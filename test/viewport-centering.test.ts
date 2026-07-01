import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument } from "../src/types/diagram.ts";
import { createCenteredViewportForDiagram } from "../src/utils/viewport.ts";

function diagramWithNodes(): DiagramDocument {
  return {
    meta: { name: "Centered", version: 1 },
    notes: "",
    nodes: [
      { id: "a", type: "entity", label: "A", x: 0, y: 0, width: 120, height: 70 },
      { id: "b", type: "entity", label: "B", x: 400, y: 240, width: 120, height: 70 },
    ],
    edges: [],
  };
}

test("createCenteredViewportForDiagram fits node bounds inside target container", () => {
  const viewport = createCenteredViewportForDiagram(diagramWithNodes(), { width: 800, height: 500 });

  assert.ok(viewport.zoom > 0);
  assert.ok(viewport.zoom <= 1.15);
  assert.ok(Number.isFinite(viewport.x));
  assert.ok(Number.isFinite(viewport.y));
});

test("createCenteredViewportForDiagram returns default viewport for empty diagram", () => {
  const viewport = createCenteredViewportForDiagram({ meta: { name: "Empty", version: 1 }, notes: "", nodes: [], edges: [] });

  assert.deepEqual(viewport, { x: 180, y: 110, zoom: 1 });
});
