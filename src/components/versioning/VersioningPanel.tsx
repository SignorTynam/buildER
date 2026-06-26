import type { ProjectCommit } from "../../features/versioning/projectCommitSnapshot";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface VersioningPanelProps {
  open: boolean;
  commits: ProjectCommit[];
  headCommitId: string | null;
  hasUncommittedChanges: boolean;
  onClose: () => void;
  onNewCommit: () => void;
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

export function VersioningPanel({
  open,
  commits,
  headCommitId,
  hasUncommittedChanges,
  onClose,
  onNewCommit,
}: VersioningPanelProps) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <div className="studio-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="studio-modal studio-modal--wide versioning-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="versioning-panel-title"
        onClick={(event) => event.stopPropagation()}
        data-testid="versioning-panel"
      >
        <div className="studio-modal__header">
          <div>
            <h2 id="versioning-panel-title" className="studio-modal__title">{t("versioning.versions")}</h2>
            {hasUncommittedChanges ? (
              <p className="studio-modal__subtitle versioning-unsaved" data-testid="versioning-uncommitted">
                {t("versioning.uncommittedChanges")}
              </p>
            ) : null}
          </div>
          <div className="versioning-panel-actions">
            <button type="button" className="mode-button active" onClick={onNewCommit} data-testid="open-commit-dialog">
              <StudioIcon name="history" aria-hidden="true" />
              {t("versioning.newCommit")}
            </button>
            <button type="button" className="studio-modal__close" onClick={onClose} aria-label={t("common.actions.close")}>
              <StudioIcon name="close" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="studio-modal__body versioning-panel-body">
          {commits.length === 0 ? (
            <div className="versioning-empty" data-testid="versioning-empty">
              <StudioIcon name="history" aria-hidden="true" />
              <strong>{t("versioning.noVersions")}</strong>
            </div>
          ) : (
            <ol className="versioning-timeline" data-testid="versioning-timeline">
              {commits.map((commit) => (
                <li key={commit.id} className="versioning-commit-card">
                  <div className="versioning-commit-main">
                    <div>
                      <div className="versioning-commit-title-row">
                        <strong>{commit.message}</strong>
                        {commit.id === headCommitId ? <span className="versioning-head-badge">{t("versioning.head")}</span> : null}
                      </div>
                      <div className="versioning-commit-meta">
                        <span>{shortCommitId(commit.id)}</span>
                        <span>{formatCommitDate(commit.createdAt)}</span>
                        <span>{commit.automatic ? t("versioning.automaticCommit") : t("versioning.manualCommit")}</span>
                      </div>
                    </div>
                  </div>
                  {commit.description ? <p className="versioning-commit-description">{commit.description}</p> : null}
                  <div className="versioning-commit-stats">
                    <span>{t("versioning.stats.entities", { count: commit.stats.entityCount })}</span>
                    <span>{t("versioning.stats.relationships", { count: commit.stats.relationshipCount })}</span>
                    <span>{t("versioning.stats.attributes", { count: commit.stats.attributeCount })}</span>
                    <span>{t("versioning.stats.edges", { count: commit.stats.edgeCount })}</span>
                    {commit.stats.tableCount !== undefined ? (
                      <span>{t("versioning.stats.tables", { count: commit.stats.tableCount })}</span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
