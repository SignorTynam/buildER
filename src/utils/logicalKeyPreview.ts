import type {
  AttributeNode,
  DiagramDocument,
  EntityNode,
  ExternalIdentifier,
  InternalIdentifier,
  RelationshipNode,
} from "../types/diagram";
import type { LogicalTranslationChoice } from "../types/logical";
import type { LogicalEntityKeySelectionRequest } from "./logicalTranslation";

export type EntityKeyPreviewKind = "internal" | "external" | "none";

export interface EntityKeyPreviewAttribute {
  id: string;
  label: string;
  role: "selected-local" | "selected-imported" | "other-candidate";
}

export interface EntityKeyPreviewEntity {
  id: string;
  label: string;
  role: "host" | "source";
  attributes: EntityKeyPreviewAttribute[];
}

export interface EntityKeyPreviewRelationship {
  id: string;
  label: string;
  sourceEntityId: string;
  targetEntityId: string;
}

export interface EntityKeyPreviewColumn {
  id: string;
  name: string;
  label: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isNullable: boolean;
  isUniqueAlternative: boolean;
  references?: {
    tableName: string;
    columnName: string;
  };
}

export interface EntityKeyPreviewData {
  kind: EntityKeyPreviewKind;
  hostEntityId: string;
  hostEntityLabel: string;
  title: string;
  kindLabel: string;
  explanation: string;
  summary: string;
  effectLines: string[];
  entities: EntityKeyPreviewEntity[];
  relationships: EntityKeyPreviewRelationship[];
  logicalTable: {
    name: string;
    columns: EntityKeyPreviewColumn[];
  };
  tables: Array<{
    id: string;
    name: string;
    role: "host" | "referenced";
    columns: EntityKeyPreviewColumn[];
  }>;
  foreignKeys: Array<{
    fromTableName: string;
    fromColumnNames: string[];
    toTableName: string;
    toColumnNames: string[];
    relationshipName?: string;
  }>;
  alternativeKeys: Array<{
    label: string;
    columnNames: string[];
  }>;
}

function findEntity(diagram: DiagramDocument, entityId: string): EntityNode | null {
  return diagram.nodes.find((node): node is EntityNode => node.type === "entity" && node.id === entityId) ?? null;
}

function findRelationship(diagram: DiagramDocument, relationshipId: string): RelationshipNode | null {
  return diagram.nodes.find((node): node is RelationshipNode => node.type === "relationship" && node.id === relationshipId) ?? null;
}

function findAttribute(diagram: DiagramDocument, attributeId: string): AttributeNode | null {
  return diagram.nodes.find((node): node is AttributeNode => node.type === "attribute" && node.id === attributeId) ?? null;
}

function attributePreview(diagram: DiagramDocument, attributeId: string, role: EntityKeyPreviewAttribute["role"]): EntityKeyPreviewAttribute {
  const attribute = findAttribute(diagram, attributeId);
  return {
    id: attributeId,
    label: attribute?.label ?? attributeId,
    role,
  };
}

function addColumn(
  columns: EntityKeyPreviewData["logicalTable"]["columns"],
  column: EntityKeyPreviewData["logicalTable"]["columns"][number],
): void {
  const existing = columns.find((candidate) => candidate.id === column.id);
  if (!existing) {
    columns.push(column);
    return;
  }

  existing.isPrimaryKey = existing.isPrimaryKey || column.isPrimaryKey;
  existing.isForeignKey = existing.isForeignKey || column.isForeignKey;
  existing.isUniqueAlternative = existing.isUniqueAlternative || column.isUniqueAlternative;
  existing.isNullable = existing.isNullable && column.isNullable;
  existing.references = existing.references ?? column.references;
}

function joinNames(values: string[]): string {
  return values.length > 0 ? values.join(" + ") : "nessuna colonna";
}

function attributeLabels(diagram: DiagramDocument, attributeIds: string[]): string[] {
  return attributeIds.map((attributeId) => findAttribute(diagram, attributeId)?.label ?? attributeId);
}

function describeInternalIdentifier(diagram: DiagramDocument, identifier: InternalIdentifier): string[] {
  return attributeLabels(diagram, identifier.attributeIds);
}

