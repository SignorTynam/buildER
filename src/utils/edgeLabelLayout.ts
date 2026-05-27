import type { Bounds, DiagramEdge, DiagramNode, Point } from "../types/diagram";

export interface ReservedLabelBox extends Bounds {
  kind: "node" | "attribute-label" | "edge-label" | "external-identifier" | "shape";
  id: string;
}

export interface EdgeLabelPlacement {
  point: Point;
  y: number;
  width: number;
  height: number;
  bounds: Bounds;
}

export interface AttributeLabelLayoutLike {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
}

const EDGE_LABEL_HEIGHT = 18;
const EDGE_LABEL_Y_OFFSET = 13;
const ATTRIBUTE_LABEL_HEIGHT = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distance(left: Point, right: Point): number {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function distanceSquared(left: Point, right: Point): number {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  return dx * dx + dy * dy;
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

function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

export function boundsIntersect(left: Bounds, right: Bounds): boolean {
  return !(
    left.x + left.width < right.x ||
    right.x + right.width < left.x ||
    left.y + left.height < right.y ||
    right.y + right.height < left.y
  );
}

export function buildEdgeLabelBounds(point: Point, y: number, width: number, height = EDGE_LABEL_HEIGHT): Bounds {
  return {
    x: point.x - width / 2,
    y: y - EDGE_LABEL_Y_OFFSET,
    width,
    height,
  };
}

export function estimateEdgeLabelWidth(label: string): number {
  return label.length * 7 + 10;
}

export function buildAttributeLabelBounds(
  label: string,
  layout: AttributeLabelLayoutLike,
  padding = 4,
): Bounds {
  const width = label.length * 7 + 12;
  const height = ATTRIBUTE_LABEL_HEIGHT;
  const x =
    layout.textAnchor === "middle"
      ? layout.x - width / 2
      : layout.textAnchor === "end"
        ? layout.x - width
        : layout.x;

  return padBounds(
    {
      x,
      y: layout.y - height / 2,
      width,
      height,
    },
    padding,
  );
}

export function buildNodeReservedBounds(node: DiagramNode, padding = 6): ReservedLabelBox[] {
  if (node.type === "attribute" && node.isMultivalued !== true) {
    const indicatorRadius = 8;
    return [
      {
        id: `${node.id}:indicator`,
        kind: "shape",
        x: node.x + 10 - indicatorRadius - padding,
        y: node.y + node.height / 2 - indicatorRadius - padding,
        width: (indicatorRadius + padding) * 2,
        height: (indicatorRadius + padding) * 2,
      },
    ];
  }

  return [
    {
      id: node.id,
      kind: node.type === "attribute" ? "shape" : "node",
      ...padBounds(
        {
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        },
        padding,
      ),
    },
  ];
}

export function getPointAlongPolyline(points: Point[], progress: number): Point {
  if (points.length === 0) {
    return { x: 0, y: 0 };
  }

  if (points.length === 1) {
    return points[0];
  }

  const totalLength = points.reduce((sum, point, index) => {
    if (index === 0) {
      return sum;
    }

    return sum + distance(points[index - 1], point);
  }, 0);

  if (totalLength <= 0.001) {
    return points[0];
  }

  const targetLength = totalLength * clamp(progress, 0, 1);
  let travelled = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distance(start, end);

    if (travelled + segmentLength >= targetLength) {
      const segmentProgress = (targetLength - travelled) / Math.max(segmentLength, 0.001);
      return {
        x: start.x + (end.x - start.x) * segmentProgress,
        y: start.y + (end.y - start.y) * segmentProgress,
      };
    }

    travelled += segmentLength;
  }

  return points[points.length - 1];
}

function getNearestSegmentInfo(points: Point[], point: Point): { distance: number; normal: Point; progress: number } {
  if (points.length < 2) {
    return {
      distance: 0,
      normal: { x: 0, y: -1 },
      progress: 0.5,
    };
  }

  let totalLength = 0;
  const segmentLengths = points.slice(1).map((end, index) => {
    const segmentLength = distance(points[index], end);
    totalLength += segmentLength;
    return segmentLength;
  });
  let travelled = 0;
  let best = {
    distance: Number.POSITIVE_INFINITY,
    normal: { x: 0, y: -1 },
    progress: 0,
  };

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = Math.max(segmentLengths[index - 1], 0.001);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (segmentLength * segmentLength), 0, 1);
    const projection = {
      x: start.x + dx * t,
      y: start.y + dy * t,
    };
    const candidateDistance = distance(point, projection);
    if (candidateDistance < best.distance) {
      let normal = normalizeVector({ x: -dy, y: dx }, { x: 0, y: -1 });
      if (Math.abs(dx) >= Math.abs(dy) && normal.y > 0) {
        normal = { x: -normal.x, y: -normal.y };
      }
      if (Math.abs(dy) > Math.abs(dx) && normal.x < 0) {
        normal = { x: -normal.x, y: -normal.y };
      }

      best = {
        distance: candidateDistance,
        normal,
        progress: totalLength <= 0.001 ? 0.5 : (travelled + segmentLength * t) / totalLength,
      };
    }

    travelled += segmentLength;
  }

  return best;
}

