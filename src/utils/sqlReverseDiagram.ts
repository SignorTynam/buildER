import type {
  AttributeNode,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EntityNode,
  RelationshipNode,
} from "../types/diagram";
import type {
  LogicalColumn,
  LogicalForeignKey,
  LogicalIssue,
  LogicalModel,
  LogicalTable,
} from "../types/logical";
import {
  DEFAULT_SQL_REVERSE_OPTIONS,
  type SqlReverseIssue,
  type SqlReverseOptions,
  type SqlSchemaModel,
} from "../types/sqlReverse";
import { reverseSqlToLogicalModel } from "./sqlReverseLogical";

export interface SqlReverseDiagramResult {
  diagram: DiagramDocument;
  logicalModel: LogicalModel;
  sqlModel: SqlSchemaModel;
  issues: SqlReverseIssue[];
  logicalIssues: LogicalIssue[];
}

export interface LogicalToDiagramResult {
  diagram: DiagramDocument;
  logicalIssues: LogicalIssue[];
}

interface DiagramConversionContext {
  options: Required<SqlReverseOptions>;
  logicalIssues: LogicalIssue[];
  nextIssueIndex: number;
  tableById: Map<string, LogicalTable>;
  entityByTableId: Map<string, EntityNode>;
  relationshipByTableId: Map<string, RelationshipNode>;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
}

interface AssociativeTableResolution {
  table: LogicalTable;
  foreignKeys: LogicalForeignKey[];
}

export function convertLogicalModelToDiagram(
  logicalModel: LogicalModel,
  options?: SqlReverseOptions,
): LogicalToDiagramResult {
  const context: DiagramConversionContext = {
    options: resolveOptions(options),
    logicalIssues: [...logicalModel.issues],
    nextIssueIndex: logicalModel.issues.length + 1,
    tableById: new Map(logicalModel.tables.map((table) => [table.id, table])),
    entityByTableId: new Map(),
    relationshipByTableId: new Map(),
    nodes: [],
    edges: [],
  };
  const associativeResolutions = resolveAssociativeTables(logicalModel, context);
  const associativeTableIds = new Set(associativeResolutions.map((resolution) => resolution.table.id));

  logicalModel.tables
    .filter((table) => !associativeTableIds.has(table.id))
    .forEach((table) => addEntityForTable(table, context));

  associativeResolutions.forEach((resolution) => addRelationshipForAssociativeTable(resolution, context));

  logicalModel.foreignKeys
    .filter((foreignKey) => !associativeTableIds.has(foreignKey.fromTableId))
    .forEach((foreignKey) => addRelationshipForForeignKey(foreignKey, context));

  const diagram: DiagramDocument = {
    meta: {
      name: `${logicalModel.meta.name ?? "Imported SQL schema"} (ER)`,
      version: 3,
    },
    notes: "Diagramma ER generato automaticamente tramite Reverse Engineering SQL.",
    nodes: context.nodes,
    edges: filterValidEdges(context),
    generalizationGroups: [],
  };

  return {
    diagram,
    logicalIssues: context.logicalIssues,
  };
}

export function reverseSqlToDiagram(
  sourceSql: string,
  options?: SqlReverseOptions,
): SqlReverseDiagramResult {
  const logicalResult = reverseSqlToLogicalModel(sourceSql, options);
  const diagramResult = convertLogicalModelToDiagram(logicalResult.model, options);

  return {
    diagram: diagramResult.diagram,
    logicalModel: logicalResult.model,
    sqlModel: logicalResult.sqlModel,
    issues: logicalResult.issues,
    logicalIssues: diagramResult.logicalIssues,
  };
}

function resolveOptions(options?: SqlReverseOptions): Required<SqlReverseOptions> {
  return {
    ...DEFAULT_SQL_REVERSE_OPTIONS,
    ...options,
  };
}

