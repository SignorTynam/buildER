import type { ChangeEvent } from "react";
import type { SqlReverseIssue } from "../types/sqlReverse";
import type { LogicalIssue } from "../types/logical";
import { PanelSection, WarningCard } from "./panels";

interface SqlReversePanelProps {
  sql: string;
  issues: SqlReverseIssue[];
  logicalIssues?: LogicalIssue[];
  logicalIssueCount: number;
  tableCount: number;
  unsupportedStatementCount: number;
  canApply: boolean;
  isPreviewReady: boolean;
  onSqlChange: (value: string) => void;
  onParsePreview: () => void;
  onApply: () => void;
  onLoadFile: (file: File) => void;
  onClear: () => void;
}

const MAX_VISIBLE_ISSUES = 12;

function truncateFragment(value: string): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > 160 ? `${compact.slice(0, 157)}...` : compact;
}

function formatIssueLabel(issue: SqlReverseIssue): string {
  return `${issue.level.toUpperCase()} - ${issue.code}`;
}

export function SqlReversePanel({
  sql,
  issues,
  logicalIssues = [],
  logicalIssueCount,
  tableCount,
  unsupportedStatementCount,
  canApply,
  isPreviewReady,
  onSqlChange,
  onParsePreview,
  onApply,
  onLoadFile,
  onClear,
}: SqlReversePanelProps) {
  const blockingErrors = issues.filter((issue) => issue.level === "error");
  const warnings = issues.filter((issue) => issue.level === "warning");
  const visibleIssues = issues.slice(0, MAX_VISIBLE_ISSUES);
  const hiddenIssueCount = Math.max(0, issues.length - visibleIssues.length);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      onLoadFile(file);
    }
    event.target.value = "";
  }

  return (
    <div className="sql-reverse-panel">
      <PanelSection
        title="Reverse Engineering SQL"
        subtitle="Incolla uno schema SQL CREATE TABLE e genera automaticamente un diagramma ER."
        className="technical-dock-section sql-reverse-section"
      >
        <label className="sql-reverse-editor-label" htmlFor="sql-reverse-source">
          Schema SQL
        </label>
        <textarea
          id="sql-reverse-source"
          className="sql-reverse-editor"
          aria-label="Codice SQL da importare"
          value={sql}
          onChange={(event) => onSqlChange(event.target.value)}
          placeholder={"CREATE TABLE Student (\n  id INTEGER PRIMARY KEY,\n  name TEXT NOT NULL\n);"}
          spellCheck={false}
        />

        <div className="sql-reverse-actions">
          <button type="button" className="mode-button active" onClick={onParsePreview}>
            Analizza SQL
          </button>
          <button type="button" className="mode-button active" onClick={onApply} disabled={!canApply}>
            Genera ER
          </button>
          <label className="header-button sql-reverse-file-button">
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
            Pulisci
          </button>
        </div>
      </PanelSection>

      <PanelSection title="Preview import" className="technical-dock-section sql-reverse-section">
        <div className="sql-reverse-summary-grid">
          <div className="context-card sql-reverse-summary-card">
            <strong>{tableCount}</strong>
            <span>Tabelle</span>
          </div>
          <div className="context-card sql-reverse-summary-card">
            <strong>{unsupportedStatementCount}</strong>
            <span>Statement ignorati</span>
          </div>
          <div className="context-card sql-reverse-summary-card">
            <strong>{issues.length}</strong>
            <span>Warning/errori SQL</span>
          </div>
          <div className="context-card sql-reverse-summary-card">
            <strong>{logicalIssueCount}</strong>
            <span>Issue logiche</span>
          </div>
        </div>

        {!isPreviewReady ? (
          <p className="sql-reverse-muted">Analizza lo schema per vedere anteprima, warning e stato import.</p>
        ) : blockingErrors.length > 0 ? (
          <WarningCard type="error">SQL non importabile: correggi gli errori indicati prima di generare il diagramma.</WarningCard>
        ) : warnings.length > 0 || logicalIssueCount > 0 ? (
          <WarningCard type="warning">Preview pronta con warning non bloccanti.</WarningCard>
        ) : (
          <WarningCard type="success">Preview pronta: nessun warning o errore rilevato.</WarningCard>
        )}
      </PanelSection>

      <PanelSection title="Issue SQL" className="technical-dock-section sql-reverse-section">
        {visibleIssues.length === 0 ? (
          <div className="empty-state-card sql-reverse-empty">Nessun warning o errore SQL.</div>
        ) : (
          <div className="sql-reverse-issue-list">
            {visibleIssues.map((issue) => (
              <WarningCard key={issue.id} type={issue.level} className="sql-reverse-issue-card">
                <span className="sql-reverse-issue-copy">
                  <strong>{formatIssueLabel(issue)}</strong>
                  <span>{issue.message}</span>
                  {issue.rawFragment ? <code>{truncateFragment(issue.rawFragment)}</code> : null}
                </span>
              </WarningCard>
            ))}
            {hiddenIssueCount > 0 ? (
              <div className="technical-empty-note">Altre {hiddenIssueCount} issue non mostrate.</div>
            ) : null}
          </div>
        )}
      </PanelSection>

      {logicalIssues.length > 0 ? (
        <PanelSection title="Issue logiche" className="technical-dock-section sql-reverse-section">
          <div className="sql-reverse-issue-list">
            {logicalIssues.slice(0, MAX_VISIBLE_ISSUES).map((issue) => (
              <WarningCard key={issue.id} type={issue.level} className="sql-reverse-issue-card">
                <span className="sql-reverse-issue-copy">
                  <strong>{issue.level.toUpperCase()} - {issue.code}</strong>
                  <span>{issue.message}</span>
                </span>
              </WarningCard>
            ))}
          </div>
        </PanelSection>
      ) : null}
    </div>
  );
}
