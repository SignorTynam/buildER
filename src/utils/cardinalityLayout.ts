import type { Bounds, DiagramEdge, DiagramNode, Point } from "../types/diagram";
import { getAttributeCardinalityOwner, getConnectorParticipationContext } from "./cardinality";
import {
  buildEdgeLabelBounds,
  boundsIntersect,
  estimateEdgeLabelWidth,
  getPointAlongPolyline,
  type EdgeLabelPlacement,
  type ReservedLabelBox,
} from "./edgeLabelLayout";
import { getNodeCenter, getSimpleAttributeMarkerCenter } from "./geometry";

const CONNECTOR_CARDINALITY_DISTANCE_FROM_ENTITY = 30;
const CONNECTOR_CARDINALITY_MAX_PROGRESS = 0.18;
const ATTRIBUTE_CARDINALITY_DISTANCE_FROM_MARKER = 22;
const MIN_CARDINALITY_LINE_CLEARANCE = 14;
const MAX_CONNECTOR_CARDINALITY_DISTANCE_FROM_OWNER = 96;
const MAX_ATTRIBUTE_CARDINALITY_DISTANCE_FROM_OWNER = 76;

export interface CardinalityAnchor {
  point: Point;
  referencePoint: Point;
  normal: Point;
  preferredProgress: number;
  lockNearEndpoint: boolean;
  kind: "connector-cardinality" | "attribute-cardinality" | "generic-edge-label";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function normalizeVector(vector: Point, fallback: Point): Point {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0.001) {
    return fallback;
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function getReadableNormalForDirection(direction: Point): Point {
  let normal = { x: -direction.y, y: direction.x };

  if (Math.abs(direction.x) >= Math.abs(direction.y) && normal.y > 0) {
    normal = { x: -normal.x, y: -normal.y };
  } else if (Math.abs(direction.y) > Math.abs(direction.x) && normal.x < 0) {
    normal = { x: -normal.x, y: -normal.y };
  }

  return normalizeVector(normal, { x: 0, y: -1 });
}

function getReadableNormal(from: Point, to: Point): Point {
  const direction = normalizeVector({ x: to.x - from.x, y: to.y - from.y }, { x: 1, y: 0 });
  return getReadableNormalForDirection(direction);
}

function getPolylineLength(points: Point[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1], points[index]);
  }
  return length;
}

function getNearestSegmentInfo(points: Point[], point: Point): { progress: number; distance: number } {
  const totalLength = getPolylineLength(points);
  if (points.length < 2 || totalLength <= 0.001) {
    return { progress: 0, distance: 0 };
  }

  let bestProgress = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = Math.max(distance(start, end), 0.001);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const t = Math.min(
      Math.max(((point.x - start.x) * dx + (point.y - start.y) * dy) / (segmentLength * segmentLength), 0),
      1,
    );
    const projection = {
      x: start.x + dx * t,
      y: start.y + dy * t,
    };
    const candidateDistance = distance(point, projection);
    if (candidateDistance < bestDistance) {
      bestDistance = candidateDistance;
      bestProgress = (travelled + segmentLength * t) / totalLength;
    }
    travelled += segmentLength;
  }

  return { progress: bestProgress, distance: bestDistance };
}

function offsetPoint(point: Point, normal: Point, offset: number): Point {
  return {
    x: point.x + normal.x * offset,
    y: point.y + normal.y * offset,
  };
}

export function getConnectorCardinalityAnchorPoint(options: {
  edge: DiagramEdge;
  sourceNode: DiagramNode;
  targetNode: DiagramNode;
  points: Point[];
}): CardinalityAnchor | null {
  if (options.edge.type !== "connector" || options.points.length < 2) {
    return null;
  }

  const context = getConnectorParticipationContext(options.sourceNode, options.targetNode);
  if (!context) {
    return null;
  }

  const entityIsSource = options.sourceNode.id === context.entity.id;
  const totalLength = getPolylineLength(options.points);
  const endpoint = entityIsSource ? options.points[0] : options.points[options.points.length - 1];
  const distanceFromOwner = clamp(
    Math.min(CONNECTOR_CARDINALITY_DISTANCE_FROM_ENTITY, totalLength * CONNECTOR_CARDINALITY_MAX_PROGRESS),
    Math.min(20, totalLength),
    Math.min(38, totalLength),
  );
  const progressFromSource = totalLength <= 0.001 ? 0 : distanceFromOwner / totalLength;
  const preferredProgress = entityIsSource ? progressFromSource : 1 - progressFromSource;
  const point = getPointAlongPolyline(options.points, preferredProgress);

  return {
    point,
    referencePoint: endpoint,
    normal: getReadableNormal(endpoint, point),
    preferredProgress,
    lockNearEndpoint: true,
    kind: "connector-cardinality",
  };
}

