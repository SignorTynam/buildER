import assert from "node:assert/strict";
import test from "node:test";

import type { AttributeNode, DiagramDocument, DiagramEdge, DiagramNode, EntityNode } from "../src/types/diagram.ts";
import { validateDiagram } from "../src/utils/diagram.ts";
import { parseErsDiagram } from "../src/utils/ers.ts";
import {
  applyCompositeAttributeTranslation,
  applyErTranslationChoice,
  applyGeneralizationTranslation,
  buildErTranslationOverview,
  canOpenLogicalView,
  createEmptyErTranslationWorkspace,
  getErTranslationChoicesForItem,
} from "../src/utils/erTranslation.ts";

function createEntity(
  id: string,
  label: string,
  attributeIds: string[] = [],
): EntityNode {
  return {
    id,
    type: "entity",
    label,
    x: 0,
    y: 0,
    width: 160,
    height: 80,
    internalIdentifiers:
      attributeIds.length > 0
        ? [
            {
              id: `${id}-pk`,
              attributeIds,
            },
          ]
        : [],
    externalIdentifiers: [],
    relationshipParticipations: [],
  };
}

function createAttribute(
  id: string,
  label: string,
  options: Partial<AttributeNode> = {},
): AttributeNode {
  return {
    id,
    type: "attribute",
    label,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    isIdentifier: false,
    isCompositeInternal: false,
    isMultivalued: false,
    ...options,
  };
}

function createAttributeEdge(id: string, sourceId: string, targetId: string): DiagramEdge {
  return {
    id,
    type: "attribute",
    sourceId,
    targetId,
    label: "",
    lineStyle: "solid",
  };
}

function createInheritanceEdge(id: string, subtypeId: string, supertypeId: string): DiagramEdge {
  return {
    id,
    type: "inheritance",
    sourceId: subtypeId,
    targetId: supertypeId,
    label: "",
    lineStyle: "solid",
    isaCompleteness: "partial",
    isaDisjointness: "disjoint",
  };
}

function createOrderedWorkflowDiagram(): DiagramDocument {
  const nodes: DiagramNode[] = [
    createEntity("entity-persona", "PERSONA", ["attr-codice"]),
    createAttribute("attr-codice", "Codice", { isIdentifier: true }),
    createEntity("entity-impiegato", "IMPIEGATO"),
    createAttribute("attr-stipendio", "Stipendio"),
    createAttribute("attr-indirizzo", "INDIRIZZO", { isMultivalued: true, width: 140, height: 52 }),
    createAttribute("attr-via", "Via"),
  ];

  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-codice", "attr-codice", "entity-persona"),
    createAttributeEdge("edge-stipendio", "attr-stipendio", "entity-impiegato"),
    createAttributeEdge("edge-indirizzo", "attr-indirizzo", "entity-persona"),
    createAttributeEdge("edge-via", "attr-via", "attr-indirizzo"),
    createInheritanceEdge("edge-isa", "entity-impiegato", "entity-persona"),
  ];

  return {
    meta: {
      name: "Workflow ordinato",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
  };
}

function createCompositeDiagram(): DiagramDocument {
  const nodes: DiagramNode[] = [
    createEntity("entity-impiegato", "IMPIEGATO", ["attr-codice"]),
    createAttribute("attr-codice", "Codice", { isIdentifier: true }),
    createAttribute("attr-indirizzo", "INDIRIZZO", { isMultivalued: true, width: 140, height: 52 }),
    createAttribute("attr-localita", "LOCALITA"),
    createAttribute("attr-via", "Via"),
    createAttribute("attr-cap", "CAP"),
  ];

  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-codice", "attr-codice", "entity-impiegato"),
    createAttributeEdge("edge-indirizzo", "attr-indirizzo", "entity-impiegato"),
    createAttributeEdge("edge-localita", "attr-localita", "attr-indirizzo"),
    createAttributeEdge("edge-via", "attr-via", "attr-localita"),
    createAttributeEdge("edge-cap", "attr-cap", "attr-localita"),
  ];

  return {
    meta: {
      name: "Attributo composto",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
  };
}

