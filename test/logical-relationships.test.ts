import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument, DiagramEdge, DiagramNode } from "../src/types/diagram.ts";
import type { LogicalModel, LogicalTransformationEdge, LogicalTransformationNode } from "../src/types/logical.ts";
import {
  clampLogicalTransformationZoom,
  getDesignerLogicalColumnNameLabel,
  getDesignerLogicalColumnTypeLabel,
  getDesignerLogicalTableDimensions,
  getLogicalTransformationFitFrame,
  getLogicalTransformationCanvasVisibility,
  toSyntheticDiagramNode,
} from "../src/logical/LogicalTransformationCanvas.tsx";
import { getLogicalCanvasViewMode } from "../src/logical/LogicalTranslationWorkspace.tsx";
import {
  LOGICAL_TRANSLATION_STEPS,
  applyLogicalTranslationChoice,
  buildLogicalTranslationOverview,
  createEmptyLogicalWorkspace,
  getLogicalTranslationChoicesForItem,
} from "../src/utils/logicalTranslation.ts";
import { generateLogicalModel } from "../src/utils/logicalMapping.ts";
import { generateLogicalSql } from "../src/utils/logicalSql.ts";
import { updateLogicalColumnSqlMetadata } from "../src/utils/logicalSqlMetadata.ts";

test("logical table dimensions include long foreign key type labels", () => {
  const fkColumn = {
    id: "col-passenger",
    name: "PASSEGGERO_codPasseggero",
    isPrimaryKey: false,
    isForeignKey: true,
    isUnique: true,
    isNullable: false,
    dataType: "VARCHAR",
    length: 100,
    references: [
      {
        foreignKeyId: "fk-passenger",
        targetTableId: "PASSEGGERO",
        targetColumnId: "codPasseggero",
      },
    ],
  };
  const compact = getDesignerLogicalTableDimensions("BIGLIETTO", [
    fkColumn,
  ]);

  assert.equal(getDesignerLogicalColumnNameLabel(fkColumn), "FK NN U PASSEGGERO_codPasseggero");
  assert.equal(getDesignerLogicalColumnTypeLabel(fkColumn), "VARCHAR(100)");
  assert.ok(compact.width > 390);
});

test("logical canvas transformation mode keeps only unresolved ER context while schema mode shows only tables", () => {
  const nodes = [
    {
      id: "er-entity",
      kind: "er-node",
      renderType: "entity",
      label: "ENTITA1",
      x: 0,
      y: 0,
      width: 160,
      height: 80,
      status: "transformed",
      generatedByDecisionIds: [],
      relatedTargetKeys: [],
    },
    {
      id: "er-rel",
      kind: "er-node",
      renderType: "relationship",
      label: "REL",
      x: 120,
      y: 0,
      width: 120,
      height: 80,
      status: "unresolved",
      generatedByDecisionIds: [],
      relatedTargetKeys: [],
    },
    {
      id: "table-entity",
      kind: "logical-table",
      renderType: "table",
      label: "ENTITA1",
      x: 260,
      y: 0,
      width: 180,
      height: 80,
      status: "transformed",
      sourceNodeId: "er-entity",
      tableId: "table-entity",
      generatedByDecisionIds: [],
      relatedTargetKeys: [],
    },
  ] satisfies LogicalTransformationNode[];
  const edges = [
    {
      id: "er-edge",
      kind: "er-edge",
      renderType: "connector",
      sourceId: "er-entity",
      targetId: "er-rel",
      label: "",
      status: "unresolved",
      generatedByDecisionIds: [],
      relatedTargetKeys: [],
    },
    {
      id: "er-rel-self-edge",
      kind: "er-edge",
      renderType: "connector",
      sourceId: "er-rel",
      targetId: "er-rel",
      label: "",
      status: "unresolved",
      generatedByDecisionIds: [],
      relatedTargetKeys: [],
    },
    {
      id: "fk-edge",
      kind: "foreign-key",
      renderType: "foreign-key",
      sourceId: "table-entity",
      targetId: "table-other",
      label: "",
      status: "transformed",
      generatedByDecisionIds: [],
      relatedTargetKeys: [],
    },
  ] satisfies LogicalTransformationEdge[];

  const transformation = getLogicalTransformationCanvasVisibility(nodes, edges, "transformation");
  assert.deepEqual(transformation.visibleNodes.map((node) => node.id), ["er-rel", "table-entity"]);
  assert.deepEqual(transformation.erEdges.map((edge) => edge.id), ["er-edge", "er-rel-self-edge"]);
  assert.deepEqual(
    transformation.erEdges.find((edge) => edge.id === "er-edge"),
    {
      ...edges[0],
      sourceId: "table-entity",
      targetId: "er-rel",
    },
  );
  assert.deepEqual(transformation.fkEdges.map((edge) => edge.id), ["fk-edge"]);

  const schema = getLogicalTransformationCanvasVisibility(nodes, edges, "schema");
  assert.deepEqual(schema.visibleNodes.map((node) => node.id), ["table-entity"]);
  assert.deepEqual(schema.erNodes, []);
  assert.deepEqual(schema.erEdges, []);
  assert.deepEqual(schema.fkEdges.map((edge) => edge.id), ["fk-edge"]);
});

test("logical workspace schema stage usa la canvas solo schema anche senza pannello SQL", () => {
  assert.equal(getLogicalCanvasViewMode("translation"), "transformation");
  assert.equal(getLogicalCanvasViewMode("schema"), "schema");
});

test("logical canvas supports zoom below the ER canvas minimum for wide transformation graphs", () => {
  assert.equal(clampLogicalTransformationZoom(0.12), 0.18);
  assert.equal(clampLogicalTransformationZoom(0.28), 0.28);
});

test("logical canvas fit reserves space for floating controls", () => {
  const frame = getLogicalTransformationFitFrame({ width: 746, height: 817 });

  assert.equal(frame.x, 150);
  assert.equal(frame.y, 72);
  assert.ok(frame.width < 746);
  assert.ok(frame.height < 817);
});

test("logical canvas preserves ER identifier metadata from source nodes", () => {
  const sourceAttribute: Extract<DiagramNode, { type: "attribute" }> = {
    id: "attr-id",
    type: "attribute",
    label: "codice",
    x: 10,
    y: 20,
    width: 100,
    height: 32,
    isIdentifier: true,
    isCompositeInternal: true,
  };
  const transformationNode: LogicalTransformationNode = {
    id: "attr-id",
    kind: "er-node",
    renderType: "attribute",
    label: "codice",
    x: 30,
    y: 40,
    width: 120,
    height: 36,
    status: "unresolved",
    sourceNodeId: "attr-id",
    sourceNodeType: "attribute",
    generatedByDecisionIds: [],
    relatedTargetKeys: [],
  };

  const synthetic = toSyntheticDiagramNode(transformationNode, sourceAttribute);

  assert.equal(synthetic.type, "attribute");
  assert.equal(synthetic.isIdentifier, true);
  assert.equal(synthetic.isCompositeInternal, true);
  assert.equal(synthetic.x, 30);
  assert.equal(synthetic.width, 120);
});

