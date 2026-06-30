import assert from "node:assert/strict";
import test from "node:test";

import { createProjectCommitSnapshot } from "../src/features/versioning/projectCommitSnapshot.ts";
import { buildProjectVersionDiff } from "../src/features/versioning/projectVersionDiff.ts";
import { getProjectUncommittedChangeState } from "../src/features/versioning/useProjectVersioning.ts";
import { createEmptyProjectVersioningState } from "../src/utils/projectFile.ts";
import {
  addProjectFile,
  createEmptySchemaDocument,
  createProjectFromSchema,
  createTextWorkspaceFile,
} from "../src/utils/projectExplorer.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";

const VIEWPORT = { x: 0, y: 0, zoom: 1 };

function createProjectWideSnapshot() {
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

test("commit snapshot include tutti i file del progetto", () => {
  const snapshot = createProjectWideSnapshot();

  assert.ok(snapshot.project);
  assert.ok(snapshot.files);
  assert.equal(Object.values(snapshot.files).some((file) => file.kind === "schema"), true);
  assert.equal(Object.values(snapshot.files).some((file) => file.kind === "text" && file.content === "Initial notes"), true);
  assert.equal(Object.values(snapshot.files).some((file) => file.kind === "sql" && file.content.includes("CREATE TABLE")), true);
});

test("diff project-wide rileva modifiche note, schema non attivo e file aggiunti", () => {
  const before = createProjectWideSnapshot();
  const after = createProjectWideSnapshot();
  assert.ok(after.files);
  const note = Object.values(after.files).find((file) => file.kind === "text");
  assert.ok(note && note.kind === "text");
  after.files[note.id] = { ...note, content: "Updated notes" };
  const schema = Object.values(after.files).find((file) => file.kind === "schema");
  assert.ok(schema && schema.kind === "schema");
  after.files[schema.id] = {
    ...schema,
    schema: {
      ...schema.schema,
      diagram: {
        ...schema.schema.diagram,
        meta: { ...schema.schema.diagram.meta, name: "Changed schema" },
      },
    },
  };

  const diff = buildProjectVersionDiff(before, after);

  assert.equal(diff.sections.notes.changed, true);
  assert.equal(diff.sections.schemas.changed, true);
  assert.equal(diff.summary.hasFileChanges, true);
});

test("dirty state project-wide include note SQL e schema", () => {
  const snapshot = createProjectWideSnapshot();
  const changeState = getProjectUncommittedChangeState(createEmptyProjectVersioningState(), snapshot);

  assert.equal(changeState.hasChanges, true);
  assert.equal(changeState.categories.schemas, true);
  assert.equal(changeState.categories.notes, true);
  assert.equal(changeState.categories.sql, true);
});
