import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SourceControlPanel } from "../src/components/versioning/SourceControlPanel.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { createEmptyProjectVersioningState } from "../src/utils/projectFile.ts";
import { getProjectUncommittedChangeState } from "../src/features/versioning/useProjectVersioning.ts";
import { createProjectWideSnapshotForTest } from "./support/projectWideSnapshot.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("Source Control panel mostra repository, changes, input e bottone commit", () => {
  const snapshot = createProjectWideSnapshotForTest();
  const changeState = getProjectUncommittedChangeState(createEmptyProjectVersioningState(), snapshot);
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <SourceControlPanel
        projectName="ER Studio"
        branchName="newfeatures"
        commitMessage="Initial commit"
        changeState={changeState}
        files={snapshot.files ?? {}}
        commits={[]}
        onCommitMessageChange={() => undefined}
        onCommit={() => undefined}
        onOpenHistory={() => undefined}
        onRefresh={() => undefined}
      />
    </I18nProvider>,
  );

  assert.match(markup, /Source Control/i);
  assert.match(markup, /Repositories/i);
  assert.match(markup, /Changes/i);
  assert.match(markup, /newfeatures/);
  assert.match(markup, /textarea/);
  assert.match(markup, /Create first commit|Crea primo commit/);
});

test("Source Control panel supporta Ctrl+Enter per commit", () => {
  const source = readFileSync(new URL("../src/components/versioning/SourceControlPanel.tsx", import.meta.url), "utf8");

  assert.match(source, /event\.key === "Enter"/);
  assert.match(source, /onCommit\(\)/);
});
