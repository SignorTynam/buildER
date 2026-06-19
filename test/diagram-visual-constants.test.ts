import assert from "node:assert/strict";
import test from "node:test";

import {
  DIAGRAM_ATTRIBUTE_MARKER_RADIUS,
  DIAGRAM_IDENTIFIER_DEFAULT_STROKE,
  DIAGRAM_IDENTIFIER_SELECTED_STROKE,
  DIAGRAM_IDENTIFIER_STROKE_WIDTH,
  DIAGRAM_IDENTIFIER_TERMINAL_MARKER_RADIUS,
  getIdentifierStroke,
  getIdentifierTerminalMarkerStroke,
} from "../src/canvas/diagramVisualConstants.ts";
import { readFileSync } from "node:fs";

test("diagram visual constants keep identifier terminal markers aligned with attribute markers", () => {
  assert.equal(DIAGRAM_ATTRIBUTE_MARKER_RADIUS, 7);
  assert.equal(DIAGRAM_IDENTIFIER_TERMINAL_MARKER_RADIUS, DIAGRAM_ATTRIBUTE_MARKER_RADIUS);
});

test("diagram visual constants keep identifier line strokes at normal connector width", () => {
  assert.equal(DIAGRAM_IDENTIFIER_STROKE_WIDTH, 2);
});

test("identifier selection stroke helpers only swap the stroke color", () => {
  assert.equal(getIdentifierStroke(false), DIAGRAM_IDENTIFIER_DEFAULT_STROKE);
  assert.equal(getIdentifierStroke(true), DIAGRAM_IDENTIFIER_SELECTED_STROKE);
  assert.equal(getIdentifierTerminalMarkerStroke(false), DIAGRAM_IDENTIFIER_DEFAULT_STROKE);
  assert.equal(getIdentifierTerminalMarkerStroke(true), DIAGRAM_IDENTIFIER_SELECTED_STROKE);
});

test("identifier selected rendering does not reintroduce large focus rings", () => {
  const source = readFileSync(new URL("../src/canvas/DiagramCanvas.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /composite-identifier-focus-ring/);
  assert.doesNotMatch(source, /external-identifier-focus-ring/);
  assert.doesNotMatch(source, /DIAGRAM_IDENTIFIER_STROKE_WIDTH\s*\+\s*4/);
  assert.doesNotMatch(source, /DIAGRAM_IDENTIFIER_TERMINAL_MARKER_RADIUS\s*\+\s*4/);
});
