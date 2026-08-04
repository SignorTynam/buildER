import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  ChangeEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { DiagramCanvas } from "./canvas/DiagramCanvas";
import { AppHeader } from "./components/AppHeader";
import { BottomStatusBar } from "./components/BottomStatusBar";
import { AppLoadingScreen } from "./components/AppLoadingScreen";
import { ReleaseAnnouncement } from "./components/releases/ReleaseAnnouncement";
import { ReleaseCenter } from "./components/releases/ReleaseCenter";
import { ReleaseToast } from "./components/releases/ReleaseToast";
import { CriticalReleaseBanner } from "./components/releases/CriticalReleaseBanner";
import { CodePanel } from "./components/CodePanel";
import { CommandMenuModal } from "./components/CommandMenuModal";
import {
  ProjectActivityPanel,
  type ProjectActivityId,
  type ProjectActivityItem,
} from "./components/project/ProjectActivityPanel";
import { ProjectActivityPanelHeader } from "./components/project/ProjectActivityPanelHeader";
import { ProjectExplorer } from "./components/project/ProjectExplorer";
import { SelectionInspectorPanel } from "./components/inspector/SelectionInspectorPanel";
import { MoveToDialog } from "./components/project/MoveToDialog";
import { ProjectFileTabs } from "./components/project/ProjectFileTabs";
import { SqlReversePanel } from "./components/reverse/SqlReversePanel";
import { NoProjectWelcomePage } from "./components/workspace/NoProjectWelcomePage";
import { WorkspaceEmptyEditor } from "./components/workspace/WorkspaceEmptyEditor";
import { WorkspaceEditorHeader } from "./components/workspace/WorkspaceEditorHeader";
import { PanelEmptyState, PanelIconButton, WorkspacePanel } from "./components/workspace/WorkspacePanel";
import { WorkspaceTextEditor } from "./components/workspace/WorkspaceTextEditor";
import { WorkspaceWelcomePage } from "./components/workspace/WorkspaceWelcomePage";
import { ErrorsPanel } from "./components/validation/ErrorsPanel";
import { SourceControlPanel } from "./components/versioning/SourceControlPanel";
import { getPreferredCompareView } from "./components/versioning/sourceControlPresentation";
import { VersionCompareMode } from "./components/versioning/VersionCompareMode";
import {
  CardinalityModal,
  type CardinalityDialogState,
  type CardinalityDialogTarget,
} from "./components/CardinalityModal";
import { KeyboardShortcutsModal } from "./components/KeyboardShortcutsModal";
import { SettingsModal } from "./components/settings/SettingsModal";
import { NotesModal } from "./components/NotesModal";
import { OnboardingGuide } from "./components/OnboardingGuide";
import { SqlReverseErPreview } from "./components/SqlReverseErPreview";
import { SqlReverseLogicalPreview } from "./components/SqlReverseLogicalPreview";
import { SqlReversePreviewFrame } from "./components/SqlReversePreviewFrame";
import { WorkspaceToastStack } from "./components/WorkspaceToastStack";
import { StudioIcon } from "./components/icons/StudioIcon";
import { Button, Field, Modal } from "./components/ui";
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
  CanvasViewportAction,
  CanvasViewportCommand,
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
import type { ProjectWorkspaceFile, WorkspaceOpenTab } from "./types/projectExplorer";
import type { EditorDiagnostic } from "./types/editor";
import { SqlPlaygroundManager } from "./features/sql-playground/SqlPlaygroundManager";
import { SqlPlaygroundWorkspace } from "./features/sql-playground/SqlPlaygroundWorkspace";
import { SqlExplorerPanel } from "./features/sql-playground/SqlExplorerPanel";
import {
  buildSqlPlaygroundSessionId,
  createImportedDatabaseSessionState,
  createSqlPlaygroundSessionState,
  downloadImportedSqliteDatabase,
  markImportedDatabaseExported,
  markImportedDatabaseRestored,
} from "./utils/sqlPlayground";
import {
  resolveSqlFileDatabaseName,
  resolveSqlPlaygroundSchema,
  stripSqlFileDatabaseContext,
} from "./utils/sqlFileWorkspace";
import { ImportedDatabaseWorkspace } from "./features/database-workspace/ImportedDatabaseWorkspace";
import { DatabaseCloseDialog } from "./features/database-workspace/DatabaseCloseDialog";
import { DatabaseReverseWizard } from "./features/database-workspace/reverse/DatabaseReverseWizard";
import {
  SQLITE_DATABASE_ACCEPT,
  SqliteFileValidationError,
  createImportedDatabaseSessionId,
  readAndValidateSqliteFile,
  validateSqliteFileMetadata,
} from "./features/database-workspace/importedDatabaseFile";
import type {
  DatabaseReverseApplyReport,
  DatabaseReverseApplyRequest,
} from "./features/database-workspace/databaseWorkspaceTypes";
import type {
  GeneratedSqlPlaygroundSessionState,
  ImportedSqlDatabaseSessionState,
} from "./features/sql-playground/sqlPlaygroundState";
import { createReverseExtrasSql } from "./features/database-workspace/reverse/sqliteMetadataToSqlSchemaModel";
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
import { ErsParseError, parseErsDiagram, serializeDiagramToErs } from "./utils/ers";
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
  getNodeConnectionSide,
  snapValue,
} from "./utils/geometry";
import {
  buildAttributeLayoutOptionsForHost,
  createAttributeForHost,
  distributeAttributesAroundHost,
  findDirectHostedAttributes,
  layoutIncrementallyConnectedAttribute,
} from "./utils/attributeLayout";
import { autoLayoutLogicalModel, normalizeLogicalModelGeometry } from "./utils/logicalLayout";
import { autoLayoutConceptualDiagram, autoLayoutConceptualSelection } from "./utils/conceptualLayout";
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
import {
  LOGICAL_SQL_DIALECT_OPTIONS,
  generateLogicalSql,
  type LogicalSqlDialect,
} from "./utils/logicalSql";
import { generateLogicalRelationalSchema } from "./utils/logicalRelationalSchema";
import { reverseSqlToDiagram, type SqlReverseDiagramResult } from "./utils/sqlReverseDiagram";
import { validateSqlReverseBetaSource } from "./utils/sqlReverseBetaValidation";
import { importSqlReverseSourceFile, updateSqlReverseSourceFile } from "./utils/sqlReverseWorkspace";
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
  DEFAULT_PROJECT_EXPLORER_WIDTH,
  MAX_PROJECT_EXPLORER_WIDTH,
  MIN_PROJECT_EXPLORER_WIDTH,
  addProjectFile,
  addProjectFolder,
  createEmptyProjectExplorerState,
  createProjectFromSchema,
  createSchemaWorkspaceFile,
  createTextWorkspaceFile,
  deleteProjectNode,
  ensureProjectFileExtension,
  getUniqueProjectNodeName,
  getValidMoveDestinations,
  moveNode,
  normalizeProjectNodeName,
  renameProjectNode,
  setProjectExplorerExpandedFolders,
  stripKnownProjectExtension,
  type ProjectExplorerState,
} from "./utils/projectExplorer";
import {
  applyProjectTabDirtyFileIds,
  closeProjectTab,
  ensureFileTabOpen,
  openWelcomeTab,
  markProjectTabDirty,
  normalizeProjectTabs,
  setActiveProjectTab,
  WELCOME_TAB_ID,
} from "./utils/projectTabs";
import { createCenteredViewportForDiagram } from "./utils/viewport";
import {
  SCHEMA_FILE_ACCEPT,
  SCHEMA_FILE_EXTENSION,
  SCHEMA_FILE_MIME_TYPE,
  createSchemaDocumentFromProjectState,
  parseSchemaFile,
  serializeSchemaFile,
} from "./utils/projectSchemaFile";
import {
  getProjectUncommittedChangeState,
  useProjectVersioning,
  type ProjectFileChange,
} from "./features/versioning/useProjectVersioning";
import {
  updateProjectSchemaFileIfContentChanged,
  type ProjectVersioningSettings,
} from "./features/versioning/projectCommitSnapshot";
import type { ProjectCommitTagInput } from "./features/versioning/projectVersioningMetadata";
import type { VersionCompareRef, VersionCompareScope } from "./features/versioning/projectVersionVisualDiff";
import {
  getValidationActivityPresentation,
  localizeValidationIssue,
  presentValidationIssue,
  validationIssueTargetExists,
} from "./utils/validationIssuePresentation";
import type { ValidationIssueAction } from "./utils/validationIssuePresentation";
import { computeValidationAutoFix } from "./utils/validationAutoFix";
import type { SqlReverseDialect, SqlReverseIssue, SqlUnsupportedStatement } from "./types/sqlReverse";
import {
  readSqlReverseDialectPreference,
  writeSqlReverseDialectPreference,
} from "./utils/sqlReverseDialectPreference";
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
import { APP_TITLE, APP_VERSION } from "./utils/appMeta";
import { useAppReleases } from "./features/releases/useAppReleases";

interface VersionCompareSession {
  left: VersionCompareRef;
  right: VersionCompareRef;
  scope?: VersionCompareScope;
}

type AppTranslator = (key: MessageKey, params?: TranslationParams) => string;