function createEntity(
  id: string,
  label: string,
  keyAttributeId: string,
  keyAttributeLabel: string,
  relationshipParticipations: NonNullable<Extract<DiagramNode, { type: "entity" }>["relationshipParticipations"]>,
): DiagramNode[] {
  const entity: Extract<DiagramNode, { type: "entity" }> = {
    id,
    type: "entity",
    label,
    x: 0,
    y: 0,
    width: 160,
    height: 80,
    internalIdentifiers: [
      {
        id: `${id}-pk`,
        attributeIds: [keyAttributeId],
      },
    ],
    relationshipParticipations,
  };

  const attribute: Extract<DiagramNode, { type: "attribute" }> = {
    id: keyAttributeId,
    type: "attribute",
    label: keyAttributeLabel,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    isIdentifier: true,
  };

  return [entity, attribute];
}

function createEntityWithIdentifiers(
  id: string,
  label: string,
  identifiers: Array<{ id: string; attributeIds: string[] }>,
  attributes: Array<{ id: string; label: string; isIdentifier?: boolean }>,
  relationshipParticipations: NonNullable<Extract<DiagramNode, { type: "entity" }>["relationshipParticipations"]> = [],
): DiagramNode[] {
  const entity: Extract<DiagramNode, { type: "entity" }> = {
    id,
    type: "entity",
    label,
    x: 0,
    y: 0,
    width: 160,
    height: 80,
    internalIdentifiers: identifiers,
    relationshipParticipations,
  };

  const attributeNodes: DiagramNode[] = attributes.map((attribute) => ({
    id: attribute.id,
    type: "attribute",
    label: attribute.label,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    isIdentifier: attribute.isIdentifier === true,
  }));

  return [entity, ...attributeNodes];
}

function createAttributeEdge(id: string, sourceId: string, targetId: string): DiagramEdge {
  return {
    id,
    type: "attribute",
    sourceId,
    targetId,
    label: "",
    lineStyle: "solid",
  };
}

function createConnectorEdge(id: string, sourceId: string, targetId: string, participationId: string): DiagramEdge {
  return {
    id,
    type: "connector",
    sourceId,
    targetId,
    label: "",
    lineStyle: "solid",
    participationId,
  };
}

function createRelationship(id: string, label: string): DiagramNode {
  return {
    id,
    type: "relationship",
    label,
    x: 0,
    y: 0,
    width: 120,
    height: 70,
  };
}

function createEntityWithoutKey(
  id: string,
  label: string,
  relationshipParticipations: NonNullable<Extract<DiagramNode, { type: "entity" }>["relationshipParticipations"]> = [],
): DiagramNode {
  return {
    id,
    type: "entity",
    label,
    x: 0,
    y: 0,
    width: 160,
    height: 80,
    relationshipParticipations,
  };
}

function createAttachedAttribute(
  hostId: string,
  attributeId: string,
  label: string,
  options: Partial<Extract<DiagramNode, { type: "attribute" }>> = {},
): { node: DiagramNode; edge: DiagramEdge } {
  return {
    node: {
      id: attributeId,
      type: "attribute",
      label,
      x: 0,
      y: 0,
      width: 100,
      height: 40,
      ...options,
    },
    edge: createAttributeEdge(`edge-${attributeId}`, attributeId, hostId),
  };
}

function createInheritanceEdge(id: string, subtypeId: string, supertypeId: string): DiagramEdge {
  return {
    id,
    type: "inheritance",
    sourceId: subtypeId,
    targetId: supertypeId,
    label: "",
    lineStyle: "solid",
  };
}

function createRelationshipRegressionDiagram(): DiagramDocument {
  const nodes: DiagramNode[] = [
    ...createEntity("entity-lezione", "LEZIONE", "attr-lezione-id", "idLezione", [
      { id: "part-lezione-orario", relationshipId: "rel-orario", cardinality: "(1,1)" },
    ]),
    ...createEntity("entity-edizione-corso", "EDIZIONE CORSO", "attr-edizione-id", "idEdizione", [
      { id: "part-edizione-orario", relationshipId: "rel-orario", cardinality: "(0,N)" },
      { id: "part-edizione-docenza", relationshipId: "rel-docenza", cardinality: "(0,1)" },
    ]),
    ...createEntity("entity-docente", "DOCENTE", "attr-docente-id", "idDocente", [
      { id: "part-docente-docenza", relationshipId: "rel-docenza", cardinality: "(0,N)" },
    ]),
    createRelationship("rel-orario", "ORARIO"),
    createRelationship("rel-docenza", "DOCENZA"),
  ];

  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-attr-lezione-id", "attr-lezione-id", "entity-lezione"),
    createAttributeEdge("edge-attr-edizione-id", "attr-edizione-id", "entity-edizione-corso"),
    createAttributeEdge("edge-attr-docente-id", "attr-docente-id", "entity-docente"),
    createConnectorEdge("edge-lezione-orario", "entity-lezione", "rel-orario", "part-lezione-orario"),
    createConnectorEdge("edge-edizione-orario", "entity-edizione-corso", "rel-orario", "part-edizione-orario"),
    createConnectorEdge("edge-docente-docenza", "entity-docente", "rel-docenza", "part-docente-docenza"),
    createConnectorEdge("edge-edizione-docenza", "entity-edizione-corso", "rel-docenza", "part-edizione-docenza"),
  ];

  return {
    meta: {
      name: "Regressioni relazioni 1:N",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
  };
}

function extractCreateTable(sql: string, tableName: string): string {
  const escapedName = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = sql.match(new RegExp(`CREATE TABLE ${escapedName} \\([\\s\\S]*?\\n\\);`, "i"));
  assert.ok(match, `CREATE TABLE per ${tableName} non trovato`);
  return match[0];
}

function getItemByLabel(
  overview: ReturnType<typeof buildLogicalTranslationOverview>,
  step: keyof ReturnType<typeof buildLogicalTranslationOverview>["itemsByStep"],
  label: string,
) {
  const item = overview.itemsByStep[step].find((candidate) => candidate.label === label);
  assert.ok(item, `Elemento di traduzione non trovato: ${step} -> ${label}`);
  return item;
}

function getRecommendedChoice(
  overview: ReturnType<typeof buildLogicalTranslationOverview>,
  item: Parameters<typeof getLogicalTranslationChoicesForItem>[1],
) {
  const choice = getLogicalTranslationChoicesForItem(overview, item).find((candidate) => candidate.recommended) ??
    getLogicalTranslationChoicesForItem(overview, item)[0];
  assert.ok(choice, `Scelta non trovata per ${item.label}`);
  return choice;
}

function getChoiceByRule(
  overview: ReturnType<typeof buildLogicalTranslationOverview>,
  item: Parameters<typeof getLogicalTranslationChoicesForItem>[1],
  rule: string,
) {
  const choice = getLogicalTranslationChoicesForItem(overview, item).find((candidate) => candidate.rule === rule);
  assert.ok(choice, `Scelta ${rule} non trovata per ${item.label}`);
  return choice;
}

function applyEntityChoices(diagram: DiagramDocument) {
  let workspace = createEmptyLogicalWorkspace(diagram);
  let overview = buildLogicalTranslationOverview(diagram, workspace);

  for (const label of ["LEZIONE", "EDIZIONE CORSO", "DOCENTE"]) {
    const item = getItemByLabel(overview, "entities", label);
    const choice = getRecommendedChoice(overview, item);
    workspace = applyLogicalTranslationChoice(diagram, workspace, choice, item.targetType, item.id);
    overview = buildLogicalTranslationOverview(diagram, workspace);
  }

  return { workspace, overview };
}

