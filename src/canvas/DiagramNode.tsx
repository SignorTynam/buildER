import type { FocusEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import type { DiagramHighlightKind, DiagramNode, Point } from "../types/diagram";
import { useI18n } from "../i18n/useI18n";

const DIAGRAM_NODE_FILL = "var(--diagram-node-fill)";
const DIAGRAM_STROKE = "var(--diagram-stroke)";
const DIAGRAM_FOCUS = "var(--diagram-focus)";
const DIAGRAM_PENDING = "var(--diagram-pending)";
const DIAGRAM_DRAG = "var(--diagram-drag)";
const DIAGRAM_WARNING = "var(--diagram-warning)";
const DIAGRAM_WARNING_FILL = "var(--diagram-warning-fill)";
const DIAGRAM_ERROR = "var(--diagram-error)";
const DIAGRAM_ERROR_FILL = "var(--diagram-error-fill)";
const DIAGRAM_TRANSLATION_PENDING = "var(--diagram-translation-pending, #ff3b30)";
const DIAGRAM_TRANSLATION_BLOCKED = "var(--diagram-translation-blocked, #b75b56)";

type DiagramIssueLevel = "warning" | "error" | undefined;

interface AttributeLabelLayout {
  x: number;
  y: number;
  textAnchor: "start" | "middle" | "end";
  dominantBaseline: "middle";
}

function getAttributeIndicatorOffset(node: DiagramNode): number {
  return 24;
}

function getAttributeVerticalAnchor(node: DiagramNode): number {
  return node.x + 10;
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
      <circle cx={x} cy={y} r={10} fill="#fffdf7" stroke={getValidationStroke(level)} strokeWidth={2.2} />
      <text
        x={x}
        y={y + 0.5}
        textAnchor="middle"
        dominantBaseline="middle"
        fill={getValidationStroke(level)}
        style={{ fontSize: "11px", fontWeight: 700 }}
      >
        {badgeText}
      </text>
    </g>
  );
}

export function getAttributeLabelLayout(node: DiagramNode, direction?: Point): AttributeLabelLayout {
  const cy = node.y + node.height / 2;
  const indicatorOffset = getAttributeIndicatorOffset(node);

  if (!direction) {
    return {
      x: node.x + indicatorOffset,
      y: cy,
      textAnchor: "start",
      dominantBaseline: "middle",
    };
  }

  if (Math.abs(direction.x) >= Math.abs(direction.y)) {
    const goesRight = direction.x >= 0;
    return {
      x: goesRight ? node.x - 6 : node.x + 24,
      y: cy,
      textAnchor: goesRight ? "end" : "start",
      dominantBaseline: "middle",
    };
  }

  const goesDown = direction.y >= 0;
  return {
    x: getAttributeVerticalAnchor(node),
    y: goesDown ? node.y - 8 : node.y + node.height + 8,
    textAnchor: "middle",
    dominantBaseline: "middle",
  };
}

interface DiagramNodeProps {
  node: DiagramNode;
  selected: boolean;
  dragging: boolean;
  ghost?: boolean;
  pending: boolean;
  focused: boolean;
  focusable: boolean;
  validationLevel?: DiagramIssueLevel;
  validationCount?: number;
  translationHighlight?: DiagramHighlightKind;
  attributeDirection?: Point;
  onFocus: (node: DiagramNode) => void;
  onBlur: (event: FocusEvent<SVGGElement>) => void;
  onPointerDown: (event: PointerEvent<SVGGElement>, node: DiagramNode) => void;
  onDoubleClick: (event: MouseEvent<SVGGElement>, node: DiagramNode) => void;
}

