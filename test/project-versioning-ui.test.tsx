import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { CommitDialog } from "../src/components/versioning/CommitDialog.tsx";
import { RestoreVersionDialog } from "../src/components/versioning/RestoreVersionDialog.tsx";
import { VersionDiffDialog } from "../src/components/versioning/VersionDiffDialog.tsx";
import { VersioningPanel } from "../src/components/versioning/VersioningPanel.tsx";
import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { DEFAULT_LOCALE, setCurrentLocale } from "../src/i18n/index.ts";
import { buildProjectCommitDraft, createProjectCommitSnapshot } from "../src/features/versioning/projectCommitSnapshot.ts";
import {
  buildProjectVersionDiff,
  createProjectVersionDiffFromCommitAndSnapshot,
  createProjectVersionDiffFromCommits,
} from "../src/features/versioning/projectVersionDiff.ts";
import {
  createProjectCommitInState,
  getProjectUncommittedChangeState,
} from "../src/features/versioning/useProjectVersioning.ts";
import { createEmptyDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import { createEmptyProjectVersioningState } from "../src/utils/projectFile.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const VIEWPORT = { x: 0, y: 0, zoom: 1 };
const EMPTY_CATEGORIES = {
  er: false,
  layout: false,
  logical: false,
  code: false,
  workspace: false,
  versioning: false,
};

function renderWithI18n(element: React.ReactElement): string {
  return renderToStaticMarkup(<I18nProvider>{element}</I18nProvider>);
}

function createSnapshot() {
  const diagram = createEmptyDiagram("Versioning UI");
  diagram.nodes = [
    { id: "entity-a", type: "entity", label: "Cliente", x: 10, y: 20, width: 140, height: 64 },
    { id: "attribute-a", type: "attribute", label: "Nome", x: 220, y: 20, width: 100, height: 48 },
  ];
  diagram.edges = [
    {
      id: "edge-a",
      type: "attribute",
      sourceId: "entity-a",
      targetId: "attribute-a",
      label: "",
      lineStyle: "solid",
    },
  ];
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  return createProjectCommitSnapshot({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: false,
    logicalStage: "translation",
    diagramView: "er",
    tool: "select",
    mode: "edit",
    viewport: VIEWPORT,
    selection: { nodeIds: ["entity-a"], edgeIds: [] },
    translationViewport: VIEWPORT,
    translationSelection: { nodeIds: [], edgeIds: [] },
    logicalViewport: VIEWPORT,
    logicalSelection: { nodeId: null, columnId: null, edgeId: null },
    codeDraft: "entity Cliente",
    codeDirty: true,
    technicalPanelOpen: true,
    technicalPanelTab: "code",
    codePanelOpen: true,
    codePanelWidth: 360,
    notesPanelOpen: false,
    notesPanelWidth: 320,
    toolbarCollapsed: false,
    focusMode: false,
    toolbarWidth: 208,
    showDiagnostics: true,
  });
}

test("dialog commit si apre con input messaggio, descrizione ed errore", () => {
  setCurrentLocale("it");
  const markup = renderWithI18n(
    <CommitDialog
      open
      busy={false}
      error="Messaggio obbligatorio"
      canCommit
      hint=""
      categories={{ ...EMPTY_CATEGORIES, er: true }}
      firstCommit={false}
      onClose={() => undefined}
      onSubmit={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="commit-dialog"/);
  assert.match(markup, /data-testid="commit-message-input"/);
  assert.match(markup, /data-testid="commit-description-input"/);
  assert.match(markup, /data-testid="create-commit-button"/);
  assert.match(markup, /Nuovo commit/);
  assert.match(markup, /Messaggio obbligatorio/);
  assert.match(markup, /Suggerimento messaggio/);
  assert.match(markup, /Aggiornato schema ER/);
  assert.match(markup, /Modifiche allo schema ER/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("dialog commit disabilita la creazione quando non ci sono modifiche", () => {
  setCurrentLocale("it");
  const markup = renderWithI18n(
    <CommitDialog
      open
      busy={false}
      error=""
      canCommit={false}
      hint="Nessuna modifica rispetto a HEAD"
      categories={EMPTY_CATEGORIES}
      firstCommit={false}
      onClose={() => undefined}
      onSubmit={() => undefined}
    />,
  );

  assert.match(markup, /Nessuna modifica rispetto a HEAD/);
  assert.match(markup, /<button type="submit" class="mode-button active" disabled="" data-testid="create-commit-button"/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("pannello Versioni mostra modifiche non committate, categorie, HEAD, messaggio e statistiche", async () => {
  setCurrentLocale("it");
  const snapshot = createSnapshot();
  const commit = await buildProjectCommitDraft({
    id: "commit-ui-test",
    parentId: null,
    message: "Schema iniziale",
    description: "Prima versione stabile",
    createdAt: "2026-06-26T10:00:00.000Z",
    snapshot,
    automatic: false,
    tags: [],
  });
  const changedSnapshot = createProjectCommitSnapshot({
    ...snapshot,
    codeDraft: "entity Cliente\nentity Ordine",
    codeDirty: true,
    codePanelOpen: false,
  });
  const changeState = getProjectUncommittedChangeState(
    {
      ...createEmptyProjectVersioningState(),
      headCommitId: commit.id,
      commits: [commit],
    },
    changedSnapshot,
  );
  const markup = renderWithI18n(
    <VersioningPanel
      open
      commits={[commit]}
      headCommitId={commit.id}
      changeState={changeState}
      onClose={() => undefined}
      onNewCommit={() => undefined}
      onCompareWithCurrent={() => undefined}
      onCompareWithHead={() => undefined}
      onRestoreCommit={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="versioning-panel"/);
  assert.match(markup, /data-testid="versioning-uncommitted"/);
  assert.match(markup, /data-testid="versioning-change-categories"/);
  assert.match(markup, /data-testid="versioning-timeline"/);
  assert.match(markup, /Modifiche al codice/);
  assert.match(markup, /Modifiche al workspace/);
  assert.match(markup, /Schema iniziale/);
  assert.match(markup, /Prima versione stabile/);
  assert.match(markup, /HEAD/);
  assert.match(markup, /Commit manuale/);
  assert.match(markup, /Ripristina/);
  assert.match(markup, /Confronta con corrente/);
  assert.match(markup, /Entit(?:à|&#xE0;): 1/);
  assert.match(markup, /Attributi: 1/);
  assert.match(markup, /Edge: 1/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("pannello Versioni mostra lo stato vuoto", () => {
  setCurrentLocale("it");
  const emptyState = getProjectUncommittedChangeState(createEmptyProjectVersioningState(), createSnapshot());
  const noContentState = {
    ...emptyState,
    status: "no-head-empty" as const,
    hasChanges: false,
    summary: { changedCategoryCount: 0, canCommit: false },
  };
  const markup = renderWithI18n(
    <VersioningPanel
      open
      commits={[]}
      headCommitId={null}
      changeState={noContentState}
      onClose={() => undefined}
      onNewCommit={() => undefined}
      onCompareWithCurrent={() => undefined}
      onCompareWithHead={() => undefined}
      onRestoreCommit={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="versioning-empty"/);
  assert.match(markup, /Nessuna versione salvata/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("pannello Versioni mostra CTA primo commit quando manca HEAD ma c'e contenuto", () => {
  setCurrentLocale("it");
  const snapshot = createSnapshot();
  const changeState = getProjectUncommittedChangeState(createEmptyProjectVersioningState(), snapshot);
  const markup = renderWithI18n(
    <VersioningPanel
      open
      commits={[]}
      headCommitId={null}
      changeState={changeState}
      onClose={() => undefined}
      onNewCommit={() => undefined}
      onCompareWithCurrent={() => undefined}
      onCompareWithHead={() => undefined}
      onRestoreCommit={() => undefined}
    />,
  );

  assert.match(markup, /Questo progetto non ha ancora commit/);
  assert.match(markup, /Crea primo commit/);
  assert.match(markup, /Modifiche allo schema ER/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("pannello Versioni mostra working copy pulita quando HEAD e invariato", async () => {
  setCurrentLocale("it");
  const snapshot = createSnapshot();
  const result = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot,
    message: "Schema iniziale",
  });
  assert.equal(result.status, "created");
  if (result.status !== "created") {
    return;
  }
  const markup = renderWithI18n(
    <VersioningPanel
      open
      commits={result.versioning.commits}
      headCommitId={result.commit.id}
      changeState={getProjectUncommittedChangeState(result.versioning, snapshot)}
      onClose={() => undefined}
      onNewCommit={() => undefined}
      onCompareWithCurrent={() => undefined}
      onCompareWithHead={() => undefined}
      onRestoreCommit={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="versioning-clean"/);
  assert.match(markup, /Working copy pulita/);
  assert.match(markup, /Nessuna modifica rispetto a HEAD/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("pannello Versioni mostra azione Confronta con HEAD per commit non HEAD", async () => {
  setCurrentLocale("it");
  const base = createSnapshot();
  const first = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: base,
    message: "Schema iniziale",
  });
  assert.equal(first.status, "created");
  if (first.status !== "created") {
    return;
  }
  const changed = createProjectCommitSnapshot({
    ...base,
    codeDraft: "entity Cliente\nentity Ordine",
    codeDirty: true,
    codePanelOpen: false,
  });
  const second = await createProjectCommitInState(first.versioning, {
    snapshot: changed,
    message: "Schema aggiornato",
  });
  assert.equal(second.status, "created");
  if (second.status !== "created") {
    return;
  }

  const markup = renderWithI18n(
    <VersioningPanel
      open
      commits={second.versioning.commits}
      headCommitId={second.commit.id}
      changeState={getProjectUncommittedChangeState(second.versioning, changed)}
      onClose={() => undefined}
      onNewCommit={() => undefined}
      onCompareWithCurrent={() => undefined}
      onCompareWithHead={() => undefined}
      onRestoreCommit={() => undefined}
    />,
  );

  assert.match(markup, /Confronta con corrente/);
  assert.match(markup, /Ripristina/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("timeline distingue commit manuale, backup e restore automatici", async () => {
  setCurrentLocale("it");
  const snapshot = createSnapshot();
  const manual = await buildProjectCommitDraft({
    id: "manual-commit",
    parentId: null,
    message: "Schema iniziale",
    createdAt: "2026-06-27T09:00:00.000Z",
    snapshot,
  });
  const backup = await buildProjectCommitDraft({
    id: "backup-commit",
    parentId: manual.id,
    message: "Backup automatico prima del ripristino",
    createdAt: "2026-06-27T10:00:00.000Z",
    snapshot,
    automatic: true,
    tags: ["auto-backup"],
  });
  const restore = await buildProjectCommitDraft({
    id: "restore-commit",
    parentId: backup.id,
    message: "Ripristino di: Schema iniziale",
    createdAt: "2026-06-27T11:00:00.000Z",
    snapshot,
    automatic: true,
    tags: ["auto-restore"],
  });
  const versioning = {
    ...createEmptyProjectVersioningState(),
    headCommitId: restore.id,
    commits: [manual, backup, restore],
  };
  const markup = renderWithI18n(
    <VersioningPanel
      open
      commits={[restore, backup, manual]}
      headCommitId={restore.id}
      changeState={getProjectUncommittedChangeState(versioning, snapshot)}
      onClose={() => undefined}
      onNewCommit={() => undefined}
      onCompareWithCurrent={() => undefined}
      onCompareWithHead={() => undefined}
      onRestoreCommit={() => undefined}
    />,
  );

  assert.match(markup, /Commit manuale/);
  assert.match(markup, /Backup automatico/);
  assert.match(markup, /Commit di restore/);
  assert.match(markup, /auto-backup/);
  assert.match(markup, /auto-restore/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("RestoreVersionDialog mostra conferma e commit target", async () => {
  setCurrentLocale("it");
  const commit = await buildProjectCommitDraft({
    id: "restore-target",
    parentId: null,
    message: "Schema iniziale",
    description: "Versione stabile",
    createdAt: "2026-06-27T10:00:00.000Z",
    snapshot: createSnapshot(),
  });

  const markup = renderWithI18n(
    <RestoreVersionDialog
      open
      busy={false}
      error=""
      commit={commit}
      onClose={() => undefined}
      onConfirm={() => undefined}
    />,
  );

  assert.match(markup, /data-testid="restore-version-dialog"/);
  assert.match(markup, /Ripristina versione/);
  assert.match(markup, /Schema iniziale/);
  assert.match(markup, /Prima del ripristino/);
  assert.match(markup, /data-testid="confirm-restore-button"/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("VersionDiffDialog mostra riepilogo, sezioni e una modifica", () => {
  setCurrentLocale("it");
  const base = createSnapshot();
  const changed = createProjectCommitSnapshot({
    ...base,
    codeDraft: "entity Cliente\nentity Ordine",
    codeDirty: true,
    codePanelOpen: false,
  });
  const diff = buildProjectVersionDiff(base, changed, {
    leftLabel: "Schema iniziale",
    rightLabel: "Working copy",
  });
  const markup = renderWithI18n(
    <VersionDiffDialog open diff={diff} onClose={() => undefined} />,
  );

  assert.match(markup, /data-testid="version-diff-dialog"/);
  assert.match(markup, /Confronto versioni/);
  assert.match(markup, /Riepilogo/);
  assert.match(markup, /ER/);
  assert.match(markup, /Layout/);
  assert.match(markup, /Modello logico/);
  assert.match(markup, /Codice/);
  assert.match(markup, /Workspace/);
  assert.match(markup, /Codice modificato/);
  assert.match(markup, /Nessuna modifica in questa sezione/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("VersionDiffDialog mostra empty state se le versioni sono identiche", () => {
  setCurrentLocale("it");
  const snapshot = createSnapshot();
  const diff = buildProjectVersionDiff(snapshot, snapshot, {
    leftLabel: "Schema iniziale",
    rightLabel: "Schema iniziale",
  });
  const markup = renderWithI18n(
    <VersionDiffDialog open diff={diff} onClose={() => undefined} />,
  );

  assert.match(markup, /Le due versioni sono identiche/);
  assert.match(markup, /Nessuna modifica/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("funzioni diff commit usate dalla UI producono confronti commit e working copy", async () => {
  const base = createSnapshot();
  const first = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: base,
    message: "Schema iniziale",
  });
  assert.equal(first.status, "created");
  if (first.status !== "created") {
    return;
  }
  const changed = createProjectCommitSnapshot({
    ...base,
    codeDraft: "entity Cliente\nentity Ordine",
    codeDirty: true,
    codePanelOpen: false,
  });
  const second = await createProjectCommitInState(first.versioning, {
    snapshot: changed,
    message: "Schema aggiornato",
  });
  assert.equal(second.status, "created");
  if (second.status !== "created") {
    return;
  }

  assert.equal(createProjectVersionDiffFromCommits(second.versioning, first.commit.id, second.commit.id).status, "ok");
  assert.equal(createProjectVersionDiffFromCommitAndSnapshot(second.versioning, first.commit.id, changed).status, "ok");
});
