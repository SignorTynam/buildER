import { useState, type KeyboardEvent } from "react";
import { useI18n } from "../../i18n/useI18n";
import type {
  ProjectFileChange,
  ProjectUncommittedChangeState,
} from "../../features/versioning/useProjectVersioning";
import type { ProjectCommit } from "../../features/versioning/projectCommitSnapshot";
import { StudioIcon } from "../icons/StudioIcon";

interface SourceControlPanelProps {
  projectName: string;
  commitMessage: string;
  changeState: ProjectUncommittedChangeState;
  commits: ProjectCommit[];
  headCommitId: string | null;
  selectedCommitId: string | null;
  onCommitMessageChange: (value: string) => void;
  onCommit: () => void;
  onRefresh: () => void;
  onSelectCommit: (commitId: string | null) => void;
  onCompareWithCurrent: (commitId: string) => void;
  onCompareWithHead: (commitId: string) => void;
  onCompareWithParent: (commitId: string) => void;
  onRestoreCommit: (commitId: string) => void;
  onDeleteCommit: (commitId: string) => void;
  onClose?: () => void;
  closeLabel?: string;
}

type PendingAction = { kind: "restore" | "delete"; commitId: string } | null;

function formatCommitDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function shortCommitId(id: string | null | undefined) {
  return id ? id.slice(0, 8) : "-";
}

function getChangeStatusLabel(change: ProjectFileChange): string {
  switch (change.status) {
    case "added":
      return "A";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    case "modified":
    default:
      return "M";
  }
}

function getChangeIconName(change: ProjectFileChange) {
  if (change.kind === "schema") {
    return "entity";
  }
  if (change.kind === "sql") {
    return "database";
  }
  return "fileText";
}

