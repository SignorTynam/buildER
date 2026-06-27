import { useEffect, useMemo, useState } from "react";
import type { ProjectCommit } from "../../features/versioning/projectCommitSnapshot";
import type {
  ProjectUncommittedChangeCategories,
  ProjectUncommittedChangeState,
} from "../../features/versioning/useProjectVersioning";
import { PROJECT_RESTORE_BACKUP_TAG, PROJECT_RESTORE_TAG } from "../../features/versioning/projectVersionRestore";
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

type CommitTone = "manual" | "automatic" | "backup" | "restore";

const CATEGORY_KEYS = ["er", "layout", "logical", "code", "workspace"] as const;

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
  return CATEGORY_KEYS.filter((key) => categories[key]);
}

function getCommitTone(commit: ProjectCommit): CommitTone {
  if (commit.tags?.includes(PROJECT_RESTORE_BACKUP_TAG)) {
    return "backup";
  }

  if (commit.tags?.includes(PROJECT_RESTORE_TAG)) {
    return "restore";
  }

  return commit.automatic ? "automatic" : "manual";
}

function getCommitToneLabelKey(tone: CommitTone) {
  switch (tone) {
    case "backup":
      return "versioning.backupCommit";
    case "restore":
      return "versioning.restoreCommit";
    case "automatic":
      return "versioning.automaticCommit";
    case "manual":
    default:
      return "versioning.manualCommit";
  }
}

function getCommitTagLabel(tag: string, t: ReturnType<typeof useI18n>["t"]) {
  if (tag === PROJECT_RESTORE_BACKUP_TAG) {
    return t("versioning.backupCommit");
  }

  if (tag === PROJECT_RESTORE_TAG) {
    return t("versioning.restoreCommit");
  }

  return tag;
}

