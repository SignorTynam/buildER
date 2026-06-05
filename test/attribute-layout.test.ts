import assert from "node:assert/strict";
import test from "node:test";

import type { AttributeNode, EntityNode } from "../src/types/diagram.ts";
import {
  distributeAttributesAroundHost,
  getAttributeMarkerCenter,
  getDirectAttributeLayoutSide,
} from "../src/utils/attributeLayout.ts";
import { reverseSqlToDiagram } from "../src/utils/sqlReverseDiagram.ts";

function hostEntity(): EntityNode {
  return {
    id: "entity1",
    type: "entity",
    label: "ENTITA1",
    x: 240,
    y: 180,
    width: 220,
    height: 96,
    relationshipParticipations: [],
  };
}

function attribute(id: string, index: number): AttributeNode {
  return {
    id,
    type: "attribute",
    label: `ATTRIBUTO${index + 1}`,
    x: 620,
    y: 180 + index * 44,
    width: 150,
    height: 36,
  };
}

function sideCounts(host: EntityNode, attributes: AttributeNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  attributes.forEach((candidate) => {
    const side = getDirectAttributeLayoutSide(host, candidate);
    counts.set(side, (counts.get(side) ?? 0) + 1);
  });
  return counts;
}

function intersectsHost(host: EntityNode, candidate: AttributeNode): boolean {
  return !(
    candidate.x + candidate.width <= host.x ||
    candidate.x >= host.x + host.width ||
    candidate.y + candidate.height <= host.y ||
    candidate.y >= host.y + host.height
  );
}

test("attribute layout: six attributes are distributed on multiple sides", () => {
  const host = hostEntity();
  const attributes = Array.from({ length: 6 }, (_, index) => attribute(`attribute${index + 1}`, index));
  const positioned = distributeAttributesAroundHost(host, attributes);
  const counts = sideCounts(host, positioned);

  assert.ok(counts.size >= 3);
  assert.notEqual(counts.get("right"), positioned.length);
  assert.equal(positioned.some((candidate) => intersectsHost(host, candidate)), false);
});

test("attribute layout: many attributes do not stack in one descending column", () => {
  const host = hostEntity();
  const attributes = Array.from({ length: 10 }, (_, index) => attribute(`attribute${index + 1}`, index));
  const positioned = distributeAttributesAroundHost(host, attributes);
  const counts = [...sideCounts(host, positioned).values()];
  const uniqueMarkerX = new Set(positioned.map((candidate) => Math.round(getAttributeMarkerCenter(candidate).x)));

  assert.ok(counts.length >= 4);
  assert.ok(Math.max(...counts) <= 3);
  assert.ok(uniqueMarkerX.size > 2);
});

test("attribute layout: existing far attributes are pulled back near the host", () => {
  const host = hostEntity();
  const farAttribute = {
    ...attribute("attribute3", 2),
    x: host.x - 920,
    y: host.y - 140,
  };
  const attributes = [
    attribute("attribute1", 0),
    attribute("attribute2", 1),
    farAttribute,
    attribute("attribute4", 3),
    attribute("attribute5", 4),
    attribute("attribute6", 5),
  ];
  const positioned = distributeAttributesAroundHost(host, attributes);
  const positionedFar = positioned.find((candidate) => candidate.id === farAttribute.id);
  const hostCenter = { x: host.x + host.width / 2, y: host.y + host.height / 2 };
  const marker = positionedFar ? getAttributeMarkerCenter(positionedFar) : { x: 0, y: 0 };
  const distance = Math.hypot(marker.x - hostCenter.x, marker.y - hostCenter.y);

  assert.ok(positionedFar);
  assert.ok(distance < 360);
  assert.notEqual(positionedFar.x, farAttribute.x);
});

test("attribute layout: three attributes do not leave the third at its old far position", () => {
  const host = hostEntity();
  const farThird = {
    ...attribute("attribute3", 2),
    x: host.x - 900,
    y: host.y - 120,
  };
  const positioned = distributeAttributesAroundHost(host, [
    attribute("attribute1", 0),
    attribute("attribute2", 1),
    farThird,
  ]);
  const positionedThird = positioned.find((candidate) => candidate.id === farThird.id);
  const hostCenter = { x: host.x + host.width / 2, y: host.y + host.height / 2 };
  const marker = positionedThird ? getAttributeMarkerCenter(positionedThird) : { x: 0, y: 0 };
  const distance = Math.hypot(marker.x - hostCenter.x, marker.y - hostCenter.y);

  assert.ok(positionedThird);
  assert.notEqual(positionedThird.x, farThird.x);
  assert.ok(distance < 360);
});

test("attribute layout: simulated next attribute uses a balanced slot", () => {
  const host = hostEntity();
  const existing = Array.from({ length: 3 }, (_, index) => attribute(`attribute${index + 1}`, index));
  const next = attribute("attribute4", 3);
  const positioned = distributeAttributesAroundHost(host, [...existing, next]);
  const positionedNext = positioned.find((candidate) => candidate.id === next.id);

  assert.ok(positionedNext);
  assert.equal(getDirectAttributeLayoutSide(host, positionedNext), "bottom");
  assert.notEqual(positionedNext.x, next.x);
  assert.notEqual(positionedNext.y, next.y);
});

test("sql reverse diagram distributes generated attributes around entity", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE WideEntity (
      id INTEGER PRIMARY KEY,
      col_1 TEXT,
      col_2 TEXT,
      col_3 TEXT,
      col_4 TEXT,
      col_5 TEXT,
      col_6 TEXT,
      col_7 TEXT,
      col_8 TEXT,
      col_9 TEXT
    );
  `);
  const host = result.diagram.nodes.find((node): node is EntityNode => node.type === "entity" && node.label === "WideEntity");

  assert.ok(host);
  const attributeIds = new Set(
    result.diagram.edges
      .filter((edge) => edge.type === "attribute" && edge.sourceId === host.id)
      .map((edge) => edge.targetId),
  );
  const attributes = result.diagram.nodes.filter(
    (node): node is AttributeNode => node.type === "attribute" && attributeIds.has(node.id),
  );
  const counts = sideCounts(host, attributes);

  assert.equal(attributes.length, 10);
  assert.ok(counts.size >= 3);
  assert.notEqual(counts.get("right"), attributes.length);
});
