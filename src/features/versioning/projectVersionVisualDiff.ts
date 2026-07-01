import type { DiagramDocument, VersionDiagramHighlights } from "../../types/diagram";
import type { LogicalWorkspaceDocument, VersionLogicalHighlights } from "../../types/logical";
import type {
  ProjectExplorerNode,
  ProjectWorkspaceFile,
  ProjectSchemaWorkspaceFile,
} from "../../types/projectExplorer";
import type { ErTranslationWorkspaceDocument } from "../../types/translation";
import { createEmptyDiagram } from "../../utils/diagram";
import { createEmptyErTranslationWorkspace } from "../../utils/erTranslation";
import { createEmptyLogicalWorkspace } from "../../utils/logicalWorkspace";
import {
  buildProjectVersionDiff,
  type ProjectVersionDiffItem,
  type ProjectVersionDiffResult,
} from "./projectVersionDiff";
import {
  cloneProjectCommitSnapshot,
  createProjectCommitSnapshot,
  stringifyProjectFileContent,
  type ProjectCommit,
  type ProjectCommitSnapshot,
  type ProjectVersioningState,
} from "./projectCommitSnapshot";

export type VersionCompareRef =
  | { kind: "working-copy" }
  | { kind: "head" }
  | { kind: "commit"; commitId: string };

export type VersionCompareViewMode = "er" | "translation" | "logical";

export type VersionCompareScope =
  | { kind: "project" }
  | { kind: "project-tree" }
  | {
      kind: "file";
      fileId: string;
      preferredView?: "er" | "translation" | "logical" | "text" | "sql" | "code";
    };

export type VersionCompareFileStatus = "added" | "modified" | "deleted" | "renamed" | "unchanged";

export interface VersionCompareFileOption {
  fileId: string;
  name: string;
  path: string;
  kind: ProjectWorkspaceFile["kind"];
  status: VersionCompareFileStatus;
  existsOnLeft: boolean;
  existsOnRight: boolean;
  leftName?: string;
  rightName?: string;
  leftPath?: string;
  rightPath?: string;
}

export type VersionCompareScopeOption =
  | { kind: "project"; changed: boolean }
  | { kind: "project-tree"; changed: boolean }
  | { kind: "legacy-diagram"; changed: boolean }
  | { kind: "file"; file: VersionCompareFileOption };

export interface VersionCompareSideResolved {
  ref: VersionCompareRef;
  label: string;
  commitId?: string;
  createdAt?: string;
  snapshot: ProjectCommitSnapshot;
  missingFile?: boolean;
  missingFileName?: string;
  readonly: true;
}

export interface VersionCompareHighlights {
  diagram: VersionDiagramHighlights;
  logical: VersionLogicalHighlights;
}

export interface VersionCompareVisualModel {
  diff: ProjectVersionDiffResult;
  left: VersionCompareSideResolved;
  right: VersionCompareSideResolved;
  highlights: {
    left: VersionCompareHighlights;
    right: VersionCompareHighlights;
  };
}

export type ResolveVersionCompareRefResult =
  | { status: "ok"; side: VersionCompareSideResolved }
  | { status: "missing-commit"; commitId: string }
  | { status: "missing-head" };

export type BuildVersionCompareVisualModelResult =
  | { status: "ok"; model: VersionCompareVisualModel }
  | { status: "missing-commit"; commitId: string }
  | { status: "missing-head" };

export type ResolveVersionCompareSidesResult =
  | { status: "ok"; left: VersionCompareSideResolved; right: VersionCompareSideResolved }
  | { status: "missing-commit"; commitId: string }
  | { status: "missing-head" };

export interface VersionCompareTextFileContents {
  fileName: string;
  language: "text" | "sql" | "unknown";
  leftContent: string;
  rightContent: string;
  leftMissing: boolean;
  rightMissing: boolean;
}

export type SnapshotViewPayload =
  | { mode: "er"; diagram: DiagramDocument }
  | { mode: "translation"; workspace: ErTranslationWorkspaceDocument; diagram: DiagramDocument }
  | { mode: "logical"; workspace: LogicalWorkspaceDocument }
  | { mode: "unavailable"; viewMode: "translation" | "logical"; reason: "not-used-in-snapshot" };

