import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { DEFAULT_LOCALE, setCurrentLocale } from "../src/i18n/index.ts";
import { getVisibleExportMenuItems } from "../src/components/FloatingExportMenu.tsx";
import { Toolbar, findSimpleInternalIdentifierForAttribute, getVisibleToolbarCommands } from "../src/toolbar/Toolbar.tsx";
import type {
  AttributeNode,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EditorMode,
  EntityNode,
  RelationshipNode,
  SelectionState,
} from "../src/types/diagram.ts";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

function entity(overrides: Partial<EntityNode> = {}): EntityNode {
  return {
    id: "entity-1",
    type: "entity",
    label: "ENTITA1",
    x: 100,
    y: 100,
    width: 160,
    height: 72,
    relationshipParticipations: [],
    ...overrides,
  };
}

function attribute(overrides: Partial<AttributeNode> = {}): AttributeNode {
  return {
    id: "attr-1",
    type: "attribute",
    label: "ATTRIBUTO1",
    x: 120,
    y: 220,
    width: 140,
    height: 36,
    ...overrides,
  };
}

function relationship(overrides: Partial<RelationshipNode> = {}): RelationshipNode {
  return {
    id: "relationship-1",
    type: "relationship",
    label: "RELAZIONE1",
    x: 360,
    y: 100,
    width: 150,
    height: 80,
    ...overrides,
  };
}

function diagramWithAttribute(attributeNode: AttributeNode, entityNode: EntityNode = entity()): DiagramDocument {
  return {
    meta: { name: "Test", version: 1 },
    notes: "",
    nodes: [entityNode, attributeNode],
    edges: [
      { id: "edge-1", type: "attribute", sourceId: entityNode.id, targetId: attributeNode.id, label: "", lineStyle: "solid" },
    ],
  };
}

function renderToolbar(
  diagram: DiagramDocument,
  selection: SelectionState,
  selectedNode?: DiagramNode,
  mode: EditorMode | "readonly" = "edit",
  options: { selectedEdge?: DiagramEdge; canUndo?: boolean; canRedo?: boolean } = {},
): string {
  return renderToStaticMarkup(
    <I18nProvider>
      <Toolbar
        diagram={diagram}
        selection={selection}
        activeTool="select"
        mode={mode as EditorMode}
        collapsed={false}
        selectionItemCount={selection.nodeIds.length + selection.edgeIds.length}
        issues={[]}
        selectedNode={selectedNode}
        selectedEdge={options.selectedEdge}
        canUndo={options.canUndo}
        canRedo={options.canRedo}
        onExportPng={() => undefined}
        onExportJpeg={() => undefined}
        onToolChange={() => undefined}
        onDuplicateSelection={() => undefined}
        onDeleteSelection={() => undefined}
        onDeleteIdentifierSelection={() => undefined}
        onCreateAttributeForSelection={() => undefined}
        onRenameSelection={() => undefined}
        onOpenTranslation={() => undefined}
        onExportSvg={() => undefined}
      />
    </I18nProvider>,
  );
}

function buttonMarkup(markup: string, title: string): string | undefined {
  return markup.match(new RegExp(`<button[^>]*title="${title}"[\\s\\S]*?<\\/button>`))?.[0];
}

test("findSimpleInternalIdentifierForAttribute finds one-attribute internal identifiers", () => {
  const selectedAttribute = attribute({ isIdentifier: true });
  const diagram = diagramWithAttribute(
    selectedAttribute,
    entity({ internalIdentifiers: [{ id: "simple-id", attributeIds: [selectedAttribute.id] }] }),
  );

  assert.deepEqual(findSimpleInternalIdentifierForAttribute(diagram, selectedAttribute.id), {
    hostEntityId: "entity-1",
    internalIdentifierId: "simple-id",
  });
});

