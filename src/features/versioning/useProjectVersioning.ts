import { useMemo, useState } from "react";
import {
  areProjectCommitSnapshotsEqual,
  buildProjectCommitDraft,
  cloneProjectCommitSnapshot,
  stringifyProjectContentSnapshot,
  stringifyProjectFileContent,
  type ProjectCommit,
  type ProjectCommitSnapshot,
  type ProjectVersioningState,
} from "./projectCommitSnapshot";
import {
  restoreProjectCommitInState,
  type RestoreProjectCommitOptions,
  type RestoreProjectCommitResult,
} from "./projectVersionRestore";
import { createEmptyProjectVersioningState } from "../../utils/projectFile";
import type { ProjectWorkspaceFile } from "../../types/projectExplorer";

export interface CreateProjectCommitInput {
  snapshot: ProjectCommitSnapshot;
  message: string;
  description?: string;
  author?: string;
}

export type CreateProjectCommitResult =
  | {
      status: "created";
      commit: ProjectCommit;
      versioning: ProjectVersioningState;
    }
  | {
      status: "empty-message" | "unchanged";
    };

export type ProjectUncommittedChangeStatus = "no-head-empty" | "no-head-with-content" | "clean" | "dirty";

export interface ProjectUncommittedChangeCategories {
  project: boolean;
  files: boolean;
  folders: boolean;
  schemas: boolean;
  notes: boolean;
  sql: boolean;
  er: boolean;
  layout: boolean;
  logical: boolean;
  code: boolean;
  workspace: boolean;
  versioning: boolean;
}

export interface ProjectUncommittedChangeState {
  status: ProjectUncommittedChangeStatus;
  hasChanges: boolean;
  hasHead: boolean;
  headCommitId: string | null;
  categories: ProjectUncommittedChangeCategories;
  files: ProjectFileChange[];
  summary: {
    changedCategoryCount: number;
    canCommit: boolean;
  };
}

export type ProjectFileChangeStatus = "added" | "modified" | "deleted" | "renamed";

export interface ProjectFileChange {
  fileId: string;
  name: string;
  kind: ProjectWorkspaceFile["kind"];
  status: ProjectFileChangeStatus;
  previousName?: string;
}

export type DeleteProjectCommitResult =
  | {
      status: "deleted";
      versioning: ProjectVersioningState;
      deletedCommit: ProjectCommit;
    }
  | {
      status: "missing-commit";
      commitId: string;
    };

const EMPTY_CHANGE_CATEGORIES: ProjectUncommittedChangeCategories = {
  project: false,
  files: false,
  folders: false,
  schemas: false,
  notes: false,
  sql: false,
  er: false,
  layout: false,
  logical: false,
  code: false,
  workspace: false,
  versioning: false,
};

export function getProjectCommitById(
  versioning: ProjectVersioningState,
  commitId: string | null,
): ProjectCommit | null {
  if (!commitId) {
    return null;
  }

  return versioning.commits.find((commit) => commit.id === commitId) ?? null;
}

export function getProjectHeadCommit(versioning: ProjectVersioningState): ProjectCommit | null {
  return getProjectCommitById(versioning, versioning.headCommitId);
}

export function sortProjectCommitsNewestFirst(commits: ProjectCommit[]): ProjectCommit[] {
  return [...commits].sort((left, right) => {
    const byDate = Date.parse(right.createdAt) - Date.parse(left.createdAt);
    return byDate !== 0 ? byDate : right.id.localeCompare(left.id);
  });
}