test("GeneralizationGroup condivisi e separati producono item distinti nella overview", () => {
  const diagram = parseErsDiagram(`entity PERSONA {
  identifier CF
}
entity UOMO
entity DONNA
entity IMPIEGATO
entity STUDENTE

generalization G_SESSO PERSONA (t,e) {
  UOMO
  DONNA
}
generalization G_RUOLO PERSONA (p,o) {
  IMPIEGATO
  STUDENTE
}`);

  const workspace = createEmptyErTranslationWorkspace(diagram);
  const overview = buildErTranslationOverview(workspace);
  const generalizations = overview.itemsByStep.generalizations;

  assert.equal(generalizations.length, 2);
  assert.equal(generalizations.some((item) => item.id === "G_SESSO"), true);
  assert.equal(generalizations.some((item) => item.id === "G_RUOLO"), true);
});

test("collapse up si applica solo al gruppo selezionato anche con stesso parent", () => {
  const diagram = parseErsDiagram(`entity PERSONA {
  identifier CF
  attribute Nome
}
entity UOMO {
  attribute Barba
}
entity DONNA {
  attribute Maternita
}
entity IMPIEGATO
entity STUDENTE

generalization G_SESSO PERSONA (t,e) {
  UOMO
  DONNA
}
generalization G_RUOLO PERSONA (p,o) {
  IMPIEGATO
  STUDENTE
}`);

  const translated = applyGeneralizationTranslation(diagram, {
    supertypeId: "G_SESSO",
    rule: "generalization-collapse-up",
  });

  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.label === "UOMO"), false);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.label === "DONNA"), false);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.label === "IMPIEGATO"), true);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.label === "STUDENTE"), true);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_RUOLO"), true);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_SESSO"), false);
});

test("la pipeline ER->ER blocca gli attributi composti finche esistono generalizzazioni aperte", () => {
  const diagram = createOrderedWorkflowDiagram();
  let workspace = createEmptyErTranslationWorkspace(diagram);
  let overview = buildErTranslationOverview(workspace);

  assert.equal(overview.steps.find((step) => step.id === "generalizations")?.pending, 1);
  assert.equal(overview.itemsByStep["composite-attributes"][0]?.status, "blocked");
  assert.match(
    overview.itemsByStep["composite-attributes"][0]?.blockedReason ?? "",
    /Risolvi prima le generalizzazioni/i,
  );
  assert.equal(canOpenLogicalView(workspace).allowed, false);

  const generalizationItem = overview.itemsByStep.generalizations[0];
  assert.ok(generalizationItem);
  const generalizationChoice = getErTranslationChoicesForItem(workspace, generalizationItem).find(
    (choice) => choice.rule === "generalization-collapse-up",
  );
  assert.ok(generalizationChoice);

  workspace = applyErTranslationChoice(
    diagram,
    workspace,
    generalizationChoice,
    generalizationItem.targetType,
    generalizationItem.id,
  );
  overview = buildErTranslationOverview(workspace);

  assert.equal(overview.itemsByStep.generalizations.length, 0);
  assert.equal(overview.itemsByStep["composite-attributes"][0]?.status, "pending");
  assert.equal(canOpenLogicalView(workspace).allowed, false);

  const compositeItem = overview.itemsByStep["composite-attributes"][0];
  assert.ok(compositeItem);
  const compositeChoice = getErTranslationChoicesForItem(workspace, compositeItem).find(
    (choice) => choice.rule === "composite-split",
  );
  assert.ok(compositeChoice);

  workspace = applyErTranslationChoice(diagram, workspace, compositeChoice, compositeItem.targetType, compositeItem.id);

  assert.equal(canOpenLogicalView(workspace).allowed, true);
  assert.equal(workspace.translatedDiagram.edges.some((edge) => edge.type === "inheritance"), false);
  assert.equal(
    workspace.translatedDiagram.nodes.some((node) => node.type === "attribute" && node.isMultivalued === true),
    false,
  );
});

