import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import { DiagramCanvas } from "./canvas/DiagramCanvas";
import { AppHeader } from "./components/AppHeader";
import { ChangelogModal } from "./components/ChangelogModal";
import { CodeModeTutorialPage } from "./components/CodeModeTutorialPage";
import { CodePanel } from "./components/CodePanel";
import { CommandMenuModal } from "./components/CommandMenuModal";
import {
  CardinalityModal,
  type CardinalityDialogState,
  type CardinalityDialogTarget,
} from "./components/CardinalityModal";
import { KeyboardShortcutsModal } from "./components/KeyboardShortcutsModal";
import { NotesPanel } from "./components/NotesPanel";
import { OnboardingGuide } from "./components/OnboardingGuide";
import { SqlReverseErPreview } from "./components/SqlReverseErPreview";
import { SqlReverseInputModal } from "./components/SqlReverseInputModal";
import { SqlReverseLogicalPreview } from "./components/SqlReverseLogicalPreview";
import { SqlReversePreviewFrame } from "./components/SqlReversePreviewFrame";
import type { TechnicalPanelTab } from "./components/TechnicalDockPanel";
import { StudioIcon } from "./components/icons/StudioIcon";
import { PanelSection, WarningCard } from "./components/panels";
import { useHistory } from "./hooks/useHistory";
import { LogicalTranslationWorkspace } from "./logical/LogicalTranslationWorkspace";
import { TranslationWorkspace } from "./translation/TranslationWorkspace";
import { Toolbar } from "./toolbar/Toolbar";
import type {
  AttributeNode,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EntityNode,
  EditorMode,
  ExternalIdentifier,
  GeneralizationGroup,
  IsaCompleteness,
  IsaDisjointness,
  Point,
  SelectionState,
  ToolKind,
  ValidationIssue,
  Viewport,
} from "./types/diagram";
import { EMPTY_LOGICAL_SELECTION } from "./types/logical";
import type {
  LogicalIssue,
  LogicalModel,
  LogicalSelection,
  LogicalStage,
  LogicalTranslationChoice,
  LogicalTranslationItem,
  LogicalTranslationState,
  LogicalWorkspaceDocument,
} from "./types/logical";
import type {
  ErTranslationChoice,
  ErTranslationItem,
  ErTranslationState,
  ErTranslationWorkspaceDocument,
  WorkspaceView,
} from "./types/translation";
import {
  alignNodes,
  assignInheritanceEdgeToGeneralizationGroup,
  assignInheritanceConstraintToGroup,
  canConnect,
  canAttributeHaveCardinality,
  canAttributeBecomeComposite,
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
  parseDiagram,
  removeEntityFromGeneralizationHierarchy,
  removeExternalIdentifierFromEntity,
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
import { downloadPng, downloadSvg } from "./utils/export";
import { GRID_SIZE, snapValue } from "./utils/geometry";
import { distributeAttributesAroundHost, placeNewAttributeAroundHost } from "./utils/attributeLayout";
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
  parseProjectFile,
  ProjectFileError,
  PROJECT_FILE_ACCEPT,
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MIME_TYPE,
  serializeProjectFile,
} from "./utils/projectFile";
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
import { APP_CHANGELOG, APP_NAME, APP_TITLE, APP_VERSION, type AppChangelogEntry } from "./utils/appMeta";
import { VersionAnnouncement } from "./components/VersionAnnouncement";
import { classifyAppUpdate } from "./utils/versioning";
import type { AppUpdateKind } from "./utils/versioning";
import {
  getLastSeenAppVersion,
  hasSeenVersionAnnouncement,
  rememberLastSeenAppVersion,
  rememberVersionAnnouncementSeen,
} from "./utils/versionAnnouncementStorage";

const DEFAULT_VIEWPORT: Viewport = {
  x: 180,
  y: 110,
  zoom: 1,
};

type VisibleVersionUpdateKind = Extract<AppUpdateKind, "patch" | "minor" | "major">;

interface VersionAnnouncementState {
  previousVersion: string | null;
  updateKind: VisibleVersionUpdateKind;
  changelogEntry: AppChangelogEntry;
}