const EMPTY_DIAGRAM_HIGHLIGHTS: VersionDiagramHighlights = {
  addedNodeIds: [],
  removedNodeIds: [],
  modifiedNodeIds: [],
  layoutNodeIds: [],
  addedEdgeIds: [],
  removedEdgeIds: [],
  modifiedEdgeIds: [],
  layoutEdgeIds: [],
  focusedNodeId: null,
  focusedEdgeId: null,
};

const EMPTY_LOGICAL_HIGHLIGHTS: VersionLogicalHighlights = {
  addedTableIds: [],
  removedTableIds: [],
  modifiedTableIds: [],
  addedColumnIds: [],
  removedColumnIds: [],
  modifiedColumnIds: [],
  addedForeignKeyIds: [],
  removedForeignKeyIds: [],
  modifiedForeignKeyIds: [],
  addedEdgeIds: [],
  removedEdgeIds: [],
  modifiedEdgeIds: [],
  focusedTableId: null,
  focusedColumnId: null,
  focusedForeignKeyId: null,
};

function cloneDiagramHighlights(highlights: VersionDiagramHighlights): VersionDiagramHighlights {
  return {
    addedNodeIds: [...highlights.addedNodeIds],
    removedNodeIds: [...highlights.removedNodeIds],
    modifiedNodeIds: [...highlights.modifiedNodeIds],
    layoutNodeIds: [...highlights.layoutNodeIds],
    addedEdgeIds: [...highlights.addedEdgeIds],
    removedEdgeIds: [...highlights.removedEdgeIds],
    modifiedEdgeIds: [...highlights.modifiedEdgeIds],
    layoutEdgeIds: [...highlights.layoutEdgeIds],
    focusedNodeId: highlights.focusedNodeId ?? null,
    focusedEdgeId: highlights.focusedEdgeId ?? null,
  };
}

function cloneLogicalHighlights(highlights: VersionLogicalHighlights): VersionLogicalHighlights {
  return {
    addedTableIds: [...highlights.addedTableIds],
    removedTableIds: [...highlights.removedTableIds],
    modifiedTableIds: [...highlights.modifiedTableIds],
    addedColumnIds: [...highlights.addedColumnIds],
    removedColumnIds: [...highlights.removedColumnIds],
    modifiedColumnIds: [...highlights.modifiedColumnIds],
    addedForeignKeyIds: [...highlights.addedForeignKeyIds],
    removedForeignKeyIds: [...highlights.removedForeignKeyIds],
    modifiedForeignKeyIds: [...highlights.modifiedForeignKeyIds],
    addedEdgeIds: [...highlights.addedEdgeIds],
    removedEdgeIds: [...highlights.removedEdgeIds],
    modifiedEdgeIds: [...highlights.modifiedEdgeIds],
    focusedTableId: highlights.focusedTableId ?? null,
    focusedColumnId: highlights.focusedColumnId ?? null,
    focusedForeignKeyId: highlights.focusedForeignKeyId ?? null,
  };
}

function findCommit(versioning: ProjectVersioningState, commitId: string): ProjectCommit | null {
  return versioning.commits.find((commit) => commit.id === commitId) ?? null;
}

function hasProjectWorkspace(snapshot: ProjectCommitSnapshot): boolean {
  return Boolean(snapshot.project && snapshot.files);
}

function hasItems<T>(items: T[] | undefined): boolean {
  return Array.isArray(items) && items.length > 0;
}

function getDiagramSemanticSignature(diagram: DiagramDocument): string {
  return JSON.stringify({
    nodes: diagram.nodes.map((node) => ({
      id: node.id,
      type: node.type,
      label: node.label,
      weak: "weak" in node ? node.weak : undefined,
      optional: "optional" in node ? node.optional : undefined,
      multivalued: "multivalued" in node ? node.multivalued : undefined,
      composite: "composite" in node ? node.composite : undefined,
      cardinality: "cardinality" in node ? node.cardinality : undefined,
    })),
    edges: diagram.edges.map((edge) => ({
      id: edge.id,
      type: edge.type,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      label: edge.label,
      cardinality: "cardinality" in edge ? edge.cardinality : undefined,
      generalizationGroupId: "generalizationGroupId" in edge ? edge.generalizationGroupId : undefined,
    })),
    generalizationGroups: diagram.generalizationGroups ?? [],
    notes: diagram.notes ?? [],
  });
}

