import type {
  AttributeNode,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EntityNode,
  RelationshipNode,
} from "../types/diagram";
import { GRID_SIZE, snapValue } from "./geometry";

export interface SqlReverseLayoutOptions {
  marginX?: number;
  marginY?: number;
  entityGapX?: number;
  entityGapY?: number;
  attributeGapX?: number;
  attributeGapY?: number;
  attributeSpacingX?: number;
  attributeSpacingY?: number;
  relationshipOffset?: number;
  collisionPadding?: number;
}

interface RequiredSqlReverseLayoutOptions {
  marginX: number;
  marginY: number;
  entityGapX: number;
  entityGapY: number;
  attributeGapX: number;
  attributeGapY: number;
  attributeSpacingX: number;
  attributeSpacingY: number;
  relationshipOffset: number;
  collisionPadding: number;
}

interface LayoutBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

type AttributeSide = "left" | "right" | "top" | "bottom";

const DEFAULT_SQL_REVERSE_LAYOUT_OPTIONS: RequiredSqlReverseLayoutOptions = {
  marginX: 180,
  marginY: 140,
  entityGapX: 360,
  entityGapY: 220,
  attributeGapX: 180,
  attributeGapY: 120,
  attributeSpacingX: 150,
  attributeSpacingY: 56,
  relationshipOffset: 90,
  collisionPadding: 28,
};

export function layoutSqlReverseDiagram(
  diagram: DiagramDocument,
  options?: SqlReverseLayoutOptions,
): DiagramDocument {
  const resolvedOptions = resolveLayoutOptions(options);
  const nodes = cloneDiagramNodes(diagram.nodes).map((node) => resizeNodeForLabel(node));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const entityNodes = sortNodesDeterministically(nodes.filter((node): node is EntityNode => node.type === "entity"));
  const relationshipNodes = sortNodesDeterministically(
    nodes.filter((node): node is RelationshipNode => node.type === "relationship"),
  );
  const attributeNodes = nodes.filter((node): node is AttributeNode => node.type === "attribute");
  const occupied: LayoutBounds[] = [];

  entityNodes.forEach((entity) => {
    const laidOut = placeEntity(entity, occupied, resolvedOptions);
    Object.assign(entity, laidOut);
    occupied.push(getNodeBounds(entity));
  });

  layoutRelationships(relationshipNodes, diagram.edges, nodeById, occupied, resolvedOptions);

  layoutAttributes(attributeNodes, diagram.edges, nodeById, occupied, resolvedOptions);

  const shiftedNodes = shiftDiagramToPositiveArea(nodes, resolvedOptions).map((node) => ({
    ...node,
    x: snapValue(node.x, GRID_SIZE),
    y: snapValue(node.y, GRID_SIZE),
  }));

  return {
    ...diagram,
    nodes: shiftedNodes,
    edges: diagram.edges.map((edge) => ({ ...edge })),
    generalizationGroups: diagram.generalizationGroups ? diagram.generalizationGroups.map((group) => ({ ...group })) : diagram.generalizationGroups,
  };
}

function resolveLayoutOptions(options?: SqlReverseLayoutOptions): RequiredSqlReverseLayoutOptions {
  return {
    ...DEFAULT_SQL_REVERSE_LAYOUT_OPTIONS,
    ...options,
  };
}

function cloneDiagramNodes(nodes: DiagramNode[]): DiagramNode[] {
  return nodes.map((node) => {
    if (node.type === "entity") {
      return {
        ...node,
        internalIdentifiers: node.internalIdentifiers?.map((identifier) => ({
          ...identifier,
          attributeIds: [...identifier.attributeIds],
        })),
        externalIdentifiers: node.externalIdentifiers?.map((identifier) => ({
          ...identifier,
          importedParts: identifier.importedParts.map((part) => ({ ...part })),
          localAttributeIds: [...identifier.localAttributeIds],
        })),
        relationshipParticipations: node.relationshipParticipations?.map((participation) => ({ ...participation })),
      };
    }

    return { ...node };
  });
}

function resizeNodeForLabel<T extends DiagramNode>(node: T): T {
  if (node.type === "entity") {
    return {
      ...node,
      width: Math.max(node.width, 140, node.label.length * 10 + 48),
      height: Math.max(node.height, 72),
    };
  }

  if (node.type === "relationship") {
    return {
      ...node,
      width: Math.max(node.width, 120, node.label.length * 9 + 56),
      height: Math.max(node.height, 64),
    };
  }

  return {
    ...node,
    width: Math.max(node.width, 112, node.label.length * 8 + 36),
    height: Math.max(node.height, 36),
  };
}

