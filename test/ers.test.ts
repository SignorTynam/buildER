import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument, DiagramEdge, DiagramNode } from "../src/types/diagram.ts";
import {
  assignInheritanceConstraintToGroup,
  canAttributeBecomeComposite,
  cleanupGeneralizationReferences,
  mergeCompatibleGeneralizationGroups,
  normalizeGeneralizationGroups,
  removeEntityFromGeneralizationHierarchy,
  removeExternalIdentifierFromEntity,
  removeSelection,
  removeSubtypeFromGeneralizationGroup,
  renameNodeAsNameIdentity,
  updateGeneralizationGroupConstraint,
  validateDiagram,
} from "../src/utils/diagram.ts";
import { computeClassicIsaGroupLayout } from "../src/utils/geometry.ts";
import { buildInheritanceGroups, getInheritanceGroupLayout } from "../src/utils/inheritanceLayout.ts";
import { parseErsDiagram, serializeDiagramToErs } from "../src/utils/ers.ts";
import { normalizeCardinalityInput } from "../src/utils/cardinality.ts";

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

function generalizationBlock(source: string, groupId: string): string {
  const match = source.match(new RegExp(`generalization ${groupId}[^]*?\\n\\}`));
  return match?.[0] ?? "";
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

test("cambio vincolo ISA unifica gruppi compatibili", () => {
  let diagram = createIsaMergeDiagram();
  diagram = updateGeneralizationGroupConstraint(diagram, "g2", "partial", "overlap");

  const groups = diagram.generalizationGroups?.filter(
    (group) => group.supertypeId === "ENTITA1" && group.isaCompleteness === "partial" && group.isaDisjointness === "overlap",
  ) ?? [];
  assert.equal(groups.length, 1);
  assert.deepEqual(new Set(groups[0].subtypeIds), new Set(["ENTITA2", "ENTITA3", "ENTITA7", "ENTITA5"]));
  assert.equal(diagram.generalizationGroups?.some((group) => group.id === "g2"), false);
  const entita5Edge = diagram.edges.find((edge) => edge.id === "isa-entita5" && edge.type === "inheritance");
  assert.equal(entita5Edge?.generalizationGroupId, groups[0].id);
});

test("serializzazione ERS unifica gruppi ISA compatibili", () => {
  let diagram = createIsaMergeDiagram();
  diagram = updateGeneralizationGroupConstraint(diagram, "g2", "partial", "overlap");
  const serialized = serializeDiagramToErs(diagram);
  const blocks = serialized.match(/generalization .* ENTITA1 \(p,o\) \{/g) ?? [];
  assert.equal(blocks.length, 1);
  assert.match(serialized, /\bENTITA5\b/);
});

test("parser ERS fonde generalization con stesso vincolo", () => {
  const diagram = parseErsDiagram(`entity ENTITA1 {}
entity ENTITA2 {}
entity ENTITA5 {}

generalization g1 ENTITA1 (p,o) {
  ENTITA2
}
generalization g2 ENTITA1 (p,o) {
  ENTITA5
}`);
  const groups = diagram.generalizationGroups?.filter(
    (group) => group.supertypeId === "ENTITA1" && group.isaCompleteness === "partial" && group.isaDisjointness === "overlap",
  ) ?? [];
  assert.equal(groups.length, 1);
  assert.deepEqual(new Set(groups[0].subtypeIds), new Set(["ENTITA2", "ENTITA5"]));
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

test("merge ISA evita duplicati di sottotipo", () => {
  const diagram = mergeCompatibleGeneralizationGroups({
    ...createIsaMergeDiagram(),
    generalizationGroups: [
      { id: "g1", supertypeId: "ENTITA1", subtypeIds: ["ENTITA2", "ENTITA2"], isaCompleteness: "partial", isaDisjointness: "overlap" },
      { id: "g3", supertypeId: "ENTITA1", subtypeIds: ["ENTITA2"], isaCompleteness: "partial", isaDisjointness: "overlap" },
    ],
  });
  const groups = diagram.generalizationGroups ?? [];
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].subtypeIds, ["ENTITA2"]);
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