export function hasProjectSnapshotSignificantContent(snapshot: ProjectCommitSnapshot): boolean {
  if (snapshot.project && snapshot.files) {
    return Object.keys(snapshot.files).length > 0 || snapshot.project.fileTree.length > 0;
  }

  return (
    snapshot.diagram.nodes.length > 0 ||
    snapshot.diagram.edges.length > 0 ||
    snapshot.diagram.notes.trim().length > 0 ||
    (snapshot.diagram.generalizationGroups?.length ?? 0) > 0 ||
    snapshot.translationWorkspace.translation.decisions.length > 0 ||
    snapshot.translationWorkspace.translation.mappings.length > 0 ||
    snapshot.translationWorkspace.translation.conflicts.length > 0 ||
    snapshot.logicalGenerated ||
    snapshot.logicalWorkspace.model.tables.length > 0 ||
    snapshot.logicalWorkspace.model.foreignKeys.length > 0 ||
    snapshot.logicalWorkspace.model.uniqueConstraints.length > 0 ||
    snapshot.logicalWorkspace.model.edges.length > 0 ||
    snapshot.logicalWorkspace.model.issues.length > 0 ||
    (snapshot.codeDirty && snapshot.codeDraft.trim().length > 0)
  );
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    return JSON.stringify(Number.isFinite(value) ? value : null);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }

  return "null";
}

function changed(left: unknown, right: unknown): boolean {
  return stableStringify(left) !== stableStringify(right);
}

function getDiagramErProjection(snapshot: ProjectCommitSnapshot) {
  return {
    meta: snapshot.diagram.meta,
    notes: snapshot.diagram.notes,
    nodes: snapshot.diagram.nodes.map((node) => {
      const { x, y, width, height, ...semanticNode } = node;
      return semanticNode;
    }),
    edges: snapshot.diagram.edges.map((edge) => {
      const { manualOffset, ...semanticEdge } = edge;
      return semanticEdge;
    }),
    generalizationGroups: snapshot.diagram.generalizationGroups ?? [],
  };
}

function getLayoutProjection(snapshot: ProjectCommitSnapshot) {
  return {
    nodes: snapshot.diagram.nodes.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
    })),
    edgeOffsets: snapshot.diagram.edges.map((edge) => ({
      id: edge.id,
      manualOffset: edge.manualOffset ?? null,
    })),
  };
}

function getLogicalProjection(snapshot: ProjectCommitSnapshot) {
  return {
    logicalWorkspace: snapshot.logicalWorkspace,
    logicalGenerated: snapshot.logicalGenerated,
    logicalStage: snapshot.logicalStage,
  };
}

function getCodeProjection(snapshot: ProjectCommitSnapshot) {
  return {
    codeDraft: snapshot.codeDraft,
    codeDirty: snapshot.codeDirty,
  };
}

