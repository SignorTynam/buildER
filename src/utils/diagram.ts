import type {
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EdgeKind,
  ExternalIdentifier,
  ExternalIdentifierImportPart,
  GeneralizationGroup,
  EntityRelationshipParticipation,
  InternalIdentifier,
  IsaCompleteness,
  IsaDisjointness,
  NodeKind,
  Point,
  SelectionState,
  ValidationIssue,
} from "../types/diagram";
import { GRID_SIZE, getNodeBounds, snapPoint, snapValue } from "./geometry";
import { duplicateDiagramSelection } from "./clipboard";
import {
  getAttributeCardinalityOwner,
  getConnectorParticipation,
  getConnectorParticipationContext,
  isSupportedCardinality,
  normalizeSupportedCardinality,
} from "./cardinality";
import { removeDisallowedManualRouting } from "./edgeRouting";

const MULTIVALUED_ATTRIBUTE_MIN_WIDTH = 92;
const MULTIVALUED_ATTRIBUTE_MAX_WIDTH = 320;
const MULTIVALUED_ATTRIBUTE_HEIGHT = 44;
const MULTIVALUED_ATTRIBUTE_HORIZONTAL_PADDING = 28;
const MULTIVALUED_ATTRIBUTE_CHAR_WIDTH = 8;
const ENTITY_TEXT_HORIZONTAL_PADDING = 52;
const RELATIONSHIP_TEXT_HORIZONTAL_PADDING = 70;
const SHAPE_LABEL_CHAR_WIDTH = 9;
const RELATIONSHIP_WIDE_LABEL_CHAR_WIDTH = 11;
const RELATIONSHIP_LABEL_CHAR_WIDTH = 8;
const RELATIONSHIP_MAX_AUTO_EXTRA_HEIGHT = 32;
const RELATIONSHIP_AUTO_HEIGHT_RATIO = 0.08;

type RelationshipNode = Extract<DiagramNode, { type: "relationship" }>;
type AttributeNode = Extract<DiagramNode, { type: "attribute" }>;
type EntityNode = Extract<DiagramNode, { type: "entity" }>;
type ConnectorEdge = Extract<DiagramEdge, { type: "connector" }>;

const CURRENT_DIAGRAM_VERSION = 3;

export type ExternalIdentifierKind = "imported_only" | "imported_plus_local";

export interface ExternalIdentifierValidationResult {
  valid: boolean;
  externalIdentifierId: string;
  hostEntityId: string;
  hostEntityLabel: string;
  relationshipId?: string;
  relationshipLabel?: string;
  sourceEntityId?: string;
  sourceEntityLabel?: string;
  kind?: ExternalIdentifierKind;
  reason?: string;
  message?: string;
}

export interface ExternalIdentifierInvalidation {
  externalIdentifierId: string;
  hostEntityId: string;
  hostEntityLabel: string;
  relationshipId?: string;
  relationshipLabel?: string;
  sourceEntityId?: string;
  sourceEntityLabel?: string;
  reason: string;
  message: string;
}

export interface ExternalIdentifierImportPartOption extends ExternalIdentifierImportPart {
  relationshipLabel: string;
  sourceEntityLabel: string;
  importedIdentifierLabel: string;
}

