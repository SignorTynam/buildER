import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { VersionCompareChangeDrawer } from "../src/components/versioning/VersionCompareChangeDrawer.tsx";
import { VersionComparePane } from "../src/components/versioning/VersionComparePane.tsx";
import { VisualVersionCompareDialog } from "../src/components/versioning/VisualVersionCompareDialog.tsx";
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

test("VisualVersionCompareDialog mostra due pannelli e toolbar premium", () => {
  setCurrentLocale("it");
  const versioning = createVersioning();
  const markup = renderWithI18n(
    <VisualVersionCompareDialog
      open
      versioning={versioning}
      currentSnapshot={createSnapshot("Visual changed", "changed")}
      initialLeft={{ kind: "commit", commitId: "commit-base" }}
      initialRight={{ kind: "working-copy" }}
      onClose={() => undefined}
      onRestoreCommit={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="visual-version-compare-dialog"/);
  assert.match(markup, /Confronto visuale versioni/);
  assert.match(markup, /data-testid="visual-compare-pane-left"/);
  assert.match(markup, /data-testid="visual-compare-pane-right"/);
  assert.match(markup, /Sincronizza pan\/zoom/);
  assert.match(markup, /Adatta entrambi/);
  assert.match(markup, /Scambia lati/);
  assert.match(markup, /Apri dettagli/);
  assert.match(markup, /Ripristina sinistra/);
  assert.doesNotMatch(markup, /Ripristina destra/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("VersionComparePane supporta viste indipendenti ER e logico", () => {
  setCurrentLocale("it");
  const snapshot = createSnapshot("Visual pane");
  const diff = buildProjectVersionDiff(snapshot, createSnapshot("Visual pane changed", "changed"));
  const markup = renderWithI18n(
    <div>
      <VersionComparePane
        side="left"
        resolved={{ ref: { kind: "working-copy" }, label: "Working copy", snapshot, readonly: true }}
        viewMode="logical"
        diagramHighlights={buildDiagramVersionHighlights(diff, "left")}
        logicalHighlights={buildLogicalVersionHighlights(diff, "left")}
        syncViewport={false}
        fitRequestToken={0}
        onViewModeChange={() => undefined}
        onSyncedViewportChange={() => undefined}
      />
      <VersionComparePane
        side="right"
        resolved={{ ref: { kind: "working-copy" }, label: "Working copy", snapshot, readonly: true }}
        viewMode="er"
        diagramHighlights={buildDiagramVersionHighlights(diff, "right")}
        logicalHighlights={buildLogicalVersionHighlights(diff, "right")}
        syncViewport={false}
        fitRequestToken={0}
        onViewModeChange={() => undefined}
        onSyncedViewportChange={() => undefined}
      />
    </div>,
  );

  assert.match(markup, /Schema logico non generato in questa versione/);
  assert.match(markup, /data-testid="visual-compare-pane-left"/);
  assert.match(markup, /data-testid="visual-compare-pane-right"/);
  assert.match(markup, /class="diagram-canvas"/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("VersionCompareChangeDrawer mostra sezioni e item selezionabili", () => {
  setCurrentLocale("it");
  const diff = buildProjectVersionDiff(createSnapshot("Visual base"), createSnapshot("Visual changed", "changed"));
  const markup = renderWithI18n(
    <VersionCompareChangeDrawer
      open
      diff={diff}
      activeChange={null}
      onSelectChange={() => undefined}
      onClose={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="visual-compare-drawer"/);
  assert.match(markup, /Dettagli modifiche/);
  assert.match(markup, /Aggiunti/);
  assert.match(markup, /Modificati/);
  assert.match(markup, /data-testid="visual-compare-change-item"/);
  setCurrentLocale(DEFAULT_LOCALE);
});