function describeExternalIdentifier(diagram: DiagramDocument, identifier: ExternalIdentifier): string[] {
  const importedLabels = identifier.importedParts.flatMap((part) => {
    const sourceEntity = findEntity(diagram, part.sourceEntityId);
    const importedIdentifier = sourceEntity?.internalIdentifiers?.find((candidate) => candidate.id === part.importedIdentifierId);
    return importedIdentifier ? attributeLabels(diagram, importedIdentifier.attributeIds) : ["identificatore importato"];
  });
  return [...importedLabels, ...attributeLabels(diagram, identifier.localAttributeIds)];
}

function alternativeKeysForChoices(
  diagram: DiagramDocument,
  entity: EntityNode,
  request: LogicalEntityKeySelectionRequest,
  selectedChoiceId: string | undefined,
): EntityKeyPreviewData["alternativeKeys"] {
  return request.choices
    .filter((choice) => choice.id !== selectedChoiceId)
    .map((choice) => {
      const keySourceType = choice.configuration?.keySourceType;
      const keySourceId = typeof choice.configuration?.keySourceId === "string" ? choice.configuration.keySourceId : undefined;
      if (keySourceType === "internal" && keySourceId) {
        const identifier = entity.internalIdentifiers?.find((candidate) => candidate.id === keySourceId);
        const columnNames = identifier ? describeInternalIdentifier(diagram, identifier) : [];
        return {
          label: `${joinNames(columnNames)} sara tradotta come UNIQUE NOT NULL.`,
          columnNames,
        };
      }
      if (keySourceType === "external" && keySourceId) {
        const identifier = entity.externalIdentifiers?.find((candidate) => candidate.id === keySourceId);
        const columnNames = identifier ? describeExternalIdentifier(diagram, identifier) : [];
        return {
          label: `${joinNames(columnNames)} sara tradotta come UNIQUE NOT NULL.`,
          columnNames,
        };
      }
      return null;
    })
    .filter((item): item is EntityKeyPreviewData["alternativeKeys"][number] => item != null);
}

function fallbackPreview(hostEntity: EntityNode | null, choice: LogicalTranslationChoice | null): EntityKeyPreviewData {
  const logicalTable = {
    name: hostEntity?.label ?? "Tabella",
    columns: [],
  };
  return {
    kind: "none",
    hostEntityId: hostEntity?.id ?? "",
    hostEntityLabel: hostEntity?.label ?? "Entita",
    title: choice?.label ?? "Preview non disponibile",
    kindLabel: "Preview non disponibile",
    explanation: "Non ci sono dati sufficienti per descrivere questa scelta.",
    summary: "Preview non disponibile per questa alternativa.",
    effectLines: ["Preview non disponibile per questa alternativa."],
    entities: hostEntity
      ? [{
          id: hostEntity.id,
          label: hostEntity.label,
          role: "host",
          attributes: [],
        }]
      : [],
    relationships: [],
    logicalTable,
    tables: hostEntity ? [{ id: hostEntity.id, name: hostEntity.label, role: "host", columns: logicalTable.columns }] : [],
    foreignKeys: [],
    alternativeKeys: [],
  };
}

function addAlternativeInternalColumns(
  diagram: DiagramDocument,
  entity: EntityNode,
  selectedIdentifierId: string,
  columns: EntityKeyPreviewData["logicalTable"]["columns"],
): void {
  (entity.internalIdentifiers ?? [])
    .filter((identifier) => identifier.id !== selectedIdentifierId)
    .forEach((identifier) => {
      identifier.attributeIds.forEach((attributeId) => {
        const attribute = findAttribute(diagram, attributeId);
        addColumn(columns, {
          id: `unique-${attributeId}`,
          name: attribute?.label ?? attributeId,
          label: attribute?.label ?? attributeId,
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: false,
          isUniqueAlternative: true,
        });
      });
    });
}