function createFallbackChangelogEntry(version: string, updateKind: VisibleVersionUpdateKind): AppChangelogEntry {
  const importantUpdate = updateKind === "minor" || updateKind === "major";

  return {
    version,
    date: new Date().toISOString().slice(0, 10),
    impact: updateKind,
    headline: importantUpdate ? "Nuova versione disponibile" : "Aggiornamento di stabilita",
    summary: importantUpdate
      ? "Questa release introduce miglioramenti importanti all'esperienza di lavoro."
      : "Questa release include correzioni e miglioramenti mirati.",
    updates: importantUpdate
      ? ["Nuova release pronta per l'uso.", "Miglioramenti all'esperienza dell'editor."]
      : ["Correzioni e miglioramenti di stabilita."],
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

interface WorkspaceNotice {
  id: number;
  message: string;
  tone: "success" | "warning" | "error";
  sticky?: boolean;
  stickyType?: "source-selection" | "selection-warning";
  targetId?: string;
}

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
}

interface PromptDialogState {
  title: string;
  label: string;
  placeholder?: string;
  confirmLabel: string;
  cancelLabel: string;
  required: boolean;
  requiredMessage: string;
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

type AppSurface = "studio" | "code-tutorial";
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

interface WorkspaceSessionSnapshot {
  version: 4;
  savedAt: string;
  diagram: DiagramDocument;
  translationWorkspace: ErTranslationWorkspaceDocument;
  logicalWorkspace: LogicalWorkspaceDocument;
  logicalGenerated: boolean;
  logicalStage: LogicalStage;
  surface: AppSurface;
  diagramView: WorkspaceView;
  tool: ToolKind;
  mode: EditorMode;
  viewport: Viewport;
  selection: SelectionState;
  translationViewport: Viewport;
  translationSelection: SelectionState;
  logicalViewport: Viewport;
  logicalSelection: LogicalSelection;
  codeDraft: string;
  codeDirty: boolean;
  technicalPanelOpen: boolean;
  technicalPanelTab: TechnicalPanelTab;
  codePanelOpen: boolean;
  codePanelWidth: number;
  notesPanelOpen: boolean;
  notesPanelWidth: number;
  toolbarCollapsed: boolean;
  focusMode: boolean;
  toolbarWidth: number;
  showDiagnostics: boolean;
}

interface WorkspaceSessionBootstrap {
  diagram: DiagramDocument;
  translationWorkspace: ErTranslationWorkspaceDocument;
  logicalWorkspace: LogicalWorkspaceDocument;
  logicalGenerated: boolean;
  logicalStage: LogicalStage;
  surface: AppSurface;
  diagramView: WorkspaceView;
  tool: ToolKind;
  mode: EditorMode;
  viewport: Viewport;
  selection: SelectionState;
  translationViewport: Viewport;
  translationSelection: SelectionState;
  logicalViewport: Viewport;
  logicalSelection: LogicalSelection;
  codeDraft: string;
  codeDirty: boolean;
  technicalPanelOpen: boolean;
  technicalPanelTab: TechnicalPanelTab;
  codePanelOpen: boolean;
  codePanelWidth: number;
  notesPanelOpen: boolean;
  notesPanelWidth: number;
  toolbarCollapsed: boolean;
  focusMode: boolean;
  toolbarWidth: number;
  showDiagnostics: boolean;
  restored: boolean;
}

const ERROR_PATTERNS = [/^errore[:\s]/i, /\berrore\b/i, /impossibile/i, /non compatibile/i, /non valido/i, /non riuscit[oa]/i];
const CANCELLATION_PATTERNS = [/annullat[oa]/i, /rimoss[oa]/i, /eliminat[oa]/i, /cancellat[oa]/i] as const;
const WARNING_PATTERNS = [
  /gia presente/i,
  /^nessun/i,
  /^nessuna/i,
  /^sorgente selezionata:/i,
  /seleziona almeno/i,
  /seleziona la destinazione/i,
  /apri la vista/i,
  /gia allineati/i,
  /non disponibile/i,
] as const;
const SUCCESS_PATTERNS = [/aggiunt[oa]/i, /creat[oa]/i, /caricat[oa]/i, /salvat[oa]/i, /esportat[oa]/i, /rigenerat[oa]/i] as const;
const NOTICE_DURATION_MS = {
  success: 3200,
  warning: 4400,
  error: 6200,
} as const;
const STATUS_FOLLOWUP_NOTICE_MS = 2600;
const COMPOSITE_CHILD_HORIZONTAL_STEP = 24;
const COMPOSITE_CHILD_VERTICAL_GAP = 80;
const COMPOSITE_CHILD_VERTICAL_STEP = 44;
const INITIAL_WINDOW_WIDTH = typeof window === "undefined" ? 1440 : window.innerWidth;
const TOOLBAR_COLLAPSED_WIDTH = 56;
const DEFAULT_TOOLBAR_WIDTH = INITIAL_WINDOW_WIDTH >= 1680 ? 220 : 208;
const MIN_TOOLBAR_WIDTH = 188;
const MAX_TOOLBAR_WIDTH = 240;
const DEFAULT_CODE_PANEL_WIDTH = clampValue(Math.round(INITIAL_WINDOW_WIDTH * 0.24), 330, 360);
const MIN_CODE_PANEL_WIDTH = 320;
const MAX_CODE_PANEL_WIDTH = 420;
const DEFAULT_NOTES_PANEL_WIDTH = clampValue(Math.round(INITIAL_WINDOW_WIDTH * 0.22), 320, 360);
const MIN_NOTES_PANEL_WIDTH = 300;
const MAX_NOTES_PANEL_WIDTH = 400;
const RESIZER_WIDTH = 12;
const ONBOARDING_STORAGE_KEY = "chen-er-diagram-studio:onboarding-v1:done";
const WORKSPACE_SESSION_STORAGE_KEY = "chen-er-diagram-studio:workspace-session-v4";
const WORKSPACE_SESSION_SAVE_DEBOUNCE_MS = 420;
const TOOL_KIND_VALUES: ToolKind[] = [
  "move",
  "select",
  "delete",
  "entity",
  "relationship",
  "attribute",
  "connector",
  "inheritance",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function sanitizeViewport(value: unknown, fallback: Viewport): Viewport {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  const x = typeof value.x === "number" && Number.isFinite(value.x) ? value.x : fallback.x;
  const y = typeof value.y === "number" && Number.isFinite(value.y) ? value.y : fallback.y;
  const zoom = typeof value.zoom === "number" && Number.isFinite(value.zoom) && value.zoom > 0 ? value.zoom : fallback.zoom;
  return { x, y, zoom };
}

function sanitizeSelectionState(value: unknown): SelectionState {
  if (!isRecord(value)) {
    return { nodeIds: [], edgeIds: [] };
  }

  const nodeIds = Array.isArray(value.nodeIds) ? value.nodeIds.filter((nodeId): nodeId is string => typeof nodeId === "string") : [];
  const edgeIds = Array.isArray(value.edgeIds) ? value.edgeIds.filter((edgeId): edgeId is string => typeof edgeId === "string") : [];
  return { nodeIds, edgeIds };
}

function sanitizeLogicalSelectionState(value: unknown): LogicalSelection {
  if (!isRecord(value)) {
    return { ...EMPTY_LOGICAL_SELECTION };
  }

  return {
    nodeId:
      typeof value.nodeId === "string"
        ? value.nodeId
        : typeof value.tableId === "string"
          ? value.tableId
          : null,
    columnId: typeof value.columnId === "string" ? value.columnId : null,
    edgeId: typeof value.edgeId === "string" ? value.edgeId : null,
  };
}

function sanitizeToolKind(value: unknown): ToolKind {
  if (typeof value === "string" && TOOL_KIND_VALUES.includes(value as ToolKind)) {
    return value as ToolKind;
  }

  return "select";
}

function sanitizeLogicalModel(value: unknown): LogicalModel {
  const fallback = createEmptyLogicalModel("modello-logico");
  if (!isRecord(value)) {
    return fallback;
  }

  const candidate = value as Partial<LogicalModel>;
  const meta = candidate.meta;
  if (
    !isRecord(meta) ||
    typeof meta.name !== "string" ||
    typeof meta.generatedAt !== "string" ||
    typeof meta.sourceDiagramVersion !== "number" ||
    typeof meta.sourceSignature !== "string" ||
    !Array.isArray(candidate.tables) ||
    !Array.isArray(candidate.foreignKeys) ||
    ("uniqueConstraints" in candidate && !Array.isArray(candidate.uniqueConstraints)) ||
    !Array.isArray(candidate.edges) ||
    !Array.isArray(candidate.issues)
  ) {
    return fallback;
  }

  return {
    ...candidate,
    uniqueConstraints: Array.isArray(candidate.uniqueConstraints) ? candidate.uniqueConstraints : [],
  } as LogicalModel;
}

function sanitizeErTranslationWorkspace(value: unknown, diagram: DiagramDocument): ErTranslationWorkspaceDocument {
  const fallback = createEmptyErTranslationWorkspace(diagram);
  if (!isRecord(value) || !isRecord(value.translation)) {
    return fallback;
  }

  const translation = value.translation as Partial<ErTranslationState>;
  const meta = translation.meta;
  if (
    !isRecord(meta) ||
    typeof meta.createdAt !== "string" ||
    typeof meta.updatedAt !== "string" ||
    typeof meta.sourceSignature !== "string" ||
    !Array.isArray(translation.decisions) ||
    !Array.isArray(translation.mappings) ||
    !Array.isArray(translation.conflicts)
  ) {
    return fallback;
  }

  try {
    return refreshErTranslationWorkspace(diagram, {
      sourceDiagram: diagram,
      translatedDiagram: isRecord(value.translatedDiagram) ? parseDiagram(JSON.stringify(value.translatedDiagram)) : diagram,
      translation: translation as ErTranslationState,
    });
  } catch {
    return fallback;
  }
}

function sanitizeLogicalTranslationState(
  value: unknown,
  fallback: LogicalTranslationState,
): LogicalTranslationState {
  if (!isRecord(value)) {
    return fallback;
  }

  const meta = value.meta;
  if (
    !isRecord(meta) ||
    typeof meta.createdAt !== "string" ||
    typeof meta.updatedAt !== "string" ||
    typeof meta.sourceSignature !== "string" ||
    !Array.isArray(value.decisions) ||
    !Array.isArray(value.mappings) ||
    !Array.isArray(value.conflicts)
  ) {
    return fallback;
  }

  return {
    meta: {
      ...fallback.meta,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      sourceSignature: meta.sourceSignature,
    },
    decisions: value.decisions as LogicalTranslationState["decisions"],
    mappings: value.mappings as LogicalTranslationState["mappings"],
    conflicts: value.conflicts as LogicalTranslationState["conflicts"],
  };
}

function sanitizeLogicalWorkspace(value: unknown, diagram: DiagramDocument): LogicalWorkspaceDocument {
  const fallback = createEmptyLogicalWorkspace(diagram);
  if (!isRecord(value) || !isRecord(value.model)) {
    return fallback;
  }

  try {
    const translation = sanitizeLogicalTranslationState(value.translation, fallback.translation);
    return refreshLogicalWorkspace(diagram, {
      ...fallback,
      model: sanitizeLogicalModel(value.model),
      translation,
      transformation: fallback.transformation,
    });
  } catch {
    return fallback;
  }
}

function createDefaultWorkspaceSessionBootstrap(): WorkspaceSessionBootstrap {
  const diagram = synchronizeNodeNameIdentity(createEmptyDiagram("Nuovo diagramma")).diagram;
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  return {
    diagram,
    translationWorkspace,
    logicalWorkspace: createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram),
    logicalGenerated: false,
    logicalStage: "translation",
    surface: "studio",
    diagramView: "er",
    tool: "select",
    mode: "edit",
    viewport: { ...DEFAULT_VIEWPORT },
    selection: { nodeIds: [], edgeIds: [] },
    translationViewport: { ...DEFAULT_VIEWPORT },
    translationSelection: { nodeIds: [], edgeIds: [] },
    logicalViewport: { ...DEFAULT_VIEWPORT },
    logicalSelection: { ...EMPTY_LOGICAL_SELECTION },
    codeDraft: serializeDiagramToErs(diagram),
    codeDirty: false,
    technicalPanelOpen: false,
    technicalPanelTab: "review",
    codePanelOpen: false,
    codePanelWidth: DEFAULT_CODE_PANEL_WIDTH,
    notesPanelOpen: false,
    notesPanelWidth: DEFAULT_NOTES_PANEL_WIDTH,
    toolbarCollapsed: INITIAL_WINDOW_WIDTH < 1460,
    focusMode: false,
    toolbarWidth: DEFAULT_TOOLBAR_WIDTH,
    showDiagnostics: true,
    restored: false,
  };
}

function readWorkspaceSessionBootstrap(): WorkspaceSessionBootstrap {
  const fallback = createDefaultWorkspaceSessionBootstrap();
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.localStorage.getItem(WORKSPACE_SESSION_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || (parsed.version !== 1 && parsed.version !== 2 && parsed.version !== 3 && parsed.version !== 4)) {
      return fallback;
    }

    const storedDiagram = parseDiagram(JSON.stringify(parsed.diagram));
    const storedViewport = sanitizeViewport(parsed.viewport, DEFAULT_VIEWPORT);
    const storedTranslationViewport = sanitizeViewport(parsed.translationViewport, DEFAULT_VIEWPORT);
    const storedLogicalViewport = sanitizeViewport(parsed.logicalViewport, DEFAULT_VIEWPORT);
    const storedSelection = sanitizeSelectionState(parsed.selection);
    const storedTranslationSelection = sanitizeSelectionState(parsed.translationSelection);
    const storedLogicalSelection = sanitizeLogicalSelectionState(parsed.logicalSelection);
    const storedSurface: AppSurface = parsed.surface === "code-tutorial" ? "code-tutorial" : "studio";
    const storedDiagramView: WorkspaceView =
      parsed.diagramView === "logical" ? "logical" : parsed.diagramView === "translation" ? "translation" : "er";
    const storedTool = sanitizeToolKind(parsed.tool);
    const storedCodeDraft =
      typeof parsed.codeDraft === "string" && parsed.codeDraft.trim().length > 0
        ? parsed.codeDraft
        : serializeDiagramToErs(storedDiagram);
    const storedNotesPanelOpen = parsed.notesPanelOpen === true;
    const storedCodePanelOpen = parsed.codePanelOpen === true;
    const storedTechnicalPanelTab: TechnicalPanelTab =
      parsed.technicalPanelTab === "notes"
        ? "notes"
        : parsed.technicalPanelTab === "code"
          ? "code"
          : storedNotesPanelOpen
            ? "notes"
            : storedCodePanelOpen
              ? "code"
              : "review";
    const storedTechnicalPanelOpen = false;

    const storedTranslationWorkspace =
      parsed.version >= 3
        ? sanitizeErTranslationWorkspace(parsed.translationWorkspace, storedDiagram)
        : createEmptyErTranslationWorkspace(storedDiagram);

    return {
      diagram: storedDiagram,
      translationWorkspace: storedTranslationWorkspace,
      logicalWorkspace:
        parsed.version >= 2
          ? sanitizeLogicalWorkspace(parsed.logicalWorkspace, storedTranslationWorkspace.translatedDiagram)
          : createEmptyLogicalWorkspace(storedTranslationWorkspace.translatedDiagram),
      logicalGenerated: parsed.logicalGenerated === true,
      logicalStage: parsed.logicalStage === "schema" ? "schema" : "translation",
      surface: storedSurface,
      diagramView: storedDiagramView,
      tool: storedTool,
      mode: "edit",
      viewport: storedViewport,
      selection: storedSelection,
      translationViewport: storedTranslationViewport,
      translationSelection: storedTranslationSelection,
      logicalViewport: storedLogicalViewport,
      logicalSelection: storedLogicalSelection,
      codeDraft: storedCodeDraft,
      codeDirty: parsed.codeDirty === true,
      technicalPanelOpen: storedTechnicalPanelOpen,
      technicalPanelTab: storedTechnicalPanelTab,
      codePanelOpen: storedTechnicalPanelOpen && storedTechnicalPanelTab === "code",
      codePanelWidth:
        typeof parsed.codePanelWidth === "number" && Number.isFinite(parsed.codePanelWidth)
          ? parsed.codePanelWidth
          : fallback.codePanelWidth,
      notesPanelOpen: storedTechnicalPanelOpen && storedTechnicalPanelTab === "notes",
      notesPanelWidth:
        typeof parsed.notesPanelWidth === "number" && Number.isFinite(parsed.notesPanelWidth)
          ? parsed.notesPanelWidth
          : fallback.notesPanelWidth,
      toolbarCollapsed: typeof parsed.toolbarCollapsed === "boolean" ? parsed.toolbarCollapsed : fallback.toolbarCollapsed,
      focusMode: typeof parsed.focusMode === "boolean" ? parsed.focusMode : false,
      toolbarWidth:
        typeof parsed.toolbarWidth === "number" && Number.isFinite(parsed.toolbarWidth)
          ? parsed.toolbarWidth
          : fallback.toolbarWidth,
      showDiagnostics: typeof parsed.showDiagnostics === "boolean" ? parsed.showDiagnostics : true,
      restored: true,
    };
  } catch {
    return fallback;
  }
}

function normalizeMessagePart(value: string): string {
  return value.trim().replace(/\s+/g, " ").replace(/[;:,.!?]+$/g, "");
}

function lowerCaseFirst(value: string): string {
  if (!value) {
    return value;
  }

  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function buildStructuredErrorMessage(what: string, why: string, how: string): string {
  const normalizedWhat = normalizeMessagePart(what) || "operazione non completata";
  const normalizedWhy = normalizeMessagePart(why) || "si e verificato un problema non specificato";
  const normalizedHow = normalizeMessagePart(how) || "controlla i dati e riprova";
  return `Errore: ${normalizedWhat} perche ${lowerCaseFirst(normalizedWhy)}; per risolvere ${lowerCaseFirst(normalizedHow)}.`;
}

function formatErrorFromRawMessage(message: string, fallbackHow = "controlla i dati inseriti e riprova"): string {
  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    return buildStructuredErrorMessage(
      "operazione non completata",
      "si e verificato un problema non specificato",
      fallbackHow,
    );
  }

  const alreadyStructured = /^errore:\s.+\sperche\s.+;\sper risolvere\s.+\.$/i.test(normalizedMessage);
  if (alreadyStructured) {
    return normalizedMessage;
  }

  const isCancellationMessage =
    CANCELLATION_PATTERNS.some((pattern) => pattern.test(normalizedMessage)) &&
    !ERROR_PATTERNS.some((pattern) => pattern.test(normalizedMessage));
  if (isCancellationMessage) {
    return normalizedMessage;
  }

  const reason = normalizeMessagePart(normalizedMessage.replace(/^errore[:\s]*/i, ""));
  return buildStructuredErrorMessage("operazione non completata", reason, fallbackHow);
}

function formatErsErrorMessage(message: string): string {
  const reason = normalizeMessagePart(message.replace(/^errore[:\s]*/i, "")) || "codice ERS non valido";
  return buildStructuredErrorMessage(
    "il codice ERS non e stato applicato",
    reason,
    "correggi la riga indicata e riprova",
  );
}

function formatProjectFileErrorMessage(error: unknown): string {
  if (error instanceof ProjectFileError) {
    return buildStructuredErrorMessage(error.details.what, error.details.why, error.details.how);
  }

  return buildStructuredErrorMessage(
    "il file progetto non e stato caricato",
    "si e verificato un problema non previsto durante l'importazione",
    "controlla il file selezionato e riprova",
  );
}

function isSourceSelectionPendingMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return (
    normalized.startsWith("sorgente selezionata:") &&
    normalized.includes("seleziona la destinazione") &&
    normalized.includes("premi esc per annullare")
  );
}

function sanitizeFileNameBase(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "diagramma-er";
}