export function hasSnapshotTranslationWork(snapshot: ProjectCommitSnapshot): boolean {
  const workspace = snapshot.translationWorkspace;
  if (snapshot.diagramView === "translation" || snapshot.diagramView === "logical") {
    return true;
  }

  if (
    hasItems(workspace.translation.decisions) ||
    hasItems(workspace.translation.mappings) ||
    hasItems(workspace.translation.conflicts)
  ) {
    return true;
  }

  return getDiagramSemanticSignature(workspace.translatedDiagram) !== getDiagramSemanticSignature(snapshot.diagram);
}

export function hasSnapshotLogicalWork(snapshot: ProjectCommitSnapshot): boolean {
  const workspace = snapshot.logicalWorkspace;
  if (snapshot.logicalGenerated || snapshot.diagramView === "logical") {
    return true;
  }

  return (
    hasItems(workspace.model.tables) ||
    hasItems(workspace.model.foreignKeys) ||
    hasItems(workspace.model.uniqueConstraints) ||
    hasItems(workspace.model.edges) ||
    hasItems(workspace.translation.decisions) ||
    hasItems(workspace.translation.mappings) ||
    hasItems(workspace.translation.conflicts)
  );
}

function shortCommitId(commitId: string): string {
  return commitId.slice(0, 8);
}

function findFileNode(snapshot: ProjectCommitSnapshot, fileId: string): ProjectExplorerNode | undefined {
  return snapshot.project?.fileTree.find((node) => node.fileId === fileId);
}

function buildNodePath(snapshot: ProjectCommitSnapshot, node: ProjectExplorerNode | undefined, fallbackName: string): string {
  if (!node || !snapshot.project) {
    return fallbackName;
  }

  const byId = new Map(snapshot.project.fileTree.map((item) => [item.id, item]));
  const names = [node.name];
  let parentId = node.parentId;
  while (parentId) {
    const parent = byId.get(parentId);
    if (!parent || parent.id === snapshot.project.rootId) {
      break;
    }
    names.unshift(parent.name);
    parentId = parent.parentId;
  }

  return names.join("/");
}

function getFileDisplayName(snapshot: ProjectCommitSnapshot, fileId: string, file?: ProjectWorkspaceFile): string {
  return findFileNode(snapshot, fileId)?.name ?? file?.name ?? fileId;
}

function getFilePath(snapshot: ProjectCommitSnapshot, fileId: string, file?: ProjectWorkspaceFile): string {
  return buildNodePath(snapshot, findFileNode(snapshot, fileId), getFileDisplayName(snapshot, fileId, file));
}

function getFileContentSignatureIgnoringName(file: ProjectWorkspaceFile, canonicalName: string): string {
  return stringifyProjectFileContent({ ...file, name: canonicalName } as ProjectWorkspaceFile);
}

function getScopedFileKind(leftFile: ProjectWorkspaceFile | undefined, rightFile: ProjectWorkspaceFile | undefined): ProjectWorkspaceFile["kind"] {
  return (rightFile ?? leftFile)?.kind ?? "unknown";
}

function statusRank(status: VersionCompareFileStatus): number {
  switch (status) {
    case "modified":
      return 0;
    case "added":
      return 1;
    case "deleted":
      return 2;
    case "renamed":
      return 3;
    case "unchanged":
    default:
      return 4;
  }
}

function splitRenamedId(id: string, side: "left" | "right"): string {
  const separatorIndex = id.indexOf("->");
  if (separatorIndex < 0) {
    return id;
  }

  return side === "left" ? id.slice(0, separatorIndex) : id.slice(separatorIndex + 2);
}

function addUnique(target: Set<string>, value: string | null | undefined) {
  if (value && value.trim().length > 0) {
    target.add(value);
  }
}

