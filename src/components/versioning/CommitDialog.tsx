import { useEffect, useState } from "react";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface CommitDialogProps {
  open: boolean;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (message: string, description?: string) => void;
}

export function CommitDialog({ open, busy, error, onClose, onSubmit }: CommitDialogProps) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) {
      setMessage("");
      setDescription("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="help-modal-backdrop" role="presentation" onClick={busy ? undefined : onClose}>
      <div
        className="help-modal action-modal versioning-commit-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="versioning-commit-title"
        onClick={(event) => event.stopPropagation()}
        data-testid="commit-dialog"
      >
        <div className="help-modal-head">
          <h2 id="versioning-commit-title">{t("versioning.newCommit")}</h2>
          <button
            type="button"
            className="help-close"
            onClick={onClose}
            aria-label={t("common.actions.close")}
            disabled={busy}
          >
            <StudioIcon name="close" aria-hidden="true" />
          </button>
        </div>
        <form
          className="action-modal-content"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(message, description);
          }}
        >
          <label className="action-modal-field">
            <span>{t("versioning.commitMessage")}</span>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              disabled={busy}
              autoFocus
              data-testid="commit-message-input"
            />
          </label>
          <label className="action-modal-field">
            <span>{t("versioning.optionalDescription")}</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={busy}
              rows={4}
              data-testid="commit-description-input"
            />
          </label>
          {error ? <p className="action-modal-error">{error}</p> : null}
          <div className="action-modal-actions">
            <button type="button" className="header-button" onClick={onClose} disabled={busy}>
              {t("common.actions.cancel")}
            </button>
            <button type="submit" className="mode-button active" disabled={busy} data-testid="create-commit-button">
              {t("versioning.createCommit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
