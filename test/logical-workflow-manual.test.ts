import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { DiagramDocument, DiagramEdge, DiagramNode } from "../src/types/diagram.ts";
import type {
  LogicalSelection,
  LogicalTranslationArtifactKind,
  LogicalTranslationItem,
  LogicalWorkspaceDocument,
} from "../src/types/logical.ts";
import { findTranslationRenameTarget } from "../src/logical/LogicalTranslationWorkspace.tsx";
import {
  LOGICAL_TRANSLATION_STEPS,
  applyBulkLogicalFix,
  applyLogicalTranslationChoice,
  buildLogicalTranslationOverview,
  createEmptyLogicalWorkspace,
  getLogicalTranslationOpenItemCount,
  getLogicalTranslationStepCompletion,
  getLogicalTranslationChoicesForItem,
  refreshLogicalWorkspace,
} from "../src/utils/logicalTranslation.ts";

const EMPTY_LOGICAL_SELECTION_FOR_TEST: LogicalSelection = {
  nodeId: null,
  columnId: null,
  edgeId: null,
};

function createTranslationItem(overrides: Partial<LogicalTranslationItem> = {}): LogicalTranslationItem {
  return {
    id: "entity-student",
    targetType: "entity",
    step: "entities",
    label: "Student",
    description: "Student entity",
    status: "applied",
    currentDecisionId: "decision-1",
    choiceIds: [],
    conflictMessages: [],
    ...overrides,
  };
}

function createRenameWorkspace(
  options: {
    transformationNodeTableId?: string;
    mappingArtifacts?: { kind: LogicalTranslationArtifactKind; id: string; label?: string }[];
  } = {},
): LogicalWorkspaceDocument {
  return {
    model: {
      meta: {
        name: "Logical rename target",
        generatedAt: new Date(0).toISOString(),
        sourceDiagramVersion: 1,
        sourceSignature: "rename-target",
      },
      tables: [
        {
          id: "table-student",
          name: "student",
          kind: "entity",
          columns: [
            {
              id: "column-name",
              name: "name",
              isPrimaryKey: false,
              isForeignKey: false,
              isNullable: false,
              references: [],
            },
          ],
          x: 0,
          y: 0,
          width: 220,
          height: 120,
        },
      ],
      foreignKeys: [],
      uniqueConstraints: [],
      edges: [],
      issues: [],
    },
    translation: {
      meta: {
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        sourceSignature: "rename-target",
      },
      decisions: [],
      mappings: options.mappingArtifacts
        ? [
            {
              decisionId: "decision-1",
              targetType: "entity",
              targetId: "entity-student",
              summary: "Applied",
              artifacts: options.mappingArtifacts.map((artifact) => ({
                kind: artifact.kind,
                id: artifact.id,
                label: artifact.label ?? artifact.id,
              })),
            },
          ]
        : [],
      conflicts: [],
    },
    transformation: {
      meta: {
        updatedAt: new Date(0).toISOString(),
        sourceSignature: "rename-target",
      },
      nodes: [
        {
          id: "transformation-node-student",
          kind: "logical-table",
          renderType: "table",
          label: "student",
          x: 0,
          y: 0,
          width: 220,
          height: 120,
          status: "transformed",
          tableId: options.transformationNodeTableId,
          generatedByDecisionIds: ["decision-1"],
          relatedTargetKeys: ["entity:entity-student"],
        },
      ],
      edges: [],
    },
  };
}

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

test("Fix Entities bulk applica la scelta raccomandata a tutte le entita forti pending", () => {
  const diagram = createTwoEntityDiagram();
  const workspace = createEmptyLogicalWorkspace(diagram);

  const result = applyBulkLogicalFix(diagram, workspace, "entities");
  const overview = buildLogicalTranslationOverview(diagram, result.workspace);
  const completion = getLogicalTranslationStepCompletion(overview);

  assert.equal(result.appliedCount, 2);
  assert.equal(result.skippedCount, 0);
  assert.equal(result.workspace.model.tables.length, 2);
  assert.equal(completion.entities.pending, 0);
  assert.equal(completion.entities.applied, 2);
  assert.equal(getLogicalTranslationOpenItemCount(overview), 0);
});