function isDiagramNodeItem(item: ProjectVersionDiffItem): boolean {
  return item.path?.startsWith("diagram.nodes.") === true;
}

function isDiagramEdgeItem(item: ProjectVersionDiffItem): boolean {
  return item.path?.startsWith("diagram.edges.") === true;
}

function isLayoutNodeItem(item: ProjectVersionDiffItem): boolean {
  return item.kind === "node-position" || item.kind === "node-size" || item.kind === "node-layout";
}

function isLayoutEdgeItem(item: ProjectVersionDiffItem): boolean {
  return item.kind === "edge-offset";
}

function columnIdFromItemId(itemId: string): string {
  return itemId;
}

function createDiagramHighlights(input: {
  addedNodeIds?: Set<string>;
  removedNodeIds?: Set<string>;
  modifiedNodeIds?: Set<string>;
  layoutNodeIds?: Set<string>;
  addedEdgeIds?: Set<string>;
  removedEdgeIds?: Set<string>;
  modifiedEdgeIds?: Set<string>;
  layoutEdgeIds?: Set<string>;
}): VersionDiagramHighlights {
  return {
    ...cloneDiagramHighlights(EMPTY_DIAGRAM_HIGHLIGHTS),
    addedNodeIds: [...(input.addedNodeIds ?? new Set<string>())],
    removedNodeIds: [...(input.removedNodeIds ?? new Set<string>())],
    modifiedNodeIds: [...(input.modifiedNodeIds ?? new Set<string>())],
    layoutNodeIds: [...(input.layoutNodeIds ?? new Set<string>())],
    addedEdgeIds: [...(input.addedEdgeIds ?? new Set<string>())],
    removedEdgeIds: [...(input.removedEdgeIds ?? new Set<string>())],
    modifiedEdgeIds: [...(input.modifiedEdgeIds ?? new Set<string>())],
    layoutEdgeIds: [...(input.layoutEdgeIds ?? new Set<string>())],
  };
}

function createLogicalHighlights(input: {
  addedTableIds?: Set<string>;
  removedTableIds?: Set<string>;
  modifiedTableIds?: Set<string>;
  addedColumnIds?: Set<string>;
  removedColumnIds?: Set<string>;
  modifiedColumnIds?: Set<string>;
  addedForeignKeyIds?: Set<string>;
  removedForeignKeyIds?: Set<string>;
  modifiedForeignKeyIds?: Set<string>;
  addedEdgeIds?: Set<string>;
  removedEdgeIds?: Set<string>;
  modifiedEdgeIds?: Set<string>;
}): VersionLogicalHighlights {
  return {
    ...cloneLogicalHighlights(EMPTY_LOGICAL_HIGHLIGHTS),
    addedTableIds: [...(input.addedTableIds ?? new Set<string>())],
    removedTableIds: [...(input.removedTableIds ?? new Set<string>())],
    modifiedTableIds: [...(input.modifiedTableIds ?? new Set<string>())],
    addedColumnIds: [...(input.addedColumnIds ?? new Set<string>())],
    removedColumnIds: [...(input.removedColumnIds ?? new Set<string>())],
    modifiedColumnIds: [...(input.modifiedColumnIds ?? new Set<string>())],
    addedForeignKeyIds: [...(input.addedForeignKeyIds ?? new Set<string>())],
    removedForeignKeyIds: [...(input.removedForeignKeyIds ?? new Set<string>())],
    modifiedForeignKeyIds: [...(input.modifiedForeignKeyIds ?? new Set<string>())],
    addedEdgeIds: [...(input.addedEdgeIds ?? new Set<string>())],
    removedEdgeIds: [...(input.removedEdgeIds ?? new Set<string>())],
    modifiedEdgeIds: [...(input.modifiedEdgeIds ?? new Set<string>())],
  };
}