test("applyGeneralizationTranslation risolve la gerarchia ISA dentro l'ER tradotto", () => {
  const translated = applyGeneralizationTranslation(createOrderedWorkflowDiagram(), {
    supertypeId: "entity-persona",
    rule: "generalization-collapse-up",
  });

  assert.equal(translated.nodes.some((node) => node.id === "entity-impiegato"), false);
  assert.equal(translated.edges.some((edge) => edge.type === "inheritance"), false);

  const stipendioNode = translated.nodes.find((node) => node.type === "attribute" && node.label === "Stipendio");
  assert.ok(stipendioNode);
  const stipendioOwnerEdge = translated.edges.find(
    (edge) =>
      edge.type === "attribute" &&
      ((edge.sourceId === stipendioNode.id && edge.targetId === "entity-persona") ||
        (edge.targetId === stipendioNode.id && edge.sourceId === "entity-persona")),
  );
  assert.ok(stipendioOwnerEdge);
});

test("applyCompositeAttributeTranslation espande ricorsivamente i foglia sull'owner ER", () => {
  const translated = applyCompositeAttributeTranslation(
    createCompositeDiagram(),
    "attr-indirizzo",
    "composite-split",
  );

  assert.equal(translated.nodes.some((node) => node.id === "attr-indirizzo"), false);
  assert.equal(translated.nodes.some((node) => node.id === "attr-localita"), false);
  assert.equal(
    translated.nodes.some((node) => node.type === "attribute" && node.isMultivalued === true),
    false,
  );

  const expectedLeafLabels = ["INDIRIZZO_LOCALITA_Via", "INDIRIZZO_LOCALITA_CAP"];
  expectedLeafLabels.forEach((label) => {
    const node = translated.nodes.find((candidate) => candidate.type === "attribute" && candidate.label === label);
    assert.ok(node, `Attributo foglia tradotto non trovato: ${label}`);
    const ownerEdge = translated.edges.find(
      (edge) =>
        edge.type === "attribute" &&
        ((edge.sourceId === node.id && edge.targetId === "entity-impiegato") ||
          (edge.targetId === node.id && edge.sourceId === "entity-impiegato")),
    );
    assert.ok(ownerEdge, `Collegamento owner mancante per ${label}`);
  });
});

