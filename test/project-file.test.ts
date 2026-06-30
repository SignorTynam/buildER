import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyDiagram, serializeDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import {
  CURRENT_PROJECT_FILE_VERSION,
  createProjectCommitSnapshot,
  createEmptyProjectVersioningState,
  parseProjectFile,
  PROJECT_FILE_KIND,
  ProjectFileError,
  serializeProjectFile,
  type ProjectFileWorkspaceState,
} from "../src/utils/projectFile.ts";
import {
  addProjectFile,
  createEmptyProjectExplorerState,
  createSchemaWorkspaceFile,
  createTextWorkspaceFile,
} from "../src/utils/projectExplorer.ts";

const DEFAULT_VIEWPORT = { x: 180, y: 110, zoom: 1 };

function createSerializableProject(name: string) {
  const diagram = createEmptyDiagram(name);
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  return {
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: false,
    logicalStage: "translation" as const,
    diagramView: "er" as const,
    viewport: DEFAULT_VIEWPORT,
    translationViewport: DEFAULT_VIEWPORT,
    logicalViewport: DEFAULT_VIEWPORT,
    savedAt: "2026-06-26T10:00:00.000Z",
  };
}

function createFullProjectSnapshot(name: string) {
  return createProjectCommitSnapshot({
    ...createSerializableProject(name),
    tool: "attribute",
    mode: "edit",
    selection: { nodeIds: ["entity-a"], edgeIds: [] },
    translationSelection: { nodeIds: ["translated-a"], edgeIds: [] },
    logicalSelection: { nodeId: "table-a", columnId: null, edgeId: null },
    codeDraft: "entity A",
    codeDirty: true,
    technicalPanelOpen: true,
    technicalPanelTab: "code",
    codePanelOpen: true,
    codePanelWidth: 348,
    notesPanelOpen: false,
    notesPanelWidth: 336,
    toolbarCollapsed: true,
    focusMode: true,
    toolbarWidth: 220,
    showDiagnostics: false,
  });
}

function createWorkspaceState(overrides: Partial<ProjectFileWorkspaceState> = {}): ProjectFileWorkspaceState {
  return {
    tool: "attribute",
    mode: "edit",
    selection: { nodeIds: ["entity-a"], edgeIds: ["edge-a"] },
    translationSelection: { nodeIds: ["translated-a"], edgeIds: [] },
    logicalSelection: { nodeId: "table-a", columnId: "column-a", edgeId: "logical-edge-a" },
    codeDraft: "entity Cliente",
    codeDirty: true,
    technicalPanelOpen: true,
    technicalPanelTab: "notes",
    codePanelOpen: true,
    codePanelWidth: 348,
    notesPanelOpen: true,
    notesPanelWidth: 336,
    toolbarCollapsed: true,
    focusMode: true,
    toolbarWidth: 220,
    showDiagnostics: false,
    ...overrides,
  };
}

test("il formato .ersp salva e ripristina vista corrente e viewport del progetto", () => {
  const diagram = createEmptyDiagram("Progetto completo");
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  const serialized = serializeProjectFile({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: true,
    logicalStage: "schema",
    diagramView: "logical",
    viewport: { x: 42, y: -18, zoom: 1.35 },
    translationViewport: { x: 64, y: 24, zoom: 0.92 },
    logicalViewport: { x: -120, y: 88, zoom: 0.75 },
    savedAt: "2026-04-15T10:00:00.000Z",
  });

  const parsed = parseProjectFile(serialized, {
    fallbackViewport: DEFAULT_VIEWPORT,
    fallbackDiagramView: "er",
  });

  assert.equal(parsed.source, "project-file");
  assert.equal(parsed.document.version, CURRENT_PROJECT_FILE_VERSION);
  assert.equal(parsed.document.kind, PROJECT_FILE_KIND);
  assert.equal(parsed.state.diagram.meta.name, "Progetto completo");
  assert.equal(parsed.state.logicalGenerated, true);
  assert.equal(parsed.state.logicalStage, "schema");
  assert.equal(parsed.document.logicalStage, "schema");
  assert.equal(parsed.document.view.logicalStage, "schema");
  assert.equal(parsed.state.diagramView, "logical");
  assert.deepEqual(parsed.state.viewport, { x: 42, y: -18, zoom: 1.35 });
  assert.deepEqual(parsed.state.translationViewport, { x: 64, y: 24, zoom: 0.92 });
  assert.deepEqual(parsed.state.logicalViewport, { x: -120, y: 88, zoom: 0.75 });
  assert.equal(parsed.state.translationWorkspace.translatedDiagram.meta.name, "Progetto completo");
});

