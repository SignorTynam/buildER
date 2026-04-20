import type {
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
} from "../types/diagram";
import type {
  LogicalColumn,
  LogicalEdge,
  LogicalForeignKey,
  LogicalIssue,
  LogicalIssueCode,
  LogicalModel,
  LogicalTable,
  LogicalTableKind,
  LogicalUniqueConstraint,
} from "../types/logical";
import { autoLayoutLogicalModel, normalizeLogicalModelGeometry } from "./logicalLayout";
import { normalizeLogicalModelSqlMetadata } from "./logicalSqlMetadata";
import { getConnectorParticipation } from "./cardinality";

interface ParsedCardinality {
  raw: string;
  min: number | null;
  max: number | null;
  isKnown: boolean;
  isMany: boolean;
  isTotal: boolean;
}

interface RelationshipParticipant {
  entityId: string;
  tableId: string;
  cardinality: ParsedCardinality;
}

interface MappingContext {
  diagram: DiagramDocument;
  tables: LogicalTable[];
  foreignKeys: LogicalForeignKey[];
  uniqueConstraints: LogicalUniqueConstraint[];
  edges: LogicalEdge[];
  issues: LogicalIssue[];
  tableById: Map<string, LogicalTable>;
  usedTableNames: Set<string>;
  usedFkNames: Set<string>;
  usedColumnNamesByTable: Map<string, Set<string>>;
  entityTableByEntityId: Map<string, string>;
  tableSequence: number;
  columnSequence: number;
  fkSequence: number;
  uniqueConstraintSequence: number;
  edgeSequence: number;
  issueSequence: number;
}

const MANY = Number.POSITIVE_INFINITY;

function toAscii(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTableName(label: string): string {
  const cleaned = normalizeSpaces(label);
  return cleaned || "Tabella";
}

function normalizeColumnName(label: string): string {
  const cleaned = normalizeSpaces(label);
  return cleaned || "Colonna";
}

function sortByLabel<T extends { id: string; label: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const byLabel = left.label.localeCompare(right.label, "it", { sensitivity: "base" });
    if (byLabel !== 0) {
      return byLabel;
    }

    return left.id.localeCompare(right.id);
  });
}

function canonicalKey(value: string): string {
  return toAscii(normalizeSpaces(value)).toLowerCase();
}

function allocateUniqueName(
  used: Set<string>,
  preferredName: string,
): { value: string; collided: boolean } {
  let candidate = preferredName;
  let suffix = 2;
  let collided = false;

  while (used.has(canonicalKey(candidate))) {
    collided = true;
    candidate = `${preferredName} (${suffix})`;
    suffix += 1;
  }

  used.add(canonicalKey(candidate));
  return { value: candidate, collided };
}

function parseCardinalityToken(token: string): number | null {
  const normalized = token.trim().toUpperCase();
  if (normalized === "N" || normalized === "M") {
    return MANY;
  }

  if (normalized === "0" || normalized === "1") {
    return Number.parseInt(normalized, 10);
  }

  return null;
}

function parseConnectorCardinality(rawValue: string | undefined): ParsedCardinality {
  const raw = (rawValue ?? "").trim();
  if (!raw || raw.includes("X")) {
    return {
      raw,
      min: null,
      max: null,
      isKnown: false,
      isMany: false,
      isTotal: false,
    };
  }

  const normalized = raw.replace(/[()\s]/g, "");
  const [rawMin, rawMax] = normalized.split(",");

  if (!rawMin || !rawMax) {
    return {
      raw,
      min: null,
      max: null,
      isKnown: false,
      isMany: false,
      isTotal: false,
    };
  }

  const parsedMin = parseCardinalityToken(rawMin);
  const parsedMax = parseCardinalityToken(rawMax);

  if (parsedMin == null || parsedMax == null) {
    return {
      raw,
      min: null,
      max: null,
      isKnown: false,
      isMany: false,
      isTotal: false,
    };
  }

  let min = parsedMin;
  let max = parsedMax;

  if (Number.isFinite(min) && Number.isFinite(max) && min > max) {
    const swap = min;
    min = max;
    max = swap;
  }

  return {
    raw,
    min,
    max,
    isKnown: true,
    isMany: max === MANY,
    isTotal: min >= 1,
  };
}

