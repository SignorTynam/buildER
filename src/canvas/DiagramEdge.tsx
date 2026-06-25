import type { FocusEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import { getRenderedEdgeGeometry, pathFromPoints } from "../utils/geometry";
import type { DiagramEdge, DiagramHighlightKind, DiagramNode, IsaCompleteness, IsaDisjointness, Point } from "../types/diagram";
import { getConnectorParticipation, getEdgeCardinalityLabel } from "../utils/cardinality";
import { getPointAlongPolyline } from "../utils/edgeLabelLayout";
import { useI18n } from "../i18n/useI18n";

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
  translationHighlight?: DiagramHighlightKind;
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

function getValidationHalo(level: DiagramIssueLevel): string {
  if (level === "error") {
    return DIAGRAM_ERROR_FILL;
  }

  if (level === "warning") {
    return DIAGRAM_WARNING_FILL;
  }

  return "transparent";
}

function renderValidationBadge(x: number, y: number, level: DiagramIssueLevel, _count?: number): ReactNode {
  if (!level) {
    return null;
  }

  const badgeText = level === "error" ? "X" : "!";
  return (
    <g className="diagram-validation-badge" aria-hidden="true">
      <circle cx={x} cy={y} r={9} fill="#fffdf7" stroke={getValidationStroke(level)} strokeWidth={2} />
      <text
        x={x}
        y={y + 0.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={getValidationStroke(level)}
        style={{ fontSize: "10px", fontWeight: 700 }}
      >
        {badgeText}
      </text>
    </g>
  );
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
  const strokeColor = isGhost ? DIAGRAM_DRAG : translationStroke ?? getValidationStroke(props.validationLevel);
  const selectedStrokeColor =
    props.translationHighlight === "selected" ? DIAGRAM_TRANSLATION_PENDING : isEdgeHighlighted ? DIAGRAM_FOCUS : strokeColor;
  const haloColor = isGhost ? "transparent" : getValidationHalo(props.validationLevel);
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
  const badgePoint = roleLabel ? roleLabelPoint : usesSplitConnectorLabels ? roleLabelPoint : displayLabelPoint;
  const badgeXOffset = Math.max((roleLabel ? roleLabelWidth : displayLabelWidth) / 2 + 14, 24);
  const badgeY = (roleLabel ? roleLabelY : displayLabelY) - 12;
  const primaryDashArray = isGhost ? "10 8" : dashArray;
  const groupClassName = isGhost ? "diagram-edge ghost" : props.selected ? "diagram-edge selected" : "diagram-edge";
  const groupTabIndex = !isGhost && props.focusable ? 0 : -1;
  const groupFocusable = !isGhost && props.focusable ? "true" : "false";

  return (
    <g
      className={groupClassName}
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
      {!isGhost ? <path d={pathData} fill="none" stroke="transparent" strokeWidth={16} /> : null}
      {!isGhost && props.validationLevel ? (
        <path
          d={pathData}
          fill="none"
          stroke={haloColor}
          strokeWidth={5}
          strokeLinecap="round"
          strokeLinejoin="round"
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
          <text
            x={displayLabelPoint.x}
            y={displayLabelY}
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
            x={roleLabelPoint.x - roleLabelWidth / 2}
            y={roleLabelY - 13}
            width={roleLabelWidth}
            height={18}
            rx={3}
            fill="var(--diagram-canvas-fill)"
            opacity={0.9}
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
      {!isGhost ? renderValidationBadge(badgePoint.x + badgeXOffset, badgeY, props.validationLevel, props.validationCount) : null}
    </g>
  );
}
