import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument, DiagramEdge, DiagramNode, InternalIdentifier } from "../src/types/diagram.ts";
import type { LogicalModel, LogicalTable } from "../src/types/logical.ts";
import { getDesignerLogicalColumnNameUnderlineLayout } from "../src/logical/LogicalTransformationCanvas.tsx";
import { generateLogicalModel } from "../src/utils/logicalMapping.ts";
import { generateLogicalSql } from "../src/utils/logicalSql.ts";
import {
  applyBulkLogicalFix,
  applyLogicalTranslationChoice,
  buildLogicalTranslationOverview,
  createEmptyLogicalWorkspace,
  findEntityKeySelectionRequests,
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

function createNestedExternalIdentifierDiagram(): DiagramDocument {
  return {
    meta: { name: "Nested external identifiers", version: 3 },
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
        relationshipParticipations: [{ id: "p-dip-contiene", relationshipId: "CONTIENE", cardinality: "(1,N)" }],
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
        relationshipParticipations: [
          { id: "p-corso-contiene", relationshipId: "CONTIENE", cardinality: "(1,1)" },
          { id: "p-corso-svolgimento", relationshipId: "SVOLGIMENTO", cardinality: "(0,N)" },
        ],
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
        relationshipParticipations: [{ id: "p-edizione-svolgimento", relationshipId: "SVOLGIMENTO", cardinality: "(1,1)" }],
      },
      { id: "CONTIENE", type: "relationship", label: "CONTIENE", x: 0, y: 0, width: 120, height: 70 },
      { id: "SVOLGIMENTO", type: "relationship", label: "SVOLGIMENTO", x: 0, y: 0, width: 140, height: 70 },
      { id: "idDipartimento", type: "attribute", label: "idDipartimento", x: 0, y: 0, width: 120, height: 36, isIdentifier: true },
      { id: "NomeDip", type: "attribute", label: "NomeDip", x: 0, y: 0, width: 100, height: 36 },
      { id: "idCorso", type: "attribute", label: "idCorso", x: 0, y: 0, width: 100, height: 36 },
      { id: "NomeCorso", type: "attribute", label: "NomeCorso", x: 0, y: 0, width: 120, height: 36 },
      { id: "Anno", type: "attribute", label: "Anno", x: 0, y: 0, width: 100, height: 36 },
    ],
    edges: [
      { id: "e-dip-contiene", type: "connector", sourceId: "DIPARTIMENTO", targetId: "CONTIENE", label: "", lineStyle: "solid", participationId: "p-dip-contiene" },
      { id: "e-corso-contiene", type: "connector", sourceId: "CORSO", targetId: "CONTIENE", label: "", lineStyle: "solid", participationId: "p-corso-contiene" },
      { id: "e-corso-svolgimento", type: "connector", sourceId: "CORSO", targetId: "SVOLGIMENTO", label: "", lineStyle: "solid", participationId: "p-corso-svolgimento" },
      { id: "e-edizione-svolgimento", type: "connector", sourceId: "EDIZIONE_CORSO", targetId: "SVOLGIMENTO", label: "", lineStyle: "solid", participationId: "p-edizione-svolgimento" },
      { id: "e-dip-id", type: "attribute", sourceId: "DIPARTIMENTO", targetId: "idDipartimento", label: "", lineStyle: "solid" },
      { id: "e-dip-name", type: "attribute", sourceId: "DIPARTIMENTO", targetId: "NomeDip", label: "", lineStyle: "solid" },
      { id: "e-corso-id", type: "attribute", sourceId: "CORSO", targetId: "idCorso", label: "", lineStyle: "solid" },
      { id: "e-corso-name", type: "attribute", sourceId: "CORSO", targetId: "NomeCorso", label: "", lineStyle: "solid" },
      { id: "e-edizione-anno", type: "attribute", sourceId: "EDIZIONE_CORSO", targetId: "Anno", label: "", lineStyle: "solid" },
    ],
  };
}

function applyEntityChoiceByKeySource(
  diagram: DiagramDocument,
  workspace: ReturnType<typeof createEmptyLogicalWorkspace>,
  entityId: string,
  keySourceId: string,
) {
  const overview = buildLogicalTranslationOverview(diagram, workspace);
  const item = overview.itemsByStep.entities.find((candidate) => candidate.id === entityId);
  assert.ok(item, `Item ${entityId} non trovato`);
  const choice = getLogicalTranslationChoicesForItem(overview, item).find(
    (candidate) => candidate.configuration?.keySourceId === keySourceId,
  );
  assert.ok(choice, `Choice ${keySourceId} non trovata`);
  return applyLogicalTranslationChoice(diagram, workspace, choice, item.targetType, item.id);
}

function getTable(model: LogicalModel, name: string): LogicalTable {
  const table = model.tables.find((candidate) => candidate.name === name);
  assert.ok(table, `Tabella ${name} non trovata`);
  return table;
}

