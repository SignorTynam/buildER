import type { AttributeNode, Bounds, EntityNode, Point, RelationshipNode } from "../types/diagram";
import { buildAttributeLabelBounds, boundsIntersect } from "./edgeLabelLayout";
import { GRID_SIZE, snapValue } from "./geometry";

export type AttributeLayoutSide = "top" | "right" | "bottom" | "left";

type AttributeLayoutHost = EntityNode | RelationshipNode;

export interface AttributeLayoutSlot {
  side: AttributeLayoutSide;
  lane: number;
  offsetIndex: number;
  marker: Point;
}

export interface AttributeLayoutOptions {
  markerGap?: number;
  laneGap?: number;
  collisionPadding?: number;
  occupiedBounds?: Bounds[];
  sidePenalties?: Partial<Record<AttributeLayoutSide, number>>;
  preferredSides?: AttributeLayoutSide[];
  preserveInputOrder?: boolean;
}

const ATTRIBUTE_MARKER_OFFSET_X = 10;
const ATTRIBUTE_MARKER_RADIUS = 8;
const DEFAULT_MARKER_GAP = 28;
const DEFAULT_LANE_GAP = 44;
const COLLISION_PADDING = 5;
const MIN_SIDE_SPACING = 38;
const MIN_ROW_SPACING = 86;
const MAX_LANE_COUNT = 6;
const EXTRA_SLOT_COUNT = 8;
const CANDIDATE_SIDE_ORDER: AttributeLayoutSide[] = ["left", "right", "top", "bottom"];

export function getAttributeMarkerCenter(attribute: AttributeNode): Point {
  return {
    x: attribute.x + ATTRIBUTE_MARKER_OFFSET_X,
    y: attribute.y + attribute.height / 2,
  };
}

export function placeAttributeMarker(
  attribute: AttributeNode,
  marker: Point,
  snapToGrid = true,
): AttributeNode {
  return {
    ...attribute,
    x: snapToGrid
      ? snapValue(marker.x - ATTRIBUTE_MARKER_OFFSET_X, GRID_SIZE)
      : marker.x - ATTRIBUTE_MARKER_OFFSET_X,
    y: snapToGrid
      ? snapValue(marker.y - attribute.height / 2, GRID_SIZE)
      : marker.y - attribute.height / 2,
  };
}

export function getDirectAttributeLayoutSide(
  host: AttributeLayoutHost,
  attribute: AttributeNode,
): AttributeLayoutSide {
  const marker = getAttributeMarkerCenter(attribute);
  const hostCenterX = host.x + host.width / 2;
  const hostCenterY = host.y + host.height / 2;
  const deltaX = marker.x - hostCenterX;
  const deltaY = marker.y - hostCenterY;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX < 0 ? "left" : "right";
  }

  return deltaY < 0 ? "top" : "bottom";
}

function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