export function resolveVersionCompareRef(
  versioning: ProjectVersioningState,
  currentSnapshot: ProjectCommitSnapshot,
  ref: VersionCompareRef,
): ResolveVersionCompareRefResult {
  if (ref.kind === "working-copy") {
    return {
      status: "ok",
      side: {
        ref,
        label: "Working copy",
        snapshot: cloneProjectCommitSnapshot(currentSnapshot),
        readonly: true,
      },
    };
  }

  const commitId = ref.kind === "head" ? versioning.headCommitId : ref.commitId;
  if (!commitId) {
    return ref.kind === "head" ? { status: "missing-head" } : { status: "missing-commit", commitId: ref.commitId };
  }

  const commit = findCommit(versioning, commitId);
  if (!commit) {
    return { status: "missing-commit", commitId };
  }

  return {
    status: "ok",
    side: {
      ref,
      label: ref.kind === "head" ? `HEAD ${shortCommitId(commit.id)}` : commit.message,
      commitId: commit.id,
      createdAt: commit.createdAt,
      snapshot: cloneProjectCommitSnapshot(commit.snapshot),
      readonly: true,
    },
  };
}

export function resolveVersionCompareSides(
  versioning: ProjectVersioningState,
  currentSnapshot: ProjectCommitSnapshot,
  leftRef: VersionCompareRef,
  rightRef: VersionCompareRef,
): ResolveVersionCompareSidesResult {
  const left = resolveVersionCompareRef(versioning, currentSnapshot, leftRef);
  if (left.status !== "ok") {
    return left;
  }

  const right = resolveVersionCompareRef(versioning, currentSnapshot, rightRef);
  if (right.status !== "ok") {
    return right;
  }

  return { status: "ok", left: left.side, right: right.side };
}

export function buildVersionCompareScopeOptions(
  leftSnapshot: ProjectCommitSnapshot,
  rightSnapshot: ProjectCommitSnapshot,
  options?: { includeUnchanged?: boolean },
): VersionCompareScopeOption[] {
  const diff = buildProjectVersionDiff(leftSnapshot, rightSnapshot);
  const projectChanged = diff.sections.project.changed;
  const treeChanged = diff.sections.files.changed || diff.sections.folders.changed || projectChanged;

  if (!hasProjectWorkspace(leftSnapshot) || !hasProjectWorkspace(rightSnapshot)) {
    return [{ kind: "legacy-diagram", changed: !diff.isEqual }];
  }

  const leftFiles = leftSnapshot.files ?? {};
  const rightFiles = rightSnapshot.files ?? {};
  const fileIds = Array.from(new Set([...Object.keys(leftFiles), ...Object.keys(rightFiles)]));
  const fileOptions = fileIds
    .map((fileId): VersionCompareFileOption => {
      const leftFile = leftFiles[fileId];
      const rightFile = rightFiles[fileId];
      const leftName = leftFile ? getFileDisplayName(leftSnapshot, fileId, leftFile) : undefined;
      const rightName = rightFile ? getFileDisplayName(rightSnapshot, fileId, rightFile) : undefined;
      const leftPath = leftFile ? getFilePath(leftSnapshot, fileId, leftFile) : undefined;
      const rightPath = rightFile ? getFilePath(rightSnapshot, fileId, rightFile) : undefined;
      const pathChanged = Boolean(leftFile && rightFile && (leftName !== rightName || leftPath !== rightPath));
      const contentChanged = Boolean(
        leftFile &&
          rightFile &&
          getFileContentSignatureIgnoringName(leftFile, rightName ?? leftName ?? leftFile.name) !==
            getFileContentSignatureIgnoringName(rightFile, rightName ?? leftName ?? rightFile.name),
      );
      const status: VersionCompareFileStatus = !leftFile
        ? "added"
        : !rightFile
          ? "deleted"
          : contentChanged
            ? "modified"
            : pathChanged
              ? "renamed"
              : "unchanged";

      return {
        fileId,
        name: rightName ?? leftName ?? fileId,
        path: rightPath ?? leftPath ?? fileId,
        kind: getScopedFileKind(leftFile, rightFile),
        status,
        existsOnLeft: Boolean(leftFile),
        existsOnRight: Boolean(rightFile),
        leftName,
        rightName,
        leftPath,
        rightPath,
      };
    })
    .filter((fileOption) => options?.includeUnchanged === true || fileOption.status !== "unchanged")
    .sort((left, right) => {
      const rankDiff = statusRank(left.status) - statusRank(right.status);
      return rankDiff !== 0 ? rankDiff : left.path.localeCompare(right.path);
    });

  const scopeOptions: VersionCompareScopeOption[] = [{ kind: "project", changed: !diff.isEqual }];
  if (treeChanged) {
    scopeOptions.push({ kind: "project-tree", changed: treeChanged });
  }
  scopeOptions.push(...fileOptions.map((file) => ({ kind: "file" as const, file })));
  return scopeOptions;
}

