import type { TechnicalPanelTab } from "../components/TechnicalDockPanel";
import type { DiagramDocument, EditorMode, SelectionState, ToolKind, Viewport } from "../types/diagram";
import type {
  LogicalModel,
  LogicalSelection,
  LogicalStage,
  LogicalTranslationState,
  LogicalWorkspaceDocument,
} from "../types/logical";
import type { ErTranslationState, ErTranslationWorkspaceDocument, WorkspaceView } from "../types/translation";
import {
  buildProjectCommitStats,
  normalizeProjectCommitSnapshot,
} from "../features/versioning/projectCommitSnapshot";
import type {
  ProjectCommit,
  ProjectCommitSnapshot,
  ProjectCommitStats,
  ProjectCommitTag,
  ProjectVersioningSettings,
  ProjectVersioningState,
} from "../features/versioning/projectCommitSnapshot";
import { parseDiagram, serializeDiagram } from "./diagram";
import { serializeDiagramToErs } from "./ers";
import { createEmptyErTranslationWorkspace, refreshErTranslationWorkspace } from "./erTranslation";
import { createEmptyLogicalModel, createEmptyLogicalWorkspace, refreshLogicalWorkspace } from "./logicalWorkspace";
import type {
  ProjectExplorerProject,
  ProjectExplorerViewState,
  ProjectWorkspaceFile,
} from "../types/projectExplorer";
import {
  DEFAULT_PROJECT_EXPLORER_WIDTH,
  createEmptySchemaDocument,
  createProjectFromSchema,
  stripKnownProjectExtension,
  type ProjectExplorerState,
} from "./projectExplorer";
import {
  SCHEMA_FILE_KIND,
  createSchemaDocumentFromProjectState,
  parseSchemaFile,
  type SchemaFileDocument,
} from "./projectSchemaFile";
import { normalizeProjectTabs } from "./projectTabs";

export const PROJECT_FILE_KIND = "er-studio-project";
export const PROJECT_FILE_EXTENSION = ".ersp";
export const PROJECT_FILE_MIME_TYPE = "application/json;charset=utf-8";
export const PROJECT_FILE_ACCEPT = ".ersp,.json,application/json";
export const CURRENT_PROJECT_FILE_VERSION = 6;
export const PROJECT_VERSIONING_STATE_VERSION = 1;
export const DEFAULT_PROJECT_VERSIONING_MAX_COMMITS = 200;

export type ProjectFileWorkspaceView = WorkspaceView;
export type ParsedProjectFileSource =
  | "project-file"
  | "schema-file"
  | "legacy-project-json"
  | "legacy-diagram-json";
export type ProjectFileErrorCode =
  | "invalid-json"
  | "invalid-format"
  | "invalid-kind"
  | "unsupported-version"
  | "invalid-diagram"
  | "invalid-logical-workspace"
  | "invalid-view-state";

export interface ProjectFileViewState {
  current: ProjectFileWorkspaceView;
  logicalStage?: LogicalStage;
  erViewport: Viewport;
  translationViewport: Viewport;
  logicalViewport: Viewport;
}

export interface ProjectFileWorkspaceState {
  tool: ToolKind;
  mode: EditorMode;
  selection: SelectionState;
  translationSelection: SelectionState;
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

export type {
  BuildProjectCommitDraftInput,
  NormalizeProjectCommitSnapshotOptions,
  ProjectCommit,
  ProjectCommitSnapshot,
  ProjectCommitSnapshotInput,
  ProjectCommitStats,
  ProjectCommitTag,
  ProjectVersioningSettings,
  ProjectVersioningState,
} from "../features/versioning/projectCommitSnapshot";
export {
  areProjectCommitSnapshotsEqual,
  buildProjectCommitDraft,
  buildProjectCommitStats,
  calculateProjectCommitSnapshotChecksum,
  cloneProjectCommitSnapshot,
  createProjectCommitSnapshot,
  normalizeProjectCommitSnapshot,
} from "../features/versioning/projectCommitSnapshot";

export interface ProjectFileState {
  diagram: DiagramDocument;
  translationWorkspace: ErTranslationWorkspaceDocument;
  logicalWorkspace: LogicalWorkspaceDocument;
  logicalGenerated: boolean;
  logicalStage: LogicalStage;
  diagramView: ProjectFileWorkspaceView;
  viewport: Viewport;
  translationViewport: Viewport;
  logicalViewport: Viewport;
  savedAt?: string;
  versioning?: ProjectVersioningState;
  workspace?: ProjectFileWorkspaceState;
  project?: ProjectExplorerProject;
  files?: Record<string, ProjectWorkspaceFile>;
  explorerView?: ProjectExplorerViewState;
}

export interface ProjectFileDocument {
  version: typeof CURRENT_PROJECT_FILE_VERSION;
  kind: typeof PROJECT_FILE_KIND;
  savedAt: string;
  project: ProjectExplorerProject;
  files: Record<string, ProjectWorkspaceFile>;
  view: ProjectExplorerViewState & Partial<ProjectFileViewState>;
  workspace: ProjectFileWorkspaceState;
  versioning: ProjectVersioningState;
  diagram?: DiagramDocument;
  translationWorkspace?: ErTranslationWorkspaceDocument;
  logicalWorkspace?: LogicalWorkspaceDocument;
  logicalGenerated?: boolean;
  logicalStage?: LogicalStage;
}

export type ParsedProjectFileState = ProjectFileState & {
  versioning: ProjectVersioningState;
};

export interface ParsedProjectFile {
  document: ProjectFileDocument;
  state: ParsedProjectFileState;
  source: ParsedProjectFileSource;
}

export interface ParseProjectFileOptions {
  fallbackViewport?: Viewport;
  fallbackDiagramView?: ProjectFileWorkspaceView;
}

export interface ProjectFileErrorDetails {
  what: string;
  why: string;
  how: string;
}

export class ProjectFileError extends Error {
  readonly code: ProjectFileErrorCode;
  readonly details: ProjectFileErrorDetails;

