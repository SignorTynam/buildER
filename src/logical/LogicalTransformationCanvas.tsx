import { useEffect, useMemo, useRef, useState } from "react";
import type {
  FocusEvent as ReactFocusEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  WheelEvent as ReactWheelEvent,
} from "react";
import { DiagramIdentifierOverlay } from "../canvas/DiagramCanvas";
import { DiagramEdgeView } from "../canvas/DiagramEdge";
import { DiagramNodeView } from "../canvas/DiagramNode";
import { StudioIcon } from "../components/icons/StudioIcon";
import type { Bounds, DiagramDocument, DiagramEdge, DiagramNode, Point, Viewport } from "../types/diagram";
import type {
  LogicalColumn,
  LogicalSelection,
  LogicalTransformationEdge,
  LogicalTransformationNode,
  VersionLogicalHighlights,
  LogicalWorkspaceDocument,
} from "../types/logical";
import {
  MAX_ZOOM,
  clientPointFromWorld,
} from "../utils/geometry";
import {
  formatSqlType,
  isColumnTypeLockedByReference,
  type LogicalColumnSqlPatch,
} from "../utils/logicalSqlMetadata";
import {
  getMultivaluedAttributeSize,
  getPreferredNodeSizeForLabel,
} from "../utils/diagram";
import {
  chooseLogicalForeignKeyLabelPlacement,
  type LogicalFkLabelPlacement,
  type LogicalFkLabelReservedBox,
} from "../utils/logicalForeignKeyLabelLayout";

interface LogicalTransformationCanvasProps {
  sourceDiagram: DiagramDocument;
  workspace: LogicalWorkspaceDocument;
  selection: LogicalSelection;
  viewport: Viewport;
  svgRef?: RefObject<SVGSVGElement>;
  showForeignKeyLabels: boolean;
  typeMode: boolean;
  fitRequestToken: number;
  autoFitOnMount?: boolean;
  activeTargetKeys: string[];
  focusedTargetKey: string | null;
  viewMode?: LogicalTransformationCanvasMode;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: LogicalSelection) => void;
  onPreviewModel: (model: LogicalWorkspaceDocument["model"]) => void;
  onCommitModel: (nextModel: LogicalWorkspaceDocument["model"], previousModel: LogicalWorkspaceDocument["model"]) => void;
  onRenameTable: (tableId: string, nextName: string) => void;
  onRenameColumn: (tableId: string, columnId: string, nextName: string) => void;
  onUpdateColumnSql: (tableId: string, columnId: string, patch: LogicalColumnSqlPatch) => void;
  versionHighlights?: VersionLogicalHighlights;
  readOnly?: boolean;
}

type ConnectionSide = "left" | "right" | "top" | "bottom";
export type LogicalTransformationCanvasMode = "transformation" | "schema";

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

function resolveLogicalVersionHighlight(
  id: string,
  highlights: VersionLogicalHighlights | undefined,
  kind: "table" | "column" | "foreign-key" | "edge",
): "added" | "removed" | "modified" | undefined {
  if (!highlights) {
    return undefined;
  }

  if (kind === "table") {
    if (highlights.focusedTableId === id) {
      return "modified";
    }
    if (highlights.addedTableIds.includes(id)) {
      return "added";
    }
    if (highlights.removedTableIds.includes(id)) {
      return "removed";
    }
    return highlights.modifiedTableIds.includes(id) ? "modified" : undefined;
  }

  if (kind === "column") {
    if (highlights.focusedColumnId === id) {
      return "modified";
    }
    if (highlights.addedColumnIds.includes(id)) {
      return "added";
    }
    if (highlights.removedColumnIds.includes(id)) {
      return "removed";
    }
    return highlights.modifiedColumnIds.includes(id) ? "modified" : undefined;
  }

  if (kind === "foreign-key") {
    if (highlights.focusedForeignKeyId === id) {
      return "modified";
    }
    if (highlights.addedForeignKeyIds.includes(id)) {
      return "added";
    }
    if (highlights.removedForeignKeyIds.includes(id)) {
      return "removed";
    }
    return highlights.modifiedForeignKeyIds.includes(id) ? "modified" : undefined;
  }

  if (highlights.addedEdgeIds.includes(id)) {
    return "added";
  }
  if (highlights.removedEdgeIds.includes(id)) {
    return "removed";
  }
  return highlights.modifiedEdgeIds.includes(id) ? "modified" : undefined;
}

