import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";

import { useI18n } from "../i18n/useI18n";
import type { AppChangelogEntry, AppChangelogFeature } from "../utils/appMeta";

type VersionAnnouncementKind = "patch" | "minor" | "major";

interface VersionAnnouncementProps {
  appName: string;
  currentVersion: string;
  previousVersion: string | null;
  updateKind: VersionAnnouncementKind;
  changelogEntry: AppChangelogEntry;
  onClose: () => void;
  onOpenFullChangelog?: () => void;
}

type Translate = ReturnType<typeof useI18n>["t"];

function getUpdateLabel(updateKind: VersionAnnouncementKind, t: Translate): string {
  if (updateKind === "major") {
    return t("versionAnnouncement.updateKind.major");
  }

  if (updateKind === "minor") {
    return t("versionAnnouncement.updateKind.minor");
  }

  return t("versionAnnouncement.updateKind.patch");
}

function getFallbackHighlights(entry: AppChangelogEntry, t: Translate): AppChangelogFeature[] {
  return entry.updates.slice(0, 3).map((update, index) => ({
    title: t("versionAnnouncement.fallbackHighlightTitle", { index: index + 1 }),
    description: update,
    tag: t("versionAnnouncement.fallbackHighlightTag"),
  }));
}

export function VersionAnnouncement({
  appName,
  currentVersion,
  previousVersion,
  updateKind,
  changelogEntry,
  onClose,
  onOpenFullChangelog,
}: VersionAnnouncementProps) {
  const { t } = useI18n();
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const isWowUpdate = updateKind === "minor" || updateKind === "major";
  const updateLabel = changelogEntry.hero?.eyebrow ?? getUpdateLabel(updateKind, t);
  const versionRoute = previousVersion ? `v${previousVersion} -> v${currentVersion}` : `v${currentVersion}`;
  const highlights = useMemo(
    () => (changelogEntry.highlights && changelogEntry.highlights.length > 0
      ? changelogEntry.highlights
      : getFallbackHighlights(changelogEntry, t)),
    [changelogEntry, t],
  );
  const updates = changelogEntry.updates.slice(0, isWowUpdate ? 6 : 4);
  const title = isWowUpdate
    ? changelogEntry.hero?.title ??
      (updateKind === "major"
        ? t("versionAnnouncement.majorTitle", { appName })
        : t("versionAnnouncement.minorTitle", { appName, version: currentVersion }))
    : t("versionAnnouncement.patchTitle", { appName });
  const subtitle = isWowUpdate
    ? changelogEntry.hero?.subtitle ?? changelogEntry.summary ?? t("versionAnnouncement.defaultWowSubtitle")
    : t("versionAnnouncement.patchSubtitle");

  useEffect(() => {
    primaryActionRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function handleBackdropClick() {
    if (!isWowUpdate) {
      onClose();
    }
  }

  return (
    <div
      className={isWowUpdate ? "version-announcement-backdrop version-announcement-backdrop--wow" : "version-announcement-backdrop"}
      role="presentation"
      onClick={handleBackdropClick}
    >
      <section
        className={isWowUpdate ? "version-announcement version-announcement--wow" : "version-announcement version-announcement--patch"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="version-announcement-title"
        aria-describedby="version-announcement-subtitle"
        onClick={(event) => event.stopPropagation()}
      >
        {isWowUpdate ? (
          <>
            <div className="version-announcement__glow" aria-hidden="true" />
            <div className="version-announcement__grid" aria-hidden="true" />
            <header className="version-announcement__hero">
              <div className="version-announcement__hero-copy">
                <span className="version-announcement__eyebrow">{updateLabel}</span>
                <h2 id="version-announcement-title" className="version-announcement__title">{title}</h2>
                <p id="version-announcement-subtitle" className="version-announcement__subtitle">{subtitle}</p>
                <div className="version-announcement__route" aria-label={t("versionAnnouncement.versionRouteAria")}>
                  <span>{previousVersion ? `v${previousVersion}` : t("versionAnnouncement.previousVersion")}</span>
                  <strong>{"->"}</strong>
                  <span>v{currentVersion}</span>
                </div>
              </div>
              <div className="version-announcement__version-showcase" aria-hidden="true">
                <span>Release</span>
                <strong>v{currentVersion}</strong>
                <small>{updateKind === "major" ? t("versionAnnouncement.majorRelease") : t("versionAnnouncement.minorRelease")}</small>
              </div>
            </header>

            <div className="version-announcement__highlights">
              {highlights.slice(0, 3).map((highlight, index) => (
                <article
                  key={`${highlight.title}-${index}`}
                  className="version-announcement__highlight-card"
                  style={{ "--highlight-index": index } as CSSProperties}
                >
                  {highlight.tag ? <span>{highlight.tag}</span> : null}
                  <h3>{highlight.title}</h3>
                  <p>{highlight.description}</p>
                </article>
              ))}
            </div>

            {updates.length > 0 ? (
              <section className="version-announcement__updates" aria-label={t("versionAnnouncement.moreUpdates")}>
                <div className="version-announcement__updates-title">{t("versionAnnouncement.moreUpdates")}</div>
                <ul>
                  {updates.map((update) => (
                    <li key={update}>{update}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <footer className="version-announcement__actions">
              {onOpenFullChangelog ? (
                <button type="button" className="version-announcement__secondary" onClick={onOpenFullChangelog}>
                  {t("versionAnnouncement.openFullChangelog")}
                </button>
              ) : null}
              <button type="button" className="version-announcement__primary" onClick={onClose} ref={primaryActionRef}>
                {t("common.actions.start")}
              </button>
            </footer>
          </>
        ) : (
          <>
            <header className="version-announcement__patch-head">
              <span className="version-announcement__eyebrow">{updateLabel}</span>
              <h2 id="version-announcement-title" className="version-announcement__title">{title}</h2>
              <p id="version-announcement-subtitle" className="version-announcement__subtitle">{subtitle}</p>
              <strong className="version-announcement__patch-route">{versionRoute}</strong>
            </header>

            {updates.length > 0 ? (
              <ul className="version-announcement__patch-list">
                {updates.map((update) => (
                  <li key={update}>{update}</li>
                ))}
              </ul>
            ) : null}

            <footer className="version-announcement__actions">
              {onOpenFullChangelog ? (
                <button type="button" className="version-announcement__secondary" onClick={onOpenFullChangelog}>
                  {t("versionAnnouncement.viewDetails")}
                </button>
              ) : null}
              <button type="button" className="version-announcement__primary" onClick={onClose} ref={primaryActionRef}>
                {t("versionAnnouncement.gotIt")}
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