export interface NodeNameIdentitySyncResult {
  diagram: DiagramDocument;
  nodeIdMap: Map<string, string>;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getMultivaluedAttributeSize(label: string): { width: number; height: number } {
  const normalizedLabel = label.trim();
  const estimatedTextWidth = normalizedLabel.length * MULTIVALUED_ATTRIBUTE_CHAR_WIDTH;
  const paddedWidth = estimatedTextWidth + MULTIVALUED_ATTRIBUTE_HORIZONTAL_PADDING;
  const width = clamp(
    snapValue(paddedWidth, 10),
    MULTIVALUED_ATTRIBUTE_MIN_WIDTH,
    MULTIVALUED_ATTRIBUTE_MAX_WIDTH,
  );

  return {
    width,
    height: MULTIVALUED_ATTRIBUTE_HEIGHT,
  };
}

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

function sanitizeEntityRelationshipParticipations(
  rawParticipations: unknown,
): EntityRelationshipParticipation[] | undefined {
  const parsedParticipations: EntityRelationshipParticipation[] = [];
  if (Array.isArray(rawParticipations)) {
    rawParticipations.forEach((participation) => {
      if (typeof participation !== "object" || participation === null) {
        return;
      }

      const rawParticipation = participation as {
        id?: unknown;
        relationshipId?: unknown;
        cardinality?: unknown;
        role?: unknown;
      };
      if (
        typeof rawParticipation.relationshipId !== "string" ||
        rawParticipation.relationshipId.trim().length === 0
      ) {
        return;
      }

      parsedParticipations.push({
        id:
          typeof rawParticipation.id === "string" && rawParticipation.id.trim().length > 0
            ? rawParticipation.id
            : createId("participation"),
        relationshipId: rawParticipation.relationshipId,
        ...(typeof rawParticipation.cardinality === "string"
          ? { cardinality: normalizeSupportedCardinality(rawParticipation.cardinality) }
          : {}),
        ...(typeof rawParticipation.role === "string" && rawParticipation.role.trim().length > 0
          ? { role: rawParticipation.role.trim() }
          : {}),
      });
    });
  }

  return parsedParticipations.length > 0 ? parsedParticipations : undefined;
}

function sanitizeExternalIdentifierImportParts(rawIdentifier: {
  importedParts?: unknown;
  relationshipId?: unknown;
  sourceEntityId?: unknown;
  importedIdentifierId?: unknown;
}): ExternalIdentifierImportPart[] {
  const parsedParts: ExternalIdentifierImportPart[] = [];
  const seenPartKeys = new Set<string>();
  const pushPart = (part: {
    id?: unknown;
    relationshipId?: unknown;
    sourceEntityId?: unknown;
    importedIdentifierId?: unknown;
  }) => {
    if (
      typeof part.relationshipId !== "string" ||
      part.relationshipId.trim().length === 0 ||
      typeof part.sourceEntityId !== "string" ||
      part.sourceEntityId.trim().length === 0 ||
      typeof part.importedIdentifierId !== "string" ||
      part.importedIdentifierId.trim().length === 0
    ) {
      return;
    }

    const key = [part.relationshipId, part.sourceEntityId, part.importedIdentifierId].join("|");
    if (seenPartKeys.has(key)) {
      return;
    }

    seenPartKeys.add(key);
    parsedParts.push({
      id:
        typeof part.id === "string" && part.id.trim().length > 0
          ? part.id
          : createId("externalIdentifierPart"),
      relationshipId: part.relationshipId,
      sourceEntityId: part.sourceEntityId,
      importedIdentifierId: part.importedIdentifierId,
    });
  };

  if (Array.isArray(rawIdentifier.importedParts)) {
    rawIdentifier.importedParts.forEach((part) => {
      if (typeof part !== "object" || part === null) {
        return;
      }

      pushPart(part as {
        id?: unknown;
        relationshipId?: unknown;
        sourceEntityId?: unknown;
        importedIdentifierId?: unknown;
      });
    });
  }

  if (parsedParts.length === 0) {
    pushPart({
      relationshipId: rawIdentifier.relationshipId,
      sourceEntityId: rawIdentifier.sourceEntityId,
      importedIdentifierId: rawIdentifier.importedIdentifierId,
    });
  }

  return parsedParts;
}

function sanitizeExternalIdentifiers(rawIdentifiers: unknown): ExternalIdentifier[] | undefined {
  const parsedIdentifiers: ExternalIdentifier[] = [];
  if (Array.isArray(rawIdentifiers)) {
    rawIdentifiers.forEach((identifier) => {
      if (typeof identifier !== "object" || identifier === null) {
        return;
      }

      const rawIdentifier = identifier as {
        id?: unknown;
        relationshipId?: unknown;
        sourceEntityId?: unknown;
        importedIdentifierId?: unknown;
        localAttributeIds?: unknown;
        offset?: unknown;
        markerOffsetX?: unknown;
        markerOffsetY?: unknown;
        importedParts?: unknown;
      };
      const importedParts = sanitizeExternalIdentifierImportParts(rawIdentifier);
      if (importedParts.length === 0) {
        return;
      }

      parsedIdentifiers.push({
        id:
          typeof rawIdentifier.id === "string" && rawIdentifier.id.trim().length > 0
            ? rawIdentifier.id
            : createId("externalIdentifier"),
        importedParts,
        localAttributeIds: Array.isArray(rawIdentifier.localAttributeIds)
          ? rawIdentifier.localAttributeIds.filter(
              (attributeId): attributeId is string =>
                typeof attributeId === "string" && attributeId.trim().length > 0,
            )
          : [],
        offset:
          typeof rawIdentifier.offset === "number" && Number.isFinite(rawIdentifier.offset)
            ? rawIdentifier.offset
            : undefined,
        markerOffsetX:
          typeof rawIdentifier.markerOffsetX === "number" && Number.isFinite(rawIdentifier.markerOffsetX)
            ? rawIdentifier.markerOffsetX
            : undefined,
        markerOffsetY:
          typeof rawIdentifier.markerOffsetY === "number" && Number.isFinite(rawIdentifier.markerOffsetY)
            ? rawIdentifier.markerOffsetY
            : undefined,
      });
    });
  }

  return parsedIdentifiers.length > 0 ? parsedIdentifiers : undefined;
}

function areEntityRelationshipParticipationsEqual(
  left: EntityRelationshipParticipation[] | undefined,
  right: EntityRelationshipParticipation[] | undefined,
): boolean {
  const leftList = left ?? [];
  const rightList = right ?? [];

  if (leftList.length !== rightList.length) {
    return false;
  }

  return leftList.every((participation, index) => {
    const other = rightList[index];
    return (
      other !== undefined &&
      other.id === participation.id &&
      other.relationshipId === participation.relationshipId &&
      other.cardinality === participation.cardinality &&
      (other.role ?? "") === (participation.role ?? "")
    );
  });
}

function areExternalIdentifierListsEqual(
  left: ExternalIdentifier[] | undefined,
  right: ExternalIdentifier[] | undefined,
): boolean {
  const leftList = left ?? [];
  const rightList = right ?? [];

  if (leftList.length !== rightList.length) {
    return false;
  }

  return leftList.every((identifier, index) => {
    const other = rightList[index];
    if (
      other === undefined ||
      other.id !== identifier.id ||
      other.importedParts.length !== identifier.importedParts.length ||
      other.localAttributeIds.length !== identifier.localAttributeIds.length ||
      other.offset !== identifier.offset ||
      other.markerOffsetX !== identifier.markerOffsetX ||
      other.markerOffsetY !== identifier.markerOffsetY
    ) {
      return false;
    }

    return (
      other.importedParts.every((part, partIndex) => {
        const leftPart = identifier.importedParts[partIndex];
        return (
          leftPart !== undefined &&
          part.id === leftPart.id &&
          part.relationshipId === leftPart.relationshipId &&
          part.sourceEntityId === leftPart.sourceEntityId &&
          part.importedIdentifierId === leftPart.importedIdentifierId
        );
      }) &&
      other.localAttributeIds.every((attributeId, attributeIndex) =>
        attributeId === identifier.localAttributeIds[attributeIndex],
      )
    );
  });
}

const NODE_ID_PREFIX_BY_TYPE: Record<NodeKind, string> = {
  entity: "entity",
  relationship: "relationship",
  attribute: "attribute",
};

const NODE_LABEL_PREFIX_BY_TYPE: Record<NodeKind, string> = {
  entity: "ENTITA",
  relationship: "RELAZIONE",
  attribute: "ATTRIBUTO",
};

const EDGE_ID_PREFIX_BY_TYPE: Record<EdgeKind, string> = {
  connector: "connector",
  attribute: "attributeLink",
  inheritance: "inheritance",
};

const EDGE_LABEL_PREFIX_BY_TYPE: Partial<Record<EdgeKind, string>> = {
  connector: "COLLEGAMENTO",
  attribute: "COLLEGAMENTO_ATTRIBUTO",
};

function normalizeNodeNameKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

export function normalizeNodeNameCandidate(value: string | undefined, nodeType: NodeKind): string {
  const normalized = typeof value === "string" ? value.trim().replace(/\s+/g, "_") : "";
  const fallback = NODE_LABEL_PREFIX_BY_TYPE[nodeType];
  const candidate = normalized.length > 0 ? normalized : fallback;

  if (nodeType === "entity" || nodeType === "relationship") {
    return candidate.toUpperCase();
  }

  return candidate;
}

function createUniqueNodeName(baseName: string, usedNames: Set<string>): string {
  const normalizedBase = baseName.trim().replace(/\s+/g, "_");
  const fallback = normalizedBase.length > 0 ? normalizedBase : "ELEMENTO";
  const fallbackKey = normalizeNodeNameKey(fallback);

  if (!usedNames.has(fallbackKey)) {
    usedNames.add(fallbackKey);
    return fallback;
  }

  let suffix = 2;
  while (true) {
    const candidate = `${fallback}_${suffix}`;
    const candidateKey = normalizeNodeNameKey(candidate);
    if (!usedNames.has(candidateKey)) {
      usedNames.add(candidateKey);
      return candidate;
    }
    suffix += 1;
  }
}

export type NodeNameNamespaceKind = "entity" | "relationship" | "attribute";

export interface NodeNameValidationContext {
  diagram: DiagramDocument;
  nodeType: NodeKind;
  candidateName: string;
  nodeId?: string;
  attributeOwnerId?: string;
}

export interface NodeNameValidationResult {
  valid: boolean;
  normalizedName: string;
  namespaceKey: string;
  conflictNodeId?: string;
}

function buildAttributeOwnerByAttributeId(diagram: DiagramDocument): Map<string, string> {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const ownerCandidatesByAttributeId = new Map<string, Set<string>>();

  diagram.edges.forEach((edge) => {
    const ownership = resolveAttributeOwnership(edge, nodeMap);
    if (!ownership) {
      return;
    }

    const ownerCandidates = ownerCandidatesByAttributeId.get(ownership.childId) ?? new Set<string>();
    ownerCandidates.add(ownership.hostId);
    ownerCandidatesByAttributeId.set(ownership.childId, ownerCandidates);
  });

  const ownerByAttributeId = new Map<string, string>();
  ownerCandidatesByAttributeId.forEach((ownerCandidates, attributeId) => {
    const [resolvedOwnerId] = [...ownerCandidates].sort((left, right) => left.localeCompare(right));
    if (!resolvedOwnerId) {
      return;
    }

    ownerByAttributeId.set(attributeId, resolvedOwnerId);
  });

  return ownerByAttributeId;
}

function getNodeNamespaceKey(
  nodeType: NodeKind,
  options?: {
    nodeId?: string;
    attributeOwnerId?: string;
  },
): string {
  if (nodeType === "entity") {
    return "entity";
  }

  if (nodeType === "relationship") {
    return "relationship";
  }

  const ownerId = options?.attributeOwnerId;
  if (ownerId) {
    return `attribute:${ownerId}`;
  }

  return options?.nodeId ? `attribute:orphan:${options.nodeId}` : "attribute:orphan";
}

export function validateNodeNameInNamespace(context: NodeNameValidationContext): NodeNameValidationResult {
  const ownerByAttributeId = buildAttributeOwnerByAttributeId(context.diagram);
  const normalizedName = normalizeNodeNameCandidate(context.candidateName, context.nodeType);
  const normalizedNameKey = normalizeNodeNameKey(normalizedName);
  const namespaceKey = getNodeNamespaceKey(context.nodeType, {
    nodeId: context.nodeId,
    attributeOwnerId:
      context.nodeType === "attribute"
        ? context.attributeOwnerId ?? (context.nodeId ? ownerByAttributeId.get(context.nodeId) : undefined)
        : undefined,
  });

  const conflictingNode = context.diagram.nodes.find((node) => {
    if (context.nodeId && node.id === context.nodeId) {
      return false;
    }

    const nodeNamespaceKey = getNodeNamespaceKey(node.type, {
      nodeId: node.id,
      attributeOwnerId: node.type === "attribute" ? ownerByAttributeId.get(node.id) : undefined,
    });
    if (nodeNamespaceKey !== namespaceKey) {
      return false;
    }

    return normalizeNodeNameKey(node.label) === normalizedNameKey;
  });

  return {
    valid: conflictingNode === undefined,
    normalizedName,
    namespaceKey,
    conflictNodeId: conflictingNode?.id,
  };
}

function getOrCreateNamespaceNameSet(
  usedNamesByNamespace: Map<string, Set<string>>,
  namespaceKey: string,
): Set<string> {
  const existing = usedNamesByNamespace.get(namespaceKey);
  if (existing) {
    return existing;
  }

  const created = new Set<string>();
  usedNamesByNamespace.set(namespaceKey, created);
  return created;
}

function assignUniqueNodeLabel(
  node: DiagramNode,
  nameCandidate: string,
  usedNamesByNamespace: Map<string, Set<string>>,
  ownerByAttributeId: Map<string, string>,
): string {
  const namespaceKey = getNodeNamespaceKey(node.type, {
    nodeId: node.id,
    attributeOwnerId: node.type === "attribute" ? ownerByAttributeId.get(node.id) : undefined,
  });
  const usedNames = getOrCreateNamespaceNameSet(usedNamesByNamespace, namespaceKey);
  return createUniqueNodeName(normalizeNodeNameCandidate(nameCandidate, node.type), usedNames);
}

function synchronizeNodeLabelsByNamespace(
  diagram: DiagramDocument,
  preferredNamesByNodeId?: Record<string, string>,
): Map<string, string> {
  const usedNamesByNamespace = new Map<string, Set<string>>();
  const ownerByAttributeId = buildAttributeOwnerByAttributeId(diagram);
  const synchronizedLabelByNodeId = new Map<string, string>();
  const preferredIds = new Set(Object.keys(preferredNamesByNodeId ?? {}));

  diagram.nodes.forEach((node) => {
    if (preferredIds.has(node.id)) {
      return;
    }

    const uniqueLabel = assignUniqueNodeLabel(
      node,
      node.label ?? node.id,
      usedNamesByNamespace,
      ownerByAttributeId,
    );
    synchronizedLabelByNodeId.set(node.id, uniqueLabel);
  });

  diagram.nodes.forEach((node) => {
    if (!preferredIds.has(node.id)) {
      return;
    }

    const preferredLabel = preferredNamesByNodeId?.[node.id] ?? node.label ?? node.id;
    const uniqueLabel = assignUniqueNodeLabel(
      node,
      preferredLabel,
      usedNamesByNamespace,
      ownerByAttributeId,
    );
    synchronizedLabelByNodeId.set(node.id, uniqueLabel);
  });

  return synchronizedLabelByNodeId;
}

function synchronizeNodeIds(
  diagram: DiagramDocument,
  synchronizedLabelsByNodeId?: Map<string, string>,
): Map<string, string> {
  const usedNodeIds = new Set<string>();
  const synchronizedNodeIds = new Map<string, string>();

  diagram.nodes.forEach((node) => {
    const preferredIdSource = synchronizedLabelsByNodeId?.get(node.id) ?? node.id;
    const normalizedIdCandidate = preferredIdSource.trim().replace(/\s+/g, " ");
    const idCandidate = normalizedIdCandidate.length > 0 ? normalizedIdCandidate : createId("node");
    const uniqueId = createUniqueNodeName(idCandidate, usedNodeIds);
    synchronizedNodeIds.set(node.id, uniqueId);
  });

  return synchronizedNodeIds;
}

function remapNodeScopedMetadata(node: DiagramNode, nodeIdMap: Map<string, string>): DiagramNode {
  if (node.type === "entity") {
    const nextInternalIdentifiers =
      Array.isArray(node.internalIdentifiers) && node.internalIdentifiers.length > 0
        ? node.internalIdentifiers.map((identifier) => ({
            ...identifier,
            attributeIds: identifier.attributeIds.map((attributeId) => nodeIdMap.get(attributeId) ?? attributeId),
          }))
        : undefined;
    const nextParticipations =
      Array.isArray(node.relationshipParticipations) && node.relationshipParticipations.length > 0
        ? node.relationshipParticipations.map((participation) => ({
            ...participation,
            relationshipId: nodeIdMap.get(participation.relationshipId) ?? participation.relationshipId,
          }))
        : undefined;
    const nextExternalIdentifiers =
      Array.isArray(node.externalIdentifiers) && node.externalIdentifiers.length > 0
        ? node.externalIdentifiers.map((identifier) => ({
            ...identifier,
            importedParts: identifier.importedParts.map((part) => ({
              ...part,
              relationshipId: nodeIdMap.get(part.relationshipId) ?? part.relationshipId,
              sourceEntityId: nodeIdMap.get(part.sourceEntityId) ?? part.sourceEntityId,
            })),
            localAttributeIds: identifier.localAttributeIds.map(
              (attributeId) => nodeIdMap.get(attributeId) ?? attributeId,
            ),
          }))
        : undefined;

    if (
      areEntityRelationshipParticipationsEqual(node.relationshipParticipations, nextParticipations) &&
      areInternalIdentifierListsEqual(node.internalIdentifiers, nextInternalIdentifiers) &&
      areExternalIdentifierListsEqual(node.externalIdentifiers, nextExternalIdentifiers)
    ) {
      return node;
    }

    return {
      ...node,
      internalIdentifiers: nextInternalIdentifiers,
      externalIdentifiers: nextExternalIdentifiers,
      relationshipParticipations: nextParticipations,
    };
  }

  return node;
}

function remapGeneralizationGroups(
  groups: GeneralizationGroup[] | undefined,
  nodeIdMap: Map<string, string>,
): GeneralizationGroup[] | undefined {
  if (!groups || groups.length === 0) {
    return groups;
  }

  return groups.map((group) => ({
    ...group,
    supertypeId: nodeIdMap.get(group.supertypeId) ?? group.supertypeId,
    subtypeIds: group.subtypeIds.map((subtypeId) => nodeIdMap.get(subtypeId) ?? subtypeId),
  }));
}

export function synchronizeNodeNameIdentity(
  diagram: DiagramDocument,
  preferredNamesByNodeId?: Record<string, string>,
): NodeNameIdentitySyncResult {
  const synchronizedLabelsByNodeId = synchronizeNodeLabelsByNamespace(diagram, preferredNamesByNodeId);
  const fullNodeIdMap = synchronizeNodeIds(diagram, synchronizedLabelsByNodeId);

  const nodeIdMap = new Map<string, string>();
  fullNodeIdMap.forEach((nextId, previousId) => {
    if (nextId !== previousId) {
      nodeIdMap.set(previousId, nextId);
    }
  });

  const nextNodes = diagram.nodes.map((node) => {
    const nextNodeId = fullNodeIdMap.get(node.id) ?? node.id;
    const nextNodeLabel = synchronizedLabelsByNodeId.get(node.id) ?? normalizeNodeNameCandidate(node.label, node.type);
    const nextNode = {
      ...node,
      id: nextNodeId,
      label: nextNodeLabel,
    } as DiagramNode;
    return remapNodeScopedMetadata(withMinimumNodeSizeForLabel(nextNode), fullNodeIdMap);
  });

  const nextEdges = diagram.edges.map((edge) => ({
    ...edge,
    sourceId: fullNodeIdMap.get(edge.sourceId) ?? edge.sourceId,
    targetId: fullNodeIdMap.get(edge.targetId) ?? edge.targetId,
  }));

  return {
    diagram: {
      ...diagram,
      nodes: nextNodes,
      edges: nextEdges,
      generalizationGroups: remapGeneralizationGroups(diagram.generalizationGroups, fullNodeIdMap),
    },
    nodeIdMap,
  };
}

export function renameNodeAsNameIdentity(
  diagram: DiagramDocument,
  nodeId: string,
  nextName: string,
): NodeNameIdentitySyncResult {
  return synchronizeNodeNameIdentity(diagram, { [nodeId]: nextName });
}

function parseTrailingIndex(value: string, prefix: string): number | null {
  const normalizedValue = value.trim().toLowerCase();
  const normalizedPrefix = prefix.trim().toLowerCase();
  if (!normalizedValue.startsWith(normalizedPrefix)) {
    return null;
  }

  const suffix = normalizedValue.slice(normalizedPrefix.length);
  if (!/^\d+$/.test(suffix)) {
    return null;
  }

  const parsed = Number.parseInt(suffix, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getNextNodeIndex(diagram: DiagramDocument, nodeType: NodeKind): number {
  const idPrefix = NODE_ID_PREFIX_BY_TYPE[nodeType];
  const labelPrefix = NODE_LABEL_PREFIX_BY_TYPE[nodeType];
  let maxIndex = 0;

  for (const node of diagram.nodes) {
    if (node.type !== nodeType) {
      continue;
    }

    const idIndex = parseTrailingIndex(node.id, idPrefix);
    if (idIndex !== null) {
      maxIndex = Math.max(maxIndex, idIndex);
    }

    const labelIndex = parseTrailingIndex(node.label, labelPrefix);
    if (labelIndex !== null) {
      maxIndex = Math.max(maxIndex, labelIndex);
    }
  }

  return maxIndex + 1;
}

function createDefaultNodeIdentity(
  nodeType: NodeKind,
  diagram: DiagramDocument,
): { id: string; label: string } {
  const nextIndex = getNextNodeIndex(diagram, nodeType);
  const labelPrefix = NODE_LABEL_PREFIX_BY_TYPE[nodeType];
  const name = `${labelPrefix}${nextIndex}`;

  return {
    id: name,
    label: name,
  };
}

function getNextEdgeIndex(diagram: DiagramDocument, edgeType: EdgeKind): number {
  const idPrefix = EDGE_ID_PREFIX_BY_TYPE[edgeType];
  const labelPrefix = EDGE_LABEL_PREFIX_BY_TYPE[edgeType];
  let maxIndex = 0;

  for (const edge of diagram.edges) {
    if (edge.type !== edgeType) {
      continue;
    }

    const idIndex = parseTrailingIndex(edge.id, idPrefix);
    if (idIndex !== null) {
      maxIndex = Math.max(maxIndex, idIndex);
    }

    if (labelPrefix) {
      const labelIndex = parseTrailingIndex(edge.label, labelPrefix);
      if (labelIndex !== null) {
        maxIndex = Math.max(maxIndex, labelIndex);
      }
    }
  }

  return maxIndex + 1;
}

function createDefaultEdgeIdentity(
  edgeType: EdgeKind,
  diagram: DiagramDocument,
): { id: string; label: string } {
  const nextIndex = getNextEdgeIndex(diagram, edgeType);
  const idPrefix = EDGE_ID_PREFIX_BY_TYPE[edgeType];
  const labelPrefix = EDGE_LABEL_PREFIX_BY_TYPE[edgeType];

  return {
    id: `${idPrefix}${nextIndex}`,
    label: labelPrefix ? `${labelPrefix}${nextIndex}` : "",
  };
}

function getNodeSize(nodeType: NodeKind) {
  switch (nodeType) {
    case "entity":
      return { width: 140, height: 64 };
    case "relationship":
      return { width: 130, height: 78 };
    case "attribute":
      return { width: 150, height: 28 };
    default:
      return { width: 120, height: 48 };
  }
}

function estimateRelationshipTextWidth(label: string): number {
  const normalizedLabel = label.trim();
  if (normalizedLabel.length === 0) {
    return RELATIONSHIP_LABEL_CHAR_WIDTH;
  }

  return Array.from(normalizedLabel).reduce((width, character) => {
    const upperCharacter = character.toUpperCase();
    const characterWidth =
      upperCharacter === "W" || upperCharacter === "M"
        ? RELATIONSHIP_WIDE_LABEL_CHAR_WIDTH
        : RELATIONSHIP_LABEL_CHAR_WIDTH;
    return width + characterWidth;
  }, 0);
}

export function getPreferredNodeSizeForLabel(
  nodeType: NodeKind,
  label: string,
): { width: number; height: number } {
  const baseSize = getNodeSize(nodeType);

  if (nodeType === "entity") {
    const estimatedTextWidth = Math.max(1, label.trim().length) * SHAPE_LABEL_CHAR_WIDTH;
    return {
      width: Math.max(baseSize.width, snapValue(estimatedTextWidth + ENTITY_TEXT_HORIZONTAL_PADDING, 10)),
      height: baseSize.height,
    };
  }

  if (nodeType === "relationship") {
    const estimatedTextWidth = estimateRelationshipTextWidth(label);
    const width = Math.max(
      baseSize.width,
      snapValue(estimatedTextWidth + RELATIONSHIP_TEXT_HORIZONTAL_PADDING, 10),
    );
    const extraHeight = clamp(
      (width - baseSize.width) * RELATIONSHIP_AUTO_HEIGHT_RATIO,
      0,
      RELATIONSHIP_MAX_AUTO_EXTRA_HEIGHT,
    );
    return {
      width,
      height: baseSize.height + snapValue(extraHeight, 10),
    };
  }

  return baseSize;
}

export function getMinimumNodeSizeForLabel(
  nodeType: NodeKind,
  label: string,
): { width: number; height: number } {
  const baseSize = getNodeSize(nodeType);
  const estimatedTextWidth = Math.max(1, label.trim().length) * SHAPE_LABEL_CHAR_WIDTH;

  if (nodeType === "entity") {
    return {
      width: Math.max(baseSize.width, snapValue(estimatedTextWidth + ENTITY_TEXT_HORIZONTAL_PADDING, 10)),
      height: baseSize.height,
    };
  }

  if (nodeType === "relationship") {
    return getPreferredNodeSizeForLabel(nodeType, label);
  }

  return baseSize;
}

export function withMinimumNodeSizeForLabel(node: DiagramNode): DiagramNode {
  if (node.type !== "entity" && node.type !== "relationship") {
    return node;
  }

  const minimumSize = getMinimumNodeSizeForLabel(node.type, node.label);
  if (node.width >= minimumSize.width && node.height >= minimumSize.height) {
    return node;
  }

  return {
    ...node,
    width: Math.max(node.width, minimumSize.width),
    height: Math.max(node.height, minimumSize.height),
  };
}

export function withPreferredNodeSizeForLabel(node: DiagramNode, center?: Point): DiagramNode {
  if (node.type !== "entity" && node.type !== "relationship") {
    return node;
  }

  const preferredSize = getPreferredNodeSizeForLabel(node.type, node.label);
  const centerX = center?.x ?? node.x + node.width / 2;
  const centerY = center?.y ?? node.y + node.height / 2;

  return {
    ...node,
    x: centerX - preferredSize.width / 2,
    y: centerY - preferredSize.height / 2,
    width: preferredSize.width,
    height: preferredSize.height,
  };
}

export function createEmptyDiagram(name = "Diagramma ER"): DiagramDocument {
  return {
    meta: {
      name,
      version: CURRENT_DIAGRAM_VERSION,
    },
    notes: "",
    nodes: [],
    edges: [],
  };
}

export function createNode(
  nodeType: NodeKind,
  position: Point,
  diagram: DiagramDocument,
): DiagramNode {
  const size = getNodeSize(nodeType);
  const snappedCenter = snapPoint(position);
  const x = snapValue(snappedCenter.x - size.width / 2, GRID_SIZE);
  const y = snapValue(snappedCenter.y - size.height / 2, GRID_SIZE);
  const defaultIdentity = createDefaultNodeIdentity(nodeType, diagram);

  if (nodeType === "attribute") {
    return {
      id: defaultIdentity.id,
      type: nodeType,
      label: defaultIdentity.label,
      x,
      y,
      width: size.width,
      height: size.height,
      isIdentifier: false,
      isCompositeInternal: false,
      isMultivalued: false,
      cardinality: undefined,
    };
  }

  if (nodeType === "entity") {
    return {
      id: defaultIdentity.id,
      type: nodeType,
      label: defaultIdentity.label,
      x,
      y,
      width: size.width,
      height: size.height,
      isWeak: false,
      internalIdentifiers: [],
      externalIdentifiers: [],
      relationshipParticipations: [],
    };
  }

  return {
    id: defaultIdentity.id,
    type: nodeType,
    label: defaultIdentity.label,
    x,
    y,
    width: size.width,
    height: size.height,
  } as DiagramNode;
}

export function createEdge(
  edgeType: EdgeKind,
  sourceId: string,
  targetId: string,
  diagram: DiagramDocument,
): DiagramEdge {
  const defaultIdentity = createDefaultEdgeIdentity(edgeType, diagram);

  if (edgeType === "connector") {
    return {
      id: defaultIdentity.id,
      type: edgeType,
      sourceId,
      targetId,
      label: defaultIdentity.label,
      lineStyle: "solid",
    };
  }

  return {
    id: defaultIdentity.id,
    type: edgeType,
    sourceId,
    targetId,
    label: defaultIdentity.label,
    lineStyle: "solid",
  } as DiagramEdge;
}

export function synchronizeEntityRelationshipParticipations(diagram: DiagramDocument): DiagramDocument {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const existingByEntityId = new Map(
    diagram.nodes
      .filter((node): node is EntityNode => node.type === "entity")
      .map((entity) => [entity.id, entity.relationshipParticipations ?? []]),
  );
  const usedParticipationIdsByEntityId = new Map<string, Set<string>>();
  const nextParticipationsByEntityId = new Map<string, EntityRelationshipParticipation[]>();
  let edgeChanged = false;

  const nextEdges = diagram.edges.map((edge) => {
    if (edge.type !== "connector") {
      return edge;
    }

    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    const context = getConnectorParticipationContext(sourceNode, targetNode);
    if (!context) {
      if (edge.participationId === undefined) {
        return edge;
      }

      edgeChanged = true;
      return {
        ...edge,
        participationId: undefined,
      };
    }

    const entityParticipations = existingByEntityId.get(context.entity.id) ?? [];
    const usedParticipationIds = usedParticipationIdsByEntityId.get(context.entity.id) ?? new Set<string>();
    usedParticipationIdsByEntityId.set(context.entity.id, usedParticipationIds);

    let participation =
      typeof edge.participationId === "string" && edge.participationId.trim().length > 0
        ? entityParticipations.find(
            (candidate) =>
              candidate.id === edge.participationId &&
              candidate.relationshipId === context.relationship.id &&
              !usedParticipationIds.has(candidate.id),
          )
        : undefined;

    if (!participation) {
      participation = entityParticipations.find(
        (candidate) =>
          candidate.relationshipId === context.relationship.id && !usedParticipationIds.has(candidate.id),
      );
    }

    const nextParticipation =
      participation ??
      ({
        id:
          typeof edge.participationId === "string" && edge.participationId.trim().length > 0
            ? edge.participationId
            : createId("participation"),
        relationshipId: context.relationship.id,
        cardinality: undefined,
      } satisfies EntityRelationshipParticipation);
    usedParticipationIds.add(nextParticipation.id);

    const nextEntityParticipations = nextParticipationsByEntityId.get(context.entity.id) ?? [];
    nextEntityParticipations.push({
      ...nextParticipation,
      relationshipId: context.relationship.id,
    });
    nextParticipationsByEntityId.set(context.entity.id, nextEntityParticipations);

    if (edge.participationId === nextParticipation.id) {
      return edge;
    }

    edgeChanged = true;
    return {
      ...edge,
      participationId: nextParticipation.id,
    };
  });

  let nodeChanged = false;
  const nextNodes = diagram.nodes.map((node) => {
    if (node.type !== "entity") {
      return node;
    }

    const nextParticipations = nextParticipationsByEntityId.get(node.id);
    if (areEntityRelationshipParticipationsEqual(node.relationshipParticipations, nextParticipations)) {
      return node;
    }

    nodeChanged = true;
    return {
      ...node,
      relationshipParticipations: nextParticipations && nextParticipations.length > 0 ? nextParticipations : undefined,
    };
  });

  return nodeChanged || edgeChanged
    ? {
        ...diagram,
        nodes: nextNodes,
        edges: nextEdges,
      }
    : diagram;
}

export function findNode(diagram: DiagramDocument, nodeId: string): DiagramNode | undefined {
  return diagram.nodes.find((node) => node.id === nodeId);
}

export function getAttributeHost(diagram: DiagramDocument, attributeId: string): DiagramNode | undefined {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const edge = diagram.edges.find((candidate) => {
    if (candidate.type !== "attribute") {
      return false;
    }

    const ownership = resolveAttributeOwnership(candidate, nodeMap);
    return ownership?.childId === attributeId;
  });

  if (!edge) {
    return undefined;
  }

  const ownership = resolveAttributeOwnership(edge, nodeMap);
  return ownership ? nodeMap.get(ownership.hostId) : undefined;
}

export function isAttributeUsedInAnyIdentifier(diagram: DiagramDocument, attributeId: string): boolean {
  return diagram.nodes.some((node) => {
    if (node.type !== "entity") {
      return false;
    }

    return (
      (node.internalIdentifiers ?? []).some((identifier) => identifier.attributeIds.includes(attributeId)) ||
      (node.externalIdentifiers ?? []).some((identifier) => identifier.localAttributeIds.includes(attributeId))
    );
  });
}

export function canAttributeHaveCardinality(diagram: DiagramDocument, attribute: AttributeNode): boolean {
  if (attribute.isIdentifier === true || attribute.isCompositeInternal === true) {
    return false;
  }

  return !isAttributeUsedInAnyIdentifier(diagram, attribute.id);
}

export function canAttributeBecomeComposite(diagram: DiagramDocument, attribute: AttributeNode): boolean {
  const host = getAttributeHost(diagram, attribute.id);
  return host?.type !== "attribute";
}

export function canConnect(
  edgeType: EdgeKind,
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
): boolean {
  if (sourceNode.id === targetNode.id) {
    return false;
  }

  if (edgeType === "attribute") {
    const oneIsAttribute =
      sourceNode.type === "attribute" || targetNode.type === "attribute";
    const otherIsAttachable =
      sourceNode.type === "entity" ||
      sourceNode.type === "attribute" ||
      sourceNode.type === "relationship" ||
      targetNode.type === "entity" ||
      targetNode.type === "attribute" ||
      targetNode.type === "relationship";
    return oneIsAttribute && otherIsAttachable;
  }

  if (edgeType === "inheritance") {
    return sourceNode.type === "entity" && targetNode.type === "entity";
  }

  return (
    (sourceNode.type === "entity" && targetNode.type === "relationship") ||
    (sourceNode.type === "relationship" && targetNode.type === "entity")
  );
}

export function edgeAlreadyExists(
  diagram: DiagramDocument,
  edgeType: EdgeKind,
  sourceId: string,
  targetId: string,
): boolean {
  // In Chen notation it can be useful to model more than one connector
  // between the same entity and relationship pair.
  if (edgeType === "connector") {
    return false;
  }

  return diagram.edges.some((edge) => {
    if (edge.type !== edgeType) {
      return false;
    }

    if (edgeType === "inheritance") {
      return edge.sourceId === sourceId && edge.targetId === targetId;
    }

    return (
      (edge.sourceId === sourceId && edge.targetId === targetId) ||
      (edge.sourceId === targetId && edge.targetId === sourceId)
    );
  });
}

function getDuplicateEdgeSignature(edge: DiagramEdge): string | null {
  if (edge.type === "connector") {
    return null;
  }

  if (edge.type === "inheritance") {
    return `${edge.type}:${edge.generalizationGroupId ?? "unassigned"}:${edge.sourceId}->${edge.targetId}`;
  }

  const [firstId, secondId] = [edge.sourceId, edge.targetId].sort();
  return `${edge.type}:${firstId}<->${secondId}`;
}

function resolveAttributeOwnership(
  edge: DiagramEdge,
  nodeMap: Map<string, DiagramNode>,
): { hostId: string; childId: string } | null {
  if (edge.type !== "attribute") {
    return null;
  }

  const sourceNode = nodeMap.get(edge.sourceId);
  const targetNode = nodeMap.get(edge.targetId);
  if (!sourceNode || !targetNode) {
    return null;
  }

  if (sourceNode.type === "attribute" && targetNode.type !== "attribute") {
    return { hostId: targetNode.id, childId: sourceNode.id };
  }

  if (targetNode.type === "attribute" && sourceNode.type !== "attribute") {
    return { hostId: sourceNode.id, childId: targetNode.id };
  }

  if (sourceNode.type === "attribute" && targetNode.type === "attribute") {
    if (sourceNode.isMultivalued === true && targetNode.isMultivalued !== true) {
      return { hostId: sourceNode.id, childId: targetNode.id };
    }

    if (targetNode.isMultivalued === true && sourceNode.isMultivalued !== true) {
      return { hostId: targetNode.id, childId: sourceNode.id };
    }

    return { hostId: targetNode.id, childId: sourceNode.id };
  }

  return null;
}

function getAttributeChildrenByHostId(
  diagram: DiagramDocument,
  nodeMap: Map<string, DiagramNode>,
): Map<string, string[]> {
  const attributeChildrenByHostId = new Map<string, string[]>();

  diagram.edges.forEach((edge) => {
    const ownership = resolveAttributeOwnership(edge, nodeMap);
    if (!ownership) {
      return;
    }

    const children = attributeChildrenByHostId.get(ownership.hostId) ?? [];
    if (!children.includes(ownership.childId)) {
      children.push(ownership.childId);
      attributeChildrenByHostId.set(ownership.hostId, children);
    }
  });

  return attributeChildrenByHostId;
}

function getDirectAttributeIdsByEntityId(
  diagram: DiagramDocument,
  nodeMap: Map<string, DiagramNode>,
): Map<string, Set<string>> {
  const directAttributeIdsByEntityId = new Map<string, Set<string>>();

  diagram.edges.forEach((edge) => {
    if (edge.type !== "attribute") {
      return;
    }

    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);

    if (sourceNode?.type === "entity" && targetNode?.type === "attribute") {
      const ids = directAttributeIdsByEntityId.get(sourceNode.id) ?? new Set<string>();
      ids.add(targetNode.id);
      directAttributeIdsByEntityId.set(sourceNode.id, ids);
      return;
    }

    if (targetNode?.type === "entity" && sourceNode?.type === "attribute") {
      const ids = directAttributeIdsByEntityId.get(targetNode.id) ?? new Set<string>();
      ids.add(sourceNode.id);
      directAttributeIdsByEntityId.set(targetNode.id, ids);
    }
  });

  return directAttributeIdsByEntityId;
}

function normalizeInternalIdentifierSet(
  entity: EntityNode,
  directAttributes: AttributeNode[],
): InternalIdentifier[] {
  const eligibleAttributeIds = new Set(
    directAttributes
      .filter((attribute) => attribute.isMultivalued !== true)
      .map((attribute) => attribute.id),
  );
  const usedAttributeIds = new Set<string>();
  const normalizedIdentifiers: InternalIdentifier[] = [];
  const rawIdentifiers = Array.isArray(entity.internalIdentifiers) ? entity.internalIdentifiers : [];

  rawIdentifiers.forEach((identifier) => {
    const identifierId =
      typeof identifier.id === "string" && identifier.id.trim().length > 0
        ? identifier.id
        : createId("internalIdentifier");

    const normalizedAttributeIds = (Array.isArray(identifier.attributeIds) ? identifier.attributeIds : [])
      .filter((attributeId): attributeId is string => typeof attributeId === "string" && attributeId.length > 0)
      .filter((attributeId, index, source) => source.indexOf(attributeId) === index)
      .filter((attributeId) => eligibleAttributeIds.has(attributeId))
      .filter((attributeId) => {
        if (usedAttributeIds.has(attributeId)) {
          return false;
        }

        usedAttributeIds.add(attributeId);
        return true;
      });

    if (normalizedAttributeIds.length > 0) {
      normalizedIdentifiers.push({
        id: identifierId,
        attributeIds: normalizedAttributeIds,
      });
    }
  });

  // Backward compatibility: simple identifiers toggled from legacy controls
  // should appear in entity.internalIdentifiers as one-attribute entries.
  directAttributes
    .filter((attribute) => attribute.isIdentifier === true && attribute.isMultivalued !== true)
    .forEach((attribute) => {
      if (usedAttributeIds.has(attribute.id)) {
        return;
      }

      usedAttributeIds.add(attribute.id);
      normalizedIdentifiers.push({
        id: `internalIdentifier-simple-${attribute.id}`,
        attributeIds: [attribute.id],
      });
    });

  // Backward compatibility: legacy composite marker on attributes becomes
  // one composite internal identifier if no explicit identifiers claim them.
  const legacyCompositeAttributeIds = directAttributes
    .filter(
      (attribute) =>
        attribute.isCompositeInternal === true &&
        attribute.isMultivalued !== true &&
        !usedAttributeIds.has(attribute.id),
    )
    .map((attribute) => attribute.id);

  if (legacyCompositeAttributeIds.length > 0) {
    legacyCompositeAttributeIds.forEach((attributeId) => usedAttributeIds.add(attributeId));
    normalizedIdentifiers.push({
      id: `internalIdentifier-composite-${entity.id}`,
      attributeIds: legacyCompositeAttributeIds,
    });
  }

  return normalizedIdentifiers;
}

function areInternalIdentifierListsEqual(
  left: InternalIdentifier[] | undefined,
  right: InternalIdentifier[] | undefined,
): boolean {
  const leftList = left ?? [];
  const rightList = right ?? [];

  if (leftList.length !== rightList.length) {
    return false;
  }

  for (let index = 0; index < leftList.length; index += 1) {
    const leftIdentifier = leftList[index];
    const rightIdentifier = rightList[index];
    if (
      leftIdentifier.id !== rightIdentifier.id ||
      leftIdentifier.attributeIds.length !== rightIdentifier.attributeIds.length
    ) {
      return false;
    }

    for (let attributeIndex = 0; attributeIndex < leftIdentifier.attributeIds.length; attributeIndex += 1) {
      if (leftIdentifier.attributeIds[attributeIndex] !== rightIdentifier.attributeIds[attributeIndex]) {
        return false;
      }
    }
  }

  return true;
}

export function synchronizeInternalIdentifiers(diagram: DiagramDocument): DiagramDocument {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const directAttributeIdsByEntityId = getDirectAttributeIdsByEntityId(diagram, nodeMap);
  const normalizedByEntityId = new Map<string, InternalIdentifier[]>();
  const simpleMemberAttributeIds = new Set<string>();
  const compositeMemberAttributeIds = new Set<string>();

  diagram.nodes.forEach((node) => {
    if (node.type !== "entity") {
      return;
    }

    const directAttributes = Array.from(directAttributeIdsByEntityId.get(node.id) ?? [])
      .map((attributeId) => nodeMap.get(attributeId))
      .filter((candidate): candidate is AttributeNode => candidate?.type === "attribute");
    const normalizedIdentifiers = normalizeInternalIdentifierSet(node, directAttributes);

    normalizedByEntityId.set(node.id, normalizedIdentifiers);
    normalizedIdentifiers.forEach((identifier) => {
      if (identifier.attributeIds.length === 1) {
        simpleMemberAttributeIds.add(identifier.attributeIds[0]);
        return;
      }

      identifier.attributeIds.forEach((attributeId) => compositeMemberAttributeIds.add(attributeId));
    });
  });

  let changed = false;
  const nextNodes = diagram.nodes.map((node) => {
    if (node.type === "entity") {
      const normalizedIdentifiers = normalizedByEntityId.get(node.id) ?? [];
      const nextIdentifiers = normalizedIdentifiers.length > 0 ? normalizedIdentifiers : undefined;
      if (areInternalIdentifierListsEqual(node.internalIdentifiers, nextIdentifiers)) {
        return node;
      }

      changed = true;
      return {
        ...node,
        internalIdentifiers: nextIdentifiers,
      };
    }

    if (node.type === "attribute") {
      const nextIsIdentifier = simpleMemberAttributeIds.has(node.id);
      const nextIsCompositeInternal = compositeMemberAttributeIds.has(node.id);
      const normalizedNode = {
        ...node,
        isIdentifier: nextIsIdentifier,
        isCompositeInternal: nextIsCompositeInternal,
      };
      const nextCardinality =
        canAttributeHaveCardinality(diagram, normalizedNode) ? node.cardinality : undefined;
      if (
        node.isIdentifier === nextIsIdentifier &&
        node.isCompositeInternal === nextIsCompositeInternal &&
        node.cardinality === nextCardinality
      ) {
        return node;
      }

      changed = true;
      return {
        ...node,
        isIdentifier: nextIsIdentifier,
        isCompositeInternal: nextIsCompositeInternal,
        cardinality: nextCardinality,
      };
    }

    return node;
  });

  return changed
    ? {
        ...diagram,
        nodes: nextNodes,
      }
    : diagram;
}

export function getExternalIdentifierKind(identifier: ExternalIdentifier): ExternalIdentifierKind {
  return identifier.localAttributeIds.length > 0 ? "imported_plus_local" : "imported_only";
}

export function getExternalIdentifierImportedRelationshipIds(entity: EntityNode): Set<string> {
  return new Set(
    (entity.externalIdentifiers ?? []).flatMap((identifier) =>
      identifier.importedParts.map((part) => part.relationshipId),
    ),
  );
}

export function getExternalIdentifierLocalAttributeIds(entity: EntityNode): Set<string> {
  return new Set(
    (entity.externalIdentifiers ?? []).flatMap((identifier) => identifier.localAttributeIds),
  );
}

export function getEntityDirectAttributes(
  diagram: DiagramDocument,
  entityId: string,
): AttributeNode[] {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  return Array.from(getDirectAttributeIdsByEntityId(diagram, nodeMap).get(entityId) ?? [])
    .map((attributeId) => nodeMap.get(attributeId))
    .filter((candidate): candidate is AttributeNode => candidate?.type === "attribute");
}

export function findInternalIdentifierByAttribute(
  entity: EntityNode,
  attributeId: string,
): InternalIdentifier | undefined {
  return (entity.internalIdentifiers ?? []).find((identifier) => identifier.attributeIds.includes(attributeId));
}

export function getExternalIdentifierSourceEntity(
  diagram: DiagramDocument,
  identifier: ExternalIdentifier,
): EntityNode | undefined {
  const sourceEntity = diagram.nodes.find((node) => node.id === identifier.importedParts[0]?.sourceEntityId);
  return sourceEntity?.type === "entity" ? sourceEntity : undefined;
}

export function getExternalIdentifierImportedIdentifier(
  diagram: DiagramDocument,
  identifier: ExternalIdentifier,
): InternalIdentifier | undefined {
  const sourceEntity = getExternalIdentifierSourceEntity(diagram, identifier);
  return sourceEntity?.internalIdentifiers?.find(
    (candidate) => candidate.id === identifier.importedParts[0]?.importedIdentifierId,
  );
}

export function getExternalIdentifierImportedAttributes(
  diagram: DiagramDocument,
  identifier: ExternalIdentifier,
): AttributeNode[] {
  return identifier.importedParts.flatMap((part) => getExternalIdentifierImportedPartAttributes(diagram, part));
}

export function getExternalIdentifierImportedPartAttributes(
  diagram: DiagramDocument,
  part: ExternalIdentifierImportPart,
): AttributeNode[] {
  const sourceEntity = diagram.nodes.find((node): node is EntityNode => node.id === part.sourceEntityId && node.type === "entity");
  const importedIdentifier = sourceEntity?.internalIdentifiers?.find(
    (candidate) => candidate.id === part.importedIdentifierId,
  );
  if (!sourceEntity || !importedIdentifier) {
    return [];
  }

  const sourceAttributeMap = new Map(
    getEntityDirectAttributes(diagram, sourceEntity.id).map((attribute) => [attribute.id, attribute]),
  );
  return importedIdentifier.attributeIds
    .map((attributeId) => sourceAttributeMap.get(attributeId))
    .filter((attribute): attribute is AttributeNode => attribute !== undefined);
}

function isEligibleLocalExternalIdentifierAttribute(
  attribute: AttributeNode,
  internalIdentifierAttributeIds: Set<string>,
): boolean {
  if (attribute.isMultivalued === true) {
    return false;
  }

  if (attribute.isIdentifier === true || attribute.isCompositeInternal === true) {
    return false;
  }

  if (internalIdentifierAttributeIds.has(attribute.id)) {
    return false;
  }

  return true;
}

export function getEligibleLocalExternalIdentifierAttributes(
  entity: EntityNode,
  attributes: AttributeNode[],
): AttributeNode[] {
  const internalIdentifierAttributeIds = new Set(
    (entity.internalIdentifiers ?? []).flatMap((identifier) => identifier.attributeIds),
  );

  return attributes.filter((attribute) =>
    isEligibleLocalExternalIdentifierAttribute(attribute, internalIdentifierAttributeIds),
  );
}

function normalizeExternalIdentifierSet(
  diagram: DiagramDocument,
  entity: EntityNode,
  nodeMap: Map<string, DiagramNode>,
  directAttributeIdsByEntityId: Map<string, Set<string>>,
): ExternalIdentifier[] {
  const directAttributes = Array.from(directAttributeIdsByEntityId.get(entity.id) ?? [])
    .map((attributeId) => nodeMap.get(attributeId))
    .filter((candidate): candidate is AttributeNode => candidate?.type === "attribute");
  const directAttributeMap = new Map(directAttributes.map((attribute) => [attribute.id, attribute]));
  const internalIdentifierAttributeIds = new Set(
    (entity.internalIdentifiers ?? []).flatMap((identifier) => identifier.attributeIds),
  );
  const usedIdentifierSignatures = new Set<string>();
  const normalizedIdentifiers: ExternalIdentifier[] = [];
  const rawIdentifiers = Array.isArray(entity.externalIdentifiers) ? entity.externalIdentifiers : [];

  rawIdentifiers.forEach((identifier) => {
    const seenImportedPartKeys = new Set<string>();
    const importedParts = Array.isArray(identifier.importedParts)
      ? identifier.importedParts
      : sanitizeExternalIdentifierImportParts(identifier as unknown as {
          importedParts?: unknown;
          relationshipId?: unknown;
          sourceEntityId?: unknown;
          importedIdentifierId?: unknown;
        });
    const normalizedImportedParts = importedParts
      .filter((part) => {
        const relationshipNode = nodeMap.get(part.relationshipId);
        if (relationshipNode?.type !== "relationship") {
          return false;
        }

        const sourceEntity = nodeMap.get(part.sourceEntityId);
        if (sourceEntity?.type !== "entity" || sourceEntity.id === entity.id) {
          return false;
        }

        const importedIdentifier = sourceEntity.internalIdentifiers?.find(
          (candidate) => candidate.id === part.importedIdentifierId,
        );
        if (!importedIdentifier || importedIdentifier.attributeIds.length === 0) {
          return false;
        }

        const sourceDirectAttributeIds = directAttributeIdsByEntityId.get(sourceEntity.id) ?? new Set<string>();
        if (importedIdentifier.attributeIds.some((attributeId) => !sourceDirectAttributeIds.has(attributeId))) {
          return false;
        }

        const participants = normalizeRelationshipExternalIdentifierParticipants(diagram, relationshipNode.id);
        const participantIds = new Set(participants.map((participant) => participant.entity.id));
        if (
          participantIds.size !== 2 ||
          !participantIds.has(entity.id) ||
          !participantIds.has(sourceEntity.id)
        ) {
          return false;
        }

        const dependentParticipant = participants.find((participant) => participant.entity.id === entity.id);
        const dependentCardinality = normalizeCardinality(
          dependentParticipant
            ? getConnectorParticipation(
                dependentParticipant.edge,
                nodeMap.get(dependentParticipant.edge.sourceId),
                nodeMap.get(dependentParticipant.edge.targetId),
              )?.cardinality
            : undefined,
        );
        if (dependentCardinality !== "1,1") {
          return false;
        }

        const key = [relationshipNode.id, sourceEntity.id, importedIdentifier.id].join("|");
        if (seenImportedPartKeys.has(key)) {
          return false;
        }

        seenImportedPartKeys.add(key);
        return true;
      })
      .map((part) => ({
        id:
          typeof part.id === "string" && part.id.trim().length > 0
            ? part.id
            : createId("externalIdentifierPart"),
        relationshipId: part.relationshipId,
        sourceEntityId: part.sourceEntityId,
        importedIdentifierId: part.importedIdentifierId,
      }));

    if (normalizedImportedParts.length === 0) {
      return;
    }

    const seenLocalAttributeIds = new Set<string>();
    const normalizedLocalAttributeIds = (Array.isArray(identifier.localAttributeIds)
      ? identifier.localAttributeIds
      : []
    )
      .filter((attributeId): attributeId is string => typeof attributeId === "string" && attributeId.length > 0)
      .filter((attributeId) => {
        if (seenLocalAttributeIds.has(attributeId)) {
          return false;
        }

        seenLocalAttributeIds.add(attributeId);
        return true;
      })
      .filter((attributeId) => {
        const attribute = directAttributeMap.get(attributeId);
        return (
          attribute !== undefined &&
          isEligibleLocalExternalIdentifierAttribute(attribute, internalIdentifierAttributeIds)
        );
      });

    const importedSignature = normalizedImportedParts
      .map((part) => [part.relationshipId, part.sourceEntityId, part.importedIdentifierId].join(":"))
      .sort()
      .join(",");
    const signature = [importedSignature, [...normalizedLocalAttributeIds].sort().join(",")].join("|");
    if (usedIdentifierSignatures.has(signature)) {
      return;
    }

    usedIdentifierSignatures.add(signature);
    normalizedIdentifiers.push({
      id:
        typeof identifier.id === "string" && identifier.id.trim().length > 0
          ? identifier.id
          : createId("externalIdentifier"),
      importedParts: normalizedImportedParts,
      localAttributeIds: normalizedLocalAttributeIds,
      offset:
        typeof identifier.offset === "number" && Number.isFinite(identifier.offset)
          ? identifier.offset
          : undefined,
      markerOffsetX:
        typeof identifier.markerOffsetX === "number" && Number.isFinite(identifier.markerOffsetX)
          ? identifier.markerOffsetX
          : undefined,
      markerOffsetY:
        typeof identifier.markerOffsetY === "number" && Number.isFinite(identifier.markerOffsetY)
          ? identifier.markerOffsetY
          : undefined,
    });
  });

  return normalizedIdentifiers;
}

export function synchronizeExternalIdentifiers(diagram: DiagramDocument): DiagramDocument {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const directAttributeIdsByEntityId = getDirectAttributeIdsByEntityId(diagram, nodeMap);
  const externalIdentifierAttributeIds = new Set<string>();
  let changed = false;

  const nextNodes = diagram.nodes.map((node) => {
    if (node.type !== "entity") {
      return node;
    }

    const normalizedIdentifiers = normalizeExternalIdentifierSet(
      diagram,
      node,
      nodeMap,
      directAttributeIdsByEntityId,
    );
    const nextIdentifiers = normalizedIdentifiers.length > 0 ? normalizedIdentifiers : undefined;
    normalizedIdentifiers.forEach((identifier) => {
      identifier.localAttributeIds.forEach((attributeId) => externalIdentifierAttributeIds.add(attributeId));
    });
    if (areExternalIdentifierListsEqual(node.externalIdentifiers, nextIdentifiers)) {
      return node;
    }

    changed = true;
    return {
      ...node,
      externalIdentifiers: nextIdentifiers,
    };
  });

  const cardinalityNormalizedNodes = nextNodes.map((node) => {
    if (
      node.type !== "attribute" ||
      !externalIdentifierAttributeIds.has(node.id) ||
      node.cardinality === undefined
    ) {
      return node;
    }

    changed = true;
    return {
      ...node,
      cardinality: undefined,
    };
  });

  return changed
    ? {
        ...diagram,
        nodes: cardinalityNormalizedNodes,
      }
    : diagram;
}

export function removeSelection(
  diagram: DiagramDocument,
  selection: SelectionState,
): DiagramDocument {
  const selectedNodeIds = new Set(selection.nodeIds);
  const selectedEdgeIds = new Set(selection.edgeIds);
  const deletedInheritanceEdges = diagram.edges.filter(
    (edge): edge is Extract<DiagramEdge, { type: "inheritance" }> =>
      edge.type === "inheritance" && selectedEdgeIds.has(edge.id),
  );

  if (selectedNodeIds.size > 0) {
    const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
    const attributeChildrenByHostId = getAttributeChildrenByHostId(diagram, nodeMap);
    const queue = Array.from(selectedNodeIds);
    const processedHosts = new Set<string>();

    while (queue.length > 0) {
      const hostId = queue.shift() as string;
      if (processedHosts.has(hostId)) {
        continue;
      }
      processedHosts.add(hostId);

      const hostNode = nodeMap.get(hostId);
      const canOwnAttributes =
        hostNode?.type === "entity" ||
        hostNode?.type === "relationship" ||
        hostNode?.type === "attribute";
      if (!canOwnAttributes) {
        continue;
      }

      const childIds = attributeChildrenByHostId.get(hostId) ?? [];
      childIds.forEach((childId) => {
        const childNode = nodeMap.get(childId);
        if (childNode?.type !== "attribute" || selectedNodeIds.has(childId)) {
          return;
        }

        selectedNodeIds.add(childId);
        queue.push(childId);
      });
    }
  }

  const nextDiagram = {
    ...diagram,
    nodes: diagram.nodes.filter((node) => !selectedNodeIds.has(node.id)),
    edges: diagram.edges.filter(
      (edge) =>
        !selectedEdgeIds.has(edge.id) &&
        !selectedNodeIds.has(edge.sourceId) &&
        !selectedNodeIds.has(edge.targetId),
    ),
    generalizationGroups: (diagram.generalizationGroups ?? [])
      .filter((group) => !selectedNodeIds.has(group.supertypeId))
      .map((group) => {
        const deletedSubtypes = new Set(
          deletedInheritanceEdges
            .filter((edge) => edge.generalizationGroupId === group.id)
            .map((edge) => edge.sourceId),
        );
        return {
          ...group,
          subtypeIds: group.subtypeIds.filter(
            (subtypeId) => !selectedNodeIds.has(subtypeId) && !deletedSubtypes.has(subtypeId),
          ),
        };
      }),
  };

  return mergeCompatibleGeneralizationGroups(cleanupGeneralizationReferences(nextDiagram));
}

export function duplicateSelection(
  diagram: DiagramDocument,
  selection: SelectionState,
): { diagram: DiagramDocument; selection: SelectionState } | null {
  return duplicateDiagramSelection(diagram, selection);
}

export function alignNodes(
  diagram: DiagramDocument,
  nodeIds: string[],
  axis: "left" | "center" | "top" | "middle",
): DiagramDocument {
  const selectedNodes = diagram.nodes.filter((node) => nodeIds.includes(node.id));

  if (selectedNodes.length < 2) {
    return diagram;
  }

  const minX = Math.min(...selectedNodes.map((node) => node.x));
  const minY = Math.min(...selectedNodes.map((node) => node.y));
  const centerX =
    selectedNodes.reduce((sum, node) => sum + node.x + node.width / 2, 0) /
    selectedNodes.length;
  const centerY =
    selectedNodes.reduce((sum, node) => sum + node.y + node.height / 2, 0) /
    selectedNodes.length;

  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      if (!nodeIds.includes(node.id)) {
        return node;
      }

      if (axis === "left") {
        return { ...node, x: snapValue(minX) };
      }

      if (axis === "top") {
        return { ...node, y: snapValue(minY) };
      }

      if (axis === "center") {
        return { ...node, x: snapValue(centerX - node.width / 2) };
      }

      return { ...node, y: snapValue(centerY - node.height / 2) };
    }),
  };
}

