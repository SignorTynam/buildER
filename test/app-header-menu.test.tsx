import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppHeader } from "../src/components/AppHeader.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function renderHeader() {
  return renderToStaticMarkup(
    <I18nProvider>
      <AppHeader
        appTitle="buildER"
        appVersion="6.2"
        diagramName="ER Studio"
        diagramView="er"
        logicalSqlOpen={false}
        codePanelOpen={false}
        notesPanelOpen={false}
        logicalOutOfDate={false}
        focusMode={false}
        hasUncommittedChanges={false}
        versioningCommitCount={0}
        issueCount={0}
        warningCount={0}
        showDiagnostics
        activeActivityPanel="code"
        onNewProject={() => undefined}
        onCloseProject={() => undefined}
        onNewSchema={() => undefined}
        onNewNote={() => undefined}
        onNewSql={() => undefined}
        onNewFolder={() => undefined}
        onImportSchema={() => undefined}
        onImportErs={() => undefined}
        onExportCurrentSchema={() => undefined}
        onRenameProject={() => undefined}
        onOpenVersioningPanel={() => undefined}
        onToggleCodePanel={() => undefined}
        onToggleNotesPanel={() => undefined}
        onRegenerateErs={() => undefined}
        onSaveProject={() => undefined}
        onLoadProject={() => undefined}
        onSaveErs={() => undefined}
        onOpenSqlReverseWorkflow={() => undefined}
        onImportSql={() => undefined}
        onOpenErrorsPanel={() => undefined}
        onToggleDiagnostics={() => undefined}
        onExportPng={() => undefined}
        onExportJpeg={() => undefined}
        onExportSvg={() => undefined}
        onExportSql={() => undefined}
        onOpenCommandMenu={() => undefined}
        onOpenShortcuts={() => undefined}
        onActivityPanelSelect={() => undefined}
        onCreateCommit={() => undefined}
      />
    </I18nProvider>,
  );
}

test("AppHeader mostra File ma non le tab activity nella topbar", () => {
  const markup = renderHeader();

  assert.match(markup, /data-testid="app-header-file-menu"/);
  assert.doesNotMatch(markup, /app-command-tab/);
  assert.doesNotMatch(markup, />Code</);
  assert.doesNotMatch(markup, />Reverse</);
  assert.doesNotMatch(markup, />Errors</);
  assert.doesNotMatch(markup, />Version</);
  assert.doesNotMatch(markup, />Export</);
});

test("File trigger non seleziona activity panel", () => {
  const source = readFileSync(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");
  const triggerBlock = source.slice(source.indexOf("app-file-menu__trigger"), source.indexOf("app-file-menu__panel"));

  assert.doesNotMatch(triggerBlock, /onActivityPanelSelect/);
  assert.match(source, /event\.key === "Escape"/);
});