function resolveAssociativeTables(
  logicalModel: LogicalModel,
  context: DiagramConversionContext,
): AssociativeTableResolution[] {
  if (!context.options.inferManyToManyTables) {
    return [];
  }

  return logicalModel.tables
    .filter((table) => table.kind === "associative")
    .map((table) => {
      const foreignKeys = logicalModel.foreignKeys.filter((foreignKey) => foreignKey.fromTableId === table.id);
      return isAssociativeTableToRelationship(table, foreignKeys, context.options)
        ? { table, foreignKeys }
        : null;
    })
    .filter((resolution): resolution is AssociativeTableResolution => {
      if (resolution === null) {
        return false;
      }

      const resolvedTargetCount = resolution.foreignKeys.filter((foreignKey) => {
        const targetTable = context.tableById.get(foreignKey.toTableId);
        return targetTable && targetTable.kind !== "associative";
      }).length;
      if (resolvedTargetCount < 2) {
        createLogicalIssue(context, {
          level: "warning",
          code: "INVALID_TRANSFORMATION",
          message: `La tabella associativa ${resolution.table.name} non ha almeno due entita target risolte.`,
          tableId: resolution.table.id,
        });
        return false;
      }
      return true;
    });
}

function addEntityForTable(table: LogicalTable, context: DiagramConversionContext): void {
  const entity = buildEntityNode(table);
  const primaryKeyColumns = getPrimaryKeyColumns(table);
  const visibleColumns = table.columns.filter((column) => shouldCreateEntityAttribute(column, context.options));
  const attributes = positionAttributesAroundOwner(
    entity,
    visibleColumns.map((column, index) => buildAttributeNode(column, entity, index, visibleColumns.length, context.options)),
  );

  attributes.forEach((attribute) => {
    context.nodes.push(attribute);
    context.edges.push(addAttributeEdge(entity.id, attribute.id));
  });

  const primaryKeyAttributeIds = primaryKeyColumns
    .map((column) => `attribute-${column.id}`)
    .filter((attributeId) => attributes.some((attribute) => attribute.id === attributeId));
  if (primaryKeyColumns.length > 1) {
    attributes
      .filter((attribute) => primaryKeyAttributeIds.includes(attribute.id))
      .forEach((attribute) => {
        attribute.isCompositeInternal = true;
      });
  }
  if (primaryKeyAttributeIds.length > 0) {
    entity.internalIdentifiers = [{
      id: `identifier-${table.id}-primary`,
      attributeIds: primaryKeyAttributeIds,
    }];
  }

  context.nodes.push(entity);
  context.entityByTableId.set(table.id, entity);
}

function addRelationshipForForeignKey(
  foreignKey: LogicalForeignKey,
  context: DiagramConversionContext,
): void {
  const fromTable = context.tableById.get(foreignKey.fromTableId);
  const toTable = context.tableById.get(foreignKey.toTableId);
  const fromEntity = context.entityByTableId.get(foreignKey.fromTableId);
  const toEntity = context.entityByTableId.get(foreignKey.toTableId);
  if (!fromTable || !toTable || !fromEntity || !toEntity) {
    createLogicalIssue(context, {
      level: "warning",
      code: "INVALID_TRANSFORMATION",
      message: `Relazione non creata per FK ${foreignKey.name}: entita sorgente o target mancante.`,
      relationshipId: foreignKey.id,
    });
    return;
  }

  const relationship = buildRelationshipNode(foreignKey, fromTable, toTable, fromEntity, toEntity);
  context.nodes.push(relationship);

  const fromParticipationId = addParticipation(
    fromEntity,
    relationship.id,
    foreignKey.required ? "(1,1)" : "(0,1)",
  );
  const toParticipationId = addParticipation(
    toEntity,
    relationship.id,
    foreignKey.unique ? "(0,1)" : "(0,N)",
  );

  context.edges.push(
    buildConnectorEdge(fromEntity.id, relationship.id, fromParticipationId),
    buildConnectorEdge(relationship.id, toEntity.id, toParticipationId),
  );
}

