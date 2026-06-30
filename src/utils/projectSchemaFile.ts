import type { DiagramDocument, Viewport } from "../types/diagram";
import type { LogicalStage, LogicalWorkspaceDocument } from "../types/logical";
import type { ErTranslationWorkspaceDocument } from "../types/translation";
import { createEmptyErTranslationWorkspace, refreshErTranslationWorkspace } from "./erTranslation";
import { createEmptyLogicalWorkspace, refreshLogicalWorkspace } from "./logicalWorkspace";
import { parseDiagram, serializeDiagram } from "./diagram";
import type {
  ProjectFileViewState,
  ProjectFileWorkspaceState,
  ProjectVersioningState,
} from "./projectFile";

export const SCHEMA_FILE_EXTENSION = ".erschema";
export const SCHEMA_FILE_KIND = "er-studio-schema";
export const SCHEMA_FILE_MIME_TYPE = "application/json;charset=utf-8";
export const SCHEMA_FILE_ACCEPT = ".erschema,.json,application/json";
export const CURRENT_SCHEMA_FILE_VERSION = 1;

export interface SchemaFileDocument {
  version: typeof CURRENT_SCHEMA_FILE_VERSION;
  kind: typeof SCHEMA_FILE_KIND;
  savedAt: string;
  diagram: DiagramDocument;
  translationWorkspace: ErTranslationWorkspaceDocument;
  logicalWorkspace: LogicalWorkspaceDocument;
  logicalGenerated: boolean;
  logicalStage: LogicalStage;
  view: ProjectFileViewState;
  workspace: ProjectFileWorkspaceState;
  versioning?: ProjectVersioningState;
}

export interface SchemaFileState {
  diagram: DiagramDocument;
  translationWorkspace: ErTranslationWorkspaceDocument;
  logicalWorkspace: LogicalWorkspaceDocument;
  logicalGenerated: boolean;
  logicalStage: LogicalStage;
  diagramView: ProjectFileViewState["current"];
  viewport: Viewport;
  translationViewport: Viewport;
  logicalViewport: Viewport;
  workspace: ProjectFileWorkspaceState;
  versioning?: ProjectVersioningState;
  savedAt?: string;
}