function createSqlMetadataModelFixture(): LogicalModel {
  return {
    meta: {
      name: "SQL Metadata Fixture",
      generatedAt: "2026-01-01T00:00:00.000Z",
      sourceDiagramVersion: 1,
      sourceSignature: "fixture",
    },
    tables: [
      {
        id: "table-user",
        name: "USER",
        kind: "entity",
        x: 40,
        y: 80,
        width: 240,
        height: 120,
        columns: [
          {
            id: "col-user-id",
            name: "ID",
            isPrimaryKey: true,
            isForeignKey: false,
            isNullable: false,
            dataType: "INTEGER",
            references: [],
          },
          {
            id: "col-user-email",
            name: "Email",
            isPrimaryKey: false,
            isForeignKey: false,
            isNullable: true,
            dataType: "VARCHAR",
            length: 100,
            references: [],
          },
        ],
      },
      {
        id: "table-order",
        name: "ORDERS",
        kind: "entity",
        x: 420,
        y: 80,
        width: 260,
        height: 150,
        columns: [
          {
            id: "col-order-id",
            name: "ID",
            isPrimaryKey: true,
            isForeignKey: false,
            isNullable: false,
            dataType: "INTEGER",
            references: [],
          },
          {
            id: "col-order-user-id",
            name: "User_ID",
            isPrimaryKey: false,
            isForeignKey: true,
            isNullable: false,
            dataType: "INTEGER",
            references: [
              {
                foreignKeyId: "fk-order-user",
                targetTableId: "table-user",
                targetColumnId: "col-user-id",
              },
            ],
          },
          {
            id: "col-order-total",
            name: "Totale",
            isPrimaryKey: false,
            isForeignKey: false,
            isNullable: true,
            dataType: "NUMERIC",
            precision: 10,
            scale: 2,
            references: [],
          },
        ],
      },
    ],
    foreignKeys: [
      {
        id: "fk-order-user",
        name: "FK_ORDER_USER",
        fromTableId: "table-order",
        toTableId: "table-user",
        mappings: [
          {
            fromColumnId: "col-order-user-id",
            toColumnId: "col-user-id",
          },
        ],
        required: true,
      },
    ],
    uniqueConstraints: [],
    edges: [
      {
        id: "edge-order-user",
        foreignKeyId: "fk-order-user",
        fromTableId: "table-order",
        toTableId: "table-user",
        label: "FK_ORDER_USER",
      },
    ],
    issues: [],
  };
}

test("la traduzione guidata 1:N assegna la FK al carrier corretto e conserva il contesto ER tradotto", () => {
  const diagram = createRelationshipRegressionDiagram();
  let { workspace, overview } = applyEntityChoices(diagram);

  const orarioItem = getItemByLabel(overview, "relationships", "ORARIO");
  const docenzaItem = getItemByLabel(overview, "relationships", "DOCENZA");

  const orarioChoice = getRecommendedChoice(overview, orarioItem);
  const docenzaChoice = getRecommendedChoice(overview, docenzaItem);

  assert.equal(orarioChoice.label, "FK su LEZIONE");
  assert.match(
    orarioChoice.description,
    /PK del lato 1 \(EDIZIONE CORSO\) migra come FK nella tabella del lato N \(LEZIONE\)/,
  );
  assert.equal(docenzaChoice.label, "FK su EDIZIONE CORSO");
  assert.match(
    docenzaChoice.description,
    /PK del lato 1 \(DOCENTE\) migra come FK nella tabella del lato N \(EDIZIONE CORSO\)/,
  );

  workspace = applyLogicalTranslationChoice(diagram, workspace, orarioChoice, orarioItem.targetType, orarioItem.id);
  overview = buildLogicalTranslationOverview(diagram, workspace);
  workspace = applyLogicalTranslationChoice(diagram, workspace, docenzaChoice, docenzaItem.targetType, docenzaItem.id);
  overview = buildLogicalTranslationOverview(diagram, workspace);

  const appliedOrarioItem = getItemByLabel(overview, "relationships", "ORARIO");
  const appliedDocenzaItem = getItemByLabel(overview, "relationships", "DOCENZA");

  assert.equal(appliedOrarioItem.currentSummary, 'Relazione "ORARIO" assorbita come FK in "LEZIONE".');
  assert.equal(appliedDocenzaItem.currentSummary, 'Relazione "DOCENZA" assorbita come FK in "EDIZIONE CORSO".');

  const lezioneTable = workspace.model.tables.find((table) => table.sourceEntityId === "entity-lezione");
  const edizioneTable = workspace.model.tables.find((table) => table.sourceEntityId === "entity-edizione-corso");
  const docenteTable = workspace.model.tables.find((table) => table.sourceEntityId === "entity-docente");

  assert.ok(lezioneTable, "Tabella LEZIONE non generata");
  assert.ok(edizioneTable, "Tabella EDIZIONE CORSO non generata");
  assert.ok(docenteTable, "Tabella DOCENTE non generata");

  const orarioFk = workspace.model.foreignKeys.find((foreignKey) => foreignKey.sourceRelationshipId === "rel-orario");
  const docenzaFk = workspace.model.foreignKeys.find((foreignKey) => foreignKey.sourceRelationshipId === "rel-docenza");

  assert.ok(orarioFk, "FK per ORARIO non generata");
  assert.ok(docenzaFk, "FK per DOCENZA non generata");

  assert.equal(orarioFk.fromTableId, lezioneTable.id);
  assert.equal(orarioFk.toTableId, edizioneTable.id);
  assert.equal(orarioFk.required, true);
  assert.equal(docenzaFk.fromTableId, edizioneTable.id);
  assert.equal(docenzaFk.toTableId, docenteTable.id);
  assert.equal(docenzaFk.required, false);

  assert.ok(
    lezioneTable.columns.some((column) => column.isForeignKey && column.references.some((reference) => reference.targetTableId === edizioneTable.id)),
    "LEZIONE deve contenere la FK verso EDIZIONE CORSO",
  );
  assert.ok(
    edizioneTable.columns.some((column) => column.isForeignKey && column.references.some((reference) => reference.targetTableId === docenteTable.id)),
    "EDIZIONE CORSO deve contenere la FK verso DOCENTE",
  );

  assert.ok(
    diagram.nodes.every((node) => workspace.transformation.nodes.some((candidate) => candidate.id === node.id)),
    "Il graph logico deve ereditare tutti i nodi del diagramma tradotto",
  );

  assert.ok(
    diagram.edges.every((edge) =>
      workspace.transformation.edges.some((candidate) => candidate.kind === "er-edge" && candidate.sourceEdgeId === edge.id),
    ),
    "Il graph logico deve ereditare tutti gli archi ER del diagramma tradotto",
  );

  assert.ok(
    workspace.transformation.edges.some(
      (edge) =>
        edge.kind === "foreign-key" &&
        edge.sourceId === lezioneTable.id &&
        edge.targetId === edizioneTable.id &&
        edge.relatedTargetKeys.includes("relationship:rel-orario"),
    ),
    "Il graph logico deve esporre la FK ORARIO da LEZIONE a EDIZIONE CORSO",
  );
  assert.ok(
    workspace.transformation.edges.some(
      (edge) =>
        edge.kind === "foreign-key" &&
        edge.sourceId === edizioneTable.id &&
        edge.targetId === docenteTable.id &&
        edge.relatedTargetKeys.includes("relationship:rel-docenza"),
    ),
    "Il graph logico deve esporre la FK DOCENZA da EDIZIONE CORSO a DOCENTE",
  );
});

