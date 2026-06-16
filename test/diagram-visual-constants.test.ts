import assert from "node:assert/strict";
import test from "node:test";

import {
  DIAGRAM_ATTRIBUTE_MARKER_RADIUS,
  DIAGRAM_IDENTIFIER_STROKE_WIDTH,
  DIAGRAM_IDENTIFIER_TERMINAL_MARKER_RADIUS,
} from "../src/canvas/diagramVisualConstants.ts";

test("diagram visual constants keep identifier terminal markers aligned with attribute markers", () => {
  assert.equal(DIAGRAM_ATTRIBUTE_MARKER_RADIUS, 7);
  assert.equal(DIAGRAM_IDENTIFIER_TERMINAL_MARKER_RADIUS, DIAGRAM_ATTRIBUTE_MARKER_RADIUS);
});

test("diagram visual constants keep identifier line strokes at normal connector width", () => {
  assert.equal(DIAGRAM_IDENTIFIER_STROKE_WIDTH, 2);
});
