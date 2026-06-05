import type { AttributeNode, EntityNode, Point, RelationshipNode } from "../types/diagram";
import { GRID_SIZE, snapValue } from "./geometry";

export type AttributeLayoutSide = "top" | "right" | "bottom" | "left";

type AttributeLayoutHost = EntityNode | RelationshipNode;

interface AttributeLayoutSlot {
  side: AttributeLayoutSide;
  marker: Point;
}

const ATTRIBUTE_MARKER_OFFSET_X = 10;
const HORIZONTAL_MARKER_GAP = 104;
const VERTICAL_MARKER_GAP = 88;
const MIN_HORIZONTAL_SPACING = 96;
const MIN_VERTICAL_SPACING = 56;

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

function getBalancedSideCounts(count: number): Record<AttributeLayoutSide, number> {
  const counts: Record<AttributeLayoutSide, number> = {
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  };
  const sideOrder: AttributeLayoutSide[] = ["top", "right", "left", "bottom"];

  for (let index = 0; index < count; index += 1) {
    counts[sideOrder[index % sideOrder.length]] += 1;
  }

  return counts;
}

function getHorizontalSpacing(attributes: AttributeNode[]): number {
  const widestLabel = attributes.reduce((max, attribute) => Math.max(max, attribute.label.length), 0);
  return Math.max(MIN_HORIZONTAL_SPACING, Math.min(160, widestLabel * 9 + 40));
}

function getVerticalSpacing(attributes: AttributeNode[]): number {
  const hasLongLabel = attributes.some((attribute) => attribute.label.length > 18);
  return hasLongLabel ? Math.max(MIN_VERTICAL_SPACING, 64) : MIN_VERTICAL_SPACING;
}

function buildSideSlots(
  host: AttributeLayoutHost,
  side: AttributeLayoutSide,
  count: number,
  attributes: AttributeNode[],
): AttributeLayoutSlot[] {
  if (count <= 0) {
    return [];
  }

  const hostCenterX = host.x + host.width / 2;
  const hostCenterY = host.y + host.height / 2;
  const horizontalSpacing = getHorizontalSpacing(attributes);
  const verticalSpacing = getVerticalSpacing(attributes);

  if (side === "top" || side === "bottom") {
    const lane = count > 4 ? Math.floor((count - 1) / 4) : 0;
    const y =
      side === "top"
        ? host.y - VERTICAL_MARKER_GAP - lane * 28
        : host.y + host.height + VERTICAL_MARKER_GAP + lane * 28;
    const total = (count - 1) * horizontalSpacing;

    return Array.from({ length: count }, (_, index) => ({
      side,
      marker: {
        x: hostCenterX - total / 2 + index * horizontalSpacing,
        y,
      },
    }));
  }

  const lane = count > 4 ? Math.floor((count - 1) / 4) : 0;
  const maxAttributeWidth = attributes.reduce((max, attribute) => Math.max(max, attribute.width), 0);
  const leftMarkerGap = Math.max(HORIZONTAL_MARKER_GAP, maxAttributeWidth + 34);
  const x =
    side === "left"
      ? host.x - leftMarkerGap - lane * 34
      : host.x + host.width + HORIZONTAL_MARKER_GAP + lane * 34;
  const topLimit = host.y + 20;
  const bottomLimit = host.y + host.height - 20;
  const availableSpan = Math.max(0, bottomLimit - topLimit);
  const resolvedVerticalSpacing =
    count <= 1 ? 0 : Math.min(verticalSpacing, availableSpan / (count - 1));
  const total = (count - 1) * resolvedVerticalSpacing;
  const startY = Math.max(topLimit, Math.min(bottomLimit, hostCenterY - total / 2));

  return Array.from({ length: count }, (_, index) => ({
    side,
    marker: {
      x,
      y: startY + index * resolvedVerticalSpacing,
    },
  }));
}

function buildBalancedSlots(host: AttributeLayoutHost, attributes: AttributeNode[]): AttributeLayoutSlot[] {
  const counts = getBalancedSideCounts(attributes.length);
  const sideOrder: AttributeLayoutSide[] = ["top", "right", "bottom", "left"];

  return sideOrder.flatMap((side) => {
    const sideAttributes = attributes.slice(0, counts[side]);
    return buildSideSlots(host, side, counts[side], sideAttributes);
  });
}

export function distributeAttributesAroundHost<T extends AttributeNode>(
  host: AttributeLayoutHost,
  attributes: T[],
): T[] {
  if (attributes.length === 0) {
    return attributes;
  }

  const orderedAttributes = [...attributes].sort((left, right) => left.id.localeCompare(right.id));
  const slots = buildBalancedSlots(host, orderedAttributes);
  const sideOrder: AttributeLayoutSide[] = ["top", "right", "bottom", "left"];
  const slotsBySide = new Map<AttributeLayoutSide, AttributeLayoutSlot[]>(
    sideOrder.map((side) => [side, []]),
  );
  slots.forEach((slot) => slotsBySide.get(slot.side)?.push(slot));

  const attributesBySide = new Map<AttributeLayoutSide, T[]>(
    sideOrder.map((side) => [side, []]),
  );
  orderedAttributes.forEach((attribute, index) => {
    const side = sideOrder[index % sideOrder.length];
    attributesBySide.get(side)?.push(attribute as T);
  });

  const positionedById = new Map<string, AttributeNode>();
  sideOrder.forEach((side) => {
    const sideAttributes = attributesBySide.get(side) ?? [];
    const sideSlots = slotsBySide.get(side) ?? [];
    sideAttributes.forEach((attribute, index) => {
      const slot = sideSlots[index];
      if (slot) {
        positionedById.set(attribute.id, placeAttributeMarker(attribute, slot.marker));
      }
    });
  });

  return attributes.map((attribute) => (positionedById.get(attribute.id) ?? attribute) as T);
}
