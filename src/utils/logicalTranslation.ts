import type {
  AttributeNode,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EntityNode,
  ExternalIdentifier,
  GeneralizationGroup,
  InheritanceEdge,
  InternalIdentifier,
  RelationshipNode,
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
  LogicalTranslationChoice,
  LogicalTranslationConflict,
  LogicalTranslationDecision,
  LogicalTransformationColumn,
  LogicalTransformationEdge,
  LogicalTransformationElementStatus,
  LogicalTransformationNode,
  LogicalTransformationState,
  LogicalTranslationItem,
  LogicalTranslationRuleKind,
  LogicalTranslationState,
  LogicalTranslationStep,
  LogicalWorkspaceDocument,
} from "../types/logical";
import { getConnectorParticipation, getEdgeCardinalityLabel } from "./cardinality";
import { normalizeGeneralizationGroups } from "./diagram";
import { normalizeLogicalModelGeometry } from "./logicalLayout";
import { normalizeLogicalModelSqlMetadata } from "./logicalSqlMetadata";

interface ParsedCardinality {
  raw: string;
  min: number | null;
  max: number | null;
  isKnown: boolean;
  isMany: boolean;
  isTotal: boolean;
}

interface RelationshipParticipant {
  entity: EntityNode;
  cardinality: ParsedCardinality;
}

interface GeneralizationHierarchy {
  id: string;
  group?: GeneralizationGroup;
  supertype: EntityNode;
  subtypes: EntityNode[];
  edges: InheritanceEdge[];
  disjointness?: InheritanceEdge["isaDisjointness"];
  completeness?: InheritanceEdge["isaCompleteness"];
}

interface TranslationChoiceRecord extends LogicalTranslationChoice {
  targetType: LogicalTranslationDecision["targetType"];
  targetId: string;
}

export interface TranslationOverview {
  itemsByStep: Record<LogicalTranslationStep, LogicalTranslationItem[]>;
  choicesByKey: Map<string, TranslationChoiceRecord>;
}

interface MappingContext {
  diagram: DiagramDocument;
  tables: LogicalTable[];
  foreignKeys: LogicalForeignKey[];
  uniqueConstraints: LogicalUniqueConstraint[];
  edges: LogicalEdge[];
  issues: LogicalIssue[];
  tableById: Map<string, LogicalTable>;
  entityTableByEntityId: Map<string, string>;
  usedTableNames: Set<string>;
  usedColumnNamesByTable: Map<string, Set<string>>;
  usedFkNames: Set<string>;
  uniqueConstraintSequence: number;
  tableSequence: number;
  columnSequence: number;
  fkSequence: number;
  edgeSequence: number;
  issueSequence: number;
}

interface AttributeOwnershipContext {
  nodeById: Map<string, DiagramNode>;
  childrenByHostId: Map<string, string[]>;
  parentByAttributeId: Map<string, string>;
  directAttributeIdsByOwnerId: Map<string, string[]>;
}

type EntityDecisionConfiguration = {
  keySourceType?: "internal" | "external" | "none";
  keySourceId?: string;
};

type WeakEntityDecisionConfiguration = {
  externalIdentifierId?: string;
};

type RelationshipDecisionConfiguration = {
  strategy?: "foreign-key" | "table";
  carrierEntityId?: string;
  referencedEntityId?: string;
};

type GeneralizationDecisionConfiguration = {
  strategy?: "table-per-type" | "subtypes-only" | "single-table";
};

interface TableCreationOptions {
  name: string;
  kind: LogicalTableKind;
  decisionId: string;
  sourceEntityId?: string;
  sourceRelationshipId?: string;
  sourceAttributeId?: string;
  originLabel?: string;
}

interface ColumnCreationOptions {
  baseName: string;
  decisionId: string;
  sourceAttributeId?: string;
  sourceRelationshipId?: string;
  originLabel?: string;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique?: boolean;
  isNullable: boolean;
  isGenerated?: boolean;
}

interface ForeignKeyCreationOptions {
  decisionId: string;
  fromTableId: string;
  toTableId: string;
  sourceRelationshipId?: string;
  required: boolean;
  unique?: boolean;
  includeInPrimaryKey?: boolean;
}

export const LOGICAL_TRANSLATION_STEPS: Array<{
  id: LogicalTranslationStep;
  label: string;
  description: string;
}> = [
  {
    id: "entities",
    label: "Fix Entities",
    description: "Conferma le entita forti e scegli quale identificatore porta la PK.",
  },
  {
    id: "weak-entities",
    label: "Fix Weak Entities",
    description: "Assorbi la relazione identificante e compone la PK con owner + discriminante.",
  },
  {
    id: "relationships",
    label: "Fix Relationships",
    description: "Decidi esplicitamente se una relazione sparisce in FK o diventa tabella autonoma.",
  },
  {
    id: "multivalued-attributes",
    label: "Fix Multivalued",
    description: "Trasforma ogni attributo multivalore in tabella separata con FK verso l'owner.",
  },
  {
    id: "review",
    label: "Review",
    description: "Controlla mapping, conflitti aperti e avanzamento della trasformazione logica manuale.",
  },
];

const MANY = Number.POSITIVE_INFINITY;

function nowIso(): string {
  return new Date().toISOString();
}

