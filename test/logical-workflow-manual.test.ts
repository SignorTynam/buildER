import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument, DiagramEdge, DiagramNode } from "../src/types/diagram.ts";
import {
  LOGICAL_TRANSLATION_STEPS,
  applyLogicalTranslationChoice,
  buildLogicalTranslationOverview,
  createEmptyLogicalWorkspace,
  getLogicalTranslationChoicesForItem,
  refreshLogicalWorkspace,
} from "../src/utils/logicalTranslation.ts";

function createEntityWithIdentifier(
  entityId: string,
  entityLabel: string,
  attributeId: string,
  attributeLabel: string,
): DiagramNode[] {
  const entity: Extract<DiagramNode, { type: "entity" }> = {
    id: entityId,
    type: "entity",
    label: entityLabel,
    x: 0,
    y: 0,
    width: 180,
    height: 80,
    internalIdentifiers: [
      {
        id: `${entityId}-id`,
        attributeIds: [attributeId],
      },
    ],
    relationshipParticipations: [],
  };

  const attribute: Extract<DiagramNode, { type: "attribute" }> = {
    id: attributeId,
    type: "attribute",
    label: attributeLabel,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    isIdentifier: true,
  };

  return [entity, attribute];
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

function createTwoEntityDiagram(): DiagramDocument {
  const nodes: DiagramNode[] = [
    ...createEntityWithIdentifier("entity-a", "A", "attr-a-id", "idA"),
    ...createEntityWithIdentifier("entity-b", "B", "attr-b-id", "idB"),
  ];

  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-attr-a-id", "attr-a-id", "entity-a"),
    createAttributeEdge("edge-attr-b-id", "attr-b-id", "entity-b"),
  ];

  return {
    meta: {
      name: "Manual workflow baseline",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
  };
}

function createHierarchyDiagram(): DiagramDocument {
  const nodes: DiagramNode[] = [
    ...createEntityWithIdentifier("entity-super", "SUPER", "attr-super-id", "idSuper"),
    ...createEntityWithIdentifier("entity-sub", "SUB", "attr-sub-id", "idSub"),
  ];

  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-attr-super-id", "attr-super-id", "entity-super"),
    createAttributeEdge("edge-attr-sub-id", "attr-sub-id", "entity-sub"),
    {
      id: "edge-sub-super",
      type: "inheritance",
      sourceId: "entity-sub",
      targetId: "entity-super",
      label: "",
      lineStyle: "solid",
    },
  ];

  return {
    meta: {
      name: "Legacy hierarchy",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
  };
}

test("l'apertura del workspace logico non materializza automaticamente lo schema completo", () => {
  const diagram = createTwoEntityDiagram();
  const workspace = refreshLogicalWorkspace(diagram, createEmptyLogicalWorkspace(diagram));

  assert.equal(workspace.model.tables.length, 0);
  assert.equal(workspace.model.foreignKeys.length, 0);
  assert.equal(workspace.translation.decisions.length, 0);

  const overview = buildLogicalTranslationOverview(diagram, workspace);
  assert.equal(overview.itemsByStep.entities.length, 2);
  assert.equal(overview.itemsByStep.entities.every((item) => item.status === "pending"), true);
});

test("applicare una sola decisione su entity aggiorna solo la parte coinvolta", () => {
  const diagram = createTwoEntityDiagram();
  let workspace = createEmptyLogicalWorkspace(diagram);
  let overview = buildLogicalTranslationOverview(diagram, workspace);

  const target = overview.itemsByStep.entities.find((item) => item.id === "entity-a");
  assert.ok(target, "Entity A non trovata nello step entities");

  const choice =
    getLogicalTranslationChoicesForItem(overview, target).find((candidate) => candidate.recommended) ??
    getLogicalTranslationChoicesForItem(overview, target)[0];
  assert.ok(choice, "Nessuna scelta disponibile per entity A");

  workspace = applyLogicalTranslationChoice(diagram, workspace, choice, target.targetType, target.id);
  overview = buildLogicalTranslationOverview(diagram, workspace);

  assert.equal(workspace.model.tables.length, 1);
  assert.equal(workspace.model.tables[0].sourceEntityId, "entity-a");

  const untouchedEntity = overview.itemsByStep.entities.find((item) => item.id === "entity-b");
  assert.equal(untouchedEntity?.status, "pending");
});

test("decisioni legacy di generalizzazione nella vista logica vengono invalidate senza crash", () => {
  const diagram = createHierarchyDiagram();
  const baseWorkspace = createEmptyLogicalWorkspace(diagram);

  const refreshed = refreshLogicalWorkspace(diagram, {
    ...baseWorkspace,
    translation: {
      ...baseWorkspace.translation,
      decisions: [
        {
          id: "legacy-generalization",
          targetType: "generalization",
          targetId: "entity-super",
          step: "generalizations",
          rule: "generalization-table-per-type",
          summary: "Legacy decision",
          appliedAt: new Date(0).toISOString(),
          status: "applied",
          configuration: {
            strategy: "table-per-type",
          },
        },
      ],
      mappings: [],
      conflicts: [],
    },
  });

  const legacyDecision = refreshed.translation.decisions.find((decision) => decision.id === "legacy-generalization");
  assert.ok(legacyDecision, "La decisione legacy deve essere mantenuta per audit");
  assert.equal(legacyDecision.status, "invalid");
  assert.equal(
    refreshed.translation.conflicts.some((conflict) => conflict.decisionId === "legacy-generalization"),
    true,
  );
  assert.equal(refreshed.model.tables.length, 0);
});

test("il workflow logico espone solo step post-traduzione coerenti", () => {
  const stepIds = LOGICAL_TRANSLATION_STEPS.map((step) => step.id);

  assert.equal(stepIds.includes("generalizations"), false);
  assert.equal(stepIds.includes("review"), true);
  assert.equal(stepIds.includes("entities"), true);
  assert.equal(stepIds.includes("weak-entities"), true);
  assert.equal(stepIds.includes("relationships"), true);
  assert.equal(stepIds.includes("multivalued-attributes"), true);
  assert.equal(stepIds.includes("composite-attributes" as never), false);
});

test("refresh su sorgente aggiornato riallinea decisioni senza conversione totale automatica", () => {
  const diagram = createTwoEntityDiagram();
  let workspace = createEmptyLogicalWorkspace(diagram);
  let overview = buildLogicalTranslationOverview(diagram, workspace);

  const target = overview.itemsByStep.entities.find((item) => item.id === "entity-a");
  assert.ok(target, "Entity A non trovata nello step entities");

  const choice =
    getLogicalTranslationChoicesForItem(overview, target).find((candidate) => candidate.recommended) ??
    getLogicalTranslationChoicesForItem(overview, target)[0];
  assert.ok(choice, "Nessuna scelta disponibile per entity A");

  workspace = applyLogicalTranslationChoice(diagram, workspace, choice, target.targetType, target.id);

  const updatedSource: DiagramDocument = {
    ...diagram,
    meta: {
      ...diagram.meta,
      name: "Manual workflow baseline v2",
    },
  };

  const refreshed = refreshLogicalWorkspace(updatedSource, workspace);
  const refreshedOverview = buildLogicalTranslationOverview(updatedSource, refreshed);

  assert.equal(refreshed.model.tables.length, 1);
  assert.equal(refreshed.model.tables[0].sourceEntityId, "entity-a");
  assert.equal(
    refreshedOverview.itemsByStep.entities.find((item) => item.id === "entity-b")?.status,
    "pending",
  );

  const resetWorkspace = createEmptyLogicalWorkspace(updatedSource, refreshed);
  assert.equal(resetWorkspace.model.tables.length, 0);
  assert.equal(resetWorkspace.translation.decisions.length, 0);
});
