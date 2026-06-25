import assert from "node:assert/strict";
import test from "node:test";

import type { AttributeNode, EntityNode, RelationshipNode } from "../src/types/diagram.ts";
import {
  type AttributeLayoutHost,
  FIXED_ATTRIBUTE_MARKER_GAP,
  distributeAttributesAroundHost,
  getAttributeMarkerCenter,
  getDirectAttributeLayoutSide,
  placeNewAttributeAroundHost,
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

function relationshipNode(): RelationshipNode {
  return {
    id: "relationship6",
    type: "relationship",
    label: "RELATIONSHIP6",
    x: 620,
    y: 188,
    width: 150,
    height: 80,
  };
}

function hostAttribute(): AttributeNode {
  return {
    id: "attribute-host",
    type: "attribute",
    label: "INDIRIZZO",
    x: 240,
    y: 180,
    width: 150,
    height: 34,
    isMultivalued: true,
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

function perimeterDistance(host: AttributeLayoutHost, candidate: AttributeNode): number {
  const marker = getAttributeMarkerCenter(candidate);
  const clampedX = Math.min(Math.max(marker.x, host.x), host.x + host.width);
  const clampedY = Math.min(Math.max(marker.y, host.y), host.y + host.height);
  return Math.hypot(marker.x - clampedX, marker.y - clampedY);
}

function assertFixedDistance(host: AttributeLayoutHost, attributes: AttributeNode[]): void {
  attributes.forEach((candidate) => {
    assert.ok(
      Math.abs(perimeterDistance(host, candidate) - FIXED_ATTRIBUTE_MARKER_GAP) <= 0.001,
      `${candidate.id} is not at the fixed marker gap`,
    );
  });
}

function serialSides(host: AttributeLayoutHost, attributes: AttributeNode[]): string[] {
  return attributes.map((candidate) => getDirectAttributeLayoutSide(host, candidate));
}

test("attribute layout: entity attributes use a fixed marker distance", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 10 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );

  assertFixedDistance(host, positioned);
  assert.ok(Math.max(...positioned.map((candidate) => perimeterDistance(host, candidate))) <= FIXED_ATTRIBUTE_MARKER_GAP + 1);
});

test("attribute layout: entity attributes follow a deterministic serial order", () => {
  const host = hostEntity();
  const attributes = Array.from({ length: 10 }, (_, index) => attribute(`attribute${index + 1}`, index));
  const first = distributeAttributesAroundHost(host, attributes);
  const second = distributeAttributesAroundHost(host, attributes);

  assert.deepEqual(
    first.map((candidate) => ({ id: candidate.id, x: candidate.x, y: candidate.y })),
    second.map((candidate) => ({ id: candidate.id, x: candidate.x, y: candidate.y })),
  );
  assert.deepEqual(serialSides(host, first), [
    "top",
    "top",
    "top",
    "right",
    "right",
    "right",
    "bottom",
    "bottom",
    "left",
    "left",
  ]);
  assert.ok(getAttributeMarkerCenter(first[0]).x < getAttributeMarkerCenter(first[1]).x);
  assert.ok(getAttributeMarkerCenter(first[1]).x < getAttributeMarkerCenter(first[2]).x);
  assert.ok(getAttributeMarkerCenter(first[3]).y < getAttributeMarkerCenter(first[4]).y);
  assert.ok(getAttributeMarkerCenter(first[6]).x > getAttributeMarkerCenter(first[7]).x);
  assert.ok(getAttributeMarkerCenter(first[8]).y > getAttributeMarkerCenter(first[9]).y);
});

test("attribute layout: fixed layout does not create far lanes when labels are dense", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 20 }, (_, index) => ({
      ...attribute(`attribute${index + 1}`, index),
      label: `ATTRIBUTO_CON_LABEL_LUNGA_${index + 1}`,
    })),
  );

  assertFixedDistance(host, positioned);
});

test("attribute layout: relationship attributes use the same fixed serial layout", () => {
  const host = relationshipNode();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 10 }, (_, index) => attribute(`relationship-attribute${index + 1}`, index)),
  );

  assertFixedDistance(host, positioned);
  assert.deepEqual(serialSides(host, positioned), [
    "top",
    "top",
    "top",
    "right",
    "right",
    "right",
    "bottom",
    "bottom",
    "left",
    "left",
  ]);
});

test("attribute layout: composite attribute children use the same fixed serial layout", () => {
  const host = hostAttribute();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 5 }, (_, index) => attribute(`subattribute${index + 1}`, index)),
  );

  assertFixedDistance(host, positioned);
  assert.deepEqual(serialSides(host, positioned), ["top", "top", "right", "bottom", "left"]);
});

test("attribute layout: incremental placement uses the serial position for the new attribute", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 3 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );
  const frozenPositions = new Map(positioned.map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]));
  const next = placeNewAttributeAroundHost(host, positioned, attribute("attribute4", 3));

  positioned.forEach((candidate) => {
    assert.deepEqual({ x: candidate.x, y: candidate.y }, frozenPositions.get(candidate.id));
  });
  assertFixedDistance(host, [next]);
  assert.equal(getDirectAttributeLayoutSide(host, next), "left");
});

test("attribute layout: preserveInputOrder false keeps deterministic id order", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    [attribute("attribute-c", 2), attribute("attribute-a", 0), attribute("attribute-b", 1)],
    { preserveInputOrder: false },
  );

  assert.deepEqual(positioned.map((candidate) => candidate.id), ["attribute-c", "attribute-a", "attribute-b"]);
  assert.equal(getDirectAttributeLayoutSide(host, positioned.find((candidate) => candidate.id === "attribute-a")!), "top");
  assert.equal(getDirectAttributeLayoutSide(host, positioned.find((candidate) => candidate.id === "attribute-b")!), "right");
  assert.equal(getDirectAttributeLayoutSide(host, positioned.find((candidate) => candidate.id === "attribute-c")!), "bottom");
});

test("sql reverse diagram uses fixed-distance attribute layout", () => {
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

  assert.equal(attributes.length, 10);
  assertFixedDistance(host, attributes);
});
