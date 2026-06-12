import { useEffect, useRef, useState } from "react";
import type {
  FocusEvent as ReactFocusEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from "react";
import { DiagramEdgeView, type EdgeLabelLayoutOverride } from "./DiagramEdge";
import { DiagramNodeView, getAttributeLabelLayout } from "./DiagramNode";
import { getToolDefinitions } from "../utils/toolConfig";
import {
  expandNodeIdsForMove,
  getExternalIdentifierImportedPartAttributes,
  getExternalIdentifierImportedRelationshipIds,
  getExternalIdentifierLocalAttributeIds,
} from "../utils/diagram";
import { canEdgeUseManualRouting } from "../utils/edgeRouting";
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
import { getConnectorParticipation, getEdgeCardinalityLabel } from "../utils/cardinality";
import { chooseCollisionFreeCardinalityLabelPlacement, getCardinalityLabelAnchorPoint } from "../utils/cardinalityLayout";
import {
  buildAttributeLabelBounds,
  buildEdgeLabelBounds,
  buildNodeReservedBounds,
  getPointAlongPolyline,
  type ReservedLabelBox,
} from "../utils/edgeLabelLayout";
import {
  buildInheritanceGroups,
  getInheritanceGroupLayout,
} from "../utils/inheritanceLayout";
import type {
  Bounds,
  DiagramDocument,
  DiagramHighlightKind,
  DiagramHighlights,
  EdgeKind,
  DiagramEdge,
  DiagramNode,
  EditorMode,
  ExternalIdentifier,
  Point,
  SelectionState,
  ToolKind,
  ValidationIssue,
  Viewport,
} from "../types/diagram";

const DIAGRAM_STROKE = "var(--diagram-stroke)";
const DIAGRAM_SELECTION_FILL = "var(--diagram-selection-fill)";
const DIAGRAM_FOCUS = "var(--diagram-focus)";
const DIAGRAM_TRANSLATION_PENDING = "var(--diagram-translation-pending, #ff3b30)";
const DIAGRAM_TRANSLATION_BLOCKED = "var(--diagram-translation-blocked, #b75b56)";

type FocusTarget =
  | { kind: "node"; id: string }
  | { kind: "edge"; id: string }
  | { kind: "externalIdentifier"; hostEntityId: string; externalIdentifierId: string }
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
      offsetDirection: Point;
      offsetMin: number;
      offsetMax: number;
    };

interface ActivePointer {
  pointerId: number;
  clientX: number;
  clientY: number;
  pointerType: string;
}

interface PinchState {
  pointerIds: [number, number];
  startDistance: number;
  startViewport: Viewport;
  startCenter: Point;
  startWorldCenter: Point;
}

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
  onOpenInheritanceType: (edgeId?: string) => void;
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
  readOnly?: boolean;
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
const COMPOSITE_INTERNAL_TERMINAL_MARKER_RADIUS = 8.5;
const EXTERNAL_IDENTIFIER_FRAME_PADDING = 18;
const EXTERNAL_IDENTIFIER_MIN_SEGMENT_LENGTH = 9;
const EXTERNAL_IDENTIFIER_COMPOSITE_MARKER_DISTANCE = 15;
const EXTERNAL_IDENTIFIER_IMPORTED_MARKER_RADIUS = 6.5;
const EXTERNAL_IDENTIFIER_IMPORTED_MARKER_STEM_LENGTH = 22;
const EXTERNAL_IDENTIFIER_IMPORTED_BRACKET_LENGTH = 24;
const EXTERNAL_IDENTIFIER_IMPORTED_HIT_STROKE_WIDTH = 22;
const EXTERNAL_IDENTIFIER_CARDINALITY_AVOIDANCE = 12;
const EXTERNAL_IDENTIFIER_LOCAL_MARKER_OFFSET = 28;
const EXTERNAL_IDENTIFIER_LOCAL_MARKER_CURVE = 18;
const EXTERNAL_IDENTIFIER_ENTITY_FRAME_OFFSET = 16;
const EXTERNAL_IDENTIFIER_FRAME_LANE_GAP = 16;
const EXTERNAL_IDENTIFIER_ROUTE_TERMINAL_EXTENSION = 16;
const EXTERNAL_IDENTIFIER_TERMINAL_MARKER_RADIUS = 6.5;

interface CompositeIdentifierMember {
  attributeId: string;
  attributeCenter: Point;
  hostAnchor: Point;
}

interface CompositeIdentifierMemberMarker {
  attributeId: string;
  marker: Point;
  projection: Point;
  side: FrameSide;
}

interface CompositeIdentifierLayout {
  groupKey: string;
  hostEntityId: string;
  memberAttributeIds: string[];
  laneIndex: number;
  frame: RouteFrame;
  pathData: string;
  hitPathData: string;
  pathPoints: Point[];
  memberMarkers: CompositeIdentifierMemberMarker[];
  junctions: Point[];
  terminalMarker?: Point;
}

interface ExternalIdentifierLayout {
  externalIdentifierId: string;
  hostEntityId: string;
  relationshipId: string;
  kind: "imported_only" | "imported_plus_local";
  marker: Point;
  pathPoints: Point[];
  markerStemStart?: Point;
  bracketStart?: Point;
  bracketEnd?: Point;
  junction?: Point;
  attributeJunction?: Point;
  offsetDirection?: Point;
  offsetMin?: number;
  offsetMax?: number;
}

interface ExternalIdentifierMarkerLayout {
  key: string;
  hostEntityId: string;
  externalIdentifierId: string;
  marker: Point;
  entityEndpoint?: Point;
  kind: "importedRelationship" | "localAttribute";
  tooltip?: string;
}

