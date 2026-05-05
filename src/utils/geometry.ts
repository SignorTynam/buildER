import type {
  Bounds,
  DiagramEdge,
  DiagramNode,
  EdgeGeometry,
  EdgeKind,
  GeneralizationGroup,
  Point,
  Viewport,
} from "../types/diagram";

interface EdgeLaneInfo {
  laneIndex: number;
  laneCount: number;
}

type ConnectionSide = "left" | "right" | "top" | "bottom";

interface EdgeEndpointGeometry {
  logicalAnchor: Point;
  visualAttachmentPoint: Point;
  side: ConnectionSide;
}

export const GRID_SIZE = 20;
export const MIN_ZOOM = 0.45;
export const MAX_ZOOM = 2.4;
export const WORLD_EXTENT = 5200;

function usesCompositeAttributeShape(node: DiagramNode): boolean {
  return node.type === "attribute" && node.isMultivalued === true;
}

function getSimpleAttributeIndicatorCenter(node: Extract<DiagramNode, { type: "attribute" }>): Point {
  return {
    x: node.x + 10,
    y: node.y + node.height / 2,
  };
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

export function snapValue(value: number, gridSize = GRID_SIZE): number {
  return Math.round(value / gridSize) * gridSize;
}

export function snapPoint(point: Point, gridSize = GRID_SIZE): Point {
  return {
    x: snapValue(point.x, gridSize),
    y: snapValue(point.y, gridSize),
  };
}

export function worldPointFromClient(
  client: Point,
  viewport: Viewport,
  rect: DOMRect,
): Point {
  return {
    x: (client.x - rect.left - viewport.x) / viewport.zoom,
    y: (client.y - rect.top - viewport.y) / viewport.zoom,
  };
}

export function clientPointFromWorld(
  point: Point,
  viewport: Viewport,
  rect: DOMRect,
): Point {
  return {
    x: rect.left + viewport.x + point.x * viewport.zoom,
    y: rect.top + viewport.y + point.y * viewport.zoom,
  };
}

export function getNodeLogicalAnchor(node: DiagramNode): Point {
  if (node.type === "attribute" && !usesCompositeAttributeShape(node)) {
    // Simple attributes are marker-based; use the indicator center as their logical center.
    return getSimpleAttributeIndicatorCenter(node);
  }

  return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

export function getNodeCenter(node: DiagramNode): Point {
  return getNodeLogicalAnchor(node);
}

export function getGeneralizationJunctionPoint(
  group: GeneralizationGroup,
  supertype: DiagramNode,
  subtypes: DiagramNode[],
  groupIndex: number,
  siblingGroupCount: number,
): Point {
  const superCenter = getNodeCenter(supertype);
  const subtypeCenters = subtypes.length > 0 ? subtypes.map(getNodeCenter) : [{ x: superCenter.x, y: superCenter.y + 180 }];
  const averageSubtype = {
    x: subtypeCenters.reduce((sum, point) => sum + point.x, 0) / subtypeCenters.length,
    y: subtypeCenters.reduce((sum, point) => sum + point.y, 0) / subtypeCenters.length,
  };
  const belowSupertype = averageSubtype.y >= superCenter.y;
  const siblingOffset = (groupIndex - (siblingGroupCount - 1) / 2) * 96;
  const superBoundaryY = belowSupertype ? supertype.y + supertype.height : supertype.y;
  const naturalY = (averageSubtype.y + superBoundaryY) / 2;
  const minGap = 44;
  const y = belowSupertype
    ? Math.max(superBoundaryY + minGap, naturalY)
    : Math.min(superBoundaryY - minGap, naturalY);

  return {
    x: averageSubtype.x + siblingOffset + (group.junctionOffsetX ?? 0),
    y: y + (group.junctionOffsetY ?? 0),
  };
}

export function getNodeBounds(node: DiagramNode): Bounds {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
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

export function normalizeBounds(start: Point, end: Point): Bounds {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(start.x - end.x),
    height: Math.abs(start.y - end.y),
  };
}

export function getDominantConnectionSide(from: Point, to: Point): ConnectionSide {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? "right" : "left";
  }

  return deltaY >= 0 ? "bottom" : "top";
}

function intersectRectBounds(node: DiagramNode, toward: Point): Point {
  const logicalAnchor = getNodeLogicalAnchor(node);
  const deltaX = toward.x - logicalAnchor.x;
  const deltaY = toward.y - logicalAnchor.y;
  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;
  const scaleDenominator = Math.max(
    Math.abs(deltaX) / Math.max(1, halfWidth),
    Math.abs(deltaY) / Math.max(1, halfHeight),
  );

  if (scaleDenominator <= 0.001) {
    return logicalAnchor;
  }

  const t = 1 / scaleDenominator;
  return {
    x: logicalAnchor.x + deltaX * t,
    y: logicalAnchor.y + deltaY * t,
  };
}

function intersectEllipseBounds(node: DiagramNode, toward: Point): Point {
  const logicalAnchor = getNodeLogicalAnchor(node);
  const radiusX = node.width / 2;
  const radiusY = node.height / 2;
  const deltaX = toward.x - logicalAnchor.x;
  const deltaY = toward.y - logicalAnchor.y;
  const scaleDenominator =
    (deltaX * deltaX) / Math.max(1, radiusX * radiusX) +
    (deltaY * deltaY) / Math.max(1, radiusY * radiusY);

  if (scaleDenominator <= 0.001) {
    return logicalAnchor;
  }

  const t = 1 / Math.sqrt(scaleDenominator);
  return {
    x: logicalAnchor.x + deltaX * t,
    y: logicalAnchor.y + deltaY * t,
  };
}

function intersectSimpleAttributeIndicator(node: Extract<DiagramNode, { type: "attribute" }>, toward: Point): Point {
  const indicatorCenter = getSimpleAttributeIndicatorCenter(node);
  const indicatorRadius = 7;
  const deltaX = toward.x - indicatorCenter.x;
  const deltaY = toward.y - indicatorCenter.y;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance <= 0.001) {
    return indicatorCenter;
  }

  const scale = indicatorRadius / distance;
  return {
    x: indicatorCenter.x + deltaX * scale,
    y: indicatorCenter.y + deltaY * scale,
  };
}

