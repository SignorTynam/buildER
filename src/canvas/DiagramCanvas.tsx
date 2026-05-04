import { useEffect, useRef, useState } from "react";
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from "react";
import { DiagramEdgeView } from "./DiagramEdge";
import { DiagramNodeView, getAttributeLabelLayout } from "./DiagramNode";
import { getToolDefinitions } from "../utils/toolConfig";
import {
  expandNodeIdsForMove,
  getExternalIdentifierImportedAttributes,
} from "../utils/diagram";
import {
  clampZoom,
  clipPointToNodePerimeter,
  clientPointFromWorld,
  getEdgeGeometry,
  getNodeAnchor,
  getNodeCenter,
  getNodeBounds,
  getSelectionBounds,
  GRID_SIZE,
  normalizeBounds,
  pathFromPoints,
  snapValue,
  WORLD_EXTENT,
  worldPointFromClient,
} from "../utils/geometry";
import type {
  Bounds,
  DiagramDocument,
  DiagramHighlightKind,
  DiagramHighlights,
  EdgeKind,
  DiagramEdge,
  DiagramNode,
  EditorMode,
  Point,
  SelectionState,
  ToolKind,
  ValidationIssue,
  Viewport,
} from "../types/diagram";

const DIAGRAM_STROKE = "var(--diagram-stroke)";
const DIAGRAM_SELECTION_FILL = "var(--diagram-selection-fill)";
const DIAGRAM_FOCUS = "var(--diagram-focus)";

type FocusTarget =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | null;

type InteractionState =
  | { kind: "idle" }
  | {
      kind: "pan";
      pointerId: number;
      startClient: Point;
      startViewport: Viewport;
    }
  | {
      kind: "drag";
      pointerId: number;
      startClient: Point;
      originalDiagram: DiagramDocument;
      nodeIds: string[];
      originPositions: Record<string, Point>;
    }
  | {
      kind: "marquee";
      pointerId: number;
      startWorld: Point;
      currentWorld: Point;
      additive: boolean;
      baseSelection: SelectionState;
    }
  | {
      kind: "edge-drag";
      pointerId: number;
      startClient: Point;
      originalDiagram: DiagramDocument;
      edgeId: string;
      startOffset: number;
      axis: "x" | "y";
    }
  | {
      kind: "external-id-drag";
      pointerId: number;
      startClient: Point;
      originalDiagram: DiagramDocument;
      hostEntityId: string;
      externalIdentifierId: string;
      startOffset: number;
    }
  | {
      kind: "external-id-marker-drag";
      pointerId: number;
      startClient: Point;
      originalDiagram: DiagramDocument;
      hostEntityId: string;
      externalIdentifierId: string;
      startOffsetX: number;
      startOffsetY: number;
    };

type InlineEditState =
  | { kind: "node"; id: string; value: string }
  | { kind: "edge"; id: string; value: string }
  | null;

type CanvasGuidanceTone = "info" | "success" | "warning" | "error";
type CanvasGuidanceState =
  | "idle"
  | "selecting-source"
  | "selecting-target"
  | "dragging-routing"
  | "editing-label"
  | "invalid-action";

interface PersistentCanvasMessage {
  key: string;
  message: string;
  tone: CanvasGuidanceTone;
}

interface DiagramCanvasProps {
  diagram: DiagramDocument;
  selection: SelectionState;
  tool: ToolKind;
  mode: EditorMode;
  viewport: Viewport;
  issues: ValidationIssue[];
  statusMessage: string;
  svgRef: RefObject<SVGSVGElement>;
  translationHighlights?: DiagramHighlights;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: SelectionState) => void;
  onPreviewDiagram: (diagram: DiagramDocument) => void;
  onCommitDiagram: (diagram: DiagramDocument, previous: DiagramDocument) => void;
  onCreateNode: (
    type: Extract<ToolKind, "entity" | "relationship" | "attribute">,
    point: Point,
  ) => string;
  onCreateEdge: (
    type: EdgeKind,
    sourceId: string,
    targetId: string,
  ) => { success: boolean; message: string };
  onOpenCardinality: (edgeId?: string) => void;
  onToolChange: (tool: ToolKind) => void;
  onCreateExternalIdentifier: (
    sourceAttributeId: string,
    targetId: string,
  ) => { success: boolean; message: string };
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onDeleteSelection: () => void;
  onDeleteExternalIdentifier: (hostEntityId: string, externalIdentifierId: string) => void;
  onRenameNode: (nodeId: string, label: string) => void;
  onRenameEdge: (edgeId: string, label: string) => void;
  onStatusMessageChange: (message: string) => void;
}

function resolveTranslationHighlight(id: string, highlights?: DiagramHighlights): DiagramHighlightKind | undefined {
  if (!highlights) {
    return undefined;
  }

  if (highlights.selectedNodeIds?.includes(id) || highlights.selectedEdgeIds?.includes(id)) {
    return "selected";
  }

  if (highlights.pendingNodeIds?.includes(id) || highlights.pendingEdgeIds?.includes(id)) {
    return "pending";
  }

  if (highlights.blockedNodeIds?.includes(id) || highlights.blockedEdgeIds?.includes(id)) {
    return "blocked";
  }

  return undefined;
}

function getCanvasMessageTone(message: string): CanvasGuidanceTone {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return "info";
  }

  if (
    normalized.includes("errore") ||
    normalized.includes("impossibile") ||
    normalized.includes("non ") ||
    normalized.includes("blocc")
  ) {
    return "error";
  }

  if (
    normalized.includes("annull") ||
    normalized.includes("attenzione") ||
    normalized.includes("warning") ||
    normalized.includes("seleziona") ||
    normalized.includes("rimuov")
  ) {
    return "warning";
  }

  if (
    normalized.includes("aggiunt") ||
    normalized.includes("creat") ||
    normalized.includes("aggiornat") ||
    normalized.includes("salvat") ||
    normalized.includes("esportat")
  ) {
    return "success";
  }

  return "info";
}

function shouldPersistCanvasMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  const transientPatterns = [
    /^zoom /,
    /^viewport /,
    /centrat/,
    /adattat/,
    /spostat[oa] con la tastiera/,
    /regolat[oa] con la tastiera/,
  ];

  return !transientPatterns.some((pattern) => pattern.test(normalized));
}

const VIEWPORT_PADDING = 140;
const COMPOSITE_INTERNAL_BACKBONE_MIN_OFFSET = 18;
const COMPOSITE_INTERNAL_BACKBONE_MIN_SAFE_OFFSET = 8;
const COMPOSITE_INTERNAL_BACKBONE_MAX_OFFSET = 70;
const COMPOSITE_INTERNAL_BACKBONE_DEFAULT_OFFSET = 30;
const COMPOSITE_INTERNAL_BACKBONE_DISTANCE_RATIO = 0.45;
const COMPOSITE_INTERNAL_BACKBONE_PADDING = 10;
const COMPOSITE_INTERNAL_BRANCH_MIN_SPACING = 22;
const COMPOSITE_INTERNAL_MIN_BRANCH_LENGTH = 10;
const COMPOSITE_INTERNAL_MARKER_OFFSET = 22;
const EXTERNAL_IDENTIFIER_FRAME_PADDING = 18;
const EXTERNAL_IDENTIFIER_MIN_SEGMENT_LENGTH = 9;
const EXTERNAL_IDENTIFIER_ENTITY_MARKER_RISE = 24;
const EXTERNAL_IDENTIFIER_COMPOSITE_MARKER_DISTANCE = 15;

interface CompositeIdentifierMember {
  attributeId: string;
  attributeCenter: Point;
  hostAnchor: Point;
}

interface CompositeIdentifierBranch {
  attributeId: string;
  from: Point;
  to: Point;
}

interface CompositeIdentifierStem {
  attributeId: string;
  from: Point;
  to: Point;
}

interface CompositeIdentifierLayout {
  groupKey: string;
  hostEntityId: string;
  memberAttributeIds: string[];
  orientation: "vertical" | "horizontal";
  backboneStart: Point;
  backboneEnd: Point;
  branches: CompositeIdentifierBranch[];
  hostStems: CompositeIdentifierStem[];
  junctions: Point[];
  markerStemFrom: Point;
  marker: Point;
}

interface ExternalIdentifierLayout {
  externalIdentifierId: string;
  hostEntityId: string;
  relationshipId: string;
  kind: "imported_only" | "imported_plus_local";
  marker: Point;
  pathPoints: Point[];
  markerStemStart?: Point;
  junction?: Point;
  attributeJunction?: Point;
}

type FrameSide = "left" | "right" | "top" | "bottom";

interface RouteFrame {
  left: number;
  top: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
}

function expandBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

function viewportForBounds(bounds: Bounds, rect: DOMRect, zoom: number): Viewport {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;

  return {
    zoom,
    x: rect.width / 2 - centerX * zoom,
    y: rect.height / 2 - centerY * zoom,
  };
}

function getBoundsForViewport(nodes: DiagramNode[]): Bounds | null {
  if (nodes.length === 0) {
    return null;
  }

  return getSelectionBounds(nodes);
}

function addToSelection(selection: SelectionState, nodeId: string): SelectionState {
  if (selection.nodeIds.includes(nodeId)) {
    return {
      nodeIds: selection.nodeIds.filter((id) => id !== nodeId),
      edgeIds: [],
    };
  }

  return {
    nodeIds: [...selection.nodeIds, nodeId],
    edgeIds: [],
  };
}

function unionSelection(base: SelectionState, nodeIds: string[]): SelectionState {
  return {
    nodeIds: Array.from(new Set([...base.nodeIds, ...nodeIds])),
    edgeIds: [],
  };
}

function buildAttributeDirectionMap(diagram: DiagramDocument): Map<string, Point> {
  const directions = new Map<string, Point>();
  const localNodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));

  diagram.edges.forEach((edge) => {
    if (edge.type !== "attribute") {
      return;
    }

    const sourceNode = localNodeMap.get(edge.sourceId);
    const targetNode = localNodeMap.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      return;
    }

    const attributeNode =
      sourceNode.type === "attribute" ? sourceNode : targetNode.type === "attribute" ? targetNode : null;
    if (!attributeNode || directions.has(attributeNode.id)) {
      return;
    }

    const hostNode = attributeNode.id === sourceNode.id ? targetNode : sourceNode;
    const attributeCenter = getNodeCenter(attributeNode);
    const hostCenter = getNodeCenter(hostNode);

    directions.set(attributeNode.id, {
      x: hostCenter.x - attributeCenter.x,
      y: hostCenter.y - attributeCenter.y,
    });
  });

  return directions;
}

function editableTool(tool: ToolKind): tool is Extract<ToolKind, "entity" | "relationship" | "attribute"> {
  return tool === "entity" || tool === "relationship" || tool === "attribute";
}

