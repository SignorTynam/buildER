import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDiagramVersionHighlights,
  buildLogicalVersionHighlights,
  buildVersionCompareVisualModel,
  getSnapshotViewPayload,
  hasSnapshotLogicalWork,
  hasSnapshotTranslationWork,
} from "../src/features/versioning/projectVersionVisualDiff.ts";
import { buildProjectVersionDiff } from "../src/features/versioning/projectVersionDiff.ts";
import { createProjectCommitSnapshot, type ProjectCommitSnapshot } from "../src/features/versioning/projectCommitSnapshot.ts";
import { createEmptyDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import { createEmptyProjectVersioningState } from "../src/utils/projectFile.ts";
import type { LogicalWorkspaceDocument } from "../src/types/logical.ts";

const VIEWPORT = { x: 0, y: 0, zoom: 1 };

function createLogicalWorkspace(label: "left" | "right"): LogicalWorkspaceDocument {
  const diagram = createEmptyDiagram(`logical-${label}`);
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const workspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  workspace.model.tables = [
    {
      id: "table-a",
      name: label === "left" ? "Cliente" : "ClienteFinale",
      kind: "entity",
      columns: [
        {
          id: "column-a",
          name: label === "left" ? "id" : "id_cliente",
          isPrimaryKey: true,
          isForeignKey: false,
          isNullable: false,
          references: [],
        },
      ],
      x: 10,
      y: 20,
      width: 180,
      height: 96,
    },
  ];

  if (label === "left") {
    workspace.model.tables.push({
      id: "table-removed",
      name: "Vecchia",
      kind: "entity",
      columns: [
        {
          id: "column-removed",
          name: "legacy",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: true,
          references: [],
        },
      ],
      x: 240,
      y: 20,
      width: 160,
      height: 96,
    });
    workspace.model.foreignKeys = [
      {
        id: "fk-a",
        name: "fk_old",
        fromTableId: "table-a",
        toTableId: "table-removed",
        mappings: [{ fromColumnId: "column-a", toColumnId: "column-removed" }],
        required: true,
      },
    ];
  } else {
    workspace.model.tables.push({
      id: "table-added",
      name: "Ordine",
      kind: "entity",
      columns: [
        {
          id: "column-added",
          name: "id",
          isPrimaryKey: true,
          isForeignKey: false,
          isNullable: false,
          references: [],
        },
      ],
      x: 260,
      y: 40,
      width: 160,
      height: 96,
    });
    workspace.model.foreignKeys = [
      {
        id: "fk-a",
        name: "fk_new",
        fromTableId: "table-added",
        toTableId: "table-a",
        mappings: [{ fromColumnId: "column-added", toColumnId: "column-a" }],
        required: false,
      },
      {
        id: "fk-added",
        name: "fk_added",
        fromTableId: "table-added",
        toTableId: "table-a",
        mappings: [{ fromColumnId: "column-added", toColumnId: "column-a" }],
        required: true,
      },
    ];
  }
  workspace.model.edges = workspace.model.foreignKeys.map((foreignKey) => ({
    id: `edge-${foreignKey.id}`,
    foreignKeyId: foreignKey.id,
    fromTableId: foreignKey.fromTableId,
    toTableId: foreignKey.toTableId,
    label: foreignKey.name,
  }));

  return workspace;
}

function createSnapshot(label: "left" | "right"): ProjectCommitSnapshot {
  const diagram = createEmptyDiagram(`visual-${label}`);
  diagram.nodes = [
    {
      id: "entity-a",
      type: "entity",
      label: label === "left" ? "Cliente" : "Cliente finale",
      x: label === "left" ? 10 : 80,
      y: 20,
      width: label === "left" ? 140 : 180,
      height: 64,
    },
    {
      id: "attribute-removed",
      type: "attribute",
      label: "Legacy",
      x: 20,
      y: 140,
      width: 100,
      height: 48,
    },
    {
      id: "relationship-stable",
      type: "relationship",
      label: "Iscrizione",
      x: label === "left" ? 460 : 500,
      y: 140,
      width: label === "left" ? 96 : 120,
      height: 64,
    },
  ];
  if (label === "right") {
    diagram.nodes = diagram.nodes.filter((node) => node.id !== "attribute-removed");
    diagram.nodes.push({ id: "entity-added", type: "entity", label: "Ordine", x: 260, y: 20, width: 140, height: 64 });
  }
  diagram.edges = [
    {
      id: "edge-a",
      type: label === "left" ? "attribute" : "connector",
      sourceId: "entity-a",
      targetId: label === "left" ? "attribute-removed" : "entity-added",
      label: label === "left" ? "" : "nuovo",
      lineStyle: "solid",
      manualOffset: label === "left" ? 0 : 18,
    },
  ];
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);

  return createProjectCommitSnapshot({
    diagram,
    translationWorkspace,
    logicalWorkspace: createLogicalWorkspace(label),
    logicalGenerated: true,
    logicalStage: "schema",
    diagramView: "er",
    tool: "select",
    mode: "edit",
    viewport: VIEWPORT,
    selection: { nodeIds: [], edgeIds: [] },
    translationViewport: VIEWPORT,
    translationSelection: { nodeIds: [], edgeIds: [] },
    logicalViewport: VIEWPORT,
    logicalSelection: { nodeId: null, columnId: null, edgeId: null },
    codeDraft: label,
    codeDirty: false,
    technicalPanelOpen: false,
    technicalPanelTab: "review",
    codePanelOpen: false,
    codePanelWidth: 320,
    notesPanelOpen: false,
    notesPanelWidth: 320,
    toolbarCollapsed: false,
    focusMode: false,
    toolbarWidth: 208,
    showDiagnostics: true,
  });
}

