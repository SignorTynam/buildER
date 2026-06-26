import assert from "node:assert/strict";
import test from "node:test";

import { createProjectCommitSnapshot } from "../src/features/versioning/projectCommitSnapshot.ts";
import {
  createProjectCommitInState,
  hasProjectUncommittedChanges,
} from "../src/features/versioning/useProjectVersioning.ts";
import { createEmptyDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import {
  createEmptyProjectVersioningState,
  parseProjectFile,
  serializeProjectFile,
} from "../src/utils/projectFile.ts";

const VIEWPORT = { x: 180, y: 110, zoom: 1 };

function createSnapshot(label = "A") {
  const diagram = createEmptyDiagram("Commit project");
  diagram.nodes = [{ id: "entity-a", type: "entity", label, x: 10, y: 20, width: 140, height: 64 }];
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  return {
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: false,
    logicalStage: "translation" as const,
    diagramView: "er" as const,
    viewport: VIEWPORT,
    translationViewport: VIEWPORT,
    logicalViewport: VIEWPORT,
    snapshot: createProjectCommitSnapshot({
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
      codeDraft: `entity ${label}`,
      codeDirty: true,
      technicalPanelOpen: true,
      technicalPanelTab: "code",
      codePanelOpen: true,
      codePanelWidth: 340,
      notesPanelOpen: false,
      notesPanelWidth: 330,
      toolbarCollapsed: false,
      focusMode: false,
      toolbarWidth: 208,
      showDiagnostics: true,
    }),
  };
}

test("creazione commit aggiorna HEAD e collega parentId", async () => {
  const firstProject = createSnapshot("A");
  const firstResult = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: firstProject.snapshot,
    message: "Schema iniziale",
  });

  assert.equal(firstResult.status, "created");
  if (firstResult.status !== "created") {
    return;
  }
  assert.equal(firstResult.commit.parentId, null);
  assert.equal(firstResult.versioning.headCommitId, firstResult.commit.id);
  assert.equal(firstResult.versioning.commits.length, 1);
  assert.equal(firstResult.commit.automatic, undefined);
  assert.equal(firstResult.commit.checksum.length > 0, true);
  assert.equal(firstResult.commit.stats.entityCount, 1);
  assert.equal(firstResult.commit.snapshot.codeDraft, "entity A");
  assert.deepEqual(firstResult.commit.snapshot.selection, { nodeIds: ["entity-a"], edgeIds: [] });

  const secondProject = createSnapshot("B");
  const secondResult = await createProjectCommitInState(firstResult.versioning, {
    snapshot: secondProject.snapshot,
    message: "Secondo schema",
    description: "Aggiornamento",
  });

  assert.equal(secondResult.status, "created");
  if (secondResult.status !== "created") {
    return;
  }
  assert.equal(secondResult.commit.parentId, firstResult.commit.id);
  assert.equal(secondResult.versioning.headCommitId, secondResult.commit.id);
  assert.equal(secondResult.versioning.commits.length, 2);
});

test("commit con messaggio vuoto o snapshot identico viene rifiutato", async () => {
  const project = createSnapshot("A");
  const emptyResult = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: project.snapshot,
    message: "   ",
  });

  assert.equal(emptyResult.status, "empty-message");

  const firstResult = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: project.snapshot,
    message: "Schema iniziale",
  });
  assert.equal(firstResult.status, "created");
  if (firstResult.status !== "created") {
    return;
  }

  const unchangedResult = await createProjectCommitInState(firstResult.versioning, {
    snapshot: project.snapshot,
    message: "Duplicato",
  });
  assert.equal(unchangedResult.status, "unchanged");
});

test("hasProjectUncommittedChanges confronta snapshot corrente e HEAD", async () => {
  const firstProject = createSnapshot("A");
  assert.equal(hasProjectUncommittedChanges(createEmptyProjectVersioningState(), firstProject.snapshot), true);

  const firstResult = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: firstProject.snapshot,
    message: "Schema iniziale",
  });
  assert.equal(firstResult.status, "created");
  if (firstResult.status !== "created") {
    return;
  }

  assert.equal(hasProjectUncommittedChanges(firstResult.versioning, firstProject.snapshot), false);
  assert.equal(hasProjectUncommittedChanges(firstResult.versioning, createSnapshot("B").snapshot), true);
});

test("hasProjectUncommittedChanges non segnala modifiche su progetto vuoto senza HEAD", () => {
  const diagram = createEmptyDiagram("Empty");
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  const emptySnapshot = createProjectCommitSnapshot({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: false,
    logicalStage: "translation",
    diagramView: "er",
    tool: "select",
    mode: "edit",
    viewport: VIEWPORT,
    selection: { nodeIds: [], edgeIds: [] },
    translationViewport: VIEWPORT,
    translationSelection: { nodeIds: [], edgeIds: [] },
    logicalViewport: VIEWPORT,
    logicalSelection: { nodeId: null, columnId: null, edgeId: null },
    codeDraft: "",
    codeDirty: false,
    technicalPanelOpen: false,
    technicalPanelTab: "review",
    codePanelOpen: false,
    codePanelWidth: 320,
    notesPanelOpen: false,
    notesPanelWidth: 320,
    toolbarCollapsed: false,
    focusMode: false,
    toolbarWidth: 208,
    showDiagnostics: true,
  });

  assert.equal(hasProjectUncommittedChanges(createEmptyProjectVersioningState(), emptySnapshot), false);
});

test("versioning con commit viene mantenuto dopo serializeProjectFile e parseProjectFile", async () => {
  const project = createSnapshot("A");
  const result = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: project.snapshot,
    message: "Schema iniziale",
  });

  assert.equal(result.status, "created");
  if (result.status !== "created") {
    return;
  }

  const parsed = parseProjectFile(serializeProjectFile({
    diagram: project.diagram,
    translationWorkspace: project.translationWorkspace,
    logicalWorkspace: project.logicalWorkspace,
    logicalGenerated: false,
    logicalStage: "translation",
    diagramView: "er",
    viewport: VIEWPORT,
    translationViewport: VIEWPORT,
    logicalViewport: VIEWPORT,
    versioning: result.versioning,
  }));

  assert.equal(parsed.state.versioning.headCommitId, result.commit.id);
  assert.equal(parsed.state.versioning.commits.length, 1);
  assert.equal(parsed.state.versioning.commits[0]?.message, "Schema iniziale");
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.codePanelOpen, true);
});

test("vecchio progetto senza versioning continua a caricarsi", () => {
  const project = createSnapshot("Legacy");
  const document = JSON.parse(serializeProjectFile({
    diagram: project.diagram,
    translationWorkspace: project.translationWorkspace,
    logicalWorkspace: project.logicalWorkspace,
    logicalGenerated: false,
    logicalStage: "translation",
    diagramView: "er",
    viewport: VIEWPORT,
    translationViewport: VIEWPORT,
    logicalViewport: VIEWPORT,
  }));
  document.version = 4;
  delete document.versioning;

  const parsed = parseProjectFile(JSON.stringify(document));

  assert.deepEqual(parsed.state.versioning, createEmptyProjectVersioningState());
});