const DEFAULT_ATTRIBUTE_SIZE = { width: 170, height: 72 };

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function downloadTextFile(content: string, fileName: string, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
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

function getNodeKindLabel(node: DiagramNode): string {
  if (node.type === "entity") {
    return "entita";
  }

  if (node.type === "relationship") {
    return "associazione";
  }

  if (node.type === "attribute") {
    return "attributo";
  }

  return "elemento";
}

function getConnectionFailureReason(
  edgeType: "connector" | "attribute" | "inheritance",
  sourceNode: DiagramNode,
  targetNode: DiagramNode,
): string {
  if (sourceNode.id === targetNode.id) {
    return "Non puoi collegare un elemento a se stesso.";
  }

  const sourceKind = getNodeKindLabel(sourceNode);
  const targetKind = getNodeKindLabel(targetNode);

  if (edgeType === "connector") {
    if (sourceNode.type === "entity" && targetNode.type === "entity") {
      return "Due entita non si collegano direttamente: inserisci un'associazione tra le due.";
    }

    if (sourceNode.type === "relationship" && targetNode.type === "relationship") {
      return "Due associazioni non si collegano direttamente con un collegamento Chen.";
    }

    if (sourceNode.type === "attribute" || targetNode.type === "attribute") {
      return "Per un attributo usa lo strumento Attributo, non Collegamento.";
    }

    return `Collegamento non valido tra ${sourceKind} e ${targetKind}: il collegamento Chen richiede un'entita e un'associazione.`;
  }

  if (edgeType === "inheritance") {
    return `La generalizzazione richiede due entita. Hai selezionato ${sourceKind} e ${targetKind}.`;
  }

  const oneIsAttribute = sourceNode.type === "attribute" || targetNode.type === "attribute";
  if (!oneIsAttribute) {
    return `Il collegamento attributo richiede almeno un attributo. Hai selezionato ${sourceKind} e ${targetKind}.`;
  }

  return `Un attributo puo essere collegato solo a entita, associazione o attributo. Hai selezionato ${sourceKind} e ${targetKind}.`;
}

type AttributeCreationHost = Extract<DiagramNode, { type: "entity" | "relationship" | "attribute" }>;
type AttributeNodeDraft = Extract<DiagramNode, { type: "attribute" }>;

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

  if (hostNode.type === "attribute") {
    const hostSize =
      hostNode.isMultivalued === true
        ? { width: hostNode.width, height: hostNode.height }
        : getMultivaluedAttributeSize(hostNode.label);
    const compositeIndex = hostedAttributes.length;

    return {
      x: snapValue(
        hostNode.x + hostSize.width / 2 - nextAttribute.width / 2 + compositeIndex * COMPOSITE_CHILD_HORIZONTAL_STEP,
        GRID_SIZE,
      ),
      y: snapValue(
        hostNode.y + hostSize.height + COMPOSITE_CHILD_VERTICAL_GAP + compositeIndex * COMPOSITE_CHILD_VERTICAL_STEP,
        GRID_SIZE,
      ),
    };
  }

  const positionedNextAttribute = placeNewAttributeAroundHost(hostNode, hostedAttributes, nextAttribute);

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
  if (hostNode.type === "attribute" || attributeIds.length === 0) {
    return diagram;
  }

  const idSet = new Set(attributeIds);
  const attributes = diagram.nodes
    .filter((node): node is AttributeNode => node.type === "attribute" && idSet.has(node.id))
    .sort((left, right) => attributeIds.indexOf(left.id) - attributeIds.indexOf(right.id));
  const positionedAttributes = distributeAttributesAroundHost(hostNode, attributes);
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

export default function App() {
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
  const [surface, setSurface] = useState<AppSurface>(sessionBootstrap.surface);
  const [diagramView, setDiagramView] = useState<WorkspaceView>(sessionBootstrap.diagramView);
  const [tool, setTool] = useState<ToolKind>(sessionBootstrap.tool);
  const [mode] = useState<EditorMode>(sessionBootstrap.mode);
  const [viewport, setViewport] = useState<Viewport>(() => ({ ...sessionBootstrap.viewport }));
  const [selection, setSelection] = useState<SelectionState>(() => ({
    nodeIds: [...sessionBootstrap.selection.nodeIds],
    edgeIds: [...sessionBootstrap.selection.edgeIds],
  }));
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
  const [statusMessage, setStatusMessage] = useState("");
  const [notices, setNotices] = useState<WorkspaceNotice[]>([]);
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);
  const [keyboardShortcutsOpen, setKeyboardShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [whatsNewOpen, setWhatsNewOpen] = useState(false);
  const [versionAnnouncement, setVersionAnnouncement] = useState<VersionAnnouncementState | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null);
  const [cardinalityDialog, setCardinalityDialog] = useState<CardinalityDialogState | null>(null);
  const [mixedIdentifierDialog, setMixedIdentifierDialog] = useState<MixedIdentifierDialogState | null>(null);
  const [generalizationGroupDialog, setGeneralizationGroupDialog] = useState<GeneralizationGroupDialogState | null>(null);
  const [errorsPanelOpen, setErrorsPanelOpen] = useState(false);
  const [promptValue, setPromptValue] = useState("");
  const [promptError, setPromptError] = useState("");
  const [codeDraft, setCodeDraft] = useState(() => initialSerializedCode);
  const [codeDirty, setCodeDirty] = useState(sessionBootstrap.codeDirty);
  const [codeError, setCodeError] = useState("");
  const restoredTechnicalPanelTab: TechnicalPanelTab = sessionBootstrap.technicalPanelTab;
  const [technicalPanelOpen, setTechnicalPanelOpen] = useState(sessionBootstrap.technicalPanelOpen);
  const [technicalPanelTab, setTechnicalPanelTab] = useState<TechnicalPanelTab>(restoredTechnicalPanelTab);
  const [codePanelOpen, setCodePanelOpen] = useState(
    sessionBootstrap.codePanelOpen && restoredTechnicalPanelTab === "code",
  );
  const [codePanelWidth, setCodePanelWidth] = useState(sessionBootstrap.codePanelWidth);
  const [notesPanelOpen, setNotesPanelOpen] = useState(
    sessionBootstrap.notesPanelOpen && restoredTechnicalPanelTab === "notes",
  );
  const [sqlReverseWorkflow, setSqlReverseWorkflow] = useState<SqlReverseWorkflowState>(() =>
    createInitialSqlReverseWorkflowState(),
  );
  const [notesPanelWidth, setNotesPanelWidth] = useState(sessionBootstrap.notesPanelWidth);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(sessionBootstrap.toolbarCollapsed);
  const [focusMode, setFocusMode] = useState(sessionBootstrap.focusMode);
  const [windowWidth, setWindowWidth] = useState(INITIAL_WINDOW_WIDTH);
  const [toolbarWidth, setToolbarWidth] = useState(sessionBootstrap.toolbarWidth);
  const [showDiagnostics, setShowDiagnostics] = useState(sessionBootstrap.showDiagnostics);
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
  const [hasDiagramClipboard, setHasDiagramClipboard] = useState(false);
  const lastSavedDiagramRef = useRef(serializeDiagram(initialDiagramRef.current));
  const lastSavedCodeRef = useRef(initialSerializedCode);
  const hasUnsavedChangesRef = useRef(false);
  const nextNoticeIdRef = useRef(1);
  const noticeTimeoutsRef = useRef(new Map<number, number>());
  const confirmDialogResolverRef = useRef<((confirmed: boolean) => void) | null>(null);
  const promptDialogResolverRef = useRef<((value: string | null) => void) | null>(null);
  const promptInputRef = useRef<HTMLInputElement | null>(null);
  const panelResizeRef = useRef<{
    panel: "toolbar" | "code" | "notes";
    startClientX: number;
    startWidth: number;
  } | null>(null);
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
  const effectiveToolbarCollapsed = focusMode || toolbarCollapsed;
  const activeCanUndo =
    diagramView === "er" ? history.canUndo : diagramView === "translation" ? translationHistory.canUndo : logicalHistory.canUndo;
  const activeCanRedo =
    diagramView === "er" ? history.canRedo : diagramView === "translation" ? translationHistory.canRedo : logicalHistory.canRedo;
  const toolbarResizeBounds = {
    min: MIN_TOOLBAR_WIDTH,
    max: clampValue(Math.floor(windowWidth * 0.22), 168, MAX_TOOLBAR_WIDTH),
  };
  const codePanelResizeBounds = {
    min: clampValue(Math.floor(windowWidth * 0.18), MIN_CODE_PANEL_WIDTH, 340),
    max: clampValue(Math.floor(windowWidth * 0.32), 360, MAX_CODE_PANEL_WIDTH),
  };
  const notesPanelResizeBounds = {
    min: clampValue(Math.floor(windowWidth * 0.17), MIN_NOTES_PANEL_WIDTH, 320),
    max: clampValue(Math.floor(windowWidth * 0.3), 340, MAX_NOTES_PANEL_WIDTH),
  };
  const visibleToolbarWidth = focusMode
    ? 0
    : effectiveToolbarCollapsed
      ? TOOLBAR_COLLAPSED_WIDTH
      : clampValue(toolbarWidth, toolbarResizeBounds.min, toolbarResizeBounds.max);
  const technicalPanelResizeBounds = technicalPanelTab === "notes" ? notesPanelResizeBounds : codePanelResizeBounds;
  const technicalPanelWidth = technicalPanelTab === "notes" ? notesPanelWidth : codePanelWidth;
  const visibleTechnicalPanelWidth = clampValue(
    technicalPanelWidth,
    technicalPanelResizeBounds.min,
    technicalPanelResizeBounds.max,
  );
  const technicalPanelVisible = false;
  const structuredSidePanelHidden = false;
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
    "technical-workspace-shell",
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
    surface !== "studio" ||
    commandMenuOpen ||
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

    try {
      window.localStorage.setItem(WORKSPACE_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore storage errors and keep the app usable.
    }
  }

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

    const updateKind: VisibleVersionUpdateKind = classification.kind;

    if (hasSeenVersionAnnouncement(APP_VERSION)) {
      rememberLastSeenAppVersion(APP_VERSION);
      return;
    }

    if (versionAnnouncement || versionAnnouncementBlocked) {
      return;
    }

    const changelogEntry =
      APP_CHANGELOG.find((entry) => entry.version === APP_VERSION) ??
      createFallbackChangelogEntry(APP_VERSION, updateKind);
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
  }, [versionAnnouncement, versionAnnouncementBlocked]);

  useEffect(() => {
    if (!statusMessage || isSourceSelectionPendingMessage(statusMessage)) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setStatusMessage("");
    }, 2600);

    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    if (!sessionBootstrap.restored || restoredSessionNoticeShownRef.current) {
      return;
    }

    restoredSessionNoticeShownRef.current = true;
    setStatusMessage("Sessione precedente ripristinata automaticamente.");
    showSuccessNotice("Sessione precedente ripristinata automaticamente.");
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
    hasUnsavedChangesRef.current =
      serializeDiagram(history.present) !== lastSavedDiagramRef.current || currentCode !== lastSavedCodeRef.current;
  }, [history.present, codeDraft]);

  useEffect(() => {
    latestSessionSnapshotRef.current = {
      version: 4,
      savedAt: new Date().toISOString(),
      diagram: history.present,
      translationWorkspace: translationHistory.present,
      logicalWorkspace: logicalHistory.present,
      logicalGenerated,
      logicalStage,
      surface,
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
    };
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
    surface,
    tool,
    toolbarCollapsed,
    toolbarWidth,
    showDiagnostics,
    viewport,
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
    surface,
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
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (windowWidth < 1460) {
      setToolbarCollapsed(true);
    }
  }, [windowWidth]);

  useEffect(() => {
    setToolbarWidth((current) => clampValue(current, toolbarResizeBounds.min, toolbarResizeBounds.max));
  }, [toolbarResizeBounds.max, toolbarResizeBounds.min]);

  useEffect(() => {
    setCodePanelWidth((current) => clampValue(current, codePanelResizeBounds.min, codePanelResizeBounds.max));
  }, [codePanelResizeBounds.max, codePanelResizeBounds.min]);

  useEffect(() => {
    setNotesPanelWidth((current) => clampValue(current, notesPanelResizeBounds.min, notesPanelResizeBounds.max));
  }, [notesPanelResizeBounds.max, notesPanelResizeBounds.min]);

  useEffect(() => {
    if (surface !== "studio" || diagramView !== "er") {
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
  }, [diagramView, onboardingOpen, sessionBootstrap.restored, surface]);

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
    showSuccessNotice("Tour chiuso. Ora puoi modellare liberamente.");
  }, [onboardingOpen, onboardingProgress.allCompleted]);

  useEffect(() => {
    if (!promptDialog) {
      return;
    }

    const timeout = window.setTimeout(() => {
      promptInputRef.current?.focus();
      promptInputRef.current?.select();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [promptDialog]);

  useEffect(() => {
    return () => {
      if (confirmDialogResolverRef.current) {
        confirmDialogResolverRef.current(false);
        confirmDialogResolverRef.current = null;
      }

      if (promptDialogResolverRef.current) {
        promptDialogResolverRef.current(null);
        promptDialogResolverRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    function handleResizePointerMove(event: PointerEvent) {
      const currentResize = panelResizeRef.current;
      if (!currentResize) {
        return;
      }

      if (currentResize.panel === "toolbar") {
        const nextWidth = currentResize.startWidth + (event.clientX - currentResize.startClientX);
        setToolbarWidth(clampValue(nextWidth, toolbarResizeBounds.min, toolbarResizeBounds.max));
        return;
      }

      const nextWidth = currentResize.startWidth - (event.clientX - currentResize.startClientX);
      if (currentResize.panel === "code") {
        setCodePanelWidth(clampValue(nextWidth, codePanelResizeBounds.min, codePanelResizeBounds.max));
        return;
      }

      setNotesPanelWidth(clampValue(nextWidth, notesPanelResizeBounds.min, notesPanelResizeBounds.max));
    }

    function stopResize() {
      if (!panelResizeRef.current) {
        return;
      }

      panelResizeRef.current = null;
      document.body.classList.remove("workspace-resizing");
    }

    window.addEventListener("pointermove", handleResizePointerMove);
    window.addEventListener("pointerup", stopResize);

    return () => {
      window.removeEventListener("pointermove", handleResizePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.classList.remove("workspace-resizing");
    };
  }, [
    codePanelResizeBounds.max,
    codePanelResizeBounds.min,
    notesPanelResizeBounds.max,
    notesPanelResizeBounds.min,
    toolbarResizeBounds.max,
    toolbarResizeBounds.min,
  ]);

  useEffect(() => {
    return () => {
      noticeTimeoutsRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      noticeTimeoutsRef.current.clear();
    };
  }, []);

  function clearNoticeTimer(noticeId: number) {
    const timeoutId = noticeTimeoutsRef.current.get(noticeId);
    if (timeoutId === undefined) {
      return;
    }

    window.clearTimeout(timeoutId);
    noticeTimeoutsRef.current.delete(noticeId);
  }

  function dismissNotice(noticeId: number) {
    clearNoticeTimer(noticeId);
    setNotices((current) => current.filter((notice) => notice.id !== noticeId));
  }

  function dismissStickyNotices(stickyType?: WorkspaceNotice["stickyType"]) {
    setNotices((current) => {
      const stickyNotices = current.filter(
        (notice) => notice.sticky && (stickyType === undefined || notice.stickyType === stickyType),
      );
      if (stickyNotices.length === 0) {
        return current;
      }

      stickyNotices.forEach((notice) => clearNoticeTimer(notice.id));
      return current.filter((notice) => !stickyNotices.some((stickyNotice) => stickyNotice.id === notice.id));
    });
  }

  function showSelectionWarningNotice(issue: ValidationIssue) {
    if (issue.level !== "warning") {
      return;
    }

    setNotices((current) => {
      const existing = current.find((notice) => notice.stickyType === "selection-warning");
      if (existing && existing.targetId === issue.targetId && existing.message === issue.message) {
        return current;
      }

      const selectionWarningNotices = current.filter((notice) => notice.stickyType === "selection-warning");
      selectionWarningNotices.forEach((notice) => clearNoticeTimer(notice.id));

      const retained = current.filter((notice) => notice.stickyType !== "selection-warning");
      return [
        {
          id: nextNoticeIdRef.current++,
          message: issue.message,
          tone: "warning",
          sticky: true,
          stickyType: "selection-warning",
          targetId: issue.targetId,
        },
        ...retained,
      ];
    });
  }

  function showNotice(notice: Omit<WorkspaceNotice, "id">, duration: number | null = NOTICE_DURATION_MS[notice.tone]) {
    const id = nextNoticeIdRef.current++;

    setNotices((current) => {
      const preservedSelectionWarningNotices =
        notice.stickyType === "selection-warning"
          ? []
          : current.filter((item) => item.stickyType === "selection-warning");
      const retained = current.filter((item) => item.message !== notice.message && !item.sticky).slice(0, 1);
      const removed = current.filter(
        (item) =>
          !retained.some((kept) => kept.id === item.id) &&
          !preservedSelectionWarningNotices.some((kept) => kept.id === item.id),
      );
      removed.forEach((item) => clearNoticeTimer(item.id));
      return [{ id, ...notice }, ...preservedSelectionWarningNotices, ...retained];
    });

    if (duration !== null) {
      const timeoutId = window.setTimeout(() => {
        dismissNotice(id);
      }, duration);
      noticeTimeoutsRef.current.set(id, timeoutId);
    }
  }

  function showErrorNotice(message: string) {
    showNotice({
      message: formatErrorFromRawMessage(message),
      tone: "error",
    });
  }

  function showWarningNotice(message: string) {
    const sticky = isSourceSelectionPendingMessage(message);
    showNotice(
      {
        message,
        tone: "warning",
        sticky,
        stickyType: sticky ? "source-selection" : undefined,
      },
      sticky ? null : NOTICE_DURATION_MS.warning,
    );
  }

  function showSuccessNotice(message: string) {
    showNotice({
      message,
      tone: "success",
    });
  }

  function getNoticeTone(message: string): WorkspaceNotice["tone"] | null {
    if (!message.trim()) {
      return null;
    }

    if (CANCELLATION_PATTERNS.some((pattern) => pattern.test(message))) {
      return "error";
    }

    if (ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
      return "error";
    }

    if (WARNING_PATTERNS.some((pattern) => pattern.test(message))) {
      return "warning";
    }

    if (SUCCESS_PATTERNS.some((pattern) => pattern.test(message))) {
      return "success";
    }

    return null;
  }

  function markDocumentBaseline(diagram: DiagramDocument) {
    lastSavedDiagramRef.current = serializeDiagram(diagram);
    lastSavedCodeRef.current = serializeDiagramToErs(diagram);
    hasUnsavedChangesRef.current = false;
  }

  function markDiagramSaved(diagram: DiagramDocument) {
    lastSavedDiagramRef.current = serializeDiagram(diagram);
  }

  function markCodeSaved(code: string) {
    lastSavedCodeRef.current = code;
  }

  function closeConfirmDialog(confirmed: boolean) {
    const resolve = confirmDialogResolverRef.current;
    confirmDialogResolverRef.current = null;
    setConfirmDialog(null);
    resolve?.(confirmed);
  }

  function requestConfirmDialog(options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }): Promise<boolean> {
    return new Promise((resolve) => {
      if (confirmDialogResolverRef.current) {
        confirmDialogResolverRef.current(false);
      }

      confirmDialogResolverRef.current = resolve;
      setConfirmDialog({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Conferma",
        cancelLabel: options.cancelLabel ?? "Annulla",
      });
    });
  }

  function closePromptDialog(value: string | null) {
    const resolve = promptDialogResolverRef.current;
    promptDialogResolverRef.current = null;
    setPromptDialog(null);
    setPromptValue("");
    setPromptError("");
    resolve?.(value);
  }

  function requestPromptDialog(options: {
    title: string;
    label: string;
    initialValue: string;
    placeholder?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    required?: boolean;
    requiredMessage?: string;
  }): Promise<string | null> {
    return new Promise((resolve) => {
      if (promptDialogResolverRef.current) {
        promptDialogResolverRef.current(null);
      }

      promptDialogResolverRef.current = resolve;
      setPromptDialog({
        title: options.title,
        label: options.label,
        placeholder: options.placeholder,
        confirmLabel: options.confirmLabel ?? "Salva",
        cancelLabel: options.cancelLabel ?? "Annulla",
        required: options.required === true,
        requiredMessage: options.requiredMessage ?? "Il campo non puo essere vuoto.",
      });
      setPromptValue(options.initialValue);
      setPromptError("");
    });
  }

  function submitPromptDialog() {
    if (!promptDialog) {
      return;
    }

    const normalized = promptValue.trim();
    if (promptDialog.required && !normalized) {
      setPromptError(promptDialog.requiredMessage);
      return;
    }

    closePromptDialog(normalized);
  }

  async function confirmDiscardChanges(actionLabel: string): Promise<boolean> {
    if (!hasUnsavedChangesRef.current) {
      return true;
    }

    return requestConfirmDialog({
      title: "Modifiche non salvate",
      message: `Ci sono modifiche non salvate. Vuoi davvero ${actionLabel}? Le modifiche non salvate andranno perse.`,
      confirmLabel: "Continua",
      cancelLabel: "Annulla",
    });
  }

  function openStudioSurface() {
    setSurface("studio");
    setIntroOpen(false);
  }

  async function openCodeTutorialSurface() {
    if (surface === "studio" && !(await confirmDiscardChanges("aprire la guida ERS"))) {
      return;
    }

    setSurface("code-tutorial");
    setAboutOpen(false);
    setWhatsNewOpen(false);
    setIntroOpen(false);
  }

  function openCommandMenu() {
    setAboutOpen(false);
    setWhatsNewOpen(false);
    setIntroOpen(false);
    setKeyboardShortcutsOpen(false);
    setCommandMenuOpen(true);
  }

  function openKeyboardShortcuts() {
    setCommandMenuOpen(false);
    setAboutOpen(false);
    setWhatsNewOpen(false);
    setIntroOpen(false);
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

  function setStatus(message: string) {
    setStatusMessage(message);
    if (!message.trim()) {
      dismissStickyNotices("source-selection");
      return;
    }

    const tone = getNoticeTone(message);
    if (tone === "error") {
      showErrorNotice(message);
      return;
    }

    if (tone === "warning") {
      showWarningNotice(message);
      return;
    }

    if (tone === "success") {
      showSuccessNotice(message);
      return;
    }

    if (notices.some((notice) => notice.sticky)) {
      showNotice(
        {
          message,
          tone: "success",
        },
        STATUS_FOLLOWUP_NOTICE_MS,
      );
    }
  }

  function setStatusWarning(message: string) {
    setStatusMessage(message);
    showWarningNotice(message);
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

  function setStatusError(message: string) {
    const normalizedError = formatErrorFromRawMessage(message);
    setStatusMessage(normalizedError);
    showErrorNotice(normalizedError);
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

  function handleIssueNotice(issue: ValidationIssue) {
    if (issue.level === "error") {
      const formattedIssue = formatErrorFromRawMessage(
        issue.message,
        "correggi l'elemento evidenziato e valida di nuovo il diagramma",
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

  function handleToggleToolRail() {
    setToolbarCollapsed((current) => !current);
  }

  function handleToggleFocusMode() {
    setFocusMode((current) => {
      const next = !current;
      setStatus(next ? "Modalita focus attiva: il canvas diventa protagonista." : "Modalita focus disattivata.");
      return next;
    });
  }

  function openTechnicalPanelTab(nextTab: TechnicalPanelTab) {
    setTechnicalPanelTab(nextTab);
    setTechnicalPanelOpen(false);
    setCodePanelOpen(nextTab === "code");
    setNotesPanelOpen(nextTab === "notes");
  }

  function closeTechnicalPanel() {
    setTechnicalPanelOpen(false);
    setCodePanelOpen(false);
    setNotesPanelOpen(false);
  }

  function handleToggleCodePanel() {
    if (codePanelOpen) {
      closeTechnicalPanel();
      return;
    }

    openTechnicalPanelTab("code");
  }

  function handleToggleDiagnosticsVisibility() {
    setShowDiagnostics((current) => !current);
  }

  function handleToggleNotesPanel() {
    if (notesPanelOpen) {
      closeTechnicalPanel();
      return;
    }

    openTechnicalPanelTab("notes");
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
      setStatusWarning("Reverse Engineering SQL è disponibile solo nella vista ER.");
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
    setStatusWarning("Import SQL annullato.");
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
      const result = reverseSqlToDiagram(validation.normalizedSql, { sourceName: "Reverse Engineering SQL" });
      const hasSqlErrors = result.issues.some((issue) => issue.level === "error");
      const hasValidDiagram = result.diagram.nodes.length > 0;

      if (result.sqlModel.unsupportedStatements.length > 0) {
        const message = "La beta accetta solo CREATE TABLE. Rimuovi gli statement non supportati e riprova.";
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
          errorMessage: "SQL non importabile: correggi gli errori indicati.",
          isPreviewReady: true,
        }));
        setStatusError("SQL non importabile: correggi gli errori indicati.");
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
        setStatusWarning("SQL analizzato con warning. Preview logica pronta.");
      } else {
        setStatus(`SQL analizzato: ${result.sqlModel.tables.length} tabelle riconosciute.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore durante l'analisi SQL.";
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
      setStatusError("SQL non importabile: correggi gli errori indicati.");
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
    setStatus("Preview ER pronta.");
  }

  function handleSqlReverseBackToLogicalPreview() {
    setSqlReverseWorkflow((current) => current.result ? { ...current, step: "logical-preview" } : current);
    setStatus("Preview logica pronta.");
  }

  async function handleSqlReverseFinalDone() {
    const preview = sqlReverseWorkflow.result;
    if (!preview) {
      setStatusError("Preview SQL non disponibile.");
      return;
    }
    const confirmed = await requestConfirmDialog({
      title: "Importa diagramma da SQL",
      message: "Il diagramma corrente verrà sostituito dal diagramma generato dallo schema SQL. Continuare?",
      confirmLabel: "Importa",
      cancelLabel: "Annulla",
    });
    if (!confirmed) {
      setStatusWarning("Import SQL annullato.");
      return;
    }

    const warningCount = preview.issues.filter((issue) => issue.level === "warning").length;
    setSqlReverseWorkflow((current) => createInitialSqlReverseWorkflowState(current.sourceSql));
    applyWorkspaceDocument(
      preview.diagram,
      warningCount > 0
        ? `Diagramma ER importato da SQL con ${warningCount} warning.`
        : `Diagramma ER importato da SQL: ${preview.sqlModel.tables.length} tabelle riconosciute.`,
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
        setStatusWarning("Il file SQL caricato e vuoto.");
        return;
      }

      if (!extensionOk && !/\bCREATE\s+TABLE\b/i.test(text)) {
        setStatusWarning("File caricato: il contenuto non sembra uno schema SQL CREATE TABLE.");
        return;
      }

      setStatus(`File SQL caricato: ${fileName}.`);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Impossibile leggere il file SQL.");
    }
  }

  function handleClearSqlReverse() {
    setSqlReverseWorkflow((current) => ({
      ...createInitialSqlReverseWorkflowState(""),
      step: current.step === "idle" ? "input" : current.step,
    }));
    setStatus("Import SQL pulito.");
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

  function handlePanelResizeStart(
    panel: "toolbar" | "code" | "notes",
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    panelResizeRef.current = {
      panel,
      startClientX: event.clientX,
      startWidth: panel === "toolbar" ? toolbarWidth : panel === "code" ? codePanelWidth : notesPanelWidth,
    };
    document.body.classList.add("workspace-resizing");
  }

  function resetPanelWidth(panel: "toolbar" | "code" | "notes") {
    if (panel === "toolbar") {
      setToolbarWidth(clampValue(DEFAULT_TOOLBAR_WIDTH, toolbarResizeBounds.min, toolbarResizeBounds.max));
      return;
    }

    if (panel === "code") {
      setCodePanelWidth(clampValue(DEFAULT_CODE_PANEL_WIDTH, codePanelResizeBounds.min, codePanelResizeBounds.max));
      return;
    }

    setNotesPanelWidth(clampValue(DEFAULT_NOTES_PANEL_WIDTH, notesPanelResizeBounds.min, notesPanelResizeBounds.max));
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
    history.commit(normalizedIncoming.diagram, normalizedCurrent.diagram);
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
    setSurface("studio");
    setAboutOpen(false);
    setWhatsNewOpen(false);
    setIntroOpen(false);
    setLogicalGenerated(nextLogicalGenerated);
    setLogicalStage(options?.logicalStage === "schema" && nextLogicalGenerated ? "schema" : "translation");
    setDiagramView(nextDiagramView);
    setTranslationSelection({ nodeIds: [], edgeIds: [] });
    setTranslationViewport(options?.translationViewport ? { ...options.translationViewport } : { ...DEFAULT_VIEWPORT });
    setLogicalSelection(EMPTY_LOGICAL_SELECTION);
    setLogicalViewport(options?.logicalViewport ? { ...options.logicalViewport } : { ...DEFAULT_VIEWPORT });
    syncCodeDraftWithDiagram(normalizedIncoming.diagram);
    markDocumentBaseline(normalizedIncoming.diagram);
    setSelection({ nodeIds: [], edgeIds: [] });
    setViewport(options?.viewport ? { ...options.viewport } : { ...DEFAULT_VIEWPORT });
    setTool("select");
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
        setCodeError(formatErsErrorMessage(message));
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
    // in-progress input. External canvas/project changes sync only when the
    // draft is clean and the editor is not active.
    if (
      shouldSyncCodeDraftFromDiagram({
        focused: codeEditorFocusedRef.current,
        dirty: codeDirtyRef.current,
        source: syncSource,
      })
    ) {
      codeDraftRef.current = nextSerializedCode;
      codeDirtyRef.current = false;
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
          setTool(nextTool);
          setStatus(`Strumento attivo: ${getToolLabel(nextTool)}.`);
          return;
        }
      }

      if (diagramView === "er" && (event.key === "Delete" || event.key === "Backspace")) {
        event.preventDefault();
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
      setStatusWarning("Scegli una chiave primaria per continuare.");
      return;
    }

    if (result.appliedCount === 0) {
      setStatusWarning("Nessun elemento logico applicabile per questo step.");
      return;
    }

    commitLogicalWorkspace(result.workspace, previousWorkspace);
    setDiagramView("logical");
    showLogicalStageAfterFix(
      result.workspace,
      `Fix logico applicato a ${result.appliedCount} elementi.`,
      `Fix logico applicato a ${result.appliedCount} elementi. Schema logico attivo.`,
    );
  }

  function handleLogicalDone() {
    if (logicalPendingCount > 0 || logicalHistory.present.translation.conflicts.some((conflict) => conflict.level === "error")) {
      setStatusWarning("Completa prima entita, entita deboli e relazioni.");
      return;
    }

    setLogicalStage("schema");
    setLogicalPanelMode("review");
    setLogicalTypeMode(false);
    setLogicalSelection(EMPTY_LOGICAL_SELECTION);
    setLogicalFitRequestToken((current) => current + 1);
    setStatus("Schema logico attivo.");
  }

  function handleResetTranslation() {
    if (!translationAccess.allowed) {
      setStatusWarning(translationAccess.reason ?? "Correggi prima gli errori bloccanti del diagramma ER.");
      return;
    }

    const hasAppliedWork =
      translationHistory.present.translation.decisions.length > 0 ||
      translationHistory.present.translation.mappings.length > 0 ||
      translationHistory.present.translation.conflicts.length > 0;
    if (hasAppliedWork && !window.confirm("Vuoi cancellare tutte le modifiche di ristrutturazione?")) {
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
    setStatus("Layout logico aggiornato.");
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
    if (!(await confirmDiscardChanges("creare un nuovo progetto"))) {
      return;
    }

    applyWorkspaceDocument(
      createEmptyDiagram("Nuovo diagramma"),
      "Nuovo progetto creato.",
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
    setTool("select");
    setStatus(`${nextNode.label} aggiunto.`);
    return nextNode.id;
  }

  function handleCreateNodeFromToolbar(nodeType: Extract<ToolKind, "entity" | "relationship">) {
    setTool(nodeType);
    setSelection({ nodeIds: [], edgeIds: [] });
    setStatus(nodeType === "entity" ? "Clicca nel workspace per posizionare la nuova entita." : "Clicca nel workspace per posizionare la nuova associazione.");
  }

  function handleCreateEdge(type: "connector" | "attribute" | "inheritance", sourceId: string, targetId: string) {
    let resolvedSourceId = sourceId;
    let resolvedTargetId = targetId;
    let sourceNode = findNode(history.present, resolvedSourceId);
    let targetNode = findNode(history.present, resolvedTargetId);

    if (!sourceNode || !targetNode) {
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "il collegamento non e stato creato",
          "manca il nodo sorgente o destinazione",
          "seleziona due nodi validi e riprova",
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
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "il collegamento non e stato creato",
          `l'attributo "${targetNode.label}" appartiene gia a un attributo composto e non puo diventare composto`,
          "collega il nuovo attributo direttamente all'attributo composto principale",
        ),
      };
    }

    if (!canConnect(type, sourceNode, targetNode)) {
      const failureReason = getConnectionFailureReason(type, sourceNode, targetNode);
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "il collegamento non e stato creato",
          normalizeMessagePart(failureReason.replace(/^errore[:\s]*/i, "")),
          "collega solo elementi compatibili con la notazione Chen",
        ),
      };
    }

    if (edgeAlreadyExists(history.present, type, resolvedSourceId, resolvedTargetId)) {
      return { success: false, message: "Collegamento gia presente." };
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
    const directAttributeHost =
      type === "attribute" && sourceNode.type !== "attribute" && targetNode.type === "attribute"
        ? sourceNode
        : type === "attribute" && targetNode.type !== "attribute" && sourceNode.type === "attribute"
          ? targetNode
          : undefined;
    const nextDiagram =
      directAttributeHost?.type === "entity" || directAttributeHost?.type === "relationship"
        ? layoutDirectAttributesAroundHost(
            nextDiagramWithEdge,
            directAttributeHost,
            findDirectHostedAttributes(nextDiagramWithEdge, directAttributeHost.id).map((attribute) => attribute.id),
          )
        : nextDiagramWithEdge;

    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [], edgeIds: [edgeToSelect.id] });
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
      return { success: true, message: "Scegli la cardinalita per completare il collegamento." };
    }
    if (type === "inheritance") {
      openGeneralizationGroupDialog(edgeToSelect.id, nextDiagram, { createdEdgeWasTemporary: true });
      return { success: true, message: "Configura il gruppo ISA per completare la gerarchia." };
    }
    return { success: true, message: "Collegamento creato." };
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
      return "Attributo non disponibile.";
    }

    return canAttributeHaveCardinality(history.present, attribute)
      ? null
      : "La cardinalita non e assegnabile ad attributi usati come identificatori.";
  }

  function handleOpenCardinalityControl(edgeId?: string) {
    const target = getCardinalityTargetFromSelection(edgeId);
    if (!target) {
      setStatusWarning("Seleziona prima un attributo o un connector entita-relazione.");
      return;
    }

    const blockReason = getCardinalityBlockReason(target);
    if (blockReason) {
      setStatusWarning(blockReason);
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
        current ? { ...current, error: parsed.reason ?? "Cardinalita non valida." } : current,
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
                error: "La cardinalita non e assegnabile ad attributi usati come identificatori.",
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
      setCardinalityDialog((current) => current ? { ...current, error: "Connector non disponibile." } : current);
      return null;
    }

    const result = applyConnectorCardinalityToDiagram(history.present, connectorEdge.id, parsed.value);
    if (!result) {
      setCardinalityDialog((current) =>
        current ? { ...current, error: "Seleziona un connector entita-relazione." } : current,
      );
      return null;
    }

    commitDiagram(result.diagram, options?.previousDiagram);
    setSelection({ nodeIds: [], edgeIds: [connectorEdge.id] });
    return parsed.value;
  }

  async function handleOpenConnectorRoleControl() {
    if (!selectedEdge || selectedEdge.type !== "connector") {
      setStatusWarning("Seleziona un collegamento entita-relazione per assegnare un ruolo.");
      return;
    }

    const currentNodeMap = new Map(history.present.nodes.map((node) => [node.id, node]));
    const sourceNode = currentNodeMap.get(selectedEdge.sourceId);
    const targetNode = currentNodeMap.get(selectedEdge.targetId);
    const context = getConnectorParticipationContext(sourceNode, targetNode);
    if (!context) {
      setStatusWarning("Il ruolo e disponibile solo sui collegamenti tra entita e relazione.");
      return;
    }

    const currentParticipation = getConnectorParticipation(selectedEdge, sourceNode, targetNode);
    const nextRole = await requestPromptDialog({
      title: "Role",
      label: "Role del collegamento",
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
    setStatus(normalizedRole ? "Role del collegamento aggiornato." : "Role del collegamento rimosso.");
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
          ? `Collegamento creato con cardinalita ${appliedValue}.`
          : `Cardinalita aggiornata a ${appliedValue}.`,
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
      return;
    }

    const context = getDirectEntityAttributeContext(selectedNode.id);
    if (!context) {
      setStatusWarning("Simple Id e disponibile solo per attributi semplici collegati direttamente a un'entita.");
      return;
    }

    const existing = context.entity.internalIdentifiers?.find((identifier) =>
      identifier.attributeIds.includes(context.attribute.id),
    );
    const nextIdentifiers = existing
      ? (context.entity.internalIdentifiers ?? []).filter((identifier) => identifier.id !== existing.id)
      : [
          ...(context.entity.internalIdentifiers ?? []),
          {
            id: `internalIdentifier-simple-${context.attribute.id}`,
            attributeIds: [context.attribute.id],
          },
        ];
    handleEntityInternalIdentifiersChange(
      context.entity.id,
      { internalIdentifiers: nextIdentifiers },
      { [context.attribute.id]: { isIdentifier: !existing, isCompositeInternal: false, cardinality: undefined } },
    );
  }

  function handleCreateCompositeIdentifierFromSelection() {
    const context = getCompositeIdentifierSelectionContext();
    if (!context) {
      setStatusWarning("Composite Id richiede almeno due attributi semplici della stessa entita selezionati con Ctrl/Cmd+click.");
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
    setStatus("Identificatore interno composto creato.");
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
      setStatusWarning("Mixed Id richiede un'entita host o un connector entita-relazione.");
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
      setStatusWarning("Nessuna parte importata disponibile: servono relazioni con cardinalita lato host (1,1) e sorgenti con identificatore interno.");
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
    setStatus(localAttributeIds.length > 0 ? "Identificatore misto creato." : "Identificatore esterno creato.");
  }

  function handleOpenMixedIdentifierModal() {
    const connectorContext = getConnectorContextFromSelectedEdge();
    if (!connectorContext) {
      setStatusWarning("Mixed Id richiede un connector entita-relazione selezionato.");
      return;
    }

    if (!selectedConnectorRequiresMixedIdentifierCardinality()) {
      setStatusWarning("L'identificatore esterno misto richiede cardinalita 1,1 sull'entita.");
      return;
    }

    const hostEntity = connectorContext.entity;
    const importOptions = getEligibleImportedIdentifierParts(history.present, hostEntity.id);
    if (importOptions.length === 0) {
      setStatusWarning("Nessuna parte importata disponibile: servono relazioni con cardinalita lato host (1,1) e sorgenti con identificatore interno.");
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
      error: attributes.length === 0 ? "Nessun attributo semplice locale eleggibile." : "",
    });
  }

  function submitMixedIdentifierDialog() {
    if (!mixedIdentifierDialog) {
      return;
    }

    if (mixedIdentifierDialog.selectedImportedPartKeys.length === 0) {
      setMixedIdentifierDialog({
        ...mixedIdentifierDialog,
        error: "Seleziona almeno una parte importata per creare un identificatore esterno/misto.",
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
        setGeneralizationGroupDialog({ ...dialog, error: "Gruppo ISA non disponibile." });
        return;
      }
      if (!name) {
        setGeneralizationGroupDialog({ ...dialog, error: "Il nome gruppo e obbligatorio." });
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
      setStatus(`Gruppo ISA ${name} aggiornato.`);
      return;
    }

    if (!dialog.edgeId) {
      setGeneralizationGroupDialog({ ...dialog, error: "Ramo ISA non disponibile." });
      return;
    }

    if (dialog.mode === "existing") {
      if (!dialog.selectedGroupId) {
        setGeneralizationGroupDialog({ ...dialog, error: "Seleziona un gruppo ISA." });
        return;
      }
      const targetGroup = (history.present.generalizationGroups ?? []).find((group) => group.id === dialog.selectedGroupId);
      if (!targetGroup || targetGroup.supertypeId !== dialog.supertypeId) {
        setGeneralizationGroupDialog({ ...dialog, error: "Il gruppo selezionato non e compatibile con questa superentita." });
        return;
      }
      if (targetGroup.subtypeIds.includes(dialog.subtypeId)) {
        setGeneralizationGroupDialog({ ...dialog, error: "Questa sottoentita appartiene gia al gruppo selezionato." });
        return;
      }
      const conflict = getSubtypeGroupConflict(history.present, dialog.supertypeId, dialog.subtypeId, targetGroup.id);
      if (conflict) {
        setGeneralizationGroupDialog({
          ...dialog,
          error: `Questa sottoentita appartiene gia al gruppo ${conflict.label ?? conflict.id}.`,
        });
        return;
      }
      const nextDiagram = assignInheritanceEdgeToGeneralizationGroup(history.present, dialog.edgeId, targetGroup.id);
      commitDiagram(nextDiagram);
      setGeneralizationGroupDialog(null);
      setSelection({ nodeIds: [], edgeIds: [dialog.edgeId] });
      setStatus(`Sottotipo ${getEntityLabel(history.present, dialog.subtypeId)} aggiunto al gruppo ${targetGroup.label ?? targetGroup.id}.`);
      return;
    }

    if (!name) {
      setGeneralizationGroupDialog({ ...dialog, error: "Il nome gruppo e obbligatorio." });
      return;
    }
    const conflict = getSubtypeGroupConflict(history.present, dialog.supertypeId, dialog.subtypeId);
    if (conflict) {
      setGeneralizationGroupDialog({
        ...dialog,
        error: `Questa sottoentita appartiene gia al gruppo ${conflict.label ?? conflict.id}.`,
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
    setStatus(`Nuovo gruppo ISA ${name} creato.`);
  }

  function handleCreateExternalIdentifierFromSelection(sourceAttributeId: string, targetId: string) {
    const sourceAttribute = history.present.nodes.find((node) => node.id === sourceAttributeId);
    if (sourceAttribute?.type !== "attribute") {
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "l'identificatore esterno non e stato creato",
          "non hai selezionato un attributo sorgente valido",
          "seleziona prima un attributo identificatore e poi il target",
        ),
      };
    }

    const sourceEntity = findEntityHostForAttribute(history.present, sourceAttributeId);
    if (!sourceEntity) {
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "l'identificatore esterno non e stato creato",
          "l'attributo sorgente non appartiene a nessuna entita",
          "collega l'attributo sorgente a un'entita e riprova",
        ),
      };
    }

    const importedIdentifierId = findInternalIdentifierContainingAttribute(sourceEntity, sourceAttribute.id);
    if (!importedIdentifierId) {
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "l'identificatore esterno non e stato creato",
          `l'attributo sorgente "${sourceAttribute.label}" non appartiene a nessun identificatore interno disponibile`,
          "seleziona un attributo che faccia parte di un identificatore interno della sorgente",
        ),
      };
    }

    const targetNode = history.present.nodes.find((node) => node.id === targetId);
    if (!targetNode) {
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "l'identificatore esterno non e stato creato",
          "la destinazione selezionata non e valida",
          "seleziona un'entita o un attributo di destinazione valido",
        ),
      };
    }

    let targetEntity: EntityNode | undefined;
    let localAttributeIds: string[] = [];

    if (targetNode.type === "attribute") {
      if (
        targetNode.isIdentifier === true ||
        targetNode.isCompositeInternal === true ||
        targetNode.isMultivalued === true
      ) {
        return {
          success: false,
          message: buildStructuredErrorMessage(
            "l'identificatore esterno non e stato creato",
            "l'attributo locale selezionato non e eleggibile",
            "usa solo attributi semplici locali non composti e non gia identificatori",
          ),
        };
      }

      targetEntity = findEntityHostForAttribute(history.present, targetNode.id);
      if (!targetEntity || targetEntity.type !== "entity") {
        return {
          success: false,
          message: buildStructuredErrorMessage(
            "l'identificatore esterno non e stato creato",
            "l'attributo di destinazione non appartiene a nessuna entita",
            "collega l'attributo target a un'entita e riprova",
          ),
        };
      }

      if (
        (targetEntity.internalIdentifiers ?? []).some((identifier) => identifier.attributeIds.includes(targetNode.id))
      ) {
        return {
          success: false,
          message: buildStructuredErrorMessage(
            "l'identificatore esterno non e stato creato",
            `l'attributo locale "${targetNode.label}" e gia occupato da un identificatore interno`,
            "scegli un attributo locale semplice non gia usato come identificatore",
          ),
        };
      }

      localAttributeIds = [targetNode.id];
    } else if (targetNode.type === "entity") {
      targetEntity = targetNode;
    } else {
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "l'identificatore esterno non e stato creato",
          "la destinazione non e un'entita o un attributo valido",
          "seleziona un'entita o un attributo come target",
        ),
      };
    }

    if (targetEntity.id === sourceEntity.id) {
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "l'identificatore esterno non e stato creato",
          "origine e destinazione appartengono alla stessa entita",
          "scegli una destinazione su un'entita diversa",
        ),
      };
    }

    const relationship = findRelationshipBetweenEntities(history.present, sourceEntity.id, targetEntity.id);
    if (!relationship || relationship.type !== "relationship") {
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "l'identificatore esterno non e stato creato",
          "non esiste una relazione valida tra le due entita selezionate",
          "crea prima la relazione tra le entita e poi riprova",
        ),
      };
    }

    const nextExternalIdentifier: ExternalIdentifier = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `externalIdentifier-${Math.random().toString(36).slice(2, 11)}`,
      importedParts: [
        {
          id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `externalIdentifierPart-${Math.random().toString(36).slice(2, 11)}`,
          relationshipId: relationship.id,
          sourceEntityId: sourceEntity.id,
          importedIdentifierId,
        },
      ],
      localAttributeIds,
    };
    const buildIdentifierSignature = (identifier: ExternalIdentifier) =>
      [
        identifier.importedParts
          .map((part) => [part.relationshipId, part.sourceEntityId, part.importedIdentifierId].join(":"))
          .sort()
          .join("|"),
        [...identifier.localAttributeIds].sort().join("|"),
      ].join("||");
    const duplicateExists = (targetEntity.externalIdentifiers ?? []).some(
      (identifier) => buildIdentifierSignature(identifier) === buildIdentifierSignature(nextExternalIdentifier),
    );
    if (duplicateExists) {
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "l'identificatore esterno non e stato creato",
          "esiste gia un identificatore esterno con la stessa parte importata e gli stessi attributi locali",
          "modifica l'identificatore esistente oppure scegli una combinazione diversa",
        ),
      };
    }

    const nextDiagram = updateNodeInDiagram(history.present, targetEntity.id, {
      externalIdentifiers: [...(targetEntity.externalIdentifiers ?? []), nextExternalIdentifier],
    } as Partial<DiagramNode>);

    const externalIdentifierCheck = revalidateExternalIdentifiers(
      synchronizeExternalIdentifiers(
        synchronizeInternalIdentifiers(synchronizeEntityRelationshipParticipations(nextDiagram)),
      ),
    );
    const blockedInvalidation = externalIdentifierCheck.invalidations.find(
      (invalidation) => invalidation.externalIdentifierId === nextExternalIdentifier.id,
    );
    if (blockedInvalidation) {
      return {
        success: false,
        message: buildStructuredErrorMessage(
          "l'identificatore esterno non e stato creato",
          blockedInvalidation.reason,
          "ripristina i prerequisiti identificanti e riprova",
        ),
      };
    }

    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [targetEntity.id], edgeIds: [] });
    return {
      success: true,
      message:
        localAttributeIds.length > 0
          ? "Identificatore esterno misto creato. Verifica cardinalita (1,1) sul lato host."
          : "Identificatore esterno importato creato. Verifica cardinalita (1,1) sul lato host.",
      };
  }

  function handleCreateAttributeFromSelection() {
    if (selection.nodeIds.length !== 1 || selection.edgeIds.length > 0) {
      setStatusWarning("Seleziona prima un'entita o una relazione.");
      return;
    }

    const hostNode = history.present.nodes.find((node) => node.id === selection.nodeIds[0]);
    if (!hostNode || (hostNode.type !== "entity" && hostNode.type !== "relationship" && hostNode.type !== "attribute")) {
      setStatusWarning("Seleziona prima un'entita o una relazione.");
      return;
    }

    if (hostNode.type === "attribute" && !canAttributeBecomeComposite(history.present, hostNode)) {
      setStatusError(
        buildStructuredErrorMessage(
          "l'attributo non e stato creato",
          `l'attributo "${hostNode.label}" appartiene gia a un attributo composto e non puo diventare composto`,
          "seleziona l'attributo composto principale e aggiungi li il nuovo attributo",
        ),
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
    const nextDiagram =
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

    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [hostNode.id], edgeIds: [] });
    setTool("select");
    setStatus(`Attributo collegato a ${hostNode.label}.`);
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

      const identityRenamed = renameNodeAsNameIdentity(history.present, nodeId, patch.label);
      workingDiagram = identityRenamed.diagram;
      workingNodeId = identityRenamed.nodeIdMap.get(nodeId) ?? nodeId;
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
        "La cardinalita del collegamento si modifica dall'entita collegata, non dal connector.",
      );
      return;
    }

    if (selectedEdge.type === "attribute") {
      setStatusWarning(
        "La cardinalita del collegamento si modifica dall'attributo collegato, non dal link grafico.",
      );
      return;
    }

    const nextValue = await requestPromptDialog({
      title: "Aggiorna collegamento",
      label: "Nuovo nome collegamento",
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
    setStatus("Collegamento aggiornato.");
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
      showWarningNotice("L'entita selezionata non appartiene a una gerarchia.");
      return;
    }

    if (!isEntityInGeneralizationGroup(history.present, selectedNode.id)) {
      showWarningNotice("L'entita selezionata non appartiene a una gerarchia.");
      return;
    }

    const nextDiagram = removeEntityFromGeneralizationHierarchy(history.present, selectedNode.id);
    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [selectedNode.id], edgeIds: [] });
    setTool("select");
    setStatus("Entita rimossa dalla gerarchia.");
    showSuccessNotice("Entita rimossa dalla gerarchia.");
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
    setStatus("Collegamento eliminato.");
  }

  function handleDeleteExternalIdentifier(hostEntityId: string, externalIdentifierId: string) {
    const hostEntity = history.present.nodes.find(
      (node): node is EntityNode => node.id === hostEntityId && node.type === "entity",
    );
    if (!hostEntity || !(hostEntity.externalIdentifiers ?? []).some((identifier) => identifier.id === externalIdentifierId)) {
      setStatusWarning("Nessun identificatore esterno da rimuovere sull'entita selezionata.");
      return;
    }

    const nextDiagram = removeExternalIdentifierFromEntity(history.present, hostEntityId, externalIdentifierId);
    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [hostEntityId], edgeIds: [] });
    setStatus("Identificatore esterno rimosso.");
  }

  function handleRemoveSelectedExternalIdentifier() {
    if (selectedNode?.type !== "entity") {
      setStatusWarning("Seleziona un'entita con identificatore esterno.");
      return;
    }

    const externalIdentifier = selectedNode.externalIdentifiers?.[0];
    if (!externalIdentifier) {
      setStatusWarning("Nessun identificatore esterno da rimuovere sull'entita selezionata.");
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
      showWarningNotice("Selezione copiata nella sessione. Clipboard di sistema non disponibile.");
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
      setStatusWarning("Copy disponibile nella vista ER.");
      return;
    }

    const payload = createDiagramClipboardPayload(history.present, selection);
    if (!payload) {
      setStatusWarning("Seleziona almeno un elemento ER da copiare.");
      return;
    }

    diagramClipboardRef.current = payload;
    pasteOffsetStepRef.current = 0;
    setHasDiagramClipboard(true);
    void writeDiagramPayloadToSystemClipboard(payload);
    setStatus("Selezione copiata.");
    payload.warnings?.forEach((warning) => showWarningNotice(warning));
  }

  async function handlePasteSelection() {
    if (diagramView !== "er") {
      setStatusWarning("Paste disponibile nella vista ER.");
      return;
    }
    if (mode !== "edit") {
      setStatusWarning("Paste disponibile solo in modalita modifica.");
      return;
    }

    const payload = diagramClipboardRef.current ?? (await readDiagramPayloadFromSystemClipboard());
    if (!payload) {
      setStatusWarning("Clipboard non contiene elementi ER Studio incollabili.");
      return;
    }

    if (!diagramClipboardRef.current) {
      diagramClipboardRef.current = payload;
      setHasDiagramClipboard(true);
    }

    const offset = GRID_SIZE * 2 * (pasteOffsetStepRef.current + 1);
    const pasted = pasteDiagramClipboardPayload(history.present, payload, { offset });
    if (!pasted) {
      setStatusWarning("Clipboard non contiene elementi ER Studio incollabili.");
      return;
    }

    pasteOffsetStepRef.current = (pasteOffsetStepRef.current + 1) % 8;
    commitDiagram(pasted.diagram);
    setSelection(pasted.selection);
    setTool("select");
    setStatus("Selezione incollata.");
  }

  function handleDuplicateSelection() {
    if (diagramView !== "er") {
      setStatusWarning("Duplica disponibile nella vista ER.");
      return;
    }
    if (mode !== "edit") {
      setStatusWarning("Duplica disponibile solo in modalita modifica.");
      return;
    }

    const duplicated = duplicateSelection(history.present, selection);
    if (!duplicated) {
      setStatusWarning("Seleziona almeno un elemento ER da duplicare.");
      return;
    }

    commitDiagram(duplicated.diagram);
    setSelection(duplicated.selection);
    setTool("select");
    setStatus("Selezione duplicata.");
  }

  function handleAlignSelection(axis: "left" | "center" | "top" | "middle") {
    if (selection.nodeIds.length < 2) {
      setStatusWarning("Seleziona almeno due nodi per allineare.");
      return;
    }

    const nextDiagram = alignNodes(history.present, selection.nodeIds, axis);
    if (nextDiagram === history.present) {
      setStatusWarning("Nodi gia allineati su questo asse.");
      return;
    }

    commitDiagram(nextDiagram);
    setStatus("Allineamento applicato.");
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
      });
      downloadTextFile(
        serializedProject,
        `${sanitizeFileNameBase(history.present.meta.name)}${PROJECT_FILE_EXTENSION}`,
        PROJECT_FILE_MIME_TYPE,
      );
      markDiagramSaved(history.present);
      if (!codeDirtyRef.current) {
        markCodeSaved(serializeDiagramToErs(history.present));
      }
      setStatus("Progetto salvato.");
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
    setStatus(codeDirtyRef.current ? "Bozza ERS scaricata." : "Codice ERS scaricato.");
  }

  function handleSaveRestructuredErs() {
    const source = serializeDiagramToErs(translationHistory.present.translatedDiagram);
    downloadTextFile(source, `${sanitizeFileNameBase(history.present.meta.name)}-restructured.ers`);
    setStatus("Codice ERS ristrutturato scaricato.");
  }

  function handleSaveLogicalSql() {
    if (logicalHistory.present.model.tables.length === 0) {
      setStatusWarning("Traduci almeno un elemento per generare codice SQL.");
      return;
    }

    downloadTextFile(
      generateLogicalSql(logicalHistory.present.model),
      `${sanitizeFileNameBase(history.present.meta.name)}.sql`,
      "text/sql;charset=utf-8",
    );
    setStatus("SQL scaricato.");
  }

  async function handleLoadProjectRequest() {
    if (!(await confirmDiscardChanges("caricare un progetto"))) {
      return;
    }

    projectFileInputRef.current?.click();
  }

  async function handleLoadErsRequest() {
    if (!(await confirmDiscardChanges("caricare un file ERS"))) {
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
          ? "Diagramma JSON legacy caricato come progetto."
          : "Progetto caricato.";
      applyWorkspaceDocument(parsedProject.state.diagram, loadStatus, {
        translationWorkspace: parsedProject.state.translationWorkspace,
        logicalWorkspace: parsedProject.state.logicalWorkspace,
        logicalGenerated: parsedProject.state.logicalGenerated,
        logicalStage: parsedProject.state.logicalStage,
        diagramView: parsedProject.state.diagramView,
        viewport: parsedProject.state.viewport,
        translationViewport: parsedProject.state.translationViewport,
        logicalViewport: parsedProject.state.logicalViewport,
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
        "Codice ERS caricato.",
      );
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Codice ERS non valido.";
      const formattedMessage = formatErsErrorMessage(message);
      setCodeError(formattedMessage);
      setStatusError(formattedMessage);
    } finally {
      event.target.value = "";
    }
  }

  function handleResetCodeFromDiagram() {
    syncCodeDraftWithDiagram(history.present);
    setStatus("Codice ERS rigenerato dal diagramma.");
  }

  async function handleExportPng() {
    if (!svgRef.current) {
      setStatusWarning("Canvas non disponibile per esportare il PNG.");
      return;
    }

    try {
      await downloadPng(svgRef.current, "chen-er-diagram.png");
      setStatus("PNG esportato.");
    } catch (error) {
      console.error(error);
      setStatusError(
        buildStructuredErrorMessage(
          "il PNG non e stato esportato",
          "il canvas non e stato convertito correttamente in immagine",
          "riprova l'esportazione e verifica che il diagramma sia visibile",
        ),
      );
    }
  }

  function handleExportSvg() {
    if (!svgRef.current) {
      setStatusWarning("Canvas non disponibile per esportare l'SVG.");
      return;
    }

    downloadSvg(svgRef.current, "chen-er-diagram.svg");
    setStatus("SVG esportato.");
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
          title: "Crea un'entita",
          description: "Seleziona Entita e clicca nel canvas.",
          complete: onboardingProgress.entityCreated,
          actionLabel: "Attiva Entita",
        },
        {
          id: "create-relationship",
          title: "Crea una relazione",
          description: "Seleziona Associazione e aggiungi un rombo.",
          complete: onboardingProgress.relationshipCreated,
          actionLabel: "Attiva Associazione",
        },
        {
          id: "create-connection",
          title: "Collega i nodi",
          description: "Usa Collegamento tra entita e associazione.",
          complete: onboardingProgress.connectionCreated,
          actionLabel: "Attiva Collegamento",
        },
        {
          id: "rename-node",
          title: "Rinomina un elemento",
          description: "Con Selezione, fai doppio click e cambia il nome.",
          complete: onboardingProgress.renamedNode,
          actionLabel: "Attiva Selezione",
        },
      ]
    : [];
  const onboardingActiveStepIndex = onboardingSteps.findIndex((step) => !step.complete);
  const resolvedOnboardingStepIndex = onboardingActiveStepIndex >= 0 ? onboardingActiveStepIndex : onboardingSteps.length - 1;
  const showOnboardingGuide =
    surface === "studio" &&
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
        title="Preview logica"
        subtitle="Step 2 di 3 — Tabelle, chiavi e vincoli ricavati dal CREATE TABLE."
        onDone={handleSqlReverseLogicalDone}
        onCancel={handleCancelSqlReverseWorkflow}
        doneLabel="Avanti"
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
        title="Preview concettuale ER"
        subtitle="Step 3 di 3 — Diagramma ER generato dallo schema SQL."
        onDone={handleSqlReverseFinalDone}
        onCancel={handleCancelSqlReverseWorkflow}
        onBack={handleSqlReverseBackToLogicalPreview}
        doneLabel="Done"
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

  if (surface === "code-tutorial") {
    return (
      <CodeModeTutorialPage
        appTitle={APP_TITLE}
        appVersion={APP_VERSION}
        onBackWorkspace={openStudioSurface}
        onOpenCodeStudio={openStudioSurface}
      />
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
        onNewProject={handleNewProject}
        onToggleCodePanel={handleToggleCodePanel}
        onToggleNotesPanel={handleToggleNotesPanel}
        onSaveProject={handleSaveProject}
        onLoadProject={handleLoadProjectRequest}
        onOpenCommandMenu={openCommandMenu}
        onOpenShortcuts={openKeyboardShortcuts}
        onDiagramNameChange={handleDiagramNameChange}
      />

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
            <div className={codePanelOpen ? "designer-workspace code-open" : "designer-workspace"}>
              {codePanelOpen ? (
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
              ) : null}

              <div className="designer-canvas-region">
                <div className="designer-quick-actions-bar designer-side-toggle-group" aria-label="Pannelli rapidi">
                  <button
                    type="button"
                    className={["designer-side-toggle", codePanelOpen ? "active" : ""].filter(Boolean).join(" ")}
                    onClick={handleToggleCodePanel}
                    title={codePanelOpen ? "Chiudi codice ERS" : "Apri codice ERS"}
                    aria-label={codePanelOpen ? "Chiudi pannello Code ERS" : "Apri pannello Code ERS"}
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
                    title="Importa schema SQL"
                    aria-label="Apri workflow Reverse Engineering SQL"
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
                    title="Apri errori e warning"
                    aria-label="Apri elenco errori e warning"
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
                    title={notesPanelOpen ? "Chiudi note" : "Apri note"}
                    aria-label={notesPanelOpen ? "Chiudi pannello Notes" : "Apri pannello Notes"}
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
                  onOpenCardinality={handleOpenCardinalityControl}
                  onOpenRole={handleOpenConnectorRoleControl}
                  onToggleSimpleIdentifier={handleToggleSimpleIdentifierFromSelection}
                  onOpenCompositeIdentifier={handleCreateCompositeIdentifierFromSelection}
                  onOpenMixedIdentifier={handleOpenMixedIdentifierModal}
                  onOpenExternalIdentifier={() => createExternalIdentifierFromContext({ mixed: false })}
                  onOpenInheritanceType={handleOpenInheritanceTypeControl}
                  onRemoveFromHierarchy={handleRemoveSelectedEntityFromHierarchy}
                  onRemoveExternalIdentifier={handleRemoveSelectedExternalIdentifier}
                  onToolChange={setTool}
                  onCopySelection={handleCopySelection}
                  onPasteSelection={() => void handlePasteSelection()}
                  onDuplicateSelection={handleDuplicateSelection}
                  canPasteSelection={hasDiagramClipboard}
                  onDeleteSelection={handleDeleteSelection}
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
                  onSelectionChange={setSelection}
                  onPreviewDiagram={handlePreviewDiagram}
                  onCommitDiagram={commitDiagram}
                  onCreateNode={handleCreateNode}
                  onCreateEdge={handleCreateEdge}
                  onOpenCardinality={handleOpenCardinalityControl}
                  onOpenInheritanceType={handleOpenInheritanceTypeControl}
                  onToolChange={setTool}
                  onCreateExternalIdentifier={handleCreateExternalIdentifierFromSelection}
                  onDeleteNode={handleDeleteNodeById}
                  onDeleteEdge={handleDeleteEdgeById}
                  onDeleteSelection={handleDeleteSelection}
                  onDeleteExternalIdentifier={handleDeleteExternalIdentifier}
                  onRenameNode={handleRenameNode}
                  onRenameEdge={handleRenameEdge}
                  onStatusMessageChange={handleCanvasStatusMessage}
                />

                {notesPanelOpen ? (
                  <NotesPanel
                    embedded
                    notes={history.present.notes}
                    editable={mode === "edit"}
                    onChange={handleNotesChange}
                    onClose={handleToggleNotesPanel}
                  />
                ) : null}
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
          onToggleCodePanel={handleToggleCodePanel}
          onToggleNotesPanel={handleToggleNotesPanel}
          onSaveProject={handleSaveProject}
          onSaveErs={handleSaveErs}
          onLoadProject={handleLoadProjectRequest}
          onLoadErs={handleLoadErsRequest}
          onExportPng={handleExportPng}
          onExportSvg={handleExportSvg}
          onResetErs={handleResetCodeFromDiagram}
          onOpenErsGuide={openCodeTutorialSurface}
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
              <button type="button" className="help-close" onClick={() => setErrorsPanelOpen(false)} aria-label="Chiudi errori e warning">
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
                <p className="errors-modal-empty">Nessun errore o warning nel diagramma.</p>
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
              <h2 id="mixed-id-dialog-title">Mixed Id</h2>
            </div>
            <form
              className="action-modal-content"
              onSubmit={(event) => {
                event.preventDefault();
                submitMixedIdentifierDialog();
              }}
            >
              <div className="context-card-title">Parti importate eleggibili</div>
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
              <div className="context-card-title">Attributi locali dell'host</div>
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
                  Annulla
                </button>
                <button type="submit" className="mode-button active" disabled={mixedIdentifierDialog.importedParts.length === 0}>
                  Crea
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
                <h2 id="isa-dialog-title">Configura gruppo ISA</h2>
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
                    ? "Modifica nome e vincoli del gruppo di gerarchia selezionato."
                    : "Scegli se aggiungere questa sottoentita a un gruppo esistente oppure creare un nuovo gruppo di gerarchia."}
                </p>
                <div className="action-modal-summary">
                  <strong>Sottoentita:</strong> {subtypeLabel}
                  <br />
                  <strong>Superentita:</strong> {supertypeLabel}
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
                      <span>Usa gruppo esistente</span>
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
                                Vincoli: {formatIsaConstraintShort(group.isaCompleteness, group.isaDisjointness)}
                                <br />
                                Sottoentita: {group.subtypeIds.map((subtypeId) => getEntityLabel(history.present, subtypeId)).join(", ") || "-"}
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
                      <span>Crea nuovo gruppo</span>
                    </label>
                  </div>
                ) : null}

                {(dialog.kind === "edit" || dialog.mode === "new") ? (
                  <>
                    <label className="action-modal-field">
                      <span>Nome gruppo</span>
                      <input
                        value={dialog.newGroupName}
                        onChange={(event) => setGeneralizationGroupDialog({ ...dialog, newGroupName: event.target.value, error: "" })}
                        placeholder="Genere"
                        autoFocus
                      />
                    </label>
                    <div className="choice-grid">
                      {([
                        ["total", "Totale"],
                        ["partial", "Parziale"],
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
                        ["disjoint", "Disgiunta"],
                        ["overlap", "Sovrapposta"],
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
                      Vincolo: {formatIsaConstraintShort(dialog.isaCompleteness, dialog.isaDisjointness)}
                    </p>
                  </>
                ) : null}

                {dialog.error ? <p className="action-modal-error">{dialog.error}</p> : null}
                <div className="action-modal-actions">
                  <button type="button" className="header-button" onClick={cancelGeneralizationGroupDialog}>
                    Annulla
                  </button>
                  <button type="submit" className="mode-button active">
                    Conferma
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
              <h2 id="intro-modal-title">Benvenuto in {APP_TITLE}</h2>
              <button type="button" className="help-close" onClick={() => setIntroOpen(false)} aria-label="Chiudi introduzione">
                <StudioIcon name="close" aria-hidden="true" />
              </button>
            </div>

            <div className="intro-modal-content">
              <p>
                Questa applicazione ti aiuta a costruire diagrammi ER in stile Chen in modo rapido: crea entita,
                relazioni e attributi, collega i nodi e valida la consistenza del modello.
              </p>

              <div className="intro-grid">
                <article>
                  <h3>1. Crea</h3>
                  <p>Seleziona uno strumento, clicca sul canvas e inserisci i tuoi elementi principali.</p>
                </article>
                <article>
                  <h3>2. Collega</h3>
                  <p>Usa Collegamento o Generalizzazione per definire relazioni e cardinalita.</p>
                </article>
                <article>
                  <h3>3. Rifinisci</h3>
                  <p>Rinomina con doppio click, allinea i nodi e correggi i warning nelle validazioni.</p>
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
                  Apri la guida
                </button>
                <button type="button" className="mode-button active" onClick={() => setIntroOpen(false)}>
                  Inizia a disegnare
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
                <h2 id="about-modal-title" className="studio-modal__title">Informazioni</h2>
                <p className="studio-modal__subtitle">ER Studio e stato corrente dell'editor.</p>
              </div>
              <button
                type="button"
                className="studio-modal__close"
                onClick={() => setAboutOpen(false)}
                aria-label="Chiudi informazioni"
                autoFocus
              >
                <StudioIcon name="close" aria-hidden="true" />
              </button>
            </div>

            <div className="studio-modal__body">
              <div className="studio-modal__meta about-meta">
                <strong>{APP_TITLE}</strong>
                <span>Versione corrente {APP_VERSION}</span>
              </div>

              <div className="studio-modal__accordion help-sections">
                <details className="studio-modal__details help-section" open>
                <summary>Strumenti e scorciatoie</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>Selezione rapida strumenti: S Sposta, V Selezione, X Cancella, E Entita, R Relazione, A Attributo, C Collegamento, G Generalizzazione.</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>Inserimento e Collegamenti</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>Con Entita, Relazione o Attributo: clic sul canvas per inserire l'elemento; dopo l'inserimento il tool torna su Selezione.</li>
                  <li>Collegamenti: scegli Collegamento o Generalizzazione, clicca il nodo sorgente e poi il nodo destinazione.</li>
                  <li>Le Notes del diagramma si gestiscono dal pannello Notes sulla destra e vengono salvate insieme al modello.</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>Selezione e Modifica</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>Con Selezione puoi trascinare nodi e box di selezione; Shift+click aggiunge/rimuove nodi dalla selezione.</li>
                  <li>Doppio click su nodo o su una generalizzazione per rinominare; le cardinalita si modificano dai pannelli proprieta di entita e attributi.</li>
                  <li>Nell'ispettore puoi attivare entita deboli dedicate, attributi composti e vincoli ISA avanzati sulle generalizzazioni.</li>
                  <li>Con Selezione puoi trascinare la cardinalita di un collegamento per spostare la linea.</li>
                  <li>I pulsanti di allineamento funzionano con almeno due nodi selezionati.</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>Navigazione del canvas</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>Navigazione canvas: rotella per zoom, strumento Sposta per pan, oppure trascina con tasto centrale.</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>Comandi Tastiera</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>Ctrl/Cmd+S salva il progetto `.ersp`, Ctrl/Cmd+C copia, Ctrl/Cmd+V incolla, Ctrl/Cmd+D duplica selezione, Ctrl/Cmd+I apre o chiude il dock tecnico, Ctrl/Cmd+Z annulla, Ctrl/Cmd+Shift+Z o Ctrl/Cmd+Y ripete.</li>
                  <li>Delete/Backspace elimina la selezione; Esc annulla la selezione corrente e chiude le finestre informazioni/novita.</li>
                  <li>Nel canvas usa Tab per mettere a fuoco nodi e collegamenti, frecce per spostare la selezione, Invio per rinominare ed Esc per annullare un collegamento in corso.</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>Modalita codice e sincronizzazione live</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>In vista Affiancata, il codice ERS viene validato in tempo reale e il diagramma si aggiorna automaticamente quando la sintassi e valida.</li>
                  <li>Se il codice e incompleto o non valido, viene mostrato l'errore nel pannello senza alterare l'ultimo stato valido del diagramma.</li>
                  <li>Usa Rigenera dal diagramma per riallineare rapidamente il sorgente ERS allo stato corrente del canvas.</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>Validazioni ed Errori</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>Avvisi ed errori operativi compaiono come toast flottanti in overlay, senza spostare il layout, e i problemi del modello restano evidenziati su nodi e collegamenti.</li>
                </ul>
              </details>

              <details className="studio-modal__details help-section">
                <summary>Stato Notazione ER (v{APP_VERSION})</summary>
                <ul className="studio-modal__list-text help-list">
                  <li>Disponibile: entita, entita deboli dedicate, relazioni, attributi, attributi composti, cardinalita, generalizzazione e identificatori semplici/composti interni/esterni.</li>
                  <li>Disponibile: vincoli ISA avanzati disjoint/overlap e total/partial su ogni collegamento di generalizzazione.</li>
                  <li>Ancora non coperto: attributi derivati e altri simboli EER specialistici non ancora presenti nel canvas.</li>
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
          entries={APP_CHANGELOG}
          onClose={() => setWhatsNewOpen(false)}
        />
      ) : null}

    </div>
  );
}
