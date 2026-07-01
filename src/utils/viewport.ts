import type { DiagramDocument, Viewport } from "../types/diagram";

const DEFAULT_CENTER_CONTAINER = {
  width: 1180,
  height: 760,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createCenteredViewportForDiagram(
  diagram: DiagramDocument,
  containerSize: { width: number; height: number } = DEFAULT_CENTER_CONTAINER,
  options: { padding?: number; minZoom?: number; maxZoom?: number } = {},
): Viewport {
  if (diagram.nodes.length === 0) {
    return { x: 180, y: 110, zoom: 1 };
  }

  const padding = options.padding ?? 96;
  const minZoom = options.minZoom ?? 0.35;
  const maxZoom = options.maxZoom ?? 1.15;
  const minX = Math.min(...diagram.nodes.map((node) => node.x));
  const minY = Math.min(...diagram.nodes.map((node) => node.y));
  const maxX = Math.max(...diagram.nodes.map((node) => node.x + node.width));
  const maxY = Math.max(...diagram.nodes.map((node) => node.y + node.height));
  const boundsWidth = Math.max(maxX - minX, 1);
  const boundsHeight = Math.max(maxY - minY, 1);
  const availableWidth = Math.max(containerSize.width - padding * 2, 1);
  const availableHeight = Math.max(containerSize.height - padding * 2, 1);
  const zoom = clamp(Math.min(availableWidth / boundsWidth, availableHeight / boundsHeight), minZoom, maxZoom);
  const centerX = minX + boundsWidth / 2;
  const centerY = minY + boundsHeight / 2;

  return {
    x: Math.round(containerSize.width / 2 - centerX * zoom),
    y: Math.round(containerSize.height / 2 - centerY * zoom),
    zoom: Number(zoom.toFixed(3)),
  };
}
