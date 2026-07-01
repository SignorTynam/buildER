import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { SourceControlPanel } from "../src/components/versioning/SourceControlPanel.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { createEmptyProjectVersioningState } from "../src/utils/projectFile.ts";
import {
  createProjectCommitInState,
  getProjectUncommittedChangeState,
} from "../src/features/versioning/useProjectVersioning.ts";
import { createProjectWideSnapshotForTest } from "./support/projectWideSnapshot.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

test("Source Control panel mostra repository, changes, input e bottone commit", () => {
  const snapshot = createProjectWideSnapshotForTest();
  const changeState = getProjectUncommittedChangeState(createEmptyProjectVersioningState(), snapshot);
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <SourceControlPanel
        projectName="ER Studio"
        commitMessage="Initial commit"
        changeState={changeState}
        commits={[]}
        headCommitId={null}
        selectedCommitId={null}
        onCommitMessageChange={() => undefined}
        onCommit={() => undefined}
        onRefresh={() => undefined}
        onSelectCommit={() => undefined}
        onCompareWithCurrent={() => undefined}
        onCompareWithHead={() => undefined}
        onCompareWithParent={() => undefined}
        onRestoreCommit={() => undefined}
        onDeleteCommit={() => undefined}
      />
    </I18nProvider>,
  );

  assert.match(markup, /Source Control/i);
  assert.match(markup, /Repositories/i);
  assert.match(markup, /Changes/i);
  assert.doesNotMatch(markup, /newfeatures/);
  assert.match(markup, /textarea/);
  assert.match(markup, /Create first commit|Crea primo commit/);
});

test("Source Control panel mostra branch pill logiche senza branch fake", () => {
  const source = readFileSync(new URL("../src/components/versioning/SourceControlPanel.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /branchName/);
  assert.match(source, /source-control-branch-pill/);
  assert.doesNotMatch(source, /newfeatures/);
});

test("Source Control panel supporta Ctrl+Enter per commit", () => {
  const source = readFileSync(new URL("../src/components/versioning/SourceControlPanel.tsx", import.meta.url), "utf8");

  assert.match(source, /event\.key === "Enter"/);
  assert.match(source, /onCommit\(\)/);
});

test("App non monta piu la modal Versioni progetto dal Source Control", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /components\/versioning\/VersioningPanel/);
  assert.doesNotMatch(source, /components\/versioning\/CommitDialog/);
  assert.doesNotMatch(source, /components\/versioning\/RestoreVersionDialog/);
  assert.doesNotMatch(source, /<VersioningPanel/);
  assert.doesNotMatch(source, /<CommitDialog/);
  assert.doesNotMatch(source, /<RestoreVersionDialog/);
  assert.doesNotMatch(source, /studio-modal versioning-panel/);
});

test("App marca dirty i tab usando i file modificati e non il dirty globale", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const visibleTabsStart = source.indexOf("const visibleProjectTabs");
  const visibleTabsEnd = source.indexOf("const visibleActivityIssues", visibleTabsStart);
  const visibleTabsSource = source.slice(visibleTabsStart, visibleTabsEnd);

  assert.match(source, /applyProjectTabDirtyFileIds/);
  assert.match(source, /versioningChangeState\.files\.map\(\(file\) => file\.fileId\)/);
  assert.doesNotMatch(visibleTabsSource, /hasVersioningUncommittedChanges/);
});

test("Source Control panel renderizza graph scrollabile e dettagli commit selezionato", async () => {
  let versioning = createEmptyProjectVersioningState();
  const snapshot = createProjectWideSnapshotForTest();
  for (let index = 0; index < 30; index += 1) {
    const nextSnapshot = createProjectWideSnapshotForTest();
    const textFile = Object.values(nextSnapshot.files ?? {}).find((file) => file.kind === "text");
    assert.ok(textFile && textFile.kind === "text");
    nextSnapshot.files = {
      ...(nextSnapshot.files ?? {}),
      [textFile.id]: {
        ...textFile,
        content: `note ${index}`,
      },
    };
    const result = await createProjectCommitInState(versioning, {
      snapshot: nextSnapshot,
      message: `Commit ${index}`,
    });
    assert.equal(result.status, "created");
    if (result.status !== "created") throw new Error("commit failed");
    versioning = result.versioning;
  }
  const commits = [...versioning.commits].reverse();
  const selected = commits[0];
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <SourceControlPanel
        projectName="ER Studio"
        commitMessage=""
        changeState={getProjectUncommittedChangeState(versioning, snapshot)}
        commits={commits}
        headCommitId={versioning.headCommitId}
        selectedCommitId={selected.id}
        onCommitMessageChange={() => undefined}
        onCommit={() => undefined}
        onRefresh={() => undefined}
        onSelectCommit={() => undefined}
        onCompareWithCurrent={() => undefined}
        onCompareWithHead={() => undefined}
        onCompareWithParent={() => undefined}
        onRestoreCommit={() => undefined}
        onDeleteCommit={() => undefined}
      />
    </I18nProvider>,
  );

  assert.match(markup, /data-testid="source-control-history-scroll"/);
  assert.match(markup, /source-control-graph-row/);
  assert.match(markup, /source-control-commit-details/);
  assert.match(markup, /Delete commit/);
});
