import type { WorkspaceView } from "../types/translation";

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
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="10" height="6" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="8" cy="8" r="1" fill="currentColor"/>
      </svg>
    );
  }
  if (stage === "translation") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 8h8M8 4v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 6h10M6 6v7" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

export function WorkspaceStageBar(props: WorkspaceStageBarProps) {
  return (
    <nav className="workspace-stage-bar" aria-label="Workflow di modellazione">
      <div className="workspace-stage-tabs">
        <button
          type="button"
          className={`workspace-stage-tab ${props.currentView === "er" ? "active" : ""}`}
          onClick={props.onOpenEr}
          aria-current={props.currentView === "er" ? "page" : undefined}
        >
          <StageIcon stage="er" />
          <span className="workspace-stage-tab-label">Modello ER</span>
          {props.erIssuesCount > 0 && (
            <span className="workspace-stage-badge workspace-stage-badge-warning">{props.erIssuesCount}</span>
          )}
        </button>

        <div className="workspace-stage-connector" aria-hidden="true">
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
            <path d="M0 8h20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2"/>
            <path d="M16 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <button
          type="button"
          className={`workspace-stage-tab ${props.currentView === "translation" ? "active" : ""}`}
          onClick={props.onOpenTranslation}
          aria-current={props.currentView === "translation" ? "page" : undefined}
        >
          <StageIcon stage="translation" />
          <span className="workspace-stage-tab-label">Traduzione</span>
          {props.translationPendingCount > 0 && (
            <span className="workspace-stage-badge">{props.translationPendingCount}</span>
          )}
        </button>

        <div className="workspace-stage-connector" aria-hidden="true">
          <svg width="20" height="16" viewBox="0 0 20 16" fill="none">
            <path d="M0 8h20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2"/>
            <path d="M16 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <button
          type="button"
          className={`workspace-stage-tab ${props.currentView === "logical" ? "active" : ""}`}
          onClick={props.onOpenLogical}
          aria-current={props.currentView === "logical" ? "page" : undefined}
          title={props.logicalOutOfDate ? "Schema logico da riallineare" : undefined}
        >
          <StageIcon stage="logical" />
          <span className="workspace-stage-tab-label">Schema logico</span>
          {props.logicalPendingCount > 0 && (
            <span className="workspace-stage-badge">{props.logicalPendingCount}</span>
          )}
          {props.logicalPendingCount === 0 && props.logicalOutOfDate && (
            <span className="workspace-stage-badge workspace-stage-badge-warning">!</span>
          )}
        </button>
      </div>
    </nav>
  );
}
