import assert from "node:assert/strict";
import test from "node:test";

import type { AttributeNode, DiagramDocument, EntityNode, SelectionState } from "../src/types/diagram.ts";
import {
  createDiagramClipboardPayload,
  pasteDiagramClipboardPayload,
} from "../src/utils/clipboard.ts";
import { duplicateSelection } from "../src/utils/diagram.ts";

function entity(id: string, label = id): EntityNode {
  return {
    id,
    type: "entity",
    label,
    x: 100,
    y: 100,
    width: 140,
    height: 64,
    relationshipParticipations: [],
  };
}

function attribute(id: string, label = id): AttributeNode {
  return {
    id,
    type: "attribute",
    label,
    x: 280,
    y: 112,
    width: 120,
    height: 36,
  };
}

function baseDiagram(): DiagramDocument {
  return {
    meta: { name: "Clipboard test", version: 3 },
    notes: "",
    nodes: [
      {
        ...entity("ENTITA1", "ENTITA1"),
        internalIdentifiers: [{ id: "identifier-1", attributeIds: ["ATTRIBUTO1"] }],
        externalIdentifiers: [
          {
            id: "external-1",
            importedParts: [],
            localAttributeIds: ["ATTRIBUTO1", "missing-attribute"],
          },
        ],
      },
      attribute("ATTRIBUTO1", "ATTRIBUTO1"),
    ],
    edges: [
      {
        id: "attribute-edge-1",
        type: "attribute",
        sourceId: "ENTITA1",
        targetId: "ATTRIBUTO1",
        label: "",
        lineStyle: "solid",
      },
    ],
    generalizationGroups: [],
  };
}

const emptySelection: SelectionState = { nodeIds: [], edgeIds: [] };

test("clipboard: empty selection returns null", () => {
  assert.equal(createDiagramClipboardPayload(baseDiagram(), emptySelection), null);
});

test("clipboard: copy single entity includes owned attributes and no orphan edges", () => {
  const payload = createDiagramClipboardPayload(baseDiagram(), { nodeIds: ["ENTITA1"], edgeIds: [] });

  assert.ok(payload);
  assert.deepEqual(new Set(payload.nodes.map((node) => node.id)), new Set(["ENTITA1", "ATTRIBUTO1"]));
  assert.equal(payload.edges.length, 1);
  assert.equal(
    payload.edges.every((edge) =>
      payload.nodes.some((node) => node.id === edge.sourceId) &&
      payload.nodes.some((node) => node.id === edge.targetId),
    ),
    true,
  );
});

test("clipboard: copy entity and connected attribute includes structural edge", () => {
  const payload = createDiagramClipboardPayload(baseDiagram(), {
    nodeIds: ["ENTITA1", "ATTRIBUTO1"],
    edgeIds: [],
  });

  assert.ok(payload);
  assert.equal(payload.nodes.length, 2);
  assert.equal(payload.edges.length, 1);
  assert.equal(payload.edges[0].id, "attribute-edge-1");
});

test("clipboard: paste generates new ids and unique copy labels", () => {
  const diagram = baseDiagram();
  const payload = createDiagramClipboardPayload(diagram, { nodeIds: ["ENTITA1"], edgeIds: [] });

  assert.ok(payload);
  const firstPaste = pasteDiagramClipboardPayload(diagram, payload);
  assert.ok(firstPaste);
  const firstEntity = firstPaste.diagram.nodes.find((node) => node.id !== "ENTITA1" && node.type === "entity");

  assert.ok(firstEntity);
  assert.notEqual(firstEntity.id, "ENTITA1");
  assert.equal(firstEntity.label, "ENTITA1_C");

  const secondPaste = pasteDiagramClipboardPayload(firstPaste.diagram, payload);
  assert.ok(secondPaste);
  const secondEntity = secondPaste.diagram.nodes.find((node) => node.label === "ENTITA1_C2");

  assert.ok(secondEntity);
  assert.notEqual(secondEntity.id, "ENTITA1");
});

