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

function getRestoreStats(commit: ProjectCommit, t: ReturnType<typeof useI18n>["t"]) {
  return [
    t("versioning.stats.entities", { count: commit.stats.entityCount }),
    t("versioning.stats.relationships", { count: commit.stats.relationshipCount }),
    t("versioning.stats.attributes", { count: commit.stats.attributeCount }),
    t("versioning.stats.edges", { count: commit.stats.edgeCount }),
    commit.stats.tableCount !== undefined ? t("versioning.stats.tables", { count: commit.stats.tableCount }) : null,
  ].filter((item): item is string => Boolean(item));
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

  const stats = getRestoreStats(commit, t);
  const commitKind = t(getCommitKindKey(commit));

  return (
    <div className="help-modal-backdrop versioning-restore-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="help-modal action-modal versioning-restore-dialog versioning-restore-dialog-v2"
        role="dialog"
        aria-modal="true"
        aria-labelledby="versioning-restore-title"
        aria-describedby="versioning-restore-description"
        onClick={(event) => event.stopPropagation()}
        data-testid="restore-version-dialog"
      >
        <header className="versioning-restore-header">
          <div className="versioning-restore-kicker">
            <span className="versioning-restore-icon" aria-hidden="true">
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
        </header>
        <div className="action-modal-content versioning-restore-body">
          <section className="versioning-restore-target" data-testid="restore-version-target">
            <div className="versioning-restore-target-heading">
              <span className="versioning-type-badge is-restore">{t("versioning.restore.targetVersion")}</span>
              <strong title={commit.message}>{commit.message}</strong>
            </div>
            {commit.description ? <p className="versioning-restore-description">{commit.description}</p> : null}
            <dl className="versioning-restore-meta" aria-label={t("versioning.restore.targetVersion")}>
              <div>
                <dt>ID</dt>
                <dd>{shortCommitId(commit.id)}</dd>
              </div>
              <div>
                <dt>{t("versioning.createdAt")}</dt>
                <dd>{formatCommitDate(commit.createdAt)}</dd>
              </div>
              <div>
                <dt>{t("versioning.commit")}</dt>
                <dd>{commitKind}</dd>
              </div>
            </dl>
            <div className="versioning-restore-stat-row">
              {stats.map((stat) => (
                <span key={stat}>{stat}</span>
              ))}
            </div>
          </section>

          <section className="versioning-restore-safety" data-testid="restore-version-flow">
            <div>
              <h3>{t("versioning.restore.protectedRestore")}</h3>
              <p>{t("versioning.restore.backupBeforeRestore")}</p>
            </div>
            <ol className="versioning-restore-flow">
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
          <div className="action-modal-actions versioning-restore-actions">
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
