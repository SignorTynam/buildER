import type { DiagramDocument, VersionDiagramHighlights } from "../../types/diagram";
import type { LogicalWorkspaceDocument, VersionLogicalHighlights } from "../../types/logical";
import { refreshErTranslationWorkspace } from "../../utils/erTranslation";
import {
  buildProjectVersionDiff,
  type ProjectVersionDiffItem,
  type ProjectVersionDiffResult,
} from "./projectVersionDiff";
import {
  cloneProjectCommitSnapshot,
  type ProjectCommit,
  type ProjectCommitSnapshot,
  type ProjectVersioningState,
} from "./projectCommitSnapshot";

export type VersionCompareRef =
  | { kind: "working-copy" }
  | { kind: "head" }
  | { kind: "commit"; commitId: string };

export type VersionCompareViewMode = "er" | "translation" | "logical";

export interface VersionCompareSideResolved {
  ref: VersionCompareRef;
  label: string;
  commitId?: string;
  createdAt?: string;
  snapshot: ProjectCommitSnapshot;
  readonly: true;
}

export interface VersionCompareHighlights {
  diagram: VersionDiagramHighlights;
  logical: VersionLogicalHighlights;
}

export interface VersionCompareVisualModel {
  diff: ProjectVersionDiffResult;
  left: VersionCompareSideResolved;
  right: VersionCompareSideResolved;
  highlights: {
    left: VersionCompareHighlights;
    right: VersionCompareHighlights;
  };
}

export type ResolveVersionCompareRefResult =
  | { status: "ok"; side: VersionCompareSideResolved }
  | { status: "missing-commit"; commitId: string }
  | { status: "missing-head" };

export type BuildVersionCompareVisualModelResult =
  | { status: "ok"; model: VersionCompareVisualModel }
  | { status: "missing-commit"; commitId: string }
  | { status: "missing-head" };

export type SnapshotViewPayload =
  | { mode: "er"; diagram: DiagramDocument }
  | { mode: "translation"; diagram: DiagramDocument }
  | { mode: "logical"; workspace: LogicalWorkspaceDocument };

const EMPTY_DIAGRAM_HIGHLIGHTS: VersionDiagramHighlights = {
  addedNodeIds: [],
  removedNodeIds: [],
  modifiedNodeIds: [],
  layoutNodeIds: [],
  addedEdgeIds: [],
  removedEdgeIds: [],
  modifiedEdgeIds: [],
  layoutEdgeIds: [],
  focusedNodeId: null,
  focusedEdgeId: null,
};

const EMPTY_LOGICAL_HIGHLIGHTS: VersionLogicalHighlights = {
  addedTableIds: [],
  removedTableIds: [],
  modifiedTableIds: [],
  addedColumnIds: [],
  removedColumnIds: [],
  modifiedColumnIds: [],
  addedForeignKeyIds: [],
  removedForeignKeyIds: [],
  modifiedForeignKeyIds: [],
  addedEdgeIds: [],
  removedEdgeIds: [],
  modifiedEdgeIds: [],
  focusedTableId: null,
  focusedColumnId: null,
  focusedForeignKeyId: null,
};

function cloneDiagramHighlights(highlights: VersionDiagramHighlights): VersionDiagramHighlights {
  return {
    addedNodeIds: [...highlights.addedNodeIds],
    removedNodeIds: [...highlights.removedNodeIds],
    modifiedNodeIds: [...highlights.modifiedNodeIds],
    layoutNodeIds: [...highlights.layoutNodeIds],
    addedEdgeIds: [...highlights.addedEdgeIds],
    removedEdgeIds: [...highlights.removedEdgeIds],
    modifiedEdgeIds: [...highlights.modifiedEdgeIds],
    layoutEdgeIds: [...highlights.layoutEdgeIds],
    focusedNodeId: highlights.focusedNodeId ?? null,
    focusedEdgeId: highlights.focusedEdgeId ?? null,
  };
}

