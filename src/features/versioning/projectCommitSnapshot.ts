import type { TechnicalPanelTab } from "../../components/TechnicalDockPanel";
import type { DiagramDocument, EditorMode, SelectionState, ToolKind, Viewport } from "../../types/diagram";
import type {
  ProjectExplorerProject,
  ProjectExplorerViewState,
  ProjectWorkspaceFile,
} from "../../types/projectExplorer";
import type {
  LogicalSelection,
  LogicalStage,
  LogicalTransformationState,
  LogicalWorkspaceDocument,
} from "../../types/logical";
import type { ErTranslationState, ErTranslationWorkspaceDocument, WorkspaceView } from "../../types/translation";
import {
  DEFAULT_CODE_PANEL_WIDTH,
  DEFAULT_NOTES_PANEL_WIDTH,
  DEFAULT_TOOLBAR_WIDTH,
  DEFAULT_VIEWPORT,
  isRecord,
  sanitizeLogicalSelectionState,
  sanitizeLogicalModel,
  sanitizeLogicalTranslationState,
  sanitizeSelectionState,
  sanitizeToolKind,
  sanitizeViewport,
} from "../workspace/workspaceSession";
import { createEmptyErTranslationWorkspace } from "../../utils/erTranslation";
import { createEmptyLogicalWorkspace } from "../../utils/logicalWorkspace";
import { parseDiagram } from "../../utils/diagram";

export interface ProjectCommitSnapshot {
  project?: ProjectExplorerProject;
  files?: Record<string, ProjectWorkspaceFile>;
  explorerView?: ProjectExplorerViewState;
  activeFileId?: string | null;
  activeWorkspace?: {
    diagramView: WorkspaceView;
    viewport: Viewport;
    translationViewport: Viewport;
    logicalViewport: Viewport;
    selection: SelectionState;
    translationSelection: SelectionState;
    logicalSelection: LogicalSelection;
    codeDraft: string;
    codeDirty: boolean;
    showDiagnostics: boolean;
  };
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
  workspaceInfo?: Record<string, unknown>;
}

export type ProjectCommitSnapshotInput = Omit<ProjectCommitSnapshot, "workspaceInfo"> & {
  workspaceInfo?: Record<string, unknown>;
};

export interface ProjectCommitStats {
  entityCount: number;
  relationshipCount: number;
  attributeCount: number;
  edgeCount: number;
  tableCount?: number;
  warningCount?: number;
  errorCount?: number;
}

export interface ProjectCommitTag {
  id: string;
  name: string;
  commitId: string;
  createdAt: string;
  description?: string;
  color?: string;
}

export interface ProjectVersioningSettings {
  maxCommits?: number;
  keepTaggedCommits?: boolean;
  includeAutomaticCommits?: boolean;
}

export interface ProjectCommit {
  id: string;
  parentId: string | null;
  message: string;
  description?: string;
  createdAt: string;
  author?: string;
  snapshot: ProjectCommitSnapshot;
  checksum: string;
  stats: ProjectCommitStats;
  tags?: string[];
  automatic?: boolean;
}

export interface ProjectVersioningState {
  version: number;
  enabled: boolean;
  headCommitId: string | null;
  commits: ProjectCommit[];
  tags: ProjectCommitTag[];
  settings: ProjectVersioningSettings;
}

export interface NormalizeProjectCommitSnapshotOptions {
  fallbackViewport?: Viewport;
}

export interface BuildProjectCommitDraftInput {
  id?: string;
  parentId: string | null;
  message: string;
  description?: string;
  createdAt?: string;
  author?: string;
  snapshot: ProjectCommitSnapshot;
  automatic?: boolean;
  tags?: string[];
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clonePlainRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? cloneJson(value) : undefined;
}

function sanitizeProjectExplorerProjectSnapshot(value: unknown): ProjectExplorerProject | undefined {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.rootId !== "string" || !Array.isArray(value.fileTree)) {
    return undefined;
  }

  return cloneJson(value) as unknown as ProjectExplorerProject;
}

function sanitizeProjectExplorerFilesSnapshot(value: unknown): Record<string, ProjectWorkspaceFile> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return cloneJson(value) as Record<string, ProjectWorkspaceFile>;
}

