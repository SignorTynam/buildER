import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_VIEWPORT,
  WORKSPACE_SESSION_STORAGE_KEY,
  createDefaultWorkspaceSessionBootstrap,
  readWorkspaceSessionBootstrap,
  saveWorkspaceSessionSnapshot,
  serializeWorkspaceSessionSnapshot,
} from "../src/features/workspace/workspaceSession.ts";
import { createEmptyProjectVersioningState } from "../src/utils/projectFile.ts";
import type { WorkspaceView } from "../src/types/translation.ts";

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function createValidSnapshot(overrides: Partial<Parameters<typeof serializeWorkspaceSessionSnapshot>[0]> = {}) {
  const bootstrap = createDefaultWorkspaceSessionBootstrap();

  return serializeWorkspaceSessionSnapshot({
    diagram: bootstrap.diagram,
    translationWorkspace: bootstrap.translationWorkspace,
    logicalWorkspace: bootstrap.logicalWorkspace,
    logicalGenerated: bootstrap.logicalGenerated,
    logicalStage: bootstrap.logicalStage,
    diagramView: bootstrap.diagramView,
    tool: bootstrap.tool,
    mode: bootstrap.mode,
    viewport: bootstrap.viewport,
    selection: bootstrap.selection,
    translationViewport: bootstrap.translationViewport,
    translationSelection: bootstrap.translationSelection,
    logicalViewport: bootstrap.logicalViewport,
    logicalSelection: bootstrap.logicalSelection,
    codeDraft: bootstrap.codeDraft,
    codeDirty: bootstrap.codeDirty,
    technicalPanelOpen: bootstrap.technicalPanelOpen,
    technicalPanelTab: bootstrap.technicalPanelTab,
    codePanelOpen: bootstrap.codePanelOpen,
    codePanelWidth: bootstrap.codePanelWidth,
    notesPanelOpen: bootstrap.notesPanelOpen,
    notesPanelWidth: bootstrap.notesPanelWidth,
    toolbarCollapsed: bootstrap.toolbarCollapsed,
    focusMode: bootstrap.focusMode,
    toolbarWidth: bootstrap.toolbarWidth,
    showDiagnostics: bootstrap.showDiagnostics,
    versioning: bootstrap.versioning,
    ...overrides,
  });
}

test("workspace session bootstrap defaults when storage is empty", () => {
  const restored = readWorkspaceSessionBootstrap(new MemoryStorage());

  assert.equal(restored.restored, false);
  assert.equal(restored.diagramView, "er");
  assert.equal(restored.tool, "select");
  assert.deepEqual(restored.viewport, DEFAULT_VIEWPORT);
});

test("workspace session bootstrap defaults when storage contains invalid JSON", () => {
  const storage = new MemoryStorage();
  storage.setItem(WORKSPACE_SESSION_STORAGE_KEY, "{invalid-json");

  const restored = readWorkspaceSessionBootstrap(storage);

  assert.equal(restored.restored, false);
  assert.equal(restored.diagramView, "er");
  assert.equal(restored.tool, "select");
});

for (const diagramView of ["er", "logical", "translation"] as const satisfies readonly WorkspaceView[]) {
  test(`workspace session restores saved ${diagramView} view`, () => {
    const storage = new MemoryStorage();
    saveWorkspaceSessionSnapshot(createValidSnapshot({ diagramView }), storage);

    const restored = readWorkspaceSessionBootstrap(storage);

    assert.equal(restored.restored, true);
    assert.equal(restored.diagramView, diagramView);
  });
}

test("workspace session sanitizes invalid tool, viewport, and selection", () => {
  const storage = new MemoryStorage();
  const snapshot = createValidSnapshot({
    tool: "connector",
    viewport: { x: 12, y: 34, zoom: 1.5 },
    selection: { nodeIds: ["node-a"], edgeIds: ["edge-a"] },
  });
  storage.setItem(
    WORKSPACE_SESSION_STORAGE_KEY,
    JSON.stringify({
      ...snapshot,
      tool: "invalid-tool",
      viewport: { x: "bad", y: 44, zoom: -3 },
      selection: { nodeIds: ["node-a", 42], edgeIds: ["edge-a", false] },
      logicalSelection: { tableId: "legacy-table", columnId: 99, edgeId: "edge-l" },
    }),
  );

  const restored = readWorkspaceSessionBootstrap(storage);

  assert.equal(restored.tool, "select");
  assert.deepEqual(restored.viewport, { x: DEFAULT_VIEWPORT.x, y: 44, zoom: DEFAULT_VIEWPORT.zoom });
  assert.deepEqual(restored.selection, { nodeIds: ["node-a"], edgeIds: ["edge-a"] });
  assert.deepEqual(restored.logicalSelection, { nodeId: "legacy-table", columnId: null, edgeId: "edge-l" });
});

