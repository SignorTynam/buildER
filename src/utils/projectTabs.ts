import type { ProjectOpenTab, ProjectWorkspaceFile } from "../types/projectExplorer";
import type { ProjectExplorerState } from "./projectExplorer";

export const WELCOME_TAB_ID = "welcome";

export function createWelcomeTab(): ProjectOpenTab {
  return {
    id: WELCOME_TAB_ID,
    kind: "welcome",
    title: "Welcome",
  };
}

function createFileTab(file: ProjectWorkspaceFile, preview = false): ProjectOpenTab {
  return {
    id: `file:${file.id}`,
    kind: "file",
    fileId: file.id,
    title: file.name,
    dirty: false,
    preview,
  };
}

function getActiveFileIdFromTab(tabs: ProjectOpenTab[], activeTabId: string | null): string | null {
  const activeTab = activeTabId ? tabs.find((tab) => tab.id === activeTabId) : undefined;
  return activeTab?.kind === "file" ? activeTab.fileId ?? null : null;
}

function ensureAtLeastWelcome(tabs: ProjectOpenTab[]): ProjectOpenTab[] {
  return tabs.length > 0 ? tabs : [createWelcomeTab()];
}

export function normalizeProjectTabs(state: ProjectExplorerState): ProjectExplorerState {
  const rawTabs = Array.isArray(state.view.openTabs) ? state.view.openTabs : [];
  const normalizedTabs = rawTabs
    .map((tab) => {
      if (tab?.kind === "welcome") {
        return createWelcomeTab();
      }
      if (tab?.kind === "file" && tab.fileId && state.files[tab.fileId]) {
        const file = state.files[tab.fileId];
        return {
          ...createFileTab(file, tab.preview === true),
          dirty: tab.dirty === true,
        };
      }
      return null;
    })
    .filter((tab): tab is ProjectOpenTab => Boolean(tab));

  const activeFileId = state.project.activeFileId ?? state.view.activeFileId;
  const tabsWithActive =
    activeFileId && state.files[activeFileId] && !normalizedTabs.some((tab) => tab.fileId === activeFileId)
      ? [...normalizedTabs, createFileTab(state.files[activeFileId])]
      : normalizedTabs;
  const tabs = ensureAtLeastWelcome(tabsWithActive);
  const requestedActiveTabId =
    typeof state.view.activeTabId === "string" && tabs.some((tab) => tab.id === state.view.activeTabId)
      ? state.view.activeTabId
      : activeFileId
        ? tabs.find((tab) => tab.fileId === activeFileId)?.id ?? null
        : null;
  const activeTabId = requestedActiveTabId ?? tabs[0]?.id ?? WELCOME_TAB_ID;
  const nextActiveFileId = getActiveFileIdFromTab(tabs, activeTabId);

  return {
    ...state,
    project: {
      ...state.project,
      activeFileId: nextActiveFileId,
    },
    view: {
      ...state.view,
      activeFileId: nextActiveFileId,
      openTabs: tabs,
      activeTabId,
    },
  };
}

export function ensureFileTabOpen(
  state: ProjectExplorerState,
  fileId: string,
  options: { activate?: boolean; preview?: boolean } = {},
): ProjectExplorerState {
  const normalized = normalizeProjectTabs(state);
  const file = normalized.files[fileId];
  if (!file) {
    return normalized;
  }

  const existingTab = normalized.view.openTabs.find((tab) => tab.fileId === fileId);
  const tabs = existingTab
    ? normalized.view.openTabs.map((tab) =>
        tab.fileId === fileId
          ? { ...tab, title: file.name, preview: options.preview ?? tab.preview }
          : tab,
      )
    : [...normalized.view.openTabs.filter((tab) => tab.kind !== "welcome" || normalized.view.openTabs.length === 1), createFileTab(file, options.preview === true)];
  const activeTabId = options.activate === false ? normalized.view.activeTabId : existingTab?.id ?? `file:${fileId}`;
  const activeFileId = options.activate === false ? normalized.project.activeFileId : fileId;

  return {
    ...normalized,
    project: {
      ...normalized.project,
      activeFileId,
    },
    view: {
      ...normalized.view,
      openTabs: tabs,
      activeTabId,
      activeFileId,
    },
  };
}

export function setActiveProjectTab(state: ProjectExplorerState, tabId: string): ProjectExplorerState {
  const normalized = normalizeProjectTabs(state);
  const tab = normalized.view.openTabs.find((candidate) => candidate.id === tabId);
  if (!tab) {
    return normalized;
  }

  const activeFileId = tab.kind === "file" ? tab.fileId ?? null : null;
  return {
    ...normalized,
    project: {
      ...normalized.project,
      activeFileId,
    },
    view: {
      ...normalized.view,
      activeTabId: tab.id,
      activeFileId,
    },
  };
}

export function closeProjectTab(state: ProjectExplorerState, tabId: string): ProjectExplorerState {
  const normalized = normalizeProjectTabs(state);
  const tabIndex = normalized.view.openTabs.findIndex((tab) => tab.id === tabId);
  if (tabIndex < 0) {
    return normalized;
  }

  const remainingTabs = ensureAtLeastWelcome(normalized.view.openTabs.filter((tab) => tab.id !== tabId));
  const nextActiveTab =
    normalized.view.activeTabId === tabId
      ? remainingTabs[Math.min(tabIndex, remainingTabs.length - 1)] ?? remainingTabs[0]
      : remainingTabs.find((tab) => tab.id === normalized.view.activeTabId) ?? remainingTabs[0];
  const activeFileId = nextActiveTab?.kind === "file" ? nextActiveTab.fileId ?? null : null;

  return {
    ...normalized,
    project: {
      ...normalized.project,
      activeFileId,
    },
    view: {
      ...normalized.view,
      openTabs: remainingTabs,
      activeTabId: nextActiveTab?.id ?? WELCOME_TAB_ID,
      activeFileId,
    },
  };
}

export function closeTabsForDeletedFile(state: ProjectExplorerState, fileId: string): ProjectExplorerState {
  const normalized = normalizeProjectTabs(state);
  const deletedTab = normalized.view.openTabs.find((tab) => tab.fileId === fileId);
  return deletedTab ? closeProjectTab(normalized, deletedTab.id) : normalized;
}

export function markProjectTabDirty(
  state: ProjectExplorerState,
  fileId: string,
  dirty: boolean,
): ProjectExplorerState {
  const normalized = normalizeProjectTabs(state);
  return {
    ...normalized,
    view: {
      ...normalized.view,
      openTabs: normalized.view.openTabs.map((tab) =>
        tab.fileId === fileId ? { ...tab, dirty } : tab,
      ),
    },
  };
}
