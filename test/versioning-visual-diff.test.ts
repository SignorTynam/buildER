import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDiagramVersionHighlights,
  buildLogicalVersionHighlights,
  buildVersionCompareScopeOptions,
  buildVersionCompareVisualModel,
  createSnapshotForSchemaFile,
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
import {
  addProjectFile,
  createEmptySchemaDocument,
  createProjectFromSchema,
  createSchemaWorkspaceFile,
  createTextWorkspaceFile,
} from "../src/utils/projectExplorer.ts";
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

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createProjectSnapshot(label: "left" | "right"): ProjectCommitSnapshot {
  const state = createProjectFromSchema("Scoped project", createEmptySchemaDocument("schema1.erschema"));
  const firstSchemaId = state.project.activeFileId;
  assert.ok(firstSchemaId);
  const secondSchema = createSchemaWorkspaceFile("schema2.erschema", createEmptySchemaDocument("schema2.erschema"));
  const notes = createTextWorkspaceFile("notes.txt", "text", label === "left" ? "alpha\nbeta" : "alpha\ngamma");
  const sql = createTextWorkspaceFile("query.sql", "sql", label === "left" ? "select 1;" : "select 2;");
  const withSecond = addProjectFile(state, state.project.rootId, secondSchema);
  assert.equal(withSecond.ok, true);
  if (!withSecond.ok) throw new Error("schema2 not added");
  const withNotes = addProjectFile(withSecond.state, withSecond.state.project.rootId, notes);
  assert.equal(withNotes.ok, true);
  if (!withNotes.ok) throw new Error("notes not added");
  const withSql = addProjectFile(withNotes.state, withNotes.state.project.rootId, sql);
  assert.equal(withSql.ok, true);
  if (!withSql.ok) throw new Error("sql not added");

  const files = cloneJson(withSql.state.files);
  const schema1 = files[firstSchemaId];
  const schema2 = files[secondSchema.id];
  assert.equal(schema1?.kind, "schema");
  assert.equal(schema2?.kind, "schema");
  if (schema1?.kind !== "schema" || schema2?.kind !== "schema") throw new Error("schemas missing");
  schema1.schema.diagram.nodes = [
    { id: "schema1-node", type: "entity", label: "Schema one", x: 10, y: 20, width: 140, height: 64 },
  ];
  schema2.schema.diagram.nodes = [
    {
      id: "schema2-node",
      type: "entity",
      label: label === "left" ? "Invoice" : "Invoice row",
      x: label === "left" ? 20 : 120,
      y: 30,
      width: 140,
      height: 64,
    },
  ];
  const activeDiagram = schema1.schema.diagram;

  return createProjectCommitSnapshot({
    project: { ...withSql.state.project, activeFileId: firstSchemaId },
    files,
    explorerView: { ...withSql.state.view, activeFileId: firstSchemaId },
    activeFileId: firstSchemaId,
    activeWorkspace: {
      diagramView: "er",
      viewport: VIEWPORT,
      translationViewport: VIEWPORT,
      logicalViewport: VIEWPORT,
      selection: { nodeIds: [], edgeIds: [] },
      translationSelection: { nodeIds: [], edgeIds: [] },
      logicalSelection: { nodeId: null, columnId: null, edgeId: null },
      codeDraft: "",
      codeDirty: false,
      showDiagnostics: true,
    },
    diagram: activeDiagram,
    translationWorkspace: createEmptyErTranslationWorkspace(activeDiagram),
    logicalWorkspace: createEmptyLogicalWorkspace(activeDiagram),
    logicalGenerated: false,
    logicalStage: "translation",
    diagramView: "er",
    tool: "select",
    mode: "edit",
    viewport: VIEWPORT,
    selection: { nodeIds: [], edgeIds: [] },
    translationViewport: VIEWPORT,
    translationSelection: { nodeIds: [], edgeIds: [] },
    logicalViewport: VIEWPORT,
    logicalSelection: { nodeId: null, columnId: null, edgeId: null },
    codeDraft: "",
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

function createProjectSnapshotPair(): { left: ProjectCommitSnapshot; right: ProjectCommitSnapshot } {
  const left = createProjectSnapshot("left");
  const right = cloneJson(left);
  const schema2 = Object.values(right.files ?? {}).find((file) => file.name === "schema2.erschema");
  const notes = Object.values(right.files ?? {}).find((file) => file.name === "notes.txt");
  const sql = Object.values(right.files ?? {}).find((file) => file.name === "query.sql");
  assert.ok(schema2?.kind === "schema");
  assert.ok(notes?.kind === "text");
  assert.ok(sql?.kind === "sql");
  if (schema2.kind === "schema") {
    schema2.schema.diagram.nodes[0] = {
      ...schema2.schema.diagram.nodes[0],
      label: "Invoice row",
      x: 120,
    };
  }
  if (notes.kind === "text") {
    notes.content = "alpha\ngamma";
  }
  if (sql.kind === "sql") {
    sql.content = "select 2;";
  }
  return { left, right };
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

test("scope options elencano piu file modificati con stato e tipo", () => {
  const { left, right } = createProjectSnapshotPair();

  const options = buildVersionCompareScopeOptions(left, right);
  const fileOptions = options.filter((option) => option.kind === "file");

  assert.ok(options.some((option) => option.kind === "project"));
  assert.equal(fileOptions.length, 3);
  assert.ok(fileOptions.some((option) => option.kind === "file" && option.file.name === "schema2.erschema" && option.file.status === "modified"));
  assert.ok(fileOptions.some((option) => option.kind === "file" && option.file.name === "notes.txt" && option.file.kind === "text"));
  assert.ok(fileOptions.some((option) => option.kind === "file" && option.file.name === "query.sql" && option.file.kind === "sql"));
});

test("compare schema scoped usa il diagramma del file scelto e non snapshot.diagram globale", () => {
  const { left, right } = createProjectSnapshotPair();
  const schema2 = Object.values(right.files ?? {}).find((file) => file.name === "schema2.erschema");
  assert.ok(schema2?.kind === "schema");
  const versioning = {
    ...createEmptyProjectVersioningState(),
    headCommitId: "commit-left",
    commits: [
      {
        id: "commit-left",
        parentId: null,
        message: "Left",
        createdAt: "2026-06-28T10:00:00.000Z",
        snapshot: left,
        checksum: "left",
        stats: { entityCount: 1, relationshipCount: 0, attributeCount: 0, edgeCount: 0 },
      },
    ],
  };

  const result = buildVersionCompareVisualModel(
    versioning,
    right,
    { kind: "commit", commitId: "commit-left" },
    { kind: "working-copy" },
    { kind: "file", fileId: schema2.id, preferredView: "er" },
  );

  assert.equal(result.status, "ok");
  if (result.status !== "ok") return;
  assert.equal(result.model.right.snapshot.diagram.nodes[0]?.label, "INVOICE_ROW");
  assert.notEqual(result.model.right.snapshot.diagram.nodes[0]?.id, right.diagram.nodes[0]?.id);
  assert.ok(result.model.highlights.right.diagram.modifiedNodeIds.includes(result.model.right.snapshot.diagram.nodes[0]?.id ?? ""));
});

test("scope options gestiscono file aggiunti cancellati e rinominati", () => {
  const left = createProjectSnapshot("left");
  const right = cloneJson(left);
  const notesId = Object.values(right.files ?? {}).find((file) => file.name === "notes.txt")?.id;
  const sqlId = Object.values(left.files ?? {}).find((file) => file.name === "query.sql")?.id;
  const schema2 = Object.values(right.files ?? {}).find((file) => file.name === "schema2.erschema");
  assert.ok(notesId);
  assert.ok(sqlId);
  assert.ok(schema2);
  delete (left.files ?? {})[notesId];
  delete (right.files ?? {})[sqlId];
  const schemaNode = right.project?.fileTree.find((node) => node.fileId === schema2.id);
  assert.ok(schemaNode);
  if (schemaNode) schemaNode.name = "schema2-renamed.erschema";
  if (right.files?.[schema2.id]) right.files[schema2.id].name = "schema2-renamed.erschema";

  const fileOptions = buildVersionCompareScopeOptions(left, right, { includeUnchanged: true }).filter((option) => option.kind === "file");

  assert.ok(fileOptions.some((option) => option.kind === "file" && option.file.fileId === notesId && option.file.status === "added"));
  assert.ok(fileOptions.some((option) => option.kind === "file" && option.file.fileId === sqlId && option.file.status === "deleted"));
  assert.ok(fileOptions.some((option) => option.kind === "file" && option.file.fileId === schema2.id && option.file.status === "renamed"));
});

test("legacy snapshot senza project/files espone fallback diagramma", () => {
  const options = buildVersionCompareScopeOptions(createSnapshot("left"), createSnapshot("right"));

  assert.deepEqual(options, [{ kind: "legacy-diagram", changed: true }]);
});

test("createSnapshotForSchemaFile copia viste e workspace dal file schema", () => {
  const { right: snapshot } = createProjectSnapshotPair();
  const schema2 = Object.values(snapshot.files ?? {}).find((file) => file.name === "schema2.erschema");
  assert.ok(schema2?.kind === "schema");
  if (schema2.kind !== "schema") return;

  const scoped = createSnapshotForSchemaFile(snapshot, schema2);

  assert.equal(scoped.diagram.nodes[0]?.label, "INVOICE_ROW");
  assert.equal(scoped.project, undefined);
  assert.equal(scoped.files, undefined);
});
