import type { ChangeEvent } from "react";
import type { LogicalIssue } from "../types/logical";
import type { SqlReverseIssue } from "../types/sqlReverse";
import { StudioIcon } from "./icons/StudioIcon";
import { WarningCard } from "./panels";

interface SqlReverseInputModalProps {
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
  onCancel: () => void;
}

const MAX_VISIBLE_ISSUES = 8;

function formatIssue(issue: SqlReverseIssue | LogicalIssue): string {
  return `${issue.level.toUpperCase()} - ${issue.code}`;
}

export function SqlReverseInputModal({
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
  onCancel,
}: SqlReverseInputModalProps) {
  const visibleSqlIssues = issues.slice(0, MAX_VISIBLE_ISSUES);
  const visibleLogicalIssues = logicalIssues.slice(0, MAX_VISIBLE_ISSUES);
  const warningCount = issues.filter((issue) => issue.level === "warning").length + logicalIssues.filter((issue) => issue.level === "warning").length;

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onLoadFile(file);
    }
    event.target.value = "";
  }

  return (
    <div className="studio-modal-backdrop sql-reverse-modal-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="studio-modal sql-reverse-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sql-reverse-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="studio-modal__header sql-reverse-modal__header">
          <div>
            <div className="sql-reverse-modal__title-row">
              <h2 id="sql-reverse-modal-title" className="studio-modal__title">Reverse Engineering SQL</h2>
              <span className="sql-reverse-beta-note">Beta</span>
            </div>
            <p className="studio-modal__subtitle sql-reverse-modal__subtitle">
              Questa feature è in beta. Al momento supporta solo istruzioni CREATE TABLE. Altri costrutti SQL saranno supportati nella versione finale.
            </p>
          </div>
          <button type="button" className="studio-modal__close" onClick={onCancel} aria-label="Chiudi workflow SQL reverse">
            <StudioIcon name="close" aria-hidden="true" />
          </button>
        </div>

        <div className="studio-modal__body sql-reverse-modal__body">
          <label className="sql-reverse-modal__label" htmlFor="sql-reverse-workflow-source">
            Schema SQL
          </label>
          <textarea
            id="sql-reverse-workflow-source"
            className="sql-reverse-modal__textarea"
            aria-label="Schema SQL CREATE TABLE"
            value={sql}
            onChange={(event) => onSqlChange(event.target.value)}
            placeholder={"CREATE TABLE Student (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);"}
            spellCheck={false}
            autoFocus
          />

          {errorMessage ? <WarningCard type="error">{errorMessage}</WarningCard> : null}

          {isPreviewReady && warningCount > 0 && !errorMessage ? (
            <WarningCard type="warning">SQL analizzato con {warningCount} warning non bloccanti.</WarningCard>
          ) : null}

          {isPreviewReady && !errorMessage ? (
            <div className="sql-reverse-modal__summary" aria-label="Riepilogo analisi SQL">
              <span><strong>{tableCount}</strong> tabelle</span>
              <span><strong>{unsupportedStatementCount}</strong> statement non supportati</span>
              <span><strong>{issues.length}</strong> issue SQL</span>
              <span><strong>{logicalIssues.length}</strong> issue logiche</span>
            </div>
          ) : null}

          {visibleSqlIssues.length > 0 ? (
            <div className="sql-reverse-modal__issues" aria-label="Issue SQL">
              {visibleSqlIssues.map((issue) => (
                <WarningCard key={issue.id} type={issue.level}>
                  <span className="sql-reverse-modal__issue-copy">
                    <strong>{formatIssue(issue)}</strong>
                    <span>{issue.message}</span>
                  </span>
                </WarningCard>
              ))}
            </div>
          ) : null}

          {visibleLogicalIssues.length > 0 ? (
            <div className="sql-reverse-modal__issues" aria-label="Issue logiche">
              {visibleLogicalIssues.map((issue) => (
                <WarningCard key={issue.id} type={issue.level}>
                  <span className="sql-reverse-modal__issue-copy">
                    <strong>{formatIssue(issue)}</strong>
                    <span>{issue.message}</span>
                  </span>
                </WarningCard>
              ))}
            </div>
          ) : null}
        </div>

        <div className="studio-modal__footer sql-reverse-modal__actions">
          <label className="header-button sql-reverse-modal__file-button">
            <StudioIcon name="upload" aria-hidden="true" />
            Carica .sql
            <input
              type="file"
              accept=".sql,text/plain,application/sql"
              className="sql-reverse-file-input"
              aria-label="Carica file SQL"
              onChange={handleFileChange}
            />
          </label>
          <button type="button" className="header-button" onClick={onClear}>
            <StudioIcon name="reset" aria-hidden="true" />
            Pulisci
          </button>
          <span className="sql-reverse-modal__action-spacer" />
          <button type="button" className="header-button" onClick={onCancel}>
            Annulla
          </button>
          <button type="button" className="mode-button active" onClick={onAnalyze}>
            <StudioIcon name="databaseReverse" aria-hidden="true" />
            Analizza SQL
          </button>
        </div>
      </div>
    </div>
  );
}
