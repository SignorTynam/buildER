import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { AppHeader } from "../src/components/AppHeader.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  getLanguageMenuLabel,
  setCurrentLocale,
} from "../src/i18n/index.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function renderHeader(): string {
  return renderToStaticMarkup(
    <I18nProvider>
      <AppHeader
        appTitle="buildER"
        appVersion="5.2"
        diagramName="Test"
        diagramView="er"
        logicalSqlOpen={false}
        codePanelOpen={false}
        notesPanelOpen={false}
        logicalOutOfDate={false}
        focusMode={false}
        hasUncommittedChanges
        versioningCommitCount={3}
        onNewProject={() => undefined}
        onOpenVersioningPanel={() => undefined}
        onToggleCodePanel={() => undefined}
        onToggleNotesPanel={() => undefined}
        onSaveProject={() => undefined}
        onLoadProject={() => undefined}
        onOpenCommandMenu={() => undefined}
        onOpenShortcuts={() => undefined}
      />
    </I18nProvider>,
  );
}

test("AppHeader renders the language button between help and command menu", () => {
  setCurrentLocale("en");
  const markup = renderHeader();

  const helpIndex = markup.indexOf('data-testid="app-header-help"');
  const languageIndex = markup.indexOf('data-testid="app-header-language"');
  const menuIndex = markup.indexOf('data-testid="app-header-menu"');

  assert.ok(languageIndex >= 0, "language button is rendered");
  assert.ok(helpIndex < languageIndex, "language button follows help");
  assert.ok(languageIndex < menuIndex, "language button precedes command menu");
  assert.match(markup, /aria-haspopup="menu"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /Change interface language/);
  assert.match(markup, /Open project versions\. 3 commits, uncommitted changes\./);
  assert.match(markup, /aria-label="Uncommitted changes"/);
  assert.match(markup, /aria-label="3 commits"/);

  setCurrentLocale(DEFAULT_LOCALE);
});

test("AppHeader language menu supports every configured locale", () => {
  setCurrentLocale("it");

  assert.deepEqual(SUPPORTED_LOCALES, ["it", "en", "sq"]);
  assert.equal(getLanguageMenuLabel("it"), "Italiano (Italiano)");
  assert.equal(getLanguageMenuLabel("en"), "Inglese (English)");
  assert.equal(getLanguageMenuLabel("sq"), "Albanese (Shqip)");

  setCurrentLocale(DEFAULT_LOCALE);
});

test("AppHeader language menu keeps the expected interactive wiring", () => {
  const source = readFileSync(new URL("../src/components/AppHeader.tsx", import.meta.url), "utf8");

  assert.match(source, /SUPPORTED_LOCALES\.map/);
  assert.match(source, /data-testid="app-header-language-menu"/);
  assert.match(source, /role="menuitemradio"/);
  assert.match(source, /aria-checked=\{locale === language\}/);
  assert.match(source, /StudioIcon name="globe"/);
  assert.match(source, /StudioIcon name="done"/);
  assert.match(source, /setLocale\(language\);/);
  assert.match(source, /setLanguageMenuOpen\(false\);/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /document\.addEventListener\("pointerdown"/);
});