  constructor(code: ProjectFileErrorCode, details: ProjectFileErrorDetails) {
    super(details.why);
    this.name = "ProjectFileError";
    this.code = code;
    this.details = details;
  }
}

type LegacyProjectFileDocument = {
  version: 2 | 3 | 4 | 5;
  kind: typeof PROJECT_FILE_KIND;
  savedAt?: unknown;
  diagram?: unknown;
  translationWorkspace?: unknown;
  logicalWorkspace?: unknown;
  logicalGenerated?: unknown;
  logicalStage?: unknown;
  view?: unknown;
  workspace?: unknown;
  versioning?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function cloneViewport(viewport: Viewport): Viewport {
  return { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
}

function getFallbackViewport(options?: ParseProjectFileOptions): Viewport {
  return cloneViewport(options?.fallbackViewport ?? { x: 0, y: 0, zoom: 1 });
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

function sanitizeDiagramView(value: unknown, fallback: ProjectFileWorkspaceView): ProjectFileWorkspaceView {
  if (value === "er" || value === "logical" || value === "translation") {
    return value;
  }

  return fallback;
}

function sanitizeNonEmptyString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function sanitizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function sanitizeNonNegativeInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : undefined;
}

function sanitizePositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function sanitizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return values.length > 0 ? Array.from(new Set(values)) : undefined;
}

function assertProjectFileRoot(value: unknown): asserts value is Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ProjectFileError("invalid-format", {
      what: "il file progetto non e stato caricato",
      why: "la radice JSON non contiene un oggetto progetto valido",
      how: "esporta di nuovo il progetto oppure verifica il contenuto del file",
    });
  }
}

function assertProjectKind(value: unknown): asserts value is typeof PROJECT_FILE_KIND {
  if (value !== PROJECT_FILE_KIND) {
    throw new ProjectFileError("invalid-kind", {
      what: "il file progetto non e stato caricato",
      why: `il campo kind non corrisponde a "${PROJECT_FILE_KIND}"`,
      how: "seleziona un file progetto buildER valido con estensione .ersp o un backup legacy compatibile",
    });
  }
}

function assertSupportedProjectVersion(
  value: unknown,
): asserts value is ProjectFileDocument["version"] | LegacyProjectFileDocument["version"] {
  if (value !== CURRENT_PROJECT_FILE_VERSION && value !== 5 && value !== 4 && value !== 3 && value !== 2) {
    throw new ProjectFileError("unsupported-version", {
      what: "il file progetto non e stato caricato",
      why: "la versione del formato progetto non e supportata",
      how: "aggiorna l'applicazione o esporta nuovamente il progetto in un formato compatibile",
    });
  }
}

function looksLikeDiagramDocument(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && Array.isArray(value.nodes) && Array.isArray(value.edges);
}

function assertDiagramPayload(value: unknown): asserts value is Record<string, unknown> {
  if (!looksLikeDiagramDocument(value)) {
    throw new ProjectFileError("invalid-diagram", {
      what: "il file progetto non e stato caricato",
      why: "la sezione diagram non contiene un diagramma ER valido",
      how: "verifica che il file includa il diagramma completo oppure riesporta il progetto",
    });
  }
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
    ...fallback,
    ...candidate,
    uniqueConstraints: Array.isArray(candidate.uniqueConstraints) ? candidate.uniqueConstraints : [],
  } as LogicalModel;
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

function sanitizeTranslationWorkspace(value: unknown, diagram: DiagramDocument): ErTranslationWorkspaceDocument {
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
      translatedDiagram: looksLikeDiagramDocument(value.translatedDiagram)
        ? parseDiagram(JSON.stringify(value.translatedDiagram))
        : diagram,
      translation: translation as ErTranslationState,
    });
  } catch {
    return fallback;
  }
}

