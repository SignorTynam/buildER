import type {
  AttributeNode,
  Bounds,
  DiagramEdge,
  DiagramNode,
  EntityNode,
  Point,
  RelationshipNode,
} from "../types/diagram";
import {
  buildAttributeLayoutBounds,
  getDirectAttributeLayoutSide,
  placeAttributeMarker,
  type AttributeLayoutSide,
} from "./attributeLayout";
import { boundsIntersect } from "./edgeLabelLayout";

export interface SqlReverseAttributeLayoutOptions {
  markerGap?: number;
  ringGap?: number;
  collisionPadding?: number;
  horizontalSpacing?: number;
  verticalSpacing?: number;
  beamWidth?: number;
  maxCandidatesPerAttribute?: number;
}

interface ResolvedSqlReverseAttributeLayoutOptions {
  markerGap: number;
  ringGap: number;
  collisionPadding: number;
  horizontalSpacing: number;
  verticalSpacing: number;
  beamWidth: number;
  maxCandidatesPerAttribute: number;
}

interface LayoutBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AttributeSlotCandidate {
  side: AttributeLayoutSide;
  ring: number;
  offsetIndex: number;
  offset: number;
  score: number;
}

interface PlacementState {
  placements: AttributeNode[];
  placementBounds: Bounds[];
  score: number;
}

type AttributeOwner = EntityNode | RelationshipNode;

const DEFAULT_OPTIONS: ResolvedSqlReverseAttributeLayoutOptions = {
  markerGap: 52,
  ringGap: 48,
  collisionPadding: 12,
  horizontalSpacing: 0,
  verticalSpacing: 0,
  beamWidth: 96,
  maxCandidatesPerAttribute: 14,
};

const SIDE_ORDER: AttributeLayoutSide[] = ["top", "right", "bottom", "left"];
const MAX_RING_COUNT = 4;
const BACKTRACKING_ATTRIBUTE_LIMIT = 6;
const BACKTRACKING_MAX_CANDIDATES = 8;

export function perimeterDistance(owner: AttributeOwner, attribute: AttributeNode): number {
  const bounds = buildAttributeLayoutBounds(owner, attribute, 0);
  return rectangleGapDistance(
    { x: owner.x, y: owner.y, width: owner.width, height: owner.height },
    bounds,
  );
}

function rectangleGapDistance(left: Bounds, right: Bounds): number {
  const gapX = Math.max(0, left.x - (right.x + right.width), right.x - (left.x + left.width));
  const gapY = Math.max(0, left.y - (right.y + right.height), right.y - (left.y + left.height));
  return Math.hypot(gapX, gapY);
}

