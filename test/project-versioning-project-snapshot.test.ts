import assert from "node:assert/strict";
import test from "node:test";

import {
  createProjectCommitSnapshot,
  stringifyProjectContentSnapshot,
  updateProjectSchemaFileIfContentChanged,
} from "../src/features/versioning/projectCommitSnapshot.ts";
import { buildProjectVersionDiff } from "../src/features/versioning/projectVersionDiff.ts";
import {
  createProjectCommitInState,
  getProjectUncommittedChangeState,
} from "../src/features/versioning/useProjectVersioning.ts";
import { createEmptyProjectVersioningState } from "../src/utils/projectFile.ts";
import {
  addProjectFile,
  createEmptySchemaDocument,
  createProjectFromSchema,
  createSchemaWorkspaceFile,
  createTextWorkspaceFile,
} from "../src/utils/projectExplorer.ts";
import { ensureFileTabOpen, openWelcomeTab, setActiveProjectTab, closeProjectTab } from "../src/utils/projectTabs.ts";
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

function cloneSnapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function createTwoSchemaSnapshot() {
  const state = createProjectFromSchema("ER Studio", createEmptySchemaDocument("Main schema.erschema"));
  const secondSchema = createSchemaWorkspaceFile("Second schema.erschema", createEmptySchemaDocument("Second schema.erschema"));
  const added = addProjectFile(state, state.project.rootId, secondSchema);
  assert.equal(added.ok, true);
  if (!added.ok) throw new Error("second schema not added");
  const normalized = ensureFileTabOpen(added.state, secondSchema.id);
  const activeSchema = normalized.files[normalized.project.activeFileId ?? ""];
  assert.ok(activeSchema?.kind === "schema");
  activeSchema.schema.diagram.nodes = [
    { id: "entity-a", type: "entity", label: "Entity A", x: 10, y: 20, width: 140, height: 64 },
  ];
  const diagram = activeSchema.schema.diagram;
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  return createProjectCommitSnapshot({
    project: normalized.project,
    files: normalized.files,
    explorerView: normalized.view,
    activeFileId: normalized.project.activeFileId,
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

test("dirty state project-wide mostra solo il file realmente modificato", async () => {
  const before = createProjectWideSnapshot();
  const first = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: before,
    message: "Initial",
  });
  assert.equal(first.status, "created");
  if (first.status !== "created") return;

  const after = createProjectCommitSnapshot(JSON.parse(JSON.stringify(before)));
  assert.ok(after.files);
  const note = Object.values(after.files).find((file) => file.kind === "text");
  assert.ok(note && note.kind === "text");
  after.files[note.id] = {
    ...note,
    content: "Only this note changed",
  };

  const changeState = getProjectUncommittedChangeState(first.versioning, after);

  assert.equal(changeState.hasChanges, true);
  assert.equal(changeState.files.length, 1);
  assert.equal(changeState.files[0]?.fileId, note.id);
  assert.equal(changeState.files[0]?.status, "modified");
});

test("opening schema does not change project content snapshot", async () => {
  const before = createTwoSchemaSnapshot();
  const result = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: before,
    message: "Initial",
  });
  assert.equal(result.status, "created");
  if (result.status !== "created") return;

  const after = cloneSnapshot(before);
  const fileIds = Object.keys(after.files ?? {});
  const secondFileId = fileIds.find((fileId) => fileId !== after.project?.activeFileId);
  assert.ok(secondFileId);
  assert.ok(after.project && after.explorerView);
  after.project.activeFileId = secondFileId;
  after.explorerView.activeFileId = secondFileId;
  after.explorerView.openTabs = [
    { id: `file:${fileIds[0]}`, kind: "file", fileId: fileIds[0], title: "Main schema.erschema" },
    { id: `file:${secondFileId}`, kind: "file", fileId: secondFileId, title: "Second schema.erschema" },
  ];
  after.explorerView.activeTabId = `file:${secondFileId}`;
  after.explorerView.selectedNodeId = after.project.fileTree.find((node) => node.fileId === secondFileId)?.id ?? null;
  after.explorerView.expandedFolderIds = [after.project.rootId, "temporary-expanded"];
  after.viewport = { x: 90, y: 120, zoom: 1.4 };

  assert.equal(stringifyProjectContentSnapshot(before), stringifyProjectContentSnapshot(after));
  assert.equal(getProjectUncommittedChangeState(result.versioning, after).hasChanges, false);
});

