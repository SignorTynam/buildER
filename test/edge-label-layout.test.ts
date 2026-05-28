import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramEdge, DiagramNode, Point } from "../src/types/diagram.ts";
import {
  boundsIntersect,
  buildEdgeLabelBounds,
  chooseCollisionFreeEdgeLabelPlacement,
  type ReservedLabelBox,
} from "../src/utils/edgeLabelLayout.ts";
import { getEdgeGeometry as getDiagramEdgeGeometry } from "../src/utils/geometry.ts";

function entity(id: string, x: number, y: number): DiagramNode {
  return { id, type: "entity", label: id, x, y, width: 140, height: 64 };
}

function relationship(id: string, x: number, y: number): DiagramNode {
  return { id, type: "relationship", label: id, x, y, width: 130, height: 78 };
}

function connector(id: string, sourceId: string, targetId: string): DiagramEdge {
  return { id, type: "connector", sourceId, targetId, label: "", lineStyle: "solid" };
}

function attribute(id: string, x: number, y: number, width = 120, height = 36): DiagramNode {
  return { id, type: "attribute", label: id, x, y, width, height };
}

function reservedBox(id: string, x: number, y: number, width: number, height: number): ReservedLabelBox {
  return { id, kind: "attribute-label", x, y, width, height };
}

function collidesWithAny(bounds: ReturnType<typeof buildEdgeLabelBounds>, boxes: ReservedLabelBox[]): boolean {
  return boxes.some((box) => boundsIntersect(bounds, box));
}

test("edge label layout evita label attributo su connector orizzontale", () => {
  const source = entity("ENTITA1", 0, 0);
  const target = relationship("RELAZIONE1", 260, -7);
  const edge = connector("edge-1", source.id, target.id);
  const points: Point[] = [
    { x: 140, y: 32 },
    { x: 260, y: 32 },
  ];
  const defaultPoint = { x: 166, y: 20 };
  const reserved = [reservedBox("ATTRIBUTO1-label", 140, 8, 86, 24)];

  const placement = chooseCollisionFreeEdgeLabelPlacement({
    edge,
    sourceNode: source,
    targetNode: target,
    points,
    defaultPoint,
    label: "(1,1)",
    reservedBoxes: reserved,
    alreadyPlacedBoxes: [],
  });

  assert.notDeepEqual(placement.point, defaultPoint);
  assert.equal(collidesWithAny(placement.bounds, reserved), false);
});

test("edge label layout evita label attributo su connector verticale", () => {
  const source = entity("ENTITA1", 0, 0);
  const target = relationship("RELAZIONE2", 5, 220);
  const edge = connector("edge-2", source.id, target.id);
  const points: Point[] = [
    { x: 70, y: 64 },
    { x: 70, y: 220 },
  ];
  const defaultPoint = { x: 84, y: 102 };
  const reserved = [reservedBox("ATTRIBUTO2-label", 48, 88, 90, 26)];

  const placement = chooseCollisionFreeEdgeLabelPlacement({
    edge,
    sourceNode: source,
    targetNode: target,
    points,
    defaultPoint,
    label: "(1,1)",
    reservedBoxes: reserved,
    alreadyPlacedBoxes: [],
  });

  assert.notDeepEqual(placement.point, defaultPoint);
  assert.equal(collidesWithAny(placement.bounds, reserved), false);
});

test("edge label layout separa due cardinalita con default sovrapposto", () => {
  const source = entity("ENTITA1", 0, 0);
  const target = relationship("RELAZIONE1", 260, 0);
  const edge1 = connector("edge-1", source.id, target.id);
  const edge2 = connector("edge-2", source.id, target.id);
  const points: Point[] = [
    { x: 140, y: 32 },
    { x: 260, y: 32 },
  ];
  const defaultPoint = { x: 166, y: 20 };

  const first = chooseCollisionFreeEdgeLabelPlacement({
    edge: edge1,
    sourceNode: source,
    targetNode: target,
    points,
    defaultPoint,
    label: "(1,1)",
    reservedBoxes: [],
    alreadyPlacedBoxes: [],
  });
  const second = chooseCollisionFreeEdgeLabelPlacement({
    edge: edge2,
    sourceNode: source,
    targetNode: target,
    points,
    defaultPoint,
    label: "(0,N)",
    reservedBoxes: [],
    alreadyPlacedBoxes: [{ id: "edge-1", kind: "edge-label", ...first.bounds }],
  });

  assert.equal(boundsIntersect(first.bounds, second.bounds), false);
});

