import type { TechnicalPanelTab } from "../../components/TechnicalDockPanel";
import type { DiagramDocument, EditorMode, SelectionState, ToolKind, Viewport } from "../../types/diagram";
import { EMPTY_LOGICAL_SELECTION } from "../../types/logical";
import type {
  LogicalModel,
  LogicalSelection,
  LogicalStage,
  LogicalTranslationState,
  LogicalWorkspaceDocument,
} from "../../types/logical";
import type { ErTranslationState, ErTranslationWorkspaceDocument, WorkspaceView } from "../../types/translation";
import {
  createEmptyDiagram,
  parseDiagram,
  synchronizeNodeNameIdentity,
} from "../../utils/diagram";
import { serializeDiagramToErs } from "../../utils/ers";
import {
  createEmptyErTranslationWorkspace,
  refreshErTranslationWorkspace,
} from "../../utils/erTranslation";
import {
  createEmptyLogicalModel,
  createEmptyLogicalWorkspace,
  refreshLogicalWorkspace,
} from "../../utils/logicalWorkspace";
import {
  createEmptyProjectVersioningState,
  sanitizeProjectVersioningState,
  type ProjectVersioningState,
} from "../../utils/projectFile";

export const DEFAULT_VIEWPORT: Viewport = {
  x: 180,
  y: 110,
  zoom: 1,
};

export const INITIAL_WINDOW_WIDTH = typeof window === "undefined" ? 1440 : window.innerWidth;
export const DEFAULT_CODE_PANEL_WIDTH = clampValue(Math.round(INITIAL_WINDOW_WIDTH * 0.24), 330, 360);
export const DEFAULT_NOTES_PANEL_WIDTH = clampValue(Math.round(INITIAL_WINDOW_WIDTH * 0.22), 320, 360);
export const DEFAULT_TOOLBAR_WIDTH = INITIAL_WINDOW_WIDTH >= 1680 ? 220 : 208;
export const WORKSPACE_SESSION_STORAGE_KEY = "chen-er-diagram-studio:workspace-session-v4";
export const WORKSPACE_SESSION_SAVE_DEBOUNCE_MS = 420;

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

export interface WorkspaceSessionSnapshot {
  version: 5;
  savedAt: string;
  diagram: DiagramDocument;
  translationWorkspace: ErTranslationWorkspaceDocument;
  logicalWorkspace: LogicalWorkspaceDocument;
  logicalGenerated: boolean;
  logicalStage: LogicalStage;
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
  versioning: ProjectVersioningState;
}

export interface WorkspaceSessionBootstrap {
  diagram: DiagramDocument;
  translationWorkspace: ErTranslationWorkspaceDocument;
  logicalWorkspace: LogicalWorkspaceDocument;
  logicalGenerated: boolean;
  logicalStage: LogicalStage;
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
  versioning: ProjectVersioningState;
  restored: boolean;
}

interface WorkspaceSessionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function sanitizeViewport(value: unknown, fallback: Viewport): Viewport {
  if (!isRecord(value)) {
    return { ...fallback };
  }

  const x = typeof value.x === "number" && Number.isFinite(value.x) ? value.x : fallback.x;
  const y = typeof value.y === "number" && Number.isFinite(value.y) ? value.y : fallback.y;
  const zoom = typeof value.zoom === "number" && Number.isFinite(value.zoom) && value.zoom > 0 ? value.zoom : fallback.zoom;
  return { x, y, zoom };
}

export function sanitizeSelectionState(value: unknown): SelectionState {
  if (!isRecord(value)) {
    return { nodeIds: [], edgeIds: [] };
  }

  const nodeIds = Array.isArray(value.nodeIds)
    ? value.nodeIds.filter((nodeId): nodeId is string => typeof nodeId === "string")
    : [];
  const edgeIds = Array.isArray(value.edgeIds)
    ? value.edgeIds.filter((edgeId): edgeId is string => typeof edgeId === "string")
    : [];
  return { nodeIds, edgeIds };
}