export function expandNodeIdsForMove(diagram: DiagramDocument, nodeIds: string[]): string[] {
  if (nodeIds.length === 0) {
    return [];
  }

  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const attributeChildrenByHostId = getAttributeChildrenByHostId(diagram, nodeMap);

  const expanded = new Set(nodeIds);
  const queue: string[] = [];
  const processedHosts = new Set<string>();

  nodeIds.forEach((nodeId) => {
    const node = nodeMap.get(nodeId);
    if (
      node?.type === "entity" ||
      node?.type === "relationship" ||
      (node?.type === "attribute" && node.isMultivalued === true)
    ) {
      queue.push(nodeId);
    }
  });

  while (queue.length > 0) {
    const hostId = queue.shift() as string;
    if (processedHosts.has(hostId)) {
      continue;
    }
    processedHosts.add(hostId);

    const childIds = attributeChildrenByHostId.get(hostId) ?? [];
    childIds.forEach((otherId) => {
      const otherNode = nodeMap.get(otherId);
      if (otherNode?.type !== "attribute") {
        return;
      }

      if (!expanded.has(otherId)) {
        expanded.add(otherId);
      }

      if (!processedHosts.has(otherId)) {
        queue.push(otherId);
      }
    });
  }

  return Array.from(expanded);
}

