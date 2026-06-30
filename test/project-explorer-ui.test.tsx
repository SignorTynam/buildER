import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectExplorer } from "../src/components/project/ProjectExplorer.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { createEmptySchemaDocument, createProjectFromSchema } from "../src/utils/projectExplorer.ts";

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
          onCreateFolder={() => undefined}
          onRename={() => undefined}
          onDelete={() => undefined}
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
  assert.match(markup, /Main schema\.erschema/);
  assert.match(markup, /aria-current="page"/);
});

test("ProjectExplorer espone handler per apertura file e nuovo schema", () => {
  const source = readFileSync(new URL("../src/components/project/ProjectExplorerTreeItem.tsx", import.meta.url), "utf8");
  const shellSource = readFileSync(new URL("../src/components/project/ProjectExplorer.tsx", import.meta.url), "utf8");

  assert.match(source, /props\.onOpenFile\(props\.node\.fileId\)/);
  assert.match(source, /props\.onCreateSchema\(props\.node\.id\)/);
  assert.match(shellSource, /onClick=\{\(\) => props\.onCreateSchema\(props\.project\.rootId\)\}/);
});