function buildAttributeAdjacency(diagram: DiagramDocument): Map<string, string[]> {
  const adjacency = new Map<string, string[]>();

  diagram.edges.forEach((edge) => {
    if (edge.type !== "attribute") {
      return;
    }

    const sourceBucket = adjacency.get(edge.sourceId) ?? [];
    sourceBucket.push(edge.targetId);
    adjacency.set(edge.sourceId, sourceBucket);

    const targetBucket = adjacency.get(edge.targetId) ?? [];
    targetBucket.push(edge.sourceId);
    adjacency.set(edge.targetId, targetBucket);
  });

  adjacency.forEach((neighbors, key) => {
    const unique = [...new Set(neighbors)].sort((left, right) => left.localeCompare(right));
    adjacency.set(key, unique);
  });

  return adjacency;
}

function resolveAttributeOwner(
  attributeId: string,
  nodeById: Map<string, DiagramNode>,
  adjacency: Map<string, string[]>,
): DiagramNode | undefined {
  const queue = [attributeId];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const currentId = queue.shift() as string;
    if (visited.has(currentId)) {
      continue;
    }

    visited.add(currentId);
    const neighbors = adjacency.get(currentId) ?? [];

    for (const neighborId of neighbors) {
      const neighbor = nodeById.get(neighborId);
      if (!neighbor) {
        continue;
      }

      if (neighbor.type === "entity" || neighbor.type === "relationship") {
        return neighbor;
      }

      if (neighbor.type === "attribute" && !visited.has(neighbor.id)) {
        queue.push(neighbor.id);
      }
    }
  }

  return undefined;
}

function buildOwnerAttributesMap(diagram: DiagramDocument): Map<string, Extract<DiagramNode, { type: "attribute" }>[]> {
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const adjacency = buildAttributeAdjacency(diagram);
  const byOwnerId = new Map<string, Extract<DiagramNode, { type: "attribute" }>[]>();

  diagram.nodes
    .filter((node): node is Extract<DiagramNode, { type: "attribute" }> => node.type === "attribute")
    .forEach((attribute) => {
      const owner = resolveAttributeOwner(attribute.id, nodeById, adjacency);
      if (!owner) {
        return;
      }

      const bucket = byOwnerId.get(owner.id) ?? [];
      bucket.push(attribute);
      byOwnerId.set(owner.id, bucket);
    });

  byOwnerId.forEach((attributes, ownerId) => {
    byOwnerId.set(ownerId, sortByLabel(attributes));
  });

  return byOwnerId;
}

function createContext(diagram: DiagramDocument): MappingContext {
  return {
    diagram,
    tables: [],
    foreignKeys: [],
    uniqueConstraints: [],
    edges: [],
    issues: [],
    tableById: new Map<string, LogicalTable>(),
    usedTableNames: new Set<string>(),
    usedFkNames: new Set<string>(),
    usedColumnNamesByTable: new Map<string, Set<string>>(),
    entityTableByEntityId: new Map<string, string>(),
    tableSequence: 1,
    columnSequence: 1,
    fkSequence: 1,
    uniqueConstraintSequence: 1,
    edgeSequence: 1,
    issueSequence: 1,
  };
}

function pushIssue(
  context: MappingContext,
  code: LogicalIssueCode,
  message: string,
  level: LogicalIssue["level"] = "warning",
  extra?: Pick<LogicalIssue, "tableId" | "columnId" | "relationshipId">,
) {
  context.issues.push({
    id: `issue-${context.issueSequence++}`,
    level,
    code,
    message,
    ...extra,
  });
}

function createLogicalTable(
  context: MappingContext,
  options: {
    name: string;
    kind: LogicalTableKind;
    sourceEntityId?: string;
    sourceRelationshipId?: string;
    issueRelationshipId?: string;
  },
): LogicalTable {
  const normalizedName = normalizeTableName(options.name || "Tabella");
  const unique = allocateUniqueName(context.usedTableNames, normalizedName);

  const table: LogicalTable = {
    id: `table-${context.tableSequence++}`,
    name: unique.value,
    kind: options.kind,
    sourceEntityId: options.sourceEntityId,
    sourceRelationshipId: options.sourceRelationshipId,
    columns: [],
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  };

  context.tables.push(table);
  context.tableById.set(table.id, table);
  context.usedColumnNamesByTable.set(table.id, new Set<string>());

  if (unique.collided) {
    pushIssue(
      context,
      "TABLE_NAME_COLLISION",
      `Collisione nome tabella "${normalizedName}". Rinominata in "${table.name}" per mantenere l'unicita.`,
      "warning",
      {
        tableId: table.id,
        relationshipId: options.issueRelationshipId,
      },
    );
  }

  return table;
}

