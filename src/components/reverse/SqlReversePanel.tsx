import { useId, useRef, useState } from "react";
import type { LogicalIssue } from "../../types/logical";
import type { EditorDiagnostic } from "../../types/editor";
import type { SqlReverseDialect, SqlReverseIssue, SqlUnsupportedStatement } from "../../types/sqlReverse";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";
import { CodeEditorSurface, type CodeEditorSurfaceHandle } from "../editor/CodeEditorSurface";
import { Badge, Tooltip, type BadgeTone } from "../ui";
import { PanelIconButton, WorkspacePanel, WorkspacePanelHeader } from "../workspace/WorkspacePanel";
import { SQL_REVERSE_DIALECTS } from "../../utils/sqlReverseDialectPreference";
import { getSqlReverseIssueCategory, type SqlReverseIssueCategory } from "../../utils/sqlReverseIssueCatalog";

/**
 * Fase K4 — il tono del badge rende visibile la distinzione chiave: rosso = problema nel TUO SQL,
 * neutro = costrutto senza equivalente ER (ignorato), giallo = il parser ha recuperato.
 */
const ISSUE_CATEGORY_TONE: Record<SqlReverseIssueCategory, BadgeTone> = {
  "sql-error": "danger",
  "tool-limit": "neutral",
  "parser-recovery": "warning",
};

interface SqlReversePanelProps {
  sql: string;
  errorMessage: string;
  issues: SqlReverseIssue[];
  logicalIssues: LogicalIssue[];
  tableCount: number;
  unsupportedStatementCount: number;
  /** Opzionale: assente equivale a "nessuno" (stessa prassi di `diagnostics` in CodeEditorSurface). */
  unsupportedStatements?: SqlUnsupportedStatement[];
  isPreviewReady: boolean;
  sourceFileName?: string;
  dialect: SqlReverseDialect;
  onDialectChange: (dialect: SqlReverseDialect) => void;
  onSqlChange: (value: string) => void;
  onAnalyze: () => void;
  onLoadFile: (file: File) => void;
  onClear: () => void;
  onClose?: () => void;
  closeLabel?: string;
}

/** Riga 1-based a partire da un offset nel sorgente (gli span degli statement non supportati
 * portano solo start/end). Riusata anche dal salto alla riga (K3). */
function sqlLineForOffset(source: string, offset?: number): number | undefined {
  if (offset == null || offset < 0) {
    return undefined;
  }
  return source.slice(0, offset).split(/\r?\n/).length;
}

function buildDiagnostics(
  errorMessage: string,
  issues: SqlReverseIssue[],
  logicalIssues: LogicalIssue[],
): EditorDiagnostic[] {
  const diagnostics: EditorDiagnostic[] = [
    ...issues.map((issue) => ({
      id: issue.id,
      level: issue.level,
      message: issue.message,
      line: issue.sourceSpan?.line,
      column: issue.sourceSpan?.column,
      startOffset: issue.sourceSpan?.start,
      endOffset: issue.sourceSpan?.end,
    })),
    ...logicalIssues.map((issue) => ({
      id: `logical:${issue.id}`,
      level: issue.level,
      message: issue.message,
    })),
  ];
  if (errorMessage && !diagnostics.some((diagnostic) => diagnostic.level === "error" && diagnostic.message === errorMessage)) {
    diagnostics.unshift({ id: "sql-reverse-error", level: "error", message: errorMessage });
  }
  return diagnostics;
}

