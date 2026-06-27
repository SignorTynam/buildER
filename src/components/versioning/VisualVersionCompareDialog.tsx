import { useEffect, useMemo, useState } from "react";
import type { ProjectCommitSnapshot, ProjectVersioningState } from "../../features/versioning/projectCommitSnapshot";
import type { ProjectVersionDiffItem } from "../../features/versioning/projectVersionDiff";
import {
  buildVersionCompareVisualModel,
  type VersionCompareRef,
  type VersionCompareSideResolved,
  type VersionCompareViewMode,
  type VersionCompareVisualModel,
  type VersionCompareHighlights,
} from "../../features/versioning/projectVersionVisualDiff";
import type { VersionDiagramHighlights, Viewport } from "../../types/diagram";
import type { VersionLogicalHighlights } from "../../types/logical";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";
import { VersionCompareChangeDrawer, type VersionCompareActiveChange } from "./VersionCompareChangeDrawer";
import { VersionComparePane } from "./VersionComparePane";
import { VersionCompareToolbar } from "./VersionCompareToolbar";

interface VisualVersionCompareDialogProps {
  open: boolean;
  versioning: ProjectVersioningState;
  currentSnapshot: ProjectCommitSnapshot;
  initialLeft: VersionCompareRef;
  initialRight: VersionCompareRef;
  onClose: () => void;
  onRestoreCommit: (commitId: string) => void;
}

const EMPTY_DIAGRAM_FOCUS = {
  focusedNodeId: null,
  focusedEdgeId: null,
};

const EMPTY_LOGICAL_FOCUS = {
  focusedTableId: null,
  focusedColumnId: null,
  focusedForeignKeyId: null,
};

