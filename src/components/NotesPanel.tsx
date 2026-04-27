import { useI18n } from "../i18n/useI18n";

interface NotesPanelProps {
  notes: string;
  editable?: boolean;
  onChange?: (value: string) => void;
  onClose?: () => void;
  embedded?: boolean;
}

export function NotesPanel(props: NotesPanelProps) {
  const { t } = useI18n();
  const isReadOnly = !props.editable || !props.onChange;

  return (
    <aside
      className={
        props.embedded ? "diagram-notes-panel technical-side-panel embedded" : "diagram-notes-panel technical-side-panel"
      }
      aria-label={t("notesPanel.shellAria")}
    >
      {!props.embedded ? (
        <header className="diagram-notes-panel-head technical-side-panel-head">
        <div className="technical-side-panel-copy">
          <span className="technical-side-panel-kicker">Project notes</span>
          <h2>{t("notesPanel.title")}</h2>
          <p>Annotazioni di lavoro e note sul modello corrente.</p>
        </div>

        <div className="technical-side-panel-head-actions">
          <span className="code-panel-status">
            {isReadOnly ? t("common.status.readOnly") : t("common.status.editing")}
          </span>

          {props.onClose ? (
            <button
              type="button"
              className="technical-side-panel-close"
              onClick={props.onClose}
              aria-label="Chiudi pannello note"
            >
              Nascondi
            </button>
          ) : null}
        </div>
        </header>
      ) : null}

      <textarea
        className="diagram-notes-editor"
        value={props.notes}
        onChange={(event) => props.onChange?.(event.target.value)}
        placeholder={t("notesPanel.placeholder")}
        readOnly={isReadOnly}
        spellCheck={false}
        aria-label={t("notesPanel.editorAria")}
      />
    </aside>
  );
}
