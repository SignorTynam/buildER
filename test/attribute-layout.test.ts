import assert from "node:assert/strict";
import test from "node:test";

import type { AttributeNode, Bounds, EntityNode, RelationshipNode } from "../src/types/diagram.ts";
import {
  type AttributeLayoutOptions,
  buildAttributeLayoutBounds,
  distributeAttributesAroundHost,
  getAttributeMarkerCenter,
  getDirectAttributeLayoutSide,
  placeNewAttributeAroundHost,
} from "../src/utils/attributeLayout.ts";
import { boundsIntersect } from "../src/utils/edgeLabelLayout.ts";
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

function hostBounds(host: EntityNode) {
  return {
    x: host.x,
    y: host.y,
    width: host.width,
    height: host.height,
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

function connectorCorridor(host: EntityNode, relationship: RelationshipNode, padding = 32): Bounds {
  const start = {
    x: host.x + host.width,
    y: host.y + host.height / 2,
  };
  const end = {
    x: relationship.x,
    y: relationship.y + relationship.height / 2,
  };

  return {
    x: Math.min(start.x, end.x) - padding,
    y: Math.min(start.y, end.y) - padding,
    width: Math.abs(end.x - start.x) + padding * 2,
    height: Math.abs(end.y - start.y) + padding * 2,
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

function perimeterDistance(host: EntityNode, candidate: AttributeNode): number {
  const marker = getAttributeMarkerCenter(candidate);
  const clampedX = Math.min(Math.max(marker.x, host.x), host.x + host.width);
  const clampedY = Math.min(Math.max(marker.y, host.y), host.y + host.height);
  return Math.hypot(marker.x - clampedX, marker.y - clampedY);
}

function assertNoAttributeCollisions(host: EntityNode, attributes: AttributeNode[]): void {
  attributes.forEach((candidate, index) => {
    const candidateBounds = buildAttributeLayoutBounds(host, candidate);
    assert.equal(boundsIntersect(candidateBounds, hostBounds(host)), false, `${candidate.id} overlaps host`);

    attributes.slice(index + 1).forEach((other) => {
      assert.equal(
        boundsIntersect(candidateBounds, buildAttributeLayoutBounds(host, other)),
        false,
        `${candidate.id} overlaps ${other.id}`,
      );
    });
  });
}

test("attribute layout: new attribute does not move existing attributes", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 4 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );
  const frozenPositions = new Map(positioned.map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]));
  const next = placeNewAttributeAroundHost(host, positioned, attribute("attribute5", 4));

  positioned.forEach((candidate) => {
    assert.deepEqual({ x: candidate.x, y: candidate.y }, frozenPositions.get(candidate.id));
  });
  assert.equal(boundsIntersect(buildAttributeLayoutBounds(host, next), hostBounds(host)), false);
  assert.ok(perimeterDistance(host, next) <= 90);
  assertNoAttributeCollisions(host, [...positioned, next]);
});

test("attribute layout: few attributes stay compact on one side", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 5 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );
  const counts = sideCounts(host, positioned);
  const distances = positioned.map((candidate) => perimeterDistance(host, candidate));

  assertNoAttributeCollisions(host, positioned);
  assert.equal(counts.size, 1);
  assert.equal(Math.max(...counts.values()), positioned.length);
  assert.ok(Math.max(...distances) - Math.min(...distances) <= 24);
});

test("attribute layout: many attributes avoid host and peer label collisions", () => {
  const host = hostEntity();
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 12 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );

  assertNoAttributeCollisions(host, positioned);
});

test("attribute layout: default compact side is close to host", () => {
  const host = hostEntity();

  [1, 2, 4, 5, 6, 8].forEach((count) => {
    const positioned = distributeAttributesAroundHost(
      host,
      Array.from({ length: count }, (_, index) => attribute(`attribute${count}-${index + 1}`, index)),
    );
    const distances = positioned.map((candidate) => perimeterDistance(host, candidate));

    assert.ok(Math.max(...distances) <= 130, `${count} attributes are too far from the host`);
    assert.ok(Math.min(...distances) >= 18, `${count} attributes are too close to the host`);
    assert.ok(Math.max(...distances) - Math.min(...distances) <= 8, `${count} attributes have uneven distance`);
    assertNoAttributeCollisions(host, positioned);
  });
});