function getAttributeNodeForCardinality(
  edge: DiagramEdge,
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
): Extract<DiagramNode, { type: "attribute" }> | null {
  if (edge.type !== "attribute") {
    return null;
  }

  const owner = getAttributeCardinalityOwner(sourceNode, targetNode);
  if (owner) {
    return owner;
  }
  if (sourceNode.type === "attribute" && targetNode.type !== "attribute") {
    return sourceNode;
  }
  if (targetNode.type === "attribute" && sourceNode.type !== "attribute") {
    return targetNode;
  }
  if (sourceNode.type === "attribute" && targetNode.type === "attribute") {
    return sourceNode;
  }

  return null;
}

export function getAttributeCardinalityAnchorPoint(options: {
  edge: DiagramEdge;
  sourceNode: DiagramNode;
  targetNode: DiagramNode;
  points: Point[];
}): CardinalityAnchor | null {
  const attributeNode = getAttributeNodeForCardinality(options.edge, options.sourceNode, options.targetNode);
  if (!attributeNode || options.points.length < 2) {
    return null;
  }

  const marker = attributeNode.isMultivalued === true
    ? getNodeCenter(attributeNode)
    : getSimpleAttributeMarkerCenter(attributeNode);
  const attributeIsSource = options.sourceNode.id === attributeNode.id;
  const totalLength = getPolylineLength(options.points);
  const endpoint = attributeIsSource ? options.points[0] : options.points[options.points.length - 1];
  const distanceFromOwner = clamp(
    ATTRIBUTE_CARDINALITY_DISTANCE_FROM_MARKER,
    Math.min(18, totalLength),
    Math.min(30, totalLength),
  );
  const progressFromSource = totalLength <= 0.001 ? 0 : distanceFromOwner / totalLength;
  const preferredProgress = attributeIsSource ? progressFromSource : 1 - progressFromSource;
  const point = getPointAlongPolyline(options.points, preferredProgress);

  return {
    point,
    referencePoint: marker,
    normal: getReadableNormal(endpoint, point),
    preferredProgress,
    lockNearEndpoint: true,
    kind: "attribute-cardinality",
  };
}

export function getCardinalityLabelAnchorPoint(options: {
  edge: DiagramEdge;
  sourceNode: DiagramNode;
  targetNode: DiagramNode;
  points: Point[];
  fallbackPoint: Point;
}): CardinalityAnchor {
  return (
    getConnectorCardinalityAnchorPoint(options) ??
    getAttributeCardinalityAnchorPoint(options) ?? {
      point: options.fallbackPoint,
      referencePoint: options.fallbackPoint,
      normal: getReadableNormal(
        options.points[0] ?? options.fallbackPoint,
        options.points[1] ?? { x: options.fallbackPoint.x + 1, y: options.fallbackPoint.y },
      ),
      preferredProgress: 0.5,
      lockNearEndpoint: false,
      kind: "generic-edge-label",
    }
  );
}

