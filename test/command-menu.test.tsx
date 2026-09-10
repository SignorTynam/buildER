import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CommandMenuModal } from "../src/components/CommandMenuModal.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import type { ProjectTextWorkspaceFile } from "../src/types/projectExplorer.ts";
import { withTestLocale } from "./utils/i18nTestUtils.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const noop = () => undefined;
const notesFile: ProjectTextWorkspaceFile = {
  id: "notes",
  name: "Decisioni.txt",
  kind: "text",
  content: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderPalette() {
  return withTestLocale("en", () => renderToStaticMarkup(
    <I18nProvider>
      <CommandMenuModal
        diagramView="er"
        logicalSqlOpen={false}
        sqlPlaygroundOpen={false}
        codePanelOpen={false}
        errorsPanelOpen={false}
        explorerOpen
        versioningOpen={false}
        reverseOpen={false}
        canUndo={false}
        canRedo={false}
        canExportLogicalSql={false}
        logicalOutOfDate={false}
        focusMode={false}
        showDiagnostics
        hasUncommittedChanges={false}
        toolRailCollapsed={false}
        selectionItemCount={0}
        editMode
        hasProject
        hasActiveSchema={false}
        projectFiles={[notesFile]}
        projectFilePaths={{ notes: "docs/Decisioni.txt" }}
        openTabs={[{ id: "file:notes", kind: "file", fileId: "notes", title: notesFile.name }]}
        activeFileId="notes"
        onClose={noop}
        onOpenProjectFile={noop}
        onOpenShortcuts={noop}
        onOpenSettings={noop}
        onDiagramViewChange={noop}
        onOpenSql={noop}
        onOpenSqlPlayground={noop}
        onOpenLogicalWorkflow={noop}
        onNewProject={noop}
        onCloseProject={noop}
        onShowWelcome={noop}
        onUndo={noop}
        onRedo={noop}
        onCopySelection={noop}
        onPasteSelection={noop}
        onDuplicateSelection={noop}
        onDeleteSelection={noop}
        onRenameSelection={noop}
        onGenerateLogicalModel={noop}
        onResetTranslation={noop}
        onFitAll={noop}
        onFitSelection={noop}
        onResetZoom={noop}
        onToggleMinimap={noop}
        canAutoLayoutCurrent
        onAutoLayoutCurrent={noop}
        onOpenSqlReverseWorkflow={noop}
        onOpenExplorer={noop}
        onOpenErrorsPanel={noop}
        onOpenVersioningPanel={noop}
        onToggleDiagnostics={noop}
        onToggleCodePanel={noop}
        onSaveProject={noop}
        onNewSchema={noop}
        onNewNote={noop}
        onNewSql={noop}
        onNewFolder={noop}
        onImportSchema={noop}
        onImportSql={noop}
        onExportCurrentSchema={noop}
        onSaveErs={noop}
        onExportSql={noop}
        onLoadProject={noop}
        onLoadErs={noop}
        onExportPng={noop}
        onExportJpeg={noop}
        onExportSvg={noop}
        onResetErs={noop}
        onAbout={noop}
        onOpenReleaseCenter={noop}
        onToggleFocusMode={noop}
        onToggleToolRail={noop}
      />
    </I18nProvider>,
  ));
}

test("command palette espone combobox, listbox e sezioni file/comandi", () => {
  const markup = renderPalette();

  assert.match(markup, /role="combobox"/);
  assert.match(markup, /aria-controls="command-palette-listbox"/);
  assert.match(markup, /role="listbox"/);
  assert.match(markup, /Open files/);
  assert.match(markup, /Workflow/);
});

test("command palette mostra percorso, stato attivo e comandi disabilitati", () => {
  const markup = renderPalette();

  assert.match(markup, /docs\/Decisioni\.txt/);
  assert.match(markup, />Active</);
  assert.match(markup, /aria-disabled="true"/);
  assert.doesNotMatch(markup, /command-palette-tabs/);
  assert.doesNotMatch(markup, /command-palette-tab/);
});

test("command palette espone i comandi viewport della vista corrente", () => {
  const markup = renderPalette();

  assert.match(markup, /Fit all/);
  assert.match(markup, /Fit selection/);
  assert.match(markup, /Reset zoom/);
  assert.match(markup, /Show or hide minimap/);
  assert.match(markup, /Organize automatically/);
});

test("command palette espone SQL Playground e lo disabilita senza schema attivo", () => {
  const markup = renderPalette();

  assert.match(markup, /Open SQL Playground/);
  assert.match(markup, /Open SQL Playground[\s\S]*?aria-disabled="true"/);
});
