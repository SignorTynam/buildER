import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppHeader } from "../src/components/AppHeader.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import {
  SUPPORTED_LOCALES,
  getLanguageMenuLabel,
} from "../src/i18n/index.ts";
import { withTestLocale } from "./utils/i18nTestUtils.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const appCommandCssSource = readFileSync(new URL("../src/styles/app-command-bar.css", import.meta.url), "utf8");

function renderHeader(): string {
  return withTestLocale("en", () => renderToStaticMarkup(
    <I18nProvider>
      <AppHeader
        appTitle="buildER"
        appVersion="5.2"
        diagramView="er"
        logicalSqlOpen={false}
        codePanelOpen={false}
        logicalOutOfDate={false}
        focusMode={false}
        hasUncommittedChanges
        versioningCommitCount={3}
        issueCount={0}
        warningCount={0}
        showDiagnostics
        activeActivityPanel="file"
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
        unreadReleaseCount={0}
        onActivityPanelSelect={() => undefined}
        onCreateCommit={() => undefined}
      />
    </I18nProvider>,
  ));
}

test("AppHeader renders the language button between help and command menu", () => {
  const markup = renderHeader();

  const helpIndex = markup.indexOf('data-testid="app-header-help-menu"');
  const languageIndex = markup.indexOf('data-testid="app-header-language"');
  const menuIndex = markup.indexOf('data-testid="app-header-menu"');

  assert.ok(languageIndex >= 0, "language button is rendered");
  assert.ok(helpIndex < languageIndex, "language button follows help");
  assert.ok(languageIndex < menuIndex, "language button precedes command menu");
  assert.match(markup, /aria-haspopup="menu"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /Change interface language/);
  assert.match(markup, /File/);
  assert.doesNotMatch(markup, /class="app-command-tab"/);
  assert.doesNotMatch(markup, />Code</);
  assert.doesNotMatch(markup, />Reverse</);
  assert.doesNotMatch(markup, />Version</);

});

test("AppHeader language menu supports every configured locale", () => {
  withTestLocale("it", () => {
    assert.deepEqual(SUPPORTED_LOCALES, ["it", "en", "sq"]);
    assert.equal(getLanguageMenuLabel("it"), "Italiano (Italiano)");
    assert.equal(getLanguageMenuLabel("en"), "Inglese (English)");
    assert.equal(getLanguageMenuLabel("sq"), "Albanese (Shqip)");
  });
});

test("AppHeader language menu keeps the expected interactive wiring", () => {
  const source = readFileSync(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");

  assert.match(source, /SUPPORTED_LOCALES\.map/);
  assert.match(source, /data-testid="app-header-language-menu"/);
  assert.match(source, /role="menuitemradio"/);
  assert.match(source, /aria-checked=\{locale === language\}/);
  assert.match(source, /StudioIcon name="globe"/);
  assert.match(source, /StudioIcon name="done"/);
  assert.match(source, /runTopbarMenuAction\(\(\) => setLocale\(language\)\)/);
  assert.match(source, /setActiveTopbarMenu\(null\);/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /document\.addEventListener\("pointerdown"/);
});

test("AppHeader language menu uses a dark topbar surface", () => {
  // Fase D4: il fondo scuro proprio del menu resta #1f1f1f (off-scale documentato);
  // il testo bianco e' ora tokenizzato a parita' (#ffffff == --color-text-on-accent).
  assert.match(
    appCommandCssSource,
    /\.designer-language-menu__panel\.app-topbar-menu__panel\s*\{[\s\S]*background:\s*#1f1f1f/,
  );
  assert.match(
    appCommandCssSource,
    /\.designer-language-menu__panel\.app-topbar-menu__panel\s*\{[\s\S]*color:\s*var\(--color-text-on-accent\)/,
  );
  assert.match(
    appCommandCssSource,
    /\.designer-language-menu__panel\.app-topbar-menu__panel \.designer-language-menu__item\s*\{[\s\S]*color:\s*var\(--color-text-on-accent\)/,
  );
});