function cloneLogicalHighlights(highlights: VersionLogicalHighlights): VersionLogicalHighlights {
  return {
    addedTableIds: [...highlights.addedTableIds],
    removedTableIds: [...highlights.removedTableIds],
    modifiedTableIds: [...highlights.modifiedTableIds],
    addedColumnIds: [...highlights.addedColumnIds],
    removedColumnIds: [...highlights.removedColumnIds],
    modifiedColumnIds: [...highlights.modifiedColumnIds],
    addedForeignKeyIds: [...highlights.addedForeignKeyIds],
    removedForeignKeyIds: [...highlights.removedForeignKeyIds],
    modifiedForeignKeyIds: [...highlights.modifiedForeignKeyIds],
    addedEdgeIds: [...highlights.addedEdgeIds],
    removedEdgeIds: [...highlights.removedEdgeIds],
    modifiedEdgeIds: [...highlights.modifiedEdgeIds],
    focusedTableId: highlights.focusedTableId ?? null,
    focusedColumnId: highlights.focusedColumnId ?? null,
    focusedForeignKeyId: highlights.focusedForeignKeyId ?? null,
  };
}

function findCommit(versioning: ProjectVersioningState, commitId: string): ProjectCommit | null {
  return versioning.commits.find((commit) => commit.id === commitId) ?? null;
}

function shortCommitId(commitId: string): string {
  return commitId.slice(0, 8);
}

function splitRenamedId(id: string, side: "left" | "right"): string {
  const separatorIndex = id.indexOf("->");
  if (separatorIndex < 0) {
    return id;
  }

  return side === "left" ? id.slice(0, separatorIndex) : id.slice(separatorIndex + 2);
}

function addUnique(target: Set<string>, value: string | null | undefined) {
  if (value && value.trim().length > 0) {
    target.add(value);
  }
}

function isDiagramNodeItem(item: ProjectVersionDiffItem): boolean {
  return item.path?.startsWith("diagram.nodes.") === true;
}

function isDiagramEdgeItem(item: ProjectVersionDiffItem): boolean {
  return item.path?.startsWith("diagram.edges.") === true;
}

function isLayoutNodeItem(item: ProjectVersionDiffItem): boolean {
  return item.kind === "node-position" || item.kind === "node-size" || item.kind === "node-layout";
}

function isLayoutEdgeItem(item: ProjectVersionDiffItem): boolean {
  return item.kind === "edge-offset";
}

function columnIdFromItemId(itemId: string): string {
  return itemId;
}

function createDiagramHighlights(input: {
  addedNodeIds?: Set<string>;
  removedNodeIds?: Set<string>;
  modifiedNodeIds?: Set<string>;
  layoutNodeIds?: Set<string>;
  addedEdgeIds?: Set<string>;
  removedEdgeIds?: Set<string>;
  modifiedEdgeIds?: Set<string>;
  layoutEdgeIds?: Set<string>;
}): VersionDiagramHighlights {
  return {
    ...cloneDiagramHighlights(EMPTY_DIAGRAM_HIGHLIGHTS),
    addedNodeIds: [...(input.addedNodeIds ?? new Set<string>())],
    removedNodeIds: [...(input.removedNodeIds ?? new Set<string>())],
    modifiedNodeIds: [...(input.modifiedNodeIds ?? new Set<string>())],
    layoutNodeIds: [...(input.layoutNodeIds ?? new Set<string>())],
    addedEdgeIds: [...(input.addedEdgeIds ?? new Set<string>())],
    removedEdgeIds: [...(input.removedEdgeIds ?? new Set<string>())],
    modifiedEdgeIds: [...(input.modifiedEdgeIds ?? new Set<string>())],
    layoutEdgeIds: [...(input.layoutEdgeIds ?? new Set<string>())],
  };
}

