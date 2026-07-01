import type {
  ProjectExplorerNode,
  ProjectExplorerNodeKind,
  ProjectExplorerProject,
  ProjectExplorerViewState,
  ProjectSchemaWorkspaceFile,
  ProjectTextWorkspaceFile,
  ProjectWorkspaceFile,
} from "../types/projectExplorer";
import { createEmptyDiagram } from "./diagram";
import { createEmptyErTranslationWorkspace } from "./erTranslation";
import { createEmptyLogicalWorkspace } from "./logicalWorkspace";
import { serializeDiagramToErs } from "./ers";
import {
  CURRENT_SCHEMA_FILE_VERSION,
  SCHEMA_FILE_KIND,
  type SchemaFileDocument,
} from "./projectSchemaFile";
import type { ProjectFileWorkspaceState } from "./projectFile";
import {
  WELCOME_TAB_ID,
  closeTabsForDeletedFile,
  createWelcomeTab,
  ensureFileTabOpen,
  markProjectTabDirty,
  normalizeProjectTabs,
} from "./projectTabs";

export const DEFAULT_PROJECT_EXPLORER_WIDTH = 260;
export const MIN_PROJECT_EXPLORER_WIDTH = 200;
export const MAX_PROJECT_EXPLORER_WIDTH = 420;

export interface ProjectExplorerState {
  project: ProjectExplorerProject;
  files: Record<string, ProjectWorkspaceFile>;
  view: ProjectExplorerViewState;
}

export type ProjectExplorerOperationResult =
  | { ok: true; state: ProjectExplorerState; nodeId?: string; fileId?: string }
  | { ok: false; reason: "empty-name" | "duplicate-name" | "missing-parent" | "missing-node" | "root-delete" };

function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeProjectNodeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

export function stripKnownProjectExtension(name: string): string {
  return name.replace(/\.(erschema|ersp|ers|sql|txt)$/i, "").trim();
}

export function ensureProjectFileExtension(name: string, kind: ProjectExplorerNodeKind): string {
  const normalized = normalizeProjectNodeName(name);
  if (kind === "schema" && !/\.erschema$/i.test(normalized)) {
    return `${stripKnownProjectExtension(normalized) || "Schema"}.erschema`;
  }
  if (kind === "sql" && !/\.sql$/i.test(normalized)) {
    return `${stripKnownProjectExtension(normalized) || "Query"}.sql`;
  }
  if (kind === "text" && !/\.txt$/i.test(normalized)) {
    return `${stripKnownProjectExtension(normalized) || "File"}.txt`;
  }
  return normalized;
}

export function findProjectNode(project: ProjectExplorerProject, nodeId: string): ProjectExplorerNode | undefined {
  return project.fileTree.find((node) => node.id === nodeId);
}

export function getProjectNodeChildren(project: ProjectExplorerProject, parentId: string): ProjectExplorerNode[] {
  const parent = findProjectNode(project, parentId);
  const childIds = parent?.children ?? [];
  const byId = new Map(project.fileTree.map((node) => [node.id, node]));
  return childIds.map((id) => byId.get(id)).filter((node): node is ProjectExplorerNode => Boolean(node));
}

export function hasDuplicateProjectNodeName(
  project: ProjectExplorerProject,
  parentId: string | null,
  name: string,
  excludeNodeId?: string,
): boolean {
  const normalized = normalizeProjectNodeName(name).toLocaleLowerCase();
  return project.fileTree.some(
    (node) =>
      node.parentId === parentId &&
      node.id !== excludeNodeId &&
      normalizeProjectNodeName(node.name).toLocaleLowerCase() === normalized,
  );
}

export function getUniqueProjectNodeName(
  project: ProjectExplorerProject,
  parentId: string | null,
  requestedName: string,
): string {
  const normalized = normalizeProjectNodeName(requestedName);
  if (!normalized) {
    return "";
  }

  if (!hasDuplicateProjectNodeName(project, parentId, normalized)) {
    return normalized;
  }

  const extensionMatch = normalized.match(/(\.[^.]+)$/);
  const extension = extensionMatch?.[1] ?? "";
  const base = extension ? normalized.slice(0, -extension.length) : normalized;
  let suffix = 2;
  let candidate = `${base} ${suffix}${extension}`;
  while (hasDuplicateProjectNodeName(project, parentId, candidate)) {
    suffix += 1;
    candidate = `${base} ${suffix}${extension}`;
  }
  return candidate;
}