test("applicare una decisione rimuove l'oggetto dal conteggio pending", () => {
  const diagram = createTwoEntityDiagram();
  let workspace = createEmptyLogicalWorkspace(diagram);
  let overview = buildLogicalTranslationOverview(diagram, workspace);

  assert.equal(getLogicalTranslationStepCompletion(overview).entities.pending, 2);

  const target = overview.itemsByStep.entities.find((item) => item.id === "entity-a");
  assert.ok(target, "Entity A non trovata nello step entities");

  const choice =
    getLogicalTranslationChoicesForItem(overview, target).find((candidate) => candidate.recommended) ??
    getLogicalTranslationChoicesForItem(overview, target)[0];
  assert.ok(choice, "Nessuna scelta disponibile per entity A");

  workspace = applyLogicalTranslationChoice(diagram, workspace, choice, target.targetType, target.id);
  overview = buildLogicalTranslationOverview(diagram, workspace);

  const completion = getLogicalTranslationStepCompletion(overview);
  assert.equal(completion.entities.pending, 1);
  assert.equal(completion.entities.applied, 1);
  assert.equal(getLogicalTranslationOpenItemCount(overview), 1);
  assert.equal(overview.itemsByStep.entities.find((item) => item.id === "entity-a")?.status, "applied");
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

test("translation rename target: colonna selezionata direttamente", () => {
  const target = findTranslationRenameTarget(
    createRenameWorkspace(),
    { ...EMPTY_LOGICAL_SELECTION_FOR_TEST, columnId: "column-name" },
    null,
  );

  assert.deepEqual(target, {
    kind: "column",
    tableId: "table-student",
    columnId: "column-name",
    currentName: "name",
  });
});

test("translation rename target: tabella selezionata direttamente", () => {
  const target = findTranslationRenameTarget(
    createRenameWorkspace(),
    { ...EMPTY_LOGICAL_SELECTION_FOR_TEST, nodeId: "table-student" },
    null,
  );

  assert.deepEqual(target, {
    kind: "table",
    tableId: "table-student",
    currentName: "student",
  });
});

test("translation rename target: nodo di trasformazione con tableId", () => {
  const target = findTranslationRenameTarget(
    createRenameWorkspace({ transformationNodeTableId: "table-student" }),
    { ...EMPTY_LOGICAL_SELECTION_FOR_TEST, nodeId: "transformation-node-student" },
    null,
  );

  assert.deepEqual(target, {
    kind: "table",
    tableId: "table-student",
    currentName: "student",
  });
});

test("translation rename target: mapping applicato con artifact table", () => {
  const target = findTranslationRenameTarget(
    createRenameWorkspace({ mappingArtifacts: [{ kind: "table", id: "table-student" }] }),
    EMPTY_LOGICAL_SELECTION_FOR_TEST,
    createTranslationItem(),
  );

  assert.deepEqual(target, {
    kind: "table",
    tableId: "table-student",
    currentName: "student",
  });
});

test("translation rename target: mapping applicato con artifact column", () => {
  const target = findTranslationRenameTarget(
    createRenameWorkspace({ mappingArtifacts: [{ kind: "column", id: "column-name" }] }),
    EMPTY_LOGICAL_SELECTION_FOR_TEST,
    createTranslationItem(),
  );

  assert.deepEqual(target, {
    kind: "column",
    tableId: "table-student",
    columnId: "column-name",
    currentName: "name",
  });
});

test("translation rename target: elemento pending senza artifact concreto", () => {
  const target = findTranslationRenameTarget(
    createRenameWorkspace(),
    EMPTY_LOGICAL_SELECTION_FOR_TEST,
    createTranslationItem({ status: "pending", currentDecisionId: undefined }),
  );

  assert.equal(target, null);
});

test("translation rename target: mapping con artifact non rinominabile", () => {
  for (const kind of ["foreignKey", "uniqueConstraint", "edge"] as const) {
    const target = findTranslationRenameTarget(
      createRenameWorkspace({ mappingArtifacts: [{ kind, id: `${kind}-1` }] }),
      EMPTY_LOGICAL_SELECTION_FOR_TEST,
      createTranslationItem(),
    );

    assert.equal(target, null, `${kind} should not be renameable`);
  }
});

test("LogicalTranslationWorkspace translation toolbar no longer wires Rename to a no-op", () => {
  const source = readFileSync(
    new URL("../src/logical/LogicalTranslationWorkspace.tsx", import.meta.url),
    "utf8",
  );

  assert.equal(
    source.includes('renameWithPrompt(t("logical.designer.rename"), selectedTranslationItem.label, () => undefined)'),
    false,
  );
  assert.equal(source.includes("onClick={() => selectedTranslationItem && renameWithPrompt"), false);
});
