import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { PanelIconButton } from "../components/ui";
import { useI18n } from "../i18n/useI18n";
import type { Bounds, DiagramNode, Point, Viewport } from "../types/diagram";
import { getSelectionBounds } from "../utils/geometry";

interface CanvasMinimapProps {
  canvasRef: RefObject<HTMLDivElement>;
  nodes: DiagramNode[];
  edges?: ReadonlyArray<{ id: string; sourceId: string; targetId: string }>;
  selectedNodeIds?: ReadonlyArray<string>;
  viewport: Viewport;
  visible: boolean;
  onViewportChange: (viewport: Viewport) => void;
  onVisibleChange: (visible: boolean) => void;
}

interface CanvasSize {
  width: number;
  height: number;
}

const MINIMAP_WORLD_PADDING_RATIO = 0.08;
const MINIMAP_WORLD_PADDING_MIN = 80;
const MINIMAP_KEYBOARD_PAN_RATIO = 0.12;
const CANVAS_MINIMAP_COMPACT_QUERY = "(max-width: 860px)";
// An expanded minimap leaves too little canvas on a narrow viewport, so at/under the
// compact breakpoint it stays collapsed to a single toggle. This is a space decision,
// not a collision workaround: the compact bottom stack in `canvas-navigation.css` keeps
// the minimap clear of the zoom HUD and the horizontal toolbar at every width.
const CANVAS_MINIMAP_FORCE_COLLAPSE_QUERY = CANVAS_MINIMAP_COMPACT_QUERY;

export const DEFAULT_CANVAS_MINIMAP_VISIBILITY_KEY = "builder:canvas:minimap-visible";

export function readCanvasMinimapVisibility(storageKey: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (stored !== null) return stored === "true";
  } catch {
    // Storage can be unavailable; responsive fallback keeps the control usable.
  }
  return typeof window.matchMedia === "function" ? !window.matchMedia(CANVAS_MINIMAP_COMPACT_QUERY).matches : true;
}

export function writeCanvasMinimapVisibility(storageKey: string, visible: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey, String(visible));
  } catch {
    // Persistence is optional; the in-memory toggle remains functional.
  }
}

