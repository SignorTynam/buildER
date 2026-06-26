import type { DiagramDocument, Viewport } from "../types/diagram";
import type { LogicalModel, LogicalStage, LogicalTranslationState, LogicalWorkspaceDocument } from "../types/logical";
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
import { createEmptyErTranslationWorkspace, refreshErTranslationWorkspace } from "./erTranslation";
import { createEmptyLogicalModel, createEmptyLogicalWorkspace, refreshLogicalWorkspace } from "./logicalWorkspace";

export const PROJECT_FILE_KIND = "er-studio-project";
export const PROJECT_FILE_EXTENSION = ".ersp";
export const PROJECT_FILE_MIME_TYPE = "application/json;charset=utf-8";
export const PROJECT_FILE_ACCEPT = ".ersp,.json,application/json";
export const CURRENT_PROJECT_FILE_VERSION = 5;
export const PROJECT_VERSIONING_STATE_VERSION = 1;
export const DEFAULT_PROJECT_VERSIONING_MAX_COMMITS = 200;

export type ProjectFileWorkspaceView = WorkspaceView;
export type ParsedProjectFileSource = "project-file" | "legacy-project-json" | "legacy-diagram-json";
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
}

export interface ProjectFileDocument {
  version: typeof CURRENT_PROJECT_FILE_VERSION;
  kind: typeof PROJECT_FILE_KIND;
  savedAt: string;
  diagram: DiagramDocument;
  translationWorkspace: ErTranslationWorkspaceDocument;
  logicalWorkspace: LogicalWorkspaceDocument;
  logicalGenerated: boolean;
  logicalStage?: LogicalStage;
  view: ProjectFileViewState;
  versioning: ProjectVersioningState;
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
  version: 2 | 3 | 4;
  kind: typeof PROJECT_FILE_KIND;
  savedAt?: unknown;
  diagram?: unknown;
  translationWorkspace?: unknown;
  logicalWorkspace?: unknown;
  logicalGenerated?: unknown;
  logicalStage?: unknown;
  view?: unknown;
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
  if (value !== CURRENT_PROJECT_FILE_VERSION && value !== 4 && value !== 3 && value !== 2) {
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

function sanitizeProjectVersioningState(value: unknown, options?: ParseProjectFileOptions): ProjectVersioningState {
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
): ProjectFileDocument {
  return {
    version: CURRENT_PROJECT_FILE_VERSION,
    kind: PROJECT_FILE_KIND,
    savedAt,
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage: logicalGenerated && logicalStage === "schema" ? "schema" : "translation",
    view: {
      ...view,
      logicalStage: logicalGenerated && logicalStage === "schema" ? "schema" : "translation",
    },
    versioning,
  };
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
  const document = createProjectFileDocument(
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    "translation",
    savedAt,
    view,
    versioning,
  );

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
    ),
    source: "legacy-project-json",
  };
}

function parseCurrentProjectFile(
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
  const document = createProjectFileDocument(
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    logicalStage,
    savedAt,
    view,
    versioning,
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
    ),
    source: "project-file",
  };
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
  const document = createProjectFileDocument(
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    "translation",
    savedAt,
    view,
    versioning,
  );

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
    looksLikeDiagramDocument(value.diagram) &&
    isRecord(value.translationWorkspace) &&
    isRecord(value.logicalWorkspace) &&
    isRecord(value.view) &&
    isRecord(value.view.erViewport) &&
    isRecord(value.view.translationViewport) &&
    isRecord(value.view.logicalViewport) &&
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
  const document = createProjectFileDocument(
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated,
    state.logicalStage,
    state.savedAt ?? new Date().toISOString(),
    view,
    versioning,
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