test("il formato .ersp preserva la vista ER anche quando il fallback e logical", () => {
  const diagram = createEmptyDiagram("Vista ER");
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  const serialized = serializeProjectFile({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: true,
    logicalStage: "schema",
    diagramView: "er",
    viewport: { x: 12, y: 34, zoom: 1.25 },
    translationViewport: { x: 56, y: 78, zoom: 0.9 },
    logicalViewport: { x: -20, y: 15, zoom: 0.75 },
    savedAt: "2026-06-21T10:00:00.000Z",
  });

  const parsed = parseProjectFile(serialized, {
    fallbackViewport: DEFAULT_VIEWPORT,
    fallbackDiagramView: "logical",
  });

  assert.equal(parsed.source, "project-file");
  assert.equal(parsed.document.view.current, "er");
  assert.equal(parsed.state.diagramView, "er");
  assert.deepEqual(parsed.state.viewport, { x: 12, y: 34, zoom: 1.25 });
  assert.deepEqual(parsed.state.translationViewport, { x: 56, y: 78, zoom: 0.9 });
  assert.deepEqual(parsed.state.logicalViewport, { x: -20, y: 15, zoom: 0.75 });
});

test("il formato .ersp usa il fallback quando la vista salvata non e valida", () => {
  const diagram = createEmptyDiagram("Vista invalida");
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  const serialized = serializeProjectFile({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: true,
    logicalStage: "schema",
    diagramView: "er",
    viewport: DEFAULT_VIEWPORT,
    translationViewport: DEFAULT_VIEWPORT,
    logicalViewport: DEFAULT_VIEWPORT,
  });
  const document = JSON.parse(serialized);
  document.view.current = "invalid-view";

  const parsed = parseProjectFile(JSON.stringify(document), {
    fallbackViewport: DEFAULT_VIEWPORT,
    fallbackDiagramView: "translation",
  });

  assert.equal(parsed.document.view.current, "translation");
  assert.equal(parsed.state.diagramView, "translation");
});

test("il formato .ersp conserva cardinalita custom e note HTML", () => {
  const diagram = createEmptyDiagram("Cardinalita custom");
  diagram.notes = "<h1>Note</h1><p>Test</p>";
  diagram.nodes = [
    {
      id: "entity-a",
      type: "entity",
      label: "A",
      x: 0,
      y: 0,
      width: 140,
      height: 64,
      relationshipParticipations: [
        { id: "part-a-r", relationshipId: "rel-r", cardinality: "(2,5)" },
      ],
    },
    {
      id: "entity-b",
      type: "entity",
      label: "B",
      x: 420,
      y: 0,
      width: 140,
      height: 64,
      relationshipParticipations: [
        { id: "part-b-r", relationshipId: "rel-r", cardinality: "(1,1)" },
      ],
    },
    { id: "rel-r", type: "relationship", label: "R", x: 220, y: 0, width: 130, height: 78 },
  ];
  diagram.edges = [
    {
      id: "conn-a-r",
      type: "connector",
      sourceId: "entity-a",
      targetId: "rel-r",
      label: "",
      lineStyle: "solid",
      participationId: "part-a-r",
    },
    {
      id: "conn-b-r",
      type: "connector",
      sourceId: "entity-b",
      targetId: "rel-r",
      label: "",
      lineStyle: "solid",
      participationId: "part-b-r",
    },
  ];
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  const parsed = parseProjectFile(serializeProjectFile({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: false,
    logicalStage: "translation",
    diagramView: "er",
    viewport: DEFAULT_VIEWPORT,
    translationViewport: DEFAULT_VIEWPORT,
    logicalViewport: DEFAULT_VIEWPORT,
  }));

  const entity = parsed.state.diagram.nodes.find((node) => node.type === "entity" && node.label === "A");
  assert.equal(parsed.state.diagram.notes, "<h1>Note</h1><p>Test</p>");
  assert.equal(
    entity?.type === "entity" ? entity.relationshipParticipations?.[0]?.cardinality : undefined,
    "(2,5)",
  );
});