function primaryKeyColumnNames(table: LogicalTable): string[] {
  return table.columns.filter((column) => column.isPrimaryKey).map((column) => column.name);
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
  assert.match(sql, /PRIMARY KEY \(codViaggio\)/);
  assert.match(sql, /UNIQUE \(dataOraArrivo\)/);
  assert.equal(countSqlPrimaryKeys(sql), 1);
});

test("logical translation: nested external mixed identifiers produce complete composite PK and FK", () => {
  const diagram = createNestedExternalIdentifierDiagram();
  let workspace = createEmptyLogicalWorkspace(diagram);

  workspace = applyEntityChoiceByKeySource(diagram, workspace, "EDIZIONE_CORSO", "EDIZIONE-ext");
  workspace = applyEntityChoiceByKeySource(diagram, workspace, "DIPARTIMENTO", "DIP-id");
  workspace = applyEntityChoiceByKeySource(diagram, workspace, "CORSO", "CORSO-ext");

  const model = workspace.model;
  const dipartimento = getTable(model, "DIPARTIMENTO");
  const corso = getTable(model, "CORSO");
  const edizione = getTable(model, "EDIZIONE_CORSO");
  const corsoPkNames = primaryKeyColumnNames(corso);
  const edizionePkNames = primaryKeyColumnNames(edizione);
  const corsoFk = model.foreignKeys.find((foreignKey) => foreignKey.fromTableId === corso.id && foreignKey.toTableId === dipartimento.id);
  const edizioneFk = model.foreignKeys.find((foreignKey) => foreignKey.fromTableId === edizione.id && foreignKey.toTableId === corso.id);

  assert.deepEqual(primaryKeyColumnNames(dipartimento), ["idDipartimento"]);
  assert.equal(corsoPkNames.length, 2);
  assert.equal(corsoPkNames.some((name) => name.includes("idDipartimento")), true);
  assert.equal(corsoPkNames.includes("idCorso"), true);
  assert.equal(edizionePkNames.length, 3);
  assert.equal(edizionePkNames.some((name) => name.includes("idDipartimento")), true);
  assert.equal(edizionePkNames.some((name) => name.includes("idCorso")), true);
  assert.equal(edizionePkNames.includes("Anno"), true);
  assert.ok(corsoFk);
  assert.equal(corsoFk.mappings.length, 1);
  assert.ok(edizioneFk);
  assert.equal(edizioneFk.mappings.length, 2);
  assert.deepEqual(
    new Set(edizioneFk.mappings.map((mapping) => mapping.toColumnId)),
    new Set(corso.columns.filter((column) => column.isPrimaryKey).map((column) => column.id)),
  );
  assert.deepEqual(model.issues.filter((issue) => issue.level === "warning" || issue.level === "error"), []);
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
  assert.match(sql, /PRIMARY KEY \(dataOraArrivo\)/);
  assert.match(sql, /UNIQUE \(codViaggio\)/);
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
  assert.match(sql, /UNIQUE \(dataOraPartenza, dataOraArrivo\)/);
  assert.doesNotMatch(sql, /UNIQUE \(dataOraPartenza\)/);
  assert.doesNotMatch(sql, /UNIQUE \(dataOraArrivo\)/);
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
  assert.match(sql, /PRIMARY KEY \(codViaggio\)/);
  assert.match(sql, /UNIQUE \(dataOraArrivo\)/);
  assert.match(sql, /UNIQUE \(dataOraPartenza, codiceEsterno\)/);
  assert.equal(countSqlPrimaryKeys(sql), 1);
});

test("logical translation: individua entita con piu chiavi candidate per Fix Entities", () => {
  const diagram = createViaggioDiagram([
    { id: "id-cod", attributeIds: [ATTRIBUTE_IDS.codViaggio] },
    { id: "id-arrivo", attributeIds: [ATTRIBUTE_IDS.dataOraArrivo] },
    { id: "id-esterno", attributeIds: [ATTRIBUTE_IDS.codiceEsterno] },
  ]);
  const workspace = createEmptyLogicalWorkspace(diagram);

  const requests = findEntityKeySelectionRequests(diagram, workspace);

  assert.equal(requests.length, 1);
  assert.equal(requests[0].item.id, "entity-viaggio");
  assert.deepEqual(
    requests[0].choices.map((choice) => choice.configuration?.keySourceId).sort(),
    ["id-arrivo", "id-cod", "id-esterno"],
  );
});

test("logical translation: bulk Fix Entities non sceglie automaticamente tra chiavi candidate", () => {
  const diagram = createViaggioDiagram([
    { id: "id-cod", attributeIds: [ATTRIBUTE_IDS.codViaggio] },
    { id: "id-arrivo", attributeIds: [ATTRIBUTE_IDS.dataOraArrivo] },
    { id: "id-esterno", attributeIds: [ATTRIBUTE_IDS.codiceEsterno] },
  ]);
  const workspace = createEmptyLogicalWorkspace(diagram);

  const result = applyBulkLogicalFix(diagram, workspace, "entities");

  assert.equal(result.appliedCount, 0);
  assert.equal(result.workspace.model.tables.some((table) => table.name === "VIAGGIO"), false);
  assert.equal(result.pendingEntityKeySelections?.length, 1);
  assert.equal(result.pendingEntityKeySelections?.[0]?.item.id, "entity-viaggio");
});

