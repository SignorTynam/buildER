import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectFileTabs } from "../src/components/project/ProjectFileTabs.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { createTextWorkspaceFile } from "../src/utils/projectExplorer.ts";
import { createWelcomeTab } from "../src/utils/projectTabs.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("ProjectFileTabs renders Welcome and file tabs with tab roles", () => {
  const note = createTextWorkspaceFile("notes.txt", "text", "hello");
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <ProjectFileTabs
        tabs={[createWelcomeTab(), { id: `file:${note.id}`, kind: "file", fileId: note.id, title: note.name, dirty: true }]}
        activeTabId={`file:${note.id}`}
        files={{ [note.id]: note }}
        onSelectTab={() => undefined}
        onCloseTab={() => undefined}
        onNewFile={() => undefined}
      />
    </I18nProvider>,
  );

  assert.match(markup, /role="tablist"/);
  assert.match(markup, /Welcome/);
  assert.match(markup, /notes\.txt/);
  assert.match(markup, /aria-selected="true"/);
  assert.match(markup, /aria-label="Unsaved changes"|aria-label="Modifiche non salvate"/);
});