test("edge label layout restituisce un fallback anche con tutte le candidate occupate", () => {
  const source = entity("ENTITA1", 0, 0);
  const target = relationship("RELAZIONE1", 260, 0);
  const edge = connector("edge-1", source.id, target.id);

  const placement = chooseCollisionFreeEdgeLabelPlacement({
    edge,
    sourceNode: source,
    targetNode: target,
    points: [
      { x: 140, y: 32 },
      { x: 260, y: 32 },
    ],
    defaultPoint: { x: 166, y: 20 },
    label: "(1,1)",
    reservedBoxes: [reservedBox("dense", -1000, -1000, 2000, 2000)],
    alreadyPlacedBoxes: [],
  });

  assert.ok(Number.isFinite(placement.point.x));
  assert.ok(Number.isFinite(placement.point.y));
  assert.ok(placement.bounds.width > 0);
});

test("edge label layout mantiene il default quando non ci sono collisioni", () => {
  const source = entity("ENTITA1", 0, 0);
  const target = relationship("RELAZIONE1", 260, 0);
  const edge = connector("edge-1", source.id, target.id);
  const defaultPoint = { x: 166, y: 20 };

  const placement = chooseCollisionFreeEdgeLabelPlacement({
    edge,
    sourceNode: source,
    targetNode: target,
    points: [
      { x: 140, y: 32 },
      { x: 260, y: 32 },
    ],
    defaultPoint,
    label: "(1,1)",
    reservedBoxes: [],
    alreadyPlacedBoxes: [],
  });

  assert.deepEqual(placement.point, defaultPoint);
  assert.equal(placement.y, defaultPoint.y);
});

test("geometria attributo composto collega i sotto-attributi al bordo della capsula", () => {
  const composite = attribute("ATTRIBUTO9", 200, 100, 140, 44);
  const subAttribute = attribute("ATTRIBUTO10", 400, 110);
  const edge: DiagramEdge = {
    id: "edge-composite-sub",
    type: "attribute",
    sourceId: subAttribute.id,
    targetId: composite.id,
    label: "",
    lineStyle: "solid",
  };

  const geometry = getDiagramEdgeGeometry(edge, subAttribute, composite, undefined, new Set([composite.id]));
  const compositeEndpoint = geometry.points[geometry.points.length - 1];

  assert.ok(compositeEndpoint);
  assert.ok(
    compositeEndpoint.x > composite.x + composite.width - 12,
    `expected endpoint on capsule right edge, got x=${compositeEndpoint.x}`,
  );
  assert.ok(
    Math.abs(compositeEndpoint.y - (composite.y + composite.height / 2)) < composite.height / 2,
    `expected endpoint near capsule vertical span, got y=${compositeEndpoint.y}`,
  );
});

test("geometria attributo composto resta corretta anche con edge invertito", () => {
  const composite = attribute("ATTRIBUTO9", 200, 100, 140, 44);
  const subAttribute = attribute("ATTRIBUTO10", 400, 110);
  const edge: DiagramEdge = {
    id: "edge-composite-sub-reversed",
    type: "attribute",
    sourceId: composite.id,
    targetId: subAttribute.id,
    label: "",
    lineStyle: "solid",
  };

  const geometry = getDiagramEdgeGeometry(edge, composite, subAttribute, undefined, new Set([composite.id]));
  const compositeEndpoint = geometry.points[geometry.points.length - 1];

  assert.ok(compositeEndpoint);
  assert.ok(
    compositeEndpoint.x > composite.x + composite.width - 12,
    `expected endpoint on capsule right edge, got x=${compositeEndpoint.x}`,
  );
});
