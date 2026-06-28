import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent } from "react";
import { DiagramCanvas } from "./canvas/DiagramCanvas";
import { AppHeader } from "./components/AppHeader";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { ChangelogModal } from "./components/ChangelogModal";
import { CodePanel } from "./components/CodePanel";
import { CommandMenuModal } from "./components/CommandMenuModal";
import { CommitDialog } from "./components/versioning/CommitDialog";
import { RestoreVersionDialog } from "./components/versioning/RestoreVersionDialog";
import { VersionCompareMode } from "./components/versioning/VersionCompareMode";
import { VersioningPanel } from "./components/versioning/VersioningPanel";
import {
  CardinalityModal,
  type CardinalityDialogState,
  type CardinalityDialogTarget,
} from "./components/CardinalityModal";
import { KeyboardShortcutsModal } from "./components/KeyboardShortcutsModal";
import { NotesModal } from "./components/NotesModal";
import { OnboardingGuide } from "./components/OnboardingGuide";
import { SqlReverseErPreview } from "./components/SqlReverseErPreview";
import { SqlReverseInputModal } from "./components/SqlReverseInputModal";
import { SqlReverseLogicalPreview } from "./components/SqlReverseLogicalPreview";
import { SqlReversePreviewFrame } from "./components/SqlReversePreviewFrame";
import { WorkspaceToastStack } from "./components/WorkspaceToastStack";
import { StudioIcon } from "./components/icons/StudioIcon";
import { PanelSection, WarningCard } from "./components/panels";
import { useHistory } from "./hooks/useHistory";
import { useAppDialogs } from "./hooks/useAppDialogs";
import { useWorkspaceLayoutState, RESIZER_WIDTH } from "./hooks/useWorkspaceLayoutState";
import { useWorkspaceNotices } from "./hooks/useWorkspaceNotices";
import { useI18n } from "./i18n/useI18n";
import { translate, type MessageKey, type TranslationParams } from "./i18n";
import { LogicalTranslationWorkspace } from "./logical/LogicalTranslationWorkspace";
import { TranslationWorkspace } from "./translation/TranslationWorkspace";
import { Toolbar } from "./toolbar/Toolbar";
import type {
  AttributeNode,
  Bounds,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EntityNode,
  EditorMode,
  ExternalIdentifier,
  GeneralizationGroup,
  IdentifierSelection,
  IsaCompleteness,
  IsaDisjointness,
  Point,
  RelationshipNode,
  SelectionState,
  ToolKind,
  ValidationIssue,
  Viewport,
} from "./types/diagram";
import { EMPTY_LOGICAL_SELECTION } from "./types/logical";
import type {
  LogicalIssue,
  LogicalSelection,
  LogicalStage,
  LogicalTranslationChoice,
  LogicalTranslationItem,
  LogicalModel,
  LogicalWorkspaceDocument,
} from "./types/logical";
import type {
  ErTranslationChoice,
  ErTranslationItem,
  ErTranslationWorkspaceDocument,
  WorkspaceView,
} from "./types/translation";
import {
  DEFAULT_VIEWPORT,
  WORKSPACE_SESSION_SAVE_DEBOUNCE_MS,
  clampValue,
  readWorkspaceSessionBootstrap,
  saveWorkspaceSessionSnapshot,
  serializeWorkspaceSessionSnapshot,
  type WorkspaceSessionBootstrap,
  type WorkspaceSessionSnapshot,
} from "./features/workspace/workspaceSession";
import {
  alignNodes,
  assignInheritanceEdgeToGeneralizationGroup,
  assignInheritanceConstraintToGroup,
  canConnect,
  canAttributeHaveCardinality,
  canAttributeBecomeComposite,
  createSimpleInternalIdentifierForAttribute,
  createEdge,
  createEmptyDiagram,
  createGeneralizationGroupForInheritanceEdge,
  createNode,
  duplicateSelection,
  edgeAlreadyExists,
  type ExternalIdentifierInvalidation,
  getEligibleLocalExternalIdentifierAttributes,
  getEligibleImportedIdentifierParts,
  findNode,
  getMultivaluedAttributeSize,
  isEntityInGeneralizationGroup,
  normalizeGeneralizationGroups,
  renameNodeAsNameIdentity,
  revalidateExternalIdentifiers,
  removeEntityFromGeneralizationHierarchy,
  removeExternalIdentifierFromEntity,
  removeInternalIdentifierFromEntity,
  removeSelection,
  serializeDiagram,
  updateGeneralizationGroupDetails,
  updateGeneralizationGroupConstraint,
  validateNodeNameInNamespace,
  synchronizeEntityRelationshipParticipations,
  synchronizeExternalIdentifiers,
  synchronizeNodeNameIdentity,
  synchronizeInternalIdentifiers,
  validateDiagram,
  withMinimumNodeSizeForLabel,
  withPreferredNodeSizeForLabel,
} from "./utils/diagram";
import { parseErsDiagram, serializeDiagramToErs } from "./utils/ers";
import { shouldSyncCodeDraftFromDiagram } from "./utils/codeEditor";
import {
  createDiagramClipboardPayload,
  parseDiagramClipboardPayload,
  pasteDiagramClipboardPayload,
  serializeDiagramClipboardPayload,
  type DiagramClipboardPayload,
} from "./utils/clipboard";
import { downloadJpeg, downloadPng, downloadSvg } from "./utils/export";
import {
  GRID_SIZE,
  clipPointToNodePerimeter,
  getNodeCenter,
  getNodeConnectionSide,
  snapValue,
} from "./utils/geometry";
import {
  distributeAttributesAroundHost,
  placeNewAttributeAroundHost,
  type AttributeLayoutOptions,
} from "./utils/attributeLayout";
import { autoLayoutLogicalModel, normalizeLogicalModelGeometry } from "./utils/logicalLayout";
import {
  applyErTranslationChoice,
  buildErTranslationOverview,
  buildErTranslationSourceSignature,
  canOpenLogicalView,
  canOpenTranslationView,
  createEmptyErTranslationWorkspace,
  refreshErTranslationWorkspace,
} from "./utils/erTranslation";
import {
  createEmptyLogicalModel,
  createEmptyLogicalWorkspace,
  refreshLogicalWorkspace,
  updateLogicalWorkspaceModel,
} from "./utils/logicalWorkspace";
import {
  applyBulkLogicalFix,
  applyLogicalTranslationChoice,
  buildLogicalTranslationOverview,
  getLogicalTranslationOpenItemCount,
} from "./utils/logicalTranslation";
import {
  type LogicalColumnSqlPatch,
  updateLogicalColumnSqlMetadata,
} from "./utils/logicalSqlMetadata";
import { generateLogicalSql } from "./utils/logicalSql";
import { reverseSqlToDiagram, type SqlReverseDiagramResult } from "./utils/sqlReverseDiagram";
import { validateSqlReverseBetaSource } from "./utils/sqlReverseBetaValidation";
import {
  createEmptyProjectVersioningState,
  createProjectCommitSnapshot,
  parseProjectFile,
  ProjectFileError,
  PROJECT_FILE_ACCEPT,
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MIME_TYPE,
  serializeProjectFile,
  type ProjectFileWorkspaceState,
  type ProjectCommitSnapshot,
  type ProjectVersioningState,
} from "./utils/projectFile";
import {
  getProjectUncommittedChangeState,
  useProjectVersioning,
} from "./features/versioning/useProjectVersioning";
import type { VersionCompareRef } from "./features/versioning/projectVersionVisualDiff";
import type { SqlReverseIssue } from "./types/sqlReverse";
import {
  CONNECTOR_CARDINALITY_PRESETS,
  applyConnectorCardinalityToDiagram,
  ensureConnectorParticipation,
  getAttributeCardinalityOwner,
  getConnectorParticipation,
  getConnectorParticipationContext,
  normalizeCardinalityInput,
  normalizeSupportedCardinality,
  removeTemporaryCardinalityConnector,
  shouldOpenCardinalityDialogAfterEdgeCreation,
} from "./utils/cardinality";
import { TOOL_BY_SHORTCUT, getToolLabel } from "./utils/toolConfig";
import { APP_NAME, APP_TITLE, APP_VERSION, getAppChangelog, type AppChangelogEntry } from "./utils/appMeta";
import { VersionAnnouncement } from "./components/VersionAnnouncement";
import { classifyAppUpdate } from "./utils/versioning";
import type { AppUpdateKind } from "./utils/versioning";
import {
  getLastSeenAppVersion,
  hasSeenVersionAnnouncement,
  rememberLastSeenAppVersion,
  rememberVersionAnnouncementSeen,
} from "./utils/versionAnnouncementStorage";

interface VersionCompareSession {
  left: VersionCompareRef;
  right: VersionCompareRef;
}

type VisibleVersionUpdateKind = Extract<AppUpdateKind, "patch" | "minor" | "major">;
type AppTranslator = (key: MessageKey, params?: TranslationParams) => string;

interface VersionAnnouncementState {
  previousVersion: string | null;
  updateKind: VisibleVersionUpdateKind;
  changelogEntry: AppChangelogEntry;
}

function createFallbackChangelogEntry(
  version: string,
  updateKind: VisibleVersionUpdateKind,
  translate: AppTranslator,
): AppChangelogEntry {
  const importantUpdate = updateKind === "minor" || updateKind === "major";

  return {
    version,
    date: new Date().toISOString().slice(0, 10),
    impact: updateKind,
    headline: importantUpdate
      ? translate("app.updateFallback.importantHeadline")
      : translate("app.updateFallback.patchHeadline"),
    summary: importantUpdate
      ? translate("app.updateFallback.importantSummary")
      : translate("app.updateFallback.patchSummary"),
    updates: importantUpdate
      ? [
          translate("app.updateFallback.importantUpdatePrimary"),
          translate("app.updateFallback.importantUpdateSecondary"),
        ]
      : [translate("app.updateFallback.patchUpdate")],
  };
}

function createInitialSqlReverseWorkflowState(sourceSql = ""): SqlReverseWorkflowState {
  return {
    step: "idle",
    sourceSql,
    result: null,
    issues: [],
    logicalIssues: [],
    tableCount: 0,
    unsupportedStatementCount: 0,
    errorMessage: "",
    logicalViewport: { ...DEFAULT_VIEWPORT },
    erViewport: { ...DEFAULT_VIEWPORT },
    logicalSelection: { ...EMPTY_LOGICAL_SELECTION },
    erSelection: { nodeIds: [], edgeIds: [] },
    previewToken: 0,
    isPreviewReady: false,
  };
}

interface MixedIdentifierDialogState {
  hostEntityId: string;
  importedParts: Array<{
    relationshipId: string;
    sourceEntityId: string;
    importedIdentifierId: string;
    label: string;
  }>;
  attributes: Array<{ id: string; label: string }>;
  selectedImportedPartKeys: string[];
  selectedAttributeIds: string[];
  error: string;
}

interface GeneralizationGroupDialogState {
  kind: "assign" | "edit";
  edgeId?: string;
  groupId?: string;
  subtypeId: string;
  supertypeId: string;
  mode: "existing" | "new";
  selectedGroupId?: string;
  newGroupName: string;
  isaCompleteness: IsaCompleteness;
  isaDisjointness: IsaDisjointness;
  error: string;
  createdEdgeWasTemporary: boolean;
}

interface OnboardingSnapshot {
  entityCount: number;
  relationshipCount: number;
  edgeCount: number;
  labelsByNodeId: Record<string, string>;
}

type OnboardingStepId = "create-entity" | "create-relationship" | "create-connection" | "rename-node";

interface OnboardingStepState {
  entityCreated: boolean;
  relationshipCreated: boolean;
  connectionCreated: boolean;
  renamedNode: boolean;
}

interface OnboardingProgress {
  entityCreated: boolean;
  relationshipCreated: boolean;
  connectionCreated: boolean;
  renamedNode: boolean;
  activeStepId: OnboardingStepId;
  allCompleted: boolean;
}

type SqlReverseWorkflowStep = "idle" | "input" | "logical-preview" | "er-preview";

interface SqlReverseWorkflowState {
  step: SqlReverseWorkflowStep;
  sourceSql: string;
  result: SqlReverseDiagramResult | null;
  issues: SqlReverseIssue[];
  logicalIssues: LogicalIssue[];
  tableCount: number;
  unsupportedStatementCount: number;
  errorMessage: string;
  logicalViewport: Viewport;
  erViewport: Viewport;
  logicalSelection: LogicalSelection;
  erSelection: SelectionState;
  previewToken: number;
  isPreviewReady: boolean;
}

const ONBOARDING_STORAGE_KEY = "chen-er-diagram-studio:onboarding-v1:done";
const APP_BOOT_DELAY_MS = clampValue(Number.parseInt(import.meta.env.VITE_APP_BOOT_DELAY_MS ?? "900", 10) || 900, 700, 1200);

function normalizeMessagePart(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/[;:,.!?]+$/g, "");
}

function lowerCaseFirst(value: string): string {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function buildStructuredErrorMessage(what: string, why: string, how: string, t: AppTranslator = translate): string {
  const normalizedWhat = normalizeMessagePart(what) || t("errors.structured.defaultWhat");
  const normalizedWhy = normalizeMessagePart(why) || t("errors.structured.defaultWhy");
  const normalizedHow = normalizeMessagePart(how) || t("errors.structured.defaultHow");
  return t("errors.structured.template", {
    what: normalizedWhat,
    why: lowerCaseFirst(normalizedWhy),
    how: lowerCaseFirst(normalizedHow),
  });
}

function formatErrorFromRawMessage(message: string, t: AppTranslator = translate, fallbackHow = t("errors.rawFallbackHow")): string {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return buildStructuredErrorMessage(
      t("errors.structured.defaultWhat"),
      t("errors.structured.defaultWhy"),
      fallbackHow,
      t,
    );
  }

  const alreadyStructured = /^(errore|error|gabim):\s.+\s.+;\s.+\.$/i.test(normalizedMessage);
  if (alreadyStructured) {
    return normalizedMessage;
  }

  const reason = normalizeMessagePart(normalizedMessage.replace(/^errore[:\s]*/i, ""));
  return buildStructuredErrorMessage(t("errors.structured.defaultWhat"), reason, fallbackHow, t);
}

function formatErsErrorMessage(message: string, t: AppTranslator = translate): string {
  const reason = normalizeMessagePart(message.replace(/^errore[:\s]*/i, "")) || t("errors.ers.defaultReason");
  return buildStructuredErrorMessage(
    t("errors.ers.what"),
    reason,
    t("errors.ers.how"),
    t,
  );
}

function formatProjectFileErrorMessage(error: unknown, t: AppTranslator = translate): string {
  if (error instanceof ProjectFileError) {
    return buildStructuredErrorMessage(error.details.what, error.details.why, error.details.how, t);
  }

  return buildStructuredErrorMessage(
    t("errors.projectFile.what"),
    t("errors.projectFile.why"),
    t("errors.projectFile.how"),
    t,
  );
}

function sanitizeFileNameBase(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "diagramma-er";
}

const DEFAULT_ATTRIBUTE_SIZE = { width: 170, height: 72 };

function downloadTextFile(content: string, fileName: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function getSimpleIdentifierSelectionForAttribute(
  diagram: DiagramDocument,
  attributeId: string,
): IdentifierSelection | null {
  for (const node of diagram.nodes) {
    if (node.type !== "entity") {
      continue;
    }

    const identifier = (node.internalIdentifiers ?? []).find(
      (candidate) => candidate.attributeIds.length === 1 && candidate.attributeIds[0] === attributeId,
    );

    if (identifier) {
      return {
        kind: "internal",
        hostEntityId: node.id,
        internalIdentifierId: identifier.id,
        attributeIds: [attributeId],
      };
    }
  }

  return null;
}

function identifierSelectionExists(diagram: DiagramDocument, selection: IdentifierSelection): boolean {
  const hostEntity = diagram.nodes.find(
    (node): node is EntityNode => node.id === selection.hostEntityId && node.type === "entity",
  );
  if (!hostEntity) {
    return false;
  }

  if (selection.kind === "internal") {
    return (hostEntity.internalIdentifiers ?? []).some(
      (identifier) => identifier.id === selection.internalIdentifierId,
    );
  }

  return (hostEntity.externalIdentifiers ?? []).some(
    (identifier) => identifier.id === selection.externalIdentifierId,
  );
}

function readOnboardingCompleted(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function markOnboardingCompleted() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
  } catch {
    // Ignore storage errors and continue without persistence.
  }
}

function normalizeLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isDefaultNodeLabel(node: DiagramNode): boolean {
  const normalizedLabel = normalizeLabel(node.label);

  if (node.type === "entity") {
    return normalizedLabel.startsWith("nuova entita") || /^entita\d+$/.test(normalizedLabel);
  }

  if (node.type === "relationship") {
    return normalizedLabel.startsWith("nuova relazione") || /^relazione\d+$/.test(normalizedLabel);
  }

  if (node.type === "attribute") {
    return normalizedLabel.startsWith("nuovo attributo") || /^attributo\d+$/.test(normalizedLabel);
  }

  return false;
}

function createOnboardingSnapshot(diagram: DiagramDocument): OnboardingSnapshot {
  const labelsByNodeId: Record<string, string> = {};
  diagram.nodes.forEach((node) => {
    labelsByNodeId[node.id] = node.label;
  });

  return {
    entityCount: diagram.nodes.filter((node) => node.type === "entity").length,
    relationshipCount: diagram.nodes.filter((node) => node.type === "relationship").length,
    edgeCount: diagram.edges.length,
    labelsByNodeId,
  };
}

function getOnboardingProgress(stepState: OnboardingStepState): OnboardingProgress {
  const orderedSteps: Array<{ id: OnboardingStepId; done: boolean }> = [
    { id: "create-entity", done: stepState.entityCreated },
    { id: "create-relationship", done: stepState.relationshipCreated },
    { id: "create-connection", done: stepState.connectionCreated },
    { id: "rename-node", done: stepState.renamedNode },
  ];
  const activeStep = orderedSteps.find((step) => !step.done);

  return {
    ...stepState,
    activeStepId: activeStep ? activeStep.id : "rename-node",
    allCompleted: orderedSteps.every((step) => step.done),
  };
}

function updateNodeInDiagram(
  diagram: DiagramDocument,
  nodeId: string,
  patch: Partial<DiagramNode>,
): DiagramDocument {
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) =>
      node.id === nodeId ? withMinimumNodeSizeForLabel({ ...node, ...patch } as DiagramNode) : node,
    ),
  };
}

function updateNodesInDiagram(
  diagram: DiagramDocument,
  nodeIds: string[],
  patch: Partial<DiagramNode>,
): DiagramDocument {
  const targetIds = new Set(nodeIds);

  return {
    ...diagram,
    nodes: diagram.nodes.map((node) =>
      targetIds.has(node.id) ? withMinimumNodeSizeForLabel({ ...node, ...patch } as DiagramNode) : node,
    ),
  };
}

function updateEdgeInDiagram(
  diagram: DiagramDocument,
  edgeId: string,
  patch: Partial<DiagramEdge>,
): DiagramDocument {
  return {
    ...diagram,
    edges: diagram.edges.map((edge) => (edge.id === edgeId ? { ...edge, ...patch } : edge)),
  };
}

function updateEdgesInDiagram(
  diagram: DiagramDocument,
  edgeIds: string[],
  patch: Partial<DiagramEdge>,
): DiagramDocument {
  const targetIds = new Set(edgeIds);
  return {
    ...diagram,
    edges: diagram.edges.map((edge) => (targetIds.has(edge.id) ? { ...edge, ...patch } : edge)),
  };
}

function updateEdgeTextInDiagram(diagram: DiagramDocument, edgeId: string, value: string): DiagramDocument {
  return {
    ...diagram,
    edges: diagram.edges.map((edge) => {
      if (edge.id !== edgeId) {
        return edge;
      }

      return { ...edge, label: value };
    }),
  };
}

function findEntityHostForAttribute(diagram: DiagramDocument, attributeId: string): EntityNode | undefined {
  const visited = new Set<string>();
  let currentAttributeId = attributeId;

  while (!visited.has(currentAttributeId)) {
    visited.add(currentAttributeId);
    const attributeEdge = diagram.edges.find(
      (edge) => edge.type === "attribute" && edge.sourceId === currentAttributeId,
    ) ?? diagram.edges.find(
      (edge) =>
        edge.type === "attribute" &&
        edge.targetId === currentAttributeId &&
        diagram.nodes.find((node) => node.id === edge.sourceId)?.type !== "attribute",
    );

    if (!attributeEdge) {
      return undefined;
    }

    const hostId = attributeEdge.sourceId === currentAttributeId ? attributeEdge.targetId : attributeEdge.sourceId;
    const hostNode = diagram.nodes.find((node) => node.id === hostId);

    if (hostNode?.type === "entity") {
      return hostNode;
    }

    if (hostNode?.type !== "attribute") {
      return undefined;
    }

    currentAttributeId = hostNode.id;
  }

  return undefined;
}

function findRelationshipBetweenEntities(
  diagram: DiagramDocument,
  entityAId: string,
  entityBId: string,
): DiagramNode | undefined {
  for (const node of diagram.nodes) {
    if (node.type !== "relationship") {
      continue;
    }

    const connectedEntityIds = diagram.edges
      .filter((edge) => edge.type === "connector" && (edge.sourceId === node.id || edge.targetId === node.id))
      .map((edge) => (edge.sourceId === node.id ? edge.targetId : edge.sourceId));

    if (connectedEntityIds.includes(entityAId) && connectedEntityIds.includes(entityBId)) {
      return node;
    }
  }

  return undefined;
}

function findInternalIdentifierContainingAttribute(
  entity: EntityNode,
  attributeId: string,
): string | undefined {
  return entity.internalIdentifiers?.find((identifier) => identifier.attributeIds.includes(attributeId))?.id;
}

function buildExternalImportPartKey(part: {
  relationshipId: string;
  sourceEntityId: string;
  importedIdentifierId: string;
}): string {
  return [part.relationshipId, part.sourceEntityId, part.importedIdentifierId].join("::");
}

function getNodeKindLabel(node: DiagramNode, t: AppTranslator = translate): string {
  if (node.type === "entity") {
    return t("common.entities.entity");
  }

  if (node.type === "relationship") {
    return t("common.entities.relationship");
  }

  if (node.type === "attribute") {
    return t("common.entities.attribute");
  }

  return t("common.entities.element");
}

function getConnectionFailureReason(
  edgeType: "connector" | "attribute" | "inheritance",
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
  t: AppTranslator = translate,
): string {
  if (sourceNode.id === targetNode.id) {
    return t("connection.errors.self");
  }

  const sourceKind = getNodeKindLabel(sourceNode, t);
  const targetKind = getNodeKindLabel(targetNode, t);

  if (edgeType === "connector") {
    if (sourceNode.type === "entity" && targetNode.type === "entity") {
      return t("connection.errors.twoEntities");
    }

    if (sourceNode.type === "relationship" && targetNode.type === "relationship") {
      return t("connection.errors.twoRelationships");
    }

    if (sourceNode.type === "attribute" || targetNode.type === "attribute") {
      return t("connection.errors.attributeNeedsAttributeTool");
    }

    return t("connection.errors.invalidConnector", { sourceKind, targetKind });
  }

  if (edgeType === "inheritance") {
    return t("connection.errors.inheritanceNeedsEntities", { sourceKind, targetKind });
  }

  const oneIsAttribute = sourceNode.type === "attribute" || targetNode.type === "attribute";
  if (!oneIsAttribute) {
    return t("connection.errors.attributeNeedsOneAttribute", { sourceKind, targetKind });
  }

  return t("connection.errors.invalidAttributeConnection", { sourceKind, targetKind });
}

type AttributeCreationHost = Extract<DiagramNode, { type: "entity" | "relationship" | "attribute" }>;
type AttributeNodeDraft = Extract<DiagramNode, { type: "attribute" }>;
type DirectAttributeLayoutHost = EntityNode | RelationshipNode | AttributeNode;

function padBounds(bounds: Bounds, padding: number): Bounds {
  return {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };
}

function buildConnectorCorridor(start: Point, end: Point, padding: number): Bounds {
  return {
    x: Math.min(start.x, end.x) - padding,
    y: Math.min(start.y, end.y) - padding,
    width: Math.abs(end.x - start.x) + padding * 2,
    height: Math.abs(end.y - start.y) + padding * 2,
  };
}

function buildAttributeLayoutOptionsForHost(
  diagram: DiagramDocument,
  hostNode: DirectAttributeLayoutHost,
  attributeIdsBeingLaidOut: string[],
): AttributeLayoutOptions {
  const layoutAttributeIds = new Set(attributeIdsBeingLaidOut);
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  const occupiedBounds: Bounds[] = [];
  const nodePadding = 14;
  const connectorPadding = 28;

  diagram.nodes.forEach((node) => {
    if (node.id === hostNode.id) {
      return;
    }

    if (node.type === "attribute" && layoutAttributeIds.has(node.id)) {
      return;
    }

    if (node.type === "entity" || node.type === "relationship" || node.type === "attribute") {
      occupiedBounds.push(padBounds(node, nodePadding));
    }
  });

  diagram.edges.forEach((edge) => {
    if (
      hostNode.type === "attribute" ||
      edge.type !== "connector" ||
      (edge.sourceId !== hostNode.id && edge.targetId !== hostNode.id)
    ) {
      return;
    }

    const otherNode = nodeById.get(edge.sourceId === hostNode.id ? edge.targetId : edge.sourceId);
    if (!otherNode) {
      return;
    }

    const otherCenter = getNodeCenter(otherNode);
    const hostEndpoint = clipPointToNodePerimeter(hostNode, otherCenter);
    const otherEndpoint = clipPointToNodePerimeter(otherNode, getNodeCenter(hostNode));
    occupiedBounds.push(buildConnectorCorridor(hostEndpoint, otherEndpoint, connectorPadding));
  });

  return {
    occupiedBounds,
    preserveInputOrder: true,
  };
}

function findDirectHostedAttributes(
  diagram: DiagramDocument,
  hostId: string,
): AttributeNodeDraft[] {
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));

  return diagram.edges.flatMap((edge) => {
    if (edge.type !== "attribute") {
      return [];
    }

    const candidateId =
      edge.sourceId === hostId
        ? edge.targetId
        : edge.targetId === hostId
          ? edge.sourceId
          : undefined;

    if (!candidateId) {
      return [];
    }

    const candidateNode = nodeById.get(candidateId);
    return candidateNode?.type === "attribute" ? [candidateNode] : [];
  });
}

function getNextAttributePosition(
  diagram: DiagramDocument,
  hostNode: AttributeCreationHost,
  nextAttribute: AttributeNodeDraft,
): Point {
  const hostedAttributes = findDirectHostedAttributes(diagram, hostNode.id);
  const layoutHost =
    hostNode.type === "attribute" && hostNode.isMultivalued !== true
      ? {
          ...hostNode,
          ...getMultivaluedAttributeSize(hostNode.label),
          isMultivalued: true,
        }
      : hostNode;

  const positionedNextAttribute = placeNewAttributeAroundHost(
    layoutHost,
    hostedAttributes,
    nextAttribute,
    buildAttributeLayoutOptionsForHost(
      diagram,
      layoutHost,
      hostedAttributes.map((attribute) => attribute.id),
    ),
  );

  return {
    x: positionedNextAttribute.x,
    y: positionedNextAttribute.y,
  };
}

function layoutDirectAttributesAroundHost(
  diagram: DiagramDocument,
  hostNode: AttributeCreationHost,
  attributeIds: string[],
): DiagramDocument {
  if (attributeIds.length === 0) {
    return diagram;
  }

  if (hostNode.type === "attribute" && hostNode.isMultivalued !== true) {
    return diagram;
  }

  const idSet = new Set(attributeIds);
  const attributes = diagram.nodes
    .filter((node): node is AttributeNode => node.type === "attribute" && idSet.has(node.id))
    .sort((left, right) => attributeIds.indexOf(left.id) - attributeIds.indexOf(right.id));
  const positionedAttributes = distributeAttributesAroundHost(
    hostNode,
    attributes,
    buildAttributeLayoutOptionsForHost(diagram, hostNode, attributeIds),
  );
  const positions = new Map<string, Point>(
    positionedAttributes.map((attribute) => [
      attribute.id,
      { x: attribute.x, y: attribute.y },
    ]),
  );

  if (positions.size === 0) {
    return diagram;
  }

  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      const position = positions.get(node.id);
      return position ? { ...node, ...position } : node;
    }),
  };
}