function sanitizeProjectExplorerViewSnapshot(value: unknown): ProjectExplorerViewState | undefined {
  if (!isRecord(value) || !Array.isArray(value.expandedFolderIds)) {
    return undefined;
  }

  return cloneJson(value) as unknown as ProjectExplorerViewState;
}

function normalizeSelection(value: unknown): SelectionState {
  const selection = sanitizeSelectionState(value);
  return {
    nodeIds: Array.from(new Set(selection.nodeIds)).sort(),
    edgeIds: Array.from(new Set(selection.edgeIds)).sort(),
  };
}

function sanitizeDiagramView(value: unknown, logicalGenerated: boolean): WorkspaceView {
  if (value === "translation") {
    return "translation";
  }

  if (value === "logical" && logicalGenerated) {
    return "logical";
  }

  return "er";
}

function sanitizeEditorMode(value: unknown): EditorMode {
  return value === "edit" ? "edit" : "edit";
}

function sanitizeTechnicalPanelTab(value: unknown): TechnicalPanelTab {
  return value === "code" || value === "notes" || value === "review" ? value : "review";
}

function sanitizePositiveNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

function sanitizeErTranslationState(value: unknown, fallback: ErTranslationState): ErTranslationState {
  if (!isRecord(value) || !isRecord(value.meta)) {
    return fallback;
  }

  const meta = value.meta;
  if (
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
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      sourceSignature: meta.sourceSignature,
    },
    decisions: cloneJson(value.decisions) as ErTranslationState["decisions"],
    mappings: cloneJson(value.mappings) as ErTranslationState["mappings"],
    conflicts: cloneJson(value.conflicts) as ErTranslationState["conflicts"],
  };
}

function sanitizeErTranslationWorkspaceSnapshot(
  value: unknown,
  diagram: DiagramDocument,
): ErTranslationWorkspaceDocument {
  const fallback = createEmptyErTranslationWorkspace(diagram);
  if (!isRecord(value)) {
    return fallback;
  }

  try {
    return {
      sourceDiagram: isRecord(value.sourceDiagram) ? parseDiagram(JSON.stringify(value.sourceDiagram)) : diagram,
      translatedDiagram: isRecord(value.translatedDiagram)
        ? parseDiagram(JSON.stringify(value.translatedDiagram))
        : diagram,
      translation: sanitizeErTranslationState(value.translation, fallback.translation),
    };
  } catch {
    return fallback;
  }
}

function sanitizeLogicalTransformationState(
  value: unknown,
  fallback: LogicalTransformationState,
): LogicalTransformationState {
  if (!isRecord(value) || !isRecord(value.meta) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return fallback;
  }

  const meta = value.meta;
  if (typeof meta.updatedAt !== "string" || typeof meta.sourceSignature !== "string") {
    return fallback;
  }

  return {
    meta: {
      updatedAt: meta.updatedAt,
      sourceSignature: meta.sourceSignature,
    },
    nodes: cloneJson(value.nodes) as LogicalTransformationState["nodes"],
    edges: cloneJson(value.edges) as LogicalTransformationState["edges"],
  };
}

function sanitizeLogicalWorkspaceSnapshot(
  value: unknown,
  translatedDiagram: DiagramDocument,
): LogicalWorkspaceDocument {
  const fallback = createEmptyLogicalWorkspace(translatedDiagram);
  if (!isRecord(value) || !isRecord(value.model)) {
    return fallback;
  }

  return {
    model: cloneJson(sanitizeLogicalModel(value.model)),
    translation: cloneJson(sanitizeLogicalTranslationState(value.translation, fallback.translation)),
    transformation: sanitizeLogicalTransformationState(value.transformation, fallback.transformation),
  };
}

