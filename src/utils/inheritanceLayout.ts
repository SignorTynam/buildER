import type {
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  IsaCompleteness,
  IsaDisjointness,
  Point,
} from "../types/diagram";
import {
  clipPointToNodePerimeter,
  getNodeCenter,
  getSegmentLabelPoint,
  type ConnectionSide,
} from "./geometry";

type InheritanceEdge = Extract<DiagramEdge, { type: "inheritance" }>;
type TriangleApexDirection = "top" | "bottom" | "left" | "right";

export interface InheritanceVisualGroup {
  id: string;
  supertypeId: string;
  subtypeIds: string[];
  edgeIds: string[];
  isaCompleteness: IsaCompleteness;
  isaDisjointness: IsaDisjointness;
}

export interface InheritanceLineSegment {
  id: string;
  from: Point;
  to: Point;
}

export interface InheritanceVisualLayout {
  kind: "single" | "multi";
  triangleCenter: Point;
  triangleApex: Point;
  triangleBaseA: Point;
  triangleBaseB: Point;
  triangleBaseCenter: Point;
  apexDirection: TriangleApexDirection;
  parentSide: ConnectionSide;
  triangleTop: Point;
  triangleBottom: Point;
  triangleLeft: Point;
  triangleRight: Point;
  labelPoint: Point;
  lineSegments: InheritanceLineSegment[];
  hitPoints: Point[];
}

const ISA_TRIANGLE_WIDTH = 24;
const ISA_TRIANGLE_HEIGHT = 18;
const ISA_TRIANGLE_GAP_FROM_PARENT = 14;
const ISA_LABEL_GAP = 28;
const ISA_MIN_VERTICAL_STEM = 70;
const ISA_GROUP_LANE_SPACING = 85;
export const INHERITANCE_LAYOUT_MARKER = 1;

function formatGroupKey(
  supertypeId: string,
  completeness: IsaCompleteness,
  disjointness: IsaDisjointness,
): string {
  return `${supertypeId}|${completeness}|${disjointness}`;
}

function resolveEdgeConstraint(
  edge: InheritanceEdge,
  groupById: Map<string, NonNullable<DiagramDocument["generalizationGroups"]>[number]>,
): { completeness?: IsaCompleteness; disjointness?: IsaDisjointness; groupId?: string } {
  const group = edge.generalizationGroupId ? groupById.get(edge.generalizationGroupId) : undefined;
  return {
    completeness: group?.isaCompleteness ?? edge.isaCompleteness,
    disjointness: group?.isaDisjointness ?? edge.isaDisjointness,
    groupId: group?.id,
  };
}

export function buildInheritanceGroups(diagram: DiagramDocument): InheritanceVisualGroup[] {
  const entityIds = new Set(diagram.nodes.filter((node) => node.type === "entity").map((node) => node.id));
  const groupById = new Map((diagram.generalizationGroups ?? []).map((group) => [group.id, group]));
  const groupsByKey = new Map<string, InheritanceVisualGroup>();

  diagram.edges.forEach((edge) => {
    if (edge.type !== "inheritance") {
      return;
    }

    if (!entityIds.has(edge.sourceId) || !entityIds.has(edge.targetId) || edge.sourceId === edge.targetId) {
      return;
    }

    const { completeness, disjointness, groupId } = resolveEdgeConstraint(edge, groupById);
    if (!completeness || !disjointness) {
      return;
    }

    const key = `${formatGroupKey(edge.targetId, completeness, disjointness)}|${groupId ?? "ungrouped"}`;
    const current =
      groupsByKey.get(key) ??
      {
        id: `inheritance-${key}`,
        supertypeId: edge.targetId,
        subtypeIds: [],
        edgeIds: [],
        isaCompleteness: completeness,
        isaDisjointness: disjointness,
      };

    if (!current.subtypeIds.includes(edge.sourceId)) {
      current.subtypeIds.push(edge.sourceId);
    }
    current.edgeIds.push(edge.id);
    groupsByKey.set(key, current);
  });

  return Array.from(groupsByKey.values()).sort((left, right) => left.id.localeCompare(right.id));
}

