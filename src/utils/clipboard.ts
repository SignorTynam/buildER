import type {
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  GeneralizationGroup,
  InternalIdentifier,
  SelectionState,
} from "../types/diagram";
import { GRID_SIZE, snapValue } from "./geometry";

export interface DiagramClipboardPayload {
  kind: "er-studio/diagram-selection";
  version: 1;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  selection: SelectionState;
  copiedAt: string;
  generalizationGroups?: GeneralizationGroup[];
  warnings?: string[];
}

interface PasteOptions {
  offset?: number;
}

const CLIPBOARD_KIND = "er-studio/diagram-selection";
const CLIPBOARD_VERSION = 1;
const COPY_SUFFIX = "_C";

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 11)}`;
}

function normalizeNameKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .toLowerCase();
}

function normalizeLabel(value: string, nodeType: DiagramNode["type"]): string {
  const normalized = value.trim().replace(/\s+/g, "_");
  const fallback =
    nodeType === "entity" ? "ENTITA" : nodeType === "relationship" ? "RELAZIONE" : "ATTRIBUTO";
  const candidate = normalized.length > 0 ? normalized : fallback;
  return nodeType === "entity" || nodeType === "relationship" ? candidate.toUpperCase() : candidate;
}

function getCopyBaseLabel(label: string): string {
  const normalized = label.trim().replace(/\s+/g, "_");
  const match = normalized.match(/^(.*)_C(?:\d+)?$/i);
  return match?.[1] && match[1].trim().length > 0 ? match[1] : normalized;
}

function createCopiedLabel(label: string, nodeType: DiagramNode["type"], usedLabelKeys: Set<string>): string {
  const baseLabel = normalizeLabel(getCopyBaseLabel(label), nodeType);
  const firstCandidate = normalizeLabel(`${baseLabel}${COPY_SUFFIX}`, nodeType);
  const firstKey = normalizeNameKey(firstCandidate);
  if (!usedLabelKeys.has(firstKey)) {
    usedLabelKeys.add(firstKey);
    return firstCandidate;
  }

  let suffix = 2;
  while (true) {
    const candidate = normalizeLabel(`${baseLabel}${COPY_SUFFIX}${suffix}`, nodeType);
    const key = normalizeNameKey(candidate);
    if (!usedLabelKeys.has(key)) {
      usedLabelKeys.add(key);
      return candidate;
    }
    suffix += 1;
  }
}

function createUniqueId(label: string, usedIds: Set<string>): string {
  const normalized = label.trim().replace(/\s+/g, "_");
  const fallback = normalized.length > 0 ? normalized : "node";
  let candidate = fallback;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${fallback}_${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

function getEdgePrefix(edge: DiagramEdge): string {
  if (edge.type === "connector") {
    return "connector";
  }
  if (edge.type === "attribute") {
    return "attributeLink";
  }
  return "inheritance";
}

function cloneNode(node: DiagramNode): DiagramNode {
  return JSON.parse(JSON.stringify(node)) as DiagramNode;
}

function cloneEdge(edge: DiagramEdge): DiagramEdge {
  return JSON.parse(JSON.stringify(edge)) as DiagramEdge;
}

function cloneGroup(group: GeneralizationGroup): GeneralizationGroup {
  return JSON.parse(JSON.stringify(group)) as GeneralizationGroup;
}

function isSelectionEmpty(selection: SelectionState): boolean {
  return selection.nodeIds.length === 0 && selection.edgeIds.length === 0;
}

function addOwnedAttributeClosure(
  diagram: DiagramDocument,
  includedNodeIds: Set<string>,
): void {
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const queue = [...includedNodeIds];
  const visitedHosts = new Set<string>();

  while (queue.length > 0) {
    const hostId = queue.shift() as string;
    if (visitedHosts.has(hostId)) {
      continue;
    }
    visitedHosts.add(hostId);

    diagram.edges.forEach((edge) => {
      if (edge.type !== "attribute") {
        return;
      }

      const sourceNode = nodeById.get(edge.sourceId);
      const targetNode = nodeById.get(edge.targetId);
      if (!sourceNode || !targetNode) {
        return;
      }

      const childId =
        edge.sourceId === hostId && targetNode.type === "attribute"
          ? edge.targetId
          : edge.targetId === hostId && sourceNode.type === "attribute"
            ? edge.sourceId
            : undefined;
      if (!childId || includedNodeIds.has(childId)) {
        return;
      }

      includedNodeIds.add(childId);
      queue.push(childId);
    });
  }
}

export function createDiagramClipboardPayload(
  diagram: DiagramDocument,
  selection: SelectionState,
): DiagramClipboardPayload | null {
  if (isSelectionEmpty(selection)) {
    return null;
  }

  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const selectedEdgeIds = new Set(selection.edgeIds);
  const includedNodeIds = new Set(
    selection.nodeIds.filter((nodeId) => nodeById.has(nodeId)),
  );

  diagram.edges.forEach((edge) => {
    if (!selectedEdgeIds.has(edge.id)) {
      return;
    }
    if (nodeById.has(edge.sourceId) && nodeById.has(edge.targetId)) {
      includedNodeIds.add(edge.sourceId);
      includedNodeIds.add(edge.targetId);
    }
  });
  addOwnedAttributeClosure(diagram, includedNodeIds);

  if (includedNodeIds.size === 0) {
    return null;
  }

  const includedEdges = diagram.edges.filter(
    (edge) =>
      nodeById.has(edge.sourceId) &&
      nodeById.has(edge.targetId) &&
      includedNodeIds.has(edge.sourceId) &&
      includedNodeIds.has(edge.targetId),
  );
  const copiedEdgeIds = new Set(includedEdges.map((edge) => edge.id));
  const warnings = diagram.nodes.some(
    (node) => includedNodeIds.has(node.id) && node.type === "entity" && (node.externalIdentifiers ?? []).length > 0,
  )
    ? ["Gli identificatori esterni o misti possono dipendere da elementi fuori selezione e verranno copiati solo se restano coerenti."]
    : [];
  const copiedGroups = (diagram.generalizationGroups ?? []).filter((group) => {
    if (!includedNodeIds.has(group.supertypeId) || group.subtypeIds.some((subtypeId) => !includedNodeIds.has(subtypeId))) {
      return false;
    }

    return includedEdges.some((edge) => edge.type === "inheritance" && edge.generalizationGroupId === group.id);
  });

  return {
    kind: CLIPBOARD_KIND,
    version: CLIPBOARD_VERSION,
    nodes: diagram.nodes.filter((node) => includedNodeIds.has(node.id)).map(cloneNode),
    edges: includedEdges.map(cloneEdge),
    selection: {
      nodeIds: selection.nodeIds.filter((nodeId) => includedNodeIds.has(nodeId)),
      edgeIds: selection.edgeIds.filter((edgeId) => copiedEdgeIds.has(edgeId)),
    },
    copiedAt: new Date().toISOString(),
    generalizationGroups: copiedGroups.map(cloneGroup),
    warnings,
  };
}

function remapEntityMetadata(
  node: Extract<DiagramNode, { type: "entity" }>,
  nodeIdMap: Map<string, string>,
  internalIdentifierIdMap: Map<string, string>,
  externalIdentifierIdMap: Map<string, string>,
): Extract<DiagramNode, { type: "entity" }> {
  const relationshipParticipations = (node.relationshipParticipations ?? [])
    .map((participation) => {
      const relationshipId = nodeIdMap.get(participation.relationshipId);
      if (!relationshipId) {
        return null;
      }

      return {
        ...participation,
        id: createId("participation"),
        relationshipId,
      };
    })
    .filter((participation): participation is NonNullable<typeof participation> => participation !== null);

  const internalIdentifiers = (node.internalIdentifiers ?? [])
    .map((identifier) => {
      const attributeIds = identifier.attributeIds
        .map((attributeId) => nodeIdMap.get(attributeId))
        .filter((attributeId): attributeId is string => typeof attributeId === "string");

      if (attributeIds.length === 0) {
        return null;
      }

      return {
        id: internalIdentifierIdMap.get(identifier.id) ?? createId("internalIdentifier"),
        attributeIds,
      };
    })
    .filter((identifier): identifier is InternalIdentifier => identifier !== null);

  const externalIdentifiers = (node.externalIdentifiers ?? [])
    .map((identifier) => {
      const importedParts = identifier.importedParts
        .map((part) => {
          const relationshipId = nodeIdMap.get(part.relationshipId);
          const sourceEntityId = nodeIdMap.get(part.sourceEntityId);
          const importedIdentifierId =
            part.importedIdentifierKind === "external"
              ? externalIdentifierIdMap.get(part.importedIdentifierId)
              : internalIdentifierIdMap.get(part.importedIdentifierId);

          if (!relationshipId || !sourceEntityId || !importedIdentifierId) {
            return null;
          }

          return {
            ...part,
            id: createId("externalIdentifierPart"),
            relationshipId,
            sourceEntityId,
            importedIdentifierId,
          };
        })
        .filter((part): part is NonNullable<typeof part> => part !== null);
      const localAttributeIds = identifier.localAttributeIds
        .map((attributeId) => nodeIdMap.get(attributeId))
        .filter((attributeId): attributeId is string => typeof attributeId === "string")
        .filter((attributeId, index, source) => source.indexOf(attributeId) === index);

      if (importedParts.length === 0 && localAttributeIds.length === 0) {
        return null;
      }

      return {
        ...identifier,
        id: externalIdentifierIdMap.get(identifier.id) ?? createId("externalIdentifier"),
        importedParts,
        localAttributeIds,
      };
    })
    .filter((identifier): identifier is NonNullable<typeof identifier> => identifier !== null);

  return {
    ...node,
    relationshipParticipations,
    internalIdentifiers: internalIdentifiers.length > 0 ? internalIdentifiers : undefined,
    externalIdentifiers: externalIdentifiers.length > 0 ? externalIdentifiers : undefined,
  };
}

function isDiagramClipboardPayload(value: unknown): value is DiagramClipboardPayload {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<DiagramClipboardPayload>;
  return (
    candidate.kind === CLIPBOARD_KIND &&
    candidate.version === CLIPBOARD_VERSION &&
    Array.isArray(candidate.nodes) &&
    Array.isArray(candidate.edges) &&
    typeof candidate.selection === "object" &&
    candidate.selection !== null
  );
}

export function parseDiagramClipboardPayload(text: string): DiagramClipboardPayload | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return isDiagramClipboardPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function serializeDiagramClipboardPayload(payload: DiagramClipboardPayload): string {
  return JSON.stringify(payload);
}

export function pasteDiagramClipboardPayload(
  diagram: DiagramDocument,
  payload: DiagramClipboardPayload,
  options?: PasteOptions,
): { diagram: DiagramDocument; selection: SelectionState } | null {
  if (!isDiagramClipboardPayload(payload) || payload.nodes.length === 0) {
    return null;
  }

  const offset = options?.offset ?? GRID_SIZE * 2;
  const usedIds = new Set(diagram.nodes.map((node) => node.id));
  const usedLabelKeys = new Set(diagram.nodes.map((node) => normalizeNameKey(node.label)));
  const nodeIdMap = new Map<string, string>();
  const internalIdentifierIdMap = new Map<string, string>();
  const externalIdentifierIdMap = new Map<string, string>();

  const pastedNodes = payload.nodes.map((node) => {
    const label = createCopiedLabel(node.label, node.type, usedLabelKeys);
    const id = createUniqueId(label, usedIds);
    nodeIdMap.set(node.id, id);

    const nextNode = {
      ...cloneNode(node),
      id,
      label,
      x: snapValue(node.x + offset),
      y: snapValue(node.y + offset),
    };

    if (nextNode.type === "entity") {
      (nextNode.internalIdentifiers ?? []).forEach((identifier) => {
        internalIdentifierIdMap.set(identifier.id, createId("internalIdentifier"));
      });
      (nextNode.externalIdentifiers ?? []).forEach((identifier) => {
        externalIdentifierIdMap.set(identifier.id, createId("externalIdentifier"));
      });
    }

    return nextNode;
  });

  const pastedNodesWithMetadata = pastedNodes.map((node) =>
    node.type === "entity" ? remapEntityMetadata(node, nodeIdMap, internalIdentifierIdMap, externalIdentifierIdMap) : node,
  );

  const copiedGroupIds = new Set((payload.generalizationGroups ?? []).map((group) => group.id));
  const groupIdMap = new Map<string, string>();
  const pastedGroups = (payload.generalizationGroups ?? [])
    .map((group) => {
      const supertypeId = nodeIdMap.get(group.supertypeId);
      const subtypeIds = group.subtypeIds
        .map((subtypeId) => nodeIdMap.get(subtypeId))
        .filter((subtypeId): subtypeId is string => typeof subtypeId === "string");

      if (!supertypeId || subtypeIds.length !== group.subtypeIds.length) {
        return null;
      }

      const id = createId("generalizationGroup");
      groupIdMap.set(group.id, id);
      return {
        ...cloneGroup(group),
        id,
        supertypeId,
        subtypeIds,
      };
    })
    .filter((group): group is GeneralizationGroup => group !== null);

  const pastedEdges = payload.edges
    .map((edge) => {
      const sourceId = nodeIdMap.get(edge.sourceId);
      const targetId = nodeIdMap.get(edge.targetId);
      if (!sourceId || !targetId) {
        return null;
      }

      const nextEdge: DiagramEdge = {
        ...cloneEdge(edge),
        id: createId(getEdgePrefix(edge)),
        sourceId,
        targetId,
      };

      if (nextEdge.type === "connector" && nextEdge.participationId) {
        nextEdge.participationId = createId("participation");
      }

      if (nextEdge.type === "inheritance") {
        if (nextEdge.generalizationGroupId && copiedGroupIds.has(nextEdge.generalizationGroupId)) {
          nextEdge.generalizationGroupId = groupIdMap.get(nextEdge.generalizationGroupId);
        } else {
          delete nextEdge.generalizationGroupId;
          delete nextEdge.isaCompleteness;
          delete nextEdge.isaDisjointness;
        }
      }

      return nextEdge;
    })
    .filter((edge): edge is DiagramEdge => edge !== null);

  return {
    diagram: {
      ...diagram,
      nodes: [...diagram.nodes, ...pastedNodesWithMetadata],
      edges: [...diagram.edges, ...pastedEdges],
      generalizationGroups: [...(diagram.generalizationGroups ?? []), ...pastedGroups],
    },
    selection: {
      nodeIds: pastedNodesWithMetadata.map((node) => node.id),
      edgeIds: pastedEdges.map((edge) => edge.id),
    },
  };
}

export function duplicateDiagramSelection(
  diagram: DiagramDocument,
  selection: SelectionState,
): { diagram: DiagramDocument; selection: SelectionState } | null {
  const payload = createDiagramClipboardPayload(diagram, selection);
  return payload ? pasteDiagramClipboardPayload(diagram, payload, { offset: GRID_SIZE * 2 }) : null;
}
