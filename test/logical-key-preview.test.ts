import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument, DiagramEdge, DiagramNode } from "../src/types/diagram.ts";
import type { LogicalTranslationChoice } from "../src/types/logical.ts";
import type { LogicalEntityKeySelectionRequest } from "../src/utils/logicalTranslation.ts";
import {
  buildEntityKeyChoicePreviewData,
  getNextEntityKeyModalIndex,
  getPreviousEntityKeyModalIndex,
} from "../src/utils/logicalKeyPreview.ts";

function baseRequest(entityId: string, choices: LogicalTranslationChoice[]): LogicalEntityKeySelectionRequest {
  return {
    targetKey: `entity:${entityId}`,
    item: {
      id: entityId,
      targetType: "entity",
      step: "entities",
      label: entityId === "entity-1" ? "ENTITA1" : entityId,
      description: "",
      status: "pending",
      choiceIds: choices.map((choice) => choice.id),
      conflictMessages: [],
    },
    choices,
  };
}

function internalChoice(identifierId: string): LogicalTranslationChoice {
  return {
    id: `choice-${identifierId}`,
    step: "entities",
    rule: "entity-table-internal",
    label: `Tabella con PK interna: ${identifierId}`,
    description: "Usa una PK interna.",
    summary: "",
    configuration: {
      keySourceType: "internal",
      keySourceId: identifierId,
    },
  };
}

function externalChoice(identifierId: string): LogicalTranslationChoice {
  return {
    id: `choice-${identifierId}`,
    step: "entities",
    rule: "entity-table-external",
    label: `Tabella con PK esterna: ${identifierId}`,
    description: "Usa una PK esterna.",
    summary: "",
    configuration: {
      keySourceType: "external",
      keySourceId: identifierId,
    },
  };
}

test("logical key preview: chiave interna semplice", () => {
  const entity: Extract<DiagramNode, { type: "entity" }> = {
    id: "entity-1",
    type: "entity",
    label: "ENTITA1",
    x: 0,
    y: 0,
    width: 160,
    height: 80,
    internalIdentifiers: [
      { id: "id-attr1", attributeIds: ["attr-1"] },
      { id: "id-attr2", attributeIds: ["attr-2"] },
    ],
  };
  const diagram: DiagramDocument = {
    meta: { name: "Preview", version: 3 },
    notes: "",
    nodes: [
      entity,
      { id: "attr-1", type: "attribute", label: "ATTRIBUTO1", x: 0, y: 0, width: 120, height: 36 },
      { id: "attr-2", type: "attribute", label: "ATTRIBUTO2", x: 0, y: 0, width: 120, height: 36 },
    ],
    edges: [],
  };
  const choice = internalChoice("id-attr1");
  const preview = buildEntityKeyChoicePreviewData({
    diagram,
    request: baseRequest("entity-1", [choice, internalChoice("id-attr2")]),
    choice,
  });

  assert.equal(preview.kind, "internal");
  assert.equal(preview.hostEntityLabel, "ENTITA1");
  assert.equal(preview.kindLabel, "Chiave interna");
  assert.equal(preview.title, "Usa ATTRIBUTO1 come PK");
  assert.deepEqual(preview.entities[0]?.attributes, [{ id: "attr-1", label: "ATTRIBUTO1", role: "selected-local" }]);
  assert.equal(preview.logicalTable.columns.find((column) => column.label === "ATTRIBUTO1")?.isPrimaryKey, true);
  assert.equal(preview.logicalTable.columns.find((column) => column.label === "ATTRIBUTO2")?.isPrimaryKey, false);
  assert.equal(preview.foreignKeys.length, 0);
  assert.deepEqual(preview.alternativeKeys.map((key) => key.columnNames), [["ATTRIBUTO2"]]);
});

