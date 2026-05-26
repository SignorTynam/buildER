import { useEffect, useMemo, useRef, useState } from "react";
import type {
  FocusEvent as ReactFocusEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { DiagramEdgeView } from "../canvas/DiagramEdge";
import { DiagramNodeView } from "../canvas/DiagramNode";
import type { DiagramEdge, DiagramNode, Point, Viewport } from "../types/diagram";
import type {
  LogicalColumn,
  LogicalSelection,
  LogicalTransformationEdge,
  LogicalTransformationNode,
  LogicalWorkspaceDocument,
} from "../types/logical";
import {
  clampZoom,
  clientPointFromWorld,
} from "../utils/geometry";
import {
  formatSqlType,
  isColumnTypeLockedByReference,
  type LogicalColumnSqlPatch,
} from "../utils/logicalSqlMetadata";

interface LogicalTransformationCanvasProps {
  workspace: LogicalWorkspaceDocument;
  selection: LogicalSelection;
  viewport: Viewport;
  typeMode: boolean;
  fitRequestToken: number;
  activeTargetKeys: string[];
  focusedTargetKey: string | null;
  schemaOnly?: boolean;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: LogicalSelection) => void;
  onPreviewModel: (model: LogicalWorkspaceDocument["model"]) => void;
  onCommitModel: (nextModel: LogicalWorkspaceDocument["model"], previousModel: LogicalWorkspaceDocument["model"]) => void;
  onRenameTable: (tableId: string, nextName: string) => void;
  onRenameColumn: (tableId: string, columnId: string, nextName: string) => void;
  onUpdateColumnSql: (tableId: string, columnId: string, patch: LogicalColumnSqlPatch) => void;
}

type ConnectionSide = "left" | "right" | "top" | "bottom";

interface EdgeRoute {
  points: Point[];
  labelPoint: Point;
}

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
      tableId: string;
      startClient: Point;
      startTablePosition: Point;
      originalModel: LogicalWorkspaceDocument["model"];
    };

type InlineEditState =
  | { kind: "table"; tableId: string; value: string }
  | { kind: "column"; tableId: string; columnId: string; value: string }
  | null;

const WORLD_EXTENT = 9200;
const ROUTE_EXIT_OFFSET = 18;
const LANE_STEP = 14;
const VIEWPORT_PADDING = 140;
const EDGE_BOUNDS_PADDING = 24;
const EDGE_LABEL_HALF_WIDTH = 56;
const EDGE_LABEL_HALF_HEIGHT = 12;
const EDGE_LABEL_VERTICAL_OFFSET = 6;
const DESIGNER_TABLE_MIN_WIDTH = 180;
const DESIGNER_TABLE_MAX_WIDTH = 860;
const DESIGNER_TABLE_HEADER_HEIGHT = 36;
const DESIGNER_TABLE_ROW_HEIGHT = 34;
const DESIGNER_TABLE_HORIZONTAL_PADDING = 18;
const DESIGNER_TABLE_INLINE_EDITOR_TOP = 6;
const DESIGNER_EDGE_DEFAULT_STROKE_WIDTH = 1.2;
const DESIGNER_EDGE_ACTIVE_STROKE_WIDTH = 1.45;
const DESIGNER_EDGE_SELECTED_STROKE_WIDTH = 1.7;
const DESIGNER_COLUMN_TYPE_GAP = 32;

