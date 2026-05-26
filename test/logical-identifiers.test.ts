import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument, DiagramEdge, DiagramNode, InternalIdentifier } from "../src/types/diagram.ts";
import type { LogicalModel, LogicalTable } from "../src/types/logical.ts";
import { generateLogicalModel } from "../src/utils/logicalMapping.ts";
import { generateLogicalSql } from "../src/utils/logicalSql.ts";
import {
  applyLogicalTranslationChoice,
  buildLogicalTranslationOverview,
  createEmptyLogicalWorkspace,
  getLogicalTranslationChoicesForItem,
} from "../src/utils/logicalTranslation.ts";

const ATTRIBUTE_IDS = {
  codViaggio: "attr-codViaggio",
  dataOraArrivo: "attr-dataOraArrivo",
  dataOraPartenza: "attr-dataOraPartenza",
  chilometraggio: "attr-chilometraggio",
  codiceEsterno: "attr-codiceEsterno",
} as const;

function createViaggioDiagram(internalIdentifiers: InternalIdentifier[]): DiagramDocument {
  const entity: Extract<DiagramNode, { type: "entity" }> = {
    id: "entity-viaggio",
    type: "entity",
    label: "VIAGGIO",
    x: 120,
    y: 120,
    width: 160,
    height: 80,
    internalIdentifiers,
  };

  const attributes: Array<Extract<DiagramNode, { type: "attribute" }>> = [
    { id: ATTRIBUTE_IDS.codViaggio, type: "attribute", label: "codViaggio", x: 0, y: 0, width: 120, height: 36 },
    { id: ATTRIBUTE_IDS.dataOraArrivo, type: "attribute", label: "dataOraArrivo", x: 0, y: 48, width: 150, height: 36 },
    { id: ATTRIBUTE_IDS.dataOraPartenza, type: "attribute", label: "dataOraPartenza", x: 0, y: 96, width: 170, height: 36 },
    { id: ATTRIBUTE_IDS.chilometraggio, type: "attribute", label: "chilometraggio", x: 0, y: 144, width: 150, height: 36 },
    { id: ATTRIBUTE_IDS.codiceEsterno, type: "attribute", label: "codiceEsterno", x: 0, y: 192, width: 150, height: 36 },
  ];

  const edges: DiagramEdge[] = attributes.map((attribute) => ({
    id: `edge-${attribute.id}`,
    type: "attribute",
    sourceId: attribute.id,
    targetId: entity.id,
    label: "",
    lineStyle: "solid",
  }));

  return {
    meta: { name: "Candidate keys", version: 3 },
    notes: "",
    nodes: [entity, ...attributes],
    edges,
  };
}

function translateEntityWithIdentifier(diagram: DiagramDocument, identifierId: string): LogicalModel {
  let workspace = createEmptyLogicalWorkspace(diagram);
  const overview = buildLogicalTranslationOverview(diagram, workspace);
  const item = overview.itemsByStep.entities.find((candidate) => candidate.id === "entity-viaggio");
  assert.ok(item);
  const choice = getLogicalTranslationChoicesForItem(overview, item).find(
    (candidate) => candidate.configuration?.keySourceId === identifierId,
  );
  assert.ok(choice);

  workspace = applyLogicalTranslationChoice(diagram, workspace, choice, item.targetType, item.id);
  return workspace.model;
}

function changeEntityIdentifier(
  diagram: DiagramDocument,
  firstIdentifierId: string,
  secondIdentifierId: string,
): LogicalModel {
  let workspace = createEmptyLogicalWorkspace(diagram);

  [firstIdentifierId, secondIdentifierId].forEach((identifierId) => {
    const overview = buildLogicalTranslationOverview(diagram, workspace);
    const item = overview.itemsByStep.entities.find((candidate) => candidate.id === "entity-viaggio");
    assert.ok(item);
    const choice = getLogicalTranslationChoicesForItem(overview, item).find(
      (candidate) => candidate.configuration?.keySourceId === identifierId,
    );
    assert.ok(choice);
    workspace = applyLogicalTranslationChoice(diagram, workspace, choice, item.targetType, item.id);
  });

  return workspace.model;
}

function getViaggioTable(model: LogicalModel): LogicalTable {
  const table = model.tables.find((candidate) => candidate.name === "VIAGGIO");
  assert.ok(table);
  return table;
}