test("visual diff produce highlight ER per aggiunti, rimossi, modificati e layout", () => {
  const left = createSnapshot("left");
  const right = createSnapshot("right");
  const diff = buildProjectVersionDiff(left, right);
  const addedEntityId = right.diagram.nodes.find((node) => node.label === "ORDINE")?.id;
  const removedAttributeId = left.diagram.nodes.find((node) => node.label === "Legacy")?.id;
  const leftEntityId = left.diagram.nodes.find((node) => node.label === "CLIENTE")?.id;
  const rightEntityId = right.diagram.nodes.find((node) => node.label === "CLIENTE_FINALE")?.id;
  const layoutNodeId = left.diagram.nodes.find((node) => node.label === "ISCRIZIONE")?.id;

  const leftHighlights = buildDiagramVersionHighlights(diff, "left");
  const rightHighlights = buildDiagramVersionHighlights(diff, "right");

  assert.ok(addedEntityId);
  assert.deepEqual(rightHighlights.addedNodeIds, [addedEntityId]);
  assert.ok(removedAttributeId);
  assert.deepEqual(leftHighlights.removedNodeIds, [removedAttributeId]);
  assert.ok(leftEntityId);
  assert.ok(rightEntityId);
  assert.ok(leftHighlights.modifiedNodeIds.includes(leftEntityId));
  assert.ok(rightHighlights.modifiedNodeIds.includes(rightEntityId));
  assert.ok(layoutNodeId);
  assert.ok(leftHighlights.layoutNodeIds.includes(layoutNodeId));
  assert.ok(rightHighlights.layoutNodeIds.includes(layoutNodeId));
  assert.ok(leftHighlights.layoutEdgeIds.includes("edge-a"));
  assert.ok(rightHighlights.layoutEdgeIds.includes("edge-a"));
});

