import type { AttributeNode, Bounds, EntityNode, Point, RelationshipNode } from "../types/diagram";
import { buildAttributeLabelBounds, boundsIntersect } from "./edgeLabelLayout";
import { GRID_SIZE, snapValue } from "./geometry";

export type AttributeLayoutSide = "top" | "right" | "bottom" | "left";

export type AttributeLayoutHost = EntityNode | RelationshipNode | AttributeNode;

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
const DEFAULT_LANE_GAP = 20;
const COLLISION_PADDING = 2;
const MIN_SIDE_SPACING = 20;
const MIN_ROW_SPACING = 50;
const MAX_LANE_COUNT = 10;
const EXTRA_SLOT_COUNT = 16;
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

function getHostPerimeterDistance(host: AttributeLayoutHost, marker: Point): number {
  const clampedX = Math.min(Math.max(marker.x, host.x), host.x + host.width);
  const clampedY = Math.min(Math.max(marker.y, host.y), host.y + host.height);
  return Math.hypot(marker.x - clampedX, marker.y - clampedY);
}

function getPreferredSideSpread(attributeCount: number): number {
  if (attributeCount >= 9) {
    return 4;
  }

  if (attributeCount >= 6) {
    return 3;
  }

  if (attributeCount >= 4) {
    return 2;
  }

  return 1;
}

function getSlotKey(slot: AttributeLayoutSlot): string {
  return `${slot.side}:${slot.lane}:${slot.offsetIndex}`;
}

function incrementSideCount(
  sideCounts: Partial<Record<AttributeLayoutSide, number>>,
  side: AttributeLayoutSide,
): void {
  if (side === "top") {
    sideCounts.top = (sideCounts.top ?? 0) + 1;
  } else if (side === "right") {
    sideCounts.right = (sideCounts.right ?? 0) + 1;
  } else if (side === "bottom") {
    sideCounts.bottom = (sideCounts.bottom ?? 0) + 1;
  } else {
    sideCounts.left = (sideCounts.left ?? 0) + 1;
  }
}

