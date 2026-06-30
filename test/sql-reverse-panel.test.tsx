import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SqlReversePanel } from "../src/components/reverse/SqlReversePanel.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("SqlReversePanel mostra editor SQL e azioni inline", () => {
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <SqlReversePanel
        sql="CREATE TABLE course (id INT);"
        errorMessage=""
        issues={[]}
        logicalIssues={[]}
        tableCount={1}
        unsupportedStatementCount={0}
        isPreviewReady={false}
        onSqlChange={() => undefined}
        onAnalyze={() => undefined}
        onLoadFile={() => undefined}
        onClear={() => undefined}
      />
    </I18nProvider>,
  );

  assert.match(markup, /SQL Reverse/);
  assert.match(markup, /textarea/);
  assert.match(markup, /Import SQL file/);
  assert.match(markup, /Analyze code/);
  assert.doesNotMatch(markup, /Open SQL Reverse workflow/);
});

test("Reverse inline workflow non usa piu SqlReverseInputModal in App", () => {
  const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(appSource, /<SqlReverseInputModal/);
  assert.match(appSource, /<SqlReversePanel/);
});
