import type { FocusEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import { getRenderedEdgeGeometry, pathFromPoints } from "../utils/geometry";
import type { DiagramEdge, DiagramNode, Point } from "../types/diagram";
import { getEdgeCardinalityLabel } from "../utils/cardinality";
import { useI18n } from "../i18n/useI18n";

const DIAGRAM_STROKE = "var(--diagram-stroke)";
const DIAGRAM_FOCUS = "var(--diagram-focus)";
const DIAGRAM_DRAG = "var(--diagram-drag)";
const DIAGRAM_WARNING = "var(--diagram-warning)";
const DIAGRAM_WARNING_FILL = "var(--diagram-warning-fill)";
const DIAGRAM_ERROR = "var(--diagram-error)";
const DIAGRAM_ERROR_FILL = "var(--diagram-error-fill)";

type DiagramIssueLevel = "warning" | "error" | undefined;

interface EdgeLaneInfo {
  laneIndex: number;
  laneCount: number;
}

interface DiagramEdgeProps {
  edge: DiagramEdge;
  sourceNode: DiagramNode;
  targetNode: DiagramNode;
  laneInfo?: EdgeLaneInfo;
  displayLabelOverride?: string;
  selected: boolean;
  dragging: boolean;
  ghost?: boolean;
  focused: boolean;
  focusable: boolean;
  validationLevel?: DiagramIssueLevel;
  validationCount?: number;
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

function renderValidationBadge(x: number, y: number, level: DiagramIssueLevel, count?: number): ReactNode {
  if (!level) {
    return null;
  }

  const badgeText = count && count > 1 ? String(Math.min(count, 9)) : "!";
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

function getInheritanceConstraintLabel(edge: Extract<DiagramEdge, { type: "inheritance" }>): string {
  const parts: string[] = [];

  if (edge.isaDisjointness === "disjoint") {
    parts.push("D");
  } else if (edge.isaDisjointness === "overlap") {
    parts.push("O");
  }

  if (edge.isaCompleteness === "total") {
    parts.push("T");
  } else if (edge.isaCompleteness === "partial") {
    parts.push("P");
  }

  return parts.join("/");
}

export function DiagramEdgeView(props: DiagramEdgeProps) {
  const { t } = useI18n();
  const isGhost = props.ghost === true;
  const geometry = getRenderedEdgeGeometry(props.edge, props.sourceNode, props.targetNode, props.laneInfo);
  const pathData = pathFromPoints(geometry.points);
  const dashArray = props.edge.lineStyle === "dashed" ? "8 5" : undefined;
  const inheritanceConstraintLabel =
    props.edge.type === "inheritance" ? getInheritanceConstraintLabel(props.edge) : "";
  const displayLabel =
    typeof props.displayLabelOverride === "string"
      ? props.displayLabelOverride
      : props.edge.type === "connector" || props.edge.type === "attribute"
        ? getEdgeCardinalityLabel(props.edge, props.sourceNode, props.targetNode)
      : props.edge.type === "inheritance"
        ? props.edge.label
        : "";
  const isEdgeHighlighted = !isGhost && (props.selected || props.focused) && !props.validationLevel;
  const strokeColor = isGhost ? DIAGRAM_DRAG : getValidationStroke(props.validationLevel);
  const selectedStrokeColor = isEdgeHighlighted ? DIAGRAM_FOCUS : strokeColor;
  const haloColor = isGhost ? "transparent" : getValidationHalo(props.validationLevel);
  const badgeY = geometry.labelPoint.y - (inheritanceConstraintLabel ? 28 : 16);
  const baseOpacity = isGhost ? 0.58 : 1;
  const labelOpacity = isGhost ? 0.72 : 1;
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
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      <path
        d={pathData}
        fill="none"
        stroke={selectedStrokeColor}
        strokeWidth={isGhost ? 1.8 : props.dragging ? 2.6 : isEdgeHighlighted ? 2.7 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={primaryDashArray}
        markerEnd={props.edge.type === "inheritance" ? "url(#arrowhead)" : undefined}
        opacity={baseOpacity}
      />
      {inheritanceConstraintLabel ? (
        <text
          x={geometry.labelPoint.x}
          y={geometry.labelPoint.y - (displayLabel ? 18 : 8)}
          textAnchor="middle"
          className="edge-label inheritance-constraint-label"
          fill={selectedStrokeColor}
          opacity={labelOpacity}
          onPointerDown={isGhost ? undefined : (event) => props.onLabelPointerDown(event, props.edge)}
        >
          {inheritanceConstraintLabel}
        </text>
      ) : null}
      {displayLabel ? (
        <text
          x={geometry.labelPoint.x}
          y={geometry.labelPoint.y + (inheritanceConstraintLabel ? 10 : -6)}
          textAnchor="middle"
          className={props.edge.type === "connector" ? "edge-label connector-label" : "edge-label"}
          fill={selectedStrokeColor}
          opacity={labelOpacity}
          onPointerDown={isGhost ? undefined : (event) => props.onLabelPointerDown(event, props.edge)}
        >
          {displayLabel}
        </text>
      ) : null}
      {!isGhost ? renderValidationBadge(geometry.labelPoint.x + 18, badgeY, props.validationLevel, props.validationCount) : null}
    </g>
  );
}