test("changing only explorer view is not a versioning change", async () => {
  const before = createTwoSchemaSnapshot();
  const result = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: before,
    message: "Initial",
  });
  assert.equal(result.status, "created");
  if (result.status !== "created") return;

  const after = cloneSnapshot(before);
  assert.ok(after.explorerView);
  after.explorerView.activeFileId = Object.keys(after.files ?? {})[1] ?? after.explorerView.activeFileId;
  after.explorerView.openTabs = [{ id: "welcome", kind: "welcome", title: "Welcome" }];
  after.explorerView.activeTabId = "welcome";
  after.explorerView.expandedFolderIds = [];
  after.explorerView.selectedNodeId = null;

  assert.equal(stringifyProjectContentSnapshot(before), stringifyProjectContentSnapshot(after));
  assert.equal(getProjectUncommittedChangeState(result.versioning, after).hasChanges, false);
});

test("changing only project.activeFileId is not a versioning change", async () => {
  const before = createTwoSchemaSnapshot();
  const result = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: before,
    message: "Initial",
  });
  assert.equal(result.status, "created");
  if (result.status !== "created") return;

  const after = cloneSnapshot(before);
  assert.ok(after.project);
  after.project.activeFileId = Object.keys(after.files ?? {}).find((fileId) => fileId !== before.project?.activeFileId) ?? null;

  assert.equal(stringifyProjectContentSnapshot(before), stringifyProjectContentSnapshot(after));
  assert.equal(getProjectUncommittedChangeState(result.versioning, after).hasChanges, false);
});

test("changing schema viewport and workspace UI is not a versioning change", async () => {
  const before = createTwoSchemaSnapshot();
  const result = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: before,
    message: "Initial",
  });
  assert.equal(result.status, "created");
  if (result.status !== "created") return;

  const after = cloneSnapshot(before);
  const schema = Object.values(after.files ?? {}).find((file) => file.kind === "schema");
  assert.ok(schema && schema.kind === "schema");
  schema.schema.view.erViewport = { x: 500, y: -200, zoom: 1.8 };
  schema.schema.workspace.selection = { nodeIds: ["entity-a"], edgeIds: [] };
  schema.schema.workspace.codePanelOpen = !schema.schema.workspace.codePanelOpen;

  assert.equal(stringifyProjectContentSnapshot(before), stringifyProjectContentSnapshot(after));
  assert.equal(getProjectUncommittedChangeState(result.versioning, after).hasChanges, false);
});

test("opening schema with refreshed workspace metadata is not a versioning change", async () => {
  const before = createTwoSchemaSnapshot();
  const result = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: before,
    message: "Initial",
  });
  assert.equal(result.status, "created");
  if (result.status !== "created") return;

  const after = cloneSnapshot(before);
  const schema = Object.values(after.files ?? {}).find((file) => file.kind === "schema");
  assert.ok(schema && schema.kind === "schema");
  schema.schema.translationWorkspace.translation.meta.createdAt = "2099-01-01T00:00:00.000Z";
  schema.schema.translationWorkspace.translation.meta.updatedAt = "2099-01-01T00:00:01.000Z";
  schema.schema.translationWorkspace.translation.meta.sourceSignature = "refreshed-only";
  schema.schema.logicalWorkspace.model.meta.generatedAt = "2099-01-01T00:00:02.000Z";
  schema.schema.logicalWorkspace.model.meta.sourceSignature = "refreshed-logical";
  schema.schema.logicalWorkspace.translation.meta.updatedAt = "2099-01-01T00:00:03.000Z";
  schema.schema.logicalWorkspace.transformation.meta.updatedAt = "2099-01-01T00:00:04.000Z";

  assert.equal(stringifyProjectContentSnapshot(before), stringifyProjectContentSnapshot(after));
  assert.equal(getProjectUncommittedChangeState(result.versioning, after).hasChanges, false);
});