function getGroupSubtypeCenterAxis(
  group: InheritanceVisualGroup,
  nodeMap: Map<string, DiagramNode>,
  parentSide: ConnectionSide,
): number {
  const centers = group.subtypeIds
    .map((subtypeId) => nodeMap.get(subtypeId))
    .filter((node): node is DiagramNode => node?.type === "entity")
    .map((node) => {
      const center = getNodeCenter(node);
      return parentSide === "left" || parentSide === "right" ? center.y : center.x;
    });

  if (centers.length === 0) {
    const supertype = nodeMap.get(group.supertypeId);
    if (!supertype) {
      return 0;
    }

    const center = getNodeCenter(supertype);
    return parentSide === "left" || parentSide === "right" ? center.y : center.x;
  }

  return centers.reduce((sum, x) => sum + x, 0) / centers.length;
}

function choosePrimarySibling(
  siblings: InheritanceVisualGroup[],
  nodeMap: Map<string, DiagramNode>,
  parentAxis: number,
  parentSide: ConnectionSide,
): InheritanceVisualGroup {
  return [...siblings].sort((left, right) => {
    const subtypeCountDelta = right.subtypeIds.length - left.subtypeIds.length;
    if (subtypeCountDelta !== 0) {
      return subtypeCountDelta;
    }

    const leftDistance = Math.abs(getGroupSubtypeCenterAxis(left, nodeMap, parentSide) - parentAxis);
    const rightDistance = Math.abs(getGroupSubtypeCenterAxis(right, nodeMap, parentSide) - parentAxis);
    const distanceDelta = leftDistance - rightDistance;
    return Math.abs(distanceDelta) > 0.001 ? distanceDelta : left.id.localeCompare(right.id);
  })[0];
}

function getSiblingOffset(
  group: InheritanceVisualGroup,
  groups: InheritanceVisualGroup[],
  nodeMap: Map<string, DiagramNode>,
  parentSide: ConnectionSide,
): Point {
  const supertype = nodeMap.get(group.supertypeId);
  const parentCenter = supertype ? getNodeCenter(supertype) : { x: 0, y: 0 };
  const parentAxis = parentSide === "left" || parentSide === "right" ? parentCenter.y : parentCenter.x;
  const siblings = groups.filter((candidate) => candidate.supertypeId === group.supertypeId);
  if (siblings.length <= 1) {
    return { x: 0, y: 0 };
  }

  const primary = choosePrimarySibling(siblings, nodeMap, parentAxis, parentSide);
  if (group.id === primary.id) {
    return { x: 0, y: 0 };
  }

  const remaining = siblings
    .filter((candidate) => candidate.id !== primary.id)
    .sort((left, right) => {
      const leftCenter = getGroupSubtypeCenterAxis(left, nodeMap, parentSide);
      const rightCenter = getGroupSubtypeCenterAxis(right, nodeMap, parentSide);
      const sideDelta = Math.sign(leftCenter - parentAxis) - Math.sign(rightCenter - parentAxis);
      if (sideDelta !== 0) {
        return sideDelta;
      }

      const distanceDelta = Math.abs(leftCenter - parentAxis) - Math.abs(rightCenter - parentAxis);
      return Math.abs(distanceDelta) > 0.001 ? distanceDelta : left.id.localeCompare(right.id);
    });


  const groupAxis = getGroupSubtypeCenterAxis(group, nodeMap, parentSide);
  const preferPositive = groupAxis >= parentAxis;
  const sameSide = remaining.filter(
    (entry) => (getGroupSubtypeCenterAxis(entry, nodeMap, parentSide) >= parentAxis) === preferPositive,
  );
  let sideIndex = sameSide.findIndex((entry) => entry.id === group.id) + 1;
  if (sideIndex <= 0) {
    sideIndex = 1;
  }

  const direction = preferPositive ? 1 : -1;
  const desiredOffset = direction * sideIndex * ISA_GROUP_LANE_SPACING;
  const parentSpan = parentSide === "left" || parentSide === "right" ? supertype?.height : supertype?.width;
  const maxOffset = parentSpan ? Math.max(0, parentSpan / 2 - ISA_TRIANGLE_WIDTH / 2 - 8) : Math.abs(desiredOffset);
  const clampedOffset = clamp(desiredOffset, -maxOffset, maxOffset);

  return parentSide === "left" || parentSide === "right"
    ? { x: 0, y: clampedOffset }
    : { x: clampedOffset, y: 0 };
}

