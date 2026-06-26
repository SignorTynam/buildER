import type { WorkspaceNotice } from "../hooks/useWorkspaceNotices";
import { useI18n } from "../i18n/useI18n";
import { StudioIcon, type StudioIconName } from "./icons/StudioIcon";

export const MAX_VISIBLE_WORKSPACE_TOASTS = 4;

interface WorkspaceToastStackProps {
  notices: WorkspaceNotice[];
  onDismissNotice: (noticeId: number) => void;
}

function getNoticeIcon(tone: WorkspaceNotice["tone"]): StudioIconName {
  if (tone === "error") {
    return "error";
  }
  if (tone === "warning") {
    return "warning";
  }
  if (tone === "success") {
    return "success";
  }

  return "info";
}

export function getDefaultNoticeTitle(tone: WorkspaceNotice["tone"]): string {
  if (tone === "error") {
    return "Errore";
  }
  if (tone === "warning") {
    return "Operazione non valida";
  }
  if (tone === "success") {
    return "Completato";
  }

  return "Informazione";
}

export function formatNoticeRelativeTime(createdAt: number, now = Date.now()): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - createdAt) / 1000));
  if (elapsedSeconds < 5) {
    return "ora";
  }
  if (elapsedSeconds < 60) {
    return `${elapsedSeconds} sec fa`;
  }

  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  return `${elapsedMinutes} min fa`;
}

export function getVisibleWorkspaceToasts(notices: WorkspaceNotice[]): WorkspaceNotice[] {
  return [...notices]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, MAX_VISIBLE_WORKSPACE_TOASTS);
}

export function WorkspaceToastStack({ notices, onDismissNotice }: WorkspaceToastStackProps) {
  const { t } = useI18n();
  const visibleNotices = getVisibleWorkspaceToasts(notices);

  if (visibleNotices.length === 0) {
    return null;
  }

  return (
    <section className="workspace-toast-viewport" aria-live="polite" aria-label="Notifiche workspace">
      <div className="workspace-toast-stack">
        {visibleNotices.map((notice) => {
          const title = notice.title ?? getDefaultNoticeTitle(notice.tone);
          const role = notice.tone === "error" ? "alert" : "status";
          return (
            <article
              key={notice.id}
              className={`workspace-toast tone-${notice.tone}`}
              role={role}
              aria-labelledby={`workspace-toast-title-${notice.id}`}
            >
              <header className="workspace-toast-head">
                <span className="workspace-toast-icon" aria-hidden="true">
                  <StudioIcon name={getNoticeIcon(notice.tone)} />
                </span>
                <strong id={`workspace-toast-title-${notice.id}`} className="workspace-toast-title">
                  {title}
                </strong>
                <span className="workspace-toast-time">{formatNoticeRelativeTime(notice.createdAt)}</span>
                <button
                  type="button"
                  className="workspace-toast-close"
                  onClick={() => onDismissNotice(notice.id)}
                  aria-label={t("bottomStatus.dismissNotice")}
                >
                  <StudioIcon name="close" className="studio-icon-sm" aria-hidden="true" />
                </button>
              </header>
              <div className="workspace-toast-body">
                <p>{notice.message}</p>
                {notice.actionLabel && notice.onAction ? (
                  <button
                    type="button"
                    className="workspace-toast-action"
                    onClick={() => {
                      onDismissNotice(notice.id);
                      notice.onAction?.();
                    }}
                  >
                    {notice.actionLabel}
                  </button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
