import type { DiagramEdge, DiagramNode, GeneralizationGroup, Viewport } from "../../types/diagram";
import type {
  LogicalColumn,
  LogicalEdge,
  LogicalForeignKey,
  LogicalIssue,
  LogicalTable,
  LogicalUniqueConstraint,
} from "../../types/logical";
import {
  cloneProjectCommitSnapshot,
  stringifyProjectCommitSnapshot,
  type ProjectCommit,
  type ProjectCommitSnapshot,
  type ProjectVersioningState,
} from "./projectCommitSnapshot";

export type ProjectVersionDiffSectionKey = "er" | "layout" | "logical" | "code" | "workspace";

export interface ProjectVersionDiffItemDetail {
  label: string;
  before?: string;
  after?: string;
}

export interface ProjectVersionDiffItem {
  id: string;
  kind: string;
  label: string;
  path?: string;
  before?: string;
  after?: string;
  details?: ProjectVersionDiffItemDetail[];
}

export interface ProjectVersionDiffSection {
  key: ProjectVersionDiffSectionKey;
  changed: boolean;
  added: ProjectVersionDiffItem[];
  removed: ProjectVersionDiffItem[];
  modified: ProjectVersionDiffItem[];
}

export interface ProjectVersionDiffSummary {
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  changedSectionCount: number;
  hasErChanges: boolean;
  hasLayoutChanges: boolean;
  hasLogicalChanges: boolean;
  hasCodeChanges: boolean;
  hasWorkspaceChanges: boolean;
}

export interface ProjectVersionDiffResult {
  leftLabel: string;
  rightLabel: string;
  leftCommitId?: string;
  rightCommitId?: string;
  comparedAt?: string;
  isEqual: boolean;
  summary: ProjectVersionDiffSummary;
  sections: Record<ProjectVersionDiffSectionKey, ProjectVersionDiffSection>;
}

export interface BuildProjectVersionDiffOptions {
  leftLabel?: string;
  rightLabel?: string;
  leftCommitId?: string;
  rightCommitId?: string;
  comparedAt?: string;
}

export interface ProjectVersionCommitDiffResult {
  status: "ok";
  diff: ProjectVersionDiffResult;
}

export interface ProjectVersionCommitDiffError {
  status: "missing-commit";
  commitId: string;
}

export type ProjectVersionCommitDiff = ProjectVersionCommitDiffResult | ProjectVersionCommitDiffError;

function stableStringify(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    return JSON.stringify(Number.isFinite(value) ? value : null);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }

  return "null";
}

function formatValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "";
  }

  return stableStringify(value);
}

function createSection(key: ProjectVersionDiffSectionKey): ProjectVersionDiffSection {
  return {
    key,
    changed: false,
    added: [],
    removed: [],
    modified: [],
  };
}

function finalizeSection(section: ProjectVersionDiffSection): ProjectVersionDiffSection {
  return {
    ...section,
    changed: section.added.length > 0 || section.removed.length > 0 || section.modified.length > 0,
  };
}

function mapById<T extends { id: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]));
}

function comparePrimitiveDetail(label: string, before: unknown, after: unknown): ProjectVersionDiffItemDetail | null {
  return stableStringify(before) === stableStringify(after)
    ? null
    : {
        label,
        before: formatValue(before),
        after: formatValue(after),
      };
}

function compactDetails(details: Array<ProjectVersionDiffItemDetail | null>): ProjectVersionDiffItemDetail[] | undefined {
  const compacted = details.filter((detail): detail is ProjectVersionDiffItemDetail => detail !== null);
  return compacted.length > 0 ? compacted : undefined;
}