function sortNodesDeterministically<T extends DiagramNode>(nodes: T[]): T[] {
  return [...nodes].sort((left, right) => {
    const yDelta = left.y - right.y;
    if (Math.abs(yDelta) > 0.001) {
      return yDelta;
    }

    const xDelta = left.x - right.x;
    if (Math.abs(xDelta) > 0.001) {
      return xDelta;
    }

    const labelDelta = left.label.localeCompare(right.label);
    return labelDelta !== 0 ? labelDelta : left.id.localeCompare(right.id);
  });
}

function getNodeBounds(node: DiagramNode): LayoutBounds {
  return {
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

function boundsOverlap(a: LayoutBounds, b: LayoutBounds, padding: number): boolean {
  return (
    a.x < b.x + b.width + padding
    && a.x + a.width + padding > b.x
    && a.y < b.y + b.height + padding
    && a.y + a.height + padding > b.y
  );
}

function collidesWithAny(
  candidate: LayoutBounds,
  occupied: LayoutBounds[],
  padding: number,
  ignoreIds?: ReadonlySet<string>,
): boolean {
  return occupied.some((bounds) => {
    if (ignoreIds?.has(bounds.id)) {
      return false;
    }
    return boundsOverlap(candidate, bounds, padding);
  });
}

function placeEntity(
  entity: EntityNode,
  occupied: LayoutBounds[],
  options: RequiredSqlReverseLayoutOptions,
): Pick<EntityNode, "x" | "y"> {
  let x = snapValue(Math.max(options.marginX, entity.x), GRID_SIZE);
  let y = snapValue(Math.max(options.marginY, entity.y), GRID_SIZE);
  let candidate = { ...getNodeBounds(entity), x, y };
  let attempts = 0;

  while (collidesWithAny(candidate, occupied, options.collisionPadding) && attempts < 240) {
    attempts += 1;
    if (attempts % 4 === 0) {
      x += options.entityGapX;
      y = options.marginY;
    } else {
      y += options.entityGapY;
    }
    candidate = { ...candidate, x: snapValue(x, GRID_SIZE), y: snapValue(y, GRID_SIZE) };
  }

  return {
    x: candidate.x,
    y: candidate.y,
  };
}

function layoutRelationships(
  relationships: RelationshipNode[],
  edges: DiagramEdge[],
  nodeById: Map<string, DiagramNode>,
  occupied: LayoutBounds[],
  options: RequiredSqlReverseLayoutOptions,
): void {
  const pairCounts = new Map<string, number>();

  relationships.forEach((relationship) => {
    const linkedEntities = getRelationshipEntities(relationship, edges, nodeById);
    const nextPosition = linkedEntities.length <= 1
      ? positionSelfRelationship(relationship, linkedEntities[0], options)
      : positionRelationshipBetweenEntities(relationship, linkedEntities, pairCounts, options);
    let candidate = {
      ...getNodeBounds(relationship),
      x: nextPosition.x,
      y: nextPosition.y,
    };
    let attempts = 0;

    while (collidesWithAny(candidate, occupied, options.collisionPadding) && attempts < 120) {
      attempts += 1;
      const direction = attempts % 2 === 0 ? 1 : -1;
      candidate = {
        ...candidate,
        x: snapValue(nextPosition.x + direction * Math.ceil(attempts / 2) * options.relationshipOffset, GRID_SIZE),
        y: snapValue(nextPosition.y + Math.ceil(attempts / 3) * options.relationshipOffset, GRID_SIZE),
      };
    }

    relationship.x = candidate.x;
    relationship.y = candidate.y;
    occupied.push(getNodeBounds(relationship));
  });
}

function getRelationshipEntities(
  relationship: RelationshipNode,
  edges: DiagramEdge[],
  nodeById: Map<string, DiagramNode>,
): EntityNode[] {
  const entities = edges
    .filter((edge) => edge.type === "connector" && (edge.sourceId === relationship.id || edge.targetId === relationship.id))
    .map((edge) => {
      const otherId = edge.sourceId === relationship.id ? edge.targetId : edge.sourceId;
      const otherNode = nodeById.get(otherId);
      return otherNode?.type === "entity" ? otherNode : null;
    })
    .filter((node): node is EntityNode => node !== null);
  const entityById = new Map(entities.map((entity) => [entity.id, entity]));
  return [...entityById.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function positionSelfRelationship(
  relationship: RelationshipNode,
  entity: EntityNode | undefined,
  options: RequiredSqlReverseLayoutOptions,
): { x: number; y: number } {
  if (!entity) {
    return {
      x: snapValue(Math.max(options.marginX, relationship.x), GRID_SIZE),
      y: snapValue(Math.max(options.marginY, relationship.y), GRID_SIZE),
    };
  }

  return {
    x: snapValue(entity.x + entity.width + 220, GRID_SIZE),
    y: snapValue(entity.y + entity.height + 80, GRID_SIZE),
  };
}

function positionRelationshipBetweenEntities(
  relationship: RelationshipNode,
  entities: EntityNode[],
  pairCounts: Map<string, number>,
  options: RequiredSqlReverseLayoutOptions,
): { x: number; y: number } {
  const centers = entities.map((entity) => ({
    x: entity.x + entity.width / 2,
    y: entity.y + entity.height / 2,
  }));
  const center = {
    x: centers.reduce((sum, point) => sum + point.x, 0) / centers.length,
    y: centers.reduce((sum, point) => sum + point.y, 0) / centers.length,
  };

  if (entities.length === 2) {
    const pairKey = entities.map((entity) => entity.id).sort().join("|");
    const count = pairCounts.get(pairKey) ?? 0;
    pairCounts.set(pairKey, count + 1);
    const offset = pairOffset(count, options.relationshipOffset);
    const [first, second] = centers;
    const dx = (second?.x ?? center.x) - (first?.x ?? center.x);
    const dy = (second?.y ?? center.y) - (first?.y ?? center.y);
    const length = Math.hypot(dx, dy) || 1;
    const perpendicular = {
      x: -dy / length,
      y: dx / length,
    };

    return {
      x: snapValue(center.x + perpendicular.x * offset - relationship.width / 2, GRID_SIZE),
      y: snapValue(center.y + perpendicular.y * offset - relationship.height / 2, GRID_SIZE),
    };
  }

  return {
    x: snapValue(center.x - relationship.width / 2, GRID_SIZE),
    y: snapValue(center.y - relationship.height / 2, GRID_SIZE),
  };
}

function pairOffset(index: number, step: number): number {
  if (index === 0) {
    return 0;
  }
  const magnitude = Math.ceil(index / 2) * step;
  return index % 2 === 0 ? -magnitude : magnitude;
}

function layoutAttributes(
  attributes: AttributeNode[],
  edges: DiagramEdge[],
  nodeById: Map<string, DiagramNode>,
  occupied: LayoutBounds[],
  options: RequiredSqlReverseLayoutOptions,
): void {
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

  [...attributesByOwnerId.entries()]
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .forEach(([ownerId, ownerAttributes]) => {
      const owner = nodeById.get(ownerId);
      if (!owner || (owner.type !== "entity" && owner.type !== "relationship" && owner.type !== "attribute")) {
        return;
      }

      const laidOut = layoutAttributesForOwner(
        owner,
        ownerAttributes.sort((left, right) => {
          if (left.isIdentifier !== right.isIdentifier) {
            return left.isIdentifier ? -1 : 1;
          }
          return left.id.localeCompare(right.id);
        }),
        occupied,
        options,
      );
      laidOut.forEach((attribute) => {
        const target = nodeById.get(attribute.id);
      if (target?.type === "attribute") {
        target.x = attribute.x;
        target.y = attribute.y;
      }
    });
  });
}

function findAttributeOwner(
  attribute: AttributeNode,
  edges: DiagramEdge[],
  nodeById: Map<string, DiagramNode>,
): EntityNode | RelationshipNode | AttributeNode | undefined {
  const edge = edges.find((candidate) => {
    return candidate.type === "attribute" && (candidate.sourceId === attribute.id || candidate.targetId === attribute.id);
  });
  if (!edge) {
    return undefined;
  }
  const ownerId = edge.sourceId === attribute.id ? edge.targetId : edge.sourceId;
  const owner = nodeById.get(ownerId);
  return owner?.type === "entity" || owner?.type === "relationship" || owner?.type === "attribute" ? owner : undefined;
}

function layoutAttributesForOwner(
  owner: EntityNode | RelationshipNode | AttributeNode,
  attributes: AttributeNode[],
  occupiedBounds: LayoutBounds[],
  options: RequiredSqlReverseLayoutOptions,
): AttributeNode[] {
  const sideCounts = buildAttributeSideCounts(attributes);
  const usedSideIndexes = new Map<AttributeSide, number>();
  const laidOut: AttributeNode[] = [];

  attributes.forEach((attribute, index) => {
    const preferredSides = getPreferredAttributeSides(attribute, index);
    let placed: AttributeNode | null = null;

    for (let ring = 1; ring <= 6 && !placed; ring += 1) {
      for (const side of preferredSides) {
        const sideIndex = usedSideIndexes.get(side) ?? 0;
        const candidate = placeAttributeCandidate(attribute, owner, side, sideIndex, sideCounts.get(side) ?? 1, ring, options);
        if (!collidesWithAny(getNodeBounds(candidate), occupiedBounds, options.collisionPadding)) {
          usedSideIndexes.set(side, sideIndex + 1);
          placed = candidate;
          break;
        }
      }
    }

    if (!placed) {
      const side = preferredSides[0] ?? "right";
      const sideIndex = usedSideIndexes.get(side) ?? 0;
      usedSideIndexes.set(side, sideIndex + 1);
      placed = placeAttributeCandidate(attribute, owner, side, sideIndex, sideCounts.get(side) ?? 1, 7, options);
    }

    laidOut.push(placed);
    occupiedBounds.push(getNodeBounds(placed));
  });

  return laidOut;
}

function buildAttributeSideCounts(attributes: AttributeNode[]): Map<AttributeSide, number> {
  const counts = new Map<AttributeSide, number>([
    ["left", 0],
    ["right", 0],
    ["top", 0],
    ["bottom", 0],
  ]);

  attributes.forEach((attribute, index) => {
    const side = getPreferredAttributeSides(attribute, index)[0] ?? "right";
    counts.set(side, (counts.get(side) ?? 0) + 1);
  });

  return counts;
}

function getPreferredAttributeSides(attribute: AttributeNode, index: number): AttributeSide[] {
  if (attribute.isIdentifier) {
    return index % 2 === 0 ? ["top", "left", "right", "bottom"] : ["left", "top", "right", "bottom"];
  }

  const sideOrders: AttributeSide[][] = [
    ["right", "bottom", "top", "left"],
    ["left", "bottom", "top", "right"],
    ["bottom", "right", "left", "top"],
    ["top", "right", "left", "bottom"],
  ];
  return sideOrders[index % sideOrders.length] ?? ["right", "left", "bottom", "top"];
}

function placeAttributeCandidate(
  attribute: AttributeNode,
  owner: EntityNode | RelationshipNode | AttributeNode,
  side: AttributeSide,
  sideIndex: number,
  sideCount: number,
  ring: number,
  options: RequiredSqlReverseLayoutOptions,
): AttributeNode {
  const centeredIndex = sideIndex - (Math.max(1, sideCount) - 1) / 2;
  const ownerCenterX = owner.x + owner.width / 2;
  const ownerCenterY = owner.y + owner.height / 2;

  if (side === "left") {
    return {
      ...attribute,
      x: snapValue(owner.x - options.attributeGapX * ring - attribute.width, GRID_SIZE),
      y: snapValue(ownerCenterY + centeredIndex * options.attributeSpacingY - attribute.height / 2, GRID_SIZE),
    };
  }
  if (side === "right") {
    return {
      ...attribute,
      x: snapValue(owner.x + owner.width + options.attributeGapX * ring, GRID_SIZE),
      y: snapValue(ownerCenterY + centeredIndex * options.attributeSpacingY - attribute.height / 2, GRID_SIZE),
    };
  }
  if (side === "top") {
    return {
      ...attribute,
      x: snapValue(ownerCenterX + centeredIndex * options.attributeSpacingX - attribute.width / 2, GRID_SIZE),
      y: snapValue(owner.y - options.attributeGapY * ring - attribute.height, GRID_SIZE),
    };
  }

  return {
    ...attribute,
    x: snapValue(ownerCenterX + centeredIndex * options.attributeSpacingX - attribute.width / 2, GRID_SIZE),
    y: snapValue(owner.y + owner.height + options.attributeGapY * ring, GRID_SIZE),
  };
}

function shiftDiagramToPositiveArea(
  nodes: DiagramNode[],
  options: RequiredSqlReverseLayoutOptions,
): DiagramNode[] {
  if (nodes.length === 0) {
    return nodes;
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const shiftX = minX < options.marginX ? options.marginX - minX : 0;
  const shiftY = minY < options.marginY ? options.marginY - minY : 0;

  if (shiftX === 0 && shiftY === 0) {
    return nodes;
  }

  return nodes.map((node) => ({
    ...node,
    x: node.x + shiftX,
    y: node.y + shiftY,
  }));
}