function unionBounds(bounds: Bounds[]): Bounds {
  const left = Math.min(...bounds.map((bound) => bound.x));
  const top = Math.min(...bounds.map((bound) => bound.y));
  const right = Math.max(...bounds.map((bound) => bound.x + bound.width));
  const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

function getHostBounds(host: AttributeLayoutHost, padding = COLLISION_PADDING): Bounds {
  return padBounds(
    {
      x: host.x,
      y: host.y,
      width: host.width,
      height: host.height,
    },
    padding,
  );
}

function getAttributeLabelLayoutForSide(attribute: AttributeNode, side: AttributeLayoutSide) {
  const marker = getAttributeMarkerCenter(attribute);
  const cy = attribute.y + attribute.height / 2;

  if (side === "right") {
    return {
      x: attribute.x + 24,
      y: cy,
      textAnchor: "start" as const,
    };
  }
  if (side === "left") {
    return {
      x: attribute.x - 6,
      y: cy,
      textAnchor: "end" as const,
    };
  }
  if (side === "top") {
    return {
      x: marker.x,
      y: attribute.y - 8,
      textAnchor: "middle" as const,
    };
  }

  return {
    x: marker.x,
    y: attribute.y + attribute.height + 8,
    textAnchor: "middle" as const,
  };
}

export function buildAttributeLayoutBounds(
  host: AttributeLayoutHost,
  attribute: AttributeNode,
  padding = COLLISION_PADDING,
): Bounds {
  if (attribute.isMultivalued === true) {
    return padBounds(
      {
        x: attribute.x,
        y: attribute.y,
        width: attribute.width,
        height: attribute.height,
      },
      padding,
    );
  }

  const marker = getAttributeMarkerCenter(attribute);
  const side = getDirectAttributeLayoutSide(host, attribute);
  const markerBounds = padBounds(
    {
      x: marker.x - ATTRIBUTE_MARKER_RADIUS,
      y: marker.y - ATTRIBUTE_MARKER_RADIUS,
      width: ATTRIBUTE_MARKER_RADIUS * 2,
      height: ATTRIBUTE_MARKER_RADIUS * 2,
    },
    padding,
  );
  const labelBounds = buildAttributeLabelBounds(
    attribute.label,
    getAttributeLabelLayoutForSide(attribute, side),
    padding,
  );

  return unionBounds([markerBounds, labelBounds]);
}

function estimateAttributeLabelWidth(attribute: AttributeNode): number {
  return attribute.label.length * 7 + 12 + COLLISION_PADDING * 2;
}

function getSideSpacing(attributes: AttributeNode[]): number {
  const maxMultivaluedHeight = attributes.reduce(
    (max, attribute) => Math.max(max, attribute.isMultivalued === true ? attribute.height : 0),
    0,
  );
  const simpleAttributeSpacing = ATTRIBUTE_MARKER_RADIUS * 2 + COLLISION_PADDING * 2 + 8;

  return Math.max(
    MIN_SIDE_SPACING,
    maxMultivaluedHeight > 0 ? maxMultivaluedHeight + 10 : simpleAttributeSpacing,
  );
}

function getRowSpacing(attributes: AttributeNode[]): number {
  const widestLabel = attributes.reduce(
    (max, attribute) => Math.max(max, estimateAttributeLabelWidth(attribute)),
    0,
  );
  return Math.max(MIN_ROW_SPACING, Math.min(180, widestLabel + 26));
}

function getHorizontalLaneGap(attributes: AttributeNode[], options?: AttributeLayoutOptions): number {
  const widestLabel = attributes.reduce(
    (max, attribute) => Math.max(max, estimateAttributeLabelWidth(attribute)),
    0,
  );
  return Math.max(options?.laneGap ?? DEFAULT_LANE_GAP, widestLabel + 34);
}

function getVerticalLaneGap(options?: AttributeLayoutOptions): number {
  return Math.max(options?.laneGap ?? DEFAULT_LANE_GAP, DEFAULT_LANE_GAP);
}

function getOffsetOrder(count: number): number[] {
  const offsets = [0];
  for (let index = 1; offsets.length < count; index += 1) {
    offsets.push(-index, index);
  }
  return offsets.slice(0, count);
}

function getCandidateSideOrder(options?: AttributeLayoutOptions): AttributeLayoutSide[] {
  const sides: AttributeLayoutSide[] = [];

  options?.preferredSides?.forEach((side) => {
    if (!sides.includes(side)) {
      sides.push(side);
    }
  });
  CANDIDATE_SIDE_ORDER.forEach((side) => {
    if (!sides.includes(side)) {
      sides.push(side);
    }
  });

  return sides;
}

function buildSlotForSide(options: {
  host: AttributeLayoutHost;
  attributes: AttributeNode[];
  side: AttributeLayoutSide;
  lane: number;
  offset: number;
  offsetIndex: number;
  layoutOptions?: AttributeLayoutOptions;
}): AttributeLayoutSlot {
  const hostCenterX = options.host.x + options.host.width / 2;
  const hostCenterY = options.host.y + options.host.height / 2;
  const markerGap = options.layoutOptions?.markerGap ?? DEFAULT_MARKER_GAP;
  const sideSpacing = getSideSpacing(options.attributes);
  const rowSpacing = getRowSpacing(options.attributes);
  const horizontalLaneGap = getHorizontalLaneGap(options.attributes, options.layoutOptions);
  const verticalLaneGap = getVerticalLaneGap(options.layoutOptions);
  let marker: Point;

  if (options.side === "right") {
    const distance = markerGap + options.lane * horizontalLaneGap;
    const offset = options.offset * sideSpacing;
    const sideHalfHeight = options.host.height / 2;
    if (Math.abs(offset) <= sideHalfHeight) {
      marker = {
        x: options.host.x + options.host.width + distance,
        y: hostCenterY + offset,
      };
    } else {
      const overflow = Math.abs(offset) - sideHalfHeight;
      marker = {
        x: options.host.x + options.host.width - overflow,
        y: offset < 0 ? options.host.y - distance : options.host.y + options.host.height + distance,
      };
    }
  } else if (options.side === "left") {
    const distance = markerGap + options.lane * horizontalLaneGap;
    const offset = options.offset * sideSpacing;
    const sideHalfHeight = options.host.height / 2;
    if (Math.abs(offset) <= sideHalfHeight) {
      marker = {
        x: options.host.x - distance,
        y: hostCenterY + offset,
      };
    } else {
      const overflow = Math.abs(offset) - sideHalfHeight;
      marker = {
        x: options.host.x + overflow,
        y: offset < 0 ? options.host.y - distance : options.host.y + options.host.height + distance,
      };
    }
  } else if (options.side === "top") {
    const distance = markerGap + options.lane * verticalLaneGap;
    const offset = options.offset * rowSpacing;
    const sideHalfWidth = options.host.width / 2;
    if (Math.abs(offset) <= sideHalfWidth) {
      marker = {
        x: hostCenterX + offset,
        y: options.host.y - distance,
      };
    } else {
      const overflow = Math.abs(offset) - sideHalfWidth;
      marker = {
        x: offset < 0 ? options.host.x - distance : options.host.x + options.host.width + distance,
        y: options.host.y + overflow,
      };
    }
  } else {
    const distance = markerGap + options.lane * verticalLaneGap;
    const offset = options.offset * rowSpacing;
    const sideHalfWidth = options.host.width / 2;
    if (Math.abs(offset) <= sideHalfWidth) {
      marker = {
        x: hostCenterX + offset,
        y: options.host.y + options.host.height + distance,
      };
    } else {
      const overflow = Math.abs(offset) - sideHalfWidth;
      marker = {
        x: offset < 0 ? options.host.x - distance : options.host.x + options.host.width + distance,
        y: options.host.y + options.host.height - overflow,
      };
    }
  }

  return {
    side: options.side,
    lane: options.lane,
    offsetIndex: options.offsetIndex,
    marker,
  };
}

function splitClusterCounts(count: number): { beforeCount: number; middleCount: number; afterCount: number } {
  if (count <= 3) {
    return { beforeCount: 0, middleCount: count, afterCount: 0 };
  }

  if (count <= 5) {
    return { beforeCount: 1, middleCount: count - 2, afterCount: 1 };
  }

  const middleCount = 2;
  const remainingCount = count - middleCount;
  const beforeCount = Math.floor(remainingCount / 2);

  return {
    beforeCount,
    middleCount,
    afterCount: remainingCount - beforeCount,
  };
}

function buildClusterSlotForSide(options: {
  host: AttributeLayoutHost;
  attributes: AttributeNode[];
  side: AttributeLayoutSide;
  lane: number;
  index: number;
  layoutOptions?: AttributeLayoutOptions;
}): AttributeLayoutSlot {
  const hostCenterX = options.host.x + options.host.width / 2;
  const hostCenterY = options.host.y + options.host.height / 2;
  const markerGap = options.layoutOptions?.markerGap ?? DEFAULT_MARKER_GAP;
  const sideSpacing = getSideSpacing(options.attributes);
  const rowSpacing = getRowSpacing(options.attributes);
  const horizontalLaneGap = getHorizontalLaneGap(options.attributes, options.layoutOptions);
  const verticalLaneGap = getVerticalLaneGap(options.layoutOptions);
  const { beforeCount, middleCount } = splitClusterCounts(options.attributes.length);
  let marker: Point;

  if (options.side === "left" || options.side === "right") {
    const distance = markerGap + options.lane * horizontalLaneGap;
    const sideX = options.side === "left" ? options.host.x - distance : options.host.x + options.host.width + distance;
    const rowStartX = options.side === "left" ? options.host.x : options.host.x + options.host.width;
    const rowDirection = options.side === "left" ? 1 : -1;

    if (options.index < beforeCount) {
      marker = {
        x: rowStartX + rowDirection * options.index * rowSpacing,
        y: options.host.y - distance,
      };
    } else if (options.index < beforeCount + middleCount) {
      const middleIndex = options.index - beforeCount;
      marker = {
        x: sideX,
        y: hostCenterY + (middleIndex - (middleCount - 1) / 2) * sideSpacing,
      };
    } else {
      const afterIndex = options.index - beforeCount - middleCount;
      marker = {
        x: rowStartX + rowDirection * afterIndex * rowSpacing,
        y: options.host.y + options.host.height + distance,
      };
    }
  } else {
    const distance = markerGap + options.lane * verticalLaneGap;
    const sideY = options.side === "top" ? options.host.y - distance : options.host.y + options.host.height + distance;
    const columnStartY = options.side === "top" ? options.host.y : options.host.y + options.host.height;
    const columnDirection = options.side === "top" ? 1 : -1;

    if (options.index < beforeCount) {
      marker = {
        x: options.host.x - distance,
        y: columnStartY + columnDirection * options.index * sideSpacing,
      };
    } else if (options.index < beforeCount + middleCount) {
      const middleIndex = options.index - beforeCount;
      marker = {
        x: hostCenterX + (middleIndex - (middleCount - 1) / 2) * rowSpacing,
        y: sideY,
      };
    } else {
      const afterIndex = options.index - beforeCount - middleCount;
      marker = {
        x: options.host.x + options.host.width + distance,
        y: columnStartY + columnDirection * afterIndex * sideSpacing,
      };
    }
  }

  return {
    side: options.side,
    lane: options.lane,
    offsetIndex: options.index,
    marker,
  };
}

export function buildCompactAttributeSlots(
  host: AttributeLayoutHost,
  attributes: AttributeNode[],
  options?: AttributeLayoutOptions,
): AttributeLayoutSlot[] {
  const slotCount = Math.max(attributes.length + EXTRA_SLOT_COUNT, 12);
  const offsetOrder = getOffsetOrder(slotCount);
  const slots: AttributeLayoutSlot[] = [];

  const sideOrder = getCandidateSideOrder(options);

  for (let lane = 0; lane < MAX_LANE_COUNT && slots.length < slotCount * sideOrder.length; lane += 1) {
    offsetOrder.forEach((offset, offsetIndex) => {
      sideOrder.forEach((side) => {
        slots.push(buildSlotForSide({ host, attributes, side, lane, offset, offsetIndex, layoutOptions: options }));
      });
    });
  }

  return slots;
}

function countCollisions(bounds: Bounds, occupiedBounds: Bounds[]): number {
  return occupiedBounds.filter((occupied) => boundsIntersect(bounds, occupied)).length;
}

function countPeerCollisions(bounds: Bounds, boundsList: Bounds[], ownIndex: number): number {
  return boundsList.reduce((count, otherBounds, otherIndex) => {
    if (otherIndex <= ownIndex) {
      return count;
    }

    return boundsIntersect(bounds, otherBounds) ? count + 1 : count;
  }, 0);
}

function getHostPerimeterDistance(host: AttributeLayoutHost, marker: Point): number {
  const clampedX = Math.min(Math.max(marker.x, host.x), host.x + host.width);
  const clampedY = Math.min(Math.max(marker.y, host.y), host.y + host.height);
  return Math.hypot(marker.x - clampedX, marker.y - clampedY);
}

export function placeNewAttributeAroundHost<T extends AttributeNode>(
  host: AttributeLayoutHost,
  existingAttributes: AttributeNode[],
  newAttribute: T,
  options?: AttributeLayoutOptions,
): T {
  const layoutAttributes = [...existingAttributes, newAttribute];
  const hostBounds = getHostBounds(host, options?.collisionPadding ?? COLLISION_PADDING);
  const occupiedBounds = existingAttributes.map((attribute) =>
    buildAttributeLayoutBounds(host, attribute, options?.collisionPadding ?? COLLISION_PADDING),
  );
  const externalOccupiedBounds = options?.occupiedBounds ?? [];
  const existingSideCounts = existingAttributes.reduce<Partial<Record<AttributeLayoutSide, number>>>((counts, attribute) => {
    const side = getDirectAttributeLayoutSide(host, attribute);
    counts[side] = (counts[side] ?? 0) + 1;
    return counts;
  }, {});
  const slots = buildCompactAttributeSlots(host, layoutAttributes, options);
  let bestAttribute: T | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  slots.forEach((slot, index) => {
    const candidate = placeAttributeMarker(newAttribute, slot.marker, false) as T;
    const candidateBounds = buildAttributeLayoutBounds(
      host,
      candidate,
      options?.collisionPadding ?? COLLISION_PADDING,
    );
    const hostCollisions = boundsIntersect(candidateBounds, hostBounds) ? 1 : 0;
    const attributeCollisions = countCollisions(candidateBounds, occupiedBounds);
    const externalCollisions = countCollisions(candidateBounds, externalOccupiedBounds);
    const perimeterDistance = getHostPerimeterDistance(host, getAttributeMarkerCenter(candidate));
    const existingSideMisses = existingAttributes.length - (existingSideCounts[slot.side] ?? 0);
    const sidePenalty = options?.sidePenalties?.[slot.side] ?? 0;
    const score =
      hostCollisions * 100000 +
      attributeCollisions * 50000 +
      externalCollisions * 50000 +
      sidePenalty +
      existingSideMisses * 80 +
      slot.lane * 700 +
      slot.offsetIndex * 35 +
      perimeterDistance * 1.5 +
      index / 1000;

    if (score < bestScore) {
      bestScore = score;
      bestAttribute = candidate;
    }
  });

  return bestAttribute ?? newAttribute;
}

interface AttributeGroupLayoutCandidate<T extends AttributeNode> {
  side: AttributeLayoutSide;
  lane: number;
  positionedAttributes: T[];
  bounds: Bounds[];
  score: number;
}

function buildGroupLayoutCandidate<T extends AttributeNode>(options: {
  host: AttributeLayoutHost;
  attributes: T[];
  side: AttributeLayoutSide;
  lane: number;
  sideRank: number;
  layoutOptions?: AttributeLayoutOptions;
}): AttributeGroupLayoutCandidate<T> {
  const positionedAttributes = options.attributes.map((attribute, index) => {
    const slot = buildClusterSlotForSide({
      host: options.host,
      attributes: options.attributes,
      side: options.side,
      lane: options.lane,
      index,
      layoutOptions: options.layoutOptions,
    });

    return placeAttributeMarker(attribute, slot.marker, false) as T;
  });
  const collisionPadding = options.layoutOptions?.collisionPadding ?? COLLISION_PADDING;
  const hostBounds = getHostBounds(options.host, collisionPadding);
  const externalOccupiedBounds = options.layoutOptions?.occupiedBounds ?? [];
  const bounds = positionedAttributes.map((attribute) =>
    buildAttributeLayoutBounds(options.host, attribute, collisionPadding),
  );
  const markers = positionedAttributes.map(getAttributeMarkerCenter);
  const distances = markers.map((marker) => getHostPerimeterDistance(options.host, marker));
  const maxDistance = Math.max(...distances);
  const minDistance = Math.min(...distances);
  const hostCollisions = bounds.filter((bound) => boundsIntersect(bound, hostBounds)).length;
  const externalCollisions = bounds.reduce(
    (count, bound) => count + countCollisions(bound, externalOccupiedBounds),
    0,
  );
  const peerCollisions = bounds.reduce(
    (count, bound, index) => count + countPeerCollisions(bound, bounds, index),
    0,
  );
  const span =
    options.side === "left" || options.side === "right"
      ? Math.max(...markers.map((marker) => marker.y)) - Math.min(...markers.map((marker) => marker.y))
      : Math.max(...markers.map((marker) => marker.x)) - Math.min(...markers.map((marker) => marker.x));
  const sidePenalty = options.layoutOptions?.sidePenalties?.[options.side] ?? 0;
  const score =
    hostCollisions * 1000000 +
    peerCollisions * 750000 +
    externalCollisions * 750000 +
    sidePenalty +
    options.lane * 2500 +
    options.sideRank * 60 +
    maxDistance * 3 +
    (maxDistance - minDistance) * 2 +
    span * 0.05;

  return {
    side: options.side,
    lane: options.lane,
    positionedAttributes,
    bounds,
    score,
  };
}

export function distributeAttributesAroundHost<T extends AttributeNode>(
  host: AttributeLayoutHost,
  attributes: T[],
  options?: AttributeLayoutOptions,
): T[] {
  if (attributes.length === 0) {
    return attributes;
  }

  const layoutAttributes =
    options?.preserveInputOrder === false
      ? [...attributes].sort((left, right) => left.id.localeCompare(right.id))
      : [...attributes];
  const sideOrder = getCandidateSideOrder(options);
  let bestCandidate: AttributeGroupLayoutCandidate<T> | null = null;

  for (let lane = 0; lane < MAX_LANE_COUNT; lane += 1) {
    for (let sideRank = 0; sideRank < sideOrder.length; sideRank += 1) {
      const side = sideOrder[sideRank];
      const candidate = buildGroupLayoutCandidate({
        host,
        attributes: layoutAttributes,
        side,
        lane,
        sideRank,
        layoutOptions: options,
      });

      if (!bestCandidate || candidate.score < bestCandidate.score) {
        bestCandidate = candidate;
      }
    }

    const currentBest = bestCandidate;
    if (
      currentBest?.lane === lane &&
      currentBest.bounds.every((bound, index) => {
        const hostBounds = getHostBounds(host, options?.collisionPadding ?? COLLISION_PADDING);
        const occupiedBounds = options?.occupiedBounds ?? [];
        return (
          !boundsIntersect(bound, hostBounds) &&
          countCollisions(bound, occupiedBounds) === 0 &&
          countPeerCollisions(bound, currentBest.bounds, index) === 0
        );
      })
    ) {
      break;
    }
  }

  const positionedAttributes = bestCandidate ? bestCandidate.positionedAttributes : layoutAttributes;
  const positionedById = new Map<string, AttributeNode>(
    positionedAttributes.map((attribute) => [attribute.id, attribute]),
  );

  return attributes.map((attribute) => (positionedById.get(attribute.id) ?? attribute) as T);
}