function normalizeSnapshotRecord(
  value: Record<string, unknown>,
  fallbackViewport: Viewport,
): ProjectCommitSnapshot | null {
  try {
    const diagram = parseDiagram(JSON.stringify(value.diagram));
    const translationWorkspace = sanitizeErTranslationWorkspaceSnapshot(value.translationWorkspace, diagram);
    const logicalWorkspace = sanitizeLogicalWorkspaceSnapshot(
      value.logicalWorkspace,
      translationWorkspace.translatedDiagram,
    );
    const logicalGenerated = value.logicalGenerated === true;
    const logicalStage: LogicalStage = logicalGenerated && value.logicalStage === "schema" ? "schema" : "translation";
    const diagramView = sanitizeDiagramView(value.diagramView, logicalGenerated);

    const activeWorkspace = isRecord(value.activeWorkspace)
      ? {
          diagramView: sanitizeDiagramView(value.activeWorkspace.diagramView, logicalGenerated),
          viewport: sanitizeViewport(value.activeWorkspace.viewport, fallbackViewport),
          translationViewport: sanitizeViewport(value.activeWorkspace.translationViewport, fallbackViewport),
          logicalViewport: sanitizeViewport(value.activeWorkspace.logicalViewport, fallbackViewport),
          selection: normalizeSelection(value.activeWorkspace.selection),
          translationSelection: normalizeSelection(value.activeWorkspace.translationSelection),
          logicalSelection: sanitizeLogicalSelectionState(value.activeWorkspace.logicalSelection),
          codeDraft: typeof value.activeWorkspace.codeDraft === "string" ? value.activeWorkspace.codeDraft : "",
          codeDirty: value.activeWorkspace.codeDirty === true,
          showDiagnostics: typeof value.activeWorkspace.showDiagnostics === "boolean" ? value.activeWorkspace.showDiagnostics : true,
        }
      : undefined;

    return {
      project: sanitizeProjectExplorerProjectSnapshot(value.project),
      files: sanitizeProjectExplorerFilesSnapshot(value.files),
      explorerView: sanitizeProjectExplorerViewSnapshot(value.explorerView),
      activeFileId: typeof value.activeFileId === "string" || value.activeFileId === null ? value.activeFileId : undefined,
      activeWorkspace,
      diagram,
      translationWorkspace,
      logicalWorkspace,
      logicalGenerated,
      logicalStage,
      diagramView,
      tool: sanitizeToolKind(value.tool),
      mode: sanitizeEditorMode(value.mode),
      viewport: sanitizeViewport(value.viewport, fallbackViewport),
      selection: normalizeSelection(value.selection),
      translationViewport: sanitizeViewport(value.translationViewport, fallbackViewport),
      translationSelection: normalizeSelection(value.translationSelection),
      logicalViewport: sanitizeViewport(value.logicalViewport, fallbackViewport),
      logicalSelection: sanitizeLogicalSelectionState(value.logicalSelection),
      codeDraft: typeof value.codeDraft === "string" ? value.codeDraft : "",
      codeDirty: value.codeDirty === true,
      technicalPanelOpen: value.technicalPanelOpen === true,
      technicalPanelTab: sanitizeTechnicalPanelTab(value.technicalPanelTab),
      codePanelOpen: value.codePanelOpen === true,
      codePanelWidth: sanitizePositiveNumber(value.codePanelWidth, DEFAULT_CODE_PANEL_WIDTH),
      notesPanelOpen: value.notesPanelOpen === true,
      notesPanelWidth: sanitizePositiveNumber(value.notesPanelWidth, DEFAULT_NOTES_PANEL_WIDTH),
      toolbarCollapsed: value.toolbarCollapsed === true,
      focusMode: value.focusMode === true,
      toolbarWidth: sanitizePositiveNumber(value.toolbarWidth, DEFAULT_TOOLBAR_WIDTH),
      showDiagnostics: typeof value.showDiagnostics === "boolean" ? value.showDiagnostics : true,
      workspaceInfo: clonePlainRecord(value.workspaceInfo),
    };
  } catch {
    return null;
  }
}

export function normalizeProjectCommitSnapshot(
  value: unknown,
  options?: NormalizeProjectCommitSnapshotOptions,
): ProjectCommitSnapshot | null {
  if (!isRecord(value)) {
    return null;
  }

  return normalizeSnapshotRecord(value, options?.fallbackViewport ?? DEFAULT_VIEWPORT);
}

export function createProjectCommitSnapshot(input: ProjectCommitSnapshotInput): ProjectCommitSnapshot {
  const snapshot = normalizeProjectCommitSnapshot(input);
  if (!snapshot) {
    throw new Error("Invalid project commit snapshot input");
  }

  return snapshot;
}