test("il mapping logico diretto mantiene la stessa regola generale 1:N", () => {
  const diagram = createRelationshipRegressionDiagram();
  const model = generateLogicalModel(diagram);

  const lezioneTable = model.tables.find((table) => table.sourceEntityId === "entity-lezione");
  const edizioneTable = model.tables.find((table) => table.sourceEntityId === "entity-edizione-corso");
  const docenteTable = model.tables.find((table) => table.sourceEntityId === "entity-docente");

  assert.ok(lezioneTable, "Tabella LEZIONE non generata");
  assert.ok(edizioneTable, "Tabella EDIZIONE CORSO non generata");
  assert.ok(docenteTable, "Tabella DOCENTE non generata");

  const orarioFk = model.foreignKeys.find((foreignKey) => foreignKey.sourceRelationshipId === "rel-orario");
  const docenzaFk = model.foreignKeys.find((foreignKey) => foreignKey.sourceRelationshipId === "rel-docenza");

  assert.ok(orarioFk, "FK ORARIO non generata");
  assert.ok(docenzaFk, "FK DOCENZA non generata");

  assert.equal(orarioFk.fromTableId, lezioneTable.id);
  assert.equal(orarioFk.toTableId, edizioneTable.id);
  assert.equal(docenzaFk.fromTableId, edizioneTable.id);
  assert.equal(docenzaFk.toTableId, docenteTable.id);
});