function sanitizeLogicalWorkspace(value: unknown, translatedDiagram: DiagramDocument): LogicalWorkspaceDocument {
  const fallback = createEmptyLogicalWorkspace(translatedDiagram);
  if (!isRecord(value) || !isRecord(value.model)) {
    return fallback;
  }

  try {
    const translation = sanitizeLogicalTranslationState(value.translation, fallback.translation);
    return refreshLogicalWorkspace(translatedDiagram, {
      ...fallback,
      model: sanitizeLogicalModel(value.model),
      translation,
    });
  } catch {
    return fallback;
  }
}

export function createEmptyProjectVersioningState(): ProjectVersioningState {
  return {
    version: PROJECT_VERSIONING_STATE_VERSION,
    enabled: true,
    headCommitId: null,
    commits: [],
    tags: [],
    settings: {
      maxCommits: DEFAULT_PROJECT_VERSIONING_MAX_COMMITS,
      keepTaggedCommits: true,
      includeAutomaticCommits: false,
    },
  };
}

function sanitizeProjectCommitSnapshot(value: unknown, fallbackViewport: Viewport): ProjectCommitSnapshot | null {
  return normalizeProjectCommitSnapshot(value, { fallbackViewport });
}

function sanitizeProjectCommitStats(value: unknown, fallback: ProjectCommitStats): ProjectCommitStats {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    entityCount: sanitizeNonNegativeInteger(value.entityCount) ?? fallback.entityCount,
    relationshipCount: sanitizeNonNegativeInteger(value.relationshipCount) ?? fallback.relationshipCount,
    attributeCount: sanitizeNonNegativeInteger(value.attributeCount) ?? fallback.attributeCount,
    edgeCount: sanitizeNonNegativeInteger(value.edgeCount) ?? fallback.edgeCount,
    tableCount: sanitizeNonNegativeInteger(value.tableCount) ?? fallback.tableCount,
    warningCount: sanitizeNonNegativeInteger(value.warningCount) ?? fallback.warningCount,
    errorCount: sanitizeNonNegativeInteger(value.errorCount) ?? fallback.errorCount,
  };
}

function sanitizeProjectCommit(value: unknown, fallbackViewport: Viewport): ProjectCommit | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = sanitizeOptionalString(value.id);
  if (!id) {
    return null;
  }

  const snapshot = sanitizeProjectCommitSnapshot(value.snapshot, fallbackViewport);
  if (!snapshot) {
    return null;
  }

  const stats = sanitizeProjectCommitStats(value.stats, buildProjectCommitStats(snapshot));
  const tags = sanitizeStringList(value.tags);

  return {
    id,
    parentId: typeof value.parentId === "string" && value.parentId.trim().length > 0 ? value.parentId : null,
    message: typeof value.message === "string" ? value.message : "",
    description: sanitizeOptionalString(value.description),
    createdAt: sanitizeNonEmptyString(value.createdAt, new Date().toISOString()),
    author: sanitizeOptionalString(value.author),
    snapshot,
    checksum: sanitizeNonEmptyString(value.checksum, ""),
    stats,
    tags,
    automatic: value.automatic === true ? true : undefined,
  };
}

function sanitizeProjectCommitTag(value: unknown, commitIds: Set<string>): ProjectCommitTag | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = sanitizeOptionalString(value.id);
  const name = sanitizeOptionalString(value.name);
  const commitId = sanitizeOptionalString(value.commitId);
  if (!id || !name || !commitId || !commitIds.has(commitId)) {
    return null;
  }

  return {
    id,
    name,
    commitId,
    createdAt: sanitizeNonEmptyString(value.createdAt, new Date().toISOString()),
    description: sanitizeOptionalString(value.description),
    color: sanitizeOptionalString(value.color),
  };
}

function sanitizeProjectVersioningSettings(value: unknown): ProjectVersioningSettings {
  const fallback = createEmptyProjectVersioningState().settings;
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    maxCommits: sanitizePositiveInteger(value.maxCommits) ?? fallback.maxCommits,
    keepTaggedCommits:
      typeof value.keepTaggedCommits === "boolean" ? value.keepTaggedCommits : fallback.keepTaggedCommits,
    includeAutomaticCommits:
      typeof value.includeAutomaticCommits === "boolean"
        ? value.includeAutomaticCommits
        : fallback.includeAutomaticCommits,
  };
}