function itemLabel(fallback: string, value?: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function getSemanticNode(node: DiagramNode): Record<string, unknown> {
  const { x, y, width, height, ...semanticNode } = node;
  return semanticNode;
}

function getSemanticEdge(edge: DiagramEdge): Record<string, unknown> {
  const { manualOffset, ...semanticEdge } = edge;
  return semanticEdge;
}

function getSemanticGeneralizationGroup(group: GeneralizationGroup): Record<string, unknown> {
  const { junctionOffsetX, junctionOffsetY, ...semanticGroup } = group;
  return semanticGroup;
}

function getNodeKindLabel(node: DiagramNode): string {
  return node.type;
}

function createNodeItem(node: DiagramNode): ProjectVersionDiffItem {
  return {
    id: node.id,
    kind: getNodeKindLabel(node),
    label: itemLabel(node.id, node.label),
    path: `diagram.nodes.${node.id}`,
  };
}

function createEdgeItem(edge: DiagramEdge, nodes: Map<string, DiagramNode>): ProjectVersionDiffItem {
  const source = nodes.get(edge.sourceId)?.label ?? edge.sourceId;
  const target = nodes.get(edge.targetId)?.label ?? edge.targetId;
  return {
    id: edge.id,
    kind: edge.type,
    label: edge.label.trim().length > 0 ? edge.label : `${source} -> ${target}`,
    path: `diagram.edges.${edge.id}`,
  };
}

function diffEr(left: ProjectCommitSnapshot, right: ProjectCommitSnapshot): ProjectVersionDiffSection {
  const section = createSection("er");
  const leftNodes = mapById(left.diagram.nodes);
  const rightNodes = mapById(right.diagram.nodes);

  for (const node of right.diagram.nodes) {
    if (!leftNodes.has(node.id)) {
      section.added.push(createNodeItem(node));
    }
  }

  for (const node of left.diagram.nodes) {
    if (!rightNodes.has(node.id)) {
      section.removed.push(createNodeItem(node));
    }
  }

  const pairedAddedNodeIds = new Set<string>();
  const pairedRemovedNodeIds = new Set<string>();
  for (const removedNode of left.diagram.nodes) {
    if (rightNodes.has(removedNode.id)) {
      continue;
    }

    const renamedNode = right.diagram.nodes.find(
      (candidate) =>
        !leftNodes.has(candidate.id) &&
        !pairedAddedNodeIds.has(candidate.id) &&
        candidate.type === removedNode.type,
    );
    if (!renamedNode) {
      continue;
    }

    pairedRemovedNodeIds.add(removedNode.id);
    pairedAddedNodeIds.add(renamedNode.id);
    section.modified.push({
      ...createNodeItem(renamedNode),
      id: `${removedNode.id}->${renamedNode.id}`,
      details: compactDetails([
        comparePrimitiveDetail("id", removedNode.id, renamedNode.id),
        comparePrimitiveDetail("label", removedNode.label, renamedNode.label),
      ]),
    });
  }
  section.added = section.added.filter((item) => !pairedAddedNodeIds.has(item.id));
  section.removed = section.removed.filter((item) => !pairedRemovedNodeIds.has(item.id));

  for (const [id, leftNode] of leftNodes) {
    const rightNode = rightNodes.get(id);
    if (!rightNode || stableStringify(getSemanticNode(leftNode)) === stableStringify(getSemanticNode(rightNode))) {
      continue;
    }

    section.modified.push({
      ...createNodeItem(rightNode),
      details: compactDetails([
        comparePrimitiveDetail("label", leftNode.label, rightNode.label),
        comparePrimitiveDetail("type", leftNode.type, rightNode.type),
        comparePrimitiveDetail("isWeak", "isWeak" in leftNode ? leftNode.isWeak : undefined, "isWeak" in rightNode ? rightNode.isWeak : undefined),
        comparePrimitiveDetail(
          "isIdentifier",
          "isIdentifier" in leftNode ? leftNode.isIdentifier : undefined,
          "isIdentifier" in rightNode ? rightNode.isIdentifier : undefined,
        ),
        comparePrimitiveDetail(
          "isCompositeInternal",
          "isCompositeInternal" in leftNode ? leftNode.isCompositeInternal : undefined,
          "isCompositeInternal" in rightNode ? rightNode.isCompositeInternal : undefined,
        ),
        comparePrimitiveDetail(
          "isMultivalued",
          "isMultivalued" in leftNode ? leftNode.isMultivalued : undefined,
          "isMultivalued" in rightNode ? rightNode.isMultivalued : undefined,
        ),
        comparePrimitiveDetail(
          "cardinality",
          "cardinality" in leftNode ? leftNode.cardinality : undefined,
          "cardinality" in rightNode ? rightNode.cardinality : undefined,
        ),
        comparePrimitiveDetail("properties", getSemanticNode(leftNode), getSemanticNode(rightNode)),
      ]),
    });
  }

  const leftEdges = mapById(left.diagram.edges);
  const rightEdges = mapById(right.diagram.edges);

  for (const edge of right.diagram.edges) {
    if (!leftEdges.has(edge.id)) {
      section.added.push(createEdgeItem(edge, rightNodes));
    }
  }

  for (const edge of left.diagram.edges) {
    if (!rightEdges.has(edge.id)) {
      section.removed.push(createEdgeItem(edge, leftNodes));
    }
  }

  for (const [id, leftEdge] of leftEdges) {
    const rightEdge = rightEdges.get(id);
    if (!rightEdge || stableStringify(getSemanticEdge(leftEdge)) === stableStringify(getSemanticEdge(rightEdge))) {
      continue;
    }

    section.modified.push({
      ...createEdgeItem(rightEdge, rightNodes),
      details: compactDetails([
        comparePrimitiveDetail("type", leftEdge.type, rightEdge.type),
        comparePrimitiveDetail("sourceId", leftEdge.sourceId, rightEdge.sourceId),
        comparePrimitiveDetail("targetId", leftEdge.targetId, rightEdge.targetId),
        comparePrimitiveDetail("label", leftEdge.label, rightEdge.label),
        comparePrimitiveDetail("lineStyle", leftEdge.lineStyle, rightEdge.lineStyle),
        comparePrimitiveDetail("properties", getSemanticEdge(leftEdge), getSemanticEdge(rightEdge)),
      ]),
    });
  }

  const leftGroups = mapById(left.diagram.generalizationGroups ?? []);
  const rightGroups = mapById(right.diagram.generalizationGroups ?? []);
  for (const group of rightGroups.values()) {
    if (!leftGroups.has(group.id)) {
      section.added.push({
        id: group.id,
        kind: "generalization",
        label: itemLabel(group.id, group.label),
        path: `diagram.generalizationGroups.${group.id}`,
      });
    }
  }
  for (const group of leftGroups.values()) {
    if (!rightGroups.has(group.id)) {
      section.removed.push({
        id: group.id,
        kind: "generalization",
        label: itemLabel(group.id, group.label),
        path: `diagram.generalizationGroups.${group.id}`,
      });
    }
  }
  for (const [id, leftGroup] of leftGroups) {
    const rightGroup = rightGroups.get(id);
    if (
      rightGroup &&
      stableStringify(getSemanticGeneralizationGroup(leftGroup)) !== stableStringify(getSemanticGeneralizationGroup(rightGroup))
    ) {
      section.modified.push({
        id,
        kind: "generalization",
        label: itemLabel(id, rightGroup.label),
        path: `diagram.generalizationGroups.${id}`,
        details: compactDetails([
          comparePrimitiveDetail("isaCompleteness", leftGroup.isaCompleteness, rightGroup.isaCompleteness),
          comparePrimitiveDetail("isaDisjointness", leftGroup.isaDisjointness, rightGroup.isaDisjointness),
          comparePrimitiveDetail("subtypeIds", leftGroup.subtypeIds, rightGroup.subtypeIds),
        ]),
      });
    }
  }

  if (left.diagram.notes !== right.diagram.notes) {
    section.modified.push({
      id: "diagram.notes",
      kind: "notes",
      label: "notes",
      path: "diagram.notes",
      before: left.diagram.notes,
      after: right.diagram.notes,
    });
  }

  if (stableStringify(left.diagram.meta) !== stableStringify(right.diagram.meta)) {
    section.modified.push({
      id: "diagram.meta",
      kind: "metadata",
      label: right.diagram.meta.name,
      path: "diagram.meta",
      details: compactDetails([
        comparePrimitiveDetail("name", left.diagram.meta.name, right.diagram.meta.name),
        comparePrimitiveDetail("version", left.diagram.meta.version, right.diagram.meta.version),
      ]),
    });
  }

  return finalizeSection(section);
}

function diffViewport(id: string, label: string, left: Viewport, right: Viewport): ProjectVersionDiffItem | null {
  const details = compactDetails([
    comparePrimitiveDetail("x", left.x, right.x),
    comparePrimitiveDetail("y", left.y, right.y),
    comparePrimitiveDetail("zoom", left.zoom, right.zoom),
  ]);

  return details
    ? {
        id,
        kind: "viewport",
        label,
        path: id,
        details,
      }
    : null;
}

function diffLayout(left: ProjectCommitSnapshot, right: ProjectCommitSnapshot): ProjectVersionDiffSection {
  const section = createSection("layout");
  const leftNodes = mapById(left.diagram.nodes);
  const rightNodes = mapById(right.diagram.nodes);

  for (const [id, leftNode] of leftNodes) {
    const rightNode = rightNodes.get(id);
    if (!rightNode) {
      continue;
    }

    const moved = leftNode.x !== rightNode.x || leftNode.y !== rightNode.y;
    const resized = leftNode.width !== rightNode.width || leftNode.height !== rightNode.height;
    if (moved || resized) {
      section.modified.push({
        id,
        kind: moved && resized ? "node-layout" : moved ? "node-position" : "node-size",
        label: itemLabel(id, rightNode.label),
        path: `diagram.nodes.${id}`,
        details: compactDetails([
          comparePrimitiveDetail("x", leftNode.x, rightNode.x),
          comparePrimitiveDetail("y", leftNode.y, rightNode.y),
          comparePrimitiveDetail("width", leftNode.width, rightNode.width),
          comparePrimitiveDetail("height", leftNode.height, rightNode.height),
        ]),
      });
    }
  }

  const leftEdges = mapById(left.diagram.edges);
  const rightEdges = mapById(right.diagram.edges);
  for (const [id, leftEdge] of leftEdges) {
    const rightEdge = rightEdges.get(id);
    if (rightEdge && (leftEdge.manualOffset ?? null) !== (rightEdge.manualOffset ?? null)) {
      section.modified.push({
        id,
        kind: "edge-offset",
        label: rightEdge.label || id,
        path: `diagram.edges.${id}.manualOffset`,
        details: compactDetails([comparePrimitiveDetail("manualOffset", leftEdge.manualOffset ?? null, rightEdge.manualOffset ?? null)]),
      });
    }
  }

  const viewportItems = [
    diffViewport("viewport.er", "viewport.er", left.viewport, right.viewport),
    diffViewport("viewport.translation", "viewport.translation", left.translationViewport, right.translationViewport),
    diffViewport("viewport.logical", "viewport.logical", left.logicalViewport, right.logicalViewport),
  ].filter((item): item is ProjectVersionDiffItem => item !== null);
  section.modified.push(...viewportItems);

  return finalizeSection(section);
}

function createTableItem(table: LogicalTable): ProjectVersionDiffItem {
  return {
    id: table.id,
    kind: "table",
    label: table.name,
    path: `logicalWorkspace.model.tables.${table.id}`,
  };
}

function createColumnItem(table: LogicalTable, column: LogicalColumn): ProjectVersionDiffItem {
  return {
    id: `${table.id}.${column.id}`,
    kind: "column",
    label: `${table.name}.${column.name}`,
    path: `logicalWorkspace.model.tables.${table.id}.columns.${column.id}`,
  };
}

function createForeignKeyItem(foreignKey: LogicalForeignKey): ProjectVersionDiffItem {
  return {
    id: foreignKey.id,
    kind: "foreign-key",
    label: foreignKey.name,
    path: `logicalWorkspace.model.foreignKeys.${foreignKey.id}`,
  };
}

function createUniqueConstraintItem(constraint: LogicalUniqueConstraint): ProjectVersionDiffItem {
  return {
    id: constraint.id,
    kind: "unique-constraint",
    label: constraint.id,
    path: `logicalWorkspace.model.uniqueConstraints.${constraint.id}`,
  };
}

function createLogicalIssueItem(issue: LogicalIssue): ProjectVersionDiffItem {
  return {
    id: issue.id,
    kind: `issue-${issue.level}`,
    label: issue.message,
    path: `logicalWorkspace.model.issues.${issue.id}`,
  };
}

function createLogicalEdgeItem(edge: LogicalEdge): ProjectVersionDiffItem {
  return {
    id: edge.id,
    kind: "logical-edge",
    label: edge.label,
    path: `logicalWorkspace.model.edges.${edge.id}`,
  };
}

function diffLogical(left: ProjectCommitSnapshot, right: ProjectCommitSnapshot): ProjectVersionDiffSection {
  const section = createSection("logical");

  if (left.logicalGenerated !== right.logicalGenerated) {
    section.modified.push({
      id: "logicalGenerated",
      kind: "logical-state",
      label: "logicalGenerated",
      path: "logicalGenerated",
      before: formatValue(left.logicalGenerated),
      after: formatValue(right.logicalGenerated),
    });
  }
  if (left.logicalStage !== right.logicalStage) {
    section.modified.push({
      id: "logicalStage",
      kind: "logical-state",
      label: "logicalStage",
      path: "logicalStage",
      before: left.logicalStage,
      after: right.logicalStage,
    });
  }

  const leftTables = mapById(left.logicalWorkspace.model.tables);
  const rightTables = mapById(right.logicalWorkspace.model.tables);
  for (const table of rightTables.values()) {
    if (!leftTables.has(table.id)) {
      section.added.push(createTableItem(table));
      section.added.push(...table.columns.map((column) => createColumnItem(table, column)));
    }
  }
  for (const table of leftTables.values()) {
    if (!rightTables.has(table.id)) {
      section.removed.push(createTableItem(table));
      section.removed.push(...table.columns.map((column) => createColumnItem(table, column)));
    }
  }
  for (const [id, leftTable] of leftTables) {
    const rightTable = rightTables.get(id);
    if (!rightTable) {
      continue;
    }

    const { columns: leftColumns, ...leftTableShape } = leftTable;
    const { columns: rightColumns, ...rightTableShape } = rightTable;
    if (stableStringify(leftTableShape) !== stableStringify(rightTableShape)) {
      section.modified.push({
        ...createTableItem(rightTable),
        details: compactDetails([
          comparePrimitiveDetail("name", leftTable.name, rightTable.name),
          comparePrimitiveDetail("kind", leftTable.kind, rightTable.kind),
          comparePrimitiveDetail("position", { x: leftTable.x, y: leftTable.y }, { x: rightTable.x, y: rightTable.y }),
          comparePrimitiveDetail(
            "size",
            { width: leftTable.width, height: leftTable.height },
            { width: rightTable.width, height: rightTable.height },
          ),
        ]),
      });
    }

    const leftColumnMap = mapById(leftColumns);
    const rightColumnMap = mapById(rightColumns);
    for (const column of rightColumnMap.values()) {
      if (!leftColumnMap.has(column.id)) {
        section.added.push(createColumnItem(rightTable, column));
      }
    }
    for (const column of leftColumnMap.values()) {
      if (!rightColumnMap.has(column.id)) {
        section.removed.push(createColumnItem(leftTable, column));
      }
    }
    for (const [columnId, leftColumn] of leftColumnMap) {
      const rightColumn = rightColumnMap.get(columnId);
      if (rightColumn && stableStringify(leftColumn) !== stableStringify(rightColumn)) {
        section.modified.push({
          ...createColumnItem(rightTable, rightColumn),
          details: compactDetails([
            comparePrimitiveDetail("name", leftColumn.name, rightColumn.name),
            comparePrimitiveDetail("isPrimaryKey", leftColumn.isPrimaryKey, rightColumn.isPrimaryKey),
            comparePrimitiveDetail("isForeignKey", leftColumn.isForeignKey, rightColumn.isForeignKey),
            comparePrimitiveDetail("isNullable", leftColumn.isNullable, rightColumn.isNullable),
            comparePrimitiveDetail("dataType", leftColumn.dataType, rightColumn.dataType),
            comparePrimitiveDetail("properties", leftColumn, rightColumn),
          ]),
        });
      }
    }
  }

  const leftForeignKeys = mapById(left.logicalWorkspace.model.foreignKeys);
  const rightForeignKeys = mapById(right.logicalWorkspace.model.foreignKeys);
  for (const foreignKey of rightForeignKeys.values()) {
    if (!leftForeignKeys.has(foreignKey.id)) {
      section.added.push(createForeignKeyItem(foreignKey));
    }
  }
  for (const foreignKey of leftForeignKeys.values()) {
    if (!rightForeignKeys.has(foreignKey.id)) {
      section.removed.push(createForeignKeyItem(foreignKey));
    }
  }
  for (const [id, leftForeignKey] of leftForeignKeys) {
    const rightForeignKey = rightForeignKeys.get(id);
    if (rightForeignKey && stableStringify(leftForeignKey) !== stableStringify(rightForeignKey)) {
      section.modified.push({
        ...createForeignKeyItem(rightForeignKey),
        details: compactDetails([
          comparePrimitiveDetail("name", leftForeignKey.name, rightForeignKey.name),
          comparePrimitiveDetail("required", leftForeignKey.required, rightForeignKey.required),
          comparePrimitiveDetail("unique", leftForeignKey.unique, rightForeignKey.unique),
          comparePrimitiveDetail("mappings", leftForeignKey.mappings, rightForeignKey.mappings),
        ]),
      });
    }
  }

  const leftConstraints = mapById(left.logicalWorkspace.model.uniqueConstraints);
  const rightConstraints = mapById(right.logicalWorkspace.model.uniqueConstraints);
  for (const constraint of rightConstraints.values()) {
    if (!leftConstraints.has(constraint.id)) {
      section.added.push(createUniqueConstraintItem(constraint));
    }
  }
  for (const constraint of leftConstraints.values()) {
    if (!rightConstraints.has(constraint.id)) {
      section.removed.push(createUniqueConstraintItem(constraint));
    }
  }
  for (const [id, leftConstraint] of leftConstraints) {
    const rightConstraint = rightConstraints.get(id);
    if (rightConstraint && stableStringify(leftConstraint) !== stableStringify(rightConstraint)) {
      section.modified.push({
        ...createUniqueConstraintItem(rightConstraint),
        details: compactDetails([comparePrimitiveDetail("columnIds", leftConstraint.columnIds, rightConstraint.columnIds)]),
      });
    }
  }

  const leftIssues = mapById(left.logicalWorkspace.model.issues);
  const rightIssues = mapById(right.logicalWorkspace.model.issues);
  for (const issue of rightIssues.values()) {
    if (!leftIssues.has(issue.id)) {
      section.added.push(createLogicalIssueItem(issue));
    }
  }
  for (const issue of leftIssues.values()) {
    if (!rightIssues.has(issue.id)) {
      section.removed.push(createLogicalIssueItem(issue));
    }
  }

  const leftEdges = mapById(left.logicalWorkspace.model.edges);
  const rightEdges = mapById(right.logicalWorkspace.model.edges);
  for (const edge of rightEdges.values()) {
    if (!leftEdges.has(edge.id)) {
      section.added.push(createLogicalEdgeItem(edge));
    }
  }
  for (const edge of leftEdges.values()) {
    if (!rightEdges.has(edge.id)) {
      section.removed.push(createLogicalEdgeItem(edge));
    }
  }
  for (const [id, leftEdge] of leftEdges) {
    const rightEdge = rightEdges.get(id);
    if (rightEdge && stableStringify(leftEdge) !== stableStringify(rightEdge)) {
      section.modified.push({
        ...createLogicalEdgeItem(rightEdge),
        details: compactDetails([comparePrimitiveDetail("properties", leftEdge, rightEdge)]),
      });
    }
  }

  return finalizeSection(section);
}

function countLineChanges(left: string, right: string): ProjectVersionDiffItemDetail[] {
  const leftLines = left.length > 0 ? left.split(/\r?\n/) : [];
  const rightLines = right.length > 0 ? right.split(/\r?\n/) : [];
  return [
    {
      label: "lineCount",
      before: String(leftLines.length),
      after: String(rightLines.length),
    },
  ];
}

function diffCode(left: ProjectCommitSnapshot, right: ProjectCommitSnapshot): ProjectVersionDiffSection {
  const section = createSection("code");
  if (left.codeDraft !== right.codeDraft) {
    section.modified.push({
      id: "codeDraft",
      kind: "code-draft",
      label: "codeDraft",
      path: "codeDraft",
      details: countLineChanges(left.codeDraft, right.codeDraft),
    });
  }
  if (left.codeDirty !== right.codeDirty) {
    section.modified.push({
      id: "codeDirty",
      kind: "code-dirty",
      label: "codeDirty",
      path: "codeDirty",
      before: formatValue(left.codeDirty),
      after: formatValue(right.codeDirty),
    });
  }

  return finalizeSection(section);
}

function diffWorkspaceField(
  field: keyof ProjectCommitSnapshot,
  left: ProjectCommitSnapshot,
  right: ProjectCommitSnapshot,
): ProjectVersionDiffItem | null {
  const before = left[field];
  const after = right[field];
  if (stableStringify(before) === stableStringify(after)) {
    return null;
  }

  return {
    id: `workspace.${String(field)}`,
    kind: "workspace-field",
    label: String(field),
    path: String(field),
    before: formatValue(before),
    after: formatValue(after),
  };
}

function diffWorkspace(left: ProjectCommitSnapshot, right: ProjectCommitSnapshot): ProjectVersionDiffSection {
  const section = createSection("workspace");
  const fields: Array<keyof ProjectCommitSnapshot> = [
    "tool",
    "mode",
    "selection",
    "translationSelection",
    "logicalSelection",
    "technicalPanelOpen",
    "technicalPanelTab",
    "codePanelOpen",
    "codePanelWidth",
    "notesPanelOpen",
    "notesPanelWidth",
    "toolbarCollapsed",
    "focusMode",
    "toolbarWidth",
    "showDiagnostics",
  ];

  section.modified.push(
    ...fields
      .map((field) => diffWorkspaceField(field, left, right))
      .filter((item): item is ProjectVersionDiffItem => item !== null),
  );

  return finalizeSection(section);
}

function buildSummary(sections: Record<ProjectVersionDiffSectionKey, ProjectVersionDiffSection>): ProjectVersionDiffSummary {
  const values = Object.values(sections);
  return {
    addedCount: values.reduce((total, section) => total + section.added.length, 0),
    removedCount: values.reduce((total, section) => total + section.removed.length, 0),
    modifiedCount: values.reduce((total, section) => total + section.modified.length, 0),
    changedSectionCount: values.filter((section) => section.changed).length,
    hasErChanges: sections.er.changed,
    hasLayoutChanges: sections.layout.changed,
    hasLogicalChanges: sections.logical.changed,
    hasCodeChanges: sections.code.changed,
    hasWorkspaceChanges: sections.workspace.changed,
  };
}

export function buildProjectVersionDiff(
  leftSnapshot: ProjectCommitSnapshot,
  rightSnapshot: ProjectCommitSnapshot,
  options?: BuildProjectVersionDiffOptions,
): ProjectVersionDiffResult {
  const left = cloneProjectCommitSnapshot(leftSnapshot);
  const right = cloneProjectCommitSnapshot(rightSnapshot);
  const sections: Record<ProjectVersionDiffSectionKey, ProjectVersionDiffSection> = {
    er: diffEr(left, right),
    layout: diffLayout(left, right),
    logical: diffLogical(left, right),
    code: diffCode(left, right),
    workspace: diffWorkspace(left, right),
  };
  const summary = buildSummary(sections);

  return {
    leftLabel: options?.leftLabel ?? "left",
    rightLabel: options?.rightLabel ?? "right",
    leftCommitId: options?.leftCommitId,
    rightCommitId: options?.rightCommitId,
    comparedAt: options?.comparedAt,
    isEqual: stringifyProjectCommitSnapshot(left) === stringifyProjectCommitSnapshot(right),
    summary,
    sections,
  };
}

function findCommit(versioning: ProjectVersioningState, commitId: string): ProjectCommit | null {
  return versioning.commits.find((commit) => commit.id === commitId) ?? null;
}

export function createProjectVersionDiffFromCommits(
  versioning: ProjectVersioningState,
  leftCommitId: string,
  rightCommitId: string,
): ProjectVersionCommitDiff {
  const leftCommit = findCommit(versioning, leftCommitId);
  if (!leftCommit) {
    return { status: "missing-commit", commitId: leftCommitId };
  }

  const rightCommit = findCommit(versioning, rightCommitId);
  if (!rightCommit) {
    return { status: "missing-commit", commitId: rightCommitId };
  }

  return {
    status: "ok",
    diff: buildProjectVersionDiff(leftCommit.snapshot, rightCommit.snapshot, {
      leftLabel: leftCommit.message,
      rightLabel: rightCommit.message,
      leftCommitId: leftCommit.id,
      rightCommitId: rightCommit.id,
    }),
  };
}

export function createProjectVersionDiffFromCommitAndSnapshot(
  versioning: ProjectVersioningState,
  commitId: string,
  snapshot: ProjectCommitSnapshot,
  rightLabel = "working-copy",
): ProjectVersionCommitDiff {
  const commit = findCommit(versioning, commitId);
  if (!commit) {
    return { status: "missing-commit", commitId };
  }

  return {
    status: "ok",
    diff: buildProjectVersionDiff(commit.snapshot, snapshot, {
      leftLabel: commit.message,
      rightLabel,
      leftCommitId: commit.id,
    }),
  };
}
