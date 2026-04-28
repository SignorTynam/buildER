import type { WorkspaceView } from "../types/translation";
import { WorkspaceViewBar, WorkspaceViewButton } from "./panels";

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

export function WorkspaceStageBar(props: WorkspaceStageBarProps) {
  return (
    <section className="workspace-mode-strip" aria-label="Workflow di modellazione">
      <WorkspaceViewBar>
        <WorkspaceViewButton active={props.currentView === "er"} badge={props.erIssuesCount} onClick={props.onOpenEr}>
          Modello ER
        </WorkspaceViewButton>
        <WorkspaceViewButton
          active={props.currentView === "translation"}
          badge={props.translationPendingCount}
          onClick={props.onOpenTranslation}
        >
          Traduzione
        </WorkspaceViewButton>
        <WorkspaceViewButton
          active={props.currentView === "logical"}
          badge={props.logicalPendingCount}
          onClick={props.onOpenLogical}
        >
          Schema logico
        </WorkspaceViewButton>
      </WorkspaceViewBar>
    </section>
  );
}