function intersectDiamondBounds(node: DiagramNode, toward: Point): Point {
  const logicalAnchor = getNodeLogicalAnchor(node);
  const halfWidth = node.width / 2;
  const halfHeight = node.height / 2;
  const deltaX = toward.x - logicalAnchor.x;
  const deltaY = toward.y - logicalAnchor.y;
  const scaleDenominator =
    Math.abs(deltaX) / Math.max(1, halfWidth) +
    Math.abs(deltaY) / Math.max(1, halfHeight);

  if (scaleDenominator <= 0.001) {
    return logicalAnchor;
  }

  const t = 1 / scaleDenominator;
  return {
    x: logicalAnchor.x + deltaX * t,
    y: logicalAnchor.y + deltaY * t,
  };
}

// Routing decisions use the logical center; the shape perimeter is only used here for final clipping.
export function clipPointToNodePerimeter(node: DiagramNode, toward: Point): Point {
  if (node.type === "relationship") {
    return intersectDiamondBounds(node, toward);
  }

  if (node.type === "attribute") {
    if (usesCompositeAttributeShape(node)) {
      return intersectEllipseBounds(node, toward);
    }

    return intersectSimpleAttributeIndicator(node, toward);
  }

  return intersectRectBounds(node, toward);
}

function buildEdgeEndpointGeometry(node: DiagramNode, toward: Point): EdgeEndpointGeometry {
  const logicalAnchor = getNodeLogicalAnchor(node);

  return {
    logicalAnchor,
    visualAttachmentPoint: clipPointToNodePerimeter(node, toward),
    side: getDominantConnectionSide(logicalAnchor, toward),
  };
}

export function getNodeAnchor(
  node: DiagramNode,
  toward: Point,
  _edgeType: EdgeKind,
  _role: "source" | "target",
): Point {
  return clipPointToNodePerimeter(node, toward);
}