test("il formato .ersp preserva le notes del progetto", () => {
  const diagram = createEmptyDiagram("Progetto con note");
  diagram.notes = "<p>Nota importante</p>";
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  const parsed = parseProjectFile(serializeProjectFile({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: false,
    logicalStage: "translation",
    diagramView: "er",
    viewport: DEFAULT_VIEWPORT,
    translationViewport: DEFAULT_VIEWPORT,
    logicalViewport: DEFAULT_VIEWPORT,
  }));

  assert.equal(parsed.state.diagram.notes, "<p>Nota importante</p>");
});

test("i vecchi project file JSON version 2 vengono migrati nel formato .ersp", () => {
  const diagram = createEmptyDiagram("Legacy project");
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  const legacyProject = {
    version: 2,
    kind: PROJECT_FILE_KIND,
    savedAt: "2026-04-14T08:30:00.000Z",
    diagram: JSON.parse(serializeDiagram(diagram)),
    logicalWorkspace,
    logicalGenerated: true,
  };

  const parsed = parseProjectFile(JSON.stringify(legacyProject), {
    fallbackViewport: DEFAULT_VIEWPORT,
    fallbackDiagramView: "logical",
  });

  assert.equal(parsed.source, "legacy-project-json");
  assert.equal(parsed.document.version, CURRENT_PROJECT_FILE_VERSION);
  assert.equal(parsed.state.diagram.meta.name, "Legacy project");
  assert.equal(parsed.state.diagramView, "translation");
  assert.deepEqual(parsed.state.viewport, DEFAULT_VIEWPORT);
  assert.deepEqual(parsed.state.translationViewport, DEFAULT_VIEWPORT);
  assert.deepEqual(parsed.state.logicalViewport, DEFAULT_VIEWPORT);
  assert.equal(parsed.state.logicalGenerated, false);
});

test("un diagramma JSON legacy viene accettato solo come fallback compatibile e incapsulato in un progetto", () => {
  const diagram = createEmptyDiagram("Legacy diagram");
  const parsed = parseProjectFile(serializeDiagram(diagram), {
    fallbackViewport: DEFAULT_VIEWPORT,
    fallbackDiagramView: "er",
  });

  assert.equal(parsed.source, "legacy-diagram-json");
  assert.equal(parsed.state.diagram.meta.name, "Legacy diagram");
  assert.equal(parsed.state.logicalGenerated, false);
  assert.equal(parsed.state.diagramView, "er");
  assert.equal(parsed.state.logicalWorkspace.model.tables.length, 0);
  assert.equal(parsed.state.translationWorkspace.translatedDiagram.meta.name, "Legacy diagram");
  assert.deepEqual(parsed.state.viewport, DEFAULT_VIEWPORT);
});

test("il formato .ersp serializza uno stato versioning vuoto valido", () => {
  const serialized = serializeProjectFile(createSerializableProject("Versioning vuoto"));
  const document = JSON.parse(serialized);

  assert.equal(document.version, CURRENT_PROJECT_FILE_VERSION);
  assert.deepEqual(document.versioning, createEmptyProjectVersioningState());
});

test("il formato .ersp serializza e ripristina lo stato workspace corrente", () => {
  const workspace = createWorkspaceState();
  const serialized = serializeProjectFile({
    ...createSerializableProject("Workspace completo"),
    workspace,
  });
  const document = JSON.parse(serialized);
  const parsed = parseProjectFile(serialized);

  assert.deepEqual(document.workspace, workspace);
  assert.deepEqual(parsed.state.workspace, workspace);
});

test("project file senza workspace usa fallback sicuri", () => {
  const serialized = serializeProjectFile(createSerializableProject("Senza workspace"));
  const document = JSON.parse(serialized);
  delete document.workspace;

  const parsed = parseProjectFile(JSON.stringify(document));

  assert.equal(parsed.state.workspace.tool, "select");
  assert.equal(parsed.state.workspace.mode, "edit");
  assert.deepEqual(parsed.state.workspace.selection, { nodeIds: [], edgeIds: [] });
  assert.equal(parsed.state.workspace.codeDirty, false);
  assert.equal(typeof parsed.state.workspace.codeDraft, "string");
  assert.equal(parsed.state.workspace.technicalPanelOpen, false);
  assert.equal(parsed.state.workspace.technicalPanelTab, "review");
  assert.equal(parsed.state.workspace.showDiagnostics, true);
});

