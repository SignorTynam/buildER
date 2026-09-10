import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppHeader } from "../src/components/AppHeader.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { withTestLocale } from "./utils/i18nTestUtils.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function renderHeader() {
  return withTestLocale("en", () => renderToStaticMarkup(
    <I18nProvider>
      <AppHeader
        appTitle="buildER"
        appVersion="6.3.0"
        projectName="Project only"
        diagramView="er"
        logicalSqlOpen={false}
        codePanelOpen={false}
        logicalOutOfDate={false}
        focusMode={false}
        hasUncommittedChanges={false}
        versioningCommitCount={0}
        issueCount={0}
        warningCount={0}
        showDiagnostics
        activeActivityPanel="code"
        hasProject
        onNewProject={() => undefined}
        onCloseProject={() => undefined}
        onNewSchema={() => undefined}
        onNewNote={() => undefined}
        onNewSql={() => undefined}
        onNewFolder={() => undefined}
        onImportSchema={() => undefined}
        onImportErs={() => undefined}
        onExportCurrentSchema={() => undefined}
        onOpenVersioningPanel={() => undefined}
        onToggleCodePanel={() => undefined}
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
        onOpenSettings={() => undefined}
        onOpenAbout={() => undefined}
        onOpenReleaseCenter={() => undefined}
        unreadReleaseCount={3}
        onActivityPanelSelect={() => undefined}
        onCreateCommit={() => undefined}
      />
    </I18nProvider>,
  ));
}

test("AppHeader mostra File e Importa/Esporta ma non le tab activity nella topbar", () => {
  const markup = renderHeader();

  assert.match(markup, /data-testid="app-header-file-menu"/);
  assert.match(markup, /data-testid="app-header-import-export-menu"/);
  assert.match(markup, /data-testid="app-header-info-menu"/);
  assert.match(markup, /data-testid="app-header-help-menu"/);
  assert.match(markup, /data-testid="app-header-release-center"/);
  assert.match(markup, /release-center-button__badge/);
  assert.match(markup, />3<\/span>/);
  assert.doesNotMatch(markup, /app-command-tab/);
  assert.doesNotMatch(markup, />Code</);
  assert.doesNotMatch(markup, />Reverse</);
  assert.doesNotMatch(markup, />Errors</);
  assert.doesNotMatch(markup, />Version</);
  assert.doesNotMatch(markup, /data-project-name-input/);
  assert.doesNotMatch(markup, /designer-project-name/);
  assert.match(markup, /app-project-context__name[^>]*>Project only</);
  assert.doesNotMatch(markup, /app-project-context__file|app-project-context__separator/);
  assert.match(markup, /class="app-command-search"/);
  assert.match(markup, /Ctrl K/);
});

test("tutti gli accessi header alla palette delegano a onOpenCommandMenu", () => {
  const source = readFileSync(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");

  assert.match(source, /className="app-command-search"[\s\S]*?onClick=\{props\.onOpenCommandMenu\}/);
  assert.match(source, /data-menu-block="info"[\s\S]*?runTopbarMenuAction\(props\.onOpenCommandMenu\)/);
  assert.match(source, /data-testid="app-header-menu"/);
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
    source.indexOf('data-menu-block="info"'),
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

test("Informazioni contiene Menu e il centro Novita", () => {
  const source = readFileSync(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");
  const infoBlock = source.slice(
    source.indexOf('data-menu-block="info"'),
    source.indexOf('data-menu-block="help"'),
  );

  assert.match(infoBlock, /onOpenCommandMenu/);
  assert.match(infoBlock, /onOpenReleaseCenter/);
  assert.doesNotMatch(infoBlock, /onImportSchema/);
  assert.doesNotMatch(infoBlock, /onExportPng/);
});

test("Help menu espone shortcut, novita e informazioni", () => {
  const source = readFileSync(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");
  const helpBlock = source.slice(
    source.indexOf('data-menu-block="help"'),
    source.indexOf('data-testid="app-header-language"'),
  );

  assert.match(source, /onOpenAbout: \(\) => void/);
  assert.match(source, /onOpenReleaseCenter: \(\) => void/);
  assert.match(helpBlock, /onOpenShortcuts/);
  assert.match(helpBlock, /onOpenReleaseCenter/);
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

test("workspace uses one explicit light theme without a theme toggle", () => {
  const headerSource = readFileSync(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const mainSource = readFileSync(new URL("../src/main.tsx", import.meta.url), "utf8");
  const tokensSource = readFileSync(new URL("../src/styles/tokens.css", import.meta.url), "utf8");
  const markup = renderHeader();

  assert.doesNotMatch(headerSource, /\bonToggleTheme\b/);
  assert.doesNotMatch(headerSource, /\btheme\??\s*:/);
  assert.doesNotMatch(markup, /switch to (?:light|dark) theme/i);
  assert.doesNotMatch(`${appSource}\n${mainSource}`, /builder:workspace-theme/);
  assert.doesNotMatch(`${appSource}\n${mainSource}`, /prefers-color-scheme:\s*dark/);
  assert.doesNotMatch(`${appSource}\n${mainSource}`, /dataset\.theme|data-theme/);
  assert.doesNotMatch(tokensSource, /data-theme\s*=\s*["']dark["']/);
  assert.match(tokensSource, /:root\s*\{[\s\S]*color-scheme:\s*light/);
});