export function cloneProjectCommitSnapshot(snapshot: ProjectCommitSnapshot): ProjectCommitSnapshot {
  const cloned = normalizeProjectCommitSnapshot(snapshot);
  if (!cloned) {
    throw new Error("Invalid project commit snapshot");
  }

  return cloned;
}

type StableJsonValue =
  | null
  | string
  | number
  | boolean
  | StableJsonValue[]
  | { [key: string]: StableJsonValue };

function toStableJsonValue(value: unknown): StableJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map(toStableJsonValue);
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .reduce<{ [key: string]: StableJsonValue }>((result, key) => {
        result[key] = toStableJsonValue(value[key]);
        return result;
      }, {});
  }

  return null;
}

export function stringifyProjectCommitSnapshot(snapshot: ProjectCommitSnapshot): string {
  return JSON.stringify(toStableJsonValue(cloneProjectCommitSnapshot(snapshot)));
}

function fallbackChecksum(text: string): string {
  let hash = 0x811c9dc5;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function calculateProjectCommitSnapshotChecksum(snapshot: ProjectCommitSnapshot): Promise<string> {
  const serialized = stringifyProjectCommitSnapshot(snapshot);
  const subtle = globalThis.crypto?.subtle;

  if (subtle) {
    const digest = await subtle.digest("SHA-256", new TextEncoder().encode(serialized));
    return bytesToHex(new Uint8Array(digest));
  }

  return fallbackChecksum(serialized);
}

export function areProjectCommitSnapshotsEqual(
  left: ProjectCommitSnapshot,
  right: ProjectCommitSnapshot,
): boolean {
  return stringifyProjectCommitSnapshot(left) === stringifyProjectCommitSnapshot(right);
}

export function buildProjectCommitStats(snapshot: ProjectCommitSnapshot): ProjectCommitStats {
  const normalized = cloneProjectCommitSnapshot(snapshot);
  const schemaFiles = normalized.files
    ? Object.values(normalized.files).filter((file): file is Extract<ProjectWorkspaceFile, { kind: "schema" }> => file.kind === "schema")
    : [];
  const diagrams = schemaFiles.length > 0 ? schemaFiles.map((file) => file.schema.diagram) : [normalized.diagram];
  const logicalWorkspaces = schemaFiles.length > 0
    ? schemaFiles.map((file) => file.schema.logicalWorkspace)
    : [normalized.logicalWorkspace];
  const warningCount = normalized.logicalWorkspace.model.issues.filter((issue) => issue.level === "warning").length;
  const errorCount = normalized.logicalWorkspace.model.issues.filter((issue) => issue.level === "error").length;

  return {
    entityCount: diagrams.reduce((count, diagram) => count + diagram.nodes.filter((node) => node.type === "entity").length, 0),
    relationshipCount: diagrams.reduce((count, diagram) => count + diagram.nodes.filter((node) => node.type === "relationship").length, 0),
    attributeCount: diagrams.reduce((count, diagram) => count + diagram.nodes.filter((node) => node.type === "attribute").length, 0),
    edgeCount: diagrams.reduce((count, diagram) => count + diagram.edges.length, 0),
    tableCount: logicalWorkspaces.reduce((count, workspace) => count + workspace.model.tables.length, 0),
    warningCount,
    errorCount,
  };
}

function createProjectCommitId(): string {
  if (globalThis.crypto && "randomUUID" in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return `commit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeTags(value: string[] | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  const tags = Array.from(new Set(value.filter((tag) => tag.trim().length > 0))).sort();
  return tags.length > 0 ? tags : undefined;
}

export async function buildProjectCommitDraft(input: BuildProjectCommitDraftInput): Promise<ProjectCommit> {
  const snapshot = cloneProjectCommitSnapshot(input.snapshot);

  return {
    id: input.id ?? createProjectCommitId(),
    parentId: input.parentId,
    message: input.message,
    description: input.description,
    createdAt: input.createdAt ?? new Date().toISOString(),
    author: input.author,
    snapshot,
    checksum: await calculateProjectCommitSnapshotChecksum(snapshot),
    stats: buildProjectCommitStats(snapshot),
    tags: normalizeTags(input.tags),
    automatic: input.automatic === true ? true : undefined,
  };
}
