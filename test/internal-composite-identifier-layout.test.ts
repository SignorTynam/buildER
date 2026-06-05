import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCompositeIdentifierLayout,
  getCompositeInternalIdentifierFrame,
} from "../src/canvas/DiagramCanvas.tsx";
import type { Bounds, Point } from "../src/types/diagram.ts";
import { pathFromPoints } from "../src/utils/geometry.ts";

function point(x: number, y: number): Point {
  return { x, y };
}

function member(attributeId: string, attributeCenter: Point, hostAnchor: Point) {
  return {
    attributeId,
    attributeCenter,
    hostAnchor,
  };
}

const hostBounds: Bounds = { x: 100, y: 100, width: 200, height: 80 };
const hostCenter = point(200, 140);

test("internal composite identifier: top + right attributes use an open routed frame", () => {
  const layout = buildCompositeIdentifierLayout("ENTITA1::id", "ENTITA1", hostBounds, hostCenter, [
    member("ATTRIBUTO1", point(200, 40), point(200, 100)),
    member("ATTRIBUTO2", point(390, 140), point(300, 140)),
  ]);

  assert.ok(layout);
  assert.ok(layout.pathData.length > 0);
  assert.equal(layout.pathData.includes("Z"), false);
  assert.equal(layout.pathData.includes("z"), false);
  assert.ok(layout.pathPoints.length >= 3);
  assert.equal(layout.junctions.some((junction) => junction.y === layout.frame.top), true);
  assert.equal(layout.junctions.some((junction) => junction.x === layout.frame.right), true);
});

test("internal composite identifier: left + top + right attributes skip unnecessary empty sides", () => {
  const layout = buildCompositeIdentifierLayout("ENTITA1::id", "ENTITA1", hostBounds, hostCenter, [
    member("ATTRIBUTO_LEFT", point(20, 140), point(100, 140)),
    member("ATTRIBUTO_TOP", point(200, 40), point(200, 100)),
    member("ATTRIBUTO_RIGHT", point(390, 140), point(300, 140)),
  ]);

  assert.ok(layout);
  assert.equal(layout.pathPoints.some((routePoint) => routePoint.y === layout.frame.bottom), false);
  assert.equal(layout.pathData.includes(`${layout.frame.bottom.toFixed(1)}`), false);
  assert.equal(layout.pathData.includes("Z"), false);
  assert.equal(layout.pathData.includes("z"), false);
});

test("internal composite identifier: marker remains anchored near host frame when attribute moves farther", () => {
  const nearLayout = buildCompositeIdentifierLayout("ENTITA1::id", "ENTITA1", hostBounds, hostCenter, [
    member("ATTRIBUTO_TOP", point(200, 40), point(200, 100)),
    member("ATTRIBUTO_RIGHT", point(390, 140), point(300, 140)),
  ]);
  const farLayout = buildCompositeIdentifierLayout("ENTITA1::id", "ENTITA1", hostBounds, hostCenter, [
    member("ATTRIBUTO_TOP", point(200, 40), point(200, 100)),
    member("ATTRIBUTO_RIGHT", point(860, 140), point(300, 140)),
  ]);

  assert.ok(nearLayout);
  assert.ok(farLayout);
  const nearMarker = nearLayout.memberMarkers.find((markerLayout) => markerLayout.attributeId === "ATTRIBUTO_RIGHT");
  const farMarker = farLayout.memberMarkers.find((markerLayout) => markerLayout.attributeId === "ATTRIBUTO_RIGHT");

  assert.deepEqual(farMarker?.projection, nearMarker?.projection);
});

test("internal composite identifier: multiple identifiers on same entity use different lanes", () => {
  const firstLayout = buildCompositeIdentifierLayout("ENTITA1::id-a", "ENTITA1", hostBounds, hostCenter, [
    member("A1", point(200, 40), point(200, 100)),
    member("A2", point(390, 140), point(300, 140)),
  ], 0);
  const secondLayout = buildCompositeIdentifierLayout("ENTITA1::id-b", "ENTITA1", hostBounds, hostCenter, [
    member("B1", point(210, 40), point(210, 100)),
    member("B2", point(390, 150), point(300, 150)),
  ], 1);
  const firstFrame = getCompositeInternalIdentifierFrame(hostBounds, 0);
  const secondFrame = getCompositeInternalIdentifierFrame(hostBounds, 1);

  assert.ok(firstLayout);
  assert.ok(secondLayout);
  assert.notEqual(firstLayout.pathData, secondLayout.pathData);
  assert.notDeepEqual(firstFrame, secondFrame);
  assert.equal(secondFrame.top < firstFrame.top, true);
  assert.equal(secondFrame.right > firstFrame.right, true);
});

test("internal composite identifier: render path uses rounded/corner path helper", () => {
  const layout = buildCompositeIdentifierLayout("ENTITA1::id", "ENTITA1", hostBounds, hostCenter, [
    member("ATTRIBUTO1", point(200, 40), point(200, 100)),
    member("ATTRIBUTO2", point(390, 140), point(300, 140)),
  ]);

  assert.ok(layout);
  assert.ok(layout.pathPoints.length > 2);
  assert.equal(layout.pathData, pathFromPoints(layout.pathPoints));
  assert.match(layout.pathData, /^M /);
  assert.match(layout.pathData, / L /);
});