export function serializeDiagram(diagram: DiagramDocument): string {
  const normalizedDiagram = normalizeGeneralizationGroups(synchronizeExternalIdentifiers(
    synchronizeInternalIdentifiers(
      synchronizeEntityRelationshipParticipations(synchronizeNodeNameIdentity(diagram).diagram),
    ),
  ));
  const normalizedEdges = normalizedDiagram.edges.map(removeDisallowedManualRouting);
  const normalizedNotes = normalizeDiagramNotes((normalizedDiagram as { notes?: unknown }).notes);

  return JSON.stringify(
    {
      ...normalizedDiagram,
      edges: normalizedEdges,
      meta: {
        ...normalizedDiagram.meta,
        version: CURRENT_DIAGRAM_VERSION,
      },
      notes: normalizedNotes,
    },
    null,
    2,
  );
}

function isGeneralizationGroupLike(value: unknown): value is Partial<GeneralizationGroup> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function allocateUniqueDiagramId(usedIds: Set<string>, requestedId: string): string {
  const fallback = requestedId.trim().length > 0 ? requestedId : "id";
  let id = fallback;
  let suffix = 2;
  while (usedIds.has(id)) {
    id = `${fallback}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(id);
  return id;
}

function formatIsaConstraintIdSuffix(completeness: IsaCompleteness, disjointness: IsaDisjointness): string {
  return `${completeness === "total" ? "t" : "p"}-${disjointness === "disjoint" ? "e" : "o"}`;
}

function formatIsaConstraintLabel(completeness?: IsaCompleteness, disjointness?: IsaDisjointness): string {
  if (!completeness || !disjointness) {
    return "";
  }
  return `(${completeness === "total" ? "t" : "p"},${disjointness === "disjoint" ? "e" : "o"})`;
}

export function normalizeGeneralizationGroups(diagram: DiagramDocument): DiagramDocument {
  const entityIds = new Set(diagram.nodes.filter((node) => node.type === "entity").map((node) => node.id));
  const rawGroups = Array.isArray(diagram.generalizationGroups) ? diagram.generalizationGroups : [];
  const groupById = new Map<string, GeneralizationGroup>();
  const usedGroupIds = new Set<string>();
  const usedEdgeIds = new Set(diagram.edges.map((edge) => edge.id));

  rawGroups.forEach((group, index) => {
    if (!isGeneralizationGroupLike(group) || typeof group.supertypeId !== "string" || !entityIds.has(group.supertypeId)) {
      return;
    }

    const subtypeIds = Array.isArray(group.subtypeIds)
      ? Array.from(
          new Set(
            group.subtypeIds.filter(
              (subtypeId): subtypeId is string =>
                typeof subtypeId === "string" && entityIds.has(subtypeId) && subtypeId !== group.supertypeId,
            ),
          ),
        )
      : [];

    const baseId = typeof group.id === "string" && group.id.trim().length > 0 ? group.id : `generalization-${index + 1}`;
    const id = allocateUniqueDiagramId(usedGroupIds, baseId);
    groupById.set(id, {
      id,
      supertypeId: group.supertypeId,
      subtypeIds,
      isaCompleteness: isIsaCompleteness(group.isaCompleteness) ? group.isaCompleteness : undefined,
      isaDisjointness: isIsaDisjointness(group.isaDisjointness) ? group.isaDisjointness : undefined,
      label: typeof group.label === "string" && group.label.trim().length > 0 ? group.label : undefined,
      junctionOffsetX: isFiniteNumber(group.junctionOffsetX) ? group.junctionOffsetX : undefined,
      junctionOffsetY: isFiniteNumber(group.junctionOffsetY) ? group.junctionOffsetY : undefined,
    });
  });

  const groupKeyToId = new Map<string, string>();
  groupById.forEach((group) => {
    if (group.isaCompleteness && group.isaDisjointness) {
      groupKeyToId.set(`${group.supertypeId}:${group.isaCompleteness}:${group.isaDisjointness}`, group.id);
    }
  });

  const nextEdges: DiagramEdge[] = [];
  const inheritanceSignatureOwners = new Set<string>();

  diagram.edges.forEach((edge) => {
    if (edge.type !== "inheritance") {
      nextEdges.push(edge);
      return;
    }

    if (!entityIds.has(edge.sourceId) || !entityIds.has(edge.targetId) || edge.sourceId === edge.targetId) {
      return;
    }

    const referencedGroup =
      edge.generalizationGroupId && groupById.has(edge.generalizationGroupId)
        ? groupById.get(edge.generalizationGroupId)
        : undefined;
    const edgeCompleteness = isIsaCompleteness(edge.isaCompleteness) ? edge.isaCompleteness : undefined;
    const edgeDisjointness = isIsaDisjointness(edge.isaDisjointness) ? edge.isaDisjointness : undefined;
    const hasCompleteEdgeConstraint = edgeCompleteness !== undefined && edgeDisjointness !== undefined;
    const targetGroup = referencedGroup
      ? referencedGroup
      : !edge.generalizationGroupId && hasCompleteEdgeConstraint
        ? (() => {
            const key = `${edge.targetId}:${edgeCompleteness}:${edgeDisjointness}`;
            const existingId = groupKeyToId.get(key);
            if (existingId) {
              return groupById.get(existingId);
            }
            const id = allocateUniqueDiagramId(
              usedGroupIds,
              `generalization-${edge.targetId}-${formatIsaConstraintIdSuffix(edgeCompleteness as IsaCompleteness, edgeDisjointness as IsaDisjointness)}`,
            );
            const group: GeneralizationGroup = {
              id,
              supertypeId: edge.targetId,
              subtypeIds: [],
              isaCompleteness: edgeCompleteness,
              isaDisjointness: edgeDisjointness,
              label: `ISA ${formatIsaConstraintLabel(edgeCompleteness, edgeDisjointness)}`,
            };
            groupById.set(id, group);
            groupKeyToId.set(key, id);
            return group;
          })()
        : undefined;

    if (!targetGroup) {
      nextEdges.push({
        ...edge,
        label: "",
        generalizationGroupId: edge.generalizationGroupId,
        isaCompleteness: undefined,
        isaDisjointness: undefined,
      });
      return;
    }

    const supertypeId = targetGroup.supertypeId;
    if (!entityIds.has(supertypeId) || edge.sourceId === supertypeId) {
      nextEdges.push(edge);
      return;
    }

    if (!targetGroup.subtypeIds.includes(edge.sourceId)) {
      targetGroup.subtypeIds = [...targetGroup.subtypeIds, edge.sourceId];
    }
    groupById.set(targetGroup.id, targetGroup);
    const signature = `${targetGroup.id}:${edge.sourceId}->${supertypeId}`;
    if (inheritanceSignatureOwners.has(signature)) {
      return;
    }
    inheritanceSignatureOwners.add(signature);
    nextEdges.push({
      ...edge,
      label: "",
      targetId: supertypeId,
      generalizationGroupId: targetGroup.id,
      isaCompleteness: targetGroup.isaCompleteness,
      isaDisjointness: targetGroup.isaDisjointness,
    });
  });

  Array.from(groupById.values()).forEach((group) => {
    group.subtypeIds = Array.from(
      new Set(group.subtypeIds.filter((subtypeId) => entityIds.has(subtypeId) && subtypeId !== group.supertypeId)),
    );
    group.subtypeIds.forEach((subtypeId) => {
      if (!entityIds.has(subtypeId) || !entityIds.has(group.supertypeId)) {
        return;
      }
      const signature = `${group.id}:${subtypeId}->${group.supertypeId}`;
      if (inheritanceSignatureOwners.has(signature)) {
        return;
      }
      inheritanceSignatureOwners.add(signature);
      nextEdges.push({
        id: allocateUniqueDiagramId(usedEdgeIds, `inheritance-${subtypeId}-${group.supertypeId}-${group.id}`),
        type: "inheritance",
        sourceId: subtypeId,
        targetId: group.supertypeId,
        label: "",
        lineStyle: "solid",
        generalizationGroupId: group.id,
        isaCompleteness: group.isaCompleteness,
        isaDisjointness: group.isaDisjointness,
      });
    });
  });

  return cleanupGeneralizationReferences({
    ...diagram,
    edges: nextEdges,
    generalizationGroups: Array.from(groupById.values()).filter((group) => group.subtypeIds.length > 0),
  });
}

export function cleanupGeneralizationReferences(diagram: DiagramDocument): DiagramDocument {
  const entityIds = new Set(diagram.nodes.filter((node) => node.type === "entity").map((node) => node.id));
  const groups = (diagram.generalizationGroups ?? [])
    .filter((group) => entityIds.has(group.supertypeId))
    .map((group) => ({
      ...group,
      subtypeIds: Array.from(
        new Set(group.subtypeIds.filter((subtypeId) => entityIds.has(subtypeId) && subtypeId !== group.supertypeId)),
      ),
    }))
    .filter((group) => group.subtypeIds.length > 0);
  const groupById = new Map(groups.map((group) => [group.id, group]));

  const edges = diagram.edges.flatMap((edge): DiagramEdge[] => {
    if (edge.type !== "inheritance") {
      return [edge];
    }

    if (!entityIds.has(edge.sourceId) || !entityIds.has(edge.targetId) || edge.sourceId === edge.targetId) {
      return [];
    }

    if (!edge.generalizationGroupId) {
      return [
        {
          ...edge,
          label: "",
          generalizationGroupId: undefined,
          isaCompleteness: undefined,
          isaDisjointness: undefined,
        },
      ];
    }

    const group = groupById.get(edge.generalizationGroupId);
    if (!group || !group.subtypeIds.includes(edge.sourceId)) {
      return [
        {
          ...edge,
          label: "",
          generalizationGroupId: undefined,
          isaCompleteness: undefined,
          isaDisjointness: undefined,
        },
      ];
    }

    return [
      {
        ...edge,
        label: "",
        targetId: group.supertypeId,
        isaCompleteness: group.isaCompleteness,
        isaDisjointness: group.isaDisjointness,
      },
    ];
  });

  return {
    ...diagram,
    edges,
    generalizationGroups: groups,
  };
}

export function mergeCompatibleGeneralizationGroups(diagram: DiagramDocument): DiagramDocument {
  // Kept as a compatibility entry point for older callers. Group identity is
  // the stable GeneralizationGroup.id: same supertype and ISA constraints no
  // longer imply that two explicit groups should be merged.
  return cleanupGeneralizationReferences(diagram);
}

export function assignInheritanceConstraintToGroup(
  diagram: DiagramDocument,
  edgeId: string,
  isaCompleteness: IsaCompleteness,
  isaDisjointness: IsaDisjointness,
): DiagramDocument {
  const normalized = normalizeGeneralizationGroups(diagram);
  const edge = normalized.edges.find(
    (candidate): candidate is Extract<DiagramEdge, { type: "inheritance" }> =>
      candidate.id === edgeId && candidate.type === "inheritance",
  );
  if (!edge) {
    return normalized;
  }

  const usedGroupIds = new Set([...(normalized.generalizationGroups ?? []).map((group) => group.id), ...normalized.edges.map((candidate) => candidate.id)]);
  const groupId = edge.generalizationGroupId && (normalized.generalizationGroups ?? []).some((group) => group.id === edge.generalizationGroupId)
    ? edge.generalizationGroupId
    : allocateUniqueDiagramId(
        usedGroupIds,
        `generalization-${edge.targetId}-${formatIsaConstraintIdSuffix(isaCompleteness, isaDisjointness)}`,
      );
  const groupExists = (normalized.generalizationGroups ?? []).some((group) => group.id === groupId);
  const nextGroups = groupExists
    ? (normalized.generalizationGroups ?? []).map((group) =>
        group.id === groupId
          ? {
              ...group,
              supertypeId: edge.targetId,
              subtypeIds: Array.from(new Set([...group.subtypeIds, edge.sourceId])),
              isaCompleteness,
              isaDisjointness,
              label: group.label ?? `ISA ${formatIsaConstraintLabel(isaCompleteness, isaDisjointness)}`,
            }
          : group.id === edge.generalizationGroupId
            ? { ...group, subtypeIds: group.subtypeIds.filter((subtypeId) => subtypeId !== edge.sourceId) }
            : group,
      )
    : [
        ...(normalized.generalizationGroups ?? []),
        {
          id: groupId,
          supertypeId: edge.targetId,
          subtypeIds: [edge.sourceId],
          isaCompleteness,
          isaDisjointness,
          label: `ISA ${formatIsaConstraintLabel(isaCompleteness, isaDisjointness)}`,
        },
      ];
  const nextEdges = normalized.edges.map((candidate) =>
    candidate.type === "inheritance" && candidate.id === edge.id
      ? {
          ...candidate,
          label: "",
          generalizationGroupId: groupId,
          isaCompleteness,
          isaDisjointness,
        }
      : candidate,
  );

  return normalizeGeneralizationGroups({
    ...normalized,
    edges: nextEdges,
    generalizationGroups: nextGroups,
  });
}

export function createGeneralizationGroupForInheritanceEdge(
  diagram: DiagramDocument,
  edgeId: string,
  label: string,
  isaCompleteness: IsaCompleteness,
  isaDisjointness: IsaDisjointness,
): DiagramDocument {
  const normalized = normalizeGeneralizationGroups(diagram);
  const edge = normalized.edges.find(
    (candidate): candidate is Extract<DiagramEdge, { type: "inheritance" }> =>
      candidate.id === edgeId && candidate.type === "inheritance",
  );
  if (!edge) {
    return normalized;
  }

  const normalizedLabel = label.trim();
  const requestedId = normalizedLabel
    ? `generalization-${edge.targetId}-${normalizedLabel.toLowerCase().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "")}`
    : `generalization-${edge.targetId}-${formatIsaConstraintIdSuffix(isaCompleteness, isaDisjointness)}`;
  const usedGroupIds = new Set([...(normalized.generalizationGroups ?? []).map((group) => group.id), ...normalized.edges.map((candidate) => candidate.id)]);
  const groupId = allocateUniqueDiagramId(usedGroupIds, requestedId);
  const nextGroups: GeneralizationGroup[] = [
    ...(normalized.generalizationGroups ?? []).map((group) =>
      group.id === edge.generalizationGroupId
        ? { ...group, subtypeIds: group.subtypeIds.filter((subtypeId) => subtypeId !== edge.sourceId) }
        : group,
    ),
    {
      id: groupId,
      supertypeId: edge.targetId,
      subtypeIds: [edge.sourceId],
      isaCompleteness,
      isaDisjointness,
      label: normalizedLabel,
    },
  ];
  const nextEdges = normalized.edges.map((candidate) =>
    candidate.type === "inheritance" && candidate.id === edge.id
      ? {
          ...candidate,
          label: "",
          generalizationGroupId: groupId,
          isaCompleteness,
          isaDisjointness,
        }
      : candidate,
  );

  return normalizeGeneralizationGroups({
    ...normalized,
    edges: nextEdges,
    generalizationGroups: nextGroups,
  });
}

export function assignInheritanceEdgeToGeneralizationGroup(
  diagram: DiagramDocument,
  edgeId: string,
  groupId: string,
): DiagramDocument {
  const normalized = normalizeGeneralizationGroups(diagram);
  const edge = normalized.edges.find(
    (candidate): candidate is Extract<DiagramEdge, { type: "inheritance" }> =>
      candidate.id === edgeId && candidate.type === "inheritance",
  );
  const group = (normalized.generalizationGroups ?? []).find((candidate) => candidate.id === groupId);
  if (!edge || !group || group.supertypeId !== edge.targetId) {
    return normalized;
  }

  const nextGroups = (normalized.generalizationGroups ?? []).map((candidate) => {
    if (candidate.id === group.id) {
      return { ...candidate, subtypeIds: Array.from(new Set([...candidate.subtypeIds, edge.sourceId])) };
    }
    if (candidate.id === edge.generalizationGroupId) {
      return { ...candidate, subtypeIds: candidate.subtypeIds.filter((subtypeId) => subtypeId !== edge.sourceId) };
    }
    return candidate;
  });
  const nextEdges = normalized.edges.map((candidate) =>
    candidate.type === "inheritance" && candidate.id === edge.id
      ? {
          ...candidate,
          label: "",
          targetId: group.supertypeId,
          generalizationGroupId: group.id,
          isaCompleteness: group.isaCompleteness,
          isaDisjointness: group.isaDisjointness,
        }
      : candidate,
  );

  return normalizeGeneralizationGroups({
    ...normalized,
    edges: nextEdges,
    generalizationGroups: nextGroups,
  });
}

export function updateGeneralizationGroupDetails(
  diagram: DiagramDocument,
  groupId: string,
  patch: {
    label?: string;
    isaCompleteness?: IsaCompleteness;
    isaDisjointness?: IsaDisjointness;
  },
): DiagramDocument {
  const group = (diagram.generalizationGroups ?? []).find((candidate) => candidate.id === groupId);
  if (!group) {
    return normalizeGeneralizationGroups(diagram);
  }

  const isaCompleteness = patch.isaCompleteness ?? group.isaCompleteness;
  const isaDisjointness = patch.isaDisjointness ?? group.isaDisjointness;
  return normalizeGeneralizationGroups({
    ...diagram,
    generalizationGroups: (diagram.generalizationGroups ?? []).map((candidate) =>
      candidate.id === groupId
        ? {
            ...candidate,
            label: patch.label !== undefined ? patch.label.trim() : candidate.label,
            isaCompleteness,
            isaDisjointness,
          }
        : candidate,
    ),
    edges: diagram.edges.map((edge) =>
      edge.type === "inheritance" && edge.generalizationGroupId === groupId
        ? { ...edge, label: "", isaCompleteness, isaDisjointness }
        : edge,
    ),
  });
}

export function updateGeneralizationGroupConstraint(
  diagram: DiagramDocument,
  groupId: string,
  isaCompleteness: IsaCompleteness,
  isaDisjointness: IsaDisjointness,
): DiagramDocument {
  return normalizeGeneralizationGroups({
    ...diagram,
    generalizationGroups: (diagram.generalizationGroups ?? []).map((group) =>
      group.id === groupId
        ? {
            ...group,
            isaCompleteness,
            isaDisjointness,
            label: group.label ?? `ISA ${formatIsaConstraintLabel(isaCompleteness, isaDisjointness)}`,
          }
        : group,
    ),
    edges: diagram.edges.map((edge) =>
      edge.type === "inheritance" && edge.generalizationGroupId === groupId
        ? { ...edge, label: "", isaCompleteness, isaDisjointness }
        : edge,
    ),
  });
}

export function removeSubtypeFromGeneralizationGroup(
  diagram: DiagramDocument,
  groupId: string,
  subtypeId: string,
): DiagramDocument {
  return normalizeGeneralizationGroups({
    ...diagram,
    generalizationGroups: (diagram.generalizationGroups ?? []).map((group) =>
      group.id === groupId
        ? { ...group, subtypeIds: group.subtypeIds.filter((candidate) => candidate !== subtypeId) }
        : group,
    ),
    edges: diagram.edges.map((edge) =>
      edge.type === "inheritance" && edge.generalizationGroupId === groupId && edge.sourceId === subtypeId
        ? {
            ...edge,
            label: "",
            generalizationGroupId: undefined,
            isaCompleteness: undefined,
            isaDisjointness: undefined,
          }
        : edge,
    ),
  });
}

export function findGeneralizationGroupsForEntity(
  diagram: DiagramDocument,
  entityId: string,
): GeneralizationGroup[] {
  return (diagram.generalizationGroups ?? []).filter(
    (group) => group.supertypeId === entityId || group.subtypeIds.includes(entityId),
  );
}

export function isEntityInGeneralizationGroup(diagram: DiagramDocument, entityId: string): boolean {
  return findGeneralizationGroupsForEntity(diagram, entityId).length > 0;
}

export function removeEntityFromGeneralizationHierarchy(
  diagram: DiagramDocument,
  entityId: string,
): DiagramDocument {
  const groups = diagram.generalizationGroups ?? [];
  const affectedGroups = findGeneralizationGroupsForEntity(diagram, entityId);
  if (affectedGroups.length === 0) {
    return diagram;
  }

  const removedGroupIds = new Set<string>();
  const reducedGroupIds = new Set<string>();
  const nextGroups: GeneralizationGroup[] = [];

  groups.forEach((group) => {
    const entityIsSupertype = group.supertypeId === entityId;
    const entityIsSubtype = group.subtypeIds.includes(entityId);
    if (!entityIsSupertype && !entityIsSubtype) {
      nextGroups.push(group);
      return;
    }

    if (entityIsSupertype) {
      removedGroupIds.add(group.id);
      return;
    }

    const subtypeIds = group.subtypeIds.filter((subtypeId) => subtypeId !== entityId);
    if (subtypeIds.length === 0) {
      removedGroupIds.add(group.id);
      return;
    }

    reducedGroupIds.add(group.id);
    nextGroups.push({
      ...group,
      subtypeIds,
    });
  });

  const nextEdges = diagram.edges.filter((edge) => {
    if (edge.type !== "inheritance") {
      return true;
    }

    if (edge.generalizationGroupId && removedGroupIds.has(edge.generalizationGroupId)) {
      return false;
    }

    return !(
      edge.generalizationGroupId !== undefined &&
      reducedGroupIds.has(edge.generalizationGroupId) &&
      edge.sourceId === entityId
    );
  });

  return {
    ...diagram,
    edges: nextEdges,
    generalizationGroups: nextGroups.length > 0 ? nextGroups : undefined,
  };
}

export function deleteGeneralizationGroup(diagram: DiagramDocument, groupId: string): DiagramDocument {
  return normalizeGeneralizationGroups({
    ...diagram,
    generalizationGroups: (diagram.generalizationGroups ?? []).filter((group) => group.id !== groupId),
    edges: diagram.edges.map((edge) =>
      edge.type === "inheritance" && edge.generalizationGroupId === groupId
        ? {
            ...edge,
            label: "",
            generalizationGroupId: undefined,
            isaCompleteness: undefined,
            isaDisjointness: undefined,
          }
        : edge,
    ),
  });
}

export function getGeneralizationGroupsForSupertype(diagram: DiagramDocument, supertypeId: string): GeneralizationGroup[] {
  return (diagram.generalizationGroups ?? []).filter((group) => group.supertypeId === supertypeId);
}

export function getGeneralizationGroupForEdge(
  diagram: DiagramDocument,
  edgeId: string,
): GeneralizationGroup | undefined {
  const edge = diagram.edges.find((candidate) => candidate.id === edgeId);
  return edge?.type === "inheritance" && edge.generalizationGroupId
    ? (diagram.generalizationGroups ?? []).find((group) => group.id === edge.generalizationGroupId)
    : undefined;
}

function isNodeKind(value: string): value is NodeKind {
  return ["entity", "relationship", "attribute"].includes(value);
}

function isEdgeKind(value: string): value is EdgeKind {
  return ["connector", "attribute", "inheritance"].includes(value);
}

function isIsaDisjointness(value: string | undefined): value is IsaDisjointness {
  return value === "disjoint" || value === "overlap";
}

function isIsaCompleteness(value: string | undefined): value is IsaCompleteness {
  return value === "total" || value === "partial";
}

function normalizeCardinality(value: string | undefined): string {
  if (!value) {
    return "";
  }

  return value
    .replace(/\s+/g, "")
    .replace(/[()]/g, "")
    .replace(":", ",");
}

function connectorCardinalityHasMaxOne(value: string | undefined): value is string {
  const normalized = normalizeSupportedCardinality(value);
  if (!normalized) {
    return false;
  }

  const match = normalized.match(/^\(([^,]+),([^)]+)\)$/);
  return match?.[2] === "1";
}

function buildExternalIdentifierInvalidationMessage(
  hostEntityLabel: string,
  relationshipLabel: string | undefined,
  reason: string,
): string {
  const relationshipSegment = relationshipLabel ? ` collegato alla relazione "${relationshipLabel}"` : "";
  return `L'identificatore esterno su "${hostEntityLabel}"${relationshipSegment} non e piu valido perche ${reason}.`;
}