function scoreSlot(options: {
  host: AttributeLayoutHost;
  attribute: AttributeNode;
  slot: AttributeLayoutSlot;
  slotIndex: number;
  attributesCount: number;
  sideCounts: Partial<Record<AttributeLayoutSide, number>>;
  placedBounds: Bounds[];
  occupiedBounds: Bounds[];
  layoutOptions?: AttributeLayoutOptions;
}): number {
  const collisionPadding = options.layoutOptions?.collisionPadding ?? COLLISION_PADDING;
  const candidateBounds = buildAttributeLayoutBounds(options.host, options.attribute, collisionPadding);
  const hostBounds = getHostBounds(options.host, collisionPadding);
  const hostCollisions = boundsIntersect(candidateBounds, hostBounds) ? 1 : 0;
  const peerCollisions = countCollisions(candidateBounds, options.placedBounds);
  const externalCollisions = countCollisions(candidateBounds, options.occupiedBounds);
  const sidePenalty = options.layoutOptions?.sidePenalties?.[options.slot.side] ?? 0;
  const perimeterDistance = getHostPerimeterDistance(options.host, getAttributeMarkerCenter(options.attribute));
  const sideCount = options.sideCounts[options.slot.side] ?? 0;
  const preferredSideSpread = getPreferredSideSpread(options.attributesCount);
  const targetPerSide = Math.ceil(options.attributesCount / preferredSideSpread);
  const usedSideCount = CANDIDATE_SIDE_ORDER.filter((side) => (options.sideCounts[side] ?? 0) > 0).length;
  const shouldOpenUnusedSide =
    options.attributesCount >= 6 &&
    usedSideCount < preferredSideSpread &&
    sideCount > 0;
  const sideOverTarget = Math.max(0, sideCount + 1 - targetPerSide);
  const balancePenalty =
    options.attributesCount >= 6
      ? sideCount * 2600 + sideOverTarget * 12000 + (shouldOpenUnusedSide ? 9000 : 0)
      : options.attributesCount >= 4
        ? sideCount * 850 + sideOverTarget * 4000
        : sideCount * 120;

  return (
    hostCollisions * 10000000 +
    peerCollisions * 6000000 +
    externalCollisions * 6000000 +
    sidePenalty +
    options.slot.lane * 18000 +
    perimeterDistance * 42 +
    options.slot.offsetIndex * 480 +
    balancePenalty +
    options.slotIndex / 1000
  );
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
    const candidate = placeAttributeMarker(newAttribute, slot.marker, true) as T;
    const candidateBounds = buildAttributeLayoutBounds(
      host,
      candidate,
      options?.collisionPadding ?? COLLISION_PADDING,
    );
    const hostCollisions = boundsIntersect(candidateBounds, hostBounds) ? 1 : 0;
    const attributeCollisions = countCollisions(candidateBounds, occupiedBounds);
    const externalCollisions = countCollisions(candidateBounds, externalOccupiedBounds);
    const sidePenalty = options?.sidePenalties?.[slot.side] ?? 0;
    const perimeterDistance = getHostPerimeterDistance(host, getAttributeMarkerCenter(candidate));
    const sideCount = existingSideCounts[slot.side] ?? 0;
    const preferredSideSpread = getPreferredSideSpread(layoutAttributes.length);
    const targetPerSide = Math.ceil(layoutAttributes.length / preferredSideSpread);
    const sideOverTarget = Math.max(0, sideCount + 1 - targetPerSide);
    const score =
      hostCollisions * 10000000 +
      attributeCollisions * 6000000 +
      externalCollisions * 6000000 +
      sidePenalty +
      slot.lane * 18000 +
      perimeterDistance * 42 +
      slot.offsetIndex * 480 +
      (layoutAttributes.length >= 6 ? sideCount * 2600 + sideOverTarget * 12000 : sideCount * 850) +
      index / 1000;

    if (score < bestScore) {
      bestScore = score;
      bestAttribute = candidate;
    }
  });

  return bestAttribute ?? newAttribute;
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
  const slots = buildCompactAttributeSlots(host, layoutAttributes, {
    ...options,
    preferredSides: sideOrder,
  });
  const occupiedBounds = options?.occupiedBounds ?? [];
  const sideCounts: Partial<Record<AttributeLayoutSide, number>> = {};
  const usedSlots = new Set<string>();
  const placedBounds: Bounds[] = [];
  const positionedAttributes: T[] = [];

  layoutAttributes.forEach((attribute) => {
    let bestAttribute: T | null = null;
    let bestSlotKey: string | null = null;
    let bestSlotSide: AttributeLayoutSide | null = null;
    let bestBounds: Bounds | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    slots.forEach((slot, slotIndex) => {
      if (usedSlots.has(getSlotKey(slot))) {
        return;
      }

      const candidate = placeAttributeMarker(attribute, slot.marker, true) as T;
      const candidateBounds = buildAttributeLayoutBounds(
        host,
        candidate,
        options?.collisionPadding ?? COLLISION_PADDING,
      );
      const score = scoreSlot({
        host,
        attribute: candidate,
        slot,
        slotIndex,
        attributesCount: layoutAttributes.length,
        sideCounts,
        placedBounds,
        occupiedBounds,
        layoutOptions: options,
      });

      if (score < bestScore) {
        bestScore = score;
        bestAttribute = candidate;
        bestSlotKey = getSlotKey(slot);
        bestSlotSide = slot.side;
        bestBounds = candidateBounds;
      }
    });

    if (bestAttribute && bestSlotKey && bestSlotSide && bestBounds) {
      positionedAttributes.push(bestAttribute);
      placedBounds.push(bestBounds);
      usedSlots.add(bestSlotKey);
      incrementSideCount(sideCounts, bestSlotSide);
    } else {
      positionedAttributes.push(attribute);
    }
  });
  const positionedById = new Map<string, AttributeNode>(
    positionedAttributes.map((attribute) => [attribute.id, attribute]),
  );

  return attributes.map((attribute) => (positionedById.get(attribute.id) ?? attribute) as T);
}
