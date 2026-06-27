import { useEffect, useState } from "react";
import type { ProjectUncommittedChangeCategories } from "../../features/versioning/useProjectVersioning";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface CommitDialogProps {
  open: boolean;
  busy: boolean;
  error: string;
  canCommit: boolean;
  hint: string;
  categories: ProjectUncommittedChangeCategories;
  firstCommit: boolean;
  onClose: () => void;
  onSubmit: (message: string, description?: string) => void;
}

const CATEGORY_KEYS = ["er", "layout", "logical", "code", "workspace"] as const;

function getChangedCategoryKeys(categories: ProjectUncommittedChangeCategories) {
  return CATEGORY_KEYS.filter((key) => categories[key]);
}

export function CommitDialog({
  open,
  busy,
  error,
  canCommit,
  hint,
  categories,
  firstCommit,
  onClose,
  onSubmit,
}: CommitDialogProps) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [description, setDescription] = useState("");
  const changedCategories = getChangedCategoryKeys(categories);
  const suggestedMessage =
    firstCommit
      ? t("versioning.suggestions.initialSchema")
      : changedCategories.length === 1
        ? t(`versioning.suggestions.${changedCategories[0]}`)
        : t("versioning.suggestions.project");

  useEffect(() => {
    if (open) {
      setMessage(canCommit ? suggestedMessage : "");
      setDescription("");
    }
  }, [canCommit, open, suggestedMessage]);

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
        aria-describedby="versioning-commit-description"
        onClick={(event) => event.stopPropagation()}
        data-testid="commit-dialog"
      >
        <div className="help-modal-head">
          <div>
            <h2 id="versioning-commit-title">{firstCommit ? t("versioning.createFirstCommit") : t("versioning.newCommit")}</h2>
            <p id="versioning-commit-description" className="action-modal-subtitle">
              {t("versioning.commitDialogDescription")}
            </p>
          </div>
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
          className="action-modal-content versioning-commit-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(message, description);
          }}
        >
          {changedCategories.length > 0 ? (
            <div className="versioning-dialog-section" data-testid="commit-dialog-categories">
              <span>{t("versioning.changedCategories")}</span>
              <div className="versioning-category-list">
                {changedCategories.map((key) => (
                  <span key={key} className="versioning-category-pill">
                    {t(`versioning.categories.${key}`)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <div className="versioning-dialog-section" data-testid="commit-message-suggestion">
            <span>{t("versioning.messageSuggestion")}</span>
            <button
              type="button"
              className="versioning-suggestion-button"
              onClick={() => setMessage(suggestedMessage)}
              disabled={busy || !canCommit}
            >
              {suggestedMessage}
            </button>
          </div>
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
          <div className="versioning-message-examples" aria-label={t("versioning.messageExamples")}>
            <span>{t("versioning.examples.initialSchema")}</span>
            <span>{t("versioning.examples.addedEntities")}</span>
            <span>{t("versioning.examples.refinedLayout")}</span>
            <span>{t("versioning.examples.updatedLogical")}</span>
          </div>
          {hint ? <p className={canCommit ? "action-modal-hint" : "action-modal-error"}>{hint}</p> : null}
          {error ? <p className="action-modal-error">{error}</p> : null}
          <div className="action-modal-actions">
            <button type="button" className="header-button" onClick={onClose} disabled={busy}>
              {t("common.actions.cancel")}
            </button>
            <button
              type="submit"
              className="mode-button active"
              disabled={busy || !canCommit}
              data-testid="create-commit-button"
            >
              {t("versioning.createCommit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
