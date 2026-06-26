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
  collisionPadding?: number;
  occupiedBounds?: Bounds[];
  preserveInputOrder?: boolean;
}

const ATTRIBUTE_MARKER_OFFSET_X = 10;
const ATTRIBUTE_MARKER_RADIUS = 8;
export const FIXED_ATTRIBUTE_MARKER_GAP = 28;
const DEFAULT_MARKER_GAP = FIXED_ATTRIBUTE_MARKER_GAP;
const COLLISION_PADDING = 2;
const MIN_VERTICAL_STEP = 48;
const MIN_HORIZONTAL_STEP = 72;

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
  if (marker.y < host.y) {
    return "top";
  }
  if (marker.y > host.y + host.height) {
    return "bottom";
  }
  if (marker.x < host.x) {
    return "left";
  }
  if (marker.x > host.x + host.width) {
    return "right";
  }

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

export function buildCenterOutOffsets(count: number): number[] {
  const offsets: number[] = [];
  for (let index = 0; offsets.length < count; index += 1) {
    if (index === 0) {
      offsets.push(0);
      continue;
    }

    offsets.push(-index);
    if (offsets.length < count) {
      offsets.push(index);
    }
  }
  return offsets;
}

function getVerticalStep(attributes: AttributeNode[]): number {
  const maxHeight = attributes.reduce((max, attribute) => Math.max(max, attribute.height), 0);
  return Math.max(MIN_VERTICAL_STEP, maxHeight + 12);
}

function getHorizontalStep(attributes: AttributeNode[]): number {
  const maxWidth = attributes.reduce((max, attribute) => Math.max(max, attribute.width), 0);
  return Math.max(MIN_HORIZONTAL_STEP, maxWidth / 2);
}

function getLeftSlotMarker(
  host: AttributeLayoutHost,
  offsetIndex: number,
  markerGap: number,
  verticalStep: number,
): Point {
  return {
    x: host.x - markerGap,
    y: host.y + host.height / 2 + offsetIndex * verticalStep,
  };
}

function getBottomSlotMarker(
  host: AttributeLayoutHost,
  offsetIndex: number,
  markerGap: number,
  horizontalOffsets: number[],
): Point {
  return {
    x: host.x + (horizontalOffsets[offsetIndex] ?? host.width),
    y: host.y + host.height + markerGap,
  };
}

function getTopSlotMarker(
  host: AttributeLayoutHost,
  offsetIndex: number,
  markerGap: number,
  horizontalOffsets: number[],
): Point {
  return {
    x: host.x + (horizontalOffsets[offsetIndex] ?? host.width),
    y: host.y - markerGap,
  };
}

function buildPerimeterHorizontalOffsets(host: AttributeLayoutHost, horizontalStep: number, count: number): number[] {
  if (count <= 0) {
    return [];
  }

  const segmentCount = Math.max(1, Math.ceil(host.width / horizontalStep));
  const segmentWidth = host.width / segmentCount;
  const offsets: number[] = [];

  for (let index = 0; index <= segmentCount && offsets.length < count; index += 1) {
    offsets.push(index * segmentWidth);
  }

  for (let pass = 1; offsets.length < count; pass += 1) {
    const divisor = 2 ** pass;
    for (let index = 0; index < segmentCount && offsets.length < count; index += 1) {
      for (let numerator = 1; numerator < divisor && offsets.length < count; numerator += 2) {
        offsets.push((index + numerator / divisor) * segmentWidth);
      }
    }
  }

  return offsets;
}

function boundsIntersect(left: Bounds, right: Bounds): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function isSlotAvailable(
  host: AttributeLayoutHost,
  attribute: AttributeNode,
  marker: Point,
  occupiedBounds: Bounds[],
  collisionPadding: number,
): boolean {
  if (occupiedBounds.length === 0) {
    return true;
  }

  const candidate = placeAttributeMarker(attribute, marker, false);
  const bounds = buildAttributeLayoutBounds(host, candidate, collisionPadding);
  return occupiedBounds.every((occupied) => !boundsIntersect(bounds, occupied));
}

