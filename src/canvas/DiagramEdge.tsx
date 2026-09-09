import type { FocusEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import { getRenderedEdgeGeometry, pathFromPoints } from "../utils/geometry";
import type {
  DiagramEdge,
  DiagramHighlightKind,
  DiagramNode,
  IsaCompleteness,
  IsaDisjointness,
  Point,
  VersionHighlightKind,
} from "../types/diagram";
import { getConnectorParticipation, getEdgeCardinalityLabel } from "../utils/cardinality";
import { getPointAlongPolyline } from "../utils/edgeLabelLayout";
import { useI18n } from "../i18n/useI18n";
import { getVersionHighlightStroke } from "./versionHighlightColors";

const DIAGRAM_STROKE = "var(--diagram-stroke)";
const DIAGRAM_FOCUS = "var(--diagram-focus)";
const DIAGRAM_DRAG = "var(--diagram-drag)";
const DIAGRAM_WARNING = "var(--diagram-warning)";
const DIAGRAM_WARNING_FILL = "var(--diagram-warning-fill)";
const DIAGRAM_ERROR = "var(--diagram-error)";
const DIAGRAM_ERROR_FILL = "var(--diagram-error-fill)";
const DIAGRAM_TRANSLATION_PENDING = "var(--diagram-translation-pending, #ff3b30)";
const DIAGRAM_TRANSLATION_BLOCKED = "var(--diagram-translation-blocked, #b75b56)";

type DiagramIssueLevel = "warning" | "error" | undefined;

interface EdgeLaneInfo {
  laneIndex: number;
  laneCount: number;
}

export interface EdgeLabelLayoutOverride {
  displayLabelPoint?: Point;
  displayLabelY?: number;
  roleLabelPoint?: Point;
  roleLabelY?: number;
}

interface DiagramEdgeProps {
  edge: DiagramEdge;
  sourceNode: DiagramNode;
  targetNode: DiagramNode;
  laneInfo?: EdgeLaneInfo;
  compositeAttributeIds?: ReadonlySet<string>;
  displayLabelOverride?: string;
  labelLayoutOverride?: EdgeLabelLayoutOverride;
  selected: boolean;
  dragging: boolean;
  ghost?: boolean;
  focused: boolean;
  focusable: boolean;
  validationLevel?: DiagramIssueLevel;
  validationCount?: number;
  validationMessages?: string[];
  translationHighlight?: DiagramHighlightKind;
  versionHighlight?: VersionHighlightKind;
  onFocus: (edge: DiagramEdge) => void;
  onBlur: (event: FocusEvent<SVGGElement>) => void;
  onPointerDown: (event: PointerEvent<SVGGElement>, edge: DiagramEdge) => void;
  onLabelPointerDown: (event: PointerEvent<SVGTextElement>, edge: DiagramEdge) => void;
  onDoubleClick: (event: MouseEvent<SVGGElement>, edge: DiagramEdge) => void;
}

function getValidationStroke(level: DiagramIssueLevel): string {
  if (level === "error") {
    return DIAGRAM_ERROR;
  }

  if (level === "warning") {
    return DIAGRAM_WARNING;
  }

  return DIAGRAM_STROKE;
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

function getNearestSegmentNormal(points: Point[], point: Point): Point {
  if (points.length < 2) {
    return { x: 0, y: -1 };
  }

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestNormal = { x: 0, y: -1 };

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const segmentLength = Math.max(Math.hypot(dx, dy), 0.001);
    const t = Math.min(Math.max(((point.x - start.x) * dx + (point.y - start.y) * dy) / (segmentLength * segmentLength), 0), 1);
    const projection = {
      x: start.x + dx * t,
      y: start.y + dy * t,
    };
    const candidateDistance = distance(point, projection);
    if (candidateDistance < bestDistance) {
      let normal = normalizeVector({ x: -dy, y: dx }, { x: 0, y: -1 });
      if (Math.abs(dx) >= Math.abs(dy) && normal.y > 0) {
        normal = { x: -normal.x, y: -normal.y };
      } else if (Math.abs(dy) > Math.abs(dx) && normal.x < 0) {
        normal = { x: -normal.x, y: -normal.y };
      }
      bestDistance = candidateDistance;
      bestNormal = normal;
    }
  }

  return bestNormal;
}

function formatValidationTitle(messages?: string[]): string | undefined {
  if (!messages || messages.length === 0) {
    return undefined;
  }

  const uniqueMessages = messages.filter((message, index, source) => source.indexOf(message) === index);
  if (uniqueMessages.length === 1) {
    return uniqueMessages[0];
  }

  return `${uniqueMessages.length} problemi:\n${uniqueMessages.map((message) => `- ${message}`).join("\n")}`;
}

function renderValidationBadge(x: number, y: number, level: DiagramIssueLevel, title?: string): ReactNode {
  if (!level) {
    return null;
  }

  const stroke = getValidationStroke(level);
  const fill = level === "error" ? DIAGRAM_ERROR_FILL : DIAGRAM_WARNING_FILL;
  return (
    <g className={`diagram-validation-badge ${level}`} pointerEvents="all">
      {title ? <title>{title}</title> : null}
      <circle cx={x} cy={y} r={7.5} fill="var(--color-bg-elevated)" stroke={stroke} strokeWidth={1.7} />
      <circle cx={x} cy={y} r={5.4} fill={fill} stroke="none" opacity={0.65} />
      <circle cx={x} cy={y} r={2.6} fill={stroke} opacity={0.95} />
    </g>
  );
}

function getEdgeValidationBadgePoint(options: {
  points: Point[];
  basePoint: Point;
  labelY: number;
  labelWidth: number;
  hasLabel: boolean;
}): Point {
  const base = { x: options.basePoint.x, y: options.labelY };
  const normal = getNearestSegmentNormal(options.points, base);
  const tangent = normalizeVector({ x: normal.y, y: -normal.x }, { x: 1, y: 0 });
  const normalOffset = 20;
  const tangentOffset = options.hasLabel ? options.labelWidth / 2 + 12 : 0;

  return {
    x: base.x + normal.x * normalOffset + tangent.x * tangentOffset,
    y: base.y + normal.y * normalOffset + tangent.y * tangentOffset,
  };
}

function formatIsaConstraint(completeness?: IsaCompleteness, disjointness?: IsaDisjointness): string {
  if (!completeness || !disjointness) {
    return "";
  }
  const c = completeness === "total" ? "t" : "p";
  const d = disjointness === "disjoint" ? "e" : "o";
  return `(${c},${d})`;
}

export function DiagramEdgeView(props: DiagramEdgeProps) {
  const { t } = useI18n();
  const isGhost = props.ghost === true;
  const geometry = getRenderedEdgeGeometry(
    props.edge,
    props.sourceNode,
    props.targetNode,
    props.laneInfo,
    props.compositeAttributeIds,
  );
  const pathData = pathFromPoints(geometry.points);
  const dashArray = props.edge.lineStyle === "dashed" ? "8 5" : undefined;
  const inheritanceConstraintLabel =
    props.edge.type === "inheritance" ? formatIsaConstraint(props.edge.isaCompleteness, props.edge.isaDisjointness) : "";
  const displayLabel =
    typeof props.displayLabelOverride === "string"
      ? props.displayLabelOverride
      : props.edge.type === "connector" || props.edge.type === "attribute"
        ? getEdgeCardinalityLabel(props.edge, props.sourceNode, props.targetNode)
      : props.edge.type === "inheritance"
        ? props.edge.label
        : "";
  const roleLabel =
    props.edge.type === "connector"
      ? getConnectorParticipation(props.edge, props.sourceNode, props.targetNode)?.role?.trim() ?? ""
      : "";
  const translationStroke =
    props.translationHighlight === "pending" || props.translationHighlight === "selected"
      ? DIAGRAM_TRANSLATION_PENDING
      : props.translationHighlight === "blocked"
        ? DIAGRAM_TRANSLATION_BLOCKED
        : undefined;
  const isEdgeHighlighted =
    !isGhost && (props.selected || props.focused || props.translationHighlight === "selected") && !props.validationLevel;
  const versionStroke = getVersionHighlightStroke(props.versionHighlight);
  const strokeColor = isGhost ? DIAGRAM_DRAG : translationStroke ?? versionStroke ?? getValidationStroke(props.validationLevel);
  const selectedStrokeColor =
    props.translationHighlight === "selected"
      ? DIAGRAM_TRANSLATION_PENDING
      : versionStroke ?? (isEdgeHighlighted ? DIAGRAM_FOCUS : strokeColor);
  const baseOpacity = isGhost ? 0.58 : 1;
  const labelOpacity = isGhost ? 0.72 : 1;
  const inheritanceConstraintY = geometry.labelPoint.y - (displayLabel ? 18 : 8);
  const entityIsSource = props.edge.type === "connector" && props.sourceNode.type === "entity";
  const isConnector = props.edge.type === "connector";
  const usesSplitConnectorLabels = isConnector && ((props.laneInfo?.laneCount ?? 1) > 1 || roleLabel.length > 0);
  const defaultDisplayLabelPoint =
    usesSplitConnectorLabels
      ? getPointAlongPolyline(geometry.points, entityIsSource ? 0.38 : 0.62)
      : geometry.labelPoint;
  const defaultRoleLabelPoint =
    usesSplitConnectorLabels
      ? getPointAlongPolyline(geometry.points, entityIsSource ? 0.68 : 0.32)
      : geometry.labelPoint;
  const displayLabelWidth = displayLabel.length * 7 + 10;
  const roleLabelWidth = roleLabel.length * 7 + 10;
  const defaultDisplayLabelY = usesSplitConnectorLabels
    ? defaultDisplayLabelPoint.y
    : geometry.labelPoint.y + (inheritanceConstraintLabel ? 10 : -6);
  const defaultRoleLabelY = defaultRoleLabelPoint.y;
  const displayLabelPoint = props.labelLayoutOverride?.displayLabelPoint ?? defaultDisplayLabelPoint;
  const roleLabelPoint = props.labelLayoutOverride?.roleLabelPoint ?? defaultRoleLabelPoint;
  const displayLabelY = props.labelLayoutOverride?.displayLabelY ?? defaultDisplayLabelY;
  const roleLabelY = props.labelLayoutOverride?.roleLabelY ?? defaultRoleLabelY;
  const displayLabelChipY = isConnector ? displayLabelPoint.y - 9 : displayLabelY - 13;
  const displayLabelTextY = isConnector ? displayLabelPoint.y + 4 : displayLabelY;
  const validationTitle = isGhost ? undefined : formatValidationTitle(props.validationMessages);
  const badgeBasePoint = roleLabel ? roleLabelPoint : usesSplitConnectorLabels ? roleLabelPoint : displayLabelPoint;
  const badgeLabelY = roleLabel ? roleLabelY : displayLabelY;
  const badgeLabelWidth = roleLabel ? roleLabelWidth : displayLabelWidth;
  const badgePoint = getEdgeValidationBadgePoint({
    points: geometry.points,
    basePoint: badgeBasePoint,
    labelY: badgeLabelY,
    labelWidth: badgeLabelWidth,
    hasLabel: Boolean(roleLabel || displayLabel),
  });
  const primaryDashArray = isGhost ? "10 8" : dashArray;
  const groupClassName = [
    "diagram-edge",
    isGhost ? "ghost" : "",
    props.selected ? "selected" : "",
    props.versionHighlight ? `version-highlight-${props.versionHighlight}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const groupTabIndex = !isGhost && props.focusable ? 0 : -1;
  const groupFocusable = !isGhost && props.focusable ? "true" : "false";

  return (
    <g
      className={groupClassName}
      role={isGhost ? undefined : "button"}
      tabIndex={groupTabIndex}
      focusable={groupFocusable}
      aria-label={
        isGhost
          ? undefined
          : t("canvas.diagramEdge", {
              type: props.edge.type,
              source: props.sourceNode.label,
              target: props.targetNode.label,
            })
      }
      aria-hidden={isGhost ? true : undefined}
      pointerEvents={isGhost ? "none" : undefined}
      onFocus={isGhost ? undefined : () => props.onFocus(props.edge)}
      onBlur={isGhost ? undefined : props.onBlur}
      onPointerDown={isGhost ? undefined : (event) => props.onPointerDown(event, props.edge)}
      onDoubleClick={isGhost ? undefined : (event) => props.onDoubleClick(event, props.edge)}
    >
      {validationTitle ? <title>{validationTitle}</title> : null}
      {!isGhost ? (
        <path
          className="diagram-edge-hit-target"
          d={pathData}
          fill="none"
          stroke="transparent"
          strokeWidth={16}
        />
      ) : null}
      <path
        d={pathData}
        fill="none"
        stroke={selectedStrokeColor}
        strokeWidth={
          isGhost
            ? 1.8
            : props.translationHighlight === "selected"
              ? 3.4
              : props.dragging || props.translationHighlight
                ? 2.6
                : isEdgeHighlighted
                  ? 2.7
                  : 2
        }
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={primaryDashArray}
        opacity={baseOpacity}
      />
      {inheritanceConstraintLabel ? (
        <>
          <rect
            className="edge-label-chip"
            x={geometry.labelPoint.x - (inheritanceConstraintLabel.length * 7 + 10) / 2}
            y={inheritanceConstraintY - 13}
            width={inheritanceConstraintLabel.length * 7 + 10}
            height={18}
            rx={3}
            fill="var(--color-bg-elevated)"
            stroke="var(--color-border-subtle)"
            strokeWidth={1}
            opacity={labelOpacity}
            pointerEvents="none"
          />
          <text
            x={geometry.labelPoint.x}
            y={inheritanceConstraintY}
            textAnchor="middle"
            className="edge-label inheritance-constraint-label"
            fill={selectedStrokeColor}
            opacity={labelOpacity}
            onPointerDown={isGhost ? undefined : (event) => props.onLabelPointerDown(event, props.edge)}
          >
            {inheritanceConstraintLabel}
          </text>
        </>
      ) : null}
      {displayLabel ? (
        <>
          <rect
            className="edge-label-chip"
            x={displayLabelPoint.x - displayLabelWidth / 2}
            y={displayLabelChipY}
            width={displayLabelWidth}
            height={18}
            rx={3}
            fill={isConnector ? "var(--diagram-canvas-fill)" : "var(--color-bg-elevated)"}
            stroke={isConnector ? "none" : "var(--color-border-subtle)"}
            strokeWidth={isConnector ? 0 : 1}
            opacity={labelOpacity}
            pointerEvents="none"
          />
          <text
            x={displayLabelPoint.x}
            y={displayLabelTextY}
            textAnchor="middle"
            className={
              props.edge.type === "connector"
                ? "edge-label cardinality-label connector-label"
                : props.edge.type === "attribute"
                  ? "edge-label cardinality-label attribute-cardinality-label"
                  : "edge-label"
            }
            fill={selectedStrokeColor}
            opacity={labelOpacity}
            onPointerDown={isGhost ? undefined : (event) => props.onLabelPointerDown(event, props.edge)}
          >
            {displayLabel}
          </text>
        </>
      ) : null}
      {roleLabel ? (
        <>
          <rect
            className="edge-label-chip"
            x={roleLabelPoint.x - roleLabelWidth / 2}
            y={roleLabelY - 13}
            width={roleLabelWidth}
            height={18}
            rx={3}
            fill="var(--color-bg-elevated)"
            stroke="var(--color-border-subtle)"
            strokeWidth={1}
            opacity={labelOpacity}
            pointerEvents="none"
          />
          <text
            x={roleLabelPoint.x}
            y={roleLabelY}
            textAnchor="middle"
            className="edge-label connector-role-label"
            fill={selectedStrokeColor}
            opacity={labelOpacity}
            onPointerDown={isGhost ? undefined : (event) => props.onLabelPointerDown(event, props.edge)}
          >
            {roleLabel}
          </text>
        </>
      ) : null}
      {!isGhost ? renderValidationBadge(badgePoint.x, badgePoint.y, props.validationLevel, validationTitle) : null}
    </g>
  );
}
