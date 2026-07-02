import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectExplorer } from "../src/components/project/ProjectExplorer.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import {
  addProjectFolder,
  createEmptySchemaDocument,
  createProjectFromSchema,
} from "../src/utils/projectExplorer.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function renderExplorer() {
  const state = createProjectFromSchema("Project", createEmptySchemaDocument("Main schema.erschema"));
  return {
    state,
    markup: renderToStaticMarkup(
      <I18nProvider>
        <ProjectExplorer
          project={state.project}
          files={state.files}
          view={state.view}
          onOpenFile={() => undefined}
          onCreateSchema={() => undefined}
          onCreateTextFile={() => undefined}
          onCreateSqlFile={() => undefined}
          onCreateFolder={() => undefined}
          onRename={() => undefined}
          onDelete={() => undefined}
          onSelectNode={() => undefined}
          onToggleFolder={() => undefined}
          onCollapseAll={() => undefined}
          onToggleOpen={() => undefined}
          onResizeStart={() => undefined}
        />
      </I18nProvider>,
    ),
  };
}

test("ProjectExplorer renderizza root, schema e file attivo", () => {
  const { markup } = renderExplorer();

  assert.match(markup, /Explorer/);
  assert.match(markup, /Project/);
  assert.match(markup, /project-explorer-meta/);
  assert.match(markup, /Main schema\.erschema/);
  assert.match(markup, /aria-current="page"/);
  assert.match(markup, /role="treeitem"/);
});

test("ProjectExplorer distingue active file e selected folder nel tree", () => {
  const state = createProjectFromSchema("Project", createEmptySchemaDocument("Main schema.erschema"));
  const folder = addProjectFolder(state, state.project.rootId, "Models");
  assert.equal(folder.ok, true);
  if (!folder.ok) return;
  const view = { ...folder.state.view, selectedNodeId: folder.nodeId };
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <ProjectExplorer
        project={folder.state.project}
        files={folder.state.files}
        view={view}
        onOpenFile={() => undefined}
        onCreateSchema={() => undefined}
        onCreateTextFile={() => undefined}
        onCreateSqlFile={() => undefined}
        onCreateFolder={() => undefined}
        onRename={() => undefined}
        onDelete={() => undefined}
        onSelectNode={() => undefined}
        onToggleFolder={() => undefined}
        onCollapseAll={() => undefined}
        onToggleOpen={() => undefined}
        onResizeStart={() => undefined}
      />
    </I18nProvider>,
  );

  assert.match(markup, /project-explorer-item folder selected/);
  assert.match(markup, /project-explorer-item file active/);
  assert.match(markup, /aria-expanded="true"/);
  assert.match(markup, /aria-selected="true"/);
});

test("ProjectExplorer espone handler per apertura file e nuovo schema", () => {
  const source = readFileSync(new URL("../src/components/project/ProjectExplorerTreeItem.tsx", import.meta.url), "utf8");
  const shellSource = readFileSync(new URL("../src/components/project/ProjectExplorer.tsx", import.meta.url), "utf8");

  assert.match(source, /props\.onOpenFile\(props\.node\.fileId\)/);
  assert.match(source, /props\.onCreateSchema\(props\.node\.id\)/);
  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /role="treeitem"/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /aria-current/);
  assert.match(source, /onCreateSqlFile/);
  assert.match(source, /fileText/);
  assert.match(shellSource, /selectedTargetFolderId/);
  assert.match(shellSource, /ProjectExplorerContextMenu/);
  assert.match(shellSource, /projectExplorer\.actions\.close/);
  assert.doesNotMatch(shellSource, /project-explorer-more-menu/);
  assert.doesNotMatch(shellSource, /projectExplorer\.actions\.more/);
});

test("ProjectExplorer context menu usa sezioni e azione danger", () => {
  const source = readFileSync(new URL("../src/components/project/ProjectExplorerContextMenu.tsx", import.meta.url), "utf8");

  assert.match(source, /project-explorer-context-menu__section/);
  assert.match(source, /project-explorer-context-menu__item/);
  assert.match(source, /project-explorer-context-menu__danger/);
  assert.match(source, /Math\.max\(0, viewportWidth - 260\)/);
});

test("file txt apre il modal note senza sostituire Explorer o aprire CodePanel", () => {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const filePanelStart = appSource.indexOf('activeActivityPanel === "file"');
  const filePanelEnd = appSource.indexOf(') : activeActivityPanel === "code"', filePanelStart);
  const filePanelSource = appSource.slice(filePanelStart, filePanelEnd);

  assert.match(appSource, /setTextFileModalFileId\(fileId\)/);
  assert.match(appSource, /<ProjectTextFileModal/);
  assert.match(filePanelSource, /<ProjectExplorer/);
  assert.doesNotMatch(filePanelSource, /ProjectTextFilePanel/);
  assert.doesNotMatch(filePanelSource, /<CodePanel/);
});
