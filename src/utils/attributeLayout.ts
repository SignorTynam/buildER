import type { AttributeNode, Bounds, EntityNode, Point, RelationshipNode } from "../types/diagram";
import { buildAttributeLabelBounds } from "./edgeLabelLayout";
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
export const FIXED_ATTRIBUTE_MARKER_GAP = 28;
const DEFAULT_MARKER_GAP = FIXED_ATTRIBUTE_MARKER_GAP;
const COLLISION_PADDING = 2;
const SERIAL_SIDE_ORDER: AttributeLayoutSide[] = ["top", "right", "bottom", "left"];
const SIDE_COUNT_REMAINDER_ORDER: AttributeLayoutSide[] = ["top", "right", "bottom", "left"];

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

function getSerialSideCounts(attributeCount: number): Record<AttributeLayoutSide, number> {
  const baseCount = Math.floor(attributeCount / SERIAL_SIDE_ORDER.length);
  let remainder = attributeCount % SERIAL_SIDE_ORDER.length;
  const counts: Record<AttributeLayoutSide, number> = {
    top: baseCount,
    right: baseCount,
    bottom: baseCount,
    left: baseCount,
  };

  SIDE_COUNT_REMAINDER_ORDER.forEach((side) => {
    if (remainder <= 0) {
      return;
    }

    counts[side] += 1;
    remainder -= 1;
  });

  return counts;
}

function getSerialSlotMarker(
  host: AttributeLayoutHost,
  side: AttributeLayoutSide,
  indexOnSide: number,
  countOnSide: number,
  markerGap: number,
): Point {
  const progress = countOnSide <= 1 ? 0.5 : (indexOnSide + 1) / (countOnSide + 1);

  if (side === "top") {
    return {
      x: host.x + host.width * progress,
      y: host.y - markerGap,
    };
  }

  if (side === "right") {
    return {
      x: host.x + host.width + markerGap,
      y: host.y + host.height * progress,
    };
  }

  if (side === "bottom") {
    return {
      x: host.x + host.width * (1 - progress),
      y: host.y + host.height + markerGap,
    };
  }

  return {
    x: host.x - markerGap,
    y: host.y + host.height * (1 - progress),
  };
}

export function buildCompactAttributeSlots(
  host: AttributeLayoutHost,
  attributes: AttributeNode[],
  options?: AttributeLayoutOptions,
): AttributeLayoutSlot[] {
  const markerGap = options?.markerGap ?? DEFAULT_MARKER_GAP;
  const sideCounts = getSerialSideCounts(attributes.length);
  const slots: AttributeLayoutSlot[] = [];

  SERIAL_SIDE_ORDER.forEach((side) => {
    for (let index = 0; index < sideCounts[side]; index += 1) {
      slots.push({
        side,
        lane: 0,
        offsetIndex: index,
        marker: getSerialSlotMarker(host, side, index, sideCounts[side], markerGap),
      });
    }
  });

  return slots;
}

export function placeNewAttributeAroundHost<T extends AttributeNode>(
  host: AttributeLayoutHost,
  existingAttributes: AttributeNode[],
  newAttribute: T,
  options?: AttributeLayoutOptions,
): T {
  const layoutAttributes = [...existingAttributes, newAttribute];
  const positioned = distributeAttributesAroundHost(host, layoutAttributes, options);
  const bestAttribute = positioned.find((attribute) => attribute.id === newAttribute.id) as T | undefined;

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
  const slots = buildCompactAttributeSlots(host, layoutAttributes, options);
  const positionedAttributes = layoutAttributes.map((attribute, index) =>
    placeAttributeMarker(attribute, slots[index]?.marker ?? getAttributeMarkerCenter(attribute), false) as T,
  );
  const positionedById = new Map<string, AttributeNode>(
    positionedAttributes.map((attribute) => [attribute.id, attribute]),
  );

  return attributes.map((attribute) => (positionedById.get(attribute.id) ?? attribute) as T);
}