function addColumn(
  context: MappingContext,
  tableId: string,
  options: {
    baseName: string;
    sourceAttributeId?: string;
    sourceRelationshipId?: string;
    isPrimaryKey: boolean;
    isForeignKey: boolean;
    isNullable: boolean;
    isGenerated?: boolean;
  },
): LogicalColumn {
  const table = context.tableById.get(tableId);
  if (!table) {
    throw new Error(`Tabella logica non trovata: ${tableId}`);
  }

  const normalizedBaseName = normalizeColumnName(options.baseName || "Colonna");
  const used = context.usedColumnNamesByTable.get(tableId) as Set<string>;
  const unique = allocateUniqueName(used, normalizedBaseName);

  const column: LogicalColumn = {
    id: `column-${context.columnSequence++}`,
    name: unique.value,
    sourceAttributeId: options.sourceAttributeId,
    sourceRelationshipId: options.sourceRelationshipId,
    isPrimaryKey: options.isPrimaryKey,
    isForeignKey: options.isForeignKey,
    isUnique: false,
    isNullable: options.isNullable,
    isGenerated: options.isGenerated,
    references: [],
  };

  table.columns.push(column);

  if (unique.collided) {
    pushIssue(
      context,
      "COLUMN_NAME_COLLISION",
      `Collisione nome colonna nella tabella "${table.name}". Rinominata in "${column.name}" per mantenere l'unicita.`,
      "warning",
      {
        tableId,
        columnId: column.id,
        relationshipId: options.sourceRelationshipId,
      },
    );
  }

  return column;
}

function ensurePrimaryKey(context: MappingContext, table: LogicalTable): void {
  const hasPrimaryKey = table.columns.some((column) => column.isPrimaryKey);
  if (hasPrimaryKey) {
    return;
  }

  pushIssue(
    context,
    "ENTITY_WITHOUT_PK",
    `La tabella "${table.name}" non ha identificatori nell'ER: nessuna PK e stata generata automaticamente.`,
    "warning",
    {
      tableId: table.id,
      relationshipId: table.sourceRelationshipId,
    },
  );
}

function addUniqueConstraint(
  context: MappingContext,
  tableId: string,
  columnIds: string[],
  originLabel?: string,
): LogicalUniqueConstraint | null {
  const table = context.tableById.get(tableId);
  if (!table) {
    throw new Error(`Tabella logica non trovata: ${tableId}`);
  }

  const normalizedColumnIds = [...new Set(columnIds)].filter((columnId) => table.columns.some((column) => column.id === columnId));
  if (normalizedColumnIds.length === 0) {
    return null;
  }

  const signature = normalizedColumnIds.slice().sort((left, right) => left.localeCompare(right)).join("|");
  const existing = context.uniqueConstraints.find(
    (constraint) =>
      constraint.tableId === tableId &&
      constraint.columnIds.slice().sort((left, right) => left.localeCompare(right)).join("|") === signature,
  );
  if (existing) {
    return existing;
  }

  table.columns.forEach((column) => {
    if (normalizedColumnIds.includes(column.id)) {
      column.isUnique = true;
      column.isNullable = false;
    }
  });

  const constraint: LogicalUniqueConstraint = {
    id: `unique-${context.uniqueConstraintSequence++}`,
    tableId,
    columnIds: normalizedColumnIds,
    originLabel,
  };

  context.uniqueConstraints.push(constraint);
  return constraint;
}

function buildForeignKeyColumnBase(
  targetTable: LogicalTable,
  targetColumn: LogicalColumn,
  targetKeyCount: number,
): string {
  const tableBase = normalizeColumnName(targetTable.name);
  const targetColumnBase = normalizeColumnName(targetColumn.name);

  if (targetKeyCount === 1) {
    if (targetColumnBase === "id" || targetColumnBase === `${tableBase}_id`) {
      return `${tableBase}_id`;
    }

    return `${tableBase}_${targetColumnBase}`;
  }

  return `${tableBase}_${targetColumnBase}`;
}