function CommitStats({ commit }: { commit: ProjectCommit }) {
  const { t } = useI18n();

  return (
    <div className="versioning-commit-stats">
      <span>{t("versioning.stats.entities", { count: commit.stats.entityCount })}</span>
      <span>{t("versioning.stats.relationships", { count: commit.stats.relationshipCount })}</span>
      <span>{t("versioning.stats.attributes", { count: commit.stats.attributeCount })}</span>
      <span>{t("versioning.stats.edges", { count: commit.stats.edgeCount })}</span>
      {commit.stats.tableCount !== undefined ? (
        <span>{t("versioning.stats.tables", { count: commit.stats.tableCount })}</span>
      ) : null}
      {commit.stats.warningCount ? <span>{t("versioning.stats.warnings", { count: commit.stats.warningCount })}</span> : null}
      {commit.stats.errorCount ? <span>{t("versioning.stats.errors", { count: commit.stats.errorCount })}</span> : null}
    </div>
  );
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
  const [selectedCommitId, setSelectedCommitId] = useState<string | null>(headCommitId ?? commits[0]?.id ?? null);
  const selectedCommit = useMemo(
    () => commits.find((commit) => commit.id === selectedCommitId) ?? commits[0] ?? null,
    [commits, selectedCommitId],
  );
  const latestCommit = commits[0] ?? null;
  const changedCategoryKeys = getChangedCategoryKeys(changeState.categories);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (selectedCommitId && commits.some((commit) => commit.id === selectedCommitId)) {
      return;
    }

    setSelectedCommitId(headCommitId ?? commits[0]?.id ?? null);
  }, [commits, headCommitId, open, selectedCommitId]);

  if (!open) {
    return null;
  }

  const statusText =
    changeState.status === "no-head-empty"
      ? t("versioning.emptyProject")
      : changeState.status === "no-head-with-content"
        ? t("versioning.noHeadWithContent")
        : changeState.status === "dirty"
          ? t("versioning.uncommittedChanges")
          : t("versioning.cleanWorkingCopy");

  return (
    <div className="studio-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="studio-modal studio-modal--wide versioning-panel versioning-dashboard"
        role="dialog"
        aria-modal="true"
        aria-labelledby="versioning-panel-title"
        aria-describedby="versioning-panel-description"
        onClick={(event) => event.stopPropagation()}
        data-testid="versioning-panel"
      >
        <div className="studio-modal__header versioning-dashboard-header">
          <div className="versioning-dashboard-title">
            <span className="versioning-dashboard-icon" aria-hidden="true">
              <StudioIcon name="history" />
            </span>
            <div>
              <h2 id="versioning-panel-title" className="studio-modal__title">
                {t("versioning.projectVersions")}
              </h2>
              <p
                id="versioning-panel-description"
                className={
                  changeState.hasChanges
                    ? "studio-modal__subtitle versioning-unsaved"
                    : "studio-modal__subtitle versioning-clean"
                }
                data-testid={changeState.hasChanges ? "versioning-uncommitted" : "versioning-clean"}
              >
                {statusText}
              </p>
            </div>
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

        <div className="studio-modal__body versioning-dashboard-body">
          <section className="versioning-hero" aria-label={t("versioning.projectState")}>
            <div className={changeState.hasChanges ? "versioning-status-card is-dirty" : "versioning-status-card is-clean"}>
              <span className="versioning-status-icon" aria-hidden="true">
                <StudioIcon name={changeState.hasChanges ? "warning" : "success"} />
              </span>
              <div>
                <strong>{statusText}</strong>
                <p>
                  {changeState.hasChanges
                    ? t("versioning.workingCopyDirtyDescription")
                    : changeState.hasHead
                      ? t("versioning.alignedToHead")
                      : t("versioning.startHistoryDescription")}
                </p>
              </div>
            </div>
            <div className="versioning-metric-grid">
              <div className="versioning-metric">
                <span>{t("versioning.commitCountLabel")}</span>
                <strong>{commits.length}</strong>
              </div>
              <div className="versioning-metric">
                <span>{t("versioning.head")}</span>
                <strong>{headCommitId ? shortCommitId(headCommitId) : "-"}</strong>
              </div>
              <div className="versioning-metric">
                <span>{t("versioning.lastCommit")}</span>
                <strong>{latestCommit ? shortCommitId(latestCommit.id) : "-"}</strong>
              </div>
            </div>
          </section>

          {changeState.hasChanges ? (
            <section className="versioning-change-summary" data-testid="versioning-change-categories">
              <div>
                <strong>{t("versioning.uncommittedChanges")}</strong>
                <p>{t("versioning.workingCopyDirtyDescription")}</p>
              </div>
              <div className="versioning-category-list" aria-label={t("versioning.changedCategories")}>
                {changedCategoryKeys.map((key) => (
                  <span key={key} className="versioning-category-pill">
                    {t(`versioning.categories.${key}`)}
                  </span>
                ))}
              </div>
              <button type="button" className="mode-button active" onClick={onNewCommit}>
                {t("versioning.createCommit")}
              </button>
            </section>
          ) : changeState.hasHead ? (
            <section className="versioning-change-summary is-clean" data-testid="versioning-clean-summary">
              <StudioIcon name="success" aria-hidden="true" />
              <strong>{t("versioning.noChangesComparedToHead")}</strong>
              <span>{t("versioning.alignedToHead")}</span>
            </section>
          ) : null}

          {commits.length === 0 ? (
            <section className="versioning-empty versioning-empty-state" data-testid="versioning-empty">
              <StudioIcon name="history" aria-hidden="true" />
              <strong>
                {changeState.status === "no-head-with-content"
                  ? t("versioning.noHeadWithContent")
                  : t("versioning.noVersions")}
              </strong>
              <p>{t("versioning.startHistoryDescription")}</p>
              <button
                type="button"
                className="mode-button active"
                onClick={onNewCommit}
                disabled={!changeState.summary.canCommit}
              >
                {t("versioning.createFirstCommit")}
              </button>
            </section>
          ) : (
            <div className="versioning-dashboard-grid">
              <section className="versioning-timeline-shell" aria-label={t("versioning.versionHistory")}>
                <div className="versioning-section-heading">
                  <span>{t("versioning.versionHistory")}</span>
                  <strong>{t("versioning.commitCount", { count: commits.length })}</strong>
                </div>
                <ol className="versioning-timeline" data-testid="versioning-timeline">
                  {changeState.hasChanges ? (
                    <li className="versioning-working-copy-card">
                      <span className="versioning-timeline-node is-working" aria-hidden="true" />
                      <div>
                        <strong>{t("versioning.workingCopy")}</strong>
                        <p>{t("versioning.uncommittedChanges")}</p>
                      </div>
                    </li>
                  ) : null}
                  {commits.map((commit) => {
                    const tone = getCommitTone(commit);
                    const selected = selectedCommit?.id === commit.id;
                    const isHead = commit.id === headCommitId;
                    return (
                      <li key={commit.id} className="versioning-timeline-item">
                        <span className={`versioning-timeline-node is-${tone}${isHead ? " is-head" : ""}`} aria-hidden="true" />
                        <button
                          type="button"
                          className={[
                            "versioning-commit-card",
                            selected ? "versioning-commit-card--selected" : "",
                            commit.automatic ? "versioning-commit-card--automatic" : "",
                            tone === "backup" ? "versioning-commit-card--backup" : "",
                            tone === "restore" ? "versioning-commit-card--restore" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          onClick={() => setSelectedCommitId(commit.id)}
                          aria-current={selected ? "true" : undefined}
                          data-testid="versioning-commit-card"
                        >
                          <span className="versioning-commit-main">
                            <span className="versioning-commit-title-row">
                              <strong>{commit.message}</strong>
                              {isHead ? <span className="versioning-head-badge">{t("versioning.head")}</span> : null}
                              <span className={`versioning-type-badge is-${tone}`}>{t(getCommitToneLabelKey(tone))}</span>
                            </span>
                            <span className="versioning-commit-meta">
                              <span>{shortCommitId(commit.id)}</span>
                              <span>{formatCommitDate(commit.createdAt)}</span>
                            </span>
                            {commit.tags && commit.tags.length > 0 ? (
                              <span className="versioning-tag-row">
                                {commit.tags.map((tag) => (
                                  <span key={tag} className="versioning-tag-pill">{getCommitTagLabel(tag, t)}</span>
                                ))}
                              </span>
                            ) : null}
                          </span>
                        </button>
                        <div className="versioning-commit-inline-actions">
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
                          <button
                            type="button"
                            className="mode-button versioning-restore-action"
                            onClick={() => onRestoreCommit(commit.id)}
                            disabled={commit.id === headCommitId && !changeState.hasChanges}
                            data-testid="restore-commit"
                          >
                            {commit.id === headCommitId && !changeState.hasChanges
                              ? t("versioning.restore.alreadyCurrent")
                              : t("versioning.restore.restoreThisVersion")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>

              <aside className="versioning-detail-panel" data-testid="versioning-detail-panel">
                {selectedCommit ? (
                  <>
                    <div className="versioning-section-heading">
                      <span>{t("versioning.versionDetails")}</span>
                      {selectedCommit.id === headCommitId ? (
                        <strong className="versioning-head-badge">{t("versioning.head")}</strong>
                      ) : null}
                    </div>
                    <div className="versioning-detail-card">
                      <div className="versioning-detail-title">
                        <strong>{selectedCommit.message}</strong>
                        <span>{shortCommitId(selectedCommit.id)}</span>
                      </div>
                      {selectedCommit.description ? (
                        <p className="versioning-commit-description">{selectedCommit.description}</p>
                      ) : null}
                      <div className="versioning-detail-meta">
                        <span>{formatCommitDate(selectedCommit.createdAt)}</span>
                        <span>{t(getCommitToneLabelKey(getCommitTone(selectedCommit)))}</span>
                        <span>{selectedCommit.checksum.slice(0, 12)}</span>
                      </div>
                      <CommitStats commit={selectedCommit} />
                      <div className="versioning-action-bar">
                        <button
                          type="button"
                          className="header-button"
                          onClick={() => onCompareWithCurrent(selectedCommit.id)}
                          data-testid="compare-with-current"
                        >
                          {t("versioning.diff.compareWithCurrent")}
                        </button>
                        {selectedCommit.id !== headCommitId ? (
                          <button
                            type="button"
                            className="header-button"
                            onClick={() => onCompareWithHead(selectedCommit.id)}
                            data-testid="compare-with-head"
                          >
                            {t("versioning.diff.compareWithHead")}
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="mode-button versioning-restore-action"
                          onClick={() => onRestoreCommit(selectedCommit.id)}
                          disabled={selectedCommit.id === headCommitId && !changeState.hasChanges}
                          data-testid="restore-commit"
                        >
                          {selectedCommit.id === headCommitId && !changeState.hasChanges
                            ? t("versioning.restore.alreadyCurrent")
                            : t("versioning.restore.restoreThisVersion")}
                        </button>
                      </div>
                    </div>
                  </>
                ) : null}
              </aside>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