function getColumn(table: LogicalTable, name: string) {
  const column = table.columns.find((candidate) => candidate.name === name);
  assert.ok(column, `Colonna ${name} non trovata`);
  return column;
}

function uniqueConstraintColumnNames(model: LogicalModel, table: LogicalTable): string[][] {
  return model.uniqueConstraints
    .filter((constraint) => constraint.tableId === table.id)
    .map((constraint) =>
      constraint.columnIds.map((columnId) => {
        const column = table.columns.find((candidate) => candidate.id === columnId);
        assert.ok(column);
        return column.name;
      }),
    );
}

function countSqlPrimaryKeys(sql: string): number {
  return [...sql.matchAll(/\bPRIMARY\s+KEY\b/gi)].length;
}

test("logical translation: two simple internal identifiers use the first selected identifier as PK", () => {
  const diagram = createViaggioDiagram([
    { id: "id-cod", attributeIds: [ATTRIBUTE_IDS.codViaggio] },
    { id: "id-arrivo", attributeIds: [ATTRIBUTE_IDS.dataOraArrivo] },
  ]);
  const model = translateEntityWithIdentifier(diagram, "id-cod");
  const table = getViaggioTable(model);
  const codViaggio = getColumn(table, "codViaggio");
  const dataOraArrivo = getColumn(table, "dataOraArrivo");
  const sql = generateLogicalSql(model);

  assert.equal(codViaggio.isPrimaryKey, true);
  assert.equal(codViaggio.isNullable, false);
  assert.equal(dataOraArrivo.isPrimaryKey, false);
  assert.equal(dataOraArrivo.isNullable, false);
  assert.deepEqual(uniqueConstraintColumnNames(model, table), [["dataOraArrivo"]]);
  assert.match(sql, /PRIMARY KEY \("codViaggio"\)/);
  assert.match(sql, /UNIQUE \("dataOraArrivo"\)/);
  assert.equal(countSqlPrimaryKeys(sql), 1);
});

test("logical translation: two simple internal identifiers can choose the second identifier as PK", () => {
  const diagram = createViaggioDiagram([
    { id: "id-cod", attributeIds: [ATTRIBUTE_IDS.codViaggio] },
    { id: "id-arrivo", attributeIds: [ATTRIBUTE_IDS.dataOraArrivo] },
  ]);
  const model = translateEntityWithIdentifier(diagram, "id-arrivo");
  const table = getViaggioTable(model);
  const codViaggio = getColumn(table, "codViaggio");
  const dataOraArrivo = getColumn(table, "dataOraArrivo");
  const sql = generateLogicalSql(model);

  assert.equal(dataOraArrivo.isPrimaryKey, true);
  assert.equal(dataOraArrivo.isNullable, false);
  assert.equal(codViaggio.isPrimaryKey, false);
  assert.equal(codViaggio.isNullable, false);
  assert.deepEqual(uniqueConstraintColumnNames(model, table), [["codViaggio"]]);
  assert.match(sql, /PRIMARY KEY \("dataOraArrivo"\)/);
  assert.match(sql, /UNIQUE \("codViaggio"\)/);
  assert.equal(countSqlPrimaryKeys(sql), 1);
});

test("logical translation: composite alternative internal identifier becomes one compound UNIQUE", () => {
  const diagram = createViaggioDiagram([
    { id: "id-cod", attributeIds: [ATTRIBUTE_IDS.codViaggio] },
    { id: "id-date", attributeIds: [ATTRIBUTE_IDS.dataOraPartenza, ATTRIBUTE_IDS.dataOraArrivo] },
  ]);
  const model = translateEntityWithIdentifier(diagram, "id-cod");
  const table = getViaggioTable(model);
  const codViaggio = getColumn(table, "codViaggio");
  const dataOraPartenza = getColumn(table, "dataOraPartenza");
  const dataOraArrivo = getColumn(table, "dataOraArrivo");
  const uniqueNames = uniqueConstraintColumnNames(model, table);
  const sql = generateLogicalSql(model);

  assert.equal(codViaggio.isPrimaryKey, true);
  assert.equal(codViaggio.isNullable, false);
  assert.equal(dataOraPartenza.isNullable, false);
  assert.equal(dataOraArrivo.isNullable, false);
  assert.equal(uniqueNames.length, 1);
  assert.deepEqual(new Set(uniqueNames[0]), new Set(["dataOraPartenza", "dataOraArrivo"]));
  assert.match(sql, /UNIQUE \("dataOraPartenza", "dataOraArrivo"\)/);
  assert.doesNotMatch(sql, /UNIQUE \("dataOraPartenza"\)/);
  assert.doesNotMatch(sql, /UNIQUE \("dataOraArrivo"\)/);
  assert.equal(countSqlPrimaryKeys(sql), 1);
});

