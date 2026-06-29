import assert from "node:assert/strict";
import test from "node:test";

import {
  buildProjectVersionDiff,
  createProjectVersionDiffFromCommitAndSnapshot,
  createProjectVersionDiffFromCommits,
} from "../src/features/versioning/projectVersionDiff.ts";
import {
  createProjectCommitSnapshot,
  type ProjectCommitSnapshot,
} from "../src/features/versioning/projectCommitSnapshot.ts";
import { createProjectCommitInState } from "../src/features/versioning/useProjectVersioning.ts";
import { createEmptyDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import { createEmptyProjectVersioningState } from "../src/utils/projectFile.ts";

const VIEWPORT = { x: 180, y: 110, zoom: 1 };

function createSnapshot(): ProjectCommitSnapshot {
  const diagram = createEmptyDiagram("Diff project");
  diagram.nodes = [
    { id: "entity-a", type: "entity", label: "Studente", x: 10, y: 20, width: 140, height: 64 },
    { id: "attribute-a", type: "attribute", label: "Nome", x: 210, y: 20, width: 100, height: 48 },
  ];
  diagram.edges = [
    {
      id: "edge-attribute-a",
      type: "attribute",
      sourceId: "entity-a",
      targetId: "attribute-a",
      label: "",
      lineStyle: "solid",
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
    codePanelWidth: 340,
    notesPanelOpen: false,
    notesPanelWidth: 330,
    toolbarCollapsed: false,
    focusMode: false,
    toolbarWidth: 208,
    showDiagnostics: true,
  });
}

function cloneSnapshot(snapshot: ProjectCommitSnapshot): ProjectCommitSnapshot {
  return createProjectCommitSnapshot(JSON.parse(JSON.stringify(snapshot)));
}

async function createTwoCommitVersioning(left: ProjectCommitSnapshot, right: ProjectCommitSnapshot) {
  const first = await createProjectCommitInState(createEmptyProjectVersioningState(), {
    snapshot: left,
    message: "Base",
  });
  assert.equal(first.status, "created");
  if (first.status !== "created") {
    throw new Error("expected first commit");
  }

  const second = await createProjectCommitInState(first.versioning, {
    snapshot: right,
    message: "Target",
  });
  assert.equal(second.status, "created");
  if (second.status !== "created") {
    throw new Error("expected second commit");
  }

  return { first: first.commit, second: second.commit, versioning: second.versioning };
}

test("snapshot identici producono diff vuoto", () => {
  const snapshot = createSnapshot();
  const diff = buildProjectVersionDiff(snapshot, cloneSnapshot(snapshot));

  assert.equal(diff.isEqual, true);
  assert.equal(diff.summary.addedCount, 0);
  assert.equal(diff.summary.removedCount, 0);
  assert.equal(diff.summary.modifiedCount, 0);
  assert.equal(diff.summary.changedSectionCount, 0);
  assert.equal(diff.sections.er.changed, false);
});

test("diff ER rileva entita, attributi, relazioni, cardinalita e generalizzazioni", () => {
  const left = createSnapshot();
  const right = cloneSnapshot(left);
  right.diagram.nodes[0].label = "STUDENTE AGGIORNATO";
  right.diagram.nodes.push(
    { id: "CORSO", type: "entity", label: "CORSO", x: 420, y: 20, width: 140, height: 64 },
    { id: "ISCRIZIONE", type: "relationship", label: "ISCRIZIONE", x: 250, y: 160, width: 130, height: 78 },
  );
  right.diagram.edges.push({
    id: "edge-relationship-a",
    type: "connector",
    sourceId: "STUDENTE",
    targetId: "ISCRIZIONE",
    label: "",
    lineStyle: "solid",
  });
  right.diagram.generalizationGroups = [
    {
      id: "gen-a",
      supertypeId: "STUDENTE",
      subtypeIds: ["CORSO"],
      isaCompleteness: "partial",
      isaDisjointness: "disjoint",
    },
  ];

  const diff = buildProjectVersionDiff(left, right);

  assert.equal(diff.isEqual, false);
  assert.equal(diff.sections.er.changed, true);
  assert.ok(diff.sections.er.added.some((item) => item.kind === "entity" && item.id === "CORSO"));
  assert.ok(diff.sections.er.added.some((item) => item.kind === "relationship" && item.id === "ISCRIZIONE"));
  assert.ok(diff.sections.er.added.some((item) => item.kind === "connector" && item.id === "edge-relationship-a"));
  assert.ok(diff.sections.er.added.some((item) => item.kind === "generalization" && item.id === "gen-a"));
  assert.ok(diff.sections.er.modified.some((item) => item.kind === "entity" && item.id === "STUDENTE->STUDENTE_AGGIORNATO"));
});

test("diff ER rileva attributo rimosso e cambio cardinalita", () => {
  const left = createSnapshot();
  const right = cloneSnapshot(left);
  const attribute = right.diagram.nodes.find((node) => node.id === "Nome");
  if (attribute?.type === "attribute") {
    attribute.cardinality = "(0,N)";
  }
  const removed = cloneSnapshot(right);
  removed.diagram.nodes = removed.diagram.nodes.filter((node) => node.id !== "Nome");
  removed.diagram.edges = [];

  const cardinalityDiff = buildProjectVersionDiff(left, right);
  const removedDiff = buildProjectVersionDiff(right, removed);

  assert.ok(cardinalityDiff.sections.er.modified.some((item) => item.id === "Nome"));
  assert.ok(removedDiff.sections.er.removed.some((item) => item.kind === "attribute" && item.id === "Nome"));
});

test("diff Layout separa posizione, dimensione, viewport e manualOffset dal diff ER", () => {
  const left = createSnapshot();
  const right = cloneSnapshot(left);
  right.diagram.nodes[0].x += 40;
  right.diagram.nodes[0].width += 20;
  right.diagram.edges[0].manualOffset = 24;
  right.viewport = { x: 20, y: 30, zoom: 1.2 };

  const diff = buildProjectVersionDiff(left, right);

  assert.equal(diff.sections.er.changed, false);
  assert.equal(diff.sections.layout.changed, true);
  assert.ok(diff.sections.layout.modified.some((item) => item.kind === "node-layout"));
  assert.ok(diff.sections.layout.modified.some((item) => item.kind === "edge-offset"));
  assert.ok(diff.sections.layout.modified.some((item) => item.kind === "viewport"));
});

test("diff Logical rileva tabella, colonna, FK e stato logico", () => {
  const left = createSnapshot();
  const right = cloneSnapshot(left);
  right.logicalGenerated = true;
  right.logicalStage = "schema";
  right.logicalWorkspace.model.tables.push({
    id: "table-student",
    name: "student",
    kind: "entity",
    columns: [
      {
        id: "column-id",
        name: "id",
        isPrimaryKey: true,
        isForeignKey: false,
        isNullable: false,
        references: [],
      },
    ],
    x: 0,
    y: 0,
    width: 180,
    height: 80,
  });
  right.logicalWorkspace.model.foreignKeys.push({
    id: "fk-student-course",
    name: "fk_student_course",
    fromTableId: "table-student",
    toTableId: "table-course",
    mappings: [{ fromColumnId: "course_id", toColumnId: "id" }],
    required: true,
  });

  const diff = buildProjectVersionDiff(left, right);

  assert.equal(diff.sections.logical.changed, true);
  assert.ok(diff.sections.logical.modified.some((item) => item.id === "logicalGenerated"));
  assert.ok(diff.sections.logical.added.some((item) => item.kind === "table"));
  assert.ok(diff.sections.logical.added.some((item) => item.kind === "column"));
  assert.ok(diff.sections.logical.added.some((item) => item.kind === "foreign-key"));
});

test("diff Code e Workspace rilevano draft, dirty, pannelli, selection e toolbar", () => {
  const left = createSnapshot();
  const right = cloneSnapshot(left);
  right.codeDraft = "entity Studente";
  right.codeDirty = true;
  right.technicalPanelOpen = true;
  right.codePanelOpen = true;
  right.selection = { nodeIds: ["entity-a"], edgeIds: [] };
  right.toolbarCollapsed = true;
  right.focusMode = true;
  right.showDiagnostics = false;

  const diff = buildProjectVersionDiff(left, right);

  assert.equal(diff.sections.code.changed, true);
  assert.ok(diff.sections.code.modified.some((item) => item.id === "codeDraft"));
  assert.ok(diff.sections.code.modified.some((item) => item.id === "codeDirty"));
  assert.equal(diff.sections.workspace.changed, true);
  assert.ok(diff.sections.workspace.modified.some((item) => item.id === "workspace.technicalPanelOpen"));
  assert.ok(diff.sections.workspace.modified.some((item) => item.id === "workspace.selection"));
  assert.ok(diff.sections.workspace.modified.some((item) => item.id === "workspace.toolbarCollapsed"));
});

test("summary conta added, removed, modified e sezioni cambiate", () => {
  const left = createSnapshot();
  const right = cloneSnapshot(left);
  right.diagram.nodes.push({ id: "CORSO", type: "entity", label: "CORSO", x: 420, y: 20, width: 140, height: 64 });
  right.diagram.nodes[0].x += 20;
  right.codeDraft = "entity Studente";

  const diff = buildProjectVersionDiff(left, right);

  assert.equal(diff.isEqual, false);
  assert.equal(diff.summary.addedCount, 1);
  assert.equal(diff.summary.modifiedCount, 2);
  assert.equal(diff.summary.changedSectionCount, 3);
  assert.equal(diff.summary.hasErChanges, true);
  assert.equal(diff.summary.hasLayoutChanges, true);
  assert.equal(diff.summary.hasCodeChanges, true);
});

test("compare commit vs commit e commit vs working copy funzionano", async () => {
  const left = createSnapshot();
  const right = cloneSnapshot(left);
  right.diagram.nodes[0].label = "STUDENTE AGGIORNATO";
  const { first, second, versioning } = await createTwoCommitVersioning(left, right);

  const commitDiff = createProjectVersionDiffFromCommits(versioning, first.id, second.id);
  assert.equal(commitDiff.status, "ok");
  if (commitDiff.status === "ok") {
    assert.equal(commitDiff.diff.sections.er.changed, true);
  }

  const workingCopy = cloneSnapshot(right);
  workingCopy.viewport = { x: 10, y: 20, zoom: 1.4 };
  const workingDiff = createProjectVersionDiffFromCommitAndSnapshot(versioning, second.id, workingCopy);
  assert.equal(workingDiff.status, "ok");
  if (workingDiff.status === "ok") {
    assert.equal(workingDiff.diff.sections.layout.changed, true);
  }

  assert.deepEqual(createProjectVersionDiffFromCommits(versioning, "missing", second.id), {
    status: "missing-commit",
    commitId: "missing",
  });
});