export function layoutSqlReverseAttributes(
  attributes: AttributeNode[],
  edges: DiagramEdge[],
  nodeById: Map<string, DiagramNode>,
  occupied: LayoutBounds[],
  options?: SqlReverseAttributeLayoutOptions,
): void {
  const resolvedOptions = resolveOptions(options, attributes);
  const attributesByOwnerId = groupAttributesByOwner(attributes, edges, nodeById);

  [...attributesByOwnerId.entries()]
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .forEach(([ownerId, ownerAttributes]) => {
      const owner = nodeById.get(ownerId);
      if (!owner || (owner.type !== "entity" && owner.type !== "relationship")) {
        return;
      }

      const sortedAttributes = sortAttributesForOwner(ownerAttributes);
      const laidOut = layoutAttributesForOwner(
        owner,
        sortedAttributes,
        occupied,
        resolvedOptions,
      );

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
  attributes: AttributeNode[],
): ResolvedSqlReverseAttributeLayoutOptions {
  const horizontalSpacing = options?.horizontalSpacing
    ?? Math.max(86, estimateWidestLabelWidth(attributes) + 26);
  const verticalSpacing = options?.verticalSpacing
    ?? Math.max(44, Math.max(...attributes.map((attribute) => attribute.height), 36) + 10);

  return {
    ...DEFAULT_OPTIONS,
    horizontalSpacing,
    verticalSpacing,
    ...options,
  };
}

function estimateWidestLabelWidth(attributes: AttributeNode[]): number {
  if (attributes.length === 0) {
    return 112;
  }
  return attributes.reduce((max, attribute) => Math.max(max, attribute.label.length * 7 + 12), 112);
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
  const edge = edges.find((candidate) => {
    return candidate.type === "attribute"
      && (candidate.sourceId === attribute.id || candidate.targetId === attribute.id);
  });
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

function layoutAttributesForOwner(
  owner: AttributeOwner,
  attributes: AttributeNode[],
  occupied: LayoutBounds[],
  options: ResolvedSqlReverseAttributeLayoutOptions,
): AttributeNode[] {
  if (attributes.length === 0) {
    return [];
  }

  const sharedSlots = generateCandidateSlots(owner, attributes, options);
  const candidatesPerAttribute = attributes.map((attribute) =>
    pickTopCandidates(owner, attribute, sharedSlots, occupied, options),
  );

  if (attributes.length <= BACKTRACKING_ATTRIBUTE_LIMIT) {
    const limitedCandidates = candidatesPerAttribute.map((candidates) =>
      candidates.slice(0, BACKTRACKING_MAX_CANDIDATES),
    );
    const backtrackingResult = backtrackingPlacement(
      owner,
      attributes,
      limitedCandidates,
      occupied,
      options,
    );
    if (backtrackingResult) {
      return backtrackingResult;
    }
  }

  return beamSearchPlacement(owner, attributes, candidatesPerAttribute, occupied, options);
}

function pickTopCandidates(
  owner: AttributeOwner,
  attribute: AttributeNode,
  slots: Omit<AttributeSlotCandidate, "score">[],
  occupied: LayoutBounds[],
  options: ResolvedSqlReverseAttributeLayoutOptions,
): AttributeSlotCandidate[] {
  const scored = slots.map((slot) => ({
    ...slot,
    score: scoreStandaloneSlot(owner, attribute, slot, occupied, options),
  }))
    .filter((slot) => Number.isFinite(slot.score))
    .sort(compareSlotCandidates);

  const unique = dedupeCandidates(scored);
  return unique.slice(0, options.maxCandidatesPerAttribute);
}

function generateCandidateSlots(
  owner: AttributeOwner,
  ownerAttributes: AttributeNode[],
  options: ResolvedSqlReverseAttributeLayoutOptions,
): Omit<AttributeSlotCandidate, "score">[] {
  const slotCount = Math.min(Math.max(ownerAttributes.length + 3, 8), 10);
  const offsets = buildOffsetOrder(slotCount);
  const slots: Omit<AttributeSlotCandidate, "score">[] = [];

  for (let ring = 0; ring < MAX_RING_COUNT; ring += 1) {
    offsets.forEach((offset, offsetIndex) => {
      SIDE_ORDER.forEach((side) => {
        slots.push({
          side,
          ring,
          offsetIndex,
          offset,
        });
      });
    });
  }

  return slots;
}

function buildOffsetOrder(count: number): number[] {
  const offsets = [0];
  for (let index = 1; offsets.length < count; index += 1) {
    offsets.push(-index, index);
  }
  return offsets.slice(0, count);
}

function buildMarkerForSlot(
  owner: AttributeOwner,
  attribute: AttributeNode,
  side: AttributeLayoutSide,
  ring: number,
  offset: number,
  options: ResolvedSqlReverseAttributeLayoutOptions,
): Point {
  const ownerCenterX = owner.x + owner.width / 2;
  const ownerCenterY = owner.y + owner.height / 2;
  const ringGap = options.markerGap + ring * options.ringGap;
  const markerOffsetX = 10;

  if (side === "top") {
    return {
      x: ownerCenterX + offset * options.horizontalSpacing,
      y: owner.y - ringGap - attribute.height / 2,
    };
  }
  if (side === "bottom") {
    return {
      x: ownerCenterX + offset * options.horizontalSpacing,
      y: owner.y + owner.height + ringGap + attribute.height / 2,
    };
  }
  if (side === "left") {
    return {
      x: owner.x - ringGap - attribute.width + markerOffsetX,
      y: ownerCenterY + offset * options.verticalSpacing,
    };
  }

  return {
    x: owner.x + owner.width + ringGap + markerOffsetX,
    y: ownerCenterY + offset * options.verticalSpacing,
  };
}

function placeAttributeInSlot(
  owner: AttributeOwner,
  attribute: AttributeNode,
  slot: Omit<AttributeSlotCandidate, "score">,
  options: ResolvedSqlReverseAttributeLayoutOptions,
): AttributeNode {
  const marker = buildMarkerForSlot(owner, attribute, slot.side, slot.ring, slot.offset, options);
  return placeAttributeMarker(attribute, marker);
}

function scoreStandaloneSlot(
  owner: AttributeOwner,
  attribute: AttributeNode,
  slot: Omit<AttributeSlotCandidate, "score">,
  occupied: LayoutBounds[],
  options: ResolvedSqlReverseAttributeLayoutOptions,
): number {
  const candidate = placeAttributeInSlot(owner, attribute, slot, options);
  const bounds = buildAttributeLayoutBounds(owner, candidate, options.collisionPadding);

  if (collidesWithOwner(bounds, owner, options.collisionPadding)) {
    return Number.POSITIVE_INFINITY;
  }
  if (nodeBoundsOverlapOwner(candidate, owner, options.collisionPadding)) {
    return Number.POSITIVE_INFINITY;
  }
  if (collidesWithOccupied(bounds, occupied, owner.id, options.collisionPadding)) {
    return Number.POSITIVE_INFINITY;
  }

  const perimeterDist = rectangleGapDistance(
    { x: owner.x, y: owner.y, width: owner.width, height: owner.height },
    bounds,
  );
  const ringPenalty = slot.ring * 420;
  const offsetPenalty = Math.abs(slot.offset) * 28;
  const distancePenalty = Math.max(0, perimeterDist - 72) * 3.2;
  const sidePenalty = SIDE_ORDER.indexOf(slot.side) * 4;
  const offsetIndexPenalty = slot.offsetIndex * 6;

  return ringPenalty + offsetPenalty + distancePenalty + sidePenalty + offsetIndexPenalty;
}

function nodeBoundsOverlapOwner(
  attribute: AttributeNode,
  owner: AttributeOwner,
  padding: number,
): boolean {
  return boundsOverlap(
    { x: attribute.x, y: attribute.y, width: attribute.width, height: attribute.height },
    {
      id: owner.id,
      x: owner.x,
      y: owner.y,
      width: owner.width,
      height: owner.height,
    },
    padding,
  );
}

function backtrackingPlacement(
  owner: AttributeOwner,
  attributes: AttributeNode[],
  candidatesPerAttribute: AttributeSlotCandidate[][],
  occupied: LayoutBounds[],
  options: ResolvedSqlReverseAttributeLayoutOptions,
): AttributeNode[] | null {
  let bestPlacements: AttributeNode[] | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  const visit = (
    index: number,
    currentPlacements: AttributeNode[],
    currentBounds: Bounds[],
    currentScore: number,
  ): void => {
    if (currentScore >= bestScore) {
      return;
    }

    if (index >= attributes.length) {
      bestScore = currentScore + sideBalancePenalty(owner, currentPlacements);
      bestPlacements = currentPlacements;
      return;
    }

    const attribute = attributes[index];
    const candidates = candidatesPerAttribute[index] ?? [];

    candidates.forEach((slot) => {
      const candidate = placeAttributeInSlot(owner, attribute, slot, options);
      const bounds = buildAttributeLayoutBounds(owner, candidate, options.collisionPadding);
      if (currentBounds.some((placedBounds) => boundsIntersect(bounds, placedBounds))) {
        return;
      }
      if (collidesWithOccupied(bounds, occupied, owner.id, options.collisionPadding)) {
        return;
      }
      if (collidesWithOwner(bounds, owner, options.collisionPadding)) {
        return;
      }

      visit(
        index + 1,
        [...currentPlacements, candidate],
        [...currentBounds, bounds],
        currentScore + slot.score,
      );
    });
  };

  visit(0, [], [], 0);
  return bestPlacements;
}

function beamSearchPlacement(
  owner: AttributeOwner,
  attributes: AttributeNode[],
  candidatesPerAttribute: AttributeSlotCandidate[][],
  occupied: LayoutBounds[],
  options: ResolvedSqlReverseAttributeLayoutOptions,
): AttributeNode[] {
  let beam: PlacementState[] = [{ placements: [], placementBounds: [], score: 0 }];

  for (let attributeIndex = 0; attributeIndex < attributes.length; attributeIndex += 1) {
    const attribute = attributes[attributeIndex];
    const candidates = candidatesPerAttribute[attributeIndex] ?? [];
    const nextBeam: PlacementState[] = [];

    beam.forEach((state) => {
      candidates.forEach((slot) => {
        const candidate = placeAttributeInSlot(owner, attribute, slot, options);
        const bounds = buildAttributeLayoutBounds(owner, candidate, options.collisionPadding);
        if (state.placementBounds.some((placedBounds) => boundsIntersect(bounds, placedBounds))) {
          return;
        }
        if (collidesWithOccupied(bounds, occupied, owner.id, options.collisionPadding)) {
          return;
        }
        if (collidesWithOwner(bounds, owner, options.collisionPadding)) {
          return;
        }
        if (nodeBoundsOverlapOwner(candidate, owner, options.collisionPadding)) {
          return;
        }

        nextBeam.push({
          placements: [...state.placements, candidate],
          placementBounds: [...state.placementBounds, bounds],
          score: state.score + slot.score,
        });
      });
    });

    if (nextBeam.length === 0) {
      return greedyFallbackPlacement(owner, attributes, occupied, options);
    }

    nextBeam.sort((left, right) => left.score - right.score);
    beam = nextBeam.slice(0, options.beamWidth);
  }

  if (beam.length === 0) {
    return greedyFallbackPlacement(owner, attributes, occupied, options);
  }

  const bestState = beam.reduce((best, state) => {
    const stateScore = state.score + sideBalancePenalty(owner, state.placements);
    const bestScore = best.score + sideBalancePenalty(owner, best.placements);
    return stateScore < bestScore ? { ...state, score: stateScore } : best;
  });

  return bestState.placements;
}

function greedyFallbackPlacement(
  owner: AttributeOwner,
  attributes: AttributeNode[],
  occupied: LayoutBounds[],
  options: ResolvedSqlReverseAttributeLayoutOptions,
): AttributeNode[] {
  const placements: AttributeNode[] = [];
  const placementBounds: Bounds[] = [];

  attributes.forEach((attribute) => {
    const sharedSlots = generateCandidateSlots(owner, attributes, options);
    const candidates = pickTopCandidates(owner, attribute, sharedSlots, [
      ...occupied,
      ...placements.map((placed) => layoutBoundsFromAttribute(owner, placed, options.collisionPadding)),
    ], options);

    const chosen = candidates[0];
    if (!chosen) {
      const emergencySlot = generateCandidateSlots(owner, attributes, options)[0];
      if (emergencySlot) {
        const candidate = placeAttributeInSlot(owner, attribute, emergencySlot, options);
        placements.push(candidate);
        placementBounds.push(buildAttributeLayoutBounds(owner, candidate, options.collisionPadding));
      }
      return;
    }

    const candidate = placeAttributeInSlot(owner, attribute, chosen, options);
    placements.push(candidate);
    placementBounds.push(buildAttributeLayoutBounds(owner, candidate, options.collisionPadding));
  });

  return placements;
}

function sideBalancePenalty(owner: AttributeOwner, placements: AttributeNode[]): number {
  if (placements.length <= 1) {
    return 0;
  }

  const counts = new Map<AttributeLayoutSide, number>();
  placements.forEach((placement) => {
    const side = getDirectAttributeLayoutSide(owner, placement);
    counts.set(side, (counts.get(side) ?? 0) + 1);
  });

  const values = [...counts.values()];
  const max = Math.max(...values);
  const min = Math.min(...values);
  return (max - min) * 55;
}

function collidesWithOwner(bounds: Bounds, owner: AttributeOwner, padding: number): boolean {
  const ownerBounds: LayoutBounds = {
    id: owner.id,
    x: owner.x - padding,
    y: owner.y - padding,
    width: owner.width + padding * 2,
    height: owner.height + padding * 2,
  };
  return boundsOverlap(bounds, ownerBounds, 0);
}

function collidesWithOccupied(
  bounds: Bounds,
  occupied: LayoutBounds[],
  ownerId: string,
  padding: number,
): boolean {
  return occupied.some((candidate) => {
    if (candidate.id === ownerId) {
      return false;
    }
    return boundsOverlap(bounds, candidate, padding);
  });
}

function boundsOverlap(a: Bounds, b: LayoutBounds, padding: number): boolean {
  return (
    a.x < b.x + b.width + padding
    && a.x + a.width + padding > b.x
    && a.y < b.y + b.height + padding
    && a.y + a.height + padding > b.y
  );
}

function layoutBoundsFromAttribute(
  owner: AttributeOwner,
  attribute: AttributeNode,
  padding: number,
): LayoutBounds {
  const bounds = buildAttributeLayoutBounds(owner, attribute, padding);
  return {
    id: attribute.id,
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
  };
}

function compareSlotCandidates(left: AttributeSlotCandidate, right: AttributeSlotCandidate): number {
  const scoreDelta = left.score - right.score;
  if (Math.abs(scoreDelta) > 0.001) {
    return scoreDelta;
  }

  const sideDelta = SIDE_ORDER.indexOf(left.side) - SIDE_ORDER.indexOf(right.side);
  if (sideDelta !== 0) {
    return sideDelta;
  }

  const ringDelta = left.ring - right.ring;
  if (ringDelta !== 0) {
    return ringDelta;
  }

  const offsetDelta = left.offsetIndex - right.offsetIndex;
  if (offsetDelta !== 0) {
    return offsetDelta;
  }

  return left.offset - right.offset;
}

function dedupeCandidates(candidates: AttributeSlotCandidate[]): AttributeSlotCandidate[] {
  const seen = new Set<string>();
  const unique: AttributeSlotCandidate[] = [];

  candidates.forEach((candidate) => {
    const key = `${candidate.side}|${candidate.ring}|${candidate.offset}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(candidate);
  });

  return unique;
}