function buildInternalPreview(
  diagram: DiagramDocument,
  entity: EntityNode,
  identifier: InternalIdentifier,
  choice: LogicalTranslationChoice,
  request: LogicalEntityKeySelectionRequest,
): EntityKeyPreviewData {
  const selectedAttributes = identifier.attributeIds.map((attributeId) => attributePreview(diagram, attributeId, "selected-local"));
  const columns: EntityKeyPreviewData["logicalTable"]["columns"] = [];
  const pkNames = selectedAttributes.map((attribute) => attribute.label);

  selectedAttributes.forEach((attribute) => {
    addColumn(columns, {
      id: attribute.id,
      name: attribute.label,
      label: attribute.label,
      isPrimaryKey: true,
      isForeignKey: false,
      isNullable: false,
      isUniqueAlternative: false,
    });
  });
  addAlternativeInternalColumns(diagram, entity, identifier.id, columns);
  const logicalTable = {
    name: entity.label,
    columns,
  };
  const kindLabel = pkNames.length > 1 ? "Chiave interna composta" : "Chiave interna";
  const title = `Usa ${joinNames(pkNames)} come PK`;

  return {
    kind: "internal",
    hostEntityId: entity.id,
    hostEntityLabel: entity.label,
    title,
    kindLabel,
    explanation: pkNames.length > 1
      ? "Gli attributi selezionati formano insieme la chiave primaria."
      : `${pkNames[0] ?? "L'attributo selezionato"} e un identificatore interno di ${entity.label}.`,
    summary: `${entity.label} chiave primaria = ${joinNames(pkNames)}`,
    effectLines: [
      `La tabella ${entity.label} usera ${pkNames.length > 1 ? "una chiave primaria composta" : "una chiave primaria semplice"}.`,
      ...pkNames.map((name) => `${name} sara una colonna di chiave primaria locale.`),
    ],
    entities: [{
      id: entity.id,
      label: entity.label,
      role: "host",
      attributes: selectedAttributes,
    }],
    relationships: [],
    logicalTable,
    tables: [{ id: entity.id, name: entity.label, role: "host", columns }],
    foreignKeys: [],
    alternativeKeys: alternativeKeysForChoices(diagram, entity, request, choice.id),
  };
}