function getPrimaryKeyColumns(table: LogicalTable): LogicalColumn[] {
  return table.columns.filter((column) => column.isPrimaryKey);
}

function addForeignKey(
  context: MappingContext,
  options: {
    fromTableId: string;
    toTableId: string;
    sourceRelationshipId?: string;
    required: boolean;
    unique?: boolean;
    includeInPrimaryKey?: boolean;
  },
): LogicalForeignKey | null {
  const fromTable = context.tableById.get(options.fromTableId);
  const toTable = context.tableById.get(options.toTableId);

  if (!fromTable || !toTable) {
    throw new Error("Impossibile creare la chiave esterna: tabella mancante.");
  }

  const targetColumns = getPrimaryKeyColumns(toTable);
  if (targetColumns.length === 0) {
    pushIssue(
      context,
      "AMBIGUOUS_MAPPING",
      `Impossibile creare FK ${fromTable.name} -> ${toTable.name}: la tabella di destinazione non ha PK definita nell'ER.`,
      "warning",
      {
        tableId: fromTable.id,
        relationshipId: options.sourceRelationshipId,
      },
    );
    return null;
  }

  const fkId = `fk-${context.fkSequence++}`;
  const mappings: Array<{ fromColumnId: string; toColumnId: string }> = [];

  targetColumns.forEach((targetColumn) => {
    const createdColumn = addColumn(context, fromTable.id, {
      baseName: buildForeignKeyColumnBase(toTable, targetColumn, targetColumns.length),
      sourceRelationshipId: options.sourceRelationshipId,
      isPrimaryKey: options.includeInPrimaryKey === true,
      isForeignKey: true,
      isNullable: !options.required,
    });

    createdColumn.references.push({
      foreignKeyId: fkId,
      targetTableId: toTable.id,
      targetColumnId: targetColumn.id,
    });

    mappings.push({
      fromColumnId: createdColumn.id,
      toColumnId: targetColumn.id,
    });
  });

  const fkNameBase = `fk ${fromTable.name} -> ${toTable.name}`;
  const fkName = allocateUniqueName(context.usedFkNames, fkNameBase);

  if (fkName.collided) {
    pushIssue(
      context,
      "FK_NAME_COLLISION",
      `Collisione nome FK nella relazione ${fromTable.name} -> ${toTable.name}. Rinominata in "${fkName.value}".`,
      "warning",
      {
        tableId: fromTable.id,
        relationshipId: options.sourceRelationshipId,
      },
    );
  }

  const fk: LogicalForeignKey = {
    id: fkId,
    name: fkName.value,
    fromTableId: fromTable.id,
    toTableId: toTable.id,
    mappings,
    sourceRelationshipId: options.sourceRelationshipId,
    required: options.required,
    unique: options.unique,
  };

  context.foreignKeys.push(fk);
  context.edges.push({
    id: `edge-${context.edgeSequence++}`,
    foreignKeyId: fk.id,
    fromTableId: fromTable.id,
    toTableId: toTable.id,
    label: fk.name,
  });

  return fk;
}

function addRelationshipAttributes(
  context: MappingContext,
  tableId: string,
  attributes: Extract<DiagramNode, { type: "attribute" }>[],
  relationshipId: string,
): void {
  attributes.forEach((attribute) => {
    if (attribute.isMultivalued === true) {
      pushIssue(
        context,
        "MULTIVALUED_ATTRIBUTE",
        `L'attributo composto di relazione "${attribute.label}" e mappato come colonna semplice nella tabella "${context.tableById.get(tableId)?.name ?? tableId}".`,
        "warning",
        {
          tableId,
          relationshipId,
        },
      );
    }

    addColumn(context, tableId, {
      baseName: attribute.label,
      sourceAttributeId: attribute.id,
      sourceRelationshipId: relationshipId,
      isPrimaryKey: false,
      isForeignKey: false,
      isNullable: true,
    });
  });
}

function classifyBinaryRelationship(participants: RelationshipParticipant[]): "one-to-one" | "one-to-many" | "many-to-many" | "unknown" {
  if (participants.length !== 2) {
    return "unknown";
  }

  const [left, right] = participants;
  if (!left.cardinality.isKnown || !right.cardinality.isKnown) {
    return "unknown";
  }

  if (left.cardinality.isMany && right.cardinality.isMany) {
    return "many-to-many";
  }

  if (left.cardinality.isMany !== right.cardinality.isMany) {
    return "one-to-many";
  }

  return "one-to-one";
}

