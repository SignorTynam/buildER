import {
  areProjectCommitSnapshotsEqual,
  buildProjectCommitDraft,
  cloneProjectCommitSnapshot,
  type ProjectCommit,
  type ProjectCommitSnapshot,
  type ProjectVersioningState,
} from "./projectCommitSnapshot";

export const PROJECT_RESTORE_BACKUP_TAG = "auto-backup";
export const PROJECT_RESTORE_TAG = "auto-restore";

export interface RestoreProjectCommitOptions {
  author?: string;
  createdAt?: string;
  backupMessage?: string;
  backupDescription?: string;
  restoreMessage?: string;
  restoreDescription?: string;
  backupCommitId?: string;
  restoreCommitId?: string;
}

export type RestoreProjectCommitResult =
  | {
      status: "restored";
      versioning: ProjectVersioningState;
      targetCommit: ProjectCommit;
      backupCommit: ProjectCommit;
      restoreCommit: ProjectCommit;
    }
  | {
      status: "missing-commit";
      commitId: string;
    }
  | {
      status: "already-current";
      commit: ProjectCommit;
    }
  | {
      status: "invalid-snapshot";
    };

function getProjectCommit(versioning: ProjectVersioningState, commitId: string): ProjectCommit | null {
  return versioning.commits.find((commit) => commit.id === commitId) ?? null;
}

function shortCommitId(commitId: string): string {
  return commitId.slice(0, 8);
}

function cloneVersioningState(versioning: ProjectVersioningState): ProjectVersioningState {
  return {
    ...versioning,
    commits: versioning.commits.map((commit) => ({
      ...commit,
      snapshot: cloneProjectCommitSnapshot(commit.snapshot),
      stats: { ...commit.stats },
      tags: commit.tags ? [...commit.tags] : undefined,
    })),
    tags: versioning.tags.map((tag) => ({ ...tag })),
    settings: { ...versioning.settings },
  };
}

export async function restoreProjectCommitInState(
  versioning: ProjectVersioningState,
  targetCommitId: string,
  currentSnapshot: ProjectCommitSnapshot,
  options?: RestoreProjectCommitOptions,
): Promise<RestoreProjectCommitResult> {
  const clonedVersioning = cloneVersioningState(versioning);
  const targetCommit = getProjectCommit(clonedVersioning, targetCommitId);
  if (!targetCommit) {
    return { status: "missing-commit", commitId: targetCommitId };
  }

  let safeCurrentSnapshot: ProjectCommitSnapshot;
  let safeTargetSnapshot: ProjectCommitSnapshot;
  try {
    safeCurrentSnapshot = cloneProjectCommitSnapshot(currentSnapshot);
    safeTargetSnapshot = cloneProjectCommitSnapshot(targetCommit.snapshot);
  } catch {
    return { status: "invalid-snapshot" };
  }

  if (areProjectCommitSnapshotsEqual(safeCurrentSnapshot, safeTargetSnapshot)) {
    return { status: "already-current", commit: targetCommit };
  }

  const backupCommit = await buildProjectCommitDraft({
    id: options?.backupCommitId,
    parentId: clonedVersioning.headCommitId,
    message: options?.backupMessage ?? "Automatic backup before restore",
    description:
      options?.backupDescription ??
      `Current working copy before restoring commit ${shortCommitId(targetCommit.id)}.`,
    createdAt: options?.createdAt,
    author: options?.author,
    snapshot: safeCurrentSnapshot,
    automatic: true,
    tags: [PROJECT_RESTORE_BACKUP_TAG],
  });
  const restoreCommit = await buildProjectCommitDraft({
    id: options?.restoreCommitId,
    parentId: backupCommit.id,
    message: options?.restoreMessage ?? `Restore: ${targetCommit.message}`,
    description:
      options?.restoreDescription ??
      `Snapshot restored from commit ${shortCommitId(targetCommit.id)}.`,
    createdAt: options?.createdAt,
    author: options?.author,
    snapshot: safeTargetSnapshot,
    automatic: true,
    tags: [PROJECT_RESTORE_TAG],
  });

  return {
    status: "restored",
    targetCommit,
    backupCommit,
    restoreCommit,
    versioning: {
      ...clonedVersioning,
      commits: [...clonedVersioning.commits, backupCommit, restoreCommit],
      headCommitId: restoreCommit.id,
    },
  };
}
