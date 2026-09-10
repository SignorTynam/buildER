import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument } from "../src/types/diagram.ts";
import { createEmptyDiagram, parseDiagram, serializeDiagram } from "../src/utils/diagram.ts";
import {
  applyErTranslationChoice,
  buildErTranslationOverview,
  createEmptyErTranslationWorkspace,
  getErTranslationChoicesForItem,
} from "../src/utils/erTranslation.ts";
import { createEmptyLogicalWorkspace } from "../src/utils/logicalWorkspace.ts";
import { createEmptyProjectVersioningState } from "../src/utils/projectFile.ts";
import {
  CURRENT_SCHEMA_FILE_VERSION,
  SCHEMA_FILE_KIND,
  parseSchemaFile,
  serializeSchemaFile,
} from "../src/utils/projectSchemaFile.ts";

const VIEWPORT = { x: 12, y: 24, zoom: 1.2 };

function createExternalOwnerMultivaluedDiagram(): DiagramDocument {
  return parseDiagram(serializeDiagram({
    meta: { name: "Dependent external owner", version: 3 },
    notes: "",
    nodes: [
      {
        id: "ROOT", type: "entity", label: "ROOT", x: 0, y: 0, width: 160, height: 80,
        internalIdentifiers: [{ id: "root-pk", attributeIds: ["root-id"] }],
        relationshipParticipations: [{ id: "root-owner-p", relationshipId: "ROOT_OWNER", cardinality: "(0,N)" }],
      },
      {
        id: "OWNER", type: "entity", label: "OWNER", x: 300, y: 0, width: 160, height: 80,
        externalIdentifiers: [{
          id: "owner-external-key",
          importedParts: [{
            id: "owner-root-part",
            relationshipId: "ROOT_OWNER",
            sourceEntityId: "ROOT",
            importedIdentifierId: "root-pk",
          }],
          localAttributeIds: ["owner-code"],
        }],
        relationshipParticipations: [{ id: "owner-root-p", relationshipId: "ROOT_OWNER", cardinality: "(1,1)" }],
      },
      { id: "ROOT_OWNER", type: "relationship", label: "ROOT_OWNER", x: 190, y: 0, width: 120, height: 70 },
      { id: "root-id", type: "attribute", label: "rootId", x: 0, y: 120, width: 100, height: 40, isIdentifier: true },
      { id: "owner-code", type: "attribute", label: "ownerCode", x: 300, y: 120, width: 110, height: 40 },
      { id: "tag", type: "attribute", label: "tag", x: 500, y: 120, width: 100, height: 40, cardinality: "(0,N)" },
    ],
    edges: [
      { id: "root-id-e", type: "attribute", sourceId: "root-id", targetId: "ROOT", label: "", lineStyle: "solid" },
      { id: "owner-code-e", type: "attribute", sourceId: "owner-code", targetId: "OWNER", label: "", lineStyle: "solid" },
      { id: "tag-e", type: "attribute", sourceId: "tag", targetId: "OWNER", label: "", lineStyle: "solid" },
      { id: "root-owner-e", type: "connector", sourceId: "ROOT", targetId: "ROOT_OWNER", label: "", lineStyle: "solid", participationId: "root-owner-p" },
      { id: "owner-root-e", type: "connector", sourceId: "OWNER", targetId: "ROOT_OWNER", label: "", lineStyle: "solid", participationId: "owner-root-p" },
    ],
  } satisfies DiagramDocument));
}

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

test(".erschema conserva Dependent configurato su owner external identifier", () => {
  const diagram = createExternalOwnerMultivaluedDiagram();
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const item = buildErTranslationOverview(workspace).itemsByStep["composite-attributes"].find(
    (candidate) => candidate.id === "tag",
  );
  assert.ok(item);
  const choice = getErTranslationChoicesForItem(workspace, item).find(
    (candidate) => candidate.rule === "simple-multivalued-dependent",
  );
  assert.ok(choice);
  assert.deepEqual(choice.configuration, {
    ownerIdentifierKind: "external",
    ownerIdentifierId: "owner-external-key",
  });
  const translationWorkspace = applyErTranslationChoice(diagram, workspace, choice, item.targetType, item.id);
  const serialized = serializeSchemaFile({
    diagram,
    translationWorkspace,
    logicalWorkspace: createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram),
    logicalGenerated: false,
    logicalStage: "translation",
    diagramView: "translation",
    viewport: VIEWPORT,
    translationViewport: VIEWPORT,
    logicalViewport: VIEWPORT,
    workspace: {
      tool: "select",
      mode: "edit",
      selection: { nodeIds: [], edgeIds: [] },
      translationSelection: { nodeIds: [], edgeIds: [] },
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
    },
  });
  const restored = parseSchemaFile(serialized).translationWorkspace;

  assert.deepEqual(restored.translation.conflicts, []);
  assert.equal(restored.translation.decisions[0].rule, "simple-multivalued-dependent");
  assert.deepEqual(restored.translation.decisions[0].configuration, choice.configuration);
  const dependent = restored.translatedDiagram.nodes.find(
    (node) => node.type === "entity" && node.label === "TAG",
  );
  assert.ok(dependent?.type === "entity");
  const identifier = dependent.externalIdentifiers?.[0];
  assert.ok(identifier);
  assert.deepEqual(identifier.localAttributeIds, ["tag"]);
  assert.equal(identifier.importedParts[0].importedIdentifierKind, "external");
  assert.equal(identifier.importedParts[0].importedIdentifierId, "owner-external-key");
});
