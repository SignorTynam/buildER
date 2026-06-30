import { useI18n } from "../../i18n/useI18n";

interface ProjectTextFilePanelProps {
  fileName: string;
  content: string;
  editable?: boolean;
  onChange: (content: string) => void;
}

export function ProjectTextFilePanel({
  fileName,
  content,
  editable = true,
  onChange,
}: ProjectTextFilePanelProps) {
  const { t } = useI18n();

  return (
    <section className="note-file-panel" aria-label={t("noteFile.title", { name: fileName })}>
      <header className="note-file-panel__header">
        <h2>{fileName}</h2>
      </header>
      <textarea
        className="note-file-panel__editor"
        value={content}
        onChange={(event) => onChange(event.target.value)}
        readOnly={!editable}
        placeholder={t("noteFile.placeholder")}
      />
      {content.trim().length === 0 ? <p className="note-file-panel__empty">{t("noteFile.empty")}</p> : null}
    </section>
  );
}