function resolveOneToManyParticipants(
  participants: RelationshipParticipant[],
): { carrierParticipant: RelationshipParticipant; referencedParticipant: RelationshipParticipant } | null {
  if (participants.length !== 2) {
    return null;
  }

  const referencedParticipant = participants.find((participant) => participant.cardinality.isMany);
  if (!referencedParticipant) {
    return null;
  }

  const carrierParticipant = participants.find((participant) => participant !== referencedParticipant);
  if (!carrierParticipant) {
    return null;
  }

  return {
    carrierParticipant,
    referencedParticipant,
  };
}

function createAssociativeMapping(
  context: MappingContext,
  relationship: Extract<DiagramNode, { type: "relationship" }>,
  participants: RelationshipParticipant[],
  relationshipAttributes: Extract<DiagramNode, { type: "attribute" }>[],
  reason: "unsupported-arity" | "ambiguous-cardinality" | "many-to-many",
): void {
  const table = createLogicalTable(context, {
    name: relationship.label,
    kind: "associative",
    sourceRelationshipId: relationship.id,
    issueRelationshipId: relationship.id,
  });

  participants.forEach((participant) => {
    addForeignKey(context, {
      fromTableId: table.id,
      toTableId: participant.tableId,
      sourceRelationshipId: relationship.id,
      required: participant.cardinality.isTotal,
      includeInPrimaryKey: reason === "many-to-many",
    });
  });

  addRelationshipAttributes(context, table.id, relationshipAttributes, relationship.id);
  ensurePrimaryKey(context, table);

  if (reason === "unsupported-arity") {
    pushIssue(
      context,
      "RELATIONSHIP_UNSUPPORTED_ARITY",
      `La relazione "${relationship.label}" coinvolge ${participants.length} entita: generata tabella associativa "${table.name}".`,
      "warning",
      {
        tableId: table.id,
        relationshipId: relationship.id,
      },
    );
  }

  if (reason === "ambiguous-cardinality") {
    pushIssue(
      context,
      "RELATIONSHIP_WITHOUT_CARDINALITY",
      `La relazione "${relationship.label}" ha cardinalita incomplete: usata tabella associativa "${table.name}" come ripiego.`,
      "warning",
      {
        tableId: table.id,
        relationshipId: relationship.id,
      },
    );
  }
}

function chooseOwnerForOneToOne(
  participants: RelationshipParticipant[],
  context: MappingContext,
  relationshipId: string,
): { owner: RelationshipParticipant; referenced: RelationshipParticipant } {
  const [left, right] = participants;

  if (left.cardinality.isTotal && !right.cardinality.isTotal) {
    return { owner: left, referenced: right };
  }

  if (right.cardinality.isTotal && !left.cardinality.isTotal) {
    return { owner: right, referenced: left };
  }

  const leftTable = context.tableById.get(left.tableId) as LogicalTable;
  const rightTable = context.tableById.get(right.tableId) as LogicalTable;

  const byName = leftTable.name.localeCompare(rightTable.name, "it", { sensitivity: "base" });
  const owner = byName <= 0 ? left : right;
  const referenced = owner === left ? right : left;

  pushIssue(
    context,
    "AMBIGUOUS_MAPPING",
    `Relazione 1:1 "${relationshipId}" ambigua: applicata regola stabile con FK su "${context.tableById.get(owner.tableId)?.name}".`,
    "warning",
    {
      tableId: owner.tableId,
      relationshipId,
    },
  );

  return { owner, referenced };
}