export function SourceControlPanel({
  projectName,
  commitMessage,
  changeState,
  commits,
  headCommitId,
  selectedCommitId,
  onCommitMessageChange,
  onCommit,
  onRefresh,
  onSelectCommit,
  onCompareWithCurrent,
  onCompareWithHead,
  onCompareWithParent,
  onRestoreCommit,
  onDeleteCommit,
  onClose,
  closeLabel,
}: SourceControlPanelProps) {
  const { t } = useI18n();
  const [historyCollapsed, setHistoryCollapsed] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const canCommit = changeState.summary.canCommit && commitMessage.trim().length > 0;
  const selectedCommit = commits.find((commit) => commit.id === selectedCommitId) ?? null;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canCommit) {
      event.preventDefault();
      onCommit();
    }
  }

  function handleConfirmPendingAction() {
    if (!pendingAction) {
      return;
    }

    if (pendingAction.kind === "restore") {
      onRestoreCommit(pendingAction.commitId);
    } else {
      onDeleteCommit(pendingAction.commitId);
    }
    setPendingAction(null);
  }

  return (
    <section className="source-control-panel" aria-label={t("sourceControl.title")}>
      <header className="source-control-header">
        <h2>{t("sourceControl.title")}</h2>
        <div className="project-activity-section__header-actions">
          <button type="button" className="source-control-icon-button" onClick={onRefresh} aria-label={t("sourceControl.refresh")}>
            <StudioIcon name="refresh" />
          </button>
          {onClose ? (
            <button type="button" className="project-activity-header-close" onClick={onClose} aria-label={closeLabel ?? t("workspaceActivity.closePanel")}>
              <StudioIcon name="close" />
            </button>
          ) : null}
        </div>
      </header>

      <div className="source-control-section">
        <div className="source-control-section-title">
          <StudioIcon name="arrowDown" aria-hidden="true" />
          <span>{t("sourceControl.repositories")}</span>
        </div>
        <div className="source-control-repository">
          <StudioIcon name="branch" aria-hidden="true" />
          <span className="source-control-repository-name">{projectName}</span>
          <button type="button" className="source-control-icon-button" onClick={onRefresh} aria-label={t("sourceControl.more")}>
            <StudioIcon name="menu" />
          </button>
        </div>
      </div>

      <div className="source-control-section source-control-changes">
        <div className="source-control-section-title">
          <StudioIcon name="arrowDown" aria-hidden="true" />
          <span>{t("sourceControl.changes")}</span>
          {changeState.hasChanges ? <span className="source-control-badge">{changeState.files.length}</span> : null}
        </div>
        <textarea
          className="source-control-commit-input"
          value={commitMessage}
          onChange={(event) => onCommitMessageChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("sourceControl.commitPlaceholder", { project: projectName })}
          rows={2}
        />
        <button type="button" className="source-control-commit-button" onClick={onCommit} disabled={!canCommit}>
          <StudioIcon name="done" aria-hidden="true" />
          <span>{commits.length === 0 ? t("sourceControl.createFirstCommit") : t("sourceControl.commit")}</span>
        </button>

        {changeState.hasChanges ? (
          <div className="source-control-change-list">
            {changeState.files.length === 0 ? (
              <div className="source-control-change-item">
                <StudioIcon name="openProject" aria-hidden="true" />
                <span>{projectName}</span>
                <small>M</small>
              </div>
            ) : (
              changeState.files.map((file) => (
                <div className={`source-control-change-item is-${file.status}`} key={`${file.status}-${file.fileId}`}>
                  <StudioIcon name={getChangeIconName(file)} aria-hidden="true" />
                  <span title={file.previousName ? `${file.previousName} -> ${file.name}` : file.name}>{file.name}</span>
                  <small>{getChangeStatusLabel(file)}</small>
                </div>
              ))
            )}
          </div>
        ) : (
          <p className="source-control-empty">{t("sourceControl.noChanges")}</p>
        )}
      </div>

      <div className="source-control-section source-control-history">
        <div className="source-control-section-title source-control-history-header">
          <button
            type="button"
            className="source-control-disclosure"
            onClick={() => setHistoryCollapsed((current) => !current)}
            aria-expanded={!historyCollapsed}
            aria-label={historyCollapsed ? "Expand history" : "Collapse history"}
          >
            <StudioIcon name={historyCollapsed ? "arrowRight" : "arrowDown"} aria-hidden="true" />
          </button>
          <span>{t("sourceControl.graph")}</span>
          <span className="source-control-count">{t("versioning.commitCount", { count: commits.length })}</span>
          <button type="button" className="source-control-icon-button" onClick={onRefresh} aria-label={t("sourceControl.refresh")}>
            <StudioIcon name="refresh" />
          </button>
        </div>

        {!historyCollapsed ? (
          commits.length === 0 ? (
            <p className="source-control-empty">0 commit</p>
          ) : (
            <div className="source-control-history-scroll" data-testid="source-control-history-scroll">
              <ol className="source-control-history-list">
                {commits.map((commit) => {
                  const isHead = commit.id === headCommitId;
                  const selected = commit.id === selectedCommitId;
                  return (
                    <li key={commit.id}>
                      <button
                        type="button"
                        className={`source-control-graph-row${isHead ? " is-head" : ""}${selected ? " is-selected" : ""}`}
                        onClick={() => {
                          setPendingAction(null);
                          onSelectCommit(commit.id);
                        }}
                        aria-pressed={selected}
                        aria-label={`Select commit ${shortCommitId(commit.id)} ${commit.message}`}
                      >
                        <span className="source-control-graph-rail" aria-hidden="true">
                          <span className="source-control-graph-line" />
                          <span className="source-control-graph-node" />
                        </span>
                        <span className="source-control-graph-main">
                          <span className="source-control-graph-title" title={commit.message}>{commit.message}</span>
                          <span className="source-control-graph-meta">
                            {shortCommitId(commit.id)}
                            {isHead ? <span className="source-control-branch-pill">HEAD</span> : null}
                            {isHead ? <span className="source-control-branch-pill">main</span> : null}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          )
        ) : null}

        {selectedCommit ? (
          <div className="source-control-commit-details" data-testid="source-control-commit-details">
            <strong title={selectedCommit.message}>{selectedCommit.message}</strong>
            <dl>
              <div><dt>ID</dt><dd>{shortCommitId(selectedCommit.id)}</dd></div>
              <div><dt>Parent</dt><dd>{shortCommitId(selectedCommit.parentId)}</dd></div>
              <div><dt>Date</dt><dd>{formatCommitDate(selectedCommit.createdAt)}</dd></div>
              <div><dt>Stats</dt><dd>{selectedCommit.stats.entityCount} ER, {selectedCommit.stats.tableCount ?? 0} tables</dd></div>
            </dl>
            <div className="source-control-commit-actions">
              <button type="button" className="source-control-action-button" onClick={() => onCompareWithCurrent(selectedCommit.id)}>
                Compare current
              </button>
              <button type="button" className="source-control-action-button" onClick={() => onCompareWithHead(selectedCommit.id)} disabled={!headCommitId || selectedCommit.id === headCommitId}>
                Compare HEAD
              </button>
              <button type="button" className="source-control-action-button" onClick={() => onCompareWithParent(selectedCommit.id)} disabled={!selectedCommit.parentId}>
                Compare previous
              </button>
              <button type="button" className="source-control-action-button" onClick={() => setPendingAction({ kind: "restore", commitId: selectedCommit.id })}>
                Restore
              </button>
              <button type="button" className="source-control-action-button is-danger" onClick={() => setPendingAction({ kind: "delete", commitId: selectedCommit.id })}>
                Delete commit
              </button>
            </div>
            {pendingAction?.commitId === selectedCommit.id ? (
              <div className="source-control-inline-confirm" role="alert">
                <span>
                  {pendingAction.kind === "restore"
                    ? "Restore the working tree to this commit?"
                    : "Delete this commit from history?"}
                </span>
                <button type="button" className="source-control-action-button" onClick={() => setPendingAction(null)}>
                  Cancel
                </button>
                <button type="button" className="source-control-action-button is-danger" onClick={handleConfirmPendingAction}>
                  {pendingAction.kind === "restore" ? "Restore" : "Delete commit"}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
