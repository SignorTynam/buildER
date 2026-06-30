import assert from "node:assert/strict";
import {
  createProjectCommitSnapshot,
  type ProjectCommitSnapshot,
} from "../../src/features/versioning/projectCommitSnapshot.ts";
import {
  addProjectFile,
  createEmptySchemaDocument,
  createProjectFromSchema,
  createTextWorkspaceFile,
} from "../../src/utils/projectExplorer.ts";
import { createEmptyErTranslationWorkspace } from "../../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../../src/utils/logicalWorkspace.ts";

const VIEWPORT = { x: 0, y: 0, zoom: 1 };

export function createProjectWideSnapshotForTest(): ProjectCommitSnapshot {
  const state = createProjectFromSchema("ER Studio", createEmptySchemaDocument("Main schema.erschema"));
  const notes = createTextWorkspaceFile("notes.txt", "text", "Initial notes");
  const sql = createTextWorkspaceFile("query.sql", "sql", "CREATE TABLE course (id INT);");
  const withNotes = addProjectFile(state, state.project.rootId, notes);
  assert.equal(withNotes.ok, true);
  if (!withNotes.ok) throw new Error("notes not added");
  const withSql = addProjectFile(withNotes.state, withNotes.state.project.rootId, sql);
  assert.equal(withSql.ok, true);
  if (!withSql.ok) throw new Error("sql not added");

  const activeSchema = Object.values(withSql.state.files).find((file) => file.kind === "schema");
  assert.ok(activeSchema && activeSchema.kind === "schema");
  const diagram = activeSchema.schema.diagram;
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  return createProjectCommitSnapshot({
    project: withSql.state.project,
    files: withSql.state.files,
    explorerView: withSql.state.view,
    activeFileId: withSql.state.project.activeFileId,
    activeWorkspace: {
      diagramView: "er",
      viewport: VIEWPORT,
      translationViewport: VIEWPORT,
      logicalViewport: VIEWPORT,
      selection: { nodeIds: [], edgeIds: [] },
      translationSelection: { nodeIds: [], edgeIds: [] },
      logicalSelection: { nodeId: null, columnId: null, edgeId: null },
      codeDraft: "",
      codeDirty: false,
      showDiagnostics: true,
    },
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
    codePanelWidth: 330,
    notesPanelOpen: false,
    notesPanelWidth: 320,
    toolbarCollapsed: false,
    focusMode: false,
    toolbarWidth: 208,
    showDiagnostics: true,
  });
}
