import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectTextFileModal } from "../src/components/project/ProjectTextFileModal.tsx";
import { WorkspaceEditorHeader } from "../src/components/workspace/WorkspaceEditorHeader.tsx";
import { PanelEmptyState } from "../src/components/workspace/WorkspacePanel.tsx";
import { WorkspaceTextEditor } from "../src/components/workspace/WorkspaceTextEditor.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { createSchemaWorkspaceFile, createTextWorkspaceFile } from "../src/utils/projectExplorer.ts";
import { withTestLocale } from "./utils/i18nTestUtils.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const renderInEnglish = (element: React.ReactElement): string =>
  withTestLocale("en", () => renderToStaticMarkup(element));

test("ProjectTextFileModal renderizza editor note per file txt", () => {
  const source = readFileSync(new URL("../src/components/project/ProjectTextFileModal.tsx", import.meta.url), "utf8");
  const markup = renderInEnglish(
    <I18nProvider>
      <ProjectTextFileModal
        open
        fileName="notes.txt"
        content="Project note"
        editable
        onChange={() => undefined}
        onClose={() => undefined}
      />
    </I18nProvider>,
  );

  assert.match(markup, /notes\.txt/);
  assert.match(markup, /textarea/);
  assert.match(markup, /Project note/);
  assert.match(markup, /project-text-file-modal/);
  // Fase C4b: Esc/backdrop/focus li gestisce la Modal shell condivisa.
  assert.match(source, /<Modal[\s\S]*onClose=\{onClose\}/);
  assert.match(markup, /role="dialog"/);
});

test("App apre txt e SQL nel WorkspaceTextEditor principale", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(source, /activeProjectFile && activeProjectFile\.kind !== "schema"/);
  assert.match(source, /<WorkspaceTextEditor/);
  assert.match(source, /onChange=\{handleActiveTextFileChange\}/);
  assert.doesNotMatch(source, /<ProjectTextFileModal/);
  assert.doesNotMatch(source, /<ProjectTextFilePanel/);
  assert.doesNotMatch(source, /note-file-panel/);
});

test("WorkspaceTextEditor usa CodeEditorSurface per SQL e conserva il footer controllato", () => {
  const sqlFile = createTextWorkspaceFile("query.sql", "sql", "SELECT 1;\nFROM sample;");
  const markup = renderInEnglish(
    <I18nProvider>
      <WorkspaceTextEditor file={sqlFile} editable onChange={() => undefined} />
    </I18nProvider>,
  );

  assert.match(markup, /workspace-text-editor--sql/);
  assert.match(markup, /designer-code-line-numbers/);
  assert.match(markup, /designer-code-highlight/);
  assert.match(markup, /sql-token-keyword/);
  assert.match(markup, /spellcheck="false"/i);
  assert.match(markup, /SQL editor for query\.sql/);
  assert.match(markup, /2 lines/);
  assert.match(markup, />SQL</);
  assert.match(markup, />Editable</);
});

test("WorkspaceTextEditor lascia invariato il textarea dei file TXT e supporta SQL vuoto read-only", () => {
  const textMarkup = renderInEnglish(
    <I18nProvider>
      <WorkspaceTextEditor
        file={createTextWorkspaceFile("notes.txt", "text", "Project note")}
        editable
        onChange={() => undefined}
      />
    </I18nProvider>,
  );
  assert.match(textMarkup, /workspace-text-editor__input/);
  assert.doesNotMatch(textMarkup, /designer-code-editor/);

  const sqlMarkup = renderInEnglish(
    <I18nProvider>
      <WorkspaceTextEditor
        file={createTextWorkspaceFile("empty.sql", "sql", "")}
        editable={false}
        onChange={() => undefined}
      />
    </I18nProvider>,
  );
  assert.match(sqlMarkup, /Write or paste SQL/);
  assert.match(sqlMarkup, /readOnly=""/i);
  assert.match(sqlMarkup, /1 line/);
  assert.match(sqlMarkup, />Read only</);
});

test("WorkspaceEditorHeader espone azioni accessibili solo per i file SQL e non ripete il percorso", () => {
  const sqlFile = createTextWorkspaceFile("query.sql", "sql", "SELECT 1;");
  const sqlMarkup = renderInEnglish(
    <I18nProvider>
      <WorkspaceEditorHeader
        file={sqlFile}
        view="er"
        onViewChange={() => undefined}
        onOpenSqlPlayground={() => undefined}
        onStartSqlReverse={() => undefined}
      />
    </I18nProvider>,
  );
  assert.match(sqlMarkup, /aria-label="Open in Playground"/);
  assert.match(sqlMarkup, /aria-label="Start Reverse Engineering"/);
  assert.match(sqlMarkup, /role="tooltip"/);
  // Il percorso vive sulla tab e nella status bar: la barra di contesto porta
  // solo azioni, e "Reveal in Explorer" resta nel menu contestuale della tab.
  assert.doesNotMatch(sqlMarkup, /editor-breadcrumb/);
  assert.doesNotMatch(sqlMarkup, /Reveal in Explorer/);

  const schemaMarkup = renderInEnglish(
    <I18nProvider>
      <WorkspaceEditorHeader
        file={createSchemaWorkspaceFile("model.erschema")}
        view="er"
        onViewChange={() => undefined}
      />
    </I18nProvider>,
  );
  // Il view switcher e il primo blocco della barra, allineato a sinistra.
  assert.match(schemaMarkup, /editor-context-actions"><div class="editor-view-switcher"/);

  const textMarkup = renderInEnglish(
    <I18nProvider>
      <WorkspaceEditorHeader
        file={createTextWorkspaceFile("notes.txt", "text", "")}
        view="er"
        onViewChange={() => undefined}
      />
    </I18nProvider>,
  );
  assert.doesNotMatch(textMarkup, /Open in Playground/);
  assert.doesNotMatch(textMarkup, /Start Reverse Engineering/);
  assert.doesNotMatch(textMarkup, /Reveal in Explorer/);
});

test("PanelEmptyState offre la variante card e il tone positivo canonici", () => {
  const markup = renderInEnglish(
    <PanelEmptyState
      variant="card"
      tone="success"
      icon="success"
      title="Valid diagram"
      description="No issues."
      role="status"
    />,
  );
  assert.match(markup, /workspace-panel__empty--card/);
  assert.match(markup, /workspace-panel__empty--success/);
  assert.match(markup, /workspace-panel__empty-icon/);
  assert.match(markup, /Valid diagram/);
  assert.match(markup, /No issues/);
  assert.match(markup, /role="status"/);
});
