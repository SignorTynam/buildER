import assert from "node:assert/strict";
import test from "node:test";

import type { ProjectCommitSnapshotInput } from "../src/features/versioning/projectCommitSnapshot.ts";
import type { LogicalIssue, LogicalTable } from "../src/types/logical.ts";
import { createEmptyDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import {
  areProjectCommitSnapshotsEqual,
  buildProjectCommitDraft,
  buildProjectCommitStats,
  calculateProjectCommitSnapshotChecksum,
  cloneProjectCommitSnapshot,
  createProjectCommitSnapshot,
  normalizeProjectCommitSnapshot,
} from "../src/features/versioning/projectCommitSnapshot.ts";

const DEFAULT_VIEWPORT = { x: 180, y: 110, zoom: 1 };

function createLogicalTable(id: string): LogicalTable {
  return {
    id,
    name: id,
    kind: "entity",
    columns: [],
    x: 20,
    y: 30,
    width: 180,
    height: 96,
  };
}

function createLogicalIssue(id: string, level: LogicalIssue["level"]): LogicalIssue {
  return {
    id,
    level,
    code: level === "warning" ? "ENTITY_WITHOUT_PK" : "INVALID_TRANSFORMATION",
    message: id,
  };
}

function createSnapshotInput(): ProjectCommitSnapshotInput {
  const diagram = createEmptyDiagram("Snapshot completo");
  diagram.nodes = [
    { id: "entity-a", type: "entity", label: "A", x: 10, y: 20, width: 140, height: 64 },
    { id: "rel-a", type: "relationship", label: "R", x: 260, y: 20, width: 130, height: 78 },
    { id: "attr-a", type: "attribute", label: "name", x: 10, y: 140, width: 120, height: 48 },
  ];
  diagram.edges = [
    {
      id: "edge-a",
      type: "connector",
      sourceId: "entity-a",
      targetId: "rel-a",
      label: "",
      lineStyle: "solid",
    },
    {
      id: "edge-attr",
      type: "attribute",
      sourceId: "entity-a",
      targetId: "attr-a",
      label: "",
      lineStyle: "solid",
    },
  ];
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  logicalWorkspace.model.tables = [createLogicalTable("table-a")];
  logicalWorkspace.model.issues = [
    createLogicalIssue("warning-a", "warning"),
    createLogicalIssue("error-a", "error"),
  ];

  return {
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: true,
    logicalStage: "schema",
    diagramView: "logical",
    tool: "connector",
    mode: "edit",
    viewport: { x: 42, y: -18, zoom: 1.35 },
    selection: { nodeIds: ["entity-a"], edgeIds: ["edge-a"] },
    translationViewport: { x: 64, y: 24, zoom: 0.92 },
    translationSelection: { nodeIds: ["rel-a"], edgeIds: [] },
    logicalViewport: { x: -120, y: 88, zoom: 0.75 },
    logicalSelection: { nodeId: "table-a", columnId: null, edgeId: null },
    codeDraft: "entity A",
    codeDirty: true,
    technicalPanelOpen: true,
    technicalPanelTab: "notes",
    codePanelOpen: true,
    codePanelWidth: 344,
    notesPanelOpen: true,
    notesPanelWidth: 332,
    toolbarCollapsed: true,
    focusMode: true,
    toolbarWidth: 216,
    showDiagnostics: false,
    workspaceInfo: { source: "test" },
  };
}

test("createProjectCommitSnapshot include tutti i campi workspace richiesti", () => {
  const snapshot = createProjectCommitSnapshot(createSnapshotInput());

  assert.equal(snapshot.diagram.meta.name, "Snapshot completo");
  assert.equal(snapshot.translationWorkspace.translatedDiagram.meta.name, "Snapshot completo");
  assert.equal(snapshot.logicalWorkspace.model.tables.length, 1);
  assert.equal(snapshot.logicalGenerated, true);
  assert.equal(snapshot.logicalStage, "schema");
  assert.equal(snapshot.diagramView, "logical");
  assert.equal(snapshot.tool, "connector");
  assert.equal(snapshot.mode, "edit");
  assert.deepEqual(snapshot.selection, { nodeIds: ["entity-a"], edgeIds: ["edge-a"] });
  assert.deepEqual(snapshot.logicalSelection, { nodeId: "table-a", columnId: null, edgeId: null });
  assert.equal(snapshot.codeDraft, "entity A");
  assert.equal(snapshot.codeDirty, true);
  assert.equal(snapshot.technicalPanelOpen, true);
  assert.equal(snapshot.technicalPanelTab, "notes");
  assert.equal(snapshot.codePanelOpen, true);
  assert.equal(snapshot.codePanelWidth, 344);
  assert.equal(snapshot.notesPanelOpen, true);
  assert.equal(snapshot.notesPanelWidth, 332);
  assert.equal(snapshot.toolbarCollapsed, true);
  assert.equal(snapshot.focusMode, true);
  assert.equal(snapshot.toolbarWidth, 216);
  assert.equal(snapshot.showDiagnostics, false);
  assert.deepEqual(snapshot.viewport, { x: 42, y: -18, zoom: 1.35 });
  assert.equal(snapshot.diagram.nodes[0]?.x, 10);
});

test("createProjectCommitSnapshot e cloneProjectCommitSnapshot non mantengono riferimenti mutabili", () => {
  const input = createSnapshotInput();
  const snapshot = createProjectCommitSnapshot(input);

  input.diagram.nodes[0]!.label = "Mutata";
  input.selection.nodeIds.push("entity-b");
  input.logicalWorkspace.model.tables[0]!.x = 999;

  assert.equal(snapshot.diagram.nodes[0]?.label, "A");
  assert.deepEqual(snapshot.selection.nodeIds, ["entity-a"]);
  assert.equal(snapshot.logicalWorkspace.model.tables[0]?.x, 20);

  const cloned = cloneProjectCommitSnapshot(snapshot);
  cloned.diagram.nodes[0]!.label = "Clone mutato";
  cloned.logicalSelection.nodeId = "other-table";

  assert.equal(snapshot.diagram.nodes[0]?.label, "A");
  assert.equal(snapshot.logicalSelection.nodeId, "table-a");
});

test("normalizeProjectCommitSnapshot applica fallback coerenti", () => {
  const input = createSnapshotInput();
  const normalized = normalizeProjectCommitSnapshot({
    ...input,
    logicalGenerated: false,
    logicalStage: "schema",
    diagramView: "logical",
    tool: "bad-tool",
    mode: "bad-mode",
    viewport: { x: "bad", y: 1, zoom: -1 },
    selection: { nodeIds: ["b", "a", "a", 3], edgeIds: [false, "edge-a"] },
    translationViewport: null,
    translationSelection: null,
    logicalViewport: { x: Number.NaN, y: 2, zoom: 0 },
    logicalSelection: { tableId: "legacy-table", columnId: 4, edgeId: "edge-l" },
    codeDraft: 12,
    codeDirty: "yes",
    technicalPanelOpen: "yes",
    technicalPanelTab: "bad-tab",
    codePanelOpen: "yes",
    codePanelWidth: -1,
    notesPanelOpen: "yes",
    notesPanelWidth: Number.POSITIVE_INFINITY,
    toolbarCollapsed: "yes",
    focusMode: "yes",
    toolbarWidth: 0,
    showDiagnostics: "no",
  }, {
    fallbackViewport: DEFAULT_VIEWPORT,
  });

  assert.ok(normalized);
  assert.equal(normalized.logicalStage, "translation");
  assert.equal(normalized.diagramView, "er");
  assert.equal(normalized.tool, "select");
  assert.equal(normalized.mode, "edit");
  assert.deepEqual(normalized.viewport, { x: 180, y: 1, zoom: 1 });
  assert.deepEqual(normalized.selection, { nodeIds: ["a", "b"], edgeIds: ["edge-a"] });
  assert.deepEqual(normalized.translationViewport, DEFAULT_VIEWPORT);
  assert.deepEqual(normalized.translationSelection, { nodeIds: [], edgeIds: [] });
  assert.deepEqual(normalized.logicalViewport, { x: 180, y: 2, zoom: 1 });
  assert.deepEqual(normalized.logicalSelection, { nodeId: "legacy-table", columnId: null, edgeId: "edge-l" });
  assert.equal(normalized.codeDraft, "");
  assert.equal(normalized.codeDirty, false);
  assert.equal(normalized.technicalPanelOpen, false);
  assert.equal(normalized.technicalPanelTab, "review");
  assert.equal(normalized.codePanelOpen, false);
  assert.ok(normalized.codePanelWidth > 0);
  assert.equal(normalized.notesPanelOpen, false);
  assert.ok(normalized.notesPanelWidth > 0);
  assert.equal(normalized.toolbarCollapsed, false);
  assert.equal(normalized.focusMode, false);
  assert.ok(normalized.toolbarWidth > 0);
  assert.equal(normalized.showDiagnostics, true);
});

test("checksum snapshot cambia per contenuti, layout, codice dirty e workspace logico ma ignora UI session", async () => {
  const snapshot = createProjectCommitSnapshot(createSnapshotInput());
  const same = cloneProjectCommitSnapshot(snapshot);

  assert.equal(
    await calculateProjectCommitSnapshotChecksum(snapshot),
    await calculateProjectCommitSnapshotChecksum(same),
  );
  assert.equal(areProjectCommitSnapshotsEqual(snapshot, same), true);

  const relabeled = cloneProjectCommitSnapshot(snapshot);
  relabeled.diagram.nodes[0]!.label = "B";
  assert.notEqual(
    await calculateProjectCommitSnapshotChecksum(snapshot),
    await calculateProjectCommitSnapshotChecksum(relabeled),
  );

  const moved = cloneProjectCommitSnapshot(snapshot);
  moved.diagram.nodes[0]!.x += 1;
  assert.notEqual(
    await calculateProjectCommitSnapshotChecksum(snapshot),
    await calculateProjectCommitSnapshotChecksum(moved),
  );

  const viewportChanged = cloneProjectCommitSnapshot(snapshot);
  viewportChanged.viewport.x += 1;
  assert.equal(
    await calculateProjectCommitSnapshotChecksum(snapshot),
    await calculateProjectCommitSnapshotChecksum(viewportChanged),
  );

  const codeChanged = cloneProjectCommitSnapshot(snapshot);
  codeChanged.codeDraft = "entity B";
  assert.notEqual(
    await calculateProjectCommitSnapshotChecksum(snapshot),
    await calculateProjectCommitSnapshotChecksum(codeChanged),
  );

  const panelChanged = cloneProjectCommitSnapshot(snapshot);
  panelChanged.codePanelOpen = !panelChanged.codePanelOpen;
  panelChanged.codePanelWidth += 1;
  assert.equal(
    await calculateProjectCommitSnapshotChecksum(snapshot),
    await calculateProjectCommitSnapshotChecksum(panelChanged),
  );

  const logicalChanged = cloneProjectCommitSnapshot(snapshot);
  logicalChanged.logicalWorkspace.model.tables.push(createLogicalTable("table-b"));
  assert.notEqual(
    await calculateProjectCommitSnapshotChecksum(snapshot),
    await calculateProjectCommitSnapshotChecksum(logicalChanged),
  );
  assert.equal(areProjectCommitSnapshotsEqual(snapshot, logicalChanged), false);
});

test("buildProjectCommitStats calcola conteggi ER e logici", () => {
  const snapshot = createProjectCommitSnapshot(createSnapshotInput());
  const stats = buildProjectCommitStats(snapshot);

  assert.deepEqual(stats, {
    entityCount: 1,
    relationshipCount: 1,
    attributeCount: 1,
    edgeCount: 2,
    tableCount: 1,
    warningCount: 1,
    errorCount: 1,
  });
});

test("buildProjectCommitDraft prepara un commit valido con snapshot clonato", async () => {
  const snapshot = createProjectCommitSnapshot(createSnapshotInput());
  const commit = await buildProjectCommitDraft({
    id: "commit-test",
    parentId: "parent-test",
    message: "Snapshot",
    description: "Draft commit",
    createdAt: "2026-06-26T12:00:00.000Z",
    author: "buildER",
    snapshot,
    automatic: true,
    tags: ["beta", "beta", "alpha"],
  });

  snapshot.diagram.nodes[0]!.label = "Mutata dopo commit";

  assert.equal(commit.id, "commit-test");
  assert.equal(commit.parentId, "parent-test");
  assert.equal(commit.message, "Snapshot");
  assert.equal(commit.description, "Draft commit");
  assert.equal(commit.createdAt, "2026-06-26T12:00:00.000Z");
  assert.equal(commit.author, "buildER");
  assert.equal(commit.automatic, true);
  assert.deepEqual(commit.tags, ["alpha", "beta"]);
  assert.equal(commit.snapshot.diagram.nodes[0]?.label, "A");
  assert.equal(commit.checksum.length > 0, true);
  assert.equal(commit.stats.entityCount, 1);
});