function dedupePoints(points: Point[]): Point[] {
  return points.filter((point, index) => {
    if (index === 0) {
      return true;
    }

    const previous = points[index - 1];
    return previous.x !== point.x || previous.y !== point.y;
  });
}

function simplifyPoints(points: Point[]): Point[] {
  const deduped = dedupePoints(points);

  if (deduped.length <= 2) {
    return deduped;
  }

  const simplified: Point[] = [deduped[0]];

  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previous = simplified[simplified.length - 1];
    const current = deduped[index];
    const next = deduped[index + 1];
    const cross =
      (current.x - previous.x) * (next.y - current.y) -
      (current.y - previous.y) * (next.x - current.x);

    if (Math.abs(cross) < 0.001) {
      continue;
    }

    simplified.push(current);
  }

  simplified.push(deduped[deduped.length - 1]);
  return simplified;
}

export function buildOrthogonalPoints(
  source: Point,
  target: Point,
  edgeType: EdgeKind,
  laneOffset = 0,
): Point[] {
  if (edgeType === "attribute") {
    return simplifyPoints([source, target]);
  }

  const sourceSide = getDominantConnectionSide(source, target);
  const horizontalBias = sourceSide === "left" || sourceSide === "right";

  if (horizontalBias) {
    // Shift the shared trunk instead of the endpoints so exit/entry stay coherent with center-to-center direction.
    const midX = (source.x + target.x) / 2 + laneOffset;
    return simplifyPoints([
      source,
      { x: midX, y: source.y },
      { x: midX, y: target.y },
      target,
    ]);
  }

  const midY = (source.y + target.y) / 2 + laneOffset;
  return simplifyPoints([
    source,
    { x: source.x, y: midY },
    { x: target.x, y: midY },
    target,
  ]);
}

