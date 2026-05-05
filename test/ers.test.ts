import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument, DiagramEdge, DiagramNode } from "../src/types/diagram.ts";
import {
  assignInheritanceConstraintToGroup,
  normalizeGeneralizationGroups,
  removeSubtypeFromGeneralizationGroup,
  renameNodeAsNameIdentity,
  updateGeneralizationGroupConstraint,
  validateDiagram,
} from "../src/utils/diagram.ts";
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
  assert.match(serialized, /^    Budget,?$/m);
  assert.match(serialized, /^    DataConsegna,?$/m);
  assert.match(serialized, /^    Nome \(id\)$/m);
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

test("gli edge ISA nascono senza vincolo e vengono raggruppati per padre e vincolo", () => {
  let diagram = createIsaTestDiagram();
  let issues = validateDiagram(diagram);
  assert.equal(issues.filter((issue) => issue.id.startsWith("inheritance-missing-group")).length, 4);

  diagram = assignInheritanceConstraintToGroup(diagram, "isa-uomo", "total", "disjoint");
  let groups = diagram.generalizationGroups ?? [];
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].subtypeIds, ["UOMO"]);
  assert.equal(diagram.edges.find((edge) => edge.id === "isa-donna" && edge.type === "inheritance")?.generalizationGroupId, undefined);

  diagram = assignInheritanceConstraintToGroup(diagram, "isa-donna", "total", "disjoint");
  groups = diagram.generalizationGroups ?? [];
  assert.equal(groups.length, 1);
  assert.deepEqual([...groups[0].subtypeIds].sort(), ["DONNA", "UOMO"]);

  diagram = assignInheritanceConstraintToGroup(diagram, "isa-impiegato", "partial", "overlap");
  diagram = assignInheritanceConstraintToGroup(diagram, "isa-studente", "partial", "overlap");
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
  diagram = assignInheritanceConstraintToGroup(diagram, "isa-uomo", "total", "disjoint");
  diagram = assignInheritanceConstraintToGroup(diagram, "isa-donna", "total", "disjoint");
  diagram = assignInheritanceConstraintToGroup(diagram, "isa-impiegato", "partial", "overlap");
  diagram = assignInheritanceConstraintToGroup(diagram, "isa-studente", "partial", "overlap");

  const serialized = serializeDiagramToErs(diagram);
  assert.match(serialized, /generalization .* PERSONA \(t,e\) \{/);
  assert.match(serialized, /generalization .* PERSONA \(p,o\) \{/);
  assert.doesNotMatch(serialized, /\b(?:D\/T|D\/P|O\/T|O\/P|T\/D|P\/D)\b/);

  const reparsed = parseErsDiagram(serialized);
  const groups = normalizeGeneralizationGroups(reparsed).generalizationGroups?.filter((group) => group.supertypeId === "PERSONA") ?? [];
  assert.equal(groups.length, 2);
  assert.equal(groups.some((group) => group.isaCompleteness === "total" && group.isaDisjointness === "disjoint"), true);
  assert.equal(groups.some((group) => group.isaCompleteness === "partial" && group.isaDisjointness === "overlap"), true);
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
  assert.match(serialized, /generalization TRENO_generalization_\d+ TRENO \(p,e\) \{/);
  assert.match(serialized, /identifier \(Nome, Cognome\)/);
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
  assert.match(serialized, /^    B: one\.\.one external$/m);
});

test("ERS parse e serializza gruppi generalization espliciti", () => {
  const parsed = parseErsDiagram(`entity PERSONA
entity UOMO
entity DONNA

generalization G1 PERSONA (t,e) {
  UOMO
  DONNA
}`);

  assert.equal(parsed.generalizationGroups?.length, 1);
  assert.equal(parsed.generalizationGroups?.[0]?.id, "G1");
  assert.equal(parsed.generalizationGroups?.[0]?.subtypeIds.length, 2);

  const serialized = serializeDiagramToErs(parsed);
  assert.match(serialized, /generalization G1 PERSONA \(t,e\) \{/);
  assert.match(serialized, /UOMO,/);
  assert.match(serialized, /DONNA/);
});
