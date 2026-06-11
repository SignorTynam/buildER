import assert from "node:assert/strict";
import test from "node:test";

import type { Bounds, DiagramEdge, DiagramNode, Point } from "../src/types/diagram.ts";
import {
  chooseCollisionFreeCardinalityLabelPlacement,
  getAttributeCardinalityAnchorPoint,
  getConnectorCardinalityAnchorPoint,
} from "../src/utils/cardinalityLayout.ts";
import {
  boundsIntersect,
  buildAttributeLabelBounds,
  buildEdgeLabelBounds,
  getPointAlongPolyline,
  type ReservedLabelBox,
} from "../src/utils/edgeLabelLayout.ts";
import { buildNodeReservedBounds } from "../src/utils/edgeLabelLayout.ts";

function entity(id: string, x: number, y: number): DiagramNode {
  return { id, type: "entity", label: id, x, y, width: 140, height: 64 };
}

function relationship(id: string, x: number, y: number): DiagramNode {
  return { id, type: "relationship", label: id, x, y, width: 130, height: 78 };
}

function attribute(id: string, x: number, y: number, label = id): DiagramNode {
  return {
    id,
    type: "attribute",
    label,
    x,
    y,
    width: Math.max(68, label.length * 8 + 34),
    height: 36,
    cardinality: "(0,N)",
  };
}

function connector(id: string, sourceId: string, targetId: string): DiagramEdge {
  return { id, type: "connector", sourceId, targetId, label: "", lineStyle: "solid" };
}

function attributeEdge(id: string, sourceId: string, targetId: string): DiagramEdge {
  return { id, type: "attribute", sourceId, targetId, label: "", lineStyle: "solid" };
}

function distance(left: Point, right: Point): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function intersectsAny(bounds: Bounds, boxes: ReservedLabelBox[]): boolean {
  return boxes.some((box) => boundsIntersect(bounds, box));
}

function edgeBox(id: string, point: Point, label = "(1,N)"): ReservedLabelBox {
  return {
    id,
    kind: "edge-label",
    ...buildEdgeLabelBounds(point, point.y, label.length * 7 + 10),
  };
}

function attributeLabelBox(node: Extract<DiagramNode, { type: "attribute" }>, host: DiagramNode): ReservedLabelBox {
  const marker = { x: node.x + 10, y: node.y + node.height / 2 };
  const hostCenter = { x: host.x + host.width / 2, y: host.y + host.height / 2 };
  const dx = hostCenter.x - marker.x;
  const dy = hostCenter.y - marker.y;
  const layout =
    Math.abs(dx) >= Math.abs(dy)
      ? {
          x: dx >= 0 ? node.x - 6 : node.x + 24,
          y: marker.y,
          textAnchor: dx >= 0 ? "end" as const : "start" as const,
        }
      : {
          x: marker.x,
          y: dy >= 0 ? node.y - 8 : node.y + node.height + 8,
          textAnchor: "middle" as const,
        };

  return {
    id: `${node.id}:label`,
    kind: "attribute-label",
    ...buildAttributeLabelBounds(node.label, layout),
  };
}

test("cardinality layout: connector label stays near source entity endpoint instead of centered", () => {
  const source = entity("ENTITY1", 0, 0);
  const target = relationship("RELATIONSHIP1", 420, -7);
  const edge = connector("edge-1", source.id, target.id);
  const endpoint = { x: source.x + source.width, y: source.y + source.height / 2 };
  const points = [endpoint, { x: target.x, y: target.y + target.height / 2 }];
  const anchor = getConnectorCardinalityAnchorPoint({ edge, sourceNode: source, targetNode: target, points });

  assert.ok(anchor);
  assert.ok(distance(anchor.point, endpoint) >= 36);
  assert.ok(distance(anchor.point, endpoint) <= 58);
  assert.ok(distance(anchor.point, getPointAlongPolyline(points, 0.5)) > 90);
});

test("cardinality layout: connector label stays near target entity endpoint for reversed edges", () => {
  const source = relationship("RELATIONSHIP1", 0, -7);
  const target = entity("ENTITY1", 420, 0);
  const edge = connector("edge-1", source.id, target.id);
  const endpoint = { x: target.x, y: target.y + target.height / 2 };
  const points = [{ x: source.x + source.width, y: source.y + source.height / 2 }, endpoint];
  const anchor = getConnectorCardinalityAnchorPoint({ edge, sourceNode: source, targetNode: target, points });

  assert.ok(anchor);
  assert.ok(distance(anchor.point, endpoint) >= 36);
  assert.ok(distance(anchor.point, endpoint) <= 58);
  assert.ok(distance(anchor.point, getPointAlongPolyline(points, 0.5)) > 90);
});

