import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument, DiagramEdge, DiagramNode } from "../src/types/diagram.ts";
import {
  assignInheritanceEdgeToGeneralizationGroup,
  assignInheritanceConstraintToGroup,
  canAttributeBecomeComposite,
  createEdge,
  cleanupGeneralizationReferences,
  createGeneralizationGroupForInheritanceEdge,
  getMultivaluedAttributeSize,
  getPreferredNodeSizeForLabel,
  mergeCompatibleGeneralizationGroups,
  normalizeGeneralizationGroups,
  parseDiagram,
  removeEntityFromGeneralizationHierarchy,
  removeExternalIdentifierFromEntity,
  removeSelection,
  removeSubtypeFromGeneralizationGroup,
  renameNodeAsNameIdentity,
  synchronizeExternalIdentifiers,
  updateGeneralizationGroupDetails,
  updateGeneralizationGroupConstraint,
  validateDiagram,
  validateExternalIdentifier,
  withPreferredNodeSizeForLabel,
} from "../src/utils/diagram.ts";
import { computeClassicIsaGroupLayout } from "../src/utils/geometry.ts";
import { buildInheritanceGroups, getInheritanceGroupLayout } from "../src/utils/inheritanceLayout.ts";
import { parseErsDiagram, serializeDiagramToErs } from "../src/utils/ers.ts";
import { normalizeCardinalityInput } from "../src/utils/cardinality.ts";
import { serializeDiagramForCodePanel } from "../src/utils/codePanelSerializer.ts";

function findEntity(diagram: DiagramDocument, label: string): Extract<DiagramNode, { type: "entity" }> | undefined {
  return diagram.nodes.find(
    (node): node is Extract<DiagramNode, { type: "entity" }> => node.type === "entity" && node.label === label,
  );
}

function findDirectAttribute(
  diagram: DiagramDocument,
  entityLabel: string,
  attributeLabel: string,
): Extract<DiagramNode, { type: "attribute" }> | undefined {
  const entity = findEntity(diagram, entityLabel);
  if (!entity) {
    return undefined;
  }

  return diagram.nodes.find(
    (node): node is Extract<DiagramNode, { type: "attribute" }> =>
      node.type === "attribute" &&
      node.label === attributeLabel &&
      diagram.edges.some(
        (edge) =>
          edge.type === "attribute" &&
          ((edge.sourceId === node.id && edge.targetId === entity.id) ||
            (edge.sourceId === entity.id && edge.targetId === node.id)),
      ),
  );
}

function findRelationship(
  diagram: DiagramDocument,
  label: string,
): Extract<DiagramNode, { type: "relationship" }> | undefined {
  return diagram.nodes.find(
    (node): node is Extract<DiagramNode, { type: "relationship" }> =>
      node.type === "relationship" && node.label === label,
  );
}

function findRelationshipAttribute(
  diagram: DiagramDocument,
  relationshipLabel: string,
  attributeLabel: string,
): Extract<DiagramNode, { type: "attribute" }> | undefined {
  const relationship = findRelationship(diagram, relationshipLabel);
  if (!relationship) {
    return undefined;
  }

  return diagram.nodes.find(
    (node): node is Extract<DiagramNode, { type: "attribute" }> =>
      node.type === "attribute" &&
      node.label === attributeLabel &&
      diagram.edges.some(
        (edge) =>
          edge.type === "attribute" &&
          ((edge.sourceId === node.id && edge.targetId === relationship.id) ||
            (edge.sourceId === relationship.id && edge.targetId === node.id)),
      ),
  );
}

test("relationship preferred size stays close to base for a short label", () => {
  const size = getPreferredNodeSizeForLabel("relationship", "RELAZIONE1");

  assert.ok(size.width >= 130);
  assert.ok(size.width <= 150);
  assert.ok(size.height >= 78);
  assert.ok(size.height <= 90);
});

test("relationship preferred size grows wide but not very tall for a long label", () => {
  const shortSize = getPreferredNodeSizeForLabel("relationship", "RELAZIONE1");
  const longSize = getPreferredNodeSizeForLabel("relationship", `RELAZIONE1${"W".repeat(30)}`);

  assert.ok(longSize.width > shortSize.width);
  assert.ok(longSize.height > shortSize.height);
  assert.ok(longSize.height <= 120);
});

test("relationship preferred resize after rename shrinks and preserves center", () => {
  const node: Extract<DiagramNode, { type: "relationship" }> = {
    id: "RELAZIONE1",
    type: "relationship",
    label: "RELAZIONE1",
    x: 100,
    y: 80,
    width: 560,
    height: 220,
  };
  const center = {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };

  const resized = withPreferredNodeSizeForLabel(node);

  assert.ok(resized.width < node.width);
  assert.ok(resized.height < node.height);
  assert.equal(resized.x + resized.width / 2, center.x);
  assert.equal(resized.y + resized.height / 2, center.y);
});

test("entity preferred size grows for a long label", () => {
  const shortSize = getPreferredNodeSizeForLabel("entity", "Cliente");
  const longSize = getPreferredNodeSizeForLabel("entity", "CLIENTE_CON_NOME_MOLTO_MOLTO_LUNGO");

  assert.ok(longSize.width > shortSize.width);
  assert.equal(longSize.height, shortSize.height);
});

