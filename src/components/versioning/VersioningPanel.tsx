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
  commitBusy?: boolean;
  commitError?: string;
  commitHint?: string;
  onClose: () => void;
  onCreateCommit: (message: string, description?: string) => Promise<boolean | void> | boolean | void;
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

function getPanelSubtitle(changeState: ProjectUncommittedChangeState, commitCount: number, t: ReturnType<typeof useI18n>["t"]) {
  if (commitCount === 0) {
    return t("versioning.panel.noCommitsCompact");
  }

  if (changeState.hasChanges) {
    return t("versioning.panel.subtitleDirty", { count: commitCount });
  }

  return t("versioning.panel.subtitleClean", { count: commitCount });
}

function WorkingCopyBanner({
  changeState,
  commitBusy,
  commitError,
  commitHint,
  formOpen,
  onOpenForm,
  onCancelForm,
  onCreateCommit,
}: {
  changeState: ProjectUncommittedChangeState;
  commitBusy: boolean;
  commitError: string;
  commitHint: string;
  formOpen: boolean;
  onOpenForm: () => void;
  onCancelForm: () => void;
  onCreateCommit: (message: string, description?: string) => Promise<boolean | void> | boolean | void;
}) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [description, setDescription] = useState("");
  const [localError, setLocalError] = useState("");
  const changedCategoryKeys = getChangedCategoryKeys(changeState.categories);

  useEffect(() => {
    if (!formOpen) {
      setMessage("");
      setDescription("");
      setLocalError("");
    }
  }, [formOpen]);

  if (!changeState.hasChanges && changeState.status !== "no-head-with-content") {
    return (
      <section className="versioning-compact-status is-clean" data-testid="versioning-clean-summary">
        <StudioIcon name="success" aria-hidden="true" />
        <div>
          <strong>{t("versioning.cleanWorkingCopy")}</strong>
          <p>{changeState.hasHead ? t("versioning.noChangesComparedToHead") : t("versioning.emptyProject")}</p>
        </div>
      </section>
    );
  }

  async function handleSubmit() {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setLocalError(t("versioning.messageRequired"));
      return;
    }

    setLocalError("");
    await onCreateCommit(trimmedMessage, description.trim() || undefined);
  }

  return (
    <section className="versioning-working-copy-banner" data-testid="versioning-uncommitted">
      <div className="versioning-working-copy-main">
        <StudioIcon name="warning" aria-hidden="true" />
        <div>
          <strong>
            {changeState.status === "no-head-with-content"
              ? t("versioning.noHeadWithContent")
              : t("versioning.uncommittedChanges")}
          </strong>
          <p>
            {changedCategoryKeys.length > 0
              ? changedCategoryKeys.map((key) => t(`versioning.categories.${key}`)).join(", ")
              : t("versioning.workingCopyDirtyDescription")}
          </p>
        </div>
      </div>
      {!formOpen ? (
        <button
          type="button"
          className="mode-button active"
          onClick={onOpenForm}
          disabled={!changeState.summary.canCommit}
          data-testid="open-inline-commit-form"
        >
          <StudioIcon name="history" aria-hidden="true" />
          {t("versioning.panel.createCommitInline")}
        </button>
      ) : (
        <div className="versioning-inline-commit-form" data-testid="inline-commit-form">
          <label>
            <span>{t("versioning.commitMessage")}</span>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={t("versioning.commitMessage")}
              disabled={commitBusy}
            />
          </label>
          <label>
            <span>{t("versioning.optionalDescription")}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              disabled={commitBusy}
            />
          </label>
          {commitHint ? <p className="versioning-inline-hint">{commitHint}</p> : null}
          {localError || commitError ? <p className="versioning-inline-error">{localError || commitError}</p> : null}
          <div className="versioning-inline-actions">
            <button type="button" className="header-button" onClick={onCancelForm} disabled={commitBusy}>
              {t("versioning.panel.cancelCommitInline")}
            </button>
            <button type="button" className="mode-button active" onClick={handleSubmit} disabled={commitBusy}>
              {t("versioning.createCommit")}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function VersionListItem({
  commit,
  headCommitId,
  changeState,
  onCompareWithCurrent,
  onCompareWithHead,
  onRestoreCommit,
}: {
  commit: ProjectCommit;
  headCommitId: string | null;
  changeState: ProjectUncommittedChangeState;
  onCompareWithCurrent: (commitId: string) => void;
  onCompareWithHead: (commitId: string) => void;
  onRestoreCommit: (commitId: string) => void;
}) {
  const { t } = useI18n();
  const isHead = commit.id === headCommitId;
  const tone = getCommitTone(commit);

  return (
    <li className={`versioning-list-item is-${tone}`} data-testid="versioning-commit-card">
      <div className="versioning-list-item-main">
        <div className="versioning-list-title-row">
          <strong title={commit.message}>{commit.message}</strong>
          {isHead ? <span className="versioning-head-badge">{t("versioning.panel.headBadge")}</span> : null}
          {tone !== "manual" ? <span className={`versioning-type-badge is-${tone}`}>{t(getCommitToneLabelKey(tone))}</span> : null}
        </div>
        {commit.description ? <p title={commit.description}>{commit.description}</p> : null}
        <span className="versioning-list-meta">
          {shortCommitId(commit.id)} - {formatCommitDate(commit.createdAt)}
        </span>
      </div>
      <div className="versioning-list-actions">
        <button
          type="button"
          className="header-button"
          onClick={() => onCompareWithCurrent(commit.id)}
          data-testid="compare-with-current"
        >
          {t("versioning.panel.compare")}
        </button>
        {!isHead ? (
          <button
            type="button"
            className="header-button"
            onClick={() => onCompareWithHead(commit.id)}
            data-testid="compare-with-head"
          >
            {t("versioning.panel.compareWithHead")}
          </button>
        ) : null}
        <button
          type="button"
          className="mode-button versioning-restore-action"
          onClick={() => onRestoreCommit(commit.id)}
          disabled={isHead && !changeState.hasChanges}
          data-testid="restore-commit"
        >
          {isHead && !changeState.hasChanges ? t("versioning.restore.alreadyCurrent") : t("versioning.panel.restore")}
        </button>
      </div>
    </li>
  );
}

export function VersioningPanel({
  open,
  commits,
  headCommitId,
  changeState,
  commitBusy = false,
  commitError = "",
  commitHint = "",
  onClose,
  onCreateCommit,
  onCompareWithCurrent,
  onCompareWithHead,
  onRestoreCommit,
}: VersioningPanelProps) {
  const { t } = useI18n();
  const [inlineFormOpen, setInlineFormOpen] = useState(false);
  const subtitle = useMemo(() => getPanelSubtitle(changeState, commits.length, t), [changeState, commits.length, t]);

  useEffect(() => {
    if (!open) {
      setInlineFormOpen(false);
    }
  }, [open]);

  async function handleCreateCommit(message: string, description?: string) {
    const result = await onCreateCommit(message, description);
    if (result !== false) {
      setInlineFormOpen(false);
    }
  }

  if (!open) {
    return null;
  }

  return (
    <div className="studio-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="studio-modal versioning-panel versioning-panel-compact"
        role="dialog"
        aria-modal="true"
        aria-labelledby="versioning-panel-title"
        aria-describedby="versioning-panel-description"
        onClick={(event) => event.stopPropagation()}
        data-testid="versioning-panel"
      >
        <div className="studio-modal__header versioning-panel-compact-header">
          <div>
            <h2 id="versioning-panel-title" className="studio-modal__title">
              {t("versioning.panel.title")}
            </h2>
            <p
              id="versioning-panel-description"
              className={changeState.hasChanges ? "studio-modal__subtitle versioning-unsaved" : "studio-modal__subtitle versioning-clean"}
              data-testid={changeState.hasChanges ? "versioning-uncommitted-subtitle" : "versioning-clean"}
            >
              {subtitle}
            </p>
          </div>
          <button type="button" className="studio-modal__close" onClick={onClose} aria-label={t("common.actions.close")}>
            <StudioIcon name="close" aria-hidden="true" />
          </button>
        </div>

        <div className="studio-modal__body versioning-panel-compact-body">
          <WorkingCopyBanner
            changeState={changeState}
            commitBusy={commitBusy}
            commitError={commitError}
            commitHint={commitHint}
            formOpen={inlineFormOpen}
            onOpenForm={() => setInlineFormOpen(true)}
            onCancelForm={() => setInlineFormOpen(false)}
            onCreateCommit={handleCreateCommit}
          />

          <section className="versioning-list-section" aria-label={t("versioning.versionHistory")}>
            <div className="versioning-compact-section-title">
              <span>{t("versioning.versionHistory")}</span>
              <strong>{t("versioning.commitCount", { count: commits.length })}</strong>
            </div>
            {commits.length === 0 ? (
              <div className="versioning-empty versioning-empty-state" data-testid="versioning-empty">
                <StudioIcon name="history" aria-hidden="true" />
                <strong>{t("versioning.panel.noCommitsCompact")}</strong>
                <p>{t("versioning.startHistoryDescription")}</p>
              </div>
            ) : (
              <ol className="versioning-list" data-testid="versioning-timeline">
                {commits.map((commit) => (
                  <VersionListItem
                    key={commit.id}
                    commit={commit}
                    headCommitId={headCommitId}
                    changeState={changeState}
                    onCompareWithCurrent={onCompareWithCurrent}
                    onCompareWithHead={onCompareWithHead}
                    onRestoreCommit={onRestoreCommit}
                  />
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