const WORLD_EXTENT = 9200;
const ROUTE_EXIT_OFFSET = 18;
const LANE_STEP = 14;
const VIEWPORT_PADDING = 140;
const LOGICAL_MIN_ZOOM = 0.18;
const LOGICAL_FIT_LEFT_INSET = 150;
const LOGICAL_FIT_RIGHT_INSET = 72;
const LOGICAL_FIT_VERTICAL_INSET = 72;
const EDGE_BOUNDS_PADDING = 24;
const DESIGNER_TABLE_MIN_WIDTH = 180;
const DESIGNER_TABLE_MAX_WIDTH = 860;
const DESIGNER_TABLE_HEADER_HEIGHT = 36;
const DESIGNER_TABLE_ROW_HEIGHT = 34;
const DESIGNER_TABLE_HORIZONTAL_PADDING = 18;
const DESIGNER_TABLE_INLINE_EDITOR_TOP = 6;
const DESIGNER_EDGE_DEFAULT_STROKE_WIDTH = 1.2;
const DESIGNER_EDGE_ACTIVE_STROKE_WIDTH = 1.45;
const DESIGNER_EDGE_SELECTED_STROKE_WIDTH = 1.7;
const DESIGNER_FK_LABEL_MIN_HEIGHT = 26;
const DESIGNER_FK_LABEL_LINE_HEIGHT = 13;
const DESIGNER_FK_LABEL_MAX_WIDTH = 240;
const DESIGNER_FK_LABEL_PADDING_X = 9;
const DESIGNER_FK_LABEL_BADGE_WIDTH = 28;
const DESIGNER_FK_LABEL_BADGE_GAP = 8;
const DESIGNER_FK_LABEL_BADGE_HEIGHT = 18;
const DESIGNER_COLUMN_TYPE_GAP = 32;
const DESIGNER_QUALIFIER_BADGE_HEIGHT = 18;
const DESIGNER_QUALIFIER_BADGE_PADDING_X = 6;
const DESIGNER_QUALIFIER_BADGE_GAP = 6;
const DESIGNER_QUALIFIER_BADGE_TEXT_GAP = 8;
const DESIGNER_QUALIFIER_CHAR_WIDTH = 7.2;
const DESIGNER_COLUMN_NAME_UNDERLINE_Y = 11;

function clampDesignerDimension(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clampLogicalTransformationZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(LOGICAL_MIN_ZOOM, zoom));
}

export function getLogicalTransformationFitFrame(rect: Pick<DOMRect, "width" | "height">): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const left = Math.min(LOGICAL_FIT_LEFT_INSET, rect.width * 0.25);
  const right = Math.min(LOGICAL_FIT_RIGHT_INSET, rect.width * 0.12);
  const top = Math.min(LOGICAL_FIT_VERTICAL_INSET, rect.height * 0.12);
  const bottom = Math.min(LOGICAL_FIT_VERTICAL_INSET, rect.height * 0.12);

  return {
    x: left,
    y: top,
    width: Math.max(1, rect.width - left - right),
    height: Math.max(1, rect.height - top - bottom),
  };
}

function estimateDesignerTextWidth(value: string, variant: "title" | "column" | "type"): number {
  const normalized = value.trim();
  const charWidth = variant === "title" ? 10.8 : variant === "type" ? 7.4 : 9.4;
  return normalized.length * charWidth;
}

function estimateDesignerQualifierTextWidth(value: string): number {
  const normalized = value.trim();
  return normalized.length * DESIGNER_QUALIFIER_CHAR_WIDTH;
}

