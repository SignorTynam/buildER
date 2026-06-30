import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import { createEmptyProjectVersioningState } from "../src/utils/projectFile.ts";
import {
  CURRENT_SCHEMA_FILE_VERSION,
  SCHEMA_FILE_KIND,
  parseSchemaFile,
  serializeSchemaFile,
} from "../src/utils/projectSchemaFile.ts";

const VIEWPORT = { x: 12, y: 24, zoom: 1.2 };

test("serializeSchemaFile produce un .erschema valido", () => {
  const diagram = createEmptyDiagram("Schema singolo");
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  const document = JSON.parse(serializeSchemaFile({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: false,
    logicalStage: "translation",
    diagramView: "er",
    viewport: VIEWPORT,
    translationViewport: VIEWPORT,
    logicalViewport: VIEWPORT,
    workspace: {
      tool: "select",
      mode: "edit",
      selection: { nodeIds: [], edgeIds: [] },
      translationSelection: { nodeIds: [], edgeIds: [] },
      logicalSelection: { nodeId: null, columnId: null, edgeId: null },
      codeDraft: "entity A",
      codeDirty: true,
      technicalPanelOpen: false,
      technicalPanelTab: "review",
      codePanelOpen: true,
      codePanelWidth: 340,
      notesPanelOpen: false,
      notesPanelWidth: 320,
      toolbarCollapsed: false,
      focusMode: false,
      toolbarWidth: 208,
      showDiagnostics: true,
    },
    versioning: createEmptyProjectVersioningState(),
  }));

  assert.equal(document.version, CURRENT_SCHEMA_FILE_VERSION);
  assert.equal(document.kind, SCHEMA_FILE_KIND);
  assert.equal(document.diagram.meta.name, "Schema singolo");
  assert.equal(document.workspace.codeDraft, "entity A");
});

test("parseSchemaFile ricostruisce diagramma, workspace, viste e traduzioni", () => {
  const diagram = createEmptyDiagram("Roundtrip schema");
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  const serialized = serializeSchemaFile({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: true,
    logicalStage: "schema",
    diagramView: "logical",
    viewport: VIEWPORT,
    translationViewport: { x: 1, y: 2, zoom: 1 },
    logicalViewport: { x: 3, y: 4, zoom: 0.8 },
    workspace: {
      tool: "attribute",
      mode: "edit",
      selection: { nodeIds: ["a"], edgeIds: [] },
      translationSelection: { nodeIds: ["b"], edgeIds: [] },
      logicalSelection: { nodeId: "t", columnId: "c", edgeId: null },
      codeDraft: "entity B",
      codeDirty: false,
      technicalPanelOpen: true,
      technicalPanelTab: "notes",
      codePanelOpen: false,
      codePanelWidth: 350,
      notesPanelOpen: true,
      notesPanelWidth: 330,
      toolbarCollapsed: true,
      focusMode: false,
      toolbarWidth: 220,
      showDiagnostics: false,
    },
  });

  const parsed = parseSchemaFile(serialized);

  assert.equal(parsed.diagram.meta.name, "Roundtrip schema");
  assert.equal(parsed.translationWorkspace.translatedDiagram.meta.name, "Roundtrip schema");
  assert.equal(parsed.logicalGenerated, true);
  assert.equal(parsed.logicalStage, "schema");
  assert.deepEqual(parsed.view.logicalViewport, { x: 3, y: 4, zoom: 0.8 });
  assert.deepEqual(parsed.workspace.logicalSelection, { nodeId: "t", columnId: "c", edgeId: null });
  assert.equal(parsed.workspace.showDiagnostics, false);
});
