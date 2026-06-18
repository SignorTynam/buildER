export const DIAGRAM_ATTRIBUTE_MARKER_RADIUS = 7;
export const DIAGRAM_IDENTIFIER_TERMINAL_MARKER_RADIUS = DIAGRAM_ATTRIBUTE_MARKER_RADIUS;
export const DIAGRAM_IDENTIFIER_STROKE_WIDTH = 2;

export const DIAGRAM_IDENTIFIER_DEFAULT_STROKE = "var(--diagram-stroke)";
export const DIAGRAM_IDENTIFIER_SELECTED_STROKE = "var(--diagram-focus)";

export function getIdentifierStroke(isSelected: boolean): string {
  return isSelected ? DIAGRAM_IDENTIFIER_SELECTED_STROKE : DIAGRAM_IDENTIFIER_DEFAULT_STROKE;
}

export function getIdentifierTerminalMarkerStroke(isSelected: boolean): string {
  return getIdentifierStroke(isSelected);
}
