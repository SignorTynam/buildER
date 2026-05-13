import assert from "node:assert/strict";
import test from "node:test";

import { buildImportedOnlyExternalIdentifierLayout } from "../src/canvas/DiagramCanvas.tsx";
import type { Bounds, Point } from "../src/types/diagram.ts";

function point(x: number, y: number): Point {
  return { x, y };
}

test("external identifier imported-only: vertical layout anchors near the host top side and avoids the cardinality label", () => {
  const hostBounds: Bounds = { x: 200, y: 300, width: 160, height: 70 };
  const layout = buildImportedOnlyExternalIdentifierLayout(
    hostBounds,
    point(280, 300),
    point(280, 220),
    point(300, 260),
  );

  assert.equal(layout.junction?.y, 282);
  assert.ok((layout.marker.x ?? 0) < (layout.junction?.x ?? 0));
  assert.equal(layout.marker.y, layout.junction?.y);
});

test("external identifier imported-only: horizontal layout anchors near the host left side and avoids the cardinality label", () => {
  const hostBounds: Bounds = { x: 500, y: 200, width: 160, height: 70 };
  const layout = buildImportedOnlyExternalIdentifierLayout(
    hostBounds,
    point(500, 235),
    point(420, 235),
    point(460, 214),
  );

  assert.equal(layout.junction?.x, 482);
  assert.ok(layout.marker.y > (layout.junction?.y ?? 0));
  assert.equal(layout.marker.x, layout.junction?.x);
});

test("external identifier imported-only: diagonal layout remains anchored to the host-facing side", () => {
  const hostBounds: Bounds = { x: 100, y: 300, width: 160, height: 70 };
  const layout = buildImportedOnlyExternalIdentifierLayout(
    hostBounds,
    point(260, 320),
    point(340, 260),
    point(275, 312),
  );

  assert.equal(layout.junction?.x, 278);
  assert.ok(layout.marker.x < (layout.junction?.x ?? 0));
  assert.ok(layout.marker.y < (layout.junction?.y ?? 0));
});

test("external identifier imported-only: layout does not expose manual offset controls", () => {
  const hostBounds: Bounds = { x: 200, y: 300, width: 160, height: 70 };
  const layout = buildImportedOnlyExternalIdentifierLayout(
    hostBounds,
    point(280, 300),
    point(280, 220),
    point(300, 260),
  );

  assert.equal("offsetDirection" in layout, false);
  assert.equal("offsetMin" in layout, false);
  assert.equal("offsetMax" in layout, false);
});
