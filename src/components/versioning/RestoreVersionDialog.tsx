import type { ProjectCommit } from "../../features/versioning/projectCommitSnapshot";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface RestoreVersionDialogProps {
  open: boolean;
  busy: boolean;
  error: string;
  commit: ProjectCommit | null;
  onClose: () => void;
  onConfirm: () => void;
}

function formatCommitDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function shortCommitId(id: string) {
  return id.slice(0, 8);
}

export function RestoreVersionDialog({
  open,
  busy,
  error,
  commit,
  onClose,
  onConfirm,
}: RestoreVersionDialogProps) {
  const { t } = useI18n();

  if (!open || !commit) {
    return null;
  }

  return (
    <div className="help-modal-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="help-modal action-modal versioning-restore-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="versioning-restore-title"
        onClick={(event) => event.stopPropagation()}
        data-testid="restore-version-dialog"
      >
        <div className="help-modal-head">
          <h2 id="versioning-restore-title">{t("versioning.restore.title")}</h2>
          <button
            type="button"
            className="help-close"
            onClick={onClose}
            aria-label={t("common.actions.close")}
            disabled={busy}
          >
            <StudioIcon name="close" aria-hidden="true" />
          </button>
        </div>
        <div className="action-modal-content">
          <p className="action-modal-hint">{t("versioning.restore.confirmMessage")}</p>
          <div className="versioning-restore-target" data-testid="restore-version-target">
            <strong>{commit.message}</strong>
            <span>{shortCommitId(commit.id)}</span>
            <span>{formatCommitDate(commit.createdAt)}</span>
            <div className="versioning-commit-stats">
              <span>{t("versioning.stats.entities", { count: commit.stats.entityCount })}</span>
              <span>{t("versioning.stats.relationships", { count: commit.stats.relationshipCount })}</span>
              <span>{t("versioning.stats.attributes", { count: commit.stats.attributeCount })}</span>
              <span>{t("versioning.stats.edges", { count: commit.stats.edgeCount })}</span>
              {commit.stats.tableCount !== undefined ? (
                <span>{t("versioning.stats.tables", { count: commit.stats.tableCount })}</span>
              ) : null}
            </div>
          </div>
          <p className="versioning-restore-warning">
            {t("versioning.restore.backupBeforeRestore")}
          </p>
          {error ? <p className="action-modal-error">{error}</p> : null}
          <div className="action-modal-actions">
            <button type="button" className="header-button" onClick={onClose} disabled={busy}>
              {t("common.actions.cancel")}
            </button>
            <button
              type="button"
              className="mode-button active"
              onClick={onConfirm}
              disabled={busy}
              data-testid="confirm-restore-button"
            >
              {t("versioning.restore.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
