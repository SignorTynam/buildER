import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument, DiagramEdge, DiagramNode } from "../src/types/diagram.ts";
import { getEdgeGeometry } from "../src/utils/geometry.ts";
import { parseProjectFile, serializeProjectFile } from "../src/utils/projectFile.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import { parseErsDiagram, serializeDiagramToErs } from "../src/utils/ers.ts";
import { validateDiagram } from "../src/utils/diagram.ts";

function createEntity(id: string, x: number): Extract<DiagramNode, { type: "entity" }> {
  return {
    id,
    type: "entity",
    label: id,
    x,
    y: 0,
    width: 150,
    height: 64,
    internalIdentifiers: [],
    externalIdentifiers: [],
    relationshipParticipations: [],
  };
}

function createRelationship(id: string): Extract<DiagramNode, { type: "relationship" }> {
  return {
    id,
    type: "relationship",
    label: id,
    x: 260,
    y: 0,
    width: 130,
    height: 78,
  };
}

function createConnector(id: string, entityId: string, relationshipId: string, participationId: string): DiagramEdge {
  return {
    id,
    type: "connector",
    sourceId: entityId,
    targetId: relationshipId,
    label: "",
    lineStyle: "solid",
    participationId,
  };
}

function createNormalRelationshipDiagram(): DiagramDocument {
  return {
    meta: { name: "Normal", version: 3 },
    notes: "",
    nodes: [
      {
        ...createEntity("A", 0),
        relationshipParticipations: [{ id: "p-a-r", relationshipId: "R", cardinality: "(0,N)" }],
      },
      {
        ...createEntity("B", 520),
        relationshipParticipations: [{ id: "p-b-r", relationshipId: "R", cardinality: "(1,1)" }],
      },
      createRelationship("R"),
    ],
    edges: [
      createConnector("e-a-r", "A", "R", "p-a-r"),
      createConnector("e-b-r", "B", "R", "p-b-r"),
    ],
  };
}

function createLoopDiagram(roles: Array<string | undefined>): DiagramDocument {
  return {
    meta: { name: "Loop", version: 3 },
    notes: "",
    nodes: [
      {
        ...createEntity("ENTITY15", 0),
        relationshipParticipations: roles.map((role, index) => ({
          id: `p-loop-${index + 1}`,
          relationshipId: "RELATIONSHIP16",
          cardinality: "(0,N)",
          ...(role !== undefined ? { role } : {}),
        })),
      },
      createRelationship("RELATIONSHIP16"),
    ],
    edges: roles.map((_, index) =>
      createConnector(`e-loop-${index + 1}`, "ENTITY15", "RELATIONSHIP16", `p-loop-${index + 1}`),
    ),
  };
}

function getErrors(diagram: DiagramDocument) {
  return validateDiagram(diagram).filter((issue) => issue.level === "error");
}

test("relazione normale senza ruolo resta valida", () => {
  assert.deepEqual(getErrors(createNormalRelationshipDiagram()), []);
});

test("associazione ad anello senza ruoli richiede un ruolo per ogni collegamento", () => {
  const errors = getErrors(createLoopDiagram([undefined, undefined]));

  assert.equal(errors.filter((issue) => issue.message === "Loop association requires a role for each connection.").length, 2);
});

test("associazione ad anello con un solo ruolo resta invalida", () => {
  const errors = getErrors(createLoopDiagram(["hello", undefined]));

  assert.equal(errors.some((issue) => issue.id === "loop-role-missing-e-loop-2"), true);
});

test("associazione ad anello con ruoli distinti e valida", () => {
  assert.deepEqual(getErrors(createLoopDiagram(["hello", "hi"])), []);
});

test("associazione ad anello con ruoli duplicati non e valida", () => {
  const errors = getErrors(createLoopDiagram(["parent", "parent"]));

  assert.equal(
    errors.some((issue) => issue.message === "Each connection in a loop association must have a distinct role."),
    true,
  );
});

test("due collegamenti tra gli stessi nodi ricevono geometrie separate", () => {
  const diagram = createLoopDiagram(["hello", "hi"]);
  const source = diagram.nodes.find((node) => node.id === "ENTITY15");
  const target = diagram.nodes.find((node) => node.id === "RELATIONSHIP16");
  const [firstEdge, secondEdge] = diagram.edges;

  assert.ok(source);
  assert.ok(target);
  assert.ok(firstEdge);
  assert.ok(secondEdge);

  const firstGeometry = getEdgeGeometry(firstEdge, source, target, { laneIndex: 0, laneCount: 2 });
  const secondGeometry = getEdgeGeometry(secondEdge, source, target, { laneIndex: 1, laneCount: 2 });

  assert.notDeepEqual(firstGeometry.points, secondGeometry.points);
  assert.notDeepEqual(firstGeometry.labelPoint, secondGeometry.labelPoint);
  assert.equal(firstGeometry.points.length, 2);
  assert.equal(secondGeometry.points.length, 2);
});

test("i ruoli delle partecipazioni ad anello persistono nel file progetto", () => {
  const diagram = createLoopDiagram(["hello", "hi"]);
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  const parsed = parseProjectFile(
    serializeProjectFile({
      diagram,
      translationWorkspace,
      logicalWorkspace,
      logicalGenerated: false,
      logicalStage: "translation",
      diagramView: "er",
      viewport: { x: 0, y: 0, zoom: 1 },
      translationViewport: { x: 0, y: 0, zoom: 1 },
      logicalViewport: { x: 0, y: 0, zoom: 1 },
    }),
  );
  const entity = parsed.state.diagram.nodes.find(
    (node): node is Extract<DiagramNode, { type: "entity" }> => node.id === "ENTITY15" && node.type === "entity",
  );

  assert.deepEqual(entity?.relationshipParticipations?.map((participation) => participation.role), ["hello", "hi"]);
});

test("export/import ERS conserva i ruoli dei connector ricorsivi", () => {
  const parsed = parseErsDiagram(serializeDiagramToErs(createLoopDiagram(["hello", "hi"])));
  const entity = parsed.nodes.find(
    (node): node is Extract<DiagramNode, { type: "entity" }> => node.id === "ENTITY15" && node.type === "entity",
  );

  assert.deepEqual(entity?.relationshipParticipations?.map((participation) => participation.role), ["hello", "hi"]);
});