test("logical key preview: chiave esterna mista", () => {
  const entity1: Extract<DiagramNode, { type: "entity" }> = {
    id: "entity-1",
    type: "entity",
    label: "ENTITA4",
    x: 0,
    y: 0,
    width: 160,
    height: 80,
    externalIdentifiers: [{
      id: "external-1",
      localAttributeIds: ["attr-7"],
      importedParts: [{
        id: "part-1",
        relationshipId: "rel-1",
        sourceEntityId: "entity-2",
        importedIdentifierId: "id-attr3",
      }],
    }],
  };
  const entity2: Extract<DiagramNode, { type: "entity" }> = {
    id: "entity-2",
    type: "entity",
    label: "ENTITA2",
    x: 0,
    y: 0,
    width: 160,
    height: 80,
    internalIdentifiers: [{ id: "id-attr3", attributeIds: ["attr-3"] }],
  };
  const edges: DiagramEdge[] = [{
    id: "edge-rel",
    type: "connector",
    sourceId: "entity-1",
    targetId: "rel-1",
    label: "",
    lineStyle: "solid",
  }];
  const diagram: DiagramDocument = {
    meta: { name: "Preview", version: 3 },
    notes: "",
    nodes: [
      entity1,
      entity2,
      { id: "rel-1", type: "relationship", label: "RELAZIONE1", x: 0, y: 0, width: 160, height: 80 },
      { id: "attr-7", type: "attribute", label: "ATTRIBUTO7", x: 0, y: 0, width: 120, height: 36 },
      { id: "attr-3", type: "attribute", label: "ATTRIBUTO3", x: 0, y: 0, width: 120, height: 36 },
    ],
    edges,
  };
  const choice = externalChoice("external-1");
  const preview = buildEntityKeyChoicePreviewData({
    diagram,
    request: baseRequest("entity-1", [choice]),
    choice,
  });

  assert.equal(preview.kind, "external");
  assert.equal(preview.kindLabel, "Chiave esterna/mista");
  assert.equal(preview.title, "Usa ATTRIBUTO3 + ATTRIBUTO7 come PK");
  assert.match(preview.explanation, /relazioni identificanti/);
  assert.match(preview.effectLines.join(" "), /ENTITA4/);
  assert.match(preview.effectLines.join(" "), /ENTITA2/);
  assert.match(preview.effectLines.join(" "), /RELAZIONE1/);
  assert.match(preview.effectLines.join(" "), /ATTRIBUTO3/);
  assert.match(preview.effectLines.join(" "), /ATTRIBUTO7/);
  assert.deepEqual(preview.entities.map((entity) => [entity.label, entity.role]), [["ENTITA4", "host"], ["ENTITA2", "source"]]);
  assert.deepEqual(preview.relationships.map((relationship) => relationship.label), ["RELAZIONE1"]);
  assert.deepEqual(
    preview.logicalTable.columns.map((column) => [column.label, column.isPrimaryKey, column.isForeignKey]),
    [["ATTRIBUTO7", true, false], ["ATTRIBUTO3", true, true]],
  );
  assert.deepEqual(preview.foreignKeys.map((foreignKey) => [foreignKey.fromTableName, foreignKey.toTableName]), [["ENTITA4", "ENTITA2"]]);
});

test("logical key preview: chiave interna composta", () => {
  const entity: Extract<DiagramNode, { type: "entity" }> = {
    id: "entity-1",
    type: "entity",
    label: "ENTITA1",
    x: 0,
    y: 0,
    width: 160,
    height: 80,
    internalIdentifiers: [{ id: "id-composite", attributeIds: ["attr-1", "attr-2"] }],
  };
  const diagram: DiagramDocument = {
    meta: { name: "Preview", version: 3 },
    notes: "",
    nodes: [
      entity,
      { id: "attr-1", type: "attribute", label: "ATTRIBUTO1", x: 0, y: 0, width: 120, height: 36 },
      { id: "attr-2", type: "attribute", label: "ATTRIBUTO2", x: 0, y: 0, width: 120, height: 36 },
    ],
    edges: [],
  };
  const choice = internalChoice("id-composite");
  const preview = buildEntityKeyChoicePreviewData({
    diagram,
    request: baseRequest("entity-1", [choice]),
    choice,
  });

  assert.equal(preview.kindLabel, "Chiave interna composta");
  assert.deepEqual(
    preview.logicalTable.columns.map((column) => [column.label, column.isPrimaryKey, column.isForeignKey]),
    [["ATTRIBUTO1", true, false], ["ATTRIBUTO2", true, false]],
  );
});

test("logical key preview: fallback senza eccezioni", () => {
  const diagram: DiagramDocument = {
    meta: { name: "Preview", version: 3 },
    notes: "",
    nodes: [{
      id: "entity-1",
      type: "entity",
      label: "ENTITA1",
      x: 0,
      y: 0,
      width: 160,
      height: 80,
      internalIdentifiers: [{ id: "id-attr1", attributeIds: ["attr-1"] }],
    }],
    edges: [],
  };
  const preview = buildEntityKeyChoicePreviewData({
    diagram,
    request: baseRequest("entity-1", []),
    choice: null,
  });

  assert.equal(preview.kind, "none");
  assert.match(preview.summary, /Preview non disponibile/);
});

test("logical key preview: indici di paginazione restano nei limiti", () => {
  assert.equal(getPreviousEntityKeyModalIndex(0), 0);
  assert.equal(getPreviousEntityKeyModalIndex(2), 1);
  assert.equal(getNextEntityKeyModalIndex(0, 3), 1);
  assert.equal(getNextEntityKeyModalIndex(2, 3), 2);
  assert.equal(getNextEntityKeyModalIndex(0, 0), 0);
});
