import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CommitDialog } from "../src/components/versioning/CommitDialog.tsx";
import { VersioningPanel } from "../src/components/versioning/VersioningPanel.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { DEFAULT_LOCALE, setCurrentLocale } from "../src/i18n/index.ts";
import { buildProjectCommitDraft, createProjectCommitSnapshot } from "../src/features/versioning/projectCommitSnapshot.ts";
import { createEmptyDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const VIEWPORT = { x: 0, y: 0, zoom: 1 };

function renderWithI18n(element: React.ReactElement): string {
  return renderToStaticMarkup(<I18nProvider>{element}</I18nProvider>);
}

function createSnapshot() {
  const diagram = createEmptyDiagram("Versioning UI");
  diagram.nodes = [
    { id: "entity-a", type: "entity", label: "Cliente", x: 10, y: 20, width: 140, height: 64 },
    { id: "attribute-a", type: "attribute", label: "Nome", x: 220, y: 20, width: 100, height: 48 },
  ];
  diagram.edges = [
    {
      id: "edge-a",
      type: "attribute",
      sourceId: "entity-a",
      targetId: "attribute-a",
      label: "",
      lineStyle: "solid",
    },
  ];
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
    selection: { nodeIds: ["entity-a"], edgeIds: [] },
    translationViewport: VIEWPORT,
    translationSelection: { nodeIds: [], edgeIds: [] },
    logicalViewport: VIEWPORT,
    logicalSelection: { nodeId: null, columnId: null, edgeId: null },
    codeDraft: "entity Cliente",
    codeDirty: true,
    technicalPanelOpen: true,
    technicalPanelTab: "code",
    codePanelOpen: true,
    codePanelWidth: 360,
    notesPanelOpen: false,
    notesPanelWidth: 320,
    toolbarCollapsed: false,
    focusMode: false,
    toolbarWidth: 208,
    showDiagnostics: true,
  });
}

test("dialog commit si apre con input messaggio, descrizione ed errore", () => {
  setCurrentLocale("it");
  const markup = renderWithI18n(
    <CommitDialog
      open
      busy={false}
      error="Messaggio obbligatorio"
      onClose={() => undefined}
      onSubmit={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="commit-dialog"/);
  assert.match(markup, /data-testid="commit-message-input"/);
  assert.match(markup, /data-testid="commit-description-input"/);
  assert.match(markup, /data-testid="create-commit-button"/);
  assert.match(markup, /Nuovo commit/);
  assert.match(markup, /Messaggio obbligatorio/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("pannello Versioni mostra modifiche non committate, HEAD, messaggio e statistiche", async () => {
  setCurrentLocale("it");
  const commit = await buildProjectCommitDraft({
    id: "commit-ui-test",
    parentId: null,
    message: "Schema iniziale",
    description: "Prima versione stabile",
    createdAt: "2026-06-26T10:00:00.000Z",
    snapshot: createSnapshot(),
    automatic: false,
    tags: [],
  });
  const markup = renderWithI18n(
    <VersioningPanel
      open
      commits={[commit]}
      headCommitId={commit.id}
      hasUncommittedChanges
      onClose={() => undefined}
      onNewCommit={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="versioning-panel"/);
  assert.match(markup, /data-testid="versioning-uncommitted"/);
  assert.match(markup, /data-testid="versioning-timeline"/);
  assert.match(markup, /Schema iniziale/);
  assert.match(markup, /Prima versione stabile/);
  assert.match(markup, /HEAD/);
  assert.match(markup, /Commit manuale/);
  assert.match(markup, /Entit(?:à|&#xE0;): 1/);
  assert.match(markup, /Attributi: 1/);
  assert.match(markup, /Edge: 1/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("pannello Versioni mostra lo stato vuoto", () => {
  setCurrentLocale("it");
  const markup = renderWithI18n(
    <VersioningPanel
      open
      commits={[]}
      headCommitId={null}
      hasUncommittedChanges={false}
      onClose={() => undefined}
      onNewCommit={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="versioning-empty"/);
  assert.match(markup, /Nessuna versione salvata/);
  setCurrentLocale(DEFAULT_LOCALE);
});
