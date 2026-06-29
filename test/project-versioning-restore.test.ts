import assert from "node:assert/strict";
import test from "node:test";

import {
  areProjectCommitSnapshotsEqual,
  createProjectCommitSnapshot,
  type ProjectCommitSnapshot,
} from "../src/features/versioning/projectCommitSnapshot.ts";
import { restoreProjectCommitInState } from "../src/features/versioning/projectVersionRestore.ts";
import {
  createProjectCommitInState,
  getProjectUncommittedChangeState,
} from "../src/features/versioning/useProjectVersioning.ts";
import { createEmptyDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import {
  createEmptyProjectVersioningState,
  parseProjectFile,
  serializeProjectFile,
} from "../src/utils/projectFile.ts";

const VIEWPORT = { x: 0, y: 0, zoom: 1 };

function createSnapshot(label: string): ProjectCommitSnapshot {
  const diagram = createEmptyDiagram("Restore project");
  diagram.nodes = [
    {
      id: "entity-a",
      type: "entity",
      label,
      x: label === "Moved" ? 80 : 10,
      y: 20,
      width: 140,
      height: 64,
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
    codeDraft: `entity ${label}`,
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

async function createTwoCommitVersioning() {
  const firstSnapshot = createSnapshot("Initial");
  const first = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: firstSnapshot,
    message: "Schema iniziale",
  });
  assert.equal(first.status, "created");
  if (first.status !== "created") {
    throw new Error("first commit not created");
  }

  const secondSnapshot = createSnapshot("Updated");
  const second = await createProjectCommitInState(first.versioning, {
    snapshot: secondSnapshot,
    message: "Schema aggiornato",
  });
  assert.equal(second.status, "created");
  if (second.status !== "created") {
    throw new Error("second commit not created");
  }

  return {
    firstSnapshot,
    secondSnapshot,
    firstCommit: first.commit,
    secondCommit: second.commit,
    versioning: second.versioning,
  };
}

test("restoreProjectCommitInState segnala commit mancante", async () => {
  const result = await restoreProjectCommitInState(
    createEmptyProjectVersioningState(),
    "missing",
    createSnapshot("Current"),
  );

  assert.equal(result.status, "missing-commit");
  if (result.status === "missing-commit") {
    assert.equal(result.commitId, "missing");
  }
});

test("restoreProjectCommitInState non crea commit quando lo snapshot e gia corrente", async () => {
  const { firstCommit, versioning } = await createTwoCommitVersioning();
  const result = await restoreProjectCommitInState(versioning, firstCommit.id, firstCommit.snapshot);

  assert.equal(result.status, "already-current");
  if (result.status === "already-current") {
    assert.equal(result.commit.id, firstCommit.id);
  }
});

test("restoreProjectCommitInState crea backup automatico e restore commit lineare", async () => {
  const { firstCommit, secondCommit, versioning } = await createTwoCommitVersioning();
  const currentSnapshot = createSnapshot("Moved");
  const result = await restoreProjectCommitInState(versioning, firstCommit.id, currentSnapshot, {
    backupCommitId: "backup-commit",
    restoreCommitId: "restore-commit",
    createdAt: "2026-06-27T10:00:00.000Z",
    backupMessage: "Backup automatico prima del ripristino",
    restoreMessage: "Ripristino di: Schema iniziale",
  });

  assert.equal(result.status, "restored");
  if (result.status !== "restored") {
    return;
  }

  assert.equal(result.versioning.commits.length, versioning.commits.length + 2);
  assert.equal(result.versioning.headCommitId, "restore-commit");
  assert.equal(result.backupCommit.parentId, secondCommit.id);
  assert.equal(result.restoreCommit.parentId, result.backupCommit.id);
  assert.equal(result.backupCommit.automatic, true);
  assert.equal(result.restoreCommit.automatic, true);
  assert.deepEqual(result.backupCommit.tags, ["auto-backup"]);
  assert.deepEqual(result.restoreCommit.tags, ["auto-restore"]);
  assert.equal(areProjectCommitSnapshotsEqual(result.backupCommit.snapshot, currentSnapshot), true);
  assert.equal(areProjectCommitSnapshotsEqual(result.restoreCommit.snapshot, firstCommit.snapshot), true);
  assert.equal(result.versioning.commits[0]?.id, firstCommit.id);
  assert.equal(result.versioning.commits[1]?.id, secondCommit.id);
});

test("restoreProjectCommitInState preserva tags e settings del versioning", async () => {
  const { firstCommit, versioning } = await createTwoCommitVersioning();
  const withMetadata = {
    ...versioning,
    tags: [
      {
        id: "tag-1",
        name: "Stabile",
        commitId: firstCommit.id,
        createdAt: "2026-06-27T09:00:00.000Z",
      },
    ],
    settings: {
      maxCommits: 120,
      keepTaggedCommits: true,
      includeAutomaticCommits: true,
    },
  };

  const result = await restoreProjectCommitInState(withMetadata, firstCommit.id, createSnapshot("Current"));

  assert.equal(result.status, "restored");
  if (result.status !== "restored") {
    return;
  }
  assert.deepEqual(result.versioning.tags, withMetadata.tags);
  assert.deepEqual(result.versioning.settings, withMetadata.settings);
});

test("restoreProjectCommitInState non muta snapshot e commit originali", async () => {
  const { firstCommit, versioning } = await createTwoCommitVersioning();
  const originalSerialized = JSON.stringify(versioning);
  const currentSnapshot = createSnapshot("Current");
  const currentSerialized = JSON.stringify(currentSnapshot);
  const result = await restoreProjectCommitInState(versioning, firstCommit.id, currentSnapshot);

  assert.equal(result.status, "restored");
  assert.equal(JSON.stringify(versioning), originalSerialized);
  assert.equal(JSON.stringify(currentSnapshot), currentSerialized);
});

test("dirty state risulta clean dopo restore con nuovo HEAD", async () => {
  const { firstCommit, versioning } = await createTwoCommitVersioning();
  const result = await restoreProjectCommitInState(versioning, firstCommit.id, createSnapshot("Current"));

  assert.equal(result.status, "restored");
  if (result.status !== "restored") {
    return;
  }

  const changeState = getProjectUncommittedChangeState(result.versioning, result.restoreCommit.snapshot);

  assert.equal(changeState.status, "clean");
  assert.equal(changeState.hasChanges, false);
  assert.equal(changeState.headCommitId, result.restoreCommit.id);
});

test("versioning con backup e restore commit resta nel project file", async () => {
  const { firstCommit, versioning } = await createTwoCommitVersioning();
  const result = await restoreProjectCommitInState(versioning, firstCommit.id, createSnapshot("Current"), {
    backupCommitId: "backup-roundtrip",
    restoreCommitId: "restore-roundtrip",
  });

  assert.equal(result.status, "restored");
  if (result.status !== "restored") {
    return;
  }

  const snapshot = result.restoreCommit.snapshot;
  const parsed = parseProjectFile(serializeProjectFile({
    diagram: snapshot.diagram,
    translationWorkspace: snapshot.translationWorkspace,
    logicalWorkspace: snapshot.logicalWorkspace,
    logicalGenerated: snapshot.logicalGenerated,
    logicalStage: snapshot.logicalStage,
    diagramView: snapshot.diagramView,
    viewport: snapshot.viewport,
    translationViewport: snapshot.translationViewport,
    logicalViewport: snapshot.logicalViewport,
    versioning: result.versioning,
  }));

  assert.equal(parsed.state.versioning.headCommitId, "restore-roundtrip");
  assert.equal(parsed.state.versioning.commits.length, 4);
  assert.equal(parsed.state.versioning.commits.at(-2)?.id, "backup-roundtrip");
  assert.equal(parsed.state.versioning.commits.at(-2)?.automatic, true);
  assert.deepEqual(parsed.state.versioning.commits.at(-2)?.tags, ["auto-backup"]);
  assert.equal(parsed.state.versioning.commits.at(-1)?.id, "restore-roundtrip");
  assert.deepEqual(parsed.state.versioning.commits.at(-1)?.tags, ["auto-restore"]);
  assert.equal(parsed.state.versioning.commits.at(-1)?.snapshot.codeDraft, firstCommit.snapshot.codeDraft);
});
