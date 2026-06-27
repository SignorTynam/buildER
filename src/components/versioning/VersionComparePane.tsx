import { useEffect, useMemo, useRef, useState } from "react";
import { DiagramCanvas } from "../../canvas/DiagramCanvas";
import { LogicalTransformationCanvas } from "../../logical/LogicalTransformationCanvas";
import type { SelectionState, VersionDiagramHighlights, Viewport } from "../../types/diagram";
import type { LogicalSelection, VersionLogicalHighlights } from "../../types/logical";
import {
  getSnapshotViewPayload,
  type VersionCompareSideResolved,
  type VersionCompareViewMode,
} from "../../features/versioning/projectVersionVisualDiff";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface VersionComparePaneProps {
  side: "left" | "right";
  resolved: VersionCompareSideResolved;
  viewMode: VersionCompareViewMode;
  diagramHighlights: VersionDiagramHighlights;
  logicalHighlights: VersionLogicalHighlights;
  syncViewport: boolean;
  fitRequestToken: number;
  onViewModeChange: (viewMode: VersionCompareViewMode) => void;
  onSyncedViewportChange: (viewMode: VersionCompareViewMode, viewport: Viewport, source: "left" | "right") => void;
  syncedViewport?: Viewport | null;
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

export function VersionComparePane({
  side,
  resolved,
  viewMode,
  diagramHighlights,
  logicalHighlights,
  syncViewport,
  fitRequestToken,
  onViewModeChange,
  onSyncedViewportChange,
  syncedViewport,
}: VersionComparePaneProps) {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement>(null);
  const logicalSvgRef = useRef<SVGSVGElement>(null);
  const [viewport, setViewport] = useState<Viewport>(() => getInitialViewport(resolved, viewMode));
  const [selection, setSelection] = useState<SelectionState>(() => getInitialSelection(resolved, viewMode));
  const [logicalSelection, setLogicalSelection] = useState<LogicalSelection>(() => resolved.snapshot.logicalSelection);
  const logicalFitToken = viewMode === "logical" ? fitRequestToken : 0;
  const payload = useMemo(() => getSnapshotViewPayload(resolved.snapshot, viewMode), [resolved.snapshot, viewMode]);
  const versionDate = formatCommitDate(resolved.createdAt);

  useEffect(() => {
    setViewport(getInitialViewport(resolved, viewMode));
    setSelection(getInitialSelection(resolved, viewMode));
    setLogicalSelection(resolved.snapshot.logicalSelection);
  }, [resolved, viewMode]);

  useEffect(() => {
    setViewport(getInitialViewport(resolved, viewMode));
  }, [fitRequestToken, resolved, viewMode]);

  useEffect(() => {
    if (syncViewport && syncedViewport) {
      setViewport(syncedViewport);
    }
  }, [syncViewport, syncedViewport]);

  function handleViewportChange(nextViewport: Viewport) {
    setViewport(nextViewport);
    if (syncViewport) {
      onSyncedViewportChange(viewMode, nextViewport, side);
    }
  }

  const logicalIsEmpty =
    viewMode === "logical" &&
    payload.mode === "logical" &&
    !resolved.snapshot.logicalGenerated &&
    payload.workspace.model.tables.length === 0;

  return (
    <section className={`version-compare-pane is-${side}`} data-testid={`visual-compare-pane-${side}`}>
      <header className="version-compare-pane-head">
        <div>
          <span>{side === "left" ? t("versioning.visualCompare.leftSide") : t("versioning.visualCompare.rightSide")}</span>
          <strong>{resolved.label}</strong>
          <small>
            {resolved.commitId ? shortCommitId(resolved.commitId) : t("versioning.visualCompare.workingCopy")}
            {versionDate ? ` · ${versionDate}` : ""}
          </small>
        </div>
        <nav className="version-compare-view-tabs" aria-label={t("versioning.visualCompare.selectVersion")}>
          {VIEW_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              className={viewMode === mode ? "active" : ""}
              onClick={() => onViewModeChange(mode)}
              data-testid={`visual-compare-${side}-view-${mode}`}
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

      <div className="version-compare-canvas-shell">
        {payload.mode === "logical" ? (
          logicalIsEmpty ? (
            <div className="version-compare-empty-logical">
              <StudioIcon name="database" aria-hidden="true" />
              <strong>{t("versioning.visualCompare.noLogicalSchema")}</strong>
              <p>{t("versioning.visualCompare.noLogicalSchemaDescription")}</p>
            </div>
          ) : (
            <LogicalTransformationCanvas
              sourceDiagram={resolved.snapshot.translationWorkspace.translatedDiagram}
              workspace={payload.workspace}
              selection={logicalSelection}
              viewport={viewport}
              svgRef={logicalSvgRef}
              showForeignKeyLabels
              typeMode={false}
              fitRequestToken={logicalFitToken}
              autoFitOnMount
              activeTargetKeys={[]}
              focusedTargetKey={null}
              viewMode="schema"
              readOnly
              versionHighlights={logicalHighlights}
              onViewportChange={handleViewportChange}
              onSelectionChange={setLogicalSelection}
              onPreviewModel={() => undefined}
              onCommitModel={() => undefined}
              onRenameTable={() => undefined}
              onRenameColumn={() => undefined}
              onUpdateColumnSql={() => undefined}
            />
          )
        ) : (
          <DiagramCanvas
            diagram={payload.diagram}
            selection={selection}
            tool="select"
            mode="edit"
            viewport={viewport}
            issues={[]}
            statusMessage={t("versioning.visualCompare.readOnlyStatus")}
            svgRef={svgRef}
            readOnly
            versionHighlights={diagramHighlights}
            onViewportChange={handleViewportChange}
            onSelectionChange={setSelection}
            onPreviewDiagram={() => undefined}
            onCommitDiagram={() => undefined}
            onCreateNode={() => ""}
            onCreateEdge={() => ({ success: false, message: t("versioning.visualCompare.readOnlyStatus") })}
            onOpenCardinality={() => undefined}
            onOpenInheritanceType={() => undefined}
            onToolChange={() => undefined}
            onDeleteNode={() => undefined}
            onDeleteEdge={() => undefined}
            onDeleteSelection={() => undefined}
            onDeleteExternalIdentifier={() => undefined}
            onRenameNode={() => undefined}
            onRenameEdge={() => undefined}
            onStatusMessageChange={() => undefined}
          />
        )}
      </div>

      <footer className="version-compare-pane-foot">
        <span>{t("versioning.stats.entities", { count: resolved.snapshot.diagram.nodes.filter((node) => node.type === "entity").length })}</span>
        <span>{t("versioning.stats.relationships", { count: resolved.snapshot.diagram.nodes.filter((node) => node.type === "relationship").length })}</span>
        <span>{t("versioning.stats.attributes", { count: resolved.snapshot.diagram.nodes.filter((node) => node.type === "attribute").length })}</span>
        <span>{t("versioning.stats.tables", { count: resolved.snapshot.logicalWorkspace.model.tables.length })}</span>
        <span>{t("versioning.stats.warnings", { count: resolved.snapshot.logicalWorkspace.model.issues.filter((issue) => issue.level === "warning").length })}</span>
        <span>{t("versioning.stats.errors", { count: resolved.snapshot.logicalWorkspace.model.issues.filter((issue) => issue.level === "error").length })}</span>
      </footer>
    </section>
  );
}
