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
        onOpenAbout={() => undefined}
        onOpenWhatsNew={() => undefined}
        onActivityPanelSelect={() => undefined}
        onCreateCommit={() => undefined}
      />
    </I18nProvider>,
  );
}

test("AppHeader mostra File e Importa/Esporta ma non le tab activity nella topbar", () => {
  const markup = renderHeader();

  assert.match(markup, /data-testid="app-header-file-menu"/);
  assert.match(markup, /data-testid="app-header-import-export-menu"/);
  assert.match(markup, /data-testid="app-header-help-menu"/);
  assert.doesNotMatch(markup, /app-command-tab/);
  assert.doesNotMatch(markup, />Code</);
  assert.doesNotMatch(markup, />Reverse</);
  assert.doesNotMatch(markup, />Errors</);
  assert.doesNotMatch(markup, />Version</);
});

test("File menu non contiene Import, Export o Versioning", () => {
  const source = readFileSync(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");
  const fileBlock = source.slice(
    source.indexOf('data-menu-block="file"'),
    source.indexOf('data-menu-block="import-export"'),
  );

  assert.doesNotMatch(fileBlock, /onImportSchema/);
  assert.doesNotMatch(fileBlock, /onImportErs/);
  assert.doesNotMatch(fileBlock, /onImportSql/);
  assert.doesNotMatch(fileBlock, /onExportPng/);
  assert.doesNotMatch(fileBlock, /onExportJpeg/);
  assert.doesNotMatch(fileBlock, /onExportSvg/);
  assert.doesNotMatch(fileBlock, /onExportSql/);
  assert.doesNotMatch(fileBlock, /onSaveErs/);
  assert.doesNotMatch(fileBlock, /onOpenVersioningPanel/);
  assert.doesNotMatch(fileBlock, /onActivityPanelSelect/);
  assert.doesNotMatch(fileBlock, /onCreateCommit/);
  assert.doesNotMatch(fileBlock, /versioning/i);
});

test("Importa/Esporta contiene tutte le azioni di import ed export", () => {
  const source = readFileSync(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");
  const importExportBlock = source.slice(
    source.indexOf('data-menu-block="import-export"'),
    source.indexOf('data-menu-block="help"'),
  );

  assert.match(importExportBlock, /onImportSchema/);
  assert.match(importExportBlock, /onImportErs/);
  assert.match(importExportBlock, /onImportSql/);
  assert.match(importExportBlock, /onExportPng/);
  assert.match(importExportBlock, /onExportJpeg/);
  assert.match(importExportBlock, /onExportSvg/);
  assert.match(importExportBlock, /onExportSql/);
  assert.match(importExportBlock, /onExportCurrentSchema/);
  assert.match(importExportBlock, /onSaveProject/);
  assert.match(importExportBlock, /onSaveErs/);
  assert.doesNotMatch(importExportBlock, /onOpenVersioningPanel/);
  assert.doesNotMatch(importExportBlock, /onCreateCommit/);
});

test("Help menu espone shortcut, novita e informazioni", () => {
  const source = readFileSync(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");
  const helpBlock = source.slice(
    source.indexOf('data-menu-block="help"'),
    source.indexOf('data-testid="app-header-language"'),
  );

  assert.match(source, /onOpenAbout: \(\) => void/);
  assert.match(source, /onOpenWhatsNew: \(\) => void/);
  assert.match(helpBlock, /onOpenShortcuts/);
  assert.match(helpBlock, /onOpenWhatsNew/);
  assert.match(helpBlock, /onOpenAbout/);
});

test("Topbar menu chiude i dropdown con Escape", () => {
  const source = readFileSync(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");

  assert.match(source, /event\.key === "Escape"/);
});

test("Topbar menu usa stacking context sopra workspace e toolbox", () => {
  const css = readFileSync(new URL("../src/styles/app-command-bar.css", import.meta.url), "utf8");

  assert.match(css, /\.app-command-topbar[\s\S]*z-index:\s*1000/);
  assert.match(css, /\.app-command-topbar[\s\S]*isolation:\s*isolate/);
  assert.match(css, /\.app-topbar-menu\s*\{[\s\S]*z-index:\s*1001/);
  assert.match(css, /\.app-topbar-menu__panel\s*\{[\s\S]*z-index:\s*10000/);
});
