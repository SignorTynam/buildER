import type { ReactNode } from "react";

interface SqlReversePreviewFrameProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  onDone: () => void;
  onCancel: () => void;
  onBack?: () => void;
}

export function SqlReversePreviewFrame({
  title,
  subtitle,
  children,
  onDone,
  onCancel,
  onBack,
}: SqlReversePreviewFrameProps) {
  return (
    <section className="sql-reverse-preview-shell" aria-label={title}>
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
                Indietro
              </button>
            ) : null}
            <button type="button" className="header-button" onClick={onCancel}>
              Annulla import
            </button>
          </div>
        </header>
        <div className="sql-reverse-preview-body">{children}</div>
        <div className="sql-reverse-preview-actions">
          <button type="button" className="sql-reverse-preview-done" onClick={onDone}>
            Done
          </button>
        </div>
      </div>
    </section>
  );
}