function addRelationshipForAssociativeTable(
  resolution: AssociativeTableResolution,
  context: DiagramConversionContext,
): void {
  const relationship = buildAssociativeRelationshipNode(resolution.table);
  const resolvedForeignKeys = resolution.foreignKeys
    .map((foreignKey) => ({
      foreignKey,
      targetEntity: context.entityByTableId.get(foreignKey.toTableId),
    }))
    .filter((entry): entry is { foreignKey: LogicalForeignKey; targetEntity: EntityNode } => {
      return typeof entry.targetEntity !== "undefined";
    });

  if (resolvedForeignKeys.length < 2) {
    createLogicalIssue(context, {
      level: "warning",
      code: "INVALID_TRANSFORMATION",
      message: `La tabella associativa ${resolution.table.name} non puo essere convertita in relazione molti-a-molti.`,
      tableId: resolution.table.id,
    });
    addEntityForTable(resolution.table, context);
    return;
  }

  context.nodes.push(relationship);
  context.relationshipByTableId.set(resolution.table.id, relationship);

  resolvedForeignKeys.forEach(({ targetEntity }) => {
    const participationId = addParticipation(targetEntity, relationship.id, "(0,N)");
    context.edges.push(buildConnectorEdge(relationship.id, targetEntity.id, participationId));
  });

  const foreignKeyColumnIds = new Set(getForeignKeyColumns(resolution.table).map((column) => column.id));
  const relationshipColumns = resolution.table.columns.filter((column) => !foreignKeyColumnIds.has(column.id));
  const attributes = positionAttributesAroundOwner(
    relationship,
    relationshipColumns.map((column, index) =>
      buildRelationshipAttributeNode(column, relationship, index, relationshipColumns.length),
    ),
  );
  attributes.forEach((attribute) => {
    context.nodes.push(attribute);
    context.edges.push(addAttributeEdge(relationship.id, attribute.id));
  });
}

function buildEntityNode(table: LogicalTable): EntityNode {
  return {
    id: `entity-${table.id}`,
    type: "entity",
    label: table.name,
    x: table.x,
    y: table.y,
    width: Math.max(140, table.name.length * 10 + 48),
    height: 72,
    relationshipParticipations: [],
  };
}

function buildAttributeNode(
  column: LogicalColumn,
  ownerNode: EntityNode | RelationshipNode,
  index: number,
  total: number,
  options: Required<SqlReverseOptions>,
): AttributeNode {
  const attribute: AttributeNode = {
    id: `attribute-${column.id}`,
    type: "attribute",
    label: column.name,
    x: ownerNode.x,
    y: ownerNode.y,
    width: Math.max(112, column.name.length * 8 + 36),
    height: 36,
  };

  if (column.isPrimaryKey) {
    attribute.isIdentifier = true;
  }

  return attribute;
}

function buildRelationshipAttributeNode(
  column: LogicalColumn,
  ownerNode: RelationshipNode,
  index: number,
  total: number,
): AttributeNode {
  const attribute = buildAttributeNode(column, ownerNode, index, total, resolveOptions());
  attribute.id = `attribute-${ownerNode.id}-${column.id}`;
  return attribute;
}

function addAttributeEdge(ownerId: string, attributeId: string): DiagramEdge {
  return {
    id: `attribute-edge-${ownerId}-${attributeId}`,
    type: "attribute",
    sourceId: ownerId,
    targetId: attributeId,
    label: "",
    lineStyle: "solid",
  };
}

function buildRelationshipLabel(
  foreignKey: LogicalForeignKey,
  fromTable: LogicalTable,
  toTable: LogicalTable,
): string {
  return foreignKey.name || `${fromTable.name}_${toTable.name}`;
}

function buildRelationshipNode(
  foreignKey: LogicalForeignKey,
  fromTable: LogicalTable,
  toTable: LogicalTable,
  fromEntity: EntityNode,
  toEntity: EntityNode,
): RelationshipNode {
  const label = buildRelationshipLabel(foreignKey, fromTable, toTable);
  return {
    id: `relationship-${foreignKey.id}`,
    type: "relationship",
    label,
    x: (fromEntity.x + toEntity.x) / 2,
    y: (fromEntity.y + toEntity.y) / 2 + 96,
    width: Math.max(120, label.length * 9 + 56),
    height: 64,
  };
}