test("project file con workspace malformato usa fallback sanitizzati", () => {
  const serialized = serializeProjectFile(createSerializableProject("Workspace malformato"));
  const document = JSON.parse(serialized);
  document.workspace = {
    tool: "bad-tool",
    selection: { nodeIds: ["node-a", 42], edgeIds: [false, "edge-a"] },
    logicalSelection: { tableId: "legacy-table", columnId: 99, edgeId: "edge-a" },
    codeDraft: 42,
    codeDirty: "yes",
    technicalPanelOpen: "yes",
    technicalPanelTab: "missing",
    codePanelOpen: true,
    codePanelWidth: -1,
    notesPanelWidth: Number.NaN,
    toolbarCollapsed: true,
    focusMode: "no",
    toolbarWidth: 0,
    showDiagnostics: "yes",
  };

  const parsed = parseProjectFile(JSON.stringify(document));

  assert.equal(parsed.state.workspace.tool, "select");
  assert.deepEqual(parsed.state.workspace.selection, { nodeIds: ["node-a"], edgeIds: ["edge-a"] });
  assert.deepEqual(parsed.state.workspace.logicalSelection, {
    nodeId: "legacy-table",
    columnId: null,
    edgeId: "edge-a",
  });
  assert.equal(parsed.state.workspace.codeDraft, "");
  assert.equal(parsed.state.workspace.codeDirty, false);
  assert.equal(parsed.state.workspace.technicalPanelOpen, false);
  assert.equal(parsed.state.workspace.technicalPanelTab, "review");
  assert.equal(parsed.state.workspace.codePanelOpen, true);
  assert.equal(typeof parsed.state.workspace.codePanelWidth, "number");
  assert.equal(typeof parsed.state.workspace.notesPanelWidth, "number");
  assert.equal(parsed.state.workspace.toolbarCollapsed, true);
  assert.equal(parsed.state.workspace.focusMode, false);
  assert.equal(typeof parsed.state.workspace.toolbarWidth, "number");
  assert.equal(parsed.state.workspace.showDiagnostics, true);
});

test("il formato .ersp carica uno stato versioning vuoto", () => {
  const parsed = parseProjectFile(serializeProjectFile({
    ...createSerializableProject("Parse versioning vuoto"),
    versioning: createEmptyProjectVersioningState(),
  }));

  assert.equal(parsed.state.versioning.enabled, true);
  assert.equal(parsed.state.versioning.headCommitId, null);
  assert.deepEqual(parsed.state.versioning.commits, []);
  assert.deepEqual(parsed.document.versioning, createEmptyProjectVersioningState());
});

test("il formato .ersp carica un commit fittizio nel versioning", () => {
  const serialized = serializeProjectFile(createSerializableProject("Commit fittizio"));
  const document = JSON.parse(serialized);
  document.versioning = {
    version: 1,
    enabled: true,
    headCommitId: "commit-1",
    commits: [
      {
        id: "commit-1",
        parentId: null,
        message: "Snapshot iniziale",
        description: "Commit di test",
        createdAt: "2026-06-26T10:05:00.000Z",
        author: "buildER",
        snapshot: {
          diagram: document.diagram,
          translationWorkspace: document.translationWorkspace,
          logicalWorkspace: document.logicalWorkspace,
          logicalGenerated: false,
          logicalStage: "translation",
          diagramView: "er",
          viewport: DEFAULT_VIEWPORT,
          translationViewport: DEFAULT_VIEWPORT,
          logicalViewport: DEFAULT_VIEWPORT,
          workspaceInfo: { source: "test" },
        },
        checksum: "checksum-1",
        stats: {
          entityCount: 0,
          relationshipCount: 0,
          attributeCount: 0,
          edgeCount: 0,
          tableCount: 0,
          warningCount: 0,
          errorCount: 0,
        },
        tags: ["initial"],
        automatic: true,
      },
    ],
    tags: [
      {
        id: "tag-1",
        name: "initial",
        commitId: "commit-1",
        createdAt: "2026-06-26T10:06:00.000Z",
      },
    ],
    settings: {
      maxCommits: 50,
      keepTaggedCommits: true,
      includeAutomaticCommits: true,
    },
  };

  const parsed = parseProjectFile(JSON.stringify(document));

  assert.equal(parsed.state.versioning.headCommitId, "commit-1");
  assert.equal(parsed.state.versioning.commits.length, 1);
  assert.equal(parsed.state.versioning.commits[0]?.message, "Snapshot iniziale");
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.diagram.meta.name, "Commit fittizio");
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.tool, "select");
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.mode, "edit");
  assert.deepEqual(parsed.state.versioning.commits[0]?.snapshot.selection, { nodeIds: [], edgeIds: [] });
  assert.deepEqual(parsed.state.versioning.commits[0]?.snapshot.translationSelection, { nodeIds: [], edgeIds: [] });
  assert.deepEqual(parsed.state.versioning.commits[0]?.snapshot.logicalSelection, {
    nodeId: null,
    columnId: null,
    edgeId: null,
  });
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.codeDraft, "");
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.codeDirty, false);
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.technicalPanelOpen, false);
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.technicalPanelTab, "review");
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.codePanelOpen, false);
  assert.equal(typeof parsed.state.versioning.commits[0]?.snapshot.codePanelWidth, "number");
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.notesPanelOpen, false);
  assert.equal(typeof parsed.state.versioning.commits[0]?.snapshot.notesPanelWidth, "number");
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.toolbarCollapsed, false);
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.focusMode, false);
  assert.equal(typeof parsed.state.versioning.commits[0]?.snapshot.toolbarWidth, "number");
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.showDiagnostics, true);
  assert.equal(parsed.state.versioning.tags[0]?.name, "initial");
});

