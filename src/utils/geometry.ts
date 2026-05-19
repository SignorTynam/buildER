import type {
  Bounds,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EdgeGeometry,
  EdgeKind,
  GeneralizationGroup,
  IsaGroupLayout,
  Point,
  Viewport,
} from "../types/diagram";

interface EdgeLaneInfo {
  laneIndex: number;
  laneCount: number;
}

export type ConnectionSide = "left" | "right" | "top" | "bottom";

interface EdgeEndpointGeometry {
  logicalAnchor: Point;
  visualAttachmentPoint: Point;
  side: ConnectionSide;
}

export const GRID_SIZE = 20;
export const MIN_ZOOM = 0.45;
export const MAX_ZOOM = 2.4;
export const WORLD_EXTENT = 5200;
export const ISA_TRIANGLE_WIDTH = 18;
export const ISA_TRIANGLE_HEIGHT = 16;
const ISA_TRIANGLE_GAP = 8;
const ISA_TRUNK_MIN_LENGTH = 18;
const ISA_BUS_PADDING = 22;
const ISA_BUS_MIN_HALF = 28;
const ISA_GROUP_SIBLING_OFFSET_X = 70;
const ISA_GROUP_SIBLING_OFFSET_Y = 26;

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

export function computeClassicIsaGroupLayout(
  diagram: DiagramDocument,
  group: GeneralizationGroup,
): IsaGroupLayout | null {
  const supertype = diagram.nodes.find(
    (node) => node.type === "entity" && node.id === group.supertypeId,
  );
  if (!supertype) {
    return null;
  }

  const subtypes = group.subtypeIds
    .map((subtypeId) => diagram.nodes.find((node) => node.id === subtypeId))
    .filter((node): node is DiagramNode => node?.type === "entity");
  if (subtypes.length === 0) {
    return null;
  }

  const siblings = (diagram.generalizationGroups ?? []).filter(
    (candidate) => candidate.supertypeId === group.supertypeId,
  );
  const siblingIndex = Math.max(0, siblings.findIndex((candidate) => candidate.id === group.id));
  const siblingCount = Math.max(1, siblings.length);
  const siblingOffsetX = (siblingIndex - (siblingCount - 1) / 2) * ISA_GROUP_SIBLING_OFFSET_X;
  const siblingOffsetY = (siblingIndex - (siblingCount - 1) / 2) * ISA_GROUP_SIBLING_OFFSET_Y;

  const superCenter = getNodeCenter(supertype);
  const superBottom = supertype.y + supertype.height;
  const triangleCenter: Point = {
    x: superCenter.x + siblingOffsetX + (group.junctionOffsetX ?? 0),
    y: superBottom + ISA_TRIANGLE_GAP + ISA_TRIANGLE_HEIGHT / 2 + (group.junctionOffsetY ?? 0),
  };

  const subtypeCenters = subtypes.map(getNodeCenter);
  const minSubtypeTop = Math.min(...subtypes.map((node) => node.y));
  const baseBusY = (superBottom + minSubtypeTop) / 2;
  const minBusY = triangleCenter.y + ISA_TRIANGLE_HEIGHT / 2 + ISA_TRUNK_MIN_LENGTH;
  const maxBusY = minSubtypeTop - 24;
  const busY = clamp(baseBusY + siblingOffsetY, minBusY, Math.max(minBusY, maxBusY));
  const trunkX = triangleCenter.x;

  const minX = Math.min(...subtypeCenters.map((point) => point.x));
  const maxX = Math.max(...subtypeCenters.map((point) => point.x));
  let busStartX = minX - ISA_BUS_PADDING;
  let busEndX = maxX + ISA_BUS_PADDING;
  if (minX === maxX) {
    busStartX = minX - ISA_BUS_MIN_HALF;
    busEndX = maxX + ISA_BUS_MIN_HALF;
  }
  busStartX = Math.min(busStartX, trunkX - 6);
  busEndX = Math.max(busEndX, trunkX + 6);

  const trunkTop: Point = {
    x: trunkX,
    y: triangleCenter.y + ISA_TRIANGLE_HEIGHT / 2,
  };
  const trunkBottom: Point = {
    x: trunkX,
    y: busY,
  };

  const labelPoint: Point = {
    x: trunkX + 14,
    y: (trunkTop.y + trunkBottom.y) / 2,
  };

  const subtypeBranches = subtypes.map((subtype) => {
    const subtypeCenter = getNodeCenter(subtype);
    const branchFrom = { x: subtypeCenter.x, y: busY };
    const branchTo = clipPointToNodePerimeter(subtype, branchFrom);
    return {
      subtypeId: subtype.id,
      from: branchFrom,
      to: branchTo,
    };
  });

  return {
    triangleCenter,
    trunkTop,
    trunkBottom,
    busStart: { x: busStartX, y: busY },
    busEnd: { x: busEndX, y: busY },
    busY,
    labelPoint,
    subtypeBranches,
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

export function getNodeConnectionSide(node: DiagramNode, toward: Point): ConnectionSide {
  return getDominantConnectionSide(getNodeLogicalAnchor(node), toward);
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

export function getConnectionPoint(node: DiagramNode, toward: Point): Point {
  return clipPointToNodePerimeter(node, toward);
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

  if (Math.abs(laneOffset) > 0.001 && Math.abs(source.y - target.y) <= 8) {
    const laneY = (source.y + target.y) / 2 + laneOffset;
    return simplifyPoints([
      source,
      { x: source.x, y: laneY },
      { x: target.x, y: laneY },
      target,
    ]);
  }

  if (Math.abs(laneOffset) > 0.001 && Math.abs(source.x - target.x) <= 8) {
    const laneX = (source.x + target.x) / 2 + laneOffset;
    return simplifyPoints([
      source,
      { x: laneX, y: source.y },
      { x: laneX, y: target.y },
      target,
    ]);
  }

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

  const step = 60;
  const center = (laneInfo.laneCount - 1) / 2;
  return (laneInfo.laneIndex - center) * step;
}

function offsetPoint(point: Point, normalX: number, normalY: number, offset: number): Point {
  return {
    x: point.x + normalX * offset,
    y: point.y + normalY * offset,
  };
}

function buildParallelConnectorRenderedPoints(
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
  laneOffset: number,
): Point[] {
  const sourceAnchor = getNodeLogicalAnchor(sourceNode);
  const targetAnchor = getNodeLogicalAnchor(targetNode);
  const deltaX = targetAnchor.x - sourceAnchor.x;
  const deltaY = targetAnchor.y - sourceAnchor.y;
  const length = Math.hypot(deltaX, deltaY);

  if (length <= 0.001 || Math.abs(laneOffset) <= 0.001) {
    return attachPolylineToNodeBounds([sourceAnchor, targetAnchor], sourceNode, targetNode);
  }

  const normalX = -deltaY / length;
  const normalY = deltaX / length;
  const sourceEndpoint = clipPointToNodePerimeter(sourceNode, targetAnchor);
  const targetEndpoint = clipPointToNodePerimeter(targetNode, sourceAnchor);
  return [
    offsetPoint(sourceEndpoint, normalX, normalY, laneOffset),
    offsetPoint(targetEndpoint, normalX, normalY, laneOffset),
  ];
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

export function getSegmentLabelPoint(start: Point, end: Point, offset = 14): Point {
  const midpoint = getMidpoint(start, end);
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const length = Math.hypot(deltaX, deltaY);

  if (length <= 0.001) {
    return { x: midpoint.x, y: midpoint.y - offset };
  }

  if (Math.abs(deltaY) > Math.abs(deltaX) * 2.5) {
    return {
      x: midpoint.x + (deltaX >= 0 ? offset : -offset),
      y: midpoint.y,
    };
  }

  if (Math.abs(deltaX) > Math.abs(deltaY) * 2.5) {
    return {
      x: midpoint.x,
      y: midpoint.y - offset,
    };
  }

  let normalX = -deltaY / length;
  let normalY = deltaX / length;
  if (normalY > 0) {
    normalX *= -1;
    normalY *= -1;
  }

  return {
    x: midpoint.x + normalX * offset,
    y: midpoint.y + normalY * offset,
  };
}

function getLongestSegment(points: Point[]): { start: Point; end: Point } | null {
  if (points.length < 2) {
    return null;
  }

  let longest = {
    start: points[0],
    end: points[1],
    length: distanceBetweenPoints(points[0], points[1]),
  };

  for (let index = 2; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = distanceBetweenPoints(start, end);
    if (length > longest.length) {
      longest = { start, end, length };
    }
  }

  return longest;
}

function resolveEdgeLabelPoint(
  edge: DiagramEdge,
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
  points: Point[],
): Point {
  if (edge.type === "connector") {
    const labelSegment = getLongestSegment(points);
    if (labelSegment) {
      return getSegmentLabelPoint(labelSegment.start, labelSegment.end, 12);
    }
  }

  if (edge.type === "attribute") {
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
  const sourceAnchor = getNodeLogicalAnchor(sourceNode);
  const targetAnchor = getNodeLogicalAnchor(targetNode);

  const shouldUseStraightRoute =
    edge.type === "inheritance" ||
    (edge.type === "connector" && laneCount === 1 && connectorLaneOffset === 0);

  return shouldUseStraightRoute
    ? [sourceAnchor, targetAnchor]
    : buildOrthogonalPoints(
        sourceAnchor,
        targetAnchor,
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
  } else if (edge.type === "connector" && (laneInfo?.laneCount ?? 1) > 1) {
    points = buildParallelConnectorRenderedPoints(
      sourceNode,
      targetNode,
      getParallelLaneOffset(laneInfo) + (edge.manualOffset ?? 0),
    );
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
    if ((laneInfo?.laneCount ?? 1) > 1) {
      const points = buildParallelConnectorRenderedPoints(
        sourceNode,
        targetNode,
        getParallelLaneOffset(laneInfo) + (edge.manualOffset ?? 0),
      );

      return {
        points,
        labelPoint: resolveEdgeLabelPoint(edge, sourceNode, targetNode, points),
      };
    }

    const logicalPoints = buildNonAttributeLogicalPoints(edge, sourceNode, targetNode, laneInfo);
    const points = attachPolylineToNodeBounds(logicalPoints, sourceNode, targetNode);

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