function buildAssociativeRelationshipNode(table: LogicalTable): RelationshipNode {
  return {
    id: `relationship-${table.id}`,
    type: "relationship",
    label: table.name,
    x: table.x,
    y: table.y,
    width: Math.max(120, table.name.length * 9 + 56),
    height: 64,
  };
}

function addParticipation(
  entity: EntityNode,
  relationshipId: string,
  cardinality: string,
): string {
  const existingParticipations = entity.relationshipParticipations ?? [];
  const participationId = `participation-${entity.id}-${relationshipId}-${existingParticipations.length + 1}`;
  entity.relationshipParticipations = [
    ...existingParticipations,
    {
      id: participationId,
      relationshipId,
      cardinality,
    },
  ];
  return participationId;
}

function buildConnectorEdge(
  sourceId: string,
  targetId: string,
  participationId: string,
): DiagramEdge {
  return {
    id: `connector-edge-${sourceId}-${targetId}-${participationId}`,
    type: "connector",
    sourceId,
    targetId,
    label: "",
    lineStyle: "solid",
    participationId,
  };
}

function getPrimaryKeyColumns(table: LogicalTable): LogicalColumn[] {
  return table.columns.filter((column) => column.isPrimaryKey);
}

function getForeignKeyColumns(table: LogicalTable): LogicalColumn[] {
  return table.columns.filter((column) => column.isForeignKey);
}

function isAssociativeTableToRelationship(
  table: LogicalTable,
  foreignKeys: LogicalForeignKey[],
  options: Required<SqlReverseOptions>,
): boolean {
  if (!options.inferManyToManyTables || table.kind !== "associative") {
    return false;
  }
  return foreignKeys.length >= 2;
}

function createLogicalIssue(
  context: DiagramConversionContext,
  issue: Omit<LogicalIssue, "id">,
): void {
  context.logicalIssues.push({
    id: `sql-reverse-diagram-issue-${context.nextIssueIndex}`,
    ...issue,
  });
  context.nextIssueIndex += 1;
}

function shouldCreateEntityAttribute(
  column: LogicalColumn,
  options: Required<SqlReverseOptions>,
): boolean {
  if (!column.isForeignKey || column.isPrimaryKey) {
    return true;
  }
  return options.keepForeignKeyColumnsAsAttributes;
}

function positionAttributesAroundOwner<T extends AttributeNode>(
  owner: EntityNode | RelationshipNode,
  attributes: T[],
): T[] {
  const leftCount = Math.ceil(attributes.length / 2);
  return attributes.map((attribute, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const sideIndex = Math.floor(index / 2);
    const verticalOffset = (sideIndex - Math.max(0, leftCount - 1) / 2) * 54;
    return {
      ...attribute,
      x: owner.x + owner.width / 2 + side * 180 - attribute.width / 2,
      y: owner.y + owner.height / 2 + verticalOffset - attribute.height / 2,
    };
  });
}

function filterValidEdges(context: DiagramConversionContext): DiagramEdge[] {
  const nodeIds = new Set(context.nodes.map((node) => node.id));
  return context.edges.filter((edge) => {
    if (!nodeIds.has(edge.sourceId) || !nodeIds.has(edge.targetId)) {
      createLogicalIssue(context, {
        level: "warning",
        code: "INVALID_TRANSFORMATION",
        message: `Edge ${edge.id} scartato perche punta a nodi mancanti.`,
        relationshipId: edge.id,
      });
      return false;
    }

    if (edge.type !== "connector") {
      return true;
    }

    const sourceNode = context.nodes.find((node) => node.id === edge.sourceId);
    const targetNode = context.nodes.find((node) => node.id === edge.targetId);
    const entity = sourceNode?.type === "entity"
      ? sourceNode
      : targetNode?.type === "entity"
        ? targetNode
        : undefined;
    const participation = entity?.relationshipParticipations?.find((candidate) => candidate.id === edge.participationId);
    if (!participation) {
      createLogicalIssue(context, {
        level: "warning",
        code: "INVALID_TRANSFORMATION",
        message: `Connector ${edge.id} scartato per participationId non valido.`,
        relationshipId: edge.id,
      });
      return false;
    }

    return true;
  });
}
