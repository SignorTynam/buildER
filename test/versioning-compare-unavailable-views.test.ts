import assert from "node:assert/strict";
import test from "node:test";

import { createProjectCommitSnapshot, type ProjectCommitSnapshot } from "../src/features/versioning/projectCommitSnapshot.ts";
import {
  getSnapshotViewPayload,
  hasSnapshotLogicalWork,
  hasSnapshotTranslationWork,
} from "../src/features/versioning/projectVersionVisualDiff.ts";
import { createEmptyDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";

const VIEWPORT = { x: 0, y: 0, zoom: 1 };

function createSnapshot(options: {
  diagramView?: ProjectCommitSnapshot["diagramView"];
  logicalGenerated?: boolean;
  logicalTable?: boolean;
} = {}): ProjectCommitSnapshot {
  const diagram = createEmptyDiagram("compare availability");
  diagram.nodes = [{ id: "entity-a", type: "entity", label: "Cliente", x: 20, y: 20, width: 140, height: 64 }];
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  if (options.logicalTable) {
    logicalWorkspace.model.tables = [
      {
        id: "table-a",
        name: "Cliente",
        kind: "entity",
        columns: [],
        x: 20,
        y: 20,
        width: 160,
        height: 96,
      },
    ];
  }

  return createProjectCommitSnapshot({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: options.logicalGenerated ?? false,
    logicalStage: options.logicalGenerated ? "schema" : "translation",
    diagramView: options.diagramView ?? "er",
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
}

test("compare mode considera unavailable la traduzione fallback mai salvata", () => {
  const snapshot = createSnapshot();
  const before = JSON.stringify(snapshot);
  const payload = getSnapshotViewPayload(snapshot, "translation");

  assert.equal(hasSnapshotTranslationWork(snapshot), false);
  assert.equal(payload.mode, "unavailable");
  assert.equal(payload.viewMode, "translation");
  assert.equal(JSON.stringify(snapshot), before);
});

test("compare mode mostra la traduzione solo quando lo snapshot segnala lavoro traduzione", () => {
  const snapshot = createSnapshot({ diagramView: "translation" });
  const payload = getSnapshotViewPayload(snapshot, "translation");

  assert.equal(hasSnapshotTranslationWork(snapshot), true);
  assert.equal(payload.mode, "translation");
});

test("compare mode considera unavailable il logico fallback vuoto", () => {
  const snapshot = createSnapshot();
  const payload = getSnapshotViewPayload(snapshot, "logical");

  assert.equal(hasSnapshotLogicalWork(snapshot), false);
  assert.equal(payload.mode, "unavailable");
  assert.equal(payload.viewMode, "logical");
});

test("compare mode mostra il logico quando lo snapshot contiene schema salvato", () => {
  const snapshot = createSnapshot({ logicalGenerated: true, logicalTable: true });
  const payload = getSnapshotViewPayload(snapshot, "logical");

  assert.equal(hasSnapshotLogicalWork(snapshot), true);
  assert.equal(payload.mode, "logical");
});
