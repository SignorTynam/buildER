import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ProjectTextFileModal } from "../src/components/project/ProjectTextFileModal.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("ProjectTextFileModal renderizza editor note per file txt", () => {
  const source = readFileSync(new URL("../src/components/project/ProjectTextFileModal.tsx", import.meta.url), "utf8");
  const markup = renderToStaticMarkup(
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
  assert.match(source, /useEscapeKey\(open, onClose\)/);
});

test("App apre txt in modal e non usa ProjectTextFilePanel nel pannello activity", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.match(source, /setTextFileModalFileId\(fileId\)/);
  assert.match(source, /<ProjectTextFileModal/);
  assert.doesNotMatch(source, /<ProjectTextFilePanel/);
  assert.doesNotMatch(source, /note-file-panel/);
});