function createProjectFileWorkspaceStateFromBootstrap(
  sessionBootstrap: WorkspaceSessionBootstrap,
): ProjectFileWorkspaceState {
  return {
    tool: sessionBootstrap.tool,
    mode: sessionBootstrap.mode,
    selection: {
      nodeIds: [...sessionBootstrap.selection.nodeIds],
      edgeIds: [...sessionBootstrap.selection.edgeIds],
    },
    translationSelection: {
      nodeIds: [...sessionBootstrap.translationSelection.nodeIds],
      edgeIds: [...sessionBootstrap.translationSelection.edgeIds],
    },
    logicalSelection: { ...sessionBootstrap.logicalSelection },
    codeDraft: sessionBootstrap.codeDraft,
    codeDirty: sessionBootstrap.codeDirty,
    technicalPanelOpen: sessionBootstrap.technicalPanelOpen,
    technicalPanelTab: sessionBootstrap.technicalPanelTab,
    codePanelOpen: sessionBootstrap.codePanelOpen,
    codePanelWidth: sessionBootstrap.codePanelWidth,
    notesPanelOpen: sessionBootstrap.notesPanelOpen,
    notesPanelWidth: sessionBootstrap.notesPanelWidth,
    toolbarCollapsed: sessionBootstrap.toolbarCollapsed,
    focusMode: sessionBootstrap.focusMode,
    toolbarWidth: sessionBootstrap.toolbarWidth,
    showDiagnostics: sessionBootstrap.showDiagnostics,
  };
}

