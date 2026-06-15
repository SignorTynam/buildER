import type { ReactNode } from "react";
import { StudioIcon } from "./icons/StudioIcon";

interface SqlReversePreviewFrameProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  onDone: () => void;
  onCancel: () => void;
  onBack?: () => void;
  doneLabel?: string;
  variant?: "er" | "logical";
}

export function SqlReversePreviewFrame({
  title,
  subtitle,
  children,
  onDone,
  onCancel,
  onBack,
  doneLabel = "Done",
  variant = "er",
}: SqlReversePreviewFrameProps) {
  const shellClassName = [
    "sql-reverse-preview-shell",
    `sql-reverse-preview-shell-${variant}`,
    variant === "logical" ? "designer-logical-view" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={shellClassName} aria-label={title}>
      <div className="sql-reverse-preview-frame">
        <div className="sql-reverse-preview-ribbon">PREVIEW</div>
        <header className="sql-reverse-preview-header">
          <div>
            <h2 className="sql-reverse-preview-title">{title}</h2>
            <p className="sql-reverse-preview-subtitle">{subtitle}</p>
          </div>
          <div className="sql-reverse-preview-header-actions">
            {onBack ? (
              <button type="button" className="header-button" onClick={onBack}>
                <StudioIcon name="arrowUp" aria-hidden="true" />
                Indietro
              </button>
            ) : null}
            <button type="button" className="header-button" onClick={onCancel}>
              <StudioIcon name="close" aria-hidden="true" />
              Annulla import
            </button>
          </div>
        </header>
        <div className="sql-reverse-preview-body">{children}</div>
        <div className="sql-reverse-preview-actions">
          <button type="button" className="sql-reverse-preview-done" onClick={onDone}>
            <StudioIcon name="done" aria-hidden="true" />
            {doneLabel}
          </button>
        </div>
      </div>
    </section>
  );
}