function stripProjectWorkspace(snapshot: ProjectCommitSnapshot): ProjectCommitSnapshot {
  return {
    ...snapshot,
    project: undefined,
    files: undefined,
    explorerView: undefined,
    activeFileId: undefined,
    activeWorkspace: undefined,
  };
}

export function createSnapshotForSchemaFile(
  baseSnapshot: ProjectCommitSnapshot,
  file: ProjectSchemaWorkspaceFile,
): ProjectCommitSnapshot {
  const schema = file.schema;
  return createProjectCommitSnapshot({
    ...stripProjectWorkspace(cloneProjectCommitSnapshot(baseSnapshot)),
    diagram: schema.diagram,
    translationWorkspace: schema.translationWorkspace,
    logicalWorkspace: schema.logicalWorkspace,
    logicalGenerated: schema.logicalGenerated,
    logicalStage: schema.logicalStage,
    diagramView: schema.view.current,
    tool: schema.workspace.tool,
    mode: schema.workspace.mode,
    viewport: schema.view.erViewport,
    selection: schema.workspace.selection,
    translationViewport: schema.view.translationViewport,
    translationSelection: schema.workspace.translationSelection,
    logicalViewport: schema.view.logicalViewport,
    logicalSelection: schema.workspace.logicalSelection,
    codeDraft: schema.workspace.codeDraft,
    codeDirty: schema.workspace.codeDirty,
    technicalPanelOpen: schema.workspace.technicalPanelOpen,
    technicalPanelTab: schema.workspace.technicalPanelTab,
    codePanelOpen: schema.workspace.codePanelOpen,
    codePanelWidth: schema.workspace.codePanelWidth,
    notesPanelOpen: schema.workspace.notesPanelOpen,
    notesPanelWidth: schema.workspace.notesPanelWidth,
    toolbarCollapsed: schema.workspace.toolbarCollapsed,
    focusMode: schema.workspace.focusMode,
    toolbarWidth: schema.workspace.toolbarWidth,
    showDiagnostics: schema.workspace.showDiagnostics,
  });
}

function createMissingSchemaSnapshot(baseSnapshot: ProjectCommitSnapshot, name: string): ProjectCommitSnapshot {
  const diagram = createEmptyDiagram(name);
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  return createProjectCommitSnapshot({
    ...stripProjectWorkspace(cloneProjectCommitSnapshot(baseSnapshot)),
    diagram,
    translationWorkspace,
    logicalWorkspace: createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram),
    logicalGenerated: false,
    logicalStage: "translation",
    diagramView: "er",
    viewport: { x: 0, y: 0, zoom: 1 },
    selection: { nodeIds: [], edgeIds: [] },
    translationViewport: { x: 0, y: 0, zoom: 1 },
    translationSelection: { nodeIds: [], edgeIds: [] },
    logicalViewport: { x: 0, y: 0, zoom: 1 },
    logicalSelection: { nodeId: null, columnId: null, edgeId: null },
    codeDraft: "",
    codeDirty: false,
  });
}

export function getScopedTextFileContents(
  leftSnapshot: ProjectCommitSnapshot,
  rightSnapshot: ProjectCommitSnapshot,
  fileId: string,
): VersionCompareTextFileContents | null {
  const leftFile = leftSnapshot.files?.[fileId];
  const rightFile = rightSnapshot.files?.[fileId];
  const file = rightFile ?? leftFile;
  if (!file || file.kind === "schema") {
    return null;
  }

  return {
    fileName: getFileDisplayName(rightSnapshot, fileId, rightFile) ?? getFileDisplayName(leftSnapshot, fileId, leftFile),
    language: file.kind === "sql" ? "sql" : file.kind === "text" ? "text" : "unknown",
    leftContent: leftFile && leftFile.kind !== "schema" ? leftFile.content : "",
    rightContent: rightFile && rightFile.kind !== "schema" ? rightFile.content : "",
    leftMissing: !leftFile,
    rightMissing: !rightFile,
  };
}

