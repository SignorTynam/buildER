import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { VersionCompareMode } from "../src/components/versioning/VersionCompareMode.tsx";
import { VersionCompareWorkspaceInstance } from "../src/components/versioning/VersionCompareWorkspaceInstance.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { DEFAULT_LOCALE, setCurrentLocale } from "../src/i18n/index.ts";
import { buildProjectVersionDiff } from "../src/features/versioning/projectVersionDiff.ts";
import {
  buildDiagramVersionHighlights,
  buildLogicalVersionHighlights,
} from "../src/features/versioning/projectVersionVisualDiff.ts";
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

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const VIEWPORT = { x: 0, y: 0, zoom: 1 };

function renderWithI18n(element: React.ReactElement): string {
  return renderToStaticMarkup(<I18nProvider>{element}</I18nProvider>);
}

function createSnapshot(name: string, variant: "base" | "changed" = "base"): ProjectCommitSnapshot {
  const diagram = createEmptyDiagram(name);
  diagram.nodes = [
    { id: "entity-a", type: "entity", label: variant === "base" ? "Cliente" : "Cliente finale", x: 10, y: 20, width: 140, height: 64 },
  ];
  if (variant === "changed") {
    diagram.nodes.push({ id: "entity-b", type: "entity", label: "Ordine", x: 230, y: 20, width: 140, height: 64 });
    diagram.edges = [
      {
        id: "edge-a",
        type: "connector",
        sourceId: "entity-a",
        targetId: "entity-b",
        label: "",
        lineStyle: "solid",
      },
    ];
  }
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  return createProjectCommitSnapshot({
    diagram,
    translationWorkspace,
    logicalWorkspace,
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
    codeDraft: variant,
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

function createScopedSnapshot(label: "base" | "changed"): ProjectCommitSnapshot {
  const state = createProjectFromSchema("Scoped", createEmptySchemaDocument("schema1.erschema"));
  const firstSchemaId = state.project.activeFileId;
  assert.ok(firstSchemaId);
  const secondSchema = createSchemaWorkspaceFile("schema2.erschema", createEmptySchemaDocument("schema2.erschema"));
  const notes = createTextWorkspaceFile("notes.txt", "text", label === "base" ? "prima\nseconda" : "prima\nterza");
  const sql = createTextWorkspaceFile("query.sql", "sql", label === "base" ? "select 1;" : "select 2;");
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
  if (schema1?.kind !== "schema" || schema2?.kind !== "schema") throw new Error("schema missing");
  schema1.schema.diagram.nodes = [
    { id: "schema1-node", type: "entity", label: "Cliente", x: 10, y: 20, width: 140, height: 64 },
  ];
  schema2.schema.diagram.nodes = [
    { id: "schema2-node", type: "entity", label: label === "base" ? "Ordine" : "Ordine riga", x: 30, y: 40, width: 140, height: 64 },
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

function createScopedSnapshotPair(): { base: ProjectCommitSnapshot; changed: ProjectCommitSnapshot } {
  const base = createScopedSnapshot("base");
  const changed = cloneJson(base);
  const schema2 = Object.values(changed.files ?? {}).find((file) => file.name === "schema2.erschema");
  const notes = Object.values(changed.files ?? {}).find((file) => file.name === "notes.txt");
  const sql = Object.values(changed.files ?? {}).find((file) => file.name === "query.sql");
  assert.ok(schema2?.kind === "schema");
  assert.ok(notes?.kind === "text");
  assert.ok(sql?.kind === "sql");
  if (schema2.kind === "schema") {
    schema2.schema.diagram.nodes[0] = {
      ...schema2.schema.diagram.nodes[0],
      label: "Ordine riga",
    };
  }
  if (notes.kind === "text") {
    notes.content = "prima\nterza";
  }
  if (sql.kind === "sql") {
    sql.content = "select 2;";
  }
  return { base, changed };
}

function createVersioning() {
  const snapshot = createSnapshot("Visual base");
  return {
    ...createEmptyProjectVersioningState(),
    headCommitId: "commit-base",
    commits: [
      {
        id: "commit-base",
        parentId: null,
        message: "Schema iniziale",
        createdAt: "2026-06-28T10:00:00.000Z",
        snapshot,
        checksum: "checksum-base",
        stats: {
          entityCount: 1,
          relationshipCount: 0,
          attributeCount: 0,
          edgeCount: 0,
          tableCount: 0,
          warningCount: 0,
          errorCount: 0,
        },
      },
    ],
  };
}

test("VersionCompareMode apre il picker di scope prima del canvas", () => {
  setCurrentLocale("it");
  const versioning = createVersioning();
  const markup = renderWithI18n(
    <VersionCompareMode
      appTitle="buildER"
      appVersion="6.2"
      versioning={versioning}
      currentSnapshot={createSnapshot("Visual changed", "changed")}
      initialLeft={{ kind: "commit", commitId: "commit-base" }}
      initialRight={{ kind: "working-copy" }}
      onExitCompareMode={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="version-compare-mode"/);
  assert.match(markup, /data-testid="version-compare-scope-picker"/);
  assert.match(markup, /Cosa vuoi confrontare\?/);
  assert.doesNotMatch(markup, /data-testid="version-compare-instance-left"/);
  assert.doesNotMatch(markup, /data-testid="version-compare-instance-right"/);
  assert.match(markup, /Esci dal confronto/);
  assert.match(markup, /v6\.2/);
  assert.doesNotMatch(markup, /data-testid="visual-compare-toolbar"/);
  assert.doesNotMatch(markup, /Modalit.+sola lettura/);
  assert.doesNotMatch(markup, /Aggiunti/);
  assert.doesNotMatch(markup, /Rimossi/);
  assert.doesNotMatch(markup, /Modificati/);
  assert.doesNotMatch(markup, /Sincronizza pan\/zoom/);
  assert.doesNotMatch(markup, /Adatta entrambi/);
  assert.doesNotMatch(markup, /Scambia lati/);
  assert.doesNotMatch(markup, /Ripristina sinistra/);
  assert.doesNotMatch(markup, /data-testid="visual-version-compare-dialog"/);
  assert.doesNotMatch(markup, /role="dialog"/);
  assert.doesNotMatch(markup, /aria-modal="true"/);
  assert.doesNotMatch(markup, /studio-modal-backdrop/);
  assert.doesNotMatch(markup, /Nuovo progetto/);
  assert.doesNotMatch(markup, /Apri progetto/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("VersionCompareMode mostra overview progetto e file cliccabili con initialScope project", () => {
  setCurrentLocale("it");
  const { base, changed } = createScopedSnapshotPair();
  const versioning = {
    ...createEmptyProjectVersioningState(),
    headCommitId: "commit-base",
    commits: [
      {
        id: "commit-base",
        parentId: null,
        message: "Base",
        createdAt: "2026-06-28T10:00:00.000Z",
        snapshot: base,
        checksum: "base",
        stats: { entityCount: 2, relationshipCount: 0, attributeCount: 0, edgeCount: 0 },
      },
    ],
  };

  const markup = renderWithI18n(
    <VersionCompareMode
      appTitle="buildER"
      appVersion="6.2"
      versioning={versioning}
      currentSnapshot={changed}
      initialLeft={{ kind: "commit", commitId: "commit-base" }}
      initialRight={{ kind: "working-copy" }}
      initialScope={{ kind: "project" }}
      onExitCompareMode={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="version-compare-project-overview"/);
  assert.match(markup, /schema2\.erschema/);
  assert.match(markup, /notes\.txt/);
  assert.match(markup, /query\.sql/);
  assert.match(markup, /Cambia elemento confrontato/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("VersionCompareMode renderizza diff testuale per file txt e sql", () => {
  setCurrentLocale("it");
  const { base, changed } = createScopedSnapshotPair();
  const notesId = Object.values(changed.files ?? {}).find((file) => file.name === "notes.txt")?.id;
  const sqlId = Object.values(changed.files ?? {}).find((file) => file.name === "query.sql")?.id;
  assert.ok(notesId);
  assert.ok(sqlId);
  const versioning = {
    ...createEmptyProjectVersioningState(),
    headCommitId: "commit-base",
    commits: [
      {
        id: "commit-base",
        parentId: null,
        message: "Base",
        createdAt: "2026-06-28T10:00:00.000Z",
        snapshot: base,
        checksum: "base",
        stats: { entityCount: 2, relationshipCount: 0, attributeCount: 0, edgeCount: 0 },
      },
    ],
  };

  const notesMarkup = renderWithI18n(
    <VersionCompareMode
      appTitle="buildER"
      appVersion="6.2"
      versioning={versioning}
      currentSnapshot={changed}
      initialLeft={{ kind: "commit", commitId: "commit-base" }}
      initialRight={{ kind: "working-copy" }}
      initialScope={{ kind: "file", fileId: notesId, preferredView: "text" }}
      onExitCompareMode={() => undefined}
    />,
  );
  const sqlMarkup = renderWithI18n(
    <VersionCompareMode
      appTitle="buildER"
      appVersion="6.2"
      versioning={versioning}
      currentSnapshot={changed}
      initialLeft={{ kind: "commit", commitId: "commit-base" }}
      initialRight={{ kind: "working-copy" }}
      initialScope={{ kind: "file", fileId: sqlId, preferredView: "sql" }}
      onExitCompareMode={() => undefined}
    />,
  );

  assert.match(notesMarkup, /data-testid="version-compare-text-diff"/);
  assert.match(notesMarkup, /seconda/);
  assert.match(notesMarkup, /terza/);
  assert.match(sqlMarkup, /query\.sql/);
  assert.match(sqlMarkup, /select 1;/);
  assert.match(sqlMarkup, /select 2;/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("VersionCompareMode renderizza schema scoped dal file selezionato", () => {
  setCurrentLocale("it");
  const { base, changed } = createScopedSnapshotPair();
  const schema2Id = Object.values(changed.files ?? {}).find((file) => file.name === "schema2.erschema")?.id;
  assert.ok(schema2Id);
  const versioning = {
    ...createEmptyProjectVersioningState(),
    headCommitId: "commit-base",
    commits: [
      {
        id: "commit-base",
        parentId: null,
        message: "Base",
        createdAt: "2026-06-28T10:00:00.000Z",
        snapshot: base,
        checksum: "base",
        stats: { entityCount: 2, relationshipCount: 0, attributeCount: 0, edgeCount: 0 },
      },
    ],
  };

  const markup = renderWithI18n(
    <VersionCompareMode
      appTitle="buildER"
      appVersion="6.2"
      versioning={versioning}
      currentSnapshot={changed}
      initialLeft={{ kind: "commit", commitId: "commit-base" }}
      initialRight={{ kind: "working-copy" }}
      initialScope={{ kind: "file", fileId: schema2Id, preferredView: "er" }}
      onExitCompareMode={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="version-compare-instance-left"/);
  assert.match(markup, /data-testid="version-compare-instance-right"/);
  assert.match(markup, /ORDINE_RIGA/);
  assert.doesNotMatch(markup, /Cliente finale/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("VersionCompareWorkspaceInstance mantiene viste indipendenti e canvas read-only", () => {
  setCurrentLocale("it");
  const snapshot = createSnapshot("Visual pane");
  const diff = buildProjectVersionDiff(snapshot, createSnapshot("Visual pane changed", "changed"));
  const markup = renderWithI18n(
    <div>
      <VersionCompareWorkspaceInstance
        side="left"
        resolved={{ ref: { kind: "working-copy" }, label: "Working copy", snapshot, readonly: true }}
        viewMode="logical"
        diagramHighlights={buildDiagramVersionHighlights(diff, "left")}
        logicalHighlights={buildLogicalVersionHighlights(diff, "left")}
        onViewModeChange={() => undefined}
      />
      <VersionCompareWorkspaceInstance
        side="right"
        resolved={{ ref: { kind: "working-copy" }, label: "Working copy", snapshot, readonly: true }}
        viewMode="er"
        diagramHighlights={buildDiagramVersionHighlights(diff, "right")}
        logicalHighlights={buildLogicalVersionHighlights(diff, "right")}
        onViewModeChange={() => undefined}
      />
    </div>,
  );

  assert.match(markup, /Vista Logica non salvata in questa versione/);
  assert.match(markup, /data-testid="version-compare-instance-left"/);
  assert.match(markup, /data-testid="version-compare-instance-right"/);
  assert.match(markup, /designer-workspace/);
  assert.match(markup, /designer-canvas-region/);
  assert.match(markup, /class="diagram-canvas" data-readonly="true"/);
  assert.doesNotMatch(markup, /designer-toolbar/);
  setCurrentLocale(DEFAULT_LOCALE);
});