function mapRelationship(
  context: MappingContext,
  relationship: Extract<DiagramNode, { type: "relationship" }>,
  ownerAttributesByNodeId: Map<string, Extract<DiagramNode, { type: "attribute" }>[]>,
): void {
  const connectors = context.diagram.edges.filter(
    (edge): edge is Extract<DiagramEdge, { type: "connector" }> =>
      edge.type === "connector" && (edge.sourceId === relationship.id || edge.targetId === relationship.id),
  );

  const participantsByEntityId = new Map<string, RelationshipParticipant>();

  connectors.forEach((connector) => {
    const otherId = connector.sourceId === relationship.id ? connector.targetId : connector.sourceId;
    const otherNode = context.diagram.nodes.find((node) => node.id === otherId);

    if (!otherNode || otherNode.type !== "entity") {
      return;
    }

    const targetTableId = context.entityTableByEntityId.get(otherNode.id);
    if (!targetTableId) {
      return;
    }

    if (!participantsByEntityId.has(otherNode.id)) {
      participantsByEntityId.set(otherNode.id, {
        entityId: otherNode.id,
        tableId: targetTableId,
        cardinality: parseConnectorCardinality(
          getConnectorParticipation(
            connector,
            context.diagram.nodes.find((node) => node.id === connector.sourceId),
            context.diagram.nodes.find((node) => node.id === connector.targetId),
          )?.cardinality,
        ),
      });
    }
  });

  const participants = [...participantsByEntityId.values()].sort((left, right) => {
    const leftTable = context.tableById.get(left.tableId);
    const rightTable = context.tableById.get(right.tableId);

    if (!leftTable || !rightTable) {
      return left.tableId.localeCompare(right.tableId);
    }

    const byName = leftTable.name.localeCompare(rightTable.name, "it", { sensitivity: "base" });
    if (byName !== 0) {
      return byName;
    }

    return left.tableId.localeCompare(right.tableId);
  });

  const relationshipAttributes = ownerAttributesByNodeId.get(relationship.id) ?? [];

  if (participants.length === 0) {
    pushIssue(
      context,
      "RELATIONSHIP_WITHOUT_PARTICIPANTS",
      `La relazione "${relationship.label}" non e collegata ad alcuna entita: mapping saltato.`,
      "warning",
      {
        relationshipId: relationship.id,
      },
    );
    return;
  }

  if (participants.length !== 2) {
    createAssociativeMapping(context, relationship, participants, relationshipAttributes, "unsupported-arity");
    return;
  }

  const relationshipKind = classifyBinaryRelationship(participants);

  if (relationshipKind === "unknown") {
    createAssociativeMapping(context, relationship, participants, relationshipAttributes, "ambiguous-cardinality");
    return;
  }

  if (relationshipKind === "many-to-many") {
    createAssociativeMapping(context, relationship, participants, relationshipAttributes, "many-to-many");
    return;
  }

  if (relationshipKind === "one-to-many") {
    const oneToManyParticipants = resolveOneToManyParticipants(participants);
    if (!oneToManyParticipants) {
      createAssociativeMapping(context, relationship, participants, relationshipAttributes, "ambiguous-cardinality");
      return;
    }

    const { carrierParticipant, referencedParticipant } = oneToManyParticipants;

    addForeignKey(context, {
      fromTableId: carrierParticipant.tableId,
      toTableId: referencedParticipant.tableId,
      sourceRelationshipId: relationship.id,
      required: carrierParticipant.cardinality.isTotal,
    });

    addRelationshipAttributes(context, carrierParticipant.tableId, relationshipAttributes, relationship.id);
    return;
  }

  const oneToOne = chooseOwnerForOneToOne(participants, context, relationship.label);
  addForeignKey(context, {
    fromTableId: oneToOne.owner.tableId,
    toTableId: oneToOne.referenced.tableId,
    sourceRelationshipId: relationship.id,
    required: oneToOne.owner.cardinality.isTotal,
    unique: true,
  });

  addRelationshipAttributes(context, oneToOne.owner.tableId, relationshipAttributes, relationship.id);
}

export function buildLogicalSourceSignature(diagram: DiagramDocument): string {
  const nodes = [...diagram.nodes].sort((left, right) => left.id.localeCompare(right.id));
  const edges = [...diagram.edges].sort((left, right) => left.id.localeCompare(right.id));

  return JSON.stringify({
    meta: diagram.meta,
    nodes,
    edges,
  });
}

export function createEmptyLogicalModel(name = "Modello logico"): LogicalModel {
  return {
    meta: {
      name,
      generatedAt: new Date(0).toISOString(),
      sourceDiagramVersion: 1,
      sourceSignature: "",
    },
    tables: [],
    foreignKeys: [],
    uniqueConstraints: [],
    edges: [],
    issues: [],
  };
}

