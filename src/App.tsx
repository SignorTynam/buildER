import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent, PointerEvent as ReactPointerEvent } from "react";
import { DiagramCanvas } from "./canvas/DiagramCanvas";
import { AppHeader } from "./components/AppHeader";
import { CodeModeTutorialPage } from "./components/CodeModeTutorialPage";
import { CodePanel } from "./components/CodePanel";
import { CommandMenuModal } from "./components/CommandMenuModal";
import { KeyboardShortcutsModal } from "./components/KeyboardShortcutsModal";
import { NotesPanel } from "./components/NotesPanel";
import { OnboardingGuide } from "./components/OnboardingGuide";
import { TechnicalDockPanel, type TechnicalPanelTab } from "./components/TechnicalDockPanel";
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
  Point,
  SelectionState,
  ToolKind,
  ValidationIssue,
  Viewport,
} from "./types/diagram";
import { EMPTY_LOGICAL_SELECTION } from "./types/logical";
import type {
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
  assignInheritanceConstraintToGroup,
  canConnect,
  canAttributeHaveCardinality,
  createEdge,
  createEmptyDiagram,
  createNode,
  duplicateSelection,
  edgeAlreadyExists,
  type ExternalIdentifierInvalidation,
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
import { downloadPng, downloadSvg } from "./utils/export";
import { GRID_SIZE, snapValue } from "./utils/geometry";
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
  getLogicalTranslationStepCompletion,
} from "./utils/logicalTranslation";
import {
  type LogicalColumnSqlPatch,
  updateLogicalColumnSqlMetadata,
} from "./utils/logicalSqlMetadata";
import { generateLogicalSql } from "./utils/logicalSql";
import {
  parseProjectFile,
  ProjectFileError,
  PROJECT_FILE_ACCEPT,
  PROJECT_FILE_EXTENSION,
  PROJECT_FILE_MIME_TYPE,
  serializeProjectFile,
} from "./utils/projectFile";
import {
  CONNECTOR_CARDINALITY_PRESETS,
  getAttributeCardinalityOwner,
  getConnectorParticipation,
  getConnectorParticipationContext,
  normalizeCardinalityInput,
  normalizeSupportedCardinality,
} from "./utils/cardinality";
import { TOOL_BY_SHORTCUT, getToolLabel } from "./utils/toolConfig";
import { APP_CHANGELOG, APP_NAME, APP_TITLE, APP_VERSION } from "./utils/appMeta";

const DEFAULT_VIEWPORT: Viewport = {
  x: 180,
  y: 110,
  zoom: 1,
};

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

type CardinalityDialogTarget =
  | { kind: "attribute"; attributeId: string }
  | { kind: "connector"; edgeId: string };

interface CardinalityDialogState {
  target: CardinalityDialogTarget;
  initialValue: string;
  presetValue: string;
  customValue: string;
  error: string;
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

interface InheritanceTypeDialogState {
  edgeId: string;
  value: "t,e" | "t,o" | "p,e" | "p,o";
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
const ATTRIBUTE_CREATION_HORIZONTAL_OFFSET = 140;
const ATTRIBUTE_CREATION_STACK_GAP = 28;
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
          : parsed.technicalPanelTab === "sql"
            ? "sql"
            : storedNotesPanelOpen
              ? "notes"
              : storedCodePanelOpen
                ? "code"
                : "review";
    const storedTechnicalPanelOpen =
      typeof parsed.technicalPanelOpen === "boolean"
        ? parsed.technicalPanelOpen
        : storedNotesPanelOpen || storedCodePanelOpen;

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