test("applyGeneralizationTranslation con collapse verso il basso risolve gerarchia senza attributi orfani, espande connector mantenendo l'identificatore", () => {
  const ersCode = `entity ARGOMENTO {
  attribute titolo
  identifier IDArgomento
  attribute tags
}

entity ARG_TEORICO {
  attribute libro
}

entity ARG_PRATICO {
  attribute dispensa
}

generalization G_ARG ARGOMENTO (t,e) {
  ARG_TEORICO
  ARG_PRATICO
}

relation PARTECIPAZIONE ARGOMENTO "(0,N)" STATISTICA "(1,1)"
entity STATISTICA {
  attribute someAttr
}`;

  const diagram = parseErsDiagram(ersCode);
  const supertypeNode = diagram.nodes.find((n) => n.type === "entity" && n.label === "ARGOMENTO");
  assert.ok(supertypeNode);

  const translated = applyGeneralizationTranslation(diagram, {
    supertypeId: supertypeNode.id,
    rule: "generalization-collapse-down",
  });

  // 1. The supertype ARGOMENTO does not exist in translated.nodes
  assert.equal(
    translated.nodes.some((n) => n.id === supertypeNode.id),
    false,
  );

  // 2. No orphaned attributes originally belonging to the supertype
  const teorico = translated.nodes.find((n) => n.type === "entity" && n.label === "ARG_TEORICO") as EntityNode;
  const pratico = translated.nodes.find((n) => n.type === "entity" && n.label === "ARG_PRATICO") as EntityNode;
  assert.ok(teorico);
  assert.ok(pratico);

  // 3. The subtypes contain the expected inherited attributes
  const getSubtypeAttributes = (subtypeId: string) => {
    return translated.edges
      .filter((e) => e.type === "attribute" && (e.sourceId === subtypeId || e.targetId === subtypeId))
      .map((e) => {
        const attrId = e.sourceId === subtypeId ? e.targetId : e.sourceId;
        return translated.nodes.find((n) => n.id === attrId)?.label;
      });
  };

  const teoricoAttrs = getSubtypeAttributes(teorico.id);
  const praticoAttrs = getSubtypeAttributes(pratico.id);

  assert.ok(teoricoAttrs.includes("titolo"));
  assert.ok(teoricoAttrs.includes("IDArgomento"));
  assert.ok(teoricoAttrs.includes("tags"));
  assert.ok(teoricoAttrs.includes("libro"));

  assert.ok(praticoAttrs.includes("titolo"));
  assert.ok(praticoAttrs.includes("IDArgomento"));
  assert.ok(praticoAttrs.includes("tags"));
  assert.ok(praticoAttrs.includes("dispensa"));

  // Check no orphaned attribute edges to the old supertype
  assert.equal(
    translated.edges.some(
      (e) => e.type === "attribute" && (e.sourceId === supertypeNode.id || e.targetId === supertypeNode.id),
    ),
    false,
  );

  // 4. Inherited identifier is maintained
  const checkIdentifier = (subtype: EntityNode) => {
    const idEdge = translated.edges.find(
      (e) =>
        e.type === "attribute" &&
        (e.sourceId === subtype.id || e.targetId === subtype.id) &&
        translated.nodes.find((n) => n.id === (e.sourceId === subtype.id ? e.targetId : e.sourceId))?.label ===
          "IDArgomento",
    );
    assert.ok(idEdge);
    const idAttrNodeId = idEdge.sourceId === subtype.id ? idEdge.targetId : idEdge.sourceId;
    const idAttrNode = translated.nodes.find((n) => n.id === idAttrNodeId) as AttributeNode;

    assert.ok(idAttrNode);
    assert.equal(idAttrNode.isIdentifier, true);

    const internalIdentifiers = subtype.internalIdentifiers || [];
    assert.equal(internalIdentifiers.length, 1);
    assert.ok(internalIdentifiers[0].attributeIds.includes(idAttrNode.id));
  };

  checkIdentifier(teorico);
  checkIdentifier(pratico);

  // 5. No residual inheritance edges
  assert.equal(
    translated.edges.some((edge) => edge.type === "inheritance"),
    false,
  );

  // 6. Connector and cardinalities are replicated cleanly
  const partecipazione = translated.nodes.find((n) => n.type === "relationship" && n.label === "PARTECIPAZIONE");
  assert.ok(partecipazione);

  const teoricoParticipation = teorico.relationshipParticipations?.find(
    (p) => p.relationshipId === partecipazione.id,
  );
  assert.ok(teoricoParticipation);
  assert.equal(teoricoParticipation.cardinality, "(0,N)");

  const praticoParticipation = pratico.relationshipParticipations?.find(
    (p) => p.relationshipId === partecipazione.id,
  );
  assert.ok(praticoParticipation);
  assert.equal(praticoParticipation.cardinality, "(0,N)");

  // 7. No structural warnings are generated
  const issues = validateDiagram(translated);
  assert.equal(
    issues.filter((i) => i.level === "warning").length,
    0,
  );
});