function findEntityHostForAttribute(diagram: DiagramDocument, attributeId: string): EntityNode | undefined {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const visited = new Set<string>();
  let currentAttributeId = attributeId;

  while (!visited.has(currentAttributeId)) {
    visited.add(currentAttributeId);
    const connectedAttributeEdges = diagram.edges.filter(
      (edge) =>
        edge.type === "attribute" &&
        (edge.sourceId === currentAttributeId || edge.targetId === currentAttributeId),
    );
    if (connectedAttributeEdges.length === 0) {
      return undefined;
    }

    const edgeWithNonAttributeHost = connectedAttributeEdges.find((edge) => {
      const hostId = edge.sourceId === currentAttributeId ? edge.targetId : edge.sourceId;
      const hostNode = nodeMap.get(hostId);
      return hostNode?.type !== "attribute";
    });
    const chosenEdge = edgeWithNonAttributeHost ?? connectedAttributeEdges[0];
    if (!chosenEdge) {
      return undefined;
    }

    const hostId = chosenEdge.sourceId === currentAttributeId ? chosenEdge.targetId : chosenEdge.sourceId;
    const hostNode = nodeMap.get(hostId);
    if (!hostNode) {
      return undefined;
    }

    if (hostNode.type === "entity") {
      return hostNode;
    }

    if (hostNode.type !== "attribute") {
      return undefined;
    }

    currentAttributeId = hostNode.id;
  }

  return undefined;
}

function normalizeRelationshipExternalIdentifierParticipants(
  diagram: DiagramDocument,
  relationshipId: string,
): Array<{ edge: ConnectorEdge; entity: EntityNode }> {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  return diagram.edges
    .filter(
      (edge): edge is ConnectorEdge =>
        edge.type === "connector" && (edge.sourceId === relationshipId || edge.targetId === relationshipId),
    )
    .map((edge) => {
      const entityId = edge.sourceId === relationshipId ? edge.targetId : edge.sourceId;
      const entityNode = nodeMap.get(entityId);
      return entityNode?.type === "entity" ? { edge, entity: entityNode } : null;
    })
    .filter((candidate): candidate is { edge: ConnectorEdge; entity: EntityNode } => candidate !== null);
}

function describeInternalIdentifier(
  identifier: InternalIdentifier,
  attributesById: Map<string, AttributeNode>,
): string {
  return identifier.attributeIds
    .map((attributeId) => attributesById.get(attributeId)?.label ?? attributeId)
    .join(", ");
}

export function getEligibleImportedIdentifierParts(
  diagram: DiagramDocument,
  hostEntityId: string,
): ExternalIdentifierImportPartOption[] {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const hostEntity = nodeMap.get(hostEntityId);
  if (hostEntity?.type !== "entity") {
    return [];
  }

  const options = new Map<string, ExternalIdentifierImportPartOption>();
  diagram.nodes.forEach((node) => {
    if (node.type !== "relationship") {
      return;
    }

    const participants = normalizeRelationshipExternalIdentifierParticipants(diagram, node.id);
    const participantByEntityId = new Map(participants.map((participant) => [participant.entity.id, participant]));
    const hostParticipant = participantByEntityId.get(hostEntity.id);
    if (!hostParticipant || participants.length !== 2) {
      return;
    }

    const hostCardinality = normalizeCardinality(
      getConnectorParticipation(
        hostParticipant.edge,
        nodeMap.get(hostParticipant.edge.sourceId),
        nodeMap.get(hostParticipant.edge.targetId),
      )?.cardinality,
    );
    if (hostCardinality !== "1,1") {
      return;
    }

    const sourceEntity = participants.find((participant) => participant.entity.id !== hostEntity.id)?.entity;
    if (!sourceEntity) {
      return;
    }

    const sourceAttributesById = new Map(
      getEntityDirectAttributes(diagram, sourceEntity.id).map((attribute) => [attribute.id, attribute]),
    );
    (sourceEntity.internalIdentifiers ?? []).forEach((identifier) => {
      if (
        identifier.attributeIds.length === 0 ||
        identifier.attributeIds.some((attributeId) => !sourceAttributesById.has(attributeId))
      ) {
        return;
      }

      const key = [node.id, sourceEntity.id, identifier.id].join("|");
      if (options.has(key)) {
        return;
      }

      options.set(key, {
        id: createId("externalIdentifierPart"),
        relationshipId: node.id,
        relationshipLabel: node.label,
        sourceEntityId: sourceEntity.id,
        sourceEntityLabel: sourceEntity.label,
        importedIdentifierId: identifier.id,
        importedIdentifierLabel: describeInternalIdentifier(identifier, sourceAttributesById),
      });
    });
  });

  return Array.from(options.values()).sort((left, right) => {
    const leftLabel = `${left.sourceEntityLabel} ${left.relationshipLabel} ${left.importedIdentifierLabel}`;
    const rightLabel = `${right.sourceEntityLabel} ${right.relationshipLabel} ${right.importedIdentifierLabel}`;
    return leftLabel.localeCompare(rightLabel, "it", { sensitivity: "base" });
  });
}