function getParallelLaneOffset(laneInfo?: EdgeLaneInfo): number {
  if (!laneInfo || laneInfo.laneCount <= 1) {
    return 0;
  }

  const step = 16;
  const center = (laneInfo.laneCount - 1) / 2;
  return (laneInfo.laneIndex - center) * step;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function distanceBetweenPoints(start: Point, end: Point): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function movePointToward(from: Point, to: Point, distance: number): Point {
  const length = distanceBetweenPoints(from, to);

  if (length <= 0.001) {
    return from;
  }

  const ratio = distance / length;
  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

function getPointAlongPolyline(points: Point[], progress: number): Point {
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

    return sum + distanceBetweenPoints(points[index - 1], point);
  }, 0);

  if (totalLength <= 0.001) {
    return points[0];
  }

  const targetLength = totalLength * clamp(progress, 0, 1);
  let travelled = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = distanceBetweenPoints(start, end);

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

function getMidpoint(start: Point, end: Point): Point {
  return {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
}

function resolveEdgeLabelPoint(
  edge: DiagramEdge,
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
  points: Point[],
): Point {
  if (edge.type === "connector" || edge.type === "attribute") {
    return getMidpoint(getNodeLogicalAnchor(sourceNode), getNodeLogicalAnchor(targetNode));
  }

  return getPointAlongPolyline(points, 0.5);
}

function attachPolylineToNodeBounds(
  logicalPoints: Point[],
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
): Point[] {
  if (logicalPoints.length < 2) {
    return logicalPoints;
  }

  const points = [...logicalPoints];
  const sourceEndpoint = buildEdgeEndpointGeometry(sourceNode, points[1]);
  const targetEndpoint = buildEdgeEndpointGeometry(targetNode, points[points.length - 2]);

  points[0] = sourceEndpoint.visualAttachmentPoint;
  points[points.length - 1] = targetEndpoint.visualAttachmentPoint;

  return simplifyPoints(points);
}

function buildNonAttributeLogicalPoints(
  edge: Exclude<DiagramEdge, Extract<DiagramEdge, { type: "attribute" }>>,
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
  laneInfo?: EdgeLaneInfo,
): Point[] {
  const laneCount = laneInfo?.laneCount ?? 1;
  const connectorLaneOffset = getParallelLaneOffset(laneInfo) + (edge.manualOffset ?? 0);
  const shouldUseStraightRoute =
    edge.type === "inheritance" ||
    (edge.type === "connector" && laneCount === 1 && connectorLaneOffset === 0);

  return shouldUseStraightRoute
    ? [getNodeLogicalAnchor(sourceNode), getNodeLogicalAnchor(targetNode)]
    : buildOrthogonalPoints(
        getNodeLogicalAnchor(sourceNode),
        getNodeLogicalAnchor(targetNode),
        edge.type,
        connectorLaneOffset,
      );
}

export function getEdgeGeometry(
  edge: DiagramEdge,
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
  laneInfo?: EdgeLaneInfo,
): EdgeGeometry {
  let points: Point[];

  if (edge.type === "attribute") {
    const sourceIsAttribute = sourceNode.type === "attribute";
    const attributeNode = sourceIsAttribute ? sourceNode : targetNode;
    const hostNode = sourceIsAttribute ? targetNode : sourceNode;

    points = attachPolylineToNodeBounds([
      getNodeLogicalAnchor(attributeNode),
      getNodeLogicalAnchor(hostNode),
    ], attributeNode, hostNode);
  } else {
    const logicalPoints = buildNonAttributeLogicalPoints(edge, sourceNode, targetNode, laneInfo);
    points = attachPolylineToNodeBounds(logicalPoints, sourceNode, targetNode);
  }

  return {
    points,
    labelPoint: resolveEdgeLabelPoint(edge, sourceNode, targetNode, points),
  };
}

export function getRenderedEdgeGeometry(
  edge: DiagramEdge,
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
  laneInfo?: EdgeLaneInfo,
): EdgeGeometry {
  if (edge.type === "connector") {
    const points = simplifyPoints(buildNonAttributeLogicalPoints(edge, sourceNode, targetNode, laneInfo));

    return {
      points,
      labelPoint: resolveEdgeLabelPoint(edge, sourceNode, targetNode, points),
    };
  }

  if (edge.type === "attribute") {
    return getEdgeGeometry(edge, sourceNode, targetNode, laneInfo);
  }

  return getEdgeGeometry(edge, sourceNode, targetNode, laneInfo);
}

export function pathFromPoints(points: Point[]): string {
  const simplified = simplifyPoints(points);

  if (simplified.length === 0) {
    return "";
  }

  if (simplified.length === 1) {
    return `M ${simplified[0].x.toFixed(1)} ${simplified[0].y.toFixed(1)}`;
  }

  const commands = [`M ${simplified[0].x.toFixed(1)} ${simplified[0].y.toFixed(1)}`];
  const maxCornerRadius = 22;

  for (let index = 1; index < simplified.length - 1; index += 1) {
    const previous = simplified[index - 1];
    const current = simplified[index];
    const next = simplified[index + 1];
    const incomingLength = distanceBetweenPoints(previous, current);
    const outgoingLength = distanceBetweenPoints(current, next);
    const cornerRadius = Math.min(maxCornerRadius, incomingLength / 2, outgoingLength / 2);

    if (cornerRadius <= 0.5) {
      commands.push(`L ${current.x.toFixed(1)} ${current.y.toFixed(1)}`);
      continue;
    }

    const cornerStart = movePointToward(current, previous, cornerRadius);
    const cornerEnd = movePointToward(current, next, cornerRadius);

    commands.push(`L ${cornerStart.x.toFixed(1)} ${cornerStart.y.toFixed(1)}`);
    commands.push(
      `Q ${current.x.toFixed(1)} ${current.y.toFixed(1)} ${cornerEnd.x.toFixed(1)} ${cornerEnd.y.toFixed(1)}`,
    );
  }

  const last = simplified[simplified.length - 1];
  commands.push(`L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`);
  return commands.join(" ");
}

export function getSelectionBounds(nodes: DiagramNode[]): Bounds | null {
  if (nodes.length === 0) {
    return null;
  }

  const left = Math.min(...nodes.map((node) => node.x));
  const top = Math.min(...nodes.map((node) => node.y));
  const right = Math.max(...nodes.map((node) => node.x + node.width));
  const bottom = Math.max(...nodes.map((node) => node.y + node.height));

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}
