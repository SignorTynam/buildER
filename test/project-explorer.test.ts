import assert from "node:assert/strict";
import test from "node:test";

import {
  addProjectFile,
  addProjectFolder,
  createEmptySchemaDocument,
  createProjectFromSchema,
  createSchemaWorkspaceFile,
  deleteProjectNode,
  getUniqueProjectNodeName,
  normalizeProjectNodeName,
  renameProjectNode,
} from "../src/utils/projectExplorer.ts";

function createState() {
  return createProjectFromSchema("Project", createEmptySchemaDocument("Main schema.erschema"));
}

test("normalizeProjectNodeName rifiuta/sanitizza nomi vuoti e caratteri non validi", () => {
  assert.equal(normalizeProjectNodeName("   "), "");
  assert.equal(normalizeProjectNodeName(" bad/name?.erschema "), "bad name .erschema");
});

test("getUniqueProjectNodeName gestisce duplicati nella stessa cartella", () => {
  const state = createState();
  const rootId = state.project.rootId;
  const existing = state.project.fileTree.find((node) => node.fileId === state.project.activeFileId);
  assert.ok(existing);

  assert.equal(getUniqueProjectNodeName(state.project, rootId, existing.name), "Main schema 2.erschema");
});

test("addProjectFolder impedisce nomi duplicati nella stessa cartella", () => {
  const state = createState();
  const first = addProjectFolder(state, state.project.rootId, "Models");
  assert.equal(first.ok, true);
  if (!first.ok) {
    return;
  }

  const duplicate = addProjectFolder(first.state, first.state.project.rootId, "Models");
  assert.deepEqual(duplicate, { ok: false, reason: "duplicate-name" });
});

test("renameProjectNode aggiorna file schema e nome diagramma", () => {
  const state = createState();
  const schemaNode = state.project.fileTree.find((node) => node.fileId === state.project.activeFileId);
  assert.ok(schemaNode);

  const result = renameProjectNode(state, schemaNode.id, "Orders.erschema");
  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  const file = result.state.files[state.project.activeFileId ?? ""];
  assert.equal(file?.name, "Orders.erschema");
  assert.equal(file?.kind === "schema" ? file.schema.diagram.meta.name : "", "Orders");
});

test("deleteProjectNode impedisce eliminazione root folder", () => {
  const state = createState();
  assert.deepEqual(deleteProjectNode(state, state.project.rootId), { ok: false, reason: "root-delete" });
});

test("deleteProjectNode sceglie un nuovo schema attivo o crea fallback", () => {
  const state = createState();
  const secondFile = createSchemaWorkspaceFile("Second.erschema");
  const added = addProjectFile(state, state.project.rootId, secondFile);
  assert.equal(added.ok, true);
  if (!added.ok) {
    return;
  }

  const firstSchemaNode = added.state.project.fileTree.find((node) => node.fileId === state.project.activeFileId);
  assert.ok(firstSchemaNode);
  const deletedFirst = deleteProjectNode(added.state, firstSchemaNode.id);
  assert.equal(deletedFirst.ok, true);
  if (!deletedFirst.ok) {
    return;
  }
  assert.equal(deletedFirst.state.project.activeFileId, secondFile.id);

  const secondSchemaNode = deletedFirst.state.project.fileTree.find((node) => node.fileId === secondFile.id);
  assert.ok(secondSchemaNode);
  const deletedLast = deleteProjectNode(deletedFirst.state, secondSchemaNode.id);
  assert.equal(deletedLast.ok, true);
  if (!deletedLast.ok) {
    return;
  }
  assert.ok(deletedLast.state.project.activeFileId);
  assert.equal(Object.values(deletedLast.state.files).filter((file) => file.kind === "schema").length, 1);
});
