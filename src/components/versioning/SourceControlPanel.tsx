import type { KeyboardEvent } from "react";
import { useI18n } from "../../i18n/useI18n";
import type { ProjectWorkspaceFile } from "../../types/projectExplorer";
import type { ProjectUncommittedChangeState } from "../../features/versioning/useProjectVersioning";
import type { ProjectCommit } from "../../features/versioning/projectCommitSnapshot";
import { StudioIcon } from "../icons/StudioIcon";

interface SourceControlPanelProps {
  projectName: string;
  commitMessage: string;
  changeState: ProjectUncommittedChangeState;
  files: Record<string, ProjectWorkspaceFile>;
  commits: ProjectCommit[];
  onCommitMessageChange: (value: string) => void;
  onCommit: () => void;
  onOpenHistory: () => void;
  onRefresh: () => void;
}

function getFileExtensionLabel(file: ProjectWorkspaceFile): string {
  if (file.kind === "schema") {
    return ".erschema";
  }
  if (file.kind === "sql") {
    return ".sql";
  }
  if (file.kind === "text") {
    return ".txt";
  }
  return "";
}

export function SourceControlPanel({
  projectName,
  commitMessage,
  changeState,
  files,
  commits,
  onCommitMessageChange,
  onCommit,
  onOpenHistory,
  onRefresh,
}: SourceControlPanelProps) {
  const { t } = useI18n();
  const canCommit = changeState.summary.canCommit && commitMessage.trim().length > 0;
  const changedFiles = Object.values(files).sort((left, right) => left.name.localeCompare(right.name));
  const visibleChanges = changeState.hasChanges ? changedFiles : [];

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && canCommit) {
      event.preventDefault();
      onCommit();
    }
  }

  return (
    <section className="source-control-panel" aria-label={t("sourceControl.title")}>
      <header className="source-control-header">
        <h2>{t("sourceControl.title")}</h2>
        <button type="button" className="source-control-icon-button" onClick={onRefresh} aria-label={t("sourceControl.refresh")}>
          <StudioIcon name="refresh" />
        </button>
      </header>

      <div className="source-control-section">
        <div className="source-control-section-title">
          <StudioIcon name="arrowDown" aria-hidden="true" />
          <span>{t("sourceControl.repositories")}</span>
        </div>
        <div className="source-control-repository">
          <StudioIcon name="openProject" aria-hidden="true" />
          <span className="source-control-repository-name">{projectName}</span>
          <button type="button" className="source-control-icon-button" onClick={onOpenHistory} aria-label={t("sourceControl.more")}>
            <StudioIcon name="menu" />
          </button>
        </div>
      </div>

      <div className="source-control-section source-control-section--grow">
        <div className="source-control-section-title">
          <StudioIcon name="arrowDown" aria-hidden="true" />
          <span>{t("sourceControl.changes")}</span>
          {changeState.hasChanges ? <span className="source-control-badge">{visibleChanges.length}</span> : null}
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
            <div className="source-control-change-group">{t("sourceControl.modified")}</div>
            {visibleChanges.map((file) => (
              <div className="source-control-change-item" key={file.id}>
                <StudioIcon name={file.kind === "schema" ? "entity" : file.kind === "sql" ? "database" : "fileText"} aria-hidden="true" />
                <span>{file.name}</span>
                <small>{getFileExtensionLabel(file)}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="source-control-empty">{t("sourceControl.noChanges")}</p>
        )}
      </div>

      <div className="source-control-section source-control-history">
        <div className="source-control-section-title">
          <StudioIcon name="arrowDown" aria-hidden="true" />
          <span>{t("sourceControl.graph")}</span>
          <span className="source-control-count">{t("versioning.commitCount", { count: commits.length })}</span>
        </div>
        {commits.length === 0 ? (
          <p className="source-control-empty">0 commit</p>
        ) : (
          <ol className="source-control-history-list">
            {commits.slice(0, 6).map((commit) => (
              <li key={commit.id}>
                <span className="source-control-history-dot" aria-hidden="true" />
                <span>{commit.message}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
