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

const CONNECTOR_CARDINALITY_DISTANCE_FROM_ENTITY = 44;
const CONNECTOR_CARDINALITY_NORMAL_OFFSET = 14;
const CONNECTOR_CARDINALITY_MIN_PROGRESS = 0.12;
const CONNECTOR_CARDINALITY_MAX_PROGRESS = 0.35;
const ATTRIBUTE_CARDINALITY_DISTANCE_FROM_MARKER = 18;
const ATTRIBUTE_CARDINALITY_NORMAL_OFFSET = 14;
const ATTRIBUTE_CARDINALITY_MAX_DISTANCE_FROM_MARKER = 44;

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

function getReadableNormal(from: Point, to: Point): Point {
  const direction = normalizeVector({ x: to.x - from.x, y: to.y - from.y }, { x: 1, y: 0 });
  let normal = { x: -direction.y, y: direction.x };

  if (Math.abs(direction.x) >= Math.abs(direction.y)) {
    normal = { x: 0, y: -1 };
  } else if (Math.abs(direction.y) > Math.abs(direction.x)) {
    normal = { x: direction.y >= 0 ? 1 : -1, y: 0 };
  } else if (normal.y > 0) {
    normal = { x: -normal.x, y: -normal.y };
  }

  return normal;
}

function getPolylineLength(points: Point[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += distance(points[index - 1], points[index]);
  }
  return length;
}

function getPointAlongPolylineDistance(points: Point[], distanceFromStart: number): { point: Point; progress: number } {
  if (points.length === 0) {
    return { point: { x: 0, y: 0 }, progress: 0 };
  }
  if (points.length === 1) {
    return { point: points[0], progress: 0 };
  }

  const totalLength = getPolylineLength(points);
  if (totalLength <= 0.001) {
    return { point: points[0], progress: 0 };
  }

  const targetDistance = Math.min(Math.max(distanceFromStart, 0), totalLength);
  let travelled = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);
    if (travelled + segmentLength >= targetDistance) {
      const segmentProgress = (targetDistance - travelled) / Math.max(segmentLength, 0.001);
      return {
        point: {
          x: start.x + (end.x - start.x) * segmentProgress,
          y: start.y + (end.y - start.y) * segmentProgress,
        },
        progress: targetDistance / totalLength,
      };
    }

    travelled += segmentLength;
  }

  return { point: points[points.length - 1], progress: 1 };
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
  const adjacentPoint = entityIsSource ? options.points[1] : options.points[options.points.length - 2];
  const minDistance = totalLength * CONNECTOR_CARDINALITY_MIN_PROGRESS;
  const maxDistance = Math.max(minDistance, totalLength * CONNECTOR_CARDINALITY_MAX_PROGRESS);
  const targetDistanceFromEntity = clamp(CONNECTOR_CARDINALITY_DISTANCE_FROM_ENTITY, minDistance, maxDistance);
  const distanceFromStart = entityIsSource ? targetDistanceFromEntity : totalLength - targetDistanceFromEntity;
  const base = getPointAlongPolylineDistance(options.points, distanceFromStart);
  const normal = getReadableNormal(endpoint, adjacentPoint);
  const point = offsetPoint(base.point, normal, CONNECTOR_CARDINALITY_NORMAL_OFFSET);

  return {
    point,
    referencePoint: endpoint,
    normal,
    preferredProgress: base.progress,
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
  const hostNode = options.sourceNode.id === attributeNode.id ? options.targetNode : options.sourceNode;
  const hostCenter = getNodeCenter(hostNode);
  const direction = normalizeVector({ x: hostCenter.x - marker.x, y: hostCenter.y - marker.y }, { x: 1, y: 0 });
  const normal = getReadableNormal(marker, hostCenter);
  const point = {
    x: marker.x + direction.x * ATTRIBUTE_CARDINALITY_DISTANCE_FROM_MARKER + normal.x * ATTRIBUTE_CARDINALITY_NORMAL_OFFSET,
    y: marker.y + direction.y * ATTRIBUTE_CARDINALITY_DISTANCE_FROM_MARKER + normal.y * ATTRIBUTE_CARDINALITY_NORMAL_OFFSET,
  };
  const segmentInfo = getNearestSegmentInfo(options.points, point);

  return {
    point,
    referencePoint: marker,
    normal,
    preferredProgress: segmentInfo.progress,
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
  const candidates: Point[] = [options.anchor.point];
  const segmentInfo = getNearestSegmentInfo(options.points, options.anchor.point);
  const basePoint = getPointAlongPolyline(options.points, segmentInfo.progress);
  const normal = options.anchor.normal;
  const offsetDistances = [0, 10, -10, 20, -20, 30, -30];

  offsetDistances.forEach((offset) => {
    candidates.push(offsetPoint(basePoint, normal, offset));
  });

  const progressDeltas = options.anchor.kind === "connector-cardinality"
    ? [0.05, -0.05, 0.1, -0.1, 0.16, -0.16]
    : [0.04, -0.04, 0.08, -0.08, 0.12, -0.12];
  progressDeltas.forEach((delta) => {
    const progress = Math.min(Math.max(options.anchor.preferredProgress + delta, 0), 1);
    const point = getPointAlongPolyline(options.points, progress);
    offsetDistances.slice(0, 5).forEach((offset) => {
      candidates.push(offsetPoint(point, normal, offset));
    });
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
    score += distance(candidate, anchor.point) * 8;
    score += distance(candidate, anchor.referencePoint) * (anchor.kind === "attribute-cardinality" ? 5 : 3);
    score += Math.abs(segmentInfo.progress - anchor.preferredProgress) * (anchor.lockNearEndpoint ? 900 : 120);
    score += segmentInfo.distance * 2;

    if (anchor.kind === "attribute-cardinality" && distance(candidate, anchor.referencePoint) > ATTRIBUTE_CARDINALITY_MAX_DISTANCE_FROM_MARKER) {
      score += 3000 + distance(candidate, anchor.referencePoint) * 20;
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