function placeableCanvasTool(tool: ToolKind): tool is Extract<ToolKind, "entity" | "relationship"> {
  return tool === "entity" || tool === "relationship";
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function spreadValuesWithMinimumSpacing(
  points: Array<{ id: string; value: number }>,
  minimumSpacing: number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (points.length === 0) {
    return result;
  }

  const sorted = [...points].sort((left, right) => {
    const delta = left.value - right.value;
    return Math.abs(delta) <= 0.001 ? left.id.localeCompare(right.id) : delta;
  });
  const spread = sorted.map((entry) => entry.value);

  for (let index = 1; index < spread.length; index += 1) {
    const minAllowed = spread[index - 1] + minimumSpacing;
    if (spread[index] < minAllowed) {
      spread[index] = minAllowed;
    }
  }

  const originalCenter = (sorted[0].value + sorted[sorted.length - 1].value) / 2;
  const spreadCenter = (spread[0] + spread[spread.length - 1]) / 2;
  const correction = originalCenter - spreadCenter;

  sorted.forEach((entry, index) => {
    result.set(entry.id, spread[index] + correction);
  });

  return result;
}

function getFrameSidePoint(frame: RouteFrame, side: FrameSide, reference: Point): Point {
  if (side === "left" || side === "right") {
    return {
      x: side === "left" ? frame.left : frame.right,
      y: clampNumber(reference.y, frame.top, frame.bottom),
    };
  }

  return {
    x: clampNumber(reference.x, frame.left, frame.right),
    y: side === "top" ? frame.top : frame.bottom,
  };
}

function getNextSide(side: FrameSide, direction: "cw" | "ccw"): FrameSide {
  const clockwiseOrder: FrameSide[] = ["top", "right", "bottom", "left"];
  const index = clockwiseOrder.indexOf(side);
  if (direction === "cw") {
    return clockwiseOrder[(index + 1) % clockwiseOrder.length];
  }

  return clockwiseOrder[(index + clockwiseOrder.length - 1) % clockwiseOrder.length];
}

function getCornerBetweenSides(frame: RouteFrame, from: FrameSide, to: FrameSide): Point {
  if (from === "top" && to === "right") {
    return { x: frame.right, y: frame.top };
  }
  if (from === "right" && to === "bottom") {
    return { x: frame.right, y: frame.bottom };
  }
  if (from === "bottom" && to === "left") {
    return { x: frame.left, y: frame.bottom };
  }
  if (from === "left" && to === "top") {
    return { x: frame.left, y: frame.top };
  }
  if (from === "top" && to === "left") {
    return { x: frame.left, y: frame.top };
  }
  if (from === "left" && to === "bottom") {
    return { x: frame.left, y: frame.bottom };
  }
  if (from === "bottom" && to === "right") {
    return { x: frame.right, y: frame.bottom };
  }

  return { x: frame.right, y: frame.top };
}

function buildFrameRoute(
  frame: RouteFrame,
  startSide: FrameSide,
  startPoint: Point,
  endSide: FrameSide,
  endPoint: Point,
  direction: "cw" | "ccw",
): Point[] {
  const points: Point[] = [startPoint];
  let currentSide = startSide;

  while (currentSide !== endSide) {
    const nextSide = getNextSide(currentSide, direction);
    points.push(getCornerBetweenSides(frame, currentSide, nextSide));
    currentSide = nextSide;
  }

  points.push(endPoint);
  return points;
}

function routeLength(points: Point[]): number {
  if (points.length < 2) {
    return 0;
  }

  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return total;
}

function routeTouchesBottom(route: Point[], frame: RouteFrame): boolean {
  return route.some((point) => Math.abs(point.y - frame.bottom) <= 0.01);
}

function routeTouchesRight(route: Point[], frame: RouteFrame): boolean {
  return route.some((point) => Math.abs(point.x - frame.right) <= 0.01);
}

function selectFrameRoute(
  frame: RouteFrame,
  startSide: FrameSide,
  startPoint: Point,
  endSide: FrameSide,
  endPoint: Point,
): Point[] {
  const clockwise = buildFrameRoute(frame, startSide, startPoint, endSide, endPoint, "cw");
  const counterClockwise = buildFrameRoute(frame, startSide, startPoint, endSide, endPoint, "ccw");
  const clockwiseLength = routeLength(clockwise);
  const counterClockwiseLength = routeLength(counterClockwise);

  if (clockwiseLength + 0.5 < counterClockwiseLength) {
    return clockwise;
  }
  if (counterClockwiseLength + 0.5 < clockwiseLength) {
    return counterClockwise;
  }

  const horizontalOpposite =
    (startSide === "left" && endSide === "right") || (startSide === "right" && endSide === "left");
  if (horizontalOpposite) {
    const preferBottom = endPoint.y >= frame.centerY;
    const clockwiseUsesBottom = routeTouchesBottom(clockwise, frame);
    return clockwiseUsesBottom === preferBottom ? clockwise : counterClockwise;
  }

  const verticalOpposite =
    (startSide === "top" && endSide === "bottom") || (startSide === "bottom" && endSide === "top");
  if (verticalOpposite) {
    const preferRight = endPoint.x >= frame.centerX;
    const clockwiseUsesRight = routeTouchesRight(clockwise, frame);
    return clockwiseUsesRight === preferRight ? clockwise : counterClockwise;
  }

  return clockwise;
}

function getFrameSideNormal(side: FrameSide): Point {
  if (side === "left") {
    return { x: -1, y: 0 };
  }
  if (side === "right") {
    return { x: 1, y: 0 };
  }
  if (side === "top") {
    return { x: 0, y: -1 };
  }

  return { x: 0, y: 1 };
}

function resolveFrameSide(bounds: Bounds, anchor: Point, outwardHint: Point): FrameSide {
  const sideDistances: Array<{ side: FrameSide; distance: number }> = [
    { side: "left", distance: Math.abs(anchor.x - bounds.x) },
    { side: "right", distance: Math.abs(anchor.x - (bounds.x + bounds.width)) },
    { side: "top", distance: Math.abs(anchor.y - bounds.y) },
    { side: "bottom", distance: Math.abs(anchor.y - (bounds.y + bounds.height)) },
  ];
  const minDistance = Math.min(...sideDistances.map((entry) => entry.distance));
  const candidateSides = sideDistances.filter((entry) => entry.distance <= minDistance + 1.2);

  if (candidateSides.length === 1) {
    return candidateSides[0].side;
  }

  const hintLength = Math.hypot(outwardHint.x, outwardHint.y);
  const normalizedHint =
    hintLength <= 0.001
      ? { x: 1, y: 0 }
      : {
          x: outwardHint.x / hintLength,
          y: outwardHint.y / hintLength,
        };

  let best = candidateSides[0];
  let bestScore = Number.NEGATIVE_INFINITY;
  candidateSides.forEach((entry) => {
    const normal = getFrameSideNormal(entry.side);
    const score = normal.x * normalizedHint.x + normal.y * normalizedHint.y;
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  });

  return best.side;
}

function chooseCompositeGroupSide(
  hostBounds: Bounds,
  hostCenter: Point,
  members: CompositeIdentifierMember[],
): FrameSide {
  const sideStats = new Map<FrameSide, { count: number; distance: number }>();
  const preferredSideOrder: FrameSide[] = ["bottom", "top", "right", "left"];

  members.forEach((member) => {
    const outwardHint = {
      x: member.attributeCenter.x - hostCenter.x,
      y: member.attributeCenter.y - hostCenter.y,
    };
    const side = resolveFrameSide(hostBounds, member.hostAnchor, outwardHint);
    const outwardDistance =
      side === "left" || side === "right"
        ? Math.abs(member.attributeCenter.x - hostCenter.x)
        : Math.abs(member.attributeCenter.y - hostCenter.y);
    const current = sideStats.get(side) ?? { count: 0, distance: 0 };
    sideStats.set(side, {
      count: current.count + 1,
      distance: current.distance + outwardDistance,
    });
  });

  let bestSide: FrameSide | null = null;
  let bestCount = -1;
  let bestDistance = -1;
  preferredSideOrder.forEach((side) => {
    const stats = sideStats.get(side) ?? { count: 0, distance: 0 };
    const betterCount = stats.count > bestCount;
    const sameCount = stats.count === bestCount;
    const betterDistance = stats.distance > bestDistance + 0.001;
    if (betterCount || (sameCount && betterDistance)) {
      bestSide = side;
      bestCount = stats.count;
      bestDistance = stats.distance;
    }
  });

  if (bestSide && bestCount > 0) {
    return bestSide;
  }

  const centroid = members.reduce(
    (sum, member) => ({
      x: sum.x + member.attributeCenter.x,
      y: sum.y + member.attributeCenter.y,
    }),
    { x: 0, y: 0 },
  );
  const centroidPoint = {
    x: centroid.x / members.length,
    y: centroid.y / members.length,
  };
  const deltaX = centroidPoint.x - hostCenter.x;
  const deltaY = centroidPoint.y - hostCenter.y;

  if (Math.abs(deltaY) >= Math.abs(deltaX)) {
    return deltaY >= 0 ? "bottom" : "top";
  }

  return deltaX >= 0 ? "right" : "left";
}

function computeCompositeBackboneOffset(
  hostSideCoordinate: number,
  memberCoordinates: number[],
  outwardSign: number,
): number {
  const outwardDistances = memberCoordinates
    .map((coordinate) => outwardSign * (coordinate - hostSideCoordinate))
    .filter((distance) => Number.isFinite(distance));
  if (outwardDistances.length === 0) {
    return COMPOSITE_INTERNAL_BACKBONE_DEFAULT_OFFSET;
  }

  const positiveDistances = outwardDistances.map((distance) => Math.max(0, distance));
  const averageDistance =
    positiveDistances.reduce((sum, distance) => sum + distance, 0) / positiveDistances.length;
  const nearestMemberDistance = Math.min(...positiveDistances.filter((distance) => distance > 0));

  let offset = clampNumber(
    averageDistance * COMPOSITE_INTERNAL_BACKBONE_DISTANCE_RATIO,
    COMPOSITE_INTERNAL_BACKBONE_MIN_OFFSET,
    COMPOSITE_INTERNAL_BACKBONE_MAX_OFFSET,
  );

  if (Number.isFinite(nearestMemberDistance)) {
    const maxReadableOffset = Math.max(
      COMPOSITE_INTERNAL_BACKBONE_MIN_SAFE_OFFSET,
      nearestMemberDistance - COMPOSITE_INTERNAL_MIN_BRANCH_LENGTH,
    );
    offset = Math.min(offset, maxReadableOffset);
  }

  if (!Number.isFinite(offset)) {
    return COMPOSITE_INTERNAL_BACKBONE_DEFAULT_OFFSET;
  }

  return Math.max(COMPOSITE_INTERNAL_BACKBONE_MIN_SAFE_OFFSET, offset);
}

function buildCompositeIdentifierLayout(
  groupKey: string,
  hostEntityId: string,
  hostBounds: Bounds,
  hostCenter: Point,
  members: CompositeIdentifierMember[],
): CompositeIdentifierLayout | null {
  if (members.length < 2) {
    return null;
  }

  const groupSide = chooseCompositeGroupSide(hostBounds, hostCenter, members);

  if (groupSide === "top" || groupSide === "bottom") {
    const outwardSign = groupSide === "bottom" ? 1 : -1;
    const hostSideY = groupSide === "bottom" ? hostBounds.y + hostBounds.height : hostBounds.y;
    const axisOffset = computeCompositeBackboneOffset(
      hostSideY,
      members.map((member) => member.attributeCenter.y),
      outwardSign,
    );
    const backboneY = hostSideY + outwardSign * axisOffset;
    const branchXByAttributeId = spreadValuesWithMinimumSpacing(
      members.map((member) => ({
        id: member.attributeId,
        value: member.attributeCenter.x,
      })),
      COMPOSITE_INTERNAL_BRANCH_MIN_SPACING,
    );

    const branches = members
      .map((member) => {
        const branchX = branchXByAttributeId.get(member.attributeId) ?? member.attributeCenter.x;
        return {
          attributeId: member.attributeId,
          from: { x: branchX, y: backboneY },
          to: { x: branchX, y: member.attributeCenter.y },
        };
      })
      .sort((left, right) => left.from.x - right.from.x || left.attributeId.localeCompare(right.attributeId));

    if (branches.length < 2) {
      return null;
    }

    const backboneStart = {
      x: branches[0].from.x - COMPOSITE_INTERNAL_BACKBONE_PADDING,
      y: backboneY,
    };
    const backboneEnd = {
      x: branches[branches.length - 1].from.x + COMPOSITE_INTERNAL_BACKBONE_PADDING,
      y: backboneY,
    };
    const hostStems = branches.map((branch) => ({
      attributeId: branch.attributeId,
      from: { x: branch.from.x, y: hostSideY },
      to: { ...branch.from },
    }));
    const markerStemFrom = { ...backboneStart };

    return {
      groupKey,
      hostEntityId,
      memberAttributeIds: branches.map((branch) => branch.attributeId),
      orientation: "horizontal",
      backboneStart,
      backboneEnd,
      branches,
      hostStems,
      junctions: branches.map((branch) => branch.from),
      markerStemFrom,
      marker: {
        x: markerStemFrom.x - COMPOSITE_INTERNAL_MARKER_OFFSET,
        y: markerStemFrom.y,
      },
    };
  }

  const outwardSign = groupSide === "right" ? 1 : -1;
  const hostSideX = groupSide === "right" ? hostBounds.x + hostBounds.width : hostBounds.x;
  const axisOffset = computeCompositeBackboneOffset(
    hostSideX,
    members.map((member) => member.attributeCenter.x),
    outwardSign,
  );
  const backboneX = hostSideX + outwardSign * axisOffset;
  const branchYByAttributeId = spreadValuesWithMinimumSpacing(
    members.map((member) => ({
      id: member.attributeId,
      value: member.attributeCenter.y,
    })),
    COMPOSITE_INTERNAL_BRANCH_MIN_SPACING,
  );

  const branches = members
    .map((member) => {
      const branchY = branchYByAttributeId.get(member.attributeId) ?? member.attributeCenter.y;
      return {
        attributeId: member.attributeId,
        from: { x: backboneX, y: branchY },
        to: { x: member.attributeCenter.x, y: branchY },
      };
    })
    .sort((left, right) => left.from.y - right.from.y || left.attributeId.localeCompare(right.attributeId));

  if (branches.length < 2) {
    return null;
  }

  const backboneStart = {
    x: backboneX,
    y: branches[0].from.y - COMPOSITE_INTERNAL_BACKBONE_PADDING,
  };
  const backboneEnd = {
    x: backboneX,
    y: branches[branches.length - 1].from.y + COMPOSITE_INTERNAL_BACKBONE_PADDING,
  };
  const hostStems = branches.map((branch) => ({
    attributeId: branch.attributeId,
    from: { x: hostSideX, y: branch.from.y },
    to: { ...branch.from },
  }));
  const markerStemFrom = { ...backboneEnd };

  return {
    groupKey,
    hostEntityId,
    memberAttributeIds: branches.map((branch) => branch.attributeId),
    orientation: "vertical",
    backboneStart,
    backboneEnd,
    branches,
    hostStems,
    junctions: branches.map((branch) => branch.from),
    markerStemFrom,
    marker: {
      x: markerStemFrom.x,
      y: markerStemFrom.y + COMPOSITE_INTERNAL_MARKER_OFFSET,
    },
  };
}

function offsetPointOnFrameSide(frame: RouteFrame, side: FrameSide, point: Point, offset: number): Point {
  if (offset === 0) {
    return point;
  }

  if (side === "left" || side === "right") {
    return {
      x: point.x,
      y: clampNumber(point.y + offset, frame.top, frame.bottom),
    };
  }

  return {
    x: clampNumber(point.x + offset, frame.left, frame.right),
    y: point.y,
  };
}

function computeFrameSideLineIntersection(
  frame: RouteFrame,
  side: FrameSide,
  lineStart: Point,
  lineToward: Point,
): Point {
  const deltaX = lineToward.x - lineStart.x;
  const deltaY = lineToward.y - lineStart.y;

  if (side === "left" || side === "right") {
    const sideX = side === "left" ? frame.left : frame.right;
    if (Math.abs(deltaX) <= 0.001) {
      return getFrameSidePoint(frame, side, lineStart);
    }

    const t = (sideX - lineStart.x) / deltaX;
    return {
      x: sideX,
      y: clampNumber(lineStart.y + deltaY * t, frame.top, frame.bottom),
    };
  }

  const sideY = side === "top" ? frame.top : frame.bottom;
  if (Math.abs(deltaY) <= 0.001) {
    return getFrameSidePoint(frame, side, lineStart);
  }

  const t = (sideY - lineStart.y) / deltaY;
  return {
    x: clampNumber(lineStart.x + deltaX * t, frame.left, frame.right),
    y: sideY,
  };
}

function computeTopJunctionPoint(frame: RouteFrame, lineStart: Point, lineToward: Point): Point {
  return computeFrameSideLineIntersection(frame, "top", lineStart, lineToward);
}

function computeBottomJunctionPoint(frame: RouteFrame, lineStart: Point, lineToward: Point): Point {
  return computeFrameSideLineIntersection(frame, "bottom", lineStart, lineToward);
}

function computeVisibleJunctionPoint(
  frame: RouteFrame,
  side: FrameSide,
  lineStart: Point,
  lineToward: Point,
  sideOffset = 0,
): Point {
  const basePoint =
    side === "top"
      ? computeTopJunctionPoint(frame, lineStart, lineToward)
      : side === "bottom"
        ? computeBottomJunctionPoint(frame, lineStart, lineToward)
        : computeFrameSideLineIntersection(frame, side, lineStart, lineToward);
  return offsetPointOnFrameSide(frame, side, basePoint, sideOffset);
}

function dedupeRoutePoints(points: Point[]): Point[] {
  return points.filter((point, index) => {
    if (index === 0) {
      return true;
    }

    const previous = points[index - 1];
    return Math.abs(previous.x - point.x) > 0.001 || Math.abs(previous.y - point.y) > 0.001;
  });
}

function pruneTinyRouteSegments(points: Point[], minimumSegmentLength: number): Point[] {
  const deduped = dedupeRoutePoints(points);
  if (deduped.length <= 2) {
    return deduped;
  }

  const pruned: Point[] = [deduped[0]];
  for (let index = 1; index < deduped.length - 1; index += 1) {
    const previous = pruned[pruned.length - 1];
    const current = deduped[index];
    const next = deduped[index + 1];
    const incoming = Math.hypot(current.x - previous.x, current.y - previous.y);
    const outgoing = Math.hypot(next.x - current.x, next.y - current.y);

    if (incoming < minimumSegmentLength || outgoing < minimumSegmentLength) {
      continue;
    }

    pruned.push(current);
  }

  pruned.push(deduped[deduped.length - 1]);
  return dedupeRoutePoints(pruned);
}

function getFirstRouteDirection(points: Point[], fallback: Point): Point {
  for (let index = 1; index < points.length; index += 1) {
    const delta = {
      x: points[index].x - points[index - 1].x,
      y: points[index].y - points[index - 1].y,
    };
    if (Math.hypot(delta.x, delta.y) > 0.001) {
      return normalizeVector(delta, fallback);
    }
  }

  return normalizeVector(fallback);
}

function normalizeVector(vector: Point, fallback: Point = { x: 1, y: 0 }): Point {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0.001) {
    return fallback;
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function distanceSquared(from: Point, to: Point): number {
  const deltaX = from.x - to.x;
  const deltaY = from.y - to.y;
  return deltaX * deltaX + deltaY * deltaY;
}

export function DiagramCanvas(props: DiagramCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [interaction, setInteraction] = useState<InteractionState>({ kind: "idle" });
  const [pendingConnectionSource, setPendingConnectionSource] = useState<string | null>(null);
  const [connectionPreviewPoint, setConnectionPreviewPoint] = useState<Point | null>(null);
  const [focusedTarget, setFocusedTarget] = useState<FocusTarget>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEditState>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [showPanHint, setShowPanHint] = useState(true);
  const [persistentMessage, setPersistentMessage] = useState<PersistentCanvasMessage | null>(null);
  const [dismissedMessageKey, setDismissedMessageKey] = useState<string | null>(null);
  const [placementPreviewPoint, setPlacementPreviewPoint] = useState<Point | null>(null);

  const nodeMap = new Map(props.diagram.nodes.map((node) => [node.id, node]));
  const nodeIssueMap = new Map<string, { level: ValidationIssue["level"]; count: number }>();
  const edgeIssueMap = new Map<string, { level: ValidationIssue["level"]; count: number }>();
  const connectorLaneMap = new Map<string, { laneIndex: number; laneCount: number }>();
  const connectorGroups = new Map<string, string[]>();
  const attributeDirectionMap = new Map<string, Point>();
  const compositeGroups = new Map<string, { host: Extract<DiagramNode, { type: "entity" }>; members: CompositeIdentifierMember[] }>();
  const compositeGroupKeyByAttributeId = new Map<string, string>();
  const compositeGroupMemberIdsByGroupKey = new Map<string, string[]>();
  const compositeIdentifierLayouts: CompositeIdentifierLayout[] = [];
  const externalIdentifierLayouts: ExternalIdentifierLayout[] = [];
  const edgeGeometryMap = new Map<string, Point[]>();
  const originalAttributeDirectionMap =
    interaction.kind === "drag" ? buildAttributeDirectionMap(interaction.originalDiagram) : new Map<string, Point>();

  props.issues.forEach((issue) => {
    const targetMap = issue.targetType === "node" ? nodeIssueMap : edgeIssueMap;
    const current = targetMap.get(issue.targetId);
    if (!current) {
      targetMap.set(issue.targetId, { level: issue.level, count: 1 });
      return;
    }

    targetMap.set(issue.targetId, {
      level: current.level === "error" || issue.level === "error" ? "error" : "warning",
      count: current.count + 1,
    });
  });

  props.diagram.nodes.forEach((node) => {
    if (node.type !== "entity") {
      return;
    }

    (node.internalIdentifiers ?? []).forEach((identifier, index) => {
      if (identifier.attributeIds.length <= 1) {
        return;
      }

      const identifierId =
        typeof identifier.id === "string" && identifier.id.trim().length > 0
          ? identifier.id
          : `generated-${index}`;
      const groupKey = `${node.id}::${identifierId}`;
      const uniqueAttributeIds = identifier.attributeIds.filter(
        (attributeId, attributeIndex, source) =>
          typeof attributeId === "string" &&
          attributeId.length > 0 &&
          source.indexOf(attributeId) === attributeIndex,
      );

      if (uniqueAttributeIds.length < 2) {
        return;
      }

      compositeGroupMemberIdsByGroupKey.set(groupKey, uniqueAttributeIds);

      uniqueAttributeIds.forEach((attributeId) => {
        if (!compositeGroupKeyByAttributeId.has(attributeId)) {
          compositeGroupKeyByAttributeId.set(attributeId, groupKey);
        }
      });
    });
  });

  props.diagram.edges.forEach((edge) => {
    if (edge.type !== "connector") {
      return;
    }

    const groupKey = [edge.sourceId, edge.targetId].sort().join("::");
    const group = connectorGroups.get(groupKey) ?? [];
    group.push(edge.id);
    connectorGroups.set(groupKey, group);
  });

  connectorGroups.forEach((edgeIds) => {
    const laneCount = edgeIds.length;
    edgeIds.forEach((edgeId, laneIndex) => {
      connectorLaneMap.set(edgeId, { laneIndex, laneCount });
    });
  });

  props.diagram.edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      return;
    }

    const geometry = getEdgeGeometry(edge, sourceNode, targetNode, connectorLaneMap.get(edge.id));
    edgeGeometryMap.set(edge.id, geometry.points);
  });

  props.diagram.edges.forEach((edge) => {
    if (edge.type !== "attribute") {
      return;
    }

    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      return;
    }

    const attributeNode = sourceNode.type === "attribute" ? sourceNode : targetNode.type === "attribute" ? targetNode : null;
    if (!attributeNode || attributeDirectionMap.has(attributeNode.id)) {
      return;
    }

    const hostNode = attributeNode.id === sourceNode.id ? targetNode : sourceNode;
    const attributeCenter = getNodeCenter(attributeNode);
    const hostCenter = getNodeCenter(hostNode);

    if (
      attributeNode.isIdentifier !== true &&
      attributeNode.isCompositeInternal === true &&
      hostNode.type === "entity"
    ) {
      const explicitGroupKey = compositeGroupKeyByAttributeId.get(attributeNode.id);
      const groupKey = explicitGroupKey ?? `legacy::${hostNode.id}`;
      const hostAnchor = getNodeAnchor(hostNode, attributeCenter, "attribute", "target");
      const group = compositeGroups.get(groupKey) ?? { host: hostNode, members: [] };

      if (!group.members.some((member) => member.attributeId === attributeNode.id)) {
        group.members.push({
          attributeId: attributeNode.id,
          attributeCenter,
          hostAnchor,
        });
      }

      compositeGroups.set(groupKey, group);

      if (!compositeGroupMemberIdsByGroupKey.has(groupKey)) {
        compositeGroupMemberIdsByGroupKey.set(groupKey, [attributeNode.id]);
      } else {
        const memberIds = compositeGroupMemberIdsByGroupKey.get(groupKey) ?? [];
        if (!memberIds.includes(attributeNode.id)) {
          compositeGroupMemberIdsByGroupKey.set(groupKey, [...memberIds, attributeNode.id]);
        }
      }
    }

    attributeDirectionMap.set(attributeNode.id, {
      x: hostCenter.x - attributeCenter.x,
      y: hostCenter.y - attributeCenter.y,
    });
  });

  compositeGroups.forEach((group, groupKey) => {
    if (group.members.length < 2) {
      return;
    }

    const hostBounds = getNodeBounds(group.host);
    const hostCenter = getNodeCenter(group.host);
    const membershipOrder = compositeGroupMemberIdsByGroupKey.get(groupKey) ?? [];
    const orderIndexByAttributeId = new Map(
      membershipOrder.map((attributeId, index) => [attributeId, index]),
    );
    const orderedMembers = [...group.members].sort((left, right) => {
      const leftIndex = orderIndexByAttributeId.get(left.attributeId) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = orderIndexByAttributeId.get(right.attributeId) ?? Number.MAX_SAFE_INTEGER;
      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.attributeId.localeCompare(right.attributeId);
    });

    const layout = buildCompositeIdentifierLayout(
      groupKey,
      group.host.id,
      hostBounds,
      hostCenter,
      orderedMembers,
    );

    if (layout) {
      compositeIdentifierLayouts.push(layout);
    }
  });

  props.diagram.nodes.forEach((node) => {
    if (node.type !== "entity") {
      return;
    }

    (node.externalIdentifiers ?? []).forEach((identifier) => {
      const relationshipNode = nodeMap.get(identifier.relationshipId);
      if (relationshipNode?.type !== "relationship") {
        return;
      }

      const importedAttributes = getExternalIdentifierImportedAttributes(props.diagram, identifier);
      const sourceAttribute = importedAttributes[0];
      if (!sourceAttribute) {
        return;
      }

      const targetEntityNode = node;
      const manualOffset =
        typeof identifier.offset === "number" && Number.isFinite(identifier.offset) ? identifier.offset : 0;
      const markerOffsetX =
        typeof identifier.markerOffsetX === "number" && Number.isFinite(identifier.markerOffsetX)
          ? identifier.markerOffsetX
          : 0;
      const markerOffsetY =
        typeof identifier.markerOffsetY === "number" && Number.isFinite(identifier.markerOffsetY)
          ? identifier.markerOffsetY
          : 0;

      const weakConnector = props.diagram.edges.find(
        (edge) =>
          edge.type === "connector" &&
          ((edge.sourceId === relationshipNode.id && edge.targetId === targetEntityNode.id) ||
            (edge.targetId === relationshipNode.id && edge.sourceId === targetEntityNode.id)),
      );
      if (!weakConnector) {
        return;
      }

      const weakConnectorGeometry = getEdgeGeometry(
        weakConnector,
        nodeMap.get(weakConnector.sourceId) as DiagramNode,
        nodeMap.get(weakConnector.targetId) as DiagramNode,
        connectorLaneMap.get(weakConnector.id),
      );
      const weakSidePoint =
        weakConnector.sourceId === targetEntityNode.id
          ? weakConnectorGeometry.points[0]
          : weakConnectorGeometry.points[weakConnectorGeometry.points.length - 1];
      const weakSideAdjacentPoint =
        weakConnector.sourceId === targetEntityNode.id
          ? weakConnectorGeometry.points[Math.min(1, weakConnectorGeometry.points.length - 1)]
          : weakConnectorGeometry.points[Math.max(0, weakConnectorGeometry.points.length - 2)];
      const weakDelta = {
        x: weakSideAdjacentPoint.x - weakSidePoint.x,
        y: weakSideAdjacentPoint.y - weakSidePoint.y,
      };
      const weakDirection = normalizeVector(weakDelta, { x: 0, y: -1 });
      const targetBounds = getNodeBounds(targetEntityNode);
      const frame: RouteFrame = {
        left: targetBounds.x - EXTERNAL_IDENTIFIER_FRAME_PADDING,
        top: targetBounds.y - EXTERNAL_IDENTIFIER_FRAME_PADDING,
        right: targetBounds.x + targetBounds.width + EXTERNAL_IDENTIFIER_FRAME_PADDING,
        bottom: targetBounds.y + targetBounds.height + EXTERNAL_IDENTIFIER_FRAME_PADDING,
        centerX: targetBounds.x + targetBounds.width / 2,
        centerY: targetBounds.y + targetBounds.height / 2,
      };
      const relationSide = resolveFrameSide(targetBounds, weakSidePoint, weakDirection);
      const junction = computeVisibleJunctionPoint(
        frame,
        relationSide,
        weakSidePoint,
        weakSideAdjacentPoint,
        manualOffset,
      );
      const relationNormal = getFrameSideNormal(relationSide);
      const localAttributes = identifier.localAttributeIds
        .map((attributeId) => nodeMap.get(attributeId))
        .filter((attribute): attribute is Extract<DiagramNode, { type: "attribute" }> => attribute?.type === "attribute");

      if (localAttributes.length === 0) {
        const targetCenter = getNodeCenter(targetEntityNode);
        const sourceAttributeCenter = getNodeCenter(sourceAttribute);
        const baseDirection = normalizeVector(
          {
            x: sourceAttributeCenter.x - junction.x,
            y: sourceAttributeCenter.y - junction.y,
          },
          relationNormal,
        );
        const candidateDirections = [baseDirection, { x: -baseDirection.x, y: -baseDirection.y }];
        const markerCandidates = candidateDirections.map((direction) => {
          const markerBase = {
            x: junction.x + direction.x * EXTERNAL_IDENTIFIER_ENTITY_MARKER_RISE,
            y: junction.y + direction.y * EXTERNAL_IDENTIFIER_ENTITY_MARKER_RISE,
          };
          const sourceDistance = distanceSquared(markerBase, sourceAttributeCenter);
          const entityDistance = distanceSquared(markerBase, targetCenter);
          const score = sourceDistance - entityDistance * 0.3;
          return { markerBase, score };
        });
        markerCandidates.sort((left, right) => left.score - right.score);
        const marker = {
          x: markerCandidates[0].markerBase.x + markerOffsetX,
          y: markerCandidates[0].markerBase.y + markerOffsetY,
        };

        externalIdentifierLayouts.push({
          externalIdentifierId: identifier.id,
          hostEntityId: targetEntityNode.id,
          relationshipId: relationshipNode.id,
          kind: "imported_only",
          marker,
          pathPoints: [marker, junction],
          junction,
        });
        return;
      }

      const localConnections = localAttributes
        .map((attribute) => {
          const attributeEdge = props.diagram.edges.find(
            (edge) =>
              edge.type === "attribute" &&
              ((edge.sourceId === attribute.id && edge.targetId === targetEntityNode.id) ||
                (edge.targetId === attribute.id && edge.sourceId === targetEntityNode.id)),
          );
          if (!attributeEdge) {
            return null;
          }

          const attributeEdgeGeometry = getEdgeGeometry(
            attributeEdge,
            nodeMap.get(attributeEdge.sourceId) as DiagramNode,
            nodeMap.get(attributeEdge.targetId) as DiagramNode,
            connectorLaneMap.get(attributeEdge.id),
          );

          return {
            attribute,
            attributeAnchor: attributeEdgeGeometry.points[0],
            entityAnchor: attributeEdgeGeometry.points[attributeEdgeGeometry.points.length - 1],
          };
        })
        .filter(
          (
            connection,
          ): connection is {
            attribute: Extract<DiagramNode, { type: "attribute" }>;
            attributeAnchor: Point;
            entityAnchor: Point;
          } => connection !== null,
        );
      if (localConnections.length === 0) {
        return;
      }

      const centroid = localConnections.reduce(
        (current, connection) => ({
          x: current.x + connection.attributeAnchor.x,
          y: current.y + connection.attributeAnchor.y,
        }),
        { x: 0, y: 0 },
      );
      const centroidPoint = {
        x: centroid.x / localConnections.length,
        y: centroid.y / localConnections.length,
      };
      const primaryConnection = localConnections.reduce((best, candidate) =>
        distanceSquared(candidate.attributeAnchor, centroidPoint) <
        distanceSquared(best.attributeAnchor, centroidPoint)
          ? candidate
          : best,
      );
      const branchVector = {
        x: primaryConnection.attributeAnchor.x - primaryConnection.entityAnchor.x,
        y: primaryConnection.attributeAnchor.y - primaryConnection.entityAnchor.y,
      };
      const branchDirection = normalizeVector(branchVector, relationNormal);
      const attributeSide = resolveFrameSide(targetBounds, primaryConnection.entityAnchor, branchDirection);
      const attributeJunction = computeVisibleJunctionPoint(
        frame,
        attributeSide,
        primaryConnection.entityAnchor,
        primaryConnection.attributeAnchor,
      );
      const frameRoute = selectFrameRoute(frame, relationSide, junction, attributeSide, attributeJunction);
      const routePoints = pruneTinyRouteSegments(frameRoute, EXTERNAL_IDENTIFIER_MIN_SEGMENT_LENGTH);
      const routeDirection = getFirstRouteDirection(routePoints, relationNormal);
      const markerBase = {
        x: junction.x - routeDirection.x * EXTERNAL_IDENTIFIER_COMPOSITE_MARKER_DISTANCE,
        y: junction.y - routeDirection.y * EXTERNAL_IDENTIFIER_COMPOSITE_MARKER_DISTANCE,
      };
      const marker = {
        x: markerBase.x + markerOffsetX,
        y: markerBase.y + markerOffsetY,
      };

      externalIdentifierLayouts.push({
        externalIdentifierId: identifier.id,
        hostEntityId: targetEntityNode.id,
        relationshipId: relationshipNode.id,
        kind: "imported_plus_local",
        marker,
        pathPoints: routePoints,
        markerStemStart: junction,
        junction,
        attributeJunction,
      });
    });
  });

  const activeDragNodeIds = interaction.kind === "drag" ? interaction.nodeIds : props.selection.nodeIds;
  const selectionBounds = getSelectionBounds(props.diagram.nodes.filter((node) => activeDragNodeIds.includes(node.id)));
  const dragOriginBounds =
    interaction.kind === "drag"
      ? getSelectionBounds(interaction.originalDiagram.nodes.filter((node) => interaction.nodeIds.includes(node.id)))
      : null;
  const dragGhostNodeIds = interaction.kind === "drag" ? new Set(interaction.nodeIds) : new Set<string>();
  const dragGhostEdges =
    interaction.kind === "drag"
      ? interaction.originalDiagram.edges.filter(
          (edge) => dragGhostNodeIds.has(edge.sourceId) || dragGhostNodeIds.has(edge.targetId),
        )
      : interaction.kind === "edge-drag"
        ? interaction.originalDiagram.edges.filter((edge) => edge.id === interaction.edgeId)
        : [];
  const dragGhostNodeMap =
    interaction.kind === "drag"
      ? new Map(interaction.originalDiagram.nodes.map((node) => [node.id, node]))
      : new Map<string, DiagramNode>();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.code === "Space") {
        setSpacePressed(true);
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.code === "Space") {
        setSpacePressed(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setShowPanHint(false);
    }, 4200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    if (!shouldPersistCanvasMessage(props.statusMessage)) {
      return;
    }

    setPersistentMessage({
      key: props.statusMessage,
      message: props.statusMessage,
      tone: getCanvasMessageTone(props.statusMessage),
    });
    setDismissedMessageKey(null);
  }, [props.statusMessage]);

  useEffect(() => {
    if (props.tool !== "connector" && props.tool !== "inheritance") {
      setPendingConnectionSource(null);
      setConnectionPreviewPoint(null);
      if (props.statusMessage.startsWith("Sorgente")) {
        props.onStatusMessageChange("");
      }
    }
  }, [props.onStatusMessageChange, props.statusMessage, props.tool]);

  useEffect(() => {
    if (!placeableCanvasTool(props.tool)) {
      setPlacementPreviewPoint(null);
    }
  }, [props.tool]);

  useEffect(() => {
    if (props.tool !== "connector" && props.tool !== "inheritance") {
      return;
    }

    if (pendingConnectionSource || props.selection.nodeIds.length !== 1 || props.selection.edgeIds.length > 0) {
      return;
    }

    const selectedSource = nodeMap.get(props.selection.nodeIds[0]);
    if (!selectedSource) {
      return;
    }

    if (
      (props.tool === "connector" && selectedSource.type === "relationship") ||
      (props.tool === "inheritance" && selectedSource.type === "entity")
    ) {
      setPendingConnectionSource(selectedSource.id);
      setConnectionPreviewPoint(getNodeCenter(selectedSource));
      props.onStatusMessageChange(
        props.tool === "inheritance"
          ? `Sorgente selezionata: ${selectedSource.label}. Seleziona parent entity o premi Esc per annullare.`
          : `Sorgente selezionata: ${selectedSource.label}. Seleziona target entity o premi Esc per annullare.`,
      );
    }
  }, [
    nodeMap,
    pendingConnectionSource,
    props.onStatusMessageChange,
    props.selection.edgeIds.length,
    props.selection.nodeIds,
    props.tool,
  ]);

  useEffect(() => {
    if (!focusedTarget) {
      return;
    }

    if (
      focusedTarget.kind === "node" &&
      !props.diagram.nodes.some((node) => node.id === focusedTarget.id)
    ) {
      setFocusedTarget(null);
      return;
    }

    if (
      focusedTarget.kind === "edge" &&
      !props.diagram.edges.some((edge) => edge.id === focusedTarget.id)
    ) {
      setFocusedTarget(null);
    }
  }, [focusedTarget, props.diagram.edges, props.diagram.nodes]);

  function dismissPanHint() {
    setShowPanHint(false);
  }

  function beginPanInteraction(pointerId: number, clientX: number, clientY: number) {
    dismissPanHint();
    setInteraction({
      kind: "pan",
      pointerId,
      startClient: { x: clientX, y: clientY },
      startViewport: props.viewport,
    });
  }

  function getWorldPointFromEvent(event: { clientX: number; clientY: number }): Point | null {
    if (!containerRef.current) {
      return null;
    }

    return worldPointFromClient(
      { x: event.clientX, y: event.clientY },
      props.viewport,
      containerRef.current.getBoundingClientRect(),
    );
  }

  function cancelPendingConnection(clearStatus = true) {
    setPendingConnectionSource(null);
    setConnectionPreviewPoint(null);
    if (clearStatus && props.statusMessage.startsWith("Sorgente")) {
      props.onStatusMessageChange("");
    }
  }

  function getViewportRect(): DOMRect | null {
    if (!containerRef.current) {
      return null;
    }

    return containerRef.current.getBoundingClientRect();
  }

  function getViewportTargetBounds(): Bounds | null {
    const selectedNodes = props.diagram.nodes.filter((node) => props.selection.nodeIds.includes(node.id));
    const selectionBounds = getBoundsForViewport(selectedNodes);

    if (selectionBounds) {
      return selectionBounds;
    }

    return getBoundsForViewport(props.diagram.nodes);
  }

  function setViewportFromBounds(bounds: Bounds, zoom: number) {
    const rect = getViewportRect();
    if (!rect) {
      return;
    }

    props.onViewportChange(viewportForBounds(bounds, rect, zoom));
  }

  function fitToContent() {
    dismissPanHint();
    const rect = getViewportRect();
    const bounds = getViewportTargetBounds();

    if (!rect) {
      return;
    }

    if (!bounds) {
      props.onViewportChange({
        x: rect.width / 2,
        y: rect.height / 2,
        zoom: 1,
      });
      props.onStatusMessageChange("Viewport centrata.");
      return;
    }

    const paddedBounds = expandBounds(bounds, VIEWPORT_PADDING);
    const widthZoom = rect.width / Math.max(paddedBounds.width, 220);
    const heightZoom = rect.height / Math.max(paddedBounds.height, 200);
    const nextZoom = clampZoom(Math.min(widthZoom, heightZoom));

    props.onViewportChange(viewportForBounds(bounds, rect, nextZoom));
    props.onStatusMessageChange(
      props.selection.nodeIds.length > 0 ? "Selezione adattata al canvas." : "Diagramma adattato al canvas.",
    );
  }

  function centerDiagram() {
    dismissPanHint();
    const bounds = getViewportTargetBounds();

    if (!bounds) {
      return;
    }

    setViewportFromBounds(bounds, props.viewport.zoom);
    props.onStatusMessageChange(
      props.selection.nodeIds.length > 0 ? "Selezione centrata." : "Diagramma centrato nel canvas.",
    );
  }

  function resetViewport() {
    dismissPanHint();
    const bounds = getViewportTargetBounds();
    const rect = getViewportRect();

    if (!rect) {
      return;
    }

    if (!bounds) {
      props.onViewportChange({
        x: rect.width / 2,
        y: rect.height / 2,
        zoom: 1,
      });
      props.onStatusMessageChange("Viewport ripristinata.");
      return;
    }

    props.onViewportChange(viewportForBounds(bounds, rect, 1));
    props.onStatusMessageChange("Viewport ripristinata.");
  }

  function zoomAroundCanvasCenter(multiplier: number) {
    dismissPanHint();
    const rect = getViewportRect();
    if (!rect) {
      return;
    }

    const canvasCenterX = rect.width / 2;
    const canvasCenterY = rect.height / 2;
    const worldX = (canvasCenterX - props.viewport.x) / props.viewport.zoom;
    const worldY = (canvasCenterY - props.viewport.y) / props.viewport.zoom;
    const nextZoom = clampZoom(props.viewport.zoom * multiplier);

    props.onViewportChange({
      zoom: nextZoom,
      x: canvasCenterX - worldX * nextZoom,
      y: canvasCenterY - worldY * nextZoom,
    });
    props.onStatusMessageChange(`Zoom ${Math.round(nextZoom * 100)}%.`);
  }

  function openInlineEditorForSelection() {
    if (props.tool !== "select") {
      return;
    }

    if (props.selection.nodeIds.length === 1 && props.selection.edgeIds.length === 0) {
      const node = nodeMap.get(props.selection.nodeIds[0]);
      if (node) {
        setInlineEdit({ kind: "node", id: node.id, value: node.label });
      }
      return;
    }

    if (props.selection.edgeIds.length === 1 && props.selection.nodeIds.length === 0) {
      const edge = props.diagram.edges.find((candidate) => candidate.id === props.selection.edgeIds[0]);
      if (!edge || edge.type !== "inheritance") {
        return;
      }
      setInlineEdit({ kind: "edge", id: edge.id, value: edge.label });
    }
  }

  function moveSelectedNodes(deltaX: number, deltaY: number): boolean {
    if (props.selection.nodeIds.length === 0) {
      return false;
    }

    const movingNodeIds = new Set(expandNodeIdsForMove(props.diagram, props.selection.nodeIds));
    const nextDiagram = {
      ...props.diagram,
      nodes: props.diagram.nodes.map((node) =>
        movingNodeIds.has(node.id)
          ? {
              ...node,
              x: snapValue(node.x + deltaX),
              y: snapValue(node.y + deltaY),
            }
          : node,
      ),
    };

    props.onCommitDiagram(nextDiagram, props.diagram);
    props.onStatusMessageChange("Selezione spostata con la tastiera.");
    return true;
  }

  function isExternalIdentifierConnectorEdge(edge: DiagramEdge): boolean {
    if (edge.type !== "connector") {
      return false;
    }

    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    const relationshipNode =
      sourceNode?.type === "relationship" ? sourceNode : targetNode?.type === "relationship" ? targetNode : null;
    if (!relationshipNode) {
      return false;
    }

    return props.diagram.nodes.some(
      (node) =>
        node.type === "entity" &&
        (node.externalIdentifiers ?? []).some((identifier) => identifier.relationshipId === relationshipNode.id),
    );
  }

  function moveSelectedEdgeOffset(delta: number): boolean {
    if (props.selection.nodeIds.length > 0 || props.selection.edgeIds.length !== 1) {
      return false;
    }

    const selectedEdge = props.diagram.edges.find((edge) => edge.id === props.selection.edgeIds[0]);
    if (!selectedEdge) {
      return false;
    }

    if (isExternalIdentifierConnectorEdge(selectedEdge)) {
      props.onStatusMessageChange("Gli estremi del collegamento dell'identificatore esterno sono bloccati.");
      return false;
    }

    const nextDiagram = {
      ...props.diagram,
      edges: props.diagram.edges.map((edge) =>
        edge.id === selectedEdge.id
          ? {
              ...edge,
              manualOffset: Math.round(((edge.manualOffset ?? 0) + delta) / 2) * 2,
            }
          : edge,
      ),
    };

    props.onCommitDiagram(nextDiagram, props.diagram);
    props.onStatusMessageChange("Collegamento regolato con la tastiera.");
    return true;
  }

  function handleCanvasKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (inlineEdit) {
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      event.stopPropagation();
      centerDiagram();
      return;
    }

    if (event.key === "0") {
      event.preventDefault();
      event.stopPropagation();
      resetViewport();
      return;
    }

    if (event.key === "9") {
      event.preventDefault();
      event.stopPropagation();
      fitToContent();
      return;
    }

    if (event.key === "=" || event.key === "+") {
      event.preventDefault();
      event.stopPropagation();
      zoomAroundCanvasCenter(1.14);
      return;
    }

    if (event.key === "-") {
      event.preventDefault();
      event.stopPropagation();
      zoomAroundCanvasCenter(1 / 1.14);
      return;
    }

    if (event.key === "Escape" && pendingConnectionSource) {
      event.preventDefault();
      event.stopPropagation();
      cancelPendingConnection();
      props.onStatusMessageChange("Creazione collegamento annullata.");
      return;
    }

    if (event.key === "Escape" && placeableCanvasTool(props.tool)) {
      event.preventDefault();
      event.stopPropagation();
      setPlacementPreviewPoint(null);
      props.onToolChange("select");
      props.onStatusMessageChange("Posizionamento annullato.");
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      openInlineEditorForSelection();
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      event.stopPropagation();
      props.onDeleteSelection();
      return;
    }

    const distance = event.shiftKey ? GRID_SIZE * 2 : GRID_SIZE;
    const arrowMoves: Record<string, { x: number; y: number; edgeDelta: number }> = {
      ArrowUp: { x: 0, y: -distance, edgeDelta: -distance / 2 },
      ArrowDown: { x: 0, y: distance, edgeDelta: distance / 2 },
      ArrowLeft: { x: -distance, y: 0, edgeDelta: -distance / 2 },
      ArrowRight: { x: distance, y: 0, edgeDelta: distance / 2 },
    };

    const movement = arrowMoves[event.key];
    if (!movement) {
      return;
    }

    const movedNodes = moveSelectedNodes(movement.x, movement.y);
    const movedEdge = !movedNodes && moveSelectedEdgeOffset(movement.edgeDelta);

    if (movedNodes || movedEdge) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleNodeFocus(node: DiagramNode) {
    setFocusedTarget({ kind: "node", id: node.id });
    props.onSelectionChange({ nodeIds: [node.id], edgeIds: [] });
  }

  function handleEdgeFocus(edge: DiagramEdge) {
    setFocusedTarget({ kind: "edge", id: edge.id });
    props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
  }

  function beginConnection(node: DiagramNode) {
    if (!pendingConnectionSource) {
      setPendingConnectionSource(node.id);
      setConnectionPreviewPoint(getNodeCenter(node));
      props.onStatusMessageChange(
        `Sorgente selezionata: ${node.label}. Seleziona la destinazione o premi Esc per annullare.`,
      );
      return;
    }

    if (pendingConnectionSource === node.id) {
      cancelPendingConnection();
      return;
    }

    const sourceNode = nodeMap.get(pendingConnectionSource);
    if (!sourceNode) {
      cancelPendingConnection();
      return;
    }

    const edgeType: EdgeKind =
      props.tool === "inheritance"
        ? "inheritance"
        : sourceNode.type === "attribute" || node.type === "attribute"
          ? "attribute"
          : "connector";

    const result = props.onCreateEdge(edgeType, pendingConnectionSource, node.id);
    cancelPendingConnection(false);
    props.onStatusMessageChange(result.message);
  }

  function handleCanvasPointerDown(event: ReactPointerEvent<SVGRectElement>) {
    if (event.button === 2) {
      return;
    }

    if (!containerRef.current) {
      return;
    }

    containerRef.current.focus();

    const worldPoint = getWorldPointFromEvent(event);
    if (!worldPoint) {
      return;
    }

    if (event.button === 1 || spacePressed || props.tool === "move") {
      beginPanInteraction(event.pointerId, event.clientX, event.clientY);
      return;
    }

    if (props.tool === "attribute") {
      props.onStatusMessageChange("Seleziona prima un'entita o una relazione.");
      return;
    }

    if (placeableCanvasTool(props.tool)) {
      const newId = props.onCreateNode(props.tool, worldPoint);
      setPlacementPreviewPoint(null);
      props.onSelectionChange({ nodeIds: [newId], edgeIds: [] });
      return;
    }

    cancelPendingConnection();

    if (props.tool === "select") {
      setInteraction({
        kind: "marquee",
        pointerId: event.pointerId,
        startWorld: worldPoint,
        currentWorld: worldPoint,
        additive: event.shiftKey,
        baseSelection: props.selection,
      });

      if (!event.shiftKey) {
        props.onSelectionChange({ nodeIds: [], edgeIds: [] });
      }
      return;
    }

  }

  function startNodeDragInteraction(
    pointerId: number,
    startClientX: number,
    startClientY: number,
    selectedNodeIds: string[],
  ) {
    if (selectedNodeIds.length === 0) {
      return;
    }

    const nodeIds = expandNodeIdsForMove(props.diagram, selectedNodeIds);
    const originalDiagram = props.diagram;
    const originPositions: Record<string, Point> = {};

    nodeIds.forEach((nodeId) => {
      const currentNode = nodeMap.get(nodeId);
      if (currentNode) {
        originPositions[nodeId] = { x: currentNode.x, y: currentNode.y };
      }
    });

    props.onSelectionChange({ nodeIds: selectedNodeIds, edgeIds: [] });
    setInteraction({
      kind: "drag",
      pointerId,
      startClient: { x: startClientX, y: startClientY },
      originalDiagram,
      nodeIds,
      originPositions,
    });
  }

  function handleCompositeIdentifierPointerDown(
    event: ReactPointerEvent<SVGGElement>,
    layout: CompositeIdentifierLayout,
  ) {
    event.stopPropagation();

    if (props.tool !== "select") {
      return;
    }

    const memberAttributeIds = layout.memberAttributeIds.filter((attributeId) => {
      const node = nodeMap.get(attributeId);
      return node?.type === "attribute";
    });

    if (memberAttributeIds.length === 0) {
      props.onSelectionChange({ nodeIds: [layout.hostEntityId], edgeIds: [] });
      return;
    }

    startNodeDragInteraction(
      event.pointerId,
      event.clientX,
      event.clientY,
      memberAttributeIds,
    );
    props.onStatusMessageChange(
      "Trascina il backbone dell'identificatore composto: gli attributi membri si muovono come gruppo.",
    );
  }

  function handleNodePointerDown(event: ReactPointerEvent<SVGGElement>, node: DiagramNode) {
    event.stopPropagation();
    event.currentTarget.focus();

    if (props.tool === "delete") {
      props.onDeleteNode(node.id);
      return;
    }

    if (props.tool === "connector" || props.tool === "inheritance") {
      beginConnection(node);
      return;
    }

    if (props.tool === "move") {
      beginPanInteraction(event.pointerId, event.clientX, event.clientY);
      return;
    }

    if (props.tool !== "select") {
      return;
    }

    if (props.selection.nodeIds.length === 1 && props.selection.edgeIds.length === 0) {
      const sourceNode = nodeMap.get(props.selection.nodeIds[0]);
      const sourceEntity =
        sourceNode?.type === "attribute"
          ? props.diagram.nodes.find(
              (node) =>
                node.type === "entity" &&
                (node.internalIdentifiers ?? []).some((identifier) => identifier.attributeIds.includes(sourceNode.id)),
            )
          : undefined;
      const canStartExternalIdentifier =
        sourceNode?.type === "attribute" &&
        sourceEntity?.type === "entity" &&
        sourceNode.id !== node.id;

      const validTarget =
        node.type === "entity" ||
        (node.type === "attribute" &&
          node.isIdentifier !== true &&
          node.isCompositeInternal !== true &&
          node.isMultivalued !== true);
      if (canStartExternalIdentifier && validTarget) {
        const result = props.onCreateExternalIdentifier(sourceNode.id, node.id);
        props.onStatusMessageChange(result.message);
        return;
      }
    }

    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      props.onSelectionChange(addToSelection(props.selection, node.id));
      return;
    }

    const selectedNodeIds =
      props.selection.nodeIds.includes(node.id) && props.selection.nodeIds.length > 0
        ? props.selection.nodeIds
        : [node.id];

    startNodeDragInteraction(event.pointerId, event.clientX, event.clientY, selectedNodeIds);
  }

  function handleEdgePointerDown(event: ReactPointerEvent<SVGGElement>, edge: DiagramEdge) {
    event.stopPropagation();
    event.currentTarget.focus();

    if (props.tool === "delete") {
      props.onDeleteEdge(edge.id);
      return;
    }

    if (props.tool === "move") {
      beginPanInteraction(event.pointerId, event.clientX, event.clientY);
      return;
    }

    if (props.tool !== "select") {
      return;
    }

    props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
  }

  function handleEdgeLabelPointerDown(event: ReactPointerEvent<SVGTextElement>, edge: DiagramEdge) {
    event.stopPropagation();

    if (props.tool !== "select" || edge.type !== "connector") {
      props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
      return;
    }

    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      return;
    }

    if (isExternalIdentifierConnectorEdge(edge)) {
      props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
      props.onStatusMessageChange("Gli estremi del collegamento dell'identificatore esterno sono bloccati.");
      return;
    }

    const sourceCenter = getNodeCenter(sourceNode);
    const targetCenter = getNodeCenter(targetNode);
    // Drag should move connectors across parallel lanes, i.e. on the perpendicular axis.
    const axis =
      Math.abs(sourceCenter.x - targetCenter.x) >= Math.abs(sourceCenter.y - targetCenter.y)
        ? "y"
        : "x";

    props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
    setInteraction({
      kind: "edge-drag",
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      originalDiagram: props.diagram,
      edgeId: edge.id,
      startOffset: edge.manualOffset ?? 0,
      axis,
    });
  }

  function handleExternalIdentifierPointerDown(
    event: ReactPointerEvent<SVGGElement>,
    hostEntityId: string,
    externalIdentifierId: string,
  ) {
    event.stopPropagation();

    if (props.tool === "delete") {
      props.onDeleteExternalIdentifier(hostEntityId, externalIdentifierId);
      return;
    }

    if (props.tool !== "select") {
      return;
    }

    const hostEntity = nodeMap.get(hostEntityId);
    if (!hostEntity || hostEntity.type !== "entity") {
      return;
    }

    props.onSelectionChange({ nodeIds: [hostEntityId], edgeIds: [] });
    const identifier = hostEntity.externalIdentifiers?.find(
      (candidate) => candidate.id === externalIdentifierId,
    );
    setInteraction({
      kind: "external-id-drag",
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      originalDiagram: props.diagram,
      hostEntityId,
      externalIdentifierId,
      startOffset: identifier?.offset ?? 0,
    });
    props.onStatusMessageChange("Trascina il simbolo per regolare il routing dell'identificatore esterno.");
  }

  function handleExternalIdentifierMarkerPointerDown(
    event: ReactPointerEvent<SVGCircleElement>,
    hostEntityId: string,
    externalIdentifierId: string,
  ) {
    event.stopPropagation();

    if (props.tool === "delete") {
      props.onDeleteExternalIdentifier(hostEntityId, externalIdentifierId);
      return;
    }

    if (props.tool !== "select") {
      return;
    }

    const hostEntity = nodeMap.get(hostEntityId);
    if (!hostEntity || hostEntity.type !== "entity") {
      return;
    }

    props.onSelectionChange({ nodeIds: [hostEntityId], edgeIds: [] });
    const identifier = hostEntity.externalIdentifiers?.find(
      (candidate) => candidate.id === externalIdentifierId,
    );
    setInteraction({
      kind: "external-id-marker-drag",
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      originalDiagram: props.diagram,
      hostEntityId,
      externalIdentifierId,
      startOffsetX: identifier?.markerOffsetX ?? 0,
      startOffsetY: identifier?.markerOffsetY ?? 0,
    });
    props.onStatusMessageChange("Trascina il marker per regolare la posizione dell'identificatore esterno.");
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (placeableCanvasTool(props.tool)) {
      setPlacementPreviewPoint(getWorldPointFromEvent(event));
    }

    if (pendingConnectionSource) {
      const worldPoint = getWorldPointFromEvent(event);
      if (worldPoint) {
        setConnectionPreviewPoint(worldPoint);
      }
    }

    if (interaction.kind === "idle") {
      return;
    }

    if (interaction.kind === "pan") {
      const deltaX = event.clientX - interaction.startClient.x;
      const deltaY = event.clientY - interaction.startClient.y;
      props.onViewportChange({
        ...interaction.startViewport,
        x: interaction.startViewport.x + deltaX,
        y: interaction.startViewport.y + deltaY,
      });
      return;
    }

    if (interaction.kind === "drag") {
      const deltaX = (event.clientX - interaction.startClient.x) / props.viewport.zoom;
      const deltaY = (event.clientY - interaction.startClient.y) / props.viewport.zoom;
      const nextNodes = interaction.originalDiagram.nodes.map((node) => {
        if (!interaction.nodeIds.includes(node.id)) {
          return node;
        }

        const origin = interaction.originPositions[node.id];
        return {
          ...node,
          x: origin.x + deltaX,
          y: origin.y + deltaY,
        };
      });

      props.onPreviewDiagram({
        ...interaction.originalDiagram,
        nodes: nextNodes,
      });
      return;
    }

    if (interaction.kind === "edge-drag") {
      const pointerDelta =
        interaction.axis === "x"
          ? event.clientX - interaction.startClient.x
          : event.clientY - interaction.startClient.y;
      const nextOffset = Math.round((interaction.startOffset + pointerDelta / props.viewport.zoom) / 2) * 2;

      const nextEdges = interaction.originalDiagram.edges.map((edge) =>
        edge.id === interaction.edgeId ? { ...edge, manualOffset: nextOffset } : edge,
      );

      props.onPreviewDiagram({
        ...interaction.originalDiagram,
        edges: nextEdges,
      });
      return;
    }

    if (interaction.kind === "external-id-drag") {
      const pointerDelta = event.clientY - interaction.startClient.y;
      const nextOffset = Math.round((interaction.startOffset + pointerDelta / props.viewport.zoom) / 2) * 2;

      const nextNodes = interaction.originalDiagram.nodes.map((node) => {
        if (node.id !== interaction.hostEntityId || node.type !== "entity") {
          return node;
        }

        return {
          ...node,
          externalIdentifiers: (node.externalIdentifiers ?? []).map((identifier) =>
            identifier.id === interaction.externalIdentifierId
              ? {
                  ...identifier,
                  offset: nextOffset,
                }
              : identifier,
          ),
        };
      });

      props.onPreviewDiagram({
        ...interaction.originalDiagram,
        nodes: nextNodes,
      });
      return;
    }

    if (interaction.kind === "external-id-marker-drag") {
      const deltaX = (event.clientX - interaction.startClient.x) / props.viewport.zoom;
      const deltaY = (event.clientY - interaction.startClient.y) / props.viewport.zoom;
      const nextOffsetX = Math.round((interaction.startOffsetX + deltaX) / 2) * 2;
      const nextOffsetY = Math.round((interaction.startOffsetY + deltaY) / 2) * 2;

      const nextNodes = interaction.originalDiagram.nodes.map((node) => {
        if (node.id !== interaction.hostEntityId || node.type !== "entity") {
          return node;
        }

        return {
          ...node,
          externalIdentifiers: (node.externalIdentifiers ?? []).map((identifier) =>
            identifier.id === interaction.externalIdentifierId
              ? {
                  ...identifier,
                  markerOffsetX: nextOffsetX,
                  markerOffsetY: nextOffsetY,
                }
              : identifier,
          ),
        };
      });

      props.onPreviewDiagram({
        ...interaction.originalDiagram,
        nodes: nextNodes,
      });
      return;
    }

    const worldPoint = getWorldPointFromEvent(event);
    if (!worldPoint) {
      return;
    }

    setInteraction({
      ...interaction,
      currentWorld: worldPoint,
    });
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (interaction.kind === "idle") {
      return;
    }

    if (interaction.kind === "drag") {
      props.onCommitDiagram(props.diagram, interaction.originalDiagram);
      setInteraction({ kind: "idle" });
      return;
    }

    if (interaction.kind === "edge-drag") {
      props.onCommitDiagram(props.diagram, interaction.originalDiagram);
      setInteraction({ kind: "idle" });
      return;
    }

    if (interaction.kind === "external-id-drag") {
      props.onCommitDiagram(props.diagram, interaction.originalDiagram);
      setInteraction({ kind: "idle" });
      return;
    }

    if (interaction.kind === "external-id-marker-drag") {
      props.onCommitDiagram(props.diagram, interaction.originalDiagram);
      setInteraction({ kind: "idle" });
      return;
    }

    if (interaction.kind === "marquee") {
      const bounds = normalizeBounds(interaction.startWorld, interaction.currentWorld);
      const selectedIds = props.diagram.nodes
        .filter((node) => {
          if (bounds.width < 4 && bounds.height < 4) {
            return false;
          }

          const nodeBounds = getNodeBounds(node);
          return !(
            nodeBounds.x + nodeBounds.width < bounds.x ||
            bounds.x + bounds.width < nodeBounds.x ||
            nodeBounds.y + nodeBounds.height < bounds.y ||
            bounds.y + bounds.height < nodeBounds.y
          );
        })
        .map((node) => node.id);

      props.onSelectionChange(
        interaction.additive
          ? unionSelection(interaction.baseSelection, selectedIds)
          : { nodeIds: selectedIds, edgeIds: [] },
      );
    }

    if (interaction.kind === "pan" && event.pointerId === interaction.pointerId) {
      setInteraction({ kind: "idle" });
      return;
    }

    setInteraction({ kind: "idle" });
  }

  function handleCanvasWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    dismissPanHint();

    if (!containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const deltaScale = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? rect.height : 1;
    const zoomFactor = Math.exp((-event.deltaY * deltaScale) / 720);
    const nextZoom = clampZoom(props.viewport.zoom * zoomFactor);

    if (Math.abs(nextZoom - props.viewport.zoom) < 0.001) {
      return;
    }

    const worldX = (cursorX - props.viewport.x) / props.viewport.zoom;
    const worldY = (cursorY - props.viewport.y) / props.viewport.zoom;

    props.onViewportChange({
      zoom: nextZoom,
      x: cursorX - worldX * nextZoom,
      y: cursorY - worldY * nextZoom,
    });
  }

  function startInlineNodeEdit(event: MouseEvent<SVGGElement>, node: DiagramNode) {
    event.stopPropagation();
    setInlineEdit({ kind: "node", id: node.id, value: node.label });
  }

  function startInlineEdgeEdit(event: MouseEvent<SVGGElement>, edge: DiagramEdge) {
    event.stopPropagation();
    if (edge.type === "connector") {
      props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
      props.onOpenCardinality(edge.id);
      return;
    }

    if (edge.type !== "inheritance") {
      return;
    }

    setInlineEdit({ kind: "edge", id: edge.id, value: edge.label });
  }

  function commitInlineEdit() {
    if (!inlineEdit) {
      return;
    }

    const trimmed = inlineEdit.value.trim();
    if (inlineEdit.kind === "node") {
      const currentNode = nodeMap.get(inlineEdit.id);
      props.onRenameNode(inlineEdit.id, trimmed || currentNode?.label || "");
    } else {
      const currentEdge = props.diagram.edges.find((edge) => edge.id === inlineEdit.id);

      if (!currentEdge) {
        setInlineEdit(null);
        return;
      }

      props.onRenameEdge(inlineEdit.id, trimmed || currentEdge.label || "");
    }

    setInlineEdit(null);
  }

  function inlineEditorStyle() {
    if (!inlineEdit || !containerRef.current) {
      return undefined;
    }

    const rect = containerRef.current.getBoundingClientRect();

    if (inlineEdit.kind === "node") {
      const node = nodeMap.get(inlineEdit.id);
      if (!node) {
        return undefined;
      }

      const targetPoint =
        node.type === "attribute"
          ? (() => {
              const layout = getAttributeLabelLayout(node, attributeDirectionMap.get(node.id));
              const horizontalAnchorOffset =
                layout.textAnchor === "start" ? 12 : layout.textAnchor === "end" ? -160 : -74;
              return {
                x: layout.x + horizontalAnchorOffset,
                y: layout.y - 12,
              };
            })()
          : { x: node.x + 10, y: node.y + node.height / 2 - 14 };
      const screenPoint = clientPointFromWorld(targetPoint, props.viewport, rect);

      return {
        left: screenPoint.x - rect.left,
        top: screenPoint.y - rect.top,
        width: Math.max(140, node.width * props.viewport.zoom),
      };
    }

    const edge = props.diagram.edges.find((candidate) => candidate.id === inlineEdit.id);
    if (!edge) {
      return undefined;
    }

    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      return undefined;
    }

    const laneInfo = connectorLaneMap.get(edge.id);
    const geometry = getEdgeGeometry(edge, sourceNode, targetNode, laneInfo);
    const screenPoint = clientPointFromWorld(geometry.labelPoint, props.viewport, rect);

    return {
      left: screenPoint.x - rect.left - 80,
      top: screenPoint.y - rect.top - 18,
      width: 180,
    };
  }

  const marqueeBounds =
    interaction.kind === "marquee"
      ? normalizeBounds(interaction.startWorld, interaction.currentWorld)
      : null;
  const editorStyle = inlineEditorStyle();
  const pendingSourceNode = pendingConnectionSource ? nodeMap.get(pendingConnectionSource) : undefined;
  const pendingConnectionPath =
    pendingSourceNode && connectionPreviewPoint
      ? pathFromPoints([
          clipPointToNodePerimeter(pendingSourceNode, connectionPreviewPoint),
          connectionPreviewPoint,
        ])
      : null;
  const compositeMemberHostByAttributeId = new Map<string, string>();
  compositeIdentifierLayouts.forEach((layout) => {
    layout.memberAttributeIds.forEach((attributeId) => {
      compositeMemberHostByAttributeId.set(attributeId, layout.hostEntityId);
    });
  });
  const compositeIdentifierInteractive = props.mode === "edit" && props.tool === "select";
  const groupedInheritanceLayouts = (props.diagram.generalizationGroups ?? [])
    .map((group) => {
      if (group.subtypeIds.length < 2) {
        return null;
      }

      const supertype = nodeMap.get(group.supertypeId);
      const subtypes = group.subtypeIds
        .map((subtypeId) => nodeMap.get(subtypeId))
        .filter((node): node is DiagramNode => node?.type === "entity");
      if (!supertype || supertype.type !== "entity" || subtypes.length < 2) {
        return null;
      }

      const edges = props.diagram.edges.filter(
        (edge) =>
          edge.type === "inheritance" &&
          (
            edge.generalizationGroupId === group.id ||
            (edge.targetId === group.supertypeId && group.subtypeIds.includes(edge.sourceId))
          ),
      );
      if (edges.length < 2) {
        return null;
      }

      const childCenters = subtypes.map((node) => getNodeCenter(node));
      const superCenter = getNodeCenter(supertype);
      const childAverageY = childCenters.reduce((sum, point) => sum + point.y, 0) / childCenters.length;
      const barY = (childAverageY + superCenter.y) / 2;
      const minX = Math.min(...childCenters.map((point) => point.x));
      const maxX = Math.max(...childCenters.map((point) => point.x));
      const barStart = { x: minX, y: barY };
      const barEnd = { x: maxX, y: barY };
      const barCenter = { x: (minX + maxX) / 2, y: barY };
      const superAttach = clipPointToNodePerimeter(supertype, barCenter);
      const childStems = subtypes.map((node) => {
        const childCenter = getNodeCenter(node);
        return {
          nodeId: node.id,
          from: clipPointToNodePerimeter(node, { x: childCenter.x, y: barY }),
          to: { x: childCenter.x, y: barY },
        };
      });
      const firstEdge = edges[0];

      return {
        group,
        edgeIds: edges.map((edge) => edge.id),
        selected: edges.some((edge) => props.selection.edgeIds.includes(edge.id)),
        focused: focusedTarget?.kind === "edge" && edges.some((edge) => edge.id === focusedTarget.id),
        firstEdgeId: firstEdge?.id,
        barStart,
        barEnd,
        barCenter,
        superAttach,
        childStems,
        label:
          group.isaCompleteness || group.isaDisjointness
            ? `(${group.isaCompleteness === "total" ? "t" : "p"},${group.isaDisjointness === "overlap" ? "o" : "e"})`
            : "",
      };
    })
    .filter((layout): layout is NonNullable<typeof layout> => layout !== null);
  const groupedInheritanceEdgeIds = new Set(groupedInheritanceLayouts.flatMap((layout) => layout.edgeIds));
  const toolDefinitions = getToolDefinitions();
  const activeToolDefinition = toolDefinitions.find((item) => item.tool === props.tool);
  const selectedNode =
    props.selection.nodeIds.length === 1 && props.selection.edgeIds.length === 0
      ? nodeMap.get(props.selection.nodeIds[0])
      : undefined;
  const internalIdentifierHost =
    selectedNode?.type === "attribute"
      ? props.diagram.nodes.find(
          (node) =>
            node.type === "entity" &&
            (node.internalIdentifiers ?? []).some((identifier) => identifier.attributeIds.includes(selectedNode.id)),
        )
      : undefined;
  const externalIdentifierFlowActive =
    props.mode === "edit" &&
    props.tool === "select" &&
    selectedNode?.type === "attribute" &&
    internalIdentifierHost?.type === "entity";
  const activeCompositeGroupKey =
    interaction.kind === "drag"
      ? compositeIdentifierLayouts.find((layout) =>
          interaction.nodeIds.some((nodeId) => layout.memberAttributeIds.includes(nodeId)),
        )?.groupKey
      : null;
  const activeExternalIdentifierId =
    interaction.kind === "external-id-drag" || interaction.kind === "external-id-marker-drag"
      ? interaction.externalIdentifierId
      : null;
  const visiblePersistentMessage =
    persistentMessage && persistentMessage.key !== dismissedMessageKey ? persistentMessage : null;
  const placementGhostNode: DiagramNode | null =
    placementPreviewPoint && placeableCanvasTool(props.tool)
      ? {
          id: `placement-preview-${props.tool}`,
          type: props.tool,
          label: props.tool === "entity" ? "ENTITA" : "RELAZIONE",
          x: placementPreviewPoint.x - (props.tool === "entity" ? 140 : 130) / 2,
          y: placementPreviewPoint.y - (props.tool === "entity" ? 64 : 78) / 2,
          width: props.tool === "entity" ? 140 : 130,
          height: props.tool === "entity" ? 64 : 78,
          ...(props.tool === "entity"
            ? { isWeak: false, internalIdentifiers: [], externalIdentifiers: [], relationshipParticipations: [] }
            : {}),
        } as DiagramNode
      : null;

  let guidanceState: CanvasGuidanceState = "idle";
  let guidanceStateLabel = "";
  let guidanceTitle = activeToolDefinition?.label ?? props.tool;
  let guidanceMessage = "Modella dal canvas, poi usa il rail per rifinire proprieta e regole ER della selezione.";
  let guidanceShortcuts = ["Home centra", "9 adatta", "0 reset"];

  if (inlineEdit) {
    guidanceState = "editing-label";
    guidanceStateLabel = "Editing label";
    guidanceTitle = inlineEdit.kind === "node" ? "Rinomina nodo" : "Modifica etichetta ISA";
    guidanceMessage = "Aggiorna l'etichetta direttamente sul canvas. Invio conferma e il blur salva automaticamente.";
    guidanceShortcuts = ["Invio salva", "Click fuori conferma"];
  } else if (
    interaction.kind === "edge-drag" ||
    interaction.kind === "external-id-drag" ||
    interaction.kind === "external-id-marker-drag" ||
    activeCompositeGroupKey
  ) {
    guidanceState = "dragging-routing";
    guidanceStateLabel = "Dragging routing";
    guidanceTitle =
      interaction.kind === "edge-drag"
        ? "Routing connector"
        : interaction.kind === "external-id-marker-drag"
          ? "Marker external identifier"
          : interaction.kind === "external-id-drag"
            ? "External identifier"
            : "Backbone composite identifier";
    guidanceMessage =
      interaction.kind === "edge-drag"
        ? "Trascina la label del connector per spostare il routing senza cambiare gli estremi."
        : interaction.kind === "external-id-marker-drag"
          ? "Regola il marker dell'identificatore esterno per chiarire il punto di lettura."
          : interaction.kind === "external-id-drag"
            ? "Regola il routing dell'identificatore esterno mantenendo leggibile la relazione di supporto."
            : "Trascina il backbone per muovere insieme gli attributi membri dell'identificatore composto.";
    guidanceShortcuts = ["Rilascia per salvare", "Shift + frecce per spostamenti piu ampi"];
  } else if (placementGhostNode) {
    guidanceState = "selecting-target";
    guidanceStateLabel = "Placing";
    guidanceTitle = props.tool === "entity" ? "Posiziona entita" : "Posiziona associazione";
    guidanceMessage = "Clicca nel workspace per creare l'elemento in questo punto.";
    guidanceShortcuts = ["Esc annulla", "Click crea"];
  } else if (pendingConnectionSource && pendingSourceNode) {
    guidanceState = "selecting-target";
    guidanceStateLabel = "Selecting target";
    guidanceTitle = props.tool === "inheritance" ? "Flusso ISA" : "Flusso source -> target";
    guidanceMessage = `Sorgente fissata su ${pendingSourceNode.label}. Seleziona ora la destinazione compatibile nel canvas.`;
    guidanceShortcuts = ["Esc annulla", "Click target completa"];
  } else if (externalIdentifierFlowActive && selectedNode?.type === "attribute" && internalIdentifierHost) {
    guidanceState = "selecting-target";
    guidanceStateLabel = "Selecting target";
    guidanceTitle = "External identifier";
    guidanceMessage = `Seleziona l'entita target o un attributo compatibile per creare l'identificatore esterno di ${selectedNode.label}.`;
    guidanceShortcuts = ["Click target crea", "Tab mette a fuoco i nodi"];
  } else if (props.tool === "connector" || props.tool === "inheritance") {
    guidanceState = "selecting-source";
    guidanceStateLabel = "Selecting source";
    guidanceTitle = props.tool === "inheritance" ? "Ereditarieta" : "Connector";
    guidanceMessage =
      props.tool === "inheritance"
        ? "Seleziona prima la sorgente dell'ereditarieta, poi il target ISA."
        : "Seleziona la sorgente del collegamento. Il canvas ti guidera poi al target.";
    guidanceShortcuts = ["Tab mette a fuoco i nodi", `${activeToolDefinition?.shortcut.toUpperCase() ?? "C"} mantiene il tool attivo`];
  } else if (visiblePersistentMessage && (visiblePersistentMessage.tone === "warning" || visiblePersistentMessage.tone === "error")) {
    guidanceState = "invalid-action";
    guidanceStateLabel = "Invalid action";
    guidanceTitle = "Controllo ER";
    guidanceMessage = visiblePersistentMessage.message;
    guidanceShortcuts = ["Correggi la selezione", "Consulta regole nel rail"];
  } else if (props.tool === "move") {
    guidanceTitle = activeToolDefinition?.label ?? "Pan";
    guidanceMessage = "Usa drag o Spazio + drag per navigare il canvas senza alterare il diagramma.";
    guidanceShortcuts = ["Spazio + drag pan", "+ / - zoom", "9 adatta"];
  } else if (props.tool === "select" && props.selection.nodeIds.length + props.selection.edgeIds.length > 0) {
    guidanceTitle = "Selezione attiva";
    guidanceMessage = "Azioni rapide nel rail. Le proprieta della selezione e i warning ER restano nella sezione inferiore del pannello.";
    guidanceShortcuts = ["Invio rinomina", "Canc elimina", "Frecce spostano"];
  } else if (props.tool === "select") {
    guidanceTitle = "Selezione";
    guidanceMessage = "Seleziona, trascina o usa marquee. Le gesture avanzate diventano evidenti su hover e focus.";
    guidanceShortcuts = ["Invio rinomina", "Tab focus", "Shift + drag aggiunge"];
  }

  const flowPrompt =
    pendingConnectionSource && pendingSourceNode
      ? {
          title: props.tool === "inheritance" ? "Step 2 di 2 - ISA" : "Step 2 di 2 - Connector",
          body:
            props.tool === "inheritance"
              ? `Origine: ${pendingSourceNode.label}. Seleziona il target dell'ereditarieta oppure annulla il flusso.`
              : `Origine: ${pendingSourceNode.label}. Seleziona la destinazione del collegamento oppure annulla il flusso.`,
          dismissLabel: "Annulla",
          onDismiss: () => {
            cancelPendingConnection();
            props.onStatusMessageChange("Creazione collegamento annullata.");
          },
        }
      : externalIdentifierFlowActive && selectedNode?.type === "attribute" && internalIdentifierHost
        ? {
            title: "Step 2 di 2 - Identificatore esterno",
            body: `Sorgente: ${selectedNode.label} da ${internalIdentifierHost.label}. Ora scegli l'entita host o un attributo compatibile come target.`,
            dismissLabel: "Deseleziona",
            onDismiss: () => {
              props.onSelectionChange({ nodeIds: [], edgeIds: [] });
            },
          }
        : null;

  const advancedAffordances =
    props.tool === "select"
      ? [
          props.diagram.edges.some((edge) => edge.type === "connector")
            ? { key: "connector-label", label: "Label connector", hint: "Trascina la cardinalita per regolare il routing." }
            : null,
          externalIdentifierLayouts.length > 0
            ? { key: "external-id-marker", label: "Marker ext. ID", hint: "Hover o focus sul marker per trascinarlo." }
            : null,
          compositeIdentifierLayouts.length > 0
            ? { key: "composite-backbone", label: "Backbone composite", hint: "Trascina il backbone per muovere il gruppo." }
            : null,
        ].filter((item): item is { key: string; label: string; hint: string } => item !== null)
      : [];

  return (
    <div
      ref={containerRef}
      className="canvas-panel"
      role="region"
      tabIndex={0}
      aria-label="Canvas diagramma ER. Usa Tab per mettere a fuoco nodi e collegamenti, frecce per spostare la selezione, Invio per rinominare e Canc per eliminare."
      onKeyDown={handleCanvasKeyDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={(event) => {
        if (pendingConnectionSource) {
          setConnectionPreviewPoint(null);
        }
        handlePointerUp(event);
      }}
      onWheel={handleCanvasWheel}
    >


      <svg ref={props.svgRef} className="diagram-canvas">
        <defs>
          <marker
            id="arrowhead"
            markerWidth="12"
            markerHeight="12"
            refX="10"
            refY="6"
            orient="auto"
            markerUnits="strokeWidth"
          >
            <path d="M 0 0 L 12 6 L 0 12 z" fill="context-stroke" />
          </marker>
        </defs>

        <g transform={`translate(${props.viewport.x}, ${props.viewport.y}) scale(${props.viewport.zoom})`}>
          <rect
            x={-WORLD_EXTENT / 2}
            y={-WORLD_EXTENT / 2}
            width={WORLD_EXTENT}
            height={WORLD_EXTENT}
            fill="var(--diagram-canvas-fill)"
            onPointerDown={handleCanvasPointerDown}
          />

          {dragGhostEdges.map((edge) => {
            const sourceNode = dragGhostNodeMap.get(edge.sourceId) ?? nodeMap.get(edge.sourceId);
            const targetNode = dragGhostNodeMap.get(edge.targetId) ?? nodeMap.get(edge.targetId);

            if (!sourceNode || !targetNode) {
              return null;
            }

            return (
              <DiagramEdgeView
                key={`ghost-${edge.id}`}
                edge={edge}
                sourceNode={sourceNode}
                targetNode={targetNode}
                laneInfo={connectorLaneMap.get(edge.id)}
                selected={false}
                dragging={false}
                ghost
                focused={false}
                focusable={false}
                onFocus={() => undefined}
                onBlur={() => undefined}
                onPointerDown={() => undefined}
                onLabelPointerDown={() => undefined}
                onDoubleClick={() => undefined}
              />
            );
          })}

          {interaction.kind === "drag"
            ? interaction.originalDiagram.nodes
                .filter((node) => dragGhostNodeIds.has(node.id))
                .map((node) => (
                  <DiagramNodeView
                    key={`ghost-${node.id}`}
                    node={node}
                    selected={false}
                    dragging={false}
                    ghost
                    pending={false}
                    validationLevel={undefined}
                    validationCount={undefined}
                    focused={false}
                    focusable={false}
                    onFocus={() => undefined}
                    onBlur={() => undefined}
                    attributeDirection={originalAttributeDirectionMap.get(node.id)}
                    onPointerDown={() => undefined}
                    onDoubleClick={() => undefined}
                  />
                ))
            : null}

          {placementGhostNode ? (
            <DiagramNodeView
              key={placementGhostNode.id}
              node={placementGhostNode}
              selected={false}
              dragging={false}
              ghost
              pending={false}
              validationLevel={undefined}
              validationCount={undefined}
              focused={false}
              focusable={false}
              onFocus={() => undefined}
              onBlur={() => undefined}
              attributeDirection={undefined}
              onPointerDown={() => undefined}
              onDoubleClick={() => undefined}
            />
          ) : null}

          {groupedInheritanceLayouts.map((layout) => {
            const stroke = layout.selected || layout.focused ? DIAGRAM_FOCUS : DIAGRAM_STROKE;
            const pathData = pathFromPoints([layout.barCenter, layout.superAttach]);
            return (
              <g
                key={`inheritance-group-${layout.group.id}`}
                className={layout.selected ? "diagram-edge selected inheritance-group" : "diagram-edge inheritance-group"}
                tabIndex={props.tool === "select" ? 0 : -1}
                focusable={props.tool === "select" ? "true" : "false"}
                onFocus={() => layout.firstEdgeId ? setFocusedTarget({ kind: "edge", id: layout.firstEdgeId }) : undefined}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (!layout.firstEdgeId || props.tool !== "select") {
                    return;
                  }
                  props.onSelectionChange({ nodeIds: [], edgeIds: [layout.firstEdgeId] });
                }}
                onDoubleClick={(event) => {
                  event.stopPropagation();
                  if (!layout.firstEdgeId) {
                    return;
                  }
                  props.onSelectionChange({ nodeIds: [], edgeIds: [layout.firstEdgeId] });
                  startInlineEdgeEdit(event, props.diagram.edges.find((edge) => edge.id === layout.firstEdgeId) as DiagramEdge);
                }}
              >
                <path d={pathData} fill="none" stroke="transparent" strokeWidth={16} />
                <line
                  x1={layout.barStart.x}
                  y1={layout.barStart.y}
                  x2={layout.barEnd.x}
                  y2={layout.barEnd.y}
                  stroke={stroke}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                />
                <path
                  d={pathData}
                  fill="none"
                  stroke={stroke}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  markerEnd="url(#arrowhead)"
                />
                {layout.childStems.map((stem) => (
                  <line
                    key={`${layout.group.id}-${stem.nodeId}`}
                    x1={stem.from.x}
                    y1={stem.from.y}
                    x2={stem.to.x}
                    y2={stem.to.y}
                    stroke={stroke}
                    strokeWidth={2.2}
                    strokeLinecap="round"
                  />
                ))}
                {layout.label ? (
                  <text
                    x={layout.barCenter.x}
                    y={layout.barCenter.y + 18}
                    textAnchor="middle"
                    className="edge-label inheritance-constraint-label"
                    fill={stroke}
                  >
                    {layout.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          {props.diagram.edges.map((edge) => {
            if (groupedInheritanceEdgeIds.has(edge.id)) {
              return null;
            }

            const sourceNode = nodeMap.get(edge.sourceId);
            const targetNode = nodeMap.get(edge.targetId);

            if (!sourceNode || !targetNode) {
              return null;
            }

            if (edge.type === "attribute") {
              const sourceHostId =
                sourceNode.type === "attribute"
                  ? compositeMemberHostByAttributeId.get(sourceNode.id)
                  : undefined;
              const targetHostId =
                targetNode.type === "attribute"
                  ? compositeMemberHostByAttributeId.get(targetNode.id)
                  : undefined;

              const isCompositeMemberDirectEdge =
                (sourceHostId !== undefined && targetNode.type === "entity" && targetNode.id === sourceHostId) ||
                (targetHostId !== undefined && sourceNode.type === "entity" && sourceNode.id === targetHostId);

              if (isCompositeMemberDirectEdge) {
                return null;
              }
            }

            return (
              <DiagramEdgeView
                key={edge.id}
                edge={edge}
                sourceNode={sourceNode}
                targetNode={targetNode}
                laneInfo={connectorLaneMap.get(edge.id)}
                selected={props.selection.edgeIds.includes(edge.id)}
                dragging={interaction.kind === "edge-drag" && interaction.edgeId === edge.id}
                validationLevel={edgeIssueMap.get(edge.id)?.level}
                validationCount={edgeIssueMap.get(edge.id)?.count}
                translationHighlight={resolveTranslationHighlight(edge.id, props.translationHighlights)}
                focused={focusedTarget?.kind === "edge" && focusedTarget.id === edge.id}
                focusable={props.tool === "select"}
                onFocus={handleEdgeFocus}
                onBlur={(focusEvent: ReactFocusEvent<SVGGElement>) => {
                  if (!focusEvent.currentTarget.contains(focusEvent.relatedTarget as Node | null)) {
                    setFocusedTarget((current) =>
                      current?.kind === "edge" && current.id === edge.id ? null : current,
                    );
                  }
                }}
                onPointerDown={handleEdgePointerDown}
                onLabelPointerDown={handleEdgeLabelPointerDown}
                onDoubleClick={startInlineEdgeEdit}
              />
            );
          })}

          {props.diagram.nodes.map((node) => (
            <DiagramNodeView
              key={node.id}
              node={node}
              selected={props.selection.nodeIds.includes(node.id)}
              dragging={interaction.kind === "drag" && interaction.nodeIds.includes(node.id)}
              pending={pendingConnectionSource === node.id}
              validationLevel={nodeIssueMap.get(node.id)?.level}
              validationCount={nodeIssueMap.get(node.id)?.count}
              translationHighlight={resolveTranslationHighlight(node.id, props.translationHighlights)}
              focused={focusedTarget?.kind === "node" && focusedTarget.id === node.id}
              focusable={props.tool === "select" || props.tool === "connector" || props.tool === "inheritance"}
              onFocus={handleNodeFocus}
              onBlur={(focusEvent: ReactFocusEvent<SVGGElement>) => {
                if (!focusEvent.currentTarget.contains(focusEvent.relatedTarget as Node | null)) {
                  setFocusedTarget((current) =>
                    current?.kind === "node" && current.id === node.id ? null : current,
                  );
                }
              }}
              attributeDirection={attributeDirectionMap.get(node.id)}
              onPointerDown={handleNodePointerDown}
              onDoubleClick={startInlineNodeEdit}
            />
          ))}

          {pendingConnectionPath ? (
            <g className="connection-preview" pointerEvents="none">
              <path
                d={pendingConnectionPath}
                fill="none"
                stroke={DIAGRAM_FOCUS}
                strokeWidth={2.5}
                strokeDasharray="10 8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx={connectionPreviewPoint?.x} cy={connectionPreviewPoint?.y} r={6} fill={DIAGRAM_FOCUS} />
            </g>
          ) : null}

          {compositeIdentifierLayouts.map((layout) => (
            <g
              key={`composite-id-${layout.groupKey}`}
              className={
                activeCompositeGroupKey === layout.groupKey
                  ? "composite-identifier composite-identifier-active"
                  : "composite-identifier"
              }
              pointerEvents={compositeIdentifierInteractive ? "visiblePainted" : "none"}
              onPointerDown={
                compositeIdentifierInteractive
                  ? (event) => handleCompositeIdentifierPointerDown(event, layout)
                  : undefined
              }
            >
              {layout.hostStems.map((stem) => (
                <line
                  key={`composite-id-host-stem-${layout.groupKey}-${stem.attributeId}`}
                  className="composite-identifier-path"
                  x1={stem.from.x}
                  y1={stem.from.y}
                  x2={stem.to.x}
                  y2={stem.to.y}
                  stroke={DIAGRAM_STROKE}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              ))}
              {layout.branches.map((branch) => (
                <line
                  key={`composite-id-branch-${layout.groupKey}-${branch.attributeId}`}
                  className="composite-identifier-path"
                  x1={branch.from.x}
                  y1={branch.from.y}
                  x2={branch.to.x}
                  y2={branch.to.y}
                  stroke={DIAGRAM_STROKE}
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              ))}
              <line
                className="composite-identifier-path composite-identifier-backbone"
                x1={layout.backboneStart.x}
                y1={layout.backboneStart.y}
                x2={layout.backboneEnd.x}
                y2={layout.backboneEnd.y}
                stroke={DIAGRAM_STROKE}
                strokeWidth={2}
                strokeLinecap="round"
              />
              {layout.junctions.map((junction, index) => (
                <circle
                  key={`composite-id-junction-${layout.groupKey}-${index}`}
                  className="composite-identifier-junction"
                  cx={junction.x}
                  cy={junction.y}
                  r={4.5}
                  fill={DIAGRAM_STROKE}
                  stroke={DIAGRAM_STROKE}
                  strokeWidth={1.2}
                />
              ))}
              <line
                className="composite-identifier-path"
                x1={layout.markerStemFrom.x}
                y1={layout.markerStemFrom.y}
                x2={layout.marker.x}
                y2={layout.marker.y}
                stroke={DIAGRAM_STROKE}
                strokeWidth={2}
                strokeLinecap="round"
              />
              <circle
                className="composite-identifier-marker"
                cx={layout.marker.x}
                cy={layout.marker.y}
                r={8.5}
                fill={DIAGRAM_STROKE}
                stroke={DIAGRAM_STROKE}
                strokeWidth={2}
              />

              {compositeIdentifierInteractive ? (
                <>
                  {layout.hostStems.map((stem) => (
                    <line
                      key={`composite-id-host-stem-hit-${layout.groupKey}-${stem.attributeId}`}
                      className="composite-identifier-hit"
                      x1={stem.from.x}
                      y1={stem.from.y}
                      x2={stem.to.x}
                      y2={stem.to.y}
                      stroke="transparent"
                      strokeWidth={12}
                    />
                  ))}
                  <line
                    className="composite-identifier-hit"
                    x1={layout.backboneStart.x}
                    y1={layout.backboneStart.y}
                    x2={layout.backboneEnd.x}
                    y2={layout.backboneEnd.y}
                    stroke="transparent"
                    strokeWidth={14}
                  />
                  {layout.branches.map((branch) => (
                    <line
                      key={`composite-id-branch-hit-${layout.groupKey}-${branch.attributeId}`}
                      className="composite-identifier-hit"
                      x1={branch.from.x}
                      y1={branch.from.y}
                      x2={branch.to.x}
                      y2={branch.to.y}
                      stroke="transparent"
                      strokeWidth={12}
                    />
                  ))}
                  <circle className="composite-identifier-hit" cx={layout.marker.x} cy={layout.marker.y} r={11} fill="transparent" />
                </>
              ) : null}
            </g>
          ))}

          {externalIdentifierLayouts.map((layout) => {
            if (layout.kind === "imported_only" && layout.junction) {
              const markerPath = pathFromPoints(layout.pathPoints);
              return (
                <g
                  key={`external-id-${layout.externalIdentifierId}`}
                  className={
                    activeExternalIdentifierId === layout.externalIdentifierId
                      ? "external-identifier external-identifier-imported external-identifier-active"
                      : "external-identifier external-identifier-imported"
                  }
                  onPointerDown={(event) =>
                    handleExternalIdentifierPointerDown(
                      event,
                      layout.hostEntityId,
                      layout.externalIdentifierId,
                    )
                  }
                >
                  <path className="external-identifier-hit-path" d={markerPath} fill="none" stroke="transparent" strokeWidth={16} />
                  <path
                    className="external-identifier-path"
                    d={markerPath}
                    fill="none"
                    stroke={DIAGRAM_STROKE}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    className="external-identifier-junction"
                    cx={layout.junction.x}
                    cy={layout.junction.y}
                    r={4.3}
                    fill={DIAGRAM_STROKE}
                    stroke={DIAGRAM_STROKE}
                    strokeWidth={1.2}
                  />
                  <circle
                    className="external-identifier-marker"
                    cx={layout.marker.x}
                    cy={layout.marker.y}
                    r={6.5}
                    fill="var(--diagram-canvas-fill)"
                    stroke={DIAGRAM_STROKE}
                    strokeWidth={1.8}
                    pointerEvents="none"
                  />
                  <circle
                    className="external-identifier-marker-hit"
                    cx={layout.marker.x}
                    cy={layout.marker.y}
                    r={10}
                    fill="transparent"
                    stroke="none"
                    pointerEvents="all"
                    onPointerDown={(event) =>
                      handleExternalIdentifierMarkerPointerDown(
                        event,
                        layout.hostEntityId,
                        layout.externalIdentifierId,
                      )
                    }
                  />
                </g>
              );
            }

            const pathData = pathFromPoints(layout.pathPoints);

            return (
              <g
                key={`external-id-${layout.externalIdentifierId}`}
                className={
                  activeExternalIdentifierId === layout.externalIdentifierId
                    ? "external-identifier external-identifier-mixed external-identifier-active"
                    : "external-identifier external-identifier-mixed"
                }
                onPointerDown={(event) =>
                  handleExternalIdentifierPointerDown(
                    event,
                    layout.hostEntityId,
                    layout.externalIdentifierId,
                  )
                }
              >
                <path className="external-identifier-hit-path" d={pathData} fill="none" stroke="transparent" strokeWidth={14} />
                <path
                  className="external-identifier-path"
                  d={pathData}
                  fill="none"
                  stroke={DIAGRAM_STROKE}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {layout.junction ? (
                  <circle
                    className="external-identifier-junction"
                    cx={layout.junction.x}
                    cy={layout.junction.y}
                    r={4.3}
                    fill={DIAGRAM_STROKE}
                    stroke={DIAGRAM_STROKE}
                    strokeWidth={1.2}
                  />
                ) : null}
                {layout.attributeJunction ? (
                  <circle
                    className="external-identifier-junction"
                    cx={layout.attributeJunction.x}
                    cy={layout.attributeJunction.y}
                    r={3.9}
                    fill={DIAGRAM_STROKE}
                    stroke={DIAGRAM_STROKE}
                    strokeWidth={1.1}
                  />
                ) : null}
                {layout.markerStemStart ? (
                  <line
                    className="external-identifier-path"
                    x1={layout.markerStemStart.x}
                    y1={layout.markerStemStart.y}
                    x2={layout.marker.x}
                    y2={layout.marker.y}
                    stroke={DIAGRAM_STROKE}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                ) : null}
                <circle
                  className="external-identifier-marker"
                  cx={layout.marker.x}
                  cy={layout.marker.y}
                  r={6.5}
                  fill="var(--diagram-canvas-fill)"
                  stroke={DIAGRAM_STROKE}
                  strokeWidth={1.8}
                  pointerEvents="none"
                />
                <circle
                  className="external-identifier-marker-hit"
                  cx={layout.marker.x}
                  cy={layout.marker.y}
                  r={10}
                  fill="transparent"
                  stroke="none"
                  pointerEvents="all"
                  onPointerDown={(event) =>
                    handleExternalIdentifierMarkerPointerDown(
                      event,
                      layout.hostEntityId,
                      layout.externalIdentifierId,
                    )
                  }
                />
              </g>
            );
          })}

          {marqueeBounds ? (
            <rect
              x={marqueeBounds.x}
              y={marqueeBounds.y}
              width={marqueeBounds.width}
              height={marqueeBounds.height}
              fill={DIAGRAM_SELECTION_FILL}
              stroke={DIAGRAM_FOCUS}
              strokeWidth={1.2}
              opacity={0.55}
            />
          ) : null}
        </g>
      </svg>

      <div className="canvas-viewport-hud" aria-label="Controlli viewport">
        <div className="canvas-hud-cluster canvas-hud-cluster-viewport">
          <button type="button" className="canvas-hud-button" onClick={() => zoomAroundCanvasCenter(1 / 1.14)}>
            -
          </button>
          <button type="button" className="canvas-hud-button canvas-hud-zoom" onClick={resetViewport}>
            {Math.round(props.viewport.zoom * 100)}%
          </button>
          <button type="button" className="canvas-hud-button" onClick={() => zoomAroundCanvasCenter(1.14)}>
            +
          </button>
          <button type="button" className="canvas-hud-button" onClick={fitToContent}>
            {props.selection.nodeIds.length > 0 ? "Adatta sel." : "Adatta"}
          </button>
          <button type="button" className="canvas-hud-button" onClick={centerDiagram}>
            Centra
          </button>
          <button type="button" className="canvas-hud-button" onClick={resetViewport}>
            Reset
          </button>
        </div>
      </div>

      {showPanHint ? (
        <div className="canvas-pan-hint" aria-hidden="true">
          Spazio + drag per pan, 9 adatta, 0 reset.
        </div>
      ) : null}

      {inlineEdit && editorStyle ? (
        <form
          className="inline-editor"
          style={editorStyle}
          onSubmit={(event) => {
            event.preventDefault();
            commitInlineEdit();
          }}
        >
          <input
            autoFocus
            value={inlineEdit.value}
            onBlur={commitInlineEdit}
            onChange={(event) =>
              setInlineEdit((current) => (current ? { ...current, value: event.target.value } : current))
            }
          />
        </form>
      ) : null}
    </div>
  );
}