function createLogicalHighlights(input: {
  addedTableIds?: Set<string>;
  removedTableIds?: Set<string>;
  modifiedTableIds?: Set<string>;
  addedColumnIds?: Set<string>;
  removedColumnIds?: Set<string>;
  modifiedColumnIds?: Set<string>;
  addedForeignKeyIds?: Set<string>;
  removedForeignKeyIds?: Set<string>;
  modifiedForeignKeyIds?: Set<string>;
  addedEdgeIds?: Set<string>;
  removedEdgeIds?: Set<string>;
  modifiedEdgeIds?: Set<string>;
}): VersionLogicalHighlights {
  return {
    ...cloneLogicalHighlights(EMPTY_LOGICAL_HIGHLIGHTS),
    addedTableIds: [...(input.addedTableIds ?? new Set<string>())],
    removedTableIds: [...(input.removedTableIds ?? new Set<string>())],
    modifiedTableIds: [...(input.modifiedTableIds ?? new Set<string>())],
    addedColumnIds: [...(input.addedColumnIds ?? new Set<string>())],
    removedColumnIds: [...(input.removedColumnIds ?? new Set<string>())],
    modifiedColumnIds: [...(input.modifiedColumnIds ?? new Set<string>())],
    addedForeignKeyIds: [...(input.addedForeignKeyIds ?? new Set<string>())],
    removedForeignKeyIds: [...(input.removedForeignKeyIds ?? new Set<string>())],
    modifiedForeignKeyIds: [...(input.modifiedForeignKeyIds ?? new Set<string>())],
    addedEdgeIds: [...(input.addedEdgeIds ?? new Set<string>())],
    removedEdgeIds: [...(input.removedEdgeIds ?? new Set<string>())],
    modifiedEdgeIds: [...(input.modifiedEdgeIds ?? new Set<string>())],
  };
}

export function resolveVersionCompareRef(
  versioning: ProjectVersioningState,
  currentSnapshot: ProjectCommitSnapshot,
  ref: VersionCompareRef,
): ResolveVersionCompareRefResult {
  if (ref.kind === "working-copy") {
    return {
      status: "ok",
      side: {
        ref,
        label: "Working copy",
        snapshot: cloneProjectCommitSnapshot(currentSnapshot),
        readonly: true,
      },
    };
  }

  const commitId = ref.kind === "head" ? versioning.headCommitId : ref.commitId;
  if (!commitId) {
    return ref.kind === "head" ? { status: "missing-head" } : { status: "missing-commit", commitId: ref.commitId };
  }

  const commit = findCommit(versioning, commitId);
  if (!commit) {
    return { status: "missing-commit", commitId };
  }

  return {
    status: "ok",
    side: {
      ref,
      label: ref.kind === "head" ? `HEAD ${shortCommitId(commit.id)}` : commit.message,
      commitId: commit.id,
      createdAt: commit.createdAt,
      snapshot: cloneProjectCommitSnapshot(commit.snapshot),
      readonly: true,
    },
  };
}

export function buildDiagramVersionHighlights(
  diff: ProjectVersionDiffResult,
  side: "left" | "right",
): VersionDiagramHighlights {
  const addedNodeIds = new Set<string>();
  const removedNodeIds = new Set<string>();
  const modifiedNodeIds = new Set<string>();
  const layoutNodeIds = new Set<string>();
  const addedEdgeIds = new Set<string>();
  const removedEdgeIds = new Set<string>();
  const modifiedEdgeIds = new Set<string>();
  const layoutEdgeIds = new Set<string>();
  const er = diff.sections.er;
  const layout = diff.sections.layout;

  if (side === "right") {
    er.added.forEach((item) => {
      if (isDiagramNodeItem(item)) addUnique(addedNodeIds, item.id);
      if (isDiagramEdgeItem(item)) addUnique(addedEdgeIds, item.id);
    });
  } else {
    er.removed.forEach((item) => {
      if (isDiagramNodeItem(item)) addUnique(removedNodeIds, item.id);
      if (isDiagramEdgeItem(item)) addUnique(removedEdgeIds, item.id);
    });
  }

  er.modified.forEach((item) => {
    const id = splitRenamedId(item.id, side);
    if (isDiagramNodeItem(item)) addUnique(modifiedNodeIds, id);
    if (isDiagramEdgeItem(item)) addUnique(modifiedEdgeIds, id);
  });
  layout.modified.forEach((item) => {
    if (isLayoutNodeItem(item)) addUnique(layoutNodeIds, item.id);
    if (isLayoutEdgeItem(item)) addUnique(layoutEdgeIds, item.id);
  });

  return createDiagramHighlights({
    addedNodeIds,
    removedNodeIds,
    modifiedNodeIds,
    layoutNodeIds,
    addedEdgeIds,
    removedEdgeIds,
    modifiedEdgeIds,
    layoutEdgeIds,
  });
}

