import type { EdgeKind, LineStyle, NodeKind, Viewport } from "./diagram";

export type LogicalTableKind = "entity" | "associative" | "relationship";
export type LogicalStage = "translation" | "schema";
export const SQL_DATA_TYPE_OPTIONS = [
  "INTEGER",
  "TEXT",
  "VARCHAR",
  "REAL",
  "NUMERIC",
  "DATE",
  "DATETIME",
  "BLOB",
  "JSON",
  "BOOLEAN",
] as const;
export type SupportedSqlDataType = (typeof SQL_DATA_TYPE_OPTIONS)[number];
export type LogicalIssueLevel = "warning" | "error";
export type LogicalTranslationStep =
  | "entities"
  | "weak-entities"
  | "relationships"
  | "multivalued-attributes"
  | "generalizations"
  | "review";
export type LogicalTranslationTargetType =
  | "entity"
  | "weak-entity"
  | "relationship"
  | "attribute"
  | "generalization";
export type LogicalTranslationDecisionStatus = "applied" | "invalid";
export type LogicalTranslationArtifactKind = "table" | "column" | "uniqueConstraint" | "foreignKey" | "edge";
export type LogicalTranslationItemStatus = "pending" | "applied" | "invalid";
export type LogicalTranslationRuleKind =
  | "entity-table-internal"
  | "entity-table-external"
  | "entity-table-without-key"
  | "weak-entity-table"
  | "relationship-foreign-key"
  | "relationship-table"
  | "multivalued-table"
  | "generalization-table-per-type"
  | "generalization-subtypes-only"
  | "generalization-single-table";

export type LogicalIssueCode =
  | "ENTITY_WITHOUT_PK"
  | "RELATIONSHIP_WITHOUT_CARDINALITY"
  | "RELATIONSHIP_UNSUPPORTED_ARITY"
  | "RELATIONSHIP_WITHOUT_PARTICIPANTS"
  | "TABLE_NAME_COLLISION"
  | "COLUMN_NAME_COLLISION"
  | "FK_NAME_COLLISION"
  | "AMBIGUOUS_MAPPING"
  | "MULTIVALUED_ATTRIBUTE"
  | "UNRESOLVED_TRANSFORMATION"
  | "INVALID_TRANSFORMATION";

export interface LogicalIssue {
  id: string;
  level: LogicalIssueLevel;
  code: LogicalIssueCode;
  message: string;
  tableId?: string;
  columnId?: string;
  relationshipId?: string;
}

export interface LogicalColumnReference {
  foreignKeyId: string;
  targetTableId: string;
  targetColumnId: string;
}

export interface LogicalColumn {
  id: string;
  name: string;
  sourceAttributeId?: string;
  sourceRelationshipId?: string;
  generatedByDecisionId?: string;
  originLabel?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique?: boolean;
  isNullable: boolean;
  isGenerated?: boolean;
  dataType?: string;
  defaultValue?: string | null;
  length?: number | null;
  precision?: number | null;
  scale?: number | null;
  references: LogicalColumnReference[];
}