export function sanitizeLogicalSelectionState(value: unknown): LogicalSelection {
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

export function sanitizeToolKind(value: unknown): ToolKind {
  if (typeof value === "string" && TOOL_KIND_VALUES.includes(value as ToolKind)) {
    return value as ToolKind;
  }

  return "select";
}

export function sanitizeLogicalModel(value: unknown): LogicalModel {
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

export function sanitizeErTranslationWorkspace(value: unknown, diagram: DiagramDocument): ErTranslationWorkspaceDocument {
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

export function sanitizeLogicalTranslationState(
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

export function sanitizeLogicalWorkspace(value: unknown, diagram: DiagramDocument): LogicalWorkspaceDocument {
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

export function createDefaultWorkspaceSessionBootstrap(): WorkspaceSessionBootstrap {
  const diagram = synchronizeNodeNameIdentity(createEmptyDiagram("Nuovo diagramma")).diagram;
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  return {
    diagram,
    translationWorkspace,
    logicalWorkspace: createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram),
    logicalGenerated: false,
    logicalStage: "translation",
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
    versioning: createEmptyProjectVersioningState(),
    restored: false,
  };
}

function getDefaultSessionStorage(): WorkspaceSessionStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function readWorkspaceSessionBootstrap(storage: WorkspaceSessionStorage | null = getDefaultSessionStorage()): WorkspaceSessionBootstrap {
  const fallback = createDefaultWorkspaceSessionBootstrap();
  if (!storage) {
    return fallback;
  }

  try {
    const raw = storage.getItem(WORKSPACE_SESSION_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (
      !isRecord(parsed) ||
      (parsed.version !== 1 &&
        parsed.version !== 2 &&
        parsed.version !== 3 &&
        parsed.version !== 4 &&
        parsed.version !== 5)
    ) {
      return fallback;
    }

    const storedDiagram = parseDiagram(JSON.stringify(parsed.diagram));
    const storedViewport = sanitizeViewport(parsed.viewport, DEFAULT_VIEWPORT);
    const storedTranslationViewport = sanitizeViewport(parsed.translationViewport, DEFAULT_VIEWPORT);
    const storedLogicalViewport = sanitizeViewport(parsed.logicalViewport, DEFAULT_VIEWPORT);
    const storedSelection = sanitizeSelectionState(parsed.selection);
    const storedTranslationSelection = sanitizeSelectionState(parsed.translationSelection);
    const storedLogicalSelection = sanitizeLogicalSelectionState(parsed.logicalSelection);
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
          : parsed.technicalPanelTab === "review"
            ? "review"
            : storedNotesPanelOpen
              ? "notes"
              : storedCodePanelOpen
                ? "code"
                : "review";
    const storedLegacyCodePanelOpen = parsed.technicalPanelOpen === true && storedTechnicalPanelTab === "code";
    const restoredNotesPanelOpen = storedNotesPanelOpen || (parsed.technicalPanelOpen === true && storedTechnicalPanelTab === "notes");
    const storedTechnicalPanelOpen =
      (parsed.technicalPanelOpen === true && storedTechnicalPanelTab !== "code") || restoredNotesPanelOpen;

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
      codePanelOpen: storedCodePanelOpen || storedLegacyCodePanelOpen,
      codePanelWidth:
        typeof parsed.codePanelWidth === "number" && Number.isFinite(parsed.codePanelWidth)
          ? parsed.codePanelWidth
          : fallback.codePanelWidth,
      notesPanelOpen: restoredNotesPanelOpen,
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
      versioning: sanitizeProjectVersioningState(parsed.versioning, { fallbackViewport: DEFAULT_VIEWPORT }),
      restored: true,
    };
  } catch {
    return fallback;
  }
}

export function serializeWorkspaceSessionSnapshot(
  snapshot: Omit<WorkspaceSessionSnapshot, "version" | "savedAt">,
): WorkspaceSessionSnapshot {
  return {
    version: 5,
    savedAt: new Date().toISOString(),
    ...snapshot,
  };
}

export function saveWorkspaceSessionSnapshot(
  snapshot: WorkspaceSessionSnapshot,
  storage: WorkspaceSessionStorage | null = getDefaultSessionStorage(),
): void {
  if (!storage) {
    return;
  }

  try {
    storage.setItem(WORKSPACE_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage errors and keep the app usable.
  }
}