function createGeneralizationPipelineRegressionDiagram(): DiagramDocument {
  const personaNodes = createEntity("entity-persona", "PERSONA", "attr-persona-cf", "CF", []);
  const datoreNodes = createEntity("entity-datore", "DATORE", "attr-datore-id", "Codice", [
    { id: "part-datore-impiego-corrente", relationshipId: "rel-impiego-corrente", cardinality: "(0,N)" },
    { id: "part-datore-impiego-passato", relationshipId: "rel-impiego-passato", cardinality: "(0,N)" },
  ]);
  const edizioneNodes = createEntity("entity-edizione-corso", "EDIZIONE CORSO", "attr-edizione-id", "idEdizione", [
    { id: "part-edizione-orario", relationshipId: "rel-orario", cardinality: "(0,N)" },
    { id: "part-edizione-docenza", relationshipId: "rel-docenza", cardinality: "(0,1)" },
  ]);
  const lezioneNodes = createEntity("entity-lezione", "LEZIONE", "attr-lezione-id", "idLezione", [
    { id: "part-lezione-orario", relationshipId: "rel-orario", cardinality: "(1,1)" },
  ]);

  const partecipanteNode = createEntityWithoutKey("entity-partecipante", "PARTECIPANTE");
  const docenteNode = createEntityWithoutKey("entity-docente", "DOCENTE", [
    { id: "part-docente-docenza", relationshipId: "rel-docenza", cardinality: "(0,N)" },
  ]);
  const dipendenteNode = createEntityWithoutKey("entity-dipendente", "DIPENDENTE", [
    { id: "part-dipendente-impiego-corrente", relationshipId: "rel-impiego-corrente", cardinality: "(1,1)" },
    { id: "part-dipendente-impiego-passato", relationshipId: "rel-impiego-passato", cardinality: "(0,N)" },
  ]);
  const internoNode = createEntityWithoutKey("entity-interno", "INTERNO");
  const collaboratoreNode = createEntityWithoutKey("entity-collaboratore", "COLLABORATORE");

  const docenteTelefono = createAttachedAttribute("entity-docente", "attr-docente-telefono", "Telefono");
  const dipendentePosizione = createAttachedAttribute("entity-dipendente", "attr-dipendente-posizione", "Posizione");
  const internoBadge = createAttachedAttribute("entity-interno", "attr-interno-badge", "Badge");
  const collaboratoreContratto = createAttachedAttribute("entity-collaboratore", "attr-collaboratore-contratto", "Contratto");
  const impiegoCorrenteDataInizio = createAttachedAttribute("rel-impiego-corrente", "attr-impiego-corrente-data-inizio", "DataInizio");
  const impiegoPassatoDataInizio = createAttachedAttribute("rel-impiego-passato", "attr-impiego-passato-data-inizio", "DataInizio");
  const impiegoPassatoDataFine = createAttachedAttribute("rel-impiego-passato", "attr-impiego-passato-data-fine", "DataFine");

  const nodes: DiagramNode[] = [
    ...personaNodes,
    ...datoreNodes,
    ...edizioneNodes,
    ...lezioneNodes,
    partecipanteNode,
    docenteNode,
    dipendenteNode,
    internoNode,
    collaboratoreNode,
    docenteTelefono.node,
    dipendentePosizione.node,
    internoBadge.node,
    collaboratoreContratto.node,
    createRelationship("rel-orario", "ORARIO"),
    createRelationship("rel-docenza", "DOCENZA"),
    createRelationship("rel-impiego-corrente", "IMPIEGO CORRENTE"),
    createRelationship("rel-impiego-passato", "IMPIEGO PASSATO"),
    impiegoCorrenteDataInizio.node,
    impiegoPassatoDataInizio.node,
    impiegoPassatoDataFine.node,
  ];

  const edges: DiagramEdge[] = [
    createInheritanceEdge("edge-partecipante-persona", "entity-partecipante", "entity-persona"),
    createInheritanceEdge("edge-docente-persona", "entity-docente", "entity-persona"),
    createInheritanceEdge("edge-dipendente-partecipante", "entity-dipendente", "entity-partecipante"),
    createInheritanceEdge("edge-interno-docente", "entity-interno", "entity-docente"),
    createInheritanceEdge("edge-collaboratore-docente", "entity-collaboratore", "entity-docente"),
    docenteTelefono.edge,
    dipendentePosizione.edge,
    internoBadge.edge,
    collaboratoreContratto.edge,
    impiegoCorrenteDataInizio.edge,
    impiegoPassatoDataInizio.edge,
    impiegoPassatoDataFine.edge,
    ...personaNodes.slice(1).map((attributeNode) => createAttributeEdge(`edge-${attributeNode.id}`, attributeNode.id, "entity-persona")),
    ...datoreNodes.slice(1).map((attributeNode) => createAttributeEdge(`edge-${attributeNode.id}`, attributeNode.id, "entity-datore")),
    ...edizioneNodes.slice(1).map((attributeNode) => createAttributeEdge(`edge-${attributeNode.id}`, attributeNode.id, "entity-edizione-corso")),
    ...lezioneNodes.slice(1).map((attributeNode) => createAttributeEdge(`edge-${attributeNode.id}`, attributeNode.id, "entity-lezione")),
    createConnectorEdge("edge-lezione-orario", "entity-lezione", "rel-orario", "part-lezione-orario"),
    createConnectorEdge("edge-edizione-orario", "entity-edizione-corso", "rel-orario", "part-edizione-orario"),
    createConnectorEdge("edge-docente-docenza", "entity-docente", "rel-docenza", "part-docente-docenza"),
    createConnectorEdge("edge-edizione-docenza", "entity-edizione-corso", "rel-docenza", "part-edizione-docenza"),
    createConnectorEdge("edge-dipendente-impiego-corrente", "entity-dipendente", "rel-impiego-corrente", "part-dipendente-impiego-corrente"),
    createConnectorEdge("edge-datore-impiego-corrente", "entity-datore", "rel-impiego-corrente", "part-datore-impiego-corrente"),
    createConnectorEdge("edge-dipendente-impiego-passato", "entity-dipendente", "rel-impiego-passato", "part-dipendente-impiego-passato"),
    createConnectorEdge("edge-datore-impiego-passato", "entity-datore", "rel-impiego-passato", "part-datore-impiego-passato"),
  ];

  return {
    meta: {
      name: "Pipeline generalizzazioni e relazioni",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
  };
}

test.skip("la pipeline materializza prima le PK derivate dei sottotipi e poi le FK dipendenti", () => {
  const diagram = createGeneralizationPipelineRegressionDiagram();
  let workspace = createEmptyLogicalWorkspace(diagram);
  let overview = buildLogicalTranslationOverview(diagram, workspace);

  for (const label of [
    "PERSONA",
    "PARTECIPANTE",
    "DOCENTE",
    "DIPENDENTE",
    "INTERNO",
    "COLLABORATORE",
    "DATORE",
    "EDIZIONE CORSO",
    "LEZIONE",
  ]) {
    const item = getItemByLabel(overview, "entities", label);
    const choice = getRecommendedChoice(overview, item);
    workspace = applyLogicalTranslationChoice(diagram, workspace, choice, item.targetType, item.id);
    overview = buildLogicalTranslationOverview(diagram, workspace);
  }

  for (const label of ["DOCENTE", "PARTECIPANTE", "PERSONA"]) {
    const item = getItemByLabel(overview, "generalizations", label);
    const choice = getRecommendedChoice(overview, item);
    workspace = applyLogicalTranslationChoice(diagram, workspace, choice, item.targetType, item.id);
    overview = buildLogicalTranslationOverview(diagram, workspace);
  }

  const orarioItem = getItemByLabel(overview, "relationships", "ORARIO");
  const docenzaItem = getItemByLabel(overview, "relationships", "DOCENZA");
  const impiegoCorrenteItem = getItemByLabel(overview, "relationships", "IMPIEGO CORRENTE");
  const impiegoPassatoItem = getItemByLabel(overview, "relationships", "IMPIEGO PASSATO");

  workspace = applyLogicalTranslationChoice(
    diagram,
    workspace,
    getRecommendedChoice(overview, orarioItem),
    orarioItem.targetType,
    orarioItem.id,
  );
  overview = buildLogicalTranslationOverview(diagram, workspace);
  workspace = applyLogicalTranslationChoice(
    diagram,
    workspace,
    getRecommendedChoice(overview, docenzaItem),
    docenzaItem.targetType,
    docenzaItem.id,
  );
  overview = buildLogicalTranslationOverview(diagram, workspace);
  workspace = applyLogicalTranslationChoice(
    diagram,
    workspace,
    getChoiceByRule(overview, impiegoCorrenteItem, "relationship-table"),
    impiegoCorrenteItem.targetType,
    impiegoCorrenteItem.id,
  );
  overview = buildLogicalTranslationOverview(diagram, workspace);
  workspace = applyLogicalTranslationChoice(
    diagram,
    workspace,
    getRecommendedChoice(overview, impiegoPassatoItem),
    impiegoPassatoItem.targetType,
    impiegoPassatoItem.id,
  );
  overview = buildLogicalTranslationOverview(diagram, workspace);

  const tableBySourceEntityId = new Map(
    workspace.model.tables
      .filter((table) => typeof table.sourceEntityId === "string")
      .map((table) => [table.sourceEntityId as string, table]),
  );
  const docenteTable = tableBySourceEntityId.get("entity-docente");
  const dipendenteTable = tableBySourceEntityId.get("entity-dipendente");
  const internoTable = tableBySourceEntityId.get("entity-interno");
  const collaboratoreTable = tableBySourceEntityId.get("entity-collaboratore");
  const edizioneTable = tableBySourceEntityId.get("entity-edizione-corso");
  const lezioneTable = tableBySourceEntityId.get("entity-lezione");
  const datoreTable = tableBySourceEntityId.get("entity-datore");
  const partecipanteTable = tableBySourceEntityId.get("entity-partecipante");
  const personaTable = tableBySourceEntityId.get("entity-persona");

  assert.ok(docenteTable, "Tabella DOCENTE non generata");
  assert.ok(dipendenteTable, "Tabella DIPENDENTE non generata");
  assert.ok(internoTable, "Tabella INTERNO non generata");
  assert.ok(collaboratoreTable, "Tabella COLLABORATORE non generata");
  assert.ok(edizioneTable, "Tabella EDIZIONE CORSO non generata");
  assert.ok(lezioneTable, "Tabella LEZIONE non generata");
  assert.ok(datoreTable, "Tabella DATORE non generata");
  assert.ok(partecipanteTable, "Tabella PARTECIPANTE non generata");
  assert.ok(personaTable, "Tabella PERSONA non generata");

  const modelIssueMessages = workspace.model.issues.map((issue) => issue.message);
  assert.equal(
    modelIssueMessages.some((message) => /destinazione non ha PK disponibile/i.test(message)),
    false,
    "La pipeline non deve piu produrre warning per PK mancanti sui sottotipi",
  );

  const docentePkColumns = docenteTable.columns.filter((column) => column.isPrimaryKey);
  const dipendentePkColumns = dipendenteTable.columns.filter((column) => column.isPrimaryKey);
  const internoPkColumns = internoTable.columns.filter((column) => column.isPrimaryKey);
  const collaboratorePkColumns = collaboratoreTable.columns.filter((column) => column.isPrimaryKey);

  assert.ok(
    docentePkColumns.some((column) => column.references.some((reference) => reference.targetTableId === personaTable.id)),
    "DOCENTE deve avere una PK derivata da PERSONA",
  );
  assert.ok(
    dipendentePkColumns.some((column) => column.references.some((reference) => reference.targetTableId === partecipanteTable.id)),
    "DIPENDENTE deve avere una PK derivata da PARTECIPANTE",
  );
  assert.ok(
    internoPkColumns.some((column) => column.references.some((reference) => reference.targetTableId === docenteTable.id)),
    "INTERNO deve avere una PK derivata da DOCENTE",
  );
  assert.ok(
    collaboratorePkColumns.some((column) => column.references.some((reference) => reference.targetTableId === docenteTable.id)),
    "COLLABORATORE deve avere una PK derivata da DOCENTE",
  );

  const docenzaFk = workspace.model.foreignKeys.find((foreignKey) => foreignKey.sourceRelationshipId === "rel-docenza");
  const orarioFk = workspace.model.foreignKeys.find((foreignKey) => foreignKey.sourceRelationshipId === "rel-orario");
  const impiegoCorrenteTable = workspace.model.tables.find((table) => table.sourceRelationshipId === "rel-impiego-corrente");
  const impiegoPassatoTable = workspace.model.tables.find((table) => table.sourceRelationshipId === "rel-impiego-passato");

  assert.ok(docenzaFk, "La FK di DOCENZA deve essere stata generata");
  assert.ok(orarioFk, "La FK di ORARIO deve essere stata generata");
  assert.ok(impiegoCorrenteTable, "IMPIEGO CORRENTE deve restare una tabella propria");
  assert.ok(impiegoPassatoTable, "IMPIEGO PASSATO deve restare una tabella propria");

  assert.equal(docenzaFk.fromTableId, edizioneTable.id);
  assert.equal(docenzaFk.toTableId, docenteTable.id);
  assert.equal(orarioFk.fromTableId, lezioneTable.id);
  assert.equal(orarioFk.toTableId, edizioneTable.id);

  const impiegoCorrenteFks = workspace.model.foreignKeys.filter((foreignKey) => foreignKey.sourceRelationshipId === "rel-impiego-corrente");
  const impiegoPassatoFks = workspace.model.foreignKeys.filter((foreignKey) => foreignKey.sourceRelationshipId === "rel-impiego-passato");
  assert.ok(
    impiegoCorrenteFks.some((foreignKey) => foreignKey.toTableId === dipendenteTable.id),
    "IMPIEGO CORRENTE deve poter referenziare DIPENDENTE dopo la propagazione PK",
  );
  assert.ok(
    impiegoPassatoFks.some((foreignKey) => foreignKey.toTableId === dipendenteTable.id),
    "IMPIEGO PASSATO deve poter referenziare DIPENDENTE dopo la propagazione PK",
  );
  assert.ok(
    impiegoCorrenteFks.some((foreignKey) => foreignKey.toTableId === datoreTable.id),
    "IMPIEGO CORRENTE deve mantenere anche la FK verso DATORE",
  );
  assert.ok(
    impiegoPassatoFks.some((foreignKey) => foreignKey.toTableId === datoreTable.id),
    "IMPIEGO PASSATO deve mantenere anche la FK verso DATORE",
  );

  const entitySummaries = new Map(
    workspace.translation.decisions
      .filter((decision) => decision.targetType === "entity")
      .map((decision) => [decision.targetId, decision.summary]),
  );
  assert.equal(
    entitySummaries.get("entity-docente"),
    'Tabella sottotipo "DOCENTE" fissata con PK derivata da "PERSONA".',
  );
  assert.equal(
    entitySummaries.get("entity-dipendente"),
    'Tabella sottotipo "DIPENDENTE" fissata con PK derivata da "PARTECIPANTE".',
  );
  assert.equal(
    entitySummaries.get("entity-interno"),
    'Tabella sottotipo "INTERNO" fissata con PK derivata da "DOCENTE".',
  );
  assert.equal(
    entitySummaries.get("entity-collaboratore"),
    'Tabella sottotipo "COLLABORATORE" fissata con PK derivata da "DOCENTE".',
  );

  assert.equal(
    workspace.transformation.nodes.some((node) =>
      ["rel-orario", "rel-docenza", "rel-impiego-corrente", "rel-impiego-passato"].includes(node.id),
    ),
    false,
    "Le relazioni assorbite o trasformate non devono restare come rombi attivi sul canvas logico",
  );
});

test("la vista logica non espone piu lo step generalizzazioni", () => {
  assert.equal(
    LOGICAL_TRANSLATION_STEPS.some((step) => step.id === "generalizations"),
    false,
    "Lo step generalizzazioni non deve comparire nel workflow logico manuale",
  );

  const diagram = createGeneralizationPipelineRegressionDiagram();
  const workspace = createEmptyLogicalWorkspace(diagram);
  const overview = buildLogicalTranslationOverview(diagram, workspace);

  assert.equal(
    overview.itemsByStep.generalizations.length,
    0,
    "Le generalizzazioni devono essere risolte in vista Traduzione e non riproposte in vista Logica",
  );
});

function createAlternateIdentifierSubtypeDiagram(): DiagramDocument {
  const personaNodes = createEntity("entity-persona", "PERSONA", "attr-persona-cf", "CF", []);
  const partecipanteNodes = createEntity("entity-partecipante", "PARTECIPANTE", "attr-partecipante-codice", "Codice", []);
  const dipendenteNode = createEntityWithoutKey("entity-dipendente", "DIPENDENTE");
  const professionistaNode = createEntityWithoutKey("entity-professionista", "PROFESSIONISTA");
  const partecipanteNome = createAttachedAttribute("entity-partecipante", "attr-partecipante-nome", "Nome");

  const nodes: DiagramNode[] = [
    ...personaNodes,
    ...partecipanteNodes,
    dipendenteNode,
    professionistaNode,
    partecipanteNome.node,
  ];

  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-attr-persona-cf", "attr-persona-cf", "entity-persona"),
    createAttributeEdge("edge-attr-partecipante-codice", "attr-partecipante-codice", "entity-partecipante"),
    partecipanteNome.edge,
    createInheritanceEdge("edge-partecipante-persona", "entity-partecipante", "entity-persona"),
    createInheritanceEdge("edge-dipendente-partecipante", "entity-dipendente", "entity-partecipante"),
    createInheritanceEdge("edge-professionista-partecipante", "entity-professionista", "entity-partecipante"),
  ];

  return {
    meta: {
      name: "Identificatori alternativi su sottotipo",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
  };
}

function createAlternateIdentifierEntityDiagram(): DiagramDocument {
  const customerNodes = createEntityWithIdentifiers(
    "entity-cliente",
    "CLIENTE",
    [
      { id: "cliente-id-codice", attributeIds: ["attr-cliente-codice"] },
      { id: "cliente-id-email", attributeIds: ["attr-cliente-email"] },
    ],
    [
      { id: "attr-cliente-codice", label: "Codice", isIdentifier: true },
      { id: "attr-cliente-email", label: "Email", isIdentifier: true },
      { id: "attr-cliente-nome", label: "Nome" },
    ],
  );

  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-attr-cliente-codice", "attr-cliente-codice", "entity-cliente"),
    createAttributeEdge("edge-attr-cliente-email", "attr-cliente-email", "entity-cliente"),
    createAttributeEdge("edge-attr-cliente-nome", "attr-cliente-nome", "entity-cliente"),
  ];

  return {
    meta: {
      name: "Identificatori alternativi semplici",
      version: 1,
    },
    notes: "",
    nodes: customerNodes,
    edges,
  };
}