function getCandidateBaseProgresses(edge: DiagramEdge, sourceNode: DiagramNode, targetNode: DiagramNode): number[] {
  if (edge.type !== "connector") {
    return [0.5, 0.38, 0.62, 0.3, 0.7, 0.22, 0.78];
  }

  if (sourceNode.type === "entity") {
    return [0.22, 0.3, 0.38, 0.5, 0.62, 0.7, 0.78];
  }

  if (targetNode.type === "entity") {
    return [0.78, 0.7, 0.62, 0.5, 0.38, 0.3, 0.22];
  }

  return [0.38, 0.5, 0.62, 0.3, 0.7, 0.22, 0.78];
}

function buildCandidatePoints(options: {
  edge: DiagramEdge;
  sourceNode: DiagramNode;
  targetNode: DiagramNode;
  points: Point[];
  defaultPoint: Point;
}): Point[] {
  const candidates: Point[] = [options.defaultPoint];
  const offsetDistances = [12, -12, 22, -22, 34, -34];

  getCandidateBaseProgresses(options.edge, options.sourceNode, options.targetNode).forEach((progress) => {
    const basePoint = getPointAlongPolyline(options.points, progress);
    const segmentInfo = getNearestSegmentInfo(options.points, basePoint);
    candidates.push(basePoint);
    offsetDistances.forEach((offset) => {
      candidates.push({
        x: basePoint.x + segmentInfo.normal.x * offset,
        y: basePoint.y + segmentInfo.normal.y * offset,
      });
    });
  });

  return candidates.filter(
    (candidate, index, source) =>
      source.findIndex((other) => distanceSquared(candidate, other) <= 1) === index,
  );
}

function getConnectorEntityProgress(edge: DiagramEdge, sourceNode: DiagramNode, targetNode: DiagramNode): number | undefined {
  if (edge.type !== "connector") {
    return undefined;
  }

  if (sourceNode.type === "entity") {
    return 0;
  }

  if (targetNode.type === "entity") {
    return 1;
  }

  return undefined;
}

export function chooseCollisionFreeEdgeLabelPlacement(options: {
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
  const defaultBounds = buildEdgeLabelBounds(options.defaultPoint, options.defaultPoint.y, width);
  if (
    !options.reservedBoxes.some((box) => boundsIntersect(defaultBounds, box)) &&
    !options.alreadyPlacedBoxes.some((box) => boundsIntersect(defaultBounds, box))
  ) {
    return {
      point: options.defaultPoint,
      y: options.defaultPoint.y,
      width,
      height: EDGE_LABEL_HEIGHT,
      bounds: defaultBounds,
    };
  }

  const candidates = buildCandidatePoints(options);
  const entityProgress = getConnectorEntityProgress(options.edge, options.sourceNode, options.targetNode);

  let best: EdgeLabelPlacement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  candidates.forEach((candidate) => {
    const bounds = buildEdgeLabelBounds(candidate, candidate.y, width);
    const reservedCollisions = options.reservedBoxes.filter((box) => boundsIntersect(bounds, box)).length;
    const placedCollisions = options.alreadyPlacedBoxes.filter((box) => boundsIntersect(bounds, box)).length;
    const segmentInfo = getNearestSegmentInfo(options.points, candidate);
    let score = reservedCollisions * 10000 + placedCollisions * 8000;

    score += distance(candidate, options.defaultPoint) * 1.5;
    score += segmentInfo.distance * 2;

    if (entityProgress !== undefined) {
      score += Math.abs(segmentInfo.progress - entityProgress) * 200;
    }

    if (
      candidate.x < -2600 ||
      candidate.x > 2600 ||
      candidate.y < -2600 ||
      candidate.y > 2600
    ) {
      score += 500;
    }

    if (score < bestScore) {
      bestScore = score;
      best = {
        point: candidate,
        y: candidate.y,
        width,
        height: EDGE_LABEL_HEIGHT,
        bounds,
      };
    }
  });

  return (
    best ?? {
      point: options.defaultPoint,
      y: options.defaultPoint.y,
      width,
      height: EDGE_LABEL_HEIGHT,
      bounds: buildEdgeLabelBounds(options.defaultPoint, options.defaultPoint.y, width),
    }
  );
}
