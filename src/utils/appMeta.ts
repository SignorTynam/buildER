import type { MessageKey, TranslationParams } from "../i18n";

export const APP_NAME = "buildER";
export const APP_VERSION = "6.2";
export const APP_TITLE = `${APP_NAME}`;

export type AppChangelogImpact = "patch" | "minor" | "major";

export interface AppChangelogFeature {
  title: string;
  description: string;
  icon?: string;
  tag?: string;
}

export interface AppChangelogEntry {
  version: string;
  date: string;
  impact?: AppChangelogImpact;
  headline?: string;
  summary?: string;
  hero?: {
    eyebrow?: string;
    title: string;
    subtitle: string;
  };
  highlights?: AppChangelogFeature[];
  updates: string[];
}

export type AppTranslator = (key: MessageKey, params?: TranslationParams) => string;

interface ChangelogMetaEntry {
  version: string;
  date: string;
  impact?: AppChangelogImpact;
  updateCount: number;
}

const CHANGELOG_META: ChangelogMetaEntry[] = [
  { version: "6.2", date: "2026-06-30", impact: "major", updateCount: 12 },
  { version: "6.1", date: "2026-06-26", impact: "major", updateCount: 10 },
  { version: "6.0", date: "2026-06-25", impact: "major", updateCount: 6 },
  { version: "5.4", date: "2026-06-25", impact: "patch", updateCount: 4 },
  { version: "5.3", date: "2026-06-21", impact: "minor", updateCount: 4 },
  { version: "5.2", date: "2026-06-19", impact: "patch", updateCount: 4 },
  { version: "5.1", date: "2026-06-16", impact: "patch", updateCount: 4 },
  { version: "5.0", date: "2026-06-14", impact: "major", updateCount: 4 },
  { version: "4.6", date: "2026-06-04", impact: "minor", updateCount: 3 },
  { version: "4.5", date: "2026-05-30", impact: "patch", updateCount: 3 },
  { version: "4.4", date: "2026-05-26", impact: "patch", updateCount: 3 },
  { version: "4.3.1", date: "2026-05-21", impact: "patch", updateCount: 3 },
  { version: "4.3", date: "2026-05-19", impact: "minor", updateCount: 3 },
  { version: "4.2", date: "2026-05-11", impact: "minor", updateCount: 3 },
  { version: "4.1", date: "2026-04-30", impact: "patch", updateCount: 3 },
  { version: "4.0", date: "2026-04-26", impact: "major", updateCount: 3 },
  { version: "3.9", date: "2026-04-20", impact: "minor", updateCount: 3 },
  { version: "3.8", date: "2026-04-16", impact: "minor", updateCount: 3 },
  { version: "3.7", date: "2026-04-15", impact: "minor", updateCount: 3 },
  { version: "3.6", date: "2026-04-14", impact: "patch", updateCount: 3 },
  { version: "3.5", date: "2026-04-14", impact: "patch", updateCount: 3 },
  { version: "3.4", date: "2026-04-14", impact: "patch", updateCount: 3 },
  { version: "3.3", date: "2026-04-13", impact: "minor", updateCount: 3 },
  { version: "3.2.0", date: "2026-04-09", impact: "patch", updateCount: 3 },
  { version: "3.1.0", date: "2026-04-07", impact: "minor", updateCount: 3 },
  { version: "3.0.0", date: "2026-03-29", impact: "major", updateCount: 3 },
  { version: "2.5.2", date: "2026-03-29", impact: "patch", updateCount: 3 },
  { version: "2.5.1", date: "2026-03-27", impact: "patch", updateCount: 3 },
  { version: "2.4.3", date: "2026-03-27", impact: "patch", updateCount: 3 },
  { version: "2.4.2", date: "2026-03-25", impact: "patch", updateCount: 3 },
  { version: "2.4", date: "2026-03-22", impact: "minor", updateCount: 3 },
  { version: "2.3", date: "2026-03-19", impact: "patch", updateCount: 3 },
  { version: "2.2", date: "2026-03-19", impact: "patch", updateCount: 3 },
  { version: "2.1", date: "2026-03-19", impact: "patch", updateCount: 3 },
  { version: "2.0", date: "2026-03-13", impact: "major", updateCount: 3 },
  { version: "1.1", date: "2026-03-13", impact: "minor", updateCount: 3 },
  { version: "1.0", date: "2026-03-13", impact: "major", updateCount: 3 },
];

function versionKey(version: string): string {
  return `v${version.replace(/\./g, "_")}`;
}

function buildUpdates(t: AppTranslator, key: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    t(`changelog.entries.${key}.updates.${index}`),
  );
}

export function getAppChangelog(t: AppTranslator): AppChangelogEntry[] {
  return CHANGELOG_META.map((entry) => {
    const key = versionKey(entry.version);
    const baseKey = entry.version === APP_VERSION ? `changelog.entries.${key}` : "changelog.entries.generic";
    const localized: AppChangelogEntry = {
      version: entry.version,
      date: entry.date,
      impact: entry.impact,
      headline: t(`${baseKey}.headline`, { version: entry.version }),
      summary: t(`${baseKey}.summary`, { version: entry.version }),
      updates: entry.version === APP_VERSION
        ? buildUpdates(t, key, entry.updateCount)
        : buildUpdates(t, "generic", entry.updateCount),
    };

    if (entry.version === APP_VERSION) {
      localized.hero = {
        eyebrow: t(`${baseKey}.hero.eyebrow`),
        title: t(`${baseKey}.hero.title`),
        subtitle: t(`${baseKey}.hero.subtitle`),
      };
      localized.highlights = ["code", "layout", "experience"].map((highlightKey) => ({
        title: t(`${baseKey}.highlights.${highlightKey}.title`),
        description: t(`${baseKey}.highlights.${highlightKey}.description`),
        tag: t(`${baseKey}.highlights.${highlightKey}.tag`),
      }));
    }

    return localized;
  });
}

export const APP_CHANGELOG: AppChangelogEntry[] = [];