function buildExternalPreview(
  diagram: DiagramDocument,
  entity: EntityNode,
  identifier: ExternalIdentifier,
  choice: LogicalTranslationChoice,
  request: LogicalEntityKeySelectionRequest,
): EntityKeyPreviewData {
  const hostAttributes = identifier.localAttributeIds.map((attributeId) => attributePreview(diagram, attributeId, "selected-local"));
  const columns: EntityKeyPreviewData["logicalTable"]["columns"] = [];
  const sourceEntities = new Map<string, EntityKeyPreviewEntity>();
  const relationships: EntityKeyPreviewRelationship[] = [];
  const referencedTables = new Map<string, EntityKeyPreviewData["tables"][number]>();
  const foreignKeys: EntityKeyPreviewData["foreignKeys"] = [];
  const effectLines: string[] = [];

  hostAttributes.forEach((attribute) => {
    addColumn(columns, {
      id: attribute.id,
      name: attribute.label,
      label: attribute.label,
      isPrimaryKey: true,
      isForeignKey: false,
      isNullable: false,
      isUniqueAlternative: false,
    });
    effectLines.push(`${attribute.label} sara una colonna PK locale.`);
  });

  identifier.importedParts.forEach((part) => {
    const sourceEntity = findEntity(diagram, part.sourceEntityId);
    const relationship = findRelationship(diagram, part.relationshipId);
    const importedIdentifier = sourceEntity?.internalIdentifiers?.find((candidate) => candidate.id === part.importedIdentifierId);
    const importedColumnNames: string[] = [];

    if (relationship && sourceEntity) {
      relationships.push({
        id: relationship.id,
        label: relationship.label,
        sourceEntityId: entity.id,
        targetEntityId: sourceEntity.id,
      });
    }

    if (!sourceEntity || !importedIdentifier) {
      return;
    }

    const sourcePreview = sourceEntities.get(sourceEntity.id) ?? {
      id: sourceEntity.id,
      label: sourceEntity.label,
      role: "source" as const,
      attributes: [],
    };

    importedIdentifier.attributeIds.forEach((attributeId) => {
      const attribute = attributePreview(diagram, attributeId, "selected-imported");
      importedColumnNames.push(attribute.label);
      if (!sourcePreview.attributes.some((candidate) => candidate.id === attribute.id)) {
        sourcePreview.attributes.push(attribute);
      }
      addColumn(columns, {
        id: `imported-${sourceEntity.id}-${attribute.id}`,
        name: attribute.label,
        label: attribute.label,
        isPrimaryKey: true,
        isForeignKey: true,
        isNullable: false,
        isUniqueAlternative: false,
        references: {
          tableName: sourceEntity.label,
          columnName: attribute.label,
        },
      });
    });

    if (importedColumnNames.length > 0) {
      const relationshipName = relationship?.label ?? part.relationshipId;
      effectLines.push(`Importa ${joinNames(importedColumnNames)} da ${sourceEntity.label} tramite ${relationshipName}.`);
      foreignKeys.push({
        fromTableName: entity.label,
        fromColumnNames: importedColumnNames,
        toTableName: sourceEntity.label,
        toColumnNames: importedColumnNames,
        relationshipName,
      });
      referencedTables.set(sourceEntity.id, {
        id: sourceEntity.id,
        name: sourceEntity.label,
        role: "referenced",
        columns: importedColumnNames.map((name, index) => ({
          id: `${sourceEntity.id}-${importedIdentifier.attributeIds[index] ?? name}`,
          name,
          label: name,
          isPrimaryKey: true,
          isForeignKey: false,
          isNullable: false,
          isUniqueAlternative: false,
        })),
      });
    }

    sourceEntities.set(sourceEntity.id, sourcePreview);
  });

  const pkNames = describeExternalIdentifier(diagram, identifier);
  const logicalTable = {
    name: entity.label,
    columns,
  };
  const kindLabel =
    hostAttributes.length > 0 && identifier.importedParts.length > 0
      ? "Chiave esterna/mista"
      : "Chiave esterna";

  return {
    kind: "external",
    hostEntityId: entity.id,
    hostEntityLabel: entity.label,
    title: `Usa ${joinNames(pkNames)} come PK`,
    kindLabel,
    explanation:
      kindLabel === "Chiave esterna/mista"
        ? "Combina attributi locali e colonne importate tramite relazioni identificanti."
        : "Usa una chiave primaria importata tramite una relazione identificante.",
    summary: `${entity.label} chiave primaria = ${joinNames(pkNames)}`,
    effectLines: [
      `La tabella ${entity.label} usera ${pkNames.length > 1 ? "una chiave primaria composta" : "una chiave primaria semplice"}.`,
      ...effectLines,
    ],
    entities: [{
      id: entity.id,
      label: entity.label,
      role: "host",
      attributes: hostAttributes,
    }, ...sourceEntities.values()],
    relationships,
    logicalTable,
    tables: [{ id: entity.id, name: entity.label, role: "host", columns }, ...referencedTables.values()],
    foreignKeys,
    alternativeKeys: alternativeKeysForChoices(diagram, entity, request, choice.id),
  };
}

export function buildEntityKeyChoicePreviewData(options: {
  diagram: DiagramDocument;
  request: LogicalEntityKeySelectionRequest;
  choice: LogicalTranslationChoice | null;
}): EntityKeyPreviewData {
  const entity = findEntity(options.diagram, options.request.item.id);
  if (!entity || !options.choice) {
    return fallbackPreview(entity, options.choice);
  }

  const keySourceType = options.choice.configuration?.keySourceType;
  const keySourceId = typeof options.choice.configuration?.keySourceId === "string"
    ? options.choice.configuration.keySourceId
    : undefined;

  if (keySourceType === "internal" && keySourceId) {
    const identifier = entity.internalIdentifiers?.find((candidate) => candidate.id === keySourceId);
    return identifier
      ? buildInternalPreview(options.diagram, entity, identifier, options.choice, options.request)
      : fallbackPreview(entity, options.choice);
  }

  if (keySourceType === "external" && keySourceId) {
    const identifier = entity.externalIdentifiers?.find((candidate) => candidate.id === keySourceId);
    return identifier
      ? buildExternalPreview(options.diagram, entity, identifier, options.choice, options.request)
      : fallbackPreview(entity, options.choice);
  }

  return fallbackPreview(entity, options.choice);
}

export function getPreviousEntityKeyModalIndex(currentIndex: number): number {
  return Math.max(0, currentIndex - 1);
}

export function getNextEntityKeyModalIndex(currentIndex: number, total: number): number {
  return Math.min(Math.max(0, total - 1), currentIndex + 1);
}