export function createFallbackWorkspaceState(schema: SchemaFileDocument): ProjectFileWorkspaceState {
  return {
    tool: "select",
    mode: "edit",
    selection: { nodeIds: [], edgeIds: [] },
    translationSelection: { nodeIds: [], edgeIds: [] },
    logicalSelection: { nodeId: null, columnId: null, edgeId: null },
    codeDraft: serializeDiagramToErs(schema.diagram),
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

export function createEmptySchemaDocument(name: string): SchemaFileDocument {
  const diagram = createEmptyDiagram(stripKnownProjectExtension(name) || "Schema");
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  const savedAt = new Date().toISOString();

  return {
    version: CURRENT_SCHEMA_FILE_VERSION,
    kind: SCHEMA_FILE_KIND,
    savedAt,
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: false,
    logicalStage: "translation",
    view: {
      current: "er",
      logicalStage: "translation",
      erViewport: { x: 180, y: 110, zoom: 1 },
      translationViewport: { x: 180, y: 110, zoom: 1 },
      logicalViewport: { x: 180, y: 110, zoom: 1 },
    },
    workspace: {
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
    },
  };
}

export function createSchemaWorkspaceFile(name: string, schema?: SchemaFileDocument): ProjectSchemaWorkspaceFile {
  const now = new Date().toISOString();
  const fileName = ensureProjectFileExtension(name, "schema");
  const schemaDocument = schema ?? createEmptySchemaDocument(fileName);
  return {
    id: createId("file"),
    name: fileName,
    kind: "schema",
    createdAt: now,
    updatedAt: now,
    schema: {
      ...schemaDocument,
      diagram: {
        ...schemaDocument.diagram,
        meta: {
          ...schemaDocument.diagram.meta,
          name: stripKnownProjectExtension(fileName) || schemaDocument.diagram.meta.name,
        },
      },
    },
  };
}

export function createTextWorkspaceFile(
  name: string,
  kind: Extract<ProjectExplorerNodeKind, "text" | "sql" | "unknown">,
  content = "",
): ProjectTextWorkspaceFile {
  const now = new Date().toISOString();
  const fileName = ensureProjectFileExtension(name, kind);
  return {
    id: createId("file"),
    name: fileName,
    kind,
    createdAt: now,
    updatedAt: now,
    content,
  };
}

export function createEmptyProjectExplorerState(name = "buildER Project"): ProjectExplorerState {
  const now = new Date().toISOString();
  const projectId = createId("project");
  const rootId = createId("folder");
  const projectName = normalizeProjectNodeName(name) || "buildER Project";
  const rootNode: ProjectExplorerNode = {
    id: rootId,
    name: projectName,
    kind: "folder",
    parentId: null,
    children: [],
    createdAt: now,
    updatedAt: now,
  };

  return {
    project: {
      id: projectId,
      name: projectName,
      rootId,
      activeFileId: null,
      fileTree: [rootNode],
    },
    files: {},
    view: {
      activeFileId: null,
      explorerOpen: true,
      explorerWidth: DEFAULT_PROJECT_EXPLORER_WIDTH,
      expandedFolderIds: [rootId],
      openTabs: [createWelcomeTab()],
      activeTabId: "welcome",
      selectedNodeId: rootId,
    },
  };
}

export function createProjectFromSchema(name: string, schema: SchemaFileDocument): ProjectExplorerState {
  const now = new Date().toISOString();
  const projectId = createId("project");
  const rootId = createId("folder");
  const schemaFile = createSchemaWorkspaceFile(`${schema.diagram.meta.name || "Main schema"}.erschema`, schema);
  const schemaNodeId = createId("node");
  const rootNode: ProjectExplorerNode = {
    id: rootId,
    name: normalizeProjectNodeName(name) || "buildER Project",
    kind: "folder",
    parentId: null,
    children: [schemaNodeId],
    createdAt: now,
    updatedAt: now,
  };
  const schemaNode: ProjectExplorerNode = {
    id: schemaNodeId,
    name: schemaFile.name,
    kind: "schema",
    parentId: rootId,
    fileId: schemaFile.id,
    createdAt: schemaFile.createdAt,
    updatedAt: schemaFile.updatedAt,
  };

  return ensureFileTabOpen({
    project: {
      id: projectId,
      name: rootNode.name,
      rootId,
      activeFileId: schemaFile.id,
      fileTree: [rootNode, schemaNode],
    },
    files: {
      [schemaFile.id]: schemaFile,
    },
    view: {
      activeFileId: schemaFile.id,
      explorerOpen: true,
      explorerWidth: DEFAULT_PROJECT_EXPLORER_WIDTH,
      expandedFolderIds: [rootId],
      openTabs: [],
      activeTabId: null,
      selectedNodeId: schemaNodeId,
    },
  }, schemaFile.id);
}

function updateNode(project: ProjectExplorerProject, nodeId: string, updater: (node: ProjectExplorerNode) => ProjectExplorerNode) {
  return {
    ...project,
    fileTree: project.fileTree.map((node) => (node.id === nodeId ? updater(node) : node)),
  };
}

export function addProjectFolder(state: ProjectExplorerState, parentId: string, requestedName: string): ProjectExplorerOperationResult {
  const parent = findProjectNode(state.project, parentId);
  if (!parent || parent.kind !== "folder") {
    return { ok: false, reason: "missing-parent" };
  }

  const name = normalizeProjectNodeName(requestedName);
  if (!name) {
    return { ok: false, reason: "empty-name" };
  }
  if (hasDuplicateProjectNodeName(state.project, parentId, name)) {
    return { ok: false, reason: "duplicate-name" };
  }

  const now = new Date().toISOString();
  const nodeId = createId("folder");
  const node: ProjectExplorerNode = {
    id: nodeId,
    name,
    kind: "folder",
    parentId,
    children: [],
    createdAt: now,
    updatedAt: now,
  };
  const projectWithParent = updateNode(state.project, parentId, (current) => ({
    ...current,
    children: [...(current.children ?? []), nodeId],
    updatedAt: now,
  }));

  return {
    ok: true,
    nodeId,
    state: {
      ...state,
      project: {
        ...projectWithParent,
        fileTree: [...projectWithParent.fileTree, node],
      },
      view: {
        ...state.view,
        expandedFolderIds: Array.from(new Set([...state.view.expandedFolderIds, parentId])),
      },
    },
  };
}

export function addProjectFile(
  state: ProjectExplorerState,
  parentId: string,
  file: ProjectWorkspaceFile,
): ProjectExplorerOperationResult {
  const parent = findProjectNode(state.project, parentId);
  if (!parent || parent.kind !== "folder") {
    return { ok: false, reason: "missing-parent" };
  }
  if (!normalizeProjectNodeName(file.name)) {
    return { ok: false, reason: "empty-name" };
  }
  if (hasDuplicateProjectNodeName(state.project, parentId, file.name)) {
    return { ok: false, reason: "duplicate-name" };
  }

  const now = new Date().toISOString();
  const nodeId = createId("node");
  const node: ProjectExplorerNode = {
    id: nodeId,
    name: file.name,
    kind: file.kind,
    parentId,
    fileId: file.id,
    createdAt: file.createdAt,
    updatedAt: file.updatedAt,
  };
  const projectWithParent = updateNode(state.project, parentId, (current) => ({
    ...current,
    children: [...(current.children ?? []), nodeId],
    updatedAt: now,
  }));

  return {
    ok: true,
    nodeId,
    fileId: file.id,
    state: {
      ...state,
      project: {
        ...projectWithParent,
        activeFileId: file.kind === "schema" ? file.id : state.project.activeFileId,
        fileTree: [...projectWithParent.fileTree, node],
      },
      files: {
        ...state.files,
        [file.id]: file,
      },
      view: {
        ...state.view,
        activeFileId: file.kind === "schema" ? file.id : state.view.activeFileId,
        expandedFolderIds: Array.from(new Set([...state.view.expandedFolderIds, parentId])),
        selectedNodeId: nodeId,
      },
    },
  };
}

export function renameProjectNode(
  state: ProjectExplorerState,
  nodeId: string,
  requestedName: string,
): ProjectExplorerOperationResult {
  const node = findProjectNode(state.project, nodeId);
  if (!node) {
    return { ok: false, reason: "missing-node" };
  }

  const name = node.kind === "folder"
    ? normalizeProjectNodeName(requestedName)
    : ensureProjectFileExtension(requestedName, node.kind);
  if (!name) {
    return { ok: false, reason: "empty-name" };
  }
  if (hasDuplicateProjectNodeName(state.project, node.parentId, name, nodeId)) {
    return { ok: false, reason: "duplicate-name" };
  }

  const now = new Date().toISOString();
  const files = { ...state.files };
  if (node.fileId && files[node.fileId]) {
    const file = files[node.fileId];
    files[node.fileId] =
      file.kind === "schema"
        ? {
            ...file,
            name,
            updatedAt: now,
            schema: {
              ...file.schema,
              diagram: {
                ...file.schema.diagram,
                meta: {
                  ...file.schema.diagram.meta,
                  name: stripKnownProjectExtension(name) || file.schema.diagram.meta.name,
                },
              },
            },
          }
        : { ...file, name, updatedAt: now };
  }

  const nextState = normalizeProjectTabs({
    ...state,
    project: updateNode(state.project, nodeId, (current) => ({ ...current, name, updatedAt: now })),
    files,
  });

  return {
    ok: true,
    state: node.fileId ? markProjectTabDirty(nextState, node.fileId, true) : nextState,
  };
}

function collectDescendantNodeIds(project: ProjectExplorerProject, nodeId: string): string[] {
  const node = findProjectNode(project, nodeId);
  if (!node) {
    return [];
  }

  return [
    nodeId,
    ...(node.children ?? []).flatMap((childId) => collectDescendantNodeIds(project, childId)),
  ];
}

export function deleteProjectNode(state: ProjectExplorerState, nodeId: string): ProjectExplorerOperationResult {
  if (nodeId === state.project.rootId) {
    return { ok: false, reason: "root-delete" };
  }

  const node = findProjectNode(state.project, nodeId);
  if (!node) {
    return { ok: false, reason: "missing-node" };
  }

  const deletedNodeIds = new Set(collectDescendantNodeIds(state.project, nodeId));
  const deletedFileIds = new Set(
    state.project.fileTree
      .filter((candidate) => deletedNodeIds.has(candidate.id) && candidate.fileId)
      .map((candidate) => candidate.fileId as string),
  );
  const files = Object.fromEntries(
    Object.entries(state.files).filter(([fileId]) => !deletedFileIds.has(fileId)),
  ) as Record<string, ProjectWorkspaceFile>;
  const now = new Date().toISOString();
  let project: ProjectExplorerProject = {
    ...state.project,
    fileTree: state.project.fileTree
      .filter((candidate) => !deletedNodeIds.has(candidate.id))
      .map((candidate) =>
        candidate.id === node.parentId
          ? {
              ...candidate,
              children: (candidate.children ?? []).filter((childId) => childId !== nodeId),
              updatedAt: now,
            }
          : candidate,
      ),
  };
  let view = {
    ...state.view,
    expandedFolderIds: state.view.expandedFolderIds.filter((id) => !deletedNodeIds.has(id)),
    selectedNodeId: deletedNodeIds.has(state.view.selectedNodeId ?? "") ? node.parentId ?? state.project.rootId : state.view.selectedNodeId,
  };

  const nextActiveFileId = deletedFileIds.has(state.project.activeFileId ?? "")
    ? null
    : state.project.activeFileId;

  project = {
    ...project,
    activeFileId: nextActiveFileId,
  };
  view = {
    ...view,
    activeFileId: nextActiveFileId,
  };

  let nextState = normalizeProjectTabs({ project, files, view });
  for (const fileId of deletedFileIds) {
    nextState = closeTabsForDeletedFile(nextState, fileId);
  }

  return {
    ok: true,
    state: nextState,
  };
}

export function setProjectActiveFile(state: ProjectExplorerState, fileId: string | null): ProjectExplorerState {
  const normalized = normalizeProjectTabs(state);
  const nextActiveTabId =
    fileId === null
      ? normalized.view.openTabs.some((tab) => tab.id === WELCOME_TAB_ID) ? WELCOME_TAB_ID : null
      : normalized.view.openTabs.find((tab) => tab.fileId === fileId)?.id ?? normalized.view.activeTabId;

  return {
    ...normalized,
    project: {
      ...normalized.project,
      activeFileId: fileId,
    },
    view: {
      ...normalized.view,
      activeFileId: fileId,
      activeTabId: nextActiveTabId,
    },
  };
}

export function setProjectExplorerExpandedFolders(
  state: ProjectExplorerState,
  expandedFolderIds: string[],
): ProjectExplorerState {
  return {
    ...state,
    view: {
      ...state.view,
      expandedFolderIds: Array.from(new Set(expandedFolderIds)),
    },
  };
}