  const regularAttributes = hostedAttributes.filter(
    (attribute) => attribute.isIdentifier !== true && attribute.isCompositeInternal !== true,
  );
  const hostCenterX = hostNode.x + hostNode.width / 2;
  const leftAttributes = regularAttributes.filter(
    (attribute) => attribute.x + attribute.width / 2 < hostCenterX,
  );
  const rightAttributes = regularAttributes.filter(
    (attribute) => attribute.x + attribute.width / 2 >= hostCenterX,
  );
  const useLeftSide = leftAttributes.length > 0 && rightAttributes.length === 0;
  const sideAttributes = useLeftSide ? leftAttributes : rightAttributes;
  const baseY = hostNode.y + hostNode.height / 2 - nextAttribute.height / 2;
  const nextY =
    sideAttributes.length === 0
      ? baseY
      : Math.max(...sideAttributes.map((attribute) => attribute.y + attribute.height)) +
        ATTRIBUTE_CREATION_STACK_GAP;

  return {
    x: snapValue(
      useLeftSide
        ? hostNode.x - ATTRIBUTE_CREATION_HORIZONTAL_OFFSET - nextAttribute.width / 2
        : hostNode.x + hostNode.width + ATTRIBUTE_CREATION_HORIZONTAL_OFFSET - nextAttribute.width / 2,
      GRID_SIZE,
    ),
    y: snapValue(nextY, GRID_SIZE),
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
  const sideOrder: Array<"left" | "right" | "top" | "bottom"> = ["left", "right", "top", "bottom"];
  const bySide = new Map<(typeof sideOrder)[number], AttributeNode[]>(
    sideOrder.map((side) => [side, []]),
  );

  attributes.forEach((attribute, index) => {
    bySide.get(sideOrder[index % sideOrder.length])?.push(attribute);
  });

  const hostCenterX = hostNode.x + hostNode.width / 2;
  const hostCenterY = hostNode.y + hostNode.height / 2;
  const horizontalGap = 74;
  const verticalGap = 64;
  const verticalSpacing = 44;
  const horizontalSpacing = 64;
  const positions = new Map<string, Point>();

  (["left", "right"] as const).forEach((side) => {
    const sideAttributes = bySide.get(side) ?? [];
    const total = (sideAttributes.length - 1) * verticalSpacing;
    sideAttributes.forEach((attribute, index) => {
      const circleX = side === "left" ? hostNode.x - horizontalGap : hostNode.x + hostNode.width + horizontalGap;
      const circleY = hostCenterY - total / 2 + index * verticalSpacing;
      positions.set(attribute.id, {
        x: snapValue(circleX - 10, GRID_SIZE),
        y: snapValue(circleY - attribute.height / 2, GRID_SIZE),
      });
    });
  });

  (["top", "bottom"] as const).forEach((side) => {
    const sideAttributes = bySide.get(side) ?? [];
    const total = (sideAttributes.length - 1) * horizontalSpacing;
    sideAttributes.forEach((attribute, index) => {
      const circleX = hostCenterX - total / 2 + index * horizontalSpacing;
      const circleY = side === "top" ? hostNode.y - verticalGap : hostNode.y + hostNode.height + verticalGap;
      positions.set(attribute.id, {
        x: snapValue(circleX - 10, GRID_SIZE),
        y: snapValue(circleY - attribute.height / 2, GRID_SIZE),
      });
    });
  });

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
  const [introOpen, setIntroOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [promptDialog, setPromptDialog] = useState<PromptDialogState | null>(null);
  const [cardinalityDialog, setCardinalityDialog] = useState<CardinalityDialogState | null>(null);
  const [mixedIdentifierDialog, setMixedIdentifierDialog] = useState<MixedIdentifierDialogState | null>(null);
  const [inheritanceTypeDialog, setInheritanceTypeDialog] = useState<InheritanceTypeDialogState | null>(null);
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
  const [notesPanelWidth, setNotesPanelWidth] = useState(sessionBootstrap.notesPanelWidth);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(sessionBootstrap.toolbarCollapsed);
  const [focusMode, setFocusMode] = useState(sessionBootstrap.focusMode);
  const [windowWidth, setWindowWidth] = useState(INITIAL_WINDOW_WIDTH);
  const [toolbarWidth, setToolbarWidth] = useState(sessionBootstrap.toolbarWidth);
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

  const issues = validateDiagram(history.present);
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
  const logicalStepCompletion = useMemo(
    () => getLogicalTranslationStepCompletion(logicalTranslationOverview),
    [logicalTranslationOverview],
  );
  const logicalPendingCount = Object.entries(logicalStepCompletion)
    .filter(([stepId]) => stepId !== "review")
    .reduce((total, [, value]) => total + value.pending + value.invalid, 0);
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
  const technicalPanelAvailableInView = diagramView === "er";
  const technicalPanelVisible = technicalPanelOpen && technicalPanelAvailableInView && !focusMode;
  const structuredSidePanelHidden = diagramView !== "er" && technicalPanelVisible;
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
    setTechnicalPanelOpen(true);
    setCodePanelOpen(nextTab === "code");
    setNotesPanelOpen(nextTab === "notes");
  }

  function closeTechnicalPanel() {
    setTechnicalPanelOpen(false);
    setCodePanelOpen(false);
    setNotesPanelOpen(false);
  }

  function handleToggleReviewPanel() {
    if (technicalPanelOpen) {
      closeTechnicalPanel();
      return;
    }

    openTechnicalPanelTab("review");
  }

  function handleToggleCodePanel() {
    if (technicalPanelOpen && technicalPanelTab === "code") {
      closeTechnicalPanel();
      return;
    }

    openTechnicalPanelTab("code");
  }

  function handleToggleNotesPanel() {
    if (technicalPanelOpen && technicalPanelTab === "notes") {
      closeTechnicalPanel();
      return;
    }

    openTechnicalPanelTab("notes");
  }

  function handleOpenErStage() {
    setLogicalPanelMode("review");
    if (diagramView !== "er") {
      handleDiagramViewChange("er");
    }
  }

  function handleOpenTranslationStage() {
    setLogicalPanelMode("review");
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
    codeDirtyRef.current = nextDirty;
    setCodeDraft(nextCode);
    setCodeDirty(nextDirty);
    if (codeError) {
      setCodeError("");
    }
  }

  useEffect(() => {
    if (!codeDirtyRef.current) {
      return;
    }

    const timeout = window.setTimeout(() => {
      try {
        const parsed = parseErsDiagram(codeDraftRef.current, history.present);
        const parsedSerialized = serializeDiagramToErs(parsed);

        if (parsedSerialized !== lastSerializedCodeRef.current) {
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
                synchronizeEntityRelationshipParticipations(synchronizeNodeNameIdentity(history.present).diagram),
              ),
            ),
          ).diagram;
          history.commit(normalizedParsed, normalizedCurrent);
        }

        if (codeError) {
          setCodeError("");
        }
        lastSerializedCodeRef.current = codeDraftRef.current;
        codeDirtyRef.current = false;
        setCodeDirty(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Codice ERS non valido.";
        setCodeError(formatErsErrorMessage(message));
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [codeDraft, history, codeError]);

  useEffect(() => {
    const nextSerializedCode = serializeDiagramToErs(history.present);
    const draftWasSynced = codeDraftRef.current === lastSerializedCodeRef.current;
    lastSerializedCodeRef.current = nextSerializedCode;

    if (!codeDirtyRef.current || draftWasSynced) {
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
        target instanceof HTMLSelectElement;

      if (isEditingField) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handleSaveProject();
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
          handleToggleReviewPanel();
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
          setCardinalityDialog(null);
          return;
        }

        if (mixedIdentifierDialog) {
          event.preventDefault();
          setMixedIdentifierDialog(null);
          return;
        }

        if (inheritanceTypeDialog) {
          event.preventDefault();
          setInheritanceTypeDialog(null);
          return;
        }

        if (errorsPanelOpen) {
          event.preventDefault();
          setErrorsPanelOpen(false);
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
    inheritanceTypeDialog,
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
    setLogicalViewport(DEFAULT_VIEWPORT);
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
        regenerateLogicalWorkspace({ switchToLogical: true, preservePositions: true });
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

  function handleApplyBulkLogicalFix(step: "entities" | "weak-entities" | "relationships" | "multivalued-attributes") {
    const previousWorkspace = logicalHistory.present;
    const result = applyBulkLogicalFix(translationHistory.present.translatedDiagram, previousWorkspace, step);
    if (result.appliedCount === 0) {
      setStatusWarning("Nessun elemento logico applicabile per questo step.");
      return;
    }

    commitLogicalWorkspace(result.workspace, previousWorkspace);
    setDiagramView("logical");
    setLogicalStage("translation");
    setLogicalTypeMode(false);
    setStatus(`Fix logico applicato a ${result.appliedCount} elementi.`);
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
    setStatus(choice.summary);
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
    const nextDiagramBase = {
      ...history.present,
      edges: [...history.present.edges, nextEdge],
    };
    const nextDiagram =
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

    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [], edgeIds: [nextEdge.id] });
    setTool("select");
    if (type === "inheritance") {
      return { success: true, message: "Collegamento ISA creato. Assegna un vincolo alla gerarchia." };
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
      target,
      initialValue: currentValue,
      presetValue: (CONNECTOR_CARDINALITY_PRESETS as readonly string[]).includes(currentValue)
        ? currentValue
        : "custom",
      customValue: currentValue,
      error: "",
    });
  }

  function applyCardinalityToTarget(target: CardinalityDialogTarget, value: string): boolean {
    const parsed = normalizeCardinalityInput(value);
    if (!parsed.valid || !parsed.value) {
      setCardinalityDialog((current) =>
        current ? { ...current, error: parsed.reason ?? "Cardinalita non valida." } : current,
      );
      return false;
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
        return false;
      }

      handleNodeChange(target.attributeId, { cardinality: parsed.value } as Partial<DiagramNode>);
      setStatus(`Cardinalita aggiornata a ${parsed.value}.`);
      return true;
    }

    const nodeMap = new Map(history.present.nodes.map((node) => [node.id, node]));
    const connectorEdge = history.present.edges.find(
      (edge): edge is Extract<DiagramEdge, { type: "connector" }> =>
        edge.id === target.edgeId && edge.type === "connector",
    );
    if (!connectorEdge) {
      setCardinalityDialog((current) => current ? { ...current, error: "Connector non disponibile." } : current);
      return false;
    }

    const sourceNode = nodeMap.get(connectorEdge.sourceId);
    const targetNode = nodeMap.get(connectorEdge.targetId);
    const context = getConnectorParticipationContext(sourceNode, targetNode);
    if (!context) {
      setCardinalityDialog((current) =>
        current ? { ...current, error: "Seleziona un connector entita-relazione." } : current,
      );
      return false;
    }

    const participationId = connectorEdge.participationId ?? `participation-${connectorEdge.id}`;
    const nextDiagram: DiagramDocument = {
      ...history.present,
      edges: history.present.edges.map((edge) =>
        edge.id === connectorEdge.id && edge.type === "connector"
          ? { ...edge, participationId }
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
                  ? { ...participation, cardinality: parsed.value }
                  : participation,
              )
            : [
                ...participations,
                {
                  id: participationId,
                  relationshipId: context.relationship.id,
                  cardinality: parsed.value,
                },
              ],
        };
      }),
    };
    commitDiagram(nextDiagram);
    setSelection({ nodeIds: [], edgeIds: [connectorEdge.id] });
    setStatus(`Cardinalita aggiornata a ${parsed.value}.`);
    return true;
  }