test("workspace session restores the code drawer without reopening the technical panel", () => {
  const storage = new MemoryStorage();
  saveWorkspaceSessionSnapshot(
    createValidSnapshot({
      technicalPanelOpen: true,
      technicalPanelTab: "code",
      codePanelOpen: true,
      notesPanelOpen: false,
    }),
    storage,
  );

  const restored = readWorkspaceSessionBootstrap(storage);

  assert.equal(restored.technicalPanelOpen, false);
  assert.equal(restored.technicalPanelTab, "code");
  assert.equal(restored.codePanelOpen, true);
  assert.equal(restored.notesPanelOpen, false);
});

test("workspace session restores the notes technical panel", () => {
  const storage = new MemoryStorage();
  saveWorkspaceSessionSnapshot(
    createValidSnapshot({
      technicalPanelOpen: true,
      technicalPanelTab: "notes",
      codePanelOpen: false,
      notesPanelOpen: true,
    }),
    storage,
  );

  const restored = readWorkspaceSessionBootstrap(storage);

  assert.equal(restored.technicalPanelOpen, true);
  assert.equal(restored.technicalPanelTab, "notes");
  assert.equal(restored.codePanelOpen, false);
  assert.equal(restored.notesPanelOpen, true);
});

test("workspace session restores the review technical panel", () => {
  const storage = new MemoryStorage();
  saveWorkspaceSessionSnapshot(
    createValidSnapshot({
      technicalPanelOpen: true,
      technicalPanelTab: "review",
      codePanelOpen: false,
      notesPanelOpen: false,
    }),
    storage,
  );

  const restored = readWorkspaceSessionBootstrap(storage);

  assert.equal(restored.technicalPanelOpen, true);
  assert.equal(restored.technicalPanelTab, "review");
  assert.equal(restored.codePanelOpen, false);
  assert.equal(restored.notesPanelOpen, false);
});

test("workspace session keeps compatibility with older saved versions", () => {
  const storage = new MemoryStorage();
  const snapshot = createValidSnapshot({ diagramView: "translation", tool: "attribute" });
  storage.setItem(WORKSPACE_SESSION_STORAGE_KEY, JSON.stringify({ ...snapshot, version: 1 }));

  const restored = readWorkspaceSessionBootstrap(storage);

  assert.equal(restored.restored, true);
  assert.equal(restored.diagramView, "translation");
  assert.equal(restored.tool, "attribute");
  assert.equal(restored.logicalGenerated, false);
});

test("workspace session serializza e ripristina versioning", () => {
  const storage = new MemoryStorage();
  const versioning = {
    ...createEmptyProjectVersioningState(),
    enabled: false,
    settings: {
      maxCommits: 12,
      keepTaggedCommits: false,
      includeAutomaticCommits: true,
    },
  };
  const snapshot = createValidSnapshot({ versioning });
  saveWorkspaceSessionSnapshot(snapshot, storage);

  const raw = storage.getItem(WORKSPACE_SESSION_STORAGE_KEY);
  assert.ok(raw);
  assert.deepEqual(JSON.parse(raw).versioning, versioning);

  const restored = readWorkspaceSessionBootstrap(storage);
  assert.equal(restored.restored, true);
  assert.deepEqual(restored.versioning, versioning);
});

test("workspace session senza versioning usa uno stato vuoto", () => {
  const storage = new MemoryStorage();
  const snapshot = createValidSnapshot();
  storage.setItem(WORKSPACE_SESSION_STORAGE_KEY, JSON.stringify({ ...snapshot, version: 4, versioning: undefined }));

  const restored = readWorkspaceSessionBootstrap(storage);

  assert.equal(restored.restored, true);
  assert.deepEqual(restored.versioning, createEmptyProjectVersioningState());
});

test("workspace session con versioning malformato non crasha", () => {
  const storage = new MemoryStorage();
  const snapshot = createValidSnapshot();
  storage.setItem(
    WORKSPACE_SESSION_STORAGE_KEY,
    JSON.stringify({
      ...snapshot,
      versioning: {
        enabled: "yes",
        headCommitId: "missing",
        commits: [{ id: "", snapshot: null }],
      },
    }),
  );

  const restored = readWorkspaceSessionBootstrap(storage);

  assert.equal(restored.restored, true);
  assert.deepEqual(restored.versioning, createEmptyProjectVersioningState());
});