function pointWithMin(points: Point[], axis: "x" | "y"): Point {
  return points.reduce((best, point) => (point[axis] < best[axis] ? point : best), points[0]);
}

function pointWithMax(points: Point[], axis: "x" | "y"): Point {
  return points.reduce((best, point) => (point[axis] > best[axis] ? point : best), points[0]);
}

function buildTriangle(
  center: Point,
  apexDirection: TriangleApexDirection,
): Pick<
  InheritanceVisualLayout,
  | "triangleApex"
  | "triangleBaseA"
  | "triangleBaseB"
  | "triangleBaseCenter"
  | "apexDirection"
  | "triangleTop"
  | "triangleBottom"
  | "triangleLeft"
  | "triangleRight"
> {
  const halfWidth = ISA_TRIANGLE_WIDTH / 2;
  const halfHeight = ISA_TRIANGLE_HEIGHT / 2;
  let triangleApex: Point;
  let triangleBaseA: Point;
  let triangleBaseB: Point;

  if (apexDirection === "top") {
    triangleApex = { x: center.x, y: center.y - halfHeight };
    triangleBaseA = { x: center.x - halfWidth, y: center.y + halfHeight };
    triangleBaseB = { x: center.x + halfWidth, y: center.y + halfHeight };
  } else if (apexDirection === "bottom") {
    triangleApex = { x: center.x, y: center.y + halfHeight };
    triangleBaseA = { x: center.x - halfWidth, y: center.y - halfHeight };
    triangleBaseB = { x: center.x + halfWidth, y: center.y - halfHeight };
  } else if (apexDirection === "left") {
    triangleApex = { x: center.x - halfHeight, y: center.y };
    triangleBaseA = { x: center.x + halfHeight, y: center.y - halfWidth };
    triangleBaseB = { x: center.x + halfHeight, y: center.y + halfWidth };
  } else {
    triangleApex = { x: center.x + halfHeight, y: center.y };
    triangleBaseA = { x: center.x - halfHeight, y: center.y - halfWidth };
    triangleBaseB = { x: center.x - halfHeight, y: center.y + halfWidth };
  }

  const trianglePoints = [triangleApex, triangleBaseA, triangleBaseB];

  return {
    triangleApex,
    triangleBaseA,
    triangleBaseB,
    triangleBaseCenter: {
      x: (triangleBaseA.x + triangleBaseB.x) / 2,
      y: (triangleBaseA.y + triangleBaseB.y) / 2,
    },
    apexDirection,
    triangleTop: pointWithMin(trianglePoints, "y"),
    triangleBottom: pointWithMax(trianglePoints, "y"),
    triangleLeft: pointWithMin(trianglePoints, "x"),
    triangleRight: pointWithMax(trianglePoints, "x"),
  };
}

function getApexDirection(parentSide: ConnectionSide): TriangleApexDirection {
  if (parentSide === "bottom") {
    return "top";
  }
  if (parentSide === "top") {
    return "bottom";
  }
  if (parentSide === "right") {
    return "left";
  }

  return "right";
}

function getChildrenCentroid(subtypes: DiagramNode[], fallback: Point): Point {
  if (subtypes.length === 0) {
    return fallback;
  }

  const sum = subtypes.reduce(
    (total, subtype) => {
      const center = getNodeCenter(subtype);
      return {
        x: total.x + center.x,
        y: total.y + center.y,
      };
    },
    { x: 0, y: 0 },
  );

  return {
    x: sum.x / subtypes.length,
    y: sum.y / subtypes.length,
  };
}

function getParentSide(supertype: DiagramNode, subtypes: DiagramNode[]): ConnectionSide {
  const parentCenter = getNodeCenter(supertype);
  const childrenCentroid = getChildrenCentroid(subtypes, parentCenter);
  const deltaX = childrenCentroid.x - parentCenter.x;
  const deltaY = childrenCentroid.y - parentCenter.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? "right" : "left";
  }

  return deltaY >= 0 ? "bottom" : "top";
}

