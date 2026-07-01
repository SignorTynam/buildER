import assert from "node:assert/strict";
import test from "node:test";

import {
  addProjectFile,
  createEmptyProjectExplorerState,
  createSchemaWorkspaceFile,
  createTextWorkspaceFile,
  deleteProjectNode,
} from "../src/utils/projectExplorer.ts";
import {
  closeProjectTab,
  ensureFileTabOpen,
  normalizeProjectTabs,
  setActiveProjectTab,
} from "../src/utils/projectTabs.ts";

test("empty project normalizes to active Welcome tab", () => {
  const state = normalizeProjectTabs(createEmptyProjectExplorerState("Tabs"));

  assert.equal(state.project.activeFileId, null);
  assert.equal(state.view.activeTabId, "welcome");
  assert.equal(state.view.openTabs[0].kind, "welcome");
});

test("opening schema, sql and text files creates file tabs", () => {
  let state = createEmptyProjectExplorerState("Tabs");
  const schema = createSchemaWorkspaceFile("Main.erschema");
  const sql = createTextWorkspaceFile("query.sql", "sql");
  const note = createTextWorkspaceFile("notes.txt", "text");

  const withSchema = addProjectFile(state, state.project.rootId, schema);
  assert.equal(withSchema.ok, true);
  if (!withSchema.ok) return;
  state = ensureFileTabOpen(withSchema.state, schema.id);

  const withSql = addProjectFile(state, state.project.rootId, sql);
  assert.equal(withSql.ok, true);
  if (!withSql.ok) return;
  state = ensureFileTabOpen(withSql.state, sql.id);

  const withNote = addProjectFile(state, state.project.rootId, note);
  assert.equal(withNote.ok, true);
  if (!withNote.ok) return;
  state = ensureFileTabOpen(withNote.state, note.id);

  assert.ok(state.view.openTabs.some((tab) => tab.fileId === schema.id));
  assert.ok(state.view.openTabs.some((tab) => tab.fileId === sql.id));
  assert.ok(state.view.openTabs.some((tab) => tab.fileId === note.id));
  assert.equal(state.project.activeFileId, note.id);
});

test("closing active tab selects a neighbor and closing all returns Welcome", () => {
  let state = createEmptyProjectExplorerState("Tabs");
  const first = createSchemaWorkspaceFile("First.erschema");
  const second = createSchemaWorkspaceFile("Second.erschema");
  const addedFirst = addProjectFile(state, state.project.rootId, first);
  assert.equal(addedFirst.ok, true);
  if (!addedFirst.ok) return;
  state = ensureFileTabOpen(addedFirst.state, first.id);
  const addedSecond = addProjectFile(state, state.project.rootId, second);
  assert.equal(addedSecond.ok, true);
  if (!addedSecond.ok) return;
  state = ensureFileTabOpen(addedSecond.state, second.id);

  state = closeProjectTab(state, `file:${second.id}`);
  assert.equal(state.project.activeFileId, first.id);

  state = closeProjectTab(state, `file:${first.id}`);
  assert.equal(state.project.activeFileId, null);
  assert.equal(state.view.activeTabId, "welcome");
});

test("deleteProjectNode removes deleted file tab", () => {
  let state = createEmptyProjectExplorerState("Tabs");
  const file = createTextWorkspaceFile("notes.txt", "text");
  const added = addProjectFile(state, state.project.rootId, file);
  assert.equal(added.ok, true);
  if (!added.ok) return;
  state = ensureFileTabOpen(added.state, file.id);
  const node = state.project.fileTree.find((candidate) => candidate.fileId === file.id);
  assert.ok(node);

  const deleted = deleteProjectNode(state, node.id);
  assert.equal(deleted.ok, true);
  if (!deleted.ok) return;
  assert.equal(deleted.state.view.openTabs.some((tab) => tab.fileId === file.id), false);
});

test("setActiveProjectTab updates active file for file tabs", () => {
  let state = createEmptyProjectExplorerState("Tabs");
  const file = createTextWorkspaceFile("query.sql", "sql");
  const added = addProjectFile(state, state.project.rootId, file);
  assert.equal(added.ok, true);
  if (!added.ok) return;
  state = ensureFileTabOpen(added.state, file.id, { activate: false });

  const next = setActiveProjectTab(state, `file:${file.id}`);
  assert.equal(next.project.activeFileId, file.id);
  assert.equal(next.view.activeTabId, `file:${file.id}`);
});