export function buildLeftPriorityPerimeterSlots(
  host: AttributeLayoutHost,
  attributes: AttributeNode[],
  options?: AttributeLayoutOptions,
  requestedCount = attributes.length,
): AttributeLayoutSlot[] {
  const markerGap = options?.markerGap ?? DEFAULT_MARKER_GAP;
  const verticalStep = getVerticalStep(attributes);
  const horizontalStep = getHorizontalStep(attributes);
  const slots: AttributeLayoutSlot[] = [];
  const leftMinY = host.y;
  const leftMaxY = host.y + host.height;

  buildCenterOutOffsets(requestedCount).forEach((offsetIndex) => {
    const marker = getLeftSlotMarker(host, offsetIndex, markerGap, verticalStep);
    if (marker.y < leftMinY || marker.y > leftMaxY) {
      return;
    }

    slots.push({
      side: "left",
      lane: 0,
      offsetIndex,
      marker,
    });
  });

  const horizontalOffsets = buildPerimeterHorizontalOffsets(host, horizontalStep, requestedCount);
  let perimeterIndex = 0;
  while (slots.length < requestedCount) {
    slots.push({
      side: "top",
      lane: 0,
      offsetIndex: perimeterIndex,
      marker: getTopSlotMarker(host, perimeterIndex, markerGap, horizontalOffsets),
    });
    if (slots.length >= requestedCount) {
      break;
    }
    slots.push({
      side: "bottom",
      lane: 0,
      offsetIndex: perimeterIndex,
      marker: getBottomSlotMarker(host, perimeterIndex, markerGap, horizontalOffsets),
    });
    perimeterIndex += 1;
  }

  return slots;
}

function getSlotKey(slot: AttributeLayoutSlot): string {
  return `${slot.side}:${slot.lane}:${slot.offsetIndex}`;
}

function getOccupiedSlotKeys(
  host: AttributeLayoutHost,
  existingAttributes: AttributeNode[],
  attributesForStep: AttributeNode[],
  options?: AttributeLayoutOptions,
): Set<string> {
  const slots = buildLeftPriorityPerimeterSlots(
    host,
    attributesForStep,
    options,
    Math.max(existingAttributes.length + attributesForStep.length + 8, 16),
  );
  const occupied = new Set<string>();

  existingAttributes.forEach((attribute) => {
    const marker = getAttributeMarkerCenter(attribute);
    const slot = slots.find((candidate) => (
      Math.abs(candidate.marker.x - marker.x) <= 0.001 &&
      Math.abs(candidate.marker.y - marker.y) <= 0.001
    ));
    if (slot) {
      occupied.add(getSlotKey(slot));
    }
  });

  return occupied;
}

function findFirstAvailablePerimeterSlot(
  host: AttributeLayoutHost,
  attribute: AttributeNode,
  attributesForStep: AttributeNode[],
  occupiedBounds: Bounds[],
  occupiedSlotKeys: Set<string>,
  options?: AttributeLayoutOptions,
): AttributeLayoutSlot {
  const collisionPadding = options?.collisionPadding ?? COLLISION_PADDING;
  let candidateCount = Math.max(attributesForStep.length + occupiedBounds.length + 8, 12);

  while (candidateCount < 256) {
    const slots = buildLeftPriorityPerimeterSlots(host, attributesForStep, options, candidateCount);
    for (const slot of slots) {
      if (occupiedSlotKeys.has(getSlotKey(slot))) {
        continue;
      }

      const { marker } = slot;
      if (!isSlotAvailable(host, attribute, marker, occupiedBounds, collisionPadding)) {
        continue;
      }

      return slot;
    }

    candidateCount *= 2;
  }

  return buildLeftPriorityPerimeterSlots(host, attributesForStep, options, candidateCount)[0];
}

export function buildCompactAttributeSlots(
  host: AttributeLayoutHost,
  attributes: AttributeNode[],
  options?: AttributeLayoutOptions,
): AttributeLayoutSlot[] {
  return buildLeftPriorityPerimeterSlots(host, attributes, options);
}

export function placeNewAttributeAroundHost<T extends AttributeNode>(
  host: AttributeLayoutHost,
  existingAttributes: AttributeNode[],
  newAttribute: T,
  options?: AttributeLayoutOptions,
): T {
  const attributesForStep = [...existingAttributes, newAttribute];
  const occupiedBounds = [...(options?.occupiedBounds ?? [])];
  const occupiedSlotKeys = getOccupiedSlotKeys(host, existingAttributes, attributesForStep, options);
  const slot = findFirstAvailablePerimeterSlot(
    host,
    newAttribute,
    attributesForStep,
    occupiedBounds,
    occupiedSlotKeys,
    options,
  );

  return placeAttributeMarker(newAttribute, slot.marker, false) as T;
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
  const occupiedBounds = [...(options?.occupiedBounds ?? [])];
  const occupiedSlotKeys = new Set<string>();
  const positionedAttributes = layoutAttributes.map((attribute) => {
    const slot = findFirstAvailablePerimeterSlot(
      host,
      attribute,
      layoutAttributes,
      occupiedBounds,
      occupiedSlotKeys,
      options,
    );
    const positioned = placeAttributeMarker(attribute, slot.marker, false) as T;
    occupiedSlotKeys.add(getSlotKey(slot));
    return positioned;
  });
  const positionedById = new Map<string, AttributeNode>(
    positionedAttributes.map((attribute) => [attribute.id, attribute]),
  );

  return attributes.map((attribute) => (positionedById.get(attribute.id) ?? attribute) as T);
}
