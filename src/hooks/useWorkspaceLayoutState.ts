import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { TechnicalPanelTab } from "../components/TechnicalDockPanel";
import {
  DEFAULT_CODE_PANEL_WIDTH,
  DEFAULT_NOTES_PANEL_WIDTH,
  DEFAULT_TOOLBAR_WIDTH,
  INITIAL_WINDOW_WIDTH,
  clampValue,
  type WorkspaceSessionBootstrap,
} from "../features/workspace/workspaceSession";

export const TOOLBAR_COLLAPSED_WIDTH = 56;
export const MIN_TOOLBAR_WIDTH = 188;
export const MAX_TOOLBAR_WIDTH = 240;
export const MIN_CODE_PANEL_WIDTH = 320;
export const MAX_CODE_PANEL_WIDTH = 420;
export const MIN_NOTES_PANEL_WIDTH = 300;
export const MAX_NOTES_PANEL_WIDTH = 400;
export const RESIZER_WIDTH = 12;

export function useWorkspaceLayoutState(sessionBootstrap: WorkspaceSessionBootstrap) {
  const restoredTechnicalPanelTab: TechnicalPanelTab = sessionBootstrap.technicalPanelTab;
  const [technicalPanelOpen, setTechnicalPanelOpen] = useState(sessionBootstrap.technicalPanelOpen);
  const [technicalPanelTab, setTechnicalPanelTab] = useState<TechnicalPanelTab>(restoredTechnicalPanelTab);
  const [codePanelOpen, setCodePanelOpen] = useState(
    sessionBootstrap.codePanelOpen && restoredTechnicalPanelTab === "code",
  );
  const [codePanelWidth, setCodePanelWidth] = useState(sessionBootstrap.codePanelWidth);
  const [notesPanelOpen, setNotesPanelOpen] = useState(
    sessionBootstrap.notesPanelOpen && restoredTechnicalPanelTab === "notes",
  );
  const [notesPanelWidth, setNotesPanelWidth] = useState(sessionBootstrap.notesPanelWidth);
  const [toolbarCollapsed, setToolbarCollapsed] = useState(sessionBootstrap.toolbarCollapsed);
  const [focusMode, setFocusMode] = useState(sessionBootstrap.focusMode);
  const [windowWidth, setWindowWidth] = useState(INITIAL_WINDOW_WIDTH);
  const [toolbarWidth, setToolbarWidth] = useState(sessionBootstrap.toolbarWidth);
  const panelResizeRef = useRef<{
    panel: "toolbar" | "code" | "notes";
    startClientX: number;
    startWidth: number;
  } | null>(null);

  const effectiveToolbarCollapsed = focusMode || toolbarCollapsed;
  const toolbarResizeBounds = {
    min: MIN_TOOLBAR_WIDTH,
    max: clampValue(Math.floor(windowWidth * 0.22), 168, MAX_TOOLBAR_WIDTH),
  };
  const codePanelResizeBounds = {
    min: clampValue(Math.floor(windowWidth * 0.18), MIN_CODE_PANEL_WIDTH, 340),
    max: clampValue(Math.floor(windowWidth * 0.32), 360, MAX_CODE_PANEL_WIDTH),
  };
  const notesPanelResizeBounds = {
    min: clampValue(Math.floor(windowWidth * 0.17), MIN_NOTES_PANEL_WIDTH, 320),
    max: clampValue(Math.floor(windowWidth * 0.3), 340, MAX_NOTES_PANEL_WIDTH),
  };
  const visibleToolbarWidth = focusMode
    ? 0
    : effectiveToolbarCollapsed
      ? TOOLBAR_COLLAPSED_WIDTH
      : clampValue(toolbarWidth, toolbarResizeBounds.min, toolbarResizeBounds.max);
  const technicalPanelResizeBounds = technicalPanelTab === "notes" ? notesPanelResizeBounds : codePanelResizeBounds;
  const technicalPanelWidth = technicalPanelTab === "notes" ? notesPanelWidth : codePanelWidth;
  const visibleTechnicalPanelWidth = clampValue(
    technicalPanelWidth,
    technicalPanelResizeBounds.min,
    technicalPanelResizeBounds.max,
  );
  const technicalPanelVisible = false;
  const structuredSidePanelHidden = false;

  function handleToggleToolRail() {
    setToolbarCollapsed((current) => !current);
  }

  function openTechnicalPanelTab(nextTab: TechnicalPanelTab) {
    setTechnicalPanelTab(nextTab);
    setTechnicalPanelOpen(false);
    setCodePanelOpen(nextTab === "code");
    setNotesPanelOpen(nextTab === "notes");
  }

  function closeTechnicalPanel() {
    setTechnicalPanelOpen(false);
    setCodePanelOpen(false);
    setNotesPanelOpen(false);
  }

  function handleToggleCodePanel() {
    if (codePanelOpen) {
      closeTechnicalPanel();
      return;
    }

    openTechnicalPanelTab("code");
  }

  function handleToggleNotesPanel() {
    setNotesPanelOpen((current) => !current);
  }

  function handlePanelResizeStart(
    panel: "toolbar" | "code" | "notes",
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    panelResizeRef.current = {
      panel,
      startClientX: event.clientX,
      startWidth: panel === "toolbar" ? toolbarWidth : panel === "code" ? codePanelWidth : notesPanelWidth,
    };
    document.body.classList.add("workspace-resizing");
  }

  function resetPanelWidth(panel: "toolbar" | "code" | "notes") {
    if (panel === "toolbar") {
      setToolbarWidth(clampValue(DEFAULT_TOOLBAR_WIDTH, toolbarResizeBounds.min, toolbarResizeBounds.max));
      return;
    }

    if (panel === "code") {
      setCodePanelWidth(clampValue(DEFAULT_CODE_PANEL_WIDTH, codePanelResizeBounds.min, codePanelResizeBounds.max));
      return;
    }

    setNotesPanelWidth(clampValue(DEFAULT_NOTES_PANEL_WIDTH, notesPanelResizeBounds.min, notesPanelResizeBounds.max));
  }

  useEffect(() => {
    function handleResize() {
      setWindowWidth(window.innerWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (windowWidth < 1460) {
      setToolbarCollapsed(true);
    }
  }, [windowWidth]);

  useEffect(() => {
    setToolbarWidth((current) => clampValue(current, toolbarResizeBounds.min, toolbarResizeBounds.max));
  }, [toolbarResizeBounds.max, toolbarResizeBounds.min]);

  useEffect(() => {
    setCodePanelWidth((current) => clampValue(current, codePanelResizeBounds.min, codePanelResizeBounds.max));
  }, [codePanelResizeBounds.max, codePanelResizeBounds.min]);

  useEffect(() => {
    setNotesPanelWidth((current) => clampValue(current, notesPanelResizeBounds.min, notesPanelResizeBounds.max));
  }, [notesPanelResizeBounds.max, notesPanelResizeBounds.min]);

  useEffect(() => {
    function handleResizePointerMove(event: PointerEvent) {
      const currentResize = panelResizeRef.current;
      if (!currentResize) {
        return;
      }

      if (currentResize.panel === "toolbar") {
        const nextWidth = currentResize.startWidth + (event.clientX - currentResize.startClientX);
        setToolbarWidth(clampValue(nextWidth, toolbarResizeBounds.min, toolbarResizeBounds.max));
        return;
      }

      const nextWidth = currentResize.startWidth - (event.clientX - currentResize.startClientX);
      if (currentResize.panel === "code") {
        setCodePanelWidth(clampValue(nextWidth, codePanelResizeBounds.min, codePanelResizeBounds.max));
        return;
      }

      setNotesPanelWidth(clampValue(nextWidth, notesPanelResizeBounds.min, notesPanelResizeBounds.max));
    }

    function stopResize() {
      if (!panelResizeRef.current) {
        return;
      }

      panelResizeRef.current = null;
      document.body.classList.remove("workspace-resizing");
    }

    window.addEventListener("pointermove", handleResizePointerMove);
    window.addEventListener("pointerup", stopResize);

    return () => {
      window.removeEventListener("pointermove", handleResizePointerMove);
      window.removeEventListener("pointerup", stopResize);
      document.body.classList.remove("workspace-resizing");
    };
  }, [
    codePanelResizeBounds.max,
    codePanelResizeBounds.min,
    notesPanelResizeBounds.max,
    notesPanelResizeBounds.min,
    toolbarResizeBounds.max,
    toolbarResizeBounds.min,
  ]);

  return {
    technicalPanelOpen,
    setTechnicalPanelOpen,
    technicalPanelTab,
    setTechnicalPanelTab,
    codePanelOpen,
    setCodePanelOpen,
    codePanelWidth,
    setCodePanelWidth,
    notesPanelOpen,
    setNotesPanelOpen,
    notesPanelWidth,
    setNotesPanelWidth,
    toolbarCollapsed,
    setToolbarCollapsed,
    focusMode,
    setFocusMode,
    windowWidth,
    toolbarWidth,
    setToolbarWidth,
    effectiveToolbarCollapsed,
    toolbarResizeBounds,
    codePanelResizeBounds,
    notesPanelResizeBounds,
    visibleToolbarWidth,
    technicalPanelResizeBounds,
    technicalPanelWidth,
    visibleTechnicalPanelWidth,
    technicalPanelVisible,
    structuredSidePanelHidden,
    handleToggleToolRail,
    openTechnicalPanelTab,
    closeTechnicalPanel,
    handleToggleCodePanel,
    handleToggleNotesPanel,
    handlePanelResizeStart,
    resetPanelWidth,
  };
}
