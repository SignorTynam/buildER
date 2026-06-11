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

interface AttributeLayoutOptions {
  markerGap?: number;
  laneGap?: number;
  collisionPadding?: number;
}

const ATTRIBUTE_MARKER_OFFSET_X = 10;
const ATTRIBUTE_MARKER_RADIUS = 8;
const DEFAULT_MARKER_GAP = 52;
const DEFAULT_LANE_GAP = 44;
const COLLISION_PADDING = 5;
const MIN_SIDE_SPACING = 44;
const MIN_ROW_SPACING = 86;
const MAX_LANE_COUNT = 6;
const EXTRA_SLOT_COUNT = 8;
const CANDIDATE_SIDE_ORDER: AttributeLayoutSide[] = ["right", "left", "top", "bottom"];

export function getAttributeMarkerCenter(attribute: AttributeNode): Point {
  return {
    x: attribute.x + ATTRIBUTE_MARKER_OFFSET_X,
    y: attribute.y + attribute.height / 2,
  };
}

export function placeAttributeMarker(attribute: AttributeNode, marker: Point): AttributeNode {
  return {
    ...attribute,
    x: snapValue(marker.x - ATTRIBUTE_MARKER_OFFSET_X, GRID_SIZE),
    y: snapValue(marker.y - attribute.height / 2, GRID_SIZE),
  };
}

export function getDirectAttributeLayoutSide(
  host: AttributeLayoutHost,
  attribute: AttributeNode,
): AttributeLayoutSide {
  const marker = getAttributeMarkerCenter(attribute);
  if (marker.y < host.y) {
    return "top";
  }
  if (marker.y > host.y + host.height) {
    return "bottom";
  }

  return marker.x < host.x + host.width / 2 ? "left" : "right";
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
  const maxHeight = attributes.reduce((max, attribute) => Math.max(max, attribute.height), 0);
  return Math.max(MIN_SIDE_SPACING, maxHeight + 10);
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
    marker = {
      x: options.host.x + options.host.width + markerGap + options.lane * horizontalLaneGap,
      y: hostCenterY + options.offset * sideSpacing,
    };
  } else if (options.side === "left") {
    marker = {
      x: options.host.x - markerGap - options.lane * horizontalLaneGap,
      y: hostCenterY + options.offset * sideSpacing,
    };
  } else if (options.side === "top") {
    marker = {
      x: hostCenterX + options.offset * rowSpacing,
      y: options.host.y - markerGap - options.lane * verticalLaneGap,
    };
  } else {
    marker = {
      x: hostCenterX + options.offset * rowSpacing,
      y: options.host.y + options.host.height + markerGap + options.lane * verticalLaneGap,
    };
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

  for (let lane = 0; lane < MAX_LANE_COUNT && slots.length < slotCount * CANDIDATE_SIDE_ORDER.length; lane += 1) {
    offsetOrder.forEach((offset, offsetIndex) => {
      CANDIDATE_SIDE_ORDER.forEach((side) => {
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
  const slots = buildCompactAttributeSlots(host, layoutAttributes, options);
  let bestAttribute: T | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  slots.forEach((slot, index) => {
    const candidate = placeAttributeMarker(newAttribute, slot.marker) as T;
    const candidateBounds = buildAttributeLayoutBounds(
      host,
      candidate,
      options?.collisionPadding ?? COLLISION_PADDING,
    );
    const hostCollisions = boundsIntersect(candidateBounds, hostBounds) ? 1 : 0;
    const attributeCollisions = countCollisions(candidateBounds, occupiedBounds);
    const perimeterDistance = getHostPerimeterDistance(host, getAttributeMarkerCenter(candidate));
    const score =
      hostCollisions * 100000 +
      attributeCollisions * 50000 +
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

export function distributeAttributesAroundHost<T extends AttributeNode>(
  host: AttributeLayoutHost,
  attributes: T[],
  options?: AttributeLayoutOptions,
): T[] {
  if (attributes.length === 0) {
    return attributes;
  }

  const orderedAttributes = [...attributes].sort((left, right) => left.id.localeCompare(right.id));
  const positionedById = new Map<string, AttributeNode>();
  const placedAttributes: AttributeNode[] = [];

  orderedAttributes.forEach((attribute) => {
    const nextAttribute = placeNewAttributeAroundHost(host, placedAttributes, attribute, options);
    positionedById.set(attribute.id, nextAttribute);
    placedAttributes.push(nextAttribute);
  });

  return attributes.map((attribute) => (positionedById.get(attribute.id) ?? attribute) as T);
}
