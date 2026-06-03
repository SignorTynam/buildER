import { useEffect, useMemo, useRef } from "react";
import type { CSSProperties } from "react";

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

function getUpdateLabel(updateKind: VersionAnnouncementKind): string {
  if (updateKind === "major") {
    return "Major Update";
  }

  if (updateKind === "minor") {
    return "Important Update";
  }

  return "Update";
}

function getFallbackHighlights(entry: AppChangelogEntry): AppChangelogFeature[] {
  return entry.updates.slice(0, 3).map((update, index) => ({
    title: `Novita ${index + 1}`,
    description: update,
    tag: "Update",
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
  const primaryActionRef = useRef<HTMLButtonElement>(null);
  const isWowUpdate = updateKind === "minor" || updateKind === "major";
  const updateLabel = changelogEntry.hero?.eyebrow ?? getUpdateLabel(updateKind);
  const versionRoute = previousVersion ? `v${previousVersion} -> v${currentVersion}` : `v${currentVersion}`;
  const highlights = useMemo(
    () => (changelogEntry.highlights && changelogEntry.highlights.length > 0
      ? changelogEntry.highlights
      : getFallbackHighlights(changelogEntry)),
    [changelogEntry],
  );
  const updates = changelogEntry.updates.slice(0, isWowUpdate ? 6 : 4);
  const title = isWowUpdate
    ? changelogEntry.hero?.title ??
      (updateKind === "major"
        ? `Benvenuto nella nuova generazione di ${appName}`
        : `${appName} ${currentVersion} e arrivato`)
    : `${appName} e stato aggiornato`;
  const subtitle = isWowUpdate
    ? changelogEntry.hero?.subtitle ?? changelogEntry.summary ?? "Scopri le principali novita di questa release."
    : "Abbiamo corretto bug e migliorato la stabilita.";

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
                <div className="version-announcement__route" aria-label="Cambio versione">
                  <span>{previousVersion ? `v${previousVersion}` : "Versione precedente"}</span>
                  <strong>{"->"}</strong>
                  <span>v{currentVersion}</span>
                </div>
              </div>
              <div className="version-announcement__version-showcase" aria-hidden="true">
                <span>Release</span>
                <strong>v{currentVersion}</strong>
                <small>{updateKind === "major" ? "Major" : "Minor"} release</small>
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
              <section className="version-announcement__updates" aria-label="Altre novita">
                <div className="version-announcement__updates-title">Altre novita</div>
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
                  Vedi changelog completo
                </button>
              ) : null}
              <button type="button" className="version-announcement__primary" onClick={onClose} ref={primaryActionRef}>
                Inizia
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
                  Vedi dettagli
                </button>
              ) : null}
              <button type="button" className="version-announcement__primary" onClick={onClose} ref={primaryActionRef}>
                Ho capito
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