function getWorkspaceProjection(snapshot: ProjectCommitSnapshot) {
  return {
    tool: snapshot.tool,
    mode: snapshot.mode,
    selection: snapshot.selection,
    translationSelection: snapshot.translationSelection,
    logicalSelection: snapshot.logicalSelection,
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

function getProjectMetadataProjection(snapshot: ProjectCommitSnapshot) {
  return {
    project: snapshot.project
      ? {
          id: snapshot.project.id,
          name: snapshot.project.name,
          rootId: snapshot.project.rootId,
        }
      : null,
  };
}

function getProjectFolderProjection(snapshot: ProjectCommitSnapshot) {
  return (snapshot.project?.fileTree ?? [])
    .filter((node) => node.kind === "folder")
    .map((node) => ({
      id: node.id,
      name: node.name,
      parentId: node.parentId,
      children: node.children ?? [],
    }));
}

function getProjectFileProjection(snapshot: ProjectCommitSnapshot) {
  return {
    tree: (snapshot.project?.fileTree ?? [])
      .filter((node) => node.kind !== "folder")
      .map((node) => ({
        id: node.id,
        name: node.name,
        kind: node.kind,
        parentId: node.parentId,
        fileId: node.fileId,
      })),
    fileIds: Object.keys(snapshot.files ?? {}).sort(),
  };
}

function getFilesByKindProjection(snapshot: ProjectCommitSnapshot, kind: "schema" | "text" | "sql") {
  return Object.values(snapshot.files ?? {})
    .filter((file) => file.kind === kind)
    .map((file) => stringifyProjectFileContent(file));
}

function getProjectWorkspaceProjection(snapshot: ProjectCommitSnapshot) {
  return {
    explorerView: snapshot.explorerView
      ? {
          expandedFolderIds: [...snapshot.explorerView.expandedFolderIds].sort(),
        }
      : undefined,
  };
}

function hasLogicalContent(snapshot: ProjectCommitSnapshot): boolean {
  return (
    snapshot.logicalGenerated ||
    snapshot.logicalWorkspace.model.tables.length > 0 ||
    snapshot.logicalWorkspace.model.foreignKeys.length > 0 ||
    snapshot.logicalWorkspace.model.uniqueConstraints.length > 0 ||
    snapshot.logicalWorkspace.model.edges.length > 0 ||
    snapshot.logicalWorkspace.model.issues.length > 0 ||
    snapshot.logicalWorkspace.translation.decisions.length > 0 ||
    snapshot.logicalWorkspace.translation.mappings.length > 0 ||
    snapshot.logicalWorkspace.translation.conflicts.length > 0
  );
}

function hasWorkspaceContent(snapshot: ProjectCommitSnapshot): boolean {
  return (
    snapshot.selection.nodeIds.length > 0 ||
    snapshot.selection.edgeIds.length > 0 ||
    snapshot.translationSelection.nodeIds.length > 0 ||
    snapshot.translationSelection.edgeIds.length > 0 ||
    snapshot.logicalSelection.nodeId !== null ||
    snapshot.logicalSelection.columnId !== null ||
    snapshot.logicalSelection.edgeId !== null ||
    snapshot.technicalPanelOpen ||
    snapshot.technicalPanelTab !== "review" ||
    snapshot.codePanelOpen ||
    snapshot.notesPanelOpen ||
    snapshot.toolbarCollapsed ||
    snapshot.focusMode ||
    !snapshot.showDiagnostics
  );
}

function getNoHeadCategories(snapshot: ProjectCommitSnapshot): ProjectUncommittedChangeCategories {
  if (snapshot.project && snapshot.files) {
    return {
      project: true,
      files: Object.keys(snapshot.files).length > 0,
      folders: (snapshot.project.fileTree ?? []).some((node) => node.kind === "folder"),
      schemas: Object.values(snapshot.files).some((file) => file.kind === "schema"),
      notes: Object.values(snapshot.files).some((file) => file.kind === "text" && file.content.trim().length > 0),
      sql: Object.values(snapshot.files).some((file) => file.kind === "sql" && file.content.trim().length > 0),
      er: true,
      layout: false,
      logical: Object.values(snapshot.files).some((file) => file.kind === "schema" && hasLogicalContent({
        ...snapshot,
        logicalGenerated: file.schema.logicalGenerated,
        logicalWorkspace: file.schema.logicalWorkspace,
      })),
      code: snapshot.codeDirty && snapshot.codeDraft.trim().length > 0,
      workspace: false,
      versioning: false,
    };
  }

  const er =
    snapshot.diagram.nodes.length > 0 ||
    snapshot.diagram.edges.length > 0 ||
    snapshot.diagram.notes.trim().length > 0 ||
    (snapshot.diagram.generalizationGroups?.length ?? 0) > 0;

  return {
    project: false,
    files: false,
    folders: false,
    schemas: false,
    notes: false,
    sql: false,
    er,
    layout: false,
    logical: hasLogicalContent(snapshot),
    code: snapshot.codeDirty && snapshot.codeDraft.trim().length > 0,
    workspace: false,
    versioning: false,
  };
}

function countChangedCategories(categories: ProjectUncommittedChangeCategories): number {
  return Object.values(categories).filter(Boolean).length;
}

export function getProjectUncommittedChangeState(
  versioning: ProjectVersioningState,
  currentSnapshot: ProjectCommitSnapshot | null,
): ProjectUncommittedChangeState {
  if (!currentSnapshot) {
    return {
      status: "no-head-empty",
      hasChanges: false,
      hasHead: false,
      headCommitId: null,
      categories: EMPTY_CHANGE_CATEGORIES,
      files: [],
      summary: {
        changedCategoryCount: 0,
        canCommit: false,
      },
    };
  }

  const headCommit = getProjectHeadCommit(versioning);
  if (!headCommit) {
    const hasContent = hasProjectSnapshotSignificantContent(currentSnapshot);
    const categories = hasContent ? getNoHeadCategories(currentSnapshot) : EMPTY_CHANGE_CATEGORIES;
    return {
      status: hasContent ? "no-head-with-content" : "no-head-empty",
      hasChanges: hasContent,
      hasHead: false,
      headCommitId: null,
      categories,
      files: getProjectFileChanges(versioning, currentSnapshot),
      summary: {
        changedCategoryCount: countChangedCategories(categories),
        canCommit: hasContent,
      },
    };
  }

  if (stringifyProjectContentSnapshot(currentSnapshot) === stringifyProjectContentSnapshot(headCommit.snapshot)) {
    return {
      status: "clean",
      hasChanges: false,
      hasHead: true,
      headCommitId: headCommit.id,
      categories: EMPTY_CHANGE_CATEGORIES,
      files: [],
      summary: {
        changedCategoryCount: 0,
        canCommit: false,
      },
    };
  }

  const categories: ProjectUncommittedChangeCategories = {
    project: changed(getProjectMetadataProjection(currentSnapshot), getProjectMetadataProjection(headCommit.snapshot)),
    files: changed(getProjectFileProjection(currentSnapshot), getProjectFileProjection(headCommit.snapshot)),
    folders: changed(getProjectFolderProjection(currentSnapshot), getProjectFolderProjection(headCommit.snapshot)),
    schemas: changed(getFilesByKindProjection(currentSnapshot, "schema"), getFilesByKindProjection(headCommit.snapshot, "schema")),
    notes: changed(getFilesByKindProjection(currentSnapshot, "text"), getFilesByKindProjection(headCommit.snapshot, "text")),
    sql: changed(getFilesByKindProjection(currentSnapshot, "sql"), getFilesByKindProjection(headCommit.snapshot, "sql")),
    er: changed(getDiagramErProjection(currentSnapshot), getDiagramErProjection(headCommit.snapshot)),
    layout: changed(getLayoutProjection(currentSnapshot), getLayoutProjection(headCommit.snapshot)),
    logical: changed(getLogicalProjection(currentSnapshot), getLogicalProjection(headCommit.snapshot)),
    code: changed(getCodeProjection(currentSnapshot), getCodeProjection(headCommit.snapshot)),
    workspace: false,
    versioning: false,
  };

  return {
    status: "dirty",
    hasChanges: true,
    hasHead: true,
    headCommitId: headCommit.id,
    categories,
    files: getProjectFileChanges(versioning, currentSnapshot),
    summary: {
      changedCategoryCount: countChangedCategories(categories),
      canCommit: true,
    },
  };
}

export function hasProjectUncommittedChanges(
  versioning: ProjectVersioningState,
  currentSnapshot: ProjectCommitSnapshot | null,
): boolean {
  return getProjectUncommittedChangeState(versioning, currentSnapshot).hasChanges;
}

export async function createProjectCommitInState(
  versioning: ProjectVersioningState,
  input: CreateProjectCommitInput,
): Promise<CreateProjectCommitResult> {
  const message = input.message.trim();
  if (!message) {
    return { status: "empty-message" };
  }

  const snapshot = cloneProjectCommitSnapshot(input.snapshot);
  const headCommit = getProjectHeadCommit(versioning);
  if (headCommit && areProjectCommitSnapshotsEqual(snapshot, headCommit.snapshot)) {
    return { status: "unchanged" };
  }

  const commit = await buildProjectCommitDraft({
    parentId: versioning.headCommitId,
    message,
    description: input.description?.trim() || undefined,
    author: input.author,
    snapshot,
    automatic: false,
    tags: [],
  });
  const nextVersioning: ProjectVersioningState = applyProjectCommitLimit({
    ...versioning,
    headCommitId: commit.id,
    commits: [...versioning.commits, commit],
  });

  return {
    status: "created",
    commit,
    versioning: nextVersioning,
  };
}

function getFileMap(snapshot: ProjectCommitSnapshot | null): Record<string, ProjectWorkspaceFile> {
  return snapshot?.files ?? {};
}

function getProjectTreeNodeMap(snapshot: ProjectCommitSnapshot | null) {
  return new Map((snapshot?.project?.fileTree ?? []).map((node) => [node.fileId ?? node.id, node]));
}

export function getProjectFileChanges(
  versioning: ProjectVersioningState,
  currentSnapshot: ProjectCommitSnapshot | null,
): ProjectFileChange[] {
  if (!currentSnapshot) {
    return [];
  }

  const headCommit = getProjectHeadCommit(versioning);
  const leftFiles = getFileMap(headCommit?.snapshot ?? null);
  const rightFiles = getFileMap(currentSnapshot);
  const leftNodes = getProjectTreeNodeMap(headCommit?.snapshot ?? null);
  const rightNodes = getProjectTreeNodeMap(currentSnapshot);
  const fileIds = Array.from(new Set([...Object.keys(leftFiles), ...Object.keys(rightFiles)])).sort((left, right) => {
    const leftName = rightFiles[left]?.name ?? leftFiles[left]?.name ?? left;
    const rightName = rightFiles[right]?.name ?? leftFiles[right]?.name ?? right;
    return leftName.localeCompare(rightName);
  });

  return fileIds.flatMap((fileId): ProjectFileChange[] => {
    const leftFile = leftFiles[fileId];
    const rightFile = rightFiles[fileId];

    if (!leftFile && rightFile) {
      return [{ fileId, name: rightFile.name, kind: rightFile.kind, status: "added" }];
    }

    if (leftFile && !rightFile) {
      return [{ fileId, name: leftFile.name, kind: leftFile.kind, status: "deleted" }];
    }

    if (!leftFile || !rightFile) {
      return [];
    }

    const leftSignature = stringifyProjectFileContent(leftFile);
    const rightSignature = stringifyProjectFileContent(rightFile);
    const leftNode = leftNodes.get(fileId);
    const rightNode = rightNodes.get(fileId);
    const renamed =
      leftFile.name !== rightFile.name ||
      (leftNode?.parentId ?? null) !== (rightNode?.parentId ?? null) ||
      (leftNode?.name ?? leftFile.name) !== (rightNode?.name ?? rightFile.name);

    if (leftSignature === rightSignature && !renamed) {
      return [];
    }

    return [
      {
        fileId,
        name: rightFile.name,
        kind: rightFile.kind,
        status: renamed && leftSignature === rightSignature ? "renamed" : "modified",
        previousName: renamed ? leftFile.name : undefined,
      },
    ];
  });
}

function getProtectedCommitIds(versioning: ProjectVersioningState): Set<string> {
  const protectedIds = new Set<string>();
  if (versioning.headCommitId) {
    protectedIds.add(versioning.headCommitId);
  }
  if (versioning.settings.keepTaggedCommits !== false) {
    versioning.tags.forEach((tag) => protectedIds.add(tag.commitId));
    versioning.commits.forEach((commit) => {
      if (commit.tags && commit.tags.length > 0) {
        protectedIds.add(commit.id);
      }
    });
  }
  return protectedIds;
}

function reparentAfterRemovingCommit(commits: ProjectCommit[], removed: ProjectCommit): ProjectCommit[] {
  return commits.map((commit) =>
    commit.parentId === removed.id
      ? {
          ...commit,
          parentId: removed.parentId,
        }
      : commit,
  );
}

function applyProjectCommitLimit(versioning: ProjectVersioningState): ProjectVersioningState {
  const maxCommits = versioning.settings.maxCommits;
  if (!maxCommits || versioning.commits.length <= maxCommits) {
    return versioning;
  }

  let commits = [...versioning.commits];
  const protectedIds = getProtectedCommitIds(versioning);
  const oldestFirst = [...commits].sort((left, right) => {
    const byDate = Date.parse(left.createdAt) - Date.parse(right.createdAt);
    return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
  });

  for (const candidate of oldestFirst) {
    if (commits.length <= maxCommits) {
      break;
    }
    if (protectedIds.has(candidate.id)) {
      continue;
    }
    commits = reparentAfterRemovingCommit(commits.filter((commit) => commit.id !== candidate.id), candidate);
  }

  const commitIds = new Set(commits.map((commit) => commit.id));
  return {
    ...versioning,
    commits,
    headCommitId: versioning.headCommitId && commitIds.has(versioning.headCommitId) ? versioning.headCommitId : null,
    tags: versioning.tags.filter((tag) => commitIds.has(tag.commitId)),
  };
}

export function deleteProjectCommitInState(
  versioning: ProjectVersioningState,
  commitId: string,
): DeleteProjectCommitResult {
  const deletedCommit = getProjectCommitById(versioning, commitId);
  if (!deletedCommit) {
    return { status: "missing-commit", commitId };
  }

  const commits = reparentAfterRemovingCommit(
    versioning.commits.filter((commit) => commit.id !== commitId),
    deletedCommit,
  );
  const commitIds = new Set(commits.map((commit) => commit.id));
  const nextHeadCommitId =
    versioning.headCommitId === commitId
      ? deletedCommit.parentId && commitIds.has(deletedCommit.parentId)
        ? deletedCommit.parentId
        : null
      : versioning.headCommitId && commitIds.has(versioning.headCommitId)
        ? versioning.headCommitId
        : null;

  return {
    status: "deleted",
    deletedCommit,
    versioning: {
      ...versioning,
      commits,
      headCommitId: nextHeadCommitId,
      tags: versioning.tags.filter((tag) => tag.commitId !== commitId && commitIds.has(tag.commitId)),
    },
  };
}

export function useProjectVersioning(initialVersioning?: ProjectVersioningState) {
  const [versioning, setVersioning] = useState<ProjectVersioningState>(
    () => initialVersioning ?? createEmptyProjectVersioningState(),
  );
  const commitsNewestFirst = useMemo(
    () => sortProjectCommitsNewestFirst(versioning.commits),
    [versioning.commits],
  );
  const headCommit = useMemo(() => getProjectHeadCommit(versioning), [versioning]);

  async function createCommit(input: CreateProjectCommitInput): Promise<CreateProjectCommitResult> {
    const result = await createProjectCommitInState(versioning, input);
    if (result.status === "created") {
      setVersioning(result.versioning);
    }

    return result;
  }

  async function restoreCommit(
    targetCommitId: string,
    currentSnapshot: ProjectCommitSnapshot,
    options?: RestoreProjectCommitOptions,
  ): Promise<RestoreProjectCommitResult> {
    const result = await restoreProjectCommitInState(versioning, targetCommitId, currentSnapshot, options);
    if (result.status === "restored") {
      setVersioning(result.versioning);
    }

    return result;
  }

  function deleteCommit(commitId: string): DeleteProjectCommitResult {
    const result = deleteProjectCommitInState(versioning, commitId);
    if (result.status === "deleted") {
      setVersioning(result.versioning);
    }

    return result;
  }

  return {
    versioning,
    setVersioning,
    commitsNewestFirst,
    headCommit,
    createCommit,
    restoreCommit,
    deleteCommit,
    getHeadCommit: () => getProjectHeadCommit(versioning),
    getCommitById: (commitId: string | null) => getProjectCommitById(versioning, commitId),
  };
}
