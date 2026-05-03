import type {
  AttributeNode,
  ConnectorEdge,
  DiagramEdge,
  DiagramNode,
  EntityNode,
  EntityRelationshipParticipation,
  RelationshipNode,
} from "../types/diagram";

export const CONNECTOR_CARDINALITY_PLACEHOLDER = "(X,Y)";

export const CONNECTOR_CARDINALITIES = [
  "(0,0)",
  "(0,1)",
  "(0,N)",
  "(1,0)",
  "(1,1)",
  "(1,N)",
  "(N,0)",
  "(N,1)",
  "(N,N)",
] as const;

export const CONNECTOR_CARDINALITY_PRESETS = ["(0,1)", "(1,1)", "(0,N)", "(1,N)"] as const;

export type ConnectorCardinality = string;

export interface CardinalityParseResult {
  valid: boolean;
  value?: ConnectorCardinality;
  reason?: string;
}

function parseCardinalityBound(value: string): number | "N" | null {
  const normalized = value.trim().toUpperCase();
  if (normalized === "N") {
    return "N";
  }

  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeCardinalityInput(value: string | undefined): CardinalityParseResult {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) {
    return { valid: false, reason: "Cardinalita mancante." };
  }

  const compact = raw.replace(/\s+/g, "").toUpperCase();
  const unwrapped = compact.startsWith("(") && compact.endsWith(")") ? compact.slice(1, -1) : compact;
  const separatorMatch = unwrapped.match(/^([^,.]+?)(?:\.\.\.|\.{2}|,)([^,.]+)$/);
  if (!separatorMatch) {
    return { valid: false, reason: "Usa una forma come 1...4, 1..N o (1,N)." };
  }

  const min = parseCardinalityBound(separatorMatch[1]);
  const max = parseCardinalityBound(separatorMatch[2]);
  if (min === null || max === null) {
    return { valid: false, reason: "Minimo e massimo devono essere interi >= 0 oppure N." };
  }

  if (typeof min === "number" && typeof max === "number" && min > max) {
    return { valid: false, reason: "Il minimo non puo essere maggiore del massimo." };
  }

  return { valid: true, value: `(${min},${max})` };
}

export function isSupportedCardinality(value: string): value is ConnectorCardinality {
  return normalizeCardinalityInput(value).valid;
}

export function normalizeSupportedCardinality(value: string | undefined): ConnectorCardinality | undefined {
  return normalizeCardinalityInput(value).value;
}

export function getAttributeCardinalityOwner(
  sourceNode: DiagramNode | undefined,
  targetNode: DiagramNode | undefined,
): AttributeNode | undefined {
  if (sourceNode?.type === "attribute" && targetNode?.type !== "attribute") {
    return sourceNode;
  }

  if (targetNode?.type === "attribute" && sourceNode?.type !== "attribute") {
    return targetNode;
  }

  if (sourceNode?.type === "attribute" && targetNode?.type === "attribute") {
    return sourceNode;
  }

  return undefined;
}

export function getConnectorParticipationContext(
  sourceNode: DiagramNode | undefined,
  targetNode: DiagramNode | undefined,
): { entity: EntityNode; relationship: RelationshipNode } | undefined {
  if (sourceNode?.type === "entity" && targetNode?.type === "relationship") {
    return {
      entity: sourceNode,
      relationship: targetNode,
    };
  }

  if (sourceNode?.type === "relationship" && targetNode?.type === "entity") {
    return {
      entity: targetNode,
      relationship: sourceNode,
    };
  }

  return undefined;
}

export function getEntityParticipationById(
  entity: EntityNode | undefined,
  participationId: string | undefined,
): EntityRelationshipParticipation | undefined {
  if (!entity || !participationId) {
    return undefined;
  }

  return entity.relationshipParticipations?.find((participation) => participation.id === participationId);
}

export function getConnectorParticipation(
  edge: ConnectorEdge,
  sourceNode: DiagramNode | undefined,
  targetNode: DiagramNode | undefined,
): EntityRelationshipParticipation | undefined {
  const context = getConnectorParticipationContext(sourceNode, targetNode);
  if (!context) {
    return undefined;
  }

  const participation = getEntityParticipationById(context.entity, edge.participationId);
  if (!participation || participation.relationshipId !== context.relationship.id) {
    return undefined;
  }

  return participation;
}

export function getEdgeCardinalityValue(
  edge: DiagramEdge,
  sourceNode: DiagramNode | undefined,
  targetNode: DiagramNode | undefined,
): ConnectorCardinality | undefined {
  if (edge.type === "attribute") {
    return getAttributeCardinalityOwner(sourceNode, targetNode)?.cardinality;
  }

  if (edge.type === "connector") {
    return getConnectorParticipation(edge, sourceNode, targetNode)?.cardinality;
  }

  return undefined;
}

export function getEdgeCardinalityLabel(
  edge: DiagramEdge,
  sourceNode: DiagramNode | undefined,
  targetNode: DiagramNode | undefined,
): string {
  if (edge.type === "connector") {
    return getEdgeCardinalityValue(edge, sourceNode, targetNode) ?? CONNECTOR_CARDINALITY_PLACEHOLDER;
  }

  if (edge.type === "attribute") {
    return getEdgeCardinalityValue(edge, sourceNode, targetNode) ?? "";
  }

  return "";
}
