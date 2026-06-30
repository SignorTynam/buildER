import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectTextFilePanel } from "../src/components/project/ProjectTextFilePanel.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("ProjectTextFilePanel renderizza editor note per file txt", () => {
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <ProjectTextFilePanel
        fileName="notes.txt"
        content="Project note"
        editable
        onChange={() => undefined}
      />
    </I18nProvider>,
  );

  assert.match(markup, /notes\.txt/);
  assert.match(markup, /textarea/);
  assert.match(markup, /Project note/);
});
