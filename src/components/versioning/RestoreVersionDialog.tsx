import type { ProjectCommit } from "../../features/versioning/projectCommitSnapshot";
import { PROJECT_RESTORE_BACKUP_TAG, PROJECT_RESTORE_TAG } from "../../features/versioning/projectVersionRestore";
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

function getCommitKindKey(commit: ProjectCommit) {
  if (commit.tags?.includes(PROJECT_RESTORE_BACKUP_TAG)) {
    return "versioning.backupCommit";
  }

  if (commit.tags?.includes(PROJECT_RESTORE_TAG)) {
    return "versioning.restoreCommit";
  }

  return commit.automatic ? "versioning.automaticCommit" : "versioning.manualCommit";
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
        aria-describedby="versioning-restore-description"
        onClick={(event) => event.stopPropagation()}
        data-testid="restore-version-dialog"
      >
        <div className="help-modal-head">
          <div className="versioning-restore-title">
            <span aria-hidden="true">
              <StudioIcon name="warning" />
            </span>
            <div>
              <h2 id="versioning-restore-title">{t("versioning.restore.title")}</h2>
              <p id="versioning-restore-description" className="action-modal-subtitle">
                {t("versioning.restore.confirmMessage")}
              </p>
            </div>
          </div>
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
          <div className="versioning-restore-target" data-testid="restore-version-target">
            <span className="versioning-type-badge is-restore">{t("versioning.restore.targetVersion")}</span>
            <strong>{commit.message}</strong>
            {commit.description ? <p>{commit.description}</p> : null}
            <div className="versioning-commit-meta">
              <span>{shortCommitId(commit.id)}</span>
              <span>{formatCommitDate(commit.createdAt)}</span>
              <span>{t(getCommitKindKey(commit))}</span>
            </div>
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
          <section className="versioning-restore-safety">
            <h3>{t("versioning.restore.protectedRestore")}</h3>
            <p>{t("versioning.restore.backupBeforeRestore")}</p>
            <ol className="versioning-restore-flow" data-testid="restore-version-flow">
              <li>
                <StudioIcon name="save" aria-hidden="true" />
                <span>{t("versioning.restore.flowBackup")}</span>
              </li>
              <li>
                <StudioIcon name="refresh" aria-hidden="true" />
                <span>{t("versioning.restore.flowApply")}</span>
              </li>
              <li>
                <StudioIcon name="history" aria-hidden="true" />
                <span>{t("versioning.restore.flowHead")}</span>
              </li>
            </ol>
          </section>
          {error ? <p className="action-modal-error">{error}</p> : null}
          <div className="action-modal-actions">
            <button type="button" className="header-button" onClick={onClose} disabled={busy}>
              {t("common.actions.cancel")}
            </button>
            <button
              type="button"
              className="mode-button active versioning-restore-confirm"
              onClick={onConfirm}
              disabled={busy}
              data-testid="confirm-restore-button"
            >
              {t("versioning.restore.restoreThisVersion")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