export class SchemaFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SchemaFileError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneViewport(viewport: Viewport): Viewport {
  return { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
}

function sanitizeViewport(value: unknown, fallback: Viewport): Viewport {
  if (!isRecord(value)) {
    return cloneViewport(fallback);
  }

  return {
    x: typeof value.x === "number" && Number.isFinite(value.x) ? value.x : fallback.x,
    y: typeof value.y === "number" && Number.isFinite(value.y) ? value.y : fallback.y,
    zoom:
      typeof value.zoom === "number" && Number.isFinite(value.zoom) && value.zoom > 0
        ? value.zoom
        : fallback.zoom,
  };
}

function sanitizeView(value: unknown, fallbackViewport: Viewport): ProjectFileViewState {
  const candidate = isRecord(value) ? value : {};
  const current =
    candidate.current === "logical" || candidate.current === "translation" || candidate.current === "er"
      ? candidate.current
      : "er";

  return {
    current,
    logicalStage: candidate.logicalStage === "schema" ? "schema" : "translation",
    erViewport: sanitizeViewport(candidate.erViewport, fallbackViewport),
    translationViewport: sanitizeViewport(candidate.translationViewport, fallbackViewport),
    logicalViewport: sanitizeViewport(candidate.logicalViewport, fallbackViewport),
  };
}

function sanitizeWorkspace(value: unknown, diagram: DiagramDocument): ProjectFileWorkspaceState {
  const candidate = isRecord(value) ? value : {};
  return {
    tool:
      candidate.tool === "move" ||
      candidate.tool === "select" ||
      candidate.tool === "delete" ||
      candidate.tool === "entity" ||
      candidate.tool === "relationship" ||
      candidate.tool === "attribute" ||
      candidate.tool === "connector" ||
      candidate.tool === "inheritance"
        ? candidate.tool
        : "select",
    mode: "edit",
    selection: {
      nodeIds: isRecord(candidate.selection) && Array.isArray(candidate.selection.nodeIds)
        ? candidate.selection.nodeIds.filter((id): id is string => typeof id === "string")
        : [],
      edgeIds: isRecord(candidate.selection) && Array.isArray(candidate.selection.edgeIds)
        ? candidate.selection.edgeIds.filter((id): id is string => typeof id === "string")
        : [],
    },
    translationSelection: {
      nodeIds: isRecord(candidate.translationSelection) && Array.isArray(candidate.translationSelection.nodeIds)
        ? candidate.translationSelection.nodeIds.filter((id): id is string => typeof id === "string")
        : [],
      edgeIds: isRecord(candidate.translationSelection) && Array.isArray(candidate.translationSelection.edgeIds)
        ? candidate.translationSelection.edgeIds.filter((id): id is string => typeof id === "string")
        : [],
    },
    logicalSelection: {
      nodeId:
        isRecord(candidate.logicalSelection) && typeof candidate.logicalSelection.nodeId === "string"
          ? candidate.logicalSelection.nodeId
          : null,
      columnId:
        isRecord(candidate.logicalSelection) && typeof candidate.logicalSelection.columnId === "string"
          ? candidate.logicalSelection.columnId
          : null,
      edgeId:
        isRecord(candidate.logicalSelection) && typeof candidate.logicalSelection.edgeId === "string"
          ? candidate.logicalSelection.edgeId
          : null,
    },
    codeDraft: typeof candidate.codeDraft === "string" ? candidate.codeDraft : "",
    codeDirty: candidate.codeDirty === true,
    technicalPanelOpen: candidate.technicalPanelOpen === true,
    technicalPanelTab:
      candidate.technicalPanelTab === "notes" || candidate.technicalPanelTab === "code"
        ? candidate.technicalPanelTab
        : "review",
    codePanelOpen: candidate.codePanelOpen === true,
    codePanelWidth:
      typeof candidate.codePanelWidth === "number" && Number.isFinite(candidate.codePanelWidth)
        ? candidate.codePanelWidth
        : 330,
    notesPanelOpen: candidate.notesPanelOpen === true,
    notesPanelWidth:
      typeof candidate.notesPanelWidth === "number" && Number.isFinite(candidate.notesPanelWidth)
        ? candidate.notesPanelWidth
        : 320,
    toolbarCollapsed: candidate.toolbarCollapsed === true,
    focusMode: candidate.focusMode === true,
    toolbarWidth:
      typeof candidate.toolbarWidth === "number" && Number.isFinite(candidate.toolbarWidth)
        ? candidate.toolbarWidth
        : 208,
    showDiagnostics: typeof candidate.showDiagnostics === "boolean" ? candidate.showDiagnostics : true,
  };
}

export function createSchemaDocumentFromProjectState(state: SchemaFileState): SchemaFileDocument {
  const diagram = JSON.parse(serializeDiagram(state.diagram)) as DiagramDocument;
  const translationWorkspace = refreshErTranslationWorkspace(diagram, state.translationWorkspace);
  const logicalWorkspace = refreshLogicalWorkspace(translationWorkspace.translatedDiagram, state.logicalWorkspace);
  const logicalGenerated = state.logicalGenerated === true;
  const logicalStage = logicalGenerated && state.logicalStage === "schema" ? "schema" : "translation";

  return {
    version: CURRENT_SCHEMA_FILE_VERSION,
    kind: SCHEMA_FILE_KIND,
    savedAt: state.savedAt ?? new Date().toISOString(),
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage,
    view: {
      current: state.diagramView === "logical" && logicalGenerated ? "logical" : state.diagramView,
      logicalStage,
      erViewport: cloneViewport(state.viewport),
      translationViewport: cloneViewport(state.translationViewport),
      logicalViewport: cloneViewport(state.logicalViewport),
    },
    workspace: state.workspace,
    versioning: state.versioning,
  };
}

export function serializeSchemaFile(state: SchemaFileState | SchemaFileDocument): string {
  const document =
    isRecord(state) && state.kind === SCHEMA_FILE_KIND
      ? (state as SchemaFileDocument)
      : createSchemaDocumentFromProjectState(state as SchemaFileState);

  return JSON.stringify(document, null, 2);
}

export function parseSchemaFile(rawText: string, fallbackViewport: Viewport = { x: 0, y: 0, zoom: 1 }): SchemaFileDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new SchemaFileError("Invalid schema JSON.");
  }

  if (!isRecord(parsed) || parsed.kind !== SCHEMA_FILE_KIND || parsed.version !== CURRENT_SCHEMA_FILE_VERSION) {
    throw new SchemaFileError("Unsupported schema file.");
  }

  if (!isRecord(parsed.diagram)) {
    throw new SchemaFileError("Missing schema diagram.");
  }

  const diagram = parseDiagram(JSON.stringify(parsed.diagram));
  const translationWorkspace = isRecord(parsed.translationWorkspace)
    ? refreshErTranslationWorkspace(diagram, parsed.translationWorkspace as unknown as ErTranslationWorkspaceDocument)
    : createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = isRecord(parsed.logicalWorkspace)
    ? refreshLogicalWorkspace(translationWorkspace.translatedDiagram, parsed.logicalWorkspace as unknown as LogicalWorkspaceDocument)
    : createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  const view = sanitizeView(parsed.view, fallbackViewport);

  return {
    version: CURRENT_SCHEMA_FILE_VERSION,
    kind: SCHEMA_FILE_KIND,
    savedAt: typeof parsed.savedAt === "string" && parsed.savedAt.trim() ? parsed.savedAt : new Date().toISOString(),
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: parsed.logicalGenerated === true,
    logicalStage: parsed.logicalStage === "schema" || view.logicalStage === "schema" ? "schema" : "translation",
    view,
    workspace: sanitizeWorkspace(parsed.workspace, diagram),
    versioning: isRecord(parsed.versioning) ? (parsed.versioning as unknown as ProjectVersioningState) : undefined,
  };
}