export function buildLogicalVersionHighlights(
  diff: ProjectVersionDiffResult,
  side: "left" | "right",
): VersionLogicalHighlights {
  const addedTableIds = new Set<string>();
  const removedTableIds = new Set<string>();
  const modifiedTableIds = new Set<string>();
  const addedColumnIds = new Set<string>();
  const removedColumnIds = new Set<string>();
  const modifiedColumnIds = new Set<string>();
  const addedForeignKeyIds = new Set<string>();
  const removedForeignKeyIds = new Set<string>();
  const modifiedForeignKeyIds = new Set<string>();
  const addedEdgeIds = new Set<string>();
  const removedEdgeIds = new Set<string>();
  const modifiedEdgeIds = new Set<string>();
  const logical = diff.sections.logical;
  const visibleAdded = side === "right" ? logical.added : [];
  const visibleRemoved = side === "left" ? logical.removed : [];

  visibleAdded.forEach((item) => {
    if (item.kind === "table") addUnique(addedTableIds, item.id);
    if (item.kind === "column") addUnique(addedColumnIds, columnIdFromItemId(item.id));
    if (item.kind === "foreign-key") addUnique(addedForeignKeyIds, item.id);
    if (item.kind === "logical-edge") addUnique(addedEdgeIds, item.id);
  });
  visibleRemoved.forEach((item) => {
    if (item.kind === "table") addUnique(removedTableIds, item.id);
    if (item.kind === "column") addUnique(removedColumnIds, columnIdFromItemId(item.id));
    if (item.kind === "foreign-key") addUnique(removedForeignKeyIds, item.id);
    if (item.kind === "logical-edge") addUnique(removedEdgeIds, item.id);
  });
  logical.modified.forEach((item) => {
    if (item.kind === "table") addUnique(modifiedTableIds, item.id);
    if (item.kind === "column") addUnique(modifiedColumnIds, columnIdFromItemId(item.id));
    if (item.kind === "foreign-key") addUnique(modifiedForeignKeyIds, item.id);
    if (item.kind === "logical-edge") addUnique(modifiedEdgeIds, item.id);
  });

  return createLogicalHighlights({
    addedTableIds,
    removedTableIds,
    modifiedTableIds,
    addedColumnIds,
    removedColumnIds,
    modifiedColumnIds,
    addedForeignKeyIds,
    removedForeignKeyIds,
    modifiedForeignKeyIds,
    addedEdgeIds,
    removedEdgeIds,
    modifiedEdgeIds,
  });
}

export function buildVersionCompareVisualModel(
  versioning: ProjectVersioningState,
  currentSnapshot: ProjectCommitSnapshot,
  leftRef: VersionCompareRef,
  rightRef: VersionCompareRef,
): BuildVersionCompareVisualModelResult {
  const left = resolveVersionCompareRef(versioning, currentSnapshot, leftRef);
  if (left.status !== "ok") {
    return left;
  }

  const right = resolveVersionCompareRef(versioning, currentSnapshot, rightRef);
  if (right.status !== "ok") {
    return right;
  }

  const diff = buildProjectVersionDiff(left.side.snapshot, right.side.snapshot, {
    leftLabel: left.side.label,
    rightLabel: right.side.label,
    leftCommitId: left.side.commitId,
    rightCommitId: right.side.commitId,
  });

  return {
    status: "ok",
    model: {
      diff,
      left: left.side,
      right: right.side,
      highlights: {
        left: {
          diagram: buildDiagramVersionHighlights(diff, "left"),
          logical: buildLogicalVersionHighlights(diff, "left"),
        },
        right: {
          diagram: buildDiagramVersionHighlights(diff, "right"),
          logical: buildLogicalVersionHighlights(diff, "right"),
        },
      },
    },
  };
}

export function getSnapshotViewPayload(
  snapshot: ProjectCommitSnapshot,
  viewMode: VersionCompareViewMode,
): SnapshotViewPayload {
  if (viewMode === "logical") {
    return {
      mode: "logical",
      workspace: cloneProjectCommitSnapshot(snapshot).logicalWorkspace,
    };
  }

  if (viewMode === "translation") {
    const cloned = cloneProjectCommitSnapshot(snapshot);
    return {
      mode: "translation",
      diagram: refreshErTranslationWorkspace(cloned.diagram, cloned.translationWorkspace).translatedDiagram,
    };
  }

  return {
    mode: "er",
    diagram: cloneProjectCommitSnapshot(snapshot).diagram,
  };
}