test("logical translation: bulk Fix Entities usa la chiave candidata scelta esplicitamente", () => {
  const diagram = createViaggioDiagram([
    { id: "id-cod", attributeIds: [ATTRIBUTE_IDS.codViaggio] },
    { id: "id-arrivo", attributeIds: [ATTRIBUTE_IDS.dataOraArrivo] },
    { id: "id-esterno", attributeIds: [ATTRIBUTE_IDS.codiceEsterno] },
  ]);
  const workspace = createEmptyLogicalWorkspace(diagram);
  const request = findEntityKeySelectionRequests(diagram, workspace)[0];
  assert.ok(request);
  const selectedChoice = request.choices.find((choice) => choice.configuration?.keySourceId === "id-esterno");
  assert.ok(selectedChoice);

  const result = applyBulkLogicalFix(diagram, workspace, "entities", {
    choiceIdsByTargetKey: {
      [request.targetKey]: selectedChoice.id,
    },
  });
  const table = getViaggioTable(result.workspace.model);
  const sql = generateLogicalSql(result.workspace.model);

  assert.equal(result.appliedCount, 1);
  assert.equal(getColumn(table, "codiceEsterno").isPrimaryKey, true);
  assert.equal(getColumn(table, "codViaggio").isPrimaryKey, false);
  assert.equal(getColumn(table, "dataOraArrivo").isPrimaryKey, false);
  assert.equal(getColumn(table, "codViaggio").isNullable, false);
  assert.equal(getColumn(table, "dataOraArrivo").isNullable, false);
  assert.deepEqual(
    uniqueConstraintColumnNames(result.workspace.model, table).map((names) => names[0]).sort(),
    ["codViaggio", "dataOraArrivo"],
  );
  assert.match(sql, /PRIMARY KEY \(codiceEsterno\)/);
  assert.equal(countSqlPrimaryKeys(sql), 1);
});

test("logical translation: bulk Fix Entities procede automaticamente con una sola chiave candidata", () => {
  const diagram = createViaggioDiagram([
    { id: "id-cod", attributeIds: [ATTRIBUTE_IDS.codViaggio] },
  ]);
  const workspace = createEmptyLogicalWorkspace(diagram);

  const result = applyBulkLogicalFix(diagram, workspace, "entities");
  const table = getViaggioTable(result.workspace.model);

  assert.equal(result.pendingEntityKeySelections, undefined);
  assert.equal(result.appliedCount, 1);
  assert.equal(getColumn(table, "codViaggio").isPrimaryKey, true);
});

test("logical canvas: sottolineatura del nome solo per colonne PK", () => {
  const baseColumn = {
    id: "column-1",
    name: "ATTRIBUTO4",
    sourceAttributeId: "attr-4",
    isPrimaryKey: false,
    isForeignKey: false,
    isUnique: false,
    isNullable: true,
    references: [],
  };
  const pk = getDesignerLogicalColumnNameUnderlineLayout({ ...baseColumn, isPrimaryKey: true });
  const regular = getDesignerLogicalColumnNameUnderlineLayout(baseColumn);
  const fk = getDesignerLogicalColumnNameUnderlineLayout({ ...baseColumn, isForeignKey: true });
  const pkFk = getDesignerLogicalColumnNameUnderlineLayout({ ...baseColumn, isPrimaryKey: true, isForeignKey: true });
  const pkWithSqlType = getDesignerLogicalColumnNameUnderlineLayout({
    ...baseColumn,
    isPrimaryKey: true,
    dataType: "VARCHAR",
    length: 100,
  });

  assert.equal(pk.visible, true);
  assert.equal(regular.visible, false);
  assert.equal(fk.visible, false);
  assert.equal(pkFk.visible, true);
  assert.ok(pk.x1 > 0);
  assert.ok(Math.abs((pk.x2 - pk.x1) - (pkFk.x2 - pkFk.x1)) < 0.0001);
  assert.ok(Math.abs((pk.x2 - pk.x1) - (pkWithSqlType.x2 - pkWithSqlType.x1)) < 0.0001);
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
  assert.match(sql, /PRIMARY KEY \(dataOraArrivo\)/);
  assert.match(sql, /UNIQUE \(codViaggio\)/);
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
  assert.match(sql, /PRIMARY KEY \(codViaggio\)/);
  assert.match(sql, /UNIQUE \(dataOraPartenza, dataOraArrivo\)/);
  assert.equal(countSqlPrimaryKeys(sql), 1);
});
