import assert from "node:assert/strict";
import test from "node:test";

import type { AttributeNode, DiagramDocument, DiagramEdge, EntityNode, RelationshipNode } from "../src/types/diagram.ts";
import {
  getCardinalityModalPrimaryLabel,
  shouldCancelCardinalityModalFromKeyboard,
  shouldConfirmCardinalityModalFromKeyboard,
} from "../src/components/CardinalityModal.tsx";
import {
  applyConnectorCardinalityToDiagram,
  ensureConnectorParticipation,
  getEdgeCardinalityLabel,
  removeTemporaryCardinalityConnector,
  shouldOpenCardinalityDialogAfterEdgeCreation,
} from "../src/utils/cardinality.ts";
import { canEdgeUseManualRouting } from "../src/utils/edgeRouting.ts";
import { parseDiagram, serializeDiagram } from "../src/utils/diagram.ts";

function entity(id: string): EntityNode {
  return {
    id,
    type: "entity",
    label: id,
    x: 0,
    y: 0,
    width: 140,
    height: 64,
    relationshipParticipations: [],
  };
}

function relationship(id: string): RelationshipNode {
  return {
    id,
    type: "relationship",
    label: id,
    x: 220,
    y: 0,
    width: 130,
    height: 78,
  };
}

function attribute(id: string, cardinality?: string): AttributeNode {
  return {
    id,
    type: "attribute",
    label: id,
    x: 120,
    y: 120,
    width: 120,
    height: 36,
    cardinality,
  };
}

function connector(edgeId = "edge-1", participationId?: string): DiagramEdge {
  return {
    id: edgeId,
    type: "connector",
    sourceId: "ENTITY1",
    targetId: "RELATIONSHIP1",
    label: "",
    lineStyle: "solid",
    participationId,
  };
}

function baseDiagram(edge: DiagramEdge = connector()): DiagramDocument {
  return {
    meta: { name: "Cardinality flow", version: 3 },
    notes: "",
    nodes: [entity("ENTITY1"), relationship("RELATIONSHIP1")],
    edges: [edge],
  };
}

test("cardinality flow: connector without cardinality does not render placeholder", () => {
  const diagram = baseDiagram(connector());
  const [sourceNode, targetNode] = diagram.nodes;
  const [edge] = diagram.edges;

  assert.equal(getEdgeCardinalityLabel(edge, sourceNode, targetNode), "");
});

test("cardinality flow: connector with cardinality renders saved value", () => {
  const diagram = baseDiagram(connector("edge-1", "participation-edge-1"));
  const entityNode = diagram.nodes[0] as EntityNode;
  const nextDiagram = {
    ...diagram,
    nodes: [
      {
        ...entityNode,
        relationshipParticipations: [
          {
            id: "participation-edge-1",
            relationshipId: "RELATIONSHIP1",
            cardinality: "(0,N)",
          },
        ],
      },
      diagram.nodes[1],
    ],
  };

  assert.equal(getEdgeCardinalityLabel(nextDiagram.edges[0], nextDiagram.nodes[0], nextDiagram.nodes[1]), "(0,N)");
});

test("cardinality flow: new connector between entity and relationship opens cardinality dialog", () => {
  const entityNode = entity("ENTITY1");
  const relationshipNode = relationship("RELATIONSHIP1");
  const attributeNode = attribute("ATTR1");

  assert.equal(shouldOpenCardinalityDialogAfterEdgeCreation("connector", entityNode, relationshipNode), true);
  assert.equal(shouldOpenCardinalityDialogAfterEdgeCreation("connector", relationshipNode, entityNode), true);
  assert.equal(shouldOpenCardinalityDialogAfterEdgeCreation("attribute", entityNode, attributeNode), false);
  assert.equal(shouldOpenCardinalityDialogAfterEdgeCreation("inheritance", entityNode, relationshipNode), false);
});

test("cardinality flow: modal Enter shortcut confirms immediately", () => {
  assert.equal(shouldConfirmCardinalityModalFromKeyboard({ key: "Enter" }), true);
});

test("cardinality flow: modal Enter shortcut ignores modified or repeated events", () => {
  assert.equal(shouldConfirmCardinalityModalFromKeyboard({ key: "Enter", repeat: true }), false);
  assert.equal(shouldConfirmCardinalityModalFromKeyboard({ key: "Enter", ctrlKey: true }), false);
  assert.equal(shouldConfirmCardinalityModalFromKeyboard({ key: "Enter", metaKey: true }), false);
  assert.equal(shouldConfirmCardinalityModalFromKeyboard({ key: "Enter", altKey: true }), false);
  assert.equal(shouldConfirmCardinalityModalFromKeyboard({ key: "Enter", isComposing: true }), false);
  assert.equal(shouldConfirmCardinalityModalFromKeyboard({ key: "Enter", defaultPrevented: true }), false);
});