export default function App() {
  const { t } = useI18n();
  const appChangelog = useMemo(() => getAppChangelog(t), [t]);
  const sessionBootstrapRef = useRef<WorkspaceSessionBootstrap | null>(null);
  if (!sessionBootstrapRef.current) {
    sessionBootstrapRef.current = readWorkspaceSessionBootstrap();
  }
  const sessionBootstrap = sessionBootstrapRef.current;

  const initialDiagramRef = useRef<DiagramDocument>(sessionBootstrap.diagram);
  const history = useHistory<DiagramDocument>(initialDiagramRef.current);
  const initialTranslationWorkspaceRef = useRef<ErTranslationWorkspaceDocument>(sessionBootstrap.translationWorkspace);
  const translationHistory = useHistory<ErTranslationWorkspaceDocument>(initialTranslationWorkspaceRef.current);
  const initialLogicalWorkspaceRef = useRef<LogicalWorkspaceDocument>(sessionBootstrap.logicalWorkspace);
  const logicalHistory = useHistory<LogicalWorkspaceDocument>(initialLogicalWorkspaceRef.current);
  const initialSerializedCode = sessionBootstrap.codeDraft;
  const [booting, setBooting] = useState(true);
  const [diagramView, setDiagramView] = useState<WorkspaceView>(sessionBootstrap.diagramView);
  const [tool, setTool] = useState<ToolKind>(sessionBootstrap.tool);
  const [mode] = useState<EditorMode>(sessionBootstrap.mode);
  const [viewport, setViewport] = useState<Viewport>(() => ({ ...sessionBootstrap.viewport }));
  const [selection, setSelection] = useState<SelectionState>(() => ({
    nodeIds: [...sessionBootstrap.selection.nodeIds],
    edgeIds: [...sessionBootstrap.selection.edgeIds],
  }));
  const [identifierSelection, setIdentifierSelection] = useState<IdentifierSelection | null>(null);
  const [translationViewport, setTranslationViewport] = useState<Viewport>(() => ({ ...sessionBootstrap.translationViewport }));
  const [translationSelection, setTranslationSelection] = useState<SelectionState>(() => ({
    nodeIds: [...sessionBootstrap.translationSelection.nodeIds],
    edgeIds: [...sessionBootstrap.translationSelection.edgeIds],
  }));
  const [logicalViewport, setLogicalViewport] = useState<Viewport>(() => ({ ...sessionBootstrap.logicalViewport }));
  const [logicalSelection, setLogicalSelection] = useState<LogicalSelection>(() => ({ ...sessionBootstrap.logicalSelection }));
  const [logicalStage, setLogicalStage] = useState<LogicalStage>(sessionBootstrap.logicalStage);
  const [logicalTypeMode, setLogicalTypeMode] = useState(false);
  const [logicalPanelMode, setLogicalPanelMode] = useState<"review" | "sql">("review");
  const [logicalFitRequestToken, setLogicalFitRequestToken] = useState(0);
  const [logicalGenerated, setLogicalGenerated] = useState(sessionBootstrap.logicalGenerated);
  const {
    notices,
    statusMessage,
    setStatusMessage,
    setStatus,
    setStatusWarning,
    setStatusSuccess,
    setStatusError,
    showErrorNotice,
    showWarningNotice,
    showSuccessNotice,
    showSelectionWarningNotice,
    removeNotice: dismissNotice,
    dismissStickyNotices,
  } = useWorkspaceNotices({ formatErrorMessage: (message) => formatErrorFromRawMessage(message, t) });
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [versioningPanelOpen, setVersioningPanelOpen] = useState(false);
  const [commitDialogOpen, setCommitDialogOpen] = useState(false);
  const [versionCompareSession, setVersionCompareSession] = useState<VersionCompareSession | null>(null);
  const [restoreCommitId, setRestoreCommitId] = useState<string | null>(null);
  const [restoreDialogBusy, setRestoreDialogBusy] = useState(false);
  const [restoreDialogError, setRestoreDialogError] = useState("");
  const [commitDialogError, setCommitDialogError] = useState("");
  const [commitDialogBusy, setCommitDialogBusy] = useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [versionAnnouncement, setVersionAnnouncement] = useState<VersionAnnouncementState | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const {
    confirmDialog,
    promptDialog,
    promptValue,
    promptError,
    promptInputRef,
    setPromptValue,
    setPromptError,
    requestConfirmDialog,
    requestPromptDialog,
    closeConfirmDialog,
    closePromptDialog,
    submitPromptDialog,
  } = useAppDialogs({
    defaultConfirmLabel: t("common.actions.confirm"),
    defaultCancelLabel: t("common.actions.cancel"),
    defaultSaveLabel: t("common.actions.save"),
    defaultRequiredMessage: t("dialogs.prompt.required"),
  });
  const [cardinalityDialog, setCardinalityDialog] = useState<CardinalityDialogState | null>(null);
  const [mixedIdentifierDialog, setMixedIdentifierDialog] = useState<MixedIdentifierDialogState | null>(null);
  const [generalizationGroupDialog, setGeneralizationGroupDialog] = useState<GeneralizationGroupDialogState | null>(null);
  const [errorsPanelOpen, setErrorsPanelOpen] = useState(false);
  const [codeDraft, setCodeDraft] = useState(() => initialSerializedCode);
  const [codeDirty, setCodeDirty] = useState(sessionBootstrap.codeDirty);
  const [codeError, setCodeError] = useState("");
  const {
    technicalPanelOpen,
    setTechnicalPanelOpen,
    technicalPanelTab,
    setTechnicalPanelTab,
    codePanelOpen,
    setCodePanelOpen,
    codePanelWidth,
    setCodePanelWidth,
    notesPanelOpen,
    setNotesPanelOpen,
    notesPanelWidth,
    setNotesPanelWidth,
    toolbarCollapsed,
    setToolbarCollapsed,
    focusMode,
    setFocusMode,
    toolbarWidth,
    setToolbarWidth,
    effectiveToolbarCollapsed,
    visibleToolbarWidth,
    visibleTechnicalPanelWidth,
    technicalPanelVisible,
    structuredSidePanelHidden,
    handleToggleToolRail,
    closeTechnicalPanel,
    handleToggleCodePanel: toggleWorkspaceCodePanel,
    handleToggleNotesPanel,
    handlePanelResizeStart,
    resetPanelWidth,
  } = useWorkspaceLayoutState(sessionBootstrap);
  const [sqlReverseWorkflow, setSqlReverseWorkflow] = useState<SqlReverseWorkflowState>(() =>
    createInitialSqlReverseWorkflowState(),
  );
  const [showDiagnostics, setShowDiagnostics] = useState(sessionBootstrap.showDiagnostics);
  const projectVersioning = useProjectVersioning(sessionBootstrap.versioning);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStepState, setOnboardingStepState] = useState<OnboardingStepState>({
    entityCreated: false,
    relationshipCreated: false,
    connectionCreated: false,
    renamedNode: false,
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement | null>(null);
  const ersFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSerializedCodeRef = useRef(codeDraft);
  const codeDraftRef = useRef(codeDraft);
  const codeDirtyRef = useRef(codeDirty);
  const codeEditorFocusedRef = useRef(false);
  const codeLayoutMemoryRef = useRef<DiagramDocument | null>(null);
  const suppressNextCodeSyncRef = useRef(false);
  const latestDiagramRef = useRef(history.present);
  const diagramClipboardRef = useRef<DiagramClipboardPayload | null>(null);
  const pasteOffsetStepRef = useRef(0);
  const [, setHasDiagramClipboard] = useState(false);
  const lastSavedDiagramRef = useRef(serializeDiagram(initialDiagramRef.current));
  const lastSavedCodeRef = useRef(initialSerializedCode);
  const lastSavedVersioningRef = useRef(JSON.stringify(sessionBootstrap.versioning));
  const lastSavedWorkspaceRef = useRef(
    JSON.stringify(createProjectFileWorkspaceStateFromBootstrap(sessionBootstrap)),
  );
  const hasUnsavedChangesRef = useRef(false);
  const onboardingPreviousSnapshotRef = useRef<OnboardingSnapshot | null>(null);
  const latestSessionSnapshotRef = useRef<WorkspaceSessionSnapshot | null>(null);
  const restoredSessionNoticeShownRef = useRef(false);
  latestDiagramRef.current = history.present;

  const issues = validateDiagram(history.present);
  const canvasIssues = showDiagnostics ? issues : [];
  const selectedNode =
    selection.nodeIds.length === 1 && selection.edgeIds.length === 0
      ? history.present.nodes.find((node) => node.id === selection.nodeIds[0])
      : undefined;
  const selectedEdge =
    selection.edgeIds.length === 1 && selection.nodeIds.length === 0
      ? history.present.edges.find((edge) => edge.id === selection.edgeIds[0])
      : undefined;

  useEffect(() => {
    if (!identifierSelection) {
      return;
    }

    if (!identifierSelectionExists(history.present, identifierSelection)) {
      setIdentifierSelection(null);
    }
  }, [history.present, identifierSelection]);

  const selectedWarningIssue =
    selectedNode
      ? issues.find(
          (issue) =>
            issue.level === "warning" &&
            issue.targetType === "node" &&
            issue.targetId === selectedNode.id,
        )
      : selectedEdge
        ? issues.find(
            (issue) =>
              issue.level === "warning" &&
              issue.targetType === "edge" &&
              issue.targetId === selectedEdge.id,
          )
      : undefined;
  const translationAccess = canOpenTranslationView(history.present);
  const currentErSignature = buildErTranslationSourceSignature(history.present);
  const currentTranslatedSignature = buildErTranslationSourceSignature(translationHistory.present.translatedDiagram);
  const logicalOutOfDate =
    logicalGenerated &&
    logicalHistory.present.translation.meta.sourceSignature !== currentTranslatedSignature;
  const translationOverview = useMemo(() => buildErTranslationOverview(translationHistory.present), [translationHistory.present]);
  const translationPendingCount = translationOverview.steps
    .filter((step) => step.id !== "review")
    .reduce((total, step) => total + step.pending, 0);
  const logicalTranslationOverview = useMemo(
    () => buildLogicalTranslationOverview(translationHistory.present.translatedDiagram, logicalHistory.present),
    [logicalHistory.present, translationHistory.present.translatedDiagram],
  );
  const logicalPendingCount = getLogicalTranslationOpenItemCount(logicalTranslationOverview);
  const selectionItemCount = selection.nodeIds.length + selection.edgeIds.length;
  const hasSelection = selectionItemCount > 0;
  const activeCanUndo =
    diagramView === "er" ? history.canUndo : diagramView === "translation" ? translationHistory.canUndo : logicalHistory.canUndo;
  const activeCanRedo =
    diagramView === "er" ? history.canRedo : diagramView === "translation" ? translationHistory.canRedo : logicalHistory.canRedo;
  const currentProjectWorkspaceState = useMemo<ProjectFileWorkspaceState>(
    () => ({
      tool,
      mode,
      selection: {
        nodeIds: [...selection.nodeIds],
        edgeIds: [...selection.edgeIds],
      },
      translationSelection: {
        nodeIds: [...translationSelection.nodeIds],
        edgeIds: [...translationSelection.edgeIds],
      },
      logicalSelection: { ...logicalSelection },
      codeDraft,
      codeDirty,
      technicalPanelOpen,
      technicalPanelTab,
      codePanelOpen,
      codePanelWidth,
      notesPanelOpen,
      notesPanelWidth,
      toolbarCollapsed,
      focusMode,
      toolbarWidth,
      showDiagnostics,
    }),
    [
      codeDirty,
      codeDraft,
      codePanelOpen,
      codePanelWidth,
      focusMode,
      logicalSelection,
      mode,
      notesPanelOpen,
      notesPanelWidth,
      selection.edgeIds,
      selection.nodeIds,
      showDiagnostics,
      technicalPanelOpen,
      technicalPanelTab,
      toolbarCollapsed,
      toolbarWidth,
      tool,
      translationSelection.edgeIds,
      translationSelection.nodeIds,
    ],
  );
  const currentProjectCommitSnapshot = useMemo(
    () =>
      createProjectCommitSnapshot({
        diagram: history.present,
        translationWorkspace: translationHistory.present,
        logicalWorkspace: logicalHistory.present,
        logicalGenerated,
        logicalStage,
        diagramView,
        viewport,
        translationViewport,
        logicalViewport,
        ...currentProjectWorkspaceState,
      }),
    [
      currentProjectWorkspaceState,
      diagramView,
      history.present,
      logicalGenerated,
      logicalHistory.present,
      logicalStage,
      logicalViewport,
      translationHistory.present,
      translationViewport,
      viewport,
    ],
  );
  const versioningChangeState = useMemo(
    () => getProjectUncommittedChangeState(projectVersioning.versioning, currentProjectCommitSnapshot),
    [currentProjectCommitSnapshot, projectVersioning.versioning],
  );
  const restoreTargetCommit = useMemo(
    () => projectVersioning.getCommitById(restoreCommitId),
    [projectVersioning, restoreCommitId],
  );
  const hasVersioningUncommittedChanges = versioningChangeState.hasChanges;
  const commitDialogHint =
    versioningChangeState.status === "no-head-empty"
      ? t("versioning.emptyProject")
      : versioningChangeState.status === "no-head-with-content"
        ? t("versioning.createFirstCommit")
        : versioningChangeState.status === "clean"
          ? t("versioning.noChangesComparedToHead")
          : "";
  const appShellClassName = [
    "app-shell",
    focusMode ? "focus-mode" : "",
    `app-shell-view-${diagramView}`,
    technicalPanelVisible ? "app-shell-sidepanel-open" : "app-shell-sidepanel-closed",
  ]
    .filter(Boolean)
    .join(" ");
  const erWorkspaceShellStyle = {
    "--toolbar-width": `${visibleToolbarWidth}px`,
    "--toolbar-resizer-width": !focusMode && !effectiveToolbarCollapsed ? `${RESIZER_WIDTH}px` : "0px",
    "--technical-panel-width": technicalPanelVisible ? `${visibleTechnicalPanelWidth}px` : "0px",
    "--technical-panel-resizer-width": technicalPanelVisible ? `${RESIZER_WIDTH}px` : "0px",
  } as CSSProperties;
  const erWorkspaceShellClassName = [
    "workspace-shell",
    "er-workspace-shell",
    effectiveToolbarCollapsed ? "toolbar-collapsed" : "",
    focusMode ? "workspace-shell-focus" : "",
    hasSelection ? "workspace-has-selection" : "workspace-idle",
    technicalPanelVisible ? "workspace-technical-open" : "",
    technicalPanelVisible ? `workspace-technical-tab-${technicalPanelTab}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const structuredWorkspaceShellClassName = [
    "workspace-shell",
    "technical-workspace-shell",
    "structured-workspace-shell",
    focusMode ? "workspace-shell-focus" : "",
    technicalPanelVisible ? "workspace-technical-open" : "",
    technicalPanelVisible ? `workspace-technical-tab-${technicalPanelTab}` : "",
    `structured-workspace-shell-${diagramView}`,
  ]
    .filter(Boolean)
    .join(" ");
  const translationWorkspaceShellClassName = [
    "workspace-shell",
    "translation-workspace-shell",
  ]
    .filter(Boolean)
    .join(" ");
  const structuredWorkspaceShellStyle = {
    "--technical-panel-width": technicalPanelVisible ? `${visibleTechnicalPanelWidth}px` : "0px",
    "--technical-panel-resizer-width": technicalPanelVisible ? `${RESIZER_WIDTH}px` : "0px",
  } as CSSProperties;
  const onboardingProgress = getOnboardingProgress(onboardingStepState);
  const versionAnnouncementBlocked =
    commandMenuOpen ||
    versioningPanelOpen ||
    commitDialogOpen ||
    keyboardShortcutsOpen ||
    aboutOpen ||
    whatsNewOpen ||
    introOpen ||
    confirmDialog !== null ||
    promptDialog !== null ||
    cardinalityDialog !== null ||
    mixedIdentifierDialog !== null ||
    generalizationGroupDialog !== null ||
    errorsPanelOpen ||
    sqlReverseWorkflow.step !== "idle";

  function persistWorkspaceSessionNow() {
    if (typeof window === "undefined") {
      return;
    }

    const snapshot = latestSessionSnapshotRef.current;
    if (!snapshot) {
      return;
    }

    saveWorkspaceSessionSnapshot(snapshot);
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setBooting(false);
    }, APP_BOOT_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const previousVersion = getLastSeenAppVersion();
    const classification = classifyAppUpdate(previousVersion, APP_VERSION);

    if (classification.kind === "first-run") {
      rememberLastSeenAppVersion(APP_VERSION);
      return;
    }

    if (!classification.shouldShow) {
      return;
    }

    if (
      classification.kind !== "patch" &&
      classification.kind !== "minor" &&
      classification.kind !== "major"
    ) {
      return;
    }

    if (hasSeenVersionAnnouncement(APP_VERSION)) {
      rememberLastSeenAppVersion(APP_VERSION);
      return;
    }

    if (versionAnnouncement || versionAnnouncementBlocked) {
      return;
    }

    const changelogEntry =
      appChangelog.find((entry) => entry.version === APP_VERSION) ??
      createFallbackChangelogEntry(APP_VERSION, classification.kind, t);
    const updateKind: VisibleVersionUpdateKind = changelogEntry.impact ?? classification.kind;
    const openDelay = window.setTimeout(() => {
      setVersionAnnouncement((current) =>
        current ?? {
          previousVersion,
          updateKind,
          changelogEntry,
        },
      );
    }, 550);

    return () => window.clearTimeout(openDelay);
  }, [appChangelog, t, versionAnnouncement, versionAnnouncementBlocked]);

  useEffect(() => {
    if (!sessionBootstrap.restored || restoredSessionNoticeShownRef.current) {
      return;
    }

    restoredSessionNoticeShownRef.current = true;
    setStatusMessage("Sessione precedente ripristinata automaticamente.");
  }, [sessionBootstrap.restored]);

  useEffect(() => {
    if (!selectedWarningIssue) {
      dismissStickyNotices("selection-warning");
      return;
    }

    showSelectionWarningNotice(selectedWarningIssue);
  }, [selectedWarningIssue]);

  useEffect(() => {
    const currentCode = codeDirtyRef.current ? codeDraftRef.current : serializeDiagramToErs(history.present);
    const currentVersioning = JSON.stringify(projectVersioning.versioning);
    const currentWorkspace = JSON.stringify(currentProjectWorkspaceState);
    hasUnsavedChangesRef.current =
      serializeDiagram(history.present) !== lastSavedDiagramRef.current ||
      currentCode !== lastSavedCodeRef.current ||
      currentVersioning !== lastSavedVersioningRef.current ||
      currentWorkspace !== lastSavedWorkspaceRef.current;
  }, [history.present, codeDraft, currentProjectWorkspaceState, projectVersioning.versioning]);

  useEffect(() => {
    latestSessionSnapshotRef.current = serializeWorkspaceSessionSnapshot({
      diagram: history.present,
      translationWorkspace: translationHistory.present,
      logicalWorkspace: logicalHistory.present,
      logicalGenerated,
      logicalStage,
      diagramView,
      tool,
      mode,
      viewport: { ...viewport },
      selection: {
        nodeIds: [...selection.nodeIds],
        edgeIds: [...selection.edgeIds],
      },
      translationViewport: { ...translationViewport },
      translationSelection: {
        nodeIds: [...translationSelection.nodeIds],
        edgeIds: [...translationSelection.edgeIds],
      },
      logicalViewport: { ...logicalViewport },
      logicalSelection: { ...logicalSelection },
      codeDraft: codeDraftRef.current,
      codeDirty: codeDirtyRef.current,
      technicalPanelOpen,
      technicalPanelTab,
      codePanelOpen,
      codePanelWidth,
      notesPanelOpen,
      notesPanelWidth,
      toolbarCollapsed,
      focusMode,
      toolbarWidth,
      showDiagnostics,
      versioning: projectVersioning.versioning,
    });
  }, [
    codeDraft,
    codeDirty,
    technicalPanelOpen,
    technicalPanelTab,
    codePanelOpen,
    codePanelWidth,
    notesPanelOpen,
    notesPanelWidth,
    diagramView,
    focusMode,
    translationHistory.present,
    translationSelection,
    translationViewport,
    history.present,
    logicalGenerated,
    logicalHistory.present,
    logicalStage,
    logicalSelection,
    logicalViewport,
    mode,
    selection,
    tool,
    toolbarCollapsed,
    toolbarWidth,
    showDiagnostics,
    viewport,
    projectVersioning.versioning,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const timeout = window.setTimeout(() => {
      persistWorkspaceSessionNow();
    }, WORKSPACE_SESSION_SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [
    codeDraft,
    codeDirty,
    technicalPanelOpen,
    technicalPanelTab,
    codePanelOpen,
    codePanelWidth,
    notesPanelOpen,
    notesPanelWidth,
    diagramView,
    focusMode,
    history.present,
    logicalGenerated,
    logicalHistory.present,
    logicalSelection,
    logicalViewport,
    mode,
    selection,
    tool,
    toolbarCollapsed,
    toolbarWidth,
    showDiagnostics,
    translationHistory.present,
    translationSelection,
    translationViewport,
    viewport,
  ]);

  useEffect(() => {
    const workspaceSignature = translationHistory.present.translation.meta.sourceSignature;
    if (workspaceSignature === currentErSignature) {
      return;
    }

    const refreshedWorkspace = refreshErTranslationWorkspace(history.present, translationHistory.present);
    translationHistory.setPresent(refreshedWorkspace);

    if (diagramView === "logical") {
      const access = canOpenLogicalView(refreshedWorkspace);
      if (!access.allowed) {
        setDiagramView("translation");
        setLogicalSelection(EMPTY_LOGICAL_SELECTION);
        setStatusWarning(access.reason ?? "La vista logica non e piu disponibile finche la traduzione non viene completata.");
      }
    } else if (diagramView === "translation") {
      setStatus("Vista Traduzione riallineata al modello ER.");
    }
  }, [currentErSignature, diagramView, history.present, translationHistory]);

  useEffect(() => {
    if (!logicalGenerated) {
      return;
    }

    const workspaceSignature = logicalHistory.present.translation.meta.sourceSignature;
    if (workspaceSignature === currentTranslatedSignature) {
      return;
    }

    const logicalAccess = canOpenLogicalView(translationHistory.present);
    if (!logicalAccess.allowed) {
      if (diagramView === "logical") {
        setDiagramView("translation");
        setStatusWarning(logicalAccess.reason ?? "Completa la traduzione ER->ER per riaprire la vista logica.");
      }
      return;
    }

    const refreshedWorkspace = refreshLogicalWorkspace(translationHistory.present.translatedDiagram, logicalHistory.present);
    logicalHistory.setPresent(refreshedWorkspace);

    if (diagramView === "logical") {
      setStatus("Vista logica riallineata all'ER tradotto.");
    }
  }, [currentTranslatedSignature, diagramView, logicalGenerated, logicalHistory, translationHistory]);

  useEffect(() => {
    if (diagramView !== "logical" || logicalGenerated) {
      return;
    }

    const logicalAccess = canOpenLogicalView(translationHistory.present);
    if (!logicalAccess.allowed) {
      setDiagramView("translation");
      setStatusWarning(logicalAccess.reason ?? "Completa la traduzione ER->ER per aprire la vista logica.");
      return;
    }

    const initializedWorkspace = refreshLogicalWorkspace(
      translationHistory.present.translatedDiagram,
      createEmptyLogicalWorkspace(translationHistory.present.translatedDiagram, logicalHistory.present),
    );
    logicalHistory.setPresent(initializedWorkspace);
    setLogicalGenerated(true);
  }, [diagramView, logicalGenerated, logicalHistory, translationHistory]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      persistWorkspaceSessionNow();
      if (!hasUnsavedChangesRef.current) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    }

    function handlePageHide() {
      persistWorkspaceSessionNow();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        persistWorkspaceSessionNow();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (diagramView !== "er") {
      return;
    }

    if (onboardingOpen) {
      return;
    }

    if (readOnboardingCompleted()) {
      return;
    }

    if (sessionBootstrap.restored) {
      return;
    }

    setOnboardingStepState({
      entityCreated: false,
      relationshipCreated: false,
      connectionCreated: false,
      renamedNode: false,
    });
    onboardingPreviousSnapshotRef.current = createOnboardingSnapshot(history.present);
    setOnboardingOpen(true);
    setStatusMessage("Tour guidato attivo: completa i 4 step nel canvas.");
  }, [diagramView, onboardingOpen, sessionBootstrap.restored]);

  useEffect(() => {
    if (!onboardingOpen) {
      return;
    }

    const previousSnapshot = onboardingPreviousSnapshotRef.current;
    const currentSnapshot = createOnboardingSnapshot(history.present);
    if (!previousSnapshot) {
      onboardingPreviousSnapshotRef.current = currentSnapshot;
      return;
    }

    const nextStatePatch: Partial<OnboardingStepState> = {};
    if (!onboardingStepState.entityCreated && currentSnapshot.entityCount > previousSnapshot.entityCount) {
      nextStatePatch.entityCreated = true;
    }
    if (!onboardingStepState.relationshipCreated && currentSnapshot.relationshipCount > previousSnapshot.relationshipCount) {
      nextStatePatch.relationshipCreated = true;
    }
    if (!onboardingStepState.connectionCreated && currentSnapshot.edgeCount > previousSnapshot.edgeCount) {
      nextStatePatch.connectionCreated = true;
    }
    if (!onboardingStepState.renamedNode) {
      const renamedExistingNode = history.present.nodes.some((node) => {
        const previousLabel = previousSnapshot.labelsByNodeId[node.id];
        return typeof previousLabel === "string" && previousLabel !== node.label;
      });
      const renamedNewNode = history.present.nodes.some(
        (node) => previousSnapshot.labelsByNodeId[node.id] === undefined && !isDefaultNodeLabel(node),
      );
      if (renamedExistingNode || renamedNewNode) {
        nextStatePatch.renamedNode = true;
      }
    }

    if (Object.keys(nextStatePatch).length > 0) {
      setOnboardingStepState((currentState) => ({
        ...currentState,
        ...nextStatePatch,
      }));
    }

    onboardingPreviousSnapshotRef.current = currentSnapshot;
  }, [
    history.present,
    onboardingOpen,
    onboardingStepState.connectionCreated,
    onboardingStepState.entityCreated,
    onboardingStepState.relationshipCreated,
    onboardingStepState.renamedNode,
  ]);

  useEffect(() => {
    if (!onboardingOpen || !onboardingProgress.allCompleted) {
      return;
    }

    markOnboardingCompleted();
    setOnboardingOpen(false);
    onboardingPreviousSnapshotRef.current = null;
    setStatus("Tour chiuso. Ora puoi modellare liberamente.");
  }, [onboardingOpen, onboardingProgress.allCompleted]);

  function markDocumentBaseline(
    diagram: DiagramDocument,
    serializedVersioning = JSON.stringify(projectVersioning.versioning),
    serializedWorkspace = JSON.stringify(currentProjectWorkspaceState),
    savedCode = serializeDiagramToErs(diagram),
  ) {
    lastSavedDiagramRef.current = serializeDiagram(diagram);
    lastSavedCodeRef.current = savedCode;
    lastSavedVersioningRef.current = serializedVersioning;
    lastSavedWorkspaceRef.current = serializedWorkspace;
    hasUnsavedChangesRef.current = false;
  }

  function markDiagramSaved(diagram: DiagramDocument) {
    lastSavedDiagramRef.current = serializeDiagram(diagram);
  }

  function markCodeSaved(code: string) {
    lastSavedCodeRef.current = code;
  }

  function markVersioningSaved() {
    lastSavedVersioningRef.current = JSON.stringify(projectVersioning.versioning);
  }

  function markWorkspaceSaved(workspace: ProjectFileWorkspaceState) {
    lastSavedWorkspaceRef.current = JSON.stringify(workspace);
  }

  async function confirmDiscardChanges(actionLabel: string): Promise<boolean> {
    if (!hasUnsavedChangesRef.current) {
      return true;
    }

    return requestConfirmDialog({
      title: t("dialogs.unsavedChanges.title"),
      message: t("dialogs.unsavedChanges.message", { action: actionLabel }),
      confirmLabel: t("dialogs.unsavedChanges.confirm"),
      cancelLabel: t("dialogs.unsavedChanges.cancel"),
    });
  }

  function openCommandMenu() {
    setAboutOpen(false);
    setWhatsNewOpen(false);
    setIntroOpen(false);
    setKeyboardShortcutsOpen(false);
    setVersioningPanelOpen(false);
    setCommitDialogOpen(false);
    setCommandMenuOpen(true);
  }

  function openKeyboardShortcuts() {
    setCommandMenuOpen(false);
    setAboutOpen(false);
    setWhatsNewOpen(false);
    setIntroOpen(false);
    setVersioningPanelOpen(false);
    setCommitDialogOpen(false);
    setKeyboardShortcutsOpen(true);
  }

  function closeVersionAnnouncement() {
    rememberVersionAnnouncementSeen(APP_VERSION);
    setVersionAnnouncement(null);
  }

  function openFullChangelogFromVersionAnnouncement() {
    rememberVersionAnnouncementSeen(APP_VERSION);
    setVersionAnnouncement(null);
    setAboutOpen(false);
    setCommandMenuOpen(false);
    setKeyboardShortcutsOpen(false);
    setIntroOpen(false);
    setWhatsNewOpen(true);
  }

  function reportExternalIdentifierInvalidations(
    invalidations: ExternalIdentifierInvalidation[],
    mode: "status" | "notice",
  ) {
    if (invalidations.length === 0) {
      return;
    }

    const primary = invalidations[0];
    if (primary) {
      if (mode === "status") {
        setStatusWarning(primary.message);
      } else {
        showWarningNotice(primary.message);
      }
    }

    if (invalidations.length > 1) {
      showWarningNotice(
        `${invalidations.length - 1} identificator${invalidations.length - 1 === 1 ? "e esterno e stato" : "i esterni sono stati"} invalidat${invalidations.length - 1 === 1 ? "o" : "i"} automaticamente.`,
      );
    }
  }

  function handleSkipOnboarding() {
    markOnboardingCompleted();
    setOnboardingOpen(false);
    onboardingPreviousSnapshotRef.current = null;
    setStatusMessage("");
  }

  function handleOnboardingStepAction(stepId: OnboardingStepId) {
    if (stepId === "create-entity") {
      setTool("entity");
      setStatus("Step 1: crea una nuova entita con un click nel canvas.");
      return;
    }

    if (stepId === "create-relationship") {
      setTool("relationship");
      setStatus("Step 2: crea una nuova associazione nel canvas.");
      return;
    }

    if (stepId === "create-connection") {
      setTool("connector");
      setStatus("Step 3: collega entita e associazione trascinando tra i nodi.");
      return;
    }

    setTool("select");
    setStatus("Step 4: fai doppio click su un nodo e rinominalo.");
  }

  function handleCanvasStatusMessage(message: string) {
    setStatus(message);
  }

  function handleErSelectionChange(nextSelection: SelectionState) {
    setSelection(nextSelection);

    if (nextSelection.nodeIds.length === 1 && nextSelection.edgeIds.length === 0) {
      setIdentifierSelection(getSimpleIdentifierSelectionForAttribute(history.present, nextSelection.nodeIds[0]));
      return;
    }

    setIdentifierSelection(null);
  }

  function handleToolChange(nextTool: ToolKind) {
    setTool(nextTool);
    setIdentifierSelection(null);
  }

  function handleIssueNotice(issue: ValidationIssue) {
    if (issue.level === "error") {
      const formattedIssue = formatErrorFromRawMessage(
        issue.message,
        t,
        t("errors.rawFallbackHow"),
      );
      setStatusMessage(formattedIssue);
      showErrorNotice(formattedIssue);
      return;
    }

    setStatusMessage(issue.message);

    const warningTargetSelected =
      issue.targetType === "node"
        ? selectedNode?.id === issue.targetId
        : selectedEdge?.id === issue.targetId;

    if (!warningTargetSelected) {
      return;
    }

    showWarningNotice(issue.message);
  }

  function getIssueElementLabel(issue: ValidationIssue): string {
    if (issue.targetType === "node") {
      const node = history.present.nodes.find((candidate) => candidate.id === issue.targetId);
      return node ? `${node.label} (${node.type})` : issue.targetId;
    }

    const edge = history.present.edges.find((candidate) => candidate.id === issue.targetId);
    if (!edge) {
      return issue.targetId;
    }

    const source = history.present.nodes.find((node) => node.id === edge.sourceId)?.label ?? edge.sourceId;
    const target = history.present.nodes.find((node) => node.id === edge.targetId)?.label ?? edge.targetId;
    return `${source} - ${target}`;
  }

  function issueTargetExists(issue: ValidationIssue): boolean {
    return issue.targetType === "node"
      ? history.present.nodes.some((node) => node.id === issue.targetId)
      : history.present.edges.some((edge) => edge.id === issue.targetId);
  }

  function selectIssueTarget(issue: ValidationIssue): boolean {
    const viewportRect = svgRef.current?.getBoundingClientRect();
    const viewportWidth = viewportRect?.width ?? (typeof window === "undefined" ? 1280 : window.innerWidth);
    const viewportHeight = viewportRect?.height ?? (typeof window === "undefined" ? 720 : window.innerHeight - 46);

    if (issue.targetType === "node") {
      const node = history.present.nodes.find((candidate) => candidate.id === issue.targetId);
      if (!node) {
        return false;
      }

      setSelection({ nodeIds: [node.id], edgeIds: [] });
      setViewport({
        ...viewport,
        x: viewportWidth / 2 - (node.x + node.width / 2) * viewport.zoom,
        y: viewportHeight / 2 - (node.y + node.height / 2) * viewport.zoom,
      });
      return true;
    }

    const edge = history.present.edges.find((candidate) => candidate.id === issue.targetId);
    if (!edge) {
      return false;
    }

    setSelection({ nodeIds: [], edgeIds: [edge.id] });
    const sourceNode = history.present.nodes.find((node) => node.id === edge.sourceId);
    const targetNode = history.present.nodes.find((node) => node.id === edge.targetId);
    if (sourceNode && targetNode) {
      const centerX = (sourceNode.x + sourceNode.width / 2 + targetNode.x + targetNode.width / 2) / 2;
      const centerY = (sourceNode.y + sourceNode.height / 2 + targetNode.y + targetNode.height / 2) / 2;
      setViewport({
        ...viewport,
        x: viewportWidth / 2 - centerX * viewport.zoom,
        y: viewportHeight / 2 - centerY * viewport.zoom,
      });
    }
    return true;
  }

  function handleToggleFocusMode() {
    setFocusMode((current) => {
      const next = !current;
      setStatus(next ? "Modalita focus attiva: il canvas diventa protagonista." : "Modalita focus disattivata.");
      return next;
    });
  }

  function handleToggleDiagnosticsVisibility() {
    setShowDiagnostics((current) => !current);
  }

  function handleSqlReverseSourceChange(value: string) {
    setSqlReverseWorkflow((current) => ({
      ...current,
      sourceSql: value,
      result: null,
      issues: [],
      logicalIssues: [],
      tableCount: 0,
      unsupportedStatementCount: 0,
      errorMessage: "",
      isPreviewReady: false,
    }));
  }

  function handleOpenSqlReverseWorkflow() {
    if (diagramView !== "er") {
      setStatusWarning(t("sqlReverse.app.onlyErView"));
      return;
    }

    setFocusMode(false);
    closeTechnicalPanel();
    setSqlReverseWorkflow((current) => ({
      ...createInitialSqlReverseWorkflowState(current.sourceSql),
      step: "input",
    }));
  }

  function handleCancelSqlReverseWorkflow() {
    setSqlReverseWorkflow((current) => createInitialSqlReverseWorkflowState(current.sourceSql));
    setStatusWarning(t("sqlReverse.app.importCancelled"));
  }

  function handleAnalyzeSqlReverseWorkflow() {
    const validation = validateSqlReverseBetaSource(sqlReverseWorkflow.sourceSql);
    if (!validation.ok) {
      setSqlReverseWorkflow((current) => ({
        ...current,
        sourceSql: validation.normalizedSql || current.sourceSql,
        result: null,
        issues: validation.issues,
        logicalIssues: [],
        tableCount: 0,
        unsupportedStatementCount: validation.unsupportedStatementCount,
        errorMessage: validation.errorMessage,
        isPreviewReady: false,
      }));
      setStatusWarning(validation.errorMessage);
      return;
    }

    try {
      const result = reverseSqlToDiagram(validation.normalizedSql, { sourceName: t("sqlReverse.input.title") });
      const hasSqlErrors = result.issues.some((issue) => issue.level === "error");
      const hasValidDiagram = result.diagram.nodes.length > 0;

      if (result.sqlModel.unsupportedStatements.length > 0) {
        const message = t("sqlReverse.app.betaCreateTableOnly");
        setSqlReverseWorkflow((current) => ({
          ...current,
          sourceSql: validation.normalizedSql,
          result: null,
          issues: result.issues,
          logicalIssues: result.logicalIssues,
          tableCount: result.sqlModel.tables.length,
          unsupportedStatementCount: result.sqlModel.unsupportedStatements.length,
          errorMessage: message,
          isPreviewReady: false,
        }));
        setStatusWarning(message);
        return;
      }

      if (hasSqlErrors || !hasValidDiagram) {
        setSqlReverseWorkflow((current) => ({
          ...current,
          sourceSql: validation.normalizedSql,
          result: null,
          issues: result.issues,
          logicalIssues: result.logicalIssues,
          tableCount: result.sqlModel.tables.length,
          unsupportedStatementCount: result.sqlModel.unsupportedStatements.length,
          errorMessage: t("sqlReverse.app.sqlNotImportable"),
          isPreviewReady: true,
        }));
        setStatusError(t("sqlReverse.app.sqlNotImportable"));
        return;
      }

      setSqlReverseWorkflow((current) => ({
        ...current,
        step: "logical-preview",
        sourceSql: validation.normalizedSql,
        result,
        issues: result.issues,
        logicalIssues: result.logicalIssues,
        tableCount: result.sqlModel.tables.length,
        unsupportedStatementCount: result.sqlModel.unsupportedStatements.length,
        errorMessage: "",
        logicalViewport: { ...DEFAULT_VIEWPORT },
        erViewport: { ...DEFAULT_VIEWPORT },
        logicalSelection: { ...EMPTY_LOGICAL_SELECTION },
        erSelection: { nodeIds: [], edgeIds: [] },
        previewToken: current.previewToken + 1,
        isPreviewReady: true,
      }));
      if (result.issues.length > 0 || result.logicalIssues.some((issue) => issue.level === "warning")) {
        setStatusWarning(t("sqlReverse.app.analyzedWithWarnings"));
      } else {
        setStatusSuccess(t("sqlReverse.app.analyzedTables", { count: result.sqlModel.tables.length }));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("sqlReverse.app.analysisError");
      const parseIssue: SqlReverseIssue = {
        id: "sql-reverse-preview-error",
        level: "error",
        code: "PARSER_RECOVERY",
        message,
      };
      setSqlReverseWorkflow((current) => ({
        ...current,
        result: null,
        issues: [parseIssue],
        logicalIssues: [],
        tableCount: 0,
        unsupportedStatementCount: 0,
        errorMessage: message,
        isPreviewReady: true,
      }));
      setStatusError(t("sqlReverse.app.sqlNotImportable"));
    }
  }

  function handleSqlReverseLogicalDone() {
    setSqlReverseWorkflow((current) =>
      current.result
        ? {
            ...current,
            step: "er-preview",
            erViewport: { ...DEFAULT_VIEWPORT },
            erSelection: { nodeIds: [], edgeIds: [] },
            previewToken: current.previewToken + 1,
          }
        : current,
    );
    setStatus(t("sqlReverse.preview.erReady"));
  }

  function handleSqlReverseBackToLogicalPreview() {
    setSqlReverseWorkflow((current) => current.result ? { ...current, step: "logical-preview" } : current);
    setStatus(t("sqlReverse.app.logicalPreviewReady"));
  }

  async function handleSqlReverseFinalDone() {
    const preview = sqlReverseWorkflow.result;
    if (!preview) {
      setStatusError(t("sqlReverse.app.previewUnavailable"));
      return;
    }
    const confirmed = await requestConfirmDialog({
      title: t("sqlReverse.app.confirmImportTitle"),
      message: t("sqlReverse.app.confirmImportMessage"),
      confirmLabel: t("sqlReverse.app.confirmImport"),
      cancelLabel: t("common.actions.cancel"),
    });
    if (!confirmed) {
      setStatusWarning(t("sqlReverse.app.importCancelled"));
      return;
    }

    const warningCount = preview.issues.filter((issue) => issue.level === "warning").length;
    setSqlReverseWorkflow((current) => createInitialSqlReverseWorkflowState(current.sourceSql));
    applyWorkspaceDocument(
      preview.diagram,
      warningCount > 0
        ? t("sqlReverse.app.importedWithWarnings", { count: warningCount })
        : t("sqlReverse.app.importedTables", { count: preview.sqlModel.tables.length }),
      {
        diagramView: "er",
        viewport: DEFAULT_VIEWPORT,
      },
    );
  }

  async function handleLoadSqlReverseFile(file: File) {
    const fileName = file.name || "schema.sql";
    const extensionOk = fileName.toLowerCase().endsWith(".sql");
    try {
      const text = await file.text();
      setSqlReverseWorkflow((current) => ({
        ...createInitialSqlReverseWorkflowState(text),
        step: current.step === "idle" ? "input" : current.step,
      }));

      if (!text.trim()) {
        setStatusWarning(t("sqlReverse.app.emptyFile"));
        return;
      }

      if (!extensionOk && !/\bCREATE\s+TABLE\b/i.test(text)) {
        setStatusWarning(t("sqlReverse.app.fileNotCreateTable"));
        return;
      }

      setStatusSuccess(t("sqlReverse.app.fileLoaded", { fileName }));
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : t("sqlReverse.app.fileReadError"));
    }
  }

  function handleClearSqlReverse() {
    setSqlReverseWorkflow((current) => ({
      ...createInitialSqlReverseWorkflowState(""),
      step: current.step === "idle" ? "input" : current.step,
    }));
    setStatus(t("sqlReverse.app.cleared"));
  }

  function handleOpenErStage() {
    setLogicalPanelMode("review");
    if (diagramView !== "er") {
      handleDiagramViewChange("er");
    }
  }

  function handleOpenTranslationStage() {
    setLogicalPanelMode("review");
    setTranslationViewport(viewport);
    handleDiagramViewChange("translation");
  }

  function handleOpenLogicalStage() {
    setLogicalPanelMode("review");
    handleDiagramViewChange("logical");
  }

  function handleOpenSqlStage() {
    setLogicalStage("schema");
    setLogicalPanelMode("sql");
    handleDiagramViewChange("logical");
  }

  function handleNotesChange(nextNotes: string) {
    const normalizedNotes = nextNotes.replace(/\r\n/g, "\n");
    if (normalizedNotes === history.present.notes) {
      return;
    }

    commitDiagram(
      {
        ...history.present,
        notes: normalizedNotes,
      },
      history.present,
      { suppressExternalIdentifierWarnings: true },
    );
  }

  function handleDiagramNameChange(nextName: string) {
    const normalizedName = nextName.trim() || "ER project";
    if (normalizedName === history.present.meta.name) {
      return;
    }

    commitDiagram(
      {
        ...history.present,
        meta: {
          ...history.present.meta,
          name: normalizedName,
        },
      },
      history.present,
      { suppressExternalIdentifierWarnings: true },
    );
    setStatus("Nome progetto aggiornato.");
  }

  function replaceCodeDraft(nextCode: string) {
    codeDraftRef.current = nextCode;
    codeDirtyRef.current = false;
    codeLayoutMemoryRef.current = null;
    lastSerializedCodeRef.current = nextCode;
    setCodeDraft(nextCode);
    setCodeDirty(false);
  }

  function syncCodeDraftWithDiagram(diagram: DiagramDocument) {
    replaceCodeDraft(serializeDiagramToErs(diagram));
    setCodeError("");
  }

  function restoreCodeDraftFromWorkspace(workspace: ProjectFileWorkspaceState, diagram: DiagramDocument) {
    const serializedDiagram = serializeDiagramToErs(diagram);
    const nextCode = workspace.codeDraft;
    codeDraftRef.current = nextCode;
    codeDirtyRef.current = workspace.codeDirty;
    codeLayoutMemoryRef.current = workspace.codeDirty ? diagram : null;
    lastSerializedCodeRef.current = serializedDiagram;
    setCodeDraft(nextCode);
    setCodeDirty(workspace.codeDirty);
    setCodeError("");
  }

  function createWorkspaceStateFromProjectCommitSnapshot(snapshot: ProjectCommitSnapshot): ProjectFileWorkspaceState {
    return {
      tool: snapshot.tool,
      mode: snapshot.mode,
      selection: { nodeIds: [...snapshot.selection.nodeIds], edgeIds: [...snapshot.selection.edgeIds] },
      translationSelection: {
        nodeIds: [...snapshot.translationSelection.nodeIds],
        edgeIds: [...snapshot.translationSelection.edgeIds],
      },
      logicalSelection: { ...snapshot.logicalSelection },
      codeDraft: snapshot.codeDraft,
      codeDirty: snapshot.codeDirty,
      technicalPanelOpen: snapshot.technicalPanelOpen,
      technicalPanelTab: snapshot.technicalPanelTab,
      codePanelOpen: snapshot.codePanelOpen,
      codePanelWidth: snapshot.codePanelWidth,
      notesPanelOpen: snapshot.notesPanelOpen,
      notesPanelWidth: snapshot.notesPanelWidth,
      toolbarCollapsed: snapshot.toolbarCollapsed,
      focusMode: snapshot.focusMode,
      toolbarWidth: snapshot.toolbarWidth,
      showDiagnostics: snapshot.showDiagnostics,
    };
  }

  function applyWorkspaceDocument(
    nextDiagram: DiagramDocument,
    status: string,
    options?: {
      translationWorkspace?: ErTranslationWorkspaceDocument;
      logicalWorkspace?: LogicalWorkspaceDocument;
      logicalGenerated?: boolean;
      logicalStage?: LogicalStage;
      diagramView?: WorkspaceView;
      viewport?: Viewport;
      translationViewport?: Viewport;
      logicalViewport?: Viewport;
      versioning?: ProjectVersioningState;
      workspace?: ProjectFileWorkspaceState;
      resetHistory?: boolean;
      markBaseline?: boolean;
    },
  ) {
    const normalizedIncoming = revalidateExternalIdentifiers(
      synchronizeExternalIdentifiers(
        synchronizeInternalIdentifiers(
          synchronizeEntityRelationshipParticipations(synchronizeNodeNameIdentity(nextDiagram).diagram),
        ),
      ),
    );
    const normalizedCurrent = revalidateExternalIdentifiers(
      synchronizeExternalIdentifiers(
        synchronizeInternalIdentifiers(
          synchronizeEntityRelationshipParticipations(synchronizeNodeNameIdentity(history.present).diagram),
        ),
      ),
    );
    if (options?.resetHistory) {
      history.reset(normalizedIncoming.diagram);
    } else {
      history.commit(normalizedIncoming.diagram, normalizedCurrent.diagram);
    }
    const nextTranslationWorkspace = options?.translationWorkspace
      ? refreshErTranslationWorkspace(normalizedIncoming.diagram, options.translationWorkspace)
      : createEmptyErTranslationWorkspace(normalizedIncoming.diagram);
    translationHistory.reset(nextTranslationWorkspace);
    logicalHistory.reset(
      options?.logicalWorkspace
        ? refreshLogicalWorkspace(nextTranslationWorkspace.translatedDiagram, options.logicalWorkspace)
        : createEmptyLogicalWorkspace(nextTranslationWorkspace.translatedDiagram),
    );
    const nextLogicalGenerated = options?.logicalGenerated === true;
    const nextDiagramView =
      options?.diagramView === "logical" && nextLogicalGenerated
        ? "logical"
        : options?.diagramView === "translation"
          ? "translation"
          : "er";
    setAboutOpen(false);
    setWhatsNewOpen(false);
    setIntroOpen(false);
    setLogicalGenerated(nextLogicalGenerated);
    setLogicalStage(options?.logicalStage === "schema" && nextLogicalGenerated ? "schema" : "translation");
    setDiagramView(nextDiagramView);
    const nextWorkspace = options?.workspace;
    setTranslationSelection(nextWorkspace?.translationSelection ?? { nodeIds: [], edgeIds: [] });
    setTranslationViewport(options?.translationViewport ? { ...options.translationViewport } : { ...DEFAULT_VIEWPORT });
    setLogicalSelection(nextWorkspace?.logicalSelection ?? EMPTY_LOGICAL_SELECTION);
    setLogicalViewport(options?.logicalViewport ? { ...options.logicalViewport } : { ...DEFAULT_VIEWPORT });
    if (nextWorkspace) {
      restoreCodeDraftFromWorkspace(nextWorkspace, normalizedIncoming.diagram);
      setTechnicalPanelTab(nextWorkspace.technicalPanelTab);
      setTechnicalPanelOpen(nextWorkspace.technicalPanelOpen && nextWorkspace.technicalPanelTab !== "code");
      setCodePanelOpen(nextWorkspace.codePanelOpen || (nextWorkspace.technicalPanelOpen && nextWorkspace.technicalPanelTab === "code"));
      setCodePanelWidth(nextWorkspace.codePanelWidth);
      setNotesPanelOpen(
        nextWorkspace.notesPanelOpen || (nextWorkspace.technicalPanelOpen && nextWorkspace.technicalPanelTab === "notes"),
      );
      setNotesPanelWidth(nextWorkspace.notesPanelWidth);
      setToolbarCollapsed(nextWorkspace.toolbarCollapsed);
      setFocusMode(nextWorkspace.focusMode);
      setToolbarWidth(nextWorkspace.toolbarWidth);
      setShowDiagnostics(nextWorkspace.showDiagnostics);
    } else {
      syncCodeDraftWithDiagram(normalizedIncoming.diagram);
    }
    const nextVersioning = options?.versioning ?? createEmptyProjectVersioningState();
    projectVersioning.setVersioning(nextVersioning);
    const baselineWorkspace = nextWorkspace ?? {
      ...currentProjectWorkspaceState,
      tool: "select",
      selection: { nodeIds: [], edgeIds: [] },
      translationSelection: { nodeIds: [], edgeIds: [] },
      logicalSelection: { ...EMPTY_LOGICAL_SELECTION },
      codeDraft: serializeDiagramToErs(normalizedIncoming.diagram),
      codeDirty: false,
    };
    if (options?.markBaseline !== false) {
      markDocumentBaseline(
        normalizedIncoming.diagram,
        JSON.stringify(nextVersioning),
        JSON.stringify(baselineWorkspace),
        baselineWorkspace.codeDirty ? baselineWorkspace.codeDraft : serializeDiagramToErs(normalizedIncoming.diagram),
      );
    } else {
      hasUnsavedChangesRef.current = true;
    }
    setSelection(nextWorkspace?.selection ?? { nodeIds: [], edgeIds: [] });
    setIdentifierSelection(null);
    setViewport(options?.viewport ? { ...options.viewport } : { ...DEFAULT_VIEWPORT });
    setTool(nextWorkspace?.tool ?? "select");
    setStatus(status);
    reportExternalIdentifierInvalidations(normalizedIncoming.invalidations, "notice");
  }

  function updateCodeDraft(nextCode: string) {
    codeDraftRef.current = nextCode;
    const nextDirty = nextCode !== lastSerializedCodeRef.current;
    if (nextDirty && !codeLayoutMemoryRef.current) {
      codeLayoutMemoryRef.current = latestDiagramRef.current;
    }
    codeDirtyRef.current = nextDirty;
    setCodeDraft(nextCode);
    setCodeDirty(nextDirty);
    if (codeError) {
      setCodeError("");
    }
  }

  function handleCodeEditorFocus() {
    codeEditorFocusedRef.current = true;
    codeLayoutMemoryRef.current = latestDiagramRef.current;
  }

  function handleCodeEditorBlur() {
    codeEditorFocusedRef.current = false;
    if (!codeDirtyRef.current) {
      codeLayoutMemoryRef.current = null;
    }
  }

  function handleToggleCodePanel() {
    if (codePanelOpen) {
      handleCodeEditorBlur();
    }

    toggleWorkspaceCodePanel();
  }

  function rememberCodeLayout(diagram: DiagramDocument) {
    const currentMemory = codeLayoutMemoryRef.current;
    if (!currentMemory) {
      codeLayoutMemoryRef.current = diagram;
      return;
    }

    const nextNodeById = new Map(currentMemory.nodes.map((node) => [node.id, node]));
    diagram.nodes.forEach((node) => {
      nextNodeById.set(node.id, node);
    });

    const nextNodeIds = new Set(nextNodeById.keys());
    const nextEdgeById = new Map(
      currentMemory.edges
        .filter((edge) => nextNodeIds.has(edge.sourceId) && nextNodeIds.has(edge.targetId))
        .map((edge) => [edge.id, edge]),
    );
    diagram.edges.forEach((edge) => {
      nextEdgeById.set(edge.id, edge);
    });

    codeLayoutMemoryRef.current = {
      ...diagram,
      nodes: Array.from(nextNodeById.values()),
      edges: Array.from(nextEdgeById.values()),
      generalizationGroups: diagram.generalizationGroups ?? currentMemory.generalizationGroups,
    };
  }

  useEffect(() => {
    if (!codeDirtyRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      try {
        const currentDiagram = latestDiagramRef.current;
        rememberCodeLayout(currentDiagram);
        const parsed = parseErsDiagram(codeDraftRef.current, currentDiagram, codeLayoutMemoryRef.current ?? undefined);
        const normalizedParsed = revalidateExternalIdentifiers(
          synchronizeExternalIdentifiers(
            synchronizeInternalIdentifiers(
              synchronizeEntityRelationshipParticipations(synchronizeNodeNameIdentity(parsed).diagram),
            ),
          ),
        ).diagram;
        const normalizedCurrent = revalidateExternalIdentifiers(
          synchronizeExternalIdentifiers(
            synchronizeInternalIdentifiers(
              synchronizeEntityRelationshipParticipations(synchronizeNodeNameIdentity(currentDiagram).diagram),
            ),
          ),
        ).diagram;
        const parsedSerialized = serializeDiagramToErs(normalizedParsed);

        if (serializeDiagram(normalizedParsed) !== serializeDiagram(normalizedCurrent)) {
          suppressNextCodeSyncRef.current = true;
          history.commit(normalizedParsed, normalizedCurrent);
        }
        rememberCodeLayout(normalizedParsed);

        if (codeError) {
          setCodeError("");
        }
        lastSerializedCodeRef.current = parsedSerialized;
        const nextDirty = codeDraftRef.current !== parsedSerialized;
        codeDirtyRef.current = nextDirty;
        setCodeDirty(nextDirty);
        if (!nextDirty && !codeEditorFocusedRef.current) {
          codeLayoutMemoryRef.current = null;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Codice ERS non valido.";
        const formattedMessage = formatErsErrorMessage(message);
        setCodeError(formattedMessage);
        showErrorNotice(formattedMessage, { title: "Errore nel codice ERS" });
      }
    }, 850);

    return () => window.clearTimeout(timeout);
  }, [codeDraft]);

  useEffect(() => {
    const nextSerializedCode = serializeDiagramToErs(history.present);
    const syncSource = suppressNextCodeSyncRef.current ? "code-parse" : "external";
    suppressNextCodeSyncRef.current = false;
    lastSerializedCodeRef.current = nextSerializedCode;

    // While the code editor owns the text, never replace the draft with the
    // canonical serializer output; that rewrite moves the caret and can erase
    // in-progress input. Once focus leaves the editor, external canvas/project
    // changes should be reflected in Code even if the previous draft was not
    // canonical serializer output.
    if (
      shouldSyncCodeDraftFromDiagram({
        focused: codeEditorFocusedRef.current,
        dirty: codeDirtyRef.current,
        source: syncSource,
      })
    ) {
      codeDraftRef.current = nextSerializedCode;
      codeDirtyRef.current = false;
      codeLayoutMemoryRef.current = null;
      setCodeDraft(nextSerializedCode);
      setCodeDirty(false);
      setCodeError("");
    }
  }, [history.present]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isEditingField =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true ||
        target?.closest('[role="dialog"], .studio-modal, .modal, dialog') !== null;

      if (isEditingField) {
        return;
      }

      if (versionCompareSession) {
        const shortcut = event.key.toLowerCase();
        const blockedEditorShortcut =
          (event.ctrlKey || event.metaKey) ||
          event.key === "Delete" ||
          event.key === "Backspace" ||
          TOOL_BY_SHORTCUT[shortcut] !== undefined;

        if (blockedEditorShortcut) {
          event.preventDefault();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSaveProject();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        if (diagramView !== "er") {
          return;
        }
        event.preventDefault();
        handleCopySelection();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {
        if (diagramView !== "er") {
          return;
        }
        event.preventDefault();
        void handlePasteSelection();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {
        if (diagramView !== "er") {
          return;
        }
        event.preventDefault();
        handleDuplicateSelection();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === ".") {
        event.preventDefault();
        handleToggleFocusMode();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "i") {
        event.preventDefault();
        if (diagramView === "er") {
          setErrorsPanelOpen(true);
          return;
        }

        if (diagramView === "logical") {
          setLogicalPanelMode((current) => (current === "sql" ? "review" : "sql"));
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedoAction();
        } else {
          handleUndoAction();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedoAction();
        return;
      }

      if (diagramView === "er" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const shortcut = event.key.toLowerCase();
        const nextTool = TOOL_BY_SHORTCUT[shortcut];

        if (nextTool) {
          event.preventDefault();
          handleToolChange(nextTool);
          setStatus(`Strumento attivo: ${getToolLabel(nextTool)}.`);
          return;
        }
      }

      if (diagramView === "er" && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
        if (identifierSelection) {
          handleDeleteIdentifierSelection();
          return;
        }
        handleDeleteSelection();
        return;
      }

      if (event.key === "Escape") {
        if (promptDialog) {
          event.preventDefault();
          closePromptDialog(null);
          return;
        }

        if (confirmDialog) {
          event.preventDefault();
          closeConfirmDialog(false);
          return;
        }

        if (cardinalityDialog) {
          event.preventDefault();
          cancelCardinalityDialog();
          return;
        }

        if (mixedIdentifierDialog) {
          event.preventDefault();
          setMixedIdentifierDialog(null);
          return;
        }

        if (generalizationGroupDialog) {
          event.preventDefault();
          cancelGeneralizationGroupDialog();
          return;
        }

        if (errorsPanelOpen) {
          event.preventDefault();
          setErrorsPanelOpen(false);
          return;
        }

        if (versionAnnouncement) {
          event.preventDefault();
          closeVersionAnnouncement();
          return;
        }

        if (commandMenuOpen) {
          setCommandMenuOpen(false);
          return;
        }

        if (keyboardShortcutsOpen) {
          setKeyboardShortcutsOpen(false);
          return;
        }

        if (introOpen) {
          setIntroOpen(false);
          return;
        }

        if (aboutOpen) {
          setAboutOpen(false);
          return;
        }

        if (whatsNewOpen) {
          setWhatsNewOpen(false);
          return;
        }

        if (diagramView === "er") {
          if (tool === "entity" || tool === "relationship") {
            setTool("select");
            setStatus("Posizionamento annullato.");
            return;
          }
          setSelection({ nodeIds: [], edgeIds: [] });
          setIdentifierSelection(null);
        } else {
          setLogicalSelection(EMPTY_LOGICAL_SELECTION);
        }
        setStatus("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    aboutOpen,
    cardinalityDialog,
    commandMenuOpen,
    confirmDialog,
    diagramView,
    errorsPanelOpen,
    history,
    identifierSelection,
    generalizationGroupDialog,
    introOpen,
    keyboardShortcutsOpen,
    logicalHistory,
    mixedIdentifierDialog,
    mode,
    promptDialog,
    selection,
    technicalPanelOpen,
    technicalPanelTab,
    tool,
    versionAnnouncement,
    versionCompareSession,
    whatsNewOpen,
  ]);

  function commitDiagram(
    nextDiagram: DiagramDocument,
    previousDiagram?: DiagramDocument,
    options?: { suppressExternalIdentifierWarnings?: boolean },
  ): DiagramDocument {
    const nodeIdentitySynchronizedNext = synchronizeNodeNameIdentity(nextDiagram);
    const synchronizedNext = normalizeGeneralizationGroups(
      synchronizeExternalIdentifiers(
        synchronizeInternalIdentifiers(
          synchronizeEntityRelationshipParticipations(nodeIdentitySynchronizedNext.diagram),
        ),
      ),
    );
    const normalizedNext = revalidateExternalIdentifiers(synchronizedNext);
    const previousIdentitySynchronized = previousDiagram
      ? synchronizeNodeNameIdentity(previousDiagram).diagram
      : undefined;
    const normalizedPrevious = previousIdentitySynchronized
      ? revalidateExternalIdentifiers(
          normalizeGeneralizationGroups(
            synchronizeExternalIdentifiers(
              synchronizeInternalIdentifiers(synchronizeEntityRelationshipParticipations(previousIdentitySynchronized)),
            ),
          ),
        ).diagram
      : undefined;

    history.commit(normalizedNext.diagram, normalizedPrevious);
    if (nodeIdentitySynchronizedNext.nodeIdMap.size > 0) {
      setSelection((currentSelection) => ({
        ...currentSelection,
        nodeIds: Array.from(
          new Set(
            currentSelection.nodeIds.map(
              (selectedNodeId) =>
                nodeIdentitySynchronizedNext.nodeIdMap.get(selectedNodeId) ?? selectedNodeId,
            ),
          ),
        ),
      }));
    }
    if (!codeDirtyRef.current) {
      syncCodeDraftWithDiagram(normalizedNext.diagram);
    }
    if (!options?.suppressExternalIdentifierWarnings) {
      reportExternalIdentifierInvalidations(normalizedNext.invalidations, "notice");
    }

    return normalizedNext.diagram;
  }

  function handlePreviewDiagram(nextDiagram: DiagramDocument) {
    const withNodeIdentity = synchronizeNodeNameIdentity(nextDiagram).diagram;
    const normalized = revalidateExternalIdentifiers(
      normalizeGeneralizationGroups(
        synchronizeExternalIdentifiers(
          synchronizeInternalIdentifiers(synchronizeEntityRelationshipParticipations(withNodeIdentity)),
        ),
      ),
    );
    history.setPresent(normalized.diagram);
  }

  function commitLogicalWorkspace(
    nextWorkspace: LogicalWorkspaceDocument,
    previousWorkspace?: LogicalWorkspaceDocument,
  ) {
    logicalHistory.commit(nextWorkspace, previousWorkspace);
  }

  function commitTranslationWorkspace(
    nextWorkspace: ErTranslationWorkspaceDocument,
    previousWorkspace?: ErTranslationWorkspaceDocument,
  ) {
    translationHistory.commit(nextWorkspace, previousWorkspace);
  }

  function previewLogicalModel(nextModel: LogicalModel) {
    logicalHistory.setPresent(
      updateLogicalWorkspaceModel(translationHistory.present.translatedDiagram, logicalHistory.present, nextModel),
    );
  }

  function commitLogicalModel(nextModel: LogicalModel, previousModel?: LogicalModel) {
    const previousWorkspace = logicalHistory.present;
    const nextWorkspace = updateLogicalWorkspaceModel(
      translationHistory.present.translatedDiagram,
      previousWorkspace,
      nextModel,
    );
    const previousSnapshot =
      previousModel == null
        ? previousWorkspace
        : updateLogicalWorkspaceModel(translationHistory.present.translatedDiagram, previousWorkspace, previousModel);
    commitLogicalWorkspace(nextWorkspace, previousSnapshot);
  }

  function resetTranslationWorkspace(options?: { switchToTranslation?: boolean; preserveHistory?: boolean }) {
    const previousWorkspace = translationHistory.present;
    const nextWorkspace = createEmptyErTranslationWorkspace(history.present, previousWorkspace);
    if (options?.preserveHistory) {
      translationHistory.commit(nextWorkspace, previousWorkspace);
    } else {
      translationHistory.reset(nextWorkspace);
    }
    setTranslationSelection({ nodeIds: [], edgeIds: [] });
    setTranslationViewport(DEFAULT_VIEWPORT);
    setLogicalGenerated(false);
    setLogicalSelection(EMPTY_LOGICAL_SELECTION);
    if (options?.switchToTranslation) {
      setDiagramView("translation");
    }

    setTool("select");
    setStatus("Workspace di traduzione ER->ER resettato.");
  }

  function regenerateLogicalWorkspace(options?: {
    switchToLogical?: boolean;
    preservePositions?: boolean;
    resetDecisions?: boolean;
    initialViewport?: Viewport;
  }) {
    const translatedDiagram = translationHistory.present.translatedDiagram;
    const previousWorkspace = options?.preservePositions && logicalGenerated ? logicalHistory.present : undefined;
    const nextWorkspace =
      options?.resetDecisions === true
        ? createEmptyLogicalWorkspace(translatedDiagram)
        : refreshLogicalWorkspace(
            translatedDiagram,
            previousWorkspace ?? createEmptyLogicalWorkspace(translatedDiagram),
          );

    logicalHistory.reset(nextWorkspace);
    setLogicalGenerated(true);
    setLogicalStage("translation");
    setLogicalSelection(EMPTY_LOGICAL_SELECTION);
    setLogicalViewport(options?.initialViewport ? { ...options.initialViewport } : { ...DEFAULT_VIEWPORT });
    if (options?.switchToLogical) {
      setDiagramView("logical");
    }

    setTool("select");
    if (options?.resetDecisions) {
      setStatus("Workflow logico manuale resettato.");
      return;
    }

    setStatus(previousWorkspace ? "Vista logica riallineata all'ER tradotto." : "Workspace logico manuale inizializzato.");
  }

  function handleDiagramViewChange(nextView: WorkspaceView) {
    if (nextView === diagramView) {
      return;
    }

    if (nextView === "translation") {
      if (!translationAccess.allowed) {
        setStatusWarning(translationAccess.reason ?? "Correggi prima gli errori bloccanti del diagramma ER.");
        return;
      }

      setDiagramView("translation");
      setLogicalTypeMode(false);
      setSelection({ nodeIds: [], edgeIds: [] });
      setTool("select");
      return;
    }

    if (nextView === "logical") {
      if (!translationAccess.allowed) {
        setStatusWarning(translationAccess.reason ?? "La vista Traduzione non e disponibile finche lo schema ER contiene errori.");
        return;
      }

      const logicalAccess = canOpenLogicalView(translationHistory.present);
      if (!logicalAccess.allowed) {
        setDiagramView("translation");
        setLogicalTypeMode(false);
        setStatusWarning(logicalAccess.reason ?? "Completa prima la traduzione ER->ER.");
        return;
      }

      if (!logicalGenerated) {
        regenerateLogicalWorkspace({ switchToLogical: true, preservePositions: true, initialViewport: translationViewport });
        return;
      }

      if (logicalOutOfDate) {
        const refreshedWorkspace = refreshLogicalWorkspace(
          translationHistory.present.translatedDiagram,
          logicalHistory.present,
        );
        logicalHistory.setPresent(refreshedWorkspace);
        setStatus("Vista logica riallineata all'ER tradotto senza conversione automatica completa.");
      }

      if (diagramView === "translation") {
        setLogicalViewport({ ...translationViewport });
      }
      setDiagramView("logical");
      setTranslationSelection({ nodeIds: [], edgeIds: [] });
      setTool("select");
      return;
    }

    setDiagramView("er");
    setLogicalTypeMode(false);
    setTranslationSelection({ nodeIds: [], edgeIds: [] });
    setLogicalSelection(EMPTY_LOGICAL_SELECTION);
    setStatus("Vista ER attiva.");
  }

  function handleGenerateLogicalModel() {
    const logicalAccess = canOpenLogicalView(translationHistory.present);
    if (!logicalAccess.allowed) {
      setDiagramView("translation");
      setStatusWarning(logicalAccess.reason ?? "Completa prima la traduzione ER->ER.");
      return;
    }

    regenerateLogicalWorkspace({
      switchToLogical: true,
      preservePositions: false,
      resetDecisions: true,
      initialViewport: translationViewport,
    });
    setLogicalStage("translation");
  }

  function handleResetLogicalTranslation() {
    const logicalAccess = canOpenLogicalView(translationHistory.present);
    if (!logicalAccess.allowed) {
      setDiagramView("translation");
      setStatusWarning(logicalAccess.reason ?? "Completa prima la traduzione ER->ER.");
      return;
    }

    const hasAppliedWork =
      logicalHistory.present.translation.decisions.length > 0 ||
      logicalHistory.present.model.tables.length > 0 ||
      logicalHistory.present.model.foreignKeys.length > 0;
    if (hasAppliedWork && !window.confirm("Vuoi cancellare tutte le modifiche della traduzione logica?")) {
      return;
    }

    const previousWorkspace = logicalHistory.present;
    const nextWorkspace = createEmptyLogicalWorkspace(translationHistory.present.translatedDiagram, previousWorkspace);
    commitLogicalWorkspace(nextWorkspace, previousWorkspace);
    setLogicalGenerated(true);
    setLogicalStage("translation");
    setLogicalPanelMode("review");
    setLogicalTypeMode(false);
    setLogicalSelection(EMPTY_LOGICAL_SELECTION);
    setLogicalViewport(DEFAULT_VIEWPORT);
    setDiagramView("logical");
    setStatus("Traduzione logica resettata.");
  }

  function showLogicalStageAfterFix(
    nextWorkspace: LogicalWorkspaceDocument,
    pendingStatus: string,
    completeStatus: string,
  ) {
    const nextOverview = buildLogicalTranslationOverview(translationHistory.present.translatedDiagram, nextWorkspace);
    const nextPendingCount = getLogicalTranslationOpenItemCount(nextOverview);
    const hasBlockingConflicts = nextWorkspace.translation.conflicts.some((conflict) => conflict.level === "error");

    if (nextPendingCount === 0 && !hasBlockingConflicts) {
      setLogicalStage("schema");
      setLogicalPanelMode("review");
      setLogicalTypeMode(false);
      setLogicalSelection(EMPTY_LOGICAL_SELECTION);
      setLogicalFitRequestToken((current) => current + 1);
      setStatus(completeStatus);
      return;
    }

    setLogicalStage("translation");
    setLogicalTypeMode(false);
    setStatus(pendingStatus);
  }

  function handleApplyBulkLogicalFix(
    step: "entities" | "weak-entities" | "relationships" | "multivalued-attributes",
    options?: { choiceIdsByTargetKey?: Record<string, string> },
  ) {
    const previousWorkspace = logicalHistory.present;
    const result = applyBulkLogicalFix(translationHistory.present.translatedDiagram, previousWorkspace, step, {
      choiceIdsByTargetKey: options?.choiceIdsByTargetKey,
    });
    if (result.pendingEntityKeySelections && result.pendingEntityKeySelections.length > 0) {
      setStatusWarning(t("workspace.logicalChoosePrimaryKey"));
      return;
    }

    if (result.appliedCount === 0) {
      setStatusWarning(t("workspace.logicalNoApplicableItems"));
      return;
    }

    commitLogicalWorkspace(result.workspace, previousWorkspace);
    setDiagramView("logical");
    showLogicalStageAfterFix(
      result.workspace,
      t("workspace.logicalFixApplied", { count: result.appliedCount }),
      t("workspace.logicalFixAppliedSchemaActive", { count: result.appliedCount }),
    );
  }

  function handleLogicalDone() {
    if (logicalPendingCount > 0 || logicalHistory.present.translation.conflicts.some((conflict) => conflict.level === "error")) {
      setStatusWarning(t("logical.designer.completeBeforeSchema"));
      return;
    }

    setLogicalStage("schema");
    setLogicalPanelMode("review");
    setLogicalTypeMode(false);
    setLogicalSelection(EMPTY_LOGICAL_SELECTION);
    setLogicalFitRequestToken((current) => current + 1);
    setStatus(t("workspace.logicalSchemaActive"));
  }

  function handleResetTranslation() {
    if (!translationAccess.allowed) {
      setStatusWarning(translationAccess.reason ?? t("workspace.fixBlockingErErrorsFirst"));
      return;
    }

    const hasAppliedWork =
      translationHistory.present.translation.decisions.length > 0 ||
      translationHistory.present.translation.mappings.length > 0 ||
      translationHistory.present.translation.conflicts.length > 0;
    if (hasAppliedWork && !window.confirm(t("workspace.confirmResetTranslationWork"))) {
      return;
    }

    resetTranslationWorkspace({ switchToTranslation: true, preserveHistory: true });
  }

  function handleLogicalAutoLayout() {
    if (!logicalGenerated) {
      regenerateLogicalWorkspace({ switchToLogical: true, preservePositions: false });
      return;
    }

    const previousModel = logicalHistory.present.model;
    const nextModel = autoLayoutLogicalModel(previousModel);
    commitLogicalModel(nextModel, previousModel);
    setStatus(t("workspace.logicalLayoutUpdated"));
  }

  function handleLogicalFit() {
    setLogicalFitRequestToken((current) => current + 1);
  }

  function handleLogicalTableRename(tableId: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed) {
      return;
    }

    const previousModel = logicalHistory.present.model;
    const nextModel = normalizeLogicalModelGeometry({
      ...previousModel,
      tables: previousModel.tables.map((table) =>
        table.id === tableId
          ? {
              ...table,
              name: trimmed,
            }
          : table,
      ),
    });

    commitLogicalModel(nextModel, previousModel);
  }

  function handleLogicalColumnRename(tableId: string, columnId: string, nextName: string) {
    const trimmed = nextName.trim();
    if (!trimmed) {
      return;
    }

    const previousModel = logicalHistory.present.model;
    const nextModel = normalizeLogicalModelGeometry({
      ...previousModel,
      tables: previousModel.tables.map((table) =>
        table.id !== tableId
          ? table
          : {
              ...table,
              columns: table.columns.map((column) =>
                column.id === columnId
                  ? {
                      ...column,
                      name: trimmed,
                    }
                  : column,
              ),
            },
      ),
    });

    commitLogicalModel(nextModel, previousModel);
  }

  function handleLogicalTypeModeChange(nextValue: boolean) {
    setLogicalTypeMode(nextValue);
  }

  function handleLogicalColumnSqlUpdate(
    tableId: string,
    columnId: string,
    patch: LogicalColumnSqlPatch,
  ) {
    const previousModel = logicalHistory.present.model;
    const nextModel = updateLogicalColumnSqlMetadata(previousModel, tableId, columnId, patch);
    commitLogicalModel(nextModel, previousModel);
  }

  function handleLogicalColumnMove(
    tableId: string,
    columnId: string,
    direction: "up" | "down" | "top" | "bottom",
  ) {
    const previousModel = logicalHistory.present.model;
    const nextModel = {
      ...previousModel,
      tables: previousModel.tables.map((table) => {
        if (table.id !== tableId) {
          return table;
        }

        const fromIndex = table.columns.findIndex((column) => column.id === columnId);
        if (fromIndex < 0) {
          return table;
        }

        const columns = [...table.columns];
        const [column] = columns.splice(fromIndex, 1);
        const toIndex =
          direction === "top"
            ? 0
            : direction === "bottom"
              ? columns.length
              : direction === "up"
                ? Math.max(0, fromIndex - 1)
                : Math.min(columns.length, fromIndex + 1);
        columns.splice(toIndex, 0, column);
        return { ...table, columns };
      }),
    };
    commitLogicalModel(nextModel, previousModel);
  }

  function handleApplyErTranslationChoice(item: ErTranslationItem, choice: ErTranslationChoice) {
    const previousWorkspace = translationHistory.present;
    try {
      const nextWorkspace = applyErTranslationChoice(history.present, previousWorkspace, choice, item.targetType, item.id);
      commitTranslationWorkspace(nextWorkspace, previousWorkspace);
      setDiagramView("translation");
      setStatus(choice.summary);
    } catch (error) {
      setStatusWarning(error instanceof Error ? error.message : "Decisione di ristrutturazione non applicabile.");
    }
  }

  function handleApplyLogicalTranslationChoice(item: LogicalTranslationItem, choice: LogicalTranslationChoice) {
    const previousWorkspace = logicalHistory.present;
    const nextWorkspace = applyLogicalTranslationChoice(
      translationHistory.present.translatedDiagram,
      previousWorkspace,
      choice,
      item.targetType,
      item.id,
    );
    commitLogicalWorkspace(nextWorkspace, previousWorkspace);
    setDiagramView("logical");
    showLogicalStageAfterFix(nextWorkspace, choice.summary, `${choice.summary} Schema logico attivo.`);
  }

  async function handleNewProject() {
    if (!(await confirmDiscardChanges(t("workspace.unsavedActions.createNewProject")))) {
      return;
    }

    applyWorkspaceDocument(
      createEmptyDiagram(t("workspace.newDiagramName")),
      t("workspace.newProject"),
    );
  }

  function handleCreateNode(
    nodeType: Extract<ToolKind, "entity" | "relationship" | "attribute">,
    point: Point,
  ) {
    const nextNode = createNode(nodeType, point, history.present);
    const nextDiagram = {
      ...history.present,
      nodes: [...history.present.nodes, nextNode],
    };
    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [nextNode.id], edgeIds: [] });
    setIdentifierSelection(null);
    setTool("select");
    setStatus(t("workspace.nodeAdded", { label: nextNode.label }));
    return nextNode.id;
  }

  function handleCreateNodeFromToolbar(nodeType: Extract<ToolKind, "entity" | "relationship">) {
    handleToolChange(nodeType);
    setSelection({ nodeIds: [], edgeIds: [] });
    setStatus(nodeType === "entity" ? t("workspace.clickToPlaceEntity") : t("workspace.clickToPlaceRelationship"));
  }

  function handleCreateEdge(type: "connector" | "attribute" | "inheritance", sourceId: string, targetId: string) {
    let resolvedSourceId = sourceId;
    let resolvedTargetId = targetId;
    let sourceNode = findNode(history.present, resolvedSourceId);
    let targetNode = findNode(history.present, resolvedTargetId);

    if (!sourceNode || !targetNode) {
      showWarningNotice(
        t("workspace.connectionMissingEndpoint"),
        { title: t("workspace.noticeTitles.invalidConnection") },
      );
      return {
        success: false,
        message: buildStructuredErrorMessage(
          t("workspace.errors.connectionNotCreated"),
          t("workspace.errors.missingEndpoint"),
          t("workspace.errors.selectTwoValidNodes"),
        ),
      };
    }

    if (
      type === "attribute" &&
      sourceNode.type === "attribute" &&
      targetNode.type === "attribute" &&
      sourceNode.isMultivalued === true &&
      targetNode.isMultivalued !== true
    ) {
      resolvedSourceId = targetId;
      resolvedTargetId = sourceId;
      sourceNode = targetNode;
      targetNode = findNode(history.present, resolvedTargetId) as DiagramNode;
    }

    if (
      type === "attribute" &&
      sourceNode.type === "attribute" &&
      targetNode.type === "attribute" &&
      !canAttributeBecomeComposite(history.present, targetNode)
    ) {
      showWarningNotice(
        t("workspace.attributeAlreadyCompositeChildConnect", { attribute: targetNode.label }),
        { title: t("workspace.noticeTitles.subattributeNotAllowed") },
      );
      return {
        success: false,
        message: buildStructuredErrorMessage(
          t("workspace.errors.connectionNotCreated"),
          t("workspace.errors.attributeAlreadyCompositeChild", { attribute: targetNode.label }),
          t("workspace.errors.connectToCompositeRoot"),
        ),
      };
    }

    if (!canConnect(type, sourceNode, targetNode)) {
      const failureReason = getConnectionFailureReason(type, sourceNode, targetNode);
      showWarningNotice(
        t("workspace.invalidConnectionWithReason", { reason: normalizeMessagePart(failureReason.replace(/^errore[:\s]*/i, "")) }),
        { title: t("workspace.noticeTitles.invalidConnection") },
      );
      return {
        success: false,
        message: buildStructuredErrorMessage(
          t("workspace.errors.connectionNotCreated"),
          normalizeMessagePart(failureReason.replace(/^errore[:\s]*/i, "")),
          t("workspace.errors.connectCompatibleChen"),
        ),
      };
    }

    if (edgeAlreadyExists(history.present, type, resolvedSourceId, resolvedTargetId)) {
      showWarningNotice(t("workspace.connectionAlreadyExists"), { title: t("workspace.noticeTitles.connectionAlreadyPresent") });
      return { success: false, message: t("workspace.connectionAlreadyPresentStatus") };
    }

    const nextEdge = createEdge(type, resolvedSourceId, resolvedTargetId, history.present);
    let edgeToSelect = nextEdge;
    let nextDiagramBase: DiagramDocument = {
      ...history.present,
      edges: [...history.present.edges, nextEdge],
    };
    const shouldRequestConnectorCardinality = shouldOpenCardinalityDialogAfterEdgeCreation(type, sourceNode, targetNode);
    if (shouldRequestConnectorCardinality) {
      const prepared = ensureConnectorParticipation(nextDiagramBase, nextEdge.id);
      if (prepared) {
        nextDiagramBase = prepared.diagram;
        edgeToSelect =
          prepared.diagram.edges.find((edge) => edge.id === nextEdge.id) ?? nextEdge;
      }
    }
    const nextDiagramWithEdge =
      type === "attribute" && sourceNode.type === "attribute" && targetNode.type === "attribute"
        ? (() => {
            const nextSize = getMultivaluedAttributeSize(targetNode.label);
            return updateNodeInDiagram(nextDiagramBase, targetNode.id, {
              isMultivalued: true,
              width: nextSize.width,
              height: nextSize.height,
            } as Partial<DiagramNode>);
          })()
        : nextDiagramBase;
    const directAttributeHostId =
      type === "attribute" && sourceNode.type === "attribute" && targetNode.type === "attribute"
        ? targetNode.id
        : type === "attribute" && sourceNode.type !== "attribute" && targetNode.type === "attribute"
          ? sourceNode.id
          : type === "attribute" && targetNode.type !== "attribute" && sourceNode.type === "attribute"
            ? targetNode.id
            : undefined;
    const directAttributeHost = directAttributeHostId
      ? nextDiagramWithEdge.nodes.find(
          (node): node is AttributeCreationHost =>
            node.id === directAttributeHostId &&
            (node.type === "entity" || node.type === "relationship" || node.type === "attribute"),
        )
      : undefined;
    const nextDiagram = directAttributeHost
      ? layoutDirectAttributesAroundHost(
          nextDiagramWithEdge,
          directAttributeHost,
          findDirectHostedAttributes(nextDiagramWithEdge, directAttributeHost.id).map((attribute) => attribute.id),
        )
      : nextDiagramWithEdge;

    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [], edgeIds: [edgeToSelect.id] });
    setIdentifierSelection(null);
    setTool("select");
    if (shouldRequestConnectorCardinality) {
      setCardinalityDialog({
        mode: "create-connector",
        target: { kind: "connector", edgeId: edgeToSelect.id },
        initialValue: "(1,1)",
        presetValue: "(1,1)",
        customValue: "(1,1)",
        error: "",
        createdEdgeWasTemporary: true,
        previousDiagramBeforeTemporary: history.present,
      });
      return { success: true, message: t("workspace.chooseCardinalityToCompleteConnection") };
    }
    if (type === "inheritance") {
      openGeneralizationGroupDialog(edgeToSelect.id, nextDiagram, { createdEdgeWasTemporary: true });
      return { success: true, message: t("workspace.configureIsaGroupToCompleteHierarchy") };
    }
    return { success: true, message: t("workspace.connectionCreated") };
  }

  function getConnectorCardinality(edge: Extract<DiagramEdge, { type: "connector" }>): string | undefined {
    const nodeMap = new Map(history.present.nodes.map((node) => [node.id, node]));
    return getConnectorParticipation(edge, nodeMap.get(edge.sourceId), nodeMap.get(edge.targetId))?.cardinality;
  }

  function getCardinalityTargetFromSelection(edgeId?: string): CardinalityDialogTarget | null {
    if (edgeId) {
      const edge = history.present.edges.find((candidate) => candidate.id === edgeId);
      return edge?.type === "connector" ? { kind: "connector", edgeId: edge.id } : null;
    }

    if (selectedNode?.type === "attribute") {
      return { kind: "attribute", attributeId: selectedNode.id };
    }

    if (selectedEdge?.type === "attribute") {
      const nodeMap = new Map(history.present.nodes.map((node) => [node.id, node]));
      const attribute = getAttributeCardinalityOwner(
        nodeMap.get(selectedEdge.sourceId),
        nodeMap.get(selectedEdge.targetId),
      );
      return attribute ? { kind: "attribute", attributeId: attribute.id } : null;
    }

    if (selectedEdge?.type === "connector") {
      return { kind: "connector", edgeId: selectedEdge.id };
    }

    return null;
  }

  function getCurrentCardinalityForTarget(target: CardinalityDialogTarget): string | undefined {
    if (target.kind === "attribute") {
      const attribute = history.present.nodes.find(
        (node): node is AttributeNode => node.id === target.attributeId && node.type === "attribute",
      );
      return attribute?.cardinality;
    }

    const edge = history.present.edges.find(
      (candidate): candidate is Extract<DiagramEdge, { type: "connector" }> =>
        candidate.id === target.edgeId && candidate.type === "connector",
    );
    return edge ? getConnectorCardinality(edge) : undefined;
  }

  function getCardinalityBlockReason(target: CardinalityDialogTarget): string | null {
    if (target.kind !== "attribute") {
      return null;
    }

    const attribute = history.present.nodes.find(
      (node): node is AttributeNode => node.id === target.attributeId && node.type === "attribute",
    );
    if (!attribute) {
      return t("workspace.attributeUnavailable");
    }

    return canAttributeHaveCardinality(history.present, attribute)
      ? null
      : t("workspace.cardinalityUnavailableForIdentifierAttribute");
  }

  function handleOpenCardinalityControl(edgeId?: string) {
    const target = getCardinalityTargetFromSelection(edgeId);
    if (!target) {
      setStatusWarning(t("workspace.selectAttributeOrConnectorForCardinality"), {
        title: t("workspace.noticeTitles.cardinalityNotApplicable"),
      });
      return;
    }

    const blockReason = getCardinalityBlockReason(target);
    if (blockReason) {
      setStatusWarning(blockReason, { title: t("workspace.noticeTitles.cardinalityNotApplicable") });
      return;
    }

    const currentValue = getCurrentCardinalityForTarget(target) ?? "(1,1)";
    setCardinalityDialog({
      mode: "edit",
      target,
      initialValue: currentValue,
      presetValue: (CONNECTOR_CARDINALITY_PRESETS as readonly string[]).includes(currentValue)
        ? currentValue
        : "custom",
      customValue: currentValue,
      error: "",
    });
  }

  function applyCardinalityToTarget(
    target: CardinalityDialogTarget,
    value: string,
    options?: { previousDiagram?: DiagramDocument },
  ): string | null {
    const parsed = normalizeCardinalityInput(value);
    if (!parsed.valid || !parsed.value) {
      setCardinalityDialog((current) =>
        current ? { ...current, error: parsed.reason ?? t("toolbar.designer.invalidCardinality") } : current,
      );
      return null;
    }

    if (target.kind === "attribute") {
      const attribute = history.present.nodes.find(
        (node): node is AttributeNode => node.id === target.attributeId && node.type === "attribute",
      );
      if (!attribute || !canAttributeHaveCardinality(history.present, attribute)) {
        setCardinalityDialog((current) =>
          current
            ? {
                ...current,
                error: t("workspace.cardinalityUnavailableForIdentifierAttribute"),
              }
            : current,
        );
        return null;
      }

      handleNodeChange(target.attributeId, { cardinality: parsed.value } as Partial<DiagramNode>);
      return parsed.value;
    }

    const connectorEdge = history.present.edges.find(
      (edge): edge is Extract<DiagramEdge, { type: "connector" }> =>
        edge.id === target.edgeId && edge.type === "connector",
    );
    if (!connectorEdge) {
      setCardinalityDialog((current) => current ? { ...current, error: t("workspace.connectorUnavailable") } : current);
      return null;
    }

    const result = applyConnectorCardinalityToDiagram(history.present, connectorEdge.id, parsed.value);
    if (!result) {
      setCardinalityDialog((current) =>
        current ? { ...current, error: t("workspace.selectEntityRelationshipConnector") } : current,
      );
      return null;
    }

    commitDiagram(result.diagram, options?.previousDiagram);
    setSelection({ nodeIds: [], edgeIds: [connectorEdge.id] });
    return parsed.value;
  }

  async function handleOpenConnectorRoleControl() {
    if (!selectedEdge || selectedEdge.type !== "connector") {
      setStatusWarning(t("workspace.selectConnectorForRole"));
      return;
    }

    const currentNodeMap = new Map(history.present.nodes.map((node) => [node.id, node]));
    const sourceNode = currentNodeMap.get(selectedEdge.sourceId);
    const targetNode = currentNodeMap.get(selectedEdge.targetId);
    const context = getConnectorParticipationContext(sourceNode, targetNode);
    if (!context) {
      setStatusWarning(t("workspace.roleOnlyForEntityRelationshipConnector"));
      return;
    }

    const currentParticipation = getConnectorParticipation(selectedEdge, sourceNode, targetNode);
    const nextRole = await requestPromptDialog({
      title: "Role",
      label: t("workspace.connectorRoleLabel"),
      placeholder: "parent, child, supervisor...",
      initialValue: currentParticipation?.role ?? "",
      required: false,
      requiredMessage: "",
    });
    if (nextRole == null) {
      return;
    }

    const participationId = selectedEdge.participationId ?? `participation-${selectedEdge.id}`;
    const normalizedRole = nextRole.trim().length > 0 ? nextRole : undefined;
    const nextDiagram: DiagramDocument = {
      ...history.present,
      edges: history.present.edges.map((edge) =>
        edge.id === selectedEdge.id && edge.type === "connector"
          ? {
              ...edge,
              participationId,
            }
          : edge,
      ),
      nodes: history.present.nodes.map((node) => {
        if (node.id !== context.entity.id || node.type !== "entity") {
          return node;
        }

        const participations = node.relationshipParticipations ?? [];
        const existing = participations.find((participation) => participation.id === participationId);
        return {
          ...node,
          relationshipParticipations: existing
            ? participations.map((participation) =>
                participation.id === participationId
                  ? {
                      ...participation,
                      relationshipId: context.relationship.id,
                      role: normalizedRole,
                    }
                  : participation,
              )
            : [
                ...participations,
                {
                  id: participationId,
                  relationshipId: context.relationship.id,
                  role: normalizedRole,
                },
              ],
        };
      }),
    };

    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [], edgeIds: [selectedEdge.id] });
    setStatus(normalizedRole ? t("workspace.connectorRoleUpdated") : t("workspace.connectorRoleRemoved"));
  }

  function submitCardinalityDialog() {
    if (!cardinalityDialog) {
      return;
    }

    const value =
      cardinalityDialog.presetValue === "custom"
        ? cardinalityDialog.customValue
        : cardinalityDialog.presetValue;
    const appliedValue = applyCardinalityToTarget(cardinalityDialog.target, value, {
      previousDiagram: cardinalityDialog.createdEdgeWasTemporary
        ? cardinalityDialog.previousDiagramBeforeTemporary
        : undefined,
    });
    if (appliedValue) {
      setCardinalityDialog(null);
      setStatus(
        cardinalityDialog.createdEdgeWasTemporary
          ? t("workspace.connectorCreatedWithCardinality", { cardinality: appliedValue })
          : t("workspace.cardinalityUpdated", { cardinality: appliedValue }),
      );
    }
  }

  function cancelCardinalityDialog() {
    if (!cardinalityDialog) {
      return;
    }

    if (cardinalityDialog.createdEdgeWasTemporary && cardinalityDialog.target.kind === "connector") {
      const nextDiagram = removeTemporaryCardinalityConnector(
        history.present,
        cardinalityDialog.target.edgeId,
      );
      commitDiagram(nextDiagram, cardinalityDialog.previousDiagramBeforeTemporary);
      setSelection({ nodeIds: [], edgeIds: [] });
      setStatus("Creazione collegamento annullata.");
    }

    setCardinalityDialog(null);
  }

  function getCardinalityDialogLabels(dialog: CardinalityDialogState): {
    sourceLabel?: string;
    targetLabel?: string;
    contextLabel?: string;
  } {
    if (dialog.target.kind === "attribute") {
      const attributeId = dialog.target.attributeId;
      const attribute = history.present.nodes.find(
        (node): node is AttributeNode => node.id === attributeId && node.type === "attribute",
      );
      return {
        sourceLabel: attribute?.label,
      };
    }

    const edgeId = dialog.target.edgeId;
    const nodeMap = new Map(history.present.nodes.map((node) => [node.id, node]));
    const edge = history.present.edges.find(
      (candidate): candidate is Extract<DiagramEdge, { type: "connector" }> =>
        candidate.id === edgeId && candidate.type === "connector",
    );
    if (!edge) {
      return {};
    }

    const sourceNode = nodeMap.get(edge.sourceId);
    const targetNode = nodeMap.get(edge.targetId);
    const context = getConnectorParticipationContext(sourceNode, targetNode);
    if (!context) {
      return {
        sourceLabel: sourceNode?.label,
        targetLabel: targetNode?.label,
      };
    }

    return {
      sourceLabel: context.entity.label,
      targetLabel: context.relationship.label,
    };
  }

  function getDirectEntityAttributeContext(attributeId: string): { entity: EntityNode; attribute: AttributeNode } | null {
    const attribute = history.present.nodes.find(
      (node): node is AttributeNode => node.id === attributeId && node.type === "attribute",
    );
    if (!attribute || attribute.isMultivalued === true) {
      return null;
    }

    const edge = history.present.edges.find((candidate) => {
      if (candidate.type !== "attribute") {
        return false;
      }
      const otherId = candidate.sourceId === attributeId ? candidate.targetId : candidate.targetId === attributeId ? candidate.sourceId : "";
      const otherNode = history.present.nodes.find((node) => node.id === otherId);
      return otherNode?.type === "entity";
    });
    if (!edge) {
      return null;
    }

    const entityId = edge.sourceId === attributeId ? edge.targetId : edge.sourceId;
    const entity = history.present.nodes.find(
      (node): node is EntityNode => node.id === entityId && node.type === "entity",
    );
    return entity ? { entity, attribute } : null;
  }

  function getCompositeIdentifierSelectionContext(): { entity: EntityNode; attributes: AttributeNode[] } | null {
    if (selection.edgeIds.length > 0 || selection.nodeIds.length < 2) {
      return null;
    }

    const contexts = selection.nodeIds
      .map((nodeId) => getDirectEntityAttributeContext(nodeId))
      .filter((context): context is { entity: EntityNode; attribute: AttributeNode } => context !== null);
    if (contexts.length !== selection.nodeIds.length) {
      return null;
    }

    const entityId = contexts[0]?.entity.id;
    if (!entityId || contexts.some((context) => context.entity.id !== entityId)) {
      return null;
    }

    const entity = contexts[0].entity;
    const selectedIds = new Set(contexts.map((context) => context.attribute.id));
    const usedByOtherInternalId = new Set(
      (entity.internalIdentifiers ?? [])
        .filter((identifier) => !identifier.attributeIds.every((attributeId) => selectedIds.has(attributeId)))
        .flatMap((identifier) => identifier.attributeIds),
    );
    const usedByExternalId = new Set(
      (entity.externalIdentifiers ?? []).flatMap((identifier) => identifier.localAttributeIds),
    );
    const attributes = contexts.map((context) => context.attribute);
    const allEligible = attributes.every(
      (attribute) =>
        attribute.isMultivalued !== true &&
        attribute.isIdentifier !== true &&
        !usedByOtherInternalId.has(attribute.id) &&
        !usedByExternalId.has(attribute.id),
    );

    return allEligible ? { entity, attributes } : null;
  }

  function handleToggleSimpleIdentifierFromSelection() {
    if (!selectedNode || selectedNode.type !== "attribute") {
      setStatusWarning(t("workspace.selectSimpleEntityAttribute"), {
        title: t("workspace.noticeTitles.invalidIdentifier"),
      });
      return;
    }

    const context = getDirectEntityAttributeContext(selectedNode.id);
    if (!context) {
      setStatusWarning(t("workspace.simpleIdOnlyForDirectEntityAttributes"), {
        title: t("workspace.noticeTitles.invalidIdentifier"),
      });
      return;
    }

    const result = createSimpleInternalIdentifierForAttribute(history.present, context.attribute.id);
    if (result.status === "already-exists") {
      setStatusWarning(t("workspace.identifierAlreadyExistsUseDelete"), { title: t("workspace.noticeTitles.identifierAlreadyPresent") });
      return;
    }

    if (result.status !== "created") {
      setStatusWarning(t("workspace.simpleIdOnlyForUnusedSimpleAttributes"), {
        title: t("workspace.noticeTitles.invalidIdentifier"),
      });
      return;
    }

    commitDiagram(result.diagram);
    setSelection({ nodeIds: [context.attribute.id], edgeIds: [] });
    setIdentifierSelection({
      kind: "internal",
      hostEntityId: result.hostEntityId,
      internalIdentifierId: result.internalIdentifierId,
      attributeIds: [context.attribute.id],
    });
    setStatus(t("workspace.simpleInternalIdentifierCreated"));
  }

  function handleCreateCompositeIdentifierFromSelection() {
    const context = getCompositeIdentifierSelectionContext();
    if (!context) {
      setStatusWarning(t("workspace.compositeIdRequiresTwoAttributes"), {
        title: t("workspace.noticeTitles.invalidCompositeIdentifier"),
      });
      return;
    }

    const selectedIds = context.attributes.map((attribute) => attribute.id);
    const selectedIdSet = new Set(selectedIds);

    const nextIdentifiers = [
      ...(context.entity.internalIdentifiers ?? []).filter((identifier) =>
        !identifier.attributeIds.some((attributeId) => selectedIdSet.has(attributeId)),
      ),
      {
        id: `internalIdentifier-composite-${context.entity.id}-${Date.now()}`,
        attributeIds: selectedIds,
      },
    ];
    const attributePatches = Object.fromEntries(
      selectedIds.map((attributeId) => [attributeId, { isIdentifier: false, isCompositeInternal: true, cardinality: undefined }]),
    ) as Record<string, Partial<AttributeNode>>;
    handleEntityInternalIdentifiersChange(context.entity.id, { internalIdentifiers: nextIdentifiers }, attributePatches);
    setStatus(t("workspace.compositeInternalIdentifierCreated"));
  }

  function getConnectorContextFromSelectedEdge() {
    if (!selectedEdge || selectedEdge.type !== "connector") {
      return null;
    }

    const nodeMap = new Map(history.present.nodes.map((node) => [node.id, node]));
    const context = getConnectorParticipationContext(
      nodeMap.get(selectedEdge.sourceId),
      nodeMap.get(selectedEdge.targetId),
    );
    return context ? { ...context, edge: selectedEdge } : null;
  }

  function selectedConnectorRequiresMixedIdentifierCardinality(): boolean {
    const connectorContext = getConnectorContextFromSelectedEdge();
    if (!connectorContext) {
      return false;
    }

    return getConnectorCardinality(connectorContext.edge) === "(1,1)";
  }

  async function createExternalIdentifierFromContext(options: { mixed: boolean; localAttributeIds?: string[]; importedPartKeys?: string[] }) {
    let hostEntity: EntityNode | undefined;
    let relationshipId: string | undefined;
    let selectedConnectorId: string | undefined;

    const connectorContext = getConnectorContextFromSelectedEdge();
    if (connectorContext) {
      hostEntity = connectorContext.entity;
      relationshipId = connectorContext.relationship.id;
      selectedConnectorId = connectorContext.edge.id;
    } else if (selectedNode?.type === "attribute") {
      const attributeContext = getDirectEntityAttributeContext(selectedNode.id);
      hostEntity = attributeContext?.entity;
    }

    if (!hostEntity) {
      setStatusWarning(t("workspace.externalIdRequiresHostOrConnector"), {
        title: t("workspace.noticeTitles.externalIdentifierUnavailable"),
      });
      return;
    }

    const importOptions = getEligibleImportedIdentifierParts(history.present, hostEntity.id);
    const selectedKeySet = new Set(options.importedPartKeys ?? []);
    const selectedImportParts = importOptions.filter((option) => {
      if (selectedKeySet.size > 0) {
        return selectedKeySet.has(buildExternalImportPartKey(option));
      }
      return relationshipId ? option.relationshipId === relationshipId : true;
    });

    if (selectedImportParts.length === 0) {
      setStatusWarning(t("workspace.externalIdentifierNoImportedParts"), {
        title: t("workspace.noticeTitles.externalIdentifierUnavailable"),
      });
      return;
    }

    const localEligible = getEligibleLocalExternalIdentifierAttributes(
      hostEntity,
      findDirectHostedAttributes(history.present, hostEntity.id),
    );

    let localAttributeIds = options.localAttributeIds ?? [];
    if (options.mixed) {
      const eligibleIds = new Set(localEligible.map((attribute) => attribute.id));
      localAttributeIds = localAttributeIds.filter((attributeId) => eligibleIds.has(attributeId));
    }

    const nextIdentifier: ExternalIdentifier = {
      id: `externalIdentifier-${Date.now()}`,
      importedParts: selectedImportParts.map((part) => ({
        id:
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `externalIdentifierPart-${Math.random().toString(36).slice(2, 11)}`,
        relationshipId: part.relationshipId,
        sourceEntityId: part.sourceEntityId,
        importedIdentifierId: part.importedIdentifierId,
      })),
      localAttributeIds,
    };
    const nextDiagram: DiagramDocument = {
      ...history.present,
      edges: selectedConnectorId
        ? history.present.edges.map((edge) =>
            edge.id === selectedConnectorId && edge.type === "connector" && !edge.participationId
              ? { ...edge, participationId: `participation-${edge.id}` }
              : edge,
          )
        : history.present.edges,
      nodes: history.present.nodes.map((node) => {
        if (node.id !== hostEntity?.id || node.type !== "entity") {
          return node;
        }
        const participations = node.relationshipParticipations ?? [];
        const connector = selectedConnectorId
          ? history.present.edges.find(
              (edge): edge is Extract<DiagramEdge, { type: "connector" }> =>
                edge.id === selectedConnectorId && edge.type === "connector",
            )
          : undefined;
        const participationId = connector?.participationId ?? (selectedConnectorId ? `participation-${selectedConnectorId}` : undefined);
        const nextParticipations =
          participationId && selectedImportParts.some((part) => part.relationshipId === relationshipId)
            ? participations.some((participation) => participation.id === participationId)
              ? participations.map((participation) =>
                  participation.id === participationId ? { ...participation, cardinality: "(1,1)" } : participation,
                )
              : [...participations, { id: participationId, relationshipId: relationshipId as string, cardinality: "(1,1)" }]
            : participations;
        return {
          ...node,
          relationshipParticipations: nextParticipations,
          externalIdentifiers: [...(node.externalIdentifiers ?? []), nextIdentifier],
        };
      }),
    };

    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [hostEntity.id], edgeIds: [] });
    setStatus(localAttributeIds.length > 0 ? t("workspace.mixedExternalIdentifierCreated") : t("workspace.externalIdentifierCreated"));
  }

  function handleOpenMixedIdentifierModal() {
    const connectorContext = getConnectorContextFromSelectedEdge();
    if (!connectorContext) {
      setStatusWarning(t("workspace.externalIdRequiresSelectedConnector"), {
        title: t("workspace.noticeTitles.externalIdentifierUnavailable"),
      });
      return;
    }

    if (!selectedConnectorRequiresMixedIdentifierCardinality()) {
      setStatusWarning(t("workspace.externalIdRequiresOneOne"), {
        title: t("workspace.noticeTitles.externalIdentifierUnavailable"),
      });
      return;
    }

    const hostEntity = connectorContext.entity;
    const importOptions = getEligibleImportedIdentifierParts(history.present, hostEntity.id);
    if (importOptions.length === 0) {
      setStatusWarning(t("workspace.externalIdentifierNoImportedParts"), {
        title: t("workspace.noticeTitles.externalIdentifierUnavailable"),
      });
      return;
    }

    const attributes = getEligibleLocalExternalIdentifierAttributes(
      hostEntity,
      findDirectHostedAttributes(history.present, hostEntity.id),
    )
      .map((attribute) => ({ id: attribute.id, label: attribute.label }));

    setMixedIdentifierDialog({
      hostEntityId: hostEntity.id,
      importedParts: importOptions.map((option) => ({
        relationshipId: option.relationshipId,
        sourceEntityId: option.sourceEntityId,
        importedIdentifierId: option.importedIdentifierId,
        label: `${option.sourceEntityLabel} via ${option.relationshipLabel}: ${option.importedIdentifierLabel}`,
      })),
      attributes,
      selectedImportedPartKeys: importOptions
        .filter((option) => option.relationshipId === connectorContext.relationship.id)
        .map((option) => buildExternalImportPartKey(option)),
      selectedAttributeIds: [],
      error: attributes.length === 0 ? t("workspace.noEligibleLocalSimpleAttribute") : "",
    });
  }

  function submitMixedIdentifierDialog() {
    if (!mixedIdentifierDialog) {
      return;
    }

    if (mixedIdentifierDialog.selectedImportedPartKeys.length === 0) {
      setMixedIdentifierDialog({
        ...mixedIdentifierDialog,
        error: t("workspace.selectImportedPartForExternalIdentifier"),
      });
      return;
    }

    void createExternalIdentifierFromContext({
      mixed: true,
      localAttributeIds: mixedIdentifierDialog.selectedAttributeIds,
      importedPartKeys: mixedIdentifierDialog.selectedImportedPartKeys,
    });
    setMixedIdentifierDialog(null);
  }

  function formatIsaConstraintShort(isaCompleteness?: IsaCompleteness, isaDisjointness?: IsaDisjointness): string {
    if (!isaCompleteness || !isaDisjointness) {
      return "(?,?)";
    }
    return `(${isaCompleteness === "total" ? "t" : "p"},${isaDisjointness === "disjoint" ? "e" : "o"})`;
  }

  function getEntityLabel(diagram: DiagramDocument, nodeId: string): string {
    const node = diagram.nodes.find((candidate) => candidate.id === nodeId);
    return node?.label ?? nodeId;
  }

  function getCompatibleGeneralizationGroups(diagram: DiagramDocument, supertypeId: string): GeneralizationGroup[] {
    return (diagram.generalizationGroups ?? []).filter((group) => group.supertypeId === supertypeId);
  }

  function getSubtypeGroupConflict(
    diagram: DiagramDocument,
    supertypeId: string,
    subtypeId: string,
    allowedGroupId?: string,
  ): GeneralizationGroup | undefined {
    return getCompatibleGeneralizationGroups(diagram, supertypeId).find(
      (group) => group.id !== allowedGroupId && group.subtypeIds.includes(subtypeId),
    );
  }

  function openGeneralizationGroupDialog(
    edgeId: string,
    diagram: DiagramDocument = history.present,
    options: { createdEdgeWasTemporary?: boolean } = {},
  ) {
    const inheritanceEdge = edgeId
      ? diagram.edges.find((edge): edge is Extract<DiagramEdge, { type: "inheritance" }> => edge.id === edgeId && edge.type === "inheritance")
      : undefined;
    if (!inheritanceEdge) {
      return;
    }

    if (inheritanceEdge.generalizationGroupId) {
      openGeneralizationGroupEditDialog(inheritanceEdge.generalizationGroupId, inheritanceEdge.id, diagram);
      return;
    }

    const compatibleGroups = getCompatibleGeneralizationGroups(diagram, inheritanceEdge.targetId);
    setGeneralizationGroupDialog({
      kind: "assign",
      edgeId: inheritanceEdge.id,
      subtypeId: inheritanceEdge.sourceId,
      supertypeId: inheritanceEdge.targetId,
      mode: compatibleGroups.length > 0 ? "existing" : "new",
      selectedGroupId: compatibleGroups[0]?.id,
      newGroupName: "",
      isaCompleteness: "total",
      isaDisjointness: "disjoint",
      error: "",
      createdEdgeWasTemporary: options.createdEdgeWasTemporary === true,
    });
  }

  function openGeneralizationGroupEditDialog(groupId: string, edgeId?: string, diagram: DiagramDocument = history.present) {
    const group = (diagram.generalizationGroups ?? []).find((candidate) => candidate.id === groupId);
    if (!group) {
      if (edgeId) {
        openGeneralizationGroupDialog(edgeId, diagram);
      }
      return;
    }

    const firstSubtypeId = group.subtypeIds[0] ?? edgeId ?? group.supertypeId;
    setGeneralizationGroupDialog({
      kind: "edit",
      edgeId,
      groupId: group.id,
      subtypeId: firstSubtypeId,
      supertypeId: group.supertypeId,
      mode: "new",
      selectedGroupId: undefined,
      newGroupName: group.label ?? group.id,
      isaCompleteness: group.isaCompleteness ?? "partial",
      isaDisjointness: group.isaDisjointness ?? "disjoint",
      error: "",
      createdEdgeWasTemporary: false,
    });
  }

  function handleOpenInheritanceTypeControl(edgeId?: string) {
    const inheritanceEdge = edgeId
      ? history.present.edges.find((edge): edge is Extract<DiagramEdge, { type: "inheritance" }> => edge.id === edgeId && edge.type === "inheritance")
      : selectedEdge?.type === "inheritance"
        ? selectedEdge
        : undefined;
    if (!inheritanceEdge) {
      return;
    }

    openGeneralizationGroupDialog(inheritanceEdge.id);
  }

  function cancelGeneralizationGroupDialog() {
    const dialog = generalizationGroupDialog;
    setGeneralizationGroupDialog(null);
    if (dialog?.kind === "assign" && dialog.createdEdgeWasTemporary && dialog.edgeId) {
      const nextDiagram = removeSelection(history.present, { nodeIds: [], edgeIds: [dialog.edgeId] });
      commitDiagram(nextDiagram);
      setSelection({ nodeIds: [], edgeIds: [] });
      setStatus("Creazione gerarchia ISA annullata.");
    }
  }

  function submitGeneralizationGroupDialog() {
    if (!generalizationGroupDialog) {
      return;
    }

    const dialog = generalizationGroupDialog;
    const name = dialog.newGroupName.trim();
    if (dialog.kind === "edit") {
      if (!dialog.groupId) {
        setGeneralizationGroupDialog({ ...dialog, error: t("workspace.generalizationGroupDialog.errors.groupUnavailable") });
        return;
      }
      if (!name) {
        setGeneralizationGroupDialog({ ...dialog, error: t("workspace.generalizationGroupDialog.errors.groupNameRequired") });
        return;
      }
      const nextDiagram = updateGeneralizationGroupDetails(history.present, dialog.groupId, {
        label: name,
        isaCompleteness: dialog.isaCompleteness,
        isaDisjointness: dialog.isaDisjointness,
      });
      commitDiagram(nextDiagram);
      setGeneralizationGroupDialog(null);
      if (dialog.edgeId) {
        setSelection({ nodeIds: [], edgeIds: [dialog.edgeId] });
      }
      setStatus(t("workspace.generalizationGroupDialog.status.groupUpdated", { name }));
      return;
    }

    if (!dialog.edgeId) {
      setGeneralizationGroupDialog({ ...dialog, error: t("workspace.generalizationGroupDialog.errors.branchUnavailable") });
      return;
    }

    if (dialog.mode === "existing") {
      if (!dialog.selectedGroupId) {
        setGeneralizationGroupDialog({ ...dialog, error: t("workspace.generalizationGroupDialog.errors.selectGroup") });
        return;
      }
      const targetGroup = (history.present.generalizationGroups ?? []).find((group) => group.id === dialog.selectedGroupId);
      if (!targetGroup || targetGroup.supertypeId !== dialog.supertypeId) {
        setGeneralizationGroupDialog({ ...dialog, error: t("workspace.generalizationGroupDialog.errors.incompatibleGroup") });
        return;
      }
      if (targetGroup.subtypeIds.includes(dialog.subtypeId)) {
        setGeneralizationGroupDialog({ ...dialog, error: t("workspace.generalizationGroupDialog.errors.subtypeAlreadyInSelectedGroup") });
        return;
      }
      const conflict = getSubtypeGroupConflict(history.present, dialog.supertypeId, dialog.subtypeId, targetGroup.id);
      if (conflict) {
        setGeneralizationGroupDialog({
          ...dialog,
          error: t("workspace.generalizationGroupDialog.errors.subtypeAlreadyInGroup", { group: conflict.label ?? conflict.id }),
        });
        return;
      }
      const nextDiagram = assignInheritanceEdgeToGeneralizationGroup(history.present, dialog.edgeId, targetGroup.id);
      commitDiagram(nextDiagram);
      setGeneralizationGroupDialog(null);
      setSelection({ nodeIds: [], edgeIds: [dialog.edgeId] });
      setStatus(t("workspace.generalizationGroupDialog.status.subtypeAdded", {
        subtype: getEntityLabel(history.present, dialog.subtypeId),
        group: targetGroup.label ?? targetGroup.id,
      }));
      return;
    }

    if (!name) {
      setGeneralizationGroupDialog({ ...dialog, error: t("workspace.generalizationGroupDialog.errors.groupNameRequired") });
      return;
    }
    const conflict = getSubtypeGroupConflict(history.present, dialog.supertypeId, dialog.subtypeId);
    if (conflict) {
      setGeneralizationGroupDialog({
        ...dialog,
        error: t("workspace.generalizationGroupDialog.errors.subtypeAlreadyInGroup", { group: conflict.label ?? conflict.id }),
      });
      return;
    }
    const nextDiagram = createGeneralizationGroupForInheritanceEdge(
      history.present,
      dialog.edgeId,
      name,
      dialog.isaCompleteness,
      dialog.isaDisjointness,
    );
    commitDiagram(nextDiagram);
    setGeneralizationGroupDialog(null);
    setSelection({ nodeIds: [], edgeIds: [dialog.edgeId] });
    setStatus(t("workspace.generalizationGroupDialog.status.groupCreated", { name }));
  }

  function handleCreateAttributeFromSelection() {
    if (selection.nodeIds.length !== 1 || selection.edgeIds.length > 0) {
      setStatusWarning(t("workspace.selectValidAttributeHost"), {
        title: t("workspace.noticeTitles.attributeNotApplicable"),
      });
      return;
    }

    const hostNode = history.present.nodes.find((node) => node.id === selection.nodeIds[0]);
    if (!hostNode || (hostNode.type !== "entity" && hostNode.type !== "relationship" && hostNode.type !== "attribute")) {
      setStatusWarning(t("workspace.selectValidAttributeHost"), {
        title: t("workspace.noticeTitles.attributeNotApplicable"),
      });
      return;
    }

    if (hostNode.type === "attribute" && !canAttributeBecomeComposite(history.present, hostNode)) {
      setStatusError(
        buildStructuredErrorMessage(
          t("workspace.errors.attributeNotCreated"),
          t("workspace.errors.attributeAlreadyCompositeChild", { attribute: hostNode.label }),
          t("workspace.errors.selectCompositeRoot"),
        ),
        { title: t("workspace.noticeTitles.subattributeNotAllowed") },
      );
      return;
    }

    const draftAttribute = createNode("attribute", { x: 0, y: 0 }, history.present) as Extract<
      DiagramNode,
      { type: "attribute" }
    >;
    const nextAttribute = {
      ...draftAttribute,
      ...getNextAttributePosition(history.present, hostNode, draftAttribute),
    };
    const nextEdge = createEdge("attribute", nextAttribute.id, hostNode.id, history.present);
    const nextDiagramBase: DiagramDocument = {
      ...history.present,
      nodes: [...history.present.nodes, nextAttribute],
      edges: [...history.present.edges, nextEdge],
    };
    const nextDiagramWithHostResize =
      hostNode.type === "attribute"
        ? (() => {
            const nextSize = getMultivaluedAttributeSize(hostNode.label);
            return updateNodeInDiagram(nextDiagramBase, hostNode.id, {
              isMultivalued: true,
              width: nextSize.width,
              height: nextSize.height,
            } as Partial<DiagramNode>);
          })()
        : nextDiagramBase;
    const layoutHost = nextDiagramWithHostResize.nodes.find(
      (node): node is AttributeCreationHost =>
        node.id === hostNode.id && (node.type === "entity" || node.type === "relationship" || node.type === "attribute"),
    );
    const nextDiagram = layoutHost
      ? layoutDirectAttributesAroundHost(
          nextDiagramWithHostResize,
          layoutHost,
          findDirectHostedAttributes(nextDiagramWithHostResize, layoutHost.id).map((attribute) => attribute.id),
        )
      : nextDiagramWithHostResize;

    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [hostNode.id], edgeIds: [] });
    setTool("select");
    setStatus(t("workspace.attributeLinkedToHost", { host: hostNode.label }));
  }

  function handleEntityInternalIdentifiersChange(
    entityId: string,
    patch: Partial<EntityNode>,
    attributePatches: Record<string, Partial<AttributeNode>>,
  ) {
    const entityNode = history.present.nodes.find(
      (node): node is EntityNode => node.id === entityId && node.type === "entity",
    );
    if (!entityNode) {
      return;
    }

    const hasEntityPatch = Object.keys(patch).length > 0;
    const attributePatchIds = Object.keys(attributePatches);
    if (!hasEntityPatch && attributePatchIds.length === 0) {
      return;
    }

    const nextDiagram: DiagramDocument = {
      ...history.present,
      nodes: history.present.nodes.map((node) => {
        if (node.id === entityId && node.type === "entity") {
          return {
            ...node,
            ...patch,
          };
        }

        if (node.type !== "attribute") {
          return node;
        }

        const attributePatch = attributePatches[node.id];
        if (!attributePatch) {
          return node;
        }

        return {
          ...node,
          ...attributePatch,
        };
      }),
    };

    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [entityId], edgeIds: [] });
    setStatus("Identificatori interni aggiornati.");
  }

  function handleEntityExternalIdentifiersChange(entityId: string, patch: Partial<EntityNode>) {
    const entityNode = history.present.nodes.find(
      (node): node is EntityNode => node.id === entityId && node.type === "entity",
    );
    if (!entityNode) {
      return;
    }

    if (Object.keys(patch).length === 0) {
      return;
    }

    const nextExternalIdentifiers = Array.isArray(patch.externalIdentifiers)
      ? patch.externalIdentifiers
      : entityNode.externalIdentifiers;

    const externalIdentifierAttributeIds = new Set(
      (nextExternalIdentifiers ?? []).flatMap((identifier) => identifier.localAttributeIds),
    );

    const nextDiagram: DiagramDocument = {
      ...history.present,
      nodes: history.present.nodes.map((node) =>
        node.id === entityId && node.type === "entity"
          ? {
              ...node,
              ...patch,
            }
          : node.type === "attribute" && externalIdentifierAttributeIds.has(node.id)
            ? {
                ...node,
                cardinality: undefined,
              }
          : node,
      ),
    };

    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [entityId], edgeIds: [] });
    setStatus("Identificatori esterni aggiornati.");
  }

  function handleNodeChange(nodeId: string, patch: Partial<DiagramNode>) {
    let workingDiagram = history.present;
    let workingNodeId = nodeId;
    let workingPatch: Partial<DiagramNode> = patch;
    let nodeRenameResize: { nodeId: string; center: Point } | null = null;

    if (typeof patch.label === "string") {
      const currentNode = history.present.nodes.find((node) => node.id === nodeId);
      if (!currentNode) {
        return;
      }

      const renameValidation = validateNodeNameInNamespace({
        diagram: history.present,
        nodeType: currentNode.type,
        candidateName: patch.label,
        nodeId,
      });
      if (!renameValidation.valid) {
        if (currentNode.type === "attribute") {
          setStatusError(
            buildStructuredErrorMessage(
              "la rinomina dell'attributo non e stata applicata",
              "esiste gia un attributo con lo stesso nome nello stesso owner semantico",
              "scegli un nome diverso oppure rinomina l'attributo esistente",
            ),
          );
        } else if (currentNode.type === "entity") {
          setStatusError(
            buildStructuredErrorMessage(
              "la rinomina dell'entita non e stata applicata",
              "esiste gia un'entita con lo stesso nome",
              "scegli un nome entita univoco nel diagramma",
            ),
          );
        } else {
          setStatusError(
            buildStructuredErrorMessage(
              "la rinomina della relazione non e stata applicata",
              "esiste gia una relazione con lo stesso nome",
              "scegli un nome relazione univoco tra le relazioni",
            ),
          );
        }

        return;
      }

      if (currentNode.type === "entity" || currentNode.type === "relationship") {
        nodeRenameResize = {
          nodeId,
          center: {
            x: currentNode.x + currentNode.width / 2,
            y: currentNode.y + currentNode.height / 2,
          },
        };
      }

      const identityRenamed = renameNodeAsNameIdentity(history.present, nodeId, patch.label);
      workingDiagram = identityRenamed.diagram;
      workingNodeId = identityRenamed.nodeIdMap.get(nodeId) ?? nodeId;
      if (nodeRenameResize) {
        nodeRenameResize = {
          ...nodeRenameResize,
          nodeId: workingNodeId,
        };
      }
      if (identityRenamed.nodeIdMap.size > 0) {
        setSelection((currentSelection) => ({
          nodeIds: Array.from(
            new Set(
              currentSelection.nodeIds.map(
                (selectedNodeId) => identityRenamed.nodeIdMap.get(selectedNodeId) ?? selectedNodeId,
              ),
            ),
          ),
          edgeIds: currentSelection.edgeIds,
        }));
      }

      const patchWithoutLabel = {
        ...patch,
      } as Partial<DiagramNode> & { label?: string };
      delete patchWithoutLabel.label;
      workingPatch = patchWithoutLabel;
    }

    const currentNode = workingDiagram.nodes.find((node) => node.id === workingNodeId);
    const attributePatch = workingPatch as Partial<Extract<DiagramNode, { type: "attribute" }>>;
    let normalizedAttributePatch = attributePatch;

    const attributeLinkedToRelationship =
      currentNode?.type === "attribute" &&
      workingDiagram.edges.some((edge) => {
        if (edge.type !== "attribute") {
          return false;
        }

        const isLinked = edge.sourceId === currentNode.id || edge.targetId === currentNode.id;
        if (!isLinked) {
          return false;
        }

        const hostId = edge.sourceId === currentNode.id ? edge.targetId : edge.sourceId;
        const hostNode = workingDiagram.nodes.find((node) => node.id === hostId);
        return hostNode?.type === "relationship";
      });

    if (
      currentNode?.type === "attribute" &&
      attributeLinkedToRelationship &&
      (attributePatch.isIdentifier === true || attributePatch.isCompositeInternal === true)
    ) {
      setStatusError(
        buildStructuredErrorMessage(
          "la modifica dell'attributo non e stata applicata",
          "un attributo collegato a un'associazione non puo diventare identificatore",
          "rimuovi il collegamento con l'associazione o disattiva il flag identificatore",
        ),
      );
      return;
    }

    if (currentNode?.type === "attribute") {
      if (Object.prototype.hasOwnProperty.call(attributePatch, "cardinality")) {
        const normalizedCardinality = normalizeSupportedCardinality(attributePatch.cardinality);
        if (normalizedCardinality !== undefined && !canAttributeHaveCardinality(workingDiagram, currentNode)) {
          setStatusWarning("La cardinalita non e assegnabile ad attributi usati come identificatori.");
          return;
        }

        normalizedAttributePatch = {
          ...normalizedAttributePatch,
          cardinality: normalizedCardinality,
        };
      }

      if (attributePatch.isIdentifier === true) {
        normalizedAttributePatch = {
          ...normalizedAttributePatch,
          isCompositeInternal: false,
          isMultivalued: false,
          cardinality: undefined,
        };
      }

      if (attributePatch.isCompositeInternal === true) {
        normalizedAttributePatch = {
          ...normalizedAttributePatch,
          isIdentifier: false,
          isMultivalued: false,
          cardinality: undefined,
        };
      }

      if (attributePatch.isMultivalued === true) {
        if (!canAttributeBecomeComposite(workingDiagram, currentNode)) {
          setStatusError(
            buildStructuredErrorMessage(
              "la modifica dell'attributo non e stata applicata",
              `l'attributo "${currentNode.label}" appartiene gia a un attributo composto e non puo diventare composto`,
              "usa come composto solo attributi collegati direttamente a entita o relazioni",
            ),
          );
          return;
        }

        normalizedAttributePatch = {
          ...normalizedAttributePatch,
          isIdentifier: false,
          isCompositeInternal: false,
        };
      }

      const attributeWillBeInternalIdentifier =
        normalizedAttributePatch.isIdentifier === true ||
        normalizedAttributePatch.isCompositeInternal === true ||
        ((currentNode.isIdentifier === true || currentNode.isCompositeInternal === true) &&
          normalizedAttributePatch.isIdentifier !== false &&
          normalizedAttributePatch.isCompositeInternal !== false);

      if (attributeWillBeInternalIdentifier && normalizedAttributePatch.cardinality !== undefined) {
        setStatusWarning(
          "La cardinalita dell'attributo viene rimossa perche gli identificatori interni non possono definirla.",
        );
        normalizedAttributePatch = {
          ...normalizedAttributePatch,
          cardinality: undefined,
        };
      }
    }

    const attributeWillBeMultivalued =
      currentNode?.type === "attribute" &&
      (normalizedAttributePatch.isMultivalued === true ||
        (currentNode.isMultivalued === true && normalizedAttributePatch.isMultivalued !== false));
    const nextMultivaluedSize =
      currentNode?.type === "attribute" && attributeWillBeMultivalued
        ? getMultivaluedAttributeSize(currentNode.label)
        : null;

    const nextPatch =
      currentNode?.type === "attribute" && attributeWillBeMultivalued && nextMultivaluedSize
        ? {
            ...workingPatch,
            ...normalizedAttributePatch,
            width: nextMultivaluedSize.width,
            height: nextMultivaluedSize.height,
          }
        : currentNode?.type === "attribute" &&
            normalizedAttributePatch.isMultivalued === false &&
            currentNode.isMultivalued === true
          ? {
              ...workingPatch,
              ...normalizedAttributePatch,
              width: DEFAULT_ATTRIBUTE_SIZE.width,
              height: DEFAULT_ATTRIBUTE_SIZE.height,
            }
        : currentNode?.type === "attribute"
          ? {
              ...workingPatch,
              ...normalizedAttributePatch,
            }
          : workingPatch;

    let nextDiagram = updateNodeInDiagram(workingDiagram, workingNodeId, nextPatch);
    if (nodeRenameResize) {
      nextDiagram = {
        ...nextDiagram,
        nodes: nextDiagram.nodes.map((node) =>
          node.id === nodeRenameResize.nodeId && (node.type === "entity" || node.type === "relationship")
            ? withPreferredNodeSizeForLabel(node, nodeRenameResize.center)
            : node,
        ),
      };
    }

    if (
      currentNode?.type === "attribute" &&
      normalizedAttributePatch.isMultivalued === false &&
      currentNode.isMultivalued === true
    ) {
      const subAttributeIds = workingDiagram.edges
        .filter(
          (edge) => edge.type === "attribute" && (edge.sourceId === workingNodeId || edge.targetId === workingNodeId),
        )
        .map((edge) => (edge.sourceId === workingNodeId ? edge.targetId : edge.sourceId))
        .filter((connectedId) => {
          const connectedNode = workingDiagram.nodes.find((n) => n.id === connectedId);
          return connectedNode?.type === "attribute";
        });

      if (subAttributeIds.length > 0) {
        nextDiagram = removeSelection(nextDiagram, { nodeIds: subAttributeIds, edgeIds: [] });
      }
    }

    if (
      currentNode?.type === "attribute" &&
      attributeWillBeMultivalued &&
      normalizedAttributePatch.isMultivalued !== false
    ) {
      const layoutHost = nextDiagram.nodes.find(
        (node): node is AttributeNode => node.id === workingNodeId && node.type === "attribute",
      );
      if (layoutHost?.isMultivalued === true) {
        nextDiagram = layoutDirectAttributesAroundHost(
          nextDiagram,
          layoutHost,
          findDirectHostedAttributes(nextDiagram, layoutHost.id).map((attribute) => attribute.id),
        );
      }
    }

    commitDiagram(nextDiagram);
  }

  function handleNodesChange(nodeIds: string[], patch: Partial<DiagramNode>) {
    if (nodeIds.length === 0) {
      return;
    }

    const attributePatch = patch as Partial<Extract<DiagramNode, { type: "attribute" }>>;
    const wantsIdentifierMode = attributePatch.isIdentifier === true || attributePatch.isCompositeInternal === true;

    let targetIds = nodeIds;
    if (Object.prototype.hasOwnProperty.call(attributePatch, "cardinality")) {
      const normalizedCardinality = normalizeSupportedCardinality(attributePatch.cardinality);
      if (normalizedCardinality !== undefined) {
        targetIds = targetIds.filter((nodeId) => {
          const node = history.present.nodes.find((item) => item.id === nodeId);
          return node?.type !== "attribute" || canAttributeHaveCardinality(history.present, node);
        });

        if (targetIds.length !== nodeIds.length) {
          setStatusWarning("La cardinalita non e stata applicata agli attributi usati come identificatori.");
        }
      }
    }

    if (wantsIdentifierMode) {
      targetIds = targetIds.filter((nodeId) => {
        const node = history.present.nodes.find((item) => item.id === nodeId);
        if (node?.type !== "attribute") {
          return true;
        }

        const linkedToRelationship = history.present.edges.some((edge) => {
          if (edge.type !== "attribute") {
            return false;
          }

          const isLinked = edge.sourceId === node.id || edge.targetId === node.id;
          if (!isLinked) {
            return false;
          }

          const hostId = edge.sourceId === node.id ? edge.targetId : edge.sourceId;
          const hostNode = history.present.nodes.find((candidate) => candidate.id === hostId);
          return hostNode?.type === "relationship";
        });

        return !linkedToRelationship && node.isMultivalued !== true;
      });

      if (targetIds.length !== nodeIds.length) {
        setStatusError(
          buildStructuredErrorMessage(
            "la modifica degli attributi non e stata applicata a tutta la selezione",
            "alcuni attributi sono composti o collegati a un'associazione e non possono essere identificatori",
            "lascia come identificatori solo attributi semplici collegati a entita",
          ),
        );
      }
    }

    if (attributePatch.isMultivalued === true) {
      targetIds = targetIds.filter((nodeId) => {
        const node = history.present.nodes.find((item) => item.id === nodeId);
        return (
          node?.type !== "attribute" ||
          (
            node.isIdentifier !== true &&
            node.isCompositeInternal !== true &&
            canAttributeBecomeComposite(history.present, node)
          )
        );
      });

      if (targetIds.length !== nodeIds.length) {
        setStatusError(
          buildStructuredErrorMessage(
            "la modifica degli attributi non e stata applicata a tutta la selezione",
            "un attributo usato come identificatore o figlio di un composto non puo diventare composto",
            "usa come composti solo attributi semplici collegati direttamente a entita o relazioni",
          ),
        );
      }
    }

    if (targetIds.length === 0) {
      return;
    }

    const nextDiagram = updateNodesInDiagram(history.present, targetIds, patch);
    commitDiagram(nextDiagram);
  }

  function handleEdgeChange(edgeId: string, patch: Partial<DiagramEdge>) {
    const edge = history.present.edges.find((candidate) => candidate.id === edgeId);
    let nextDiagram: DiagramDocument;

    if (
      edge?.type === "inheritance" &&
      "isaCompleteness" in patch &&
      "isaDisjointness" in patch &&
      patch.isaCompleteness &&
      patch.isaDisjointness
    ) {
      if (edge.generalizationGroupId) {
        nextDiagram = updateGeneralizationGroupConstraint(
          history.present,
          edge.generalizationGroupId,
          patch.isaCompleteness,
          patch.isaDisjointness,
        );
      } else {
        nextDiagram = assignInheritanceConstraintToGroup(
          history.present,
          edge.id,
          patch.isaCompleteness,
          patch.isaDisjointness,
        );
      }
    } else {
      nextDiagram = updateEdgeInDiagram(history.present, edgeId, patch);
    }

    commitDiagram(nextDiagram);
  }

  function handleRenameNode(nodeId: string, label: string) {
    handleNodeChange(nodeId, { label });
  }

  function handleRenameEdge(edgeId: string, label: string) {
    const nextDiagram = updateEdgeTextInDiagram(history.present, edgeId, label);
    commitDiagram(nextDiagram);
  }

  async function handleRenameSelectionQuick() {
    if (selectedNode) {
      const nextLabel = await requestPromptDialog({
        title: "Rinomina elemento",
        label: "Nuovo nome elemento",
        initialValue: selectedNode.label,
        required: true,
        requiredMessage: "Il nome elemento non puo essere vuoto.",
      });
      if (nextLabel == null) {
        return;
      }

      if (nextLabel === selectedNode.label) {
        return;
      }

      handleRenameNode(selectedNode.id, nextLabel);
      setStatus("Elemento rinominato.");
      return;
    }

    if (!selectedEdge) {
      return;
    }

    if (selectedEdge.type === "connector") {
      setStatusWarning(
        t("workspace.connectorCardinalityEditedOnEntity"),
      );
      return;
    }

    if (selectedEdge.type === "attribute") {
      setStatusWarning(
        t("workspace.attributeCardinalityEditedOnAttribute"),
      );
      return;
    }

    const nextValue = await requestPromptDialog({
      title: t("dialogs.prompt.updateEdgeTitle"),
      label: t("dialogs.prompt.updateEdgeLabel"),
      initialValue: selectedEdge.label,
      required: false,
      requiredMessage: "",
    });
    if (nextValue == null) {
      return;
    }

    if (nextValue === selectedEdge.label.trim()) {
      return;
    }

    handleRenameEdge(selectedEdge.id, nextValue);
    setStatus(t("workspace.edgeUpdated"));
  }

  function handleDeleteSelection() {
    if (selection.nodeIds.length === 0 && selection.edgeIds.length === 0) {
      return;
    }

    const nextDiagram = removeSelection(history.present, selection);
    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [], edgeIds: [] });
    setStatus("Selezione eliminata.");
  }

  function handleRemoveSelectedEntityFromHierarchy() {
    if (!selectedNode || selectedNode.type !== "entity") {
      showWarningNotice(t("workspace.entityNotInHierarchy"));
      return;
    }

    if (!isEntityInGeneralizationGroup(history.present, selectedNode.id)) {
      showWarningNotice(t("workspace.entityNotInHierarchy"));
      return;
    }

    const nextDiagram = removeEntityFromGeneralizationHierarchy(history.present, selectedNode.id);
    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [selectedNode.id], edgeIds: [] });
    setTool("select");
    setStatus(t("workspace.entityRemovedFromHierarchy"));
  }

  function handleDeleteNodeById(nodeId: string) {
    const nextDiagram = removeSelection(history.present, { nodeIds: [nodeId], edgeIds: [] });
    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [], edgeIds: [] });
    setStatus("Elemento eliminato.");
  }

  function handleDeleteEdgeById(edgeId: string) {
    const nextDiagram = removeSelection(history.present, { nodeIds: [], edgeIds: [edgeId] });
    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [], edgeIds: [] });
    setStatus(t("workspace.edgeDeleted"));
  }

  function handleDeleteExternalIdentifier(hostEntityId: string, externalIdentifierId: string) {
    const hostEntity = history.present.nodes.find(
      (node): node is EntityNode => node.id === hostEntityId && node.type === "entity",
    );
    if (!hostEntity || !(hostEntity.externalIdentifiers ?? []).some((identifier) => identifier.id === externalIdentifierId)) {
      setStatusWarning(t("workspace.noExternalIdentifierToRemove"));
      return;
    }

    const nextDiagram = removeExternalIdentifierFromEntity(history.present, hostEntityId, externalIdentifierId);
    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [hostEntityId], edgeIds: [] });
    setIdentifierSelection(null);
    setStatus(t("workspace.externalIdentifierRemoved"));
  }

  function handleDeleteIdentifierSelection() {
    if (!identifierSelection) {
      setStatusWarning(t("workspace.noIdentifierSelected"));
      return;
    }

    if (identifierSelection.kind === "external") {
      handleDeleteExternalIdentifier(
        identifierSelection.hostEntityId,
        identifierSelection.externalIdentifierId,
      );
      setIdentifierSelection(null);
      return;
    }

    const hostEntity = history.present.nodes.find(
      (node): node is EntityNode =>
        node.id === identifierSelection.hostEntityId &&
        node.type === "entity",
    );
    if (
      !hostEntity ||
      !(hostEntity.internalIdentifiers ?? []).some(
        (identifier) => identifier.id === identifierSelection.internalIdentifierId,
      )
    ) {
      setStatusWarning(t("workspace.noIdentifierSelected"));
      setIdentifierSelection(null);
      return;
    }

    const nextDiagram = removeInternalIdentifierFromEntity(
      history.present,
      identifierSelection.hostEntityId,
      identifierSelection.internalIdentifierId,
    );

    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [identifierSelection.hostEntityId], edgeIds: [] });
    setIdentifierSelection(null);
    setTool("select");
    setStatus(t("workspace.internalIdentifierRemoved"));
  }

  function handleRemoveSelectedExternalIdentifier() {
    if (selectedNode?.type !== "entity") {
      setStatusWarning(t("workspace.selectEntityWithExternalIdentifier"));
      return;
    }

    const externalIdentifier = selectedNode.externalIdentifiers?.[0];
    if (!externalIdentifier) {
      setStatusWarning(t("workspace.noExternalIdentifierToRemove"));
      return;
    }

    handleDeleteExternalIdentifier(selectedNode.id, externalIdentifier.id);
  }

  async function writeDiagramPayloadToSystemClipboard(payload: DiagramClipboardPayload) {
    if (!navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(serializeDiagramClipboardPayload(payload));
    } catch {
      showWarningNotice(t("workspace.selectionCopiedClipboardUnavailable"));
    }
  }

  async function readDiagramPayloadFromSystemClipboard(): Promise<DiagramClipboardPayload | null> {
    if (!navigator.clipboard?.readText) {
      return null;
    }

    try {
      const rawClipboard = await navigator.clipboard.readText();
      return parseDiagramClipboardPayload(rawClipboard);
    } catch {
      return null;
    }
  }

  function handleCopySelection() {
    if (diagramView !== "er") {
      setStatusWarning(t("workspace.copyAvailableInErView"));
      return;
    }

    const payload = createDiagramClipboardPayload(history.present, selection);
    if (!payload) {
      setStatusWarning(t("workspace.selectErElementToCopy"));
      return;
    }

    diagramClipboardRef.current = payload;
    pasteOffsetStepRef.current = 0;
    setHasDiagramClipboard(true);
    void writeDiagramPayloadToSystemClipboard(payload);
    setStatus(t("workspace.selectionCopied"));
    payload.warnings?.forEach((warning) => showWarningNotice(warning));
  }

  async function handlePasteSelection() {
    if (diagramView !== "er") {
      setStatusWarning(t("workspace.pasteAvailableInErView"));
      return;
    }
    if (mode !== "edit") {
      setStatusWarning(t("workspace.pasteAvailableInEditMode"));
      return;
    }

    const payload = diagramClipboardRef.current ?? (await readDiagramPayloadFromSystemClipboard());
    if (!payload) {
      setStatusWarning(t("workspace.clipboardNoPasteableElements"));
      return;
    }

    if (!diagramClipboardRef.current) {
      diagramClipboardRef.current = payload;
      setHasDiagramClipboard(true);
    }

    const offset = GRID_SIZE * 2 * (pasteOffsetStepRef.current + 1);
    const pasted = pasteDiagramClipboardPayload(history.present, payload, { offset });
    if (!pasted) {
      setStatusWarning(t("workspace.clipboardNoPasteableElements"));
      return;
    }

    pasteOffsetStepRef.current = (pasteOffsetStepRef.current + 1) % 8;
    commitDiagram(pasted.diagram);
    setSelection(pasted.selection);
    setTool("select");
    setStatus(t("workspace.selectionPasted"));
  }

  function handleDuplicateSelection() {
    if (diagramView !== "er") {
      setStatusWarning(t("workspace.duplicateAvailableInErView"));
      return;
    }
    if (mode !== "edit") {
      setStatusWarning(t("workspace.duplicateAvailableInEditMode"));
      return;
    }

    const duplicated = duplicateSelection(history.present, selection);
    if (!duplicated) {
      setStatusWarning(t("workspace.selectErElementToDuplicate"));
      return;
    }

    commitDiagram(duplicated.diagram);
    setSelection(duplicated.selection);
    setTool("select");
    setStatus(t("workspace.selectionDuplicated"));
  }

  function handleAlignSelection(axis: "left" | "center" | "top" | "middle") {
    if (selection.nodeIds.length < 2) {
      setStatusWarning(t("workspace.alignNeedTwo"));
      return;
    }

    const nextDiagram = alignNodes(history.present, selection.nodeIds, axis);
    if (nextDiagram === history.present) {
      setStatusWarning(t("workspace.alreadyAligned"));
      return;
    }

    commitDiagram(nextDiagram);
    setStatus(t("workspace.alignmentApplied"));
  }

  function handleSaveProject() {
    try {
      const serializedProject = serializeProjectFile({
        diagram: history.present,
        translationWorkspace: translationHistory.present,
        logicalWorkspace: logicalHistory.present,
        logicalGenerated,
        logicalStage,
        diagramView,
        viewport,
        translationViewport,
        logicalViewport,
        versioning: projectVersioning.versioning,
        workspace: currentProjectWorkspaceState,
      });
      downloadTextFile(
        serializedProject,
        `${sanitizeFileNameBase(history.present.meta.name)}${PROJECT_FILE_EXTENSION}`,
        PROJECT_FILE_MIME_TYPE,
      );
      markDiagramSaved(history.present);
      markCodeSaved(codeDirtyRef.current ? codeDraftRef.current : serializeDiagramToErs(history.present));
      markVersioningSaved();
      markWorkspaceSaved(currentProjectWorkspaceState);
      hasUnsavedChangesRef.current = false;
      setStatus(t("workspace.projectSaved"));
      showSuccessNotice(t("workspace.downloads.projectDownloaded"), { title: t("workspace.noticeTitles.downloadCompleted") });
    } catch (error) {
      console.error(error);
      setStatusError(formatProjectFileErrorMessage(error));
    }
  }

  function handleSaveErs() {
    const source = codeDirtyRef.current ? codeDraftRef.current : serializeDiagramToErs(history.present);
    downloadTextFile(source, `${sanitizeFileNameBase(history.present.meta.name)}.ers`);
    markCodeSaved(source);
    if (!codeDirtyRef.current && !codeError) {
      markDiagramSaved(history.present);
    }
    setStatus(codeDirtyRef.current ? t("workspace.ersDraftDownloaded") : t("workspace.ersDownloaded"));
    showSuccessNotice(codeDirtyRef.current ? t("workspace.downloads.ersDraftDownloaded") : t("workspace.downloads.ersDownloaded"), {
      title: t("workspace.noticeTitles.downloadCompleted"),
    });
  }

  function handleSaveRestructuredErs() {
    const source = serializeDiagramToErs(translationHistory.present.translatedDiagram);
    downloadTextFile(source, `${sanitizeFileNameBase(history.present.meta.name)}-restructured.ers`);
    setStatus(t("workspace.restructuredErsDownloaded"));
    showSuccessNotice(t("workspace.downloads.restructuredErsDownloaded"), { title: t("workspace.noticeTitles.downloadCompleted") });
  }

  function handleSaveLogicalSql() {
    if (logicalHistory.present.model.tables.length === 0) {
      setStatusWarning(t("logical.designer.noSql"));
      return;
    }

    downloadTextFile(
      generateLogicalSql(logicalHistory.present.model),
      `${sanitizeFileNameBase(history.present.meta.name)}.sql`,
      "text/sql;charset=utf-8",
    );
    setStatus(t("workspace.sqlDownloaded"));
    showSuccessNotice(t("workspace.downloads.sqlDownloaded"), { title: t("workspace.noticeTitles.downloadCompleted") });
  }

  async function handleCreateProjectCommit(message: string, description?: string) {
    if (!versioningChangeState.summary.canCommit) {
      setCommitDialogError(
        versioningChangeState.status === "no-head-empty"
          ? t("versioning.emptyProject")
          : t("versioning.noChangesToCommit"),
      );
      return false;
    }

    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setCommitDialogError(t("versioning.messageRequired"));
      return false;
    }

    setCommitDialogBusy(true);
    setCommitDialogError("");

    try {
      const result = await projectVersioning.createCommit({
        snapshot: currentProjectCommitSnapshot,
        message: trimmedMessage,
        description,
      });

      if (result.status === "empty-message") {
        setCommitDialogError(t("versioning.messageRequired"));
        return false;
      }

      if (result.status === "unchanged") {
        setCommitDialogError(t("versioning.noChangesToCommit"));
        showWarningNotice(t("versioning.noChangesToCommit"), { title: t("versioning.commit") });
        return false;
      }

      setCommitDialogOpen(false);
      setCommitDialogError("");
      setVersioningPanelOpen(true);
      setStatus(t("versioning.commitCreated"));
      showSuccessNotice(t("versioning.commitCreated"), { title: t("versioning.commit") });
      return true;
    } catch (error) {
      console.error(error);
      setCommitDialogError(t("versioning.commitFailed"));
      showErrorNotice(t("versioning.commitFailed"), { title: t("versioning.commit") });
      return false;
    } finally {
      setCommitDialogBusy(false);
    }
  }

  function handleMissingDiffCommit(commitId: string) {
    const message = t("versioning.diff.commitNotFound", { commitId });
    setStatusError(message);
    showErrorNotice(message, { title: t("versioning.diff.title") });
  }

  function handleCompareCommitWithCurrent(commitId: string) {
    if (!projectVersioning.getCommitById(commitId)) {
      handleMissingDiffCommit(commitId);
      return;
    }

    setVersioningPanelOpen(false);
    setVersionCompareSession({
      left: { kind: "commit", commitId },
      right: { kind: "working-copy" },
    });
  }

  function handleCompareCommitWithHead(commitId: string) {
    const headCommitId = projectVersioning.versioning.headCommitId;
    if (!headCommitId) {
      handleMissingDiffCommit(commitId);
      return;
    }

    if (!projectVersioning.getCommitById(commitId)) {
      handleMissingDiffCommit(commitId);
      return;
    }

    if (!projectVersioning.getCommitById(headCommitId)) {
      handleMissingDiffCommit(headCommitId);
      return;
    }

    setVersioningPanelOpen(false);
    setVersionCompareSession({
      left: { kind: "commit", commitId },
      right: { kind: "head" },
    });
  }

  function handleOpenRestoreCommit(commitId: string) {
    setRestoreCommitId(commitId);
    setRestoreDialogError("");
  }

  function handleCloseRestoreDialog() {
    if (restoreDialogBusy) {
      return;
    }

    setRestoreCommitId(null);
    setRestoreDialogError("");
  }

  async function handleConfirmRestoreCommit() {
    if (!restoreCommitId) {
      return;
    }

    setRestoreDialogBusy(true);
    setRestoreDialogError("");

    try {
      const result = await projectVersioning.restoreCommit(restoreCommitId, currentProjectCommitSnapshot, {
        backupMessage: t("versioning.restore.backupMessage"),
        backupDescription: t("versioning.restore.backupDescription", { commitId: restoreCommitId.slice(0, 8) }),
        restoreMessage: t("versioning.restore.restoreMessage", {
          message: projectVersioning.getCommitById(restoreCommitId)?.message ?? restoreCommitId.slice(0, 8),
        }),
        restoreDescription: t("versioning.restore.restoreDescription", { commitId: restoreCommitId.slice(0, 8) }),
      });

      if (result.status === "missing-commit") {
        const message = t("versioning.restore.commitNotFound");
        setRestoreDialogError(message);
        setStatusError(message);
        showErrorNotice(message, { title: t("versioning.restore.title") });
        return;
      }

      if (result.status === "already-current") {
        const message = t("versioning.restore.alreadyCurrentNotice");
        setRestoreDialogError(message);
        setStatusWarning(message);
        showWarningNotice(message, { title: t("versioning.restore.title") });
        return;
      }

      if (result.status === "invalid-snapshot") {
        const message = t("versioning.restore.failed");
        setRestoreDialogError(message);
        setStatusError(message);
        showErrorNotice(message, { title: t("versioning.restore.title") });
        return;
      }

      const restoreSnapshot = result.restoreCommit.snapshot;
      applyWorkspaceDocument(restoreSnapshot.diagram, t("versioning.restore.restored"), {
        translationWorkspace: restoreSnapshot.translationWorkspace,
        logicalWorkspace: restoreSnapshot.logicalWorkspace,
        logicalGenerated: restoreSnapshot.logicalGenerated,
        logicalStage: restoreSnapshot.logicalStage,
        diagramView: restoreSnapshot.diagramView,
        viewport: restoreSnapshot.viewport,
        translationViewport: restoreSnapshot.translationViewport,
        logicalViewport: restoreSnapshot.logicalViewport,
        versioning: result.versioning,
        workspace: createWorkspaceStateFromProjectCommitSnapshot(restoreSnapshot),
        resetHistory: true,
        markBaseline: false,
      });

      setRestoreCommitId(null);
      setRestoreDialogError("");
      setVersionCompareSession(null);
      setVersioningPanelOpen(true);
      setStatus(t("versioning.restore.restored"));
      showSuccessNotice(t("versioning.restore.restoredWithBackup"), {
        title: t("versioning.restore.title"),
      });
    } catch (error) {
      console.error(error);
      const message = t("versioning.restore.failed");
      setRestoreDialogError(message);
      setStatusError(message);
      showErrorNotice(message, { title: t("versioning.restore.title") });
    } finally {
      setRestoreDialogBusy(false);
    }
  }

  async function handleLoadProjectRequest() {
    if (!(await confirmDiscardChanges(t("workspace.unsavedActions.loadProject")))) {
      return;
    }

    projectFileInputRef.current?.click();
  }

  async function handleLoadErsRequest() {
    if (!(await confirmDiscardChanges(t("workspace.unsavedActions.loadErs")))) {
      return;
    }

    ersFileInputRef.current?.click();
  }

  async function handleLoadProjectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const parsedProject = parseProjectFile(rawText, {
        fallbackViewport: DEFAULT_VIEWPORT,
        fallbackDiagramView: "er",
      });
      const loadStatus =
        parsedProject.source === "legacy-diagram-json"
          ? t("workspace.legacyProjectLoaded")
          : t("workspace.projectLoaded");
      applyWorkspaceDocument(parsedProject.state.diagram, loadStatus, {
        translationWorkspace: parsedProject.state.translationWorkspace,
        logicalWorkspace: parsedProject.state.logicalWorkspace,
        logicalGenerated: parsedProject.state.logicalGenerated,
        logicalStage: parsedProject.state.logicalStage,
        diagramView: parsedProject.state.diagramView,
        viewport: parsedProject.state.viewport,
        translationViewport: parsedProject.state.translationViewport,
        logicalViewport: parsedProject.state.logicalViewport,
        versioning: parsedProject.state.versioning,
        workspace: parsedProject.state.workspace,
      });
    } catch (error) {
      console.error(error);
      setStatusError(formatProjectFileErrorMessage(error));
    } finally {
      event.target.value = "";
    }
  }

  async function handleLoadErsFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const parsed = parseErsDiagram(rawText, history.present);
      applyWorkspaceDocument(
        parsed,
        t("workspace.ersLoaded"),
      );
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : t("workspace.invalidErsCode");
      const formattedMessage = formatErsErrorMessage(message);
      setCodeError(formattedMessage);
      setStatusError(formattedMessage);
    } finally {
      event.target.value = "";
    }
  }

  function handleResetCodeFromDiagram() {
    syncCodeDraftWithDiagram(history.present);
    setStatus(t("workspace.codeRegenerated"));
  }

  async function handleExportPng() {
    if (!svgRef.current) {
      setStatusWarning(t("workspace.exportCanvasUnavailablePng"));
      return;
    }

    try {
      await downloadPng(svgRef.current, "builder-diagram.png");
      setStatus(t("workspace.exports.pngExported"));
      showSuccessNotice(t("workspace.downloads.pngExported"), { title: t("workspace.noticeTitles.exportCompleted") });
    } catch (error) {
      console.error(error);
      setStatusError(
        buildStructuredErrorMessage(
          t("workspace.errors.pngNotExported"),
          t("workspace.errors.canvasImageConversionFailed"),
          t("workspace.errors.retryExportVisibleDiagram"),
        ),
      );
    }
  }

  async function handleExportJpeg() {
    if (!svgRef.current) {
      setStatusWarning(t("workspace.exportCanvasUnavailableJpeg"));
      return;
    }

    try {
      await downloadJpeg(svgRef.current, "builder-diagram.jpeg");
      setStatus(t("workspace.exports.jpegExported"));
      showSuccessNotice(t("workspace.downloads.jpegExported"), { title: t("workspace.noticeTitles.exportCompleted") });
    } catch (error) {
      console.error(error);
      setStatusError(
        buildStructuredErrorMessage(
          t("workspace.errors.jpegNotExported"),
          t("workspace.errors.canvasImageConversionFailed"),
          t("workspace.errors.retryExportVisibleDiagram"),
        ),
      );
    }
  }

  function handleExportSvg() {
    if (!svgRef.current) {
      setStatusWarning(t("workspace.exportCanvasUnavailableSvg"));
      return;
    }

    downloadSvg(svgRef.current, "builder-diagram.svg");
    setStatus(t("workspace.exports.svgExported"));
    showSuccessNotice(t("workspace.downloads.svgExported"), { title: t("workspace.noticeTitles.exportCompleted") });
  }

  function handleUndoAction() {
    if (diagramView === "er") {
      if (codeDirtyRef.current || codeError) {
        syncCodeDraftWithDiagram(history.present);
      }
      history.undo();
      return;
    }

    if (diagramView === "translation") {
      translationHistory.undo();
      return;
    }

    logicalHistory.undo();
  }

  function handleRedoAction() {
    if (diagramView === "er") {
      if (codeDirtyRef.current || codeError) {
        syncCodeDraftWithDiagram(history.present);
      }
      history.redo();
      return;
    }

    if (diagramView === "translation") {
      translationHistory.redo();
      return;
    }

    logicalHistory.redo();
  }

  const onboardingSteps: Array<{
    id: OnboardingStepId;
    title: string;
    description: string;
    complete: boolean;
    actionLabel: string;
  }> = onboardingProgress
    ? [
        {
          id: "create-entity",
          title: t("onboarding.steps.createEntity.title"),
          description: t("onboarding.steps.createEntity.description"),
          complete: onboardingProgress.entityCreated,
          actionLabel: t("onboarding.steps.createEntity.action"),
        },
        {
          id: "create-relationship",
          title: t("onboarding.steps.createRelationship.title"),
          description: t("onboarding.steps.createRelationship.description"),
          complete: onboardingProgress.relationshipCreated,
          actionLabel: t("onboarding.steps.createRelationship.action"),
        },
        {
          id: "create-connection",
          title: t("onboarding.steps.createConnection.title"),
          description: t("onboarding.steps.createConnection.description"),
          complete: onboardingProgress.connectionCreated,
          actionLabel: t("onboarding.steps.createConnection.action"),
        },
        {
          id: "rename-node",
          title: t("onboarding.steps.renameNode.title"),
          description: t("onboarding.steps.renameNode.description"),
          complete: onboardingProgress.renamedNode,
          actionLabel: t("onboarding.steps.renameNode.action"),
        },
      ]
    : [];
  const onboardingActiveStepIndex = onboardingSteps.findIndex((step) => !step.complete);
  const resolvedOnboardingStepIndex = onboardingActiveStepIndex >= 0 ? onboardingActiveStepIndex : onboardingSteps.length - 1;
  const showOnboardingGuide =
    diagramView === "er" &&
    onboardingOpen &&
    onboardingSteps.length > 0;
  const workspaceRegionClassName = [
    "app-workspace-region",
    `workspace-region-${diagramView}`,
    notices.length > 0 ? "workspace-region-has-toast" : "",
    showOnboardingGuide ? "workspace-region-has-onboarding" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const visibleModelIssues = [...issues]
    .sort((left, right) => {
      if (left.level === right.level) {
        return 0;
      }

      return left.level === "error" ? -1 : 1;
    })
    .slice(0, 8);
  const modelReviewPanel = visibleModelIssues.length > 0 ? (
    <div className="technical-dock-review" aria-label="Overview modello ER">
      <PanelSection className="technical-dock-section" title="Warning">
        <div className="technical-dock-list">
          {visibleModelIssues.map((issue) => (
            <WarningCard
              key={issue.id}
              className={`technical-dock-list-item level-${issue.level}`}
              level={issue.level}
              onClick={() => handleIssueNotice(issue)}
            >
              {issue.message}
            </WarningCard>
          ))}
        </div>
      </PanelSection>
    </div>
  ) : null;
  const sqlReversePreviewSourceDiagram = useMemo(
    () => createEmptyDiagram("Preview logica SQL"),
    [sqlReverseWorkflow.result],
  );
  const sqlReverseLogicalPreviewWorkspace = useMemo(
    () =>
      sqlReverseWorkflow.result
        ? updateLogicalWorkspaceModel(
            sqlReversePreviewSourceDiagram,
            createEmptyLogicalWorkspace(sqlReversePreviewSourceDiagram),
            sqlReverseWorkflow.result.logicalModel,
          )
        : null,
    [sqlReversePreviewSourceDiagram, sqlReverseWorkflow.result],
  );
  const sqlReversePreviewContent =
    sqlReverseWorkflow.step === "logical-preview" && sqlReverseWorkflow.result && sqlReverseLogicalPreviewWorkspace ? (
      <SqlReversePreviewFrame
        title={t("sqlReverse.preview.logicalTitle")}
        subtitle={t("sqlReverse.preview.logicalSubtitle")}
        onDone={handleSqlReverseLogicalDone}
        onCancel={handleCancelSqlReverseWorkflow}
        doneLabel={t("sqlReverse.preview.applyLogical")}
        variant="logical"
      >
        <SqlReverseLogicalPreview
          sourceDiagram={sqlReversePreviewSourceDiagram}
          workspace={sqlReverseLogicalPreviewWorkspace}
          viewport={sqlReverseWorkflow.logicalViewport}
          selection={sqlReverseWorkflow.logicalSelection}
          fitRequestToken={sqlReverseWorkflow.previewToken}
          onViewportChange={(nextViewport) =>
            setSqlReverseWorkflow((current) => ({ ...current, logicalViewport: nextViewport }))
          }
          onSelectionChange={(nextSelection) =>
            setSqlReverseWorkflow((current) => ({ ...current, logicalSelection: nextSelection }))
          }
        />
      </SqlReversePreviewFrame>
    ) : sqlReverseWorkflow.step === "er-preview" && sqlReverseWorkflow.result ? (
      <SqlReversePreviewFrame
        title={t("sqlReverse.preview.erTitle")}
        subtitle={t("sqlReverse.preview.erSubtitle")}
        onDone={handleSqlReverseFinalDone}
        onCancel={handleCancelSqlReverseWorkflow}
        onBack={handleSqlReverseBackToLogicalPreview}
        doneLabel={t("sqlReverse.preview.applyEr")}
        variant="er"
      >
        <SqlReverseErPreview
          diagram={sqlReverseWorkflow.result.diagram}
          viewport={sqlReverseWorkflow.erViewport}
          selection={sqlReverseWorkflow.erSelection}
          onViewportChange={(nextViewport) =>
            setSqlReverseWorkflow((current) => ({ ...current, erViewport: nextViewport }))
          }
          onSelectionChange={(nextSelection) =>
            setSqlReverseWorkflow((current) => ({ ...current, erSelection: nextSelection }))
          }
        />
      </SqlReversePreviewFrame>
    ) : null;

  if (booting) {
    return <AppLoadingScreen />;
  }

  if (versionCompareSession) {
    return (
      <>
        <VersionCompareMode
          appTitle={APP_TITLE}
          appVersion={APP_VERSION}
          versioning={projectVersioning.versioning}
          currentSnapshot={currentProjectCommitSnapshot}
          initialLeft={versionCompareSession.left}
          initialRight={versionCompareSession.right}
          restoreDialogOpen={restoreCommitId !== null}
          onExitCompareMode={() => setVersionCompareSession(null)}
        />

        <WorkspaceToastStack notices={notices} onDismissNotice={dismissNotice} />

        <RestoreVersionDialog
          open={restoreCommitId !== null}
          busy={restoreDialogBusy}
          error={restoreDialogError}
          commit={restoreTargetCommit}
          onClose={handleCloseRestoreDialog}
          onConfirm={handleConfirmRestoreCommit}
        />
      </>
    );
  }

  return (
    <div className={appShellClassName}>
      <AppHeader
        appTitle={APP_TITLE}
        appVersion={APP_VERSION}
        diagramName={history.present.meta.name}
        diagramView={diagramView}
        logicalSqlOpen={logicalPanelMode === "sql"}
        codePanelOpen={codePanelOpen}
        notesPanelOpen={notesPanelOpen}
        logicalOutOfDate={logicalOutOfDate}
        focusMode={focusMode}
        hasUncommittedChanges={hasVersioningUncommittedChanges}
        versioningCommitCount={projectVersioning.versioning.commits.length}
        onNewProject={handleNewProject}
        onOpenVersioningPanel={() => setVersioningPanelOpen(true)}
        onToggleCodePanel={handleToggleCodePanel}
        onToggleNotesPanel={handleToggleNotesPanel}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProjectRequest}
        onOpenCommandMenu={openCommandMenu}
        onOpenShortcuts={openKeyboardShortcuts}
        onDiagramNameChange={handleDiagramNameChange}
      />

      <WorkspaceToastStack notices={notices} onDismissNotice={dismissNotice} />

      <div className={workspaceRegionClassName}>
        <div className="workspace-overlay-region">
          {showOnboardingGuide ? (
            <div className="workspace-onboarding-dock">
              <OnboardingGuide
                steps={onboardingSteps}
                activeStepIndex={resolvedOnboardingStepIndex}
                onStepAction={handleOnboardingStepAction}
                onSkip={handleSkipOnboarding}
              />
            </div>
          ) : null}
        </div>

        {sqlReversePreviewContent ? (
          sqlReversePreviewContent
        ) : (
          <div
            className={
              diagramView === "er"
                ? erWorkspaceShellClassName
                : diagramView === "translation"
                  ? translationWorkspaceShellClassName
                  : structuredWorkspaceShellClassName
            }
            style={
              diagramView === "er"
                ? erWorkspaceShellStyle
                : diagramView === "translation"
                  ? undefined
                  : structuredWorkspaceShellStyle
            }
          >
          {diagramView === "er" ? (
            <div className="designer-workspace">
              <div className={codePanelOpen ? "designer-canvas-region code-drawer-open" : "designer-canvas-region"}>
                {codePanelOpen ? (
                  <div className="designer-code-drawer">
                    <CodePanel
                      embedded
                      code={codeDraft}
                      editable={mode === "edit"}
                      parseError={codeError}
                      onCodeChange={updateCodeDraft}
                      onFocus={handleCodeEditorFocus}
                      onBlur={handleCodeEditorBlur}
                      onClose={handleToggleCodePanel}
                    />
                  </div>
                ) : null}

                <div className="designer-quick-actions-bar designer-side-toggle-group" aria-label={t("workspace.quickPanels.aria")}>
                  <button
                    type="button"
                    className={["designer-side-toggle", codePanelOpen ? "active" : ""].filter(Boolean).join(" ")}
                    onClick={handleToggleCodePanel}
                    title={codePanelOpen ? t("workspace.quickPanels.closeCodeTitle") : t("workspace.quickPanels.openCodeTitle")}
                    aria-label={codePanelOpen ? t("workspace.quickPanels.closeCodeAria") : t("workspace.quickPanels.openCodeAria")}
                    aria-pressed={codePanelOpen}
                  >
                    <span className="designer-side-toggle-icon" aria-hidden="true">
                      <StudioIcon name="code" />
                    </span>
                    <span className="designer-side-toggle-label">Code</span>
                  </button>
                  <button
                    type="button"
                    className="designer-side-toggle"
                    onClick={handleOpenSqlReverseWorkflow}
                    title={t("workspace.quickPanels.importSqlTitle")}
                    aria-label={t("workspace.quickPanels.openSqlReverseAria")}
                  >
                    <span className="designer-side-toggle-icon" aria-hidden="true">
                      <StudioIcon name="databaseReverse" />
                    </span>
                    <span className="designer-side-toggle-label">Reverse</span>
                  </button>
                  <button
                    type="button"
                    className={`designer-side-toggle designer-side-toggle-errors ${
                      issues.length > 0 ? "has-issues" : ""
                    }`}
                    onClick={() => setErrorsPanelOpen(true)}
                    title={t("workspace.quickPanels.openErrorsTitle")}
                    aria-label={t("workspace.quickPanels.openErrorsAria")}
                  >
                    <span className="designer-side-toggle-icon" aria-hidden="true">
                      <StudioIcon name={issues.some((issue) => issue.level === "error") ? "error" : "warning"} />
                    </span>
                    <span className="designer-side-toggle-label">Errors</span>
                    {issues.length > 0 ? <span className="designer-side-toggle-badge">{issues.length}</span> : null}
                  </button>
                  <button
                    type="button"
                    className={["designer-side-toggle", notesPanelOpen ? "active" : ""].filter(Boolean).join(" ")}
                    onClick={handleToggleNotesPanel}
                    title={notesPanelOpen ? t("workspace.quickPanels.closeNotesTitle") : t("workspace.quickPanels.openNotesTitle")}
                    aria-label={notesPanelOpen ? t("workspace.quickPanels.closeNotesAria") : t("workspace.quickPanels.openNotesAria")}
                    aria-pressed={notesPanelOpen}
                  >
                    <span className="designer-side-toggle-icon" aria-hidden="true">
                      <StudioIcon name="notes" />
                    </span>
                    <span className="designer-side-toggle-label">Notes</span>
                  </button>
                </div>

                <Toolbar
                  diagram={history.present}
                  selection={selection}
                  activeTool={tool}
                  mode={mode}
                  collapsed={false}
                  showPropertiesInspector={false}
                  selectionItemCount={selectionItemCount}
                  issues={issues}
                  selectedNode={selectedNode}
                  selectedEdge={selectedEdge}
                  canUndo={activeCanUndo}
                  canRedo={activeCanRedo}
                  onUndo={handleUndoAction}
                  onRedo={handleRedoAction}
                  onCreateEntity={() => handleCreateNodeFromToolbar("entity")}
                  onCreateRelationship={() => handleCreateNodeFromToolbar("relationship")}
                  onSaveProject={handleSaveProject}
                  onSaveErs={handleSaveErs}
                  onExportPng={handleExportPng}
                  onExportJpeg={handleExportJpeg}
                  onOpenCardinality={handleOpenCardinalityControl}
                  onOpenRole={handleOpenConnectorRoleControl}
                  onToggleSimpleIdentifier={handleToggleSimpleIdentifierFromSelection}
                  onOpenCompositeIdentifier={handleCreateCompositeIdentifierFromSelection}
                  onOpenMixedIdentifier={handleOpenMixedIdentifierModal}
                  onOpenInheritanceType={handleOpenInheritanceTypeControl}
                  onRemoveFromHierarchy={handleRemoveSelectedEntityFromHierarchy}
                  onRemoveExternalIdentifier={handleRemoveSelectedExternalIdentifier}
                  onToolChange={handleToolChange}
                  onDuplicateSelection={handleDuplicateSelection}
                  onDeleteSelection={handleDeleteSelection}
                  selectedIdentifier={identifierSelection}
                  onDeleteIdentifierSelection={handleDeleteIdentifierSelection}
                  onCreateAttributeForSelection={handleCreateAttributeFromSelection}
                  onEntityInternalIdentifiersChange={handleEntityInternalIdentifiersChange}
                  onEntityExternalIdentifiersChange={handleEntityExternalIdentifiersChange}
                  onRenameSelection={handleRenameSelectionQuick}
                  onNodeChange={handleNodeChange}
                  onNodesChange={handleNodesChange}
                  onEdgeChange={handleEdgeChange}
                  onAlign={handleAlignSelection}
                  onIssueSelect={handleIssueNotice}
                  onToggleCollapse={handleToggleToolRail}
                  onOpenTranslation={handleOpenTranslationStage}
                  onExportSvg={handleExportSvg}
                />

                <DiagramCanvas
                  diagram={history.present}
                  selection={selection}
                  tool={tool}
                  mode={mode}
                  viewport={viewport}
                  issues={canvasIssues}
                  statusMessage={statusMessage}
                  svgRef={svgRef}
                  onViewportChange={setViewport}
                  onSelectionChange={handleErSelectionChange}
                  selectedIdentifier={identifierSelection}
                  onIdentifierSelectionChange={setIdentifierSelection}
                  onPreviewDiagram={handlePreviewDiagram}
                  onCommitDiagram={commitDiagram}
                  onCreateNode={handleCreateNode}
                  onCreateEdge={handleCreateEdge}
                  onOpenCardinality={handleOpenCardinalityControl}
                  onOpenInheritanceType={handleOpenInheritanceTypeControl}
                  onToolChange={handleToolChange}
                  onDeleteNode={handleDeleteNodeById}
                  onDeleteEdge={handleDeleteEdgeById}
                  onDeleteSelection={handleDeleteSelection}
                  onDeleteExternalIdentifier={handleDeleteExternalIdentifier}
                  onDeleteIdentifierSelection={handleDeleteIdentifierSelection}
                  onRenameNode={handleRenameNode}
                  onRenameEdge={handleRenameEdge}
                  onStatusMessageChange={handleCanvasStatusMessage}
                />

              </div>
            </div>
          ) : diagramView === "translation" ? (
            <TranslationWorkspace
              workspace={translationHistory.present}
              viewport={translationViewport}
              selection={translationSelection}
              sidePanelHidden={structuredSidePanelHidden}
              canUndo={translationHistory.canUndo}
              canRedo={translationHistory.canRedo}
              onUndo={handleUndoAction}
              onRedo={handleRedoAction}
              onViewportChange={setTranslationViewport}
              onSelectionChange={setTranslationSelection}
              onApplyChoice={handleApplyErTranslationChoice}
              onResetTranslation={handleResetTranslation}
              onOpenDesign={() => handleDiagramViewChange("er")}
              onOpenLogical={handleGenerateLogicalModel}
              notesPanelOpen={notesPanelOpen}
              onToggleNotesPanel={handleToggleNotesPanel}
              onExportProject={handleSaveProject}
              onSaveRestructuredErs={handleSaveRestructuredErs}
              onPreviewDiagram={(diagram) => {
                translationHistory.setPresent({
                  ...translationHistory.present,
                  translatedDiagram: diagram,
                });
              }}
              onCommitDiagram={(diagram, previous) => {
                translationHistory.commit(
                  { ...translationHistory.present, translatedDiagram: diagram },
                  { ...translationHistory.present, translatedDiagram: previous }
                );
              }}
            />
          ) : (
            <LogicalTranslationWorkspace
              sourceDiagram={translationHistory.present.translatedDiagram}
              workspace={logicalHistory.present}
              logicalStage={logicalStage}
              viewport={logicalViewport}
              selection={logicalSelection}
              sidePanelHidden={structuredSidePanelHidden}
              typeMode={logicalTypeMode}
              panelMode={logicalPanelMode}
              fitRequestToken={logicalFitRequestToken}
              notesPanelOpen={notesPanelOpen}
              canUndo={logicalHistory.canUndo}
              canRedo={logicalHistory.canRedo}
              onUndo={handleUndoAction}
              onRedo={handleRedoAction}
              onViewportChange={setLogicalViewport}
              onSelectionChange={setLogicalSelection}
              onTypeModeChange={handleLogicalTypeModeChange}
              onPanelModeChange={setLogicalPanelMode}
              onToggleNotesPanel={handleToggleNotesPanel}
              onApplyChoice={handleApplyLogicalTranslationChoice}
              onApplyBulkFix={handleApplyBulkLogicalFix}
              onResetTranslation={handleResetLogicalTranslation}
              onDone={handleLogicalDone}
              onOpenDesign={handleOpenErStage}
              onExportProject={handleSaveProject}
              onSaveSql={handleSaveLogicalSql}
              onExportPng={handleExportPng}
              onExportJpeg={handleExportJpeg}
              onExportSvg={handleExportSvg}
              svgRef={svgRef}
              onPreviewModel={previewLogicalModel}
              onCommitModel={commitLogicalModel}
              onRenameTable={handleLogicalTableRename}
              onRenameColumn={handleLogicalColumnRename}
              onUpdateColumnSql={handleLogicalColumnSqlUpdate}
              onMoveColumn={handleLogicalColumnMove}
            />
          )}
          </div>
        )}
      </div>

      <input
        ref={projectFileInputRef}
        className="hidden-input"
        type="file"
        accept={PROJECT_FILE_ACCEPT}
        onChange={handleLoadProjectFile}
      />
      <input
        ref={ersFileInputRef}
        className="hidden-input"
        type="file"
        accept=".ers,text/plain"
        onChange={handleLoadErsFile}
      />

      <VersioningPanel
        open={versioningPanelOpen}
        commits={projectVersioning.commitsNewestFirst}
        headCommitId={projectVersioning.versioning.headCommitId}
        changeState={versioningChangeState}
        commitBusy={commitDialogBusy}
        commitError={commitDialogError}
        commitHint={commitDialogHint}
        onClose={() => setVersioningPanelOpen(false)}
        onCreateCommit={handleCreateProjectCommit}
        onCompareWithCurrent={handleCompareCommitWithCurrent}
        onCompareWithHead={handleCompareCommitWithHead}
        onRestoreCommit={handleOpenRestoreCommit}
      />

      <RestoreVersionDialog
        open={restoreCommitId !== null}
        busy={restoreDialogBusy}
        error={restoreDialogError}
        commit={restoreTargetCommit}
        onClose={handleCloseRestoreDialog}
        onConfirm={handleConfirmRestoreCommit}
      />

      <CommitDialog
        open={commitDialogOpen}
        busy={commitDialogBusy}
        error={commitDialogError}
        canCommit={versioningChangeState.summary.canCommit}
        hint={commitDialogHint}
        categories={versioningChangeState.categories}
        firstCommit={!versioningChangeState.hasHead}
        onClose={() => {
          if (!commitDialogBusy) {
            setCommitDialogOpen(false);
            setCommitDialogError("");
          }
        }}
        onSubmit={handleCreateProjectCommit}
      />

      <NotesModal
        open={notesPanelOpen}
        notes={history.present.notes}
        editable={mode === "edit"}
        onSave={handleNotesChange}
        onClose={() => setNotesPanelOpen(false)}
      />

      {sqlReverseWorkflow.step === "input" ? (
        <SqlReverseInputModal
          sql={sqlReverseWorkflow.sourceSql}
          errorMessage={sqlReverseWorkflow.errorMessage}
          issues={sqlReverseWorkflow.issues}
          logicalIssues={sqlReverseWorkflow.logicalIssues}
          tableCount={sqlReverseWorkflow.tableCount}
          unsupportedStatementCount={sqlReverseWorkflow.unsupportedStatementCount}
          isPreviewReady={sqlReverseWorkflow.isPreviewReady}
          onSqlChange={handleSqlReverseSourceChange}
          onAnalyze={handleAnalyzeSqlReverseWorkflow}
          onLoadFile={handleLoadSqlReverseFile}
          onClear={handleClearSqlReverse}
          onCancel={handleCancelSqlReverseWorkflow}
        />
      ) : null}

      {commandMenuOpen ? (
        <CommandMenuModal
          appTitle={APP_TITLE}
          appVersion={APP_VERSION}
          diagramName={history.present.meta.name}
          diagramView={diagramView}
          logicalSqlOpen={logicalPanelMode === "sql"}
          codePanelOpen={codePanelOpen}
          notesPanelOpen={notesPanelOpen}
          canUndo={activeCanUndo}
          canRedo={activeCanRedo}
          logicalOutOfDate={logicalOutOfDate}
          focusMode={focusMode}
          hasUncommittedChanges={hasVersioningUncommittedChanges}
          toolRailCollapsed={effectiveToolbarCollapsed}
          selectionItemCount={selectionItemCount}
          onClose={() => setCommandMenuOpen(false)}
          onOpenShortcuts={openKeyboardShortcuts}
          onDiagramViewChange={handleDiagramViewChange}
          onOpenSql={handleOpenSqlStage}
          onOpenLogicalWorkflow={handleOpenLogicalStage}
          onNewProject={handleNewProject}
          onUndo={handleUndoAction}
          onRedo={handleRedoAction}
          onDuplicateSelection={handleDuplicateSelection}
          onDeleteSelection={handleDeleteSelection}
          onRenameSelection={handleRenameSelectionQuick}
          onGenerateLogicalModel={handleGenerateLogicalModel}
          onResetTranslation={handleResetTranslation}
          onAutoLayoutLogical={handleLogicalAutoLayout}
          onFitLogical={handleLogicalFit}
          onOpenSqlReverseWorkflow={handleOpenSqlReverseWorkflow}
          onOpenVersioningPanel={() => setVersioningPanelOpen(true)}
          onToggleCodePanel={handleToggleCodePanel}
          onToggleNotesPanel={handleToggleNotesPanel}
          onSaveProject={handleSaveProject}
          onSaveErs={handleSaveErs}
          onLoadProject={handleLoadProjectRequest}
          onLoadErs={handleLoadErsRequest}
          onExportPng={handleExportPng}
          onExportJpeg={handleExportJpeg}
          onExportSvg={handleExportSvg}
          onResetErs={handleResetCodeFromDiagram}
          onAbout={() => {
            setWhatsNewOpen(false);
            setAboutOpen(true);
          }}
          onWhatsNew={() => {
            setAboutOpen(false);
            setWhatsNewOpen(true);
          }}
          onToggleFocusMode={handleToggleFocusMode}
          onToggleToolRail={handleToggleToolRail}
        />
      ) : null}

      {keyboardShortcutsOpen ? <KeyboardShortcutsModal onClose={() => setKeyboardShortcutsOpen(false)} /> : null}

      {confirmDialog ? (
        <div className="help-modal-backdrop" role="presentation" onClick={() => closeConfirmDialog(false)}>
          <div
            className="help-modal action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-modal-head">
              <h2 id="confirm-dialog-title">{confirmDialog.title}</h2>
            </div>

            <div className="action-modal-content">
              <p>{confirmDialog.message}</p>
              <div className="action-modal-actions">
                <button type="button" className="header-button" onClick={() => closeConfirmDialog(false)}>
                  {confirmDialog.cancelLabel}
                </button>
                <button type="button" className="mode-button active" onClick={() => closeConfirmDialog(true)}>
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {promptDialog ? (
        <div className="help-modal-backdrop" role="presentation" onClick={() => closePromptDialog(null)}>
          <div
            className="help-modal action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="prompt-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-modal-head">
              <h2 id="prompt-dialog-title">{promptDialog.title}</h2>
            </div>

            <form
              className="action-modal-content"
              onSubmit={(event) => {
                event.preventDefault();
                submitPromptDialog();
              }}
            >
              <label className="field action-modal-field">
                <span>{promptDialog.label}</span>
                <input
                  ref={promptInputRef}
                  value={promptValue}
                  placeholder={promptDialog.placeholder}
                  onChange={(event) => {
                    setPromptValue(event.target.value);
                    if (promptError) {
                      setPromptError("");
                    }
                  }}
                />
              </label>
              {promptError ? <p className="action-modal-error">{promptError}</p> : null}

              <div className="action-modal-actions">
                <button type="button" className="header-button" onClick={() => closePromptDialog(null)}>
                  {promptDialog.cancelLabel}
                </button>
                <button type="submit" className="mode-button active">
                  {promptDialog.confirmLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {errorsPanelOpen ? (
        <div className="help-modal-backdrop" role="presentation" onClick={() => setErrorsPanelOpen(false)}>
          <div
            className="help-modal action-modal errors-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="errors-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-modal-head errors-modal-head">
              <div className="errors-modal-heading">
                <span className="errors-modal-heading-icon" aria-hidden="true">
                  <StudioIcon name={issues.some((issue) => issue.level === "error") ? "error" : "warning"} />
                </span>
                <div>
                  <h2 id="errors-dialog-title">Errors</h2>
                  <p>{issues.filter(issueTargetExists).length} warning/errori nel diagramma</p>
                </div>
              </div>
              <button type="button" className="help-close" onClick={() => setErrorsPanelOpen(false)} aria-label={t("errors.closeAria")}>
                <StudioIcon name="close" aria-hidden="true" />
              </button>
            </div>
            <div className="action-modal-content errors-modal-list">
              <div className="errors-modal-toolbar">
                <button
                  type="button"
                  className={["errors-modal-diagnostics-toggle", showDiagnostics ? "active" : ""].filter(Boolean).join(" ")}
                  onClick={handleToggleDiagnosticsVisibility}
                  aria-pressed={showDiagnostics}
                  aria-label={showDiagnostics ? "Nascondi diagnostica sul canvas" : "Mostra diagnostica sul canvas"}
                >
                  <StudioIcon
                    name={showDiagnostics ? "viewOn" : "viewOff"}
                    className="errors-modal-diagnostics-icon"
                    aria-hidden="true"
                  />
                  <span>Mostra diagnostica sul canvas</span>
                </button>
              </div>
              {!showDiagnostics && issues.filter(issueTargetExists).length > 0 ? (
                <p className="errors-modal-note">
                  Gli indicatori sul canvas sono nascosti; la validazione resta attiva.
                </p>
              ) : null}
              {issues.filter(issueTargetExists).length === 0 ? (
                <p className="errors-modal-empty">{t("errors.empty")}</p>
              ) : (
                issues.filter(issueTargetExists).map((issue) => (
                  <button
                    type="button"
                    key={issue.id}
                    className={`errors-modal-item ${issue.level}`}
                    onClick={() => {
                      if (selectIssueTarget(issue)) {
                        setErrorsPanelOpen(false);
                      }
                    }}
                  >
                    <span className="errors-modal-item-icon" aria-hidden="true">
                      <StudioIcon name={issue.level === "error" ? "error" : "warning"} />
                    </span>
                    <span className="errors-modal-item-copy">
                      <strong>{issue.level === "error" ? "error" : "warning"}</strong>
                      <span>{getIssueElementLabel(issue)}</span>
                      <p>{issue.message}</p>
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {cardinalityDialog ? (
        <CardinalityModal
          state={cardinalityDialog}
          {...getCardinalityDialogLabels(cardinalityDialog)}
          onPresetChange={(presetValue) =>
            setCardinalityDialog((current) => current ? { ...current, presetValue, error: "" } : current)
          }
          onCustomValueChange={(customValue) =>
            setCardinalityDialog((current) =>
              current ? { ...current, presetValue: "custom", customValue, error: "" } : current,
            )
          }
          onSubmit={submitCardinalityDialog}
          onCancel={cancelCardinalityDialog}
        />
      ) : null}

      {mixedIdentifierDialog ? (
        <div className="help-modal-backdrop" role="presentation" onClick={() => setMixedIdentifierDialog(null)}>
          <div
            className="help-modal action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mixed-id-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-modal-head">
              <h2 id="mixed-id-dialog-title">{t("workspace.externalIdentifierDialog.title")}</h2>
            </div>
            <form
              className="action-modal-content"
              onSubmit={(event) => {
                event.preventDefault();
                submitMixedIdentifierDialog();
              }}
            >
              <p className="action-modal-description">{t("workspace.externalIdentifierDialog.description")}</p>
              <div className="context-card-title">{t("workspace.externalIdentifierDialog.importedParts")}</div>
              <div className="checkbox-list">
                {mixedIdentifierDialog.importedParts.map((part) => {
                  const partKey = buildExternalImportPartKey(part);
                  return (
                    <label key={partKey} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={mixedIdentifierDialog.selectedImportedPartKeys.includes(partKey)}
                        onChange={(event) => {
                          const selectedImportedPartKeys = event.target.checked
                            ? [...mixedIdentifierDialog.selectedImportedPartKeys, partKey]
                            : mixedIdentifierDialog.selectedImportedPartKeys.filter((id) => id !== partKey);
                          setMixedIdentifierDialog({ ...mixedIdentifierDialog, selectedImportedPartKeys, error: "" });
                        }}
                      />
                      <span>{part.label}</span>
                    </label>
                  );
                })}
              </div>
              <div className="context-card-title">{t("workspace.externalIdentifierDialog.localAttributes")}</div>
              <div className="checkbox-list">
                {mixedIdentifierDialog.attributes.map((attribute) => (
                  <label key={attribute.id} className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={mixedIdentifierDialog.selectedAttributeIds.includes(attribute.id)}
                      onChange={(event) => {
                        const selectedAttributeIds = event.target.checked
                          ? [...mixedIdentifierDialog.selectedAttributeIds, attribute.id]
                          : mixedIdentifierDialog.selectedAttributeIds.filter((id) => id !== attribute.id);
                        setMixedIdentifierDialog({ ...mixedIdentifierDialog, selectedAttributeIds, error: "" });
                      }}
                    />
                    <span>{attribute.label}</span>
                  </label>
                ))}
              </div>
              {mixedIdentifierDialog.error ? <p className="action-modal-error">{mixedIdentifierDialog.error}</p> : null}
              <div className="action-modal-actions">
                <button type="button" className="header-button" onClick={() => setMixedIdentifierDialog(null)}>
                  {t("workspace.externalIdentifierDialog.cancel")}
                </button>
                <button type="submit" className="mode-button active" disabled={mixedIdentifierDialog.importedParts.length === 0}>
                  {t("workspace.externalIdentifierDialog.create")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {generalizationGroupDialog ? (() => {
        const dialog = generalizationGroupDialog;
        const compatibleGroups = getCompatibleGeneralizationGroups(history.present, dialog.supertypeId);
        const subtypeLabel = getEntityLabel(history.present, dialog.subtypeId);
        const supertypeLabel = getEntityLabel(history.present, dialog.supertypeId);
        return (
          <div className="help-modal-backdrop" role="presentation" onClick={cancelGeneralizationGroupDialog}>
            <div
              className="help-modal action-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="isa-dialog-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="help-modal-head">
                <h2 id="isa-dialog-title">{t("workspace.generalizationGroupDialog.title")}</h2>
              </div>
              <form
                className="action-modal-content"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitGeneralizationGroupDialog();
                }}
              >
                <p className="action-modal-hint">
                  {dialog.kind === "edit"
                    ? t("workspace.generalizationGroupDialog.editHint")
                    : t("workspace.generalizationGroupDialog.assignHint")}
                </p>
                <div className="action-modal-summary">
                  <strong>{t("workspace.generalizationGroupDialog.subtype")}:</strong> {subtypeLabel}
                  <br />
                  <strong>{t("workspace.generalizationGroupDialog.supertype")}:</strong> {supertypeLabel}
                </div>

                {dialog.kind === "assign" ? (
                  <div className="choice-stack">
                    <label className="choice-tile">
                      <input
                        type="radio"
                        name="isa-group-mode"
                        checked={dialog.mode === "existing"}
                        disabled={compatibleGroups.length === 0}
                        onChange={() =>
                          setGeneralizationGroupDialog({
                            ...dialog,
                            mode: "existing",
                            selectedGroupId: dialog.selectedGroupId ?? compatibleGroups[0]?.id,
                            error: "",
                          })
                        }
                      />
                      <span>{t("workspace.generalizationGroupDialog.useExisting")}</span>
                    </label>
                    {dialog.mode === "existing" && compatibleGroups.length > 0 ? (
                      <div className="choice-grid">
                        {compatibleGroups.map((group) => (
                          <label key={group.id} className="choice-tile">
                            <input
                              type="radio"
                              name="isa-existing-group"
                              checked={dialog.selectedGroupId === group.id}
                              onChange={() => setGeneralizationGroupDialog({ ...dialog, selectedGroupId: group.id, error: "" })}
                            />
                            <span>
                              <strong>{group.label ?? group.id}</strong>
                              <small>
                                {t("workspace.generalizationGroupDialog.constraints")}: {formatIsaConstraintShort(group.isaCompleteness, group.isaDisjointness)}
                                <br />
                                {t("workspace.generalizationGroupDialog.subtype")}: {group.subtypeIds.map((subtypeId) => getEntityLabel(history.present, subtypeId)).join(", ") || "-"}
                              </small>
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : null}

                    <label className="choice-tile">
                      <input
                        type="radio"
                        name="isa-group-mode"
                        checked={dialog.mode === "new"}
                        onChange={() => setGeneralizationGroupDialog({ ...dialog, mode: "new", error: "" })}
                      />
                      <span>{t("workspace.generalizationGroupDialog.createNew")}</span>
                    </label>
                  </div>
                ) : null}

                {(dialog.kind === "edit" || dialog.mode === "new") ? (
                  <>
                    <label className="action-modal-field">
                      <span>{t("workspace.generalizationGroupDialog.groupName")}</span>
                      <input
                        value={dialog.newGroupName}
                        onChange={(event) => setGeneralizationGroupDialog({ ...dialog, newGroupName: event.target.value, error: "" })}
                        placeholder={t("workspace.generalizationGroupDialog.groupNamePlaceholder")}
                        autoFocus
                      />
                    </label>
                    <div className="choice-grid">
                      {([
                        ["total", t("workspace.generalizationGroupDialog.completeness.total")],
                        ["partial", t("workspace.generalizationGroupDialog.completeness.partial")],
                      ] as const).map(([value, label]) => (
                        <label key={value} className="choice-tile">
                          <input
                            type="radio"
                            name="isa-completeness"
                            checked={dialog.isaCompleteness === value}
                            onChange={() => setGeneralizationGroupDialog({ ...dialog, isaCompleteness: value, error: "" })}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <div className="choice-grid">
                      {([
                        ["disjoint", t("workspace.generalizationGroupDialog.disjointness.disjoint")],
                        ["overlap", t("workspace.generalizationGroupDialog.disjointness.overlap")],
                      ] as const).map(([value, label]) => (
                        <label key={value} className="choice-tile">
                          <input
                            type="radio"
                            name="isa-disjointness"
                            checked={dialog.isaDisjointness === value}
                            onChange={() => setGeneralizationGroupDialog({ ...dialog, isaDisjointness: value, error: "" })}
                          />
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="action-modal-hint">
                      {t("workspace.generalizationGroupDialog.constraint")}: {formatIsaConstraintShort(dialog.isaCompleteness, dialog.isaDisjointness)}
                    </p>
                  </>
                ) : null}

                {dialog.error ? <p className="action-modal-error">{dialog.error}</p> : null}
                <div className="action-modal-actions">
                  <button type="button" className="header-button" onClick={cancelGeneralizationGroupDialog}>
                    {t("common.actions.cancel")}
                  </button>
                  <button type="submit" className="mode-button active">
                    {t("common.actions.confirm")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })() : null}

      {introOpen ? (
        <div className="intro-modal-backdrop" role="presentation" onClick={() => setIntroOpen(false)}>
          <div
            className="intro-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="intro-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="intro-modal-head">
              <h2 id="intro-modal-title">{t("intro.title", { appTitle: APP_TITLE })}</h2>
              <button type="button" className="help-close" onClick={() => setIntroOpen(false)} aria-label={t("intro.closeAria")}>
                <StudioIcon name="close" aria-hidden="true" />
              </button>
            </div>

            <div className="intro-modal-content">
              <p>
                {t("intro.description")}
              </p>

              <div className="intro-grid">
                <article>
                  <h3>{t("intro.cards.create.title")}</h3>
                  <p>{t("intro.cards.create.description")}</p>
                </article>
                <article>
                  <h3>{t("intro.cards.connect.title")}</h3>
                  <p>{t("intro.cards.connect.description")}</p>
                </article>
                <article>
                  <h3>{t("intro.cards.refine.title")}</h3>
                  <p>{t("intro.cards.refine.description")}</p>
                </article>
              </div>

              <div className="intro-actions">
                <button
                  type="button"
                  className="header-button"
                  onClick={() => {
                    setIntroOpen(false);
                    setAboutOpen(true);
                  }}
                >
                  {t("intro.openGuide")}
                </button>
                <button type="button" className="mode-button active" onClick={() => setIntroOpen(false)}>
                  {t("intro.startDrawing")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {aboutOpen ? (
        <div className="studio-modal-backdrop" role="presentation" onClick={() => setAboutOpen(false)}>
          <div
            className="studio-modal studio-modal--medium about-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="studio-modal__header">
              <div>
                <h2 id="about-modal-title" className="studio-modal__title">{t("about.title")}</h2>
                <p className="studio-modal__subtitle">{t("about.subtitle")}</p>
              </div>
              <button
                type="button"
                className="studio-modal__close"
                onClick={() => setAboutOpen(false)}
                aria-label={t("about.closeAria")}
                autoFocus
              >
                <StudioIcon name="close" aria-hidden="true" />
              </button>
            </div>

            <div className="studio-modal__body">
              <div className="studio-modal__meta about-meta">
                <strong>{APP_TITLE}</strong>
                <span>{t("about.currentVersion", { version: APP_VERSION })}</span>
              </div>

              <div className="studio-modal__accordion help-sections">
                <details className="studio-modal__details help-section" open>
                <summary>{t("about.sections.tools.title")}</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>{t("about.sections.tools.items.shortcuts")}</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>{t("about.sections.insertion.title")}</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>{t("about.sections.insertion.items.place")}</li>
                  <li>{t("about.sections.insertion.items.connect")}</li>
                  <li>{t("about.sections.insertion.items.notes")}</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>{t("about.sections.selection.title")}</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>{t("about.sections.selection.items.drag")}</li>
                  <li>{t("about.sections.selection.items.rename")}</li>
                  <li>{t("about.sections.selection.items.inspector")}</li>
                  <li>{t("about.sections.selection.items.cardinalityDrag")}</li>
                  <li>{t("about.sections.selection.items.align")}</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>{t("about.sections.navigation.title")}</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>{t("about.sections.navigation.items.canvas")}</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>{t("about.sections.keyboard.title")}</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>{t("about.sections.keyboard.items.shortcuts")}</li>
                  <li>{t("about.sections.keyboard.items.deleteEscape")}</li>
                  <li>{t("about.sections.keyboard.items.canvas")}</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>{t("about.sections.code.title")}</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>{t("about.sections.code.items.live")}</li>
                  <li>{t("about.sections.code.items.invalid")}</li>
                  <li>{t("about.sections.code.items.regenerate")}</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>{t("about.sections.validation.title")}</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>{t("about.sections.validation.items.toasts")}</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>{t("about.sections.notation.title", { version: APP_VERSION })}</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>{t("about.sections.notation.items.available")}</li>
                  <li>{t("about.sections.notation.items.isa")}</li>
                  <li>{t("about.sections.notation.items.missing")}</li>
                </ul>
              </details>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {versionAnnouncement ? (
        <VersionAnnouncement
          appName={APP_NAME}
          currentVersion={APP_VERSION}
          previousVersion={versionAnnouncement.previousVersion}
          updateKind={versionAnnouncement.updateKind}
          changelogEntry={versionAnnouncement.changelogEntry}
          onClose={closeVersionAnnouncement}
          onOpenFullChangelog={openFullChangelogFromVersionAnnouncement}
        />
      ) : null}

      {whatsNewOpen ? (
        <ChangelogModal
          appName={APP_NAME}
          currentVersion={APP_VERSION}
          entries={appChangelog}
          onClose={() => setWhatsNewOpen(false)}
        />
      ) : null}

    </div>
  );
}
