import { useRef } from "react";

import { useI18n } from "../i18n/useI18n";
import type { AppChangelogEntry, AppChangelogImpact } from "../utils/appMeta";
import { StudioIcon } from "./icons/StudioIcon";

interface ChangelogModalProps {
  appName: string;
  currentVersion: string;
  entries: AppChangelogEntry[];
  onClose: () => void;
}

type Translate = ReturnType<typeof useI18n>["t"];

function getImpactLabel(impact: AppChangelogImpact | undefined, t: Translate): string {
  if (impact === "major") {
    return t("changelog.impact.major");
  }

  if (impact === "minor") {
    return t("changelog.impact.minor");
  }

  return t("changelog.impact.fix");
}

function getImpactClassName(impact: AppChangelogImpact | undefined): string {
  if (impact === "major") {
    return "changelog-impact-badge changelog-impact-badge--major";
  }

  if (impact === "minor") {
    return "changelog-impact-badge changelog-impact-badge--important";
  }

  return "changelog-impact-badge changelog-impact-badge--fix";
}

export function ChangelogModal({ appName, currentVersion, entries, onClose }: ChangelogModalProps) {
  const { t } = useI18n();
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="studio-modal-backdrop changelog-modal-modern-backdrop" role="presentation" onClick={onClose}>
      <section
        className="studio-modal studio-modal--wide changelog-modal-modern"
        role="dialog"
        aria-modal="true"
        aria-labelledby="changelog-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="studio-modal__header changelog-modal-modern__header">
          <div>
            <span className="changelog-modal-modern__eyebrow">{t("changelog.eyebrow", { appName })}</span>
            <h2 id="changelog-modal-title" className="studio-modal__title">{t("changelog.title")}</h2>
            <p className="studio-modal__subtitle">
              {t("changelog.subtitle", { version: currentVersion })}
            </p>
          </div>
          <button
            type="button"
            className="studio-modal__close"
            onClick={onClose}
            aria-label={t("changelog.closeAria")}
            autoFocus
            ref={closeButtonRef}
          >
            <StudioIcon name="close" aria-hidden="true" />
          </button>
        </header>

        <div className="studio-modal__body changelog-modal-modern__body">
          {entries.map((entry) => {
            const isCurrentVersion = entry.version === currentVersion;

            return (
              <article
                key={`${entry.version}-${entry.date}`}
                className={
                  isCurrentVersion
                    ? "changelog-release-card changelog-release-card--current"
                    : "changelog-release-card"
                }
              >
                <header className="changelog-release-card__header">
                  <div>
                    <div className="changelog-release-card__title-row">
                      <h3>{appName} {entry.version}</h3>
                      {isCurrentVersion ? <span className="changelog-current-badge">{t("changelog.current")}</span> : null}
                    </div>
                    <p>{entry.headline ?? entry.summary ?? t("changelog.defaultSummary")}</p>
                  </div>
                  <div className="changelog-release-card__meta">
                    <span className={getImpactClassName(entry.impact)}>{getImpactLabel(entry.impact, t)}</span>
                    <time dateTime={entry.date}>{entry.date}</time>
                  </div>
                </header>

                {entry.highlights && entry.highlights.length > 0 ? (
                  <div className="changelog-release-card__highlights" aria-label={t("changelog.highlightsAria")}>
                    {entry.highlights.slice(0, 3).map((highlight) => (
                      <span key={`${entry.version}-${highlight.title}`}>
                        {highlight.tag ? <strong>{highlight.tag}</strong> : null}
                        {highlight.title}
                      </span>
                    ))}
                  </div>
                ) : null}

                <ul className="changelog-release-card__updates">
                  {entry.updates.map((update) => (
                    <li key={update}>{update}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
