import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument } from "../src/types/diagram.ts";
import { renameNodeAsNameIdentity } from "../src/utils/diagram.ts";
import { parseErsDiagram, serializeDiagramToErs } from "../src/utils/ers.ts";
import { normalizeCardinalityInput } from "../src/utils/cardinality.ts";

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
  assert.match(serialized, /^  attribute Budget$/m);
  assert.match(serialized, /^  attribute DataConsegna$/m);
  assert.match(serialized, /^  identifier Nome$/m);
  assert.match(serialized, /^relation RELAZIONE2 ENTITA2 "\(X,Y\)" PROGETTO "\(X,Y\)"$/m);
  assert.doesNotMatch(serialized, /\bENTITA1\b/);
  assert.doesNotMatch(serialized, /\bATTRIBUTO1\b/);
  assert.doesNotMatch(serialized, /\bATTRIBUTO2\b/);
  assert.doesNotMatch(serialized, /\bATTRIBUTO3\b/);
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
  assert.match(serialized, /card "\(1,4\)"/);
  assert.match(serialized, /A "\(2,N\)"/);
});
