import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { DiagramDocument, DiagramEdge, DiagramNode } from "../src/types/diagram.ts";
import type { LogicalTranslationChoice } from "../src/types/logical.ts";
import type { LogicalEntityKeySelectionRequest } from "../src/utils/logicalTranslation.ts";
import { EntityKeyChoicePreview } from "../src/logical/EntityKeyChoicePreview.tsx";
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
  }, {
    id: "edge-attr-7",
    type: "attribute",
    sourceId: "entity-1",
    targetId: "attr-7",
    label: "",
    lineStyle: "solid",
  }, {
    id: "edge-attr-3",
    type: "attribute",
    sourceId: "entity-2",
    targetId: "attr-3",
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
  const request = baseRequest("entity-1", [choice]);
  const preview = buildEntityKeyChoicePreviewData({
    diagram,
    request,
    choice,
  });

  assert.equal(preview.kind, "external");
  assert.equal(preview.kindLabel, "Chiave esterna/mista");
  assert.equal(preview.title, "Usa ENTITA2_ATTRIBUTO3 + ATTRIBUTO7 come PK");
  assert.match(preview.explanation, /relazioni identificanti/);
  assert.match(preview.effectLines.join(" "), /ENTITA4/);
  assert.match(preview.effectLines.join(" "), /ENTITA2/);
  assert.match(preview.effectLines.join(" "), /RELAZIONE1/);
  assert.match(preview.effectLines.join(" "), /ENTITA2_ATTRIBUTO3/);
  assert.match(preview.effectLines.join(" "), /ATTRIBUTO7/);
  assert.deepEqual(preview.entities.map((entity) => [entity.label, entity.role]), [["ENTITA4", "host"], ["ENTITA2", "source"]]);
  assert.deepEqual(preview.relationships.map((relationship) => relationship.label), ["RELAZIONE1"]);
  assert.deepEqual(
    preview.logicalTable.columns.map((column) => [column.label, column.isPrimaryKey, column.isForeignKey]),
    [["ATTRIBUTO7", true, false], ["ENTITA2_ATTRIBUTO3", true, true]],
  );
  assert.deepEqual(preview.foreignKeys.map((foreignKey) => [foreignKey.fromTableName, foreignKey.toTableName]), [["ENTITA4", "ENTITA2"]]);
  assert.deepEqual(preview.foreignKeys[0]?.fromColumnNames, ["ENTITA2_ATTRIBUTO3"]);
  assert.deepEqual(preview.foreignKeys[0]?.toColumnNames, ["ATTRIBUTO3"]);
  assert.deepEqual(
    preview.tables.find((table) => table.role === "referenced")?.columns.map((column) => column.name),
    ["ATTRIBUTO3"],
  );

  const markup = renderToStaticMarkup(
    createElement(EntityKeyChoicePreview, { diagram, request, choice, confirmed: false }),
  );
  assert.match(markup, /logical-column-name-underline/);
  assert.doesNotMatch(markup, /logical-column-qualifier-pk[^"]*underlined/);
});

test("logical key preview: chiave esterna annidata importa la chiave completa della sorgente", () => {
  const diagram: DiagramDocument = {
    meta: { name: "Nested preview", version: 3 },
    notes: "",
    nodes: [
      {
        id: "DIPARTIMENTO",
        type: "entity",
        label: "DIPARTIMENTO",
        x: 0,
        y: 0,
        width: 160,
        height: 80,
        internalIdentifiers: [{ id: "DIP-id", attributeIds: ["idDipartimento"] }],
      },
      {
        id: "CORSO",
        type: "entity",
        label: "CORSO",
        x: 0,
        y: 0,
        width: 160,
        height: 80,
        externalIdentifiers: [{
          id: "CORSO-ext",
          importedParts: [{
            id: "CORSO-part-dip",
            relationshipId: "CONTIENE",
            sourceEntityId: "DIPARTIMENTO",
            importedIdentifierId: "DIP-id",
          }],
          localAttributeIds: ["idCorso"],
        }],
      },
      {
        id: "EDIZIONE_CORSO",
        type: "entity",
        label: "EDIZIONE_CORSO",
        x: 0,
        y: 0,
        width: 180,
        height: 80,
        externalIdentifiers: [{
          id: "EDIZIONE-ext",
          importedParts: [{
            id: "EDIZIONE-part-corso",
            relationshipId: "SVOLGIMENTO",
            sourceEntityId: "CORSO",
            importedIdentifierId: "CORSO-ext",
            importedIdentifierKind: "external",
          }],
          localAttributeIds: ["Anno"],
        }],
      },
      { id: "CONTIENE", type: "relationship", label: "CONTIENE", x: 0, y: 0, width: 120, height: 70 },
      { id: "SVOLGIMENTO", type: "relationship", label: "SVOLGIMENTO", x: 0, y: 0, width: 140, height: 70 },
      { id: "idDipartimento", type: "attribute", label: "idDipartimento", x: 0, y: 0, width: 120, height: 36 },
      { id: "idCorso", type: "attribute", label: "idCorso", x: 0, y: 0, width: 100, height: 36 },
      { id: "Anno", type: "attribute", label: "Anno", x: 0, y: 0, width: 100, height: 36 },
    ],
    edges: [
      { id: "e-dip-id", type: "attribute", sourceId: "DIPARTIMENTO", targetId: "idDipartimento", label: "", lineStyle: "solid" },
      { id: "e-corso-id", type: "attribute", sourceId: "CORSO", targetId: "idCorso", label: "", lineStyle: "solid" },
      { id: "e-edizione-anno", type: "attribute", sourceId: "EDIZIONE_CORSO", targetId: "Anno", label: "", lineStyle: "solid" },
    ],
  };
  const choice = externalChoice("EDIZIONE-ext");
  const preview = buildEntityKeyChoicePreviewData({
    diagram,
    request: baseRequest("EDIZIONE_CORSO", [choice]),
    choice,
  });

  assert.equal(preview.kind, "external");
  assert.equal(preview.kindLabel, "Chiave esterna/mista");
  assert.deepEqual(preview.foreignKeys[0]?.toColumnNames, ["idDipartimento", "idCorso"]);
  assert.deepEqual(preview.foreignKeys[0]?.fromColumnNames, ["CORSO_idDipartimento", "CORSO_idCorso"]);
  assert.match(preview.title, /CORSO_idDipartimento/);
  assert.match(preview.title, /CORSO_idCorso/);
  assert.match(preview.title, /Anno/);
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
