import type {
  AttributeNode,
  Bounds,
  DiagramEdge,
  DiagramNode,
  EntityNode,
  RelationshipNode,
} from "../types/diagram";
import {
  buildAttributeLayoutBounds,
  distributeAttributesAroundHost,
  FIXED_ATTRIBUTE_MARKER_GAP,
} from "./attributeLayout";

export interface SqlReverseAttributeLayoutOptions {
  markerGap?: number;
  collisionPadding?: number;
}

interface ResolvedSqlReverseAttributeLayoutOptions {
  markerGap: number;
  collisionPadding: number;
}

interface LayoutBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type AttributeOwner = EntityNode | RelationshipNode;

const DEFAULT_OPTIONS: ResolvedSqlReverseAttributeLayoutOptions = {
  markerGap: FIXED_ATTRIBUTE_MARKER_GAP,
  collisionPadding: 12,
};

export function layoutSqlReverseAttributes(
  attributes: AttributeNode[],
  edges: DiagramEdge[],
  nodeById: Map<string, DiagramNode>,
  occupied: LayoutBounds[],
  options?: SqlReverseAttributeLayoutOptions,
): void {
  const resolvedOptions = resolveOptions(options);
  const attributesByOwnerId = groupAttributesByOwner(attributes, edges, nodeById);

  [...attributesByOwnerId.entries()]
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .forEach(([ownerId, ownerAttributes]) => {
      const owner = nodeById.get(ownerId);
      if (!owner || (owner.type !== "entity" && owner.type !== "relationship")) {
        return;
      }

      const sortedAttributes = sortAttributesForOwner(ownerAttributes);
      const laidOut = distributeAttributesAroundHost(owner, sortedAttributes, {
        markerGap: resolvedOptions.markerGap,
        collisionPadding: resolvedOptions.collisionPadding,
        occupiedBounds: occupied.map(({ x, y, width, height }) => ({ x, y, width, height })),
        preserveInputOrder: true,
      });

      laidOut.forEach((attribute) => {
        const target = nodeById.get(attribute.id);
        if (target?.type === "attribute") {
          target.x = attribute.x;
          target.y = attribute.y;
        }
        occupied.push(layoutBoundsFromAttribute(owner, attribute, resolvedOptions.collisionPadding));
      });
    });
}

function resolveOptions(
  options: SqlReverseAttributeLayoutOptions | undefined,
): ResolvedSqlReverseAttributeLayoutOptions {
  return {
    ...DEFAULT_OPTIONS,
    ...options,
  };
}

function groupAttributesByOwner(
  attributes: AttributeNode[],
  edges: DiagramEdge[],
  nodeById: Map<string, DiagramNode>,
): Map<string, AttributeNode[]> {
  const attributesByOwnerId = new Map<string, AttributeNode[]>();

  attributes.forEach((attribute) => {
    const owner = findAttributeOwner(attribute, edges, nodeById);
    if (!owner) {
      return;
    }
    const bucket = attributesByOwnerId.get(owner.id) ?? [];
    bucket.push(attribute);
    attributesByOwnerId.set(owner.id, bucket);
  });

  return attributesByOwnerId;
}

function findAttributeOwner(
  attribute: AttributeNode,
  edges: DiagramEdge[],
  nodeById: Map<string, DiagramNode>,
): AttributeOwner | undefined {
  const edge = edges.find((candidate) => (
    candidate.type === "attribute" &&
    (candidate.sourceId === attribute.id || candidate.targetId === attribute.id)
  ));
  if (!edge) {
    return undefined;
  }

  const ownerId = edge.sourceId === attribute.id ? edge.targetId : edge.sourceId;
  const owner = nodeById.get(ownerId);
  return owner?.type === "entity" || owner?.type === "relationship" ? owner : undefined;
}

function sortAttributesForOwner(attributes: AttributeNode[]): AttributeNode[] {
  return [...attributes].sort((left, right) => {
    if (left.isIdentifier !== right.isIdentifier) {
      return left.isIdentifier ? -1 : 1;
    }
    const labelDelta = left.label.localeCompare(right.label);
    return labelDelta !== 0 ? labelDelta : left.id.localeCompare(right.id);
  });
}

function layoutBoundsFromAttribute(
  owner: AttributeOwner,
  attribute: AttributeNode,
  padding: number,
): LayoutBounds {
  const bounds: Bounds = buildAttributeLayoutBounds(owner, attribute, padding);
  return {
    id: attribute.id,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}
