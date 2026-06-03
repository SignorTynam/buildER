export interface ParsedAppVersion {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

export type AppUpdateKind = "first-run" | "none" | "patch" | "minor" | "major" | "downgrade";

export interface AppUpdateClassification {
  kind: AppUpdateKind;
  shouldShow: boolean;
  wow: boolean;
}

function parseVersionPart(value: string | undefined): number {
  if (!value) {
    return 0;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function parseAppVersion(version: string): ParsedAppVersion {
  const raw = version;
  const normalized = version.trim().replace(/^v/i, "");
  const [coreVersion, prerelease] = normalized.split("-", 2);
  const [major, minor, patch] = coreVersion.split(".");

  return {
    raw,
    major: parseVersionPart(major),
    minor: parseVersionPart(minor),
    patch: parseVersionPart(patch),
    prerelease: prerelease?.trim() || undefined,
  };
}

export function compareAppVersions(previous: string, current: string): -1 | 0 | 1 {
  const left = parseAppVersion(previous);
  const right = parseAppVersion(current);
  const orderedParts: Array<keyof Pick<ParsedAppVersion, "major" | "minor" | "patch">> = ["major", "minor", "patch"];

  for (const part of orderedParts) {
    if (left[part] < right[part]) {
      return -1;
    }

    if (left[part] > right[part]) {
      return 1;
    }
  }

  if (left.prerelease && !right.prerelease) {
    return -1;
  }

  if (!left.prerelease && right.prerelease) {
    return 1;
  }

  if (left.prerelease && right.prerelease) {
    if (left.prerelease < right.prerelease) {
      return -1;
    }

    if (left.prerelease > right.prerelease) {
      return 1;
    }
  }

  return 0;
}

export function classifyAppUpdate(previous: string | null, current: string): AppUpdateClassification {
  if (previous === null) {
    return { kind: "first-run", shouldShow: false, wow: false };
  }

  const comparison = compareAppVersions(previous, current);

  if (comparison === 0) {
    return { kind: "none", shouldShow: false, wow: false };
  }

  if (comparison > 0) {
    return { kind: "downgrade", shouldShow: false, wow: false };
  }

  const parsedPrevious = parseAppVersion(previous);
  const parsedCurrent = parseAppVersion(current);

  if (parsedPrevious.major !== parsedCurrent.major) {
    return { kind: "major", shouldShow: true, wow: true };
  }

  if (parsedPrevious.minor !== parsedCurrent.minor) {
    return { kind: "minor", shouldShow: true, wow: true };
  }

  return { kind: "patch", shouldShow: true, wow: false };
}
