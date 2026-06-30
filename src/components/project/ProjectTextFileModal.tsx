import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface ProjectTextFileModalProps {
  open: boolean;
  fileName: string;
  content: string;
  editable?: boolean;
  dirty?: boolean;
  onChange: (content: string) => void;
  onClose: () => void;
}

export function ProjectTextFileModal({
  open,
  fileName,
  content,
  editable = true,
  onChange,
  onClose,
}: ProjectTextFileModalProps) {
  const { t } = useI18n();

  if (!open) {
    return null;
  }

  return (
    <div className="help-modal-backdrop project-text-file-modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="help-modal project-text-file-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-text-file-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="help-modal-head project-text-file-modal__header">
          <h2 id="project-text-file-modal-title">{t("textFileModal.title", { name: fileName })}</h2>
          <button type="button" className="designer-icon-button" onClick={onClose} aria-label={t("textFileModal.close")}>
            <StudioIcon name="close" aria-hidden="true" />
          </button>
        </header>
        <textarea
          className="project-text-file-modal__editor"
          value={content}
          onChange={(event) => onChange(event.target.value)}
          readOnly={!editable}
          placeholder={t("textFileModal.placeholder")}
          aria-label={t("textFileModal.title", { name: fileName })}
        />
        {content.trim().length === 0 ? <p className="project-text-file-modal__empty">{t("textFileModal.empty")}</p> : null}
        <footer className="project-text-file-modal__footer">
          <button type="button" className="header-button" onClick={onClose}>
            {t("textFileModal.close")}
          </button>
        </footer>
      </section>
    </div>
  );
}