export function sanitizeProjectVersioningState(value: unknown, options?: ParseProjectFileOptions): ProjectVersioningState {
  const fallback = createEmptyProjectVersioningState();
  if (!isRecord(value)) {
    return fallback;
  }

  const fallbackViewport = getFallbackViewport(options);
  const parsedCommits = Array.isArray(value.commits)
    ? value.commits
        .map((commit) => sanitizeProjectCommit(commit, fallbackViewport))
        .filter((commit): commit is ProjectCommit => commit !== null)
    : [];
  const seenCommitIds = new Set<string>();
  const uniqueCommits = parsedCommits.filter((commit) => {
    if (seenCommitIds.has(commit.id)) {
      return false;
    }

    seenCommitIds.add(commit.id);
    return true;
  });
  const commitIds = new Set(uniqueCommits.map((commit) => commit.id));
  const commits = uniqueCommits.map((commit) => ({
    ...commit,
    parentId: commit.parentId && commitIds.has(commit.parentId) ? commit.parentId : null,
  }));
  const tags = Array.isArray(value.tags)
    ? value.tags
        .map((tag) => sanitizeProjectCommitTag(tag, commitIds))
        .filter((tag): tag is ProjectCommitTag => tag !== null)
    : [];
  const requestedHeadCommitId = sanitizeOptionalString(value.headCommitId);

  return {
    version:
      typeof value.version === "number" && Number.isInteger(value.version) && value.version > 0
        ? value.version
        : fallback.version,
    enabled: typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    headCommitId: requestedHeadCommitId && commitIds.has(requestedHeadCommitId) ? requestedHeadCommitId : null,
    commits,
    tags,
    settings: sanitizeProjectVersioningSettings(value.settings),
  };
}

function cloneProjectVersioningState(value: ProjectVersioningState | undefined): ProjectVersioningState {
  return sanitizeProjectVersioningState(value);
}