test("cardinality flow: modal Escape shortcut cancels", () => {
  assert.equal(shouldCancelCardinalityModalFromKeyboard({ key: "Escape" }), true);
  assert.equal(shouldCancelCardinalityModalFromKeyboard({ key: "Enter" }), false);
  assert.equal(shouldCancelCardinalityModalFromKeyboard({ key: "Escape", isComposing: true }), false);
});

test("cardinality flow: cancel removes temporary connector and its participation only", () => {
  const prepared = ensureConnectorParticipation(baseDiagram(connector("edge-1")), "edge-1");
  assert.ok(prepared);
  const diagramWithExtraEdge = {
    ...prepared.diagram,
    edges: [
      ...prepared.diagram.edges,
      {
        id: "attribute-edge",
        type: "attribute",
        sourceId: "ENTITY1",
        targetId: "ATTR1",
        label: "",
        lineStyle: "solid",
      } satisfies DiagramEdge,
    ],
    nodes: [...prepared.diagram.nodes, attribute("ATTR1")],
  };

  const nextDiagram = removeTemporaryCardinalityConnector(diagramWithExtraEdge, "edge-1");
  const nextEntity = nextDiagram.nodes.find((node): node is EntityNode => node.id === "ENTITY1" && node.type === "entity");

  assert.ok(nextEntity);
  assert.equal(nextDiagram.edges.some((edge) => edge.id === "edge-1"), false);
  assert.equal(nextDiagram.edges.some((edge) => edge.id === "attribute-edge"), true);
  assert.notEqual(
    nextEntity.relationshipParticipations?.some((participation) => participation.id === prepared.participationId),
    true,
  );
});

test("cardinality flow: submit new connector keeps coherent participation and cardinality", () => {
  const prepared = ensureConnectorParticipation(
    baseDiagram({ ...connector("edge-1"), manualOffset: 42 }),
    "edge-1",
  );
  assert.ok(prepared);

  const applied = applyConnectorCardinalityToDiagram(prepared.diagram, "edge-1", "(1,N)");
  assert.ok(applied);
  const nextEdge = applied.diagram.edges.find((edge) => edge.id === "edge-1");
  const nextEntity = applied.diagram.nodes.find((node): node is EntityNode => node.id === "ENTITY1" && node.type === "entity");
  const participation = nextEntity?.relationshipParticipations?.find((candidate) => candidate.id === nextEdge?.participationId);

  assert.equal(nextEdge?.type, "connector");
  assert.equal(nextEdge?.participationId, applied.participationId);
  assert.equal(nextEdge?.sourceId, "ENTITY1");
  assert.equal(nextEdge?.targetId, "RELATIONSHIP1");
  assert.equal(nextEdge?.manualOffset, undefined);
  assert.equal(participation?.relationshipId, "RELATIONSHIP1");
  assert.equal(participation?.cardinality, "(1,N)");
});

test("cardinality flow: manual routing is disabled for connectors", () => {
  assert.equal(canEdgeUseManualRouting(connector("edge-1")), false);
  assert.equal(
    canEdgeUseManualRouting({
      id: "attribute-edge",
      type: "attribute",
      sourceId: "ENTITY1",
      targetId: "ATTR1",
      label: "",
      lineStyle: "solid",
    }),
    true,
  );
});

test("cardinality flow: parse and serialize remove connector manual offset", () => {
  const diagram = baseDiagram({ ...connector("edge-1"), manualOffset: 36 });

  const serialized = serializeDiagram(diagram);
  const serializedDiagram = JSON.parse(serialized) as DiagramDocument;
  assert.equal(serializedDiagram.edges[0]?.manualOffset, undefined);

  const parsed = parseDiagram(JSON.stringify(diagram));
  assert.equal(parsed.edges[0]?.manualOffset, undefined);
});

test("cardinality flow: modal primary label reflects create versus edit mode", () => {
  assert.equal(getCardinalityModalPrimaryLabel({ mode: "create-connector", createdEdgeWasTemporary: true }), "Crea collegamento");
  assert.equal(getCardinalityModalPrimaryLabel({ mode: "edit", createdEdgeWasTemporary: false }), "Salva cardinalità");
});

test("cardinality flow: attribute cardinality labels stay empty unless explicitly set", () => {
  const host = entity("ENTITY1");
  const attributeWithoutCardinality = attribute("ATTR1");
  const attributeWithCardinality = attribute("ATTR2", "(0,N)");
  const edgeWithoutCardinality: DiagramEdge = {
    id: "attribute-edge-1",
    type: "attribute",
    sourceId: host.id,
    targetId: attributeWithoutCardinality.id,
    label: "",
    lineStyle: "solid",
  };
  const edgeWithCardinality: DiagramEdge = {
    ...edgeWithoutCardinality,
    id: "attribute-edge-2",
    targetId: attributeWithCardinality.id,
  };

  assert.equal(getEdgeCardinalityLabel(edgeWithoutCardinality, host, attributeWithoutCardinality), "");
  assert.equal(getEdgeCardinalityLabel(edgeWithCardinality, host, attributeWithCardinality), "(0,N)");
});
