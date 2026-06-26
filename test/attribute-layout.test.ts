import assert from "node:assert/strict";
import test from "node:test";

import type { AttributeNode, Bounds, EntityNode, RelationshipNode } from "../src/types/diagram.ts";
import {
  type AttributeLayoutHost,
  type AttributeLayoutSide,
  FIXED_ATTRIBUTE_MARKER_GAP,
  buildCenterOutOffsets,
  buildLeftPriorityPerimeterSlots,
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

function layoutSides(host: AttributeLayoutHost, attributes: AttributeNode[]): AttributeLayoutSide[] {
  return attributes.map((candidate) => getDirectAttributeLayoutSide(host, candidate));
}

function assertConstantPerimeterGap(host: AttributeLayoutHost, attributes: AttributeNode[]): void {
  attributes.forEach((candidate) => {
    const marker = getAttributeMarkerCenter(candidate);
    const side = getDirectAttributeLayoutSide(host, candidate);

    if (side === "left") {
      assert.equal(marker.x, host.x - FIXED_ATTRIBUTE_MARKER_GAP);
      assert.ok(marker.y >= host.y - 0.001, `${candidate.id} left marker is too high`);
      assert.ok(marker.y <= host.y + host.height + 0.001, `${candidate.id} left marker is too low`);
      return;
    }

    if (side === "top") {
      assert.equal(marker.y, host.y - FIXED_ATTRIBUTE_MARKER_GAP);
      return;
    }

    if (side === "bottom") {
      assert.equal(marker.y, host.y + host.height + FIXED_ATTRIBUTE_MARKER_GAP);
      return;
    }

    assert.fail(`${candidate.id} unexpectedly used right-side fallback`);
  });
}

test("attribute layout: center-out offsets are stable", () => {
  assert.deepEqual(buildCenterOutOffsets(7), [0, -1, 1, -2, 2, -3, 3]);
});

test("attribute layout: perimeter slots start left and then turn to top and bottom", () => {
  const host = hostEntity();
  const slots = buildLeftPriorityPerimeterSlots(
    host,
    Array.from({ length: 9 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );

  assert.deepEqual(
    slots.map((slot) => slot.side),
    ["left", "left", "left", "top", "bottom", "top", "bottom", "top", "bottom"],
  );
  assert.deepEqual(slots.slice(0, 3).map((slot) => slot.offsetIndex), [0, -1, 1]);
});

test("attribute layout: entity attributes follow the left-priority perimeter", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 9 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );

  assert.deepEqual(
    layoutSides(host, positioned),
    ["left", "left", "left", "top", "bottom", "top", "bottom", "top", "bottom"],
  );
  assertConstantPerimeterGap(host, positioned);
});

test("attribute layout: saturated left side does not create an infinite vertical column", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 9 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );

  const leftMarkers = positioned
    .filter((candidate) => getDirectAttributeLayoutSide(host, candidate) === "left")
    .map((candidate) => getAttributeMarkerCenter(candidate));

  assert.equal(leftMarkers.length, 3);
  leftMarkers.forEach((marker) => {
    assert.ok(marker.y >= host.y - 0.001);
    assert.ok(marker.y <= host.y + host.height + 0.001);
  });
});

test("attribute layout: incremental placement does not move existing attributes", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 5 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );
  const frozenPositions = new Map(positioned.map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]));
  const next = placeNewAttributeAroundHost(host, positioned, attribute("attribute6", 5));

  positioned.forEach((candidate) => {
    assert.deepEqual({ x: candidate.x, y: candidate.y }, frozenPositions.get(candidate.id));
  });
  assert.deepEqual(layoutSides(host, [...positioned, next]), ["left", "left", "left", "top", "bottom", "top"]);
  assertConstantPerimeterGap(host, [next]);
});

test("attribute layout: left connector corridor reserves the center slot", () => {
  const host = hostEntity();
  const centerY = host.y + host.height / 2;
  const reservedCenter: Bounds = {
    x: host.x - 160,
    y: centerY - 14,
    width: 180,
    height: 28,
  };
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 4 }, (_, index) => attribute(`attribute${index + 1}`, index)),
    { occupiedBounds: [reservedCenter] },
  );

  assert.deepEqual(layoutSides(host, positioned), ["left", "left", "top", "bottom"]);
  positioned
    .filter((candidate) => getDirectAttributeLayoutSide(host, candidate) === "left")
    .forEach((candidate) => {
      assert.notEqual(getAttributeMarkerCenter(candidate).y, centerY);
    });
  assertConstantPerimeterGap(host, positioned);
});

test("attribute layout: many attributes follow the perimeter without using right as normal layout", () => {
  const host = hostEntity();
  const attributes = Array.from({ length: 20 }, (_, index) => attribute(`attribute${index + 1}`, index));
  const positioned = distributeAttributesAroundHost(host, attributes);
  const sides = layoutSides(host, positioned);

  assert.equal(sides.includes("right"), false);
  assert.notDeepEqual(sides, Array.from({ length: 20 }, () => "left"));
  assert.equal(sides.filter((side) => side === "left").length, 3);
  assert.ok(sides.filter((side) => side === "top").length > 0);
  assert.ok(sides.filter((side) => side === "bottom").length > 0);
  assertConstantPerimeterGap(host, positioned);
});

test("attribute layout: relationship attributes use the same perimeter strategy", () => {
  const host = relationshipNode();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 6 }, (_, index) => attribute(`relationship-attribute${index + 1}`, index)),
  );
  const sides = layoutSides(host, positioned);

  assert.equal(sides[0], "left");
  assert.ok(sides.includes("top"));
  assert.ok(sides.includes("bottom"));
  assertConstantPerimeterGap(host, positioned);
});

test("attribute layout: composite attribute children use the same perimeter strategy", () => {
  const host = hostAttribute();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 6 }, (_, index) => attribute(`subattribute${index + 1}`, index)),
  );
  const sides = layoutSides(host, positioned);

  assert.equal(sides[0], "left");
  assert.ok(sides.includes("top"));
  assert.ok(sides.includes("bottom"));
  assertConstantPerimeterGap(host, positioned);
});

test("attribute layout: preserveInputOrder false keeps deterministic id order on perimeter slots", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    [attribute("attribute-c", 2), attribute("attribute-a", 0), attribute("attribute-b", 1)],
    { preserveInputOrder: false },
  );

  assert.deepEqual(positioned.map((candidate) => candidate.id), ["attribute-c", "attribute-a", "attribute-b"]);
  assert.deepEqual(
    layoutSides(host, [
      positioned.find((candidate) => candidate.id === "attribute-a")!,
      positioned.find((candidate) => candidate.id === "attribute-b")!,
      positioned.find((candidate) => candidate.id === "attribute-c")!,
    ]),
    ["left", "left", "left"],
  );
});

test("sql reverse diagram uses left-priority perimeter attribute layout", () => {
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
  assert.notDeepEqual(layoutSides(host, attributes), Array.from({ length: attributes.length }, () => "left"));
  assertConstantPerimeterGap(host, attributes);
});
