import assert from "node:assert/strict";
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
  assert.match(markup, /textarea/);
  assert.doesNotMatch(markup, />CODE</);
  assert.doesNotMatch(markup, /designer-panel-close/);
});
