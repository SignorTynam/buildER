import type { WorkspaceView } from "../types/translation";
import { useI18n } from "../i18n/useI18n";
import { StudioIcon } from "./icons/StudioIcon";

interface WorkspaceStageBarProps {
  currentView: WorkspaceView;
  sqlActive: boolean;
  erIssuesCount: number;
  translationPendingCount: number;
  logicalPendingCount: number;
  logicalTableCount: number;
  logicalOutOfDate: boolean;
  onOpenEr: () => void;
  onOpenTranslation: () => void;
  onOpenLogical: () => void;
}

function StageIcon({ stage }: { stage: "er" | "translation" | "logical" }) {
  if (stage === "er") {
    return <StudioIcon name="entity" className="studio-icon-sm" aria-hidden="true" />;
  }
  if (stage === "translation") {
    return <StudioIcon name="translate" className="studio-icon-sm" aria-hidden="true" />;
  }
  return <StudioIcon name="design" className="studio-icon-sm" aria-hidden="true" />;
}

export function WorkspaceStageBar(props: WorkspaceStageBarProps) {
  const { t } = useI18n();

  return (
    <nav className="workspace-stage-bar" aria-label={t("workspaceStage.aria")}>
      <div className="workspace-stage-tabs">
        <button
          type="button"
          className={`workspace-stage-tab ${props.currentView === "er" ? "active" : ""}`}
          onClick={props.onOpenEr}
          aria-current={props.currentView === "er" ? "page" : undefined}
        >
          <StageIcon stage="er" />
          <span className="workspace-stage-tab-label">{t("workspaceStage.er")}</span>
          {props.erIssuesCount > 0 && (
            <span className="workspace-stage-badge workspace-stage-badge-warning">{props.erIssuesCount}</span>
          )}
        </button>

        <div className="workspace-stage-connector" aria-hidden="true">
          <StudioIcon name="arrowRight" className="studio-icon-sm" />
        </div>

        <button
          type="button"
          className={`workspace-stage-tab ${props.currentView === "translation" ? "active" : ""}`}
          onClick={props.onOpenTranslation}
          aria-current={props.currentView === "translation" ? "page" : undefined}
        >
          <StageIcon stage="translation" />
          <span className="workspace-stage-tab-label">{t("workspaceStage.translation")}</span>
          {props.translationPendingCount > 0 && (
            <span className="workspace-stage-badge">{props.translationPendingCount}</span>
          )}
        </button>

        <div className="workspace-stage-connector" aria-hidden="true">
          <StudioIcon name="arrowRight" className="studio-icon-sm" />
        </div>

        <button
          type="button"
          className={`workspace-stage-tab ${props.currentView === "logical" ? "active" : ""}`}
          onClick={props.onOpenLogical}
          aria-current={props.currentView === "logical" ? "page" : undefined}
          title={props.logicalOutOfDate ? t("workspaceStage.logicalOutdated") : undefined}
        >
          <StageIcon stage="logical" />
          <span className="workspace-stage-tab-label">{t("workspaceStage.logical")}</span>
          {props.logicalPendingCount > 0 && (
            <span className="workspace-stage-badge">{props.logicalPendingCount}</span>
          )}
          {props.logicalPendingCount === 0 && props.logicalOutOfDate && (
            <span className="workspace-stage-badge workspace-stage-badge-warning">
              <StudioIcon name="warning" className="studio-icon-sm" aria-hidden="true" />
            </span>
          )}
        </button>
      </div>
    </nav>
  );
}
