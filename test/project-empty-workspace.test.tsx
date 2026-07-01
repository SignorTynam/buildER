import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { WorkspaceWelcomePage } from "../src/components/workspace/WorkspaceWelcomePage.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { createEmptyProjectExplorerState } from "../src/utils/projectExplorer.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("WorkspaceWelcomePage renderizza start actions senza canvas", () => {
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <WorkspaceWelcomePage
        projectName="Empty Project"
        onNewSchema={() => undefined}
        onNewNote={() => undefined}
        onNewSql={() => undefined}
        onOpenProject={() => undefined}
        onImportSchema={() => undefined}
      />
    </I18nProvider>,
  );

  assert.match(markup, /buildER/);
  assert.match(markup, /New schema|Nuovo schema/);
  assert.match(markup, /New note|Nuova nota/);
  assert.doesNotMatch(markup, /diagram-canvas/);
});

test("New Project usa progetto vuoto senza erschema automatico", () => {
  const state = createEmptyProjectExplorerState("New Project");

  assert.equal(state.project.activeFileId, null);
  assert.equal(state.view.activeFileId, null);
  assert.equal(Object.keys(state.files).length, 0);

  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const newProjectStart = appSource.indexOf("async function handleNewProject");
  const newProjectEnd = appSource.indexOf("function handleCreateNode", newProjectStart);
  const newProjectSource = appSource.slice(newProjectStart, newProjectEnd);

  assert.match(newProjectSource, /createEmptyProjectExplorerState/);
  assert.doesNotMatch(newProjectSource, /createProjectFromSchema/);
  assert.doesNotMatch(newProjectSource, /createSchemaWorkspaceFile/);
});

test("workspace senza schema aperto e senza tab mostra EmptyEditor e non renderizza Toolbar o DiagramCanvas", () => {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const welcomeStart = appSource.indexOf("!hasOpenSchema ? (");
  const schemaBranchStart = appSource.indexOf("<div", welcomeStart);
  const welcomeBranch = appSource.slice(welcomeStart, schemaBranchStart);

  assert.match(appSource, /const hasOpenSchema = Boolean\(activeSchemaFile\)/);
  assert.match(appSource, /welcomeTabActive/);
  assert.match(appSource, /<WorkspaceWelcomePage/);
  assert.match(welcomeBranch, /<WorkspaceEmptyEditor/);
  assert.doesNotMatch(welcomeBranch, /<Toolbar/);
  assert.doesNotMatch(welcomeBranch, /<DiagramCanvas/);
});
