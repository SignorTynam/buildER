import { useRef } from "react";
import type { LogicalIssue } from "../../types/logical";
import type { SqlReverseIssue } from "../../types/sqlReverse";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface SqlReversePanelProps {
  sql: string;
  errorMessage: string;
  issues: SqlReverseIssue[];
  logicalIssues: LogicalIssue[];
  tableCount: number;
  unsupportedStatementCount: number;
  isPreviewReady: boolean;
  onSqlChange: (value: string) => void;
  onAnalyze: () => void;
  onLoadFile: (file: File) => void;
  onClear: () => void;
}

function formatIssue(issue: SqlReverseIssue | LogicalIssue): string {
  return issue.message;
}

export function SqlReversePanel({
  sql,
  errorMessage,
  issues,
  logicalIssues,
  tableCount,
  unsupportedStatementCount,
  isPreviewReady,
  onSqlChange,
  onAnalyze,
  onLoadFile,
  onClear,
}: SqlReversePanelProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const visibleIssues = [...issues, ...logicalIssues];

  return (
    <section className="sql-reverse-panel" aria-label={t("sqlReversePanel.title")}>
      <header className="sql-reverse-panel__header">
        <h2>{t("sqlReversePanel.title")}</h2>
        <button type="button" className="project-activity-action compact" onClick={() => fileInputRef.current?.click()}>
          <StudioIcon name="upload" aria-hidden="true" />
          <span>{t("sqlReversePanel.importFile")}</span>
        </button>
        <input
          ref={fileInputRef}
          className="hidden-input"
          type="file"
          accept=".sql,text/sql,text/plain"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (file) {
              onLoadFile(file);
            }
          }}
        />
      </header>

      <textarea
        className="sql-reverse-panel__editor"
        value={sql}
        onChange={(event) => onSqlChange(event.target.value)}
        placeholder={t("sqlReversePanel.placeholder")}
        spellCheck={false}
      />

      <div className="sql-reverse-panel__meta">
        <span>{t("sqlReversePanel.tables", { count: tableCount })}</span>
        {unsupportedStatementCount > 0 ? (
          <span>{t("sqlReversePanel.unsupported", { count: unsupportedStatementCount })}</span>
        ) : null}
        {isPreviewReady ? <span>{t("sqlReversePanel.previewReady")}</span> : null}
      </div>

      {errorMessage ? <p className="sql-reverse-panel__error">{errorMessage}</p> : null}
      {visibleIssues.length > 0 ? (
        <div className="sql-reverse-panel__issues">
          {visibleIssues.map((issue) => (
            <p key={issue.id} className={`sql-reverse-panel__issue level-${issue.level}`}>
              <StudioIcon name={issue.level === "error" ? "error" : "warning"} aria-hidden="true" />
              <span>{formatIssue(issue)}</span>
            </p>
          ))}
        </div>
      ) : null}

      <footer className="sql-reverse-panel__footer">
        <button type="button" className="project-activity-action" onClick={onClear}>
          <StudioIcon name="delete" aria-hidden="true" />
          <span>{t("sqlReversePanel.clear")}</span>
        </button>
        <button type="button" className="project-activity-action primary" onClick={onAnalyze} disabled={sql.trim().length === 0}>
          <StudioIcon name="databaseReverse" aria-hidden="true" />
          <span>{t("sqlReversePanel.analyze")}</span>
        </button>
      </footer>
    </section>
  );
}
