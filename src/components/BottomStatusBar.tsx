import type { ValidationIssue } from "../types/diagram";
import type { WorkspaceView } from "../types/translation";
import { useI18n } from "../i18n/useI18n";
import { StudioIcon } from "./icons/StudioIcon";

type NoticeTone = "success" | "warning" | "error" | "info";

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

type Translate = ReturnType<typeof useI18n>["t"];

function getWorkspaceLabel(props: BottomStatusBarProps, t: Translate): string {
  if (props.diagramView === "translation") {
    return t("bottomStatus.workspace.translation");
  }

  if (props.diagramView === "logical") {
    return props.logicalSqlOpen ? t("bottomStatus.workspace.schemaSql") : t("bottomStatus.workspace.schema");
  }

  return t("bottomStatus.workspace.model");
}

function getPanelLabels(props: BottomStatusBarProps, t: Translate): string {
  const activePanels = [
    props.codePanelOpen ? t("bottomStatus.panels.code") : "",
    props.notesPanelOpen ? t("bottomStatus.panels.notes") : "",
  ].filter(Boolean);
  return activePanels.length > 0 ? activePanels.join(" + ") : "";
}

function getFallbackStatus(props: BottomStatusBarProps, t: Translate): { tone: NoticeTone | "info"; message: string } {
  const errorCount = props.issues.filter((issue) => issue.level === "error").length;
  const warningCount = props.issues.filter((issue) => issue.level === "warning").length;

  if (errorCount > 0) {
    return {
      tone: "error",
      message: t("bottomStatus.validationErrors", { count: errorCount }),
    };
  }

  if (warningCount > 0) {
    return {
      tone: "warning",
      message: t("bottomStatus.validationWarnings", { count: warningCount }),
    };
  }

  return {
    tone: "info",
    message: "",
  };
}

export function BottomStatusBar(props: BottomStatusBarProps) {
  const { t } = useI18n();
  const errorCount = props.issues.filter((issue) => issue.level === "error").length;
  const warningCount = props.issues.filter((issue) => issue.level === "warning").length;
  const primaryNotice = props.notices[0] as WorkspaceNoticeItem | undefined;
  const fallbackStatus = getFallbackStatus(props, t);
  const primaryTone: NoticeTone | "info" = primaryNotice?.tone ?? fallbackStatus.tone;
  const trimmedStatusMessage = props.statusMessage.trim();
  const primaryMessage =
    primaryNotice?.message ?? (trimmedStatusMessage || fallbackStatus.message);
  const panelLabel = getPanelLabels(props, t);

  return (
    <footer className="bottom-status-bar" aria-live="polite">
      <div className="bottom-status-left">
        <div className="bottom-status-workspace">
          <span className="bottom-status-workspace-label">{t("bottomStatus.workspaceLabel")}</span>
          <span className="bottom-status-workspace-value">{getWorkspaceLabel(props, t)}</span>
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
                <StudioIcon
                  name={primaryTone === "warning" ? "warning" : primaryTone === "error" ? "error" : "success"}
                  className="studio-icon-sm"
                  aria-hidden="true"
                />
              </span>
            )}
            <span className="bottom-status-message-text">{primaryMessage}</span>
            {primaryNotice && (
              <button
                type="button"
                className="bottom-status-dismiss"
                onClick={() => props.onDismissNotice(primaryNotice.id)}
                aria-label={t("bottomStatus.dismissNotice")}
              >
                <StudioIcon name="close" className="studio-icon-sm" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bottom-status-right">
        {props.selectionItemCount > 0 && (
          <div className="bottom-status-meta-item">
            <span className="bottom-status-meta-value">{props.selectionItemCount}</span>
            <span className="bottom-status-meta-label">{t("bottomStatus.selected", { count: props.selectionItemCount })}</span>
          </div>
        )}
        {warningCount > 0 && (
          <div className="bottom-status-meta-item bottom-status-meta-warning">
            <span className="bottom-status-meta-value">{warningCount}</span>
            <span className="bottom-status-meta-label">{t("bottomStatus.warnings", { count: warningCount })}</span>
          </div>
        )}
        {errorCount > 0 && (
          <div className="bottom-status-meta-item bottom-status-meta-error">
            <span className="bottom-status-meta-value">{errorCount}</span>
            <span className="bottom-status-meta-label">{t("bottomStatus.errors", { count: errorCount })}</span>
          </div>
        )}
      </div>
    </footer>
  );
}