test("applyCompositeAttributeTranslation - test split", () => {
  const diagram: DiagramDocument = {
    nodes: [
      createEntity("entity-persona", "PERSONA"),
      createAttribute("attr-cf", "CF", { isIdentifier: true }),
      createAttribute("attr-dipartimento", "Dipartimento", { isMultivalued: true }),
      createAttribute("attr-nomedip", "NomeDip"),
      createAttribute("attr-numerodip", "NumeroDip"),
    ],
    edges: [
      createAttributeEdge("e-cf", "attr-cf", "entity-persona"),
      createAttributeEdge("e-dip", "attr-dipartimento", "entity-persona"),
      createAttributeEdge("e-nome", "attr-nomedip", "attr-dipartimento"),
      createAttributeEdge("e-num", "attr-numerodip", "attr-dipartimento"),
    ],
  };

  const dipartimentoNode = diagram.nodes.find((n) => n.type === "attribute" && n.label === "Dipartimento");
  assert.ok(dipartimentoNode);

  const translated = applyCompositeAttributeTranslation(diagram, dipartimentoNode.id, "composite-split");

  // assert: Dipartimento node missing
  assert.equal(
    translated.nodes.some((n) => n.id === dipartimentoNode.id),
    false,
  );

  // find entity PERSONA
  const personaNode = translated.nodes.find((n) => n.type === "entity" && n.label === "PERSONA");
  assert.ok(personaNode);

  // expect two simple attributes: NomeDip_Dipartimento and NumeroDip_Dipartimento
  const nomeDipNode = translated.nodes.find((n) => n.type === "attribute" && n.label === "NomeDip_Dipartimento");
  assert.ok(nomeDipNode, "missing NomeDip_Dipartimento");
  const numeroDipNode = translated.nodes.find((n) => n.type === "attribute" && n.label === "NumeroDip_Dipartimento");
  assert.ok(numeroDipNode, "missing NumeroDip_Dipartimento");

  // connected to PERSONA
  const nomeDipEdge = translated.edges.find(
    (e) =>
      e.type === "attribute" &&
      ((e.sourceId === nomeDipNode.id && e.targetId === personaNode.id) ||
        (e.targetId === nomeDipNode.id && e.sourceId === personaNode.id)),
  );
  assert.ok(nomeDipEdge, "NomeDip_Dipartimento not connected to PERSONA");

  const numeroDipEdge = translated.edges.find(
    (e) =>
      e.type === "attribute" &&
      ((e.sourceId === numeroDipNode.id && e.targetId === personaNode.id) ||
        (e.targetId === numeroDipNode.id && e.sourceId === personaNode.id)),
  );
  assert.ok(numeroDipEdge, "NumeroDip_Dipartimento not connected to PERSONA");

  // No orphans, no edges of the compound
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NomeDip"),
    false,
  );
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NumeroDip"),
    false,
  );
});

test("applyCompositeAttributeTranslation - test merge", () => {
  const diagram: DiagramDocument = {
    nodes: [
      createEntity("entity-persona", "PERSONA"),
      createAttribute("attr-cf", "CF", { isIdentifier: true }),
      createAttribute("attr-dipartimento", "Dipartimento", { isMultivalued: true }),
      createAttribute("attr-nomedip", "NomeDip"),
      createAttribute("attr-numerodip", "NumeroDip"),
    ],
    edges: [
      createAttributeEdge("e-cf", "attr-cf", "entity-persona"),
      createAttributeEdge("e-dip", "attr-dipartimento", "entity-persona"),
      createAttributeEdge("e-nome", "attr-nomedip", "attr-dipartimento"),
      createAttributeEdge("e-num", "attr-numerodip", "attr-dipartimento"),
    ],
  };

  const dipartimentoNode = diagram.nodes.find((n) => n.type === "attribute" && n.label === "Dipartimento");
  assert.ok(dipartimentoNode);

  const translated = applyCompositeAttributeTranslation(diagram, dipartimentoNode.id, "composite-merge");

  // assert: Dipartimento is missing
  assert.equal(
    translated.nodes.some((n) => n.id === dipartimentoNode.id),
    false,
  );

  // ONLY ONE simple attribute created on PERSONA named Dipartimento_NomeDip_NumeroDip
  const personaNode = translated.nodes.find((n) => n.type === "entity" && n.label === "PERSONA");
  assert.ok(personaNode);

  const mergedNode = translated.nodes.find((n) => n.type === "attribute" && n.label === "Dipartimento_NomeDip_NumeroDip");
  assert.ok(mergedNode, "missing Dipartimento_NomeDip_NumeroDip");

  const mergedEdge = translated.edges.find(
    (e) =>
      e.type === "attribute" &&
      ((e.sourceId === mergedNode.id && e.targetId === personaNode.id) ||
        (e.targetId === mergedNode.id && e.sourceId === personaNode.id)),
  );
  assert.ok(mergedEdge, "Dipartimento_NomeDip_NumeroDip not connected to PERSONA");

  // None of NomeDip and NumeroDip nodes should exist independently
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NomeDip"),
    false,
  );
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NumeroDip"),
    false,
  );
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NomeDip_Dipartimento"),
    false,
  );
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NumeroDip_Dipartimento"),
    false,
  );
});