test("moving node, renaming entity and editing Code remain versioning changes", async () => {
  const before = createTwoSchemaSnapshot();
  const result = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: before,
    message: "Initial",
  });
  assert.equal(result.status, "created");
  if (result.status !== "created") return;

  const moved = cloneSnapshot(before);
  const movedSchema = Object.values(moved.files ?? {}).find((file) => file.kind === "schema" && file.schema.diagram.nodes.length > 0);
  assert.ok(movedSchema && movedSchema.kind === "schema");
  movedSchema.schema.diagram.nodes[0].x += 40;
  assert.equal(getProjectUncommittedChangeState(result.versioning, moved).hasChanges, true);

  const renamed = cloneSnapshot(before);
  const renamedSchema = Object.values(renamed.files ?? {}).find((file) => file.kind === "schema" && file.schema.diagram.nodes.length > 0);
  assert.ok(renamedSchema && renamedSchema.kind === "schema");
  renamedSchema.schema.diagram.nodes[0].label = "Renamed entity";
  assert.equal(getProjectUncommittedChangeState(result.versioning, renamed).hasChanges, true);

  const code = cloneSnapshot(before);
  const codeSchema = Object.values(code.files ?? {}).find((file) => file.kind === "schema" && file.schema.diagram.nodes.length > 0);
  assert.ok(codeSchema && codeSchema.kind === "schema");
  codeSchema.schema.workspace.codeDirty = true;
  codeSchema.schema.workspace.codeDraft = "entity Renamed";
  assert.equal(getProjectUncommittedChangeState(result.versioning, code).hasChanges, true);
});

test("syncActiveSchemaToProject helper keeps same state when content is unchanged", () => {
  const before = createTwoSchemaSnapshot();
  assert.ok(before.project && before.files);
  const state = {
    project: before.project,
    files: before.files,
    view: before.explorerView!,
  };
  const activeFileId = before.project.activeFileId;
  assert.ok(activeFileId);
  const activeFile = state.files[activeFileId];
  assert.ok(activeFile?.kind === "schema");
  const schemaWithNavigationOnlyChanges = {
    ...activeFile.schema,
    savedAt: "2099-01-01T00:00:00.000Z",
    view: {
      ...activeFile.schema.view,
      erViewport: { x: 999, y: 999, zoom: 2 },
    },
    workspace: {
      ...activeFile.schema.workspace,
      codePanelOpen: !activeFile.schema.workspace.codePanelOpen,
    },
  };

  const nextState = updateProjectSchemaFileIfContentChanged(state, activeFileId, schemaWithNavigationOnlyChanges);

  assert.equal(nextState, state);
  assert.equal(nextState.files[activeFileId], activeFile);
});

test("switch tab after commit remains clean", async () => {
  const before = createTwoSchemaSnapshot();
  const result = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: before,
    message: "Initial",
  });
  assert.equal(result.status, "created");
  if (result.status !== "created") return;
  assert.ok(before.project && before.files && before.explorerView);
  let state = {
    project: before.project,
    files: before.files,
    view: before.explorerView,
  };
  const fileIds = Object.keys(before.files);
  state = ensureFileTabOpen(state, fileIds[1]);
  state = setActiveProjectTab(state, `file:${fileIds[0]}`);
  state = closeProjectTab(state, `file:${fileIds[1]}`);
  state = openWelcomeTab(state);
  const after = createProjectCommitSnapshot({
    ...before,
    project: state.project,
    files: state.files,
    explorerView: state.view,
    activeFileId: state.project.activeFileId,
  });

  assert.equal(stringifyProjectContentSnapshot(before), stringifyProjectContentSnapshot(after));
  assert.equal(getProjectUncommittedChangeState(result.versioning, after).hasChanges, false);
});
