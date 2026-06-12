import type {
  AttributeNode,
  ConnectorEdge,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EdgeKind,
  EntityNode,
  EntityRelationshipParticipation,
  RelationshipNode,
} from "../types/diagram";
import { removeDisallowedManualRouting } from "./edgeRouting";

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
    return getEdgeCardinalityValue(edge, sourceNode, targetNode) ?? "";
  }

  if (edge.type === "attribute") {
    return getEdgeCardinalityValue(edge, sourceNode, targetNode) ?? "";
  }

  return "";
}

export function shouldOpenCardinalityDialogAfterEdgeCreation(
  edgeType: EdgeKind,
  sourceNode: DiagramNode | undefined,
  targetNode: DiagramNode | undefined,
): boolean {
  return edgeType === "connector" && getConnectorParticipationContext(sourceNode, targetNode) !== undefined;
}

export function ensureConnectorParticipation(
  diagram: DiagramDocument,
  edgeId: string,
  cardinality?: ConnectorCardinality,
): { diagram: DiagramDocument; participationId: string } | null {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const connectorEdge = diagram.edges.find(
    (edge): edge is ConnectorEdge => edge.id === edgeId && edge.type === "connector",
  );
  if (!connectorEdge) {
    return null;
  }

  const context = getConnectorParticipationContext(
    nodeMap.get(connectorEdge.sourceId),
    nodeMap.get(connectorEdge.targetId),
  );
  if (!context) {
    return null;
  }

  const participationId = connectorEdge.participationId ?? `participation-${connectorEdge.id}`;
  const nextEdges = diagram.edges.map((edge) =>
    edge.id === connectorEdge.id && edge.type === "connector"
      ? removeDisallowedManualRouting({ ...edge, participationId })
      : edge,
  );
  const nextNodes = diagram.nodes.map((node) => {
    if (node.id !== context.entity.id || node.type !== "entity") {
      return node;
    }

    const participations = node.relationshipParticipations ?? [];
    const existing = participations.find((participation) => participation.id === participationId);
    const nextParticipation: EntityRelationshipParticipation = {
      ...(existing ?? { id: participationId }),
      relationshipId: context.relationship.id,
      ...(cardinality !== undefined ? { cardinality } : {}),
    };

    return {
      ...node,
      relationshipParticipations: existing
        ? participations.map((participation) =>
            participation.id === participationId ? nextParticipation : participation,
          )
        : [...participations, nextParticipation],
    };
  });

  return {
    diagram: {
      ...diagram,
      nodes: nextNodes,
      edges: nextEdges,
    },
    participationId,
  };
}

export function applyConnectorCardinalityToDiagram(
  diagram: DiagramDocument,
  edgeId: string,
  cardinality: ConnectorCardinality,
): { diagram: DiagramDocument; participationId: string } | null {
  return ensureConnectorParticipation(diagram, edgeId, cardinality);
}

export function removeTemporaryCardinalityConnector(diagram: DiagramDocument, edgeId: string): DiagramDocument {
  const edgeToRemove = diagram.edges.find(
    (edge): edge is ConnectorEdge => edge.id === edgeId && edge.type === "connector",
  );
  if (!edgeToRemove) {
    return diagram;
  }

  const participationId = edgeToRemove.participationId ?? `participation-${edgeToRemove.id}`;
  return {
    ...diagram,
    edges: diagram.edges.filter((edge) => edge.id !== edgeId),
    nodes: diagram.nodes.map((node) => {
      if (node.type !== "entity" || !node.relationshipParticipations?.some((participation) => participation.id === participationId)) {
        return node;
      }

      const relationshipParticipations = node.relationshipParticipations.filter(
        (participation) => participation.id !== participationId,
      );
      return {
        ...node,
        relationshipParticipations:
          relationshipParticipations.length > 0 ? relationshipParticipations : undefined,
      };
    }),
  };
}
