import type { ValidationIssue } from "../types/diagram";
import type { WorkspaceView } from "../types/translation";

type NoticeTone = "success" | "warning" | "error";

interface WorkspaceNoticeItem {
  id: number;
  message: string;
  tone: NoticeTone;
  sticky?: boolean;
}

interface BottomStatusBarProps {
  diagramView: WorkspaceView;
  logicalSqlOpen: boolean;
  codePanelOpen: boolean;
  notesPanelOpen: boolean;
  statusMessage: string;
  notices: WorkspaceNoticeItem[];
  issues: ValidationIssue[];
  selectionItemCount: number;
  onDismissNotice: (noticeId: number) => void;
}

function getWorkspaceLabel(props: BottomStatusBarProps): string {
  if (props.diagramView === "translation") {
    return "TRANSLATION";
  }

  if (props.diagramView === "logical") {
    return props.logicalSqlOpen ? "SCHEMA + SQL" : "SCHEMA";
  }

  return "MODEL";
}

function getPanelLabels(props: BottomStatusBarProps): string {
  const activePanels = [
    props.codePanelOpen ? "Code" : "",
    props.notesPanelOpen ? "Notes" : "",
  ].filter(Boolean);
  return activePanels.length > 0 ? activePanels.join(" + ") : "";
}

function getFallbackStatus(props: BottomStatusBarProps): { tone: NoticeTone | "info"; message: string } {
  const errorCount = props.issues.filter((issue) => issue.level === "error").length;
  const warningCount = props.issues.filter((issue) => issue.level === "warning").length;

  if (errorCount > 0) {
    return {
      tone: "error",
      message: `${errorCount} errori di validazione richiedono attenzione.`,
    };
  }

  if (warningCount > 0) {
    return {
      tone: "warning",
      message: `${warningCount} warning di validazione nel workspace corrente.`,
    };
  }

  return {
    tone: "info",
    message: "",
  };
}

export function BottomStatusBar(props: BottomStatusBarProps) {
  const errorCount = props.issues.filter((issue) => issue.level === "error").length;
  const warningCount = props.issues.filter((issue) => issue.level === "warning").length;
  const primaryNotice = props.notices[0] as WorkspaceNoticeItem | undefined;
  const fallbackStatus = getFallbackStatus(props);
  const primaryTone: NoticeTone | "info" = primaryNotice?.tone ?? fallbackStatus.tone;
  const trimmedStatusMessage = props.statusMessage.trim();
  const primaryMessage =
    primaryNotice?.message ?? (trimmedStatusMessage || fallbackStatus.message);
  const panelLabel = getPanelLabels(props);

  return (
    <footer className="bottom-status-bar" aria-live="polite">
      <div className="bottom-status-left">
        <div className="bottom-status-workspace">
          <span className="bottom-status-workspace-label">WORKSPACE</span>
          <span className="bottom-status-workspace-value">{getWorkspaceLabel(props)}</span>
        </div>
        {panelLabel && (
          <div className="bottom-status-panels">
            <span className="bottom-status-panels-label">+</span>
            <span className="bottom-status-panels-value">{panelLabel}</span>
          </div>
        )}
      </div>

      <div className="bottom-status-center">
        {primaryMessage && (
          <div className={`bottom-status-message tone-${primaryTone}`}>
            {primaryTone !== "info" && (
              <span className={`bottom-status-indicator tone-${primaryTone}`}>
                {primaryTone === "warning" && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path d="M6 1L11 10H1L6 1z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    <circle cx="6" cy="8" r="0.5" fill="currentColor"/>
                    <path d="M6 4v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
                {primaryTone === "error" && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M4 4l4 4M8 4l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                )}
                {primaryTone === "success" && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M3.5 6l2 2 3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </span>
            )}
            <span className="bottom-status-message-text">{primaryMessage}</span>
            {primaryNotice && (
              <button
                type="button"
                className="bottom-status-dismiss"
                onClick={() => props.onDismissNotice(primaryNotice.id)}
                aria-label="Chiudi notifica"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                  <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bottom-status-right">
        {props.selectionItemCount > 0 && (
          <div className="bottom-status-meta-item">
            <span className="bottom-status-meta-value">{props.selectionItemCount}</span>
            <span className="bottom-status-meta-label">selezionati</span>
          </div>
        )}
        {warningCount > 0 && (
          <div className="bottom-status-meta-item bottom-status-meta-warning">
            <span className="bottom-status-meta-value">{warningCount}</span>
            <span className="bottom-status-meta-label">warning</span>
          </div>
        )}
        {errorCount > 0 && (
          <div className="bottom-status-meta-item bottom-status-meta-error">
            <span className="bottom-status-meta-value">{errorCount}</span>
            <span className="bottom-status-meta-label">errori</span>
          </div>
        )}
      </div>
    </footer>
  );
}