export function buildDiagramVersionHighlights(
  diff: ProjectVersionDiffResult,
  side: "left" | "right",
): VersionDiagramHighlights {
  const addedNodeIds = new Set<string>();
  const removedNodeIds = new Set<string>();
  const modifiedNodeIds = new Set<string>();
  const layoutNodeIds = new Set<string>();
  const addedEdgeIds = new Set<string>();
  const removedEdgeIds = new Set<string>();
  const modifiedEdgeIds = new Set<string>();
  const layoutEdgeIds = new Set<string>();
  const er = diff.sections.er;
  const layout = diff.sections.layout;

  if (side === "right") {
    er.added.forEach((item) => {
      if (isDiagramNodeItem(item)) addUnique(addedNodeIds, item.id);
      if (isDiagramEdgeItem(item)) addUnique(addedEdgeIds, item.id);
    });
  } else {
    er.removed.forEach((item) => {
      if (isDiagramNodeItem(item)) addUnique(removedNodeIds, item.id);
      if (isDiagramEdgeItem(item)) addUnique(removedEdgeIds, item.id);
    });
  }

  er.modified.forEach((item) => {
    const id = splitRenamedId(item.id, side);
    if (isDiagramNodeItem(item)) addUnique(modifiedNodeIds, id);
    if (isDiagramEdgeItem(item)) addUnique(modifiedEdgeIds, id);
  });
  layout.modified.forEach((item) => {
    if (isLayoutNodeItem(item)) addUnique(layoutNodeIds, item.id);
    if (isLayoutEdgeItem(item)) addUnique(layoutEdgeIds, item.id);
  });

  return createDiagramHighlights({
    addedNodeIds,
    removedNodeIds,
    modifiedNodeIds,
    layoutNodeIds,
    addedEdgeIds,
    removedEdgeIds,
    modifiedEdgeIds,
    layoutEdgeIds,
  });
}

export function buildLogicalVersionHighlights(
  diff: ProjectVersionDiffResult,
  side: "left" | "right",
): VersionLogicalHighlights {
  const addedTableIds = new Set<string>();
  const removedTableIds = new Set<string>();
  const modifiedTableIds = new Set<string>();
  const addedColumnIds = new Set<string>();
  const removedColumnIds = new Set<string>();
  const modifiedColumnIds = new Set<string>();
  const addedForeignKeyIds = new Set<string>();
  const removedForeignKeyIds = new Set<string>();
  const modifiedForeignKeyIds = new Set<string>();
  const addedEdgeIds = new Set<string>();
  const removedEdgeIds = new Set<string>();
  const modifiedEdgeIds = new Set<string>();
  const logical = diff.sections.logical;
  const visibleAdded = side === "right" ? logical.added : [];
  const visibleRemoved = side === "left" ? logical.removed : [];

  visibleAdded.forEach((item) => {
    if (item.kind === "table") addUnique(addedTableIds, item.id);
    if (item.kind === "column") addUnique(addedColumnIds, columnIdFromItemId(item.id));
    if (item.kind === "foreign-key") addUnique(addedForeignKeyIds, item.id);
    if (item.kind === "logical-edge") addUnique(addedEdgeIds, item.id);
  });
  visibleRemoved.forEach((item) => {
    if (item.kind === "table") addUnique(removedTableIds, item.id);
    if (item.kind === "column") addUnique(removedColumnIds, columnIdFromItemId(item.id));
    if (item.kind === "foreign-key") addUnique(removedForeignKeyIds, item.id);
    if (item.kind === "logical-edge") addUnique(removedEdgeIds, item.id);
  });
  logical.modified.forEach((item) => {
    if (item.kind === "table") addUnique(modifiedTableIds, item.id);
    if (item.kind === "column") addUnique(modifiedColumnIds, columnIdFromItemId(item.id));
    if (item.kind === "foreign-key") addUnique(modifiedForeignKeyIds, item.id);
    if (item.kind === "logical-edge") addUnique(modifiedEdgeIds, item.id);
  });

  return createLogicalHighlights({
    addedTableIds,
    removedTableIds,
    modifiedTableIds,
    addedColumnIds,
    removedColumnIds,
    modifiedColumnIds,
    addedForeignKeyIds,
    removedForeignKeyIds,
    modifiedForeignKeyIds,
    addedEdgeIds,
    removedEdgeIds,
    modifiedEdgeIds,
  });
}

