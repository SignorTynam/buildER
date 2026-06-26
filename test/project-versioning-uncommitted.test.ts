import assert from "node:assert/strict";
import test from "node:test";

import {
  createProjectCommitSnapshot,
  type ProjectCommitSnapshot,
} from "../src/features/versioning/projectCommitSnapshot.ts";
import {
  createProjectCommitInState,
  getProjectUncommittedChangeState,
  hasProjectUncommittedChanges,
} from "../src/features/versioning/useProjectVersioning.ts";
import { createEmptyDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import { createEmptyProjectVersioningState } from "../src/utils/projectFile.ts";

const VIEWPORT = { x: 180, y: 110, zoom: 1 };

function createSnapshot(label = "A"): ProjectCommitSnapshot {
  const diagram = createEmptyDiagram("Uncommitted project");
  if (label) {
    diagram.nodes = [{ id: "entity-a", type: "entity", label, x: 10, y: 20, width: 140, height: 64 }];
  }
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
    codePanelWidth: 340,
    notesPanelOpen: false,
    notesPanelWidth: 330,
    toolbarCollapsed: false,
    focusMode: false,
    toolbarWidth: 208,
    showDiagnostics: true,
  });
}

function cloneSnapshot(snapshot: ProjectCommitSnapshot): ProjectCommitSnapshot {
  return createProjectCommitSnapshot(JSON.parse(JSON.stringify(snapshot)));
}

async function createHead(snapshot: ProjectCommitSnapshot) {
  const result = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot,
    message: "HEAD",
  });
  assert.equal(result.status, "created");
  if (result.status !== "created") {
    throw new Error("expected commit");
  }

  return result.versioning;
}

test("stato non committato distingue no HEAD vuoto, contenuto, clean e dirty", async () => {
  const empty = createSnapshot("");
  const emptyState = getProjectUncommittedChangeState(createEmptyProjectVersioningState(), empty);
  assert.equal(emptyState.status, "no-head-empty");
  assert.equal(emptyState.hasChanges, false);
  assert.equal(emptyState.summary.canCommit, false);

  const content = createSnapshot("A");
  const contentState = getProjectUncommittedChangeState(createEmptyProjectVersioningState(), content);
  assert.equal(contentState.status, "no-head-with-content");
  assert.equal(contentState.hasChanges, true);
  assert.equal(contentState.summary.canCommit, true);
  assert.equal(contentState.categories.er, true);

  const versioning = await createHead(content);
  const cleanState = getProjectUncommittedChangeState(versioning, content);
  assert.equal(cleanState.status, "clean");
  assert.equal(cleanState.hasChanges, false);
  assert.equal(cleanState.summary.canCommit, false);

  const dirty = cloneSnapshot(content);
  dirty.diagram.nodes[0].label = "B";
  const dirtyState = getProjectUncommittedChangeState(versioning, dirty);
  assert.equal(dirtyState.status, "dirty");
  assert.equal(dirtyState.hasChanges, true);
  assert.equal(dirtyState.summary.canCommit, true);
});

test("categorie: label entita e relazione cambiano lo schema ER", async () => {
  const base = createSnapshot("A");
  const versioning = await createHead(base);

  const renamed = cloneSnapshot(base);
  renamed.diagram.nodes[0].label = "Cliente";
  assert.equal(getProjectUncommittedChangeState(versioning, renamed).categories.er, true);

  const withRelation = cloneSnapshot(base);
  withRelation.diagram.nodes.push({ id: "rel-a", type: "relationship", label: "Ordina", x: 220, y: 20, width: 130, height: 78 });
  assert.equal(getProjectUncommittedChangeState(versioning, withRelation).categories.er, true);
});

test("categorie: layout, viewport, logical, code, workspace e selection sono classificati", async () => {
  const base = createSnapshot("A");
  const versioning = await createHead(base);

  const moved = cloneSnapshot(base);
  moved.diagram.nodes[0].x += 30;
  let state = getProjectUncommittedChangeState(versioning, moved);
  assert.equal(state.categories.layout, true);
  assert.equal(state.categories.er, false);

  const zoomed = cloneSnapshot(base);
  zoomed.viewport = { ...zoomed.viewport, zoom: 1.5 };
  state = getProjectUncommittedChangeState(versioning, zoomed);
  assert.equal(state.categories.layout, true);

  const logical = cloneSnapshot(base);
  logical.logicalGenerated = true;
  logical.logicalStage = "schema";
  state = getProjectUncommittedChangeState(versioning, logical);
  assert.equal(state.categories.logical, true);

  const code = cloneSnapshot(base);
  code.codeDraft = "entity A";
  code.codeDirty = true;
  state = getProjectUncommittedChangeState(versioning, code);
  assert.equal(state.categories.code, true);

  const panel = cloneSnapshot(base);
  panel.codePanelOpen = true;
  state = getProjectUncommittedChangeState(versioning, panel);
  assert.equal(state.categories.workspace, true);

  const selected = cloneSnapshot(base);
  selected.selection = { nodeIds: ["entity-a"], edgeIds: [] };
  state = getProjectUncommittedChangeState(versioning, selected);
  assert.equal(state.categories.workspace, true);
});

test("hasProjectUncommittedChanges continua a riflettere lo stato strutturato", async () => {
  const base = createSnapshot("A");
  const versioning = await createHead(base);
  const dirty = cloneSnapshot(base);
  dirty.codePanelOpen = true;

  assert.equal(hasProjectUncommittedChanges(versioning, base), false);
  assert.equal(hasProjectUncommittedChanges(versioning, dirty), true);
});