test("cardinality layout: vertical connector label stays near the entity side", () => {
  const source = entity("ENTITY1", 100, 0);
  const target = relationship("RELATIONSHIP1", 105, 260);
  const edge = connector("edge-1", source.id, target.id);
  const endpoint = { x: source.x + source.width / 2, y: source.y + source.height };
  const points = [endpoint, { x: target.x + target.width / 2, y: target.y }];
  const anchor = getConnectorCardinalityAnchorPoint({ edge, sourceNode: source, targetNode: target, points });

  assert.ok(anchor);
  assert.ok(distance(anchor.point, endpoint) >= 36);
  assert.ok(distance(anchor.point, endpoint) <= 58);
  assert.ok(anchor.point.y < getPointAlongPolyline(points, 0.5).y);
});

test("cardinality layout: attribute cardinality is anchored near the simple attribute marker", () => {
  const host = entity("ENTITY1", 260, 80);
  const attr = attribute("ATTR1", 60, 94, "attribute_name");
  const edge = attributeEdge("edge-attr", attr.id, host.id);
  const marker = { x: attr.x + 10, y: attr.y + attr.height / 2 };
  const points = [marker, { x: host.x, y: host.y + host.height / 2 }];
  const anchor = getAttributeCardinalityAnchorPoint({ edge, sourceNode: attr, targetNode: host, points });

  assert.ok(anchor);
  assert.ok(distance(anchor.point, marker) <= 44);
  assert.ok(distance(anchor.point, getPointAlongPolyline(points, 0.5)) > 55);
});

test("cardinality layout: attribute cardinalities avoid attribute labels on all sides", () => {
  const host = entity("ENTITY1", 260, 180);
  const attrs = [
    attribute("ATTR_LEFT", 60, 194, "left_attr"),
    attribute("ATTR_RIGHT", 470, 194, "right_attr"),
    attribute("ATTR_TOP", 292, 70, "top_attr"),
    attribute("ATTR_BOTTOM", 292, 320, "bottom_attr"),
  ];

  attrs.forEach((attr) => {
    const edge = attributeEdge(`edge-${attr.id}`, attr.id, host.id);
    const marker = { x: attr.x + 10, y: attr.y + attr.height / 2 };
    const points = [marker, { x: host.x + host.width / 2, y: host.y + host.height / 2 }];
    const anchor = getAttributeCardinalityAnchorPoint({ edge, sourceNode: attr, targetNode: host, points });
    assert.ok(anchor);

    const labelBox = attributeLabelBox(attr, host);
    const cardinalityBox = buildEdgeLabelBounds(anchor.point, anchor.point.y, "(0,N)".length * 7 + 10);
    assert.equal(boundsIntersect(cardinalityBox, labelBox), false, attr.id);
  });
});

test("cardinality layout: placement repairs collisions without moving to the edge midpoint", () => {
  const source = entity("ENTITY1", 0, 0);
  const target = relationship("RELATIONSHIP1", 420, -7);
  const edge = connector("edge-1", source.id, target.id);
  const endpoint = { x: source.x + source.width, y: source.y + source.height / 2 };
  const points = [endpoint, { x: target.x, y: target.y + target.height / 2 }];
  const anchor = getConnectorCardinalityAnchorPoint({ edge, sourceNode: source, targetNode: target, points });
  assert.ok(anchor);
  const reserved = [edgeBox("occupied", anchor.point)];

  const placement = chooseCollisionFreeCardinalityLabelPlacement({
    edge,
    sourceNode: source,
    targetNode: target,
    points,
    defaultPoint: anchor.point,
    label: "(1,N)",
    reservedBoxes: reserved,
    alreadyPlacedBoxes: [],
  });

  assert.equal(intersectsAny(placement.bounds, reserved), false);
  assert.ok(distance(placement.point, endpoint) < 86);
  assert.ok(distance(placement.point, getPointAlongPolyline(points, 0.5)) > 70);
});

test("cardinality layout: connector cardinality avoids role label near the same relationship", () => {
  const source = entity("ENTITY1", 0, 0);
  const target = relationship("RELATIONSHIP1", 420, -7);
  const edge = connector("edge-1", source.id, target.id);
  const points = [
    { x: source.x + source.width, y: source.y + source.height / 2 },
    { x: target.x, y: target.y + target.height / 2 },
  ];
  const rolePoint = getPointAlongPolyline(points, 0.32);
  const roleBox = edgeBox("role", rolePoint, "owner_role");

  const placement = chooseCollisionFreeCardinalityLabelPlacement({
    edge,
    sourceNode: source,
    targetNode: target,
    points,
    defaultPoint: rolePoint,
    label: "(X,Y)",
    reservedBoxes: buildNodeReservedBounds(source).concat(buildNodeReservedBounds(target)),
    alreadyPlacedBoxes: [roleBox],
  });

  assert.equal(boundsIntersect(placement.bounds, roleBox), false);
  assert.ok(distance(placement.point, points[0]) < distance(getPointAlongPolyline(points, 0.5), points[0]));
});

