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
import {
  buildProjectCommitDraft,
  createProjectCommitSnapshot,
} from "../src/features/versioning/projectCommitSnapshot.ts";
import { createProjectCommitInState } from "../src/features/versioning/useProjectVersioning.ts";
import { PROJECT_RESTORE_BACKUP_TAG, PROJECT_RESTORE_TAG } from "../src/features/versioning/projectVersionRestore.ts";
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
    project: bootstrap.project,
    files: bootstrap.files,
    explorerView: bootstrap.explorerView,
    ...overrides,
  });
}

function createVersioningCommitSnapshot(name: string) {
  const bootstrap = createDefaultWorkspaceSessionBootstrap();

  return createProjectCommitSnapshot({
    diagram: {
      ...bootstrap.diagram,
      meta: {
        ...bootstrap.diagram.meta,
        name,
      },
    },
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
  });
}

test("workspace session bootstrap defaults when storage is empty", () => {
  const restored = readWorkspaceSessionBootstrap(new MemoryStorage());

  assert.equal(restored.restored, false);
  assert.equal(restored.diagramView, "er");
  assert.equal(restored.tool, "select");
  assert.deepEqual(restored.viewport, DEFAULT_VIEWPORT);
  assert.equal(restored.project.activeFileId, null);
  assert.equal(restored.explorerView.activeFileId, null);
  assert.equal(Object.keys(restored.files).length, 0);
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

test("workspace session preserva commit automatici di backup e restore", async () => {
  const storage = new MemoryStorage();
  const baseSnapshot = createVersioningCommitSnapshot("Schema iniziale");
  const updatedSnapshot = createVersioningCommitSnapshot("Schema aggiornato");
  const restoredSnapshot = createVersioningCommitSnapshot("Schema ripristinato");
  const initialCommit = await buildProjectCommitDraft({
    id: "commit-initial",
    parentId: null,
    message: "Schema iniziale",
    createdAt: "2026-06-27T09:00:00.000Z",
    snapshot: baseSnapshot,
  });
  const updatedCommit = await buildProjectCommitDraft({
    id: "commit-updated",
    parentId: initialCommit.id,
    message: "Schema aggiornato",
    createdAt: "2026-06-27T10:00:00.000Z",
    snapshot: updatedSnapshot,
  });
  const backupCommit = await buildProjectCommitDraft({
    id: "commit-backup",
    parentId: updatedCommit.id,
    message: "Backup automatico prima del ripristino",
    createdAt: "2026-06-27T11:00:00.000Z",
    snapshot: updatedSnapshot,
    automatic: true,
    tags: [PROJECT_RESTORE_BACKUP_TAG],
  });
  const restoreCommit = await buildProjectCommitDraft({
    id: "commit-restore",
    parentId: backupCommit.id,
    message: "Ripristino di: Schema iniziale",
    createdAt: "2026-06-27T11:01:00.000Z",
    snapshot: restoredSnapshot,
    automatic: true,
    tags: [PROJECT_RESTORE_TAG],
  });
  const versioning = {
    ...createEmptyProjectVersioningState(),
    headCommitId: restoreCommit.id,
    commits: [initialCommit, updatedCommit, backupCommit, restoreCommit],
  };

  saveWorkspaceSessionSnapshot(createValidSnapshot({ versioning }), storage);

  const restored = readWorkspaceSessionBootstrap(storage);

  assert.equal(restored.restored, true);
  assert.equal(restored.versioning.headCommitId, "commit-restore");
  assert.equal(restored.versioning.commits.length, 4);
  assert.equal(restored.versioning.commits[2]?.parentId, "commit-updated");
  assert.deepEqual(restored.versioning.commits[2]?.tags, [PROJECT_RESTORE_BACKUP_TAG]);
  assert.equal(restored.versioning.commits[3]?.parentId, "commit-backup");
  assert.deepEqual(restored.versioning.commits[3]?.tags, [PROJECT_RESTORE_TAG]);
});

test("workspace session serializza e ripristina project explorer", () => {
  const storage = new MemoryStorage();
  const snapshot = createValidSnapshot();
  const explorerView = {
    ...snapshot.explorerView,
    explorerOpen: false,
    explorerWidth: 312,
    expandedFolderIds: [snapshot.project.rootId],
  };

  saveWorkspaceSessionSnapshot({ ...snapshot, explorerView }, storage);

  const raw = storage.getItem(WORKSPACE_SESSION_STORAGE_KEY);
  assert.ok(raw);
  assert.equal(JSON.parse(raw).version, 6);
  assert.equal(JSON.parse(raw).explorerView.explorerWidth, 312);

  const restored = readWorkspaceSessionBootstrap(storage);
  assert.equal(restored.project.rootId, snapshot.project.rootId);
  assert.equal(restored.explorerView.explorerOpen, false);
  assert.equal(restored.explorerView.explorerWidth, 312);
  assert.equal(Object.keys(restored.files).length, Object.keys(snapshot.files).length);
});

test("workspace session salva e ripristina molti commit senza versioning annidato nei file schema", async () => {
  const storage = new MemoryStorage();
  let versioning = createEmptyProjectVersioningState();

  for (let index = 0; index < 25; index += 1) {
    const result = await createProjectCommitInState(versioning, {
      snapshot: createVersioningCommitSnapshot(`Schema ${index}`),
      message: `Commit ${index}`,
    });
    assert.equal(result.status, "created");
    if (result.status !== "created") throw new Error("commit failed");
    versioning = result.versioning;
  }

  const snapshot = createValidSnapshot({ versioning });
  const schemaFile = Object.values(snapshot.files ?? {}).find((file) => file.kind === "schema");
  if (schemaFile?.kind === "schema") {
    schemaFile.schema.versioning = versioning;
  }
  saveWorkspaceSessionSnapshot(snapshot, storage);

  const raw = storage.getItem(WORKSPACE_SESSION_STORAGE_KEY);
  assert.ok(raw);
  assert.equal(JSON.stringify(JSON.parse(raw).files).includes('"versioning"'), false);

  const restored = readWorkspaceSessionBootstrap(storage);
  assert.equal(restored.versioning.commits.length, 25);
  assert.equal(restored.versioning.headCommitId, versioning.headCommitId);
});
