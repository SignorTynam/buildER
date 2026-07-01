import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("ProjectFileTabs supports many tabs with scroller and stable new button", () => {
  const files = Object.fromEntries(
    Array.from({ length: 20 }, (_, index) => {
      const file = createTextWorkspaceFile(`notes-${index}.txt`, "text", "hello");
      return [file.id, file];
    }),
  );
  const tabs = Object.values(files).map((file) => ({
    id: `file:${file.id}`,
    kind: "file" as const,
    fileId: file.id,
    title: file.name,
    dirty: file.name === "notes-3.txt",
  }));
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <ProjectFileTabs
        tabs={tabs}
        activeTabId={tabs[4].id}
        files={files}
        onSelectTab={() => undefined}
        onCloseTab={() => undefined}
        onNewFile={() => undefined}
      />
    </I18nProvider>,
  );

  assert.match(markup, /project-file-tabs__scroller/);
  assert.match(markup, /project-file-tabs__new/);
  assert.match(markup, /project-file-tab active/);
  assert.match(markup, /project-file-tab dirty/);
});

test("ProjectFileTabs close button stops tab selection propagation", () => {
  const source = readFileSync(new URL("../src/components/project/ProjectFileTabs.tsx", import.meta.url), "utf8");

  assert.match(source, /event\.stopPropagation\(\)/);
  assert.match(source, /event\.button === 1/);
  assert.match(source, /onCloseTab\(tab\.id\)/);
});