function clampDesignerDimension(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function estimateDesignerTextWidth(value: string, variant: "title" | "column" | "type"): number {
  const normalized = value.trim();
  const charWidth = variant === "title" ? 10.8 : variant === "type" ? 7.4 : 9.4;
  return normalized.length * charWidth;
}

export function getDesignerLogicalColumnTypeLabel(column: LogicalColumn): string {
  return formatSqlType(column);
}

export function getDesignerLogicalColumnQualifierLabels(column: LogicalColumn): string[] {
  const qualifiers: string[] = [];

  if (column.isPrimaryKey) {
    qualifiers.push("PK");
  }

  if (column.isForeignKey) {
    qualifiers.push("FK");
  }

  if (!column.isNullable && !column.isPrimaryKey) {
    qualifiers.push("NN");
  }

  if (column.isUnique === true && !column.isPrimaryKey) {
    qualifiers.push("U");
  }

  return qualifiers;
}

export function getDesignerLogicalColumnNameLabel(column: LogicalColumn): string {
  const qualifiers = getDesignerLogicalColumnQualifierLabels(column);
  return qualifiers.length > 0 ? `${qualifiers.join(" ")} ${column.name}` : column.name;
}

export function getDesignerLogicalTableDimensions(label: string, columns: LogicalColumn[]): {
  width: number;
  height: number;
} {
  const titleWidth = estimateDesignerTextWidth(label, "title") + DESIGNER_TABLE_HORIZONTAL_PADDING * 2;
  const rowWidth =
    columns.length > 0
      ? Math.max(
          ...columns.map(
            (column) =>
              estimateDesignerTextWidth(getDesignerLogicalColumnNameLabel(column), "column") +
              estimateDesignerTextWidth(getDesignerLogicalColumnTypeLabel(column), "type") +
              DESIGNER_TABLE_HORIZONTAL_PADDING * 2 +
              DESIGNER_COLUMN_TYPE_GAP,
          ),
        )
      : DESIGNER_TABLE_MIN_WIDTH;

  return {
    width: clampDesignerDimension(
      Math.ceil(Math.max(titleWidth, rowWidth)),
      DESIGNER_TABLE_MIN_WIDTH,
      DESIGNER_TABLE_MAX_WIDTH,
    ),
    height: DESIGNER_TABLE_HEADER_HEIGHT + Math.max(columns.length, 1) * DESIGNER_TABLE_ROW_HEIGHT,
  };
}

function applyDesignerLogicalTableGeometry(
  node: LogicalTransformationNode,
  columns: LogicalColumn[],
): LogicalTransformationNode {
  if (node.kind !== "logical-table") {
    return node;
  }

  const dimensions = getDesignerLogicalTableDimensions(node.label, columns);
  if (node.width === dimensions.width && node.height === dimensions.height) {
    return node;
  }

  return {
    ...node,
    width: dimensions.width,
    height: dimensions.height,
  };
}

function pathFromOrthogonalPoints(points: Point[]): string {
  const simplified = simplifyPoints(points);
  if (simplified.length === 0) {
    return "";
  }

  return simplified
    .map((point, index) =>
      `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`,
    )
    .join(" ");
}

function isColumnUnderlinedInDesignerTheme(column: LogicalColumn): boolean {
  return column.isPrimaryKey;
}

function getDesignerLogicalColumnTextClassName(column: LogicalColumn): string {
  return ["logical-column-name", isColumnUnderlinedInDesignerTheme(column) ? "underlined" : ""]
    .filter(Boolean)
    .join(" ");
}

function shouldRenderDesignerLogicalEdgeLabel(selected: boolean, focusHighlighted: boolean): boolean {
  return selected || focusHighlighted;
}

function getDesignerLogicalEdgeStrokeWidth(
  selected: boolean,
  stepHighlighted: boolean,
  focusHighlighted: boolean,
): number {
  if (selected) {
    return DESIGNER_EDGE_SELECTED_STROKE_WIDTH;
  }

  if (stepHighlighted || focusHighlighted) {
    return DESIGNER_EDGE_ACTIVE_STROKE_WIDTH;
  }

  return DESIGNER_EDGE_DEFAULT_STROKE_WIDTH;
}

function getNodeCenter(node: Pick<LogicalTransformationNode, "x" | "y" | "width" | "height">): Point {
  return {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
}

function chooseAnchorSide(
  from: Pick<LogicalTransformationNode, "x" | "y" | "width" | "height">,
  to: Pick<LogicalTransformationNode, "x" | "y" | "width" | "height">,
): ConnectionSide {
  const fromCenter = getNodeCenter(from);
  const toCenter = getNodeCenter(to);
  const deltaX = toCenter.x - fromCenter.x;
  const deltaY = toCenter.y - fromCenter.y;

  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? "right" : "left";
  }

  return deltaY >= 0 ? "bottom" : "top";
}

function anchorPointForSide(
  node: Pick<LogicalTransformationNode, "x" | "y" | "width" | "height">,
  side: ConnectionSide,
): Point {
  if (side === "left") {
    return { x: node.x, y: node.y + node.height / 2 };
  }

  if (side === "right") {
    return { x: node.x + node.width, y: node.y + node.height / 2 };
  }

  if (side === "top") {
    return { x: node.x + node.width / 2, y: node.y };
  }

  return { x: node.x + node.width / 2, y: node.y + node.height };
}

function moveAlongSide(point: Point, side: ConnectionSide, distance: number): Point {
  if (side === "left") {
    return { x: point.x - distance, y: point.y };
  }

  if (side === "right") {
    return { x: point.x + distance, y: point.y };
  }

  if (side === "top") {
    return { x: point.x, y: point.y - distance };
  }

  return { x: point.x, y: point.y + distance };
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
  if (deduped.length < 3) {
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

function getPolylineLength(points: Point[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    length += Math.hypot(end.x - start.x, end.y - start.y);
  }
  return length;
}

function pointAlongPolyline(points: Point[], progress: number): Point {
  if (points.length <= 1) {
    return points[0] ?? { x: 0, y: 0 };
  }

  const totalLength = getPolylineLength(points);
  if (totalLength <= 0.001) {
    return points[0];
  }

  const targetDistance = totalLength * Math.min(1, Math.max(0, progress));
  let consumed = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const segmentLength = Math.hypot(end.x - start.x, end.y - start.y);
    if (consumed + segmentLength >= targetDistance) {
      const ratio = (targetDistance - consumed) / Math.max(segmentLength, 0.001);
      return {
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      };
    }
    consumed += segmentLength;
  }

  return points[points.length - 1];
}

function getRoute(
  fromNode: Pick<LogicalTransformationNode, "x" | "y" | "width" | "height">,
  toNode: Pick<LogicalTransformationNode, "x" | "y" | "width" | "height">,
  laneOffset: number,
): EdgeRoute {
  const fromSide = chooseAnchorSide(fromNode, toNode);
  const toSide = chooseAnchorSide(toNode, fromNode);
  const fromAnchor = anchorPointForSide(fromNode, fromSide);
  const toAnchor = anchorPointForSide(toNode, toSide);
  const fromOuter = moveAlongSide(fromAnchor, fromSide, ROUTE_EXIT_OFFSET);
  const toOuter = moveAlongSide(toAnchor, toSide, ROUTE_EXIT_OFFSET);
  const points: Point[] = [fromAnchor, fromOuter];

  if (fromSide === "left" || fromSide === "right") {
    const midX = (fromOuter.x + toOuter.x) / 2 + laneOffset;
    points.push({ x: midX, y: fromOuter.y });
    points.push({ x: midX, y: toOuter.y });
  } else {
    const midY = (fromOuter.y + toOuter.y) / 2 + laneOffset;
    points.push({ x: fromOuter.x, y: midY });
    points.push({ x: toOuter.x, y: midY });
  }

  points.push(toOuter);
  points.push(toAnchor);

  const simplified = simplifyPoints(points);
  return {
    points: simplified,
    labelPoint: pointAlongPolyline(simplified, 0.5),
  };
}

function getBoundsForNodes(nodes: LogicalTransformationNode[]): { x: number; y: number; width: number; height: number } | null {
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

function getBoundsForVisibleContent(
  nodes: LogicalTransformationNode[],
  routes: EdgeRoute[],
): { x: number; y: number; width: number; height: number } | null {
  const nodeBounds = getBoundsForNodes(nodes);

  let minX = nodeBounds ? nodeBounds.x : Number.POSITIVE_INFINITY;
  let minY = nodeBounds ? nodeBounds.y : Number.POSITIVE_INFINITY;
  let maxX = nodeBounds ? nodeBounds.x + nodeBounds.width : Number.NEGATIVE_INFINITY;
  let maxY = nodeBounds ? nodeBounds.y + nodeBounds.height : Number.NEGATIVE_INFINITY;

  function includePoint(point: Point) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  routes.forEach((route) => {
    route.points.forEach(includePoint);

    const labelX = route.labelPoint.x;
    const labelY = route.labelPoint.y - EDGE_LABEL_VERTICAL_OFFSET;
    minX = Math.min(minX, labelX - EDGE_LABEL_HALF_WIDTH);
    minY = Math.min(minY, labelY - EDGE_LABEL_HALF_HEIGHT);
    maxX = Math.max(maxX, labelX + EDGE_LABEL_HALF_WIDTH);
    maxY = Math.max(maxY, labelY + EDGE_LABEL_HALF_HEIGHT);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
    return null;
  }

  return {
    x: minX - EDGE_BOUNDS_PADDING,
    y: minY - EDGE_BOUNDS_PADDING,
    width: Math.max(1, maxX - minX + EDGE_BOUNDS_PADDING * 2),
    height: Math.max(1, maxY - minY + EDGE_BOUNDS_PADDING * 2),
  };
}

function getRowWorldPoint(tableNode: LogicalTransformationNode, rowIndex: number): Point {
  return {
    x: tableNode.x + DESIGNER_TABLE_HORIZONTAL_PADDING - 2,
    y:
      tableNode.y +
      DESIGNER_TABLE_HEADER_HEIGHT +
      rowIndex * DESIGNER_TABLE_ROW_HEIGHT +
      DESIGNER_TABLE_INLINE_EDITOR_TOP,
  };
}

function toSyntheticDiagramNode(node: LogicalTransformationNode): DiagramNode {
  if (node.renderType === "relationship") {
    return {
      id: node.id,
      type: "relationship",
      label: node.label,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };
  }

  if (node.renderType === "attribute" || node.renderType === "multivalued-attribute") {
    return {
      id: node.id,
      type: "attribute",
      label: node.label,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      isMultivalued: node.renderType === "multivalued-attribute",
    };
  }

  return {
    id: node.id,
    type: "entity",
    label: node.label,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
    isWeak: node.renderType === "weak-entity",
  };
}

function buildAttributeDirectionMap(
  nodeById: Map<string, LogicalTransformationNode>,
  edges: LogicalTransformationEdge[],
): Map<string, Point> {
  const directions = new Map<string, Point>();

  edges.forEach((edge) => {
    if (edge.renderType !== "attribute") {
      return;
    }

    const sourceNode = nodeById.get(edge.sourceId);
    const targetNode = nodeById.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      return;
    }

    const attributeNode =
      sourceNode.renderType === "attribute" || sourceNode.renderType === "multivalued-attribute"
        ? sourceNode
        : targetNode.renderType === "attribute" || targetNode.renderType === "multivalued-attribute"
          ? targetNode
          : null;
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

function hasAnyTargetKey(
  element: { relatedTargetKeys: string[] },
  activeTargetKeys: string[],
): boolean {
  return activeTargetKeys.some((targetKey) => element.relatedTargetKeys.includes(targetKey));
}

function intersectingTargetKey(
  element: { relatedTargetKeys: string[] },
  targetKey: string | null,
): boolean {
  return targetKey != null && element.relatedTargetKeys.includes(targetKey);
}

export function LogicalTransformationCanvas(props: LogicalTransformationCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fitRetryFrameRef = useRef<number | null>(null);
  const fitRetryAttemptsRef = useRef(0);
  const [interaction, setInteraction] = useState<InteractionState>({ kind: "idle" });
  const [inlineEdit, setInlineEdit] = useState<InlineEditState>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [hoverTableId, setHoverTableId] = useState<string | null>(null);

  const graph = props.workspace.transformation;
  const tableColumnsById = useMemo(() => {
    const result = new Map<string, LogicalColumn[]>();
    props.workspace.model.tables.forEach((table) => {
      result.set(table.id, table.columns);
    });
    return result;
  }, [props.workspace.model.tables]);
  const renderedNodes = useMemo(
    () =>
      graph.nodes.map((node) =>
        node.kind === "logical-table"
          ? applyDesignerLogicalTableGeometry(node, tableColumnsById.get(node.tableId ?? node.id) ?? [])
          : node,
      ),
    [graph.nodes, tableColumnsById],
  );
  const nodeById = useMemo(() => new Map(renderedNodes.map((node) => [node.id, node])), [renderedNodes]);
  const erNodes = useMemo(
    () => (props.schemaOnly ? [] : renderedNodes.filter((node) => node.kind === "er-node")),
    [props.schemaOnly, renderedNodes],
  );
  const tableNodes = useMemo(
    () => renderedNodes.filter((node) => node.kind === "logical-table"),
    [renderedNodes],
  );
  const visibleRenderedNodes = useMemo(
    () => (props.schemaOnly ? tableNodes : renderedNodes),
    [props.schemaOnly, renderedNodes, tableNodes],
  );
  const erEdges = useMemo(
    () => (props.schemaOnly ? [] : graph.edges.filter((edge) => edge.kind === "er-edge")),
    [graph.edges, props.schemaOnly],
  );
  const fkEdges = useMemo(() => graph.edges.filter((edge) => edge.kind === "foreign-key"), [graph.edges]);
  const syntheticNodeById = useMemo(
    () => new Map(renderedNodes.map((node) => [node.id, toSyntheticDiagramNode(node)])),
    [renderedNodes],
  );

  const laneByEdgeId = useMemo(() => {
    const grouping = new Map<string, string[]>();
    fkEdges.forEach((edge) => {
      const key = `${edge.sourceId}::${edge.targetId}`;
      const bucket = grouping.get(key) ?? [];
      bucket.push(edge.id);
      grouping.set(key, bucket);
    });

    const lanes = new Map<string, number>();
    grouping.forEach((edgeIds) => {
      edgeIds.forEach((edgeId, index) => {
        const center = (edgeIds.length - 1) / 2;
        lanes.set(edgeId, (index - center) * LANE_STEP);
      });
    });
    return lanes;
  }, [fkEdges]);

  const routeByEdgeId = useMemo(() => {
    const routes = new Map<string, EdgeRoute>();
    fkEdges.forEach((edge) => {
      const fromNode = nodeById.get(edge.sourceId);
      const toNode = nodeById.get(edge.targetId);
      if (!fromNode || !toNode) {
        return;
      }

      routes.set(edge.id, getRoute(fromNode, toNode, laneByEdgeId.get(edge.id) ?? 0));
    });
    return routes;
  }, [fkEdges, nodeById, laneByEdgeId]);

  const attributeDirectionByNodeId = useMemo(() => buildAttributeDirectionMap(nodeById, erEdges), [nodeById, erEdges]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === " ") {
        setSpacePressed(true);
      }
      if (event.key === "Escape") {
        if (inlineEdit) {
          setInlineEdit(null);
        }
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (event.key === " ") {
        setSpacePressed(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [inlineEdit]);

  function getViewportRect(): DOMRect | null {
    if (!containerRef.current) {
      return null;
    }

    return containerRef.current.getBoundingClientRect();
  }

  function hasUsableViewportRect(rect: DOMRect): boolean {
    return rect.width >= 48 && rect.height >= 48;
  }

  function fitToContent(): boolean {
    const rect = getViewportRect();
    if (!rect || !hasUsableViewportRect(rect)) {
      return false;
    }

    const bounds = getBoundsForVisibleContent(visibleRenderedNodes, [...routeByEdgeId.values()]);
    if (!bounds) {
      return false;
    }

    const paddedWidth = Math.max(1, bounds.width + VIEWPORT_PADDING * 2);
    const paddedHeight = Math.max(1, bounds.height + VIEWPORT_PADDING * 2);
    const nextZoom = clampZoom(Math.min(rect.width / paddedWidth, rect.height / paddedHeight));
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    props.onViewportChange({
      zoom: nextZoom,
      x: rect.width / 2 - centerX * nextZoom,
      y: rect.height / 2 - centerY * nextZoom,
    });

    return true;
  }

  function cancelFitRetry() {
    if (fitRetryFrameRef.current != null) {
      window.cancelAnimationFrame(fitRetryFrameRef.current);
      fitRetryFrameRef.current = null;
    }
    fitRetryAttemptsRef.current = 0;
  }

  function requestFitToContent() {
    cancelFitRetry();

    const attemptFit = () => {
      if (fitToContent()) {
        cancelFitRetry();
        return;
      }

      if (fitRetryAttemptsRef.current >= 12) {
        cancelFitRetry();
        return;
      }

      fitRetryAttemptsRef.current += 1;
      fitRetryFrameRef.current = window.requestAnimationFrame(attemptFit);
    };

    fitRetryFrameRef.current = window.requestAnimationFrame(attemptFit);
  }

  useEffect(() => {
    requestFitToContent();
    // Trigger only on token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.fitRequestToken]);

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === "undefined") {
      return;
    }

    const observedNode = containerRef.current;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || entry.contentRect.width < 48 || entry.contentRect.height < 48) {
        return;
      }

      if (fitRetryFrameRef.current != null || props.viewport.zoom <= 0.451) {
        requestFitToContent();
      }
    });

    observer.observe(observedNode);
    return () => observer.disconnect();
    // Keep observer mounted; viewport zoom guard handles unnecessary refits.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.viewport.zoom]);

  useEffect(() => () => cancelFitRetry(), []);

  function centerContent() {
    const rect = getViewportRect();
    if (!rect || !hasUsableViewportRect(rect)) {
      return;
    }

    const bounds = getBoundsForVisibleContent(visibleRenderedNodes, [...routeByEdgeId.values()]);
    if (!bounds) {
      return;
    }

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    props.onViewportChange({
      ...props.viewport,
      x: rect.width / 2 - centerX * props.viewport.zoom,
      y: rect.height / 2 - centerY * props.viewport.zoom,
    });
  }

  function resetViewport() {
    const rect = getViewportRect();
    if (!rect || !hasUsableViewportRect(rect)) {
      return;
    }

    const bounds = getBoundsForVisibleContent(visibleRenderedNodes, [...routeByEdgeId.values()]);
    if (!bounds) {
      props.onViewportChange({
        x: rect.width / 2,
        y: rect.height / 2,
        zoom: 1,
      });
      return;
    }

    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    props.onViewportChange({
      zoom: 1,
      x: rect.width / 2 - centerX,
      y: rect.height / 2 - centerY,
    });
  }

  function zoomAroundCenter(factor: number) {
    if (!containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const nextZoom = clampZoom(props.viewport.zoom * factor);
    if (Math.abs(nextZoom - props.viewport.zoom) < 0.001) {
      return;
    }

    const worldX = (centerX - props.viewport.x) / props.viewport.zoom;
    const worldY = (centerY - props.viewport.y) / props.viewport.zoom;
    props.onViewportChange({
      zoom: nextZoom,
      x: centerX - worldX * nextZoom,
      y: centerY - worldY * nextZoom,
    });
  }

  function handleCanvasWheel(event: ReactWheelEvent<HTMLDivElement>) {
    event.preventDefault();
    if (!containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const deltaScale = event.deltaMode === 1 ? 18 : event.deltaMode === 2 ? rect.height : 1;
    const zoomFactor = Math.exp((-event.deltaY * deltaScale) / 720);
    const nextZoom = clampZoom(props.viewport.zoom * zoomFactor);
    if (Math.abs(nextZoom - props.viewport.zoom) < 0.001) {
      return;
    }

    const worldX = (localX - props.viewport.x) / props.viewport.zoom;
    const worldY = (localY - props.viewport.y) / props.viewport.zoom;
    props.onViewportChange({
      zoom: nextZoom,
      x: localX - worldX * nextZoom,
      y: localY - worldY * nextZoom,
    });
  }

  function handleBackgroundPointerDown(event: ReactPointerEvent<SVGRectElement>) {
    if (event.button !== 0 && event.button !== 1) {
      return;
    }

    if (spacePressed || event.button === 1) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setInteraction({
        kind: "pan",
        pointerId: event.pointerId,
        startClient: { x: event.clientX, y: event.clientY },
        startViewport: props.viewport,
      });
      return;
    }

    props.onSelectionChange({ nodeId: null, columnId: null, edgeId: null });
  }

  function handleTableHeaderPointerDown(event: ReactPointerEvent<SVGGElement>, tableNode: LogicalTransformationNode) {
    if (event.button !== 0) {
      return;
    }

    if (spacePressed) {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setInteraction({
        kind: "pan",
        pointerId: event.pointerId,
        startClient: { x: event.clientX, y: event.clientY },
        startViewport: props.viewport,
      });
      return;
    }

    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    props.onSelectionChange({ nodeId: tableNode.id, columnId: null, edgeId: null });
    setInteraction({
      kind: "drag",
      pointerId: event.pointerId,
      tableId: tableNode.id,
      startClient: { x: event.clientX, y: event.clientY },
      startTablePosition: { x: tableNode.x, y: tableNode.y },
      originalModel: props.workspace.model,
    });
  }

  function handleColumnPointerDown(
    event: ReactPointerEvent<SVGRectElement>,
    tableNode: LogicalTransformationNode,
    column: LogicalColumn,
  ) {
    event.stopPropagation();
    const connectedEdgeId =
      column.references.length > 0
        ? fkEdges.find((edge) => edge.foreignKeyId === column.references[0].foreignKeyId)?.id ?? null
        : null;

    props.onSelectionChange({
      nodeId: tableNode.id,
      columnId: column.id,
      edgeId: connectedEdgeId,
    });
  }

  function handleErNodePointerDown(_event: ReactPointerEvent<SVGGElement>, node: LogicalTransformationNode) {
    props.onSelectionChange({ nodeId: node.id, columnId: null, edgeId: null });
  }

  function handleErEdgePointerDown(_event: ReactPointerEvent<SVGGElement>, edge: LogicalTransformationEdge) {
    props.onSelectionChange({ nodeId: null, columnId: null, edgeId: edge.id });
  }

  function handleErEdgeLabelPointerDown(_event: ReactPointerEvent<SVGTextElement>, edge: LogicalTransformationEdge) {
    props.onSelectionChange({ nodeId: null, columnId: null, edgeId: edge.id });
  }

  function handleLogicalEdgePointerDown(event: ReactPointerEvent<SVGGElement>, edge: LogicalTransformationEdge) {
    event.stopPropagation();
    props.onSelectionChange({
      nodeId: edge.sourceId,
      columnId: null,
      edgeId: edge.id,
    });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (interaction.kind === "idle" || interaction.pointerId !== event.pointerId) {
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

    const deltaX = (event.clientX - interaction.startClient.x) / props.viewport.zoom;
    const deltaY = (event.clientY - interaction.startClient.y) / props.viewport.zoom;
    const nextX = Math.round(interaction.startTablePosition.x + deltaX);
    const nextY = Math.round(interaction.startTablePosition.y + deltaY);

    const nextModel = {
      ...props.workspace.model,
      tables: props.workspace.model.tables.map((table) =>
        table.id === interaction.tableId
          ? {
              ...table,
              x: nextX,
              y: nextY,
            }
          : table,
      ),
    };

    props.onPreviewModel(nextModel);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (interaction.kind === "idle" || interaction.pointerId !== event.pointerId) {
      return;
    }

    if (interaction.kind === "drag") {
      props.onCommitModel(props.workspace.model, interaction.originalModel);
    }

    setInteraction({ kind: "idle" });
  }

  function startTableInlineEdit(event: MouseEvent<SVGGElement>, tableNode: LogicalTransformationNode) {
    event.stopPropagation();
    setInlineEdit({ kind: "table", tableId: tableNode.id, value: tableNode.label });
  }

  function startColumnInlineEdit(
    event: MouseEvent<SVGGElement>,
    tableNode: LogicalTransformationNode,
    column: LogicalColumn,
  ) {
    event.stopPropagation();
    setInlineEdit({ kind: "column", tableId: tableNode.id, columnId: column.id, value: column.name });
  }

  function commitInlineEdit() {
    if (!inlineEdit) {
      return;
    }

    const value = inlineEdit.value.trim();
    if (!value) {
      setInlineEdit(null);
      return;
    }

    if (inlineEdit.kind === "table") {
      props.onRenameTable(inlineEdit.tableId, value);
    } else {
      props.onRenameColumn(inlineEdit.tableId, inlineEdit.columnId, value);
    }

    setInlineEdit(null);
  }

  function getInlineEditorStyle() {
    if (!inlineEdit || !containerRef.current) {
      return undefined;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const tableNode = nodeById.get(inlineEdit.tableId);
    if (!tableNode) {
      return undefined;
    }

    if (inlineEdit.kind === "table") {
      const clientPoint = clientPointFromWorld(
        {
          x: tableNode.x + DESIGNER_TABLE_HORIZONTAL_PADDING - 4,
          y: tableNode.y + DESIGNER_TABLE_INLINE_EDITOR_TOP,
        },
        props.viewport,
        rect,
      );
      return {
        left: clientPoint.x - rect.left,
        top: clientPoint.y - rect.top,
        width: Math.max(
          180,
          (tableNode.width - DESIGNER_TABLE_HORIZONTAL_PADDING * 2 + 8) * props.viewport.zoom,
        ),
      };
    }

    const rowIndex = (tableColumnsById.get(tableNode.tableId ?? tableNode.id) ?? []).findIndex(
      (column) => column.id === inlineEdit.columnId,
    );
    if (rowIndex < 0) {
      return undefined;
    }

    const clientPoint = clientPointFromWorld(getRowWorldPoint(tableNode, rowIndex), props.viewport, rect);
    return {
      left: clientPoint.x - rect.left,
      top: clientPoint.y - rect.top,
      width: Math.max(
        160,
        (tableNode.width - DESIGNER_TABLE_HORIZONTAL_PADDING * 2 + 8) * props.viewport.zoom,
      ),
    };
  }

  const inlineEditorStyle = getInlineEditorStyle();

  return (
    <div
      ref={containerRef}
      className="logical-canvas-panel transformation-canvas-panel"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleCanvasWheel}
    >
      <svg className="logical-canvas" role="img" aria-label="Canvas Logico con trasformazione in-place">
        <defs>
          <marker
            id="logical-arrow"
            markerWidth="9"
            markerHeight="9"
            refX="7.8"
            refY="4.5"
            orient="auto"
            markerUnits="userSpaceOnUse"
          >
            <path d="M0 0 L9 4.5 L0 9 z" fill="context-stroke" />
          </marker>
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
            onPointerDown={handleBackgroundPointerDown}
          />

          {erEdges.map((edge) => {
            const sourceNode = syntheticNodeById.get(edge.sourceId);
            const targetNode = syntheticNodeById.get(edge.targetId);
            if (!sourceNode || !targetNode) {
              return null;
            }

            const syntheticEdge: DiagramEdge =
              edge.renderType === "inheritance"
                ? {
                    id: edge.id,
                    type: "inheritance",
                    sourceId: edge.sourceId,
                    targetId: edge.targetId,
                    label: edge.label,
                    lineStyle: edge.lineStyle ?? "solid",
                    manualOffset: edge.manualOffset,
                    isaDisjointness: edge.isaDisjointness,
                    isaCompleteness: edge.isaCompleteness,
                  }
                : edge.renderType === "connector"
                  ? {
                      id: edge.id,
                      type: "connector",
                      sourceId: edge.sourceId,
                      targetId: edge.targetId,
                      label: edge.label,
                      lineStyle: edge.lineStyle ?? "solid",
                      manualOffset: edge.manualOffset,
                    }
                  : {
                      id: edge.id,
                      type: "attribute",
                      sourceId: edge.sourceId,
                      targetId: edge.targetId,
                      label: edge.label,
                      lineStyle: edge.lineStyle ?? "solid",
                      manualOffset: edge.manualOffset,
                    };

            const selected = props.selection.edgeId === edge.id;
            const stepHighlighted = hasAnyTargetKey(edge, props.activeTargetKeys);
            const focusHighlighted = intersectingTargetKey(edge, props.focusedTargetKey);

            return (
              <g
                key={edge.id}
                className={[
                  "transformation-er-edge",
                  `status-${edge.status}`,
                  stepHighlighted ? "step-highlight" : "",
                  focusHighlighted ? "focus-highlight" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <DiagramEdgeView
                  edge={syntheticEdge}
                  sourceNode={sourceNode}
                  targetNode={targetNode}
                  displayLabelOverride={edge.cardinalityLabel}
                  selected={selected}
                  dragging={false}
                  focused={focusHighlighted || stepHighlighted}
                  focusable
                  validationLevel={edge.status === "invalid" ? "error" : undefined}
                  onFocus={() => props.onSelectionChange({ nodeId: null, columnId: null, edgeId: edge.id })}
                  onBlur={() => undefined}
                  onPointerDown={(event) => handleErEdgePointerDown(event, edge)}
                  onLabelPointerDown={(event) => handleErEdgeLabelPointerDown(event, edge)}
                  onDoubleClick={() => undefined}
                />
              </g>
            );
          })}

          {fkEdges.map((edge) => {
            const route = routeByEdgeId.get(edge.id);
            if (!route) {
              return null;
            }

            const selected = props.selection.edgeId === edge.id;
            const stepHighlighted = hasAnyTargetKey(edge, props.activeTargetKeys);
            const focusHighlighted = intersectingTargetKey(edge, props.focusedTargetKey);
            const edgePath = pathFromOrthogonalPoints(route.points);
            const edgeStrokeWidth = getDesignerLogicalEdgeStrokeWidth(
              selected,
              stepHighlighted,
              focusHighlighted,
            );
            const showEdgeLabel =
              edge.label.trim().length > 0 &&
              shouldRenderDesignerLogicalEdgeLabel(selected, focusHighlighted);

            return (
              <g
                key={edge.id}
                className={[
                  "logical-edge",
                  selected ? "selected" : "",
                  stepHighlighted ? "highlighted" : "",
                  focusHighlighted ? "focus-highlight" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onPointerDown={(event) => handleLogicalEdgePointerDown(event, edge)}
              >
                <path
                  d={edgePath}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  vectorEffect="non-scaling-stroke"
                />
                <path
                  d={edgePath}
                  fill="none"
                  stroke="var(--logical-edge-stroke)"
                  strokeWidth={edgeStrokeWidth}
                  markerEnd="url(#logical-arrow)"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                  vectorEffect="non-scaling-stroke"
                />
                {showEdgeLabel ? (
                  <text
                    x={route.labelPoint.x}
                    y={route.labelPoint.y - 8}
                    textAnchor="middle"
                    className="logical-edge-label"
                  >
                    {edge.label}
                  </text>
                ) : null}
              </g>
            );
          })}

          {erNodes.map((node) => {
            const selected = props.selection.nodeId === node.id;
            const stepHighlighted = hasAnyTargetKey(node, props.activeTargetKeys);
            const focusHighlighted = intersectingTargetKey(node, props.focusedTargetKey);

            return (
              <g
                key={node.id}
                className={[
                  "transformation-er-node",
                  `status-${node.status}`,
                  stepHighlighted ? "step-highlight" : "",
                  focusHighlighted ? "focus-highlight" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <DiagramNodeView
                  node={syntheticNodeById.get(node.id) as DiagramNode}
                  selected={selected}
                  dragging={false}
                  pending={stepHighlighted || focusHighlighted}
                  focused={focusHighlighted || stepHighlighted}
                  focusable
                  validationLevel={node.status === "invalid" ? "error" : undefined}
                  attributeDirection={attributeDirectionByNodeId.get(node.id)}
                  onFocus={() => props.onSelectionChange({ nodeId: node.id, columnId: null, edgeId: null })}
                  onBlur={() => undefined}
                  onPointerDown={(event) => handleErNodePointerDown(event, node)}
                  onDoubleClick={() => undefined}
                />
              </g>
            );
          })}

          {tableNodes.map((tableNode) => {
            const selected = props.selection.nodeId === tableNode.id;
            const columns = tableColumnsById.get(tableNode.tableId ?? tableNode.id) ?? [];
            const stepHighlighted = hasAnyTargetKey(tableNode, props.activeTargetKeys);
            const focusHighlighted = intersectingTargetKey(tableNode, props.focusedTargetKey);
            const hovering = hoverTableId === tableNode.id;

            return (
              <g
                key={tableNode.id}
                className={[
                  "logical-table",
                  "transformation-table",
                  selected ? "selected" : "",
                  stepHighlighted ? "step-highlight" : "",
                  focusHighlighted ? "focus-highlight" : "",
                  hovering ? "hover" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onPointerEnter={() => setHoverTableId(tableNode.id)}
                onPointerLeave={() => setHoverTableId((current) => (current === tableNode.id ? null : current))}
                onDoubleClick={(event) => startTableInlineEdit(event, tableNode)}
              >
                <g
                  tabIndex={0}
                  role="button"
                  aria-label={`Tabella ${tableNode.label}`}
                  onFocus={() => props.onSelectionChange({ nodeId: tableNode.id, columnId: null, edgeId: null })}
                  onBlur={(event: ReactFocusEvent<SVGGElement>) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                      setHoverTableId((current) => (current === tableNode.id ? null : current));
                    }
                  }}
                  onPointerDown={(event) => handleTableHeaderPointerDown(event, tableNode)}
                >
                  <rect
                    x={tableNode.x}
                    y={tableNode.y}
                    width={tableNode.width}
                    height={tableNode.height}
                    className="logical-table-body"
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={tableNode.x}
                    y={tableNode.y}
                    width={tableNode.width}
                    height={DESIGNER_TABLE_HEADER_HEIGHT}
                    className="logical-table-header"
                    vectorEffect="non-scaling-stroke"
                  />
                  <line
                    x1={tableNode.x}
                    y1={tableNode.y + DESIGNER_TABLE_HEADER_HEIGHT}
                    x2={tableNode.x + tableNode.width}
                    y2={tableNode.y + DESIGNER_TABLE_HEADER_HEIGHT}
                    className="logical-table-divider"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={tableNode.x + tableNode.width / 2}
                    y={tableNode.y + DESIGNER_TABLE_HEADER_HEIGHT / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="logical-table-title"
                  >
                    {tableNode.label}
                  </text>
                </g>

                {columns.map((column, rowIndex) => {
                  const rowY =
                    tableNode.y + DESIGNER_TABLE_HEADER_HEIGHT + rowIndex * DESIGNER_TABLE_ROW_HEIGHT;
                  const isSelectedColumn = props.selection.columnId === column.id;
                  const isTypeMenuColumn = props.typeMode && isSelectedColumn;
                  const typeLabel = getDesignerLogicalColumnTypeLabel(column);
                  const typeLockedByFk = isColumnTypeLockedByReference(column);

                  return (
                    <g
                      key={column.id}
                      className={[
                        "logical-column-row",
                        isSelectedColumn ? "selected" : "",
                        isTypeMenuColumn ? "type-editor-active" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onDoubleClick={(event) => startColumnInlineEdit(event, tableNode, column)}
                    >
                      <rect
                        x={tableNode.x + 1}
                        y={rowY}
                        width={tableNode.width - 2}
                        height={DESIGNER_TABLE_ROW_HEIGHT}
                        className="logical-column-hit"
                        onPointerDown={(event) => handleColumnPointerDown(event, tableNode, column)}
                      />
                      {rowIndex > 0 ? (
                        <line
                          x1={tableNode.x}
                          y1={rowY}
                          x2={tableNode.x + tableNode.width}
                          y2={rowY}
                          className="logical-column-divider"
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : null}

                      <text
                        x={tableNode.x + DESIGNER_TABLE_HORIZONTAL_PADDING}
                        y={rowY + DESIGNER_TABLE_ROW_HEIGHT / 2}
                        dominantBaseline="middle"
                        className={getDesignerLogicalColumnTextClassName(column)}
                        textDecoration={isColumnUnderlinedInDesignerTheme(column) ? "underline" : undefined}
                      >
                        {getDesignerLogicalColumnNameLabel(column)}
                      </text>

                      <text
                        x={tableNode.x + tableNode.width - DESIGNER_TABLE_HORIZONTAL_PADDING}
                        y={rowY + DESIGNER_TABLE_ROW_HEIGHT / 2}
                        dominantBaseline="middle"
                        textAnchor="end"
                        className={[
                          "logical-column-type",
                          typeLockedByFk ? "locked" : "",
                          isTypeMenuColumn ? "active" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {typeLabel}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="canvas-viewport-hud" aria-label="Controlli viewport Logico">
        <div className="canvas-hud-cluster canvas-hud-cluster-viewport">
          <button type="button" className="canvas-hud-button" onClick={() => zoomAroundCenter(1 / 1.14)}>
            -
          </button>
          <button type="button" className="canvas-hud-button canvas-hud-zoom" onClick={resetViewport}>
            {Math.round(props.viewport.zoom * 100)}%
          </button>
          <button type="button" className="canvas-hud-button" onClick={() => zoomAroundCenter(1.14)}>
            +
          </button>
          <button type="button" className="canvas-hud-button" onClick={fitToContent}>
            Adatta
          </button>
          <button type="button" className="canvas-hud-button" onClick={centerContent}>
            Centra
          </button>
          <button type="button" className="canvas-hud-button" onClick={resetViewport}>
            Reset
          </button>
        </div>
      </div>

      {inlineEdit && inlineEditorStyle ? (
        <form
          className="inline-editor"
          style={inlineEditorStyle}
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
