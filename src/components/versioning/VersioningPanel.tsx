import type { ProjectCommit } from "../../features/versioning/projectCommitSnapshot";
import type {
  ProjectUncommittedChangeCategories,
  ProjectUncommittedChangeState,
} from "../../features/versioning/useProjectVersioning";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface VersioningPanelProps {
  open: boolean;
  commits: ProjectCommit[];
  headCommitId: string | null;
  changeState: ProjectUncommittedChangeState;
  onClose: () => void;
  onNewCommit: () => void;
  onCompareWithCurrent: (commitId: string) => void;
  onCompareWithHead: (commitId: string) => void;
  onRestoreCommit: (commitId: string) => void;
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

function getChangedCategoryKeys(categories: ProjectUncommittedChangeCategories) {
  return (["er", "layout", "logical", "code", "workspace"] as const).filter((key) => categories[key]);
}

export function VersioningPanel({
  open,
  commits,
  headCommitId,
  changeState,
  onClose,
  onNewCommit,
  onCompareWithCurrent,
  onCompareWithHead,
  onRestoreCommit,
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
            <p
              className={
                changeState.hasChanges
                  ? "studio-modal__subtitle versioning-unsaved"
                  : "studio-modal__subtitle versioning-clean"
              }
              data-testid={changeState.hasChanges ? "versioning-uncommitted" : "versioning-clean"}
            >
              {changeState.status === "no-head-empty"
                ? t("versioning.emptyProject")
                : changeState.status === "no-head-with-content"
                  ? t("versioning.noHeadWithContent")
                  : changeState.status === "dirty"
                    ? t("versioning.uncommittedChanges")
                    : t("versioning.cleanWorkingCopy")}
            </p>
          </div>
          <div className="versioning-panel-actions">
            <button
              type="button"
              className="mode-button active"
              onClick={onNewCommit}
              disabled={!changeState.summary.canCommit}
              data-testid="open-commit-dialog"
            >
              <StudioIcon name="history" aria-hidden="true" />
              {changeState.status === "no-head-with-content" ? t("versioning.createFirstCommit") : t("versioning.newCommit")}
            </button>
            <button type="button" className="studio-modal__close" onClick={onClose} aria-label={t("common.actions.close")}>
              <StudioIcon name="close" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="studio-modal__body versioning-panel-body">
          {changeState.hasChanges ? (
            <div className="versioning-change-summary" data-testid="versioning-change-categories">
              <strong>{t("versioning.uncommittedChanges")}</strong>
              <div className="versioning-category-list">
                {getChangedCategoryKeys(changeState.categories).map((key) => (
                  <span key={key} className="versioning-category-pill">
                    {t(`versioning.categories.${key}`)}
                  </span>
                ))}
              </div>
            </div>
          ) : changeState.hasHead ? (
            <div className="versioning-change-summary is-clean" data-testid="versioning-clean-summary">
              <strong>{t("versioning.noChangesComparedToHead")}</strong>
            </div>
          ) : null}

          {commits.length === 0 ? (
            <div className="versioning-empty" data-testid="versioning-empty">
              <StudioIcon name="history" aria-hidden="true" />
              <strong>
                {changeState.status === "no-head-with-content"
                  ? t("versioning.noHeadWithContent")
                  : t("versioning.noVersions")}
              </strong>
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
                  <div className="versioning-commit-actions">
                    <button
                      type="button"
                      className="mode-button"
                      onClick={() => onRestoreCommit(commit.id)}
                      disabled={commit.id === headCommitId && !changeState.hasChanges}
                      data-testid="restore-commit"
                    >
                      {commit.id === headCommitId && !changeState.hasChanges
                        ? t("versioning.restore.alreadyCurrent")
                        : t("versioning.restore.restoreThisVersion")}
                    </button>
                    <button
                      type="button"
                      className="header-button"
                      onClick={() => onCompareWithCurrent(commit.id)}
                      data-testid="compare-with-current"
                    >
                      {t("versioning.diff.compareWithCurrent")}
                    </button>
                    {commit.id !== headCommitId ? (
                      <button
                        type="button"
                        className="header-button"
                        onClick={() => onCompareWithHead(commit.id)}
                        data-testid="compare-with-head"
                      >
                        {t("versioning.diff.compareWithHead")}
                      </button>
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