function stableJson(value: unknown): string {
  return JSON.stringify(value);
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

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTableName(label: string): string {
  return normalizeSpaces(label) || "Tabella";
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

  return {
    raw,
    min: parsedMin,
    max: parsedMax,
    isKnown: true,
    isMany: parsedMax === MANY,
    isTotal: parsedMin >= 1,
  };
}

function buildAttributeOwnershipContext(diagram: DiagramDocument): AttributeOwnershipContext {
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const childrenByHostId = new Map<string, string[]>();
  const parentByAttributeId = new Map<string, string>();
  const directAttributeIdsByOwnerId = new Map<string, string[]>();

  diagram.edges.forEach((edge) => {
    if (edge.type !== "attribute") {
      return;
    }

    const sourceNode = nodeById.get(edge.sourceId);
    const targetNode = nodeById.get(edge.targetId);
    if (!sourceNode || !targetNode) {
      return;
    }

    if (sourceNode.type === "attribute" && targetNode.type !== "attribute") {
      const bucket = directAttributeIdsByOwnerId.get(targetNode.id) ?? [];
      if (!bucket.includes(sourceNode.id)) {
        bucket.push(sourceNode.id);
      }
      directAttributeIdsByOwnerId.set(targetNode.id, bucket);
      return;
    }

    if (targetNode.type === "attribute" && sourceNode.type !== "attribute") {
      const bucket = directAttributeIdsByOwnerId.get(sourceNode.id) ?? [];
      if (!bucket.includes(targetNode.id)) {
        bucket.push(targetNode.id);
      }
      directAttributeIdsByOwnerId.set(sourceNode.id, bucket);
      return;
    }

    if (sourceNode.type === "attribute" && targetNode.type === "attribute") {
      const hostId =
        sourceNode.isMultivalued === true && targetNode.isMultivalued !== true
          ? sourceNode.id
          : targetNode.isMultivalued === true && sourceNode.isMultivalued !== true
            ? targetNode.id
            : targetNode.id;
      const childId = hostId === sourceNode.id ? targetNode.id : sourceNode.id;
      const children = childrenByHostId.get(hostId) ?? [];
      if (!children.includes(childId)) {
        children.push(childId);
      }
      childrenByHostId.set(hostId, children);
      parentByAttributeId.set(childId, hostId);
    }
  });

  return {
    nodeById,
    childrenByHostId,
    parentByAttributeId,
    directAttributeIdsByOwnerId,
  };
}

function getAttributeChildren(
  attributeId: string,
  ownership: AttributeOwnershipContext,
): AttributeNode[] {
  return (ownership.childrenByHostId.get(attributeId) ?? [])
    .map((childId) => ownership.nodeById.get(childId))
    .filter((node): node is AttributeNode => node?.type === "attribute");
}

function collectLeafAttributes(
  attribute: AttributeNode,
  ownership: AttributeOwnershipContext,
): AttributeNode[] {
  const children = getAttributeChildren(attribute.id, ownership);
  if (children.length === 0) {
    return [attribute];
  }

  return children.flatMap((child) => collectLeafAttributes(child, ownership));
}

function expandAttributeIdsToLeafAttributes(
  attributeIds: string[],
  ownership: AttributeOwnershipContext,
): AttributeNode[] {
  const byId = new Map<string, AttributeNode>();
  attributeIds.forEach((attributeId) => {
    const attribute = ownership.nodeById.get(attributeId);
    if (attribute?.type !== "attribute") {
      return;
    }

    collectLeafAttributes(attribute, ownership).forEach((leaf) => byId.set(leaf.id, leaf));
  });
  return [...byId.values()];
}

function getDirectOwnedAttributes(
  ownerId: string,
  ownership: AttributeOwnershipContext,
): AttributeNode[] {
  return (ownership.directAttributeIdsByOwnerId.get(ownerId) ?? [])
    .map((attributeId) => ownership.nodeById.get(attributeId))
    .filter((node): node is AttributeNode => node?.type === "attribute");
}

function getOwnedLeafAttributes(
  ownerId: string,
  ownership: AttributeOwnershipContext,
): AttributeNode[] {
  return getDirectOwnedAttributes(ownerId, ownership)
    .filter((attribute) => attribute.isMultivalued !== true)
    .flatMap((attribute) => collectLeafAttributes(attribute, ownership))
    .filter((attribute) => attribute.isMultivalued !== true);
}

function getRelationshipLeafAttributes(
  relationshipId: string,
  ownership: AttributeOwnershipContext,
): AttributeNode[] {
  return getOwnedLeafAttributes(relationshipId, ownership);
}

function getEntityLeafAttributes(
  entityId: string,
  ownership: AttributeOwnershipContext,
): AttributeNode[] {
  return getOwnedLeafAttributes(entityId, ownership);
}

function getMultivaluedRootAttributes(
  diagram: DiagramDocument,
  ownership: AttributeOwnershipContext,
): AttributeNode[] {
  return sortByLabel(
    diagram.nodes.filter(
      (node): node is AttributeNode =>
        node.type === "attribute" &&
        node.isMultivalued === true &&
        ownership.parentByAttributeId.has(node.id) === false,
    ),
  );
}

function getMultivaluedAttributeLeafAttributes(
  attributeId: string,
  ownership: AttributeOwnershipContext,
): AttributeNode[] {
  const attribute = ownership.nodeById.get(attributeId);
  return attribute?.type === "attribute" ? collectLeafAttributes(attribute, ownership) : [];
}

function getAttributeOwner(
  attributeId: string,
  ownership: AttributeOwnershipContext,
): DiagramNode | undefined {
  let currentId = attributeId;
  const visited = new Set<string>();

  while (!visited.has(currentId)) {
    visited.add(currentId);
    const parentId = ownership.parentByAttributeId.get(currentId);
    if (parentId) {
      currentId = parentId;
      continue;
    }

    const ownerEntry = [...ownership.directAttributeIdsByOwnerId.entries()].find(([, ids]) => ids.includes(currentId));
    return ownerEntry ? ownership.nodeById.get(ownerEntry[0]) : undefined;
  }

  return undefined;
}

function buildGeneralizationHierarchies(diagram: DiagramDocument): GeneralizationHierarchy[] {
  diagram = normalizeGeneralizationGroups(diagram);
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const groups = diagram.generalizationGroups ?? [];

  return groups
    .map((group): GeneralizationHierarchy | null => {
      const supertype = nodeById.get(group.supertypeId);
      if (supertype?.type !== "entity") {
        return null;
      }
      const edges = diagram.edges.filter(
        (edge): edge is InheritanceEdge => edge.type === "inheritance" && edge.generalizationGroupId === group.id,
      );
      const subtypes = group.subtypeIds
        .map((subtypeId) => nodeById.get(subtypeId))
        .filter((node): node is EntityNode => node?.type === "entity");
      if (subtypes.length === 0) {
        return null;
      }
      return {
        id: group.id,
        group,
        supertype,
        subtypes,
        edges,
        disjointness: group.isaDisjointness ?? edges[0]?.isaDisjointness,
        completeness: group.isaCompleteness ?? edges[0]?.isaCompleteness,
      };
    })
    .filter((hierarchy): hierarchy is GeneralizationHierarchy => hierarchy !== null)
    .map((hierarchy) => ({
      ...hierarchy,
      subtypes: sortByLabel(hierarchy.subtypes),
    }))
    .sort((left, right) => {
      const byLabel = left.supertype.label.localeCompare(right.supertype.label, "it", { sensitivity: "base" });
      if (byLabel !== 0) {
        return byLabel;
      }

      return left.supertype.id.localeCompare(right.supertype.id);
    });
}

function buildHierarchyDecisionLookup(diagram: DiagramDocument): Map<string, GeneralizationHierarchy> {
  const hierarchies = buildGeneralizationHierarchies(diagram);
  const lookup = new Map(hierarchies.map((hierarchy) => [hierarchy.id, hierarchy] as const));
  const bySupertype = new Map<string, GeneralizationHierarchy[]>();
  hierarchies.forEach((hierarchy) => {
    bySupertype.set(hierarchy.supertype.id, [...(bySupertype.get(hierarchy.supertype.id) ?? []), hierarchy]);
  });
  bySupertype.forEach((items, supertypeId) => {
    if (items.length === 1) {
      lookup.set(supertypeId, items[0]);
    }
  });
  return lookup;
}

function buildDirectSupertypesBySubtypeId(
  diagram: DiagramDocument,
): Map<string, EntityNode[]> {
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const directSupertypesBySubtypeId = new Map<string, EntityNode[]>();

  diagram.edges
    .filter((edge): edge is InheritanceEdge => edge.type === "inheritance")
    .forEach((edge) => {
      const subtype = nodeById.get(edge.sourceId);
      const supertype = nodeById.get(edge.targetId);
      if (subtype?.type !== "entity" || supertype?.type !== "entity") {
        return;
      }

      const current = directSupertypesBySubtypeId.get(subtype.id) ?? [];
      if (current.some((candidate) => candidate.id === supertype.id)) {
        return;
      }

      current.push(supertype);
      directSupertypesBySubtypeId.set(subtype.id, sortByLabel(current));
    });

  return directSupertypesBySubtypeId;
}

function getDecisionForTarget(
  state: LogicalTranslationState,
  targetType: LogicalTranslationDecision["targetType"],
  targetId: string,
): LogicalTranslationDecision | undefined {
  return state.decisions.find((decision) => decision.targetType === targetType && decision.targetId === targetId);
}

function buildTargetKey(
  targetType: LogicalTranslationDecision["targetType"],
  targetId: string,
): string {
  return `${targetType}:${targetId}`;
}

function buildChoiceKey(
  targetType: LogicalTranslationDecision["targetType"],
  targetId: string,
  rule: LogicalTranslationRuleKind,
  configuration?: LogicalTranslationDecision["configuration"],
): string {
  return `${targetType}:${targetId}:${rule}:${stableJson(configuration ?? null)}`;
}

function getDecisionTargetKeyMap(
  translation: LogicalTranslationState,
): Map<string, string> {
  return new Map(
    translation.decisions.map((decision) => [decision.id, buildTargetKey(decision.targetType, decision.targetId)]),
  );
}

function getTransformationStatus(
  translation: LogicalTranslationState,
  targetType: LogicalTranslationDecision["targetType"],
  targetId: string,
): LogicalTransformationElementStatus {
  const conflicts = translation.conflicts.filter(
    (conflict) => conflict.targetType === targetType && conflict.targetId === targetId,
  );
  if (conflicts.length > 0) {
    return "invalid";
  }

  const decision = getDecisionForTarget(translation, targetType, targetId);
  if (decision?.status === "applied") {
    return "transformed";
  }

  return "unresolved";
}

function getSubtypeGeneralizationSupport(
  entity: EntityNode,
  state: LogicalTranslationState,
  directSupertypesBySubtypeId: Map<string, EntityNode[]>,
): { supertype: EntityNode; hasAppliedTablePerType: boolean } | null {
  const directSupertypes = directSupertypesBySubtypeId.get(entity.id) ?? [];
  if (directSupertypes.length === 0) {
    return null;
  }

  const appliedTablePerTypeSupertype = directSupertypes.find(
    (supertype) => getDecisionForTarget(state, "generalization", supertype.id)?.rule === "generalization-table-per-type",
  );
  if (appliedTablePerTypeSupertype) {
    return {
      supertype: appliedTablePerTypeSupertype,
      hasAppliedTablePerType: true,
    };
  }

  return {
    supertype: directSupertypes[0],
    hasAppliedTablePerType: false,
  };
}

function getAbsorbedExternalIdentifierRelationshipIds(
  diagram: DiagramDocument,
  translation: LogicalTranslationState,
): Set<string> {
  const entityById = new Map(
    diagram.nodes.filter((node): node is EntityNode => node.type === "entity").map((node) => [node.id, node]),
  );
  const absorbed = new Set<string>();

  translation.decisions
    .filter(
      (decision) =>
        decision.status === "applied" &&
        (decision.rule === "entity-table-external" || decision.rule === "weak-entity-table"),
    )
    .forEach((decision) => {
      const entity = entityById.get(decision.targetId);
      if (!entity) {
        return;
      }

      const identifierId =
        decision.rule === "entity-table-external"
          ? getStrongEntityMode(decision.configuration).keySourceId
          : getWeakEntityMode(decision.configuration).externalIdentifierId;
      const identifier =
        findExternalIdentifierById(entity, identifierId) ?? entity.externalIdentifiers?.[0];
      if (identifier?.relationshipId) {
        absorbed.add(identifier.relationshipId);
      }
    });

  return absorbed;
}

function collectAttributeSubtreeIds(
  attributeId: string,
  ownership: AttributeOwnershipContext,
): string[] {
  const result = new Set<string>();
  const stack = [attributeId];

  while (stack.length > 0) {
    const currentId = stack.pop() as string;
    if (result.has(currentId)) {
      continue;
    }

    result.add(currentId);
    (ownership.childrenByHostId.get(currentId) ?? []).forEach((childId) => stack.push(childId));
  }

  return [...result];
}

function getAttributeRoot(
  attributeId: string,
  ownership: AttributeOwnershipContext,
): AttributeNode | undefined {
  let currentId = attributeId;
  const visited = new Set<string>();

  while (!visited.has(currentId)) {
    visited.add(currentId);
    const parentId = ownership.parentByAttributeId.get(currentId);
    if (!parentId) {
      const node = ownership.nodeById.get(currentId);
      return node?.type === "attribute" ? node : undefined;
    }
    currentId = parentId;
  }

  return undefined;
}

function isAttributeUnderMultivaluedRoot(
  attributeId: string,
  ownership: AttributeOwnershipContext,
): boolean {
  return getAttributeRoot(attributeId, ownership)?.isMultivalued === true;
}

function classifyBinaryRelationship(
  participants: RelationshipParticipant[],
): "one-to-one" | "one-to-many" | "many-to-many" | "unknown" {
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

function buildRelationshipParticipants(
  diagram: DiagramDocument,
  relationship: RelationshipNode,
): RelationshipParticipant[] {
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const participants = new Map<string, RelationshipParticipant>();

  diagram.edges.forEach((edge) => {
    if (edge.type !== "connector" || (edge.sourceId !== relationship.id && edge.targetId !== relationship.id)) {
      return;
    }

    const entityId = edge.sourceId === relationship.id ? edge.targetId : edge.sourceId;
    const entity = nodeById.get(entityId);
    if (entity?.type !== "entity" || participants.has(entity.id)) {
      return;
    }

    participants.set(entity.id, {
      entity,
      cardinality: parseConnectorCardinality(
        getConnectorParticipation(edge, nodeById.get(edge.sourceId), nodeById.get(edge.targetId))?.cardinality,
      ),
    });
  });

  return sortByLabel([...participants.values()].map((participant) => participant.entity)).map(
    (entity) => participants.get(entity.id) as RelationshipParticipant,
  );
}

function describePrimaryKeyFromIdentifier(
  entity: EntityNode,
  identifier: InternalIdentifier | ExternalIdentifier | undefined,
  ownership: AttributeOwnershipContext,
  diagram: DiagramDocument,
): string {
  if (!identifier) {
    return "nessun identificatore definito";
  }

  if ("attributeIds" in identifier) {
    const attributes = expandAttributeIdsToLeafAttributes(identifier.attributeIds, ownership);
    return attributes.length > 0 ? attributes.map((attribute) => attribute.label).join(", ") : "nessun identificatore definito";
  }

  const sourceEntity = diagram.nodes.find(
    (node): node is EntityNode => node.id === identifier.sourceEntityId && node.type === "entity",
  );
  const importedIdentifier = sourceEntity?.internalIdentifiers?.find(
    (candidate) => candidate.id === identifier.importedIdentifierId,
  );
  const importedLabel = importedIdentifier
    ? expandAttributeIdsToLeafAttributes(importedIdentifier.attributeIds, ownership)
        .map((attribute) => attribute.label)
        .join(", ")
    : "identificatore importato";
  const localLabel = expandAttributeIdsToLeafAttributes(identifier.localAttributeIds, ownership)
    .map((attribute) => attribute.label)
    .join(", ");
  return localLabel ? `${importedLabel} + ${localLabel}` : importedLabel;
}

function buildEntityChoices(
  diagram: DiagramDocument,
  entity: EntityNode,
  ownership: AttributeOwnershipContext,
  state: LogicalTranslationState,
  directSupertypesBySubtypeId: Map<string, EntityNode[]>,
): TranslationChoiceRecord[] {
  const subtypeGeneralizationSupport = getSubtypeGeneralizationSupport(entity, state, directSupertypesBySubtypeId);
  const internalChoices = (entity.internalIdentifiers ?? []).map((identifier) => ({
    id: `entity-internal-${entity.id}-${identifier.id}`,
    targetType: "entity" as const,
    targetId: entity.id,
    step: "entities" as const,
    rule: "entity-table-internal" as const,
    label:
      subtypeGeneralizationSupport?.hasAppliedTablePerType === true
        ? `Tabella sottotipo con PK derivata + UNIQUE locale: ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}`
        : `Tabella con PK interna: ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}`,
    description:
      subtypeGeneralizationSupport?.hasAppliedTablePerType === true
        ? `Con la gerarchia table-per-type gia fissata, la PK della tabella resta derivata dal supertipo "${subtypeGeneralizationSupport.supertype.label}" e l'identificatore interno selezionato viene tradotto come vincolo UNIQUE alternativo.`
        : "Crea una tabella per l'entita forte usando l'identificatore interno selezionato come PK.",
    summary:
      subtypeGeneralizationSupport?.hasAppliedTablePerType === true
        ? `Tabella sottotipo "${entity.label}" fissata con PK derivata da "${subtypeGeneralizationSupport.supertype.label}"; identificatore locale ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)} tradotto come UNIQUE.`
        : `Tabella "${entity.label}" fissata con PK interna ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}.`,
    configuration: {
      keySourceType: "internal",
      keySourceId: identifier.id,
    },
    previewLines:
      subtypeGeneralizationSupport?.hasAppliedTablePerType === true
        ? [
            `Tabella: ${entity.label}`,
            `PK: derivata da ${subtypeGeneralizationSupport.supertype.label}`,
            `UNIQUE: ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}`,
          ]
        : [
            `Tabella: ${entity.label}`,
            `PK: ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}`,
          ],
    recommended: true,
  }));

  if (internalChoices.length > 0) {
    return internalChoices;
  }

  const externalChoices = (entity.externalIdentifiers ?? []).map((identifier) => ({
    id: `entity-external-${entity.id}-${identifier.id}`,
    targetType: "entity" as const,
    targetId: entity.id,
    step: "entities" as const,
    rule: "entity-table-external" as const,
    label:
      subtypeGeneralizationSupport?.hasAppliedTablePerType === true
        ? `Tabella sottotipo con PK derivata + UNIQUE esterna: ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}`
        : `Tabella con PK esterna: ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}`,
    description:
      subtypeGeneralizationSupport?.hasAppliedTablePerType === true
        ? `Con la gerarchia table-per-type gia fissata, la PK della tabella resta derivata dal supertipo "${subtypeGeneralizationSupport.supertype.label}" e l'identificatore esterno selezionato viene tradotto come vincolo UNIQUE alternativo.`
        : "Crea la tabella usando un identificatore esterno importato come base della PK.",
    summary:
      subtypeGeneralizationSupport?.hasAppliedTablePerType === true
        ? `Tabella sottotipo "${entity.label}" fissata con PK derivata da "${subtypeGeneralizationSupport.supertype.label}"; identificatore esterno ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)} tradotto come UNIQUE.`
        : `Tabella "${entity.label}" fissata con PK esterna ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}.`,
    configuration: {
      keySourceType: "external",
      keySourceId: identifier.id,
    },
    previewLines:
      subtypeGeneralizationSupport?.hasAppliedTablePerType === true
        ? [
            `Tabella: ${entity.label}`,
            `PK: derivata da ${subtypeGeneralizationSupport.supertype.label}`,
            `UNIQUE: ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}`,
          ]
        : [
            `Tabella: ${entity.label}`,
            `PK: ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}`,
          ],
    recommended: true,
  }));

  if (externalChoices.length > 0) {
    return externalChoices;
  }

  if (subtypeGeneralizationSupport) {
    const { supertype, hasAppliedTablePerType } = subtypeGeneralizationSupport;
    return [
      {
        id: `entity-no-key-${entity.id}`,
        targetType: "entity",
        targetId: entity.id,
        step: "entities",
        rule: "entity-table-without-key",
        label: hasAppliedTablePerType ? "Tabella sottotipo con PK derivata" : "Tabella sottotipo in attesa di gerarchia",
        description: hasAppliedTablePerType
          ? `Crea la tabella del sottotipo usando la PK derivata dal supertipo "${supertype.label}" tramite la gerarchia fissata.`
          : `Crea la tabella del sottotipo anche senza PK propria: la PK potra derivare dal supertipo "${supertype.label}" quando fisserai la generalizzazione.`,
        summary: hasAppliedTablePerType
          ? `Tabella sottotipo "${entity.label}" fissata con PK derivata da "${supertype.label}".`
          : `Tabella sottotipo "${entity.label}" creata senza PK propria; completa la generalizzazione con "${supertype.label}" per derivare la PK.`,
        configuration: {
          keySourceType: "none",
        },
        previewLines: [
          `Tabella: ${entity.label}`,
          hasAppliedTablePerType ? `PK: derivata da ${supertype.label}` : `PK: in attesa di derivazione da ${supertype.label}`,
        ],
        recommended: true,
      },
    ];
  }

  return [
    {
      id: `entity-no-key-${entity.id}`,
      targetType: "entity",
      targetId: entity.id,
      step: "entities",
      rule: "entity-table-without-key",
      label: "Tabella senza PK derivata",
      description: "Conferma la tabella anche se l'entita non ha un identificatore disponibile nel modello ER.",
      summary: `Tabella "${entity.label}" creata senza PK derivata.`,
      configuration: {
        keySourceType: "none",
      },
      previewLines: [`Tabella: ${entity.label}`, "PK: da definire manualmente"],
      recommended: true,
    },
  ];
}

function buildWeakEntityChoices(
  diagram: DiagramDocument,
  entity: EntityNode,
  ownership: AttributeOwnershipContext,
): TranslationChoiceRecord[] {
  const externalIdentifiers = entity.externalIdentifiers ?? [];
  if (externalIdentifiers.length === 0) {
    return [
      {
        id: `weak-missing-${entity.id}`,
        targetType: "weak-entity",
        targetId: entity.id,
        step: "weak-entities",
        rule: "weak-entity-table",
        label: "Tabella debole senza owner esplicito",
        description: "Crea la tabella debole, ma il modello non esplicita ancora un identificatore esterno owner-based.",
        summary: `Tabella debole "${entity.label}" creata senza owner esplicito; verifica la PK composta manualmente.`,
        configuration: {},
        previewLines: [`Tabella: ${entity.label}`, "Owner: non definito"],
      },
    ];
  }

  return externalIdentifiers.map((identifier) => {
    const sourceEntity = diagram.nodes.find(
      (node): node is EntityNode => node.id === identifier.sourceEntityId && node.type === "entity",
    );
    return {
      id: `weak-${entity.id}-${identifier.id}`,
      targetType: "weak-entity" as const,
      targetId: entity.id,
      step: "weak-entities" as const,
      rule: "weak-entity-table" as const,
      label: `Tabella debole con owner ${sourceEntity?.label ?? identifier.sourceEntityId}`,
      description: "Assorbe l'identificatore esterno nella tabella debole: FK dell'owner dentro la PK composta.",
      summary: `Tabella debole "${entity.label}" fissata con owner ${sourceEntity?.label ?? identifier.sourceEntityId}.`,
      configuration: {
        externalIdentifierId: identifier.id,
      },
      previewLines: [
        `Owner: ${sourceEntity?.label ?? identifier.sourceEntityId}`,
        `PK composta: ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}`,
      ],
      recommended: true,
    };
  });
}

function buildRelationshipChoices(
  relationship: RelationshipNode,
  participants: RelationshipParticipant[],
  relationshipAttributes: AttributeNode[],
): TranslationChoiceRecord[] {
  const relationshipKind = classifyBinaryRelationship(participants);

  if (participants.length !== 2 || relationshipKind === "many-to-many" || relationshipKind === "unknown") {
    return [
      {
        id: `relationship-table-${relationship.id}`,
        targetType: "relationship",
        targetId: relationship.id,
        step: "relationships",
        rule: "relationship-table",
        label: "Trasforma in tabella della relazione",
        description:
          participants.length !== 2
            ? "La relazione non e binaria: viene tradotta come tabella autonoma con FK verso tutti i partecipanti."
            : relationshipKind === "many-to-many"
              ? "La relazione N:M richiede una tabella associativa con PK composta dalle FK."
              : "Le cardinalita non bastano per assorbire la relazione come semplice FK, quindi serve una tabella dedicata.",
        summary: `Relazione "${relationship.label}" fissata come tabella autonoma.`,
        configuration: {
          strategy: "table",
        },
        previewLines: [
          `Tabella: ${relationship.label}`,
          `FK partecipanti: ${participants.map((participant) => participant.entity.label).join(", ") || "da definire"}`,
          relationshipAttributes.length > 0
            ? `Attributi relazione: ${relationshipAttributes.map((attribute) => attribute.label).join(", ")}`
            : "Attributi relazione: nessuno",
        ],
        recommended: true,
      },
    ];
  }

  if (relationshipKind === "one-to-many") {
    const oneToManyParticipants = resolveOneToManyParticipants(participants);
    if (!oneToManyParticipants) {
      return [
        {
          id: `relationship-table-${relationship.id}`,
          targetType: "relationship",
          targetId: relationship.id,
          step: "relationships",
          rule: "relationship-table",
          label: "Trasforma in tabella della relazione",
          description: "Le cardinalita non bastano per assorbire la relazione come semplice FK, quindi serve una tabella dedicata.",
          summary: `Relazione "${relationship.label}" fissata come tabella autonoma.`,
          configuration: {
            strategy: "table",
          },
          previewLines: [
            `Tabella: ${relationship.label}`,
            `FK partecipanti: ${participants.map((participant) => participant.entity.label).join(", ") || "da definire"}`,
            relationshipAttributes.length > 0
              ? `Attributi relazione: ${relationshipAttributes.map((attribute) => attribute.label).join(", ")}`
              : "Attributi relazione: nessuno",
          ],
          recommended: true,
        },
      ];
    }

    const { carrierParticipant, referencedParticipant } = oneToManyParticipants;

    const standardChoice: TranslationChoiceRecord = {
      id: `relationship-fk-${relationship.id}-${carrierParticipant.entity.id}`,
      targetType: "relationship",
      targetId: relationship.id,
      step: "relationships",
      rule: "relationship-foreign-key",
      label: `FK su ${carrierParticipant.entity.label}`,
      description: `Regola standard 1:N: la PK del lato 1 (${referencedParticipant.entity.label}) migra come FK nella tabella del lato N (${carrierParticipant.entity.label}).`,
      summary: `Relazione "${relationship.label}" assorbita come FK in "${carrierParticipant.entity.label}".`,
      configuration: {
        strategy: "foreign-key",
        carrierEntityId: carrierParticipant.entity.id,
        referencedEntityId: referencedParticipant.entity.id,
      },
      previewLines: [
        `Carrier FK: ${carrierParticipant.entity.label}`,
        `Referenced PK: ${referencedParticipant.entity.label}`,
        relationshipAttributes.length > 0
          ? `Attributi relazione migrati: ${relationshipAttributes.map((attribute) => attribute.label).join(", ")}`
          : "Attributi relazione: nessuno",
      ],
      recommended: true,
    };

    if (relationshipAttributes.length === 0) {
      return [standardChoice];
    }

    return [
      standardChoice,
      {
        id: `relationship-table-${relationship.id}`,
        targetType: "relationship",
        targetId: relationship.id,
        step: "relationships",
        rule: "relationship-table",
        label: "Mantieni una tabella propria",
        description: "Alternativa esplicita: la relazione resta una tabella autonoma con le due FK e gli attributi propri.",
        summary: `Relazione "${relationship.label}" trasformata in tabella autonoma.`,
        configuration: {
          strategy: "table",
        },
      },
    ];
  }

  const [left, right] = participants;
  return [
    {
      id: `relationship-fk-${relationship.id}-${left.entity.id}`,
      targetType: "relationship",
      targetId: relationship.id,
      step: "relationships",
      rule: "relationship-foreign-key",
      label: `FK su ${left.entity.label}`,
      description: `Relazione 1:1: migra la PK di "${right.entity.label}" come FK nella tabella "${left.entity.label}".`,
      summary: `Relazione "${relationship.label}" assorbita come FK in "${left.entity.label}".`,
      configuration: {
        strategy: "foreign-key",
        carrierEntityId: left.entity.id,
        referencedEntityId: right.entity.id,
      },
      recommended: left.cardinality.isTotal && !right.cardinality.isTotal,
    },
    {
      id: `relationship-fk-${relationship.id}-${right.entity.id}`,
      targetType: "relationship",
      targetId: relationship.id,
      step: "relationships",
      rule: "relationship-foreign-key",
      label: `FK su ${right.entity.label}`,
      description: `Relazione 1:1: migra la PK di "${left.entity.label}" come FK nella tabella "${right.entity.label}".`,
      summary: `Relazione "${relationship.label}" assorbita come FK in "${right.entity.label}".`,
      configuration: {
        strategy: "foreign-key",
        carrierEntityId: right.entity.id,
        referencedEntityId: left.entity.id,
      },
      recommended: right.cardinality.isTotal && !left.cardinality.isTotal,
    },
    {
      id: `relationship-table-${relationship.id}`,
      targetType: "relationship",
      targetId: relationship.id,
      step: "relationships",
      rule: "relationship-table",
      label: "Tabella autonoma della relazione",
      description: "Mantieni la relazione come tabella separata, utile quando vuoi esplicitare il legame 1:1 come oggetto proprio.",
      summary: `Relazione "${relationship.label}" trasformata in tabella autonoma.`,
      configuration: {
        strategy: "table",
      },
    },
  ];
}

function buildMultivaluedChoices(
  attribute: AttributeNode,
  owner: DiagramNode | undefined,
  ownership: AttributeOwnershipContext,
): TranslationChoiceRecord[] {
  const leafAttributes = getMultivaluedAttributeLeafAttributes(attribute.id, ownership);
  return [
    {
      id: `multivalued-${attribute.id}`,
      targetType: "attribute",
      targetId: attribute.id,
      step: "multivalued-attributes",
      rule: "multivalued-table",
      label: `Tabella ${owner?.label ?? "owner"}_${attribute.label}`,
      description: "Regola standard: l'attributo multivalore viene spostato in una tabella separata con FK verso l'owner.",
      summary: `Attributo multivalore "${attribute.label}" fissato come tabella autonoma.`,
      previewLines: [
        `Owner: ${owner?.label ?? "sconosciuto"}`,
        `Valori: ${leafAttributes.map((leaf) => leaf.label).join(", ")}`,
      ],
      recommended: true,
    },
  ];
}

function buildGeneralizationChoices(
  hierarchy: GeneralizationHierarchy,
): TranslationChoiceRecord[] {
  const hierarchyLabel = `${hierarchy.supertype.label} -> ${hierarchy.subtypes.map((subtype) => subtype.label).join(", ")}`;
  return [
    {
      id: `generalization-per-type-${hierarchy.id}`,
      targetType: "generalization",
      targetId: hierarchy.id,
      step: "generalizations",
      rule: "generalization-table-per-type",
      label: "Supertipo + tabelle sottotipi",
      description: "Mantiene una tabella del supertipo e una tabella per ogni sottotipo con PK = FK verso il supertipo.",
      summary: `Gerarchia "${hierarchyLabel}" fissata con strategia supertipo + sottotipi.`,
      configuration: {
        strategy: "table-per-type",
      },
      recommended: true,
    },
    {
      id: `generalization-subtypes-only-${hierarchy.id}`,
      targetType: "generalization",
      targetId: hierarchy.id,
      step: "generalizations",
      rule: "generalization-subtypes-only",
      label: "Solo tabelle per sottotipi",
      description: "Rimuove la tabella del supertipo e replica i suoi attributi nei sottotipi.",
      summary: `Gerarchia "${hierarchyLabel}" fissata con strategia solo sottotipi.`,
      configuration: {
        strategy: "subtypes-only",
      },
    },
    {
      id: `generalization-single-${hierarchy.id}`,
      targetType: "generalization",
      targetId: hierarchy.id,
      step: "generalizations",
      rule: "generalization-single-table",
      label: "Tabella unica con discriminatore",
      description: "Concentra supertipo e sottotipi in una singola tabella con attributi di tutta la gerarchia.",
      summary: `Gerarchia "${hierarchyLabel}" fissata con strategia tabella unica.`,
      configuration: {
        strategy: "single-table",
      },
    },
  ];
}

function createTranslationItemsByStep(
  diagram: DiagramDocument,
  state: LogicalTranslationState,
): TranslationOverview {
  const ownership = buildAttributeOwnershipContext(diagram);
  const absorbedExternalRelationshipIds = getAbsorbedExternalIdentifierRelationshipIds(diagram, state);
  const directSupertypesBySubtypeId = buildDirectSupertypesBySubtypeId(diagram);
  const choicesByKey = new Map<string, TranslationChoiceRecord>();
  const itemsByStep = {
    entities: [] as LogicalTranslationItem[],
    "weak-entities": [] as LogicalTranslationItem[],
    relationships: [] as LogicalTranslationItem[],
    "multivalued-attributes": [] as LogicalTranslationItem[],
    generalizations: [] as LogicalTranslationItem[],
    review: [] as LogicalTranslationItem[],
  };

  const conflictsByTargetKey = new Map<string, LogicalTranslationConflict[]>();
  state.conflicts.forEach((conflict) => {
    const key = `${conflict.targetType}:${conflict.targetId}`;
    const bucket = conflictsByTargetKey.get(key) ?? [];
    bucket.push(conflict);
    conflictsByTargetKey.set(key, bucket);
  });

  sortByLabel(
    diagram.nodes.filter((node): node is EntityNode => node.type === "entity" && node.isWeak !== true),
  ).forEach((entity) => {
    const choices = buildEntityChoices(diagram, entity, ownership, state, directSupertypesBySubtypeId);
    choices.forEach((choice) => choicesByKey.set(buildChoiceKey(choice.targetType, choice.targetId, choice.rule, choice.configuration), choice));
    const decision = getDecisionForTarget(state, "entity", entity.id);
    const conflictMessages = conflictsByTargetKey.get(`entity:${entity.id}`)?.map((conflict) => conflict.message) ?? [];
    itemsByStep.entities.push({
      id: entity.id,
      targetType: "entity",
      step: "entities",
      label: entity.label,
      description: "Entita forte da tradurre in tabella logica.",
      status: decision ? (conflictMessages.length > 0 || decision.status === "invalid" ? "invalid" : "applied") : "pending",
      currentDecisionId: decision?.id,
      currentSummary: decision?.summary,
      choiceIds: choices.map((choice) => choice.id),
      conflictMessages,
    });
  });

  sortByLabel(
    diagram.nodes.filter((node): node is EntityNode => node.type === "entity" && node.isWeak === true),
  ).forEach((entity) => {
    const choices = buildWeakEntityChoices(diagram, entity, ownership);
    choices.forEach((choice) => choicesByKey.set(buildChoiceKey(choice.targetType, choice.targetId, choice.rule, choice.configuration), choice));
    const decision = getDecisionForTarget(state, "weak-entity", entity.id);
    const conflictMessages = conflictsByTargetKey.get(`weak-entity:${entity.id}`)?.map((conflict) => conflict.message) ?? [];
    itemsByStep["weak-entities"].push({
      id: entity.id,
      targetType: "weak-entity",
      step: "weak-entities",
      label: entity.label,
      description: "Entita debole da assorbire con owner FK + discriminante.",
      status: decision ? (conflictMessages.length > 0 || decision.status === "invalid" ? "invalid" : "applied") : "pending",
      currentDecisionId: decision?.id,
      currentSummary: decision?.summary,
      choiceIds: choices.map((choice) => choice.id),
      conflictMessages,
    });
  });

  sortByLabel(
    diagram.nodes.filter(
      (node): node is RelationshipNode =>
        node.type === "relationship" && !absorbedExternalRelationshipIds.has(node.id),
    ),
  ).forEach((relationship) => {
    const participants = buildRelationshipParticipants(diagram, relationship);
    const choices = buildRelationshipChoices(relationship, participants, getRelationshipLeafAttributes(relationship.id, ownership));
    choices.forEach((choice) => choicesByKey.set(buildChoiceKey(choice.targetType, choice.targetId, choice.rule, choice.configuration), choice));
    const decision = getDecisionForTarget(state, "relationship", relationship.id);
    const conflictMessages = conflictsByTargetKey.get(`relationship:${relationship.id}`)?.map((conflict) => conflict.message) ?? [];
    itemsByStep.relationships.push({
      id: relationship.id,
      targetType: "relationship",
      step: "relationships",
      label: relationship.label,
      description: "Relazione da risolvere esplicitando se sparisce in FK o resta come tabella.",
      status: decision ? (conflictMessages.length > 0 || decision.status === "invalid" ? "invalid" : "applied") : "pending",
      currentDecisionId: decision?.id,
      currentSummary: decision?.summary,
      choiceIds: choices.map((choice) => choice.id),
      conflictMessages,
    });
  });

  getMultivaluedRootAttributes(diagram, ownership).forEach((attribute) => {
    const owner = getAttributeOwner(attribute.id, ownership);
    const choices = buildMultivaluedChoices(attribute, owner, ownership);
    choices.forEach((choice) => choicesByKey.set(buildChoiceKey(choice.targetType, choice.targetId, choice.rule, choice.configuration), choice));
    const decision = getDecisionForTarget(state, "attribute", attribute.id);
    const conflictMessages = conflictsByTargetKey.get(`attribute:${attribute.id}`)?.map((conflict) => conflict.message) ?? [];
    itemsByStep["multivalued-attributes"].push({
      id: attribute.id,
      targetType: "attribute",
      step: "multivalued-attributes",
      label: attribute.label,
      description: `Attributo multivalore di ${owner?.label ?? "owner"} da trasformare in tabella separata.`,
      status: decision ? (conflictMessages.length > 0 || decision.status === "invalid" ? "invalid" : "applied") : "pending",
      currentDecisionId: decision?.id,
      currentSummary: decision?.summary,
      choiceIds: choices.map((choice) => choice.id),
      conflictMessages,
    });
  });

  return {
    itemsByStep,
    choicesByKey,
  };
}

function createMappingContext(diagram: DiagramDocument): MappingContext {
  return {
    diagram,
    tables: [],
    foreignKeys: [],
    uniqueConstraints: [],
    edges: [],
    issues: [],
    tableById: new Map<string, LogicalTable>(),
    entityTableByEntityId: new Map<string, string>(),
    usedTableNames: new Set<string>(),
    usedColumnNamesByTable: new Map<string, Set<string>>(),
    usedFkNames: new Set<string>(),
    uniqueConstraintSequence: 1,
    tableSequence: 1,
    columnSequence: 1,
    fkSequence: 1,
    edgeSequence: 1,
    issueSequence: 1,
  };
}

function canonicalKey(value: string): string {
  return normalizeSpaces(value).toLowerCase();
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
  options: TableCreationOptions,
): LogicalTable {
  const unique = allocateUniqueName(context.usedTableNames, normalizeTableName(options.name));
  const table: LogicalTable = {
    id: `table-${context.tableSequence++}`,
    name: unique.value,
    kind: options.kind,
    sourceEntityId: options.sourceEntityId,
    sourceRelationshipId: options.sourceRelationshipId,
    sourceAttributeId: options.sourceAttributeId,
    generatedByDecisionId: options.decisionId,
    originLabel: options.originLabel,
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
      `Collisione nome tabella "${options.name}". Rinominata in "${table.name}".`,
      "warning",
      {
        tableId: table.id,
        relationshipId: options.sourceRelationshipId,
      },
    );
  }

  return table;
}

function addColumn(
  context: MappingContext,
  tableId: string,
  options: ColumnCreationOptions,
): LogicalColumn {
  const table = context.tableById.get(tableId);
  if (!table) {
    throw new Error(`Tabella logica non trovata: ${tableId}`);
  }

  const used = context.usedColumnNamesByTable.get(tableId) as Set<string>;
  const unique = allocateUniqueName(used, normalizeSpaces(options.baseName) || "Colonna");
  const column: LogicalColumn = {
    id: `column-${context.columnSequence++}`,
    name: unique.value,
    sourceAttributeId: options.sourceAttributeId,
    sourceRelationshipId: options.sourceRelationshipId,
    generatedByDecisionId: options.decisionId,
    originLabel: options.originLabel,
    isPrimaryKey: options.isPrimaryKey,
    isForeignKey: options.isForeignKey,
    isUnique: options.isUnique,
    isNullable: options.isNullable,
    isGenerated: options.isGenerated,
    references: [],
  };

  table.columns.push(column);

  if (unique.collided) {
    pushIssue(
      context,
      "COLUMN_NAME_COLLISION",
      `Collisione nome colonna nella tabella "${table.name}". Rinominata in "${column.name}".`,
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

function getPrimaryKeyColumns(table: LogicalTable): LogicalColumn[] {
  return table.columns.filter((column) => column.isPrimaryKey);
}

function getColumnsBySourceAttributeIds(
  table: LogicalTable,
  sourceAttributeIds: string[],
): LogicalColumn[] {
  const pending = new Set(sourceAttributeIds);
  const matches: LogicalColumn[] = [];

  table.columns.forEach((column) => {
    if (!column.sourceAttributeId || !pending.has(column.sourceAttributeId)) {
      return;
    }

    matches.push(column);
    pending.delete(column.sourceAttributeId);
  });

  return matches;
}

function markColumnsNotNull(table: LogicalTable, columnIds: Iterable<string>): void {
  const targetIds = new Set(columnIds);
  if (targetIds.size === 0) {
    return;
  }

  table.columns.forEach((column) => {
    if (targetIds.has(column.id)) {
      column.isNullable = false;
    }
  });
}

function applyPrimaryKeyToTable(
  table: LogicalTable,
  primaryKeyColumnIds: Iterable<string>,
): void {
  const targetIds = new Set(primaryKeyColumnIds);
  table.columns.forEach((column) => {
    column.isPrimaryKey = targetIds.has(column.id);
    if (column.isPrimaryKey) {
      column.isNullable = false;
    }
  });
}

function buildColumnSetSignature(columnIds: Iterable<string>): string {
  return [...new Set(columnIds)].sort((left, right) => left.localeCompare(right)).join("|");
}

function addUniqueConstraint(
  context: MappingContext,
  tableId: string,
  columnIds: string[],
  options: {
    decisionId: string;
    originLabel?: string;
  },
): LogicalUniqueConstraint | null {
  const table = context.tableById.get(tableId);
  if (!table) {
    throw new Error(`Tabella logica non trovata: ${tableId}`);
  }

  const uniqueColumnIds = [...new Set(columnIds)].filter((columnId) => table.columns.some((column) => column.id === columnId));
  if (uniqueColumnIds.length === 0) {
    return null;
  }

  const signature = buildColumnSetSignature(uniqueColumnIds);
  const existing = context.uniqueConstraints.find(
    (constraint) => constraint.tableId === tableId && buildColumnSetSignature(constraint.columnIds) === signature,
  );
  if (existing) {
    return existing;
  }

  table.columns.forEach((column) => {
    if (uniqueColumnIds.includes(column.id)) {
      column.isUnique = true;
      column.isNullable = false;
    }
  });

  const constraint: LogicalUniqueConstraint = {
    id: `unique-${context.uniqueConstraintSequence++}`,
    tableId,
    columnIds: uniqueColumnIds,
    generatedByDecisionId: options.decisionId,
    originLabel: options.originLabel,
  };

  context.uniqueConstraints.push(constraint);
  return constraint;
}

function refreshUniqueFlagsForTable(
  context: MappingContext,
  tableId: string,
): void {
  const table = context.tableById.get(tableId);
  if (!table) {
    return;
  }

  const constrainedColumnIds = new Set(
    context.uniqueConstraints
      .filter((constraint) => constraint.tableId === tableId)
      .flatMap((constraint) => constraint.columnIds),
  );

  table.columns.forEach((column) => {
    column.isUnique = constrainedColumnIds.has(column.id);
  });
}

function buildForeignKeyColumnBase(
  targetTable: LogicalTable,
  targetColumn: LogicalColumn,
  targetKeyCount: number,
): string {
  const tableBase = normalizeSpaces(targetTable.name);
  const targetColumnBase = normalizeSpaces(targetColumn.name);
  if (targetKeyCount === 1) {
    return targetColumnBase.toLowerCase() === "id" ? `${tableBase}_id` : `${tableBase}_${targetColumnBase}`;
  }

  return `${tableBase}_${targetColumnBase}`;
}

function addForeignKey(
  context: MappingContext,
  options: ForeignKeyCreationOptions,
): LogicalForeignKey | null {
  const fromTable = context.tableById.get(options.fromTableId);
  const toTable = context.tableById.get(options.toTableId);
  if (!fromTable || !toTable) {
    return null;
  }

  const targetColumns = getPrimaryKeyColumns(toTable);
  if (targetColumns.length === 0) {
    pushIssue(
      context,
      "UNRESOLVED_TRANSFORMATION",
      `Impossibile creare FK ${fromTable.name} -> ${toTable.name}: la tabella destinazione non ha PK disponibile.`,
      "warning",
      {
        tableId: fromTable.id,
        relationshipId: options.sourceRelationshipId,
      },
    );
    return null;
  }

  const mappings: Array<{ fromColumnId: string; toColumnId: string }> = [];
  targetColumns.forEach((targetColumn) => {
    const created = addColumn(context, fromTable.id, {
      baseName: buildForeignKeyColumnBase(toTable, targetColumn, targetColumns.length),
      decisionId: options.decisionId,
      sourceRelationshipId: options.sourceRelationshipId,
      originLabel: `FK verso ${toTable.name}.${targetColumn.name}`,
      isPrimaryKey: options.includeInPrimaryKey === true,
      isForeignKey: true,
      isNullable: !options.required,
      isGenerated: true,
    });
    created.references.push({
      foreignKeyId: `fk-${context.fkSequence}`,
      targetTableId: toTable.id,
      targetColumnId: targetColumn.id,
    });
    mappings.push({
      fromColumnId: created.id,
      toColumnId: targetColumn.id,
    });
  });

  const uniqueName = allocateUniqueName(context.usedFkNames, `fk ${fromTable.name} -> ${toTable.name}`);
  const foreignKey: LogicalForeignKey = {
    id: `fk-${context.fkSequence++}`,
    name: uniqueName.value,
    fromTableId: fromTable.id,
    toTableId: toTable.id,
    mappings,
    sourceRelationshipId: options.sourceRelationshipId,
    generatedByDecisionId: options.decisionId,
    required: options.required,
    unique: options.unique,
  };

  context.foreignKeys.push(foreignKey);
  context.edges.push({
    id: `edge-${context.edgeSequence++}`,
    foreignKeyId: foreignKey.id,
    fromTableId: fromTable.id,
    toTableId: toTable.id,
    label: foreignKey.name,
  });
  return foreignKey;
}

function addOwnedLeafAttributes(
  context: MappingContext,
  tableId: string,
  attributes: AttributeNode[],
  options: {
    decisionId: string;
    primaryKeyAttributeIds?: Set<string>;
    nonNullableAttributeIds?: Set<string>;
    sourceRelationshipId?: string;
  },
) {
  attributes.forEach((attribute) => {
    addColumn(context, tableId, {
      baseName: attribute.label,
      decisionId: options.decisionId,
      sourceAttributeId: attribute.id,
      sourceRelationshipId: options.sourceRelationshipId,
      originLabel: attribute.label,
      isPrimaryKey: options.primaryKeyAttributeIds?.has(attribute.id) === true,
      isForeignKey: false,
      isNullable: options.nonNullableAttributeIds?.has(attribute.id) !== true,
    });
  });
}

function getStrongEntityMode(configuration: LogicalTranslationDecision["configuration"]): EntityDecisionConfiguration {
  return {
    keySourceType:
      configuration?.keySourceType === "internal" ||
      configuration?.keySourceType === "external" ||
      configuration?.keySourceType === "none"
        ? configuration.keySourceType
        : undefined,
    keySourceId: typeof configuration?.keySourceId === "string" ? configuration.keySourceId : undefined,
  };
}

function getWeakEntityMode(configuration: LogicalTranslationDecision["configuration"]): WeakEntityDecisionConfiguration {
  return {
    externalIdentifierId:
      typeof configuration?.externalIdentifierId === "string" ? configuration.externalIdentifierId : undefined,
  };
}

function getRelationshipMode(
  configuration: LogicalTranslationDecision["configuration"],
): RelationshipDecisionConfiguration {
  return {
    strategy:
      configuration?.strategy === "foreign-key" || configuration?.strategy === "table"
        ? configuration.strategy
        : undefined,
    carrierEntityId: typeof configuration?.carrierEntityId === "string" ? configuration.carrierEntityId : undefined,
    referencedEntityId:
      typeof configuration?.referencedEntityId === "string" ? configuration.referencedEntityId : undefined,
  };
}

function getGeneralizationMode(
  configuration: LogicalTranslationDecision["configuration"],
): GeneralizationDecisionConfiguration {
  return {
    strategy:
      configuration?.strategy === "table-per-type" ||
      configuration?.strategy === "subtypes-only" ||
      configuration?.strategy === "single-table"
        ? configuration.strategy
        : undefined,
  };
}

function findExternalIdentifierById(
  entity: EntityNode,
  identifierId: string | undefined,
): ExternalIdentifier | undefined {
  return typeof identifierId === "string"
    ? entity.externalIdentifiers?.find((identifier) => identifier.id === identifierId)
    : undefined;
}

function collectInternalIdentifierColumnIds(
  table: LogicalTable,
  identifier: InternalIdentifier | undefined,
  ownership: AttributeOwnershipContext,
): string[] {
  if (!identifier) {
    return [];
  }

  return getColumnsBySourceAttributeIds(
    table,
    expandAttributeIdsToLeafAttributes(identifier.attributeIds, ownership).map((attribute) => attribute.id),
  ).map((column) => column.id);
}

function collectExternalIdentifierColumnIds(
  context: MappingContext,
  table: LogicalTable,
  identifier: ExternalIdentifier | undefined,
  decisionId: string,
  ownership: AttributeOwnershipContext,
): string[] {
  if (!identifier) {
    return [];
  }

  const columnIds = new Set<string>();
  getColumnsBySourceAttributeIds(
    table,
    expandAttributeIdsToLeafAttributes(identifier.localAttributeIds, ownership).map((attribute) => attribute.id),
  ).forEach((column) => columnIds.add(column.id));

  const sourceTableId = context.entityTableByEntityId.get(identifier.sourceEntityId);
  if (!sourceTableId) {
    return [...columnIds];
  }

  table.columns
    .filter(
      (column) =>
        column.generatedByDecisionId === decisionId &&
        column.sourceRelationshipId === identifier.relationshipId &&
        column.references.some((reference) => reference.targetTableId === sourceTableId),
    )
    .forEach((column) => columnIds.add(column.id));

  return [...columnIds];
}

function collectAppliedTablePerTypePrimaryKeyColumnIds(
  context: MappingContext,
  entity: EntityNode,
  directSupertypesBySubtypeId: Map<string, EntityNode[]>,
  appliedTablePerTypeDecisionBySupertypeId: Map<string, LogicalTranslationDecision>,
): string[] {
  const tableId = context.entityTableByEntityId.get(entity.id);
  const table = tableId ? context.tableById.get(tableId) : undefined;
  if (!table) {
    return [];
  }

  const columnIds = new Set<string>();
  const directSupertypes = directSupertypesBySubtypeId.get(entity.id) ?? [];
  directSupertypes.forEach((supertype) => {
    const decision = appliedTablePerTypeDecisionBySupertypeId.get(supertype.id);
    const supertypeTableId = context.entityTableByEntityId.get(supertype.id);
    if (!decision || !supertypeTableId) {
      return;
    }

    table.columns
      .filter(
        (column) =>
          column.generatedByDecisionId === decision.id &&
          column.references.some((reference) => reference.targetTableId === supertypeTableId),
      )
      .forEach((column) => columnIds.add(column.id));
  });

  return [...columnIds];
}

function finalizeEntityKeys(
  context: MappingContext,
  diagram: DiagramDocument,
  ownership: AttributeOwnershipContext,
  validDecisions: LogicalTranslationDecision[],
  entityById: Map<string, EntityNode>,
  directSupertypesBySubtypeId: Map<string, EntityNode[]>,
  appliedTablePerTypeDecisionBySupertypeId: Map<string, LogicalTranslationDecision>,
): void {
  validDecisions
    .filter((decision) => decision.targetType === "entity" || decision.targetType === "weak-entity")
    .forEach((decision) => {
      const entity = entityById.get(decision.targetId);
      const tableId = entity ? context.entityTableByEntityId.get(entity.id) : undefined;
      const table = tableId ? context.tableById.get(tableId) : undefined;
      if (!entity || !table) {
        return;
      }

      context.uniqueConstraints = context.uniqueConstraints.filter(
        (constraint) => !(constraint.tableId === table.id && constraint.generatedByDecisionId === decision.id),
      );
      refreshUniqueFlagsForTable(context, table.id);

      const inheritedPrimaryKeyColumnIds = collectAppliedTablePerTypePrimaryKeyColumnIds(
        context,
        entity,
        directSupertypesBySubtypeId,
        appliedTablePerTypeDecisionBySupertypeId,
      );
      const hasInheritedPrimaryKey = inheritedPrimaryKeyColumnIds.length > 0;

      const primaryKeyColumnIds = hasInheritedPrimaryKey
        ? inheritedPrimaryKeyColumnIds
        : decision.rule === "entity-table-internal"
          ? collectInternalIdentifierColumnIds(
              table,
              entity.internalIdentifiers?.find((identifier) => identifier.id === getStrongEntityMode(decision.configuration).keySourceId),
              ownership,
            )
          : decision.rule === "entity-table-external" || decision.rule === "weak-entity-table"
            ? collectExternalIdentifierColumnIds(
                context,
                table,
                findExternalIdentifierById(
                  entity,
                  decision.rule === "entity-table-external"
                    ? getStrongEntityMode(decision.configuration).keySourceId
                    : getWeakEntityMode(decision.configuration).externalIdentifierId,
                ) ?? entity.externalIdentifiers?.[0],
                decision.id,
                ownership,
              )
            : [];

      applyPrimaryKeyToTable(table, primaryKeyColumnIds);

      const primaryKeySignature = buildColumnSetSignature(primaryKeyColumnIds);
      (entity.internalIdentifiers ?? []).forEach((identifier) => {
        const identifierColumnIds = collectInternalIdentifierColumnIds(table, identifier, ownership);
        if (identifierColumnIds.length === 0) {
          return;
        }

        markColumnsNotNull(table, identifierColumnIds);
        if (buildColumnSetSignature(identifierColumnIds) === primaryKeySignature) {
          return;
        }

        addUniqueConstraint(context, table.id, identifierColumnIds, {
          decisionId: decision.id,
          originLabel: `Identificatore alternativo ${describePrimaryKeyFromIdentifier(entity, identifier, ownership, diagram)}`,
        });
      });

      if (decision.rule === "entity-table-external" || decision.rule === "weak-entity-table") {
        const externalIdentifier =
          findExternalIdentifierById(
            entity,
            decision.rule === "entity-table-external"
              ? getStrongEntityMode(decision.configuration).keySourceId
              : getWeakEntityMode(decision.configuration).externalIdentifierId,
          ) ?? entity.externalIdentifiers?.[0];
        const externalIdentifierColumnIds = collectExternalIdentifierColumnIds(
          context,
          table,
          externalIdentifier,
          decision.id,
          ownership,
        );

        if (
          externalIdentifier &&
          externalIdentifierColumnIds.length > 0 &&
          buildColumnSetSignature(externalIdentifierColumnIds) !== primaryKeySignature
        ) {
          markColumnsNotNull(table, externalIdentifierColumnIds);
          addUniqueConstraint(context, table.id, externalIdentifierColumnIds, {
            decisionId: decision.id,
            originLabel: `Identificatore alternativo ${describePrimaryKeyFromIdentifier(entity, externalIdentifier, ownership, diagram)}`,
          });
        }
      }
    });
}

function buildSubtypeToSupertypeMap(
  diagram: DiagramDocument,
  decisions: LogicalTranslationDecision[],
): Map<string, string> {
  const hierarchyByTargetId = buildHierarchyDecisionLookup(diagram);
  const mapping = new Map<string, string>();
  decisions
    .filter(
      (decision) =>
        decision.status === "applied" &&
        decision.targetType === "generalization" &&
        decision.rule === "generalization-single-table",
    )
    .forEach((decision) => {
      const hierarchy = hierarchyByTargetId.get(decision.targetId);
      if (!hierarchy) {
        return;
      }

      hierarchy.subtypes.forEach((subtype) => mapping.set(subtype.id, hierarchy.supertype.id));
    });
  return mapping;
}

function sortGeneralizationDecisionsForExecution(
  diagram: DiagramDocument,
  decisions: LogicalTranslationDecision[],
): LogicalTranslationDecision[] {
  const directSupertypesBySubtypeId = buildDirectSupertypesBySubtypeId(diagram);
  const hierarchyByTargetId = buildHierarchyDecisionLookup(diagram);
  const decisionBySupertypeId = new Map(decisions.map((decision) => [decision.targetId, decision]));
  const pendingBySupertypeId = new Map(decisions.map((decision) => [decision.targetId, decision]));
  const ordered: LogicalTranslationDecision[] = [];

  const compareDecisions = (left: LogicalTranslationDecision, right: LogicalTranslationDecision): number => {
    const leftHierarchy = hierarchyByTargetId.get(left.targetId);
    const rightHierarchy = hierarchyByTargetId.get(right.targetId);
    const leftLabel = leftHierarchy?.supertype.label ?? left.targetId;
    const rightLabel = rightHierarchy?.supertype.label ?? right.targetId;
    const byLabel = leftLabel.localeCompare(rightLabel, "it", { sensitivity: "base" });
    if (byLabel !== 0) {
      return byLabel;
    }

    return left.targetId.localeCompare(right.targetId);
  };

  while (pendingBySupertypeId.size > 0) {
    const ready = [...pendingBySupertypeId.values()]
      .filter((decision) => {
        const hierarchy = hierarchyByTargetId.get(decision.targetId);
        const parentSupertypes = hierarchy ? directSupertypesBySubtypeId.get(hierarchy.supertype.id) ?? [] : [];
        return parentSupertypes.every((supertype) => !pendingBySupertypeId.has(supertype.id) || !decisionBySupertypeId.has(supertype.id));
      })
      .sort(compareDecisions);

    if (ready.length === 0) {
      return [...ordered, ...[...pendingBySupertypeId.values()].sort(compareDecisions)];
    }

    ready.forEach((decision) => {
      ordered.push(decision);
      pendingBySupertypeId.delete(decision.targetId);
    });
  }

  return ordered;
}

function buildLogicalSourceSignatureInternal(diagram: DiagramDocument): string {
  const nodes = [...diagram.nodes].sort((left, right) => left.id.localeCompare(right.id));
  const edges = [...diagram.edges].sort((left, right) => left.id.localeCompare(right.id));
  return JSON.stringify({
    meta: diagram.meta,
    nodes,
    edges,
  });
}

function buildModelFromDecisions(
  diagram: DiagramDocument,
  translation: LogicalTranslationState,
): LogicalModel {
  const context = createMappingContext(diagram);
  const ownership = buildAttributeOwnershipContext(diagram);
  const entityById = new Map(
    diagram.nodes.filter((node): node is EntityNode => node.type === "entity").map((node) => [node.id, node]),
  );
  const directSupertypesBySubtypeId = buildDirectSupertypesBySubtypeId(diagram);
  const generalizationByTargetId = buildHierarchyDecisionLookup(diagram);
  const validDecisions = translation.decisions.filter((decision) => decision.status === "applied");
  const generalizationDecisions = sortGeneralizationDecisionsForExecution(
    diagram,
    validDecisions.filter((decision) => decision.targetType === "generalization"),
  );
  const appliedTablePerTypeDecisionBySupertypeId = new Map(
    generalizationDecisions
      .filter((decision) => decision.rule === "generalization-table-per-type")
      .map((decision) => [generalizationByTargetId.get(decision.targetId)?.supertype.id ?? decision.targetId, decision] as const),
  );
  const processedTablePerTypeDecisionBySupertypeId = new Map<string, LogicalTranslationDecision>();
  const singleTableSubtypeToSupertype = buildSubtypeToSupertypeMap(diagram, validDecisions);
  const subtypeOnlySupertypeEntityIds = new Set(
    validDecisions
      .filter(
        (decision) =>
          decision.targetType === "generalization" && decision.rule === "generalization-subtypes-only",
      )
      .map((decision) => generalizationByTargetId.get(decision.targetId)?.supertype.id ?? decision.targetId),
  );

  validDecisions
    .filter(
      (decision) =>
        (decision.targetType === "entity" || decision.targetType === "weak-entity") &&
        !singleTableSubtypeToSupertype.has(decision.targetId) &&
        !subtypeOnlySupertypeEntityIds.has(decision.targetId),
    )
    .forEach((decision) => {
      const entity = entityById.get(decision.targetId);
      if (!entity) {
        return;
      }

      const table = createLogicalTable(context, {
        name: entity.label,
        kind: "entity",
        decisionId: decision.id,
        sourceEntityId: entity.id,
        originLabel: entity.label,
      });

      const entityLeaves = getEntityLeafAttributes(entity.id, ownership);
      const primaryKeyLeafIds = new Set<string>();
      const nonNullableLeafIds = new Set<string>();

      if (decision.rule === "entity-table-internal") {
        const mode = getStrongEntityMode(decision.configuration);
        const internalIdentifier = entity.internalIdentifiers?.find((identifier) => identifier.id === mode.keySourceId);
        expandAttributeIdsToLeafAttributes(internalIdentifier?.attributeIds ?? [], ownership).forEach((attribute) => {
          primaryKeyLeafIds.add(attribute.id);
          nonNullableLeafIds.add(attribute.id);
        });
      }

      if (decision.rule === "entity-table-external" || decision.rule === "weak-entity-table") {
        const externalIdentifierId =
          decision.rule === "entity-table-external"
            ? getStrongEntityMode(decision.configuration).keySourceId
            : getWeakEntityMode(decision.configuration).externalIdentifierId;
        const externalIdentifier =
          findExternalIdentifierById(entity, externalIdentifierId) ?? entity.externalIdentifiers?.[0];
        expandAttributeIdsToLeafAttributes(externalIdentifier?.localAttributeIds ?? [], ownership).forEach((attribute) => {
          primaryKeyLeafIds.add(attribute.id);
          nonNullableLeafIds.add(attribute.id);
        });
      }

      addOwnedLeafAttributes(context, table.id, entityLeaves, {
        decisionId: decision.id,
        primaryKeyAttributeIds: primaryKeyLeafIds,
        nonNullableAttributeIds: nonNullableLeafIds,
      });
      context.entityTableByEntityId.set(entity.id, table.id);
    });

  const entityTableByEntityId = context.entityTableByEntityId;

  for (const decision of generalizationDecisions) {
      const hierarchy = generalizationByTargetId.get(decision.targetId);
      if (!hierarchy) {
        continue;
      }

      const mode = getGeneralizationMode(decision.configuration);
      if (mode.strategy === "table-per-type") {
        const supertypeTableId = entityTableByEntityId.get(hierarchy.supertype.id);
        if (!supertypeTableId) {
          continue;
        }

        hierarchy.subtypes.forEach((subtype) => {
          const subtypeTableId = entityTableByEntityId.get(subtype.id);
          if (!subtypeTableId) {
            return;
          }

          addForeignKey(context, {
            decisionId: decision.id,
            fromTableId: subtypeTableId,
            toTableId: supertypeTableId,
            required: true,
            includeInPrimaryKey: true,
          });
        });
        processedTablePerTypeDecisionBySupertypeId.set(hierarchy.supertype.id, decision);
        finalizeEntityKeys(
          context,
          diagram,
          ownership,
          validDecisions,
          entityById,
          directSupertypesBySubtypeId,
          processedTablePerTypeDecisionBySupertypeId,
        );
        continue;
      }

      if (mode.strategy === "single-table") {
        const supertypeTableId = entityTableByEntityId.get(hierarchy.supertype.id);
        if (!supertypeTableId) {
          continue;
        }

        addColumn(context, supertypeTableId, {
          baseName: `${hierarchy.supertype.label}_tipo`,
          decisionId: decision.id,
          originLabel: "Discriminatore gerarchia",
          isPrimaryKey: false,
          isForeignKey: false,
          isNullable: hierarchy.completeness !== "total",
          isGenerated: true,
        });

        hierarchy.subtypes.forEach((subtype) => {
          addOwnedLeafAttributes(context, supertypeTableId, getEntityLeafAttributes(subtype.id, ownership), {
            decisionId: decision.id,
          });
        });
        continue;
      }

      if (mode.strategy === "subtypes-only") {
        const supertypeLeaves = getEntityLeafAttributes(hierarchy.supertype.id, ownership);
        hierarchy.subtypes.forEach((subtype) => {
          const subtypeTableId = entityTableByEntityId.get(subtype.id);
          if (!subtypeTableId) {
            return;
          }

          addOwnedLeafAttributes(context, subtypeTableId, supertypeLeaves, {
            decisionId: decision.id,
          });
        });
      }
    }

  validDecisions
    .filter((decision) => decision.rule === "entity-table-external" || decision.rule === "weak-entity-table")
    .forEach((decision) => {
      const entity = entityById.get(decision.targetId);
      const tableId = entity ? entityTableByEntityId.get(entity.id) : undefined;
      if (!entity || !tableId) {
        return;
      }

      const externalIdentifierId =
        decision.rule === "entity-table-external"
          ? getStrongEntityMode(decision.configuration).keySourceId
          : getWeakEntityMode(decision.configuration).externalIdentifierId;
      const externalIdentifier =
        findExternalIdentifierById(entity, externalIdentifierId) ?? entity.externalIdentifiers?.[0];
      if (!externalIdentifier) {
        pushIssue(
          context,
          "UNRESOLVED_TRANSFORMATION",
          `L'entita "${entity.label}" richiede un identificatore esterno valido.`,
          "warning",
          {
            tableId,
          },
        );
        return;
      }

      const sourceTableId = entityTableByEntityId.get(externalIdentifier.sourceEntityId);
      if (!sourceTableId) {
        pushIssue(
          context,
          "UNRESOLVED_TRANSFORMATION",
          `L'identificatore esterno di "${entity.label}" dipende da una sorgente non ancora trasformata.`,
          "warning",
          {
            tableId,
            relationshipId: externalIdentifier.relationshipId,
          },
        );
        return;
      }

      addForeignKey(context, {
        decisionId: decision.id,
        fromTableId: tableId,
        toTableId: sourceTableId,
        sourceRelationshipId: externalIdentifier.relationshipId,
        required: true,
        includeInPrimaryKey: true,
      });

      const relationshipAttributes = getRelationshipLeafAttributes(externalIdentifier.relationshipId, ownership);
      if (relationshipAttributes.length > 0) {
        addOwnedLeafAttributes(context, tableId, relationshipAttributes, {
          decisionId: decision.id,
          sourceRelationshipId: externalIdentifier.relationshipId,
        });
      }
    });

  finalizeEntityKeys(
    context,
    diagram,
    ownership,
    validDecisions,
    entityById,
    directSupertypesBySubtypeId,
    appliedTablePerTypeDecisionBySupertypeId,
  );

  validDecisions
    .filter((decision) => decision.rule === "relationship-foreign-key" || decision.rule === "relationship-table")
    .forEach((decision) => {
      const relationship = diagram.nodes.find(
        (node): node is RelationshipNode => node.id === decision.targetId && node.type === "relationship",
      );
      if (!relationship) {
        return;
      }

      const participants = buildRelationshipParticipants(diagram, relationship);
      const relationshipAttributes = getRelationshipLeafAttributes(relationship.id, ownership);
      const mode = getRelationshipMode(decision.configuration);

      if (mode.strategy === "table" || decision.rule === "relationship-table") {
        const table = createLogicalTable(context, {
          name: relationship.label,
          kind: participants.length === 2 ? "associative" : "relationship",
          decisionId: decision.id,
          sourceRelationshipId: relationship.id,
          originLabel: relationship.label,
        });

        participants.forEach((participant) => {
          const participantTableId = entityTableByEntityId.get(participant.entity.id);
          if (!participantTableId) {
            return;
          }

          addForeignKey(context, {
            decisionId: decision.id,
            fromTableId: table.id,
            toTableId: participantTableId,
            sourceRelationshipId: relationship.id,
            required: participant.cardinality.isTotal,
            includeInPrimaryKey: true,
          });
        });

        addOwnedLeafAttributes(context, table.id, relationshipAttributes, {
          decisionId: decision.id,
          sourceRelationshipId: relationship.id,
        });
        return;
      }

      const carrierTableId = mode.carrierEntityId ? entityTableByEntityId.get(mode.carrierEntityId) : undefined;
      const referencedTableId = mode.referencedEntityId ? entityTableByEntityId.get(mode.referencedEntityId) : undefined;
      if (!carrierTableId || !referencedTableId) {
        pushIssue(
          context,
          "UNRESOLVED_TRANSFORMATION",
          `La relazione "${relationship.label}" non puo ancora migrare come FK.`,
          "warning",
          {
            relationshipId: relationship.id,
          },
        );
        return;
      }

      const carrierParticipant = mode.carrierEntityId
        ? participants.find((participant) => participant.entity.id === mode.carrierEntityId)
        : undefined;

      addForeignKey(context, {
        decisionId: decision.id,
        fromTableId: carrierTableId,
        toTableId: referencedTableId,
        sourceRelationshipId: relationship.id,
        required: carrierParticipant?.cardinality.isTotal ?? true,
        unique: classifyBinaryRelationship(participants) === "one-to-one",
      });
      addOwnedLeafAttributes(context, carrierTableId, relationshipAttributes, {
        decisionId: decision.id,
        sourceRelationshipId: relationship.id,
      });
    });

  validDecisions
    .filter((decision) => decision.rule === "multivalued-table")
    .forEach((decision) => {
      const attribute = diagram.nodes.find(
        (node): node is AttributeNode => node.id === decision.targetId && node.type === "attribute",
      );
      if (!attribute) {
        return;
      }

      const owner = getAttributeOwner(attribute.id, ownership);
      if (!owner || owner.type !== "entity") {
        return;
      }

      const ownerTableId = entityTableByEntityId.get(owner.id);
      if (!ownerTableId) {
        pushIssue(
          context,
          "UNRESOLVED_TRANSFORMATION",
          `L'attributo multivalore "${attribute.label}" dipende da un owner non ancora trasformato.`,
          "warning",
        );
        return;
      }

      const table = createLogicalTable(context, {
        name: `${owner.label}_${attribute.label}`,
        kind: "relationship",
        decisionId: decision.id,
        sourceEntityId: owner.id,
        sourceAttributeId: attribute.id,
        originLabel: attribute.label,
      });
      addForeignKey(context, {
        decisionId: decision.id,
        fromTableId: table.id,
        toTableId: ownerTableId,
        required: true,
        includeInPrimaryKey: true,
      });
      const valueLeaves = getMultivaluedAttributeLeafAttributes(attribute.id, ownership);
      const pkLeafIds = new Set(valueLeaves.map((leaf) => leaf.id));
      addOwnedLeafAttributes(context, table.id, valueLeaves, {
        decisionId: decision.id,
        primaryKeyAttributeIds: pkLeafIds,
        nonNullableAttributeIds: pkLeafIds,
      });
    });

  return normalizeLogicalModelGeometry({
    meta: {
      name: `${normalizeTableName(diagram.meta.name)} (traduzione logica)`,
      generatedAt: nowIso(),
      sourceDiagramVersion: diagram.meta.version,
      sourceSignature: buildLogicalSourceSignatureInternal(diagram),
    },
    tables: context.tables,
    foreignKeys: context.foreignKeys,
    uniqueConstraints: context.uniqueConstraints,
    edges: context.edges,
    issues: context.issues,
  });
}

function buildTablePersistenceKey(table: LogicalTable): string {
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
    return `relationship:${table.kind}:${table.sourceRelationshipId}`;
  }

  return `name:${table.kind}:${normalizeSpaces(table.name).toLowerCase()}`;
}

function buildColumnReferenceSignature(column: LogicalColumn): string {
  if (column.references.length === 0) {
    return "";
  }

  return column.references
    .map((reference) => `${reference.targetTableId}:${reference.targetColumnId}`)
    .sort((left, right) => left.localeCompare(right))
    .join(",");
}

function buildColumnPersistenceKeys(
  tablePersistenceKey: string,
  column: LogicalColumn,
  index: number,
): string[] {
  const keys: string[] = [];
  keys.push(`${tablePersistenceKey}|id:${column.id}`);

  if (column.sourceAttributeId) {
    keys.push(`${tablePersistenceKey}|attribute:${column.sourceAttributeId}`);
  }

  if (column.generatedByDecisionId) {
    keys.push(`${tablePersistenceKey}|decision:${column.generatedByDecisionId}`);
  }

  if (column.sourceRelationshipId) {
    keys.push(`${tablePersistenceKey}|relationship:${column.sourceRelationshipId}`);
  }

  const referenceSignature = buildColumnReferenceSignature(column);
  if (referenceSignature) {
    keys.push(`${tablePersistenceKey}|reference:${referenceSignature}`);
  }

  if (column.originLabel) {
    keys.push(`${tablePersistenceKey}|origin:${normalizeSpaces(column.originLabel).toLowerCase()}`);
  }

  const normalizedName = normalizeSpaces(column.name).toLowerCase();
  keys.push(`${tablePersistenceKey}|index:${index}|name:${normalizedName}`);
  keys.push(`${tablePersistenceKey}|name:${normalizedName}`);

  return [...new Set(keys)];
}

function mergeColumnSqlMetadataFromPrevious(
  nextModel: LogicalModel,
  previousModel?: LogicalModel,
): LogicalModel {
  if (!previousModel) {
    return nextModel;
  }

  const previousColumnsByKey = new Map<string, LogicalColumn[]>();
  previousModel.tables.forEach((table) => {
    const tablePersistenceKey = buildTablePersistenceKey(table);
    table.columns.forEach((column, index) => {
      buildColumnPersistenceKeys(tablePersistenceKey, column, index).forEach((key) => {
        const bucket = previousColumnsByKey.get(key) ?? [];
        bucket.push(column);
        previousColumnsByKey.set(key, bucket);
      });
    });
  });

  const consumedPreviousColumnIds = new Set<string>();

  return {
    ...nextModel,
    tables: nextModel.tables.map((table) => {
      const tablePersistenceKey = buildTablePersistenceKey(table);
      return {
        ...table,
        columns: table.columns.map((column, index) => {
          const keys = buildColumnPersistenceKeys(tablePersistenceKey, column, index);
          let matched: LogicalColumn | undefined;

          for (const key of keys) {
            const candidate = previousColumnsByKey
              .get(key)
              ?.find((previousColumn) => !consumedPreviousColumnIds.has(previousColumn.id));
            if (candidate) {
              matched = candidate;
              consumedPreviousColumnIds.add(candidate.id);
              break;
            }
          }

          if (!matched) {
            return column;
          }

          return {
            ...column,
            dataType: matched.dataType ?? column.dataType,
            defaultValue: matched.defaultValue ?? null,
            length: matched.length ?? null,
            precision: matched.precision ?? null,
            scale: matched.scale ?? null,
            isNullable: matched.isPrimaryKey ? false : matched.isNullable,
            isUnique: matched.isUnique,
          };
        }),
      };
    }),
  };
}

function getSourceNodeForTable(
  table: LogicalTable,
  nodeById: Map<string, DiagramNode>,
): DiagramNode | undefined {
  if (table.sourceAttributeId) {
    return nodeById.get(table.sourceAttributeId);
  }

  if (table.sourceRelationshipId) {
    return nodeById.get(table.sourceRelationshipId);
  }

  if (table.sourceEntityId) {
    return nodeById.get(table.sourceEntityId);
  }

  return undefined;
}

function alignTableToSource(table: LogicalTable, sourceNode: DiagramNode): LogicalTable {
  return {
    ...table,
    x: Math.round(sourceNode.x + (sourceNode.width - table.width) / 2),
    y: Math.round(sourceNode.y + (sourceNode.height - table.height) / 2),
  };
}

function positionLogicalModelInPlace(
  diagram: DiagramDocument,
  nextModel: LogicalModel,
  previousModel?: LogicalModel,
): LogicalModel {
  const previousByKey = new Map<string, LogicalTable>();
  previousModel?.tables.forEach((table) => {
    previousByKey.set(buildTablePersistenceKey(table), table);
  });

  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));

  return {
    ...nextModel,
    tables: nextModel.tables.map((table) => {
      const previous = previousByKey.get(buildTablePersistenceKey(table));
      if (previous) {
        return {
          ...table,
          x: previous.x,
          y: previous.y,
        };
      }

      const sourceNode = getSourceNodeForTable(table, nodeById);
      return sourceNode ? alignTableToSource(table, sourceNode) : table;
    }),
  };
}

function collectTargetKeysFromColumns(columns: LogicalTransformationColumn[]): string[] {
  return Array.from(
    new Set(columns.flatMap((column) => column.relatedTargetKeys)),
  );
}

function createTransformationColumns(
  table: LogicalTable,
  decisionTargetKeyById: Map<string, string>,
): LogicalTransformationColumn[] {
  return table.columns.map((column) => ({
    id: column.id,
    name: column.name,
    isPrimaryKey: column.isPrimaryKey,
    isForeignKey: column.isForeignKey,
    isUnique: column.isUnique === true,
    isNullable: column.isNullable,
    dataType: column.dataType,
    defaultValue: column.defaultValue ?? null,
    length: column.length ?? null,
    precision: column.precision ?? null,
    scale: column.scale ?? null,
    generatedByDecisionId: column.generatedByDecisionId,
    references: column.references,
    relatedTargetKeys:
      column.generatedByDecisionId && decisionTargetKeyById.has(column.generatedByDecisionId)
        ? [decisionTargetKeyById.get(column.generatedByDecisionId) as string]
        : [],
  }));
}

function addTargetKeyEntry(
  bucketById: Map<string, Set<string>>,
  id: string,
  targetKey: string,
): void {
  const bucket = bucketById.get(id) ?? new Set<string>();
  bucket.add(targetKey);
  bucketById.set(id, bucket);
}

function buildTransformationGraph(
  diagram: DiagramDocument,
  translation: LogicalTranslationState,
  model: LogicalModel,
): LogicalTransformationState {
  const ownership = buildAttributeOwnershipContext(diagram);
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const decisionTargetKeyById = getDecisionTargetKeyMap(translation);
  const absorbedExternalRelationshipIds = getAbsorbedExternalIdentifierRelationshipIds(diagram, translation);
  const tableBySourceEntityId = new Map(
    model.tables
      .filter((table) => typeof table.sourceEntityId === "string")
      .map((table) => [table.sourceEntityId as string, table]),
  );
  const tableBySourceRelationshipId = new Map(
    model.tables
      .filter((table) => typeof table.sourceRelationshipId === "string")
      .map((table) => [table.sourceRelationshipId as string, table]),
  );
  const transformedRelationshipIds = new Set<string>();
  const tableBySourceAttributeId = new Map(
    model.tables
      .filter((table) => typeof table.sourceAttributeId === "string")
      .map((table) => [table.sourceAttributeId as string, table]),
  );
  const extraTableTargetKeys = new Map<string, Set<string>>();
  const hiddenSourceNodeIds = new Set<string>();
  const representativeNodeIdBySourceId = new Map<string, string>();
  const tableNodes: LogicalTransformationNode[] = [];

  model.tables.forEach((table) => {
    const columns = createTransformationColumns(table, decisionTargetKeyById);
    const relatedTargetKeys = new Set<string>(collectTargetKeysFromColumns(columns));
    if (table.generatedByDecisionId && decisionTargetKeyById.has(table.generatedByDecisionId)) {
      relatedTargetKeys.add(decisionTargetKeyById.get(table.generatedByDecisionId) as string);
    }

    tableNodes.push({
      id: table.id,
      kind: "logical-table",
      renderType: "table",
      label: table.name,
      x: table.x,
      y: table.y,
      width: table.width,
      height: table.height,
      status: "transformed",
      sourceNodeId: table.sourceAttributeId ?? table.sourceRelationshipId ?? table.sourceEntityId,
      sourceNodeType:
        table.sourceAttributeId != null
          ? "attribute"
          : table.sourceRelationshipId != null
            ? "relationship"
            : table.sourceEntityId != null
              ? "entity"
              : undefined,
      tableId: table.id,
      generatedByDecisionIds: table.generatedByDecisionId ? [table.generatedByDecisionId] : [],
      relatedTargetKeys: [...relatedTargetKeys],
      columns,
    });

    if (table.sourceEntityId) {
      hiddenSourceNodeIds.add(table.sourceEntityId);
      representativeNodeIdBySourceId.set(table.sourceEntityId, table.id);
    }

    if (table.sourceRelationshipId) {
      hiddenSourceNodeIds.add(table.sourceRelationshipId);
      representativeNodeIdBySourceId.set(table.sourceRelationshipId, table.id);
      transformedRelationshipIds.add(table.sourceRelationshipId);
    }

    if (table.sourceAttributeId) {
      collectAttributeSubtreeIds(table.sourceAttributeId, ownership).forEach((attributeId) => {
        hiddenSourceNodeIds.add(attributeId);
      });
      representativeNodeIdBySourceId.set(table.sourceAttributeId, table.id);
    }
  });

  model.tables.forEach((table) => {
    if (!table.sourceEntityId) {
      return;
    }

    getDirectOwnedAttributes(table.sourceEntityId, ownership).forEach((attribute) => {
      if (isAttributeUnderMultivaluedRoot(attribute.id, ownership)) {
        return;
      }

      collectAttributeSubtreeIds(attribute.id, ownership).forEach((attributeId) => {
        hiddenSourceNodeIds.add(attributeId);
      });
    });
  });

  model.edges.forEach((edge) => {
    const foreignKey = model.foreignKeys.find((candidate) => candidate.id === edge.foreignKeyId);
    if (!foreignKey?.sourceRelationshipId) {
      return;
    }

    getDirectOwnedAttributes(foreignKey.sourceRelationshipId, ownership).forEach((attribute) => {
      collectAttributeSubtreeIds(attribute.id, ownership).forEach((attributeId) => hiddenSourceNodeIds.add(attributeId));
    });
  });

  model.foreignKeys.forEach((foreignKey) => {
    if (!foreignKey.sourceRelationshipId) {
      return;
    }

    hiddenSourceNodeIds.add(foreignKey.sourceRelationshipId);
    representativeNodeIdBySourceId.set(foreignKey.sourceRelationshipId, foreignKey.fromTableId);
    transformedRelationshipIds.add(foreignKey.sourceRelationshipId);
  });

  absorbedExternalRelationshipIds.forEach((relationshipId) => {
    hiddenSourceNodeIds.add(relationshipId);
    getDirectOwnedAttributes(relationshipId, ownership).forEach((attribute) => {
      collectAttributeSubtreeIds(attribute.id, ownership).forEach((attributeId) => hiddenSourceNodeIds.add(attributeId));
    });
  });

  const hierarchyByTargetId = buildHierarchyDecisionLookup(diagram);
  translation.decisions
    .filter((decision) => decision.status === "applied" && decision.targetType === "generalization")
    .forEach((decision) => {
      const hierarchy = hierarchyByTargetId.get(decision.targetId);
      if (!hierarchy) {
        return;
      }

      const targetKey = buildTargetKey("generalization", decision.targetId);
      if (decision.rule === "generalization-table-per-type") {
        const supertypeTable = tableBySourceEntityId.get(hierarchy.supertype.id);
        if (supertypeTable) {
          addTargetKeyEntry(extraTableTargetKeys, supertypeTable.id, targetKey);
        }
        hierarchy.subtypes.forEach((subtype) => {
          const subtypeTable = tableBySourceEntityId.get(subtype.id);
          if (subtypeTable) {
            addTargetKeyEntry(extraTableTargetKeys, subtypeTable.id, targetKey);
          }
        });
        return;
      }

      if (decision.rule === "generalization-single-table") {
        const supertypeTable = tableBySourceEntityId.get(hierarchy.supertype.id);
        if (supertypeTable) {
          addTargetKeyEntry(extraTableTargetKeys, supertypeTable.id, targetKey);
        }
        hierarchy.subtypes.forEach((subtype) => {
          hiddenSourceNodeIds.add(subtype.id);
          getDirectOwnedAttributes(subtype.id, ownership).forEach((attribute) => {
            collectAttributeSubtreeIds(attribute.id, ownership).forEach((attributeId) => hiddenSourceNodeIds.add(attributeId));
          });
          if (supertypeTable) {
            representativeNodeIdBySourceId.set(subtype.id, supertypeTable.id);
          }
        });
        return;
      }

      if (decision.rule === "generalization-subtypes-only") {
        hiddenSourceNodeIds.add(hierarchy.supertype.id);
        getDirectOwnedAttributes(hierarchy.supertype.id, ownership).forEach((attribute) => {
          collectAttributeSubtreeIds(attribute.id, ownership).forEach((attributeId) => hiddenSourceNodeIds.add(attributeId));
        });
        hierarchy.subtypes.forEach((subtype) => {
          const subtypeTable = tableBySourceEntityId.get(subtype.id);
          if (subtypeTable) {
            addTargetKeyEntry(extraTableTargetKeys, subtypeTable.id, targetKey);
          }
        });
      }
    });

  const transformationNodes = tableNodes.map((node) => {
    const extraKeys = extraTableTargetKeys.get(node.id);
    if (!extraKeys || extraKeys.size === 0) {
      return node;
    }

    const relatedTargetKeys = Array.from(new Set([...node.relatedTargetKeys, ...extraKeys]));
    return {
      ...node,
      relatedTargetKeys,
    };
  });

  diagram.nodes.forEach((node) => {
    if (hiddenSourceNodeIds.has(node.id)) {
      return;
    }

    let renderType: LogicalTransformationNode["renderType"];
    let relatedTargetKeys: string[] = [];
    let status: LogicalTransformationElementStatus = "unresolved";

    if (node.type === "entity") {
      renderType = node.isWeak === true ? "weak-entity" : "entity";
      relatedTargetKeys = [buildTargetKey(node.isWeak === true ? "weak-entity" : "entity", node.id)];
      status = getTransformationStatus(translation, node.isWeak === true ? "weak-entity" : "entity", node.id);
    } else if (node.type === "relationship") {
      renderType = "relationship";
      relatedTargetKeys = [buildTargetKey("relationship", node.id)];
      status = getTransformationStatus(translation, "relationship", node.id);
    } else {
      const rootAttribute = getAttributeRoot(node.id, ownership);
      if (rootAttribute?.isMultivalued === true) {
        renderType = rootAttribute.id === node.id ? "multivalued-attribute" : "attribute";
        relatedTargetKeys = [buildTargetKey("attribute", rootAttribute.id)];
        status = getTransformationStatus(translation, "attribute", rootAttribute.id);
      } else {
        renderType = "attribute";
        const owner = getAttributeOwner(node.id, ownership);
        if (owner?.type === "entity") {
          const targetType = owner.isWeak === true ? "weak-entity" : "entity";
          relatedTargetKeys = [buildTargetKey(targetType, owner.id)];
          status = getTransformationStatus(translation, targetType, owner.id);
        } else if (owner?.type === "relationship") {
          relatedTargetKeys = [buildTargetKey("relationship", owner.id)];
          status = getTransformationStatus(translation, "relationship", owner.id);
        }
      }
    }

    transformationNodes.push({
      id: node.id,
      kind: "er-node",
      renderType,
      label: node.label,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      status,
      sourceNodeId: node.id,
      sourceNodeType: node.type,
      generatedByDecisionIds: [],
      relatedTargetKeys,
    });
  });

  function resolveRenderedNodeId(sourceNodeId: string): string | null {
    if (!hiddenSourceNodeIds.has(sourceNodeId)) {
      return sourceNodeId;
    }

    return representativeNodeIdBySourceId.get(sourceNodeId) ?? null;
  }

  const transformationEdges: LogicalTransformationEdge[] = [];

  model.edges.forEach((edge) => {
    const foreignKey = model.foreignKeys.find((candidate) => candidate.id === edge.foreignKeyId);
    const relatedTargetKeys =
      foreignKey?.generatedByDecisionId && decisionTargetKeyById.has(foreignKey.generatedByDecisionId)
        ? [decisionTargetKeyById.get(foreignKey.generatedByDecisionId) as string]
        : [];

    transformationEdges.push({
      id: edge.id,
      kind: "foreign-key",
      renderType: "foreign-key",
      sourceId: edge.fromTableId,
      targetId: edge.toTableId,
      label: edge.label,
      status: "transformed",
      foreignKeyId: edge.foreignKeyId,
      generatedByDecisionIds: foreignKey?.generatedByDecisionId ? [foreignKey.generatedByDecisionId] : [],
      relatedTargetKeys,
    });
  });

  diagram.edges.forEach((edge) => {
    if (edge.type === "inheritance") {
      const status = getTransformationStatus(translation, "generalization", edge.targetId);
      if (status === "transformed") {
        return;
      }

      const sourceId = resolveRenderedNodeId(edge.sourceId);
      const targetId = resolveRenderedNodeId(edge.targetId);
      if (!sourceId || !targetId) {
        return;
      }

      transformationEdges.push({
        id: edge.id,
        kind: "er-edge",
        renderType: "inheritance",
        sourceId,
        targetId,
        label: edge.label,
        status,
        sourceEdgeId: edge.id,
        sourceEdgeType: edge.type,
        lineStyle: edge.lineStyle,
        manualOffset: edge.manualOffset,
        isaDisjointness: edge.isaDisjointness,
        isaCompleteness: edge.isaCompleteness,
        generatedByDecisionIds: [],
        relatedTargetKeys: [buildTargetKey("generalization", edge.targetId)],
      });
      return;
    }

    if (edge.type === "connector") {
      const relationshipId =
        nodeById.get(edge.sourceId)?.type === "relationship"
          ? edge.sourceId
          : nodeById.get(edge.targetId)?.type === "relationship"
            ? edge.targetId
            : null;
      if (!relationshipId || absorbedExternalRelationshipIds.has(relationshipId)) {
        return;
      }

      if (transformedRelationshipIds.has(relationshipId)) {
        return;
      }

      const status = getTransformationStatus(translation, "relationship", relationshipId);

      const sourceId = resolveRenderedNodeId(edge.sourceId);
      const targetId = resolveRenderedNodeId(edge.targetId);
      if (!sourceId || !targetId) {
        return;
      }

      transformationEdges.push({
        id: edge.id,
        kind: "er-edge",
        renderType: "connector",
        sourceId,
        targetId,
        label: edge.label,
        status,
        sourceEdgeId: edge.id,
        sourceEdgeType: edge.type,
        lineStyle: edge.lineStyle,
        manualOffset: edge.manualOffset,
        cardinalityLabel: getEdgeCardinalityLabel(edge, nodeById.get(edge.sourceId), nodeById.get(edge.targetId)),
        generatedByDecisionIds: [],
        relatedTargetKeys: [buildTargetKey("relationship", relationshipId)],
      });
      return;
    }

    const sourceNode = nodeById.get(edge.sourceId);
    const targetNode = nodeById.get(edge.targetId);
    const attributeNode =
      sourceNode?.type === "attribute"
        ? sourceNode
        : targetNode?.type === "attribute"
          ? targetNode
          : undefined;
    if (!attributeNode || hiddenSourceNodeIds.has(attributeNode.id)) {
      return;
    }

    const rootAttribute = getAttributeRoot(attributeNode.id, ownership);
    const isMultivalued = rootAttribute?.isMultivalued === true;
    const relatedTargetKeys = isMultivalued
      ? [buildTargetKey("attribute", rootAttribute?.id ?? attributeNode.id)]
      : (() => {
          const owner = getAttributeOwner(attributeNode.id, ownership);
          if (owner?.type === "entity") {
            return [buildTargetKey(owner.isWeak === true ? "weak-entity" : "entity", owner.id)];
          }

          if (owner?.type === "relationship") {
            return [buildTargetKey("relationship", owner.id)];
          }

          return [] as string[];
        })();

    const status = isMultivalued
      ? getTransformationStatus(translation, "attribute", rootAttribute?.id ?? attributeNode.id)
      : relatedTargetKeys[0]
        ? getTransformationStatus(
            translation,
            relatedTargetKeys[0].split(":")[0] as LogicalTranslationDecision["targetType"],
            relatedTargetKeys[0].split(":")[1] as string,
          )
        : "unresolved";

    const sourceId = resolveRenderedNodeId(edge.sourceId);
    const targetId = resolveRenderedNodeId(edge.targetId);
    if (!sourceId || !targetId) {
      return;
    }

    transformationEdges.push({
      id: edge.id,
      kind: "er-edge",
      renderType: "attribute",
      sourceId,
      targetId,
      label: edge.label,
      status,
      sourceEdgeId: edge.id,
      sourceEdgeType: edge.type,
      lineStyle: edge.lineStyle,
      manualOffset: edge.manualOffset,
      cardinalityLabel: getEdgeCardinalityLabel(edge, sourceNode, targetNode),
      generatedByDecisionIds: [],
      relatedTargetKeys,
    });
  });

  return {
    meta: {
      updatedAt: nowIso(),
      sourceSignature: buildLogicalSourceSignatureInternal(diagram),
    },
    nodes: transformationNodes,
    edges: transformationEdges,
  };
}

function validateDecisionAgainstOverview(
  decision: LogicalTranslationDecision,
  overview: TranslationOverview,
): LogicalTranslationConflict | null {
  const matchedChoice = overview.choicesByKey.get(
    buildChoiceKey(decision.targetType, decision.targetId, decision.rule, decision.configuration),
  );

  if (matchedChoice) {
    return null;
  }

  return {
    id: `conflict-${decision.id}`,
    targetType: decision.targetType,
    targetId: decision.targetId,
    level: "warning",
    decisionId: decision.id,
    message: `La decisione "${decision.summary}" non e piu coerente con lo schema ER corrente e va rivista.`,
  };
}

function buildMappings(
  model: LogicalModel,
  translation: LogicalTranslationState,
): LogicalTranslationState["mappings"] {
  const tableById = new Map(model.tables.map((table) => [table.id, table]));
  return translation.decisions.map((decision) => {
    const artifacts = [
      ...model.tables
        .filter((table) => table.generatedByDecisionId === decision.id)
        .flatMap((table) => [
          { kind: "table" as const, id: table.id, label: table.name },
          ...table.columns
            .filter((column) => column.generatedByDecisionId === decision.id)
            .map((column) => ({ kind: "column" as const, id: column.id, label: `${table.name}.${column.name}` })),
        ]),
      ...model.uniqueConstraints
        .filter((constraint) => constraint.generatedByDecisionId === decision.id)
        .map((constraint) => {
          const table = tableById.get(constraint.tableId);
          const labels =
            table?.columns
              .filter((column) => constraint.columnIds.includes(column.id))
              .map((column) => column.name)
              .join(", ") ?? constraint.columnIds.join(", ");
          return {
            kind: "uniqueConstraint" as const,
            id: constraint.id,
            label: `${table?.name ?? constraint.tableId} UNIQUE (${labels})`,
          };
        }),
      ...model.foreignKeys
        .filter((foreignKey) => foreignKey.generatedByDecisionId === decision.id)
        .flatMap((foreignKey) => {
          const edge = model.edges.find((candidate) => candidate.foreignKeyId === foreignKey.id);
          return [
            { kind: "foreignKey" as const, id: foreignKey.id, label: foreignKey.name },
            ...(edge ? [{ kind: "edge" as const, id: edge.id, label: edge.label }] : []),
          ];
        }),
    ];

    return {
      decisionId: decision.id,
      targetType: decision.targetType,
      targetId: decision.targetId,
      summary: decision.summary,
      artifacts,
    };
  });
}

export function buildLogicalSourceSignature(diagram: DiagramDocument): string {
  return buildLogicalSourceSignatureInternal(diagram);
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

export function createEmptyLogicalWorkspace(
  diagram: DiagramDocument,
  previousWorkspace?: LogicalWorkspaceDocument,
): LogicalWorkspaceDocument {
  const model = normalizeLogicalModelSqlMetadata(
    normalizeLogicalModelGeometry(
      createEmptyLogicalModel(`${normalizeTableName(diagram.meta.name)} (traduzione logica)`),
    ),
  );
  const translation: LogicalTranslationState = {
    meta: {
      createdAt: previousWorkspace?.translation.meta.createdAt ?? nowIso(),
      updatedAt: nowIso(),
      sourceSignature: buildLogicalSourceSignatureInternal(diagram),
    },
    decisions: [],
    mappings: [],
    conflicts: [],
  };

  return {
    model,
    translation,
    transformation: buildTransformationGraph(diagram, translation, model),
  };
}

export function serializeLogicalWorkspace(workspace: LogicalWorkspaceDocument): string {
  return JSON.stringify(workspace);
}

export function refreshLogicalWorkspace(
  diagram: DiagramDocument,
  workspace: LogicalWorkspaceDocument,
): LogicalWorkspaceDocument {
  const overview = createTranslationItemsByStep(diagram, workspace.translation);
  const decisions = workspace.translation.decisions.map((decision) => {
    const matchedChoice = overview.choicesByKey.get(
      buildChoiceKey(decision.targetType, decision.targetId, decision.rule, decision.configuration),
    );
    const conflict = validateDecisionAgainstOverview(decision, overview);
    return {
      ...decision,
      step: matchedChoice?.step ?? decision.step,
      summary: matchedChoice?.summary ?? decision.summary,
      status: conflict ? "invalid" : "applied",
    } satisfies LogicalTranslationDecision;
  });
  const conflicts = decisions
    .map((decision) => validateDecisionAgainstOverview(decision, overview))
    .filter((conflict): conflict is LogicalTranslationConflict => conflict !== null);
  const translation: LogicalTranslationState = {
    ...workspace.translation,
    meta: {
      ...workspace.translation.meta,
      updatedAt: nowIso(),
      sourceSignature: buildLogicalSourceSignatureInternal(diagram),
    },
    decisions,
    conflicts,
    mappings: [],
  };
  const rebuiltModel = buildModelFromDecisions(diagram, translation);
  const mergedModel = mergeColumnSqlMetadataFromPrevious(rebuiltModel, workspace.model);
  const normalizedModel = normalizeLogicalModelSqlMetadata(mergedModel);
  const positionedModel = positionLogicalModelInPlace(diagram, normalizedModel, workspace.model);
  const transformation = buildTransformationGraph(diagram, translation, positionedModel);
  return {
    model: positionedModel,
    translation: {
      ...translation,
      mappings: buildMappings(positionedModel, translation),
    },
    transformation,
  };
}

export function updateLogicalWorkspaceModel(
  diagram: DiagramDocument,
  workspace: LogicalWorkspaceDocument,
  model: LogicalModel,
): LogicalWorkspaceDocument {
  const normalizedModel = normalizeLogicalModelSqlMetadata(model);
  return {
    ...workspace,
    model: normalizedModel,
    translation: {
      ...workspace.translation,
      mappings: buildMappings(normalizedModel, workspace.translation),
    },
    transformation: buildTransformationGraph(diagram, workspace.translation, normalizedModel),
  };
}

export function applyLogicalTranslationChoice(
  diagram: DiagramDocument,
  workspace: LogicalWorkspaceDocument,
  choice: LogicalTranslationChoice,
  targetType: LogicalTranslationDecision["targetType"],
  targetId: string,
): LogicalWorkspaceDocument {
  const previousDecision = workspace.translation.decisions.find(
    (decision) => decision.targetType === targetType && decision.targetId === targetId,
  );
  const nextDecision: LogicalTranslationDecision = {
    id: previousDecision?.id ?? `decision-${targetType}-${targetId}`,
    targetType,
    targetId,
    step: choice.step,
    rule: choice.rule,
    summary: choice.summary,
    appliedAt: previousDecision?.appliedAt ?? nowIso(),
    status: "applied",
    configuration: choice.configuration,
  };
  return refreshLogicalWorkspace(diagram, {
    ...workspace,
    translation: {
      ...workspace.translation,
      decisions: [
        ...workspace.translation.decisions.filter(
          (decision) => !(decision.targetType === targetType && decision.targetId === targetId),
        ),
        nextDecision,
      ],
    },
  });
}

function getBulkChoicePriority(choice: LogicalTranslationChoice): number {
  const priority: Record<LogicalTranslationRuleKind, number> = {
    "entity-table-internal": 10,
    "entity-table-external": 20,
    "weak-entity-table": 25,
    "relationship-foreign-key": 30,
    "relationship-table": 40,
    "multivalued-table": 50,
    "generalization-table-per-type": 60,
    "generalization-subtypes-only": 70,
    "generalization-single-table": 80,
    "entity-table-without-key": 90,
  };
  return (choice.recommended ? 0 : 100) + (priority[choice.rule] ?? 999);
}

function chooseBulkLogicalChoice(choices: LogicalTranslationChoice[]): LogicalTranslationChoice | null {
  return [...choices].sort((left, right) => {
    const byPriority = getBulkChoicePriority(left) - getBulkChoicePriority(right);
    if (byPriority !== 0) {
      return byPriority;
    }

    return left.id.localeCompare(right.id);
  })[0] ?? null;
}

export function applyBulkLogicalFix(
  diagram: DiagramDocument,
  workspace: LogicalWorkspaceDocument,
  step: Extract<LogicalTranslationStep, "entities" | "weak-entities" | "relationships" | "multivalued-attributes">,
): { workspace: LogicalWorkspaceDocument; appliedCount: number; skippedCount: number } {
  let nextWorkspace = workspace;
  let appliedCount = 0;
  let skippedCount = 0;

  for (;;) {
    const overview = buildLogicalTranslationOverview(diagram, nextWorkspace);
    const item = (overview.itemsByStep[step] ?? []).find((candidate) => candidate.status === "pending" || candidate.status === "invalid");
    if (!item) {
      break;
    }

    const choice = chooseBulkLogicalChoice(getLogicalTranslationChoicesForItem(overview, item));
    if (!choice) {
      skippedCount += 1;
      break;
    }

    try {
      nextWorkspace = applyLogicalTranslationChoice(diagram, nextWorkspace, choice, item.targetType, item.id);
      appliedCount += 1;
    } catch {
      skippedCount += 1;
      break;
    }
  }

  return { workspace: nextWorkspace, appliedCount, skippedCount };
}

export function buildLogicalTranslationOverview(
  diagram: DiagramDocument,
  workspace: LogicalWorkspaceDocument,
): TranslationOverview {
  return createTranslationItemsByStep(diagram, workspace.translation);
}

export function getLogicalTranslationStepCompletion(
  overview: TranslationOverview,
): Record<LogicalTranslationStep, { total: number; pending: number; applied: number; invalid: number }> {
  const result = {} as Record<LogicalTranslationStep, { total: number; pending: number; applied: number; invalid: number }>;
  LOGICAL_TRANSLATION_STEPS.forEach((step) => {
    const items = overview.itemsByStep[step.id];
    result[step.id] = {
      total: items.length,
      pending: items.filter((item) => item.status === "pending").length,
      applied: items.filter((item) => item.status === "applied").length,
      invalid: items.filter((item) => item.status === "invalid").length,
    };
  });
  return result;
}

export function getLogicalTranslationChoicesForItem(
  overview: TranslationOverview,
  item: LogicalTranslationItem,
): LogicalTranslationChoice[] {
  return [...overview.choicesByKey.values()].filter((choice) => item.choiceIds.includes(choice.id));
}