test("visual diff produce highlight logici per tabelle, colonne e foreign key", () => {
  const diff = buildProjectVersionDiff(createSnapshot("left"), createSnapshot("right"));

  const leftHighlights = buildLogicalVersionHighlights(diff, "left");
  const rightHighlights = buildLogicalVersionHighlights(diff, "right");

  assert.ok(rightHighlights.addedTableIds.includes("table-added"));
  assert.ok(rightHighlights.addedColumnIds.includes("table-added.column-added"));
  assert.ok(rightHighlights.addedForeignKeyIds.includes("fk-added"));
  assert.ok(leftHighlights.removedTableIds.includes("table-removed"));
  assert.ok(leftHighlights.removedColumnIds.includes("table-removed.column-removed"));
  assert.ok(leftHighlights.modifiedTableIds.includes("table-a"));
  assert.ok(rightHighlights.modifiedColumnIds.includes("table-a.column-a"));
  assert.ok(leftHighlights.modifiedForeignKeyIds.includes("fk-a"));
  assert.ok(rightHighlights.modifiedForeignKeyIds.includes("fk-a"));
});

test("visual compare risolve commit e working copy senza mutare gli snapshot", () => {
  const left = createSnapshot("left");
  const right = createSnapshot("right");
  const beforeLeft = JSON.stringify(left);
  const beforeRight = JSON.stringify(right);
  const versioning = {
    ...createEmptyProjectVersioningState(),
    headCommitId: "commit-left",
    commits: [
      {
        id: "commit-left",
        parentId: null,
        message: "Schema iniziale",
        createdAt: "2026-06-28T10:00:00.000Z",
        snapshot: left,
        checksum: "checksum-left",
        stats: {
          entityCount: 2,
          relationshipCount: 0,
          attributeCount: 0,
          edgeCount: 1,
          tableCount: 2,
          warningCount: 0,
          errorCount: 0,
        },
      },
    ],
  };

  const result = buildVersionCompareVisualModel(
    versioning,
    right,
    { kind: "commit", commitId: "commit-left" },
    { kind: "working-copy" },
  );

  assert.equal(result.status, "ok");
  if (result.status === "ok") {
    const addedEntityId = right.diagram.nodes.find((node) => node.label === "ORDINE")?.id;
    assert.equal(result.model.left.commitId, "commit-left");
    assert.equal(result.model.right.ref.kind, "working-copy");
    assert.ok(addedEntityId);
    assert.ok(result.model.highlights.right.diagram.addedNodeIds.includes(addedEntityId));
  }
  assert.equal(JSON.stringify(left), beforeLeft);
  assert.equal(JSON.stringify(right), beforeRight);
});

test("getSnapshotViewPayload non mostra viste traduzione fallback non salvate", () => {
  const snapshot = createSnapshot("right");
  const erPayload = getSnapshotViewPayload(snapshot, "er");
  const translationPayload = getSnapshotViewPayload(snapshot, "translation");
  const logicalPayload = getSnapshotViewPayload(snapshot, "logical");

  assert.equal(erPayload.mode, "er");
  assert.equal(translationPayload.mode, "unavailable");
  assert.equal(translationPayload.viewMode, "translation");
  assert.equal(logicalPayload.mode, "logical");
  if (erPayload.mode === "er") {
    erPayload.diagram.meta.name = "mutated";
  }
  assert.equal(snapshot.diagram.meta.name, "visual-right");
});

test("visual compare distingue viste traduzione e logico realmente salvate da fallback vuoti", () => {
  const fallback = createSnapshot("right");
  const withTranslation = createSnapshot("right");
  const withLogical = createSnapshot("right");

  withTranslation.diagramView = "translation";
  withLogical.logicalGenerated = true;
  withLogical.logicalWorkspace.model.tables = [
    {
      id: "saved-table",
      name: "Cliente",
      kind: "entity",
      columns: [],
      x: 0,
      y: 0,
      width: 160,
      height: 96,
    },
  ];

  assert.equal(hasSnapshotTranslationWork(fallback), false);
  assert.equal(hasSnapshotLogicalWork(fallback), true);
  assert.equal(hasSnapshotTranslationWork(withTranslation), true);
  assert.equal(hasSnapshotLogicalWork(withLogical), true);

  const translationPayload = getSnapshotViewPayload(withTranslation, "translation");
  const logicalPayload = getSnapshotViewPayload(withLogical, "logical");
  assert.equal(translationPayload.mode, "translation");
  assert.equal(logicalPayload.mode, "logical");
});
