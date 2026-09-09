import type { AppReleaseDefinition } from "./releaseTypes";

const detailed = (
  version: string,
  date: string,
  impact: AppReleaseDefinition["impact"],
  updateCount: number,
  highlightKeys: string[],
  sections: NonNullable<AppReleaseDefinition["sections"]>,
): AppReleaseDefinition => ({
  version,
  date,
  impact,
  announcement: impact === "patch" ? "toast" : "modal",
  contentKey: `v${version.replace(/\.0$/, "").replace(/\./g, "_")}`,
  hero: impact === "major",
  highlightCount: highlightKeys.length,
  highlightKeys,
  updateCount,
  sections,
});

// builder:release-catalog:start
export const RELEASE_CATALOG: readonly AppReleaseDefinition[] = [
  { ...detailed("7.4.0", "2026-09-09", "minor", 3, ["code", "layout", "experience"], {
    added: ["0"], changed: ["1"], fixed: ["2"],
  }), managed: true },
  { ...detailed("7.3.0", "2026-07-30", "minor", 3, ["code", "layout", "experience"], {
    added: ["0"], changed: ["1"], fixed: ["2"],
  }), managed: true },
  { ...detailed("7.2.0", "2026-07-26", "minor", 3, ["code", "layout", "experience"], {
    added: ["0"], changed: ["1"], fixed: ["2"],
  }), managed: true },
  { ...detailed("7.1.0", "2026-07-25", "minor", 3, ["code", "layout", "experience"], {
    added: ["0"], changed: ["1"], fixed: ["2"],
  }), managed: true },
  { ...detailed("7.0.0", "2026-07-21", "major", 14, ["database", "reverse", "releases"], {
    added: ["0", "1", "2", "3", "4", "5"],
    changed: ["6", "7", "8", "9", "10", "11"],
    fixed: ["12", "13"],
  }), managed: true },
  { ...detailed("6.3.0", "2026-07-02", "major", 10, ["code", "layout", "experience"], {
    added: ["4"],
    changed: ["0", "1", "2", "3", "5", "6", "7", "8", "9"],
  }), managed: true },
  detailed("6.2.0", "2026-06-30", "major", 12, ["code", "layout", "experience"], {
    added: ["0", "1", "2", "3", "4", "5", "6", "7", "8"],
    changed: ["9", "10", "11"],
  }),
  detailed("6.1.0", "2026-06-26", "major", 10, ["code", "layout", "experience"], {
    added: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
  }),
  detailed("6.0.0", "2026-06-25", "major", 6, ["translation", "logical", "schema"], {
    added: ["0", "1", "2", "3", "4", "5"],
  }),
  { version: "5.4.0", date: "2026-06-25", impact: "patch", announcement: "toast", legacy: true, updateCount: 4 },
  { version: "5.3.0", date: "2026-06-21", impact: "minor", announcement: "modal", legacy: true, updateCount: 4 },
  { version: "5.2.0", date: "2026-06-19", impact: "patch", announcement: "toast", legacy: true, updateCount: 4 },
  { version: "5.1.0", date: "2026-06-16", impact: "patch", announcement: "toast", legacy: true, updateCount: 4 },
  { version: "5.0.0", date: "2026-06-14", impact: "major", announcement: "modal", legacy: true, updateCount: 4 },
  { version: "4.6.0", date: "2026-06-04", impact: "minor", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "4.5.0", date: "2026-05-30", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "4.4.0", date: "2026-05-26", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "4.3.1", date: "2026-05-21", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "4.3.0", date: "2026-05-19", impact: "minor", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "4.2.0", date: "2026-05-11", impact: "minor", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "4.1.0", date: "2026-04-30", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "4.0.0", date: "2026-04-26", impact: "major", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "3.9.0", date: "2026-04-20", impact: "minor", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "3.8.0", date: "2026-04-16", impact: "minor", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "3.7.0", date: "2026-04-15", impact: "minor", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "3.6.0", date: "2026-04-14", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "3.5.0", date: "2026-04-14", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "3.4.0", date: "2026-04-14", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "3.3.0", date: "2026-04-13", impact: "minor", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "3.2.0", date: "2026-04-09", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "3.1.0", date: "2026-04-07", impact: "minor", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "3.0.0", date: "2026-03-29", impact: "major", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "2.5.2", date: "2026-03-29", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "2.5.1", date: "2026-03-27", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "2.4.3", date: "2026-03-27", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "2.4.2", date: "2026-03-25", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "2.4.0", date: "2026-03-22", impact: "minor", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "2.3.0", date: "2026-03-19", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "2.2.0", date: "2026-03-19", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "2.1.0", date: "2026-03-19", impact: "patch", announcement: "toast", legacy: true, updateCount: 3 },
  { version: "2.0.0", date: "2026-03-13", impact: "major", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "1.1.0", date: "2026-03-13", impact: "minor", announcement: "modal", legacy: true, updateCount: 3 },
  { version: "1.0.0", date: "2026-03-13", impact: "major", announcement: "modal", legacy: true, updateCount: 3 },
];
// builder:release-catalog:end
