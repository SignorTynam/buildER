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

  if (props.codePanelOpen && props.notesPanelOpen) {
    return "MODEL + CODE + NOTES";
  }

  if (props.codePanelOpen) {
    return "MODEL + CODE";
  }

  if (props.notesPanelOpen) {
    return "MODEL + NOTES";
  }

  return "MODEL";
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

  if (props.diagramView === "translation") {
    return {
      tone: "info",
      message: "Traduzione logica guidata attiva: risolvi gli step aperti in ordine.",
    };
  }

  if (props.diagramView === "logical") {
    return {
      tone: "info",
      message: props.logicalSqlOpen
        ? "Anteprima SQL sincronizzata con il modello logico corrente."
        : "Schema relazionale attivo: controlla vincoli, chiavi e tipi.",
    };
  }

  return {
    tone: "info",
    message: "Canvas pronto per la modellazione ER.",
  };
}

function getStatusToneLabel(tone: NoticeTone | "info"): string {
  if (tone === "error") {
    return "Errore";
  }

  if (tone === "warning") {
    return "Warning";
  }

  if (tone === "success") {
    return "OK";
  }

  return "Info";
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
  const activePanels = [
    props.codePanelOpen ? "Code" : "",
    props.notesPanelOpen ? "Notes" : "",
  ].filter(Boolean);
  const statusMeta = [
    props.selectionItemCount > 0 ? `${props.selectionItemCount} selezionati` : "",
    errorCount > 0 ? `${errorCount} errori` : "",
    warningCount > 0 ? `${warningCount} warning` : "",
    ...activePanels,
  ].filter(Boolean);

  return (
    <footer className="bottom-status-bar" aria-live="polite">
      <div className="bottom-status-bar-main">
        <div className="bottom-status-block bottom-status-block-mode">
          <span className="bottom-status-label">Workspace</span>
          <strong>{getWorkspaceLabel(props)}</strong>
        </div>

        <div className={`bottom-status-block bottom-status-block-message tone-${primaryTone}`}>
          {primaryTone === "info" ? null : (
            <span className="bottom-status-indicator">{getStatusToneLabel(primaryTone)}</span>
          )}
          <p>{primaryMessage}</p>
          {primaryNotice ? (
            <button
              type="button"
              className="bottom-status-notice-close"
              onClick={() => props.onDismissNotice(primaryNotice.id)}
              aria-label="Chiudi notifica"
            >
              x
            </button>
          ) : null}
        </div>

        <div className="bottom-status-block bottom-status-block-meta" aria-label="Stato selezione e validazione">
          {statusMeta.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </div>
    </footer>
  );
}