export function validateExternalIdentifier(
  diagram: DiagramDocument,
  hostEntity: EntityNode,
  externalIdentifier: ExternalIdentifier,
): ExternalIdentifierValidationResult {
  const baseResult: ExternalIdentifierValidationResult = {
    valid: true,
    externalIdentifierId: externalIdentifier.id,
    hostEntityId: hostEntity.id,
    hostEntityLabel: hostEntity.label,
    relationshipId: externalIdentifier.importedParts[0]?.relationshipId,
  };

  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const fail = (
    reason: string,
    context?: Pick<ExternalIdentifierValidationResult, "relationshipId" | "relationshipLabel" | "sourceEntityId" | "sourceEntityLabel" | "kind">,
  ): ExternalIdentifierValidationResult => ({
    ...baseResult,
    ...context,
    valid: false,
    reason,
    message: buildExternalIdentifierInvalidationMessage(
      hostEntity.label,
      context?.relationshipLabel,
      reason,
    ),
  });

  if (externalIdentifier.importedParts.length === 0) {
    return fail("non contiene nessuna parte importata", { kind: getExternalIdentifierKind(externalIdentifier) });
  }

  const seenImportedPartKeys = new Set<string>();
  let firstValidRelationshipLabel: string | undefined;
  let firstValidSourceEntity: EntityNode | undefined;
  for (const part of externalIdentifier.importedParts) {
    const relationshipNode = nodeMap.get(part.relationshipId);
    const relationshipLabel = relationshipNode?.type === "relationship" ? relationshipNode.label : undefined;
    const partContext = {
      relationshipId: part.relationshipId,
      relationshipLabel,
      kind: getExternalIdentifierKind(externalIdentifier),
    };
    if (!relationshipNode || relationshipNode.type !== "relationship") {
      return fail("la relazione identificante non e piu disponibile", partContext);
    }

    const sourceEntity = nodeMap.get(part.sourceEntityId);
    if (!sourceEntity || sourceEntity.type !== "entity") {
      return fail("l'entita sorgente importata e stata rimossa", partContext);
    }

    if (sourceEntity.id === hostEntity.id) {
      return fail("origine e destinazione coincidono sulla stessa entita", {
        ...partContext,
        sourceEntityId: sourceEntity.id,
        sourceEntityLabel: sourceEntity.label,
      });
    }

    const participants = normalizeRelationshipExternalIdentifierParticipants(diagram, relationshipNode.id);
    const participantByEntityId = new Map(participants.map((participant) => [participant.entity.id, participant]));
    const distinctParticipantIds = new Set(participants.map((participant) => participant.entity.id));
    if (
      distinctParticipantIds.size !== 2 ||
      !participantByEntityId.has(sourceEntity.id) ||
      !participantByEntityId.has(hostEntity.id)
    ) {
      return fail(
        `la relazione non collega piu in modo coerente "${sourceEntity.label}" e "${hostEntity.label}"`,
        {
          ...partContext,
          sourceEntityId: sourceEntity.id,
          sourceEntityLabel: sourceEntity.label,
        },
      );
    }

    const dependentConnector = participantByEntityId.get(hostEntity.id);
    const dependentCardinality = normalizeCardinality(
      dependentConnector
        ? getConnectorParticipation(
            dependentConnector.edge,
            nodeMap.get(dependentConnector.edge.sourceId),
            nodeMap.get(dependentConnector.edge.targetId),
          )?.cardinality
        : undefined,
    );
    if (dependentCardinality !== "1,1") {
      return fail(`la cardinalita sul lato dipendente "${hostEntity.label}" non e piu (1,1)`, {
        ...partContext,
        sourceEntityId: sourceEntity.id,
        sourceEntityLabel: sourceEntity.label,
      });
    }

    const importedIdentifier = sourceEntity.internalIdentifiers?.find(
      (candidate) => candidate.id === part.importedIdentifierId,
    );
    if (!importedIdentifier || importedIdentifier.attributeIds.length === 0) {
      return fail(`l'identificatore importato da "${sourceEntity.label}" non e piu disponibile`, {
        ...partContext,
        sourceEntityId: sourceEntity.id,
        sourceEntityLabel: sourceEntity.label,
      });
    }

    const sourceDirectAttributeIds = new Set(getEntityDirectAttributes(diagram, sourceEntity.id).map((attribute) => attribute.id));
    if (importedIdentifier.attributeIds.some((attributeId) => !sourceDirectAttributeIds.has(attributeId))) {
      return fail(`l'identificatore importato da "${sourceEntity.label}" non e piu composto da attributi validi`, {
        ...partContext,
        sourceEntityId: sourceEntity.id,
        sourceEntityLabel: sourceEntity.label,
      });
    }

    const partKey = [relationshipNode.id, sourceEntity.id, importedIdentifier.id].join("|");
    if (seenImportedPartKeys.has(partKey)) {
      return fail("contiene piu volte la stessa parte importata", {
        ...partContext,
        sourceEntityId: sourceEntity.id,
        sourceEntityLabel: sourceEntity.label,
      });
    }

    seenImportedPartKeys.add(partKey);
    firstValidRelationshipLabel = firstValidRelationshipLabel ?? relationshipLabel;
    firstValidSourceEntity = firstValidSourceEntity ?? sourceEntity;
  }

  const hostDirectAttributes = getEntityDirectAttributes(diagram, hostEntity.id);
  const hostDirectAttributeMap = new Map(hostDirectAttributes.map((attribute) => [attribute.id, attribute]));
  const hostInternalAttributeIds = new Set(
    (hostEntity.internalIdentifiers ?? []).flatMap((identifier) => identifier.attributeIds),
  );
  const seenLocalAttributeIds = new Set<string>();
  const localFailureContext = {
    relationshipId: externalIdentifier.importedParts[0]?.relationshipId,
    relationshipLabel: firstValidRelationshipLabel,
    sourceEntityId: firstValidSourceEntity?.id,
    sourceEntityLabel: firstValidSourceEntity?.label,
    kind: getExternalIdentifierKind(externalIdentifier),
  };
  for (const attributeId of externalIdentifier.localAttributeIds) {
    if (seenLocalAttributeIds.has(attributeId)) {
      return fail("contiene piu volte lo stesso attributo locale", {
        ...localFailureContext,
      });
    }

    seenLocalAttributeIds.add(attributeId);
    const attributeNode = hostDirectAttributeMap.get(attributeId);
    if (!attributeNode) {
      return fail("contiene un attributo locale non piu diretto o non piu disponibile", {
        ...localFailureContext,
      });
    }

    if (!isEligibleLocalExternalIdentifierAttribute(attributeNode, hostInternalAttributeIds)) {
      return fail(`l'attributo locale "${attributeNode.label}" non e piu eleggibile`, {
        ...localFailureContext,
      });
    }
  }

  return {
    ...baseResult,
    relationshipLabel: firstValidRelationshipLabel,
    sourceEntityId: firstValidSourceEntity?.id,
    sourceEntityLabel: firstValidSourceEntity?.label,
    kind: getExternalIdentifierKind(externalIdentifier),
  };
}

export function isExternalIdentifierStillValid(
  diagram: DiagramDocument,
  hostEntityId: string,
  externalIdentifierId: string,
): boolean {
  const hostEntity = diagram.nodes.find(
    (node): node is EntityNode => node.id === hostEntityId && node.type === "entity",
  );
  if (!hostEntity) {
    return false;
  }

  const externalIdentifier = hostEntity.externalIdentifiers?.find(
    (identifier) => identifier.id === externalIdentifierId,
  );
  if (!externalIdentifier) {
    return false;
  }

  return validateExternalIdentifier(diagram, hostEntity, externalIdentifier).valid;
}

export type CreateSimpleInternalIdentifierResult =
  | {
      status: "created";
      diagram: DiagramDocument;
      hostEntityId: string;
      internalIdentifierId: string;
    }
  | {
      status: "already-exists" | "not-eligible";
      diagram: DiagramDocument;
      hostEntityId?: string;
      internalIdentifierId?: string;
    };

export function createSimpleInternalIdentifierForAttribute(
  diagram: DiagramDocument,
  attributeId: string,
): CreateSimpleInternalIdentifierResult {
  const attribute = diagram.nodes.find(
    (node): node is AttributeNode => node.id === attributeId && node.type === "attribute",
  );
  if (!attribute || attribute.isMultivalued === true) {
    return { status: "not-eligible", diagram };
  }

  let hostEntity: EntityNode | undefined;
  for (const edge of diagram.edges) {
    if (edge.type !== "attribute") {
      continue;
    }

    const otherId = edge.sourceId === attributeId ? edge.targetId : edge.targetId === attributeId ? edge.sourceId : "";
    const candidate = diagram.nodes.find((node): node is EntityNode => node.id === otherId && node.type === "entity");
    if (candidate) {
      hostEntity = candidate;
      break;
    }
  }

  if (!hostEntity) {
    return { status: "not-eligible", diagram };
  }

  const existing = (hostEntity.internalIdentifiers ?? []).find((identifier) =>
    identifier.attributeIds.includes(attributeId),
  );
  if (existing) {
    return {
      status: "already-exists",
      diagram,
      hostEntityId: hostEntity.id,
      internalIdentifierId: existing.id,
    };
  }

  const usedExternalAttributeIds = new Set(
    (hostEntity.externalIdentifiers ?? []).flatMap((identifier) => identifier.localAttributeIds),
  );
  if (
    attribute.isIdentifier === true ||
    attribute.isCompositeInternal === true ||
    usedExternalAttributeIds.has(attributeId)
  ) {
    return { status: "not-eligible", diagram, hostEntityId: hostEntity.id };
  }

  const internalIdentifierId = `internalIdentifier-simple-${attributeId}`;
  const nextNodes = diagram.nodes.map((node) => {
    if (node.id === hostEntity.id && node.type === "entity") {
      return {
        ...node,
        internalIdentifiers: [
          ...(node.internalIdentifiers ?? []),
          {
            id: internalIdentifierId,
            attributeIds: [attributeId],
          },
        ],
      };
    }

    if (node.id === attributeId && node.type === "attribute") {
      return {
        ...node,
        isIdentifier: true,
        isCompositeInternal: false,
        cardinality: undefined,
      };
    }

    return node;
  });

  return {
    status: "created",
    diagram: {
      ...diagram,
      nodes: nextNodes,
    },
    hostEntityId: hostEntity.id,
    internalIdentifierId,
  };
}

export function removeExternalIdentifierFromEntity(
  diagram: DiagramDocument,
  entityId: string,
  externalIdentifierId?: string,
): DiagramDocument {
  let changed = false;
  const nextNodes = diagram.nodes.map((node) => {
    if (node.id !== entityId || node.type !== "entity") {
      return node;
    }

    const currentIdentifiers = node.externalIdentifiers ?? [];
    const nextIdentifiers =
      externalIdentifierId === undefined
        ? []
        : currentIdentifiers.filter((identifier) => identifier.id !== externalIdentifierId);
    if (nextIdentifiers.length === currentIdentifiers.length) {
      return node;
    }

    changed = true;
    return {
      ...node,
      externalIdentifiers: nextIdentifiers.length > 0 ? nextIdentifiers : undefined,
    };
  });

  return changed
    ? {
        ...diagram,
        nodes: nextNodes,
      }
    : diagram;
}

export function removeInternalIdentifierFromEntity(
  diagram: DiagramDocument,
  entityId: string,
  internalIdentifierId: string,
): DiagramDocument {
  const hostEntity = diagram.nodes.find(
    (node): node is EntityNode => node.id === entityId && node.type === "entity",
  );
  const currentIdentifiers = hostEntity?.internalIdentifiers ?? [];
  const removedIdentifier = currentIdentifiers.find((identifier) => identifier.id === internalIdentifierId);
  if (!hostEntity || !removedIdentifier) {
    return diagram;
  }

  const nextIdentifiers = currentIdentifiers.filter((identifier) => identifier.id !== internalIdentifierId);
  const removedAttributeIds = new Set(removedIdentifier.attributeIds);
  const remainingSimpleAttributeIds = new Set(
    nextIdentifiers
      .filter((identifier) => identifier.attributeIds.length === 1)
      .flatMap((identifier) => identifier.attributeIds),
  );
  const remainingCompositeAttributeIds = new Set(
    nextIdentifiers
      .filter((identifier) => identifier.attributeIds.length > 1)
      .flatMap((identifier) => identifier.attributeIds),
  );

  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      if (node.id === entityId && node.type === "entity") {
        return {
          ...node,
          internalIdentifiers: nextIdentifiers.length > 0 ? nextIdentifiers : undefined,
        };
      }

      if (node.type !== "attribute" || !removedAttributeIds.has(node.id)) {
        return node;
      }

      return {
        ...node,
        isIdentifier: remainingSimpleAttributeIds.has(node.id),
        isCompositeInternal: remainingCompositeAttributeIds.has(node.id),
      };
    }),
  };
}

export function revalidateExternalIdentifiers(
  diagram: DiagramDocument,
): { diagram: DiagramDocument; invalidations: ExternalIdentifierInvalidation[] } {
  const invalidations: ExternalIdentifierInvalidation[] = [];
  const synchronizedDiagram = synchronizeExternalIdentifiers(diagram);
  const synchronizedEntityById = new Map(
    synchronizedDiagram.nodes
      .filter((node): node is EntityNode => node.type === "entity")
      .map((entity) => [entity.id, entity]),
  );

  diagram.nodes.forEach((node) => {
    if (node.type !== "entity") {
      return;
    }

    const synchronizedEntity = synchronizedEntityById.get(node.id);
    const synchronizedExternalIdentifierIds = new Set(
      synchronizedEntity?.externalIdentifiers?.map((identifier) => identifier.id) ?? [],
    );

    (node.externalIdentifiers ?? []).forEach((identifier) => {
      if (synchronizedExternalIdentifierIds.has(identifier.id)) {
        return;
      }

      const validation = validateExternalIdentifier(diagram, node, identifier);
      invalidations.push({
        externalIdentifierId: identifier.id,
        hostEntityId: node.id,
        hostEntityLabel: node.label,
        relationshipId: validation.relationshipId,
        relationshipLabel: validation.relationshipLabel,
        sourceEntityId: validation.sourceEntityId,
        sourceEntityLabel: validation.sourceEntityLabel,
        reason: validation.reason ?? "la dipendenza identificante non e piu soddisfatta",
        message:
          validation.message ??
          buildExternalIdentifierInvalidationMessage(
            node.label,
            validation.relationshipLabel,
            validation.reason ?? "la dipendenza identificante non e piu soddisfatta",
          ),
      });
    });
  });

  return {
    diagram: synchronizedDiagram,
    invalidations,
  };
}

function migrateLegacyEdgeCardinalities(
  diagram: DiagramDocument,
  legacyCardinalityByEdgeId: Map<string, string | undefined>,
): DiagramDocument {
  if (legacyCardinalityByEdgeId.size === 0) {
    return diagram;
  }

  const nextNodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  let nodeChanged = false;
  let edgeChanged = false;

  const nextEdges = diagram.edges.map((edge) => {
    const legacyCardinality = normalizeSupportedCardinality(legacyCardinalityByEdgeId.get(edge.id));
    if (!legacyCardinality) {
      return edge;
    }

    const sourceNode = nextNodeById.get(edge.sourceId);
    const targetNode = nextNodeById.get(edge.targetId);

    if (edge.type === "attribute") {
      const attributeNode = getAttributeCardinalityOwner(sourceNode, targetNode);
      if (attributeNode && attributeNode.cardinality === undefined) {
        const nextAttributeNode = {
          ...attributeNode,
          cardinality: legacyCardinality,
        };
        nextNodeById.set(attributeNode.id, nextAttributeNode);
        nodeChanged = true;
      }

      return edge;
    }

    if (edge.type !== "connector") {
      return edge;
    }

    const context = getConnectorParticipationContext(sourceNode, targetNode);
    if (!context) {
      return edge;
    }

    const currentEntity = nextNodeById.get(context.entity.id);
    if (currentEntity?.type !== "entity") {
      return edge;
    }

    const currentParticipations = currentEntity.relationshipParticipations ?? [];
    const matchingParticipation =
      typeof edge.participationId === "string" && edge.participationId.trim().length > 0
        ? currentParticipations.find(
            (participation) =>
              participation.id === edge.participationId &&
              participation.relationshipId === context.relationship.id,
          )
        : undefined;

    if (matchingParticipation) {
      if (matchingParticipation.cardinality === undefined) {
        nextNodeById.set(context.entity.id, {
          ...currentEntity,
          relationshipParticipations: currentParticipations.map((participation) =>
            participation.id === matchingParticipation.id
              ? {
                  ...participation,
                  cardinality: legacyCardinality,
                }
              : participation,
          ),
        });
        nodeChanged = true;
      }

      if (edge.participationId === matchingParticipation.id) {
        return edge;
      }

      edgeChanged = true;
      return {
        ...edge,
        participationId: matchingParticipation.id,
      };
    }

    const nextParticipationId =
      typeof edge.participationId === "string" && edge.participationId.trim().length > 0
        ? edge.participationId
        : createId("participation");
    nextNodeById.set(context.entity.id, {
      ...currentEntity,
      relationshipParticipations: [
        ...currentParticipations,
        {
          id: nextParticipationId,
          relationshipId: context.relationship.id,
          cardinality: legacyCardinality,
        },
      ],
    });
    nodeChanged = true;

    if (edge.participationId === nextParticipationId) {
      return edge;
    }

    edgeChanged = true;
    return {
      ...edge,
      participationId: nextParticipationId,
    };
  });

  if (!nodeChanged && !edgeChanged) {
    return diagram;
  }

  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => nextNodeById.get(node.id) ?? node),
    edges: nextEdges,
  };
}

interface LegacyRelationshipExternalIdentifier {
  relationshipId: string;
  sourceAttributeId?: string;
  hostEntityId?: string;
  localAttributeId?: string;
  offset?: number;
  markerOffsetX?: number;
  markerOffsetY?: number;
}

function normalizeDiagramNotes(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\r\n/g, "\n").trim();
}

function formatLegacyTextNodesAsNotes(rawNodes: unknown): string {
  if (!Array.isArray(rawNodes)) {
    return "";
  }

  const entries = rawNodes
    .flatMap((node) => {
      if (typeof node !== "object" || node === null) {
        return [];
      }

      const rawNode = node as {
        type?: unknown;
        label?: unknown;
        id?: unknown;
        x?: unknown;
        y?: unknown;
      };

      if (rawNode.type !== "text") {
        return [];
      }

      const content = (typeof rawNode.label === "string" ? rawNode.label : typeof rawNode.id === "string" ? rawNode.id : "").trim();
      if (!content) {
        return [];
      }

      return [
        {
          content,
          x: typeof rawNode.x === "number" && Number.isFinite(rawNode.x) ? rawNode.x : 0,
          y: typeof rawNode.y === "number" && Number.isFinite(rawNode.y) ? rawNode.y : 0,
        },
      ];
    })
    .sort((left, right) => {
      if (left.y !== right.y) {
        return left.y - right.y;
      }

      return left.x - right.x;
    });

  if (entries.length === 0) {
    return "";
  }

  if (entries.length === 1) {
    return entries[0].content;
  }

  return entries.map((entry, index) => `[Nota ${index + 1}]\n${entry.content}`).join("\n\n");
}