export interface LogicalTable {
  id: string;
  name: string;
  kind: LogicalTableKind;
  sourceEntityId?: string;
  sourceRelationshipId?: string;
  sourceAttributeId?: string;
  generatedByDecisionId?: string;
  originLabel?: string;
  columns: LogicalColumn[];
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LogicalForeignKeyMapping {
  fromColumnId: string;
  toColumnId: string;
}

export interface LogicalForeignKey {
  id: string;
  name: string;
  fromTableId: string;
  toTableId: string;
  mappings: LogicalForeignKeyMapping[];
  sourceRelationshipId?: string;
  generatedByDecisionId?: string;
  required: boolean;
  unique?: boolean;
}

export interface LogicalUniqueConstraint {
  id: string;
  tableId: string;
  columnIds: string[];
  generatedByDecisionId?: string;
  originLabel?: string;
}

export interface LogicalEdge {
  id: string;
  foreignKeyId: string;
  fromTableId: string;
  toTableId: string;
  label: string;
}

export interface LogicalModel {
  meta: {
    name: string;
    generatedAt: string;
    sourceDiagramVersion: number;
    sourceSignature: string;
  };
  tables: LogicalTable[];
  foreignKeys: LogicalForeignKey[];
  uniqueConstraints: LogicalUniqueConstraint[];
  edges: LogicalEdge[];
  issues: LogicalIssue[];
}

export interface LogicalTranslationDecision {
  id: string;
  targetType: LogicalTranslationTargetType;
  targetId: string;
  step: LogicalTranslationStep;
  rule: LogicalTranslationRuleKind;
  summary: string;
  appliedAt: string;
  status: LogicalTranslationDecisionStatus;
  configuration?: Record<string, string | string[] | boolean | number | null | undefined>;
}

export interface LogicalTranslationArtifactRef {
  kind: LogicalTranslationArtifactKind;
  id: string;
  label: string;
}

export interface LogicalTranslationMapping {
  decisionId: string;
  targetType: LogicalTranslationTargetType;
  targetId: string;
  summary: string;
  artifacts: LogicalTranslationArtifactRef[];
}

export interface LogicalTranslationConflict {
  id: string;
  targetType: LogicalTranslationTargetType;
  targetId: string;
  level: LogicalIssueLevel;
  message: string;
  decisionId?: string;
}

export interface LogicalTranslationChoice {
  id: string;
  step: LogicalTranslationStep;
  rule: LogicalTranslationRuleKind;
  label: string;
  description: string;
  summary: string;
  configuration?: Record<string, string | string[] | boolean | number | null | undefined>;
  previewLines?: string[];
  recommended?: boolean;
}

export interface LogicalTranslationItem {
  id: string;
  targetType: LogicalTranslationTargetType;
  step: LogicalTranslationStep;
  label: string;
  description: string;
  status: LogicalTranslationItemStatus;
  currentDecisionId?: string;
  currentSummary?: string;
  choiceIds: string[];
  conflictMessages: string[];
}

export interface LogicalTranslationState {
  meta: {
    createdAt: string;
    updatedAt: string;
    sourceSignature: string;
  };
  decisions: LogicalTranslationDecision[];
  mappings: LogicalTranslationMapping[];
  conflicts: LogicalTranslationConflict[];
}

export type LogicalTransformationElementStatus = "unresolved" | "transformed" | "invalid";
export type LogicalTransformationNodeKind = "er-node" | "logical-table";
export type LogicalTransformationNodeRenderType =
  | "entity"
  | "weak-entity"
  | "relationship"
  | "attribute"
  | "multivalued-attribute"
  | "table";
export type LogicalTransformationEdgeKind = "er-edge" | "foreign-key";
export type LogicalTransformationEdgeRenderType = Extract<EdgeKind, "connector" | "attribute" | "inheritance"> | "foreign-key";

export interface LogicalTransformationColumn {
  id: string;
  name: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isNullable: boolean;
  dataType?: string;
  defaultValue?: string | null;
  length?: number | null;
  precision?: number | null;
  scale?: number | null;
  generatedByDecisionId?: string;
  references: LogicalColumnReference[];
  relatedTargetKeys: string[];
}

export interface LogicalTransformationNode {
  id: string;
  kind: LogicalTransformationNodeKind;
  renderType: LogicalTransformationNodeRenderType;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: LogicalTransformationElementStatus;
  sourceNodeId?: string;
  sourceNodeType?: NodeKind;
  tableId?: string;
  generatedByDecisionIds: string[];
  relatedTargetKeys: string[];
  columns?: LogicalTransformationColumn[];
}

export interface LogicalTransformationEdge {
  id: string;
  kind: LogicalTransformationEdgeKind;
  renderType: LogicalTransformationEdgeRenderType;
  sourceId: string;
  targetId: string;
  label: string;
  status: LogicalTransformationElementStatus;
  sourceEdgeId?: string;
  sourceEdgeType?: EdgeKind;
  lineStyle?: LineStyle;
  manualOffset?: number;
  cardinalityLabel?: string;
  isaDisjointness?: "disjoint" | "overlap";
  isaCompleteness?: "total" | "partial";
  foreignKeyId?: string;
  generatedByDecisionIds: string[];
  relatedTargetKeys: string[];
}

export interface LogicalTransformationState {
  meta: {
    updatedAt: string;
    sourceSignature: string;
  };
  nodes: LogicalTransformationNode[];
  edges: LogicalTransformationEdge[];
}

export interface LogicalWorkspaceDocument {
  model: LogicalModel;
  translation: LogicalTranslationState;
  transformation: LogicalTransformationState;
}

export interface LogicalSelection {
  nodeId: string | null;
  columnId: string | null;
  edgeId: string | null;
}

export interface VersionLogicalHighlights {
  addedTableIds: string[];
  removedTableIds: string[];
  modifiedTableIds: string[];
  addedColumnIds: string[];
  removedColumnIds: string[];
  modifiedColumnIds: string[];
  addedForeignKeyIds: string[];
  removedForeignKeyIds: string[];
  modifiedForeignKeyIds: string[];
  addedEdgeIds: string[];
  removedEdgeIds: string[];
  modifiedEdgeIds: string[];
  focusedTableId?: string | null;
  focusedColumnId?: string | null;
  focusedForeignKeyId?: string | null;
}

export const EMPTY_LOGICAL_SELECTION: LogicalSelection = {
  nodeId: null,
  columnId: null,
  edgeId: null,
};

export interface LogicalViewState {
  viewport: Viewport;
  selection: LogicalSelection;
}