test("logical translation: three internal identifiers produce one PK and two alternative UNIQUE constraints", () => {
  const diagram = createViaggioDiagram([
    { id: "id-cod", attributeIds: [ATTRIBUTE_IDS.codViaggio] },
    { id: "id-arrivo", attributeIds: [ATTRIBUTE_IDS.dataOraArrivo] },
    { id: "id-extra", attributeIds: [ATTRIBUTE_IDS.dataOraPartenza, ATTRIBUTE_IDS.codiceEsterno] },
  ]);
  const model = translateEntityWithIdentifier(diagram, "id-cod");
  const table = getViaggioTable(model);
  const sql = generateLogicalSql(model);

  assert.equal(table.columns.filter((column) => column.isPrimaryKey).length, 1);
  assert.equal(model.uniqueConstraints.filter((constraint) => constraint.tableId === table.id).length, 2);
  ["codViaggio", "dataOraArrivo", "dataOraPartenza", "codiceEsterno"].forEach((name) => {
    assert.equal(getColumn(table, name).isNullable, false);
  });
  assert.match(sql, /PRIMARY KEY \("codViaggio"\)/);
  assert.match(sql, /UNIQUE \("dataOraArrivo"\)/);
  assert.match(sql, /UNIQUE \("dataOraPartenza", "codiceEsterno"\)/);
  assert.equal(countSqlPrimaryKeys(sql), 1);
});

test("logical translation: changing selected PK demotes the previous PK to UNIQUE without stale flags", () => {
  const diagram = createViaggioDiagram([
    { id: "id-cod", attributeIds: [ATTRIBUTE_IDS.codViaggio] },
    { id: "id-arrivo", attributeIds: [ATTRIBUTE_IDS.dataOraArrivo] },
  ]);
  const model = changeEntityIdentifier(diagram, "id-cod", "id-arrivo");
  const table = getViaggioTable(model);
  const codViaggio = getColumn(table, "codViaggio");
  const dataOraArrivo = getColumn(table, "dataOraArrivo");
  const sql = generateLogicalSql(model);

  assert.equal(dataOraArrivo.isPrimaryKey, true);
  assert.equal(codViaggio.isPrimaryKey, false);
  assert.equal(codViaggio.isNullable, false);
  assert.deepEqual(uniqueConstraintColumnNames(model, table), [["codViaggio"]]);
  assert.equal(model.uniqueConstraints.filter((constraint) => constraint.tableId === table.id).length, 1);
  assert.equal(table.columns.filter((column) => column.isPrimaryKey).length, 1);
  assert.match(sql, /PRIMARY KEY \("dataOraArrivo"\)/);
  assert.match(sql, /UNIQUE \("codViaggio"\)/);
  assert.equal(countSqlPrimaryKeys(sql), 1);
});

test("direct logical mapping: alternative internal identifiers become UNIQUE NOT NULL", () => {
  const diagram = createViaggioDiagram([
    { id: "id-cod", attributeIds: [ATTRIBUTE_IDS.codViaggio] },
    { id: "id-date", attributeIds: [ATTRIBUTE_IDS.dataOraPartenza, ATTRIBUTE_IDS.dataOraArrivo] },
  ]);
  const model = generateLogicalModel(diagram);
  const table = getViaggioTable(model);
  const sql = generateLogicalSql(model);

  assert.equal(getColumn(table, "codViaggio").isPrimaryKey, true);
  assert.equal(getColumn(table, "dataOraPartenza").isNullable, false);
  assert.equal(getColumn(table, "dataOraArrivo").isNullable, false);
  assert.deepEqual(
    uniqueConstraintColumnNames(model, table).map((names) => new Set(names)),
    [new Set(["dataOraPartenza", "dataOraArrivo"])],
  );
  assert.match(sql, /PRIMARY KEY \("codViaggio"\)/);
  assert.match(sql, /UNIQUE \("dataOraPartenza", "dataOraArrivo"\)/);
  assert.equal(countSqlPrimaryKeys(sql), 1);
});