function pickProjectFileWorkspaceState(snapshot: ProjectCommitSnapshot): ProjectFileWorkspaceState {
  return {
    tool: snapshot.tool,
    mode: snapshot.mode,
    selection: snapshot.selection,
    translationSelection: snapshot.translationSelection,
    logicalSelection: snapshot.logicalSelection,
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

function createFallbackProjectFileWorkspaceState(diagram: DiagramDocument): ProjectFileWorkspaceState {
  return {
    tool: "select",
    mode: "edit",
    selection: { nodeIds: [], edgeIds: [] },
    translationSelection: { nodeIds: [], edgeIds: [] },
    logicalSelection: { nodeId: null, columnId: null, edgeId: null },
    codeDraft: serializeDiagramToErs(diagram),
    codeDirty: false,
    technicalPanelOpen: false,
    technicalPanelTab: "review",
    codePanelOpen: false,
    codePanelWidth: 330,
    notesPanelOpen: false,
    notesPanelWidth: 320,
    toolbarCollapsed: false,
    focusMode: false,
    toolbarWidth: 208,
    showDiagnostics: true,
  };
}

function sanitizeProjectFileWorkspaceState(
  value: unknown,
  context: {
    diagram: DiagramDocument;
    translationWorkspace: ErTranslationWorkspaceDocument;
    logicalWorkspace: LogicalWorkspaceDocument;
    logicalGenerated: boolean;
    logicalStage: LogicalStage;
    diagramView: ProjectFileWorkspaceView;
    view: ProjectFileViewState;
  },
): ProjectFileWorkspaceState {
  const fallback = createFallbackProjectFileWorkspaceState(context.diagram);
  const candidate = isRecord(value) ? value : {};
  const snapshot = normalizeProjectCommitSnapshot({
    diagram: context.diagram,
    translationWorkspace: context.translationWorkspace,
    logicalWorkspace: context.logicalWorkspace,
    logicalGenerated: context.logicalGenerated,
    logicalStage: context.logicalStage,
    diagramView: context.diagramView,
    viewport: context.view.erViewport,
    translationViewport: context.view.translationViewport,
    logicalViewport: context.view.logicalViewport,
    ...fallback,
    ...candidate,
  });

  return snapshot ? pickProjectFileWorkspaceState(snapshot) : fallback;
}

function sanitizeCurrentProjectView(
  value: unknown,
  options?: ParseProjectFileOptions,
): ProjectFileViewState {
  if (
    !isRecord(value) ||
    !isRecord(value.erViewport) ||
    !isRecord(value.translationViewport) ||
    !isRecord(value.logicalViewport)
  ) {
    throw new ProjectFileError("invalid-view-state", {
      what: "il file progetto non e stato caricato",
      why: "lo stato delle viste salvate non e completo",
      how: "riesporta il progetto da buildER oppure apri un backup integro",
    });
  }

  const fallbackViewport = getFallbackViewport(options);
  const fallbackDiagramView = options?.fallbackDiagramView ?? "er";
  return {
    current: sanitizeDiagramView(value.current, fallbackDiagramView),
    logicalStage: value.logicalStage === "schema" ? "schema" : "translation",
    erViewport: sanitizeViewport(value.erViewport, fallbackViewport),
    translationViewport: sanitizeViewport(value.translationViewport, fallbackViewport),
    logicalViewport: sanitizeViewport(value.logicalViewport, fallbackViewport),
  };
}

function normalizeProjectState(
  diagram: DiagramDocument,
  translationWorkspace: ErTranslationWorkspaceDocument,
  logicalWorkspace: LogicalWorkspaceDocument,
  logicalGenerated: boolean,
  logicalStage: LogicalStage,
  savedAt: string,
  view: ProjectFileViewState,
  versioning: ProjectVersioningState,
  workspace: ProjectFileWorkspaceState,
  projectState?: ProjectExplorerState,
): ParsedProjectFileState {
  const diagramView =
    view.current === "logical" && logicalGenerated
      ? "logical"
      : view.current === "translation"
        ? "translation"
        : "er";
  return {
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage: logicalGenerated && logicalStage === "schema" ? "schema" : "translation",
    diagramView,
    viewport: cloneViewport(view.erViewport),
    translationViewport: cloneViewport(view.translationViewport),
    logicalViewport: cloneViewport(view.logicalViewport),
    savedAt,
    versioning,
    workspace,
    project: projectState?.project,
    files: projectState?.files,
    explorerView: projectState?.view,
  };
}

function createProjectFileDocument(
  diagram: DiagramDocument,
  translationWorkspace: ErTranslationWorkspaceDocument,
  logicalWorkspace: LogicalWorkspaceDocument,
  logicalGenerated: boolean,
  logicalStage: LogicalStage,
  savedAt: string,
  view: ProjectFileViewState,
  versioning: ProjectVersioningState,
  workspace: ProjectFileWorkspaceState,
  projectState?: ProjectExplorerState,
): ProjectFileDocument {
  const schema = createSchemaDocumentFromProjectState({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage,
    diagramView: view.current,
    viewport: view.erViewport,
    translationViewport: view.translationViewport,
    logicalViewport: view.logicalViewport,
    workspace,
    versioning,
    savedAt,
  });
  const fallbackProjectState = createProjectFromSchema(diagram.meta.name || "buildER Project", schema);
  const resolvedProjectState = projectState ?? fallbackProjectState;
  const activeFileId = projectState
    ? (resolvedProjectState.project.activeFileId ?? resolvedProjectState.view.activeFileId ?? null)
    : (
        resolvedProjectState.project.activeFileId ??
        resolvedProjectState.view.activeFileId ??
        Object.values(resolvedProjectState.files).find((file) => file.kind === "schema")?.id ??
        null
      );
  const explorerView: ProjectExplorerViewState = {
    activeFileId,
    explorerOpen: resolvedProjectState.view.explorerOpen !== false,
    explorerWidth:
      typeof resolvedProjectState.view.explorerWidth === "number" && Number.isFinite(resolvedProjectState.view.explorerWidth)
        ? resolvedProjectState.view.explorerWidth
        : DEFAULT_PROJECT_EXPLORER_WIDTH,
    expandedFolderIds: Array.isArray(resolvedProjectState.view.expandedFolderIds)
      ? resolvedProjectState.view.expandedFolderIds
      : [resolvedProjectState.project.rootId],
    openTabs: Array.isArray(resolvedProjectState.view.openTabs) ? resolvedProjectState.view.openTabs : [],
    activeTabId:
      typeof resolvedProjectState.view.activeTabId === "string" ? resolvedProjectState.view.activeTabId : null,
    selectedNodeId:
      typeof resolvedProjectState.view.selectedNodeId === "string"
        ? resolvedProjectState.view.selectedNodeId
        : resolvedProjectState.project.rootId,
  };

  return {
    version: CURRENT_PROJECT_FILE_VERSION,
    kind: PROJECT_FILE_KIND,
    savedAt,
    project: {
      ...resolvedProjectState.project,
      activeFileId,
    },
    files: resolvedProjectState.files,
    view: {
      ...explorerView,
      current: view.current,
      logicalStage: logicalGenerated && logicalStage === "schema" ? "schema" : "translation",
      erViewport: view.erViewport,
      translationViewport: view.translationViewport,
      logicalViewport: view.logicalViewport,
    },
    workspace,
    versioning,
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage: logicalGenerated && logicalStage === "schema" ? "schema" : "translation",
  };
}

function projectStateFromDocument(document: ProjectFileDocument): ProjectExplorerState {
  return normalizeProjectTabs({
    project: document.project,
    files: document.files,
    view: {
      activeFileId: document.view.activeFileId,
      explorerOpen: document.view.explorerOpen !== false,
      explorerWidth:
        typeof document.view.explorerWidth === "number" && Number.isFinite(document.view.explorerWidth)
          ? document.view.explorerWidth
          : DEFAULT_PROJECT_EXPLORER_WIDTH,
      expandedFolderIds: Array.isArray(document.view.expandedFolderIds)
        ? document.view.expandedFolderIds
        : [document.project.rootId],
      openTabs: Array.isArray(document.view.openTabs) ? document.view.openTabs : [],
      activeTabId: typeof document.view.activeTabId === "string" ? document.view.activeTabId : null,
      selectedNodeId:
        typeof document.view.selectedNodeId === "string" ? document.view.selectedNodeId : document.project.rootId,
    },
  });
}

function parseLegacyProjectFile(
  value: LegacyProjectFileDocument,
  options?: ParseProjectFileOptions,
): ParsedProjectFile {
  assertDiagramPayload(value.diagram);
  const diagram = parseDiagram(JSON.stringify(value.diagram));
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  const logicalGenerated = false;
  const fallbackViewport = getFallbackViewport(options);
  const legacyCurrent =
    isRecord(value.view) && value.view.current === "logical"
      ? "translation"
      : options?.fallbackDiagramView === "logical"
        ? "translation"
        : options?.fallbackDiagramView === "translation"
          ? "translation"
          : "er";
  const view: ProjectFileViewState = {
    current: legacyCurrent,
    erViewport: cloneViewport(fallbackViewport),
    translationViewport: cloneViewport(fallbackViewport),
    logicalViewport: cloneViewport(fallbackViewport),
  };
  const savedAt =
    typeof value.savedAt === "string" && value.savedAt.trim().length > 0
      ? value.savedAt
      : new Date().toISOString();
  const versioning = createEmptyProjectVersioningState();
  const workspace = sanitizeProjectFileWorkspaceState(value.workspace, {
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage: "translation",
    diagramView: legacyCurrent,
    view,
  });
  const document = createProjectFileDocument(
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    "translation",
    savedAt,
    view,
    versioning,
    workspace,
  );
  const projectState = projectStateFromDocument(document);

  return {
    document,
    state: normalizeProjectState(
      diagram,
      translationWorkspace,
      logicalWorkspace,
      logicalGenerated,
      "translation",
      savedAt,
      view,
      versioning,
      workspace,
      projectState,
    ),
    source: "legacy-project-json",
  };
}

function parseSingleSchemaProjectFile(
  value: Record<string, unknown>,
  options?: ParseProjectFileOptions,
): ParsedProjectFile {
  assertDiagramPayload(value.diagram);
  const diagram = parseDiagram(JSON.stringify(value.diagram));
  const translationWorkspace = sanitizeTranslationWorkspace(value.translationWorkspace, diagram);
  const logicalWorkspace = sanitizeLogicalWorkspace(value.logicalWorkspace, translationWorkspace.translatedDiagram);
  const logicalGenerated = value.logicalGenerated === true;
  const view = sanitizeCurrentProjectView(value.view, options);
  const logicalStage =
    value.logicalStage === "schema" || view.logicalStage === "schema" ? "schema" : "translation";
  const savedAt =
    typeof value.savedAt === "string" && value.savedAt.trim().length > 0
      ? value.savedAt
      : new Date().toISOString();
  const versioning = sanitizeProjectVersioningState(value.versioning, options);
  const diagramView =
    view.current === "logical" && logicalGenerated
      ? "logical"
      : view.current === "translation"
        ? "translation"
        : "er";
  const workspace = sanitizeProjectFileWorkspaceState(value.workspace, {
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage,
    diagramView,
    view,
  });
  const document = createProjectFileDocument(
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage,
    savedAt,
    view,
    versioning,
    workspace,
  );
  const projectState = projectStateFromDocument(document);

  return {
    document,
    state: normalizeProjectState(
      diagram,
      translationWorkspace,
      logicalWorkspace,
      logicalGenerated,
      logicalStage,
      savedAt,
      view,
      versioning,
      workspace,
      projectState,
    ),
    source: value.version === 5 ? "legacy-project-json" : "project-file",
  };
}

function sanitizeProjectExplorerView(value: unknown, project: ProjectExplorerProject): ProjectExplorerViewState {
  const candidate = isRecord(value) ? value : {};
  const activeFileId =
    typeof candidate.activeFileId === "string" && candidate.activeFileId.trim().length > 0
      ? candidate.activeFileId
      : project.activeFileId;

  return {
    activeFileId,
    explorerOpen: candidate.explorerOpen !== false,
    explorerWidth:
      typeof candidate.explorerWidth === "number" && Number.isFinite(candidate.explorerWidth)
        ? candidate.explorerWidth
        : DEFAULT_PROJECT_EXPLORER_WIDTH,
    expandedFolderIds: Array.isArray(candidate.expandedFolderIds)
      ? candidate.expandedFolderIds.filter((id): id is string => typeof id === "string")
      : [project.rootId],
    openTabs: Array.isArray(candidate.openTabs)
      ? candidate.openTabs.filter((tab): tab is ProjectExplorerViewState["openTabs"][number] => isRecord(tab))
      : [],
    activeTabId:
      typeof candidate.activeTabId === "string" && candidate.activeTabId.trim().length > 0
        ? candidate.activeTabId
        : null,
    selectedNodeId:
      typeof candidate.selectedNodeId === "string" && candidate.selectedNodeId.trim().length > 0
        ? candidate.selectedNodeId
        : project.rootId,
  };
}

function parseMultiFileProjectFile(
  value: Record<string, unknown>,
  options?: ParseProjectFileOptions,
): ParsedProjectFile {
  if (!isRecord(value.project) || !Array.isArray(value.project.fileTree) || !isRecord(value.files)) {
    return parseSingleSchemaProjectFile(value, options);
  }

  const files = value.files as Record<string, ProjectWorkspaceFile>;
  const project: ProjectExplorerProject = {
    id: sanitizeNonEmptyString(value.project.id, "project"),
    name: sanitizeNonEmptyString(value.project.name, "buildER Project"),
    rootId: sanitizeNonEmptyString(value.project.rootId, "root"),
    activeFileId:
      typeof value.project.activeFileId === "string" && value.project.activeFileId.trim().length > 0
        ? value.project.activeFileId
        : null,
    fileTree: value.project.fileTree as ProjectExplorerProject["fileTree"],
  };
  const explorerView = sanitizeProjectExplorerView(value.view, project);
  const requestedActiveFileId = explorerView.activeFileId ?? project.activeFileId;
  const activeFile = requestedActiveFileId ? files[requestedActiveFileId] : undefined;
  const activeFileId = activeFile ? requestedActiveFileId : null;
  project.activeFileId = activeFileId;
  explorerView.activeFileId = activeFileId;

  const schemaFile =
    activeFile?.kind === "schema" && isRecord(activeFile.schema)
      ? (activeFile as Extract<ProjectWorkspaceFile, { kind: "schema" }>)
      : Object.values(files).find(
          (file): file is Extract<ProjectWorkspaceFile, { kind: "schema" }> =>
            file.kind === "schema" && isRecord(file.schema),
        );
  const schema = schemaFile?.schema ?? createEmptySchemaDocument(project.name || "buildER Project");
  const diagram = parseDiagram(JSON.stringify(schema.diagram));
  const translationWorkspace = sanitizeTranslationWorkspace(schema.translationWorkspace, diagram);
  const logicalWorkspace = sanitizeLogicalWorkspace(schema.logicalWorkspace, translationWorkspace.translatedDiagram);
  const logicalGenerated = schema.logicalGenerated === true;
  const view = sanitizeCurrentProjectView(isRecord(value.view) ? value.view : schema.view, options);
  const logicalStage =
    schema.logicalStage === "schema" || view.logicalStage === "schema" ? "schema" : "translation";
  const savedAt =
    typeof value.savedAt === "string" && value.savedAt.trim().length > 0
      ? value.savedAt
      : schema.savedAt;
  const versioning = sanitizeProjectVersioningState(value.versioning ?? schema.versioning, options);
  const diagramView =
    view.current === "logical" && logicalGenerated
      ? "logical"
      : view.current === "translation"
        ? "translation"
        : "er";
  const workspace = sanitizeProjectFileWorkspaceState(value.workspace ?? schema.workspace, {
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage,
    diagramView,
    view,
  });
  const projectState: ProjectExplorerState = normalizeProjectTabs({
    project: {
      ...project,
      activeFileId,
    },
    files,
    view: {
      ...explorerView,
      activeFileId,
    },
  });
  const document = createProjectFileDocument(
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage,
    savedAt,
    view,
    versioning,
    workspace,
    projectState,
  );

  return {
    document,
    state: normalizeProjectState(
      diagram,
      translationWorkspace,
      logicalWorkspace,
      logicalGenerated,
      logicalStage,
      savedAt,
      view,
      versioning,
      workspace,
      projectStateFromDocument(document),
    ),
    source: "project-file",
  };
}

function parseCurrentProjectFile(
  value: Record<string, unknown>,
  options?: ParseProjectFileOptions,
): ParsedProjectFile {
  if (value.version === CURRENT_PROJECT_FILE_VERSION && isRecord(value.project) && isRecord(value.files)) {
    return parseMultiFileProjectFile(value, options);
  }

  return parseSingleSchemaProjectFile(value, options);
}

function parseLegacyDiagramJson(rawText: string, options?: ParseProjectFileOptions): ParsedProjectFile {
  const diagram = parseDiagram(rawText);
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  const logicalGenerated = false;
  const savedAt = new Date().toISOString();
  const fallbackViewport = getFallbackViewport(options);
  const view: ProjectFileViewState = {
    current: options?.fallbackDiagramView === "logical" ? "translation" : options?.fallbackDiagramView ?? "er",
    erViewport: cloneViewport(fallbackViewport),
    translationViewport: cloneViewport(fallbackViewport),
    logicalViewport: cloneViewport(fallbackViewport),
  };
  const versioning = createEmptyProjectVersioningState();
  const workspace = sanitizeProjectFileWorkspaceState(undefined, {
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage: "translation",
    diagramView: view.current,
    view,
  });
  const document = createProjectFileDocument(
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    "translation",
    savedAt,
    view,
    versioning,
    workspace,
  );
  const projectState = projectStateFromDocument(document);

  return {
    document,
    state: normalizeProjectState(
      diagram,
      translationWorkspace,
      logicalWorkspace,
      logicalGenerated,
      "translation",
      savedAt,
      view,
      versioning,
      workspace,
      projectState,
    ),
    source: "legacy-diagram-json",
  };
}

export function isProjectFileDocument(value: unknown): value is ProjectFileDocument {
  return (
    isRecord(value) &&
    value.version === CURRENT_PROJECT_FILE_VERSION &&
    value.kind === PROJECT_FILE_KIND &&
    typeof value.savedAt === "string" &&
    isRecord(value.project) &&
    isRecord(value.files) &&
    Array.isArray(value.project.fileTree) &&
    isRecord(value.view) &&
    isRecord(value.workspace) &&
    isRecord(value.versioning)
  );
}

export function serializeProjectFile(state: ProjectFileState): string {
  const diagram = JSON.parse(serializeDiagram(state.diagram)) as DiagramDocument;
  const translationWorkspace = refreshErTranslationWorkspace(diagram, state.translationWorkspace);
  const logicalWorkspace = sanitizeLogicalWorkspace(state.logicalWorkspace, translationWorkspace.translatedDiagram);
  const logicalGenerated = state.logicalGenerated === true;
  const versioning = cloneProjectVersioningState(state.versioning);
  const view: ProjectFileViewState = {
    current:
      state.diagramView === "logical" && logicalGenerated
        ? "logical"
        : state.diagramView === "translation"
          ? "translation"
          : "er",
    logicalStage: logicalGenerated && state.logicalStage === "schema" ? "schema" : "translation",
    erViewport: cloneViewport(state.viewport),
    translationViewport: cloneViewport(state.translationViewport),
    logicalViewport: cloneViewport(state.logicalViewport),
  };
  const diagramView = view.current;
  const workspace = sanitizeProjectFileWorkspaceState(state.workspace, {
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage: view.logicalStage ?? "translation",
    diagramView,
    view,
  });
  const activeSchema = createSchemaDocumentFromProjectState({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage: state.logicalStage,
    diagramView,
    viewport: view.erViewport,
    translationViewport: view.translationViewport,
    logicalViewport: view.logicalViewport,
    workspace,
    savedAt: state.savedAt ?? new Date().toISOString(),
  });
  let projectState: ProjectExplorerState | undefined;
  if (state.project && state.files && state.explorerView) {
    const activeFileId = state.project.activeFileId ?? state.explorerView.activeFileId;
    const files = { ...state.files };
    if (activeFileId && files[activeFileId]?.kind === "schema") {
      const activeFile = files[activeFileId] as Extract<ProjectWorkspaceFile, { kind: "schema" }>;
      files[activeFileId] = {
        ...activeFile,
        name: activeFile.name,
        updatedAt: activeSchema.savedAt,
        schema: activeSchema,
      };
    }
    projectState = {
      project: {
        ...state.project,
        activeFileId: activeFileId ?? null,
      },
      files,
      view: {
        ...state.explorerView,
        activeFileId: activeFileId ?? null,
      },
    };
  }
  const document = createProjectFileDocument(
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    state.logicalStage,
    state.savedAt ?? new Date().toISOString(),
    view,
    versioning,
    workspace,
    projectState,
  );

  return JSON.stringify(document, null, 2);
}

export function parseProjectFile(rawText: string, options?: ParseProjectFileOptions): ParsedProjectFile {
  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawText) as unknown;
  } catch {
    throw new ProjectFileError("invalid-json", {
      what: "il file progetto non e stato caricato",
      why: "il contenuto non e un JSON valido",
      how: "verifica il file .ersp o .json legacy e riprova",
    });
  }

  assertProjectFileRoot(parsedJson);

  if ("kind" in parsedJson) {
    if (parsedJson.kind === SCHEMA_FILE_KIND) {
      const schema = parseSchemaFile(rawText, getFallbackViewport(options));
      const projectState = createProjectFromSchema(schema.diagram.meta.name || "buildER Project", schema);
      const view = sanitizeCurrentProjectView(schema.view, options);
      const versioning = sanitizeProjectVersioningState(schema.versioning, options);
      const document = createProjectFileDocument(
        schema.diagram,
        schema.translationWorkspace,
        schema.logicalWorkspace,
        schema.logicalGenerated,
        schema.logicalStage,
        schema.savedAt,
        view,
        versioning,
        schema.workspace,
        projectState,
      );
      return {
        document,
        state: normalizeProjectState(
          schema.diagram,
          schema.translationWorkspace,
          schema.logicalWorkspace,
          schema.logicalGenerated,
          schema.logicalStage,
          schema.savedAt,
          view,
          versioning,
          schema.workspace,
          projectStateFromDocument(document),
        ),
        source: "schema-file",
      };
    }

    assertProjectKind(parsedJson.kind);
    assertSupportedProjectVersion(parsedJson.version);

    if (parsedJson.version === 2 || parsedJson.version === 3) {
      return parseLegacyProjectFile(parsedJson as LegacyProjectFileDocument, options);
    }

    return parseCurrentProjectFile(parsedJson, options);
  }

  if (looksLikeDiagramDocument(parsedJson)) {
    return parseLegacyDiagramJson(rawText, options);
  }

  throw new ProjectFileError("invalid-format", {
    what: "il file progetto non e stato caricato",
    why: "il contenuto JSON non rappresenta ne un progetto buildER ne un diagramma legacy compatibile",
    how: "seleziona un file .ersp valido oppure un backup .json esportato da una versione precedente",
  });
}
