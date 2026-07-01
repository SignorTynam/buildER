import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CodePanel } from "../src/components/CodePanel.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("CodePanel embedded non mostra caption CODE ne bottone close", () => {
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <CodePanel
        embedded
        showHeader={false}
        showCloseButton={false}
        code="entity Course"
        editable
        onCodeChange={() => undefined}
        onClose={() => undefined}
      />
    </I18nProvider>,
  );

  assert.match(markup, /diagram-code-panel embedded/);
  assert.match(markup, /--line-number-digits:1/);
  assert.match(markup, /textarea/);
  assert.doesNotMatch(markup, />CODE</);
  assert.doesNotMatch(markup, /designer-panel-close/);
});

test("CodePanel embedded CSS rimuove padding e occupa altezza completa", () => {
  const css = readFileSync(new URL("../src/styles/project-explorer.css", import.meta.url), "utf8");

  assert.match(css, /\.diagram-code-panel\.embedded\s*\{[\s\S]*height:\s*100%/);
  assert.match(css, /\.diagram-code-panel\.embedded\s*\{[\s\S]*padding:\s*0/);
  assert.match(css, /\.diagram-code-panel\.embedded \.designer-code-editor\s*\{[\s\S]*height:\s*100%/);
  assert.match(css, /\.diagram-code-panel\.embedded \.designer-code-editor\s*\{[\s\S]*padding:\s*0/);
  assert.match(css, /\.diagram-code-panel\.embedded \.designer-code-scroll-layer\s*\{[\s\S]*height:\s*100%/);
  assert.match(css, /\.diagram-code-panel\.embedded \.designer-code-line-numbers\s*\{[\s\S]*max-width:\s*40px/);
  assert.match(css, /--line-number-digits/);
});