test("entity preferred resize after rename shrinks and preserves center", () => {
  const node: Extract<DiagramNode, { type: "entity" }> = {
    id: "CLIENTE",
    type: "entity",
    label: "Cliente",
    x: 100,
    y: 80,
    width: 560,
    height: 64,
    relationshipParticipations: [],
  };
  const center = {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
  const shortSize = getPreferredNodeSizeForLabel("entity", node.label);

  const resized = withPreferredNodeSizeForLabel(node);

  assert.ok(resized.width < node.width);
  assert.equal(resized.width, shortSize.width);
  assert.equal(resized.height, shortSize.height);
  assert.equal(resized.x + resized.width / 2, center.x);
  assert.equal(resized.y + resized.height / 2, center.y);
});

test("entity preferred resize after rename expands and preserves center", () => {
  const node: Extract<DiagramNode, { type: "entity" }> = {
    id: "CLIENTE_CON_NOME_MOLTO_MOLTO_LUNGO",
    type: "entity",
    label: "CLIENTE_CON_NOME_MOLTO_MOLTO_LUNGO",
    x: 100,
    y: 80,
    width: getPreferredNodeSizeForLabel("entity", "Cliente").width,
    height: getPreferredNodeSizeForLabel("entity", "Cliente").height,
    relationshipParticipations: [],
  };
  const center = {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2,
  };
  const longSize = getPreferredNodeSizeForLabel("entity", node.label);

  const resized = withPreferredNodeSizeForLabel(node, center);

  assert.ok(resized.width > node.width);
  assert.equal(resized.width, longSize.width);
  assert.equal(resized.height, longSize.height);
  assert.equal(resized.x + resized.width / 2, center.x);
  assert.equal(resized.y + resized.height / 2, center.y);
});

test("entity preferred width does not shrink below base width", () => {
  const baseSize = getPreferredNodeSizeForLabel("entity", "");
  const shortSize = getPreferredNodeSizeForLabel("entity", "A");

  assert.equal(shortSize.width, baseSize.width);
  assert.equal(shortSize.height, baseSize.height);
});

test("preferred label resize does not affect attributes", () => {
  const node: Extract<DiagramNode, { type: "attribute" }> = {
    id: "ATTRIBUTO1",
    type: "attribute",
    label: "ATTRIBUTO_CON_NOME_MOLTO_MOLTO_LUNGO",
    x: 100,
    y: 80,
    width: 150,
    height: 28,
  };

  const resized = withPreferredNodeSizeForLabel(node);

  assert.deepEqual(resized, node);
});

test("multivalued attribute size uses compact capsule height and adaptive width", () => {
  const shortSize = getMultivaluedAttributeSize("ATTRIBUTO1");
  const longSize = getMultivaluedAttributeSize("ATTRIBUTO_CON_NOME_MOLTO_MOLTO_LUNGO");

  assert.equal(shortSize.height, 34);
  assert.equal(longSize.height, 34);
  assert.ok(longSize.width > shortSize.width);
});

test("parseDiagram normalizes legacy multivalued attributes to compact height", () => {
  const parsed = parseDiagram(
    JSON.stringify({
      meta: { name: "Legacy multivalued", version: 3 },
      notes: "",
      nodes: [
        {
          id: "attr-composite",
          type: "attribute",
          label: "INDIRIZZO",
          x: 100,
          y: 80,
          width: 180,
          height: 44,
          isMultivalued: true,
        },
        {
          id: "attr-simple",
          type: "attribute",
          label: "VIA",
          x: 100,
          y: 160,
          width: 150,
          height: 28,
          isMultivalued: false,
        },
      ],
      edges: [],
    } satisfies DiagramDocument),
  );
  const composite = parsed.nodes.find(
    (node): node is Extract<DiagramNode, { type: "attribute" }> =>
      node.type === "attribute" && node.isMultivalued === true,
  );
  const simple = parsed.nodes.find(
    (node): node is Extract<DiagramNode, { type: "attribute" }> =>
      node.type === "attribute" && node.isMultivalued !== true,
  );

  assert.equal(composite?.height, 34);
  assert.equal(composite?.width, getMultivaluedAttributeSize("INDIRIZZO").width);
  assert.equal(simple?.height, 28);
  assert.equal(simple?.width, 150);
});

test("ERS serialization does not emit project notes", () => {
  const diagram = createCodeLayoutFixture();
  diagram.notes = "Test notes";

  const serialized = serializeDiagramToErs(diagram);

  assert.doesNotMatch(serialized, /\bnotes\b/i);
  assert.equal(serialized.includes("Test notes"), false);
});

test("legacy ERS notes parse but are not serialized again", () => {
  const parsed = parseErsDiagram(`notes "Test notes"
entity ENTITA1 {}`);

  assert.equal(parsed.notes, "Test notes");
  const serialized = serializeDiagramToErs(parsed);
  assert.doesNotMatch(serialized, /\bnotes\b/i);
  assert.equal(serialized.includes("Test notes"), false);
});

test("code panel serialization does not show project notes", () => {
  const diagram = createCodeLayoutFixture();
  diagram.notes = "Test notes";

  const code = serializeDiagramForCodePanel(diagram);

  assert.doesNotMatch(code, /\bnotes\b/i);
  assert.equal(code.includes("Test notes"), false);
});

test("Code panel serializza attributi collegati a una relazione", () => {
  const diagram: DiagramDocument = {
    meta: { name: "Relationship attributes", version: 3 },
    notes: "",
    nodes: [
      {
        id: "CLIENTE",
        type: "entity",
        label: "Cliente",
        x: 80,
        y: 240,
        width: 140,
        height: 64,
        relationshipParticipations: [
          { id: "participation-cliente-prenotazione", relationshipId: "PRENOTAZIONE", cardinality: "(1,N)" },
        ],
      },
      {
        id: "CAMERA",
        type: "entity",
        label: "Camera",
        x: 460,
        y: 240,
        width: 140,
        height: 64,
        relationshipParticipations: [
          { id: "participation-camera-prenotazione", relationshipId: "PRENOTAZIONE", cardinality: "(1,N)" },
        ],
      },
      { id: "PRENOTAZIONE", type: "relationship", label: "Prenotazione", x: 280, y: 160, width: 150, height: 86 },
      { id: "CLIENTE.NOME", type: "attribute", label: "nome", x: 80, y: 120, width: 150, height: 28 },
      { id: "PRENOTAZIONE.DATA", type: "attribute", label: "data", x: 280, y: 80, width: 150, height: 28 },
      {
        id: "PRENOTAZIONE.NOTE",
        type: "attribute",
        label: "note",
        x: 460,
        y: 80,
        width: 150,
        height: 34,
        isMultivalued: true,
      },
      {
        id: "PRENOTAZIONE.PREZZO",
        type: "attribute",
        label: "prezzo",
        x: 640,
        y: 80,
        width: 150,
        height: 28,
        cardinality: "(1,N)",
      },
    ],
    edges: [
      {
        id: "connector-cliente-prenotazione",
        type: "connector",
        sourceId: "CLIENTE",
        targetId: "PRENOTAZIONE",
        label: "",
        lineStyle: "solid",
        participationId: "participation-cliente-prenotazione",
      },
      {
        id: "connector-camera-prenotazione",
        type: "connector",
        sourceId: "CAMERA",
        targetId: "PRENOTAZIONE",
        label: "",
        lineStyle: "solid",
        participationId: "participation-camera-prenotazione",
      },
      { id: "attribute-cliente-nome", type: "attribute", sourceId: "CLIENTE", targetId: "CLIENTE.NOME", label: "", lineStyle: "solid" },
      {
        id: "attribute-prenotazione-data",
        type: "attribute",
        sourceId: "PRENOTAZIONE",
        targetId: "PRENOTAZIONE.DATA",
        label: "",
        lineStyle: "solid",
      },
      {
        id: "attribute-prenotazione-note",
        type: "attribute",
        sourceId: "PRENOTAZIONE",
        targetId: "PRENOTAZIONE.NOTE",
        label: "",
        lineStyle: "solid",
      },
      {
        id: "attribute-prenotazione-prezzo",
        type: "attribute",
        sourceId: "PRENOTAZIONE",
        targetId: "PRENOTAZIONE.PREZZO",
        label: "",
        lineStyle: "solid",
      },
    ],
  };

  const code = serializeDiagramForCodePanel(diagram);

  assert.match(code, /^relationship Prenotazione \($/m);
  assert.match(code, /^    Camera: one\.\.many,$/m);
  assert.match(code, /^    Cliente: one\.\.many$/m);
  assert.match(code, /^\) \{$/m);
  assert.match(code, /^    data,$/m);
  assert.match(code, /^    note \(multi\),$/m);
  assert.match(code, /^    prezzo \(one\.\.many\)$/m);
  assert.match(code, /^entity Cliente \{$/m);
  assert.match(code, /^    nome$/m);

  const parsed = parseErsDiagram(code);
  const parsedRelationship = findRelationship(parsed, "Prenotazione");
  const parsedData = findRelationshipAttribute(parsed, "Prenotazione", "data");
  const parsedNote = findRelationshipAttribute(parsed, "Prenotazione", "note");
  const parsedPrezzo = findRelationshipAttribute(parsed, "Prenotazione", "prezzo");

  assert.ok(parsedRelationship);
  assert.ok(findEntity(parsed, "Cliente"));
  assert.ok(findEntity(parsed, "Camera"));
  assert.ok(parsedData);
  assert.equal(parsedNote?.isMultivalued, true);
  assert.equal(parsedPrezzo?.cardinality, "(1,N)");
  assert.ok(findDirectAttribute(parsed, "Cliente", "nome"));

  const reparsedCode = serializeDiagramToErs(parsed);
  assert.match(reparsedCode, /^    note \(multi\),$/m);
  assert.match(reparsedCode, /^    prezzo \(one\.\.many\)$/m);
});

function createCodeLayoutFixture(): DiagramDocument {
  return {
    meta: { name: "Code layout fixture", version: 3 },
    notes: "",
    nodes: [
      {
        id: "ENTITA1",
        type: "entity",
        label: "ENTITA1",
        x: 135,
        y: 245,
        width: 168,
        height: 72,
        relationshipParticipations: [
          { id: "participation-entita1-relazione1", relationshipId: "RELAZIONE1", cardinality: "(0,N)" },
        ],
      },
      {
        id: "ENTITA2",
        type: "entity",
        label: "ENTITA2",
        x: 610,
        y: 385,
        width: 154,
        height: 68,
        relationshipParticipations: [
          { id: "participation-entita2-relazione1", relationshipId: "RELAZIONE1", cardinality: "(1,N)" },
        ],
      },
      { id: "RELAZIONE1", type: "relationship", label: "RELAZIONE1", x: 390, y: 155, width: 146, height: 86 },
      {
        id: "ENTITA1.NOME",
        type: "attribute",
        label: "NOME",
        x: 54,
        y: 124,
        width: 118,
        height: 38,
        isIdentifier: false,
        isCompositeInternal: false,
        isMultivalued: false,
      },
      {
        id: "ENTITA1.COGNOME",
        type: "attribute",
        label: "COGNOME",
        x: 320,
        y: 345,
        width: 142,
        height: 40,
        isIdentifier: false,
        isCompositeInternal: false,
        isMultivalued: false,
      },
    ],
    edges: [
      {
        id: "connector-ENTITA1-RELAZIONE1-1",
        type: "connector",
        sourceId: "ENTITA1",
        targetId: "RELAZIONE1",
        label: "",
        lineStyle: "solid",
        participationId: "participation-entita1-relazione1",
      },
      {
        id: "connector-ENTITA2-RELAZIONE1-1",
        type: "connector",
        sourceId: "ENTITA2",
        targetId: "RELAZIONE1",
        label: "",
        lineStyle: "dashed",
        participationId: "participation-entita2-relazione1",
      },
      {
        id: "attribute-ENTITA1-NOME-1",
        type: "attribute",
        sourceId: "ENTITA1",
        targetId: "ENTITA1.NOME",
        label: "",
        lineStyle: "solid",
      },
      {
        id: "attribute-ENTITA1-COGNOME-1",
        type: "attribute",
        sourceId: "ENTITA1",
        targetId: "ENTITA1.COGNOME",
        label: "",
        lineStyle: "dashed",
        manualOffset: 26,
      },
    ],
  };
}

function geometrySignature(node: DiagramNode): Pick<DiagramNode, "x" | "y" | "width" | "height"> {
  return {
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

function assertNodeGeometryPreserved(
  before: DiagramDocument,
  after: DiagramDocument,
  nodeIds: string[],
) {
  nodeIds.forEach((nodeId) => {
    const beforeNode = before.nodes.find((node) => node.id === nodeId);
    const afterNode = after.nodes.find((node) => node.id === nodeId);
    assert.ok(beforeNode, `missing before node ${nodeId}`);
    assert.ok(afterNode, `missing after node ${nodeId}`);
    assert.deepEqual(geometrySignature(afterNode), geometrySignature(beforeNode), nodeId);
  });
}

function replaceInErs(source: string, search: string, replacement: string): string {
  assert.ok(source.includes(search), `ERS source should contain ${search}`);
  return source.replace(search, replacement);
}

test("ERS code merge: parsing idempotente non muove nodi esistenti", () => {
  const existing = createCodeLayoutFixture();
  const parsed = parseErsDiagram(serializeDiagramToErs(existing), existing);

  assertNodeGeometryPreserved(existing, parsed, existing.nodes.map((node) => node.id));
  const attributeEdge = parsed.edges.find((edge) => edge.type === "attribute" && (
    edge.sourceId === "ENTITA1.COGNOME" || edge.targetId === "ENTITA1.COGNOME"
  ));
  assert.equal(attributeEdge?.lineStyle, "dashed");
  assert.equal(attributeEdge?.manualOffset, 26);
});

test("ERS code merge: cambiare cardinalita non muove nodi", () => {
  const existing = createCodeLayoutFixture();
  const source = replaceInErs(serializeDiagramToErs(existing), "ENTITA1: zero..many", "ENTITA1: one..many");
  const parsed = parseErsDiagram(source, existing);

  assertNodeGeometryPreserved(existing, parsed, existing.nodes.map((node) => node.id));
  const entity1 = parsed.nodes.find((node): node is Extract<DiagramNode, { type: "entity" }> => (
    node.id === "ENTITA1" && node.type === "entity"
  ));
  assert.equal(
    entity1?.relationshipParticipations?.find((participation) => participation.relationshipId === "RELAZIONE1")
      ?.cardinality,
    "(1,N)",
  );
});

test("ERS code merge: aggiungere attributo non muove elementi esistenti", () => {
  const existing = createCodeLayoutFixture();
  const source = replaceInErs(
    serializeDiagramToErs(existing),
    "    COGNOME",
    "    COGNOME,\n    ETA",
  );
  const parsed = parseErsDiagram(source, existing);

  assertNodeGeometryPreserved(existing, parsed, existing.nodes.map((node) => node.id));
  const newAttribute = findDirectAttribute(parsed, "ENTITA1", "ETA");
  assert.ok(newAttribute);
  assert.equal(Number.isFinite(newAttribute.x), true);
  assert.equal(Number.isFinite(newAttribute.y), true);
});

test("ERS code merge: aggiungere relazione non muove entita esistenti", () => {
  const existing = createCodeLayoutFixture();
  const source = `${serializeDiagramToErs(existing)}

relationship RELAZIONE2 (
    ENTITA1: zero..many,
    ENTITA2: one..one
)`;
  const parsed = parseErsDiagram(source, existing);

  assertNodeGeometryPreserved(existing, parsed, ["ENTITA1", "ENTITA2", "RELAZIONE1", "ENTITA1.NOME", "ENTITA1.COGNOME"]);
  const newRelationship = parsed.nodes.find((node) => node.type === "relationship" && node.label === "RELAZIONE2");
  assert.ok(newRelationship);
  assert.equal(Number.isFinite(newRelationship.x), true);
  assert.equal(Number.isFinite(newRelationship.y), true);
});

test("ERS code merge: eliminare attributo non riposiziona gli altri", () => {
  const existing = createCodeLayoutFixture();
  const source = replaceInErs(serializeDiagramToErs(existing), "    NOME\n", "");
  const parsed = parseErsDiagram(source, existing);

  assertNodeGeometryPreserved(existing, parsed, ["ENTITA1", "ENTITA2", "RELAZIONE1", "ENTITA1.COGNOME"]);
  assert.equal(parsed.nodes.some((node) => node.id === "ENTITA1.NOME"), false);
});

test("ERS code merge: memoria layout preserva un nodo che ricompare dopo stato intermedio", () => {
  const existing = createCodeLayoutFixture();
  const fullSource = serializeDiagramToErs(existing);
  const withoutAttributeSource = replaceInErs(fullSource, "    NOME\n", "");
  const intermediate = parseErsDiagram(withoutAttributeSource, existing);
  const reparsed = parseErsDiagram(fullSource, intermediate, existing);

  const restoredAttribute = reparsed.nodes.find((node) => node.id === "ENTITA1.NOME");
  const originalAttribute = existing.nodes.find((node) => node.id === "ENTITA1.NOME");
  assert.ok(restoredAttribute);
  assert.ok(originalAttribute);
  assert.deepEqual(geometrySignature(restoredAttribute), geometrySignature(originalAttribute));
  assertNodeGeometryPreserved(existing, reparsed, ["ENTITA1", "ENTITA2", "RELAZIONE1", "ENTITA1.COGNOME"]);
});

test("ERS code merge: rename sicuro di una sola entita conserva la geometria", () => {
  const existing = createCodeLayoutFixture();
  const source = serializeDiagramToErs(existing)
    .replace(/^entity ENTITA2$/m, "entity CLIENTE")
    .replace("    ENTITA2: one..many", "    CLIENTE: one..many");
  const parsed = parseErsDiagram(source, existing);

  assertNodeGeometryPreserved(existing, parsed, ["ENTITA1", "RELAZIONE1", "ENTITA1.NOME", "ENTITA1.COGNOME"]);
  const renamed = parsed.nodes.find((node) => node.type === "entity" && node.label === "CLIENTE");
  const previous = existing.nodes.find((node) => node.id === "ENTITA2");
  assert.ok(renamed);
  assert.ok(previous);
  assert.deepEqual(geometrySignature(renamed), geometrySignature(previous));
  const renamedConnector = parsed.edges.find((edge) => edge.type === "connector" && (
    edge.sourceId === renamed.id || edge.targetId === renamed.id
  ));
  assert.equal(renamedConnector?.lineStyle, "dashed");
  assert.equal(renamedConnector?.manualOffset, undefined);
});

test("un attributo figlio di un attributo composto non puo diventare composto", () => {
  const diagram: DiagramDocument = {
    meta: { name: "Attributo composto annidato", version: 3 },
    notes: "",
    nodes: [
      { id: "entity-viaggio", type: "entity", label: "VIAGGIO", x: 0, y: 0, width: 140, height: 64 },
      {
        id: "attr-cabine-seconda",
        type: "attribute",
        label: "cabineSecondaClasse",
        x: 180,
        y: 0,
        width: 180,
        height: 64,
        isMultivalued: true,
      },
      { id: "attr-cabina", type: "attribute", label: "ATTRIBUTO1", x: 400, y: 0, width: 120, height: 28 },
      { id: "attr-diretto", type: "attribute", label: "cabinePrimaClasse", x: 0, y: 120, width: 140, height: 28 },
    ],
    edges: [
      {
        id: "edge-entity-cabine",
        type: "attribute",
        sourceId: "attr-cabine-seconda",
        targetId: "entity-viaggio",
        label: "",
        lineStyle: "solid",
      },
      {
        id: "edge-cabine-cabina",
        type: "attribute",
        sourceId: "attr-cabina",
        targetId: "attr-cabine-seconda",
        label: "",
        lineStyle: "solid",
      },
      {
        id: "edge-entity-diretto",
        type: "attribute",
        sourceId: "attr-diretto",
        targetId: "entity-viaggio",
        label: "",
        lineStyle: "solid",
      },
    ],
  };
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const compositeRoot = nodeById.get("attr-cabine-seconda");
  const compositeChild = nodeById.get("attr-cabina");
  const directAttribute = nodeById.get("attr-diretto");

  assert.equal(compositeRoot?.type === "attribute" && canAttributeBecomeComposite(diagram, compositeRoot), true);
  assert.equal(compositeChild?.type === "attribute" && canAttributeBecomeComposite(diagram, compositeChild), false);
  assert.equal(directAttribute?.type === "attribute" && canAttributeBecomeComposite(diagram, directAttribute), true);

  assert.ok(compositeRoot?.type === "attribute");
  const secondChild: Extract<DiagramNode, { type: "attribute" }> = {
    id: "attr-cabina-2",
    type: "attribute",
    label: "ATTRIBUTO2",
    x: 420,
    y: 80,
    width: 120,
    height: 28,
  };
  const diagramWithSecondChild: DiagramDocument = {
    ...diagram,
    nodes: [...diagram.nodes, secondChild],
    edges: [...diagram.edges, createEdge("attribute", secondChild.id, compositeRoot.id, diagram)],
  };
  const compositeChildren = diagramWithSecondChild.edges.filter(
    (edge) =>
      edge.type === "attribute" &&
      (edge.sourceId === compositeRoot.id || edge.targetId === compositeRoot.id) &&
      (edge.sourceId === secondChild.id || edge.targetId === secondChild.id || edge.id === "edge-cabine-cabina"),
  );

  assert.equal(canAttributeBecomeComposite(diagramWithSecondChild, compositeRoot), true);
  assert.equal(compositeChildren.length, 2);
});

test("la serializzazione ERS usa il nome corrente della shape invece dell'id legacy", () => {
  const source = `diagram "Nuovo diagramma"

entity ENTITA2 {
}
entity ENTITA3 {
}
entity ENTITA1 "PROGETTO" {
  attribute ATTRIBUTO3 "Budget"
  attribute ATTRIBUTO2 "DataConsegna"
  identifier ATTRIBUTO1 "Nome"
}

relation RELAZIONE1 ENTITA2 "(X,Y)" ENTITA3 "(X,Y)"
relation RELAZIONE2 ENTITA1 "(X,Y)" ENTITA2 "(X,Y)"`;

  const serialized = serializeDiagramToErs(parseErsDiagram(source));

  assert.match(serialized, /^entity PROGETTO \{$/m);
  assert.match(serialized, /^    Budget,?$/m);
  assert.match(serialized, /^    DataConsegna,?$/m);
  assert.match(serialized, /^    identifier\(Nome\)$/m);
  assert.match(serialized, /^relationship RELAZIONE2 \($/m);
  assert.match(serialized, /^    PROGETTO: X\.\.Y$/m);
  assert.doesNotMatch(serialized, /\bENTITA1\b/);
  assert.doesNotMatch(serialized, /\bATTRIBUTO1\b/);
  assert.doesNotMatch(serialized, /\bATTRIBUTO2\b/);
  assert.doesNotMatch(serialized, /\bATTRIBUTO3\b/);
});

function createIsaTestDiagram(): DiagramDocument {
  const nodes: DiagramNode[] = ["PERSONA", "UOMO", "DONNA", "IMPIEGATO", "STUDENTE"].map((id, index) => ({
    id,
    type: "entity",
    label: id,
    x: index * 180,
    y: index === 0 ? 0 : 180,
    width: 150,
    height: 64,
    internalIdentifiers: [],
    externalIdentifiers: [],
    relationshipParticipations: [],
  }));
  const edges: DiagramEdge[] = [
    { id: "isa-uomo", type: "inheritance", sourceId: "UOMO", targetId: "PERSONA", label: "", lineStyle: "solid" },
    { id: "isa-donna", type: "inheritance", sourceId: "DONNA", targetId: "PERSONA", label: "", lineStyle: "solid" },
    { id: "isa-impiegato", type: "inheritance", sourceId: "IMPIEGATO", targetId: "PERSONA", label: "", lineStyle: "solid" },
    { id: "isa-studente", type: "inheritance", sourceId: "STUDENTE", targetId: "PERSONA", label: "", lineStyle: "solid" },
  ];
  return { meta: { name: "ISA", version: 1 }, notes: "", nodes, edges };
}

function createEntitaIsaCleanupDiagram(): DiagramDocument {
  const nodes: DiagramNode[] = ["ENTITA1", "ENTITA5", "ENTITA6"].map((id, index) => ({
    id,
    type: "entity",
    label: id,
    x: index * 180,
    y: index === 0 ? 0 : 180,
    width: 150,
    height: 64,
    internalIdentifiers: [],
    externalIdentifiers: [],
    relationshipParticipations: [],
  }));
  const groupId = "generalization-ENTITA1-t-o";
  const edges: DiagramEdge[] = [
    {
      id: "isa-entita5",
      type: "inheritance",
      sourceId: "ENTITA5",
      targetId: "ENTITA1",
      label: "",
      lineStyle: "solid",
      generalizationGroupId: groupId,
      isaCompleteness: "total",
      isaDisjointness: "overlap",
    },
    {
      id: "isa-entita6",
      type: "inheritance",
      sourceId: "ENTITA6",
      targetId: "ENTITA1",
      label: "",
      lineStyle: "solid",
      generalizationGroupId: groupId,
      isaCompleteness: "total",
      isaDisjointness: "overlap",
    },
  ];
  return {
    meta: { name: "ISA cleanup", version: 1 },
    notes: "",
    nodes,
    edges,
    generalizationGroups: [
      {
        id: groupId,
        supertypeId: "ENTITA1",
        subtypeIds: ["ENTITA5", "ENTITA6"],
        isaCompleteness: "total",
        isaDisjointness: "overlap",
      },
    ],
  };
}

function createHierarchyRemovalDiagram(subtypeIds: string[] = ["ARG_TEORICO", "ARG_PRATICO"]): DiagramDocument {
  const nodeIds = ["ARGOMENTO", "ARG_TEORICO", "ARG_PRATICO", "CATEGORIA"];
  const nodes: DiagramNode[] = nodeIds.map((id, index) => ({
    id,
    type: "entity",
    label: id,
    x: index * 180,
    y: id === "ARGOMENTO" ? 0 : 180,
    width: 150,
    height: 64,
    internalIdentifiers: [{ id: `id-${id}`, attributeIds: [] }],
    externalIdentifiers: [],
    relationshipParticipations: [],
  }));
  const groupId = "isa-argomento";
  const edges: DiagramEdge[] = subtypeIds.map((subtypeId) => ({
    id: `edge-${subtypeId}`,
    type: "inheritance",
    sourceId: subtypeId,
    targetId: "ARGOMENTO",
    label: "",
    lineStyle: "solid",
    generalizationGroupId: groupId,
    isaCompleteness: "total",
    isaDisjointness: "disjoint",
  }));

  return {
    meta: { name: "Remove ISA", version: 1 },
    notes: "",
    nodes,
    edges,
    generalizationGroups: [
      {
        id: groupId,
        supertypeId: "ARGOMENTO",
        subtypeIds,
        isaCompleteness: "total",
        isaDisjointness: "disjoint",
        label: "ISA Argomento",
        junctionOffsetX: 24,
        junctionOffsetY: -12,
      },
    ],
  };
}

function getNaryMaxOneCardinalityWarnings(source: string) {
  return validateDiagram(parseErsDiagram(source)).filter((issue) =>
    issue.id.startsWith("relationship-nary-max-one-cardinality-"),
  );
}

function createIsaMergeDiagram(): DiagramDocument {
  const nodeIds = ["ENTITA1", "ENTITA2", "ENTITA3", "ENTITA7", "ENTITA5"];
  const nodes: DiagramNode[] = nodeIds.map((id, index) => ({
    id,
    type: "entity",
    label: id,
    x: index * 180,
    y: id === "ENTITA1" ? 0 : 200,
    width: 150,
    height: 64,
    internalIdentifiers: [],
    externalIdentifiers: [],
    relationshipParticipations: [],
  }));
  const group1Id = "g1";
  const group2Id = "g2";
  const edges: DiagramEdge[] = [
    { id: "isa-entita2", type: "inheritance", sourceId: "ENTITA2", targetId: "ENTITA1", label: "", lineStyle: "solid", generalizationGroupId: group1Id, isaCompleteness: "partial", isaDisjointness: "overlap" },
    { id: "isa-entita3", type: "inheritance", sourceId: "ENTITA3", targetId: "ENTITA1", label: "", lineStyle: "solid", generalizationGroupId: group1Id, isaCompleteness: "partial", isaDisjointness: "overlap" },
    { id: "isa-entita7", type: "inheritance", sourceId: "ENTITA7", targetId: "ENTITA1", label: "", lineStyle: "solid", generalizationGroupId: group1Id, isaCompleteness: "partial", isaDisjointness: "overlap" },
    { id: "isa-entita5", type: "inheritance", sourceId: "ENTITA5", targetId: "ENTITA1", label: "", lineStyle: "solid", generalizationGroupId: group2Id, isaCompleteness: "partial", isaDisjointness: "disjoint" },
  ];

  return {
    meta: { name: "ISA merge", version: 1 },
    notes: "",
    nodes,
    edges,
    generalizationGroups: [
      { id: group1Id, supertypeId: "ENTITA1", subtypeIds: ["ENTITA2", "ENTITA3", "ENTITA7"], isaCompleteness: "partial", isaDisjointness: "overlap" },
      { id: group2Id, supertypeId: "ENTITA1", subtypeIds: ["ENTITA5"], isaCompleteness: "partial", isaDisjointness: "disjoint" },
    ],
  };
}

function createTwoIsaGroupsSameConstraintsDiagram(): DiagramDocument {
  const nodes: DiagramNode[] = [
    { id: "PERSONA", type: "entity", label: "PERSONA", x: 450, y: 40, width: 180, height: 70, internalIdentifiers: [], externalIdentifiers: [], relationshipParticipations: [] },
    { id: "UOMO", type: "entity", label: "UOMO", x: 300, y: 360, width: 150, height: 64, internalIdentifiers: [], externalIdentifiers: [], relationshipParticipations: [] },
    { id: "DONNA", type: "entity", label: "DONNA", x: 480, y: 360, width: 150, height: 64, internalIdentifiers: [], externalIdentifiers: [], relationshipParticipations: [] },
    { id: "STUDENTE", type: "entity", label: "STUDENTE", x: 660, y: 360, width: 150, height: 64, internalIdentifiers: [], externalIdentifiers: [], relationshipParticipations: [] },
    { id: "PROFESSORE", type: "entity", label: "PROFESSORE", x: 840, y: 360, width: 170, height: 64, internalIdentifiers: [], externalIdentifiers: [], relationshipParticipations: [] },
  ];
  return {
    meta: { name: "ISA same constraints", version: 1 },
    notes: "",
    nodes,
    edges: [
      { id: "isa-uomo", type: "inheritance", sourceId: "UOMO", targetId: "PERSONA", label: "", lineStyle: "solid", generalizationGroupId: "GENERE", isaCompleteness: "total", isaDisjointness: "disjoint" },
      { id: "isa-donna", type: "inheritance", sourceId: "DONNA", targetId: "PERSONA", label: "", lineStyle: "solid", generalizationGroupId: "GENERE", isaCompleteness: "total", isaDisjointness: "disjoint" },
      { id: "isa-studente", type: "inheritance", sourceId: "STUDENTE", targetId: "PERSONA", label: "", lineStyle: "solid", generalizationGroupId: "LAVORO", isaCompleteness: "total", isaDisjointness: "disjoint" },
      { id: "isa-professore", type: "inheritance", sourceId: "PROFESSORE", targetId: "PERSONA", label: "", lineStyle: "solid", generalizationGroupId: "LAVORO", isaCompleteness: "total", isaDisjointness: "disjoint" },
    ],
    generalizationGroups: [
      { id: "GENERE", label: "GENERE", supertypeId: "PERSONA", subtypeIds: ["UOMO", "DONNA"], isaCompleteness: "total", isaDisjointness: "disjoint" },
      { id: "LAVORO", label: "LAVORO", supertypeId: "PERSONA", subtypeIds: ["STUDENTE", "PROFESSORE"], isaCompleteness: "total", isaDisjointness: "disjoint" },
    ],
  };
}

function generalizationBlock(source: string, groupId: string): string {
  const match = source.match(new RegExp(`generalization ${groupId}[^]*?\\n\\}`));
  return match?.[0] ?? "";
}

test("gli edge ISA nascono senza vincolo e vengono assegnati a gruppi espliciti", () => {
  let diagram = createIsaTestDiagram();
  let issues = validateDiagram(diagram);
  assert.equal(issues.filter((issue) => issue.id.startsWith("inheritance-missing-group")).length, 4);

  diagram = createGeneralizationGroupForInheritanceEdge(diagram, "isa-uomo", "Genere", "total", "disjoint");
  let groups = diagram.generalizationGroups ?? [];
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].subtypeIds, ["UOMO"]);
  assert.equal(groups[0].label, "Genere");
  assert.equal(diagram.edges.find((edge) => edge.id === "isa-donna" && edge.type === "inheritance")?.generalizationGroupId, undefined);

  diagram = assignInheritanceEdgeToGeneralizationGroup(diagram, "isa-donna", groups[0].id);
  groups = diagram.generalizationGroups ?? [];
  assert.equal(groups.length, 1);
  assert.deepEqual([...groups[0].subtypeIds].sort(), ["DONNA", "UOMO"]);
  assert.equal(diagram.edges.find((edge) => edge.id === "isa-donna" && edge.type === "inheritance")?.isaCompleteness, "total");

  diagram = createGeneralizationGroupForInheritanceEdge(diagram, "isa-impiegato", "Ruolo", "partial", "overlap");
  const roleGroup = diagram.generalizationGroups?.find((group) => group.label === "Ruolo");
  assert.ok(roleGroup);
  diagram = assignInheritanceEdgeToGeneralizationGroup(diagram, "isa-studente", roleGroup.id);
  groups = diagram.generalizationGroups ?? [];
  assert.equal(groups.length, 2);
  assert.equal(groups.some((group) => group.supertypeId === "PERSONA" && group.isaCompleteness === "partial" && group.isaDisjointness === "overlap"), true);

  const sexGroup = groups.find((group) => group.isaCompleteness === "total" && group.isaDisjointness === "disjoint");
  assert.ok(sexGroup);
  diagram = updateGeneralizationGroupConstraint(diagram, sexGroup.id, "partial", "disjoint");
  const updatedSexGroup = diagram.generalizationGroups?.find((group) => group.id === sexGroup.id);
  assert.equal(updatedSexGroup?.isaCompleteness, "partial");
  assert.equal(
    diagram.edges
      .filter((edge) => edge.type === "inheritance" && edge.generalizationGroupId === sexGroup.id)
      .every((edge) => edge.isaCompleteness === "partial" && edge.isaDisjointness === "disjoint"),
    true,
  );

  diagram = removeSubtypeFromGeneralizationGroup(diagram, sexGroup.id, "DONNA");
  const donnaEdge = diagram.edges.find((edge) => edge.id === "isa-donna" && edge.type === "inheritance");
  assert.equal(donnaEdge?.generalizationGroupId, undefined);
  assert.equal(donnaEdge?.isaCompleteness, undefined);
  assert.equal(diagram.generalizationGroups?.find((group) => group.id === sexGroup.id)?.subtypeIds.includes("UOMO"), true);
  assert.equal(validateDiagram(diagram).some((issue) => issue.id === "inheritance-missing-group-isa-donna"), true);
});

test("ERS conserva gruppi ISA distinti e non serializza etichette legacy", () => {
  let diagram = createIsaTestDiagram();
  diagram = createGeneralizationGroupForInheritanceEdge(diagram, "isa-uomo", "Genere", "total", "disjoint");
  const sexGroup = diagram.generalizationGroups?.find((group) => group.label === "Genere");
  assert.ok(sexGroup);
  diagram = assignInheritanceEdgeToGeneralizationGroup(diagram, "isa-donna", sexGroup.id);
  diagram = createGeneralizationGroupForInheritanceEdge(diagram, "isa-impiegato", "Ruolo", "partial", "overlap");
  const roleGroup = diagram.generalizationGroups?.find((group) => group.label === "Ruolo");
  assert.ok(roleGroup);
  diagram = assignInheritanceEdgeToGeneralizationGroup(diagram, "isa-studente", roleGroup.id);

  const serialized = serializeDiagramToErs(diagram);
  assert.match(serialized, /generalization Genere \(t, e\) PERSONA \{/);
  assert.match(serialized, /generalization Ruolo \(p, o\) PERSONA \{/);
  assert.doesNotMatch(serialized, /\b(?:D\/T|D\/P|O\/T|O\/P|T\/D|P\/D)\b/);

  const reparsed = parseErsDiagram(serialized);
  const groups = normalizeGeneralizationGroups(reparsed).generalizationGroups?.filter((group) => group.supertypeId === "PERSONA") ?? [];
  assert.equal(groups.length, 2);
  assert.equal(groups.some((group) => group.label === "Genere" && group.isaCompleteness === "total" && group.isaDisjointness === "disjoint"), true);
  assert.equal(groups.some((group) => group.label === "Ruolo" && group.isaCompleteness === "partial" && group.isaDisjointness === "overlap"), true);
});

test("rimozione sottotipo dal gruppo aggiorna subito il blocco generalization", () => {
  let diagram = createEntitaIsaCleanupDiagram();
  diagram = removeSubtypeFromGeneralizationGroup(diagram, "generalization-ENTITA1-t-o", "ENTITA6");

  const group = diagram.generalizationGroups?.find((candidate) => candidate.id === "generalization-ENTITA1-t-o");
  assert.deepEqual(group?.subtypeIds, ["ENTITA5"]);
  const entita6Edge = diagram.edges.find((edge) => edge.id === "isa-entita6" && edge.type === "inheritance");
  assert.equal(entita6Edge?.generalizationGroupId, undefined);

  const block = generalizationBlock(serializeDiagramToErs(diagram), "generalization-ENTITA1-t-o");
  assert.match(block, /\bENTITA5\b/);
  assert.doesNotMatch(block, /\bENTITA6\b/);
});

test("cancellazione edge o nodo ISA rimuove riferimenti zombie dai gruppi", () => {
  let diagram = createEntitaIsaCleanupDiagram();
  diagram = removeSelection(diagram, { nodeIds: [], edgeIds: ["isa-entita6"] });

  assert.equal(diagram.edges.some((edge) => edge.id === "isa-entita6"), false);
  assert.deepEqual(diagram.generalizationGroups?.[0]?.subtypeIds, ["ENTITA5"]);
  assert.doesNotMatch(generalizationBlock(serializeDiagramToErs(diagram), "generalization-ENTITA1-t-o"), /\bENTITA6\b/);

  diagram = createEntitaIsaCleanupDiagram();
  diagram = removeSelection(diagram, { nodeIds: ["ENTITA6"], edgeIds: [] });

  assert.equal(diagram.nodes.some((node) => node.id === "ENTITA6"), false);
  assert.equal(diagram.edges.some((edge) => edge.sourceId === "ENTITA6" || edge.targetId === "ENTITA6"), false);
  assert.equal(diagram.generalizationGroups?.some((group) => group.subtypeIds.includes("ENTITA6")), false);
  assert.doesNotMatch(generalizationBlock(serializeDiagramToErs(diagram), "generalization-ENTITA1-t-o"), /\bENTITA6\b/);
});

test("rimozione entity da gerarchia stacca un sottotipo e conserva il gruppo con gli altri sottotipi", () => {
  const diagram = createHierarchyRemovalDiagram();
  const updated = removeEntityFromGeneralizationHierarchy(diagram, "ARG_TEORICO");
  const group = updated.generalizationGroups?.find((candidate) => candidate.id === "isa-argomento");

  assert.ok(group);
  assert.deepEqual(group.subtypeIds, ["ARG_PRATICO"]);
  assert.equal(updated.edges.some((edge) => edge.id === "edge-ARG_TEORICO"), false);
  assert.equal(
    updated.edges.some(
      (edge) =>
        edge.type === "inheritance" &&
        edge.id === "edge-ARG_PRATICO" &&
        edge.sourceId === "ARG_PRATICO" &&
        edge.targetId === "ARGOMENTO" &&
        edge.generalizationGroupId === "isa-argomento",
    ),
    true,
  );
  assert.deepEqual(updated.nodes.map((node) => node.id), diagram.nodes.map((node) => node.id));
});

test("rimozione entity da gerarchia elimina il gruppo quando il sottotipo era unico", () => {
  const diagram = createHierarchyRemovalDiagram(["ARG_TEORICO"]);
  const updated = removeEntityFromGeneralizationHierarchy(diagram, "ARG_TEORICO");

  assert.equal(updated.generalizationGroups, undefined);
  assert.equal(updated.edges.some((edge) => edge.type === "inheritance" && edge.generalizationGroupId === "isa-argomento"), false);
  assert.deepEqual(updated.nodes.map((node) => node.id), diagram.nodes.map((node) => node.id));
});

test("rimozione supertype da gerarchia elimina l'intero gruppo ISA senza cancellare nodi", () => {
  const diagram = createHierarchyRemovalDiagram();
  const updated = removeEntityFromGeneralizationHierarchy(diagram, "ARGOMENTO");

  assert.equal(updated.generalizationGroups, undefined);
  assert.equal(updated.edges.some((edge) => edge.type === "inheritance" && edge.generalizationGroupId === "isa-argomento"), false);
  assert.deepEqual(updated.nodes.map((node) => node.id), diagram.nodes.map((node) => node.id));
});

test("rimozione entity non in gerarchia lascia il diagramma invariato", () => {
  const diagram = createHierarchyRemovalDiagram();
  const updated = removeEntityFromGeneralizationHierarchy(diagram, "CATEGORIA");

  assert.equal(updated, diagram);
});

test("rimozione subtype preserva i vincoli del gruppo ISA rimasto", () => {
  const diagram = createHierarchyRemovalDiagram();
  const updated = removeEntityFromGeneralizationHierarchy(diagram, "ARG_TEORICO");
  const group = updated.generalizationGroups?.find((candidate) => candidate.id === "isa-argomento");

  assert.ok(group);
  assert.equal(group.isaCompleteness, "total");
  assert.equal(group.isaDisjointness, "disjoint");
  assert.equal(group.label, "ISA Argomento");
  assert.equal(group.junctionOffsetX, 24);
  assert.equal(group.junctionOffsetY, -12);
});

test("cambio vincolo ISA conserva gruppi distinti anche se compatibili", () => {
  let diagram = createIsaMergeDiagram();
  diagram = updateGeneralizationGroupConstraint(diagram, "g2", "partial", "overlap");

  const groups = diagram.generalizationGroups?.filter(
    (group) => group.supertypeId === "ENTITA1" && group.isaCompleteness === "partial" && group.isaDisjointness === "overlap",
  ) ?? [];
  assert.equal(groups.length, 2);
  assert.equal(diagram.generalizationGroups?.some((group) => group.id === "g2"), true);
  const entita5Edge = diagram.edges.find((edge) => edge.id === "isa-entita5" && edge.type === "inheritance");
  assert.equal(entita5Edge?.generalizationGroupId, "g2");
});

test("serializzazione ERS preserva gruppi ISA compatibili distinti", () => {
  let diagram = createIsaMergeDiagram();
  diagram = updateGeneralizationGroupConstraint(diagram, "g2", "partial", "overlap");
  const serialized = serializeDiagramToErs(diagram);
  const blocks = serialized.match(/generalization .* \(p, o\) ENTITA1 \{/g) ?? [];
  assert.equal(blocks.length, 2);
  assert.match(serialized, /\bENTITA5\b/);
});

test("parser ERS preserva generalization con stesso vincolo", () => {
  const diagram = parseErsDiagram(`entity ENTITA1 {}
entity ENTITA2 {}
entity ENTITA5 {}

generalization g1 (p, o) ENTITA1 {
  ENTITA2
}
generalization g2 (p, o) ENTITA1 {
  ENTITA5
}`);
  const groups = diagram.generalizationGroups?.filter(
    (group) => group.supertypeId === "ENTITA1" && group.isaCompleteness === "partial" && group.isaDisjointness === "overlap",
  ) ?? [];
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.map((group) => group.id).sort(), ["g1", "g2"]);
  assert.deepEqual(groups.map((group) => group.subtypeIds[0]).sort(), ["ENTITA2", "ENTITA5"]);
});

test("layout ISA mantiene due flussi separati per stesso supertipo e stessi vincoli", () => {
  const diagram = normalizeGeneralizationGroups(createTwoIsaGroupsSameConstraintsDiagram());
  const visualGroups = buildInheritanceGroups(diagram);
  const groupsForPersona = visualGroups.filter(
    (group) =>
      group.supertypeId === "PERSONA" &&
      group.isaCompleteness === "total" &&
      group.isaDisjointness === "disjoint",
  );
  assert.equal(groupsForPersona.length, 2);
  assert.deepEqual(groupsForPersona.map((group) => group.subtypeIds.join(",")).sort(), ["STUDENTE,PROFESSORE", "UOMO,DONNA"]);

  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const layouts = groupsForPersona.map((group) => getInheritanceGroupLayout(group, nodeMap, visualGroups));
  assert.equal(layouts.every(Boolean), true);
  const [firstLayout, secondLayout] = layouts;
  assert.ok(firstLayout);
  assert.ok(secondLayout);
  assert.notDeepEqual(firstLayout.triangleCenter, secondLayout.triangleCenter);
  assert.notDeepEqual(
    firstLayout.lineSegments.find((segment) => segment.id === "bus"),
    secondLayout.lineSegments.find((segment) => segment.id === "bus"),
  );
  assert.notDeepEqual(firstLayout.labelPoint, secondLayout.labelPoint);
});

test("validateDiagram segnala sottotipi senza attributi e supertipi ISA senza relazioni", () => {
  const diagram = normalizeGeneralizationGroups(createIsaMergeDiagram());
  const issues = validateDiagram(diagram);

  assert.equal(
    issues.some((issue) => issue.id === "subtype-no-attributes-ENTITA2" && issue.level === "warning"),
    true,
  );
  assert.equal(
    issues.some((issue) => issue.id === "supertype-no-relationship-ENTITA1" && issue.level === "warning"),
    true,
  );
});

test("validateDiagram avvisa su relazione ternaria con cardinalita massima 1", () => {
  const warnings = getNaryMaxOneCardinalityWarnings(`entity A
entity B
entity C
relation R A "(1,1)" B "(1,N)" C "(0,N)"`);

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].level, "warning");
  assert.match(warnings[0].message, /grado 3/);
  assert.match(warnings[0].message, /A \(1,1\)/);
  assert.match(warnings[0].message, /combinazione delle altre entita/);
});

test("validateDiagram avvisa su relazione ternaria con cardinalita 0,1", () => {
  const warnings = getNaryMaxOneCardinalityWarnings(`entity A
entity B
entity C
relation R A "(0,1)" B "(1,N)" C "(0,N)"`);

  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /A \(0,1\)/);
});

test("validateDiagram non avvisa su relazione ternaria senza cardinalita massima 1", () => {
  const warnings = getNaryMaxOneCardinalityWarnings(`entity A
entity B
entity C
relation R A "(0,N)" B "(1,N)" C "(0,N)"`);

  assert.equal(warnings.length, 0);
});

test("validateDiagram non avvisa su relazione binaria con cardinalita massima 1", () => {
  const warnings = getNaryMaxOneCardinalityWarnings(`entity A
entity B
relation R A "(1,1)" B "(0,N)"`);

  assert.equal(warnings.length, 0);
});

test("validateDiagram avvisa su relazione n-aria di grado 4 con cardinalita 0,1", () => {
  const warnings = getNaryMaxOneCardinalityWarnings(`entity A
entity B
entity C
entity D
relation R A "(0,N)" B "(1,N)" C "(0,1)" D "(1,N)"`);

  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /grado 4/);
  assert.match(warnings[0].message, /C \(0,1\)/);
});

test("validateDiagram aggrega piu lati n-ari con cardinalita massima 1", () => {
  const warnings = getNaryMaxOneCardinalityWarnings(`entity A
entity B
entity C
relation R A "(1,1)" B "(0,1)" C "(1,N)"`);

  assert.equal(warnings.length, 1);
  assert.match(warnings[0].message, /A \(1,1\)/);
  assert.match(warnings[0].message, /B \(0,1\)/);
  assert.equal(warnings[0].level, "warning");
});

test("cleanup ISA evita duplicati dentro lo stesso gruppo senza fondere gruppi distinti", () => {
  const diagram = mergeCompatibleGeneralizationGroups({
    ...createIsaMergeDiagram(),
    generalizationGroups: [
      { id: "g1", supertypeId: "ENTITA1", subtypeIds: ["ENTITA2", "ENTITA2"], isaCompleteness: "partial", isaDisjointness: "overlap" },
      { id: "g3", supertypeId: "ENTITA1", subtypeIds: ["ENTITA2"], isaCompleteness: "partial", isaDisjointness: "overlap" },
    ],
  });
  const groups = diagram.generalizationGroups ?? [];
  assert.equal(groups.length, 2);
  assert.deepEqual(groups.find((group) => group.id === "g1")?.subtypeIds, ["ENTITA2"]);
  assert.deepEqual(groups.find((group) => group.id === "g3")?.subtypeIds, ["ENTITA2"]);
});

test("layout ISA classico genera triangolo, trunk e bus", () => {
  const diagram: DiagramDocument = {
    meta: { name: "layout ISA", version: 1 },
    notes: "",
    nodes: [
      { id: "ENTITA1", type: "entity", label: "ENTITA1", x: 200, y: 40, width: 150, height: 64, internalIdentifiers: [], externalIdentifiers: [], relationshipParticipations: [] },
      { id: "ENTITA2", type: "entity", label: "ENTITA2", x: 80, y: 240, width: 150, height: 64, internalIdentifiers: [], externalIdentifiers: [], relationshipParticipations: [] },
      { id: "ENTITA3", type: "entity", label: "ENTITA3", x: 320, y: 240, width: 150, height: 64, internalIdentifiers: [], externalIdentifiers: [], relationshipParticipations: [] },
    ],
    edges: [
      { id: "isa-entita2", type: "inheritance", sourceId: "ENTITA2", targetId: "ENTITA1", label: "", lineStyle: "solid", generalizationGroupId: "g1", isaCompleteness: "partial", isaDisjointness: "overlap" },
      { id: "isa-entita3", type: "inheritance", sourceId: "ENTITA3", targetId: "ENTITA1", label: "", lineStyle: "solid", generalizationGroupId: "g1", isaCompleteness: "partial", isaDisjointness: "overlap" },
    ],
    generalizationGroups: [
      { id: "g1", supertypeId: "ENTITA1", subtypeIds: ["ENTITA2", "ENTITA3"], isaCompleteness: "partial", isaDisjointness: "overlap" },
    ],
  };

  const layout = computeClassicIsaGroupLayout(diagram, diagram.generalizationGroups?.[0] as NonNullable<DiagramDocument["generalizationGroups"]>[number]);
  assert.ok(layout);
  assert.equal(layout?.subtypeBranches.length, 2);
  assert.equal(layout?.busStart.y, layout?.busEnd.y);
  assert.equal(layout?.busY, layout?.busStart.y);
  assert.equal(layout?.trunkTop.x, layout?.trunkBottom.x);
  assert.ok(layout ? layout.triangleCenter.y > diagram.nodes[0].y + diagram.nodes[0].height / 2 : false);
  assert.ok(layout ? layout.labelPoint.y > layout.trunkTop.y && layout.labelPoint.y < layout.trunkBottom.y : false);
});

test("layout visuale ISA compatta piu sottotipi in una sola bus", () => {
  const diagram = normalizeGeneralizationGroups(createIsaMergeDiagram());
  const groups = buildInheritanceGroups(diagram);
  const group = groups.find(
    (candidate) => candidate.supertypeId === "ENTITA1" && candidate.isaDisjointness === "overlap",
  );
  assert.ok(group);

  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const layout = getInheritanceGroupLayout(group, nodeMap, groups);
  assert.ok(layout);
  assert.equal(layout.kind, "multi");
  assert.equal(layout.lineSegments.filter((segment) => segment.id === "bus").length, 1);
  assert.equal(layout.lineSegments.filter((segment) => segment.id.startsWith("subtype-")).length, 3);

  const bus = layout.lineSegments.find((segment) => segment.id === "bus");
  assert.ok(bus);
  if (layout.parentSide === "left" || layout.parentSide === "right") {
    assert.equal(bus.from.x, bus.to.x);
    assert.ok(Math.abs(bus.to.y - bus.from.y) < 520);
  } else {
    assert.equal(bus.from.y, bus.to.y);
    assert.ok(Math.abs(bus.to.x - bus.from.x) < 520);
  }
});

test("layout visuale ISA con un solo sottotipo non disegna la bus di gruppo", () => {
  const diagram = normalizeGeneralizationGroups(createIsaMergeDiagram());
  const groups = buildInheritanceGroups(diagram);
  const group = groups.find(
    (candidate) => candidate.supertypeId === "ENTITA1" && candidate.isaDisjointness === "disjoint",
  );
  assert.ok(group);

  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const layout = getInheritanceGroupLayout(group, nodeMap, groups);
  assert.ok(layout);
  assert.equal(layout.kind, "single");
  assert.equal(layout.lineSegments.some((segment) => segment.id === "bus"), false);
  assert.equal(layout.lineSegments.filter((segment) => segment.id.startsWith("subtype-")).length, 1);
  const visibleRouteSegments = layout.lineSegments.filter(
    (segment) => segment.from.x !== segment.to.x || segment.from.y !== segment.to.y,
  );
  assert.equal(
    visibleRouteSegments.every(
      (segment) => Math.abs(segment.from.x - segment.to.x) < 0.001 || Math.abs(segment.from.y - segment.to.y) < 0.001,
    ),
    true,
  );
});
test("un nuovo nodo con lo stesso nome non viene ricollegato alla vecchia gerarchia", () => {
  let diagram = removeSelection(createEntitaIsaCleanupDiagram(), { nodeIds: ["ENTITA6"], edgeIds: [] });
  diagram = cleanupGeneralizationReferences({
    ...diagram,
    nodes: [
      ...diagram.nodes,
      {
        id: "ENTITA6-NUOVA",
        type: "entity",
        label: "ENTITA6",
        x: 420,
        y: 180,
        width: 150,
        height: 64,
        internalIdentifiers: [],
        externalIdentifiers: [],
        relationshipParticipations: [],
      },
    ],
  });

  assert.equal(diagram.generalizationGroups?.[0]?.subtypeIds.includes("ENTITA6-NUOVA"), false);
  assert.equal(
    diagram.edges.some((edge) => edge.type === "inheritance" && edge.sourceId === "ENTITA6-NUOVA" && edge.generalizationGroupId),
    false,
  );
  const block = generalizationBlock(serializeDiagramToErs(diagram), "generalization-ENTITA1-t-o");
  assert.match(block, /\bENTITA5\b/);
  assert.doesNotMatch(block, /\bENTITA6\b/);
});

test("la rinomina nome-identita aggiorna davvero l'id del nodo", () => {
  const diagram: DiagramDocument = {
    meta: {
      name: "Rinomina",
      version: 3,
    },
    notes: "",
    nodes: [
      {
        id: "ENTITA1",
        type: "entity",
        label: "ENTITA1",
        x: 0,
        y: 0,
        width: 140,
        height: 64,
        isWeak: false,
        internalIdentifiers: [
          {
            id: "pk-entita1",
            attributeIds: ["ATTRIBUTO1"],
          },
        ],
        externalIdentifiers: [],
        relationshipParticipations: [],
      },
      {
        id: "ATTRIBUTO1",
        type: "attribute",
        label: "ATTRIBUTO1",
        x: 200,
        y: 0,
        width: 150,
        height: 28,
        isIdentifier: true,
        isCompositeInternal: false,
        isMultivalued: false,
      },
    ],
    edges: [
      {
        id: "attributeLink1",
        type: "attribute",
        sourceId: "ENTITA1",
        targetId: "ATTRIBUTO1",
        label: "",
        lineStyle: "solid",
      },
    ],
  };

  const renamed = renameNodeAsNameIdentity(diagram, "ENTITA1", "PROGETTO");
  const renamedEntity = renamed.diagram.nodes.find((node) => node.type === "entity");
  const renamedEdge = renamed.diagram.edges[0];

  assert.equal(renamed.nodeIdMap.get("ENTITA1"), "PROGETTO");
  assert.equal(renamedEntity?.id, "PROGETTO");
  assert.equal(renamedEntity?.label, "PROGETTO");
  assert.equal(renamedEdge.sourceId, "PROGETTO");
});

test("le cardinalita custom vengono normalizzate e validate", () => {
  assert.deepEqual(normalizeCardinalityInput("1...4"), { valid: true, value: "(1,4)" });
  assert.deepEqual(normalizeCardinalityInput("2...N"), { valid: true, value: "(2,N)" });
  assert.equal(normalizeCardinalityInput("5...2").valid, false);
  assert.equal(normalizeCardinalityInput("abc").valid, false);
});

test("ERS serializza e rilegge cardinalita custom su connector e attributi", () => {
  const source = `diagram "Card custom"

entity A {
  attribute codice card "1...4"
}
entity B {
  identifier idB
}
relation R A "2...N" B "(1,1)"`;

  const parsed = parseErsDiagram(source);
  const attribute = parsed.nodes.find((node) => node.type === "attribute" && node.label === "codice");
  const entityA = parsed.nodes.find((node) => node.type === "entity" && node.label === "A");
  const relation = parsed.nodes.find((node) => node.type === "relationship" && node.label === "R");

  assert.equal(attribute?.type === "attribute" ? attribute.cardinality : undefined, "(1,4)");
  assert.equal(
    entityA?.type === "entity"
      ? entityA.relationshipParticipations?.find((participation) => participation.relationshipId === relation?.id)?.cardinality
      : undefined,
    "(2,N)",
  );

  const serialized = serializeDiagramToErs(parsed);
  assert.match(serialized, /codice \(one\.\.4\)/);
  assert.match(serialized, /A: 2\.\.many/);
});

test("ERS supporta sintassi designER e identificatori interni composti", () => {
  const source = `/* Entities */
entity TRENO {
    NumTreno (id),
    Attribute39 {
        Attribute40,
        Attribute41
    }
}
entity PERSONA {
    Nome,
    Cognome,
    identifier (Nome, Cognome)
}
entity TRATTA
entity REGIONALE
entity ALTA_VELOCITA

/* Relationships */
relationship RELATIONSHIP18 (
    TRENO: zero..many,
    TRATTA: one..one
)

/* Generalizations */
TRENO <= {
    REGIONALE,
    ALTA_VELOCITA
} (partial, exclusive)`;

  const parsed = parseErsDiagram(source);
  const persona = parsed.nodes.find((node) => node.type === "entity" && node.label === "PERSONA");
  assert.equal(persona?.type, "entity");
  assert.equal(persona?.type === "entity" ? persona.internalIdentifiers?.length : 0, 1);
  assert.equal(
    persona?.type === "entity"
      ? persona.internalIdentifiers?.some((identifier) => identifier.attributeIds.length === 2)
      : false,
    true,
  );

  const serialized = serializeDiagramToErs(parsed);
  assert.match(serialized, /^\/\* Entities \*\//m);
  assert.match(serialized, /^relationship RELATIONSHIP18 \($/m);
  assert.match(serialized, /generalization TRENO_generalization_\d+ \(p, e\) TRENO \{/);
  assert.match(serialized, /identifier\(Nome, Cognome\)/);
});

test("ERS designER ricostruisce identificatori esterni da partecipazioni external valide", () => {
  const source = `/* Entities */
entity A {
    idA (id)
}
entity B

/* Relationships */
relationship R (
    A: zero..many,
    B: one..one external
)`;

  const parsed = parseErsDiagram(source);
  const entityB = parsed.nodes.find((node) => node.type === "entity" && node.label === "B");
  assert.equal(entityB?.type === "entity" ? entityB.externalIdentifiers?.length : 0, 1);

  const serialized = serializeDiagramToErs(parsed);
  assert.match(serialized, /^    identifier\(R\)$/m);
  assert.doesNotMatch(serialized, /^    B: one\.\.one external$/m);
});

test("ERS serializza identificatori semplici nel formato identifier", () => {
  const diagram = parseErsDiagram(`entity BIGLIETTO {
    codBiglietto (id)
}`);

  const serialized = serializeDiagramToErs(diagram);
  assert.match(serialized, /identifier\(codBiglietto\)/);
  assert.doesNotMatch(serialized, /codBiglietto \(id\)/);
});

test("ERS parse nuovo identificatore semplice e crea l'attributo diretto", () => {
  const diagram = parseErsDiagram(`entity BIGLIETTO {
    identifier(codBiglietto)
}`);

  const entity = findEntity(diagram, "BIGLIETTO");
  const attribute = findDirectAttribute(diagram, "BIGLIETTO", "codBiglietto");

  assert.ok(entity);
  assert.ok(attribute);
  assert.equal(
    entity.internalIdentifiers?.some((identifier) => identifier.attributeIds.includes(attribute.id)),
    true,
  );
});

test("ERS parse e serializza identificatore interno composto canonico", () => {
  const diagram = parseErsDiagram(`entity VIAGGIO {
    chilometraggio,
    identifier(codViaggio, dataOraArrivo),
    dataOraPartenza
}`);

  const codViaggio = findDirectAttribute(diagram, "VIAGGIO", "codViaggio");
  const dataOraArrivo = findDirectAttribute(diagram, "VIAGGIO", "dataOraArrivo");
  ["chilometraggio", "codViaggio", "dataOraArrivo", "dataOraPartenza"].forEach((label) => {
    assert.ok(findDirectAttribute(diagram, "VIAGGIO", label));
  });

  const entity = findEntity(diagram, "VIAGGIO");
  assert.equal(
    entity?.internalIdentifiers?.some(
      (identifier) =>
        codViaggio &&
        dataOraArrivo &&
        identifier.attributeIds.includes(codViaggio.id) &&
        identifier.attributeIds.includes(dataOraArrivo.id),
    ),
    true,
  );

  const serialized = serializeDiagramToErs(diagram);
  assert.match(serialized, /identifier\(codViaggio, dataOraArrivo\)/);
  assert.doesNotMatch(serialized, /codViaggio \(id\)/);
  assert.doesNotMatch(serialized, /dataOraArrivo \(id\)/);
});

test("ERS parse e serializza identificatore misto nel nuovo formato", () => {
  const diagram = parseErsDiagram(`entity ENTITA1 {
    identifier(ATTRIBUTO1, RELAZIONE1),
    ATTRIBUTO2
}
entity ENTITA2 {
    identifier(ATTRIBUTO3)
}

relationship RELAZIONE1 (
    ENTITA1: one..one,
    ENTITA2: one..many
)`);

  const entity1 = findEntity(diagram, "ENTITA1");
  const entity2 = findEntity(diagram, "ENTITA2");
  const localAttribute = findDirectAttribute(diagram, "ENTITA1", "ATTRIBUTO1");
  const relationship = diagram.nodes.find((node) => node.type === "relationship" && node.label === "RELAZIONE1");

  assert.ok(entity1);
  assert.ok(entity2);
  assert.ok(localAttribute);
  assert.equal(entity1.externalIdentifiers && entity1.externalIdentifiers.length > 0, true);
  assert.equal(entity1.externalIdentifiers?.[0]?.localAttributeIds.includes(localAttribute.id), true);
  assert.equal(entity1.externalIdentifiers?.[0]?.importedParts.some((part) => part.relationshipId === relationship?.id), true);
  assert.equal(entity2.internalIdentifiers?.length, 1);

  const serialized = serializeDiagramToErs(diagram);
  assert.match(serialized, /identifier\(ATTRIBUTO1, RELAZIONE1\)/);
  assert.doesNotMatch(serialized, /ATTRIBUTO1 \(external\)/);
  assert.doesNotMatch(serialized, /ENTITA1: one\.\.one external/);
});

test("ERS preserva identificatori misti diversi con lo stesso attributo locale", () => {
  const diagram = parseErsDiagram(`entity ENTITA1 {
    identifier(ATTRIBUTO1)
}
entity ENTITA2 {
    identifier(ATTRIBUTO6, RELAZIONE1),
    identifier(ATTRIBUTO6, RELAZIONE2)
}
entity ENTITA3 {
    identifier(ATTRIBUTO11)
}

relationship RELAZIONE1 (
    ENTITA2: one..one,
    ENTITA1: one..many
)
relationship RELAZIONE2 (
    ENTITA2: one..one,
    ENTITA3: one..many
)`);

  const entity2 = findEntity(diagram, "ENTITA2");
  const attribute6 = findDirectAttribute(diagram, "ENTITA2", "ATTRIBUTO6");

  assert.ok(entity2);
  assert.ok(attribute6);
  assert.equal(entity2.externalIdentifiers?.length, 2);
  assert.deepEqual(
    entity2.externalIdentifiers?.map((identifier) => identifier.localAttributeIds).sort(),
    [[attribute6.id], [attribute6.id]],
  );
  assert.deepEqual(
    entity2.externalIdentifiers?.map((identifier) => identifier.importedParts[0]?.relationshipId).sort(),
    ["RELAZIONE1", "RELAZIONE2"],
  );

  const serialized = serializeDiagramToErs(diagram);
  assert.match(serialized, /identifier\(ATTRIBUTO6, RELAZIONE1\)/);
  assert.match(serialized, /identifier\(ATTRIBUTO6, RELAZIONE2\)/);
});

test("ERS migra il vecchio formato external al formato identifier", () => {
  const diagram = parseErsDiagram(`entity ENTITA1 {
    ATTRIBUTO1 (external),
    ATTRIBUTO2
}
entity ENTITA2 {
    ATTRIBUTO3 (id)
}

relationship RELAZIONE1 (
    ENTITA1: one..one external,
    ENTITA2: one..many
)`);

  const serialized = serializeDiagramToErs(diagram);
  assert.match(serialized, /identifier\(ATTRIBUTO1, RELAZIONE1\)/);
  assert.match(serialized, /identifier\(ATTRIBUTO3\)/);
  assert.doesNotMatch(serialized, /\(external\)/);
  assert.doesNotMatch(serialized, / external\b/);
});

test("ERS supporta piu identificatori interni alternativi", () => {
  const diagram = parseErsDiagram(`entity PERSONA {
    identifier(codFiscale),
    identifier(numeroDocumento),
    nome,
    cognome
}`);

  const persona = findEntity(diagram, "PERSONA");
  const codFiscale = findDirectAttribute(diagram, "PERSONA", "codFiscale");
  const numeroDocumento = findDirectAttribute(diagram, "PERSONA", "numeroDocumento");

  assert.equal(persona?.internalIdentifiers?.length, 2);
  assert.equal(
    persona?.internalIdentifiers?.some((identifier) => codFiscale && identifier.attributeIds.includes(codFiscale.id)),
    true,
  );
  assert.equal(
    persona?.internalIdentifiers?.some((identifier) => numeroDocumento && identifier.attributeIds.includes(numeroDocumento.id)),
    true,
  );

  const serialized = serializeDiagramToErs(diagram);
  assert.match(serialized, /identifier\(codFiscale\)/);
  assert.match(serialized, /identifier\(numeroDocumento\)/);
});

test("ERS supporta due identificatori esterni misti alternativi sulla stessa relazione", () => {
  const source = `entity ENTITA1 {
    identifier(ATTRIBUTO1, RELAZIONE1),
    identifier(ATTRIBUTO2, RELAZIONE1)
}
entity ENTITA2 {
    identifier(ATTRIBUTO3)
}

relationship RELAZIONE1 (
    ENTITA1: one..one,
    ENTITA2: one..many
)`;

  const diagram = parseErsDiagram(source);
  const entity1 = findEntity(diagram, "ENTITA1");
  const entity2 = findEntity(diagram, "ENTITA2");
  const relationship = diagram.nodes.find((node) => node.type === "relationship" && node.label === "RELAZIONE1");
  const attribute1 = findDirectAttribute(diagram, "ENTITA1", "ATTRIBUTO1");
  const attribute2 = findDirectAttribute(diagram, "ENTITA1", "ATTRIBUTO2");
  const attribute3 = findDirectAttribute(diagram, "ENTITA2", "ATTRIBUTO3");

  assert.ok(entity1);
  assert.ok(entity2);
  assert.ok(relationship);
  assert.ok(attribute1);
  assert.ok(attribute2);
  assert.ok(attribute3);
  assert.equal(entity1.externalIdentifiers?.length, 2);

  const identifierByLocalAttribute = new Map(
    entity1.externalIdentifiers?.map((identifier) => [identifier.localAttributeIds[0], identifier]) ?? [],
  );
  const firstIdentifier = identifierByLocalAttribute.get(attribute1.id);
  const secondIdentifier = identifierByLocalAttribute.get(attribute2.id);
  const importedIdentifierId = entity2.internalIdentifiers?.[0]?.id;

  assert.ok(firstIdentifier);
  assert.ok(secondIdentifier);
  [firstIdentifier, secondIdentifier].forEach((identifier) => {
    assert.equal(identifier.importedParts.length, 1);
    assert.equal(identifier.importedParts[0]?.relationshipId, relationship.id);
    assert.equal(identifier.importedParts[0]?.sourceEntityId, entity2.id);
    assert.equal(identifier.importedParts[0]?.importedIdentifierId, importedIdentifierId);
  });

  const externalIdentifierIssues = validateDiagram(diagram).filter((issue) => issue.id.includes("external-identifier"));
  assert.deepEqual(externalIdentifierIssues, []);

  const serialized = serializeDiagramToErs(diagram);
  assert.match(serialized, /identifier\(ATTRIBUTO1, RELAZIONE1\)/);
  assert.match(serialized, /identifier\(ATTRIBUTO2, RELAZIONE1\)/);
  assert.equal((serialized.match(/identifier\(ATTRIBUTO[12], RELAZIONE1\)/g) ?? []).length, 2);
});

test("synchronizeExternalIdentifiers non rimuove identificatori misti con stessa parte importata e locali diversi", () => {
  const diagram: DiagramDocument = {
    meta: { name: "External alternativi", version: 3 },
    notes: "",
    nodes: [
      {
        id: "ENTITA1",
        type: "entity",
        label: "ENTITA1",
        x: 100,
        y: 100,
        width: 140,
        height: 64,
        relationshipParticipations: [{ id: "p-entita1-relazione1", relationshipId: "RELAZIONE1", cardinality: "(1,1)" }],
        externalIdentifiers: [
          {
            id: "ext-1",
            importedParts: [
              {
                id: "ext-part-1",
                relationshipId: "RELAZIONE1",
                sourceEntityId: "ENTITA2",
                importedIdentifierId: "id-ENTITA2",
              },
            ],
            localAttributeIds: ["ATTRIBUTO1"],
          },
          {
            id: "ext-2",
            importedParts: [
              {
                id: "ext-part-2",
                relationshipId: "RELAZIONE1",
                sourceEntityId: "ENTITA2",
                importedIdentifierId: "id-ENTITA2",
              },
            ],
            localAttributeIds: ["ATTRIBUTO2"],
          },
        ],
      },
      {
        id: "ENTITA2",
        type: "entity",
        label: "ENTITA2",
        x: 420,
        y: 100,
        width: 140,
        height: 64,
        internalIdentifiers: [{ id: "id-ENTITA2", attributeIds: ["ATTRIBUTO3"] }],
        relationshipParticipations: [{ id: "p-entita2-relazione1", relationshipId: "RELAZIONE1", cardinality: "(1,N)" }],
      },
      { id: "RELAZIONE1", type: "relationship", label: "RELAZIONE1", x: 260, y: 100, width: 130, height: 78 },
      { id: "ATTRIBUTO1", type: "attribute", label: "ATTRIBUTO1", x: 80, y: 20, width: 150, height: 28 },
      { id: "ATTRIBUTO2", type: "attribute", label: "ATTRIBUTO2", x: 120, y: 210, width: 150, height: 28 },
      { id: "ATTRIBUTO3", type: "attribute", label: "ATTRIBUTO3", x: 430, y: 20, width: 150, height: 28 },
    ],
    edges: [
      { id: "attr-1", type: "attribute", sourceId: "ENTITA1", targetId: "ATTRIBUTO1", label: "", lineStyle: "solid" },
      { id: "attr-2", type: "attribute", sourceId: "ENTITA1", targetId: "ATTRIBUTO2", label: "", lineStyle: "solid" },
      { id: "attr-3", type: "attribute", sourceId: "ENTITA2", targetId: "ATTRIBUTO3", label: "", lineStyle: "solid" },
      {
        id: "connector-1",
        type: "connector",
        sourceId: "ENTITA1",
        targetId: "RELAZIONE1",
        label: "",
        lineStyle: "solid",
        participationId: "p-entita1-relazione1",
      },
      {
        id: "connector-2",
        type: "connector",
        sourceId: "RELAZIONE1",
        targetId: "ENTITA2",
        label: "",
        lineStyle: "solid",
        participationId: "p-entita2-relazione1",
      },
    ],
  };

  const synchronized = synchronizeExternalIdentifiers(diagram);
  const entity1 = synchronized.nodes.find((node) => node.id === "ENTITA1" && node.type === "entity");

  assert.ok(entity1);
  assert.equal(entity1?.externalIdentifiers?.length, 2);
  assert.deepEqual(
    entity1.externalIdentifiers?.map((identifier) => identifier.localAttributeIds[0]).sort(),
    ["ATTRIBUTO1", "ATTRIBUTO2"],
  );
  entity1.externalIdentifiers?.forEach((identifier) => {
    assert.equal(validateExternalIdentifier(synchronized, entity1, identifier).valid, true);
  });
});

test("removeExternalIdentifierFromEntity rimuove solo l'identificatore esterno e preserva nodi, attributi e relazioni", () => {
  const source = `/* Entities */
entity A {
    idA (id)
}
entity B {
    attributeB
}
entity C

/* Relationships */
relationship R (
    A: zero..many,
    B: one..one external
)
relationship NORMAL (
    B: zero..many,
    C: one..one
)`;

  const parsed = parseErsDiagram(source);
  const entityB = parsed.nodes.find((node) => node.type === "entity" && node.label === "B");
  assert.equal(entityB?.type, "entity");
  assert.equal(entityB?.type === "entity" ? entityB.externalIdentifiers?.length : 0, 1);
  const externalIdentifierId = entityB?.type === "entity" ? entityB.externalIdentifiers?.[0]?.id : undefined;
  assert.ok(externalIdentifierId);

  const updated = removeExternalIdentifierFromEntity(parsed, entityB.id, externalIdentifierId);
  const updatedEntityB = updated.nodes.find((node) => node.type === "entity" && node.label === "B");
  assert.equal(updatedEntityB?.type, "entity");
  assert.equal(updatedEntityB?.type === "entity" ? updatedEntityB.externalIdentifiers : undefined, undefined);
  assert.equal(updated.nodes.some((node) => node.type === "attribute" && node.label === "attributeB"), true);
  assert.equal(updated.nodes.some((node) => node.type === "relationship" && node.label === "R"), true);
  assert.equal(updated.nodes.some((node) => node.type === "relationship" && node.label === "NORMAL"), true);

  const nodeIds = new Set(updated.nodes.map((node) => node.id));
  updated.edges.forEach((edge) => {
    assert.equal(nodeIds.has(edge.sourceId), true);
    assert.equal(nodeIds.has(edge.targetId), true);
  });

  const serialized = serializeDiagramToErs(updated);
  assert.doesNotMatch(serialized, /\bexternal\b/);
});

test("ERS parse e serializza gruppi generalization espliciti", () => {
  const parsed = parseErsDiagram(`entity PERSONA
entity UOMO
entity DONNA

generalization G1 (t, e) PERSONA {
  UOMO
  DONNA
}`);

  assert.equal(parsed.generalizationGroups?.length, 1);
  assert.equal(parsed.generalizationGroups?.[0]?.id, "G1");
  assert.equal(parsed.generalizationGroups?.[0]?.subtypeIds.length, 2);

  const serialized = serializeDiagramToErs(parsed);
  assert.match(serialized, /generalization G1 \(t, e\) PERSONA \{/);
  assert.match(serialized, /UOMO,/);
  assert.match(serialized, /DONNA/);
});
