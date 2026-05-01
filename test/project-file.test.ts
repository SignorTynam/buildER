import assert from "node:assert/strict";
import test from "node:test";

import { createEmptyDiagram, serializeDiagram } from "../src/utils/diagram.ts";
import { createEmptyErTranslationWorkspace } from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import {
  CURRENT_PROJECT_FILE_VERSION,
  parseProjectFile,
  PROJECT_FILE_KIND,
  ProjectFileError,
  serializeProjectFile,
} from "../src/utils/projectFile.ts";

const DEFAULT_VIEWPORT = { x: 180, y: 110, zoom: 1 };

test("il formato .ersp salva e ripristina vista corrente e viewport del progetto", () => {
  const diagram = createEmptyDiagram("Progetto completo");
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);

  const serialized = serializeProjectFile({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: true,
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
  assert.equal(parsed.state.diagramView, "logical");
  assert.deepEqual(parsed.state.viewport, { x: 42, y: -18, zoom: 1.35 });
  assert.deepEqual(parsed.state.translationViewport, { x: 64, y: 24, zoom: 0.92 });
  assert.deepEqual(parsed.state.logicalViewport, { x: -120, y: 88, zoom: 0.75 });
  assert.equal(parsed.state.translationWorkspace.translatedDiagram.meta.name, "Progetto completo");
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