function createInitialSqlReverseWorkflowState(
  sourceSql = "",
  sourceFileId: string | null = null,
  sourceFileName?: string,
  dialect: SqlReverseDialect = readSqlReverseDialectPreference(),
): SqlReverseWorkflowState {
  return {
    step: "idle",
    sourceSql,
    sourceFileId,
    sourceFileName,
    dialect,
    result: null,
    issues: [],
    logicalIssues: [],
    tableCount: 0,
    unsupportedStatementCount: 0,
    unsupportedStatements: [],
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
    importedIdentifierKind?: "internal" | "external";
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
  sourceFileId: string | null;
  sourceFileName?: string;
  dialect: SqlReverseDialect;
  result: SqlReverseDiagramResult | null;
  issues: SqlReverseIssue[];
  logicalIssues: LogicalIssue[];
  tableCount: number;
  unsupportedStatementCount: number;
  unsupportedStatements: SqlUnsupportedStatement[];
  errorMessage: string;
  logicalViewport: Viewport;
  erViewport: Viewport;
  logicalSelection: LogicalSelection;
  erSelection: SelectionState;
  previewToken: number;
  isPreviewReady: boolean;
}

const ONBOARDING_STORAGE_KEY = "chen-er-diagram-studio:onboarding-v1:done";
/** Bersaglio dello skip link e id del landmark `main` del workspace. */
const WORKSPACE_MAIN_ID = "workspace-main";
const APP_BOOT_DELAY_MS = clampValue(Number.parseInt(import.meta.env.VITE_APP_BOOT_DELAY_MS ?? "900", 10) || 900, 700, 3200);

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
  importedIdentifierKind?: "internal" | "external";
}): string {
  return [part.relationshipId, part.sourceEntityId, part.importedIdentifierKind ?? "internal", part.importedIdentifierId].join("::");
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
  const appReleases = useAppReleases();
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
  const [logicalSqlDialect, setLogicalSqlDialect] = useState<LogicalSqlDialect>("generic");
  const [logicalCodePreviewMode, setLogicalCodePreviewMode] = useState<"sql" | "relational">("sql");
  const [logicalFitRequestToken, setLogicalFitRequestToken] = useState(0);
  const [erViewportCommand, setErViewportCommand] = useState<CanvasViewportCommand | null>(null);
  const [translationViewportCommand, setTranslationViewportCommand] = useState<CanvasViewportCommand | null>(null);
  const [logicalViewportCommand, setLogicalViewportCommand] = useState<CanvasViewportCommand | null>(null);
  const requestErViewportCommand = (action: CanvasViewportAction) =>
    setErViewportCommand((current) => ({ action, token: (current?.token ?? 0) + 1 }));
  const requestTranslationViewportCommand = (action: CanvasViewportAction) =>
    setTranslationViewportCommand((current) => ({ action, token: (current?.token ?? 0) + 1 }));
  const requestLogicalViewportCommand = (action: CanvasViewportAction) =>
    setLogicalViewportCommand((current) => ({ action, token: (current?.token ?? 0) + 1 }));
  const requestActiveViewportCommand = (action: CanvasViewportAction) => {
    if (diagramView === "translation") requestTranslationViewportCommand(action);
    else if (diagramView === "logical") requestLogicalViewportCommand(action);
    else requestErViewportCommand(action);
  };
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
    removeNotice: dismissNotice,
    pauseNoticeTimers,
    resumeNoticeTimers,
  } = useWorkspaceNotices({ formatErrorMessage: (message) => formatErrorFromRawMessage(message, t) });
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [versionCompareSession, setVersionCompareSession] = useState<VersionCompareSession | null>(null);
  const [, setRestoreDialogBusy] = useState(false);
  const [, setRestoreDialogError] = useState("");
  const [, setCommitDialogError] = useState("");
  const [commitDialogBusy, setCommitDialogBusy] = useState(false);
  const [sourceControlCommitMessage, setSourceControlCommitMessage] = useState("");
  const [selectedSourceCommitId, setSelectedSourceCommitId] = useState<string | null>(null);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [moveDialogNodeId, setMoveDialogNodeId] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
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
  const [codeDraft, setCodeDraft] = useState(() => initialSerializedCode);
  const [codeDirty, setCodeDirty] = useState(sessionBootstrap.codeDirty);
  const [codeDiagnostics, setCodeDiagnostics] = useState<EditorDiagnostic[]>([]);
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
  const [hasProject, setHasProject] = useState(sessionBootstrap.hasProject);
  const [projectExplorer, setProjectExplorer] = useState<ProjectExplorerState>(() =>
    normalizeProjectTabs({
      project: sessionBootstrap.project,
      files: sessionBootstrap.files,
      view: sessionBootstrap.explorerView,
    }),
  );
  const [openSqlPlaygroundSchemaIds, setOpenSqlPlaygroundSchemaIds] = useState<string[]>([]);
  const [activeSqlPlaygroundSchemaId, setActiveSqlPlaygroundSchemaId] = useState<string | null>(null);
  const [lastSqlPlaygroundSchemaId, setLastSqlPlaygroundSchemaId] = useState<string | null>(null);
  const [sqlFilePlaygroundConfigs, setSqlFilePlaygroundConfigs] = useState<Record<
    string,
    { databaseName: string; generatedSql: string }
  >>({});
  const [openImportedDatabaseSessionIds, setOpenImportedDatabaseSessionIds] = useState<string[]>([]);
  const [activeImportedDatabaseSessionId, setActiveImportedDatabaseSessionId] = useState<string | null>(null);
  const [manualSqlExplorerSessionId, setManualSqlExplorerSessionId] = useState<string | null>(null);
  const [databaseManagerRevision, setDatabaseManagerRevision] = useState(0);
  const [databaseOpeningName, setDatabaseOpeningName] = useState<string | null>(null);
  const [largeDatabaseFile, setLargeDatabaseFile] = useState<File | null>(null);
  const [databaseCloseSessionId, setDatabaseCloseSessionId] = useState<string | null>(null);
  const [databaseRestoreSessionId, setDatabaseRestoreSessionId] = useState<string | null>(null);
  const [databaseCloseBusy, setDatabaseCloseBusy] = useState(false);
  const [databaseReverseSessionId, setDatabaseReverseSessionId] = useState<string | null>(null);
  const [sqlExplorerQueryRequest, setSqlExplorerQueryRequest] = useState<{
    id: number;
    sessionId: string;
    query: string;
    execute: boolean;
    createDatabase?: boolean;
    databaseName?: string;
  } | null>(null);
  const sqlPlaygroundManagerRef = useRef<SqlPlaygroundManager | null>(null);
  const sqlPlaygroundManagerUnsubscribeRef = useRef<(() => void) | null>(null);
  const databaseCloseResolverRef = useRef<((closed: boolean) => void) | null>(null);
  const [activeActivityPanel, setActiveActivityPanel] = useState<ProjectActivityId>(() => {
    if (sessionBootstrap.codePanelOpen) return "code";
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem("builder:last-activity-panel");
      if (["file", "code", "reverse", "errors", "version", "sql-explorer", "export"].includes(stored ?? "")) {
        return stored as ProjectActivityId;
      }
    }
    return "file";
  });
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [onboardingStepState, setOnboardingStepState] = useState<OnboardingStepState>({
    entityCreated: false,
    relationshipCreated: false,
    connectionCreated: false,
    renamedNode: false,
  });

  const svgRef = useRef<SVGSVGElement>(null);
  const commandMenuReturnFocusRef = useRef<HTMLElement | null>(null);
  const projectFileInputRef = useRef<HTMLInputElement | null>(null);
  const schemaFileInputRef = useRef<HTMLInputElement | null>(null);
  const ersFileInputRef = useRef<HTMLInputElement | null>(null);
  const sqliteFileInputRef = useRef<HTMLInputElement | null>(null);
  const lastSerializedCodeRef = useRef(codeDraft);
  const codeDraftRef = useRef(codeDraft);
  const codeDirtyRef = useRef(codeDirty);
  const codeEditorFocusedRef = useRef(false);
  const lastCodeDiagnosticNoticeRef = useRef("");
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
  const lastSavedProjectExplorerRef = useRef(
    JSON.stringify(
      normalizeProjectTabs({
        project: sessionBootstrap.project,
        files: sessionBootstrap.files,
        view: sessionBootstrap.explorerView,
      }),
    ),
  );
  const hasUnsavedChangesRef = useRef(false);
  const hasUnexportedDatabaseChangesRef = useRef(false);
  const onboardingPreviousSnapshotRef = useRef<OnboardingSnapshot | null>(null);
  const latestSessionSnapshotRef = useRef<WorkspaceSessionSnapshot | null>(null);
  const restoredSessionNoticeShownRef = useRef(false);
  latestDiagramRef.current = history.present;

  const activeProjectFileId = hasProject ? projectExplorer.project.activeFileId ?? projectExplorer.view.activeFileId : null;
  const activeProjectFile = activeProjectFileId ? projectExplorer.files[activeProjectFileId] : undefined;
  const activeSchemaFile = activeProjectFile?.kind === "schema" ? activeProjectFile : null;
  const activeSqlPlaygroundSourceFile = activeSqlPlaygroundSchemaId
    ? projectExplorer.files[activeSqlPlaygroundSchemaId]
    : undefined;
  const sqlPlaygroundActive = activeSqlPlaygroundSourceFile?.kind === "schema"
    || activeSqlPlaygroundSourceFile?.kind === "sql";
  const importedDatabaseSessions = useMemo(() => {
    void databaseManagerRevision;
    const manager = sqlPlaygroundManagerRef.current;
    if (!manager) return [];
    return openImportedDatabaseSessionIds.flatMap((sessionId) => {
      const state = manager.getSessionState(sessionId);
      return state?.source.kind === "imported-sqlite" ? [state as ImportedSqlDatabaseSessionState] : [];
    });
  }, [databaseManagerRevision, openImportedDatabaseSessionIds]);
  const activeImportedDatabaseSession = activeImportedDatabaseSessionId
    ? importedDatabaseSessions.find((session) => session.sessionId === activeImportedDatabaseSessionId) ?? null
    : null;
  const databaseCloseSession = databaseCloseSessionId
    ? importedDatabaseSessions.find((session) => session.sessionId === databaseCloseSessionId) ?? null
    : null;
  const databaseRestoreSession = databaseRestoreSessionId
    ? importedDatabaseSessions.find((session) => session.sessionId === databaseRestoreSessionId) ?? null
    : null;
  const databaseReverseSession = databaseReverseSessionId
    ? importedDatabaseSessions.find((session) => session.sessionId === databaseReverseSessionId) ?? null
    : null;
  const importedDatabaseActive = Boolean(activeImportedDatabaseSession);
  const sqlExplorerSchemaResolution = resolveSqlPlaygroundSchema({
    files: projectExplorer.files,
    activePlaygroundSchemaId: activeSqlPlaygroundSchemaId ?? activeSchemaFile?.id ?? null,
    lastPlaygroundSchemaId: lastSqlPlaygroundSchemaId,
  });
  const sqlExplorerSchemaId = sqlExplorerSchemaResolution.status === "resolved"
    ? sqlExplorerSchemaResolution.schemaFileId
    : null;
  const sqlExplorerSchema = sqlExplorerSchemaId ? projectExplorer.files[sqlExplorerSchemaId] : undefined;
  const generatedSqlExplorerSourceFile = sqlPlaygroundActive
    ? activeSqlPlaygroundSourceFile
    : sqlExplorerSchema?.kind === "schema" ? sqlExplorerSchema : undefined;
  const generatedSqlExplorerSessionId = hasProject && generatedSqlExplorerSourceFile
    ? buildSqlPlaygroundSessionId(projectExplorer.project.id, generatedSqlExplorerSourceFile.id)
    : null;
  const availableSqlExplorerSessions = sqlPlaygroundManagerRef.current?.getSessionStates() ?? [];
  const sqlExplorerSessionId = activeImportedDatabaseSessionId
    ?? (sqlPlaygroundActive ? generatedSqlExplorerSessionId : null)
    ?? (manualSqlExplorerSessionId && availableSqlExplorerSessions.some((session) => session.sessionId === manualSqlExplorerSessionId)
      ? manualSqlExplorerSessionId
      : generatedSqlExplorerSessionId
        ?? availableSqlExplorerSessions[availableSqlExplorerSessions.length - 1]?.sessionId
        ?? null);
  const sqlExplorerSessionState = sqlExplorerSessionId
    ? sqlPlaygroundManagerRef.current?.getSessionState(sqlExplorerSessionId)
    : undefined;
  const sqlExplorerDisplayName = sqlExplorerSessionState?.source.kind === "imported-sqlite"
    ? sqlExplorerSessionState.source.fileName
    : sqlExplorerSessionState?.source.kind === "generated-schema"
      ? sqlExplorerSessionState.source.schemaName
      : sqlExplorerSchema?.kind === "schema" ? sqlExplorerSchema.name : null;
  const hasOpenSchema = Boolean(activeSchemaFile);
  const activeProjectTab = hasProject && projectExplorer.view.activeTabId
    ? projectExplorer.view.openTabs.find((tab) => tab.id === projectExplorer.view.activeTabId)
    : undefined;
  const welcomeTabActive = activeProjectTab?.kind === "welcome";
  const hasProjectTabsOpen = hasProject && projectExplorer.view.openTabs.length > 0;
  const hasDatabaseWorkspace = importedDatabaseSessions.length > 0;
  const hasWorkspaceShell = hasProject || hasDatabaseWorkspace;
  hasUnexportedDatabaseChangesRef.current = importedDatabaseSessions.some((session) => session.hasUnexportedChanges);
  const projectFileCount = hasProject ? Object.keys(projectExplorer.files).length : 0;
  const projectFolderCount = hasProject ? projectExplorer.project.fileTree.filter((node) => node.kind === "folder").length : 0;
  const projectFilePaths = useMemo(() => {
    const nodesById = new Map(projectExplorer.project.fileTree.map((node) => [node.id, node]));
    const result: Record<string, string> = {};
    projectExplorer.project.fileTree.forEach((node) => {
      if (!node.fileId) return;
      const segments = [node.name];
      let parentId = node.parentId;
      while (parentId && parentId !== projectExplorer.project.rootId) {
        const parent = nodesById.get(parentId);
        if (!parent) break;
        segments.unshift(parent.name);
        parentId = parent.parentId;
      }
      result[node.fileId] = segments.join("/");
    });
    return result;
  }, [projectExplorer.project.fileTree, projectExplorer.project.rootId]);
  const commandPaletteProjectFiles = useMemo(
    () => projectExplorer.project.fileTree.flatMap((node) => {
      if (!node.fileId) return [];
      const file = projectExplorer.files[node.fileId];
      return file ? [file] : [];
    }),
    [projectExplorer.files, projectExplorer.project.fileTree],
  );
  const issues = hasProject && hasOpenSchema ? validateDiagram(history.present) : [];
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
    window.localStorage.setItem("builder:last-activity-panel", activeActivityPanel);
  }, [activeActivityPanel]);

  useEffect(() => () => {
    sqlPlaygroundManagerUnsubscribeRef.current?.();
    sqlPlaygroundManagerUnsubscribeRef.current = null;
    void sqlPlaygroundManagerRef.current?.dispose();
    sqlPlaygroundManagerRef.current = null;
  }, []);

  useEffect(() => {
    if (!identifierSelection) {
      return;
    }

    if (!identifierSelectionExists(history.present, identifierSelection)) {
      setIdentifierSelection(null);
    }
  }, [history.present, identifierSelection]);

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
  const logicalSqlRequested =
    hasProject &&
    diagramView === "logical" &&
    logicalStage === "schema" &&
    (logicalPanelMode === "sql" || activeActivityPanel === "code");
  const canShowLogicalSqlCode =
    logicalSqlRequested &&
    logicalGenerated &&
    logicalHistory.present.model.tables.length > 0;
  const logicalSqlCode = useMemo(
    () => generateLogicalSql(logicalHistory.present.model, { dialect: logicalSqlDialect }),
    [logicalHistory.present.model, logicalSqlDialect],
  );
  const sqlPlaygroundSchemaCode = useMemo(
    () => generateLogicalSql(logicalHistory.present.model, { dialect: "sqlite", quoteIdentifiers: true }),
    [logicalHistory.present.model],
  );
  const logicalRelationalSchemaCode = useMemo(
    () => generateLogicalRelationalSchema(logicalHistory.present.model),
    [logicalHistory.present.model],
  );
  const logicalDisplayedCode = logicalCodePreviewMode === "sql" ? logicalSqlCode : logicalRelationalSchemaCode;
  const codePanelMode: "ers" | "sql" | "relational" = canShowLogicalSqlCode ? logicalCodePreviewMode : "ers";
  const codePanelContent =
    codePanelMode === "sql" ? logicalSqlCode : codePanelMode === "relational" ? logicalRelationalSchemaCode : codeDraft;
  const codePanelEditable = codePanelMode === "ers" && mode === "edit";
  const codePanelDiagnostics = codePanelMode === "ers" ? codeDiagnostics : [];
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
    () => {
      const syncedProject = syncActiveSchemaToProject(projectExplorer);
      return createProjectCommitSnapshot({
        project: syncedProject.project,
        files: syncedProject.files,
        explorerView: syncedProject.view,
        activeFileId: syncedProject.project.activeFileId ?? syncedProject.view.activeFileId,
        activeWorkspace: {
          diagramView,
          viewport,
          translationViewport,
          logicalViewport,
          selection,
          translationSelection,
          logicalSelection,
          codeDraft,
          codeDirty,
          showDiagnostics,
        },
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
      });
    },
    [
      codeDirty,
      codeDraft,
      currentProjectWorkspaceState,
      diagramView,
      history.present,
      logicalGenerated,
      logicalHistory.present,
      logicalStage,
      logicalSelection,
      logicalViewport,
      projectExplorer,
      projectVersioning.versioning,
      selection,
      showDiagnostics,
      translationHistory.present,
      translationSelection,
      translationViewport,
      viewport,
    ],
  );
  const versioningChangeState = useMemo(
    () => getProjectUncommittedChangeState(projectVersioning.versioning, currentProjectCommitSnapshot),
    [currentProjectCommitSnapshot, projectVersioning.versioning],
  );
  const hasVersioningUncommittedChanges = versioningChangeState.hasChanges;
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
  const releaseAnnouncementBlocked =
    commandMenuOpen ||
    keyboardShortcutsOpen ||
    settingsOpen ||
    aboutOpen ||
    appReleases.releaseCenterOpen ||
    introOpen ||
    confirmDialog !== null ||
    promptDialog !== null ||
    cardinalityDialog !== null ||
    mixedIdentifierDialog !== null ||
    generalizationGroupDialog !== null ||
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
    if (!sessionBootstrap.hasProject || !sessionBootstrap.restored || restoredSessionNoticeShownRef.current) {
      return;
    }

    restoredSessionNoticeShownRef.current = true;
    setStatusMessage(t("workspace.restoredSession"));
  }, [sessionBootstrap.restored]);

  useEffect(() => {
    if (!hasProject) {
      hasUnsavedChangesRef.current = false;
      return;
    }

    const currentCode = codeDirtyRef.current ? codeDraftRef.current : serializeDiagramToErs(history.present);
    const currentVersioning = JSON.stringify(projectVersioning.versioning);
    const currentWorkspace = JSON.stringify(currentProjectWorkspaceState);
    const currentProjectExplorer = JSON.stringify(projectExplorer);
    hasUnsavedChangesRef.current =
      serializeDiagram(history.present) !== lastSavedDiagramRef.current ||
      currentCode !== lastSavedCodeRef.current ||
      currentVersioning !== lastSavedVersioningRef.current ||
      currentWorkspace !== lastSavedWorkspaceRef.current ||
      currentProjectExplorer !== lastSavedProjectExplorerRef.current;
  }, [hasProject, history.present, codeDraft, currentProjectWorkspaceState, projectExplorer, projectVersioning.versioning]);

  useEffect(() => {
    if (!hasProject) {
      latestSessionSnapshotRef.current = serializeWorkspaceSessionSnapshot({
        workspaceState: "no-project",
      });
      return;
    }

    latestSessionSnapshotRef.current = serializeWorkspaceSessionSnapshot({
      workspaceState: "project",
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
      project: projectExplorer.project,
      files: projectExplorer.files,
      explorerView: projectExplorer.view,
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
    projectExplorer,
    hasProject,
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
    projectExplorer,
    hasProject,
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
      setStatus(t("workspace.translationRealigned"));
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
      setStatus(t("workspace.logicalRealigned"));
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
      if (!hasUnsavedChangesRef.current && !hasUnexportedDatabaseChangesRef.current) {
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
    if (!hasProject) {
      return;
    }

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
    setStatusMessage(t("workspace.tourActive"));
  }, [diagramView, hasProject, onboardingOpen, sessionBootstrap.restored]);

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
    setStatus(t("workspace.tourClosed"));
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

  function markProjectExplorerSaved(state: ProjectExplorerState) {
    lastSavedProjectExplorerRef.current = JSON.stringify(state);
  }

  /**
   * Azzeramento della ristrutturazione: scarta lavoro applicato, quindi passa
   * dal dialogo dell'app e non da `window.confirm`, che ignora tema, focus
   * trap e traduzioni della shell.
   */
  function confirmResetTranslationWork(): Promise<boolean> {
    return requestConfirmDialog({
      title: t("dialogs.resetTranslation.title"),
      message: t("workspace.confirmResetTranslationWork"),
      confirmLabel: t("dialogs.resetTranslation.confirm"),
      cancelLabel: t("dialogs.unsavedChanges.cancel"),
      danger: true,
    });
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
      danger: true,
    });
  }

  function openCommandMenu() {
    const activeElement = typeof document === "undefined" ? null : document.activeElement;
    if (activeElement instanceof HTMLElement && !activeElement.closest('[data-testid="command-menu"]')) {
      commandMenuReturnFocusRef.current = activeElement;
    }
    setAboutOpen(false);
    appReleases.closeReleaseCenter();
    setIntroOpen(false);
    setKeyboardShortcutsOpen(false);
    setNotesPanelOpen(false);
    setCommandMenuOpen(true);
  }

  function closeCommandMenu(restoreFocus = true) {
    setCommandMenuOpen(false);
    if (!restoreFocus) return;
    const returnTarget = commandMenuReturnFocusRef.current;
    window.requestAnimationFrame(() => {
      if (returnTarget?.isConnected) returnTarget.focus();
    });
  }

  function openKeyboardShortcuts() {
    setCommandMenuOpen(false);
    setAboutOpen(false);
    appReleases.closeReleaseCenter();
    setIntroOpen(false);
    setKeyboardShortcutsOpen(true);
  }

  function openReleaseCenter() {
    setAboutOpen(false);
    setCommandMenuOpen(false);
    setKeyboardShortcutsOpen(false);
    setIntroOpen(false);
    appReleases.openReleaseCenter();
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
      setStatus(t("workspace.tourStep1"));
      return;
    }

    if (stepId === "create-relationship") {
      setTool("relationship");
      setStatus(t("workspace.tourStep2"));
      return;
    }

    if (stepId === "create-connection") {
      setTool("connector");
      setStatus(t("workspace.tourStep3"));
      return;
    }

    setTool("select");
    setStatus(t("workspace.tourStep4"));
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
    setStatusMessage(getLocalizedValidationIssueMessage(issue));
    selectIssueTarget(issue);
  }

  function getLocalizedValidationIssueMessage(issue: ValidationIssue): string {
    return localizeValidationIssue(issue, history.present, t);
  }

  function issueTargetExists(issue: ValidationIssue): boolean {
    return validationIssueTargetExists(history.present, issue);
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

  // Fase H — esecuzione delle azioni di correzione guidata. La presentazione (validationIssuePresentation)
  // e' pura e dice *quale* azione offrire; qui la si esegue. Auto-fix = singolo undo via commitDiagram.
  function handleValidationIssueAction(issue: ValidationIssue, action: ValidationIssueAction) {
    if (action.kind === "auto") {
      applyValidationAutoFix(issue, action);
      return;
    }

    // navigate: porta l'utente nel posto giusto senza decidere la semantica al suo posto.
    handleIssueNotice(issue);
    if (action.type === "open-cardinality") {
      handleOpenCardinalityControl(issue.targetId);
    }
  }

  function applyValidationAutoFix(issue: ValidationIssue, action: ValidationIssueAction) {
    const previousDiagram = history.present;

    if (action.type === "create-attribute") {
      // Aggiunge un attributo di default all'entita/host: risolve il problema e resta un singolo undo.
      const result = createAttributeForHost(previousDiagram, issue.targetId);
      if (!result) {
        return;
      }
      commitDiagram(result.diagram, previousDiagram);
      setSelection({ nodeIds: [result.attributeId], edgeIds: [] });
      setTool("select");
      notifyValidationAutoFix("workspace.validationFix.attributeAdded");
      return;
    }

    const nextDiagram = computeValidationAutoFix(previousDiagram, issue, action.type);
    if (!nextDiagram) {
      return;
    }

    commitDiagram(nextDiagram, previousDiagram);

    if (action.type === "delete-edge") {
      setSelection({ nodeIds: [], edgeIds: [] });
      notifyValidationAutoFix("workspace.validationFix.linkRemoved");
    } else if (action.type === "delete-attribute") {
      setSelection({ nodeIds: [], edgeIds: [] });
      notifyValidationAutoFix("workspace.validationFix.attributeRemoved");
    } else if (action.type === "clear-attribute-cardinality") {
      setSelection({ nodeIds: [issue.targetId], edgeIds: [] });
      notifyValidationAutoFix("workspace.validationFix.cardinalityRemoved");
    }
  }

  function notifyValidationAutoFix(
    messageKey:
      | "workspace.validationFix.linkRemoved"
      | "workspace.validationFix.attributeRemoved"
      | "workspace.validationFix.cardinalityRemoved"
      | "workspace.validationFix.attributeAdded",
  ) {
    const message = t(messageKey);
    setStatus(message);
    showSuccessNotice(message, {
      actionLabel: t("canvas.autoLayout.undoAction"),
      onAction: handleUndoAction,
    });
  }

  function handleToggleFocusMode() {
    setFocusMode((current) => {
      const next = !current;
      setStatus(next ? t("workspace.focusModeOn") : t("workspace.focusModeOff"));
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
    setProjectExplorer((current) => {
      const sourceFileId = sqlReverseWorkflow.sourceFileId;
      return updateSqlReverseSourceFile(current, sourceFileId, value);
    });
    hasUnsavedChangesRef.current = true;
  }

  function handleOpenSqlReverseWorkflow() {
    if (!hasProject) {
      setStatusWarning(t("noProjectWelcome.title"));
      return;
    }

    if (diagramView !== "er") {
      setStatusWarning(t("sqlReverse.app.onlyErView"));
      return;
    }

    setFocusMode(false);
    closeTechnicalPanel();
    setActiveActivityPanel("reverse");
    setWorkspaceActivityOpen(true);
    setSqlReverseWorkflow((current) => ({
      ...createInitialSqlReverseWorkflowState(current.sourceSql, current.sourceFileId, current.sourceFileName),
      step: "idle",
    }));
  }

  function handleCancelSqlReverseWorkflow() {
    setSqlReverseWorkflow((current) => createInitialSqlReverseWorkflowState(
      current.sourceSql,
      current.sourceFileId,
      current.sourceFileName,
    ));
    setStatusWarning(t("sqlReverse.app.importCancelled"));
  }

  function analyzeSqlReverseSource(
    sourceSql: string,
    dialect: SqlReverseDialect,
    sourceFileId: string | null,
    sourceFileName?: string,
  ) {
    const validation = validateSqlReverseBetaSource(sourceSql, { dialect });
    const validationMessage = validation.errorCode === "empty-source"
      ? t("sqlReverse.app.emptyFile")
      : validation.errorCode === "missing-create-table"
        ? t("sqlReverse.app.fileNotCreateTable")
        : validation.errorCode === "unsupported-statement"
          ? t("sqlReverse.app.betaCreateTableOnly")
          : "";
    if (validation.normalizedSql && validation.normalizedSql !== sourceSql) {
      setProjectExplorer((current) => {
        return updateSqlReverseSourceFile(current, sourceFileId, validation.normalizedSql);
      });
    }
    if (!validation.ok) {
      setSqlReverseWorkflow(() => ({
        ...createInitialSqlReverseWorkflowState(
          validation.normalizedSql || sourceSql,
          sourceFileId,
          sourceFileName,
          dialect,
        ),
        result: null,
        issues: validation.issues,
        logicalIssues: [],
        tableCount: 0,
        unsupportedStatementCount: validation.unsupportedStatementCount,
        unsupportedStatements: validation.unsupportedStatements,
        errorMessage: validationMessage,
        isPreviewReady: false,
      }));
      setStatusWarning(validationMessage);
      return;
    }

    try {
      const result = reverseSqlToDiagram(validation.normalizedSql, { sourceName: t("sqlReverse.input.title"), dialect });
      const hasSqlErrors = result.issues.some((issue) => issue.level === "error");
      const hasValidDiagram = result.diagram.nodes.length > 0;

      if (result.sqlModel.unsupportedStatements.length > 0) {
        const message = t("sqlReverse.app.betaCreateTableOnly");
        setSqlReverseWorkflow(() => ({
          ...createInitialSqlReverseWorkflowState(
            validation.normalizedSql,
            sourceFileId,
            sourceFileName,
            dialect,
          ),
          sourceSql: validation.normalizedSql,
          result: null,
          issues: result.issues,
          logicalIssues: result.logicalIssues,
          tableCount: result.sqlModel.tables.length,
          unsupportedStatementCount: result.sqlModel.unsupportedStatements.length,
          unsupportedStatements: result.sqlModel.unsupportedStatements,
          errorMessage: message,
          isPreviewReady: false,
        }));
        setStatusWarning(message);
        return;
      }

      if (hasSqlErrors || !hasValidDiagram) {
        setSqlReverseWorkflow(() => ({
          ...createInitialSqlReverseWorkflowState(
            validation.normalizedSql,
            sourceFileId,
            sourceFileName,
            dialect,
          ),
          sourceSql: validation.normalizedSql,
          result: null,
          issues: result.issues,
          logicalIssues: result.logicalIssues,
          tableCount: result.sqlModel.tables.length,
          unsupportedStatementCount: result.sqlModel.unsupportedStatements.length,
          unsupportedStatements: result.sqlModel.unsupportedStatements,
          errorMessage: t("sqlReverse.app.sqlNotImportable"),
          isPreviewReady: true,
        }));
        setStatusError(t("sqlReverse.app.sqlNotImportable"));
        return;
      }

      setSqlReverseWorkflow((current) => ({
        ...createInitialSqlReverseWorkflowState(
          validation.normalizedSql,
          sourceFileId,
          sourceFileName,
          dialect,
        ),
        step: "logical-preview",
        sourceSql: validation.normalizedSql,
        result,
        issues: result.issues,
        logicalIssues: result.logicalIssues,
        tableCount: result.sqlModel.tables.length,
        unsupportedStatementCount: result.sqlModel.unsupportedStatements.length,
        unsupportedStatements: result.sqlModel.unsupportedStatements,
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
      setSqlReverseWorkflow(() => ({
        ...createInitialSqlReverseWorkflowState(sourceSql, sourceFileId, sourceFileName, dialect),
        result: null,
        issues: [parseIssue],
        logicalIssues: [],
        tableCount: 0,
        unsupportedStatementCount: 0,
        unsupportedStatements: [],
        errorMessage: message,
        isPreviewReady: true,
      }));
      setStatusError(t("sqlReverse.app.sqlNotImportable"));
    }
  }

  function handleAnalyzeSqlReverseWorkflow(dialectOverride?: SqlReverseDialect) {
    analyzeSqlReverseSource(
      sqlReverseWorkflow.sourceSql,
      dialectOverride ?? sqlReverseWorkflow.dialect,
      sqlReverseWorkflow.sourceFileId,
      sqlReverseWorkflow.sourceFileName,
    );
  }

  function handleStartSqlReverseFromFile(file: ProjectWorkspaceFile) {
    if (file.kind !== "sql") return;
    setFocusMode(false);
    closeTechnicalPanel();
    setWorkspaceActivityOpen(false);
    analyzeSqlReverseSource(file.content, sqlReverseWorkflow.dialect, file.id, file.name);
  }

  function handleSqlReverseDialectChange(dialect: SqlReverseDialect) {
    if (dialect === sqlReverseWorkflow.dialect) {
      return;
    }
    writeSqlReverseDialectPreference(dialect);
    setSqlReverseWorkflow((current) => ({ ...current, dialect }));
    // Se un'analisi è già stata eseguita, ri-analizzo subito col nuovo dialetto; altrimenti
    // memorizzo solo la scelta (verrà usata al prossimo "Analizza").
    const alreadyAnalyzed =
      sqlReverseWorkflow.isPreviewReady
      || sqlReverseWorkflow.result != null
      || sqlReverseWorkflow.issues.length > 0
      || sqlReverseWorkflow.errorMessage.length > 0;
    if (alreadyAnalyzed && sqlReverseWorkflow.sourceSql.trim().length > 0) {
      handleAnalyzeSqlReverseWorkflow(dialect);
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
      danger: true,
    });
    if (!confirmed) {
      setStatusWarning(t("sqlReverse.app.importCancelled"));
      return;
    }

    const warningCount = preview.issues.filter((issue) => issue.level === "warning").length;
    const translationWorkspace = createEmptyErTranslationWorkspace(preview.diagram);
    const logicalWorkspace = updateLogicalWorkspaceModel(
      translationWorkspace.translatedDiagram,
      createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram),
      preview.logicalModel,
    );
    const synced = syncActiveSchemaToProject();
    const sourceSqlFile = sqlReverseWorkflow.sourceFileId ? synced.files[sqlReverseWorkflow.sourceFileId] : undefined;
    const generatedName = getUniqueProjectNodeName(
      synced.project,
      synced.project.rootId,
      ensureProjectFileExtension(
        sourceSqlFile?.name ? stripKnownProjectExtension(sourceSqlFile.name) : t("sqlReverse.generatedSchemaName"),
        "schema",
      ),
    );
    const schema = createSchemaDocumentFromProjectState({
      diagram: preview.diagram,
      translationWorkspace,
      logicalWorkspace,
      logicalGenerated: true,
      logicalStage: "schema",
      diagramView: "er",
      viewport: createCenteredViewportForDiagram(preview.diagram),
      translationViewport: createCenteredViewportForDiagram(translationWorkspace.translatedDiagram),
      logicalViewport: DEFAULT_VIEWPORT,
      workspace: {
        ...currentProjectWorkspaceState,
        tool: "select",
        selection: { nodeIds: [], edgeIds: [] },
        translationSelection: { nodeIds: [], edgeIds: [] },
        logicalSelection: { ...EMPTY_LOGICAL_SELECTION },
        codeDraft: serializeDiagramToErs(preview.diagram),
        codeDirty: false,
      },
    });
    const schemaFile = createSchemaWorkspaceFile(generatedName, schema);
    const result = addProjectFile(synced, synced.project.rootId, schemaFile);
    if (!result.ok) {
      setStatusWarning(t(`projectExplorer.errors.${result.reason}`));
      return;
    }

    setSqlReverseWorkflow((current) => createInitialSqlReverseWorkflowState(
      current.sourceSql,
      current.sourceFileId,
      current.sourceFileName,
    ));
    openSchemaWorkspaceFile(schemaFile.id, markProjectTabDirty(ensureFileTabOpen(result.state, schemaFile.id), schemaFile.id, true), { center: true });
    setStatus(
      warningCount > 0
        ? t("sqlReverse.app.importedWithWarnings", { count: warningCount })
        : t("sqlReverse.schemaCreatedFromSql", { name: schemaFile.name }),
    );
  }

  async function handleLoadSqlReverseFile(file: File) {
    const fileName = file.name || "schema.sql";
    const extensionOk = fileName.toLowerCase().endsWith(".sql");
    try {
      const text = await file.text();
      const synced = syncActiveSchemaToProject();
      const result = importSqlReverseSourceFile(synced, fileName, text);
      if (!result.ok) {
        setStatusWarning(t(`projectExplorer.errors.${result.reason}`));
        return;
      }
      applyProjectExplorerState(result.state);
      setActiveActivityPanel("reverse");
      setWorkspaceActivityOpen(true);
      setSqlReverseWorkflow((current) => ({
        ...createInitialSqlReverseWorkflowState(text, result.binding.sourceFileId, result.binding.sourceFileName),
        step: current.step === "logical-preview" || current.step === "er-preview" ? current.step : "idle",
      }));
      hasUnsavedChangesRef.current = true;

      if (!text.trim()) {
        setStatusWarning(t("sqlReverse.app.emptyFile"));
        return;
      }

      if (!extensionOk && !/\bCREATE\s+TABLE\b/i.test(text)) {
        setStatusWarning(t("sqlReverse.app.fileNotCreateTable"));
        return;
      }

      setStatusSuccess(t("sqlReverse.sqlImportCreatedFile", { name: result.binding.sourceFileName }));
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : t("sqlReverse.app.fileReadError"));
    }
  }

  function handleClearSqlReverse() {
    setSqlReverseWorkflow(createInitialSqlReverseWorkflowState());
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

  function handleLogicalPanelModeChange(nextMode: "review" | "sql") {
    if (nextMode === "review") {
      setLogicalPanelMode("review");
      return;
    }

    if (!logicalGenerated || logicalHistory.present.model.tables.length === 0) {
      setLogicalPanelMode("review");
      setStatusWarning(t("codePanel.noLogicalSql"));
      return;
    }

    setLogicalStage("schema");
    setLogicalPanelMode("sql");
    setActiveActivityPanel("code");
    setWorkspaceActivityOpen(true);
    setCodePanelOpen(true);
  }

  function handleOpenSqlStage() {
    const logicalAccess = canOpenLogicalView(translationHistory.present);
    if (!logicalAccess.allowed) {
      setDiagramView("translation");
      setStatusWarning(logicalAccess.reason ?? t("logical.designer.completeBeforeSchema"));
      return;
    }

    if (!logicalGenerated) {
      handleDiagramViewChange("logical");
      setStatusWarning(t("codePanel.noLogicalSql"));
      return;
    }

    setDiagramView("logical");
    handleLogicalPanelModeChange("sql");
  }

  function getSqlPlaygroundManager(): SqlPlaygroundManager {
    if (!sqlPlaygroundManagerRef.current) {
      const manager = new SqlPlaygroundManager();
      sqlPlaygroundManagerRef.current = manager;
      sqlPlaygroundManagerUnsubscribeRef.current = manager.subscribe((event) => {
        if (event.type !== "session-state-changed") return;
        if (manager.getSessionState(event.sessionId)?.source.kind !== "imported-sqlite") return;
        queueMicrotask(() => setDatabaseManagerRevision((current) => current + 1));
      });
    }
    return sqlPlaygroundManagerRef.current;
  }

  async function handleImportSqlWithoutProject() {
    if (hasProject) {
      handleOpenSqlReverseWorkflow();
      return;
    }
    await handleNewProject();
    setFocusMode(false);
    closeTechnicalPanel();
    setActiveActivityPanel("reverse");
    setWorkspaceActivityOpen(true);
    setSqlReverseWorkflow(createInitialSqlReverseWorkflowState());
  }

  function handleOpenSqliteDatabaseRequest() {
    sqliteFileInputRef.current?.click();
  }

  function databaseFileErrorMessage(error: unknown): string {
    if (error instanceof SqliteFileValidationError) {
      if (error.code === "empty-file") return t("databaseWorkspace.errors.emptyFile");
      if (error.code === "too-large") return t("databaseWorkspace.errors.tooLarge");
      if (error.code === "wal-file" || error.code === "shm-file") return t("databaseWorkspace.errors.walShm");
      return t("databaseWorkspace.errors.invalidFile");
    }
    return error instanceof Error ? error.message : t("databaseWorkspace.errors.openFailed");
  }

  async function openSqliteDatabase(file: File): Promise<void> {
    setDatabaseOpeningName(file.name);
    try {
      const bytes = await readAndValidateSqliteFile(file);
      const manager = getSqlPlaygroundManager();
      const sqliteVersion = await manager.initialize();
      const sessionId = createImportedDatabaseSessionId();
      const openedAt = new Date().toISOString();
      const opened = await manager.openDatabase({
        sessionId,
        fileName: file.name,
        fileSize: file.size,
        bytes,
      });
      manager.setSessionState(createImportedDatabaseSessionState({
        sessionId,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        openedAt,
        sqliteVersion,
        schemaSignature: opened.schemaSignature,
      }));
      setOpenImportedDatabaseSessionIds((current) => [...current, sessionId]);
      setActiveImportedDatabaseSessionId(sessionId);
      setActiveSqlPlaygroundSchemaId(null);
      setManualSqlExplorerSessionId(sessionId);
      setStatusSuccess(t("databaseWorkspace.opened", { name: file.name }));
    } catch (error) {
      setStatusError(databaseFileErrorMessage(error));
    } finally {
      setDatabaseOpeningName(null);
      setLargeDatabaseFile(null);
    }
  }

  function handleSqliteDatabaseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const validation = validateSqliteFileMetadata(file.name, file.size);
    if (!validation.ok) {
      setStatusError(databaseFileErrorMessage(new SqliteFileValidationError(validation.code ?? "invalid-header")));
      return;
    }
    if (validation.warning) {
      setLargeDatabaseFile(file);
      return;
    }
    void openSqliteDatabase(file);
  }

  async function closeImportedDatabaseSession(sessionId: string): Promise<void> {
    await sqlPlaygroundManagerRef.current?.closeSession(sessionId);
    const remaining = openImportedDatabaseSessionIds.filter((id) => id !== sessionId);
    setOpenImportedDatabaseSessionIds(remaining);
    setActiveImportedDatabaseSessionId((current) => current === sessionId ? remaining[remaining.length - 1] ?? null : current);
    setManualSqlExplorerSessionId((current) => current === sessionId ? null : current);
    setDatabaseCloseSessionId(null);
    setDatabaseReverseSessionId((current) => current === sessionId ? null : current);
  }

  async function requestImportedDatabaseClose(sessionId: string): Promise<boolean> {
    const state = sqlPlaygroundManagerRef.current?.getSessionState(sessionId);
    if (state?.source.kind !== "imported-sqlite") return true;
    if (!(state as ImportedSqlDatabaseSessionState).hasUnexportedChanges) {
      await closeImportedDatabaseSession(sessionId);
      return true;
    }
    return new Promise<boolean>((resolve) => {
      databaseCloseResolverRef.current = resolve;
      setDatabaseCloseSessionId(sessionId);
    });
  }

  function resolveImportedDatabaseClose(closed: boolean) {
    const resolve = databaseCloseResolverRef.current;
    databaseCloseResolverRef.current = null;
    setDatabaseCloseSessionId(null);
    resolve?.(closed);
  }

  async function exportImportedDatabaseSession(sessionId: string): Promise<boolean> {
    const manager = sqlPlaygroundManagerRef.current;
    const state = manager?.getSessionState(sessionId);
    if (!manager || state?.source.kind !== "imported-sqlite") return false;
    try {
      const bytes = await manager.exportDatabase(sessionId);
      downloadImportedSqliteDatabase(bytes, state.source.fileName, (state as ImportedSqlDatabaseSessionState).hasSessionChanges);
      manager.setSessionState(markImportedDatabaseExported(state as ImportedSqlDatabaseSessionState));
      return true;
    } catch (error) {
      setStatusError(databaseFileErrorMessage(error));
      return false;
    }
  }

  async function restoreImportedDatabaseSession(sessionId: string): Promise<boolean> {
    const manager = sqlPlaygroundManagerRef.current;
    const state = manager?.getSessionState(sessionId);
    if (!manager || state?.source.kind !== "imported-sqlite") return false;
    manager.setSessionState({ ...(state as ImportedSqlDatabaseSessionState), status: "restoring", error: null });
    try {
      const restored = await manager.restoreDatabase(sessionId);
      manager.setSessionState(markImportedDatabaseRestored(state as ImportedSqlDatabaseSessionState, restored.schemaSignature));
      setDatabaseRestoreSessionId(null);
      return true;
    } catch (error) {
      manager.setSessionState({
        ...(state as ImportedSqlDatabaseSessionState),
        status: "runtime-error",
        error: {
          operation: "restore-database",
          message: databaseFileErrorMessage(error),
          recoverable: true,
        },
      });
      setStatusError(databaseFileErrorMessage(error));
      return false;
    }
  }

  function handleStartDatabaseReverse(sessionId: string) {
    setDatabaseReverseSessionId(sessionId);
  }

  function handleSqlExplorerSessionChange(sessionId: string) {
    const session = sqlPlaygroundManagerRef.current?.getSessionState(sessionId);
    if (!session) return;
    setManualSqlExplorerSessionId(sessionId);
    if (session.source.kind === "imported-sqlite") {
      setActiveImportedDatabaseSessionId(sessionId);
      setActiveSqlPlaygroundSchemaId(null);
      return;
    }
    const file = projectExplorer.files[session.source.schemaFileId];
    if (file?.kind === "schema") {
      openSchemaWorkspaceFile(file.id, syncActiveSchemaToProject());
      setLastSqlPlaygroundSchemaId(file.id);
    } else if (file?.kind === "sql") {
      setProjectExplorer(ensureFileTabOpen(syncActiveSchemaToProject(), file.id));
    } else {
      return;
    }
    setOpenSqlPlaygroundSchemaIds((current) => current.includes(file.id) ? current : [...current, file.id]);
    setActiveSqlPlaygroundSchemaId(file.id);
    setActiveImportedDatabaseSessionId(null);
  }

  function openGeneratedSqlPlaygroundQuery(
    schemaFileId: string,
    schemaName: string,
    query: string,
    execute: boolean,
    options: { createDatabase?: boolean; databaseName?: string } = {},
  ) {
    const synced = syncActiveSchemaToProject();
    if (activeSchemaFile?.id !== schemaFileId) {
      openSchemaWorkspaceFile(schemaFileId, synced);
    }

    const manager = getSqlPlaygroundManager();
    const sessionId = buildSqlPlaygroundSessionId(projectExplorer.project.id, schemaFileId);
    const existing = manager.getSessionState(sessionId);
    const seeded = existing?.source.kind === "generated-schema"
      ? { ...existing, query }
      : {
          ...createSqlPlaygroundSessionState({
            sessionId,
            projectId: projectExplorer.project.id,
            schemaFileId,
            schemaName,
            currentGeneratedChecksum: "",
          }),
          query,
        };
    manager.setSessionState(seeded);
    activateSqlPlayground(schemaFileId, schemaName);
    setSqlExplorerQueryRequest((current) => ({
      id: (current?.id ?? 0) + 1,
      sessionId,
      query,
      execute,
      ...options,
    }));
  }

  function handleOpenSqlExplorerQuery(sessionId: string, query: string, execute: boolean) {
    const session = sqlPlaygroundManagerRef.current?.getSessionState(sessionId);
    if (!session) return;
    if (session.source.kind === "imported-sqlite") {
      setActiveImportedDatabaseSessionId(sessionId);
      setActiveSqlPlaygroundSchemaId(null);
      setSqlExplorerQueryRequest((current) => ({
        id: (current?.id ?? 0) + 1,
        sessionId,
        query,
        execute,
      }));
    } else {
      const file = projectExplorer.files[session.source.schemaFileId];
      if (file?.kind !== "schema") return;
      openGeneratedSqlPlaygroundQuery(file.id, file.name, query, execute);
    }
  }

  function createSchemaFromDatabaseReverse(request: DatabaseReverseApplyRequest) {
    const diagram = {
      ...request.result.diagram,
      meta: {
        ...request.result.diagram.meta,
        name: stripKnownProjectExtension(request.schemaFileName) || request.result.diagram.meta.name,
      },
    };
    const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
    const logicalWorkspace = updateLogicalWorkspaceModel(
      translationWorkspace.translatedDiagram,
      createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram),
      request.result.logicalModel,
    );
    return createSchemaDocumentFromProjectState({
      diagram,
      translationWorkspace,
      logicalWorkspace,
      logicalGenerated: true,
      logicalStage: "schema",
      diagramView: "er",
      viewport: createCenteredViewportForDiagram(diagram),
      translationViewport: createCenteredViewportForDiagram(translationWorkspace.translatedDiagram),
      logicalViewport: DEFAULT_VIEWPORT,
      workspace: {
        ...currentProjectWorkspaceState,
        tool: "select",
        selection: { nodeIds: [], edgeIds: [] },
        translationSelection: { nodeIds: [], edgeIds: [] },
        logicalSelection: { ...EMPTY_LOGICAL_SELECTION },
        codeDraft: serializeDiagramToErs(diagram),
        codeDirty: false,
      },
    });
  }

  function addReverseExtrasFile(
    state: ProjectExplorerState,
    request: DatabaseReverseApplyRequest,
  ): ProjectExplorerState {
    if (!request.includeUnconvertedDefinitions || request.result.unconvertedDefinitions.length === 0) return state;
    const extras = createReverseExtrasSql(request.result);
    if (!extras.trim()) return state;
    const requestedName = `${stripKnownProjectExtension(request.schemaFileName)}-extras.sql`;
    const uniqueName = getUniqueProjectNodeName(state.project, state.project.rootId, requestedName);
    const extraFile = createTextWorkspaceFile(uniqueName, "sql", extras);
    const added = addProjectFile(state, state.project.rootId, extraFile);
    return added.ok ? added.state : state;
  }

  async function handleApplyDatabaseReverse(
    request: DatabaseReverseApplyRequest,
  ): Promise<DatabaseReverseApplyReport | null> {
    const schema = createSchemaFromDatabaseReverse(request);
    let schemaFileId = "";
    let schemaFileName = request.schemaFileName;

    if (request.destination === "new-project") {
      if (hasProject && !(await confirmDiscardChanges(t("workspace.unsavedActions.createNewProject")))) return null;
      await sqlPlaygroundManagerRef.current?.closeGeneratedSessions(projectExplorer.project.id);
      let nextState = createProjectFromSchema(request.projectName, schema);
      nextState = addReverseExtrasFile(nextState, request);
      const schemaFile = Object.values(nextState.files).find((file) => file.kind === "schema");
      if (!schemaFile || schemaFile.kind !== "schema") throw new Error(t("databaseWorkspace.reverse.error"));
      schemaFileId = schemaFile.id;
      schemaFileName = schemaFile.name;
      setHasProject(true);
      setProjectExplorer(nextState);
      openSchemaWorkspaceFile(schemaFile.id, markProjectTabDirty(nextState, schemaFile.id, true), { center: true });
      hasUnsavedChangesRef.current = true;
    } else if (request.destination === "replace-current-schema") {
      if (!activeSchemaFile) throw new Error(t("databaseWorkspace.reverse.noActiveSchema"));
      const confirmed = await requestConfirmDialog({
        title: t("databaseWorkspace.reverse.replaceConfirmTitle"),
        message: t("databaseWorkspace.reverse.replaceConfirmMessage"),
        confirmLabel: t("databaseWorkspace.reverse.replaceCurrentSchema"),
        cancelLabel: t("common.actions.cancel"),
        danger: true,
      });
      if (!confirmed) return null;
      const synced = syncActiveSchemaToProject();
      const replaced = {
        ...synced,
        files: {
          ...synced.files,
          [activeSchemaFile.id]: {
            ...activeSchemaFile,
            schema,
            updatedAt: new Date().toISOString(),
          },
        },
      };
      const dirty = addReverseExtrasFile(markProjectTabDirty(replaced, activeSchemaFile.id, true), request);
      schemaFileId = activeSchemaFile.id;
      schemaFileName = activeSchemaFile.name;
      openSchemaWorkspaceFile(activeSchemaFile.id, dirty, { center: true });
      hasUnsavedChangesRef.current = true;
    } else {
      const synced = syncActiveSchemaToProject();
      const uniqueName = getUniqueProjectNodeName(
        synced.project,
        synced.project.rootId,
        ensureProjectFileExtension(request.schemaFileName, "schema"),
      );
      const schemaFile = createSchemaWorkspaceFile(uniqueName, schema);
      const added = addProjectFile(synced, synced.project.rootId, schemaFile);
      if (!added.ok) throw new Error(t(`projectExplorer.errors.${added.reason}`));
      const withExtras = addReverseExtrasFile(added.state, request);
      schemaFileId = schemaFile.id;
      schemaFileName = schemaFile.name;
      openSchemaWorkspaceFile(schemaFile.id, markProjectTabDirty(withExtras, schemaFile.id, true), { center: true });
      hasUnsavedChangesRef.current = true;
    }

    return {
      schemaFileId,
      schemaFileName,
      tableCount: request.result.sqlModel.tables.length,
      entityCount: request.result.diagram.nodes.filter((node) => node.type === "entity").length,
      relationshipCount: request.result.diagram.nodes.filter((node) => node.type === "relationship").length,
      warningCount: request.result.issues.filter((issue) => issue.level === "warning").length
        + request.result.logicalIssues.filter((issue) => issue.level === "warning").length,
      preservedDefinitionCount: request.includeUnconvertedDefinitions ? request.result.unconvertedDefinitions.length : 0,
    };
  }

  function handleOpenSqlPlayground() {
    if (!activeSchemaFile) {
      setStatusWarning(t("sqlPlayground.noActiveSchema"));
      return;
    }
    activateSqlPlayground(activeSchemaFile.id, activeSchemaFile.name);
  }

  async function handleOpenSqlFileInPlayground(file: ProjectWorkspaceFile) {
    if (file.kind !== "sql") return;
    const sqlWithoutDatabaseContext = stripSqlFileDatabaseContext(file.content);
    let directSchemaSql: string | null = null;
    try {
      const reverseResult = reverseSqlToDiagram(sqlWithoutDatabaseContext, {
        sourceName: file.name,
        dialect: sqlReverseWorkflow.dialect,
      });
      if (
        reverseResult.sqlModel.tables.length > 0
        && !reverseResult.issues.some((issue) => issue.level === "error")
      ) {
        directSchemaSql = generateLogicalSql(reverseResult.logicalModel, {
          dialect: "sqlite",
          quoteIdentifiers: true,
        });
      }
    } catch {
      directSchemaSql = null;
    }

    let schemaFile: Extract<ProjectWorkspaceFile, { kind: "schema" }> | null = null;
    if (!directSchemaSql) {
      const resolution = resolveSqlPlaygroundSchema({
        files: projectExplorer.files,
        activePlaygroundSchemaId: activeSqlPlaygroundSchemaId,
        lastPlaygroundSchemaId: lastSqlPlaygroundSchemaId,
      });
      if (resolution.status === "missing") {
        setStatusWarning(t("workspaceChrome.sqlActions.noSchemaWarning"));
        return;
      }
      if (resolution.status === "ambiguous") {
        setStatusWarning(t("workspaceChrome.sqlActions.ambiguousSchemaWarning"));
        return;
      }
      const resolvedFile = projectExplorer.files[resolution.schemaFileId];
      if (resolvedFile?.kind !== "schema") return;
      schemaFile = resolvedFile;
    }

    const declaredDatabaseName = resolveSqlFileDatabaseName(file.content);
    const databaseName = declaredDatabaseName ?? await requestPromptDialog({
      title: t("workspaceChrome.sqlActions.databaseNameTitle"),
      label: t("workspaceChrome.sqlActions.databaseNameLabel"),
      initialValue: file.name.replace(/\.sql$/i, ""),
      placeholder: t("workspaceChrome.sqlActions.databaseNamePlaceholder"),
      confirmLabel: t("workspaceChrome.sqlActions.createDatabase"),
      required: true,
      requiredMessage: t("workspaceChrome.sqlActions.databaseNameRequired"),
    });
    if (!databaseName) return;
    if (directSchemaSql) {
      const manager = getSqlPlaygroundManager();
      const sessionId = buildSqlPlaygroundSessionId(projectExplorer.project.id, file.id);
      const existing = manager.getSessionState(sessionId);
      const generatedExisting = existing?.source.kind === "generated-schema"
        ? existing as GeneratedSqlPlaygroundSessionState
        : null;
      if (generatedExisting) {
        manager.setSessionState({
          ...generatedExisting,
          query: file.content,
          schemaName: databaseName,
          source: { ...generatedExisting.source, schemaName: databaseName },
        });
      } else {
        manager.setSessionState({
          ...createSqlPlaygroundSessionState({
            sessionId,
            projectId: projectExplorer.project.id,
            schemaFileId: file.id,
            schemaName: databaseName,
            currentGeneratedChecksum: "",
          }),
          query: file.content,
        });
      }
      setSqlFilePlaygroundConfigs((current) => ({
        ...current,
        [file.id]: { databaseName, generatedSql: directSchemaSql },
      }));
      activateSqlPlayground(file.id, databaseName);
      setSqlExplorerQueryRequest((current) => ({
        id: (current?.id ?? 0) + 1,
        sessionId,
        query: file.content,
        execute: false,
        createDatabase: true,
        databaseName,
      }));
    } else if (schemaFile) {
      openGeneratedSqlPlaygroundQuery(schemaFile.id, schemaFile.name, file.content, false, {
        createDatabase: true,
        databaseName,
      });
    }
    setStatus(t("workspaceChrome.sqlActions.playgroundDatabaseCreating", { name: databaseName }));
  }

  function activateSqlPlayground(schemaFileId: string, schemaName: string) {
    getSqlPlaygroundManager();
    setOpenSqlPlaygroundSchemaIds((current) =>
      current.includes(schemaFileId) ? current : [...current, schemaFileId],
    );
    setActiveSqlPlaygroundSchemaId(schemaFileId);
    setLastSqlPlaygroundSchemaId(schemaFileId);
    setStatus(t("sqlPlayground.opened", { name: schemaName }));
  }

  function handleOpenSqlExplorerPlayground() {
    if (!sqlExplorerSchemaId || sqlExplorerSchema?.kind !== "schema") {
      setStatusWarning(t("sqlPlayground.noActiveSchema"));
      return;
    }
    if (activeSchemaFile?.id !== sqlExplorerSchemaId) {
      openSchemaWorkspaceFile(sqlExplorerSchemaId, syncActiveSchemaToProject());
    }
    activateSqlPlayground(sqlExplorerSchemaId, sqlExplorerSchema.name);
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
    setCodeDiagnostics([]);
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
    setCodeDiagnostics([]);
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
      markDirty?: boolean;
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
    appReleases.closeReleaseCenter();
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
    } else if (options?.markDirty !== false) {
      hasUnsavedChangesRef.current = true;
    }
    setSelection(nextWorkspace?.selection ?? { nodeIds: [], edgeIds: [] });
    setIdentifierSelection(null);
    setViewport(options?.viewport ? { ...options.viewport } : { ...DEFAULT_VIEWPORT });
    setTool(nextWorkspace?.tool ?? "select");
    setStatus(status);
    reportExternalIdentifierInvalidations(normalizedIncoming.invalidations, "notice");
  }

  function createCurrentSchemaDocument() {
    return createSchemaDocumentFromProjectState({
      diagram: history.present,
      translationWorkspace: translationHistory.present,
      logicalWorkspace: logicalHistory.present,
      logicalGenerated,
      logicalStage,
      diagramView,
      viewport,
      translationViewport,
      logicalViewport,
      workspace: currentProjectWorkspaceState,
    });
  }

  function syncActiveSchemaToProject(state: ProjectExplorerState = projectExplorer): ProjectExplorerState {
    const activeFileId = state.project.activeFileId ?? state.view.activeFileId;
    if (!activeFileId || state.files[activeFileId]?.kind !== "schema") {
      return state;
    }

    return updateProjectSchemaFileIfContentChanged(state, activeFileId, createCurrentSchemaDocument());
  }

  function getProjectStateForImportedSchema(projectName: string): ProjectExplorerState {
    if (hasProject) {
      return syncActiveSchemaToProject();
    }

    return createEmptyProjectExplorerState(stripKnownProjectExtension(projectName) || "buildER Project");
  }

  function applyProjectExplorerState(nextState: ProjectExplorerState) {
    setHasProject(true);
    setProjectExplorer(normalizeProjectTabs(nextState));
    hasUnsavedChangesRef.current = true;
  }

  function findProjectNodeIdByFileId(state: ProjectExplorerState, fileId: string): string | null {
    return state.project.fileTree.find((node) => node.fileId === fileId)?.id ?? null;
  }

  function selectProjectExplorerNode(state: ProjectExplorerState, nodeId: string | null): ProjectExplorerState {
    return normalizeProjectTabs({
      ...state,
      view: {
        ...state.view,
        selectedNodeId: nodeId ?? state.project.rootId,
      },
    });
  }

  function handleShowWelcomeTab() {
    if (!hasProject) {
      setStatusWarning(t("noProjectWelcome.title"));
      return;
    }

    setActiveImportedDatabaseSessionId(null);
    setActiveSqlPlaygroundSchemaId(null);
    setProjectExplorer(openWelcomeTab(syncActiveSchemaToProject()));
  }

  function openSchemaWorkspaceFile(fileId: string, state: ProjectExplorerState, options: { center?: boolean } = {}) {
    const file = state.files[fileId];
    if (!file || file.kind !== "schema") {
      return;
    }

    setActiveSqlPlaygroundSchemaId(null);
    setActiveImportedDatabaseSessionId(null);
    const nextState = ensureFileTabOpen(state, fileId);
    setProjectExplorer(nextState);
    const centeredViewport = options.center ? createCenteredViewportForDiagram(file.schema.diagram) : file.schema.view.erViewport;
    const shouldFitLogical = options.center && file.schema.logicalGenerated;
    applyWorkspaceDocument(file.schema.diagram, t("projectExplorer.status.schemaOpened", { name: file.name }), {
      translationWorkspace: file.schema.translationWorkspace,
      logicalWorkspace: file.schema.logicalWorkspace,
      logicalGenerated: file.schema.logicalGenerated,
      logicalStage: file.schema.logicalStage,
      diagramView: file.schema.view.current,
      viewport: centeredViewport,
      translationViewport: options.center ? createCenteredViewportForDiagram(file.schema.translationWorkspace.translatedDiagram) : file.schema.view.translationViewport,
      logicalViewport: options.center ? DEFAULT_VIEWPORT : file.schema.view.logicalViewport,
      versioning: file.schema.versioning ?? projectVersioning.versioning,
      workspace: file.schema.workspace,
      resetHistory: true,
      markBaseline: false,
      markDirty: false,
    });
    if (shouldFitLogical) {
      setLogicalFitRequestToken((current) => current + 1);
    }
  }

  function handleProjectExplorerOpenFile(fileId: string) {
    const file = projectExplorer.files[fileId];
    if (!file) {
      return;
    }

    setActiveSqlPlaygroundSchemaId(null);
    setActiveImportedDatabaseSessionId(null);
    const synced = syncActiveSchemaToProject();
    if (file.kind === "schema") {
      openSchemaWorkspaceFile(fileId, synced, { center: true });
      return;
    }

    if (file.kind === "text") {
      const nodeId = findProjectNodeIdByFileId(synced, fileId);
      setProjectExplorer(ensureFileTabOpen(selectProjectExplorerNode(synced, nodeId), fileId));
      setActiveActivityPanel("file");
      setWorkspaceActivityOpen(true);
      setStatus(t("projectExplorer.status.textFileOpened", { name: file.name }));
      return;
    }

    const nextState = ensureFileTabOpen(synced, fileId);
    setProjectExplorer(nextState);
    setStatus(t("projectExplorer.status.textFileOpened", { name: file.name }));
    if (file.kind === "sql") {
      setActiveActivityPanel("file");
      setWorkspaceActivityOpen(true);
      return;
    }
    setActiveActivityPanel("file");
    setWorkspaceActivityOpen(true);
  }

  function handleProjectFileTabSelect(tabId: string) {
    const importedSessionId = openImportedDatabaseSessionIds.find((sessionId) => `database:${sessionId}` === tabId);
    if (importedSessionId) {
      setActiveImportedDatabaseSessionId(importedSessionId);
      setActiveSqlPlaygroundSchemaId(null);
      setManualSqlExplorerSessionId(importedSessionId);
      return;
    }
    const playgroundSchemaId = openSqlPlaygroundSchemaIds.find((schemaId) => `sql-playground:${schemaId}` === tabId);
    if (playgroundSchemaId) {
      const synced = syncActiveSchemaToProject();
      const file = synced.files[playgroundSchemaId];
      if (file?.kind === "schema") {
        openSchemaWorkspaceFile(playgroundSchemaId, synced);
        setActiveSqlPlaygroundSchemaId(playgroundSchemaId);
        setActiveImportedDatabaseSessionId(null);
        setLastSqlPlaygroundSchemaId(playgroundSchemaId);
      } else if (file?.kind === "sql") {
        setProjectExplorer(ensureFileTabOpen(synced, file.id));
        setActiveSqlPlaygroundSchemaId(playgroundSchemaId);
        setActiveImportedDatabaseSessionId(null);
      }
      return;
    }
    setActiveSqlPlaygroundSchemaId(null);
    setActiveImportedDatabaseSessionId(null);
    const nextState = setActiveProjectTab(syncActiveSchemaToProject(), tabId);
    const activeFileId = nextState.project.activeFileId ?? nextState.view.activeFileId;
    const file = activeFileId ? nextState.files[activeFileId] : undefined;
    if (!file) {
      setProjectExplorer(nextState);
      setStatus(t("projectTabs.welcome"));
      return;
    }

    if (file.kind === "schema") {
      openSchemaWorkspaceFile(file.id, nextState, { center: true });
      return;
    }

    setProjectExplorer(nextState);
    if (file.kind === "sql") {
      setActiveActivityPanel("file");
      setWorkspaceActivityOpen(true);
      setStatus(t("projectExplorer.status.textFileOpened", { name: file.name }));
      return;
    }
    setProjectExplorer(nextState);
    setActiveActivityPanel("file");
    setWorkspaceActivityOpen(true);
    setStatus(t("projectExplorer.status.textFileOpened", { name: file.name }));
  }

  async function handleProjectFileTabClose(tabId: string) {
    const importedSessionId = openImportedDatabaseSessionIds.find((sessionId) => `database:${sessionId}` === tabId);
    if (importedSessionId) {
      await requestImportedDatabaseClose(importedSessionId);
      return;
    }
    const playgroundSchemaId = openSqlPlaygroundSchemaIds.find((schemaId) => `sql-playground:${schemaId}` === tabId);
    if (playgroundSchemaId) {
      setOpenSqlPlaygroundSchemaIds((current) => current.filter((schemaId) => schemaId !== playgroundSchemaId));
      if (activeSqlPlaygroundSchemaId === playgroundSchemaId) setActiveSqlPlaygroundSchemaId(null);
      return;
    }
    const tab = projectExplorer.view.openTabs.find((candidate) => candidate.id === tabId);
    if (tab?.dirty) {
      const shouldClose = await requestConfirmDialog({
        title: t("projectTabs.closeModifiedTitle"),
        message: t("projectTabs.closeModifiedMessage", { name: tab.title }),
        confirmLabel: t("projectTabs.closeModifiedConfirm"),
      });
      if (!shouldClose) return;
    }
    const nextState = closeProjectTab(syncActiveSchemaToProject(), tabId);
    const activeFileId = nextState.project.activeFileId ?? nextState.view.activeFileId;
    const file = activeFileId ? nextState.files[activeFileId] : undefined;
    if (!file) {
      setProjectExplorer(nextState);
      return;
    }
    if (file.kind === "schema") {
      openSchemaWorkspaceFile(file.id, nextState, { center: true });
      return;
    }
    setProjectExplorer(nextState);
    if (file.kind === "sql") {
      setActiveActivityPanel("file");
      setWorkspaceActivityOpen(true);
    }
  }

  function applyProjectTabMutation(nextState: ProjectExplorerState) {
    const activeFileId = nextState.project.activeFileId ?? nextState.view.activeFileId;
    const file = activeFileId ? nextState.files[activeFileId] : undefined;
    if (!file) {
      setProjectExplorer(nextState);
      return;
    }
    if (file.kind === "schema") {
      openSchemaWorkspaceFile(file.id, nextState, { center: true });
      return;
    }
    setProjectExplorer(nextState);
    if (file.kind === "sql") {
      setActiveActivityPanel("file");
      setWorkspaceActivityOpen(true);
    } else {
      setActiveActivityPanel("file");
      setWorkspaceActivityOpen(true);
    }
  }

  function closeProjectTabsBy(predicate: (tabId: string, index: number) => boolean) {
    let nextState = syncActiveSchemaToProject();
    const tabsToClose = nextState.view.openTabs
      .map((tab, index) => ({ tab, index }))
      .filter(({ tab, index }) => predicate(tab.id, index))
      .map(({ tab }) => tab.id);
    tabsToClose.forEach((tabId) => {
      nextState = closeProjectTab(nextState, tabId);
    });
    applyProjectTabMutation(nextState);
  }

  async function closeWorkspaceTabs(tabIds: string[]): Promise<void> {
    for (const tabId of tabIds) {
      const sessionId = tabId.startsWith("database:") ? tabId.slice("database:".length) : null;
      if (sessionId && !(await requestImportedDatabaseClose(sessionId))) return;
    }
    const closingPlaygroundIds = new Set(tabIds.filter((id) => id.startsWith("sql-playground:")).map((id) => id.slice("sql-playground:".length)));
    setOpenSqlPlaygroundSchemaIds((current) => current.filter((id) => !closingPlaygroundIds.has(id)));
    if (activeSqlPlaygroundSchemaId && closingPlaygroundIds.has(activeSqlPlaygroundSchemaId)) setActiveSqlPlaygroundSchemaId(null);
    const closingProjectIds = new Set(tabIds.filter((id) => !id.startsWith("database:") && !id.startsWith("sql-playground:")));
    if (closingProjectIds.size > 0) closeProjectTabsBy((candidateId) => closingProjectIds.has(candidateId));
  }

  function handleProjectTabsCloseOthers(tabId: string) {
    void closeWorkspaceTabs(visibleProjectTabs.filter((tab) => tab.id !== tabId).map((tab) => tab.id));
  }

  function handleProjectTabsCloseToRight(tabId: string) {
    const index = visibleProjectTabs.findIndex((tab) => tab.id === tabId);
    if (index >= 0) void closeWorkspaceTabs(visibleProjectTabs.slice(index + 1).map((tab) => tab.id));
  }

  function handleProjectTabsCloseAll() {
    void closeWorkspaceTabs(visibleProjectTabs.map((tab) => tab.id));
  }

  function handleProjectTabReorder(sourceTabId: string, targetTabId: string) {
    setProjectExplorer((current) => {
      const tabs = [...current.view.openTabs];
      const sourceIndex = tabs.findIndex((tab) => tab.id === sourceTabId);
      const targetIndex = tabs.findIndex((tab) => tab.id === targetTabId);
      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return current;
      const [moved] = tabs.splice(sourceIndex, 1);
      tabs.splice(targetIndex, 0, moved);
      return {
        ...current,
        view: { ...current.view, openTabs: tabs },
      };
    });
  }

  function handleRevealProjectFile(fileId: string) {
    const nodeId = findProjectNodeIdByFileId(projectExplorer, fileId);
    if (!nodeId) return;
    setActiveActivityPanel("file");
    setWorkspaceActivityOpen(true);
    setProjectExplorer((current) => selectProjectExplorerNode(current, nodeId));
  }

  function handleActiveTextFileChange(content: string) {
    const activeFileId = projectExplorer.project.activeFileId ?? projectExplorer.view.activeFileId;
    if (!activeFileId) {
      return;
    }

    const activeFile = projectExplorer.files[activeFileId];
    if (!activeFile || (activeFile.kind !== "text" && activeFile.kind !== "sql" && activeFile.kind !== "unknown")) {
      return;
    }

    const updatedAt = new Date().toISOString();
    setProjectExplorer((current) => {
      const currentFile = current.files[activeFileId];
      if (!currentFile || (currentFile.kind !== "text" && currentFile.kind !== "sql" && currentFile.kind !== "unknown")) {
        return current;
      }

      return markProjectTabDirty({
        ...current,
        files: {
          ...current.files,
          [activeFileId]: {
            ...currentFile,
            content,
            updatedAt,
          },
        },
      }, activeFileId, true);
    });
    hasUnsavedChangesRef.current = true;
  }

  async function handleProjectExplorerCreateSchema(parentId: string, inlineName?: string) {
    const requestedName = inlineName ?? await requestPromptDialog({
      title: t("projectExplorer.dialogs.newSchemaTitle"),
      label: t("projectExplorer.dialogs.nameLabel"),
      initialValue: t("projectExplorer.defaults.schemaName"),
      required: true,
    });
    if (requestedName == null) {
      return;
    }

    const name = ensureProjectFileExtension(requestedName, "schema");
    const uniqueName = getUniqueProjectNodeName(projectExplorer.project, parentId, name);
    const file = createSchemaWorkspaceFile(uniqueName);
    const result = addProjectFile(syncActiveSchemaToProject(), parentId, file);
    if (!result.ok) {
      setStatusWarning(t(`projectExplorer.errors.${result.reason}`));
      return;
    }

    openSchemaWorkspaceFile(file.id, markProjectTabDirty(ensureFileTabOpen(result.state, file.id), file.id, true), { center: true });
    setStatus(t("projectExplorer.status.schemaCreated", { name: file.name }));
  }

  async function handleProjectExplorerCreateTextFile(parentId: string, inlineName?: string) {
    const requestedName = inlineName ?? await requestPromptDialog({
      title: t("projectExplorer.dialogs.newTextFileTitle"),
      label: t("projectExplorer.dialogs.nameLabel"),
      initialValue: t("projectExplorer.defaults.textFileName"),
      required: true,
    });
    if (requestedName == null) {
      return;
    }

    const normalized = normalizeProjectNodeName(requestedName);
    const kind = /\.sql$/i.test(normalized) ? "sql" : "text";
    const uniqueName = getUniqueProjectNodeName(projectExplorer.project, parentId, ensureProjectFileExtension(normalized, kind));
    const file = createTextWorkspaceFile(uniqueName, kind);
    const result = addProjectFile(syncActiveSchemaToProject(), parentId, file);
    if (!result.ok) {
      setStatusWarning(t(`projectExplorer.errors.${result.reason}`));
      return;
    }

    const nextState = markProjectTabDirty(ensureFileTabOpen(result.state, file.id), file.id, true);
    applyProjectExplorerState(nextState);
    setActiveActivityPanel("file");
    setWorkspaceActivityOpen(true);
    setStatus(t("projectExplorer.status.fileCreated", { name: uniqueName }));
  }

  async function handleProjectExplorerCreateSqlFile(parentId: string, inlineName?: string) {
    const requestedName = inlineName ?? await requestPromptDialog({
      title: t("projectExplorer.dialogs.newSqlFileTitle"),
      label: t("projectExplorer.dialogs.nameLabel"),
      initialValue: t("projectExplorer.defaults.sqlFileName"),
      required: true,
    });
    if (requestedName == null) {
      return;
    }

    const uniqueName = getUniqueProjectNodeName(
      projectExplorer.project,
      parentId,
      ensureProjectFileExtension(requestedName, "sql"),
    );
    const file = createTextWorkspaceFile(uniqueName, "sql");
    const result = addProjectFile(syncActiveSchemaToProject(), parentId, file);
    if (!result.ok) {
      setStatusWarning(t(`projectExplorer.errors.${result.reason}`));
      return;
    }

    applyProjectExplorerState(markProjectTabDirty(ensureFileTabOpen(result.state, file.id), file.id, true));
    setActiveActivityPanel("file");
    setWorkspaceActivityOpen(true);
    setStatus(t("sqlReverse.sqlFileCreated", { name: uniqueName }));
  }

  async function handleProjectExplorerCreateFolder(parentId: string, inlineName?: string) {
    const requestedName = inlineName ?? await requestPromptDialog({
      title: t("projectExplorer.dialogs.newFolderTitle"),
      label: t("projectExplorer.dialogs.nameLabel"),
      initialValue: t("projectExplorer.defaults.folderName"),
      required: true,
    });
    if (requestedName == null) {
      return;
    }

    const uniqueName = getUniqueProjectNodeName(projectExplorer.project, parentId, requestedName);
    const result = addProjectFolder(projectExplorer, parentId, uniqueName);
    if (!result.ok) {
      setStatusWarning(t(`projectExplorer.errors.${result.reason}`));
      return;
    }

    applyProjectExplorerState(result.state);
    setStatus(t("projectExplorer.status.folderCreated", { name: uniqueName }));
  }

  async function handleProjectExplorerRename(nodeId: string, inlineName?: string) {
    const node = projectExplorer.project.fileTree.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return;
    }

    const requestedName = inlineName ?? await requestPromptDialog({
        title: t("projectExplorer.dialogs.renameTitle"),
        label: t("projectExplorer.dialogs.nameLabel"),
        initialValue: node.name,
        required: true,
      });
    if (requestedName == null) {
      return;
    }

    const result = renameProjectNode(syncActiveSchemaToProject(), nodeId, requestedName);
    if (!result.ok) {
      setStatusWarning(t(`projectExplorer.errors.${result.reason}`));
      return;
    }

    const renamedNode = result.state.project.fileTree.find((candidate) => candidate.id === nodeId);
    applyProjectExplorerState(result.state);
    if (renamedNode?.fileId === result.state.project.activeFileId && result.state.files[renamedNode.fileId]?.kind === "schema") {
      const activeFile = result.state.files[renamedNode.fileId] as Extract<ProjectWorkspaceFile, { kind: "schema" }>;
      applyWorkspaceDocument(activeFile.schema.diagram, t("projectExplorer.status.renamed", { name: renamedNode.name }), {
        translationWorkspace: activeFile.schema.translationWorkspace,
        logicalWorkspace: activeFile.schema.logicalWorkspace,
        logicalGenerated: activeFile.schema.logicalGenerated,
        logicalStage: activeFile.schema.logicalStage,
        diagramView,
        viewport,
        translationViewport,
        logicalViewport,
        versioning: projectVersioning.versioning,
        workspace: currentProjectWorkspaceState,
        resetHistory: true,
        markBaseline: false,
      });
    }
    setStatus(t("projectExplorer.status.renamed", { name: renamedNode?.name ?? requestedName }));
  }

  function handleProjectExplorerMove(nodeId: string, targetParentId: string) {
    const source = syncActiveSchemaToProject();
    const result = moveNode(source, nodeId, targetParentId);
    if (!result.ok) {
      setStatusWarning(t(`projectExplorer.errors.${result.reason}`));
      return;
    }
    if (result.state === source) {
      return; // no-op: niente cambiamento, niente step di undo
    }

    applyProjectExplorerState(result.state);
    const movedNode = result.state.project.fileTree.find((candidate) => candidate.id === nodeId);
    const targetNode = result.state.project.fileTree.find((candidate) => candidate.id === targetParentId);
    setStatus(t("projectExplorer.status.moved", { name: movedNode?.name ?? "", folder: targetNode?.name ?? "" }));
  }

  async function handleProjectExplorerDelete(nodeId: string) {
    const node = projectExplorer.project.fileTree.find((candidate) => candidate.id === nodeId);
    if (!node) {
      return;
    }
    if (node.id === projectExplorer.project.rootId) {
      setStatusWarning(t("projectExplorer.errors.root-delete"));
      return;
    }

    const confirmed = await requestConfirmDialog({
      title: t("projectExplorer.dialogs.deleteTitle"),
      message: t("projectExplorer.dialogs.deleteMessage", { name: node.name }),
      confirmLabel: t("common.actions.delete"),
      danger: true,
    });
    if (!confirmed) {
      return;
    }

    const result = deleteProjectNode(syncActiveSchemaToProject(), nodeId);
    if (!result.ok) {
      setStatusWarning(t(`projectExplorer.errors.${result.reason}`));
      return;
    }

    const nextActiveFileId = result.state.project.activeFileId;
    const nextActiveFile = nextActiveFileId ? result.state.files[nextActiveFileId] : undefined;
    applyProjectExplorerState(result.state);
    if (nextActiveFile?.kind === "schema") {
      openSchemaWorkspaceFile(nextActiveFile.id, result.state, { center: true });
    }
    setStatus(t("projectExplorer.status.deleted", { name: node.name }));
  }

  function handleProjectExplorerToggleFolder(folderId: string) {
    const expanded = new Set(projectExplorer.view.expandedFolderIds);
    if (expanded.has(folderId)) {
      expanded.delete(folderId);
    } else {
      expanded.add(folderId);
    }
    applyProjectExplorerState(setProjectExplorerExpandedFolders(projectExplorer, Array.from(expanded)));
  }

  function handleProjectExplorerSelectNode(nodeId: string) {
    setProjectExplorer((current) =>
      normalizeProjectTabs({
        ...current,
        view: {
          ...current.view,
          selectedNodeId: nodeId,
        },
      }),
    );
  }

  function handleProjectExplorerCollapseAll() {
    applyProjectExplorerState(setProjectExplorerExpandedFolders(projectExplorer, [projectExplorer.project.rootId]));
  }

  function handleProjectExplorerResizeStart(event: ReactPointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = projectExplorer.view.explorerWidth || DEFAULT_PROJECT_EXPLORER_WIDTH;

    function handlePointerMove(moveEvent: PointerEvent) {
      const nextWidth = clampValue(startWidth + moveEvent.clientX - startX, MIN_PROJECT_EXPLORER_WIDTH, MAX_PROJECT_EXPLORER_WIDTH);
      setProjectExplorer((current) => ({
        ...current,
        view: {
          ...current.view,
          explorerWidth: nextWidth,
        },
      }));
    }

    function handlePointerUp() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      hasUnsavedChangesRef.current = true;
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }

  function handleProjectExplorerResizeBy(delta: number) {
    setProjectExplorer((current) => ({
      ...current,
      view: {
        ...current.view,
        explorerWidth: clampValue(
          (current.view.explorerWidth || DEFAULT_PROJECT_EXPLORER_WIDTH) + delta,
          MIN_PROJECT_EXPLORER_WIDTH,
          MAX_PROJECT_EXPLORER_WIDTH,
        ),
      },
    }));
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

  function setWorkspaceActivityOpen(open: boolean) {
    setProjectExplorer((current) => ({
      ...current,
      view: {
        ...current.view,
        explorerOpen: open,
      },
    }));
  }

  function handleSelectActivityPanel(panel: ProjectActivityId) {
    if (panel === activeActivityPanel && projectExplorer.view.explorerOpen) {
      setWorkspaceActivityOpen(false);
      if (panel === "code" && codePanelOpen) {
        handleCodeEditorBlur();
        setCodePanelOpen(false);
      }
      return;
    }
    setActiveActivityPanel(panel);
    setWorkspaceActivityOpen(true);

    if (panel === "code") {
      setCodePanelOpen(true);
      return;
    }

    if (codePanelOpen) {
      handleCodeEditorBlur();
      setCodePanelOpen(false);
    }
  }

  function handleToggleActivityPanelOpen() {
    const nextOpen = !projectExplorer.view.explorerOpen;
    setWorkspaceActivityOpen(nextOpen);
    if (!nextOpen && codePanelOpen) {
      handleCodeEditorBlur();
      setCodePanelOpen(false);
    }
  }

  function handleToggleCodePanel() {
    if (codePanelOpen && activeActivityPanel === "code" && projectExplorer.view.explorerOpen) {
      handleCodeEditorBlur();
      setCodePanelOpen(false);
      setWorkspaceActivityOpen(false);
      return;
    }

    if (!codePanelOpen) {
      toggleWorkspaceCodePanel();
    }
    setActiveActivityPanel("code");
    setWorkspaceActivityOpen(true);
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

        setCodeDiagnostics([]);
        lastCodeDiagnosticNoticeRef.current = "";
        lastSerializedCodeRef.current = parsedSerialized;
        const nextDirty = codeDraftRef.current !== parsedSerialized;
        codeDirtyRef.current = nextDirty;
        setCodeDirty(nextDirty);
        if (!nextDirty && !codeEditorFocusedRef.current) {
          codeLayoutMemoryRef.current = null;
        }
      } catch (error) {
        const message = error instanceof ErsParseError
          ? t("workspace.invalidErsCode")
          : error instanceof Error
            ? error.message
            : t("workspace.invalidErsCode");
        const formattedMessage = formatErsErrorMessage(message);
        const line = error instanceof ErsParseError ? error.line : undefined;
        const diagnostic: EditorDiagnostic = {
          id: `ers:${line ?? "unknown"}:${formattedMessage}`,
          level: "error",
          message: formattedMessage,
          line,
        };
        setCodeDiagnostics([diagnostic]);
        const signature = `${diagnostic.level}:${diagnostic.line ?? ""}:${diagnostic.message}`;
        if (activeActivityPanel !== "code" && signature !== lastCodeDiagnosticNoticeRef.current) {
          lastCodeDiagnosticNoticeRef.current = signature;
          showErrorNotice(formattedMessage, { title: t("codePanel.error") });
        }
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
      setCodeDiagnostics([]);
    }
  }, [history.present]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (!commandMenuOpen) {
          openCommandMenu();
          return;
        }

        const paletteInput = document.querySelector<HTMLInputElement>('[data-testid="command-menu-search"]');
        if (paletteInput && document.activeElement !== paletteInput) {
          paletteInput.focus();
        } else {
          closeCommandMenu(true);
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
        return;
      }

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
          handleOpenErrorsPanel();
          return;
        }

        if (diagramView === "logical") {
          handleLogicalPanelModeChange(logicalPanelMode === "sql" ? "review" : "sql");
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
          setStatus(t("workspace.toolActive", { tool: getToolLabel(nextTool) }));
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
        // Fase C4b: confirm/prompt vivono sulla Modal shell, che gestisce Esc da sé.
        if (promptDialog || confirmDialog) {
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

        if (commandMenuOpen) {
          closeCommandMenu(true);
          return;
        }

        if (settingsOpen) {
          setSettingsOpen(false);
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

        if (diagramView === "er") {
          if (tool === "entity" || tool === "relationship") {
            setTool("select");
            setStatus(t("canvas.status.placementCancelled"));
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
    versionCompareSession,
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
    setStatus(t("workspace.translationWorkspaceReset"));
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
      setStatus(t("workspace.logicalManualReset"));
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
        setStatus(t("workspace.logicalRealignedNoAutoConvert"));
      }

      if (diagramView === "translation") {
        setLogicalViewport({ ...translationViewport });
      }
      setDiagramView("logical");
      setLogicalFitRequestToken((current) => current + 1);
      setTranslationSelection({ nodeIds: [], edgeIds: [] });
      setTool("select");
      return;
    }

    setDiagramView("er");
    setLogicalTypeMode(false);
    setTranslationSelection({ nodeIds: [], edgeIds: [] });
    setLogicalSelection(EMPTY_LOGICAL_SELECTION);
    setStatus(t("workspace.erViewActive"));
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

  async function handleResetLogicalTranslation() {
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
    if (hasAppliedWork && !(await confirmResetTranslationWork())) {
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
    setStatus(t("workspace.logicalReset"));
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

  async function handleResetTranslation() {
    if (!translationAccess.allowed) {
      setStatusWarning(translationAccess.reason ?? t("workspace.fixBlockingErErrorsFirst"));
      return;
    }

    const hasAppliedWork =
      translationHistory.present.translation.decisions.length > 0 ||
      translationHistory.present.translation.mappings.length > 0 ||
      translationHistory.present.translation.conflicts.length > 0;
    if (hasAppliedWork && !(await confirmResetTranslationWork())) {
      return;
    }

    resetTranslationWorkspace({ switchToTranslation: true, preserveHistory: true });
  }

  async function handleLogicalAutoLayout() {
    if (!logicalGenerated) {
      regenerateLogicalWorkspace({ switchToLogical: true, preservePositions: false });
      setLogicalFitRequestToken((current) => current + 1);
      return;
    }

    const previousModel = logicalHistory.present.model;
    if (previousModel.tables.length === 0) {
      setStatus(t("canvas.status.autoLayoutLogicalEmpty"));
      return;
    }

    const confirmed = await requestConfirmDialog({
      title: t("canvas.autoLayout.logicalConfirmTitle"),
      message: t("canvas.autoLayout.logicalConfirmMessage"),
      confirmLabel: t("canvas.autoLayout.confirmAction"),
    });
    if (!confirmed) return;

    const nextModel = autoLayoutLogicalModel(previousModel);
    commitLogicalModel(nextModel, previousModel);
    setStatus(t("workspace.logicalLayoutUpdated"));
    showSuccessNotice(t("workspace.logicalLayoutUpdated"), {
      actionLabel: t("canvas.autoLayout.undoAction"),
      onAction: handleUndoAction,
    });
    requestLogicalViewportCommand("fitAll");
  }

  async function handleConceptualAutoLayout() {
    const previousDiagram = history.present;
    if (previousDiagram.nodes.length === 0) {
      setStatus(t("canvas.status.autoLayoutEmpty"));
      return;
    }

    const confirmed = await requestConfirmDialog({
      title: t("canvas.autoLayout.confirmTitle"),
      message: t("canvas.autoLayout.confirmMessage"),
      confirmLabel: t("canvas.autoLayout.confirmAction"),
    });
    if (!confirmed) return;

    const nextDiagram = autoLayoutConceptualDiagram(previousDiagram);
    commitDiagram(nextDiagram, previousDiagram, { suppressExternalIdentifierWarnings: true });
    setStatus(t("canvas.status.autoLayoutComplete"));
    showSuccessNotice(t("canvas.status.autoLayoutComplete"), {
      actionLabel: t("canvas.autoLayout.undoAction"),
      onAction: handleUndoAction,
    });
    requestErViewportCommand("fitAll");
  }

  function handleConceptualAutoLayoutSelection() {
    const previousDiagram = history.present;
    const coreSelected = previousDiagram.nodes.filter(
      (node) => node.type !== "attribute" && selection.nodeIds.includes(node.id),
    );
    if (coreSelected.length < 2) {
      setStatus(t("canvas.status.autoLayoutSelectionNeedsNodes"));
      return;
    }

    const nextDiagram = autoLayoutConceptualSelection(previousDiagram, selection.nodeIds);
    if (nextDiagram === previousDiagram) {
      setStatus(t("canvas.status.autoLayoutSelectionNeedsNodes"));
      return;
    }
    commitDiagram(nextDiagram, previousDiagram, { suppressExternalIdentifierWarnings: true });
    setStatus(t("canvas.status.autoLayoutSelectionComplete"));
    showSuccessNotice(t("canvas.status.autoLayoutSelectionComplete"), {
      actionLabel: t("canvas.autoLayout.undoAction"),
      onAction: handleUndoAction,
    });
    requestErViewportCommand("fitSelection");
  }

  async function handleTranslationAutoLayout() {
    const previousWorkspace = translationHistory.present;
    const previousDiagram = previousWorkspace.translatedDiagram;
    if (previousDiagram.nodes.length === 0) {
      setStatus(t("canvas.status.autoLayoutEmpty"));
      return;
    }

    const confirmed = await requestConfirmDialog({
      title: t("canvas.autoLayout.translationConfirmTitle"),
      message: t("canvas.autoLayout.confirmMessage"),
      confirmLabel: t("canvas.autoLayout.confirmAction"),
    });
    if (!confirmed) return;

    const nextDiagram = autoLayoutConceptualDiagram(previousDiagram);
    translationHistory.commit(
      { ...previousWorkspace, translatedDiagram: nextDiagram },
      { ...previousWorkspace, translatedDiagram: previousDiagram },
    );
    setStatus(t("canvas.status.autoLayoutTranslationComplete"));
    showSuccessNotice(t("canvas.status.autoLayoutTranslationComplete"), {
      actionLabel: t("canvas.autoLayout.undoAction"),
      onAction: handleUndoAction,
    });
    requestTranslationViewportCommand("fitAll");
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
      setStatusWarning(error instanceof Error ? error.message : t("workspace.errors.erTranslationDecisionNotApplicable"));
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
    showLogicalStageAfterFix(
      nextWorkspace,
      choice.summary,
      t("workspace.logicalSchemaActiveAfterFix", { summary: choice.summary }),
    );
  }

  async function handleNewProject() {
    if (!(await confirmDiscardChanges(t("workspace.unsavedActions.createNewProject")))) {
      return;
    }

    const requestedName = await requestPromptDialog({
      title: t("projectExplorer.dialogs.newProjectTitle"),
      label: t("projectExplorer.dialogs.projectNameLabel"),
      initialValue: t("workspace.newDiagramName"),
      confirmLabel: t("projectExplorer.dialogs.createAction"),
      required: true,
      validate: (value) => (/[\\/]/.test(value) ? t("projectExplorer.errors.invalid-characters") : null),
    });
    if (requestedName == null) {
      return;
    }
    const projectName = requestedName;

    await sqlPlaygroundManagerRef.current?.closeGeneratedSessions(projectExplorer.project.id);
    setOpenSqlPlaygroundSchemaIds([]);
    setSqlFilePlaygroundConfigs({});
    setActiveSqlPlaygroundSchemaId(null);
    setLastSqlPlaygroundSchemaId(null);
    setActiveImportedDatabaseSessionId(null);

    const newDiagram = createEmptyDiagram(projectName);
    const translationWorkspace = createEmptyErTranslationWorkspace(newDiagram);
    const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
    const schema = createSchemaDocumentFromProjectState({
      diagram: newDiagram,
      translationWorkspace,
      logicalWorkspace,
      logicalGenerated: false,
      logicalStage: "translation",
      diagramView: "er",
      viewport: DEFAULT_VIEWPORT,
      translationViewport: DEFAULT_VIEWPORT,
      logicalViewport: DEFAULT_VIEWPORT,
      workspace: {
        ...currentProjectWorkspaceState,
        tool: "select",
        selection: { nodeIds: [], edgeIds: [] },
        translationSelection: { nodeIds: [], edgeIds: [] },
        logicalSelection: { ...EMPTY_LOGICAL_SELECTION },
        codeDraft: serializeDiagramToErs(newDiagram),
        codeDirty: false,
      },
      versioning: createEmptyProjectVersioningState(),
    });
    const nextProject = createEmptyProjectExplorerState(projectName);
    setHasProject(true);
    setProjectExplorer(nextProject);
    applyWorkspaceDocument(
      newDiagram,
      t("workspace.newProject"),
      {
        translationWorkspace,
        logicalWorkspace,
        logicalGenerated: false,
        logicalStage: "translation",
        diagramView: "er",
        viewport: DEFAULT_VIEWPORT,
        translationViewport: DEFAULT_VIEWPORT,
        logicalViewport: DEFAULT_VIEWPORT,
        versioning: createEmptyProjectVersioningState(),
        workspace: schema.workspace,
      },
    );
    markProjectExplorerSaved(nextProject);
  }

  async function handleCloseProject() {
    if (!hasProject) {
      setStatusWarning(t("noProjectWelcome.title"));
      return;
    }
    if (!(await confirmDiscardChanges(t("workspace.unsavedActions.closeProject")))) {
      return;
    }

    const noProjectSnapshot = serializeWorkspaceSessionSnapshot({
      workspaceState: "no-project",
    });
    latestSessionSnapshotRef.current = noProjectSnapshot;
    saveWorkspaceSessionSnapshot(noProjectSnapshot);

    const blankDiagram = createEmptyDiagram("buildER");
    const blankTranslationWorkspace = createEmptyErTranslationWorkspace(blankDiagram);
    const blankLogicalWorkspace = createEmptyLogicalWorkspace(blankTranslationWorkspace.translatedDiagram);
    const emptyVersioning = createEmptyProjectVersioningState();
    const emptyProjectExplorer = createEmptyProjectExplorerState("buildER Project");
    const blankCode = serializeDiagramToErs(blankDiagram);

    await sqlPlaygroundManagerRef.current?.closeGeneratedSessions(projectExplorer.project.id);
    setOpenSqlPlaygroundSchemaIds([]);
    setSqlFilePlaygroundConfigs({});
    setActiveSqlPlaygroundSchemaId(null);
    setLastSqlPlaygroundSchemaId(null);
    setActiveImportedDatabaseSessionId((current) => current ?? openImportedDatabaseSessionIds[openImportedDatabaseSessionIds.length - 1] ?? null);
    setHasProject(false);
    setProjectExplorer(emptyProjectExplorer);
    history.reset(blankDiagram);
    translationHistory.reset(blankTranslationWorkspace);
    logicalHistory.reset(blankLogicalWorkspace);
    projectVersioning.setVersioning(emptyVersioning);
    replaceCodeDraft(blankCode);
    setDiagramView("er");
    setLogicalGenerated(false);
    setLogicalStage("translation");
    setLogicalPanelMode("review");
    setLogicalTypeMode(false);
    setViewport({ ...DEFAULT_VIEWPORT });
    setTranslationViewport({ ...DEFAULT_VIEWPORT });
    setLogicalViewport({ ...DEFAULT_VIEWPORT });
    setSelection({ nodeIds: [], edgeIds: [] });
    setTranslationSelection({ nodeIds: [], edgeIds: [] });
    setLogicalSelection({ ...EMPTY_LOGICAL_SELECTION });
    setIdentifierSelection(null);
    setTool("select");
    setCodeDiagnostics([]);
    setCommandMenuOpen(false);
    setKeyboardShortcutsOpen(false);
    setAboutOpen(false);
    appReleases.closeReleaseCenter();
    setIntroOpen(false);
    setVersionCompareSession(null);
    setSourceControlCommitMessage("");
    setSelectedSourceCommitId(null);
    setSqlReverseWorkflow(createInitialSqlReverseWorkflowState());
    setActiveActivityPanel("file");
    setTechnicalPanelOpen(false);
    setCodePanelOpen(false);
    setNotesPanelOpen(false);
    setFocusMode(false);
    setOnboardingOpen(false);
    setOnboardingStepState({
      entityCreated: false,
      relationshipCreated: false,
      connectionCreated: false,
      renamedNode: false,
    });
    onboardingPreviousSnapshotRef.current = null;
    codeLayoutMemoryRef.current = null;
    suppressNextCodeSyncRef.current = false;
    closePromptDialog(null);
    setPromptError("");
    setRestoreDialogError("");
    setCommitDialogError("");
    setRestoreDialogBusy(false);
    setCommitDialogBusy(false);

    lastSavedDiagramRef.current = serializeDiagram(blankDiagram);
    lastSavedCodeRef.current = blankCode;
    lastSavedVersioningRef.current = JSON.stringify(emptyVersioning);
    lastSavedWorkspaceRef.current = JSON.stringify({
      ...currentProjectWorkspaceState,
      tool: "select",
      selection: { nodeIds: [], edgeIds: [] },
      translationSelection: { nodeIds: [], edgeIds: [] },
      logicalSelection: { ...EMPTY_LOGICAL_SELECTION },
      codeDraft: blankCode,
      codeDirty: false,
      technicalPanelOpen: false,
      codePanelOpen: false,
      notesPanelOpen: false,
      focusMode: false,
    });
    lastSavedProjectExplorerRef.current = JSON.stringify(emptyProjectExplorer);
    hasUnsavedChangesRef.current = false;
    setStatus(t("noProjectWelcome.title"));
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
    const nextDiagram =
      type === "attribute"
        ? layoutIncrementallyConnectedAttribute(nextDiagramBase, nextEdge.id)
        : nextDiagramBase;

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
      setStatus(t("canvas.status.connectionCreationCancelled"));
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
        ...(part.importedIdentifierKind === "external" ? { importedIdentifierKind: "external" as const } : {}),
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
        ...(option.importedIdentifierKind === "external" ? { importedIdentifierKind: "external" as const } : {}),
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
      setStatus(t("workspace.isaCreationCancelled"));
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

    const result = createAttributeForHost(history.present, hostNode.id);
    if (!result) {
      setStatusWarning(t("workspace.selectValidAttributeHost"), {
        title: t("workspace.noticeTitles.attributeNotApplicable"),
      });
      return;
    }

    commitDiagram(result.diagram);
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
    setStatus(t("workspace.internalIdentifiersUpdated"));
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
    setStatus(t("workspace.externalIdentifiersUpdated"));
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
          t("workspace.errors.attributeRelationshipIdentifierNotApplied.what"),
          t("workspace.errors.attributeRelationshipIdentifierNotApplied.why"),
          t("workspace.errors.attributeRelationshipIdentifierNotApplied.how"),
        ),
      );
      return;
    }

    if (currentNode?.type === "attribute") {
      if (Object.prototype.hasOwnProperty.call(attributePatch, "cardinality")) {
        const normalizedCardinality = normalizeSupportedCardinality(attributePatch.cardinality);
        if (normalizedCardinality !== undefined && !canAttributeHaveCardinality(workingDiagram, currentNode)) {
          setStatusWarning(t("workspace.cardinalityNotAssignableToIdentifiers"));
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
              t("workspace.errors.attributeCompositeNotApplied.what"),
              t("workspace.errors.attributeCompositeNotApplied.why", { label: currentNode.label }),
              t("workspace.errors.attributeCompositeNotApplied.how"),
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
          setStatusWarning(t("workspace.cardinalityNotAppliedToIdentifiers"));
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
        title: t("dialogs.prompt.renameElementTitle"),
        label: t("dialogs.prompt.renameElementLabel"),
        initialValue: selectedNode.label,
        required: true,
        requiredMessage: t("dialogs.prompt.renameElementRequired"),
      });
      if (nextLabel == null) {
        return;
      }

      if (nextLabel === selectedNode.label) {
        return;
      }

      handleRenameNode(selectedNode.id, nextLabel);
      setStatus(t("workspace.nodeRenamed"));
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
    setStatus(t("workspace.selectionDeleted"));
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
    setStatus(t("workspace.nodeDeleted"));
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
    if (!hasProject) {
      setStatusWarning(t("noProjectWelcome.title"));
      return;
    }

    try {
      const syncedProject = syncActiveSchemaToProject();
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
        project: syncedProject.project,
        files: syncedProject.files,
        explorerView: syncedProject.view,
      });
      setProjectExplorer(syncedProject);
      downloadTextFile(
        serializedProject,
        `${sanitizeFileNameBase(syncedProject.project.name)}${PROJECT_FILE_EXTENSION}`,
        PROJECT_FILE_MIME_TYPE,
      );
      markDiagramSaved(history.present);
      markCodeSaved(codeDirtyRef.current ? codeDraftRef.current : serializeDiagramToErs(history.present));
      markVersioningSaved();
      markWorkspaceSaved(currentProjectWorkspaceState);
      markProjectExplorerSaved(syncedProject);
      hasUnsavedChangesRef.current = false;
      setStatus(t("workspace.projectSaved"));
      showSuccessNotice(t("workspace.downloads.projectDownloaded"), { title: t("workspace.noticeTitles.downloadCompleted") });
    } catch (error) {
      console.error(error);
      setStatusError(formatProjectFileErrorMessage(error));
    }
  }

  function handleSaveCurrentSchema() {
    if (!hasOpenSchema) {
      setStatusWarning(t("workspace.noSchemaExportWarning"));
      return;
    }
    const activeFileId = projectExplorer.project.activeFileId ?? projectExplorer.view.activeFileId;
    const activeFile = activeFileId ? projectExplorer.files[activeFileId] : undefined;
    const fallbackName = activeFile?.name ?? `${history.present.meta.name}${SCHEMA_FILE_EXTENSION}`;
    const schema = createCurrentSchemaDocument();
    downloadTextFile(
      serializeSchemaFile(schema),
      `${sanitizeFileNameBase(stripKnownProjectExtension(fallbackName))}${SCHEMA_FILE_EXTENSION}`,
      SCHEMA_FILE_MIME_TYPE,
    );
    setStatus(t("projectExplorer.status.schemaExported"));
    showSuccessNotice(t("workspace.downloads.schemaExported"), { title: t("workspace.noticeTitles.downloadCompleted") });
  }

  function handleImportSchemaRequest() {
    schemaFileInputRef.current?.click();
  }

  function handleSaveErs() {
    if (!hasOpenSchema) {
      setStatusWarning(t("workspace.noSchemaCodeWarning"));
      return;
    }
    const source = codeDirtyRef.current ? codeDraftRef.current : serializeDiagramToErs(history.present);
    downloadTextFile(source, `${sanitizeFileNameBase(history.present.meta.name)}.ers`);
    markCodeSaved(source);
    if (!codeDirtyRef.current && codeDiagnostics.length === 0) {
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

  async function handleCopyLogicalCode() {
    if (!canShowLogicalSqlCode) {
      setStatusWarning(t("codePanel.noLogicalSql"));
      return;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
      setStatusWarning(t("codePanel.clipboardUnavailable"));
      return;
    }

    await navigator.clipboard.writeText(logicalDisplayedCode);
    setStatus(logicalCodePreviewMode === "sql" ? t("codePanel.sqlCopied") : t("codePanel.relationalSchemaCopied"));
  }

  function handleDownloadDisplayedLogicalCode() {
    if (!canShowLogicalSqlCode) {
      setStatusWarning(t("codePanel.noLogicalSql"));
      return;
    }

    const isSql = logicalCodePreviewMode === "sql";
    downloadTextFile(
      logicalDisplayedCode,
      `${sanitizeFileNameBase(history.present.meta.name)}${isSql ? ".sql" : "-relational-schema.txt"}`,
      isSql ? "text/sql;charset=utf-8" : "text/plain;charset=utf-8",
    );
    setStatus(isSql ? t("workspace.sqlDownloaded") : t("codePanel.relationalSchemaDownloaded"));
    showSuccessNotice(isSql ? t("workspace.downloads.sqlDownloaded") : t("codePanel.relationalSchemaDownloaded"), {
      title: t("workspace.noticeTitles.downloadCompleted"),
    });
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

      setCommitDialogError("");
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

    setVersionCompareSession({
      left: { kind: "commit", commitId },
      right: { kind: "working-copy" },
    });
  }

  function handleOpenErrorsPanel() {
    setActiveActivityPanel("errors");
    setWorkspaceActivityOpen(true);
  }

  function handleReviewAllSourceChanges() {
    if (!projectVersioning.versioning.headCommitId) {
      setStatusWarning(t("sourceControl.reviewNeedsSnapshot"));
      return;
    }
    setVersionCompareSession({
      left: { kind: "head" },
      right: { kind: "working-copy" },
      scope: { kind: "project" },
    });
  }

  function handleReviewSourceFile(change: ProjectFileChange) {
    if (!projectVersioning.versioning.headCommitId) {
      setStatusWarning(t("sourceControl.reviewNeedsSnapshot"));
      return;
    }
    setVersionCompareSession({
      left: { kind: "head" },
      right: { kind: "working-copy" },
      scope: {
        kind: "file",
        fileId: change.fileId,
        preferredView: getPreferredCompareView(change.kind),
      },
    });
  }

  function handleRefreshSourceControl() {
    setProjectExplorer((current) => syncActiveSchemaToProject(current));
    setStatus(t("sourceControl.refreshed"));
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

    setVersionCompareSession({
      left: { kind: "commit", commitId },
      right: { kind: "head" },
    });
  }

  function handleCompareCommitWithParent(commitId: string) {
    const commit = projectVersioning.getCommitById(commitId);
    if (!commit) {
      handleMissingDiffCommit(commitId);
      return;
    }

    if (!commit.parentId) {
      setStatusWarning(t("versioning.diff.commitNotFound", { commitId }));
      return;
    }

    if (!projectVersioning.getCommitById(commit.parentId)) {
      handleMissingDiffCommit(commit.parentId);
      return;
    }

    setVersionCompareSession({
      left: { kind: "commit", commitId: commit.parentId },
      right: { kind: "commit", commitId },
    });
  }

  async function handleConfirmRestoreCommit(requestedCommitId: string) {
    const requestedCommit = projectVersioning.getCommitById(requestedCommitId);
    if (!requestedCommit) {
      handleMissingDiffCommit(requestedCommitId);
      return;
    }
    const confirmed = await requestConfirmDialog({
      title: t("sourceControl.confirmRestoreTitle"),
      message: t("sourceControl.confirmRestoreCommit", { message: requestedCommit.message }),
      confirmLabel: t("sourceControl.restore"),
      cancelLabel: t("sourceControl.cancel"),
      danger: true,
    });
    if (!confirmed) return;

    setRestoreDialogBusy(true);
    setRestoreDialogError("");

    try {
      const result = await projectVersioning.restoreCommit(requestedCommitId, currentProjectCommitSnapshot, {
        backupMessage: t("versioning.restore.backupMessage"),
        backupDescription: t("versioning.restore.backupDescription", { commitId: requestedCommitId.slice(0, 8) }),
        restoreMessage: t("versioning.restore.restoreMessage", {
          message: projectVersioning.getCommitById(requestedCommitId)?.message ?? requestedCommitId.slice(0, 8),
        }),
        restoreDescription: t("versioning.restore.restoreDescription", { commitId: requestedCommitId.slice(0, 8) }),
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
      if (restoreSnapshot.project && restoreSnapshot.files && restoreSnapshot.explorerView) {
        const restoredProjectExplorer: ProjectExplorerState = normalizeProjectTabs({
          project: {
            ...restoreSnapshot.project,
            activeFileId: restoreSnapshot.activeFileId ?? restoreSnapshot.project.activeFileId,
          },
          files: restoreSnapshot.files,
          view: {
            ...restoreSnapshot.explorerView,
            activeFileId: restoreSnapshot.activeFileId ?? restoreSnapshot.explorerView.activeFileId,
          },
        });
        const activeFileId =
          restoredProjectExplorer.project.activeFileId ??
          restoredProjectExplorer.view.activeFileId ??
          Object.values(restoredProjectExplorer.files).find((file) => file.kind === "schema")?.id ??
          null;
        const activeFile = activeFileId ? restoredProjectExplorer.files[activeFileId] : undefined;
        setProjectExplorer(restoredProjectExplorer);
        if (activeFile?.kind === "schema") {
          const centeredViewport = createCenteredViewportForDiagram(activeFile.schema.diagram);
          applyWorkspaceDocument(activeFile.schema.diagram, t("versioning.restore.restored"), {
            translationWorkspace: activeFile.schema.translationWorkspace,
            logicalWorkspace: activeFile.schema.logicalWorkspace,
            logicalGenerated: activeFile.schema.logicalGenerated,
            logicalStage: activeFile.schema.logicalStage,
            diagramView: activeFile.schema.view.current,
            viewport: centeredViewport,
            translationViewport: createCenteredViewportForDiagram(activeFile.schema.translationWorkspace.translatedDiagram),
            logicalViewport: DEFAULT_VIEWPORT,
            versioning: result.versioning,
            workspace: activeFile.schema.workspace,
            resetHistory: true,
            markBaseline: false,
          });
          if (activeFile.schema.logicalGenerated) {
            setLogicalFitRequestToken((current) => current + 1);
          }
        } else {
          projectVersioning.setVersioning(result.versioning);
        }
      } else {
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
      }

      setRestoreDialogError("");
      setVersionCompareSession(null);
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

  async function handleDeleteProjectCommit(commitId: string) {
    const commit = projectVersioning.getCommitById(commitId);
    if (!commit) {
      handleMissingDiffCommit(commitId);
      return;
    }
    const confirmed = await requestConfirmDialog({
      title: t("sourceControl.confirmDeleteTitle"),
      message: commitId === projectVersioning.versioning.headCommitId
        ? t("sourceControl.confirmDeleteHead", { message: commit.message })
        : t("sourceControl.confirmDeleteCommit", { message: commit.message }),
      confirmLabel: t("sourceControl.deleteCommit"),
      cancelLabel: t("sourceControl.cancel"),
      danger: true,
    });
    if (!confirmed) return;

    const result = projectVersioning.deleteCommit(commitId);
    if (result.status === "missing-commit") {
      handleMissingDiffCommit(commitId);
      return;
    }

    if (selectedSourceCommitId === commitId) {
      setSelectedSourceCommitId(null);
    }
    if (
      versionCompareSession &&
      ((versionCompareSession.left.kind === "commit" && versionCompareSession.left.commitId === commitId) ||
        (versionCompareSession.right.kind === "commit" && versionCompareSession.right.commitId === commitId))
    ) {
      setVersionCompareSession(null);
    }
    const message = t("sourceControl.deletedNotice", { id: commitId.slice(0, 8) });
    setStatus(message);
    showSuccessNotice(message, { title: t("sourceControl.title") });
  }

  function handleCreateProjectCommitTag(commitId: string, input: ProjectCommitTagInput) {
    const result = projectVersioning.createTag(commitId, input);
    if (result.status === "created") {
      const message = t("sourceControl.tags.createdNotice", { name: result.tag.name });
      setStatus(message);
      showSuccessNotice(message, { title: t("sourceControl.tags.title") });
    }
    return result;
  }

  function handleUpdateProjectCommitTag(tagId: string, input: ProjectCommitTagInput) {
    const result = projectVersioning.updateTag(tagId, input);
    if (result.status === "updated") {
      const message = t("sourceControl.tags.updatedNotice", { name: result.tag.name });
      setStatus(message);
      showSuccessNotice(message, { title: t("sourceControl.tags.title") });
    }
    return result;
  }

  function handleDeleteProjectCommitTag(tagId: string) {
    const result = projectVersioning.deleteTag(tagId);
    if (result.status === "deleted") {
      const message = t("sourceControl.tags.deletedNotice", { name: result.deletedTag.name });
      setStatus(message);
      showSuccessNotice(message, { title: t("sourceControl.tags.title") });
      if (
        selectedSourceCommitId
        && !result.versioning.commits.some((commit) => commit.id === selectedSourceCommitId)
      ) {
        setSelectedSourceCommitId(null);
      }
    }
    return result;
  }

  function handleUpdateProjectVersioningSettings(patch: Partial<ProjectVersioningSettings>) {
    const result = projectVersioning.updateSettings(patch);
    if (result.status === "updated") {
      const message = t("sourceControl.settings.updatedNotice");
      setStatus(message);
      showSuccessNotice(message, { title: t("sourceControl.settings.title") });
      if (
        selectedSourceCommitId
        && !result.versioning.commits.some((commit) => commit.id === selectedSourceCommitId)
      ) {
        setSelectedSourceCommitId(null);
      }
    }
    return result;
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
          : parsedProject.source === "legacy-project-json"
            ? t("projectExplorer.status.legacyConverted")
            : parsedProject.source === "schema-file"
              ? t("projectExplorer.status.schemaImported")
          : t("workspace.projectLoaded");
      await sqlPlaygroundManagerRef.current?.closeGeneratedSessions(projectExplorer.project.id);
      setOpenSqlPlaygroundSchemaIds([]);
      setSqlFilePlaygroundConfigs({});
      setActiveSqlPlaygroundSchemaId(null);
      setLastSqlPlaygroundSchemaId(null);
      setActiveImportedDatabaseSessionId(null);
      setHasProject(true);
      if (parsedProject.state.project && parsedProject.state.files && parsedProject.state.explorerView) {
        const nextProjectExplorer = normalizeProjectTabs({
          project: parsedProject.state.project,
          files: parsedProject.state.files,
          view: parsedProject.state.explorerView,
        });
        setProjectExplorer(nextProjectExplorer);
        markProjectExplorerSaved(nextProjectExplorer);
      }
      applyWorkspaceDocument(parsedProject.state.diagram, loadStatus, {
        translationWorkspace: parsedProject.state.translationWorkspace,
        logicalWorkspace: parsedProject.state.logicalWorkspace,
        logicalGenerated: parsedProject.state.logicalGenerated,
        logicalStage: parsedProject.state.logicalStage,
        diagramView: parsedProject.state.diagramView,
        viewport: createCenteredViewportForDiagram(parsedProject.state.diagram),
        translationViewport: createCenteredViewportForDiagram(parsedProject.state.translationWorkspace.translatedDiagram),
        logicalViewport: DEFAULT_VIEWPORT,
        versioning: parsedProject.state.versioning,
        workspace: parsedProject.state.workspace,
      });
      if (parsedProject.state.logicalGenerated) {
        setLogicalFitRequestToken((current) => current + 1);
      }
    } catch (error) {
      console.error(error);
      setStatusError(formatProjectFileErrorMessage(error));
    } finally {
      event.target.value = "";
    }
  }

  async function handleLoadSchemaFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const rawText = await file.text();
      const schema = parseSchemaFile(rawText, DEFAULT_VIEWPORT);
      const synced = getProjectStateForImportedSchema(file.name || schema.diagram.meta.name);
      const uniqueName = getUniqueProjectNodeName(
        synced.project,
        synced.project.rootId,
        ensureProjectFileExtension(file.name || schema.diagram.meta.name, "schema"),
      );
      const schemaFile = createSchemaWorkspaceFile(uniqueName, schema);
      const result = addProjectFile(synced, synced.project.rootId, schemaFile);
      if (!result.ok) {
        setStatusWarning(t(`projectExplorer.errors.${result.reason}`));
        return;
      }

      setHasProject(true);
      openSchemaWorkspaceFile(schemaFile.id, result.state, { center: true });
      setStatus(t("projectExplorer.status.schemaImported"));
      showSuccessNotice(t("projectExplorer.status.schemaImported"), { title: t("workspace.noticeTitles.downloadCompleted") });
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
      const translationWorkspace = createEmptyErTranslationWorkspace(parsed);
      const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
      const schema = createSchemaDocumentFromProjectState({
        diagram: parsed,
        translationWorkspace,
        logicalWorkspace,
        logicalGenerated: false,
        logicalStage: "translation",
        diagramView: "er",
        viewport,
        translationViewport,
        logicalViewport,
        workspace: {
          ...currentProjectWorkspaceState,
          codeDraft: rawText,
          codeDirty: false,
        },
      });
      const synced = getProjectStateForImportedSchema(file.name || parsed.meta.name);
      const uniqueName = getUniqueProjectNodeName(
        synced.project,
        synced.project.rootId,
        ensureProjectFileExtension(file.name || parsed.meta.name, "schema"),
      );
      const schemaFile = createSchemaWorkspaceFile(uniqueName, schema);
      const result = addProjectFile(synced, synced.project.rootId, schemaFile);
      if (!result.ok) {
        setStatusWarning(t(`projectExplorer.errors.${result.reason}`));
        return;
      }
      setHasProject(true);
      openSchemaWorkspaceFile(schemaFile.id, result.state, { center: true });
      setStatus(t("workspace.ersLoaded"));
    } catch (error) {
      console.error(error);
      const message = error instanceof ErsParseError
        ? t("workspace.invalidErsCode")
        : error instanceof Error
          ? error.message
          : t("workspace.invalidErsCode");
      const formattedMessage = formatErsErrorMessage(message);
      setCodeDiagnostics([{
        id: `ers-import:${error instanceof ErsParseError ? error.line : "unknown"}:${formattedMessage}`,
        level: "error",
        message: formattedMessage,
        line: error instanceof ErsParseError ? error.line : undefined,
      }]);
      setStatusError(formattedMessage);
    } finally {
      event.target.value = "";
    }
  }

  function handleResetCodeFromDiagram() {
    if (!hasOpenSchema) {
      setStatusWarning(t("workspace.noSchemaCodeWarning"));
      return;
    }
    syncCodeDraftWithDiagram(history.present);
    setStatus(t("workspace.codeRegenerated"));
  }

  async function handleExportPng() {
    if (!hasOpenSchema) {
      setStatusWarning(t("workspace.noSchemaExportWarning"));
      return;
    }
    if (!svgRef.current) {
      setStatusWarning(t("workspace.exportCanvasUnavailablePng"));
      return;
    }

    try {
      await downloadPng(svgRef.current, "builder-diagram.png", {
        background: diagramView === "er" || diagramView === "translation" ? "canvas" : "transparent",
      });
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
    if (!hasOpenSchema) {
      setStatusWarning(t("workspace.noSchemaExportWarning"));
      return;
    }
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
    if (!hasOpenSchema) {
      setStatusWarning(t("workspace.noSchemaExportWarning"));
      return;
    }
    if (!svgRef.current) {
      setStatusWarning(t("workspace.exportCanvasUnavailableSvg"));
      return;
    }

    downloadSvg(svgRef.current, "builder-diagram.svg", {
      background: diagramView === "er" || diagramView === "translation" ? "canvas" : "white",
    });
    setStatus(t("workspace.exports.svgExported"));
    showSuccessNotice(t("workspace.downloads.svgExported"), { title: t("workspace.noticeTitles.exportCompleted") });
  }

  function handleUndoAction() {
    if (diagramView === "er") {
      if (codeDirtyRef.current || codeDiagnostics.length > 0) {
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
      if (codeDirtyRef.current || codeDiagnostics.length > 0) {
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
              {getLocalizedValidationIssueMessage(issue)}
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
  const visibleActivityIssues = issues.filter(issueTargetExists);
  const visibleActivityIssuePresentations = visibleActivityIssues.map((issue) => presentValidationIssue(issue, history.present, t));
  const errorsActivityPresentation = getValidationActivityPresentation(visibleActivityIssues);
  const activityItems: ProjectActivityItem[] = [
    { id: "file", label: t("appHeader.menus.file"), icon: "openProject", shortcut: "Ctrl+Shift+E" },
    { id: "properties", label: t("inspector.panel.propertiesPanel"), icon: "list" },
    { id: "code", label: t("appHeader.menus.code"), icon: "code", shortcut: "Ctrl+`" },
    { id: "reverse", label: t("appHeader.menus.reverse"), icon: "databaseReverse" },
    { id: "errors", label: t("appHeader.menus.errors"), ...errorsActivityPresentation, shortcut: "Ctrl+Shift+M" },
    { id: "version", label: t("appHeader.menus.version"), icon: "branch", badge: hasVersioningUncommittedChanges ? 1 : undefined },
    { id: "sql-explorer", label: t("sqlExplorer.title"), icon: "database" },
    { id: "export", label: t("appHeader.menus.export"), icon: "export" },
  ];
  const dirtyProjectFileIds = new Set(versioningChangeState.files.map((file) => file.fileId));
  const visibleProjectTabs: WorkspaceOpenTab[] = [
    ...(hasProject ? applyProjectTabDirtyFileIds(projectExplorer.view.openTabs, dirtyProjectFileIds) : []),
    ...(hasProject ? openSqlPlaygroundSchemaIds.flatMap((schemaFileId) => {
      const file = projectExplorer.files[schemaFileId];
      return file?.kind === "schema" || file?.kind === "sql"
        ? [{
            id: `sql-playground:${schemaFileId}`,
            kind: "sql-playground" as const,
            schemaFileId,
            title: t("sqlPlayground.tabTitle", { name: file.name }),
          }]
        : [];
    }) : []),
    ...importedDatabaseSessions.map((session, index, allSessions) => {
      const duplicateIndex = allSessions.slice(0, index).filter((candidate) => candidate.fileName === session.fileName).length;
      const titleSuffix = duplicateIndex > 0 ? ` (${duplicateIndex + 1})` : "";
      return {
        id: `database:${session.sessionId}`,
        kind: "sqlite-database" as const,
        databaseSessionId: session.sessionId,
        title: t("databaseWorkspace.tabTitle", { name: `${session.fileName}${titleSuffix}` }),
        databaseDirty: session.hasUnexportedChanges,
      };
    }),
  ];
  const activeWorkspaceTabId = importedDatabaseActive
    ? `database:${activeImportedDatabaseSessionId}`
    : sqlPlaygroundActive
      ? `sql-playground:${activeSqlPlaygroundSchemaId}`
      : hasProject ? projectExplorer.view.activeTabId : null;
  async function handleCreateSourceControlCommit() {
    const created = await handleCreateProjectCommit(sourceControlCommitMessage);
    if (created) {
      setSourceControlCommitMessage("");
    }
  }
  const activityPanelContent =
    activeActivityPanel === "properties" ? (
      <SelectionInspectorPanel
        diagram={history.present}
        selectionItemCount={selectionItemCount}
        selectedNode={selectedNode}
        selectedEdge={selectedEdge}
        editable={mode === "edit"}
        onRenameNode={handleRenameNode}
        onSelectNode={(nodeId) => setSelection({ nodeIds: [nodeId], edgeIds: [] })}
        onAddAttribute={
          selectedNode?.type === "entity" || selectedNode?.type === "relationship"
            ? handleCreateAttributeFromSelection
            : undefined
        }
        onClose={handleToggleActivityPanelOpen}
        closeLabel={t("workspaceActivity.closePanel")}
      />
    ) : activeActivityPanel === "file" ? (
      <div className="project-activity-file">
        <ProjectExplorer
          embedded
          project={projectExplorer.project}
          files={projectExplorer.files}
          view={projectExplorer.view}
          dirtyFileIds={dirtyProjectFileIds}
          onOpenFile={handleProjectExplorerOpenFile}
          onCreateSchema={handleProjectExplorerCreateSchema}
          onCreateTextFile={handleProjectExplorerCreateTextFile}
          onCreateSqlFile={handleProjectExplorerCreateSqlFile}
          onCreateFolder={handleProjectExplorerCreateFolder}
          onRename={handleProjectExplorerRename}
          onDelete={handleProjectExplorerDelete}
          onMove={handleProjectExplorerMove}
          onRequestMove={setMoveDialogNodeId}
          onToggleFolder={handleProjectExplorerToggleFolder}
          onCollapseAll={handleProjectExplorerCollapseAll}
          onToggleOpen={handleToggleActivityPanelOpen}
          onResizeStart={handleProjectExplorerResizeStart}
          onSelectNode={handleProjectExplorerSelectNode}
        />
      </div>
    ) : activeActivityPanel === "code" ? (
      logicalSqlRequested && !canShowLogicalSqlCode ? (
        <section className="project-activity-section" aria-label={t("appHeader.menus.code")}>
          <ProjectActivityPanelHeader title={t("codePanel.title")} closeLabel={t("workspaceActivity.closePanel")} onClose={handleToggleActivityPanelOpen} />
          <p className="project-activity-empty">{t("codePanel.noLogicalSql")}</p>
        </section>
      ) : hasOpenSchema || codePanelMode !== "ers" ? (
        <section className="project-activity-section code-activity-panel" aria-label={t("appHeader.menus.code")}>
          <ProjectActivityPanelHeader
            title={t("codePanel.title")}
            badge={codePanelDiagnostics.length || undefined}
            badgeLabel={codePanelDiagnostics.length ? t("codeEditor.diagnostic.count", { count: codePanelDiagnostics.length }) : undefined}
            closeLabel={t("workspaceActivity.closePanel")}
            onClose={handleToggleActivityPanelOpen}
          />
          {codePanelMode !== "ers" ? (
            <div className="code-activity-panel__toolbar" aria-label={t("codePanel.modeSql")}>
              <div className="code-activity-panel__mode-tabs" role="tablist" aria-label={t("codePanel.logicalPreviewMode")}>
                <button
                  type="button"
                  role="tab"
                  className={["code-activity-panel__mode-tab", logicalCodePreviewMode === "sql" ? "active" : ""].filter(Boolean).join(" ")}
                  aria-selected={logicalCodePreviewMode === "sql"}
                  onClick={() => setLogicalCodePreviewMode("sql")}
                >
                  {t("logical.designer.sqlTab")}
                </button>
                <button
                  type="button"
                  role="tab"
                  className={["code-activity-panel__mode-tab", logicalCodePreviewMode === "relational" ? "active" : ""].filter(Boolean).join(" ")}
                  aria-selected={logicalCodePreviewMode === "relational"}
                  onClick={() => setLogicalCodePreviewMode("relational")}
                >
                  {t("logical.designer.relationalSchemaTab")}
                </button>
              </div>
              {logicalCodePreviewMode === "sql" ? (
                <>
                  <label className="code-activity-panel__dialect">
                    <select
                      className="ui-select"
                      value={logicalSqlDialect}
                      onChange={(event) => setLogicalSqlDialect(event.target.value as LogicalSqlDialect)}
                    >
                      {LOGICAL_SQL_DIALECT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    variant="secondary"
                    size="sm"
                    iconLeft="database"
                    disabled={!activeSchemaFile}
                    onClick={handleOpenSqlPlayground}
                  >
                    {t("sqlPlayground.open")}
                  </Button>
                </>
              ) : null}
              <PanelIconButton
                icon="copy"
                label={logicalCodePreviewMode === "sql" ? t("codePanel.copySql") : t("codePanel.copyRelationalSchema")}
                onClick={() => void handleCopyLogicalCode()}
              />
              <PanelIconButton
                icon="download"
                label={logicalCodePreviewMode === "sql" ? t("codePanel.downloadSql") : t("codePanel.downloadRelationalSchema")}
                onClick={handleDownloadDisplayedLogicalCode}
              />
            </div>
          ) : null}
          <div className="code-activity-panel__body">
            <CodePanel
              embedded
              showHeader={false}
              showCloseButton={false}
              language={codePanelMode}
              code={codePanelContent}
              editable={codePanelEditable}
              readOnly={!codePanelEditable}
              diagnostics={codePanelDiagnostics}
              editorAriaLabel={
                codePanelMode === "sql"
                  ? t("codePanel.editorAriaSql")
                  : codePanelMode === "relational"
                    ? t("codePanel.editorAriaRelational")
                    : t("codePanel.editorAria")
              }
              onCodeChange={codePanelMode === "ers" ? updateCodeDraft : undefined}
              onFocus={codePanelMode === "ers" ? handleCodeEditorFocus : undefined}
              onBlur={codePanelMode === "ers" ? handleCodeEditorBlur : undefined}
              onClose={handleToggleCodePanel}
            />
          </div>
        </section>
      ) : (
        <WorkspacePanel className="project-activity-section" label={t("appHeader.menus.code")}>
          <ProjectActivityPanelHeader title={t("codePanel.title")} closeLabel={t("workspaceActivity.closePanel")} onClose={handleToggleActivityPanelOpen} />
          <PanelEmptyState
            className="code-panel__empty"
            variant="card"
            icon="code"
            title={t("workspace.codeEmpty.title")}
            description={t("workspace.codeEmpty.description")}
          >
            <Button
              size="sm"
              variant="primary"
              iconLeft="schema"
              onClick={() => void handleProjectExplorerCreateSchema(projectExplorer.project.rootId)}
            >
              {t("workspace.codeEmpty.createSchema")}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              iconLeft="panelLeft"
              onClick={() => handleSelectActivityPanel("file")}
            >
              {t("workspace.codeEmpty.openExplorer")}
            </Button>
          </PanelEmptyState>
        </WorkspacePanel>
      )
    ) : activeActivityPanel === "reverse" ? (
      <SqlReversePanel
        sql={sqlReverseWorkflow.sourceSql}
        errorMessage={sqlReverseWorkflow.errorMessage}
        issues={sqlReverseWorkflow.issues}
        logicalIssues={sqlReverseWorkflow.logicalIssues}
        tableCount={sqlReverseWorkflow.tableCount}
        unsupportedStatementCount={sqlReverseWorkflow.unsupportedStatementCount}
        unsupportedStatements={sqlReverseWorkflow.unsupportedStatements}
        isPreviewReady={sqlReverseWorkflow.isPreviewReady}
        sourceFileName={sqlReverseWorkflow.sourceFileName}
        dialect={sqlReverseWorkflow.dialect}
        onDialectChange={handleSqlReverseDialectChange}
        onSqlChange={handleSqlReverseSourceChange}
        onAnalyze={handleAnalyzeSqlReverseWorkflow}
        onLoadFile={handleLoadSqlReverseFile}
        onClear={handleClearSqlReverse}
        onClose={handleToggleActivityPanelOpen}
        closeLabel={t("workspaceActivity.closePanel")}
      />
    ) : activeActivityPanel === "errors" ? (
      <ErrorsPanel
        issues={visibleActivityIssuePresentations}
        showIndicators={showDiagnostics}
        onToggleIndicators={handleToggleDiagnosticsVisibility}
        onSelectIssue={(issueId) => {
          const issue = visibleActivityIssues.find((candidate) => candidate.id === issueId);
          if (issue) handleIssueNotice(issue);
        }}
        onIssueAction={(issue, action) => handleValidationIssueAction(issue, action)}
        onClose={handleToggleActivityPanelOpen}
        closeLabel={t("workspaceActivity.closePanel")}
      />
    ) : activeActivityPanel === "version" ? (
      <SourceControlPanel
        projectName={projectExplorer.project.name}
        projectFilePaths={projectFilePaths}
        workingFileIds={Object.keys(projectExplorer.files)}
        commitMessage={sourceControlCommitMessage}
        commitBusy={commitDialogBusy}
        changeState={versioningChangeState}
        versioning={projectVersioning.versioning}
        commits={projectVersioning.visibleCommitsNewestFirst}
        totalCommitCount={projectVersioning.commitsNewestFirst.length}
        selectedCommitId={selectedSourceCommitId}
        onCommitMessageChange={setSourceControlCommitMessage}
        onCommit={handleCreateSourceControlCommit}
        onRefresh={handleRefreshSourceControl}
        onReviewAllChanges={handleReviewAllSourceChanges}
        onReviewFile={handleReviewSourceFile}
        onOpenFile={handleProjectExplorerOpenFile}
        onSelectCommit={setSelectedSourceCommitId}
        onCompareWithCurrent={handleCompareCommitWithCurrent}
        onCompareWithHead={handleCompareCommitWithHead}
        onCompareWithParent={handleCompareCommitWithParent}
        onRestoreCommit={(commitId) => void handleConfirmRestoreCommit(commitId)}
        onDeleteCommit={(commitId) => void handleDeleteProjectCommit(commitId)}
        onCreateTag={handleCreateProjectCommitTag}
        onUpdateTag={handleUpdateProjectCommitTag}
        onDeleteTag={handleDeleteProjectCommitTag}
        onUpdateSettings={handleUpdateProjectVersioningSettings}
        onClose={handleToggleActivityPanelOpen}
        closeLabel={t("workspaceActivity.closePanel")}
      />
    ) : activeActivityPanel === "sql-explorer" ? (
      <SqlExplorerPanel
        manager={sqlPlaygroundManagerRef.current}
        sessionId={sqlExplorerSessionId}
        schemaName={sqlExplorerDisplayName}
        hasProject={hasProject}
        hasSchema={Boolean(sqlExplorerSchema?.kind === "schema")}
        sessions={availableSqlExplorerSessions}
        onSessionChange={handleSqlExplorerSessionChange}
        onOpenDatabase={handleOpenSqliteDatabaseRequest}
        onReverseDatabase={handleStartDatabaseReverse}
        onOpenQuery={handleOpenSqlExplorerQuery}
        onOpenPlayground={handleOpenSqlExplorerPlayground}
        onClose={handleToggleActivityPanelOpen}
      />
    ) : (
      <section className="project-activity-section" aria-label={t("workspaceActivity.export.title")}>
        <ProjectActivityPanelHeader
          title={t("workspaceActivity.export.title")}
          subtitle={t("workspaceActivity.export.description")}
          closeLabel={t("workspaceActivity.closePanel")}
          onClose={handleToggleActivityPanelOpen}
        />
        <div className="project-activity-actions">
          <button type="button" className="project-activity-action" onClick={handleExportPng}>
            <StudioIcon name="fileImage" aria-hidden="true" />
            <span>{t("appHeader.commands.exportPng")}</span>
          </button>
          <button type="button" className="project-activity-action" onClick={handleExportJpeg}>
            <StudioIcon name="image" aria-hidden="true" />
            <span>{t("appHeader.commands.exportJpeg")}</span>
          </button>
          <button type="button" className="project-activity-action" onClick={handleExportSvg}>
            <StudioIcon name="export" aria-hidden="true" />
            <span>{t("appHeader.commands.exportSvg")}</span>
          </button>
          <button type="button" className="project-activity-action" onClick={handleSaveProject}>
            <StudioIcon name="save" aria-hidden="true" />
            <span>{t("appHeader.commands.exportProject")}</span>
          </button>
          <button type="button" className="project-activity-action" onClick={handleSaveCurrentSchema}>
            <StudioIcon name="download" aria-hidden="true" />
            <span>{t("appHeader.commands.exportCurrentSchema")}</span>
          </button>
          <button
            type="button"
            className="project-activity-action"
            onClick={handleSaveLogicalSql}
            disabled={diagramView !== "logical" || logicalHistory.present.model.tables.length === 0}
          >
            <StudioIcon name="database" aria-hidden="true" />
            <span>{t("appHeader.commands.exportSql")}</span>
          </button>
        </div>
      </section>
    );

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
          initialScope={versionCompareSession.scope}
          onExitCompareMode={() => setVersionCompareSession(null)}
        />

        <WorkspaceToastStack
          notices={notices}
          onDismissNotice={dismissNotice}
          onPauseTimers={pauseNoticeTimers}
          onResumeTimers={resumeNoticeTimers}
        />
      </>
    );
  }

  /**
   * Sposta il focus sul landmark `main` senza lasciare l'hash nell'URL: in una
   * SPA il fragment resterebbe in cronologia e cambierebbe il link condiviso.
   */
  function handleSkipToContent(event: ReactMouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(WORKSPACE_MAIN_ID);
    if (!target) {
      return;
    }

    event.preventDefault();
    target.focus();
    target.scrollIntoView({ block: "nearest" });
  }

  return (
    <div className={appShellClassName}>
        {/* Primo elemento focalizzabile della pagina: senza, da tastiera
            servivano oltre quaranta Tab per arrivare alla superficie di
            lavoro, attraversando header, rail, Explorer e tab dei file. */}
        <a className="skip-link" href={`#${WORKSPACE_MAIN_ID}`} onClick={handleSkipToContent}>
          {t("workspaceChrome.skipToContent")}
        </a>
        <AppHeader
          appTitle={APP_TITLE}
          appVersion={APP_VERSION}
          projectName={hasProject ? projectExplorer.project.name : undefined}
          saveState={hasVersioningUncommittedChanges ? "modified" : "saved"}
          diagramView={diagramView}
        logicalSqlOpen={logicalPanelMode === "sql"}
        codePanelOpen={codePanelOpen}
        notesPanelOpen={notesPanelOpen}
        logicalOutOfDate={logicalOutOfDate}
        focusMode={focusMode}
        hasUncommittedChanges={hasVersioningUncommittedChanges}
        versioningCommitCount={projectVersioning.versioning.commits.length}
        issueCount={issues.length}
        warningCount={issues.filter((issue) => issue.level === "warning").length}
        showDiagnostics={showDiagnostics}
        activeActivityPanel={activeActivityPanel}
        hasProject={hasProject}
        onNewProject={handleNewProject}
        onCloseProject={handleCloseProject}
        onShowWelcome={handleShowWelcomeTab}
        onNewSchema={() => handleProjectExplorerCreateSchema(projectExplorer.project.rootId)}
        onNewNote={() => handleProjectExplorerCreateTextFile(projectExplorer.project.rootId)}
        onNewSql={() => handleProjectExplorerCreateSqlFile(projectExplorer.project.rootId)}
        onNewFolder={() => handleProjectExplorerCreateFolder(projectExplorer.project.rootId)}
          onImportSchema={handleImportSchemaRequest}
          onImportErs={handleLoadErsRequest}
          onExportCurrentSchema={handleSaveCurrentSchema}
          onOpenVersioningPanel={() => {
          setActiveActivityPanel("version");
          setWorkspaceActivityOpen(true);
        }}
        onToggleCodePanel={handleToggleCodePanel}
        onToggleNotesPanel={handleToggleNotesPanel}
        onRegenerateErs={handleResetCodeFromDiagram}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProjectRequest}
        onSaveErs={handleSaveErs}
        onOpenSqlReverseWorkflow={handleOpenSqlReverseWorkflow}
        onImportSql={handleOpenSqlReverseWorkflow}
        onOpenSqliteDatabase={handleOpenSqliteDatabaseRequest}
        onOpenErrorsPanel={handleOpenErrorsPanel}
        onToggleDiagnostics={() => setShowDiagnostics((current) => !current)}
        onExportPng={handleExportPng}
        onExportJpeg={handleExportJpeg}
        onExportSvg={handleExportSvg}
        onExportSql={handleSaveLogicalSql}
        onOpenCommandMenu={openCommandMenu}
        onOpenShortcuts={openKeyboardShortcuts}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAbout={() => setAboutOpen(true)}
        onOpenReleaseCenter={openReleaseCenter}
        unreadReleaseCount={appReleases.unreadCount}
        onActivityPanelSelect={handleSelectActivityPanel}
          onCreateCommit={() => {
            setActiveActivityPanel("version");
            setWorkspaceActivityOpen(true);
          }}
        />

      <WorkspaceToastStack
          notices={notices}
          onDismissNotice={dismissNotice}
          onPauseTimers={pauseNoticeTimers}
          onResumeTimers={resumeNoticeTimers}
        />

      <div className={workspaceRegionClassName}>
        {hasWorkspaceShell ? (
          <>
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

            <ProjectActivityPanel
              items={activityItems}
              activeId={activeActivityPanel}
              open={projectExplorer.view.explorerOpen}
              width={projectExplorer.view.explorerWidth}
              title={t("workspaceActivity.title")}
              openLabel={t("workspaceActivity.openPanel")}
              closeLabel={t("workspaceActivity.closePanel")}
              commandMenuLabel={t("workspaceActivity.commandMenu")}
              keyboardShortcutsLabel={t("workspaceActivity.keyboardShortcuts")}
              onSelect={handleSelectActivityPanel}
              onToggleOpen={handleToggleActivityPanelOpen}
              onOpenCommandMenu={openCommandMenu}
              onOpenShortcuts={openKeyboardShortcuts}
              onResizeStart={handleProjectExplorerResizeStart}
              onResizeBy={handleProjectExplorerResizeBy}
            >
              {activityPanelContent}
            </ProjectActivityPanel>

            <div className="project-main-area">
          <ProjectFileTabs
            tabs={visibleProjectTabs}
            activeTabId={activeWorkspaceTabId}
            files={projectExplorer.files}
            paths={projectFilePaths}
            onSelectTab={handleProjectFileTabSelect}
            onCloseTab={handleProjectFileTabClose}
            onCloseOthers={handleProjectTabsCloseOthers}
            onCloseToRight={handleProjectTabsCloseToRight}
            onCloseAll={handleProjectTabsCloseAll}
            onRevealFile={handleRevealProjectFile}
            onReorder={handleProjectTabReorder}
            onNewFile={hasProject ? () => handleProjectExplorerCreateSchema(projectExplorer.project.rootId) : undefined}
          />
          {activeProjectFile && !sqlPlaygroundActive && !importedDatabaseActive ? (
            <WorkspaceEditorHeader
              projectName={projectExplorer.project.name}
              file={activeProjectFile}
              path={projectFilePaths[activeProjectFile.id] ?? activeProjectFile.name}
              view={diagramView}
              onReveal={() => handleRevealProjectFile(activeProjectFile.id)}
              onViewChange={handleDiagramViewChange}
              onOpenSqlPlayground={activeProjectFile.kind === "sql"
                ? () => void handleOpenSqlFileInPlayground(activeProjectFile)
                : undefined}
              onStartSqlReverse={activeProjectFile.kind === "sql"
                ? () => handleStartSqlReverseFromFile(activeProjectFile)
                : undefined}
            />
          ) : null}
          {/* Unico landmark `main` del workspace. Prima lo dichiaravano le
              singole superfici (welcome, empty, editor di testo), quindi con
              uno schema aperto — canvas ER, traduzione, logica — non ce n'era
              nessuno e tutta la pagina restava fuori da un main. */}
          <main
            id={WORKSPACE_MAIN_ID}
            tabIndex={-1}
            aria-label={t("workspaceChrome.mainContentAria")}
            className={sqlPlaygroundActive || importedDatabaseActive ? "project-main-content project-main-content--sql-playground" : "project-main-content"}
          >
            {importedDatabaseActive && activeImportedDatabaseSessionId ? (
              <ImportedDatabaseWorkspace
                key={activeImportedDatabaseSessionId}
                manager={getSqlPlaygroundManager()}
                sessionId={activeImportedDatabaseSessionId}
                onReverse={handleStartDatabaseReverse}
                queryRequest={sqlExplorerQueryRequest?.sessionId === activeImportedDatabaseSessionId ? sqlExplorerQueryRequest : null}
              />
            ) : sqlPlaygroundActive && activeSqlPlaygroundSourceFile ? (
              <SqlPlaygroundWorkspace
                key={`${projectExplorer.project.id}:${activeSqlPlaygroundSourceFile.id}`}
                manager={getSqlPlaygroundManager()}
                projectId={projectExplorer.project.id}
                schemaFileId={activeSqlPlaygroundSourceFile.id}
                schemaName={sqlFilePlaygroundConfigs[activeSqlPlaygroundSourceFile.id]?.databaseName
                  ?? activeSqlPlaygroundSourceFile.name}
                generatedSql={sqlFilePlaygroundConfigs[activeSqlPlaygroundSourceFile.id]?.generatedSql
                  ?? sqlPlaygroundSchemaCode}
                hasLogicalModel={activeSqlPlaygroundSourceFile.kind === "sql"
                  ? Boolean(sqlFilePlaygroundConfigs[activeSqlPlaygroundSourceFile.id])
                  : logicalGenerated && logicalHistory.present.model.tables.length > 0}
                logicalOutOfDate={activeSqlPlaygroundSourceFile.kind === "schema" && logicalOutOfDate}
                queryRequest={sqlExplorerQueryRequest?.sessionId === buildSqlPlaygroundSessionId(
                  projectExplorer.project.id,
                  activeSqlPlaygroundSourceFile.id,
                ) ? sqlExplorerQueryRequest : null}
                onGenerateLogicalModel={() => {
                  setActiveSqlPlaygroundSchemaId(null);
                  handleGenerateLogicalModel();
                }}
              />
            ) : sqlReversePreviewContent ? (
              sqlReversePreviewContent
            ) : welcomeTabActive ? (
              <WorkspaceWelcomePage
                projectName={projectExplorer.project.name}
                fileCount={projectFileCount}
                folderCount={projectFolderCount}
                onNewSchema={() => handleProjectExplorerCreateSchema(projectExplorer.project.rootId)}
                onNewNote={() => handleProjectExplorerCreateTextFile(projectExplorer.project.rootId)}
                onNewSql={() => handleProjectExplorerCreateSqlFile(projectExplorer.project.rootId)}
                onOpenProject={handleLoadProjectRequest}
                onImportSchema={handleImportSchemaRequest}
              />
            ) : activeProjectFile && activeProjectFile.kind !== "schema" ? (
              <WorkspaceTextEditor
                file={activeProjectFile}
                editable={mode === "edit"}
                onChange={handleActiveTextFileChange}
              />
            ) : !hasProjectTabsOpen ? (
              <WorkspaceEmptyEditor
                onOpenWelcome={handleShowWelcomeTab}
                onNewSchema={() => handleProjectExplorerCreateSchema(projectExplorer.project.rootId)}
                onNewSql={() => handleProjectExplorerCreateSqlFile(projectExplorer.project.rootId)}
              />
            ) : !hasOpenSchema ? (
              <WorkspaceEmptyEditor
                onOpenWelcome={handleShowWelcomeTab}
                onNewSchema={() => handleProjectExplorerCreateSchema(projectExplorer.project.rootId)}
                onNewSql={() => handleProjectExplorerCreateSqlFile(projectExplorer.project.rootId)}
              />
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
          {/* Le altre superfici hanno gia un titolo visibile (welcome, empty
              editor, Playground, database); il canvas no, quindi resterebbe
              l'unica pagina senza intestazione. Qui e riservato agli screen
              reader: la stessa informazione e gia visibile in breadcrumb e
              view switcher. */}
          <h1 className="visually-hidden">
            {t("workspaceChrome.diagramHeading", {
              name: activeProjectFile?.name ?? projectExplorer.project.name,
              view: t(`workspaceChrome.views.${diagramView === "er" ? "conceptual" : diagramView}`),
            })}
          </h1>
          {diagramView === "er" ? (
            <div className="designer-workspace">
              <div className="designer-canvas-region">

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
                  onAutoLayout={() => void handleConceptualAutoLayout()}
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
                  viewportCommand={erViewportCommand}
                  showMinimap
                  onAutoLayout={() => void handleConceptualAutoLayout()}
                  onAutoLayoutSelection={() => handleConceptualAutoLayoutSelection()}
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
              viewportCommand={translationViewportCommand}
              onSelectionChange={setTranslationSelection}
              onAutoLayout={() => void handleTranslationAutoLayout()}
              onApplyChoice={handleApplyErTranslationChoice}
              onResetTranslation={handleResetTranslation}
              onOpenDesign={() => handleDiagramViewChange("er")}
              onOpenLogical={handleGenerateLogicalModel}
              notesPanelOpen={notesPanelOpen}
              onToggleNotesPanel={handleToggleNotesPanel}
              onExportProject={handleSaveProject}
              onExportPng={handleExportPng}
              onExportJpeg={handleExportJpeg}
              onExportSvg={handleExportSvg}
              onSaveRestructuredErs={handleSaveRestructuredErs}
              svgRef={svgRef}
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
              viewportCommand={logicalViewportCommand}
              notesPanelOpen={notesPanelOpen}
              canUndo={logicalHistory.canUndo}
              canRedo={logicalHistory.canRedo}
              onUndo={handleUndoAction}
              onRedo={handleRedoAction}
              onAutoLayout={() => void handleLogicalAutoLayout()}
              onViewportChange={setLogicalViewport}
              onSelectionChange={setLogicalSelection}
              onTypeModeChange={handleLogicalTypeModeChange}
              onPanelModeChange={handleLogicalPanelModeChange}
              onToggleNotesPanel={handleToggleNotesPanel}
              onApplyChoice={handleApplyLogicalTranslationChoice}
              onApplyBulkFix={handleApplyBulkLogicalFix}
              onResetTranslation={handleResetLogicalTranslation}
              onRequestRename={(label, currentValue) =>
                requestPromptDialog({
                  title: label,
                  label,
                  initialValue: currentValue,
                  required: true,
                  requiredMessage: t("dialogs.prompt.required"),
                })
              }
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
          </main>
        </div>
          </>
        ) : (
          <NoProjectWelcomePage
            onNewProject={handleNewProject}
            onOpenProject={handleLoadProjectRequest}
            onImportSchema={handleImportSchemaRequest}
            onOpenSqliteDatabase={handleOpenSqliteDatabaseRequest}
            onImportSql={() => void handleImportSqlWithoutProject()}
          />
        )}
      </div>

      <BottomStatusBar
        projectName={hasProject ? projectExplorer.project.name : undefined}
        activeFileName={activeProjectFile?.name}
        zoomPercent={(diagramView === "logical" ? logicalViewport.zoom : diagramView === "translation" ? translationViewport.zoom : viewport.zoom) * 100}
        appVersion={APP_VERSION}
        diagramView={diagramView}
        logicalSqlOpen={logicalPanelMode === "sql"}
        codePanelOpen={codePanelOpen}
        notesPanelOpen={notesPanelOpen}
        statusMessage={statusMessage}
        notices={notices}
        issues={issues}
        selectionItemCount={selectionItemCount}
        onDismissNotice={dismissNotice}
      />

      <input
        ref={projectFileInputRef}
        className="hidden-input"
        type="file"
        accept={PROJECT_FILE_ACCEPT}
        onChange={handleLoadProjectFile}
      />
      <input
        ref={schemaFileInputRef}
        className="hidden-input"
        type="file"
        accept={SCHEMA_FILE_ACCEPT}
        onChange={handleLoadSchemaFile}
      />
      <input
        ref={ersFileInputRef}
        className="hidden-input"
        type="file"
        accept=".ers,text/plain"
        onChange={handleLoadErsFile}
      />
      <input
        ref={sqliteFileInputRef}
        className="hidden-input"
        type="file"
        accept={SQLITE_DATABASE_ACCEPT}
        aria-label={t("databaseWorkspace.openDatabase")}
        onChange={handleSqliteDatabaseFile}
      />

      <Modal
        open={Boolean(largeDatabaseFile)}
        onClose={() => setLargeDatabaseFile(null)}
        title={t("databaseWorkspace.largeFile.title")}
        subtitle={t("databaseWorkspace.largeFile.message")}
        size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setLargeDatabaseFile(null)}>{t("common.actions.cancel")}</Button>
            <Button variant="primary" onClick={() => { if (largeDatabaseFile) void openSqliteDatabase(largeDatabaseFile); }}>{t("databaseWorkspace.largeFile.openAnyway")}</Button>
          </>
        )}
      >
        <p>{t("databaseWorkspace.largeFile.originalSafe")}</p>
      </Modal>

      <Modal
        open={Boolean(databaseOpeningName)}
        onClose={() => undefined}
        title={t("databaseWorkspace.status.opening")}
        subtitle={databaseOpeningName ?? undefined}
        size="sm"
        busy
        hideClose
      >
        <div className="sql-explorer-loading" role="status"><span className="ui-button__spinner" aria-hidden="true" />{t("databaseWorkspace.status.verifying")}</div>
      </Modal>

      <DatabaseCloseDialog
        open={Boolean(databaseCloseSession)}
        fileName={databaseCloseSession?.fileName ?? ""}
        busy={databaseCloseBusy}
        onCancel={() => resolveImportedDatabaseClose(false)}
        onDiscard={() => {
          if (!databaseCloseSessionId) return;
          void closeImportedDatabaseSession(databaseCloseSessionId).then(() => resolveImportedDatabaseClose(true));
        }}
        onSaveCopy={() => {
          if (!databaseCloseSessionId) return;
          setDatabaseCloseBusy(true);
          void exportImportedDatabaseSession(databaseCloseSessionId).then(async (saved) => {
            if (saved) {
              await closeImportedDatabaseSession(databaseCloseSessionId);
              resolveImportedDatabaseClose(true);
            }
            setDatabaseCloseBusy(false);
          });
        }}
      />

      <Modal
        open={Boolean(databaseRestoreSession)}
        onClose={() => setDatabaseRestoreSessionId(null)}
        title={t("databaseWorkspace.restoreDialog.title")}
        subtitle={t("databaseWorkspace.restoreDialog.message")}
        size="sm"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDatabaseRestoreSessionId(null)}>{t("common.actions.cancel")}</Button>
            <Button variant="danger" onClick={() => { if (databaseRestoreSessionId) void restoreImportedDatabaseSession(databaseRestoreSessionId); }}>{t("databaseWorkspace.restoreOriginal")}</Button>
          </>
        )}
      >
        <p>{t("databaseWorkspace.restoreDialog.originalSafe")}</p>
      </Modal>

      {databaseReverseSession && sqlPlaygroundManagerRef.current ? (
        <DatabaseReverseWizard
          manager={sqlPlaygroundManagerRef.current}
          session={databaseReverseSession}
          hasProject={hasProject}
          hasActiveSchema={Boolean(activeSchemaFile)}
          onClose={() => setDatabaseReverseSessionId(null)}
          onApply={handleApplyDatabaseReverse}
        />
      ) : null}

      <NotesModal
        open={notesPanelOpen}
        notes={history.present.notes}
        editable={mode === "edit"}
        onSave={handleNotesChange}
        onClose={() => setNotesPanelOpen(false)}
        onConfirmDiscard={() =>
          requestConfirmDialog({
            title: t("dialogs.discardNotes.title"),
            message: t("notesPanel.unsavedConfirm"),
            confirmLabel: t("dialogs.discardNotes.confirm"),
            cancelLabel: t("dialogs.unsavedChanges.cancel"),
            danger: true,
          })
        }
      />

      {commandMenuOpen ? (
        <CommandMenuModal
          diagramView={diagramView}
          logicalSqlOpen={logicalPanelMode === "sql"}
          sqlPlaygroundOpen={Boolean(sqlPlaygroundActive)}
          codePanelOpen={codePanelOpen}
          notesPanelOpen={notesPanelOpen}
          errorsPanelOpen={activeActivityPanel === "errors" && projectExplorer.view.explorerOpen}
          explorerOpen={activeActivityPanel === "file" && projectExplorer.view.explorerOpen}
          versioningOpen={activeActivityPanel === "version" && projectExplorer.view.explorerOpen}
          reverseOpen={activeActivityPanel === "reverse" && projectExplorer.view.explorerOpen}
          canUndo={activeCanUndo}
          canRedo={activeCanRedo}
          canExportLogicalSql={diagramView === "logical" && logicalHistory.present.model.tables.length > 0}
          logicalOutOfDate={logicalOutOfDate}
          focusMode={focusMode}
          showDiagnostics={showDiagnostics}
          hasUncommittedChanges={hasVersioningUncommittedChanges}
          toolRailCollapsed={effectiveToolbarCollapsed}
          selectionItemCount={selectionItemCount}
          editMode={mode === "edit"}
          hasProject={hasProject}
          hasActiveSchema={hasOpenSchema}
          projectFiles={commandPaletteProjectFiles}
          projectFilePaths={projectFilePaths}
          openTabs={projectExplorer.view.openTabs}
          activeFileId={activeProjectFileId}
          onClose={closeCommandMenu}
          onOpenProjectFile={handleProjectExplorerOpenFile}
          onOpenShortcuts={openKeyboardShortcuts}
          onOpenSettings={() => setSettingsOpen(true)}
          onDiagramViewChange={handleDiagramViewChange}
          onOpenSql={handleOpenSqlStage}
          onOpenSqlPlayground={handleOpenSqlPlayground}
          onOpenSqliteDatabase={handleOpenSqliteDatabaseRequest}
          hasImportedDatabase={Boolean(activeImportedDatabaseSession)}
          onSaveImportedDatabase={() => {
            if (activeImportedDatabaseSessionId) void exportImportedDatabaseSession(activeImportedDatabaseSessionId);
          }}
          onRestoreImportedDatabase={() => {
            if (activeImportedDatabaseSessionId) setDatabaseRestoreSessionId(activeImportedDatabaseSessionId);
          }}
          onReverseImportedDatabase={() => {
            if (activeImportedDatabaseSessionId) handleStartDatabaseReverse(activeImportedDatabaseSessionId);
          }}
          onOpenLogicalWorkflow={handleOpenLogicalStage}
          onNewProject={handleNewProject}
          onCloseProject={handleCloseProject}
          onShowWelcome={handleShowWelcomeTab}
          onUndo={handleUndoAction}
          onRedo={handleRedoAction}
          onCopySelection={handleCopySelection}
          onPasteSelection={() => void handlePasteSelection()}
          onDuplicateSelection={handleDuplicateSelection}
          onDeleteSelection={handleDeleteSelection}
          onRenameSelection={handleRenameSelectionQuick}
          onGenerateLogicalModel={handleGenerateLogicalModel}
          onResetTranslation={handleResetTranslation}
          onFitAll={() => requestActiveViewportCommand("fitAll")}
          onFitSelection={() => requestActiveViewportCommand("fitSelection")}
          onResetZoom={() => requestActiveViewportCommand("resetZoom")}
          onToggleMinimap={() => requestActiveViewportCommand("toggleMinimap")}
          canAutoLayoutCurrent={
            mode === "edit" &&
            (diagramView === "logical"
              ? logicalHistory.present.model.tables.length > 0
              : diagramView === "translation"
                ? translationHistory.present.translatedDiagram.nodes.length > 0
                : history.present.nodes.length > 0)
          }
          onAutoLayoutCurrent={() => {
            if (diagramView === "logical") void handleLogicalAutoLayout();
            else if (diagramView === "translation") void handleTranslationAutoLayout();
            else void handleConceptualAutoLayout();
          }}
          canAutoLayoutSelection={
            mode === "edit" &&
            diagramView === "er" &&
            history.present.nodes.filter(
              (node) => node.type !== "attribute" && selection.nodeIds.includes(node.id),
            ).length >= 2
          }
          onAutoLayoutSelection={() => handleConceptualAutoLayoutSelection()}
          onOpenSqlReverseWorkflow={handleOpenSqlReverseWorkflow}
          onOpenExplorer={() => handleSelectActivityPanel("file")}
          onOpenErrorsPanel={handleOpenErrorsPanel}
          onOpenVersioningPanel={() => {
            setActiveActivityPanel("version");
            setWorkspaceActivityOpen(true);
          }}
          onToggleDiagnostics={() => setShowDiagnostics((current) => !current)}
          onToggleCodePanel={handleToggleCodePanel}
          onToggleNotesPanel={handleToggleNotesPanel}
          onSaveProject={handleSaveProject}
          onNewSchema={() => handleProjectExplorerCreateSchema(projectExplorer.project.rootId)}
          onNewNote={() => handleProjectExplorerCreateTextFile(projectExplorer.project.rootId)}
          onNewSql={() => handleProjectExplorerCreateSqlFile(projectExplorer.project.rootId)}
          onNewFolder={() => handleProjectExplorerCreateFolder(projectExplorer.project.rootId)}
          onImportSchema={handleImportSchemaRequest}
          onImportSql={handleOpenSqlReverseWorkflow}
          onExportCurrentSchema={handleSaveCurrentSchema}
          onSaveErs={handleSaveErs}
          onExportSql={handleSaveLogicalSql}
          onLoadProject={handleLoadProjectRequest}
          onLoadErs={handleLoadErsRequest}
          onExportPng={handleExportPng}
          onExportJpeg={handleExportJpeg}
          onExportSvg={handleExportSvg}
          onResetErs={handleResetCodeFromDiagram}
          onAbout={() => {
            appReleases.closeReleaseCenter();
            setAboutOpen(true);
          }}
          onOpenReleaseCenter={() => {
            setAboutOpen(false);
            openReleaseCenter();
          }}
          onToggleFocusMode={handleToggleFocusMode}
          onToggleToolRail={handleToggleToolRail}
        />
      ) : null}

      {keyboardShortcutsOpen ? <KeyboardShortcutsModal onClose={() => setKeyboardShortcutsOpen(false)} /> : null}
      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        showDiagnostics={showDiagnostics}
        onShowDiagnosticsChange={setShowDiagnostics}
        onOpenShortcuts={() => {
          setSettingsOpen(false);
          openKeyboardShortcuts();
        }}
        onOpenReleaseCenter={() => {
          setSettingsOpen(false);
          openReleaseCenter();
        }}
      />
      {moveDialogNodeId ? (
        <MoveToDialog
          open
          nodeName={projectExplorer.project.fileTree.find((candidate) => candidate.id === moveDialogNodeId)?.name ?? ""}
          destinations={getValidMoveDestinations(projectExplorer, moveDialogNodeId)}
          onMove={(targetParentId) => {
            handleProjectExplorerMove(moveDialogNodeId, targetParentId);
            setMoveDialogNodeId(null);
          }}
          onClose={() => setMoveDialogNodeId(null)}
        />
      ) : null}

      {confirmDialog ? (
        <Modal
          open
          onClose={() => closeConfirmDialog(false)}
          title={confirmDialog.title}
          size="sm"
          className="action-modal"
          footer={
            <>
              <Button variant="secondary" data-dialog-safe onClick={() => closeConfirmDialog(false)}>
                {confirmDialog.cancelLabel}
              </Button>
              <Button
                variant={confirmDialog.danger ? "danger" : "primary"}
                onClick={() => closeConfirmDialog(true)}
              >
                {confirmDialog.confirmLabel}
              </Button>
            </>
          }
        >
          <div className="action-modal-content">
            <p>{confirmDialog.message}</p>
          </div>
        </Modal>
      ) : null}

      {promptDialog ? (
        <Modal
          open
          onClose={() => closePromptDialog(null)}
          title={promptDialog.title}
          size="sm"
          className="action-modal"
        >
          <form
            className="action-modal-content"
            onSubmit={(event) => {
              event.preventDefault();
              submitPromptDialog();
            }}
          >
            <Field label={promptDialog.label} error={promptError || undefined}>
              {({ id, invalid, describedBy }) => (
                <input
                  id={id}
                  ref={promptInputRef}
                  value={promptValue}
                  placeholder={promptDialog.placeholder}
                  aria-invalid={invalid || undefined}
                  aria-describedby={describedBy}
                  autoFocus
                  onChange={(event) => {
                    setPromptValue(event.target.value);
                    if (promptError) {
                      setPromptError("");
                    }
                  }}
                />
              )}
            </Field>

            <div className="ui-modal__footer action-modal-actions">
              <Button variant="secondary" onClick={() => closePromptDialog(null)}>
                {promptDialog.cancelLabel}
              </Button>
              <Button type="submit" variant="primary">
                {promptDialog.confirmLabel}
              </Button>
            </div>
          </form>
        </Modal>
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
        <Modal
          open
          onClose={() => setMixedIdentifierDialog(null)}
          title={t("workspace.externalIdentifierDialog.title")}
          size="sm"
          className="action-modal"
        >
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
              {mixedIdentifierDialog.error ? <p className="action-modal-error" role="alert">{mixedIdentifierDialog.error}</p> : null}
              <div className="ui-modal__footer action-modal-actions">
                <Button variant="secondary" onClick={() => setMixedIdentifierDialog(null)}>
                  {t("workspace.externalIdentifierDialog.cancel")}
                </Button>
                <Button type="submit" variant="primary" disabled={mixedIdentifierDialog.importedParts.length === 0}>
                  {t("workspace.externalIdentifierDialog.create")}
                </Button>
              </div>
            </form>
        </Modal>
      ) : null}

      {generalizationGroupDialog ? (() => {
        const dialog = generalizationGroupDialog;
        const compatibleGroups = getCompatibleGeneralizationGroups(history.present, dialog.supertypeId);
        const subtypeLabel = getEntityLabel(history.present, dialog.subtypeId);
        const supertypeLabel = getEntityLabel(history.present, dialog.supertypeId);
        return (
          <Modal
            open
            onClose={cancelGeneralizationGroupDialog}
            title={t("workspace.generalizationGroupDialog.title")}
            size="sm"
            className="action-modal"
          >
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

                {dialog.error ? <p className="action-modal-error" role="alert">{dialog.error}</p> : null}
                <div className="ui-modal__footer action-modal-actions">
                  <Button variant="secondary" onClick={cancelGeneralizationGroupDialog}>
                    {t("common.actions.cancel")}
                  </Button>
                  <Button type="submit" variant="primary">
                    {t("common.actions.confirm")}
                  </Button>
                </div>
              </form>
          </Modal>
        );
      })() : null}

      {introOpen ? (
        <Modal
          open
          onClose={() => setIntroOpen(false)}
          title={t("intro.title", { appTitle: APP_TITLE })}
          size="md"
          className="intro-modal"
          backdropClassName="intro-modal-backdrop"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setIntroOpen(false);
                  setAboutOpen(true);
                }}
              >
                {t("intro.openGuide")}
              </Button>
              <Button variant="primary" onClick={() => setIntroOpen(false)}>
                {t("intro.startDrawing")}
              </Button>
            </>
          }
        >
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
          </div>
        </Modal>
      ) : null}

      {aboutOpen ? (
        <Modal
          open
          onClose={() => setAboutOpen(false)}
          title={t("about.title")}
          subtitle={t("about.subtitle")}
          size="md"
          className="about-modal"
        >
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
        </Modal>
      ) : null}

      {!releaseAnnouncementBlocked && appReleases.announcement?.mode === "toast" ? (
        <ReleaseToast
          announcement={appReleases.announcement}
          onClose={appReleases.dismissAnnouncement}
          onOpenReleaseCenter={openReleaseCenter}
        />
      ) : null}

      {!releaseAnnouncementBlocked && appReleases.announcement?.mode === "modal" ? (
        <ReleaseAnnouncement
          announcement={appReleases.announcement}
          onClose={appReleases.dismissAnnouncement}
          onOpenReleaseCenter={openReleaseCenter}
        />
      ) : null}

      {appReleases.announcement?.mode === "critical" ? (
        <CriticalReleaseBanner announcement={appReleases.announcement} onOpenReleaseCenter={openReleaseCenter} />
      ) : null}

      {appReleases.releaseCenterOpen ? (
        <ReleaseCenter
          currentVersion={appReleases.currentVersion}
          releases={appReleases.allReleases}
          unreadVersions={appReleases.releaseCenterUnreadVersions}
          onClose={appReleases.closeReleaseCenter}
        />
      ) : null}

    </div>
  );
}