interface ExternalIdentifierFrameLayout {
  key: string;
  hostEntityId: string;
  externalIdentifierId: string;
  pathData: string;
  terminalMarker?: Point;
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

interface ExternalIdentifierGroupingMarker {
  marker: Point;
  kind: ExternalIdentifierMarkerLayout["kind"];
}

interface ExternalIdentifierFrameProjection extends ExternalIdentifierGroupingMarker {
  projection: Point;
  side: FrameSide;
  position: number;
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

function getFrameSideForSegment(frame: RouteFrame, start: Point, end: Point): FrameSide | null {
  if (distanceSquared(start, end) <= 0.25) {
    return null;
  }

  if (Math.abs(start.x - end.x) <= 0.01) {
    if (Math.abs(start.x - frame.left) <= 0.01) {
      return "left";
    }
    if (Math.abs(start.x - frame.right) <= 0.01) {
      return "right";
    }
  }

  if (Math.abs(start.y - end.y) <= 0.01) {
    if (Math.abs(start.y - frame.top) <= 0.01) {
      return "top";
    }
    if (Math.abs(start.y - frame.bottom) <= 0.01) {
      return "bottom";
    }
  }

  return null;
}

function scoreExternalIdentifierGroupingRoute(
  frame: RouteFrame,
  route: Point[],
  markerSides: Set<FrameSide>,
): { unmarkedSideCount: number; unmarkedSideLength: number; totalLength: number } {
  const unmarkedSides = new Set<FrameSide>();
  let unmarkedSideLength = 0;

  for (let index = 1; index < route.length; index += 1) {
    const side = getFrameSideForSegment(frame, route[index - 1], route[index]);
    if (!side || markerSides.has(side)) {
      continue;
    }

    unmarkedSides.add(side);
    unmarkedSideLength += distance(route[index - 1], route[index]);
  }

  return {
    unmarkedSideCount: unmarkedSides.size,
    unmarkedSideLength,
    totalLength: routeLength(route),
  };
}

function compareExternalIdentifierGroupingRouteScores(
  left: { unmarkedSideCount: number; unmarkedSideLength: number; totalLength: number },
  right: { unmarkedSideCount: number; unmarkedSideLength: number; totalLength: number },
): number {
  if (left.unmarkedSideCount !== right.unmarkedSideCount) {
    return left.unmarkedSideCount - right.unmarkedSideCount;
  }
  if (Math.abs(left.unmarkedSideLength - right.unmarkedSideLength) > 0.5) {
    return left.unmarkedSideLength - right.unmarkedSideLength;
  }
  if (Math.abs(left.totalLength - right.totalLength) > 0.5) {
    return left.totalLength - right.totalLength;
  }

  return 0;
}

function buildClockwiseOpenFrameRoute(
  frame: RouteFrame,
  orderedProjections: ExternalIdentifierFrameProjection[],
): Point[] {
  const perimeterPoints: Point[] = [];
  appendUniquePoint(perimeterPoints, orderedProjections[0].projection);

  for (let index = 1; index < orderedProjections.length; index += 1) {
    const previous = orderedProjections[index - 1];
    const current = orderedProjections[index];
    const route = buildFrameRoute(
      frame,
      previous.side,
      previous.projection,
      current.side,
      current.projection,
      "cw",
    );
    route.slice(1).forEach((point) => appendUniquePoint(perimeterPoints, point));
  }

  return perimeterPoints;
}

function selectExternalIdentifierGroupingRoute(
  frame: RouteFrame,
  projections: ExternalIdentifierFrameProjection[],
): Point[] {
  const sorted = [...projections].sort((left, right) => left.position - right.position);
  const markerSides = new Set(sorted.map((projection) => projection.side));
  let bestRoute: Point[] = [];
  let bestScore: ReturnType<typeof scoreExternalIdentifierGroupingRoute> | null = null;

  sorted.forEach((_, gapIndex) => {
    const ordered = [
      ...sorted.slice(gapIndex + 1),
      ...sorted.slice(0, gapIndex + 1),
    ];
    const route = buildClockwiseOpenFrameRoute(frame, ordered);
    const score = scoreExternalIdentifierGroupingRoute(frame, route, markerSides);

    if (!bestScore || compareExternalIdentifierGroupingRouteScores(score, bestScore) < 0) {
      bestRoute = route;
      bestScore = score;
    }
  });

  return bestRoute;
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

function getFrameSideTangent(side: FrameSide): Point {
  return side === "left" || side === "right" ? { x: 0, y: 1 } : { x: 1, y: 0 };
}

function getFrameSideOffsetRange(frame: RouteFrame, side: FrameSide, basePoint: Point): { min: number; max: number } {
  if (side === "left" || side === "right") {
    return {
      min: frame.top - basePoint.y,
      max: frame.bottom - basePoint.y,
    };
  }

  return {
    min: frame.left - basePoint.x,
    max: frame.right - basePoint.x,
  };
}

function getDefaultImportedMarkerNormal(side: FrameSide): Point {
  if (side === "left" || side === "right") {
    return { x: 0, y: -1 };
  }

  return { x: 1, y: 0 };
}

function getImportedMarkerNormal(
  side: FrameSide,
  connectorDirection: Point,
  junction: Point,
  cardinalityLabelPoint: Point,
): Point {
  const defaultNormal = getDefaultImportedMarkerNormal(side);
  const normalizedConnector = normalizeVector(connectorDirection, getFrameSideNormal(side));
  let normal = normalizeVector(
    { x: -normalizedConnector.y, y: normalizedConnector.x },
    defaultNormal,
  );

  if (normal.x * defaultNormal.x + normal.y * defaultNormal.y < 0) {
    normal = { x: -normal.x, y: -normal.y };
  }

  const labelVector = {
    x: cardinalityLabelPoint.x - junction.x,
    y: cardinalityLabelPoint.y - junction.y,
  };
  const labelSide = labelVector.x * normal.x + labelVector.y * normal.y;
  if (labelSide > EXTERNAL_IDENTIFIER_CARDINALITY_AVOIDANCE) {
    return { x: -normal.x, y: -normal.y };
  }

  return normal;
}

export function buildImportedOnlyExternalIdentifierLayout(
  hostBounds: Bounds,
  weakSidePoint: Point,
  weakSideAdjacentPoint: Point,
  cardinalityLabelPoint: Point,
): Pick<
  ExternalIdentifierLayout,
  | "marker"
  | "pathPoints"
  | "markerStemStart"
  | "bracketStart"
  | "bracketEnd"
  | "junction"
> {
  const connectorDirection = normalizeVector(
    {
      x: weakSideAdjacentPoint.x - weakSidePoint.x,
      y: weakSideAdjacentPoint.y - weakSidePoint.y,
    },
    { x: 0, y: -1 },
  );
  const frame: RouteFrame = {
    left: hostBounds.x - EXTERNAL_IDENTIFIER_FRAME_PADDING,
    top: hostBounds.y - EXTERNAL_IDENTIFIER_FRAME_PADDING,
    right: hostBounds.x + hostBounds.width + EXTERNAL_IDENTIFIER_FRAME_PADDING,
    bottom: hostBounds.y + hostBounds.height + EXTERNAL_IDENTIFIER_FRAME_PADDING,
    centerX: hostBounds.x + hostBounds.width / 2,
    centerY: hostBounds.y + hostBounds.height / 2,
  };
  const side = resolveFrameSide(hostBounds, weakSidePoint, connectorDirection);
  const junction = computeVisibleJunctionPoint(frame, side, weakSidePoint, weakSideAdjacentPoint);
  const markerNormal = getImportedMarkerNormal(side, connectorDirection, junction, cardinalityLabelPoint);
  const marker = {
    x: junction.x + markerNormal.x * EXTERNAL_IDENTIFIER_IMPORTED_MARKER_STEM_LENGTH,
    y: junction.y + markerNormal.y * EXTERNAL_IDENTIFIER_IMPORTED_MARKER_STEM_LENGTH,
  };
  const halfBracket = EXTERNAL_IDENTIFIER_IMPORTED_BRACKET_LENGTH / 2;
  const bracketStart = {
    x: junction.x - markerNormal.x * halfBracket,
    y: junction.y - markerNormal.y * halfBracket,
  };
  const bracketEnd = {
    x: junction.x + markerNormal.x * halfBracket,
    y: junction.y + markerNormal.y * halfBracket,
  };

  return {
    marker,
    pathPoints: [junction, marker],
    markerStemStart: junction,
    bracketStart,
    bracketEnd,
    junction,
  };
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

export function getCompositeInternalIdentifierFrame(
  hostBounds: Bounds,
  laneIndex = 0,
): RouteFrame {
  const padding = getExternalIdentifierFramePadding(laneIndex);

  return {
    left: hostBounds.x - padding,
    top: hostBounds.y - padding,
    right: hostBounds.x + hostBounds.width + padding,
    bottom: hostBounds.y + hostBounds.height + padding,
    centerX: hostBounds.x + hostBounds.width / 2,
    centerY: hostBounds.y + hostBounds.height / 2,
  };
}

export function getCompositeInternalIdentifierFramePoint(
  frame: RouteFrame,
  side: FrameSide,
  reference: Point,
): Point {
  return getFrameSidePoint(frame, side, reference);
}

export function projectCompositeInternalMarkerToFrame(
  frame: RouteFrame,
  marker: CompositeIdentifierMemberMarker,
): ExternalIdentifierFrameProjection {
  return projectExternalIdentifierMarkerToFrame(frame, {
    kind: "localAttribute",
    marker: marker.marker,
  });
}

export function buildCompositeInternalIdentifierRoutePoints(
  hostBounds: Bounds,
  hostCenter: Point,
  members: CompositeIdentifierMember[],
  laneIndex = 0,
): {
  frame: RouteFrame;
  memberMarkers: CompositeIdentifierMemberMarker[];
  pathPoints: Point[];
} {
  const frame = getCompositeInternalIdentifierFrame(hostBounds, laneIndex);
  const memberMarkers = members
    .map((member) => {
      const outwardHint = {
        x: member.attributeCenter.x - hostCenter.x,
        y: member.attributeCenter.y - hostCenter.y,
      };
      const side = resolveFrameSide(hostBounds, member.hostAnchor, outwardHint);
      const projection = computeVisibleJunctionPoint(
        frame,
        side,
        member.hostAnchor,
        member.attributeCenter,
      );

      return {
        attributeId: member.attributeId,
        marker: projection,
        projection,
        side,
      };
    })
    .sort((left, right) => left.attributeId.localeCompare(right.attributeId));
  const projections = memberMarkers.map((marker) => projectCompositeInternalMarkerToFrame(frame, marker));
  const perimeterPoints = buildExternalIdentifierGroupingRoutePointsFromProjections(frame, projections);

  return {
    frame,
    memberMarkers,
    pathPoints: extendOpenRouteEndpoints(perimeterPoints),
  };
}

export function buildCompositeInternalIdentifierFrameLayout(
  hostBounds: Bounds,
  hostCenter: Point,
  members: CompositeIdentifierMember[],
  laneIndex = 0,
): {
  frame: RouteFrame;
  memberMarkers: CompositeIdentifierMemberMarker[];
  pathPoints: Point[];
  pathData: string;
  terminalMarker?: Point;
} {
  const routeLayout = buildCompositeInternalIdentifierRoutePoints(
    hostBounds,
    hostCenter,
    members,
    laneIndex,
  );
  const pathData = pathFromPoints(routeLayout.pathPoints);

  return {
    ...routeLayout,
    pathData,
    terminalMarker: routeLayout.pathPoints.length >= 2 ? routeLayout.pathPoints[0] : undefined,
  };
}

export function buildCompositeInternalIdentifierPath(
  hostBounds: Bounds,
  hostCenter: Point,
  members: CompositeIdentifierMember[],
  laneIndex = 0,
): string {
  return buildCompositeInternalIdentifierFrameLayout(
    hostBounds,
    hostCenter,
    members,
    laneIndex,
  ).pathData;
}

export function buildCompositeIdentifierLayout(
  groupKey: string,
  hostEntityId: string,
  hostBounds: Bounds,
  hostCenter: Point,
  members: CompositeIdentifierMember[],
  laneIndex = 0,
): CompositeIdentifierLayout | null {
  if (members.length < 2) {
    return null;
  }

  const frameLayout = buildCompositeInternalIdentifierFrameLayout(
    hostBounds,
    hostCenter,
    members,
    laneIndex,
  );
  if (frameLayout.pathData.length === 0) {
    return null;
  }

  return {
    groupKey,
    hostEntityId,
    memberAttributeIds: members.map((member) => member.attributeId),
    laneIndex,
    frame: frameLayout.frame,
    pathData: frameLayout.pathData,
    hitPathData: frameLayout.pathData,
    pathPoints: frameLayout.pathPoints,
    memberMarkers: frameLayout.memberMarkers,
    junctions: frameLayout.memberMarkers.map((marker) => marker.projection),
    terminalMarker: frameLayout.terminalMarker,
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

function distance(from: Point, to: Point): number {
  return Math.hypot(to.x - from.x, to.y - from.y);
}

function pointFromEndpointAlongPolyline(
  points: Point[],
  fromStart: boolean,
  labelPoint?: Point,
  preferredDistance = 18,
): Point | null {
  if (points.length < 2) {
    return null;
  }

  const endpoint = fromStart ? points[0] : points[points.length - 1];
  const adjacent = fromStart ? points[1] : points[points.length - 2];
  const segmentLength = distance(endpoint, adjacent);
  if (segmentLength <= 0.001) {
    return endpoint;
  }

  const unit = {
    x: (adjacent.x - endpoint.x) / segmentLength,
    y: (adjacent.y - endpoint.y) / segmentLength,
  };
  const maxDistance = Math.max(6, segmentLength - 6);
  const primaryDistance = Math.min(preferredDistance, maxDistance);
  const primaryPoint = {
    x: endpoint.x + unit.x * primaryDistance,
    y: endpoint.y + unit.y * primaryDistance,
  };
  if (!labelPoint || distanceSquared(primaryPoint, labelPoint) >= 24 * 24) {
    return primaryPoint;
  }

  const fallbackDistance = Math.min(Math.max(8, preferredDistance - 8), maxDistance);
  return {
    x: endpoint.x + unit.x * fallbackDistance,
    y: endpoint.y + unit.y * fallbackDistance,
  };
}

function getExternalIdentifierFramePadding(laneIndex = 0): number {
  return EXTERNAL_IDENTIFIER_ENTITY_FRAME_OFFSET + Math.max(0, laneIndex) * EXTERNAL_IDENTIFIER_FRAME_LANE_GAP;
}

function getExternalIdentifierFrameNode(
  entity: Extract<DiagramNode, { type: "entity" }>,
  laneIndex = 0,
): Extract<DiagramNode, { type: "entity" }> {
  const padding = getExternalIdentifierFramePadding(laneIndex);

  return {
    ...entity,
    x: entity.x - padding,
    y: entity.y - padding,
    width: entity.width + padding * 2,
    height: entity.height + padding * 2,
  };
}

function getExternalIdentifierFramePoint(
  entity: Extract<DiagramNode, { type: "entity" }>,
  toward: Point,
  laneIndex = 0,
): Point {
  return clipPointToNodePerimeter(getExternalIdentifierFrameNode(entity, laneIndex), toward);
}

function renderExternalIdentifierFrame(layout: ExternalIdentifierFrameLayout) {
  return (
    <g
      key={`external-id-frame-${layout.key}`}
      className="external-identifier-frame"
      pointerEvents="none"
    >
      <path
        className="external-identifier-entity-frame"
        d={layout.pathData}
        fill="none"
        stroke={DIAGRAM_STROKE}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
      {layout.terminalMarker ? (
        <circle
          className="external-identifier-terminal-marker"
          cx={layout.terminalMarker.x}
          cy={layout.terminalMarker.y}
          r={EXTERNAL_IDENTIFIER_TERMINAL_MARKER_RADIUS}
          fill={DIAGRAM_STROKE}
          stroke={DIAGRAM_STROKE}
          strokeWidth={2}
          pointerEvents="none"
        />
      ) : null}
    </g>
  );
}

function renderExternalIdentifierMarker(layout: ExternalIdentifierMarkerLayout) {
  return (
    <circle
      key={`external-id-marker-${layout.key}`}
      className={`external-identifier-marker external-identifier-marker-${layout.kind}`}
      cx={layout.marker.x}
      cy={layout.marker.y}
      r={5.4}
      fill={DIAGRAM_STROKE}
      stroke={DIAGRAM_STROKE}
      strokeWidth={1.2}
      pointerEvents={layout.tooltip ? "visiblePainted" : "none"}
    >
      {layout.tooltip ? <title>{layout.tooltip}</title> : null}
    </circle>
  );
}

export function DiagramIdentifierOverlay(props: { diagram: DiagramDocument }) {
  const nodeMap = new Map(props.diagram.nodes.map((node) => [node.id, node]));
  const connectorLaneMap = new Map<string, { laneIndex: number; laneCount: number }>();
  const connectorGroups = new Map<string, string[]>();
  const compositeAttributeIds = new Set<string>();
  const externalIdentifierFrameLayouts: ExternalIdentifierFrameLayout[] = [];
  const externalIdentifierMarkerLayouts: ExternalIdentifierMarkerLayout[] = [];

  props.diagram.edges.forEach((edge) => {
    if (edge.type !== "attribute") {
      return;
    }

    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    if (sourceNode?.type !== "attribute" || targetNode?.type !== "attribute") {
      return;
    }

    const hostNode =
      sourceNode.isMultivalued === true && targetNode.isMultivalued !== true
        ? sourceNode
        : targetNode.isMultivalued === true && sourceNode.isMultivalued !== true
          ? targetNode
          : targetNode;
    compositeAttributeIds.add(hostNode.id);
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

  props.diagram.nodes.forEach((node) => {
    if (node.type !== "entity" || (node.externalIdentifiers ?? []).length === 0) {
      return;
    }

    const importedRelationshipIds = getExternalIdentifierImportedRelationshipIds(node);
    const localAttributeIds = getExternalIdentifierLocalAttributeIds(node);
    const sortedExternalIdentifiers = [...(node.externalIdentifiers ?? [])].sort((left, right) =>
      buildExternalIdentifierSortKey(left).localeCompare(buildExternalIdentifierSortKey(right), "it", {
        sensitivity: "base",
      }),
    );

    sortedExternalIdentifiers.forEach((identifier, laneIndex) => {
      const identifierMarkerLayouts: ExternalIdentifierMarkerLayout[] = [];

      identifier.importedParts.forEach((part) => {
        if (!importedRelationshipIds.has(part.relationshipId)) {
          return;
        }

        const connectorEdge = props.diagram.edges.find(
          (edge) =>
            edge.type === "connector" &&
            ((edge.sourceId === node.id && edge.targetId === part.relationshipId) ||
              (edge.targetId === node.id && edge.sourceId === part.relationshipId)),
        );
        if (!connectorEdge) {
          return;
        }

        const relationshipNode = nodeMap.get(part.relationshipId);
        if (relationshipNode?.type !== "relationship") {
          return;
        }

        const sourceEntity = nodeMap.get(part.sourceEntityId);
        const sourceAttributeLabel = getExternalIdentifierImportedPartAttributes(props.diagram, part)
          .map((attribute) => attribute.label)
          .join(" + ");
        const sourceNode = nodeMap.get(connectorEdge.sourceId);
        const targetNode = nodeMap.get(connectorEdge.targetId);
        if (!sourceNode || !targetNode) {
          return;
        }

        const geometry = getEdgeGeometry(
          connectorEdge,
          sourceNode,
          targetNode,
          connectorLaneMap.get(connectorEdge.id),
          compositeAttributeIds,
        );
        if (geometry.points.length < 2) {
          return;
        }

        const entityIsSource = connectorEdge.sourceId === node.id;
        const entityEndpoint = entityIsSource ? geometry.points[0] : geometry.points[geometry.points.length - 1];
        const adjacentPoint = entityIsSource ? geometry.points[1] : geometry.points[geometry.points.length - 2];
        const marker = getExternalIdentifierFramePoint(node, adjacentPoint, laneIndex);
        const tooltip =
          sourceEntity?.type === "entity" && sourceAttributeLabel.length > 0
            ? `Importa ${sourceAttributeLabel} da ${sourceEntity.label}`
            : undefined;

        identifierMarkerLayouts.push({
          key: `${identifier.id}-relationship-${part.relationshipId}`,
          hostEntityId: node.id,
          externalIdentifierId: identifier.id,
          kind: "importedRelationship",
          marker,
          entityEndpoint,
          tooltip,
        });
      });

      identifier.localAttributeIds.forEach((attributeId) => {
        if (!localAttributeIds.has(attributeId)) {
          return;
        }

        const attributeEdge = props.diagram.edges.find(
          (edge) =>
            edge.type === "attribute" &&
            ((edge.sourceId === node.id && edge.targetId === attributeId) ||
              (edge.targetId === node.id && edge.sourceId === attributeId)),
        );
        if (!attributeEdge) {
          return;
        }

        const sourceNode = nodeMap.get(attributeEdge.sourceId);
        const targetNode = nodeMap.get(attributeEdge.targetId);
        if (!sourceNode || !targetNode) {
          return;
        }

        const geometry = getEdgeGeometry(attributeEdge, sourceNode, targetNode, undefined, compositeAttributeIds);
        if (geometry.points.length < 2) {
          return;
        }

        const entityIsSource = attributeEdge.sourceId === node.id;
        const entityEndpoint = entityIsSource ? geometry.points[0] : geometry.points[geometry.points.length - 1];
        const adjacentPoint = entityIsSource ? geometry.points[1] : geometry.points[geometry.points.length - 2];
        const marker = getExternalIdentifierFramePoint(node, adjacentPoint, laneIndex);

        identifierMarkerLayouts.push({
          key: `${identifier.id}-attribute-${attributeId}`,
          hostEntityId: node.id,
          externalIdentifierId: identifier.id,
          kind: "localAttribute",
          marker,
          entityEndpoint,
        });
      });

      const frameLayout = buildExternalIdentifierGroupingFrameLayout(node, identifierMarkerLayouts, laneIndex);
      if (frameLayout.pathData.length > 0) {
        externalIdentifierFrameLayouts.push({
          key: `${node.id}-${identifier.id}`,
          hostEntityId: node.id,
          externalIdentifierId: identifier.id,
          pathData: frameLayout.pathData,
          terminalMarker: frameLayout.terminalMarker,
        });
      }
      externalIdentifierMarkerLayouts.push(...identifierMarkerLayouts);
    });
  });

  return (
    <g className="diagram-identifier-overlay" pointerEvents="none">
      {externalIdentifierFrameLayouts.map(renderExternalIdentifierFrame)}
      {externalIdentifierMarkerLayouts.map(renderExternalIdentifierMarker)}
    </g>
  );
}

export function getStableLocalIdentifierMarkerPoint(
  hostEntity: Extract<DiagramNode, { type: "entity" }>,
  attributeNode: Extract<DiagramNode, { type: "attribute" }>,
  offset = EXTERNAL_IDENTIFIER_LOCAL_MARKER_OFFSET,
): Point {
  const hostCenter = getNodeCenter(hostEntity);
  const attributeCenter = getNodeCenter(attributeNode);
  const direction = normalizeVector(
    {
      x: attributeCenter.x - hostCenter.x,
      y: attributeCenter.y - hostCenter.y,
    },
    { x: 1, y: 0 },
  );
  const anchor = getNodeAnchor(hostEntity, attributeCenter, "attribute", "source");

  return {
    x: anchor.x + direction.x * offset,
    y: anchor.y + direction.y * offset,
  };
}

function getFramePerimeterLength(frame: RouteFrame): number {
  return Math.max(0, (frame.right - frame.left + frame.bottom - frame.top) * 2);
}

function getFramePerimeterPosition(frame: RouteFrame, side: FrameSide, point: Point): number {
  const width = frame.right - frame.left;
  const height = frame.bottom - frame.top;
  if (side === "top") {
    return clampNumber(point.x, frame.left, frame.right) - frame.left;
  }
  if (side === "right") {
    return width + clampNumber(point.y, frame.top, frame.bottom) - frame.top;
  }
  if (side === "bottom") {
    return width + height + frame.right - clampNumber(point.x, frame.left, frame.right);
  }

  return width + height + width + frame.bottom - clampNumber(point.y, frame.top, frame.bottom);
}

function projectExternalIdentifierMarkerToFrame(
  frame: RouteFrame,
  groupingMarker: ExternalIdentifierGroupingMarker,
): ExternalIdentifierFrameProjection {
  const { marker } = groupingMarker;
  const candidates: Array<{ side: FrameSide; distance: number }> = [
    { side: "left", distance: Math.abs(marker.x - frame.left) },
    { side: "right", distance: Math.abs(marker.x - frame.right) },
    { side: "top", distance: Math.abs(marker.y - frame.top) },
    { side: "bottom", distance: Math.abs(marker.y - frame.bottom) },
  ];
  const nearest = candidates.reduce((best, candidate) =>
    candidate.distance < best.distance ? candidate : best,
  );
  const projection = getFrameSidePoint(frame, nearest.side, marker);

  return {
    ...groupingMarker,
    marker,
    projection,
    side: nearest.side,
    position: getFramePerimeterPosition(frame, nearest.side, projection),
  };
}

function appendUniquePoint(points: Point[], point: Point): void {
  const previous = points[points.length - 1];
  if (previous && distanceSquared(previous, point) <= 0.25) {
    return;
  }

  points.push(point);
}

function orderExternalIdentifierFrameProjections(
  frame: RouteFrame,
  projections: ExternalIdentifierFrameProjection[],
): ExternalIdentifierFrameProjection[] {
  if (projections.length <= 2) {
    return [...projections].sort((left, right) => left.position - right.position);
  }

  const perimeterLength = getFramePerimeterLength(frame);
  const sorted = [...projections].sort((left, right) => left.position - right.position);
  let largestGapIndex = 0;
  let largestGap = -1;

  sorted.forEach((projection, index) => {
    const next = sorted[(index + 1) % sorted.length];
    const gap =
      index === sorted.length - 1
        ? next.position + perimeterLength - projection.position
        : next.position - projection.position;
    if (gap > largestGap) {
      largestGap = gap;
      largestGapIndex = index;
    }
  });

  return [
    ...sorted.slice(largestGapIndex + 1),
    ...sorted.slice(0, largestGapIndex + 1),
  ];
}

function buildExternalIdentifierMarkerConnectorPath(projection: ExternalIdentifierFrameProjection): string {
  if (distanceSquared(projection.marker, projection.projection) <= 2.25) {
    return "";
  }

  if (projection.kind !== "localAttribute") {
    return `M ${projection.marker.x.toFixed(1)} ${projection.marker.y.toFixed(1)} L ${projection.projection.x.toFixed(1)} ${projection.projection.y.toFixed(1)}`;
  }

  const normal = getFrameSideNormal(projection.side);
  const tangent = getFrameSideTangent(projection.side);
  const markerDirection = normalizeVector(
    {
      x: projection.marker.x - projection.projection.x,
      y: projection.marker.y - projection.projection.y,
    },
    normal,
  );
  const tangentSign =
    projection.side === "left" || projection.side === "right"
      ? projection.marker.y >= projection.projection.y
        ? 1
        : -1
      : projection.marker.x >= projection.projection.x
        ? 1
        : -1;
  const curve = Math.min(EXTERNAL_IDENTIFIER_LOCAL_MARKER_CURVE, distance(projection.projection, projection.marker) * 0.65);
  const firstControl = {
    x: projection.projection.x + tangent.x * tangentSign * curve,
    y: projection.projection.y + tangent.y * tangentSign * curve,
  };
  const secondControl = {
    x: projection.marker.x - markerDirection.x * Math.min(8, curve * 0.5),
    y: projection.marker.y - markerDirection.y * Math.min(8, curve * 0.5),
  };

  return [
    `M ${projection.projection.x.toFixed(1)} ${projection.projection.y.toFixed(1)}`,
    `C ${firstControl.x.toFixed(1)} ${firstControl.y.toFixed(1)}`,
    `${secondControl.x.toFixed(1)} ${secondControl.y.toFixed(1)}`,
    `${projection.marker.x.toFixed(1)} ${projection.marker.y.toFixed(1)}`,
  ].join(" ");
}

function getExternalIdentifierGroupingFrame(
  hostEntity: Extract<DiagramNode, { type: "entity" }>,
  laneIndex = 0,
): RouteFrame {
  const hostBounds = getNodeBounds(hostEntity);
  const padding = getExternalIdentifierFramePadding(laneIndex);

  return {
    left: hostBounds.x - padding,
    top: hostBounds.y - padding,
    right: hostBounds.x + hostBounds.width + padding,
    bottom: hostBounds.y + hostBounds.height + padding,
    centerX: hostBounds.x + hostBounds.width / 2,
    centerY: hostBounds.y + hostBounds.height / 2,
  };
}

function dedupeExternalIdentifierFrameProjections(
  projections: ExternalIdentifierFrameProjection[],
): ExternalIdentifierFrameProjection[] {
  const deduped: ExternalIdentifierFrameProjection[] = [];

  projections
    .sort((left, right) => left.position - right.position)
    .forEach((projection) => {
      if (
        deduped.some(
          (entry) =>
            entry.side === projection.side &&
            distanceSquared(entry.projection, projection.projection) <= 0.25,
        )
      ) {
        return;
      }

      deduped.push(projection);
    });

  return deduped;
}

function buildSingleProjectionFrameSegment(frame: RouteFrame, projection: ExternalIdentifierFrameProjection): Point[] {
  const halfLength = EXTERNAL_IDENTIFIER_IMPORTED_BRACKET_LENGTH / 2;

  if (projection.side === "left" || projection.side === "right") {
    return [
      {
        x: projection.projection.x,
        y: clampNumber(projection.projection.y - halfLength, frame.top, frame.bottom),
      },
      {
        x: projection.projection.x,
        y: clampNumber(projection.projection.y + halfLength, frame.top, frame.bottom),
      },
    ];
  }

  return [
    {
      x: clampNumber(projection.projection.x - halfLength, frame.left, frame.right),
      y: projection.projection.y,
    },
    {
      x: clampNumber(projection.projection.x + halfLength, frame.left, frame.right),
      y: projection.projection.y,
    },
  ];
}

function buildExternalIdentifierGroupingRoutePointsFromProjections(
  frame: RouteFrame,
  projections: ExternalIdentifierFrameProjection[],
): Point[] {
  const uniqueProjections = dedupeExternalIdentifierFrameProjections(projections);
  if (uniqueProjections.length === 0) {
    return [];
  }
  if (uniqueProjections.length === 1) {
    return buildSingleProjectionFrameSegment(frame, uniqueProjections[0]);
  }
  if (uniqueProjections.length === 2) {
    const [start, end] = orderExternalIdentifierFrameProjections(frame, uniqueProjections);
    const route = selectFrameRoute(
      frame,
      start.side,
      start.projection,
      end.side,
      end.projection,
    );
    const points: Point[] = [];
    route.forEach((point) => appendUniquePoint(points, point));
    return points;
  }

  return selectExternalIdentifierGroupingRoute(frame, uniqueProjections);
}

export function buildExternalIdentifierGroupingRoutePoints(
  hostEntity: Extract<DiagramNode, { type: "entity" }>,
  markers: ExternalIdentifierGroupingMarker[],
  laneIndex = 0,
): Point[] {
  const frame = getExternalIdentifierGroupingFrame(hostEntity, laneIndex);
  const projections = markers.map((marker) => projectExternalIdentifierMarkerToFrame(frame, marker));

  return buildExternalIdentifierGroupingRoutePointsFromProjections(frame, projections);
}

export function extendOpenRouteEndpoints(
  points: Point[],
  extension = EXTERNAL_IDENTIFIER_ROUTE_TERMINAL_EXTENSION,
): Point[] {
  if (points.length < 2 || extension <= 0) {
    return points;
  }

  const first = points[0];
  const second = points[1];
  const last = points[points.length - 1];
  const previous = points[points.length - 2];
  const startDirection = normalizeVector(
    { x: first.x - second.x, y: first.y - second.y },
    { x: 0, y: -1 },
  );
  const endDirection = normalizeVector(
    { x: last.x - previous.x, y: last.y - previous.y },
    { x: 1, y: 0 },
  );

  return [
    {
      x: first.x + startDirection.x * extension,
      y: first.y + startDirection.y * extension,
    },
    ...points.slice(1, -1),
    {
      x: last.x + endDirection.x * extension,
      y: last.y + endDirection.y * extension,
    },
  ];
}

export function buildExternalIdentifierGroupingFrameLayout(
  hostEntity: Extract<DiagramNode, { type: "entity" }>,
  markers: ExternalIdentifierGroupingMarker[],
  laneIndex = 0,
): { pathData: string; terminalMarker?: Point } {
  if (markers.length === 0) {
    return { pathData: "" };
  }

  const frame = getExternalIdentifierGroupingFrame(hostEntity, laneIndex);
  const projections = markers.map((marker) => projectExternalIdentifierMarkerToFrame(frame, marker));
  const perimeterPoints = buildExternalIdentifierGroupingRoutePointsFromProjections(frame, projections);
  const extendedPerimeterPoints = extendOpenRouteEndpoints(perimeterPoints);
  const pathParts = [pathFromPoints(extendedPerimeterPoints)];
  projections.forEach((projection) => {
    const connectorPath = buildExternalIdentifierMarkerConnectorPath(projection);
    if (connectorPath.length > 0) {
      pathParts.push(connectorPath);
    }
  });

  return {
    pathData: pathParts.filter((part) => part.length > 0).join(" "),
    terminalMarker: extendedPerimeterPoints.length >= 2 ? extendedPerimeterPoints[0] : undefined,
  };
}

export function buildExternalIdentifierGroupingPath(
  hostEntity: Extract<DiagramNode, { type: "entity" }>,
  markers: ExternalIdentifierGroupingMarker[],
  laneIndex = 0,
): string {
  return buildExternalIdentifierGroupingFrameLayout(hostEntity, markers, laneIndex).pathData;
}

function buildExternalIdentifierSortKey(identifier: ExternalIdentifier): string {
  const importedPartKey = identifier.importedParts
    .map((part) => [part.relationshipId, part.sourceEntityId, part.importedIdentifierId].join(":"))
    .sort()
    .join("|");
  const localAttributeKey = [...identifier.localAttributeIds].sort().join("|");

  return [importedPartKey, localAttributeKey, identifier.id].join("||");
}

export function DiagramCanvas(props: DiagramCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef<Map<number, ActivePointer>>(new Map());
  const pinchStateRef = useRef<PinchState | null>(null);
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
  const readOnly = props.readOnly === true;

  const nodeMap = new Map(props.diagram.nodes.map((node) => [node.id, node]));
  const nodeIssueMap = new Map<string, { level: ValidationIssue["level"]; count: number }>();
  const edgeIssueMap = new Map<string, { level: ValidationIssue["level"]; count: number }>();
  const connectorLaneMap = new Map<string, { laneIndex: number; laneCount: number }>();
  const connectorGroups = new Map<string, string[]>();
  const attributeDirectionMap = new Map<string, Point>();
  const compositeAttributeIds = new Set<string>();
  const compositeGroups = new Map<string, { host: Extract<DiagramNode, { type: "entity" }>; members: CompositeIdentifierMember[] }>();
  const compositeGroupKeyByAttributeId = new Map<string, string>();
  const compositeGroupMemberIdsByGroupKey = new Map<string, string[]>();
  const compositeIdentifierLayouts: CompositeIdentifierLayout[] = [];
  const externalIdentifierLayouts: ExternalIdentifierLayout[] = [];
  const externalIdentifierFrameLayouts: ExternalIdentifierFrameLayout[] = [];
  const externalIdentifierMarkerLayouts: ExternalIdentifierMarkerLayout[] = [];
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
    if (edge.type !== "attribute") {
      return;
    }

    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    if (sourceNode?.type !== "attribute" || targetNode?.type !== "attribute") {
      return;
    }

    const hostNode =
      sourceNode.isMultivalued === true && targetNode.isMultivalued !== true
        ? sourceNode
        : targetNode.isMultivalued === true && sourceNode.isMultivalued !== true
          ? targetNode
          : targetNode;
    compositeAttributeIds.add(hostNode.id);
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

    const geometry = getEdgeGeometry(edge, sourceNode, targetNode, connectorLaneMap.get(edge.id), compositeAttributeIds);
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

    const attributeNode =
      sourceNode.type === "attribute" && targetNode.type === "attribute"
        ? compositeAttributeIds.has(sourceNode.id) && !compositeAttributeIds.has(targetNode.id)
          ? targetNode
          : sourceNode
        : sourceNode.type === "attribute"
          ? sourceNode
          : targetNode.type === "attribute"
            ? targetNode
            : null;
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

  const compositeLaneIndexByHostId = new Map<string, number>();
  [...compositeGroups.entries()]
    .sort((left, right) => {
      const hostComparison = left[1].host.id.localeCompare(right[1].host.id);
      return hostComparison !== 0 ? hostComparison : left[0].localeCompare(right[0]);
    })
    .forEach(([groupKey, group]) => {
      if (group.members.length < 2) {
        return;
      }

      const hostBounds = getNodeBounds(group.host);
      const hostCenter = getNodeCenter(group.host);
      const laneIndex = compositeLaneIndexByHostId.get(group.host.id) ?? 0;
      compositeLaneIndexByHostId.set(group.host.id, laneIndex + 1);
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
        laneIndex,
      );

      if (layout) {
        compositeIdentifierLayouts.push(layout);
      }
    });

  props.diagram.nodes.forEach((node) => {
    if (node.type !== "entity" || (node.externalIdentifiers ?? []).length === 0) {
      return;
    }

    const importedRelationshipIds = getExternalIdentifierImportedRelationshipIds(node);
    const localAttributeIds = getExternalIdentifierLocalAttributeIds(node);

    const sortedExternalIdentifiers = [...(node.externalIdentifiers ?? [])].sort((left, right) =>
      buildExternalIdentifierSortKey(left).localeCompare(buildExternalIdentifierSortKey(right), "it", {
        sensitivity: "base",
      }),
    );

    sortedExternalIdentifiers.forEach((identifier, laneIndex) => {
      const identifierMarkerLayouts: ExternalIdentifierMarkerLayout[] = [];
      // externalIdentifiers is a model-level key definition: render importedParts as dots where
      // relationship connectors hit the outer frame, and localAttributeIds as dots where local
      // attribute links hit the same frame. This is intentionally presentation-only.
      identifier.importedParts.forEach((part) => {
        if (!importedRelationshipIds.has(part.relationshipId)) {
          return;
        }

        const connectorEdge = props.diagram.edges.find(
          (edge) =>
            edge.type === "connector" &&
            ((edge.sourceId === node.id && edge.targetId === part.relationshipId) ||
              (edge.targetId === node.id && edge.sourceId === part.relationshipId)),
        );
        if (!connectorEdge) {
          return;
        }

        const relationshipNode = nodeMap.get(part.relationshipId);
        if (relationshipNode?.type !== "relationship") {
          return;
        }
        const sourceEntity = nodeMap.get(part.sourceEntityId);
        const sourceAttributeLabel = getExternalIdentifierImportedPartAttributes(props.diagram, part)
          .map((attribute) => attribute.label)
          .join(" + ");

        const geometry = getEdgeGeometry(
          connectorEdge,
          nodeMap.get(connectorEdge.sourceId) as DiagramNode,
          nodeMap.get(connectorEdge.targetId) as DiagramNode,
          connectorLaneMap.get(connectorEdge.id),
          compositeAttributeIds,
        );
        if (geometry.points.length < 2) {
          return;
        }
        const entityIsSource = connectorEdge.sourceId === node.id;
        const entityEndpoint = entityIsSource ? geometry.points[0] : geometry.points[geometry.points.length - 1];
        const adjacentPoint = entityIsSource ? geometry.points[1] : geometry.points[geometry.points.length - 2];
        const marker = getExternalIdentifierFramePoint(node, adjacentPoint, laneIndex);
        const tooltip =
          sourceEntity?.type === "entity" && sourceAttributeLabel.length > 0
            ? `Importa ${sourceAttributeLabel} da ${sourceEntity.label}`
            : undefined;

        identifierMarkerLayouts.push({
          key: `${identifier.id}-relationship-${part.relationshipId}`,
          hostEntityId: node.id,
          externalIdentifierId: identifier.id,
          kind: "importedRelationship",
          marker,
          entityEndpoint,
          tooltip,
        });
      });

      identifier.localAttributeIds.forEach((attributeId) => {
        if (!localAttributeIds.has(attributeId)) {
          return;
        }

        const attributeEdge = props.diagram.edges.find(
          (edge) =>
            edge.type === "attribute" &&
            ((edge.sourceId === node.id && edge.targetId === attributeId) ||
              (edge.targetId === node.id && edge.sourceId === attributeId)),
        );
        if (!attributeEdge) {
          return;
        }

        const attributeNode = nodeMap.get(attributeId);
        if (attributeNode?.type !== "attribute") {
          return;
        }

        const geometry = getEdgeGeometry(
          attributeEdge,
          nodeMap.get(attributeEdge.sourceId) as DiagramNode,
          nodeMap.get(attributeEdge.targetId) as DiagramNode,
          undefined,
          compositeAttributeIds,
        );
        if (geometry.points.length < 2) {
          return;
        }
        const entityIsSource = attributeEdge.sourceId === node.id;
        const entityEndpoint = entityIsSource ? geometry.points[0] : geometry.points[geometry.points.length - 1];
        const adjacentPoint = entityIsSource ? geometry.points[1] : geometry.points[geometry.points.length - 2];
        const marker = getExternalIdentifierFramePoint(node, adjacentPoint, laneIndex);

        identifierMarkerLayouts.push({
          key: `${identifier.id}-attribute-${attributeId}`,
          hostEntityId: node.id,
          externalIdentifierId: identifier.id,
          kind: "localAttribute",
          marker,
          entityEndpoint,
        });
      });

      const frameLayout = buildExternalIdentifierGroupingFrameLayout(node, identifierMarkerLayouts, laneIndex);
      if (frameLayout.pathData.length > 0) {
        externalIdentifierFrameLayouts.push({
          key: `${node.id}-${identifier.id}`,
          hostEntityId: node.id,
          externalIdentifierId: identifier.id,
          pathData: frameLayout.pathData,
          terminalMarker: frameLayout.terminalMarker,
        });
      }
      externalIdentifierMarkerLayouts.push(...identifierMarkerLayouts);
    });
  });

  const reservedLabelBoxes: ReservedLabelBox[] = [];
  props.diagram.nodes.forEach((node) => {
    reservedLabelBoxes.push(...buildNodeReservedBounds(node));

    if (node.type !== "attribute" || node.isMultivalued === true) {
      return;
    }

    reservedLabelBoxes.push({
      id: `${node.id}:label`,
      kind: "attribute-label",
      ...buildAttributeLabelBounds(
        node.label,
        getAttributeLabelLayout(node, attributeDirectionMap.get(node.id)),
      ),
    });
  });

  externalIdentifierMarkerLayouts.forEach((layout) => {
    reservedLabelBoxes.push({
      id: layout.key,
      kind: "external-identifier",
      x: layout.marker.x - 10,
      y: layout.marker.y - 10,
      width: 20,
      height: 20,
    });
  });

  const edgeLabelLayoutOverrides = new Map<string, EdgeLabelLayoutOverride>();
  const alreadyPlacedEdgeLabelBoxes: ReservedLabelBox[] = [];
  const edgeOrder = new Map<EdgeKind, number>([
    ["connector", 0],
    ["attribute", 1],
    ["inheritance", 2],
  ]);

  [...props.diagram.edges]
    .sort((left, right) => {
      const kindDelta = (edgeOrder.get(left.type) ?? 99) - (edgeOrder.get(right.type) ?? 99);
      if (kindDelta !== 0) {
        return kindDelta;
      }

      return left.id.localeCompare(right.id);
    })
    .forEach((edge) => {
      if (edge.type !== "connector" && edge.type !== "attribute") {
        return;
      }

      const sourceNode = nodeMap.get(edge.sourceId);
      const targetNode = nodeMap.get(edge.targetId);
      const points = edgeGeometryMap.get(edge.id);
      if (!sourceNode || !targetNode || !points || points.length < 2) {
        return;
      }

      const displayLabel = getEdgeCardinalityLabel(edge, sourceNode, targetNode);
      if (!displayLabel) {
        return;
      }

      const roleLabel =
        edge.type === "connector"
          ? getConnectorParticipation(edge, sourceNode, targetNode)?.role?.trim() ?? ""
          : "";
      const entityIsSource = edge.type === "connector" && sourceNode.type === "entity";
      const usesSplitConnectorLabels =
        edge.type === "connector" && ((connectorLaneMap.get(edge.id)?.laneCount ?? 1) > 1 || roleLabel.length > 0);
      const geometryLabelPoint = getEdgeGeometry(edge, sourceNode, targetNode, connectorLaneMap.get(edge.id), compositeAttributeIds).labelPoint;
      const fallbackDisplayLabelPoint = usesSplitConnectorLabels
        ? getPointAlongPolyline(points, entityIsSource ? 0.38 : 0.62)
        : {
            x: geometryLabelPoint.x,
            y: geometryLabelPoint.y - 6,
          };
      const anchor = getCardinalityLabelAnchorPoint({
        edge,
        sourceNode,
        targetNode,
        points,
        fallbackPoint: fallbackDisplayLabelPoint,
      });
      const roleLabelPoint =
        roleLabel.length > 0 ? getPointAlongPolyline(points, entityIsSource ? 0.68 : 0.32) : null;
      const roleLabelBoxes: ReservedLabelBox[] =
        roleLabelPoint
          ? [
              {
                id: `${edge.id}:role-label`,
                kind: "edge-label",
                ...buildEdgeLabelBounds(
                  roleLabelPoint,
                  roleLabelPoint.y,
                  roleLabel.length * 7 + 10,
                ),
              },
            ]
          : [];
      const placement = chooseCollisionFreeCardinalityLabelPlacement({
        edge,
        sourceNode,
        targetNode,
        points,
        defaultPoint: anchor.point,
        label: displayLabel,
        reservedBoxes: reservedLabelBoxes,
        alreadyPlacedBoxes: [...alreadyPlacedEdgeLabelBoxes, ...roleLabelBoxes],
      });

      edgeLabelLayoutOverrides.set(edge.id, {
        displayLabelPoint: placement.point,
        displayLabelY: placement.y,
      });
      alreadyPlacedEdgeLabelBoxes.push({
        id: edge.id,
        kind: "edge-label",
        ...placement.bounds,
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
      return;
    }

    if (focusedTarget.kind === "externalIdentifier") {
      const hostEntity = props.diagram.nodes.find(
        (node) => node.id === focusedTarget.hostEntityId && node.type === "entity",
      );
      if (
        !hostEntity ||
        hostEntity.type !== "entity" ||
        !(hostEntity.externalIdentifiers ?? []).some(
          (identifier) => identifier.id === focusedTarget.externalIdentifierId,
        )
      ) {
        setFocusedTarget(null);
      }
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

  function getPointerCenter(first: ActivePointer, second: ActivePointer, rect: DOMRect): Point {
    return {
      x: (first.clientX + second.clientX) / 2 - rect.left,
      y: (first.clientY + second.clientY) / 2 - rect.top,
    };
  }

  function getPointerDistance(first: ActivePointer, second: ActivePointer): number {
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }

  function startPinchInteraction() {
    const touchPointers = Array.from(activePointersRef.current.values()).filter(
      (pointer) => pointer.pointerType === "touch",
    );
    const rect = getViewportRect();

    if (touchPointers.length < 2 || !rect) {
      return;
    }

    const [first, second] = touchPointers;
    const startDistance = getPointerDistance(first, second);
    if (startDistance < 8) {
      return;
    }

    const startCenter = getPointerCenter(first, second, rect);
    pinchStateRef.current = {
      pointerIds: [first.pointerId, second.pointerId],
      startDistance,
      startViewport: props.viewport,
      startCenter,
      startWorldCenter: {
        x: (startCenter.x - props.viewport.x) / props.viewport.zoom,
        y: (startCenter.y - props.viewport.y) / props.viewport.zoom,
      },
    };
    setInteraction({ kind: "idle" });
    dismissPanHint();
  }

  function updatePinchInteraction() {
    const pinch = pinchStateRef.current;
    if (!pinch) {
      return false;
    }

    const first = activePointersRef.current.get(pinch.pointerIds[0]);
    const second = activePointersRef.current.get(pinch.pointerIds[1]);
    const rect = getViewportRect();

    if (!first || !second || !rect) {
      pinchStateRef.current = null;
      return false;
    }

    const distance = getPointerDistance(first, second);
    if (distance < 8) {
      return true;
    }

    const center = getPointerCenter(first, second, rect);
    const nextZoom = clampZoom(pinch.startViewport.zoom * (distance / pinch.startDistance));

    props.onViewportChange({
      zoom: nextZoom,
      x: center.x - pinch.startWorldCenter.x * nextZoom,
      y: center.y - pinch.startWorldCenter.y * nextZoom,
    });
    return true;
  }

  function trackPointer(event: ReactPointerEvent, target?: Element) {
    activePointersRef.current.set(event.pointerId, {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      pointerType: event.pointerType,
    });

    if (event.pointerType === "touch" && target && "setPointerCapture" in target) {
      try {
        target.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture can fail if the browser already released the pointer.
      }
    }

    if (event.pointerType === "touch" && activePointersRef.current.size >= 2) {
      startPinchInteraction();
    }
  }

  function releasePointer(event: ReactPointerEvent) {
    activePointersRef.current.delete(event.pointerId);
    if (pinchStateRef.current?.pointerIds.includes(event.pointerId)) {
      pinchStateRef.current = null;
    }
  }

  function openInlineEditorForSelection() {
    if (readOnly) {
      return;
    }

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
    if (readOnly) {
      return false;
    }

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
        (node.externalIdentifiers ?? []).some((identifier) =>
          identifier.importedParts.some((part) => part.relationshipId === relationshipNode.id),
        ),
    );
  }

  function moveSelectedEdgeOffset(delta: number): boolean {
    if (readOnly) {
      return false;
    }

    if (props.selection.nodeIds.length > 0 || props.selection.edgeIds.length !== 1) {
      return false;
    }

    const selectedEdge = props.diagram.edges.find((edge) => edge.id === props.selection.edgeIds[0]);
    if (!selectedEdge) {
      return false;
    }

    if (!canEdgeUseManualRouting(selectedEdge)) {
      props.onStatusMessageChange("Il routing dei connector e automatico: sposta entita o relazione.");
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

    if (!readOnly && (event.key === "Delete" || event.key === "Backspace")) {
      event.preventDefault();
      event.stopPropagation();
      if (focusedTarget?.kind === "externalIdentifier") {
        props.onDeleteExternalIdentifier(
          focusedTarget.hostEntityId,
          focusedTarget.externalIdentifierId,
        );
        setFocusedTarget(null);
        return;
      }

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
    trackPointer(event, event.currentTarget);

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

    if (readOnly) {
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
      }
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

    if (readOnly) {
      props.onSelectionChange({ nodeIds: [layout.hostEntityId], edgeIds: [] });
      return;
    }

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
      "Trascina l'identificatore composto: gli attributi membri si muovono come gruppo.",
    );
  }

  function handleNodePointerDown(event: ReactPointerEvent<SVGGElement>, node: DiagramNode) {
    event.stopPropagation();
    trackPointer(event, event.currentTarget);
    event.currentTarget.focus();

    if (readOnly) {
      if (event.shiftKey || event.ctrlKey || event.metaKey) {
        props.onSelectionChange(addToSelection(props.selection, node.id));
        return;
      }
      props.onSelectionChange({ nodeIds: [node.id], edgeIds: [] });
      return;
    }

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
    trackPointer(event, event.currentTarget);
    event.currentTarget.focus();

    if (readOnly) {
      props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
      return;
    }

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
    event.preventDefault();
    event.stopPropagation();

    if (readOnly) {
      props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
      return;
    }

    if (props.tool !== "select" || edge.type !== "connector") {
      props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
      return;
    }

    props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
  }

  function handleExternalIdentifierPointerDown(
    event: ReactPointerEvent<SVGGElement>,
    hostEntityId: string,
    externalIdentifierId: string,
  ) {
    event.stopPropagation();
    trackPointer(event, event.currentTarget);
    event.currentTarget.focus();

    if (readOnly) {
      const hostEntity = nodeMap.get(hostEntityId);
      if (hostEntity?.type === "entity") {
        setFocusedTarget({ kind: "externalIdentifier", hostEntityId, externalIdentifierId });
        props.onSelectionChange({ nodeIds: [hostEntityId], edgeIds: [] });
      }
      return;
    }

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

    setFocusedTarget({ kind: "externalIdentifier", hostEntityId, externalIdentifierId });
    props.onSelectionChange({ nodeIds: [hostEntityId], edgeIds: [] });
    const identifier = hostEntity.externalIdentifiers?.find(
      (candidate) => candidate.id === externalIdentifierId,
    );
    const layout = externalIdentifierLayouts.find(
      (candidate) =>
        candidate.hostEntityId === hostEntityId &&
        candidate.externalIdentifierId === externalIdentifierId,
    );
    setInteraction({
      kind: "external-id-drag",
      pointerId: event.pointerId,
      startClient: { x: event.clientX, y: event.clientY },
      originalDiagram: props.diagram,
      hostEntityId,
      externalIdentifierId,
      startOffset: identifier?.offset ?? 0,
      offsetDirection: layout?.offsetDirection ?? { x: 0, y: 1 },
      offsetMin: layout?.offsetMin ?? -80,
      offsetMax: layout?.offsetMax ?? 80,
    });
    props.onStatusMessageChange("Trascina il simbolo per regolare il routing dell'identificatore esterno.");
  }

  function handleStaticExternalIdentifierPointerDown(
    event: ReactPointerEvent<SVGGElement>,
    hostEntityId: string,
    externalIdentifierId: string,
  ) {
    event.stopPropagation();
    trackPointer(event, event.currentTarget);
    event.currentTarget.focus();

    if (readOnly) {
      const hostEntity = nodeMap.get(hostEntityId);
      if (hostEntity?.type === "entity") {
        setFocusedTarget({ kind: "externalIdentifier", hostEntityId, externalIdentifierId });
        props.onSelectionChange({ nodeIds: [hostEntityId], edgeIds: [] });
      }
      return;
    }

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

    setFocusedTarget({ kind: "externalIdentifier", hostEntityId, externalIdentifierId });
    props.onSelectionChange({ nodeIds: [hostEntityId], edgeIds: [] });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (activePointersRef.current.has(event.pointerId)) {
      activePointersRef.current.set(event.pointerId, {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        pointerType: event.pointerType,
      });
    }

    if (updatePinchInteraction()) {
      return;
    }

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
      const draggedEdge = interaction.originalDiagram.edges.find((edge) => edge.id === interaction.edgeId);
      if (!draggedEdge || !canEdgeUseManualRouting(draggedEdge)) {
        return;
      }

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
      const deltaX = (event.clientX - interaction.startClient.x) / props.viewport.zoom;
      const deltaY = (event.clientY - interaction.startClient.y) / props.viewport.zoom;
      const pointerDelta = deltaX * interaction.offsetDirection.x + deltaY * interaction.offsetDirection.y;
      const nextOffset = clampNumber(
        Math.round((interaction.startOffset + pointerDelta) / 2) * 2,
        interaction.offsetMin,
        interaction.offsetMax,
      );

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
    releasePointer(event);

    if (interaction.kind === "idle") {
      return;
    }

    if (interaction.kind === "drag") {
      props.onCommitDiagram(props.diagram, interaction.originalDiagram);
      setInteraction({ kind: "idle" });
      return;
    }

    if (interaction.kind === "edge-drag") {
      const draggedEdge = interaction.originalDiagram.edges.find((edge) => edge.id === interaction.edgeId);
      if (draggedEdge && canEdgeUseManualRouting(draggedEdge)) {
        props.onCommitDiagram(props.diagram, interaction.originalDiagram);
      }
      setInteraction({ kind: "idle" });
      return;
    }

    if (interaction.kind === "external-id-drag") {
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
    if (readOnly) {
      return;
    }
    setInlineEdit({ kind: "node", id: node.id, value: node.label });
  }

  function startInlineEdgeEdit(event: MouseEvent<SVGGElement>, edge: DiagramEdge) {
    event.stopPropagation();
    if (readOnly) {
      return;
    }
    if (edge.type === "connector") {
      props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
      props.onOpenCardinality(edge.id);
      return;
    }

    if (edge.type !== "inheritance") {
      return;
    }

    props.onSelectionChange({ nodeIds: [], edgeIds: [edge.id] });
    props.onOpenInheritanceType(edge.id);
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
    const geometry = getEdgeGeometry(edge, sourceNode, targetNode, laneInfo, compositeAttributeIds);
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
  const compositeIdentifierInteractive = props.mode === "edit" && props.tool === "select";
  const inheritanceGroups = buildInheritanceGroups(props.diagram);
  const groupedInheritanceLayouts = inheritanceGroups
    .map((group) => {
      const supertype = nodeMap.get(group.supertypeId);
      if (!supertype || supertype.type !== "entity") {
        return null;
      }

      const visualLayout = getInheritanceGroupLayout(group, nodeMap, inheritanceGroups);
      if (!visualLayout) {
        return null;
      }

      const firstEdgeId = group.edgeIds[0];
      return {
        group,
        supertype,
        edgeIds: group.edgeIds,
        selected: group.edgeIds.some((edgeId) => props.selection.edgeIds.includes(edgeId)),
        focused: focusedTarget?.kind === "edge" && group.edgeIds.some((edgeId) => edgeId === focusedTarget.id),
        highlighted: group.edgeIds.some((edgeId) => resolveTranslationHighlight(edgeId, props.translationHighlights) === "selected"),
        blocked: group.edgeIds.some((edgeId) => resolveTranslationHighlight(edgeId, props.translationHighlights) === "blocked"),
        pending: group.edgeIds.some((edgeId) => resolveTranslationHighlight(edgeId, props.translationHighlights) === "pending"),
        firstEdgeId,
        visualLayout,
        label: `(${group.isaCompleteness === "total" ? "t" : "p"},${group.isaDisjointness === "overlap" ? "o" : "e"})`,
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
    interaction.kind === "external-id-drag"
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
    activeCompositeGroupKey
  ) {
    guidanceState = "dragging-routing";
    guidanceStateLabel = "Dragging routing";
    guidanceTitle =
      interaction.kind === "edge-drag"
        ? "Routing connector"
        : interaction.kind === "external-id-drag"
          ? "External identifier"
          : "Composite identifier";
    guidanceMessage =
      interaction.kind === "edge-drag"
        ? "Trascina la label del connector per spostare il routing senza cambiare gli estremi."
        : interaction.kind === "external-id-drag"
          ? "Regola il routing dell'identificatore esterno mantenendo leggibile la relazione di supporto."
          : "Trascina l'identificatore composto per muovere insieme gli attributi membri.";
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
            ? { key: "connector-label", label: "Label connector", hint: "Doppio click sulla cardinalita per modificarla." }
            : null,
          externalIdentifierLayouts.length > 0
            ? { key: "external-id-marker", label: "Marker ext. ID", hint: "Hover o focus sul marker per selezionarlo." }
            : null,
          compositeIdentifierLayouts.length > 0
            ? { key: "composite-identifier", label: "Composite ID", hint: "Trascina il percorso per muovere il gruppo." }
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
      onPointerCancel={handlePointerUp}
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
                compositeAttributeIds={compositeAttributeIds}
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
                    isCompositeAttribute={node.type === "attribute" && compositeAttributeIds.has(node.id)}
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
            const stroke = layout.highlighted
              ? DIAGRAM_TRANSLATION_PENDING
              : layout.blocked
                ? DIAGRAM_TRANSLATION_BLOCKED
                : layout.pending
                  ? DIAGRAM_TRANSLATION_PENDING
                  : layout.selected || layout.focused
                    ? DIAGRAM_FOCUS
                    : DIAGRAM_STROKE;
            const trianglePath = `M ${layout.visualLayout.triangleApex.x} ${layout.visualLayout.triangleApex.y} L ${layout.visualLayout.triangleBaseA.x} ${layout.visualLayout.triangleBaseA.y} L ${layout.visualLayout.triangleBaseB.x} ${layout.visualLayout.triangleBaseB.y} Z`;
            const hitPath = pathFromPoints(layout.visualLayout.hitPoints);
            const labelWidth = layout.label ? layout.label.length * 8 + 10 : 0;
            return (
              <g
                key={`inheritance-group-${layout.group.id}`}
                className={
                  layout.selected || layout.highlighted
                    ? `diagram-edge selected inheritance-group inheritance-group-${layout.visualLayout.kind}`
                    : `diagram-edge inheritance-group inheritance-group-${layout.visualLayout.kind}`
                }
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
                  props.onOpenInheritanceType(layout.firstEdgeId);
                }}
              >
                <path d={hitPath} fill="none" stroke="transparent" strokeWidth={16} />
                {layout.visualLayout.lineSegments.map((segment) => (
                  <path
                    key={`${layout.group.id}-${segment.id}`}
                    d={pathFromPoints([segment.from, segment.to])}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={layout.highlighted ? 2.6 : 2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
                <path
                  d={trianglePath}
                  fill="var(--diagram-canvas-fill)"
                  stroke={stroke}
                  strokeWidth={layout.highlighted ? 2.9 : 2.5}
                  strokeLinejoin="round"
                />
                {layout.label ? (
                  <>
                    <rect
                      x={layout.visualLayout.labelPoint.x - labelWidth / 2}
                      y={layout.visualLayout.labelPoint.y - 13}
                      width={labelWidth}
                      height={18}
                      rx={3}
                      fill="var(--diagram-canvas-fill)"
                      opacity={0.92}
                      pointerEvents="none"
                    />
                    <text
                      x={layout.visualLayout.labelPoint.x}
                      y={layout.visualLayout.labelPoint.y}
                      textAnchor="middle"
                      className="edge-label inheritance-constraint-label"
                      fill={stroke}
                    >
                      {layout.label}
                    </text>
                  </>
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

            return (
              <DiagramEdgeView
                key={edge.id}
                edge={edge}
                sourceNode={sourceNode}
                targetNode={targetNode}
                laneInfo={connectorLaneMap.get(edge.id)}
                compositeAttributeIds={compositeAttributeIds}
                labelLayoutOverride={edgeLabelLayoutOverrides.get(edge.id)}
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
              isCompositeAttribute={node.type === "attribute" && compositeAttributeIds.has(node.id)}
              onPointerDown={handleNodePointerDown}
              onDoubleClick={startInlineNodeEdit}
            />
          ))}

          {externalIdentifierFrameLayouts.map(renderExternalIdentifierFrame)}

          {externalIdentifierMarkerLayouts.map(renderExternalIdentifierMarker)}

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
              <path
                className="composite-identifier-path"
                d={layout.pathData}
                fill="none"
                stroke={DIAGRAM_STROKE}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                pointerEvents="none"
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
                  pointerEvents="none"
                />
              ))}
              {layout.terminalMarker ? (
                <circle
                  className="composite-identifier-marker"
                  cx={layout.terminalMarker.x}
                  cy={layout.terminalMarker.y}
                  r={COMPOSITE_INTERNAL_TERMINAL_MARKER_RADIUS}
                  fill={DIAGRAM_STROKE}
                  stroke={DIAGRAM_STROKE}
                  strokeWidth={2}
                  pointerEvents="none"
                />
              ) : null}

              {compositeIdentifierInteractive ? (
                <>
                  <path
                    className="composite-identifier-hit"
                    d={layout.hitPathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={18}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pointerEvents="stroke"
                  />
                  {layout.memberMarkers.map((marker) => (
                    <circle
                      key={`composite-id-marker-hit-${layout.groupKey}-${marker.attributeId}`}
                      className="composite-identifier-hit"
                      cx={marker.projection.x}
                      cy={marker.projection.y}
                      r={10}
                      fill="transparent"
                      pointerEvents="fill"
                    />
                  ))}
                  {layout.terminalMarker ? (
                    <circle
                      className="composite-identifier-hit"
                      cx={layout.terminalMarker.x}
                      cy={layout.terminalMarker.y}
                      r={12}
                      fill="transparent"
                      pointerEvents="fill"
                    />
                  ) : null}
                </>
              ) : null}
            </g>
          ))}

          {externalIdentifierLayouts.map((layout) => {
            if (layout.kind === "imported_only" && layout.junction) {
              const markerPath = pathFromPoints(layout.pathPoints);
              const externalIdentifierFocused =
                focusedTarget?.kind === "externalIdentifier" &&
                focusedTarget.hostEntityId === layout.hostEntityId &&
                focusedTarget.externalIdentifierId === layout.externalIdentifierId;
              return (
                <g
                  key={`external-id-${layout.externalIdentifierId}`}
                  className={
                    activeExternalIdentifierId === layout.externalIdentifierId || externalIdentifierFocused
                      ? "external-identifier external-identifier-imported external-identifier-active"
                      : "external-identifier external-identifier-imported"
                  }
                  tabIndex={props.tool === "select" ? 0 : -1}
                  focusable={props.tool === "select" ? "true" : "false"}
                  onFocus={() =>
                    setFocusedTarget({
                      kind: "externalIdentifier",
                      hostEntityId: layout.hostEntityId,
                      externalIdentifierId: layout.externalIdentifierId,
                    })
                  }
                  onBlur={(focusEvent: ReactFocusEvent<SVGGElement>) => {
                    if (!focusEvent.currentTarget.contains(focusEvent.relatedTarget as Node | null)) {
                      setFocusedTarget((current) =>
                        current?.kind === "externalIdentifier" &&
                        current.hostEntityId === layout.hostEntityId &&
                        current.externalIdentifierId === layout.externalIdentifierId
                          ? null
                          : current,
                      );
                    }
                  }}
                  onPointerDown={(event) =>
                    handleStaticExternalIdentifierPointerDown(
                      event,
                      layout.hostEntityId,
                      layout.externalIdentifierId,
                    )
                  }
                >
                  <path
                    className="external-identifier-hit-path"
                    d={markerPath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={EXTERNAL_IDENTIFIER_IMPORTED_HIT_STROKE_WIDTH}
                  />
                  {layout.bracketStart && layout.bracketEnd ? (
                    <line
                      className="external-identifier-hit-path"
                      x1={layout.bracketStart.x}
                      y1={layout.bracketStart.y}
                      x2={layout.bracketEnd.x}
                      y2={layout.bracketEnd.y}
                      stroke="transparent"
                      strokeWidth={EXTERNAL_IDENTIFIER_IMPORTED_HIT_STROKE_WIDTH}
                    />
                  ) : null}
                  <path
                    className="external-identifier-path"
                    d={markerPath}
                    fill="none"
                    stroke={DIAGRAM_STROKE}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {layout.bracketStart && layout.bracketEnd ? (
                    <line
                      className="external-identifier-path"
                      x1={layout.bracketStart.x}
                      y1={layout.bracketStart.y}
                      x2={layout.bracketEnd.x}
                      y2={layout.bracketEnd.y}
                      stroke={DIAGRAM_STROKE}
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  ) : null}
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
                    r={EXTERNAL_IDENTIFIER_IMPORTED_MARKER_RADIUS}
                    fill={DIAGRAM_STROKE}
                    stroke={DIAGRAM_STROKE}
                    strokeWidth={1.8}
                    pointerEvents="none"
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
