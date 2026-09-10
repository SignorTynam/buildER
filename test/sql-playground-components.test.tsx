import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { SqlPlaygroundEditor } from "../src/features/sql-playground/SqlPlaygroundEditor.tsx";
import { SqlPlaygroundHeader } from "../src/features/sql-playground/SqlPlaygroundHeader.tsx";
import { createSqlPlaygroundSessionState } from "../src/utils/sqlPlayground.ts";
import { SqlPlaygroundError } from "../src/features/sql-playground/SqlPlaygroundError.tsx";
import { SqlPlaygroundResults } from "../src/features/sql-playground/SqlPlaygroundResults.tsx";
import { SqlDataPopulationDialog } from "../src/features/sql-playground/SqlDataPopulationDialog.tsx";
import { withTestLocale } from "./utils/i18nTestUtils.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function render(node: React.ReactNode): string {
  return withTestLocale("en", () => renderToStaticMarkup(<I18nProvider>{node}</I18nProvider>));
}

test("SQL playground editor uses the shared highlighted editor with line numbers", () => {
  const markup = render(
    <SqlPlaygroundEditor value={'SELECT s.id FROM student s LEFT JOIN course c ON c.id = s.id ORDER BY s.id;\nPRAGMA table_info("student");'} executeDisabled={false} onChange={() => undefined} onExecute={() => undefined} />,
  );
  assert.match(markup, /<textarea/);
  assert.match(markup, /Editor query SQL|SQL query editor/);
  assert.match(markup, /designer-code-line-numbers/);
  assert.match(markup, /sql-token-keyword/);
  assert.match(markup, /ORDER/);
  assert.match(markup, /JOIN/);
  assert.match(markup, /PRAGMA/);
  assert.match(markup, />2<\/span>/);
  assert.doesNotMatch(markup, /ui-button--primary/);
});

test("SQL playground command bar owns ordered create, population, run, and download actions", () => {
  const session = { ...createSqlPlaygroundSessionState({ sessionId: "p:s", schemaFileId: "s", schemaName: "university.erschema", currentGeneratedChecksum: "a" }), sqliteVersion: "3.50.4", status: "engine-ready" as const };
  const markup = render(<SqlPlaygroundHeader session={session} executeDisabled onCreateDatabase={() => undefined} onGenerateData={() => undefined} onExecute={() => undefined} onDownload={() => undefined} />);
  assert.match(markup, /sql-playground-command-bar/);
  assert.match(markup, /Crea database|Create database/);
  assert.match(markup, /Esegui|Run/);
  assert.match(markup, /Genera dati|Generate data/);
  assert.match(markup, /Scarica database|Download database/);
  assert.match(markup, /SQLite 3\.50\.4/);
  assert.doesNotMatch(markup, /sql-playground-toolbar/);
  assert.match(markup, /sql-playground-command-bar__population[^>]*disabled/);
  const createIndex = markup.search(/Crea database|Create database/);
  const populationIndex = markup.search(/Genera dati|Generate data/);
  const runIndex = markup.search(/Esegui|Run/);
  const downloadIndex = markup.search(/Scarica database|Download database/);
  assert.ok(createIndex < populationIndex && populationIndex < runIndex && runIndex < downloadIndex);
});

test("SQL population command reports busy state while planning", () => {
  const base = createSqlPlaygroundSessionState({ sessionId: "p:s", schemaFileId: "s", schemaName: "university.erschema", currentGeneratedChecksum: "a" });
  const session = { ...base, databaseReady: true, schemaChecksum: "a", status: "planning-data" as const };
  const markup = render(<SqlPlaygroundHeader session={session} onRecreateDatabase={() => undefined} onGenerateData={() => undefined} onExecute={() => undefined} onDownload={() => undefined} />);
  assert.match(markup, /aria-busy="true"/);
  assert.match(markup, /Pianificazione dati|Planning data/);
});

test("SQL population dialog exposes localized defaults, labels, limits, privacy, and accessible fields", () => {
  const markup = render(
    <SqlDataPopulationDialog
      open
      onClose={() => undefined}
      onPlan={async () => { throw new Error("unused"); }}
      onApply={async () => { throw new Error("unused"); }}
      onRecreate={async () => false}
    />,
  );
  assert.match(markup, /role="dialog"/);
  assert.match(markup, /Righe per tabella|Rows per table/);
  assert.match(markup, /Seed/);
  assert.match(markup, /value="20"/);
  assert.match(markup, /value="42"/);
  assert.match(markup, /max="100"/);
  assert.match(markup, /max="4294967295"/);
  assert.match(markup, /example\.test|fittizi|fictional/);
  assert.match(markup, /Genera anteprima|Generate preview/);
});

test("SQL playground renders multiple semantic result sets, NULL, BLOB and DML summaries", () => {
  const markup = render(<SqlPlaygroundResults collapsed={false} onCollapsedChange={() => undefined} results={[
    {
      statementIndex: 0,
      sql: "SELECT a, b FROM t;",
      kind: "rows",
      columns: ["a", "b"],
      rows: [[null, { kind: "blob", byteLength: 8 }]],
      rowCount: 1,
      truncated: false,
      changes: 0,
      durationMs: 1,
    },
    {
      statementIndex: 1,
      sql: "INSERT INTO t VALUES (1);",
      kind: "changes",
      columns: [],
      rows: [],
      rowCount: 0,
      truncated: false,
      changes: 1,
      lastInsertRowId: "1",
      durationMs: 2,
    },
  ]} />);
  assert.match(markup, /<table>/);
  assert.match(markup, /<th scope="col">a<\/th>/);
  assert.match(markup, /scope="row">1<\/th>/);
  assert.match(markup, /NULL/);
  assert.match(markup, /\[BLOB · 8 byte\]/);
  assert.match(markup, /Righe modificate|Rows changed/);
  assert.match(markup, /Ultimo ID inserito|Last inserted ID/);
  assert.match(markup, /Istruzione 2|Statement 2/);
});

test("collapsed SQL results keep only the reopen bar and skip heavy result markup", () => {
  const markup = render(<SqlPlaygroundResults collapsed onCollapsedChange={() => undefined} results={[{
    statementIndex: 0,
    sql: "SELECT 1",
    kind: "rows",
    columns: ["value"],
    rows: [[1]],
    rowCount: 1,
    truncated: false,
    changes: 0,
    durationMs: 1,
  }]} />);
  assert.match(markup, /is-collapsed/);
  assert.match(markup, /aria-expanded="false"/);
  assert.doesNotMatch(markup, /<table>/);
});

test("SQL playground errors expose a useful SQLite detail through a polite live region", () => {
  const markup = render(<SqlPlaygroundError error={{ operation: "execute", message: "UNIQUE constraint failed: student.id", statementIndex: 0, recoverable: true }} />);
  assert.match(markup, /aria-live="polite"/);
  assert.match(markup, /La query non è stata eseguita|The query was not run/);
  assert.match(markup, /UNIQUE constraint failed/);
  assert.match(markup, /Errore nell&#x27;istruzione 1|Error in statement 1/);
});