function buildCardinalityCandidates(options: {
  points: Point[];
  anchor: CardinalityAnchor;
}): Point[] {
  if (options.anchor.kind !== "generic-edge-label") {
    const totalLength = Math.max(getPolylineLength(options.points), 0.001);
    const distanceDeltas = [0, 8, -8, 16, -16, 24, -24, 32, -32, 48, -48, 64, -64];
    return distanceDeltas
      .map((delta) =>
        getPointAlongPolyline(
          options.points,
          clamp(options.anchor.preferredProgress + delta / totalLength, 0, 1),
        ),
      )
      .filter(
        (candidate, index, source) =>
          source.findIndex((other) => Math.hypot(candidate.x - other.x, candidate.y - other.y) <= 1) === index,
      );
  }

  const candidates: Point[] = [options.anchor.point];
  const segmentInfo = getNearestSegmentInfo(options.points, options.anchor.point);
  const currentLineClearance = Math.max(segmentInfo.distance, MIN_CARDINALITY_LINE_CLEARANCE + 2);
  const normal = options.anchor.normal;
  const tangent = normalizeVector({ x: normal.y, y: -normal.x }, { x: 1, y: 0 });
  const normalDeltas = [8, -8, 16, -16, 24, -24];
  const tangentDeltas = [8, -8, 16, -16];

  normalDeltas.forEach((offset) => {
    candidates.push(offsetPoint(options.anchor.point, normal, offset));
  });
  tangentDeltas.forEach((offset) => {
    candidates.push(offsetPoint(options.anchor.point, tangent, offset));
  });

  const progressDeltas = [0.03, -0.03, 0.06, -0.06];
  progressDeltas.forEach((delta) => {
    const progress = Math.min(Math.max(options.anchor.preferredProgress + delta, 0), 1);
    const point = getPointAlongPolyline(options.points, progress);
    const offsetPointFromLine = offsetPoint(point, normal, currentLineClearance);
    candidates.push(offsetPointFromLine);
    candidates.push(offsetPoint(offsetPointFromLine, normal, 8));
    candidates.push(offsetPoint(offsetPointFromLine, tangent, 8));
    candidates.push(offsetPoint(offsetPointFromLine, tangent, -8));
  });

  return candidates.filter(
    (candidate, index, source) =>
      source.findIndex((other) => Math.hypot(candidate.x - other.x, candidate.y - other.y) <= 1) === index,
  );
}

function collisionCount(bounds: Bounds, boxes: ReservedLabelBox[]): number {
  return boxes.filter((box) => boundsIntersect(bounds, box)).length;
}

export function chooseCollisionFreeCardinalityLabelPlacement(options: {
  edge: DiagramEdge;
  sourceNode: DiagramNode;
  targetNode: DiagramNode;
  points: Point[];
  defaultPoint: Point;
  label: string;
  reservedBoxes: ReservedLabelBox[];
  alreadyPlacedBoxes: ReservedLabelBox[];
}): EdgeLabelPlacement {
  const width = estimateEdgeLabelWidth(options.label);
  const anchor = getCardinalityLabelAnchorPoint({
    edge: options.edge,
    sourceNode: options.sourceNode,
    targetNode: options.targetNode,
    points: options.points,
    fallbackPoint: options.defaultPoint,
  });
  const candidates = buildCardinalityCandidates({ points: options.points, anchor });
  let best: EdgeLabelPlacement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    const bounds = buildEdgeLabelBounds(candidate, candidate.y, width);
    const segmentInfo = getNearestSegmentInfo(options.points, candidate);
    let score =
      collisionCount(bounds, options.reservedBoxes) * 100000 +
      collisionCount(bounds, options.alreadyPlacedBoxes) * 80000;
    const ownerDistance = distance(candidate, anchor.referencePoint);
    score += distance(candidate, anchor.point) * 8;
    score += ownerDistance * (anchor.kind === "attribute-cardinality" ? 8 : 6);
    score += Math.abs(segmentInfo.progress - anchor.preferredProgress) * (anchor.lockNearEndpoint ? 1600 : 120);

    if (anchor.kind !== "generic-edge-label") {
      score += segmentInfo.distance * 1000000;
    } else if (segmentInfo.distance < MIN_CARDINALITY_LINE_CLEARANCE) {
      score += 1000000 + (MIN_CARDINALITY_LINE_CLEARANCE - segmentInfo.distance) * 100000;
    } else {
      score += Math.abs(segmentInfo.distance - MIN_CARDINALITY_LINE_CLEARANCE - 6) * 0.8;
    }

    const maxOwnerDistance = anchor.kind === "attribute-cardinality"
      ? MAX_ATTRIBUTE_CARDINALITY_DISTANCE_FROM_OWNER
      : anchor.kind === "connector-cardinality"
        ? MAX_CONNECTOR_CARDINALITY_DISTANCE_FROM_OWNER
        : Number.POSITIVE_INFINITY;
    if (ownerDistance > maxOwnerDistance) {
      score += 100000 + (ownerDistance - maxOwnerDistance) * 10000;
    }

    if (score < bestScore) {
      bestScore = score;
      best = {
        point: candidate,
        y: candidate.y,
        width,
        height: 18,
        bounds,
      };
    }
  });

  return best ?? {
    point: anchor.point,
    y: anchor.point.y,
    width,
    height: 18,
    bounds: buildEdgeLabelBounds(anchor.point, anchor.point.y, width),
  };
}