function getDesignerLogicalColumnQualifierBadgeWidth(label: string): number {
  return estimateDesignerQualifierTextWidth(label) + DESIGNER_QUALIFIER_BADGE_PADDING_X * 2;
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

function getDesignerLogicalColumnQualifierWidth(qualifiers: string[]): number {
  if (qualifiers.length === 0) {
    return 0;
  }

  return qualifiers.reduce((sum, label, index) => {
    const gap = index < qualifiers.length - 1 ? DESIGNER_QUALIFIER_BADGE_GAP : 0;
    return sum + getDesignerLogicalColumnQualifierBadgeWidth(label) + gap;
  }, 0);
}

function getDesignerLogicalColumnNameOffset(qualifiers: string[]): number {
  if (qualifiers.length === 0) {
    return 0;
  }

  return getDesignerLogicalColumnQualifierWidth(qualifiers) + DESIGNER_QUALIFIER_BADGE_TEXT_GAP;
}

function getDesignerLogicalColumnLabelWidth(column: LogicalColumn): number {
  const qualifiers = getDesignerLogicalColumnQualifierLabels(column);
  return getDesignerLogicalColumnNameOffset(qualifiers) + estimateDesignerTextWidth(column.name, "column");
}

export function getDesignerLogicalColumnNameUnderlineLayout(column: LogicalColumn): {
  visible: boolean;
  x1: number;
  x2: number;
  y: number;
} {
  const qualifiers = getDesignerLogicalColumnQualifierLabels(column);
  const layout = getDesignerLogicalColumnQualifierLayout(qualifiers);

  return {
    visible: column.isPrimaryKey === true,
    x1: layout.textOffset,
    x2: layout.textOffset + estimateDesignerTextWidth(column.name, "column"),
    y: DESIGNER_COLUMN_NAME_UNDERLINE_Y,
  };
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
              getDesignerLogicalColumnLabelWidth(column) +
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

function getDesignerLogicalColumnTextClassName(): string {
  return "logical-column-name";
}

export function getDesignerLogicalColumnQualifierLayout(qualifiers: string[]): {
  items: { label: string; x: number; width: number }[];
  textOffset: number;
} {
  let offset = 0;
  const items = qualifiers.map((label, index) => {
    const width = getDesignerLogicalColumnQualifierBadgeWidth(label);
    const item = { label, x: offset, width };
    offset += width + (index < qualifiers.length - 1 ? DESIGNER_QUALIFIER_BADGE_GAP : 0);
    return item;
  });

  const textOffset = qualifiers.length > 0 ? offset + DESIGNER_QUALIFIER_BADGE_TEXT_GAP : 0;

  return { items, textOffset };
}

export function getLogicalTransformationCanvasVisibility(
  nodes: LogicalTransformationNode[],
  edges: LogicalTransformationEdge[],
  viewMode: LogicalTransformationCanvasMode,
): {
  erNodes: LogicalTransformationNode[];
  tableNodes: LogicalTransformationNode[];
  visibleNodes: LogicalTransformationNode[];
  erEdges: LogicalTransformationEdge[];
  fkEdges: LogicalTransformationEdge[];
} {
  const showTransformationContext = viewMode === "transformation";
  const tableNodes = nodes.filter((node) => node.kind === "logical-table");
  const erNodes = showTransformationContext
    ? nodes.filter((node) => node.kind === "er-node" && node.status !== "transformed")
    : [];
  const visibleErNodeIds = new Set(erNodes.map((node) => node.id));
  const tableNodeIdBySourceNodeId = new Map(
    tableNodes
      .filter((node) => typeof node.sourceNodeId === "string")
      .map((node) => [node.sourceNodeId as string, node.id] as const),
  );
  const erEdges = showTransformationContext
    ? edges.flatMap((edge) => {
        if (edge.kind !== "er-edge" || edge.status === "transformed") {
          return [];
        }

        const sourceId = visibleErNodeIds.has(edge.sourceId)
          ? edge.sourceId
          : tableNodeIdBySourceNodeId.get(edge.sourceId);
        const targetId = visibleErNodeIds.has(edge.targetId)
          ? edge.targetId
          : tableNodeIdBySourceNodeId.get(edge.targetId);

        return sourceId && targetId
          ? [
              {
                ...edge,
                sourceId,
                targetId,
              },
            ]
          : [];
      })
    : [];

  return {
    erNodes,
    tableNodes,
    visibleNodes: showTransformationContext ? [...erNodes, ...tableNodes] : tableNodes,
    erEdges,
    fkEdges: edges.filter((edge) => edge.kind === "foreign-key"),
  };
}

function renderDesignerLogicalColumnLabel(column: LogicalColumn, x: number, y: number) {
  const qualifiers = getDesignerLogicalColumnQualifierLabels(column);
  const layout = getDesignerLogicalColumnQualifierLayout(qualifiers);
  const underline = getDesignerLogicalColumnNameUnderlineLayout(column);

  return (
    <g transform={`translate(${x}, ${y})`} className="logical-column-label" pointerEvents="none">
      {layout.items.map((item) => (
        <g key={`${item.label}-${item.x}`} transform={`translate(${item.x}, 0)`}>
          <rect
            x={0}
            y={-DESIGNER_QUALIFIER_BADGE_HEIGHT / 2}
            width={item.width}
            height={DESIGNER_QUALIFIER_BADGE_HEIGHT}
            rx={8}
            ry={8}
            className={`logical-column-qualifier-badge logical-column-qualifier-badge-${item.label.toLowerCase()}`}
          />
          <text
            x={item.width / 2}
            y={0}
            dominantBaseline="middle"
            textAnchor="middle"
            className={`logical-column-qualifier logical-column-qualifier-${item.label.toLowerCase()}`}
          >
            {item.label}
          </text>
        </g>
      ))}
      <text x={layout.textOffset} y={0} dominantBaseline="middle" className={getDesignerLogicalColumnTextClassName()}>
        {column.name}
      </text>
      {underline.visible ? (
        <line
          x1={underline.x1}
          y1={underline.y}
          x2={underline.x2}
          y2={underline.y}
          className="logical-column-name-underline"
          vectorEffect="non-scaling-stroke"
        />
      ) : null}
    </g>
  );
}

export interface DesignerLogicalForeignKeyLabel {
  fullLabel: string;
  displayLabel: string;
}

export function getDesignerLogicalForeignKeyLabel(
  edge: Pick<LogicalTransformationEdge, "foreignKeyId" | "label">,
  model: LogicalWorkspaceDocument["model"],
): DesignerLogicalForeignKeyLabel {
  const fallback = edge.label.trim();
  const foreignKey = edge.foreignKeyId
    ? model.foreignKeys.find((candidate) => candidate.id === edge.foreignKeyId)
    : undefined;

  if (!foreignKey) {
    return { fullLabel: fallback, displayLabel: fallback };
  }

  const fromTable = model.tables.find((table) => table.id === foreignKey.fromTableId);
  const toTable = model.tables.find((table) => table.id === foreignKey.toTableId);
  if (!fromTable || !toTable) {
    return { fullLabel: fallback, displayLabel: fallback };
  }

  const pairs = foreignKey.mappings.flatMap((mapping) => {
    const fromColumn = fromTable.columns.find((column) => column.id === mapping.fromColumnId);
    const toColumn = toTable.columns.find((column) => column.id === mapping.toColumnId);
    return fromColumn && toColumn ? [{ fromColumn, toColumn }] : [];
  });

  if (pairs.length === 0) {
    return { fullLabel: fallback, displayLabel: fallback };
  }

  const fullLabel =
    pairs.length === 1
      ? `${pairs[0].fromColumn.name} -> ${toTable.name}.${pairs[0].toColumn.name}`
      : `${pairs.map((pair) => pair.fromColumn.name).join(", ")} -> ${toTable.name}(${pairs
          .map((pair) => pair.toColumn.name)
          .join(", ")})`;

  return { fullLabel, displayLabel: fullLabel };
}

export function shouldRenderDesignerLogicalEdgeLabel(
  selected: boolean,
  focusHighlighted: boolean,
  forceVisible: boolean,
): boolean {
  return forceVisible || selected || focusHighlighted;
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

function getBoundsForNodes(nodes: LogicalTransformationNode[]): Bounds | null {
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
  labelBounds: Bounds[] = [],
): Bounds | null {
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
  });

  function includeBounds(bounds: Bounds) {
    minX = Math.min(minX, bounds.x);
    minY = Math.min(minY, bounds.y);
    maxX = Math.max(maxX, bounds.x + bounds.width);
    maxY = Math.max(maxY, bounds.y + bounds.height);
  }

  labelBounds.forEach((bounds) => {
    includeBounds(bounds);
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

export function buildLogicalFkLabelReservedBoxes(
  nodes: LogicalTransformationNode[],
  padding = 12,
): LogicalFkLabelReservedBox[] {
  return nodes.map((node) => ({
    id: node.id,
    kind: node.kind === "logical-table" ? "table" : "shape",
    x: node.x - padding,
    y: node.y - padding,
    width: node.width + padding * 2,
    height: node.height + padding * 2,
  }));
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

export function toSyntheticDiagramNode(node: LogicalTransformationNode, sourceNode?: DiagramNode): DiagramNode {
  if (node.kind === "er-node" && sourceNode) {
    return {
      ...sourceNode,
      label: node.label,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    };
  }

  const center = {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };

  if (node.renderType === "relationship") {
    const size = getPreferredNodeSizeForLabel("relationship", node.label);
    return {
      id: node.id,
      type: "relationship",
      label: node.label,
      x: center.x - size.width / 2,
      y: center.y - size.height / 2,
      width: size.width,
      height: size.height,
    };
  }

  if (node.renderType === "attribute" || node.renderType === "multivalued-attribute") {
    const size =
      node.renderType === "multivalued-attribute"
        ? getMultivaluedAttributeSize(node.label)
        : getPreferredNodeSizeForLabel("attribute", node.label);
    return {
      id: node.id,
      type: "attribute",
      label: node.label,
      x: center.x - size.width / 2,
      y: center.y - size.height / 2,
      width: size.width,
      height: size.height,
      isMultivalued: node.renderType === "multivalued-attribute",
    };
  }

  const size = getPreferredNodeSizeForLabel("entity", node.label);
  return {
    id: node.id,
    type: "entity",
    label: node.label,
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
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
  const fitEffectMountedRef = useRef(false);
  const [interaction, setInteraction] = useState<InteractionState>({ kind: "idle" });
  const [inlineEdit, setInlineEdit] = useState<InlineEditState>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [hoverTableId, setHoverTableId] = useState<string | null>(null);
  const readOnly = props.readOnly === true;

  const graph = props.workspace.transformation;
  const viewMode = props.viewMode ?? "transformation";
  const sourceNodeById = useMemo(
    () => new Map(props.sourceDiagram.nodes.map((node) => [node.id, node])),
    [props.sourceDiagram.nodes],
  );
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
  const visibleElements = useMemo(
    () => getLogicalTransformationCanvasVisibility(renderedNodes, graph.edges, viewMode),
    [graph.edges, renderedNodes, viewMode],
  );
  const { erNodes, tableNodes, visibleNodes: visibleRenderedNodes, erEdges, fkEdges } = visibleElements;
  const syntheticNodeById = useMemo(
    () => new Map(renderedNodes.map((node) => [node.id, toSyntheticDiagramNode(node, sourceNodeById.get(node.sourceNodeId ?? node.id))])),
    [renderedNodes, sourceNodeById],
  );
  const visibleErDiagram = useMemo(() => {
    const visibleSourceNodeIds = new Set(
      erNodes
        .map((node) => node.sourceNodeId ?? node.id)
        .filter((nodeId): nodeId is string => typeof nodeId === "string"),
    );
    const visibleSourceEdgeIds = new Set(
      erEdges
        .map((edge) => edge.sourceEdgeId ?? edge.id)
        .filter((edgeId): edgeId is string => typeof edgeId === "string"),
    );

    return {
      ...props.sourceDiagram,
      nodes: props.sourceDiagram.nodes.filter((node) => visibleSourceNodeIds.has(node.id)),
      edges: props.sourceDiagram.edges.filter((edge) => visibleSourceEdgeIds.has(edge.id)),
      generalizationGroups: (props.sourceDiagram.generalizationGroups ?? [])
        .map((group) => ({
          ...group,
          subtypeIds: group.subtypeIds.filter((subtypeId) => visibleSourceNodeIds.has(subtypeId)),
        }))
        .filter((group) => visibleSourceNodeIds.has(group.supertypeId) && group.subtypeIds.length > 0),
    };
  }, [erEdges, erNodes, props.sourceDiagram]);

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

  const foreignKeyLabelPlacementByEdgeId = useMemo(() => {
    const placements = new Map<string, LogicalFkLabelPlacement>();
    const reservedBoxes = buildLogicalFkLabelReservedBoxes(visibleRenderedNodes, 12);
    const alreadyPlacedBoxes: LogicalFkLabelReservedBox[] = [];

    fkEdges.forEach((edge) => {
      const route = routeByEdgeId.get(edge.id);
      if (!route) {
        return;
      }

      const selected = props.selection.edgeId === edge.id;
      const focusHighlighted = intersectingTargetKey(edge, props.focusedTargetKey);
      const edgeLabel = getDesignerLogicalForeignKeyLabel(edge, props.workspace.model);
      const shouldShow =
        edgeLabel.fullLabel.trim().length > 0 &&
        shouldRenderDesignerLogicalEdgeLabel(selected, focusHighlighted, props.showForeignKeyLabels);

      if (!shouldShow) {
        return;
      }

      const placement = chooseLogicalForeignKeyLabelPlacement({
        edgeId: edge.id,
        routePoints: route.points,
        defaultPoint: route.labelPoint,
        fullLabel: edgeLabel.fullLabel,
        reservedBoxes,
        alreadyPlacedBoxes,
        maxWidth: DESIGNER_FK_LABEL_MAX_WIDTH,
        maxLines: edgeLabel.fullLabel.length > 48 ? 3 : 2,
      });

      placements.set(edge.id, placement);
      alreadyPlacedBoxes.push({
        id: `${edge.id}:fk-label`,
        kind: "label",
        ...placement.bounds,
        x: placement.bounds.x - 6,
        y: placement.bounds.y - 6,
        width: placement.bounds.width + 12,
        height: placement.bounds.height + 12,
      });
    });

    return placements;
  }, [
    fkEdges,
    routeByEdgeId,
    visibleRenderedNodes,
    props.selection.edgeId,
    props.focusedTargetKey,
    props.showForeignKeyLabels,
    props.workspace.model,
  ]);

  const visibleFkLabelBounds = useMemo(
    () => [...foreignKeyLabelPlacementByEdgeId.values()].map((placement) => placement.bounds),
    [foreignKeyLabelPlacementByEdgeId],
  );

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

    const bounds = getBoundsForVisibleContent(visibleRenderedNodes, [...routeByEdgeId.values()], visibleFkLabelBounds);
    if (!bounds) {
      return false;
    }

    const frame = getLogicalTransformationFitFrame(rect);
    const paddedWidth = Math.max(1, bounds.width + VIEWPORT_PADDING * 2);
    const paddedHeight = Math.max(1, bounds.height + VIEWPORT_PADDING * 2);
    const nextZoom = clampLogicalTransformationZoom(Math.min(frame.width / paddedWidth, frame.height / paddedHeight));
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    props.onViewportChange({
      zoom: nextZoom,
      x: frame.x + frame.width / 2 - centerX * nextZoom,
      y: frame.y + frame.height / 2 - centerY * nextZoom,
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
    if (!fitEffectMountedRef.current) {
      fitEffectMountedRef.current = true;
      if (props.autoFitOnMount === false) {
        return;
      }
    }

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

      if (fitRetryFrameRef.current != null || props.viewport.zoom <= LOGICAL_MIN_ZOOM + 0.001) {
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

    const bounds = getBoundsForVisibleContent(visibleRenderedNodes, [...routeByEdgeId.values()], visibleFkLabelBounds);
    if (!bounds) {
      return;
    }

    const frame = getLogicalTransformationFitFrame(rect);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    props.onViewportChange({
      ...props.viewport,
      x: frame.x + frame.width / 2 - centerX * props.viewport.zoom,
      y: frame.y + frame.height / 2 - centerY * props.viewport.zoom,
    });
  }

  function resetViewport() {
    const rect = getViewportRect();
    if (!rect || !hasUsableViewportRect(rect)) {
      return;
    }

    const bounds = getBoundsForVisibleContent(visibleRenderedNodes, [...routeByEdgeId.values()], visibleFkLabelBounds);
    if (!bounds) {
      props.onViewportChange({
        x: getLogicalTransformationFitFrame(rect).x + getLogicalTransformationFitFrame(rect).width / 2,
        y: getLogicalTransformationFitFrame(rect).y + getLogicalTransformationFitFrame(rect).height / 2,
        zoom: 1,
      });
      return;
    }

    const frame = getLogicalTransformationFitFrame(rect);
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;
    props.onViewportChange({
      zoom: 1,
      x: frame.x + frame.width / 2 - centerX,
      y: frame.y + frame.height / 2 - centerY,
    });
  }

  function zoomAroundCenter(factor: number) {
    if (!containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const nextZoom = clampLogicalTransformationZoom(props.viewport.zoom * factor);
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
    const nextZoom = clampLogicalTransformationZoom(props.viewport.zoom * zoomFactor);
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
    if (readOnly) {
      props.onSelectionChange({ nodeId: tableNode.id, columnId: null, edgeId: null });
      return;
    }

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

    if (readOnly) {
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

    if (!readOnly && interaction.kind === "drag") {
      props.onCommitModel(props.workspace.model, interaction.originalModel);
    }

    setInteraction({ kind: "idle" });
  }

  function startTableInlineEdit(event: MouseEvent<SVGGElement>, tableNode: LogicalTransformationNode) {
    event.stopPropagation();
    if (readOnly) {
      return;
    }
    setInlineEdit({ kind: "table", tableId: tableNode.id, value: tableNode.label });
  }

  function startColumnInlineEdit(
    event: MouseEvent<SVGGElement>,
    tableNode: LogicalTransformationNode,
    column: LogicalColumn,
  ) {
    event.stopPropagation();
    if (readOnly) {
      return;
    }
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
      <svg
        ref={props.svgRef}
        className="logical-canvas"
        role="img"
        aria-label="Canvas Logico con trasformazione in-place"
        data-readonly={readOnly ? "true" : undefined}
      >
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

        <g data-export-world="true" transform={`translate(${props.viewport.x}, ${props.viewport.y}) scale(${props.viewport.zoom})`}>
          <rect
            data-export-background="true"
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

          <g className="logical-edge-path-layer">
            {fkEdges.map((edge) => {
              const route = routeByEdgeId.get(edge.id);
              if (!route) {
                return null;
              }

              const selected = props.selection.edgeId === edge.id;
              const stepHighlighted = hasAnyTargetKey(edge, props.activeTargetKeys);
              const focusHighlighted = intersectingTargetKey(edge, props.focusedTargetKey);
              const versionHighlight = resolveLogicalVersionHighlight(
                edge.foreignKeyId ?? edge.id,
                props.versionHighlights,
                edge.foreignKeyId ? "foreign-key" : "edge",
              );
              const versionFocused =
                props.versionHighlights?.focusedForeignKeyId === (edge.foreignKeyId ?? edge.id);
              const edgePath = pathFromOrthogonalPoints(route.points);
              const edgeStrokeWidth = getDesignerLogicalEdgeStrokeWidth(
                selected,
                stepHighlighted,
                focusHighlighted || versionFocused,
              );

              return (
                <g
                  key={edge.id}
                  className={[
                    "logical-edge",
                    selected ? "selected" : "",
                    stepHighlighted ? "highlighted" : "",
                    focusHighlighted || versionFocused ? "focus-highlight" : "",
                    versionHighlight ? `version-highlight-${versionHighlight}` : "",
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
                </g>
              );
            })}
          </g>

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

          {viewMode === "transformation" ? <DiagramIdentifierOverlay diagram={visibleErDiagram} /> : null}

          {tableNodes.map((tableNode) => {
            const selected = props.selection.nodeId === tableNode.id;
            const columns = tableColumnsById.get(tableNode.tableId ?? tableNode.id) ?? [];
            const stepHighlighted = hasAnyTargetKey(tableNode, props.activeTargetKeys);
            const focusHighlighted = intersectingTargetKey(tableNode, props.focusedTargetKey);
            const tableId = tableNode.tableId ?? tableNode.id;
            const versionHighlight = resolveLogicalVersionHighlight(tableId, props.versionHighlights, "table");
            const versionFocused = props.versionHighlights?.focusedTableId === tableId;
            const hovering = hoverTableId === tableNode.id;

            return (
              <g
                key={tableNode.id}
                className={[
                  "logical-table",
                  "transformation-table",
                  selected ? "selected" : "",
                  stepHighlighted ? "step-highlight" : "",
                  focusHighlighted || versionFocused ? "focus-highlight" : "",
                  versionHighlight ? `version-highlight-${versionHighlight}` : "",
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
                  const columnKey = `${tableId}.${column.id}`;
                  const columnVersionHighlight = resolveLogicalVersionHighlight(
                    columnKey,
                    props.versionHighlights,
                    "column",
                  );
                  const columnVersionFocused = props.versionHighlights?.focusedColumnId === columnKey;
                  const typeLabel = getDesignerLogicalColumnTypeLabel(column);
                  const typeLockedByFk = isColumnTypeLockedByReference(column);

                  return (
                    <g
                      key={column.id}
                      className={[
                        "logical-column-row",
                        isSelectedColumn ? "selected" : "",
                        columnVersionFocused ? "focus-highlight" : "",
                        isTypeMenuColumn ? "type-editor-active" : "",
                        columnVersionHighlight ? `version-highlight-${columnVersionHighlight}` : "",
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

                      {renderDesignerLogicalColumnLabel(
                        column,
                        tableNode.x + DESIGNER_TABLE_HORIZONTAL_PADDING,
                        rowY + DESIGNER_TABLE_ROW_HEIGHT / 2,
                      )}

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

          <g className="logical-edge-label-layer">
            {fkEdges.map((edge) => {
              const placement = foreignKeyLabelPlacementByEdgeId.get(edge.id);
              if (!placement) {
                return null;
              }

              const selected = props.selection.edgeId === edge.id;
              const stepHighlighted = hasAnyTargetKey(edge, props.activeTargetKeys);
              const focusHighlighted = intersectingTargetKey(edge, props.focusedTargetKey);
              const versionHighlight = resolveLogicalVersionHighlight(
                edge.foreignKeyId ?? edge.id,
                props.versionHighlights,
                edge.foreignKeyId ? "foreign-key" : "edge",
              );
              const versionFocused =
                props.versionHighlights?.focusedForeignKeyId === (edge.foreignKeyId ?? edge.id);
              const chipX = placement.bounds.x;
              const chipY = placement.bounds.y;
              const chipHeight = Math.max(DESIGNER_FK_LABEL_MIN_HEIGHT, placement.height);
              const badgeY = chipY + (chipHeight - DESIGNER_FK_LABEL_BADGE_HEIGHT) / 2;
              const textX =
                chipX +
                DESIGNER_FK_LABEL_PADDING_X +
                DESIGNER_FK_LABEL_BADGE_WIDTH +
                DESIGNER_FK_LABEL_BADGE_GAP;
              const firstLineY =
                chipY +
                chipHeight / 2 -
                ((placement.lines.length - 1) * DESIGNER_FK_LABEL_LINE_HEIGHT) / 2;

              return (
                <g
                  key={`${edge.id}:fk-label`}
                  className={[
                    "logical-edge-label-chip",
                    selected ? "selected" : "",
                    stepHighlighted ? "highlighted" : "",
                    focusHighlighted || versionFocused ? "focus-highlight" : "",
                    versionHighlight ? `version-highlight-${versionHighlight}` : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={`Foreign key ${placement.fullLabel}`}
                  onPointerDown={(event) => handleLogicalEdgePointerDown(event, edge)}
                >
                  <title>{placement.fullLabel}</title>
                  <rect
                    x={chipX}
                    y={chipY}
                    width={placement.width}
                    height={chipHeight}
                    rx={8}
                    ry={8}
                    className="logical-edge-label-chip-bg"
                    vectorEffect="non-scaling-stroke"
                  />
                  <rect
                    x={chipX + DESIGNER_FK_LABEL_PADDING_X}
                    y={badgeY}
                    width={DESIGNER_FK_LABEL_BADGE_WIDTH}
                    height={DESIGNER_FK_LABEL_BADGE_HEIGHT}
                    rx={6}
                    ry={6}
                    className="logical-edge-label-chip-badge"
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={chipX + DESIGNER_FK_LABEL_PADDING_X + DESIGNER_FK_LABEL_BADGE_WIDTH / 2}
                    y={chipY + chipHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="logical-edge-label-chip-badge-text"
                  >
                    FK
                  </text>
                  <text
                    x={textX}
                    y={firstLineY}
                    dominantBaseline="middle"
                    className="logical-edge-label-chip-text"
                  >
                    {placement.lines.map((line, index) => (
                      <tspan
                        key={`${edge.id}-line-${index}`}
                        x={textX}
                        dy={index === 0 ? 0 : DESIGNER_FK_LABEL_LINE_HEIGHT}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      <div className="canvas-viewport-hud" aria-label="Controlli viewport Logico">
        <div className="canvas-hud-cluster canvas-hud-cluster-viewport">
          <button type="button" className="canvas-hud-button canvas-hud-button-zoom-control" onClick={() => zoomAroundCenter(1 / 1.14)} aria-label="Riduci zoom">
            <StudioIcon name="zoomOut" aria-hidden="true" />
          </button>
          <button type="button" className="canvas-hud-button canvas-hud-zoom" onClick={resetViewport} aria-label="Reset zoom">
            {Math.round(props.viewport.zoom * 100)}%
          </button>
          <button type="button" className="canvas-hud-button canvas-hud-button-zoom-control" onClick={() => zoomAroundCenter(1.14)} aria-label="Aumenta zoom">
            <StudioIcon name="zoomIn" aria-hidden="true" />
          </button>
          <button type="button" className="canvas-hud-button canvas-hud-button-text" onClick={fitToContent} aria-label="Adatta contenuto al viewport">
            <StudioIcon name="fit" aria-hidden="true" />
            Adatta
          </button>
          <button type="button" className="canvas-hud-button canvas-hud-button-text" onClick={centerContent} aria-label="Centra contenuto">
            <StudioIcon name="center" aria-hidden="true" />
            Centra
          </button>
          <button type="button" className="canvas-hud-button canvas-hud-button-text" onClick={resetViewport} aria-label="Reset viewport">
            <StudioIcon name="reset" aria-hidden="true" />
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