test("attribute layout: connector side is avoided", () => {
  const host = hostEntity();
  const relationship = relationshipNode();
  const rightEntity: EntityNode = {
    ...hostEntity(),
    id: "entity7",
    label: "ENTITY7",
    x: 880,
  };
  const corridor = connectorCorridor(host, relationship);
  const options: AttributeLayoutOptions = {
    occupiedBounds: [
      corridor,
      { x: relationship.x - 14, y: relationship.y - 14, width: relationship.width + 28, height: relationship.height + 28 },
      { x: rightEntity.x - 14, y: rightEntity.y - 14, width: rightEntity.width + 28, height: rightEntity.height + 28 },
    ],
    sidePenalties: { right: 12000 },
    preferredSides: ["left", "right", "top", "bottom"],
  };
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 4 }, (_, index) => attribute(`attribute${index + 1}`, index)),
    options,
  );

  assertNoAttributeCollisions(host, positioned);
  positioned.forEach((candidate) => {
    assert.equal(getDirectAttributeLayoutSide(host, candidate), "left");
    assert.equal(boundsIntersect(buildAttributeLayoutBounds(host, candidate), corridor), false);
  });
});

test("attribute layout: fallback avoids overlap when preferred side is blocked", () => {
  const host = hostEntity();
  const blockedLeft: Bounds = {
    x: host.x - 90,
    y: host.y + 18,
    width: 100,
    height: host.height - 36,
  };
  const positioned = distributeAttributesAroundHost(
    host,
    Array.from({ length: 4 }, (_, index) => attribute(`attribute${index + 1}`, index)),
    {
      occupiedBounds: [blockedLeft],
      sidePenalties: { right: 12000 },
      preferredSides: ["left", "right", "top", "bottom"],
    },
  );
  const distances = positioned.map((candidate) => perimeterDistance(host, candidate));

  assertNoAttributeCollisions(host, positioned);
  assert.ok(Math.max(...distances) - Math.min(...distances) <= 8);
  positioned.forEach((candidate) => {
    assert.equal(boundsIntersect(buildAttributeLayoutBounds(host, candidate), blockedLeft), false);
  });
});

test("attribute layout: manual valid positions are preserved by incremental placement", () => {
  const host = hostEntity();
  const manualAttributes = [
    { ...attribute("manual1", 0), x: host.x + host.width + 42, y: host.y + 30 },
    { ...attribute("manual2", 1), x: host.x - 74, y: host.y + 30 },
    { ...attribute("manual3", 2), x: host.x + host.width / 2 - 10, y: host.y - 70 },
  ];
  const frozenPositions = new Map(manualAttributes.map((candidate) => [candidate.id, { x: candidate.x, y: candidate.y }]));
  const next = placeNewAttributeAroundHost(host, manualAttributes, attribute("attribute4", 3));

  manualAttributes.forEach((candidate) => {
    assert.deepEqual({ x: candidate.x, y: candidate.y }, frozenPositions.get(candidate.id));
  });
  assertNoAttributeCollisions(host, [...manualAttributes, next]);
});

test("attribute layout: legacy far attributes are repaired by bulk layout", () => {
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

  assert.ok(positionedFar);
  assert.notEqual(positionedFar.x, farAttribute.x);
  assert.ok(perimeterDistance(host, positionedFar) <= 150);
  assertNoAttributeCollisions(host, positioned);
});

test("attribute layout: incremental candidate uses a balanced compact slot", () => {
  const host = hostEntity();
  const existing = distributeAttributesAroundHost(
    host,
    Array.from({ length: 3 }, (_, index) => attribute(`attribute${index + 1}`, index)),
  );
  const next = placeNewAttributeAroundHost(host, existing, attribute("attribute4", 3));

  assert.equal(getDirectAttributeLayoutSide(host, next), getDirectAttributeLayoutSide(host, existing[0]));
  assert.ok(perimeterDistance(host, next) <= 90);
  assertNoAttributeCollisions(host, [...existing, next]);
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
  assertNoAttributeCollisions(host, attributes);
});
