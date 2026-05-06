import type {
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  IsaCompleteness,
  IsaDisjointness,
  Point,
} from "../types/diagram";
import {
  getNodeCenter,
  ISA_TRIANGLE_HEIGHT,
  ISA_TRIANGLE_WIDTH,
} from "./geometry";

type InheritanceEdge = Extract<DiagramEdge, { type: "inheritance" }>;

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
  triangleTop: Point;
  triangleBottom: Point;
  triangleLeft: Point;
  triangleRight: Point;
  labelPoint: Point;
  lineSegments: InheritanceLineSegment[];
  hitPoints: Point[];
}

const ISA_TRIANGLE_GAP = 8;
const ISA_TRUNK_MIN_LENGTH = 18;
const ISA_MULTI_BUS_PADDING = 0;
const ISA_SINGLE_CHILD_CLEARANCE = 24;
const ISA_LABEL_OFFSET_X = 16;
const ISA_GROUP_SIBLING_OFFSET_X = 64;
const ISA_GROUP_SIBLING_OFFSET_Y = 26;

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
): { completeness?: IsaCompleteness; disjointness?: IsaDisjointness } {
  const group = edge.generalizationGroupId ? groupById.get(edge.generalizationGroupId) : undefined;
  return {
    completeness: group?.isaCompleteness ?? edge.isaCompleteness,
    disjointness: group?.isaDisjointness ?? edge.isaDisjointness,
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

    const { completeness, disjointness } = resolveEdgeConstraint(edge, groupById);
    if (!completeness || !disjointness) {
      return;
    }

    const key = formatGroupKey(edge.targetId, completeness, disjointness);
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

function getGroupSubtypeCenterX(group: InheritanceVisualGroup, nodeMap: Map<string, DiagramNode>): number {
  const centers = group.subtypeIds
    .map((subtypeId) => nodeMap.get(subtypeId))
    .filter((node): node is DiagramNode => node?.type === "entity")
    .map((node) => getNodeCenter(node).x);

  if (centers.length === 0) {
    const supertype = nodeMap.get(group.supertypeId);
    return supertype ? getNodeCenter(supertype).x : 0;
  }

  return centers.reduce((sum, x) => sum + x, 0) / centers.length;
}

function getSiblingOffset(
  group: InheritanceVisualGroup,
  groups: InheritanceVisualGroup[],
  nodeMap: Map<string, DiagramNode>,
): Point {
  const siblings = groups
    .filter((candidate) => candidate.supertypeId === group.supertypeId)
    .sort((left, right) => {
      const delta = getGroupSubtypeCenterX(left, nodeMap) - getGroupSubtypeCenterX(right, nodeMap);
      return Math.abs(delta) > 0.001 ? delta : left.id.localeCompare(right.id);
    });
  const siblingIndex = Math.max(0, siblings.findIndex((candidate) => candidate.id === group.id));
  const siblingCount = Math.max(1, siblings.length);
  const lane = siblingIndex - (siblingCount - 1) / 2;

  return {
    x: lane * ISA_GROUP_SIBLING_OFFSET_X,
    y: lane * ISA_GROUP_SIBLING_OFFSET_Y,
  };
}

function buildTriangle(center: Point): Pick<
  InheritanceVisualLayout,
  "triangleTop" | "triangleBottom" | "triangleLeft" | "triangleRight"
> {
  const halfWidth = ISA_TRIANGLE_WIDTH / 2;
  const halfHeight = ISA_TRIANGLE_HEIGHT / 2;

  return {
    triangleTop: { x: center.x, y: center.y - halfHeight },
    triangleBottom: { x: center.x, y: center.y + halfHeight },
    triangleLeft: { x: center.x - halfWidth, y: center.y - halfHeight },
    triangleRight: { x: center.x + halfWidth, y: center.y - halfHeight },
  };
}

function getTriangleCenter(supertype: DiagramNode, offset: Point): Point {
  const superCenter = getNodeCenter(supertype);

  return {
    x: superCenter.x + offset.x,
    y: supertype.y + supertype.height + ISA_TRIANGLE_GAP + ISA_TRIANGLE_HEIGHT / 2 + offset.y,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getSubtypeNodes(group: InheritanceVisualGroup, nodeMap: Map<string, DiagramNode>): DiagramNode[] {
  return group.subtypeIds
    .map((subtypeId) => nodeMap.get(subtypeId))
    .filter((node): node is DiagramNode => node?.type === "entity")
    .sort((left, right) => {
      const leftCenter = getNodeCenter(left);
      const rightCenter = getNodeCenter(right);
      const xDelta = leftCenter.x - rightCenter.x;
      if (Math.abs(xDelta) > 0.001) {
        return xDelta;
      }
      const yDelta = leftCenter.y - rightCenter.y;
      return Math.abs(yDelta) > 0.001 ? yDelta : left.id.localeCompare(right.id);
    });
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

  const subtypes = getSubtypeNodes(group, nodeMap);
  if (subtypes.length === 0) {
    return null;
  }

  const offset = getSiblingOffset(group, groups, nodeMap);
  const triangleCenter = getTriangleCenter(supertype, offset);
  const triangle = buildTriangle(triangleCenter);
  const superAttach = { x: triangle.triangleTop.x, y: supertype.y + supertype.height };
  const trunkTop = triangle.triangleBottom;

  if (subtypes.length === 1) {
    return getSingleInheritanceRoute(group, supertype, subtypes[0], triangleCenter, triangle, superAttach, trunkTop);
  }

  return getMultiInheritanceBusLayout(group, supertype, subtypes, triangleCenter, triangle, superAttach, trunkTop, offset);
}

export function getSingleInheritanceRoute(
  group: InheritanceVisualGroup,
  _supertype: DiagramNode,
  subtype: DiagramNode,
  triangleCenter: Point,
  triangle: Pick<InheritanceVisualLayout, "triangleTop" | "triangleBottom" | "triangleLeft" | "triangleRight">,
  superAttach: Point,
  trunkTop: Point,
): InheritanceVisualLayout {
  const subtypeCenter = getNodeCenter(subtype);
  const subtypeTopY = subtype.y;
  const minElbowY = trunkTop.y + ISA_TRUNK_MIN_LENGTH;
  const maxElbowY = subtypeTopY - ISA_SINGLE_CHILD_CLEARANCE;
  const naturalElbowY = (trunkTop.y + subtypeTopY) / 2;
  const elbowY = maxElbowY > minElbowY ? clamp(naturalElbowY, minElbowY, maxElbowY) : minElbowY;
  const elbow: Point = { x: trunkTop.x, y: elbowY };
  const childStemTop: Point = { x: subtypeCenter.x, y: elbowY };
  const childAttach = { x: subtypeCenter.x, y: subtype.y };
  const labelPoint: Point = {
    x: trunkTop.x + ISA_LABEL_OFFSET_X,
    y: (trunkTop.y + elbow.y) / 2,
  };

  return {
    kind: "single",
    triangleCenter,
    ...triangle,
    labelPoint,
    lineSegments: [
      { id: "supertype-stem", from: superAttach, to: triangle.triangleTop },
      { id: "trunk", from: trunkTop, to: elbow },
      { id: "elbow", from: elbow, to: childStemTop },
      { id: `subtype-${group.subtypeIds[0]}`, from: childStemTop, to: childAttach },
    ],
    hitPoints: [superAttach, triangle.triangleTop, triangle.triangleBottom, elbow, childStemTop, childAttach],
  };
}

export function getMultiInheritanceBusLayout(
  group: InheritanceVisualGroup,
  _supertype: DiagramNode,
  subtypes: DiagramNode[],
  triangleCenter: Point,
  triangle: Pick<InheritanceVisualLayout, "triangleTop" | "triangleBottom" | "triangleLeft" | "triangleRight">,
  superAttach: Point,
  trunkTop: Point,
  offset: Point,
): InheritanceVisualLayout {
  const subtypeCenters = subtypes.map(getNodeCenter);
  const minSubtypeTop = Math.min(...subtypes.map((node) => node.y));
  const minBusY = trunkTop.y + ISA_TRUNK_MIN_LENGTH;
  const maxBusY = minSubtypeTop - ISA_SINGLE_CHILD_CLEARANCE;
  const naturalBusY = (trunkTop.y + minSubtypeTop) / 2 + offset.y;
  const busY = maxBusY > minBusY ? clamp(naturalBusY, minBusY, maxBusY) : minBusY;
  const trunkBottom: Point = { x: trunkTop.x, y: busY };
  const firstSubtypeCenter = subtypeCenters[0];
  const lastSubtypeCenter = subtypeCenters[subtypeCenters.length - 1];
  const busStart: Point = {
    x: Math.min(firstSubtypeCenter.x, lastSubtypeCenter.x) - ISA_MULTI_BUS_PADDING,
    y: busY,
  };
  const busEnd: Point = {
    x: Math.max(firstSubtypeCenter.x, lastSubtypeCenter.x) + ISA_MULTI_BUS_PADDING,
    y: busY,
  };
  const busJoin: Point = { x: clamp(trunkTop.x, busStart.x, busEnd.x), y: busY };
  const labelPoint: Point = {
    x: trunkTop.x + ISA_LABEL_OFFSET_X,
    y: (trunkTop.y + trunkBottom.y) / 2,
  };
  const trunkJoinSegments: InheritanceLineSegment[] =
    Math.abs(trunkBottom.x - busJoin.x) > 0.001
      ? [{ id: "trunk-bus-join", from: trunkBottom, to: busJoin }]
      : [];
  const branches: InheritanceLineSegment[] = subtypes.map((subtype) => {
    const subtypeCenter = getNodeCenter(subtype);
    const from = { x: subtypeCenter.x, y: busY };
    return {
      id: `subtype-${subtype.id}`,
      from,
      to: { x: subtypeCenter.x, y: subtype.y },
    };
  });

  return {
    kind: "multi",
    triangleCenter,
    ...triangle,
    labelPoint,
    lineSegments: [
      { id: "supertype-stem", from: superAttach, to: triangle.triangleTop },
      { id: "trunk", from: trunkTop, to: trunkBottom },
      ...trunkJoinSegments,
      { id: "bus", from: busStart, to: busEnd },
      ...branches,
    ],
    hitPoints: [superAttach, triangle.triangleTop, triangle.triangleBottom, trunkBottom, busJoin, busStart, busEnd],
  };
}
