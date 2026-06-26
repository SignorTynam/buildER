import assert from "node:assert/strict";
import test from "node:test";

import type { AttributeNode, Bounds, EntityNode, RelationshipNode } from "../src/types/diagram.ts";
import {
  type AttributeLayoutHost,
  FIXED_ATTRIBUTE_MARKER_GAP,
  buildCenterOutOffsets,
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

function markerOffsets(host: AttributeLayoutHost, attributes: AttributeNode[]): number[] {
  const hostCenterY = host.y + host.height / 2;
  const markers = attributes.map((candidate) => getAttributeMarkerCenter(candidate));
  const positiveSteps = markers
    .map((marker) => Math.abs(marker.y - hostCenterY))
    .filter((distance) => distance > 0);
  const verticalStep = Math.min(...positiveSteps);

  return markers.map((marker) => {
    if (Math.abs(marker.y - hostCenterY) < 0.001) {
      return 0;
    }
    return Math.round((marker.y - hostCenterY) / verticalStep);
  });
}

function assertLeftCenterOut(
  host: AttributeLayoutHost,
  attributes: AttributeNode[],
  expectedOffsets: number[],
): void {
  assert.deepEqual(markerOffsets(host, attributes), expectedOffsets);
  attributes.forEach((candidate) => {
    const marker = getAttributeMarkerCenter(candidate);
    assert.equal(getDirectAttributeLayoutSide(host, candidate), "left");
    assert.equal(marker.x, host.x - FIXED_ATTRIBUTE_MARKER_GAP);
  });
}

test("attribute layout: center-out offsets are stable", () => {
  assert.deepEqual(buildCenterOutOffsets(7), [0, -1, 1, -2, 2, -3, 3]);
});

test("attribute layout: entity attributes use left center-out slots", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 5 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );

  assertLeftCenterOut(host, positioned, [0, -1, 1, -2, 2]);
});

test("attribute layout: entity attributes keep the fixed left marker gap", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 5 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );

  positioned.forEach((candidate) => {
    assert.equal(getAttributeMarkerCenter(candidate).x, host.x - FIXED_ATTRIBUTE_MARKER_GAP);
  });
});

test("attribute layout: incremental placement does not move existing attributes", () => {
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
  assertLeftCenterOut(host, [...positioned, next], [0, -1, 1, -2]);
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

  assertLeftCenterOut(host, positioned, [-1, 1, -2, 2]);
});

test("attribute layout: relationship attributes use left center-out slots", () => {
  const host = relationshipNode();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 5 }, (_, index) => attribute(`relationship-attribute${index + 1}`, index)),
  );

  assertLeftCenterOut(host, positioned, [0, -1, 1, -2, 2]);
});

test("attribute layout: composite attribute children use left center-out slots", () => {
  const host = hostAttribute();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 5 }, (_, index) => attribute(`subattribute${index + 1}`, index)),
  );

  assertLeftCenterOut(host, positioned, [0, -1, 1, -2, 2]);
});

test("attribute layout: many attributes stay on the left center-out sequence", () => {
  const host = hostEntity();
  const attributes = Array.from({ length: 20 }, (_, index) => attribute(`attribute${index + 1}`, index));
  const positioned = distributeAttributesAroundHost(host, attributes);

  assertLeftCenterOut(host, positioned, buildCenterOutOffsets(20));
});

test("attribute layout: preserveInputOrder false keeps deterministic id order on left slots", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    [attribute("attribute-c", 2), attribute("attribute-a", 0), attribute("attribute-b", 1)],
    { preserveInputOrder: false },
  );

  assert.deepEqual(positioned.map((candidate) => candidate.id), ["attribute-c", "attribute-a", "attribute-b"]);
  assertLeftCenterOut(
    host,
    [
      positioned.find((candidate) => candidate.id === "attribute-a")!,
      positioned.find((candidate) => candidate.id === "attribute-b")!,
      positioned.find((candidate) => candidate.id === "attribute-c")!,
    ],
    [0, -1, 1],
  );
});

test("sql reverse diagram uses left center-out attribute layout", () => {
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
  attributes.forEach((candidate) => {
    assert.equal(getDirectAttributeLayoutSide(host, candidate), "left");
    assert.equal(getAttributeMarkerCenter(candidate).x, host.x - FIXED_ATTRIBUTE_MARKER_GAP);
  });
});
