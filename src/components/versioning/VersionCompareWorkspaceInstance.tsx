import { useEffect, useMemo, useState } from "react";
import type { SelectionState, VersionDiagramHighlights, Viewport } from "../../types/diagram";
import type { LogicalSelection, VersionLogicalHighlights } from "../../types/logical";
import {
  getSnapshotViewPayload,
  type VersionCompareSideResolved,
  type VersionCompareViewMode,
} from "../../features/versioning/projectVersionVisualDiff";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";
import { LogicalTranslationWorkspace } from "../../logical/LogicalTranslationWorkspace";
import { TranslationWorkspace } from "../../translation/TranslationWorkspace";
import { ErWorkspaceView } from "../../workspace/ErWorkspaceView";

interface VersionCompareWorkspaceInstanceProps {
  side: "left" | "right";
  resolved: VersionCompareSideResolved;
  viewMode: VersionCompareViewMode;
  diagramHighlights: VersionDiagramHighlights;
  logicalHighlights: VersionLogicalHighlights;
  onViewModeChange: (viewMode: VersionCompareViewMode) => void;
}

const VIEW_MODES: VersionCompareViewMode[] = ["er", "translation", "logical"];

function shortCommitId(id: string) {
  return id.slice(0, 8);
}

function formatCommitDate(value?: string) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function getInitialViewport(resolved: VersionCompareSideResolved, viewMode: VersionCompareViewMode): Viewport {
  if (viewMode === "translation") {
    return resolved.snapshot.translationViewport;
  }

  if (viewMode === "logical") {
    return resolved.snapshot.logicalViewport;
  }

  return resolved.snapshot.viewport;
}

function getInitialSelection(resolved: VersionCompareSideResolved, viewMode: VersionCompareViewMode): SelectionState {
  if (viewMode === "translation") {
    return resolved.snapshot.translationSelection;
  }

  return resolved.snapshot.selection;
}