function mergeDiagramNotes(explicitNotes: string, migratedNotes: string): string {
  if (!explicitNotes && !migratedNotes) {
    return "";
  }

  if (!explicitNotes) {
    return migratedNotes;
  }

  if (!migratedNotes) {
    return explicitNotes;
  }

  return `${explicitNotes}\n\n[Migrazione Testo Libero]\n${migratedNotes}`;
}

function migrateLegacyRelationshipExternalIdentifiers(
  diagram: DiagramDocument,
  legacyIdentifiers: LegacyRelationshipExternalIdentifier[],
): DiagramDocument {
  if (legacyIdentifiers.length === 0) {
    return diagram;
  }

  const nextNodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  let changed = false;

  legacyIdentifiers.forEach((legacyIdentifier, legacyIndex) => {
    const relationshipNode = nextNodeById.get(legacyIdentifier.relationshipId);
    if (relationshipNode?.type !== "relationship") {
      return;
    }

    const sourceAttribute =
      typeof legacyIdentifier.sourceAttributeId === "string"
        ? nextNodeById.get(legacyIdentifier.sourceAttributeId)
        : undefined;
    if (sourceAttribute?.type !== "attribute") {
      return;
    }

    const hostEntity =
      typeof legacyIdentifier.hostEntityId === "string"
        ? nextNodeById.get(legacyIdentifier.hostEntityId)
        : undefined;
    if (hostEntity?.type !== "entity") {
      return;
    }

    const sourceEntity = findEntityHostForAttribute(diagram, sourceAttribute.id);
    if (!sourceEntity || sourceEntity.id === hostEntity.id) {
      return;
    }

    const sourceIdentifier = findInternalIdentifierByAttribute(sourceEntity, sourceAttribute.id);
    if (!sourceIdentifier) {
      return;
    }

    const existingExternalIdentifiers = hostEntity.externalIdentifiers ?? [];
    if (existingExternalIdentifiers.length > 0) {
      return;
    }

    const duplicate = existingExternalIdentifiers.some(
      (identifier) =>
        identifier.importedParts.some(
          (part) =>
            part.relationshipId === relationshipNode.id &&
            part.sourceEntityId === sourceEntity.id &&
            part.importedIdentifierId === sourceIdentifier.id,
        ) &&
        identifier.localAttributeIds.length === (legacyIdentifier.localAttributeId ? 1 : 0) &&
        (legacyIdentifier.localAttributeId === undefined ||
          identifier.localAttributeIds[0] === legacyIdentifier.localAttributeId),
    );
    if (duplicate) {
      return;
    }

    nextNodeById.set(hostEntity.id, {
      ...hostEntity,
      externalIdentifiers: [
        ...existingExternalIdentifiers,
        {
          id: `externalIdentifier-legacy-${hostEntity.id}-${legacyIndex + 1}`,
          importedParts: [
            {
              id: `externalIdentifierPart-legacy-${hostEntity.id}-${legacyIndex + 1}`,
              relationshipId: relationshipNode.id,
              sourceEntityId: sourceEntity.id,
              importedIdentifierId: sourceIdentifier.id,
            },
          ],
          localAttributeIds:
            typeof legacyIdentifier.localAttributeId === "string" ? [legacyIdentifier.localAttributeId] : [],
          offset: legacyIdentifier.offset,
          markerOffsetX: legacyIdentifier.markerOffsetX,
          markerOffsetY: legacyIdentifier.markerOffsetY,
        },
      ],
    });
    changed = true;
  });

  return changed
    ? {
        ...diagram,
        nodes: diagram.nodes.map((node) => nextNodeById.get(node.id) ?? node),
      }
    : diagram;
}

export function parseDiagram(rawJson: string): DiagramDocument {
  const parsed = JSON.parse(rawJson) as Partial<DiagramDocument>;
  const meta = parsed.meta ?? { name: "Diagramma importato", version: CURRENT_DIAGRAM_VERSION };
  const explicitNotes = normalizeDiagramNotes((parsed as { notes?: unknown }).notes);
  const migratedLegacyNotes = formatLegacyTextNodesAsNotes((parsed as { nodes?: unknown }).nodes);
  const notes = mergeDiagramNotes(explicitNotes, migratedLegacyNotes);
  const legacyRelationshipExternalIdentifiers: LegacyRelationshipExternalIdentifier[] = [];
  const nodes = Array.isArray(parsed.nodes)
    ? parsed.nodes
        .filter(
          (node): node is DiagramNode =>
            typeof node === "object" &&
            node !== null &&
            typeof node.id === "string" &&
            (typeof node.label === "string" || node.label === undefined) &&
            typeof node.x === "number" &&
            typeof node.y === "number" &&
            typeof node.width === "number" &&
            typeof node.height === "number" &&
            typeof node.type === "string" &&
            isNodeKind(node.type),
        )
        .map((node) => {
          const nodeLabel = typeof node.label === "string" ? node.label : node.id;
          if (node.type === "attribute") {
            const isMultivalued = node.isMultivalued === true;
            const multivaluedSize = getMultivaluedAttributeSize(nodeLabel);
            return {
              ...node,
              label: nodeLabel,
              isIdentifier: node.isIdentifier === true,
              isCompositeInternal: node.isCompositeInternal === true,
              isMultivalued,
              cardinality:
                typeof node.cardinality === "string" ? normalizeSupportedCardinality(node.cardinality) : undefined,
              width: isMultivalued
                ? multivaluedSize.width
                : node.width,
              height: isMultivalued
                ? multivaluedSize.height
                : node.height,
            };
          }

          if (node.type === "entity") {
            const rawInternalIdentifiers = (node as { internalIdentifiers?: unknown }).internalIdentifiers;
            const parsedInternalIdentifiers = Array.isArray(rawInternalIdentifiers)
              ? rawInternalIdentifiers
                  .map((identifier) => {
                    if (typeof identifier !== "object" || identifier === null) {
                      return null;
                    }

                    const rawIdentifier = identifier as {
                      id?: unknown;
                      attributeIds?: unknown;
                    };
                    const identifierId =
                      typeof rawIdentifier.id === "string" && rawIdentifier.id.trim().length > 0
                        ? rawIdentifier.id
                        : createId("internalIdentifier");
                    const attributeIds = Array.isArray(rawIdentifier.attributeIds)
                      ? rawIdentifier.attributeIds.filter(
                          (attributeId): attributeId is string =>
                            typeof attributeId === "string" && attributeId.trim().length > 0,
                        )
                      : [];

                    if (attributeIds.length === 0) {
                      return null;
                    }

                    return {
                      id: identifierId,
                      attributeIds,
                    };
                  })
                  .filter((identifier): identifier is InternalIdentifier => identifier !== null)
              : [];

            return {
              ...node,
              label: nodeLabel,
              isWeak: node.isWeak === true,
              internalIdentifiers:
                parsedInternalIdentifiers.length > 0 ? parsedInternalIdentifiers : undefined,
              externalIdentifiers: sanitizeExternalIdentifiers(
                (node as { externalIdentifiers?: unknown }).externalIdentifiers,
              ),
              relationshipParticipations: sanitizeEntityRelationshipParticipations(
                (node as { relationshipParticipations?: unknown }).relationshipParticipations,
              ),
            };
          }

          if (node.type === "relationship") {
            const rawNode = node as {
              isExternalIdentifier?: unknown;
              externalIdentifierSourceAttributeId?: unknown;
              externalIdentifierTargetEntityId?: unknown;
              externalIdentifierTargetAttributeId?: unknown;
              externalIdentifierOffset?: unknown;
              externalIdentifierMarkerOffsetX?: unknown;
              externalIdentifierMarkerOffsetY?: unknown;
            };
            if (
              rawNode.isExternalIdentifier === true ||
              typeof rawNode.externalIdentifierSourceAttributeId === "string" ||
              typeof rawNode.externalIdentifierTargetEntityId === "string" ||
              typeof rawNode.externalIdentifierTargetAttributeId === "string"
            ) {
              legacyRelationshipExternalIdentifiers.push({
                relationshipId: node.id,
                sourceAttributeId:
                  typeof rawNode.externalIdentifierSourceAttributeId === "string"
                    ? rawNode.externalIdentifierSourceAttributeId
                    : undefined,
                hostEntityId:
                  typeof rawNode.externalIdentifierTargetEntityId === "string"
                    ? rawNode.externalIdentifierTargetEntityId
                    : undefined,
                localAttributeId:
                  typeof rawNode.externalIdentifierTargetAttributeId === "string"
                    ? rawNode.externalIdentifierTargetAttributeId
                    : undefined,
                offset:
                  typeof rawNode.externalIdentifierOffset === "number" &&
                  Number.isFinite(rawNode.externalIdentifierOffset)
                    ? rawNode.externalIdentifierOffset
                    : undefined,
                markerOffsetX:
                  typeof rawNode.externalIdentifierMarkerOffsetX === "number" &&
                  Number.isFinite(rawNode.externalIdentifierMarkerOffsetX)
                    ? rawNode.externalIdentifierMarkerOffsetX
                    : undefined,
                markerOffsetY:
                  typeof rawNode.externalIdentifierMarkerOffsetY === "number" &&
                  Number.isFinite(rawNode.externalIdentifierMarkerOffsetY)
                    ? rawNode.externalIdentifierMarkerOffsetY
                    : undefined,
              });
            }

            return {
              ...node,
              label: nodeLabel,
            };
          }

          return node;
        })
    : [];
  const legacyCardinalityByEdgeId = new Map<string, string | undefined>();
  const edges = Array.isArray(parsed.edges)
    ? parsed.edges.filter(
        (edge): edge is DiagramEdge =>
          typeof edge === "object" &&
          edge !== null &&
          typeof edge.id === "string" &&
          typeof edge.sourceId === "string" &&
          typeof edge.targetId === "string" &&
          typeof edge.label === "string" &&
          typeof edge.type === "string" &&
          typeof edge.lineStyle === "string" &&
            isEdgeKind(edge.type),
      )
        .map((edge) => {
          const rawEdge = edge as DiagramEdge & {
            cardinality?: unknown;
            participationId?: unknown;
            isaDisjointness?: string;
            isaCompleteness?: string;
          };
          legacyCardinalityByEdgeId.set(
            edge.id,
            typeof rawEdge.cardinality === "string" ? rawEdge.cardinality : undefined,
          );

          if (edge.type === "inheritance") {
            const rawInheritanceEdge = rawEdge as typeof rawEdge & { generalizationGroupId?: unknown };
            return {
              ...edge,
              isaDisjointness: isIsaDisjointness(rawInheritanceEdge.isaDisjointness)
                ? rawInheritanceEdge.isaDisjointness
                : undefined,
              isaCompleteness: isIsaCompleteness(rawInheritanceEdge.isaCompleteness)
                ? rawInheritanceEdge.isaCompleteness
                : undefined,
              generalizationGroupId:
                typeof rawInheritanceEdge.generalizationGroupId === "string" &&
                rawInheritanceEdge.generalizationGroupId.trim().length > 0
                  ? rawInheritanceEdge.generalizationGroupId
                  : undefined,
            };
          }

          if (edge.type === "connector") {
            return {
              ...removeDisallowedManualRouting(edge),
              participationId:
                typeof rawEdge.participationId === "string" && rawEdge.participationId.trim().length > 0
                  ? rawEdge.participationId
                  : undefined,
            };
          }

          return {
            ...edge,
          };
        })
    : [];

  const parsedDiagram: DiagramDocument = {
    meta: {
      name: meta.name ?? "Diagramma importato",
      version: CURRENT_DIAGRAM_VERSION,
    },
    notes,
    nodes,
    edges,
    generalizationGroups: Array.isArray(parsed.generalizationGroups)
      ? parsed.generalizationGroups.filter(isGeneralizationGroupLike).map((group, index) => ({
          id: typeof group.id === "string" && group.id.trim().length > 0 ? group.id : `generalization-${index + 1}`,
          supertypeId: typeof group.supertypeId === "string" ? group.supertypeId : "",
          subtypeIds: Array.isArray(group.subtypeIds)
            ? group.subtypeIds.filter((subtypeId): subtypeId is string => typeof subtypeId === "string")
            : [],
          isaCompleteness: isIsaCompleteness(group.isaCompleteness) ? group.isaCompleteness : undefined,
          isaDisjointness: isIsaDisjointness(group.isaDisjointness) ? group.isaDisjointness : undefined,
          label: typeof group.label === "string" && group.label.trim().length > 0 ? group.label : undefined,
          junctionOffsetX: isFiniteNumber(group.junctionOffsetX) ? group.junctionOffsetX : undefined,
          junctionOffsetY: isFiniteNumber(group.junctionOffsetY) ? group.junctionOffsetY : undefined,
        }))
      : undefined,
  };

  const migratedDiagram = migrateLegacyEdgeCardinalities(parsedDiagram, legacyCardinalityByEdgeId);
  const synchronizedBeforeLegacyExternal = synchronizeInternalIdentifiers(
    synchronizeEntityRelationshipParticipations(migratedDiagram),
  );
  const migratedLegacyExternalDiagram = migrateLegacyRelationshipExternalIdentifiers(
    synchronizedBeforeLegacyExternal,
    legacyRelationshipExternalIdentifiers,
  );
  const nodeNameIdentitySynchronized = synchronizeNodeNameIdentity(migratedLegacyExternalDiagram).diagram;
  const synchronizedDiagram = synchronizeExternalIdentifiers(
    synchronizeInternalIdentifiers(
      synchronizeEntityRelationshipParticipations(nodeNameIdentitySynchronized),
    ),
  );
  let normalizedDiagram = normalizeGeneralizationGroups(revalidateExternalIdentifiers(synchronizedDiagram).diagram);
  normalizedDiagram = mergeCompatibleGeneralizationGroups(normalizedDiagram);
  normalizedDiagram = cleanupGeneralizationReferences(normalizedDiagram);
  return {
    ...normalizedDiagram,
    edges: normalizedDiagram.edges.map(removeDisallowedManualRouting),
  };
}