export function DiagramNodeView(props: DiagramNodeProps) {
  const { t } = useI18n();
  const { node } = props;
  const isGhost = props.ghost === true;
  const translationStroke =
    props.translationHighlight === "pending" || props.translationHighlight === "selected"
      ? DIAGRAM_TRANSLATION_PENDING
      : props.translationHighlight === "blocked"
        ? DIAGRAM_TRANSLATION_BLOCKED
        : undefined;
  const strokeColor = isGhost ? DIAGRAM_DRAG : translationStroke ?? getValidationStroke(props.validationLevel);
  const isShapeHighlighted =
    !isGhost && (props.selected || props.focused || props.translationHighlight === "selected") && !props.validationLevel;
  const selectedStrokeColor =
    props.translationHighlight === "selected" ? DIAGRAM_TRANSLATION_PENDING : isShapeHighlighted ? DIAGRAM_FOCUS : strokeColor;
  const haloColor = isGhost ? "transparent" : getValidationHalo(props.validationLevel);
  const badgeCount = props.validationCount;
  const baseFill = isGhost ? "none" : DIAGRAM_NODE_FILL;
  const baseDash = isGhost ? "10 8" : undefined;
  const baseOpacity = isGhost ? 0.6 : 1;
  const labelOpacity = isGhost ? 0.74 : 1;
  const shapeStrokeWidth = isGhost
    ? 1.8
    : props.translationHighlight === "selected"
      ? 3.2
      : props.pending || props.dragging || props.translationHighlight
        ? 2.4
        : isShapeHighlighted
          ? 2.7
          : 2;
  const weakShapeStrokeWidth = isGhost
    ? 1.6
    : props.translationHighlight === "selected"
      ? 2.8
      : props.pending || props.dragging || props.translationHighlight
        ? 2.1
        : isShapeHighlighted
          ? 2.3
          : 1.8;
  const groupClassName = isGhost ? "diagram-node ghost" : props.selected ? "diagram-node selected" : "diagram-node";
  const groupTabIndex = !isGhost && props.focusable ? 0 : -1;
  const groupFocusable = !isGhost && props.focusable ? "true" : "false";

  if (node.type === "entity") {
    const inset = 8;
    return (
      <g
        className={groupClassName}
        tabIndex={groupTabIndex}
        focusable={groupFocusable}
        aria-label={isGhost ? undefined : t("canvas.diagramNode", { type: node.type, label: node.label })}
        aria-hidden={isGhost ? true : undefined}
        pointerEvents={isGhost ? "none" : undefined}
        onFocus={isGhost ? undefined : () => props.onFocus(node)}
        onBlur={isGhost ? undefined : props.onBlur}
        onPointerDown={isGhost ? undefined : (event) => props.onPointerDown(event, node)}
        onDoubleClick={isGhost ? undefined : (event) => props.onDoubleClick(event, node)}
      >
        {!isGhost && props.validationLevel ? (
          <rect
            x={node.x - 8}
            y={node.y - 8}
            width={node.width + 16}
            height={node.height + 16}
            fill="none"
            stroke={haloColor}
            strokeWidth={7}
          />
        ) : null}
        <rect
          x={node.x}
          y={node.y}
          width={node.width}
          height={node.height}
          fill={baseFill}
          stroke={selectedStrokeColor}
          strokeWidth={shapeStrokeWidth}
          strokeDasharray={baseDash}
          opacity={baseOpacity}
        />
        {node.isWeak === true || (node.externalIdentifiers ?? []).length > 0 ? (
          <rect
            x={node.x + inset}
            y={node.y + inset}
            width={Math.max(0, node.width - inset * 2)}
            height={Math.max(0, node.height - inset * 2)}
            fill="none"
            stroke={selectedStrokeColor}
            strokeWidth={weakShapeStrokeWidth}
            strokeDasharray={baseDash}
            opacity={baseOpacity}
          />
        ) : null}
        {!isGhost && props.pending ? (
          <circle cx={node.x + node.width + 8} cy={node.y - 8} r={6} fill={DIAGRAM_PENDING} />
        ) : null}
        {!isGhost ? renderValidationBadge(node.x + node.width + 10, node.y - 10, props.validationLevel, badgeCount) : null}
        <text
          x={node.x + node.width / 2}
          y={node.y + node.height / 2}
          className="entity-label"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={selectedStrokeColor}
          opacity={labelOpacity}
        >
          {node.label.toUpperCase()}
        </text>
      </g>
    );
  }

  if (node.type === "relationship") {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const points = `${cx},${node.y} ${node.x + node.width},${cy} ${cx},${node.y + node.height} ${node.x},${cy}`;

    return (
      <g
        className={groupClassName}
        tabIndex={groupTabIndex}
        focusable={groupFocusable}
        aria-label={isGhost ? undefined : t("canvas.diagramNode", { type: node.type, label: node.label })}
        aria-hidden={isGhost ? true : undefined}
        pointerEvents={isGhost ? "none" : undefined}
        onFocus={isGhost ? undefined : () => props.onFocus(node)}
        onBlur={isGhost ? undefined : props.onBlur}
        onPointerDown={isGhost ? undefined : (event) => props.onPointerDown(event, node)}
        onDoubleClick={isGhost ? undefined : (event) => props.onDoubleClick(event, node)}
      >
        {!isGhost && props.validationLevel ? (
          <polygon
            points={`${cx},${node.y - 8} ${node.x + node.width + 8},${cy} ${cx},${node.y + node.height + 8} ${node.x - 8},${cy}`}
            fill="none"
            stroke={haloColor}
            strokeWidth={7}
          />
        ) : null}
        <polygon
          points={points}
          fill={baseFill}
          stroke={selectedStrokeColor}
          strokeWidth={shapeStrokeWidth}
          strokeDasharray={baseDash}
          opacity={baseOpacity}
        />
        {!isGhost && props.pending ? (
          <circle cx={node.x + node.width + 8} cy={node.y + 8} r={6} fill={DIAGRAM_PENDING} />
        ) : null}
        {!isGhost ? renderValidationBadge(node.x + node.width + 10, node.y - 8, props.validationLevel, badgeCount) : null}
        <text
          x={cx}
          y={cy}
          className="shape-label"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={selectedStrokeColor}
          opacity={labelOpacity}
        >
          {node.label.toUpperCase()}
        </text>
      </g>
    );
  }

  if (node.type === "attribute") {
    const cy = node.y + node.height / 2;
    const isIdentifier = node.isIdentifier === true;
    const isMultivalued = node.isMultivalued === true;

    return (
      <g
        className={groupClassName}
        tabIndex={groupTabIndex}
        focusable={groupFocusable}
        aria-label={isGhost ? undefined : t("canvas.diagramNode", { type: node.type, label: node.label })}
        aria-hidden={isGhost ? true : undefined}
        pointerEvents={isGhost ? "none" : undefined}
        onFocus={isGhost ? undefined : () => props.onFocus(node)}
        onBlur={isGhost ? undefined : props.onBlur}
        onPointerDown={isGhost ? undefined : (event) => props.onPointerDown(event, node)}
        onDoubleClick={isGhost ? undefined : (event) => props.onDoubleClick(event, node)}
      >
        {!isGhost && props.validationLevel ? (
          <rect
            x={node.x - 10}
            y={node.y - 8}
            width={node.width + 20}
            height={node.height + 16}
            fill="none"
            stroke={haloColor}
            strokeWidth={7}
          />
        ) : null}
        {isMultivalued ? (
          <>
            <ellipse
              cx={node.x + node.width / 2}
              cy={cy}
              rx={node.width / 2}
              ry={node.height / 2}
              fill={baseFill}
              stroke={selectedStrokeColor}
              strokeWidth={shapeStrokeWidth}
              strokeDasharray={baseDash}
              opacity={baseOpacity}
            />
            <text
              x={node.x + node.width / 2}
              y={cy}
              className="shape-label"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={selectedStrokeColor}
              opacity={labelOpacity}
            >
              {node.label}
            </text>
          </>
        ) : (
          <>
            {(() => {
              const labelLayout = getAttributeLabelLayout(node, props.attributeDirection);
              return (
                <>
                  <circle
                    cx={node.x + 10}
                    cy={cy}
                    r={7}
                    fill={isGhost ? "none" : isIdentifier ? selectedStrokeColor : DIAGRAM_NODE_FILL}
                    stroke={selectedStrokeColor}
                    strokeWidth={isShapeHighlighted ? 2.4 : 2}
                    strokeDasharray={baseDash}
                    opacity={baseOpacity}
                  />
                  <text
                    x={labelLayout.x}
                    y={labelLayout.y}
                    className="attribute-label"
                    textAnchor={labelLayout.textAnchor}
                    dominantBaseline={labelLayout.dominantBaseline}
                    fill={selectedStrokeColor}
                    opacity={labelOpacity}
                  >
                    {node.label}
                  </text>
                </>
              );
            })()}
          </>
        )}
        {!isGhost ? renderValidationBadge(node.x + 18, node.y - 10, props.validationLevel, badgeCount) : null}
      </g>
    );
  }

  return null;
}