function getTriangleCenter(supertype: DiagramNode, offset: Point, parentSide: ConnectionSide): Point {
  const superCenter = getNodeCenter(supertype);

  if (parentSide === "bottom") {
    return {
      x: superCenter.x + offset.x,
      y: supertype.y + supertype.height + ISA_TRIANGLE_GAP_FROM_PARENT + ISA_TRIANGLE_HEIGHT / 2,
    };
  }

  if (parentSide === "top") {
    return {
      x: superCenter.x + offset.x,
      y: supertype.y - ISA_TRIANGLE_GAP_FROM_PARENT - ISA_TRIANGLE_HEIGHT / 2,
    };
  }

  if (parentSide === "right") {
    return {
      x: supertype.x + supertype.width + ISA_TRIANGLE_GAP_FROM_PARENT + ISA_TRIANGLE_HEIGHT / 2,
      y: superCenter.y + offset.y,
    };
  }

  return {
    x: supertype.x - ISA_TRIANGLE_GAP_FROM_PARENT - ISA_TRIANGLE_HEIGHT / 2,
    y: superCenter.y + offset.y,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getSubtypeNodes(
  group: InheritanceVisualGroup,
  nodeMap: Map<string, DiagramNode>,
  parentSide: ConnectionSide,
): DiagramNode[] {
  return group.subtypeIds
    .map((subtypeId) => nodeMap.get(subtypeId))
    .filter((node): node is DiagramNode => node?.type === "entity")
    .sort((left, right) => {
      const leftCenter = getNodeCenter(left);
      const rightCenter = getNodeCenter(right);
      const primaryDelta =
        parentSide === "left" || parentSide === "right"
          ? leftCenter.y - rightCenter.y
          : leftCenter.x - rightCenter.x;
      if (Math.abs(primaryDelta) > 0.001) {
        return primaryDelta;
      }
      const secondaryDelta =
        parentSide === "left" || parentSide === "right"
          ? leftCenter.x - rightCenter.x
          : leftCenter.y - rightCenter.y;
      return Math.abs(secondaryDelta) > 0.001 ? secondaryDelta : left.id.localeCompare(right.id);
    });
}

function isSamePoint(left: Point, right: Point): boolean {
  return Math.abs(left.x - right.x) <= 0.001 && Math.abs(left.y - right.y) <= 0.001;
}

function pointsToSegments(idPrefix: string, points: Point[]): InheritanceLineSegment[] {
  const segments: InheritanceLineSegment[] = [];

  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    if (!isSamePoint(from, to)) {
      segments.push({ id: `${idPrefix}-${index}`, from, to });
    }
  }

  return segments;
}

function clampBetween(value: number, first: number, second: number): number {
  return clamp(value, Math.min(first, second), Math.max(first, second));
}

function getBusCoordinate(trunkStart: number, childBoundary: number, laneOffset = 0): number {
  const direction = childBoundary >= trunkStart ? 1 : -1;
  const nearParent = trunkStart + direction * ISA_MIN_VERTICAL_STEM;
  const nearChildren = childBoundary - direction * ISA_LABEL_GAP;
  const natural = (trunkStart + childBoundary) / 2 + laneOffset;

  if (direction > 0 ? nearChildren > nearParent : nearChildren < nearParent) {
    return clampBetween(natural, nearParent, nearChildren);
  }

  return nearParent;
}

function getParentAttachPoint(supertype: DiagramNode, parentSide: ConnectionSide, triangleApex: Point): Point {
  if (parentSide === "left" || parentSide === "right") {
    return {
      x: parentSide === "right" ? supertype.x + supertype.width : supertype.x,
      y: clamp(triangleApex.y, supertype.y, supertype.y + supertype.height),
    };
  }

  return {
    x: clamp(triangleApex.x, supertype.x, supertype.x + supertype.width),
    y: parentSide === "bottom" ? supertype.y + supertype.height : supertype.y,
  };
}

export function getInheritanceGroupLayout(
  group: InheritanceVisualGroup,
  nodeMap: Map<string, DiagramNode>,
  groups: InheritanceVisualGroup[],
): InheritanceVisualLayout | null {
  const supertype = nodeMap.get(group.supertypeId);
  if (!supertype || supertype.type !== "entity") {
    return null;
  }

  const rawSubtypes = group.subtypeIds
    .map((subtypeId) => nodeMap.get(subtypeId))
    .filter((node): node is DiagramNode => node?.type === "entity");
  const parentSide = getParentSide(supertype, rawSubtypes);
  const subtypes = getSubtypeNodes(group, nodeMap, parentSide);
  if (subtypes.length === 0) {
    return null;
  }

  const offset = getSiblingOffset(group, groups, nodeMap, parentSide);
  const triangleCenter = getTriangleCenter(supertype, offset, parentSide);
  const apexDirection = getApexDirection(parentSide);
  const triangle = buildTriangle(triangleCenter, apexDirection);
  const superAttach = getParentAttachPoint(supertype, parentSide, triangle.triangleApex);
  const trunkStart = triangle.triangleBaseCenter;

  if (subtypes.length === 1) {
    return getSingleInheritanceRoute(
      group,
      subtypes[0],
      triangleCenter,
      triangle,
      parentSide,
      superAttach,
      trunkStart,
    );
  }

  return getMultiInheritanceBusLayout(group, subtypes, triangleCenter, triangle, parentSide, superAttach, trunkStart, offset);
}

export function getSingleInheritanceRoute(
  group: InheritanceVisualGroup,
  subtype: DiagramNode,
  triangleCenter: Point,
  triangle: Pick<
    InheritanceVisualLayout,
    | "triangleApex"
    | "triangleBaseA"
    | "triangleBaseB"
    | "triangleBaseCenter"
    | "apexDirection"
    | "triangleTop"
    | "triangleBottom"
    | "triangleLeft"
    | "triangleRight"
  >,
  parentSide: ConnectionSide,
  superAttach: Point,
  trunkStart: Point,
): InheritanceVisualLayout {
  const subtypeCenter = getNodeCenter(subtype);
  const childAttach = clipPointToNodePerimeter(subtype, trunkStart);
  const alignedVertically = Math.abs(trunkStart.x - subtypeCenter.x) <= 2;
  const alignedHorizontally = Math.abs(trunkStart.y - subtypeCenter.y) <= 2;
  let routePoints: Point[];

  if (alignedVertically || alignedHorizontally) {
    routePoints = [trunkStart, childAttach];
  } else if (parentSide === "top" || parentSide === "bottom") {
    const childBoundary = parentSide === "bottom" ? subtype.y : subtype.y + subtype.height;
    const elbowY = getBusCoordinate(trunkStart.y, childBoundary);
    const childStemStart = { x: subtypeCenter.x, y: elbowY };
    routePoints = [
      trunkStart,
      { x: trunkStart.x, y: elbowY },
      childStemStart,
      clipPointToNodePerimeter(subtype, childStemStart),
    ];
  } else {
    const childBoundary = parentSide === "right" ? subtype.x : subtype.x + subtype.width;
    const elbowX = getBusCoordinate(trunkStart.x, childBoundary);
    const childStemStart = { x: elbowX, y: subtypeCenter.y };
    routePoints = [
      trunkStart,
      { x: elbowX, y: trunkStart.y },
      childStemStart,
      clipPointToNodePerimeter(subtype, childStemStart),
    ];
  }

  const routeSegments = pointsToSegments("route", routePoints);
  const labelSegment = routeSegments[0] ?? { from: trunkStart, to: childAttach };
  const labelPoint = getSegmentLabelPoint(labelSegment.from, labelSegment.to, 18);

  return {
    kind: "single",
    triangleCenter,
    parentSide,
    ...triangle,
    labelPoint,
    lineSegments: [
      { id: "supertype-stem", from: superAttach, to: triangle.triangleApex },
      ...routeSegments.map((segment, index) => ({
        ...segment,
        id:
          index === 0
            ? "trunk"
            : index === routeSegments.length - 1
              ? `subtype-${group.subtypeIds[0]}`
              : `elbow-${index}`,
      })),
    ],
    hitPoints: [superAttach, triangle.triangleApex, ...routePoints],
  };
}

export function getMultiInheritanceBusLayout(
  group: InheritanceVisualGroup,
  subtypes: DiagramNode[],
  triangleCenter: Point,
  triangle: Pick<
    InheritanceVisualLayout,
    | "triangleApex"
    | "triangleBaseA"
    | "triangleBaseB"
    | "triangleBaseCenter"
    | "apexDirection"
    | "triangleTop"
    | "triangleBottom"
    | "triangleLeft"
    | "triangleRight"
  >,
  parentSide: ConnectionSide,
  superAttach: Point,
  trunkStart: Point,
  offset: Point,
): InheritanceVisualLayout {
  const subtypeCenters = subtypes.map(getNodeCenter);
  const verticalLayout = parentSide === "left" || parentSide === "right";
  let trunkEnd: Point;
  let busStart: Point;
  let busEnd: Point;
  let busJoin: Point;
  let trunkJoinSegments: InheritanceLineSegment[];
  let branches: InheritanceLineSegment[];

  if (verticalLayout) {
    const childBoundary = parentSide === "right"
      ? Math.min(...subtypes.map((node) => node.x))
      : Math.max(...subtypes.map((node) => node.x + node.width));
    const busX = getBusCoordinate(trunkStart.x, childBoundary, offset.x);
    const minY = Math.min(...subtypeCenters.map((point) => point.y));
    const maxY = Math.max(...subtypeCenters.map((point) => point.y));
    const busStartY = minY === maxY ? minY - ISA_LABEL_GAP : minY;
    const busEndY = minY === maxY ? maxY + ISA_LABEL_GAP : maxY;

    trunkEnd = { x: busX, y: trunkStart.y };
    busStart = { x: busX, y: busStartY };
    busEnd = { x: busX, y: busEndY };
    busJoin = { x: busX, y: clamp(trunkStart.y, busStartY, busEndY) };
    trunkJoinSegments = Math.abs(trunkEnd.y - busJoin.y) > 0.001
      ? [{ id: "trunk-bus-join", from: trunkEnd, to: busJoin }]
      : [];
    branches = subtypes.map((subtype) => {
      const subtypeCenter = getNodeCenter(subtype);
      const from = { x: busX, y: subtypeCenter.y };
      return {
        id: `subtype-${subtype.id}`,
        from,
        to: clipPointToNodePerimeter(subtype, from),
      };
    });
  } else {
    const childBoundary = parentSide === "bottom"
      ? Math.min(...subtypes.map((node) => node.y))
      : Math.max(...subtypes.map((node) => node.y + node.height));
    const busY = getBusCoordinate(trunkStart.y, childBoundary, offset.y);
    const minX = Math.min(...subtypeCenters.map((point) => point.x));
    const maxX = Math.max(...subtypeCenters.map((point) => point.x));
    const busStartX = minX === maxX ? minX - ISA_LABEL_GAP : minX;
    const busEndX = minX === maxX ? maxX + ISA_LABEL_GAP : maxX;

    trunkEnd = { x: trunkStart.x, y: busY };
    busStart = { x: busStartX, y: busY };
    busEnd = { x: busEndX, y: busY };
    busJoin = { x: clamp(trunkStart.x, busStartX, busEndX), y: busY };
    trunkJoinSegments = Math.abs(trunkEnd.x - busJoin.x) > 0.001
      ? [{ id: "trunk-bus-join", from: trunkEnd, to: busJoin }]
      : [];
    branches = subtypes.map((subtype) => {
      const subtypeCenter = getNodeCenter(subtype);
      const from = { x: subtypeCenter.x, y: busY };
      return {
        id: `subtype-${subtype.id}`,
        from,
        to: clipPointToNodePerimeter(subtype, from),
      };
    });
  }

  const labelPoint = getSegmentLabelPoint(trunkStart, trunkEnd, 18);

  return {
    kind: "multi",
    triangleCenter,
    parentSide,
    ...triangle,
    labelPoint,
    lineSegments: [
      { id: "supertype-stem", from: superAttach, to: triangle.triangleApex },
      { id: "trunk", from: trunkStart, to: trunkEnd },
      ...trunkJoinSegments,
      { id: "bus", from: busStart, to: busEnd },
      ...branches,
    ],
    hitPoints: [superAttach, triangle.triangleApex, trunkStart, trunkEnd, busJoin, busStart, busEnd],
  };
}