export function validateDiagram(diagram: DiagramDocument): ValidationIssue[] {
  diagram = synchronizeExternalIdentifiers(
    synchronizeInternalIdentifiers(synchronizeEntityRelationshipParticipations(diagram)),
  );
  const issues: ValidationIssue[] = [];
  const edgesByNode = new Map<string, DiagramEdge[]>();
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const duplicateEdgeOwners = new Map<string, DiagramEdge>();

  diagram.edges.forEach((edge) => {
    const sourceList = edgesByNode.get(edge.sourceId) ?? [];
    const targetList = edgesByNode.get(edge.targetId) ?? [];
    sourceList.push(edge);
    targetList.push(edge);
    edgesByNode.set(edge.sourceId, sourceList);
    edgesByNode.set(edge.targetId, targetList);
  });

  diagram.nodes.forEach((node) => {
    const connectedEdges = edgesByNode.get(node.id) ?? [];

    if (node.type === "attribute") {
      if (
        node.isMultivalued === true &&
        (node.isIdentifier === true || node.isCompositeInternal === true)
      ) {
        issues.push({
          id: `attribute-conflict-${node.id}`,
          level: "error",
          message: `L'attributo "${node.label}" non e valido perche e segnato come composto e identificatore insieme; per risolvere lascia attiva una sola modalita.`,
          targetId: node.id,
          targetType: "node",
        });
      }

      const hasHost = connectedEdges.some((edge) => edge.type === "attribute");
      if (!hasHost) {
        issues.push({
          id: `attribute-${node.id}`,
          level: "warning",
          message: `L'attributo "${node.label}" non è collegato a un'entità, una relazione o un attributo padre.`,
          targetId: node.id,
          targetType: "node",
        });
      }

      if (node.cardinality !== undefined && !canAttributeHaveCardinality(diagram, node)) {
        issues.push({
          id: `attribute-invalid-cardinality-${node.id}`,
          level: "error",
          message: `La cardinalita non e valida sull'attributo "${node.label}" perche gli identificatori non possono definirla.`,
          targetId: node.id,
          targetType: "node",
        });
      }
    }

    if (node.type === "relationship") {
      const connectors = connectedEdges.filter((edge) => edge.type === "connector");
      const compatibleConnectors = connectors.filter((edge) => {
        const otherId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
        return nodeMap.get(otherId)?.type === "entity";
      });
      const compatibleEntityIds = new Set(
        compatibleConnectors
          .map((edge) => (edge.sourceId === node.id ? edge.targetId : edge.sourceId))
          .filter((otherId) => {
            const otherNode = nodeMap.get(otherId);
            return otherNode?.type === "entity";
          }),
      );

      if (compatibleConnectors.length < 2) {
        issues.push({
          id: `relationship-${node.id}`,
          level: "warning",
          message: `La relazione "${node.label}" dovrebbe collegare almeno due entità compatibili.`,
          targetId: node.id,
          targetType: "node",
        });
      }

      const connectorGroupsByEntityId = new Map<string, Extract<DiagramEdge, { type: "connector" }>[]>();
      compatibleConnectors.forEach((edge) => {
        const entityId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
        const group = connectorGroupsByEntityId.get(entityId) ?? [];
        group.push(edge);
        connectorGroupsByEntityId.set(entityId, group);
      });
      connectorGroupsByEntityId.forEach((loopEdges) => {
        if (loopEdges.length <= 1) {
          return;
        }

        const seenRoles = new Map<string, string>();
        const duplicateReportedEdgeIds = new Set<string>();
        loopEdges.forEach((edge) => {
          const sourceNode = nodeMap.get(edge.sourceId);
          const targetNode = nodeMap.get(edge.targetId);
          const participation = getConnectorParticipation(edge, sourceNode, targetNode);
          const role = participation?.role?.trim() ?? "";
          if (role.length === 0) {
            issues.push({
              id: `loop-role-missing-${edge.id}`,
              level: "error",
              message: "Loop association requires a role for each connection.",
              targetId: edge.id,
              targetType: "edge",
            });
            return;
          }

          const roleKey = role.toLocaleLowerCase("it");
          const existingEdgeId = seenRoles.get(roleKey);
          if (existingEdgeId) {
            [edge.id, existingEdgeId].forEach((duplicateEdgeId) => {
              if (duplicateReportedEdgeIds.has(duplicateEdgeId)) {
                return;
              }

              duplicateReportedEdgeIds.add(duplicateEdgeId);
              issues.push({
                id: `loop-role-duplicate-${duplicateEdgeId}`,
                level: "error",
                message: "Each connection in a loop association must have a distinct role.",
                targetId: duplicateEdgeId,
                targetType: "edge",
              });
            });
            return;
          }

          seenRoles.set(roleKey, edge.id);
        });
      });

      if (compatibleConnectors.length >= 3) {
        const problematicParticipants = connectors
          .map((edge) => {
            const entityId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
            const entityNode = nodeMap.get(entityId);
            if (entityNode?.type !== "entity") {
              return null;
            }

            const participation = getConnectorParticipation(
              edge,
              nodeMap.get(edge.sourceId),
              nodeMap.get(edge.targetId),
            );
            const cardinality = normalizeSupportedCardinality(participation?.cardinality);
            if (!connectorCardinalityHasMaxOne(cardinality)) {
              return null;
            }

            return {
              entity: entityNode,
              cardinality,
            };
          })
          .filter((participant): participant is { entity: EntityNode; cardinality: string } => participant !== null)
          .filter((participant, index, source) =>
            source.findIndex((candidate) => candidate.entity.id === participant.entity.id) === index,
          );

        if (problematicParticipants.length > 0) {
          const participantLabels = problematicParticipants
            .map((participant) => `${participant.entity.label} ${participant.cardinality}`)
            .join(", ");
          const firstParticipant = problematicParticipants[0];
          const semanticHint =
            problematicParticipants.length === 1
              ? ` indica che una combinazione delle altre entita determina al massimo una istanza di "${firstParticipant.entity.label}"`
              : " indicano dipendenze rispetto alla combinazione delle altre entita";

          issues.push({
            id: `relationship-nary-max-one-cardinality-${node.id}`,
            level: "warning",
            message: `Attenzione: la relazione "${node.label}" ha grado ${compatibleConnectors.length} e contiene cardinalita con massimo 1 sui lati: ${participantLabels}. Nelle relazioni ternarie o n-arie questi vincoli non si interpretano come nelle relazioni binarie:${semanticHint}. Verifica che questa sia davvero la semantica desiderata.`,
            targetId: node.id,
            targetType: "node",
          });
        }
      }

      const relationshipIdentifierAttributes = connectedEdges
        .filter((edge) => edge.type === "attribute")
        .map((edge) => (edge.sourceId === node.id ? edge.targetId : edge.sourceId))
        .map((attributeId) => nodeMap.get(attributeId))
        .filter((candidate): candidate is DiagramNode => candidate !== undefined)
        .filter(
          (candidate) =>
            candidate.type === "attribute" &&
            (candidate.isIdentifier === true || candidate.isCompositeInternal === true),
        );

      if (relationshipIdentifierAttributes.length > 0) {
        issues.push({
          id: `relationship-identifier-${node.id}`,
          level: "error",
          message: `La relazione "${node.label}" non e valida perche contiene attributi identificatori; per risolvere rimuovi il flag identificatore dagli attributi collegati.`,
          targetId: node.id,
          targetType: "node",
        });
      }

    }

    if (node.type === "entity") {
      const hasRelationshipConnection = connectedEdges.some((edge) => {
        if (edge.type !== "connector") {
          return false;
        }

        const otherId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
        const otherNode = nodeMap.get(otherId);
        return otherNode?.type === "relationship";
      });

      const hasInheritanceConnection = connectedEdges.some((edge) => edge.type === "inheritance");
      const isInheritanceChild = connectedEdges.some(
        (edge) => edge.type === "inheritance" && edge.sourceId === node.id,
      );
      const isInheritanceParent = connectedEdges.some(
        (edge) => edge.type === "inheritance" && edge.targetId === node.id,
      );
      const hasEntityConnection = hasRelationshipConnection || hasInheritanceConnection;

      if (!hasEntityConnection) {
        issues.push({
          id: `entity-disconnected-${node.id}`,
          level: "warning",
          message: `L'entita "${node.label}" non e collegata ad altre entita o relazioni.`,
          targetId: node.id,
          targetType: "node",
        });
      }

      const hasAttribute = connectedEdges.some((edge) => {
        if (edge.type !== "attribute") {
          return false;
        }

        const otherId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
        const otherNode = nodeMap.get(otherId);
        return otherNode?.type === "attribute";
      });
      const hasExternalIdentifier = (node.externalIdentifiers ?? []).length > 0;

      if (!hasAttribute && !hasExternalIdentifier && !hasInheritanceConnection) {
        issues.push({
          id: `entity-no-attributes-${node.id}`,
          level: "warning",
          message: `L'entita "${node.label}" non ha attributi collegati.`,
          targetId: node.id,
          targetType: "node",
        });
      }

      if (isInheritanceChild && !hasAttribute) {
        issues.push({
          id: `subtype-no-attributes-${node.id}`,
          level: "warning",
          message: `Il sottotipo "${node.label}" non ha attributi collegati.`,
          targetId: node.id,
          targetType: "node",
        });
      }

      if (isInheritanceParent && !hasRelationshipConnection) {
        issues.push({
          id: `supertype-no-relationship-${node.id}`,
          level: "warning",
          message: `Il supertipo "${node.label}" non e collegato ad alcuna relazione.`,
          targetId: node.id,
          targetType: "node",
        });
      }

      if (node.isWeak === true && !hasExternalIdentifier) {
        issues.push({
          id: `weak-entity-${node.id}`,
          level: "warning",
          message: `L'entita debole "${node.label}" non e collegata ad alcun identificatore esterno.`,
          targetId: node.id,
          targetType: "node",
        });
      }
      const directAttributes = connectedEdges
        .filter((edge) => edge.type === "attribute")
        .map((edge) => (edge.sourceId === node.id ? edge.targetId : edge.sourceId))
        .map((attributeId) => nodeMap.get(attributeId))
        .filter((candidate): candidate is AttributeNode => candidate?.type === "attribute");
      const directAttributeById = new Map(directAttributes.map((attribute) => [attribute.id, attribute]));
      const attributeOwnerByIdentifier = new Map<string, string>();
      const internalIdentifiers = node.internalIdentifiers ?? [];

      internalIdentifiers.forEach((identifier, index) => {
        const identifierLabel = identifier.id || `identificatore-${index + 1}`;
        const seenInIdentifier = new Set<string>();

        if (identifier.attributeIds.length === 0) {
          issues.push({
            id: `internal-identifier-empty-${node.id}-${index}`,
            level: "warning",
            message: `L'entita "${node.label}" contiene un identificatore interno vuoto.`,
            targetId: node.id,
            targetType: "node",
          });
          return;
        }

        identifier.attributeIds.forEach((attributeId) => {
          if (seenInIdentifier.has(attributeId)) {
            issues.push({
              id: `internal-identifier-duplicate-attribute-${node.id}-${identifierLabel}-${attributeId}`,
              level: "warning",
              message: `L'identificatore interno "${identifierLabel}" su "${node.label}" contiene piu volte lo stesso attributo.`,
              targetId: node.id,
              targetType: "node",
            });
            return;
          }

          seenInIdentifier.add(attributeId);
          const attributeNode = directAttributeById.get(attributeId);
          if (!attributeNode) {
            issues.push({
              id: `internal-identifier-invalid-attribute-${node.id}-${identifierLabel}-${attributeId}`,
              level: "error",
              message: `L'identificatore interno "${identifierLabel}" su "${node.label}" riferisce un attributo non valido o non diretto.`,
              targetId: node.id,
              targetType: "node",
            });
            return;
          }

          if (attributeNode.isMultivalued === true) {
            issues.push({
              id: `internal-identifier-multivalued-${node.id}-${identifierLabel}-${attributeId}`,
              level: "error",
              message: `L'attributo "${attributeNode.label}" e composto e non puo far parte di un identificatore interno.`,
              targetId: node.id,
              targetType: "node",
            });
          }

          if (identifier.attributeIds.length > 1 && attributeNode.isIdentifier === true) {
            issues.push({
              id: `internal-identifier-primary-conflict-${node.id}-${identifierLabel}-${attributeId}`,
              level: "error",
              message: `L'attributo "${attributeNode.label}" e gia identificatore semplice e non puo essere riusato negli identificatori interni.`,
              targetId: node.id,
              targetType: "node",
            });
          }

          const owner = attributeOwnerByIdentifier.get(attributeId);
          if (owner && owner !== identifierLabel) {
            issues.push({
              id: `internal-identifier-overlap-${node.id}-${attributeId}`,
              level: "error",
              message: `L'attributo "${attributeNode.label}" appartiene a piu identificatori interni su "${node.label}".`,
              targetId: node.id,
              targetType: "node",
            });
            return;
          }

          attributeOwnerByIdentifier.set(attributeId, identifierLabel);
        });
      });

      const externalIdentifiers = node.externalIdentifiers ?? [];
      externalIdentifiers.forEach((identifier, index) => {
        const identifierLabel = identifier.id || `external-identifier-${index + 1}`;
        const validation = validateExternalIdentifier(diagram, node, identifier);
        if (!validation.valid) {
          issues.push({
            id: `external-identifier-invalid-${node.id}-${identifier.id}`,
            level: "warning",
            message:
              validation.message ??
              `L'identificatore esterno "${identifierLabel}" su "${node.label}" non e valido.`,
            targetId: node.id,
            targetType: "node",
          });
        }

        identifier.localAttributeIds.forEach((attributeId) => {
          const attributeNode = directAttributeById.get(attributeId);
          if (!attributeNode) {
            return;
          }

          const internalOwner = attributeOwnerByIdentifier.get(attributeId);
          if (internalOwner) {
            issues.push({
              id: `external-identifier-internal-overlap-${node.id}-${identifier.id}-${attributeId}`,
              level: "error",
              message: `L'attributo "${attributeNode.label}" non puo completare l'identificatore esterno "${identifierLabel}" perche appartiene gia all'identificatore interno "${internalOwner}".`,
              targetId: node.id,
              targetType: "node",
            });
          }
        });
      });
    }
  });

  const generalizationGroupById = new Map((diagram.generalizationGroups ?? []).map((group) => [group.id, group]));
  const entityIdsForIsa = new Set(diagram.nodes.filter((node) => node.type === "entity").map((node) => node.id));

  (diagram.generalizationGroups ?? []).forEach((group, index) => {
    const groupLabel = group.label ?? group.id ?? `generalizzazione-${index + 1}`;
    const supertypeNode = typeof group.supertypeId === "string" ? nodeMap.get(group.supertypeId) : undefined;
    const targetId = supertypeNode?.id ?? group.supertypeId ?? group.id;
    const targetType: ValidationIssue["targetType"] = supertypeNode ? "node" : "edge";

    if (supertypeNode?.type !== "entity") {
      issues.push({
        id: `generalization-invalid-supertype-${group.id}`,
        level: "error",
        message: `La gerarchia ISA "${groupLabel}" non ha un supertipo valido.`,
        targetId,
        targetType,
      });
    }

    if (!group.isaCompleteness || !group.isaDisjointness) {
      issues.push({
        id: `generalization-missing-constraint-${group.id}`,
        level: "error",
        message: `La gerarchia ISA "${groupLabel}" non ha un vincolo completo.`,
        targetId,
        targetType,
      });
    }

    if (!Array.isArray(group.subtypeIds) || group.subtypeIds.length === 0) {
      issues.push({
        id: `generalization-empty-${group.id}`,
        level: "error",
        message: `La gerarchia ISA "${groupLabel}" non contiene sottotipi.`,
        targetId,
        targetType,
      });
      return;
    }

    const seenSubtypes = new Set<string>();
    group.subtypeIds.forEach((subtypeId) => {
      const subtypeNode = nodeMap.get(subtypeId);
      if (subtypeId === group.supertypeId) {
        issues.push({
          id: `generalization-self-subtype-${group.id}-${subtypeId}`,
          level: "error",
          message: `La gerarchia ISA "${groupLabel}" usa lo stesso elemento come supertipo e sottotipo.`,
          targetId: subtypeId,
          targetType: "node",
        });
      }

      if (seenSubtypes.has(subtypeId)) {
        issues.push({
          id: `generalization-duplicate-subtype-${group.id}-${subtypeId}`,
          level: "error",
          message: `La gerarchia ISA "${groupLabel}" contiene piu volte lo stesso sottotipo.`,
          targetId: subtypeId,
          targetType: "node",
        });
      }
      seenSubtypes.add(subtypeId);

      if (subtypeNode?.type !== "entity") {
        issues.push({
          id: `generalization-invalid-subtype-${group.id}-${subtypeId}`,
          level: "error",
          message: `La gerarchia ISA "${groupLabel}" riferisce un sottotipo non valido.`,
          targetId: subtypeId,
          targetType: subtypeNode ? "node" : "edge",
        });
      }
    });
  });

  const isaChildrenByParent = new Map<string, string[]>();
  diagram.edges
    .filter((edge): edge is Extract<DiagramEdge, { type: "inheritance" }> => edge.type === "inheritance")
    .forEach((edge) => {
      const sourceNode = nodeMap.get(edge.sourceId);
      const targetNode = nodeMap.get(edge.targetId);
      if (sourceNode?.type !== "entity" || targetNode?.type !== "entity") {
        return;
      }

      if (!edge.generalizationGroupId) {
        issues.push({
          id: `inheritance-missing-group-${edge.id}`,
          level: "error",
          message: `La gerarchia ISA tra "${sourceNode.label}" e "${targetNode.label}" non ha ancora un vincolo.`,
          targetId: edge.id,
          targetType: "edge",
        });
      } else {
        const group = generalizationGroupById.get(edge.generalizationGroupId);
        if (!group) {
          issues.push({
            id: `inheritance-unknown-group-${edge.id}`,
            level: "error",
            message: `Il ramo ISA tra "${sourceNode.label}" e "${targetNode.label}" punta a una gerarchia inesistente.`,
            targetId: edge.id,
            targetType: "edge",
          });
        } else {
          if (!group.isaCompleteness || !group.isaDisjointness) {
            issues.push({
              id: `inheritance-group-missing-constraint-${edge.id}`,
              level: "error",
              message: `Il ramo ISA tra "${sourceNode.label}" e "${targetNode.label}" appartiene a un gruppo senza vincolo.`,
              targetId: edge.id,
              targetType: "edge",
            });
          }

          if (group.supertypeId !== edge.targetId || !group.subtypeIds.includes(edge.sourceId)) {
            issues.push({
              id: `inheritance-incoherent-group-${edge.id}`,
              level: "error",
              message: `Il ramo ISA tra "${sourceNode.label}" e "${targetNode.label}" non e coerente con la gerarchia "${group.label ?? group.id}".`,
              targetId: edge.id,
              targetType: "edge",
            });
          }
        }
      }

      if (entityIdsForIsa.has(edge.sourceId) && entityIdsForIsa.has(edge.targetId)) {
        isaChildrenByParent.set(edge.targetId, [...(isaChildrenByParent.get(edge.targetId) ?? []), edge.sourceId]);
      }
    });

  const visitingIsa = new Set<string>();
  const visitedIsa = new Set<string>();
  const reportIsaCycle = (entityId: string, path: string[]): void => {
    if (visitingIsa.has(entityId)) {
      issues.push({
        id: `inheritance-cycle-${[...path, entityId].join("-")}`,
        level: "error",
        message: "La gerarchia ISA contiene un ciclo.",
        targetId: entityId,
        targetType: "node",
      });
      return;
    }
    if (visitedIsa.has(entityId)) {
      return;
    }
    visitingIsa.add(entityId);
    (isaChildrenByParent.get(entityId) ?? []).forEach((childId) => reportIsaCycle(childId, [...path, entityId]));
    visitingIsa.delete(entityId);
    visitedIsa.add(entityId);
  };
  entityIdsForIsa.forEach((entityId) => reportIsaCycle(entityId, []));

  diagram.edges.forEach((edge) => {
    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);

    if (!sourceNode || !targetNode) {
      issues.push({
        id: `missing-${edge.id}`,
        level: "error",
        message: `Il collegamento "${edge.id}" non e valido perche punta a un elemento mancante; per risolvere elimina il collegamento o ricrea l'elemento mancante.`,
        targetId: edge.id,
        targetType: "edge",
      });
      return;
    }

    if (!canConnect(edge.type, sourceNode, targetNode)) {
      issues.push({
        id: `invalid-${edge.id}`,
        level: "error",
        message: `Il collegamento tra "${sourceNode.label}" e "${targetNode.label}" non e valido perche non rispetta la sintassi Chen selezionata; per risolvere collega una coppia di elementi compatibile.`,
        targetId: edge.id,
        targetType: "edge",
      });
    }

    const duplicateSignature = getDuplicateEdgeSignature(edge);
    if (duplicateSignature) {
      const firstDuplicate = duplicateEdgeOwners.get(duplicateSignature);
      if (firstDuplicate) {
        issues.push({
          id: `duplicate-${edge.id}`,
          level: "warning",
          message: `Il collegamento tra "${sourceNode.label}" e "${targetNode.label}" e duplicato.`,
          targetId: edge.id,
          targetType: "edge",
        });
      } else {
        duplicateEdgeOwners.set(duplicateSignature, edge);
      }
    }

    if (edge.type === "inheritance" && sourceNode.type === "entity" && targetNode.type === "entity") {
      const sameSuperClassCount = diagram.edges.filter(
        (candidate) =>
          candidate.type === "inheritance" &&
          candidate.sourceId === edge.sourceId &&
          candidate.id !== edge.id,
      ).length;

      if (sameSuperClassCount > 0) {
        issues.push({
          id: `subclass-${edge.id}`,
          level: "warning",
          message: `La sottoclasse "${sourceNode.label}" è collegata a più superclassi.`,
          targetId: edge.id,
          targetType: "edge",
        });
      }
    }

    if (edge.type === "connector") {
      const participation = getConnectorParticipation(edge, sourceNode, targetNode);
      const hasValidCardinality =
        participation !== undefined && isSupportedCardinality(participation.cardinality ?? "");

      if (!hasValidCardinality) {
        issues.push({
          id: `cardinality-${edge.id}`,
          level: "warning",
          message: `Il collegamento tra "${sourceNode.label}" e "${targetNode.label}" non ha cardinalita definita.`,
          targetId: edge.id,
          targetType: "edge",
        });
      }
    }
  });

  return issues;
}

export function selectedNodes(diagram: DiagramDocument, selection: SelectionState): DiagramNode[] {
  return diagram.nodes.filter((node) => selection.nodeIds.includes(node.id));
}

export function boundsForSelection(
  diagram: DiagramDocument,
  selection: SelectionState,
): ReturnType<typeof getNodeBounds>[] {
  return selectedNodes(diagram, selection).map((node) => getNodeBounds(node));
}