export function buildVersionCompareVisualModel(
  versioning: ProjectVersioningState,
  currentSnapshot: ProjectCommitSnapshot,
  leftRef: VersionCompareRef,
  rightRef: VersionCompareRef,
  scope?: VersionCompareScope,
): BuildVersionCompareVisualModelResult {
  const sides = resolveVersionCompareSides(versioning, currentSnapshot, leftRef, rightRef);
  if (sides.status !== "ok") {
    return sides;
  }

  let leftSide = sides.left;
  let rightSide = sides.right;

  if (scope?.kind === "file") {
    const leftFile = leftSide.snapshot.files?.[scope.fileId];
    const rightFile = rightSide.snapshot.files?.[scope.fileId];
    const schemaFile = (rightFile ?? leftFile) as ProjectSchemaWorkspaceFile | undefined;
    if (schemaFile?.kind === "schema") {
      const fallbackName = getFileDisplayName(rightSide.snapshot, scope.fileId, rightFile) || getFileDisplayName(leftSide.snapshot, scope.fileId, leftFile);
      leftSide = {
        ...leftSide,
        snapshot:
          leftFile?.kind === "schema"
            ? createSnapshotForSchemaFile(leftSide.snapshot, leftFile)
            : createMissingSchemaSnapshot(leftSide.snapshot, fallbackName),
        missingFile: leftFile?.kind !== "schema",
        missingFileName: fallbackName,
      };
      rightSide = {
        ...rightSide,
        snapshot:
          rightFile?.kind === "schema"
            ? createSnapshotForSchemaFile(rightSide.snapshot, rightFile)
            : createMissingSchemaSnapshot(rightSide.snapshot, fallbackName),
        missingFile: rightFile?.kind !== "schema",
        missingFileName: fallbackName,
      };
    }
  }

  const diff = buildProjectVersionDiff(leftSide.snapshot, rightSide.snapshot, {
    leftLabel: leftSide.label,
    rightLabel: rightSide.label,
    leftCommitId: leftSide.commitId,
    rightCommitId: rightSide.commitId,
  });

  return {
    status: "ok",
    model: {
      diff,
      left: leftSide,
      right: rightSide,
      highlights: {
        left: {
          diagram: buildDiagramVersionHighlights(diff, "left"),
          logical: buildLogicalVersionHighlights(diff, "left"),
        },
        right: {
          diagram: buildDiagramVersionHighlights(diff, "right"),
          logical: buildLogicalVersionHighlights(diff, "right"),
        },
      },
    },
  };
}

export function getSnapshotViewPayload(
  snapshot: ProjectCommitSnapshot,
  viewMode: VersionCompareViewMode,
): SnapshotViewPayload {
  if (viewMode === "logical") {
    if (!hasSnapshotLogicalWork(snapshot)) {
      return { mode: "unavailable", viewMode, reason: "not-used-in-snapshot" };
    }

    return {
      mode: "logical",
      workspace: cloneProjectCommitSnapshot(snapshot).logicalWorkspace,
    };
  }

  if (viewMode === "translation") {
    if (!hasSnapshotTranslationWork(snapshot)) {
      return { mode: "unavailable", viewMode, reason: "not-used-in-snapshot" };
    }

    const cloned = cloneProjectCommitSnapshot(snapshot);
    return {
      mode: "translation",
      workspace: cloned.translationWorkspace,
      diagram: cloned.translationWorkspace.translatedDiagram,
    };
  }

  return {
    mode: "er",
    diagram: cloneProjectCommitSnapshot(snapshot).diagram,
  };
}