  function submitCardinalityDialog() {
    if (!cardinalityDialog) {
      return;
    }

    const value =
      cardinalityDialog.presetValue === "custom"
        ? cardinalityDialog.customValue
        : cardinalityDialog.presetValue;
    if (applyCardinalityToTarget(cardinalityDialog.target, value)) {
      setCardinalityDialog(null);
    }
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

    const localEligible = findDirectHostedAttributes(history.present, hostEntity.id).filter((attribute) => {
      if (attribute.isMultivalued === true) {
        return false;
      }
      const usedInternal = (hostEntity?.internalIdentifiers ?? []).some((identifier) => identifier.attributeIds.includes(attribute.id));
      const usedExternal = (hostEntity?.externalIdentifiers ?? []).some((identifier) => identifier.localAttributeIds.includes(attribute.id));
      return !usedInternal && !usedExternal;
    });

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

    const attributes = findDirectHostedAttributes(history.present, hostEntity.id)
      .filter((attribute) => {
        if (attribute.isMultivalued === true || attribute.isIdentifier === true || attribute.isCompositeInternal === true) {
          return false;
        }
        const usedInternal = (hostEntity.internalIdentifiers ?? []).some((identifier) =>
          identifier.attributeIds.includes(attribute.id),
        );
        const usedExternal = (hostEntity.externalIdentifiers ?? []).some((identifier) =>
          identifier.localAttributeIds.includes(attribute.id),
        );
        return !usedInternal && !usedExternal;
      })
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

  function handleOpenInheritanceTypeControl(edgeId?: string) {
    const inheritanceEdge = edgeId
      ? history.present.edges.find((edge): edge is Extract<DiagramEdge, { type: "inheritance" }> => edge.id === edgeId && edge.type === "inheritance")
      : selectedEdge?.type === "inheritance"
        ? selectedEdge
        : undefined;
    if (!inheritanceEdge) {
      return;
    }

    const currentCompleteness = inheritanceEdge.isaCompleteness === "total" ? "t" : "p";
    const currentDisjointness = inheritanceEdge.isaDisjointness === "overlap" ? "o" : "e";
    setInheritanceTypeDialog({
      edgeId: inheritanceEdge.id,
      value: `${currentCompleteness},${currentDisjointness}` as InheritanceTypeDialogState["value"],
    });
  }

  function submitInheritanceTypeDialog() {
    if (!inheritanceTypeDialog) {
      return;
    }

    const [completeness, disjointness] = inheritanceTypeDialog.value.split(",") as ["t" | "p", "e" | "o"];
    handleEdgeChange(inheritanceTypeDialog.edgeId, {
      isaCompleteness: completeness === "t" ? "total" : "partial",
      isaDisjointness: disjointness === "o" ? "overlap" : "disjoint",
      label: `(${completeness},${disjointness})`,
    } as Partial<DiagramEdge>);
    setInheritanceTypeDialog(null);
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

      if (
        (targetEntity.externalIdentifiers ?? []).some((identifier) => identifier.localAttributeIds.includes(targetNode.id))
      ) {
        return {
          success: false,
          message: buildStructuredErrorMessage(
            "l'identificatore esterno non e stato creato",
            `l'attributo locale "${targetNode.label}" e gia usato in un altro identificatore esterno`,
            "seleziona un attributo locale libero oppure modifica l'identificatore esistente",
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
    const duplicateExists = (targetEntity.externalIdentifiers ?? []).some(
      (identifier) =>
        identifier.importedParts.length === nextExternalIdentifier.importedParts.length &&
        identifier.importedParts.every((part, index) => {
          const nextPart = nextExternalIdentifier.importedParts[index];
          return (
            nextPart !== undefined &&
            part.relationshipId === nextPart.relationshipId &&
            part.sourceEntityId === nextPart.sourceEntityId &&
            part.importedIdentifierId === nextPart.importedIdentifierId
          );
        }) &&
        identifier.localAttributeIds.length === nextExternalIdentifier.localAttributeIds.length &&
        identifier.localAttributeIds.every(
          (attributeId, index) => nextExternalIdentifier.localAttributeIds[index] === attributeId,
        ),
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
        return node?.type !== "attribute" || (node.isIdentifier !== true && node.isCompositeInternal !== true);
      });

      if (targetIds.length !== nodeIds.length) {
        setStatusError(
          buildStructuredErrorMessage(
            "la modifica degli attributi non e stata applicata a tutta la selezione",
            "un attributo usato come identificatore non puo diventare composto",
            "rimuovi il flag identificatore prima di impostare il composto",
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
    let mergedIsaGroup = false;

    if (
      edge?.type === "inheritance" &&
      "isaCompleteness" in patch &&
      "isaDisjointness" in patch &&
      patch.isaCompleteness &&
      patch.isaDisjointness
    ) {
      if (edge.generalizationGroupId) {
        const beforeGroupCount = history.present.generalizationGroups?.length ?? 0;
        const previousGroupId = edge.generalizationGroupId;
        nextDiagram = updateGeneralizationGroupConstraint(
          history.present,
          previousGroupId,
          patch.isaCompleteness,
          patch.isaDisjointness,
        );
        const afterGroupCount = nextDiagram.generalizationGroups?.length ?? 0;
        const stillExists = nextDiagram.generalizationGroups?.some((group) => group.id === previousGroupId) ?? false;
        mergedIsaGroup = !stillExists && afterGroupCount < beforeGroupCount;
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
    if (mergedIsaGroup) {
      setStatus("Gerarchia ISA aggiornata e unificata con il gruppo esistente.");
    }
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

  function handleDuplicateSelection() {
    const duplicated = duplicateSelection(history.present, selection);
    if (!duplicated) {
      return;
    }

    commitDiagram(duplicated.diagram);
    setSelection(duplicated.selection);
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
  const technicalDockAvailableTabs: TechnicalPanelTab[] =
    diagramView === "er" ? ["review", "code", "notes"] : ["code", "notes"];
  const technicalDockCode =
    diagramView === "er" ? codeDraft : serializeDiagramToErs(translationHistory.present.translatedDiagram);
  const technicalDockCodeDescription =
    diagramView === "er"
      ? "Inserisci il codice ERS"
      : diagramView === "translation"
        ? "Preview del codice ERS tradotto"
        : "Preview del codice ERS sorgente dello schema logico";
  const technicalDockPanel = technicalPanelVisible ? (
    <TechnicalDockPanel
      activeTab={technicalPanelTab}
      availableTabs={technicalDockAvailableTabs}
      code={{
        code: technicalDockCode,
        editable: diagramView === "er" && mode === "edit",
        parseError: diagramView === "er" ? codeError : undefined,
        onCodeChange: diagramView === "er" ? updateCodeDraft : undefined,
        placeholder: technicalDockCodeDescription,
      }}
      notes={{
        notes: history.present.notes,
        editable: mode === "edit",
        onChange: handleNotesChange,
      }}
      review={diagramView === "er" ? modelReviewPanel : undefined}
      onTabChange={openTechnicalPanelTab}
      onClose={closeTechnicalPanel}
    />
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
                  onClose={handleToggleCodePanel}
                />
              ) : null}

              <div className="designer-canvas-region">
                <div className="designer-side-toggle-group designer-side-toggle-left" aria-label="Pannelli rapidi">
                  <button
                    type="button"
                    className="designer-side-toggle"
                    onClick={handleToggleCodePanel}
                    title={codePanelOpen ? "Chiudi codice ERS" : "Apri codice ERS"}
                  >
                    <span aria-hidden="true">{"<>"}</span>
                    Code
                  </button>
                  <button
                    type="button"
                    className={`designer-side-toggle designer-side-toggle-errors ${
                      issues.length > 0 ? "has-issues" : ""
                    }`}
                    onClick={() => setErrorsPanelOpen(true)}
                    title="Apri errori e warning"
                  >
                    <span aria-hidden="true">{issues.some((issue) => issue.level === "error") ? "X" : "!"}</span>
                    Errors
                  </button>
                </div>
                <button
                  type="button"
                  className="designer-side-toggle designer-side-toggle-right"
                  onClick={handleToggleNotesPanel}
                  title={notesPanelOpen ? "Chiudi note" : "Apri note"}
                >
                  <span aria-hidden="true">N</span>
                  {notesPanelOpen ? "Hide" : "Notes"}
                </button>

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
                  onSaveErs={handleSaveErs}
                  onOpenCardinality={handleOpenCardinalityControl}
                  onToggleSimpleIdentifier={handleToggleSimpleIdentifierFromSelection}
                  onOpenCompositeIdentifier={handleCreateCompositeIdentifierFromSelection}
                  onOpenMixedIdentifier={handleOpenMixedIdentifierModal}
                  onOpenExternalIdentifier={() => createExternalIdentifierFromContext({ mixed: false })}
                  onOpenInheritanceType={handleOpenInheritanceTypeControl}
                  onRemoveFromHierarchy={handleRemoveSelectedEntityFromHierarchy}
                  onRemoveExternalIdentifier={handleRemoveSelectedExternalIdentifier}
                  onToolChange={setTool}
                  onDuplicateSelection={handleDuplicateSelection}
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
                  issues={issues}
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
              onPreviewModel={previewLogicalModel}
              onCommitModel={commitLogicalModel}
              onRenameTable={handleLogicalTableRename}
              onRenameColumn={handleLogicalColumnRename}
              onUpdateColumnSql={handleLogicalColumnSqlUpdate}
              onMoveColumn={handleLogicalColumnMove}
            />
          )}
          {diagramView !== "er" && technicalPanelVisible ? (
            <button
              type="button"
              className="workspace-resizer workspace-resizer-active"
              onPointerDown={(event) =>
                handlePanelResizeStart(technicalPanelTab === "notes" ? "notes" : "code", event)
              }
              onDoubleClick={() => resetPanelWidth(technicalPanelTab === "notes" ? "notes" : "code")}
              aria-label="Ridimensiona dock tecnico"
              title="Trascina per ridimensionare il pannello tecnico"
            />
          ) : null}
          {diagramView !== "er" ? technicalDockPanel : null}
        </div>
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

      {commandMenuOpen ? (
        <CommandMenuModal
          appTitle={APP_TITLE}
          appVersion={APP_VERSION}
          diagramName={history.present.meta.name}
          diagramView={diagramView}
          logicalSqlOpen={logicalPanelMode === "sql"}
          technicalPanelOpen={technicalPanelVisible}
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
          onToggleReviewPanel={handleToggleReviewPanel}
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
            <div className="help-modal-head">
              <h2 id="errors-dialog-title">Errors</h2>
              <button type="button" className="help-close" onClick={() => setErrorsPanelOpen(false)}>
                Chiudi
              </button>
            </div>
            <div className="action-modal-content errors-modal-list">
              {issues.filter(issueTargetExists).length === 0 ? (
                <p>Nessun errore o warning nel diagramma.</p>
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
                    <strong>{issue.level === "error" ? "error" : "warning"}</strong>
                    <span>{getIssueElementLabel(issue)}</span>
                    <p>{issue.message}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {cardinalityDialog ? (
        <div className="help-modal-backdrop" role="presentation" onClick={() => setCardinalityDialog(null)}>
          <div
            className="help-modal action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cardinality-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-modal-head">
              <h2 id="cardinality-dialog-title">Cardinality</h2>
            </div>
            <form
              className="action-modal-content"
              onSubmit={(event) => {
                event.preventDefault();
                submitCardinalityDialog();
              }}
            >
              <div className="choice-grid">
                {CONNECTOR_CARDINALITY_PRESETS.map((preset) => (
                  <label key={preset} className="choice-tile">
                    <input
                      type="radio"
                      name="cardinality"
                      checked={cardinalityDialog.presetValue === preset}
                      onChange={() => setCardinalityDialog({ ...cardinalityDialog, presetValue: preset, error: "" })}
                    />
                    <span>{preset.slice(1, -1)}</span>
                  </label>
                ))}
                <label className="choice-tile">
                  <input
                    type="radio"
                    name="cardinality"
                    checked={cardinalityDialog.presetValue === "custom"}
                    onChange={() => setCardinalityDialog({ ...cardinalityDialog, presetValue: "custom", error: "" })}
                  />
                  <span>Custom</span>
                </label>
              </div>
              {cardinalityDialog.presetValue === "custom" ? (
                <label className="field action-modal-field">
                  <span>Formato X,Y</span>
                  <input
                    value={cardinalityDialog.customValue}
                    placeholder="0,N"
                    onChange={(event) =>
                      setCardinalityDialog({ ...cardinalityDialog, customValue: event.target.value, error: "" })
                    }
                  />
                </label>
              ) : null}
              {cardinalityDialog.error ? <p className="action-modal-error">{cardinalityDialog.error}</p> : null}
              <div className="action-modal-actions">
                <button type="button" className="header-button" onClick={() => setCardinalityDialog(null)}>
                  Annulla
                </button>
                <button type="submit" className="mode-button active">
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
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

      {inheritanceTypeDialog ? (
        <div className="help-modal-backdrop" role="presentation" onClick={() => setInheritanceTypeDialog(null)}>
          <div
            className="help-modal action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="isa-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="help-modal-head">
              <h2 id="isa-dialog-title">Type</h2>
            </div>
            <form
              className="action-modal-content"
              onSubmit={(event) => {
                event.preventDefault();
                submitInheritanceTypeDialog();
              }}
            >
              <div className="choice-grid">
                {(["t,e", "t,o", "p,e", "p,o"] as const).map((value) => (
                  <label key={value} className="choice-tile">
                    <input
                      type="radio"
                      name="isa-type"
                      checked={inheritanceTypeDialog.value === value}
                      onChange={() => setInheritanceTypeDialog({ ...inheritanceTypeDialog, value })}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
              <div className="action-modal-actions">
                <button type="button" className="header-button" onClick={() => setInheritanceTypeDialog(null)}>
                  Annulla
                </button>
                <button type="submit" className="mode-button active">
                  Salva
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

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
              <button type="button" className="help-close" onClick={() => setIntroOpen(false)}>
                Chiudi
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
                Chiudi
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
                  <li>Ctrl/Cmd+S salva il progetto `.ersp`, Ctrl/Cmd+D duplica selezione, Ctrl/Cmd+I apre o chiude il dock tecnico, Ctrl/Cmd+Z annulla, Ctrl/Cmd+Shift+Z o Ctrl/Cmd+Y ripete.</li>
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

      {whatsNewOpen ? (
        <div className="studio-modal-backdrop" role="presentation" onClick={() => setWhatsNewOpen(false)}>
          <div
            className="studio-modal studio-modal--medium changelog-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="studio-modal__header">
              <div>
                <h2 id="new-modal-title" className="studio-modal__title">Novita</h2>
                <p className="studio-modal__subtitle">Storico compatto delle release di {APP_NAME}.</p>
              </div>
              <button
                type="button"
                className="studio-modal__close"
                onClick={() => setWhatsNewOpen(false)}
                aria-label="Chiudi novita"
                autoFocus
              >
                Chiudi
              </button>
            </div>

            <div className="studio-modal__body changelog-content">
              {APP_CHANGELOG.map((entry) => (
                <article key={`${entry.version}-${entry.date}`} className="studio-modal__release changelog-entry">
                  <header>
                    <strong>{APP_NAME} {entry.version}</strong>
                    <span>{entry.date}</span>
                  </header>
                  <ul className="studio-modal__list-text help-list">
                    {entry.updates.map((update) => (
                      <li key={update}>{update}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}