test("simple id command is hidden when selected attribute is already an identifier", () => {
  setCurrentLocale("en");
  const selectedAttribute = attribute({ isIdentifier: true });
  const diagram = diagramWithAttribute(
    selectedAttribute,
    entity({ internalIdentifiers: [{ id: "simple-id", attributeIds: [selectedAttribute.id] }] }),
  );

  const markup = renderToolbar(diagram, { nodeIds: [selectedAttribute.id], edgeIds: [] }, selectedAttribute);

  assert.doesNotMatch(markup, />Simple ID</);
  assert.match(markup, />Delete Id</);
  assert.match(markup, /Delete the selected identifier without deleting its attributes/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("simple id command is visible for a normal directly connected attribute", () => {
  setCurrentLocale("en");
  const selectedAttribute = attribute({ isIdentifier: false, isCompositeInternal: false });
  const diagram = diagramWithAttribute(selectedAttribute);

  const markup = renderToolbar(diagram, { nodeIds: [selectedAttribute.id], edgeIds: [] }, selectedAttribute);

  assert.match(markup, />Simple ID</);
  assert.doesNotMatch(markup, />Delete Id</);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("subattribute command is visible for a simple directly connected attribute", () => {
  setCurrentLocale("en");
  const selectedAttribute = attribute({ isMultivalued: false });
  const diagram = diagramWithAttribute(selectedAttribute);

  const markup = renderToolbar(diagram, { nodeIds: [selectedAttribute.id], edgeIds: [] }, selectedAttribute);

  assert.match(markup, />Subattribute</);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("subattribute command remains visible for an existing composite attribute", () => {
  setCurrentLocale("en");
  const selectedAttribute = attribute({ isMultivalued: true });
  const childAttribute = attribute({
    id: "attr-child-1",
    label: "ATTRIBUTO2",
    x: 120,
    y: 280,
    width: 140,
    height: 36,
  });
  const entityNode = entity();
  const diagram: DiagramDocument = {
    meta: { name: "Composite attribute", version: 1 },
    notes: "",
    nodes: [entityNode, selectedAttribute, childAttribute],
    edges: [
      { id: "edge-1", type: "attribute", sourceId: entityNode.id, targetId: selectedAttribute.id, label: "", lineStyle: "solid" },
      {
        id: "edge-2",
        type: "attribute",
        sourceId: childAttribute.id,
        targetId: selectedAttribute.id,
        label: "",
        lineStyle: "solid",
      },
    ],
  };

  const markup = renderToolbar(diagram, { nodeIds: [selectedAttribute.id], edgeIds: [] }, selectedAttribute);
  const subattributeButton = buttonMarkup(markup, "Subattribute");

  assert.match(markup, />Subattribute</);
  assert.ok(subattributeButton);
  assert.doesNotMatch(subattributeButton, /disabled/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("attribute command is visible for a selected relationship", () => {
  setCurrentLocale("en");
  const selectedRelationship = relationship();
  const diagram: DiagramDocument = {
    meta: { name: "Relationship attribute", version: 1 },
    notes: "",
    nodes: [selectedRelationship],
    edges: [],
  };

  const markup = renderToolbar(diagram, { nodeIds: [selectedRelationship.id], edgeIds: [] }, selectedRelationship);
  const attributeButton = buttonMarkup(markup, "Attribute");

  assert.match(markup, />Attribute</);
  assert.ok(attributeButton);
  assert.doesNotMatch(attributeButton, /disabled/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("attribute command for a selected relationship is hidden in read-only mode", () => {
  setCurrentLocale("en");
  const selectedRelationship = relationship();
  const diagram: DiagramDocument = {
    meta: { name: "Relationship attribute readonly", version: 1 },
    notes: "",
    nodes: [selectedRelationship],
    edges: [],
  };

  const markup = renderToolbar(
    diagram,
    { nodeIds: [selectedRelationship.id], edgeIds: [] },
    selectedRelationship,
    "readonly",
  );

  assert.doesNotMatch(markup, />Attribute</);
  assert.doesNotMatch(markup, /\sdisabled(=| |>)/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("toolbar hides disabled commands and does not render an empty disabled-only create group", () => {
  setCurrentLocale("en");
  const markup = renderToolbar(
    { meta: { name: "Readonly", version: 1 }, notes: "", nodes: [], edges: [] },
    { nodeIds: [], edgeIds: [] },
    undefined,
    "readonly",
  );
  const separatorCount = (markup.match(/designer-toolbar-separator/g) ?? []).length;

  assert.doesNotMatch(markup, />Entity</);
  assert.doesNotMatch(markup, />Relationship</);
  assert.doesNotMatch(markup, />Undo</);
  assert.doesNotMatch(markup, />Redo</);
  assert.doesNotMatch(markup, /\sdisabled(=| |>)/);
  assert.equal(separatorCount, 1);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("toolbar shows undo and redo only when they are available", () => {
  setCurrentLocale("en");
  const emptyDiagram: DiagramDocument = { meta: { name: "History", version: 1 }, notes: "", nodes: [], edges: [] };
  const unavailable = renderToolbar(emptyDiagram, { nodeIds: [], edgeIds: [] }, undefined, "edit", {
    canUndo: false,
    canRedo: false,
  });
  const available = renderToolbar(emptyDiagram, { nodeIds: [], edgeIds: [] }, undefined, "edit", {
    canUndo: true,
    canRedo: true,
  });

  assert.doesNotMatch(unavailable, />Undo</);
  assert.doesNotMatch(unavailable, />Redo</);
  assert.match(available, />Undo</);
  assert.match(available, />Redo</);
  assert.doesNotMatch(unavailable, /\sdisabled(=| |>)/);
  assert.doesNotMatch(available, /\sdisabled(=| |>)/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("attribute-only unavailable detail commands are hidden instead of disabled", () => {
  setCurrentLocale("en");
  const parentAttribute = attribute({ id: "attr-parent", label: "ATTRIBUTO_PARENT", isMultivalued: true });
  const selectedAttribute = attribute({ id: "attr-child", label: "ATTRIBUTO_CHILD" });
  const entityNode = entity();
  const diagram: DiagramDocument = {
    meta: { name: "Nested attribute", version: 1 },
    notes: "",
    nodes: [entityNode, parentAttribute, selectedAttribute],
    edges: [
      { id: "edge-parent", type: "attribute", sourceId: entityNode.id, targetId: parentAttribute.id, label: "", lineStyle: "solid" },
      { id: "edge-child", type: "attribute", sourceId: selectedAttribute.id, targetId: parentAttribute.id, label: "", lineStyle: "solid" },
    ],
  };
  const markup = renderToolbar(diagram, { nodeIds: [selectedAttribute.id], edgeIds: [] }, selectedAttribute);

  assert.doesNotMatch(markup, />Subattribute</);
  assert.doesNotMatch(markup, />Simple ID</);
  assert.doesNotMatch(markup, />Composite ID</);
  assert.doesNotMatch(markup, /\sdisabled(=| |>)/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("connector mixed identifier command is hidden when cardinality is not one-one", () => {
  setCurrentLocale("en");
  const entityNode = entity({
    relationshipParticipations: [
      { id: "participation-1", relationshipId: "relationship-1", cardinality: "(0,N)" },
    ],
  });
  const relationshipNode = relationship();
  const connector: DiagramEdge = {
    id: "connector-1",
    type: "connector",
    sourceId: entityNode.id,
    targetId: relationshipNode.id,
    label: "",
    lineStyle: "solid",
    participationId: "participation-1",
  };
  const diagram: DiagramDocument = {
    meta: { name: "Connector", version: 1 },
    notes: "",
    nodes: [entityNode, relationshipNode],
    edges: [connector],
  };
  const markup = renderToolbar(
    diagram,
    { nodeIds: [], edgeIds: [connector.id] },
    undefined,
    "edit",
    { selectedEdge: connector },
  );

  assert.doesNotMatch(markup, />External ID</);
  assert.match(markup, />Card</);
  assert.match(markup, />Role</);
  assert.doesNotMatch(markup, /\sdisabled(=| |>)/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("toolbar command visibility helper filters disabled commands", () => {
  const visible = getVisibleToolbarCommands([
    { key: "enabled", label: "Enabled", icon: "E", onClick: () => undefined },
    { key: "disabled", label: "Disabled", icon: "D", onClick: () => undefined, disabled: true },
  ]);

  assert.deepEqual(visible.map((command) => command.key), ["enabled"]);
});

test("floating export menu visibility helper filters disabled items", () => {
  const visible = getVisibleExportMenuItems([
    { key: "project", label: "Project", onClick: () => undefined, disabled: true },
    { key: "png", label: "PNG", onClick: () => undefined },
    { key: "svg", label: "SVG", onClick: () => undefined, disabled: false },
  ]);

  assert.deepEqual(visible.map((item) => item.key), ["png", "svg"]);
});

