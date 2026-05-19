import type { ConnectorCardinality } from "../utils/cardinality";

export type NodeKind = "entity" | "relationship" | "attribute";
export type EdgeKind = "connector" | "attribute" | "inheritance";
export type ToolKind =
  | "move"
  | "select"
  | "delete"
  | "entity"
  | "relationship"
  | "attribute"
  | "connector"
  | "inheritance";
export type EditorMode = "edit";
export type LineStyle = "solid" | "dashed";
export type IsaDisjointness = "disjoint" | "overlap";
export type IsaCompleteness = "total" | "partial";

export interface GeneralizationGroup {
  id: string;
  supertypeId: string;
  subtypeIds: string[];
  isaCompleteness?: IsaCompleteness;
  isaDisjointness?: IsaDisjointness;
  label?: string;
  junctionOffsetX?: number;
  junctionOffsetY?: number;
}

export type DiagramHighlightKind = "pending" | "blocked" | "selected";

export interface DiagramHighlights {
  pendingNodeIds?: string[];
  pendingEdgeIds?: string[];
  blockedNodeIds?: string[];
  blockedEdgeIds?: string[];
  selectedNodeIds?: string[];
  selectedEdgeIds?: string[];
}

export interface Point {
  x: number;
  y: number;
}

export interface Bounds extends Point {
  width: number;
  height: number;
}

export interface BaseNode extends Bounds {
  id: string;
  type: NodeKind;
  label: string;
}

export interface InternalIdentifier {
  id: string;
  attributeIds: string[];
}

export interface ExternalIdentifierImportPart {
  id: string;
  relationshipId: string;
  sourceEntityId: string;
  importedIdentifierId: string;
}

export interface ExternalIdentifier {
  id: string;
  importedParts: ExternalIdentifierImportPart[];
  localAttributeIds: string[];
  offset?: number;
  markerOffsetX?: number;
  markerOffsetY?: number;
}

export interface EntityRelationshipParticipation {
  id: string;
  relationshipId: string;
  cardinality?: ConnectorCardinality;
  role?: string;
}

export interface EntityNode extends BaseNode {
  type: "entity";
  isWeak?: boolean;
  internalIdentifiers?: InternalIdentifier[];
  externalIdentifiers?: ExternalIdentifier[];
  relationshipParticipations?: EntityRelationshipParticipation[];
}

export interface RelationshipNode extends BaseNode {
  type: "relationship";
}

export interface AttributeNode extends BaseNode {
  type: "attribute";
  isIdentifier?: boolean;
  isCompositeInternal?: boolean;
  isMultivalued?: boolean;
  cardinality?: ConnectorCardinality;
}

export type DiagramNode =
  | EntityNode
  | RelationshipNode
  | AttributeNode;

export interface BaseEdge {
  id: string;
  type: EdgeKind;
  sourceId: string;
  targetId: string;
  label: string;
  lineStyle: LineStyle;
  manualOffset?: number;
}

export interface ConnectorEdge extends BaseEdge {
  type: "connector";
  participationId?: string;
}

export interface AttributeEdge extends BaseEdge {
  type: "attribute";
}

export interface InheritanceEdge extends BaseEdge {
  type: "inheritance";
  isaDisjointness?: IsaDisjointness;
  isaCompleteness?: IsaCompleteness;
  generalizationGroupId?: string;
}

export type DiagramEdge = ConnectorEdge | AttributeEdge | InheritanceEdge;

export interface DiagramDocument {
  meta: {
    name: string;
    version: number;
  };
  notes: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  generalizationGroups?: GeneralizationGroup[];
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface SelectionState {
  nodeIds: string[];
  edgeIds: string[];
}

export interface ValidationIssue {
  id: string;
  level: "warning" | "error";
  message: string;
  targetId: string;
  targetType: "node" | "edge";
}

export interface EdgeGeometry {
  points: Point[];
  labelPoint: Point;
}

export interface IsaSubtypeBranch {
  subtypeId: string;
  from: Point;
  to: Point;
}

export interface IsaGroupLayout {
  triangleCenter: Point;
  trunkTop: Point;
  trunkBottom: Point;
  busStart: Point;
  busEnd: Point;
  busY: number;
  labelPoint: Point;
  subtypeBranches: IsaSubtypeBranch[];
}