test("clipboard: paste preserves internal edges using new endpoint ids", () => {
  const diagram = baseDiagram();
  const payload = createDiagramClipboardPayload(diagram, {
    nodeIds: ["ENTITA1", "ATTRIBUTO1"],
    edgeIds: [],
  });

  assert.ok(payload);
  const pasted = pasteDiagramClipboardPayload(diagram, payload);
  assert.ok(pasted);
  const pastedEntity = pasted.diagram.nodes.find((node) => node.type === "entity" && node.label === "ENTITA1_C");
  const pastedAttribute = pasted.diagram.nodes.find((node) => node.type === "attribute" && node.label === "ATTRIBUTO1_C");

  assert.ok(pastedEntity);
  assert.ok(pastedAttribute);
  assert.ok(
    pasted.diagram.edges.some(
      (edge) =>
        edge.type === "attribute" &&
        edge.sourceId === pastedEntity.id &&
        edge.targetId === pastedAttribute.id,
    ),
  );
});

test("clipboard: duplicateSelection uses paste logic and selects duplicated nodes", () => {
  const diagram = baseDiagram();
  const duplicated = duplicateSelection(diagram, {
    nodeIds: ["ENTITA1", "ATTRIBUTO1"],
    edgeIds: [],
  });

  assert.ok(duplicated);
  assert.equal(diagram.nodes.some((node) => node.label === "ENTITA1_C"), false);
  assert.equal(duplicated.selection.nodeIds.length, 2);
  assert.ok(duplicated.diagram.nodes.some((node) => node.label === "ENTITA1_C"));
  assert.ok(duplicated.selection.nodeIds.every((nodeId) => !["ENTITA1", "ATTRIBUTO1"].includes(nodeId)));
});

test("clipboard: internal identifiers are remapped to pasted attributes", () => {
  const diagram = baseDiagram();
  const payload = createDiagramClipboardPayload(diagram, {
    nodeIds: ["ENTITA1", "ATTRIBUTO1"],
    edgeIds: [],
  });

  assert.ok(payload);
  const pasted = pasteDiagramClipboardPayload(diagram, payload);
  assert.ok(pasted);
  const pastedEntity = pasted.diagram.nodes.find(
    (node): node is EntityNode => node.type === "entity" && node.label === "ENTITA1_C",
  );
  const pastedAttribute = pasted.diagram.nodes.find(
    (node): node is AttributeNode => node.type === "attribute" && node.label === "ATTRIBUTO1_C",
  );

  assert.ok(pastedEntity);
  assert.ok(pastedAttribute);
  assert.deepEqual(pastedEntity.internalIdentifiers?.[0]?.attributeIds, [pastedAttribute.id]);
});

test("clipboard: external identifier local attributes do not keep broken references", () => {
  const diagram = baseDiagram();
  const payload = createDiagramClipboardPayload(diagram, {
    nodeIds: ["ENTITA1", "ATTRIBUTO1"],
    edgeIds: [],
  });

  assert.ok(payload);
  const pasted = pasteDiagramClipboardPayload(diagram, payload);
  assert.ok(pasted);
  const nodeIds = new Set(pasted.diagram.nodes.map((node) => node.id));
  const pastedEntity = pasted.diagram.nodes.find(
    (node): node is EntityNode => node.type === "entity" && node.label === "ENTITA1_C",
  );

  assert.ok(pastedEntity);
  assert.equal(
    (pastedEntity.externalIdentifiers ?? []).every((identifier) =>
      identifier.localAttributeIds.every((attributeId) => nodeIds.has(attributeId)),
    ),
    true,
  );
});

test("clipboard: edge-only copy includes both endpoints", () => {
  const payload = createDiagramClipboardPayload(baseDiagram(), {
    nodeIds: [],
    edgeIds: ["attribute-edge-1"],
  });

  assert.ok(payload);
  assert.deepEqual(new Set(payload.nodes.map((node) => node.id)), new Set(["ENTITA1", "ATTRIBUTO1"]));
  assert.equal(payload.edges.length, 1);
});
