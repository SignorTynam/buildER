import type { FocusEvent, MouseEvent, PointerEvent, ReactNode } from "react";
import type { DiagramHighlightKind, DiagramNode, Point, VersionHighlightKind } from "../types/diagram";
import { useI18n } from "../i18n/useI18n";
import { DIAGRAM_ATTRIBUTE_MARKER_RADIUS } from "./diagramVisualConstants";
import { getVersionHighlightStroke } from "./versionHighlightColors";

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
      <circle cx={x} cy={y} r={8} fill="var(--color-bg-elevated)" stroke={stroke} strokeWidth={1.8} />
      <circle cx={x} cy={y} r={3.4} fill={stroke} opacity={level === "error" ? 0.95 : 0.88} />
      <circle cx={x} cy={y} r={5.8} fill={fill} stroke="none" opacity={0.65} />
      <circle cx={x} cy={y} r={2.7} fill={stroke} opacity={0.95} />
    </g>
  );
}

function getSimpleAttributeValidationBadgePoint(node: DiagramNode, direction?: Point): Point {
  const marker = { x: node.x + 10, y: node.y + node.height / 2 };
  if (!direction) {
    return { x: marker.x + 18, y: marker.y - 13 };
  }

  if (Math.abs(direction.x) >= Math.abs(direction.y)) {
    return {
      x: marker.x + (direction.x >= 0 ? 18 : -18),
      y: marker.y - 13,
    };
  }

  return {
    x: marker.x + 18,
    y: marker.y + (direction.y >= 0 ? 14 : -14),
  };
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
  validationMessages?: string[];
  translationHighlight?: DiagramHighlightKind;
  versionHighlight?: VersionHighlightKind;
  attributeDirection?: Point;
  isCompositeAttribute?: boolean;
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
  const versionStroke = getVersionHighlightStroke(props.versionHighlight);
  const strokeColor = isGhost ? DIAGRAM_DRAG : translationStroke ?? versionStroke ?? getValidationStroke(props.validationLevel);
  const isShapeHighlighted =
    !isGhost && (props.selected || props.focused || props.translationHighlight === "selected") && !props.validationLevel;
  const selectedStrokeColor =
    props.translationHighlight === "selected"
      ? DIAGRAM_TRANSLATION_PENDING
      : versionStroke ?? (isShapeHighlighted ? DIAGRAM_FOCUS : strokeColor);
  const validationTitle = isGhost ? undefined : formatValidationTitle(props.validationMessages);
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
  const groupClassName = [
    "diagram-node",
    isGhost ? "ghost" : "",
    props.selected ? "selected" : "",
    props.versionHighlight ? `version-highlight-${props.versionHighlight}` : "",
  ]
    .filter(Boolean)
    .join(" ");
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
        {validationTitle ? <title>{validationTitle}</title> : null}
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
        {node.isWeak === true ? (
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
        {!isGhost ? renderValidationBadge(node.x + node.width + 9, node.y - 9, props.validationLevel, validationTitle) : null}
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
        {validationTitle ? <title>{validationTitle}</title> : null}
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
        {!isGhost
          ? renderValidationBadge(node.x + node.width * 0.78 + 10, node.y + node.height * 0.2 - 8, props.validationLevel, validationTitle)
          : null}
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
    const isCompositeAttribute = props.isCompositeAttribute === true;
    const compositeLabelMaxWidth = Math.max(20, node.width - 28);
    const shouldCompressCompositeLabel = node.label.length * 7.5 > compositeLabelMaxWidth;

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
        {validationTitle ? <title>{validationTitle}</title> : null}
        {isCompositeAttribute ? (
          <>
            <rect
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              rx={Math.max(12, node.height / 2)}
              ry={Math.max(12, node.height / 2)}
              fill={baseFill}
              stroke={selectedStrokeColor}
              strokeWidth={isShapeHighlighted ? 2.8 : shapeStrokeWidth + 0.2}
              strokeDasharray={baseDash}
              opacity={baseOpacity}
              className="composite-attribute-capsule"
            />
            <text
              x={node.x + node.width / 2}
              y={cy}
              className="shape-label composite-attribute-label"
              textAnchor="middle"
              dominantBaseline="middle"
              fill={selectedStrokeColor}
              opacity={labelOpacity}
              textLength={shouldCompressCompositeLabel ? compositeLabelMaxWidth : undefined}
              lengthAdjust={shouldCompressCompositeLabel ? "spacingAndGlyphs" : undefined}
            >
              {node.label}
            </text>
          </>
        ) : isMultivalued ? (
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
                    className={isIdentifier ? "attribute-marker attribute-identifier-marker" : "attribute-marker"}
                    cx={node.x + 10}
                    cy={cy}
                    r={DIAGRAM_ATTRIBUTE_MARKER_RADIUS}
                    fill={isGhost ? "none" : isIdentifier ? DIAGRAM_FOCUS : DIAGRAM_NODE_FILL}
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
        {!isGhost
          ? (() => {
              const badgePoint =
                isCompositeAttribute || isMultivalued
                  ? { x: node.x + node.width + 8, y: node.y - 8 }
                  : getSimpleAttributeValidationBadgePoint(node, props.attributeDirection);
              return renderValidationBadge(badgePoint.x, badgePoint.y, props.validationLevel, validationTitle);
            })()
          : null}
      </g>
    );
  }

  return null;
}