test("un project file versione 4 senza versioning viene migrato al formato corrente", () => {
  const document = JSON.parse(serializeProjectFile(createSerializableProject("Versione 4")));
  document.version = 4;
  delete document.versioning;

  const parsed = parseProjectFile(JSON.stringify(document));

  assert.equal(parsed.source, "project-file");
  assert.equal(parsed.document.version, CURRENT_PROJECT_FILE_VERSION);
  assert.deepEqual(parsed.state.versioning, createEmptyProjectVersioningState());
});

test("i formati legacy creano versioning vuoto senza crash", () => {
  const diagram = createEmptyDiagram("Legacy senza versioning");
  const parsed = parseProjectFile(serializeDiagram(diagram), {
    fallbackViewport: DEFAULT_VIEWPORT,
    fallbackDiagramView: "er",
  });

  assert.equal(parsed.source, "legacy-diagram-json");
  assert.deepEqual(parsed.state.versioning, createEmptyProjectVersioningState());
});

test("versioning malformato viene sanitizzato senza impedire il caricamento", () => {
  const document = JSON.parse(serializeProjectFile(createSerializableProject("Versioning malformato")));
  document.versioning = {
    version: "wrong",
    enabled: "yes",
    headCommitId: "missing",
    commits: [
      { id: "", snapshot: null },
      {
        id: "valid-commit",
        parentId: 42,
        message: "",
        createdAt: "",
        snapshot: {
          diagram: document.diagram,
          translationWorkspace: document.translationWorkspace,
          logicalWorkspace: document.logicalWorkspace,
          logicalGenerated: false,
          logicalStage: "translation",
          diagramView: "invalid",
          viewport: { x: "bad", y: 1, zoom: -1 },
          translationViewport: null,
          logicalViewport: DEFAULT_VIEWPORT,
        },
        checksum: 123,
        stats: {
          entityCount: -1,
          relationshipCount: 10,
          attributeCount: "bad",
          edgeCount: 4,
        },
        tags: ["tag-a", "tag-a", 3],
      },
    ],
    tags: [{ id: "tag-a", name: "Tag A", commitId: "missing", createdAt: "" }],
    settings: {
      maxCommits: -1,
      keepTaggedCommits: "yes",
      includeAutomaticCommits: true,
    },
  };

  const parsed = parseProjectFile(JSON.stringify(document), {
    fallbackViewport: DEFAULT_VIEWPORT,
    fallbackDiagramView: "er",
  });

  assert.equal(parsed.state.versioning.version, 1);
  assert.equal(parsed.state.versioning.enabled, true);
  assert.equal(parsed.state.versioning.headCommitId, null);
  assert.equal(parsed.state.versioning.commits.length, 1);
  assert.equal(parsed.state.versioning.commits[0]?.parentId, null);
  assert.equal(parsed.state.versioning.commits[0]?.message, "");
  assert.deepEqual(parsed.state.versioning.commits[0]?.tags, ["tag-a"]);
  assert.deepEqual(parsed.state.versioning.commits[0]?.snapshot.selection, { nodeIds: [], edgeIds: [] });
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.codeDraft, "");
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.codeDirty, false);
  assert.equal(parsed.state.versioning.commits[0]?.snapshot.codePanelOpen, false);
  assert.deepEqual(parsed.state.versioning.tags, []);
  assert.deepEqual(parsed.state.versioning.settings, {
    maxCommits: 200,
    keepTaggedCommits: true,
    includeAutomaticCommits: true,
  });
});