test.skip("un sottotipo con PK derivata e identificatore locale usa UNIQUE invece di una PK composta", () => {
  const diagram = createAlternateIdentifierSubtypeDiagram();
  let workspace = createEmptyLogicalWorkspace(diagram);
  let overview = buildLogicalTranslationOverview(diagram, workspace);

  for (const label of ["PERSONA", "PARTECIPANTE", "DIPENDENTE", "PROFESSIONISTA"]) {
    const item = getItemByLabel(overview, "entities", label);
    const choice = getRecommendedChoice(overview, item);
    workspace = applyLogicalTranslationChoice(diagram, workspace, choice, item.targetType, item.id);
    overview = buildLogicalTranslationOverview(diagram, workspace);
  }

  for (const label of ["PARTECIPANTE", "PERSONA"]) {
    const item = getItemByLabel(overview, "generalizations", label);
    const choice = getRecommendedChoice(overview, item);
    workspace = applyLogicalTranslationChoice(diagram, workspace, choice, item.targetType, item.id);
    overview = buildLogicalTranslationOverview(diagram, workspace);
  }

  const tableBySourceEntityId = new Map(
    workspace.model.tables
      .filter((table) => typeof table.sourceEntityId === "string")
      .map((table) => [table.sourceEntityId as string, table]),
  );
  const personaTable = tableBySourceEntityId.get("entity-persona");
  const partecipanteTable = tableBySourceEntityId.get("entity-partecipante");
  const dipendenteTable = tableBySourceEntityId.get("entity-dipendente");
  const professionistaTable = tableBySourceEntityId.get("entity-professionista");

  assert.ok(personaTable, "Tabella PERSONA non generata");
  assert.ok(partecipanteTable, "Tabella PARTECIPANTE non generata");
  assert.ok(dipendenteTable, "Tabella DIPENDENTE non generata");
  assert.ok(professionistaTable, "Tabella PROFESSIONISTA non generata");

  const partecipantePkColumns = partecipanteTable.columns.filter((column) => column.isPrimaryKey);
  assert.equal(partecipantePkColumns.length, 1, "PARTECIPANTE deve avere una sola PK effettiva");
  assert.ok(
    partecipantePkColumns[0].references.some((reference) => reference.targetTableId === personaTable.id),
    "La PK di PARTECIPANTE deve derivare da PERSONA",
  );

  const codiceColumn = partecipanteTable.columns.find((column) => column.sourceAttributeId === "attr-partecipante-codice");
  assert.ok(codiceColumn, "La colonna Codice deve esistere in PARTECIPANTE");
  assert.equal(codiceColumn.isPrimaryKey, false, "Codice non deve restare parte della PK");
  assert.equal(codiceColumn.isUnique, true, "Codice deve essere marcato come identificatore alternativo UNIQUE");
  assert.equal(codiceColumn.isNullable, false, "Un identificatore alternativo deve restare NOT NULL");

  const partecipanteUnique = workspace.model.uniqueConstraints.find(
    (constraint) =>
      constraint.tableId === partecipanteTable.id &&
      constraint.columnIds.length === 1 &&
      constraint.columnIds[0] === codiceColumn.id,
  );
  assert.ok(partecipanteUnique, "La tabella PARTECIPANTE deve registrare un vincolo UNIQUE per Codice");

  assert.ok(
    dipendenteTable.columns.filter((column) => column.isPrimaryKey).every((column) =>
      column.references.some((reference) => reference.targetTableId === partecipanteTable.id),
    ),
    "DIPENDENTE deve ereditare la PK di PARTECIPANTE",
  );
  assert.ok(
    professionistaTable.columns.filter((column) => column.isPrimaryKey).every((column) =>
      column.references.some((reference) => reference.targetTableId === partecipanteTable.id),
    ),
    "PROFESSIONISTA deve ereditare la PK di PARTECIPANTE",
  );

  const dipendentePkColumns = dipendenteTable.columns.filter((column) => column.isPrimaryKey);
  const professionistaPkColumns = professionistaTable.columns.filter((column) => column.isPrimaryKey);
  assert.deepEqual(
    dipendentePkColumns.map((column) => column.name),
    ["PARTECIPANTE_PERSONA_CF"],
    "DIPENDENTE deve ereditare solo la PK effettiva di PARTECIPANTE",
  );
  assert.deepEqual(
    professionistaPkColumns.map((column) => column.name),
    ["PARTECIPANTE_PERSONA_CF"],
    "PROFESSIONISTA deve ereditare solo la PK effettiva di PARTECIPANTE",
  );
  assert.equal(
    dipendenteTable.columns.some((column) => column.name === "Partecipante_Codice" && column.isPrimaryKey),
    false,
    "DIPENDENTE non deve propagare Codice come PK/FK strutturale",
  );
  assert.equal(
    professionistaTable.columns.some((column) => column.name === "Partecipante_Codice" && column.isPrimaryKey),
    false,
    "PROFESSIONISTA non deve propagare Codice come PK/FK strutturale",
  );
  assert.equal(
    dipendenteTable.columns.some((column) => column.name === "Partecipante_Codice"),
    false,
    "DIPENDENTE non deve nemmeno materializzare una colonna Partecipante_Codice ereditaria",
  );
  assert.equal(
    professionistaTable.columns.some((column) => column.name === "Partecipante_Codice"),
    false,
    "PROFESSIONISTA non deve nemmeno materializzare una colonna Partecipante_Codice ereditaria",
  );

  const transformationPartecipante = workspace.transformation.nodes.find((node) => node.tableId === partecipanteTable.id);
  const transformationCodice = transformationPartecipante?.columns?.find((column) => column.id === codiceColumn.id);
  assert.ok(transformationCodice, "Il canvas logico deve esporre la colonna Codice");
  assert.equal(transformationCodice.isUnique, true, "Il canvas logico deve distinguere le colonne UNIQUE");

  const transformationDipendente = workspace.transformation.nodes.find((node) => node.tableId === dipendenteTable.id);
  const transformationProfessionista = workspace.transformation.nodes.find((node) => node.tableId === professionistaTable.id);
  assert.equal(
    transformationDipendente?.columns?.some((column) => column.name === "Partecipante_Codice" && column.isPrimaryKey),
    false,
    "Il canvas logico non deve mostrare Partecipante_Codice come PK/FK in DIPENDENTE",
  );
  assert.equal(
    transformationProfessionista?.columns?.some((column) => column.name === "Partecipante_Codice" && column.isPrimaryKey),
    false,
    "Il canvas logico non deve mostrare Partecipante_Codice come PK/FK in PROFESSIONISTA",
  );

  const entitySummaries = new Map(
    workspace.translation.decisions
      .filter((decision) => decision.targetType === "entity")
      .map((decision) => [decision.targetId, decision.summary]),
  );
  assert.match(
    entitySummaries.get("entity-partecipante") ?? "",
    /PK derivata da "PERSONA".*Codice.*UNIQUE/i,
  );

  const sql = generateLogicalSql(workspace.model);
  const partecipanteSql = extractCreateTable(sql, "PARTECIPANTE");
  const dipendenteSql = extractCreateTable(sql, "DIPENDENTE");
  const professionistaSql = extractCreateTable(sql, "PROFESSIONISTA");
  assert.match(partecipanteSql, /PRIMARY KEY \(PERSONA_CF\)/);
  assert.match(partecipanteSql, /UNIQUE \(Codice\)/);
  assert.doesNotMatch(partecipanteSql, /PRIMARY KEY \(Codice, PERSONA_CF\)/);
  assert.match(dipendenteSql, /PRIMARY KEY \(PARTECIPANTE_PERSONA_CF\)/);
  assert.match(professionistaSql, /PRIMARY KEY \(PARTECIPANTE_PERSONA_CF\)/);
  assert.doesNotMatch(dipendenteSql, /Partecipante_Codice/);
  assert.doesNotMatch(professionistaSql, /Partecipante_Codice/);
});