function sortCommitsNewestFirst(versioning: ProjectVersioningState) {
  return [...versioning.commits].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function localizeSide(side: VersionCompareSideResolved, t: ReturnType<typeof useI18n>["t"]): VersionCompareSideResolved {
  if (side.ref.kind === "working-copy") {
    return { ...side, label: t("versioning.visualCompare.workingCopy") };
  }

  if (side.ref.kind === "head") {
    return { ...side, label: t("versioning.visualCompare.head") };
  }

  return side;
}

function isDiagramNodeItem(item: ProjectVersionDiffItem): boolean {
  return item.path?.startsWith("diagram.nodes.") === true;
}

function isDiagramEdgeItem(item: ProjectVersionDiffItem): boolean {
  return item.path?.startsWith("diagram.edges.") === true;
}

function splitRenamedId(id: string, side: "left" | "right"): string {
  const separatorIndex = id.indexOf("->");
  if (separatorIndex < 0) {
    return id;
  }

  return side === "left" ? id.slice(0, separatorIndex) : id.slice(separatorIndex + 2);
}

function shouldFocusChangeOnSide(change: VersionCompareActiveChange, side: "left" | "right") {
  if (change.tone === "added") {
    return side === "right";
  }

  if (change.tone === "removed") {
    return side === "left";
  }

  return true;
}

function focusDiagramHighlights(
  highlights: VersionDiagramHighlights,
  change: VersionCompareActiveChange | null,
  side: "left" | "right",
): VersionDiagramHighlights {
  if (!change || !shouldFocusChangeOnSide(change, side)) {
    return { ...highlights, ...EMPTY_DIAGRAM_FOCUS };
  }

  const id = splitRenamedId(change.item.id, side);
  if (isDiagramNodeItem(change.item)) {
    return { ...highlights, focusedNodeId: id, focusedEdgeId: null };
  }

  if (isDiagramEdgeItem(change.item)) {
    return { ...highlights, focusedNodeId: null, focusedEdgeId: id };
  }

  return { ...highlights, ...EMPTY_DIAGRAM_FOCUS };
}

function focusLogicalHighlights(
  highlights: VersionLogicalHighlights,
  change: VersionCompareActiveChange | null,
  side: "left" | "right",
): VersionLogicalHighlights {
  if (!change || change.section !== "logical" || !shouldFocusChangeOnSide(change, side)) {
    return { ...highlights, ...EMPTY_LOGICAL_FOCUS };
  }

  if (change.item.kind === "table") {
    return { ...highlights, focusedTableId: change.item.id, focusedColumnId: null, focusedForeignKeyId: null };
  }

  if (change.item.kind === "column") {
    return { ...highlights, focusedTableId: null, focusedColumnId: change.item.id, focusedForeignKeyId: null };
  }

  if (change.item.kind === "foreign-key") {
    return { ...highlights, focusedTableId: null, focusedColumnId: null, focusedForeignKeyId: change.item.id };
  }

  return { ...highlights, ...EMPTY_LOGICAL_FOCUS };
}

function localizeModel(model: VersionCompareVisualModel, t: ReturnType<typeof useI18n>["t"]): VersionCompareVisualModel {
  const left = localizeSide(model.left, t);
  const right = localizeSide(model.right, t);
  return {
    ...model,
    left,
    right,
    diff: {
      ...model.diff,
      leftLabel: left.label,
      rightLabel: right.label,
    },
  };
}

function withFocusedHighlights(
  highlights: VersionCompareHighlights,
  activeChange: VersionCompareActiveChange | null,
  side: "left" | "right",
): VersionCompareHighlights {
  return {
    diagram: focusDiagramHighlights(highlights.diagram, activeChange, side),
    logical: focusLogicalHighlights(highlights.logical, activeChange, side),
  };
}

export function VisualVersionCompareDialog({
  open,
  versioning,
  currentSnapshot,
  initialLeft,
  initialRight,
  onClose,
  onRestoreCommit,
}: VisualVersionCompareDialogProps) {
  const { t } = useI18n();
  const [leftRef, setLeftRef] = useState<VersionCompareRef>(initialLeft);
  const [rightRef, setRightRef] = useState<VersionCompareRef>(initialRight);
  const [leftViewMode, setLeftViewMode] = useState<VersionCompareViewMode>("er");
  const [rightViewMode, setRightViewMode] = useState<VersionCompareViewMode>("er");
  const [syncViewport, setSyncViewport] = useState(true);
  const [fitRequestToken, setFitRequestToken] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeChange, setActiveChange] = useState<VersionCompareActiveChange | null>(null);
  const [syncedViewports, setSyncedViewports] = useState<Partial<Record<VersionCompareViewMode, Viewport>>>({});

  useEffect(() => {
    if (open) {
      setLeftRef(initialLeft);
      setRightRef(initialRight);
      setLeftViewMode("er");
      setRightViewMode("er");
      setDetailsOpen(false);
      setActiveChange(null);
      setSyncedViewports({});
    }
  }, [initialLeft, initialRight, open]);

  useEffect(() => {
    if (!open || typeof document === "undefined") {
      return undefined;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const visualModelResult = useMemo(
    () => buildVersionCompareVisualModel(versioning, currentSnapshot, leftRef, rightRef),
    [currentSnapshot, leftRef, rightRef, versioning],
  );
  const commitsNewestFirst = useMemo(() => sortCommitsNewestFirst(versioning), [versioning]);

  if (!open) {
    return null;
  }

  if (visualModelResult.status !== "ok") {
    const message =
      visualModelResult.status === "missing-head"
        ? t("versioning.visualCompare.missingHead")
        : t("versioning.diff.commitNotFound", { commitId: visualModelResult.commitId });

    return (
      <div className="studio-modal-backdrop" role="presentation" onClick={onClose}>
        <div
          className="studio-modal version-compare-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="version-compare-title"
          aria-describedby="version-compare-subtitle"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="studio-modal__header">
            <h2 id="version-compare-title" className="studio-modal__title">{t("versioning.visualCompare.title")}</h2>
            <button type="button" className="studio-modal__close" onClick={onClose} aria-label={t("common.actions.close")}>
              <StudioIcon name="close" aria-hidden="true" />
            </button>
          </div>
          <div className="studio-modal__body">
            <div className="version-compare-empty-changes">
              <StudioIcon name="warning" aria-hidden="true" />
              <p>{message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const model = localizeModel(visualModelResult.model, t);
  const leftHighlights = withFocusedHighlights(model.highlights.left, activeChange, "left");
  const rightHighlights = withFocusedHighlights(model.highlights.right, activeChange, "right");

  function handleSyncedViewportChange(viewMode: VersionCompareViewMode, viewport: Viewport) {
    setSyncedViewports((current) => ({ ...current, [viewMode]: viewport }));
  }

  return (
    <div className="studio-modal-backdrop version-compare-backdrop" role="presentation" onClick={onClose}>
      <div
        className="studio-modal version-compare-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-compare-title"
        aria-describedby="version-compare-subtitle"
        onClick={(event) => event.stopPropagation()}
        data-testid="visual-version-compare-dialog"
      >
        <header className="version-compare-header">
          <div>
            <h2 id="version-compare-title">{t("versioning.visualCompare.title")}</h2>
            <p id="version-compare-subtitle">{t("versioning.visualCompare.subtitle")}</p>
          </div>
          <div className="version-compare-summary-chips" aria-label={t("versioning.diff.summary")}>
            <span>{t("versioning.diff.added")}<strong>{model.diff.summary.addedCount}</strong></span>
            <span>{t("versioning.diff.removed")}<strong>{model.diff.summary.removedCount}</strong></span>
            <span>{t("versioning.diff.modified")}<strong>{model.diff.summary.modifiedCount}</strong></span>
            <span>{t("versioning.diff.changedSections")}<strong>{model.diff.summary.changedSectionCount}</strong></span>
          </div>
          <button type="button" className="studio-modal__close" onClick={onClose} aria-label={t("common.actions.close")}>
            <StudioIcon name="close" aria-hidden="true" />
          </button>
        </header>

        <VersionCompareToolbar
          leftRef={leftRef}
          rightRef={rightRef}
          commits={commitsNewestFirst}
          headCommitId={versioning.headCommitId}
          syncViewport={syncViewport}
          detailsOpen={detailsOpen}
          onLeftRefChange={setLeftRef}
          onRightRefChange={setRightRef}
          onSyncViewportChange={setSyncViewport}
          onFitBoth={() => setFitRequestToken((current) => current + 1)}
          onSwapSides={() => {
            setLeftRef(rightRef);
            setRightRef(leftRef);
            setActiveChange(null);
          }}
          onToggleDetails={() => setDetailsOpen((current) => !current)}
          onRestoreCommit={onRestoreCommit}
        />

        <div className={detailsOpen ? "version-compare-workspace with-drawer" : "version-compare-workspace"}>
          <main className="version-compare-main">
            <div className="version-compare-legend" aria-label={t("versioning.visualCompare.legend.title")}>
              <span className="version-legend-item is-added">{t("versioning.visualCompare.legend.added")}</span>
              <span className="version-legend-item is-removed">{t("versioning.visualCompare.legend.removed")}</span>
              <span className="version-legend-item is-modified">{t("versioning.visualCompare.legend.modified")}</span>
              <span className="version-legend-item is-layout">{t("versioning.visualCompare.legend.layout")}</span>
            </div>
            <div className="version-compare-panes">
              <VersionComparePane
                side="left"
                resolved={model.left}
                viewMode={leftViewMode}
                diagramHighlights={leftHighlights.diagram}
                logicalHighlights={leftHighlights.logical}
                syncViewport={syncViewport}
                fitRequestToken={fitRequestToken}
                syncedViewport={syncViewport ? syncedViewports[leftViewMode] ?? null : null}
                onViewModeChange={setLeftViewMode}
                onSyncedViewportChange={handleSyncedViewportChange}
              />
              <VersionComparePane
                side="right"
                resolved={model.right}
                viewMode={rightViewMode}
                diagramHighlights={rightHighlights.diagram}
                logicalHighlights={rightHighlights.logical}
                syncViewport={syncViewport}
                fitRequestToken={fitRequestToken}
                syncedViewport={syncViewport ? syncedViewports[rightViewMode] ?? null : null}
                onViewModeChange={setRightViewMode}
                onSyncedViewportChange={handleSyncedViewportChange}
              />
            </div>
          </main>
          <VersionCompareChangeDrawer
            open={detailsOpen}
            diff={model.diff}
            activeChange={activeChange}
            onSelectChange={setActiveChange}
            onClose={() => setDetailsOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
