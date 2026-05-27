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

export interface EntityKeyPreviewData {
  kind: EntityKeyPreviewKind;
  hostEntityId: string;
  hostEntityLabel: string;
  title: string;
  summary: string;
  entities: EntityKeyPreviewEntity[];
  relationships: EntityKeyPreviewRelationship[];
  logicalTable: {
    name: string;
    columns: Array<{
      id: string;
      label: string;
      isPrimaryKey: boolean;
      isForeignKey: boolean;
      isUniqueAlternative: boolean;
    }>;
  };
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
}

function fallbackPreview(hostEntity: EntityNode | null, choice: LogicalTranslationChoice | null): EntityKeyPreviewData {
  return {
    kind: "none",
    hostEntityId: hostEntity?.id ?? "",
    hostEntityLabel: hostEntity?.label ?? "Entita",
    title: choice?.label ?? "Preview non disponibile",
    summary: "Preview non disponibile per questa alternativa.",
    entities: hostEntity
      ? [{
          id: hostEntity.id,
          label: hostEntity.label,
          role: "host",
          attributes: [],
        }]
      : [],
    relationships: [],
    logicalTable: {
      name: hostEntity?.label ?? "Tabella",
      columns: [],
    },
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
          label: attribute?.label ?? attributeId,
          isPrimaryKey: false,
          isForeignKey: false,
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
): EntityKeyPreviewData {
  const selectedAttributes = identifier.attributeIds.map((attributeId) => attributePreview(diagram, attributeId, "selected-local"));
  const columns: EntityKeyPreviewData["logicalTable"]["columns"] = [];

  selectedAttributes.forEach((attribute) => {
    addColumn(columns, {
      id: attribute.id,
      label: attribute.label,
      isPrimaryKey: true,
      isForeignKey: false,
      isUniqueAlternative: false,
    });
  });
  addAlternativeInternalColumns(diagram, entity, identifier.id, columns);

  return {
    kind: "internal",
    hostEntityId: entity.id,
    hostEntityLabel: entity.label,
    title: choice.label,
    summary: `PK interna: ${selectedAttributes.map((attribute) => attribute.label).join(" + ")}`,
    entities: [{
      id: entity.id,
      label: entity.label,
      role: "host",
      attributes: selectedAttributes,
    }],
    relationships: [],
    logicalTable: {
      name: entity.label,
      columns,
    },
  };
}

function buildExternalPreview(
  diagram: DiagramDocument,
  entity: EntityNode,
  identifier: ExternalIdentifier,
  choice: LogicalTranslationChoice,
): EntityKeyPreviewData {
  const hostAttributes = identifier.localAttributeIds.map((attributeId) => attributePreview(diagram, attributeId, "selected-local"));
  const columns: EntityKeyPreviewData["logicalTable"]["columns"] = [];
  const sourceEntities = new Map<string, EntityKeyPreviewEntity>();
  const relationships: EntityKeyPreviewRelationship[] = [];

  hostAttributes.forEach((attribute) => {
    addColumn(columns, {
      id: attribute.id,
      label: attribute.label,
      isPrimaryKey: true,
      isForeignKey: false,
      isUniqueAlternative: false,
    });
  });

  identifier.importedParts.forEach((part) => {
    const sourceEntity = findEntity(diagram, part.sourceEntityId);
    const relationship = findRelationship(diagram, part.relationshipId);
    const importedIdentifier = sourceEntity?.internalIdentifiers?.find((candidate) => candidate.id === part.importedIdentifierId);

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
      if (!sourcePreview.attributes.some((candidate) => candidate.id === attribute.id)) {
        sourcePreview.attributes.push(attribute);
      }
      addColumn(columns, {
        id: `imported-${sourceEntity.id}-${attribute.id}`,
        label: attribute.label,
        isPrimaryKey: true,
        isForeignKey: true,
        isUniqueAlternative: false,
      });
    });

    sourceEntities.set(sourceEntity.id, sourcePreview);
  });

  return {
    kind: "external",
    hostEntityId: entity.id,
    hostEntityLabel: entity.label,
    title: choice.label,
    summary: `PK esterna: ${columns.filter((column) => column.isPrimaryKey).map((column) => column.label).join(" + ")}`,
    entities: [{
      id: entity.id,
      label: entity.label,
      role: "host",
      attributes: hostAttributes,
    }, ...sourceEntities.values()],
    relationships,
    logicalTable: {
      name: entity.label,
      columns,
    },
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
    return identifier ? buildInternalPreview(options.diagram, entity, identifier, options.choice) : fallbackPreview(entity, options.choice);
  }

  if (keySourceType === "external" && keySourceId) {
    const identifier = entity.externalIdentifiers?.find((candidate) => candidate.id === keySourceId);
    return identifier ? buildExternalPreview(options.diagram, entity, identifier, options.choice) : fallbackPreview(entity, options.choice);
  }

  return fallbackPreview(entity, options.choice);
}

export function getPreviousEntityKeyModalIndex(currentIndex: number): number {
  return Math.max(0, currentIndex - 1);
}

export function getNextEntityKeyModalIndex(currentIndex: number, total: number): number {
  return Math.min(Math.max(0, total - 1), currentIndex + 1);
}
