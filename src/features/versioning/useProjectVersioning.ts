import { useMemo, useState } from "react";
import {
  areProjectCommitSnapshotsEqual,
  buildProjectCommitDraft,
  cloneProjectCommitSnapshot,
  type ProjectCommit,
  type ProjectCommitSnapshot,
  type ProjectVersioningState,
} from "./projectCommitSnapshot";
import { createEmptyProjectVersioningState } from "../../utils/projectFile";

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

export function hasProjectUncommittedChanges(
  versioning: ProjectVersioningState,
  currentSnapshot: ProjectCommitSnapshot | null,
): boolean {
  if (!currentSnapshot) {
    return false;
  }

  const headCommit = getProjectHeadCommit(versioning);
  if (!headCommit) {
    return hasProjectSnapshotSignificantContent(currentSnapshot);
  }

  return !areProjectCommitSnapshotsEqual(currentSnapshot, headCommit.snapshot);
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
  const nextVersioning: ProjectVersioningState = {
    ...versioning,
    headCommitId: commit.id,
    commits: [...versioning.commits, commit],
  };

  return {
    status: "created",
    commit,
    versioning: nextVersioning,
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

  return {
    versioning,
    setVersioning,
    commitsNewestFirst,
    headCommit,
    createCommit,
    getHeadCommit: () => getProjectHeadCommit(versioning),
    getCommitById: (commitId: string | null) => getProjectCommitById(versioning, commitId),
  };
}
