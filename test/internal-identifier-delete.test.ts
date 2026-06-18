import assert from "node:assert/strict";
import test from "node:test";

import type { AttributeNode, DiagramDocument, EntityNode } from "../src/types/diagram.ts";
import { createSimpleInternalIdentifierForAttribute, removeInternalIdentifierFromEntity } from "../src/utils/diagram.ts";

function entity(overrides: Partial<EntityNode> = {}): EntityNode {
  return {
    id: "entity-1",
    type: "entity",
    label: "ENTITA1",
    x: 100,
    y: 100,
    width: 160,
    height: 72,
    relationshipParticipations: [],
    ...overrides,
  };
}

function attribute(id: string, overrides: Partial<AttributeNode> = {}): AttributeNode {
  return {
    id,
    type: "attribute",
    label: id,
    x: 100,
    y: 200,
    width: 120,
    height: 36,
    isIdentifier: false,
    isCompositeInternal: true,
    ...overrides,
  };
}

function diagramWithCompositeIdentifier(): DiagramDocument {
  return {
    meta: { name: "Test", version: 1 },
    notes: "",
    nodes: [
      entity({
        internalIdentifiers: [{ id: "identifier-1", attributeIds: ["attr-1", "attr-2"] }],
      }),
      attribute("attr-1"),
      attribute("attr-2"),
    ],
    edges: [
      { id: "edge-1", type: "attribute", sourceId: "entity-1", targetId: "attr-1", label: "", lineStyle: "solid" },
      { id: "edge-2", type: "attribute", sourceId: "entity-1", targetId: "attr-2", label: "", lineStyle: "solid" },
    ],
  };
}

test("removeInternalIdentifierFromEntity removes only the internal identifier", () => {
  const updated = removeInternalIdentifierFromEntity(diagramWithCompositeIdentifier(), "entity-1", "identifier-1");
  const updatedEntity = updated.nodes.find((node): node is EntityNode => node.id === "entity-1" && node.type === "entity");
  const updatedAttributes = updated.nodes.filter((node): node is AttributeNode => node.type === "attribute");

  assert.deepEqual(updatedEntity?.internalIdentifiers, undefined);
  assert.deepEqual(updatedAttributes.map((node) => node.id).sort(), ["attr-1", "attr-2"]);
  assert.deepEqual(updated.edges.map((edge) => edge.id).sort(), ["edge-1", "edge-2"]);
  assert.equal(updatedAttributes.every((node) => node.isCompositeInternal === false), true);
  assert.equal(updatedAttributes.every((node) => node.isIdentifier === false), true);
});

test("removeInternalIdentifierFromEntity preserves other internal identifiers", () => {
  const source: DiagramDocument = {
    ...diagramWithCompositeIdentifier(),
    nodes: [
      entity({
        internalIdentifiers: [
          { id: "identifier-1", attributeIds: ["attr-1", "attr-2"] },
          { id: "identifier-2", attributeIds: ["attr-3"] },
        ],
      }),
      attribute("attr-1"),
      attribute("attr-2"),
      attribute("attr-3", { isIdentifier: true, isCompositeInternal: false }),
    ],
    edges: [
      { id: "edge-1", type: "attribute", sourceId: "entity-1", targetId: "attr-1", label: "", lineStyle: "solid" },
      { id: "edge-2", type: "attribute", sourceId: "entity-1", targetId: "attr-2", label: "", lineStyle: "solid" },
      { id: "edge-3", type: "attribute", sourceId: "entity-1", targetId: "attr-3", label: "", lineStyle: "solid" },
    ],
  };

  const updated = removeInternalIdentifierFromEntity(source, "entity-1", "identifier-1");
  const updatedEntity = updated.nodes.find((node): node is EntityNode => node.id === "entity-1" && node.type === "entity");
  const remainingIdentifierAttribute = updated.nodes.find(
    (node): node is AttributeNode => node.id === "attr-3" && node.type === "attribute",
  );

  assert.deepEqual(updatedEntity?.internalIdentifiers, [{ id: "identifier-2", attributeIds: ["attr-3"] }]);
  assert.equal(remainingIdentifierAttribute?.isIdentifier, true);
  assert.equal(remainingIdentifierAttribute?.isCompositeInternal, false);
  assert.deepEqual(updated.nodes.filter((node) => node.type === "attribute").map((node) => node.id).sort(), [
    "attr-1",
    "attr-2",
    "attr-3",
  ]);
});

test("removeInternalIdentifierFromEntity removes a simple identifier without deleting a composite identifier", () => {
  const source: DiagramDocument = {
    ...diagramWithCompositeIdentifier(),
    nodes: [
      entity({
        internalIdentifiers: [
          { id: "identifier-simple", attributeIds: ["attr-3"] },
          { id: "identifier-composite", attributeIds: ["attr-1", "attr-2"] },
        ],
      }),
      attribute("attr-1"),
      attribute("attr-2"),
      attribute("attr-3", { isIdentifier: true, isCompositeInternal: false }),
    ],
    edges: [
      { id: "edge-1", type: "attribute", sourceId: "entity-1", targetId: "attr-1", label: "", lineStyle: "solid" },
      { id: "edge-2", type: "attribute", sourceId: "entity-1", targetId: "attr-2", label: "", lineStyle: "solid" },
      { id: "edge-3", type: "attribute", sourceId: "entity-1", targetId: "attr-3", label: "", lineStyle: "solid" },
    ],
  };

  const updated = removeInternalIdentifierFromEntity(source, "entity-1", "identifier-simple");
  const updatedEntity = updated.nodes.find((node): node is EntityNode => node.id === "entity-1" && node.type === "entity");
  const simpleAttribute = updated.nodes.find((node): node is AttributeNode => node.id === "attr-3" && node.type === "attribute");

  assert.deepEqual(updatedEntity?.internalIdentifiers, [
    { id: "identifier-composite", attributeIds: ["attr-1", "attr-2"] },
  ]);
  assert.deepEqual(updated.nodes.filter((node) => node.type === "attribute").map((node) => node.id).sort(), [
    "attr-1",
    "attr-2",
    "attr-3",
  ]);
  assert.deepEqual(updated.edges.map((edge) => edge.id).sort(), ["edge-1", "edge-2", "edge-3"]);
  assert.equal(simpleAttribute?.isIdentifier, false);
  assert.equal(simpleAttribute?.isCompositeInternal, false);
});

test("createSimpleInternalIdentifierForAttribute does not remove an existing identifier", () => {
  const source: DiagramDocument = {
    ...diagramWithCompositeIdentifier(),
    nodes: [
      entity({
        internalIdentifiers: [{ id: "identifier-simple", attributeIds: ["attr-1"] }],
      }),
      attribute("attr-1", { isIdentifier: true, isCompositeInternal: false }),
      attribute("attr-2", { isCompositeInternal: false }),
    ],
  };

  const result = createSimpleInternalIdentifierForAttribute(source, "attr-1");

  assert.equal(result.status, "already-exists");
  assert.equal(result.diagram, source);
  const updatedEntity = result.diagram.nodes.find(
    (node): node is EntityNode => node.id === "entity-1" && node.type === "entity",
  );
  assert.deepEqual(updatedEntity?.internalIdentifiers, [{ id: "identifier-simple", attributeIds: ["attr-1"] }]);
});