export function VersionCompareWorkspaceInstance({
  side,
  resolved,
  viewMode,
  diagramHighlights,
  logicalHighlights,
  onViewModeChange,
}: VersionCompareWorkspaceInstanceProps) {
  const { t } = useI18n();
  const [viewport, setViewport] = useState<Viewport>(() => getInitialViewport(resolved, viewMode));
  const [selection, setSelection] = useState<SelectionState>(() => getInitialSelection(resolved, viewMode));
  const [logicalSelection, setLogicalSelection] = useState<LogicalSelection>(() => resolved.snapshot.logicalSelection);
  const logicalFitToken = 0;
  const payload = useMemo(() => getSnapshotViewPayload(resolved.snapshot, viewMode), [resolved.snapshot, viewMode]);
  const versionDate = formatCommitDate(resolved.createdAt);

  useEffect(() => {
    setViewport(getInitialViewport(resolved, viewMode));
    setSelection(getInitialSelection(resolved, viewMode));
    setLogicalSelection(resolved.snapshot.logicalSelection);
  }, [resolved, viewMode]);

  function handleViewportChange(nextViewport: Viewport) {
    setViewport(nextViewport);
  }

  const unavailableTitle =
    payload.mode === "unavailable" && payload.viewMode === "translation"
      ? t("versioning.visualCompare.translationUnavailableTitle")
      : t("versioning.visualCompare.logicalUnavailableTitle");
  const unavailableDescription =
    payload.mode === "unavailable" && payload.viewMode === "translation"
      ? t("versioning.visualCompare.translationUnavailableDescription")
      : t("versioning.visualCompare.logicalUnavailableDescription");

  return (
    <section
      className={`version-compare-instance is-${side}`}
      data-testid={`version-compare-instance-${side}`}
      aria-label={side === "left" ? t("versioning.visualCompare.leftWorkspace") : t("versioning.visualCompare.rightWorkspace")}
    >
      <header className="version-compare-instance-header">
        <div>
          <span>{side === "left" ? t("versioning.visualCompare.leftWorkspace") : t("versioning.visualCompare.rightWorkspace")}</span>
          <strong>{resolved.label}</strong>
          <small>
            {resolved.commitId ? shortCommitId(resolved.commitId) : t("versioning.visualCompare.workingCopy")}
            {versionDate ? ` - ${versionDate}` : ""}
          </small>
        </div>
        <nav className="version-compare-view-tabs" aria-label={t("versioning.visualCompare.selectVersion")}>
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={viewMode === mode ? "active" : ""}
              onClick={() => onViewModeChange(mode)}
              data-testid={`version-compare-${side}-view-${mode}`}
            >
              {mode === "er"
                ? t("versioning.visualCompare.viewEr")
                : mode === "translation"
                  ? t("versioning.visualCompare.viewTranslation")
                  : t("versioning.visualCompare.viewLogical")}
            </button>
          ))}
        </nav>
      </header>

      <div className="version-compare-instance-real-workspace">
        {payload.mode === "unavailable" ? (
          <div className="version-compare-empty-logical" data-testid={`version-compare-${side}-unavailable-${payload.viewMode}`}>
            <StudioIcon name={payload.viewMode === "translation" ? "translate" : "database"} aria-hidden="true" />
            <strong>{unavailableTitle}</strong>
            <p>{unavailableDescription}</p>
          </div>
        ) : payload.mode === "logical" ? (
            <LogicalTranslationWorkspace
              sourceDiagram={resolved.snapshot.translationWorkspace.translatedDiagram}
              workspace={payload.workspace}
              logicalStage={resolved.snapshot.logicalStage}
              viewport={viewport}
              selection={logicalSelection}
              sidePanelHidden
              typeMode={false}
              panelMode="review"
              fitRequestToken={logicalFitToken}
              notesPanelOpen={false}
              canUndo={false}
              canRedo={false}
              readOnly
              compareMode
              versionHighlights={logicalHighlights}
              onUndo={() => undefined}
              onRedo={() => undefined}
              onViewportChange={handleViewportChange}
              onSelectionChange={setLogicalSelection}
              onTypeModeChange={() => undefined}
              onPanelModeChange={() => undefined}
              onToggleNotesPanel={() => undefined}
              onApplyChoice={() => undefined}
              onApplyBulkFix={() => undefined}
              onResetTranslation={() => undefined}
              onDone={() => undefined}
              onOpenDesign={() => undefined}
              onExportProject={() => undefined}
              onSaveSql={() => undefined}
              onExportPng={() => undefined}
              onExportJpeg={() => undefined}
              onExportSvg={() => undefined}
              onPreviewModel={() => undefined}
              onCommitModel={() => undefined}
              onRenameTable={() => undefined}
              onRenameColumn={() => undefined}
              onUpdateColumnSql={() => undefined}
              onMoveColumn={() => undefined}
            />
        ) : payload.mode === "translation" ? (
          <TranslationWorkspace
            workspace={payload.workspace}
            viewport={viewport}
            selection={selection}
            sidePanelHidden
            canUndo={false}
            canRedo={false}
            notesPanelOpen={false}
            readOnly
            compareMode
            versionHighlights={diagramHighlights}
            onUndo={() => undefined}
            onRedo={() => undefined}
            onViewportChange={handleViewportChange}
            onSelectionChange={setSelection}
            onApplyChoice={() => undefined}
            onResetTranslation={() => undefined}
            onOpenDesign={() => undefined}
            onOpenLogical={() => undefined}
            onToggleNotesPanel={() => undefined}
            onExportProject={() => undefined}
            onSaveRestructuredErs={() => undefined}
            onPreviewDiagram={() => undefined}
            onCommitDiagram={() => undefined}
          />
        ) : (
          <ErWorkspaceView
            diagram={payload.diagram}
            selection={selection}
            viewport={viewport}
            issues={[]}
            statusMessage={t("versioning.visualCompare.workspaceReadOnly")}
            readOnly
            compareMode
            versionHighlights={diagramHighlights}
            onViewportChange={handleViewportChange}
            onSelectionChange={setSelection}
          />
        )}
      </div>
    </section>
  );
}
