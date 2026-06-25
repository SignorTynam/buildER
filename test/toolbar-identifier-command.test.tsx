import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { I18nProvider } from "../src/i18n/I18nProvider.tsx";
import { DEFAULT_LOCALE, setCurrentLocale } from "../src/i18n/index.ts";
import { Toolbar, findSimpleInternalIdentifierForAttribute } from "../src/toolbar/Toolbar.tsx";
import type { AttributeNode, DiagramDocument, DiagramNode, EditorMode, EntityNode, RelationshipNode, SelectionState } from "../src/types/diagram.ts";

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
  selectedNode: DiagramNode,
  mode: EditorMode | "readonly" = "edit",
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
  const subattributeButton = markup.match(/<button[^>]*title="Subattribute"[\s\S]*?<\/button>/)?.[0];

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
  const attributeButton = markup.match(/<button[^>]*title="Attribute"[\s\S]*?<\/button>/)?.[0];

  assert.match(markup, />Attribute</);
  assert.ok(attributeButton);
  assert.doesNotMatch(attributeButton, /disabled/);
  setCurrentLocale(DEFAULT_LOCALE);
});

test("attribute command for a selected relationship is disabled in read-only mode", () => {
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
  const attributeButton = markup.match(/<button[^>]*title="Attribute"[\s\S]*?<\/button>/)?.[0];

  assert.ok(attributeButton);
  assert.match(attributeButton, /disabled/);
  setCurrentLocale(DEFAULT_LOCALE);
});