export function generateLogicalModel(diagram: DiagramDocument): LogicalModel {
  const context = createContext(diagram);
  const ownerAttributesByNodeId = buildOwnerAttributesMap(diagram);

  const entities = sortByLabel(
    diagram.nodes.filter((node): node is Extract<DiagramNode, { type: "entity" }> => node.type === "entity"),
  );

  entities.forEach((entity) => {
    const table = createLogicalTable(context, {
      name: entity.label,
      kind: "entity",
      sourceEntityId: entity.id,
    });

    context.entityTableByEntityId.set(entity.id, table.id);
    const entityAttributes = ownerAttributesByNodeId.get(entity.id) ?? [];
    const internalIdentifiers = entity.internalIdentifiers ?? [];
    const selectedIdentifier = internalIdentifiers[0];
    const selectedIdentifierAttributeIds = new Set(selectedIdentifier?.attributeIds ?? []);

    entityAttributes.forEach((attribute) => {
      if (attribute.isMultivalued === true) {
        pushIssue(
          context,
          "MULTIVALUED_ATTRIBUTE",
          `L'attributo composto "${attribute.label}" e mappato come colonna semplice nella tabella "${table.name}".`,
          "warning",
          {
            tableId: table.id,
            relationshipId: table.sourceRelationshipId,
          },
        );
      }

      addColumn(context, table.id, {
        baseName: attribute.label,
        sourceAttributeId: attribute.id,
        isPrimaryKey:
          internalIdentifiers.length > 0
            ? selectedIdentifierAttributeIds.has(attribute.id)
            : attribute.isIdentifier === true || attribute.isCompositeInternal === true,
        isForeignKey: false,
        isNullable:
          internalIdentifiers.length > 0
            ? !selectedIdentifierAttributeIds.has(attribute.id)
            : !(attribute.isIdentifier === true || attribute.isCompositeInternal === true),
      });
    });

    internalIdentifiers.slice(1).forEach((identifier) => {
      const columnIds = table.columns
        .filter((column) => column.sourceAttributeId && identifier.attributeIds.includes(column.sourceAttributeId))
        .map((column) => column.id);
      addUniqueConstraint(context, table.id, columnIds, `Identificatore alternativo ${identifier.id}`);
    });

    ensurePrimaryKey(context, table);
  });

  const relationships = sortByLabel(
    diagram.nodes.filter((node): node is Extract<DiagramNode, { type: "relationship" }> => node.type === "relationship"),
  );

  relationships.forEach((relationship) => {
    mapRelationship(context, relationship, ownerAttributesByNodeId);
  });

  const model: LogicalModel = {
    meta: {
      name: `${normalizeTableName(diagram.meta.name)} (logico)`,
      generatedAt: new Date().toISOString(),
      sourceDiagramVersion: diagram.meta.version,
      sourceSignature: buildLogicalSourceSignature(diagram),
    },
    tables: context.tables,
    foreignKeys: context.foreignKeys,
    uniqueConstraints: context.uniqueConstraints,
    edges: context.edges,
    issues: context.issues,
  };

  return autoLayoutLogicalModel(normalizeLogicalModelGeometry(normalizeLogicalModelSqlMetadata(model)));
}

function buildTableMatchKey(table: LogicalTable): string {
  if (table.generatedByDecisionId) {
    return `decision:${table.generatedByDecisionId}`;
  }

  if (table.sourceAttributeId) {
    return `attribute:${table.sourceAttributeId}`;
  }

  if (table.sourceEntityId) {
    return `entity:${table.kind}:${table.sourceEntityId}`;
  }

  if (table.sourceRelationshipId) {
    return `${table.kind}:${table.sourceRelationshipId}`;
  }

  return `name:${table.kind}:${canonicalKey(table.name)}`;
}

export function preserveLogicalTablePositions(
  nextModel: LogicalModel,
  previousModel: LogicalModel,
): LogicalModel {
  const previousByKey = new Map<string, LogicalTable>();
  previousModel.tables.forEach((table) => {
    previousByKey.set(buildTableMatchKey(table), table);
  });

  return {
    ...nextModel,
    tables: nextModel.tables.map((table) => {
      const previous = previousByKey.get(buildTableMatchKey(table));
      if (!previous) {
        return table;
      }

      return {
        ...table,
        x: previous.x,
        y: previous.y,
      };
    }),
  };
}