function unionBounds(first: Bounds, second: Bounds): Bounds {
  const left = Math.min(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const right = Math.max(first.x + first.width, second.x + second.width);
  const bottom = Math.max(first.y + first.height, second.y + second.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

function expandBounds(bounds: Bounds): Bounds {
  const padding = Math.max(MINIMAP_WORLD_PADDING_MIN, Math.max(bounds.width, bounds.height) * MINIMAP_WORLD_PADDING_RATIO);
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

function viewportWorldBounds(viewport: Viewport, canvasSize: CanvasSize): Bounds {
  return {
    x: -viewport.x / viewport.zoom,
    y: -viewport.y / viewport.zoom,
    width: canvasSize.width / viewport.zoom,
    height: canvasSize.height / viewport.zoom,
  };
}

function readCanvasSize(canvas: HTMLDivElement | null): CanvasSize {
  const rect = canvas?.getBoundingClientRect();
  return { width: rect?.width ?? 0, height: rect?.height ?? 0 };
}

// Grow `bounds` symmetrically until its aspect ratio matches the minimap viewport,
// so the world projection scales uniformly (no stretch) while the pointer mapping stays
// a plain full-rect linear map. Returns `bounds` unchanged when inputs are degenerate.
export function fitBoundsToAspect(bounds: Bounds, aspect: number): Bounds {
  if (!Number.isFinite(aspect) || aspect <= 0 || bounds.width <= 0 || bounds.height <= 0) {
    return bounds;
  }
  const boundsAspect = bounds.width / bounds.height;
  if (boundsAspect > aspect) {
    const height = bounds.width / aspect;
    return { x: bounds.x, y: bounds.y - (height - bounds.height) / 2, width: bounds.width, height };
  }
  const width = bounds.height * aspect;
  return { x: bounds.x - (width - bounds.width) / 2, y: bounds.y, width, height: bounds.height };
}

export interface MinimapSegment {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

// Simplified minimap connections: one straight segment between the centres of the two
// nodes an edge links (no routing). Edges whose endpoints are missing are skipped.
export function minimapEdgeSegments(
  nodes: ReadonlyArray<Pick<DiagramNode, "id" | "x" | "y" | "width" | "height">>,
  edges: ReadonlyArray<{ id: string; sourceId: string; targetId: string }> | undefined,
): MinimapSegment[] {
  if (!edges || edges.length === 0) return [];
  const centers = new Map<string, Point>();
  for (const node of nodes) {
    centers.set(node.id, { x: node.x + node.width / 2, y: node.y + node.height / 2 });
  }
  const segments: MinimapSegment[] = [];
  for (const edge of edges) {
    const source = centers.get(edge.sourceId);
    const target = centers.get(edge.targetId);
    if (source && target) {
      segments.push({ id: edge.id, x1: source.x, y1: source.y, x2: target.x, y2: target.y });
    }
  }
  return segments;
}

export function CanvasMinimap(props: CanvasMinimapProps) {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const activePointerRef = useRef<number | null>(null);
  const dragOffsetRef = useRef<Point>({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState<CanvasSize>(() => readCanvasSize(props.canvasRef.current));
  const [mapSize, setMapSize] = useState<CanvasSize>({ width: 0, height: 0 });
  const [forceCollapsed, setForceCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(CANVAS_MINIMAP_FORCE_COLLAPSE_QUERY).matches,
  );

  useEffect(() => {
    const canvas = props.canvasRef.current;
    if (!canvas) return;

    const update = () => setCanvasSize(readCanvasSize(canvas));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [props.canvasRef]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    const update = () => {
      const rect = svg.getBoundingClientRect();
      setMapSize({ width: rect.width, height: rect.height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(svg);
    return () => observer.disconnect();
  }, [props.visible]);

  // At and below the compact breakpoint the expanded minimap would take too much
  // of a narrow canvas, so it stays collapsed (a single toggle) regardless of the
  // stored preference. The toggle itself is kept clear of the horizontal toolbar
  // and the zoom HUD by the compact stack in `canvas-navigation.css`.
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const query = window.matchMedia(CANVAS_MINIMAP_FORCE_COLLAPSE_QUERY);
    const update = () => setForceCollapsed(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  const viewportBounds = useMemo(
    () => viewportWorldBounds(props.viewport, canvasSize),
    [canvasSize, props.viewport],
  );
  const viewBounds = useMemo(() => {
    const nodeBounds = getSelectionBounds(props.nodes);
    return expandBounds(nodeBounds ? unionBounds(nodeBounds, viewportBounds) : viewportBounds);
  }, [props.nodes, viewportBounds]);
  const projectedBounds = useMemo(
    () =>
      mapSize.width > 0 && mapSize.height > 0
        ? fitBoundsToAspect(viewBounds, mapSize.width / mapSize.height)
        : viewBounds,
    [viewBounds, mapSize],
  );
  const selectedIds = useMemo(() => new Set(props.selectedNodeIds ?? []), [props.selectedNodeIds]);
  const edgeSegments = useMemo(() => minimapEdgeSegments(props.nodes, props.edges), [props.nodes, props.edges]);

  function worldPointFromPointer(event: PointerEvent<SVGSVGElement>): Point | null {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: projectedBounds.x + ((event.clientX - rect.left) / rect.width) * projectedBounds.width,
      y: projectedBounds.y + ((event.clientY - rect.top) / rect.height) * projectedBounds.height,
    };
  }

  function centerViewport(point: Point) {
    props.onViewportChange({
      ...props.viewport,
      x: canvasSize.width / 2 - point.x * props.viewport.zoom,
      y: canvasSize.height / 2 - point.y * props.viewport.zoom,
    });
  }

  function handlePointerMove(event: PointerEvent<SVGSVGElement>) {
    if (activePointerRef.current !== event.pointerId) return;
    const point = worldPointFromPointer(event);
    if (point) {
      centerViewport({ x: point.x + dragOffsetRef.current.x, y: point.y + dragOffsetRef.current.y });
    }
  }

  function handleKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const horizontalStep = viewportBounds.width * MINIMAP_KEYBOARD_PAN_RATIO;
    const verticalStep = viewportBounds.height * MINIMAP_KEYBOARD_PAN_RATIO;
    const center = {
      x: viewportBounds.x + viewportBounds.width / 2,
      y: viewportBounds.y + viewportBounds.height / 2,
    };
    if (event.key === "ArrowLeft") center.x -= horizontalStep;
    else if (event.key === "ArrowRight") center.x += horizontalStep;
    else if (event.key === "ArrowUp") center.y -= verticalStep;
    else if (event.key === "ArrowDown") center.y += verticalStep;
    else return;
    event.preventDefault();
    event.stopPropagation();
    centerViewport(center);
  }

  const showFull = props.visible && !forceCollapsed;

  if (!showFull) {
    return (
      <div className="canvas-minimap-layer canvas-minimap-layer--collapsed">
        <PanelIconButton
          className="canvas-minimap-toggle"
          icon="minimap"
          label={t("canvas.minimap.show")}
          tooltipPosition="top"
          onClick={() => props.onVisibleChange(true)}
        />
      </div>
    );
  }

  return (
    <aside className="canvas-minimap-layer" aria-label={t("canvas.minimap.title")}>
      <div className="canvas-minimap">
        <header className="canvas-minimap__header">
          <span>{t("canvas.minimap.title")}</span>
          <PanelIconButton
            className="canvas-minimap-toggle"
            icon="viewOff"
            label={t("canvas.minimap.hide")}
            tooltipPosition="top"
            onClick={() => props.onVisibleChange(false)}
          />
        </header>
        <svg
          ref={svgRef}
          className="canvas-minimap__map"
          viewBox={`${projectedBounds.x} ${projectedBounds.y} ${Math.max(projectedBounds.width, 1)} ${Math.max(projectedBounds.height, 1)}`}
          preserveAspectRatio="none"
          role="group"
          tabIndex={0}
          aria-label={t("canvas.minimap.mapAria")}
          onKeyDown={handleKeyDown}
          onPointerDown={(event) => {
            activePointerRef.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            const point = worldPointFromPointer(event);
            if (point) {
              const targetIsViewport = (event.target as Element).classList.contains("canvas-minimap__viewport");
              dragOffsetRef.current = targetIsViewport
                ? {
                    x: viewportBounds.x + viewportBounds.width / 2 - point.x,
                    y: viewportBounds.y + viewportBounds.height / 2 - point.y,
                  }
                : { x: 0, y: 0 };
              centerViewport({ x: point.x + dragOffsetRef.current.x, y: point.y + dragOffsetRef.current.y });
            }
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => {
            if (activePointerRef.current === event.pointerId) {
              activePointerRef.current = null;
              dragOffsetRef.current = { x: 0, y: 0 };
              event.currentTarget.releasePointerCapture(event.pointerId);
            }
          }}
          onPointerCancel={() => {
            activePointerRef.current = null;
            dragOffsetRef.current = { x: 0, y: 0 };
          }}
        >
          {edgeSegments.map((segment) => (
            <line
              key={segment.id}
              className="canvas-minimap__edge"
              x1={segment.x1}
              y1={segment.y1}
              x2={segment.x2}
              y2={segment.y2}
              aria-hidden="true"
            />
          ))}
          {props.nodes.map((node) => (
            <rect
              key={node.id}
              className={`canvas-minimap__node canvas-minimap__node--${node.type}${
                selectedIds.has(node.id) ? " canvas-minimap__node--selected" : ""
              }`}
              x={node.x}
              y={node.y}
              width={node.width}
              height={node.height}
              aria-hidden="true"
            />
          ))}
          {/* Senza nodi il rettangolo di viewport non inquadra nulla: restava
              disegnato sopra il testo dello stato vuoto, tagliandolo a meta. */}
          {props.nodes.length > 0 ? (
            <rect
              className="canvas-minimap__viewport"
              x={viewportBounds.x}
              y={viewportBounds.y}
              width={Math.max(viewportBounds.width, 1)}
              height={Math.max(viewportBounds.height, 1)}
              aria-hidden="true"
            />
          ) : null}
        </svg>
        {props.nodes.length === 0 ? <span className="canvas-minimap__empty">{t("canvas.minimap.empty")}</span> : null}
      </div>
    </aside>
  );
}