test("versioning con headCommitId inesistente preserva i commit validi e azzera HEAD", () => {
  const snapshot = createFullProjectSnapshot("HEAD orfano");
  const document = JSON.parse(serializeProjectFile(createSerializableProject("HEAD orfano")));
  document.versioning = {
    ...createEmptyProjectVersioningState(),
    headCommitId: "missing-head",
    commits: [
      {
        id: "commit-valid",
        parentId: null,
        message: "Commit valido",
        createdAt: "2026-06-26T12:30:00.000Z",
        snapshot,
        checksum: "checksum-valid",
        stats: {
          entityCount: 0,
          relationshipCount: 0,
          attributeCount: 0,
          edgeCount: 0,
          tableCount: 0,
          warningCount: 0,
          errorCount: 0,
        },
      },
    ],
  };

  const parsed = parseProjectFile(JSON.stringify(document));

  assert.equal(parsed.state.versioning.headCommitId, null);
  assert.equal(parsed.state.versioning.commits.length, 1);
  assert.equal(parsed.state.versioning.commits[0]?.id, "commit-valid");
});

test("versioning viene mantenuto dopo serialize e parse", () => {
  const initial = {
    ...createSerializableProject("Roundtrip versioning"),
    versioning: {
      ...createEmptyProjectVersioningState(),
      enabled: false,
      settings: {
        maxCommits: 12,
        keepTaggedCommits: false,
        includeAutomaticCommits: true,
      },
    },
  };

  const parsed = parseProjectFile(serializeProjectFile(initial));

  assert.equal(parsed.document.versioning.enabled, false);
  assert.deepEqual(parsed.state.versioning.settings, {
    maxCommits: 12,
    keepTaggedCommits: false,
    includeAutomaticCommits: true,
  });
});

test("serialize e parse mantengono snapshot completo dentro versioning", () => {
  const snapshot = createFullProjectSnapshot("Snapshot completo ersp");
  const serialized = serializeProjectFile({
    ...createSerializableProject("Snapshot completo ersp"),
    versioning: {
      ...createEmptyProjectVersioningState(),
      headCommitId: "commit-full",
      commits: [
        {
          id: "commit-full",
          parentId: null,
          message: "Commit completo",
          createdAt: "2026-06-26T12:15:00.000Z",
          snapshot,
          checksum: "checksum-full",
          stats: {
            entityCount: 0,
            relationshipCount: 0,
            attributeCount: 0,
            edgeCount: 0,
            tableCount: 0,
            warningCount: 0,
            errorCount: 0,
          },
        },
      ],
    },
  });

  const parsed = parseProjectFile(serialized);
  const parsedSnapshot = parsed.state.versioning.commits[0]?.snapshot;

  assert.equal(parsed.state.versioning.headCommitId, "commit-full");
  assert.equal(parsedSnapshot?.diagram.meta.name, "Snapshot completo ersp");
  assert.equal(parsedSnapshot?.tool, "attribute");
  assert.deepEqual(parsedSnapshot?.selection, { nodeIds: ["entity-a"], edgeIds: [] });
  assert.deepEqual(parsedSnapshot?.translationSelection, { nodeIds: ["translated-a"], edgeIds: [] });
  assert.deepEqual(parsedSnapshot?.logicalSelection, { nodeId: "table-a", columnId: null, edgeId: null });
  assert.equal(parsedSnapshot?.codeDraft, "entity A");
  assert.equal(parsedSnapshot?.codeDirty, true);
  assert.equal(parsedSnapshot?.technicalPanelOpen, true);
  assert.equal(parsedSnapshot?.technicalPanelTab, "code");
  assert.equal(parsedSnapshot?.codePanelOpen, true);
  assert.equal(parsedSnapshot?.codePanelWidth, 348);
  assert.equal(parsedSnapshot?.notesPanelOpen, false);
  assert.equal(parsedSnapshot?.notesPanelWidth, 336);
  assert.equal(parsedSnapshot?.toolbarCollapsed, true);
  assert.equal(parsedSnapshot?.focusMode, true);
  assert.equal(parsedSnapshot?.toolbarWidth, 220);
  assert.equal(parsedSnapshot?.showDiagnostics, false);
});