test("una tabella con piu identificatori alternativi sceglie una sola PK e traduce gli altri come UNIQUE", () => {
  const diagram = createAlternateIdentifierEntityDiagram();
  let workspace = createEmptyLogicalWorkspace(diagram);
  let overview = buildLogicalTranslationOverview(diagram, workspace);

  const item = getItemByLabel(overview, "entities", "CLIENTE");
  const choice = getRecommendedChoice(overview, item);
  workspace = applyLogicalTranslationChoice(diagram, workspace, choice, item.targetType, item.id);
  overview = buildLogicalTranslationOverview(diagram, workspace);

  const clienteTable = workspace.model.tables.find((table) => table.sourceEntityId === "entity-cliente");
  assert.ok(clienteTable, "Tabella CLIENTE non generata");

  const pkColumns = clienteTable.columns.filter((column) => column.isPrimaryKey);
  assert.deepEqual(
    pkColumns.map((column) => column.name),
    ["Codice"],
    "Solo l'identificatore scelto deve restare PK",
  );

  const emailColumn = clienteTable.columns.find((column) => column.sourceAttributeId === "attr-cliente-email");
  assert.ok(emailColumn, "La colonna Email deve esistere");
  assert.equal(emailColumn.isPrimaryKey, false);
  assert.equal(emailColumn.isUnique, true, "Email deve essere tradotto come alternate key UNIQUE");
  assert.equal(emailColumn.isNullable, false, "Un alternate key deve restare NOT NULL");

  const uniqueConstraint = workspace.model.uniqueConstraints.find(
    (constraint) =>
      constraint.tableId === clienteTable.id &&
      constraint.columnIds.length === 1 &&
      constraint.columnIds[0] === emailColumn.id,
  );
  assert.ok(uniqueConstraint, "Il modello logico deve tracciare l'alternate key come uniqueConstraint");

  const sql = generateLogicalSql(workspace.model);
  const clienteSql = extractCreateTable(sql, "CLIENTE");
  assert.match(clienteSql, /PRIMARY KEY \(Codice\)/);
  assert.match(clienteSql, /UNIQUE \(Email\)/);
  assert.doesNotMatch(clienteSql, /PRIMARY KEY \(Codice, Email\)/);
});