export function SqlReversePanel({
  sql,
  errorMessage,
  issues,
  logicalIssues,
  tableCount,
  unsupportedStatementCount,
  unsupportedStatements = [],
  isPreviewReady,
  sourceFileName,
  dialect,
  onDialectChange,
  onSqlChange,
  onAnalyze,
  onLoadFile,
  onClear,
  onClose,
  closeLabel,
}: SqlReversePanelProps) {
  const { t } = useI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const editorHandleRef = useRef<CodeEditorSurfaceHandle | null>(null);
  const dialectSelectId = useId();
  const unsupportedListId = useId();
  const issueListId = useId();
  const [unsupportedOpen, setUnsupportedOpen] = useState(false);
  const [issuesOpen, setIssuesOpen] = useState(false);
  const diagnostics = buildDiagnostics(errorMessage, issues, logicalIssues);
  const lineCount = Math.max(1, sql.split(/\r?\n/).length);
  const hasUnsupported = unsupportedStatements.length > 0;

  return (
    <WorkspacePanel className="sql-reverse-panel" label={t("sqlReversePanel.title")}>
      <WorkspacePanelHeader
        title={t("sqlReversePanel.title")}
        badge={diagnostics.length || undefined}
        badgeLabel={diagnostics.length ? t("codeEditor.diagnostic.count", { count: diagnostics.length }) : undefined}
        onClose={onClose}
        closeLabel={closeLabel ?? t("workspaceActivity.closePanel")}
      >
        <PanelIconButton
          icon="upload"
          label={t("sqlReversePanel.importFile")}
          onClick={() => fileInputRef.current?.click()}
        />
        <input
          ref={fileInputRef}
          className="hidden-input"
          type="file"
          accept=".sql,text/sql,text/plain"
          aria-label={t("sqlReversePanel.importFile")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (file) onLoadFile(file);
          }}
        />
      </WorkspacePanelHeader>

      <div className="sql-reverse-panel__toolbar">
        <label htmlFor={dialectSelectId} className="sql-reverse-panel__dialect-label">
          {t("sqlReversePanel.dialect.label")}
        </label>
        <Tooltip label={t("sqlReversePanel.dialect.hint")} position="bottom" className="sql-reverse-panel__dialect-tip">
          {({ "aria-describedby": describedBy }) => (
            <select
              id={dialectSelectId}
              className="ui-select sql-reverse-panel__dialect-select"
              value={dialect}
              aria-describedby={describedBy}
              onChange={(event) => onDialectChange(event.target.value as SqlReverseDialect)}
            >
              {SQL_REVERSE_DIALECTS.map((value) => (
                <option key={value} value={value}>
                  {t(`sqlReversePanel.dialect.options.${value}`)}
                </option>
              ))}
            </select>
          )}
        </Tooltip>
      </div>

      <div className="sql-reverse-panel__editor-surface">
        <CodeEditorSurface
          ref={editorHandleRef}
          value={sql}
          language="sql"
          readOnly={false}
          onChange={onSqlChange}
          placeholder={t("sqlReversePanel.placeholder")}
          ariaLabel={t("codeEditor.sqlReverseAria")}
          diagnostics={diagnostics}
        />
      </div>

      <div className="sql-reverse-panel__meta" aria-label={t("codeEditor.status")}>
        <span>{t("workspaceChrome.lineCount", { count: lineCount })}</span>
        <span>{sourceFileName ?? t("codeEditor.draftUnbound")}</span>
        {isPreviewReady ? <span>{t("sqlReversePanel.tables", { count: tableCount })}</span> : null}
        {hasUnsupported ? (
          <button
            type="button"
            className={unsupportedOpen ? "sql-reverse-panel__meta-toggle is-open" : "sql-reverse-panel__meta-toggle"}
            aria-expanded={unsupportedOpen}
            aria-controls={unsupportedListId}
            onClick={() => setUnsupportedOpen((open) => !open)}
          >
            <StudioIcon name="arrowRight" aria-hidden="true" />
            <span>{t("sqlReversePanel.unsupported", { count: unsupportedStatements.length })}</span>
          </button>
        ) : null}
        {issues.length > 0 ? (
          <button
            type="button"
            className={issuesOpen ? "sql-reverse-panel__meta-toggle is-open" : "sql-reverse-panel__meta-toggle"}
            aria-expanded={issuesOpen}
            aria-controls={issueListId}
            onClick={() => setIssuesOpen((open) => !open)}
          >
            <StudioIcon name="arrowRight" aria-hidden="true" />
            <span>{t("sqlReversePanel.issueList.toggle", { count: issues.length })}</span>
          </button>
        ) : diagnostics.length > 0 ? (
          <span>{t("codeEditor.diagnostic.count", { count: diagnostics.length })}</span>
        ) : null}
      </div>

      {hasUnsupported && unsupportedOpen ? (
        <section
          id={unsupportedListId}
          className="sql-reverse-panel__unsupported"
          aria-label={t("sqlReversePanel.unsupportedList.title")}
        >
          <p className="sql-reverse-panel__unsupported-intro">{t("sqlReversePanel.unsupportedList.intro")}</p>
          <ul className="sql-reverse-panel__unsupported-list">
            {unsupportedStatements.map((statement) => {
              const line = statement.sourceSpan?.line ?? sqlLineForOffset(sql, statement.sourceSpan?.start);
              return (
                <li key={statement.id} className="sql-reverse-panel__unsupported-item">
                  <div className="sql-reverse-panel__unsupported-head">
                    <Badge tone="warning">{t(`sqlReversePanel.unsupportedList.kinds.${statement.kind}`)}</Badge>
                    {line ? (
                      <button
                        type="button"
                        className="sql-reverse-panel__jump-line"
                        onClick={() => editorHandleRef.current?.revealLine(line)}
                        aria-label={t("sqlReversePanel.unsupportedList.goToLine", { line })}
                      >
                        {t("sqlReversePanel.unsupportedList.lineLabel", { line })}
                      </button>
                    ) : null}
                  </div>
                  <code className="sql-reverse-panel__fragment">{statement.raw}</code>
                  <p className="sql-reverse-panel__unsupported-reason">
                    {t(`sqlReversePanel.unsupportedList.reasons.${statement.kind}`)}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {issues.length > 0 && issuesOpen ? (
        <section
          id={issueListId}
          className="sql-reverse-panel__issues"
          aria-label={t("sqlReversePanel.issueList.title")}
        >
          <ul className="sql-reverse-panel__issue-list">
            {issues.map((issue) => {
              const category = getSqlReverseIssueCategory(issue.code);
              const line = issue.sourceSpan?.line ?? sqlLineForOffset(sql, issue.sourceSpan?.start);
              return (
                <li key={issue.id} className="sql-reverse-panel__issue-item">
                  <div className="sql-reverse-panel__issue-head">
                    <Badge tone={ISSUE_CATEGORY_TONE[category]}>
                      {t(`sqlReversePanel.issueList.categories.${category}`)}
                    </Badge>
                    {line ? (
                      <button
                        type="button"
                        className="sql-reverse-panel__jump-line"
                        onClick={() => editorHandleRef.current?.revealLine(line)}
                        aria-label={t("sqlReversePanel.unsupportedList.goToLine", { line })}
                      >
                        {t("sqlReversePanel.unsupportedList.lineLabel", { line })}
                      </button>
                    ) : null}
                  </div>
                  <p className="sql-reverse-panel__issue-title">
                    {t(`sqlReversePanel.issueList.codes.${issue.code}.title`)}
                  </p>
                  <p className="sql-reverse-panel__issue-explanation">
                    {t(`sqlReversePanel.issueList.codes.${issue.code}.explanation`)}
                  </p>
                  {issue.rawFragment ? (
                    <code className="sql-reverse-panel__fragment">{issue.rawFragment}</code>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <footer className="sql-reverse-panel__footer">
        <button type="button" className="project-activity-action" onClick={onClear}>
          <StudioIcon name="delete" aria-hidden="true" />
          <span>{t("sqlReversePanel.clear")}</span>
        </button>
        <button type="button" className="project-activity-action primary" onClick={() => onAnalyze()} disabled={sql.trim().length === 0}>
          <StudioIcon name="databaseReverse" aria-hidden="true" />
          <span>{t("sqlReversePanel.analyze")}</span>
        </button>
      </footer>
    </WorkspacePanel>
  );
}