test("un file con kind errato viene rifiutato con errore strutturato", () => {
  assert.throws(
    () =>
      parseProjectFile(
        JSON.stringify({
          version: CURRENT_PROJECT_FILE_VERSION,
          kind: "wrong-project-kind",
        }),
        {
          fallbackViewport: DEFAULT_VIEWPORT,
          fallbackDiagramView: "er",
        },
      ),
    (error: unknown) => {
      assert.ok(error instanceof ProjectFileError);
      assert.equal(error.code, "invalid-kind");
      return true;
    },
  );
});

test("serializeProjectFile versione 6 include root, fileTree, files e activeFileId", () => {
  const serialized = serializeProjectFile(createSerializableProject("Progetto multi-file"));
  const document = JSON.parse(serialized);
  const parsed = parseProjectFile(serialized);

  assert.equal(document.version, CURRENT_PROJECT_FILE_VERSION);
  assert.equal(document.project.rootId, document.project.fileTree[0].id);
  assert.equal(typeof document.project.activeFileId, "string");
  assert.equal(document.files[document.project.activeFileId].kind, "schema");
  assert.ok(document.project.fileTree.some((node: { fileId?: string }) => node.fileId === document.project.activeFileId));
  assert.equal(parsed.state.project?.activeFileId, document.project.activeFileId);
  assert.equal(parsed.state.files?.[document.project.activeFileId].kind, "schema");
});

test("parseProjectFile versione 6 con activeFileId null mantiene Welcome Page senza aprire il primo schema", () => {
  const serializable = createSerializableProject("Workspace vuoto");
  const emptyProject = createEmptyProjectExplorerState("Workspace vuoto");
  const schema = createSchemaWorkspaceFile("Schema nascosto.erschema");
  const withSchema = addProjectFile(emptyProject, emptyProject.project.rootId, schema);
  assert.equal(withSchema.ok, true);
  if (!withSchema.ok) {
    return;
  }
  const projectState = {
    ...withSchema.state,
    project: {
      ...withSchema.state.project,
      activeFileId: null,
    },
    view: {
      ...withSchema.state.view,
      activeFileId: null,
    },
  };
  const serialized = serializeProjectFile({
    ...serializable,
    project: projectState.project,
    files: projectState.files,
    explorerView: projectState.view,
  });
  const parsed = parseProjectFile(serialized);

  assert.equal(JSON.parse(serialized).project.activeFileId, null);
  assert.equal(parsed.state.project?.activeFileId, null);
  assert.equal(parsed.state.explorerView?.activeFileId, null);
  assert.equal(Object.values(parsed.state.files ?? {}).filter((file) => file.kind === "schema").length, 1);
});

test("serializeProjectFile preserva contenuto note txt nel progetto", () => {
  const serializable = createSerializableProject("Note project");
  const emptyProject = createEmptyProjectExplorerState("Note project");
  const note = createTextWorkspaceFile("notes.txt", "text", "Project note");
  const withNote = addProjectFile(emptyProject, emptyProject.project.rootId, note);
  assert.equal(withNote.ok, true);
  if (!withNote.ok) {
    return;
  }
  const projectState = {
    ...withNote.state,
    project: { ...withNote.state.project, activeFileId: note.id },
    view: { ...withNote.state.view, activeFileId: note.id },
  };
  const parsed = parseProjectFile(serializeProjectFile({
    ...serializable,
    project: projectState.project,
    files: projectState.files,
    explorerView: projectState.view,
  }));
  const parsedNote = parsed.state.files?.[note.id];

  assert.equal(parsed.state.project?.activeFileId, note.id);
  assert.equal(parsedNote?.kind, "text");
  assert.equal(parsedNote?.kind === "text" ? parsedNote.content : "", "Project note");
});
