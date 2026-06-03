export const LAST_SEEN_VERSION_STORAGE_KEY = "er-studio:last-seen-version";
export const SEEN_VERSION_ANNOUNCEMENTS_STORAGE_KEY = "er-studio:seen-version-announcements";

function getLocalStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readSeenVersions(storage: Storage): string[] {
  try {
    const rawValue = storage.getItem(SEEN_VERSION_ANNOUNCEMENTS_STORAGE_KEY);
    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function getLastSeenAppVersion(): string | null {
  const storage = getLocalStorage();
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(LAST_SEEN_VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function hasSeenVersionAnnouncement(version: string): boolean {
  const storage = getLocalStorage();
  if (!storage) {
    return false;
  }

  try {
    if (storage.getItem(LAST_SEEN_VERSION_STORAGE_KEY) === version) {
      return true;
    }

    return readSeenVersions(storage).includes(version);
  } catch {
    return false;
  }
}

export function rememberLastSeenAppVersion(version: string): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    storage.setItem(LAST_SEEN_VERSION_STORAGE_KEY, version);
  } catch {
    // localStorage can be unavailable in private or embedded contexts.
  }
}

export function rememberVersionAnnouncementSeen(version: string): void {
  const storage = getLocalStorage();
  if (!storage) {
    return;
  }

  try {
    const seenVersions = new Set(readSeenVersions(storage));
    seenVersions.add(version);
    storage.setItem(SEEN_VERSION_ANNOUNCEMENTS_STORAGE_KEY, JSON.stringify([...seenVersions]));
    storage.setItem(LAST_SEEN_VERSION_STORAGE_KEY, version);
  } catch {
    // Persisting the announcement is best-effort and should never block the app.
  }
}