test("l'aggiornamento SQL mantiene la sync stretta FK<-PK e blocca la nullable delle PK", () => {
  const model = createSqlMetadataModelFixture();

  const withPkNullableAttempt = updateLogicalColumnSqlMetadata(model, "table-user", "col-user-id", {
    isNullable: true,
  });
  const userPk = withPkNullableAttempt.tables
    .find((table) => table.id === "table-user")
    ?.columns.find((column) => column.id === "col-user-id");
  assert.ok(userPk, "PK utente non trovata");
  assert.equal(userPk.isNullable, false, "Una PK non deve mai diventare nullable");

  const withFkTypeAttempt = updateLogicalColumnSqlMetadata(withPkNullableAttempt, "table-order", "col-order-user-id", {
    dataType: "VARCHAR",
    length: 80,
  });

  const fkColumn = withFkTypeAttempt.tables
    .find((table) => table.id === "table-order")
    ?.columns.find((column) => column.id === "col-order-user-id");
  assert.ok(fkColumn, "Colonna FK non trovata");
  assert.equal(fkColumn.dataType, "INTEGER", "La FK deve restare sincronizzata al tipo della PK target");
  assert.equal(fkColumn.length ?? null, null, "La FK sincronizzata non deve mantenere parametri VARCHAR");
});

test("il SQL generator usa tipo parametrico, default e unique da metadati SQL", () => {
  const model = createSqlMetadataModelFixture();

  let next = updateLogicalColumnSqlMetadata(model, "table-user", "col-user-email", {
    dataType: "VARCHAR",
    length: 180,
    isNullable: false,
    isUnique: true,
    defaultValue: "'noreply@example.com'",
  });
  next = updateLogicalColumnSqlMetadata(next, "table-order", "col-order-total", {
    dataType: "NUMERIC",
    precision: 12,
    scale: 4,
    defaultValue: "0",
  });

  const emailUnique = next.uniqueConstraints.find(
    (constraint) =>
      constraint.tableId === "table-user" &&
      constraint.columnIds.length === 1 &&
      constraint.columnIds[0] === "col-user-email",
  );
  assert.ok(emailUnique, "Il toggle UNIQUE deve creare il vincolo unico monocolonna");

  const sql = generateLogicalSql(next);
  const userSql = extractCreateTable(sql, "USER");
  const orderSql = extractCreateTable(sql, "ORDERS");

  assert.match(userSql, /Email VARCHAR\(180\) NOT NULL DEFAULT 'noreply@example.com'/);
  assert.match(userSql, /UNIQUE \(Email\)/);
  assert.match(orderSql, /Totale NUMERIC\(12,4\) DEFAULT 0/);
});

test("il SQL generator non quota gli identificatori e crea prima le tabelle referenziate", () => {
  const model = createSqlMetadataModelFixture();
  const reversedModel: LogicalModel = {
    ...model,
    tables: [...model.tables].reverse(),
  };

  const sql = generateLogicalSql(reversedModel);

  assert.equal(sql.includes('"'), false, "Il SQL generico non deve usare doppi apici sugli identificatori");
  assert.ok(
    sql.indexOf("CREATE TABLE USER") < sql.indexOf("CREATE TABLE ORDERS"),
    "USER deve essere creato prima di ORDERS per rispettare la FK",
  );
  assert.match(sql, /FOREIGN KEY \(User_ID\) REFERENCES USER \(ID\)/);
});

test("il SQL generator supporta dialetti con quoting e mapping tipi dedicati", () => {
  const model = createSqlMetadataModelFixture();
  const userTable = model.tables.find((table) => table.id === "table-user");
  assert.ok(userTable);
  const dialectModel: LogicalModel = {
    ...model,
    tables: model.tables.map((table) =>
      table.id === "table-user"
        ? {
            ...table,
            columns: [
              ...table.columns,
              {
                id: "col-user-active",
                name: "Attivo",
                isPrimaryKey: false,
                isForeignKey: false,
                isNullable: true,
                dataType: "BOOLEAN",
                references: [],
              },
            ],
          }
        : table,
    ),
  };

  const mysql = generateLogicalSql(dialectModel, { dialect: "mysql", quoteIdentifiers: true });
  assert.match(mysql, /CREATE TABLE `USER`/);
  assert.match(mysql, /`ID` INT NOT NULL/);

  const sqlServer = generateLogicalSql(dialectModel, { dialect: "sqlserver", quoteIdentifiers: true });
  assert.match(sqlServer, /CREATE TABLE \[USER\]/);
  assert.match(sqlServer, /\[ID\] INT NOT NULL/);
  assert.match(sqlServer, /\[Attivo\] BIT/);

  const oracle = generateLogicalSql(dialectModel, { dialect: "oracle" });
  const oracleUserSql = extractCreateTable(oracle, "USER");
  assert.match(oracleUserSql, /Attivo NUMBER\(1\)/);
});
