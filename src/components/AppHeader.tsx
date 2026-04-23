import { useEffect, useRef, useState } from "react";
import type { MouseEvent, SyntheticEvent } from "react";
import type { EditorMode } from "../types/diagram";
import type { WorkspaceView } from "../types/translation";
import { SUPPORTED_LOCALES } from "../i18n";
import { useI18n } from "../i18n/useI18n";

interface AppHeaderProps {
  appTitle: string;
  appVersion: string;
  diagramName: string;
  diagramView: WorkspaceView;
  logicalSqlOpen: boolean;
  codePanelOpen: boolean;
  notesPanelOpen: boolean;
  mode: EditorMode;
  canUndo: boolean;
  canRedo: boolean;
  logicalOutOfDate: boolean;
  focusMode: boolean;
  toolRailCollapsed: boolean;
  onDiagramViewChange: (view: WorkspaceView) => void;
  onOpenSql: () => void;
  onOpenLogicalWorkflow: () => void;
  onModeChange: (mode: EditorMode) => void;
  onNewProject: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onGenerateLogicalModel: () => void;
  onResetTranslation: () => void;
  onAutoLayoutLogical: () => void;
  onFitLogical: () => void;
  onToggleCodePanel: () => void;
  onToggleNotesPanel: () => void;
  onSaveProject: () => void;
  onSaveErs: () => void;
  onLoadProject: () => void;
  onLoadErs: () => void;
  onExportPng: () => void;
  onExportSvg: () => void;
  onResetErs: () => void;
  onOpenErsGuide: () => void;
  onAbout: () => void;
  onWhatsNew: () => void;
  onToggleFocusMode: () => void;
  onToggleToolRail: () => void;
}

function getWorkspaceTitle(props: AppHeaderProps, t: ReturnType<typeof useI18n>["t"]): string {
  if (props.diagramView === "translation") {
    return "TRANSLATION";
  }

  if (props.diagramView === "logical") {
    return props.logicalSqlOpen ? "SCHEMA / SQL" : t("header.views.logical").toUpperCase();
  }

  return "MODEL";
}

function getWorkspaceMeta(props: AppHeaderProps): string {
  if (props.diagramView === "logical" && props.logicalOutOfDate) {
    return "schema da riallineare";
  }

  if (props.diagramView === "logical" && props.logicalSqlOpen) {
    return "anteprima sql";
  }

  if (props.diagramView === "translation") {
    return "workflow tecnico";
  }

  return props.focusMode ? "focus canvas" : props.mode === "edit" ? "editing" : "read only";
}

export function AppHeader(props: AppHeaderProps) {
  const { locale, setLocale, t, getLanguageLabel, getLanguageMenuLabel } = useI18n();
  const navRef = useRef<HTMLElement | null>(null);
  const menuGroupRef = useRef<HTMLDetailsElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const isErView = props.diagramView === "er";
  const isTranslationView = props.diagramView === "translation";
  const isLogicalView = props.diagramView === "logical";

  function updateMenuPosition() {
    const menuGroup = menuGroupRef.current;
    if (!menuGroup?.open) {
      setMenuStyle(null);
      return;
    }

    const summary = menuGroup.querySelector("summary");
    if (!summary) {
      return;
    }

    const viewportPadding = 12;
    const triggerRect = summary.getBoundingClientRect();
    const width = Math.min(340, Math.max(260, window.innerWidth - viewportPadding * 2));
    const left = Math.max(
      viewportPadding,
      Math.min(triggerRect.right - width, window.innerWidth - width - viewportPadding),
    );
    const top = triggerRect.bottom + 8;
    const maxHeight = Math.max(220, window.innerHeight - top - viewportPadding);

    setMenuStyle({ top, left, width, maxHeight });
  }

  function closeAllMenus() {
    if (!navRef.current) {
      return;
    }

    navRef.current.querySelectorAll("details[open]").forEach((group) => group.removeAttribute("open"));
    setMenuStyle(null);
  }

  useEffect(() => {
    function handleGlobalPointerDown(event: globalThis.MouseEvent) {
      if (!navRef.current) {
        return;
      }

      const target = event.target as Node | null;
      if (target && !navRef.current.contains(target)) {
        closeAllMenus();
      }
    }

    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeAllMenus();
      }
    }

    document.addEventListener("mousedown", handleGlobalPointerDown);
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleGlobalPointerDown);
      document.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  useEffect(() => {
    function handleViewportChange() {
      updateMenuPosition();
    }

    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, []);

  function handleGroupToggle(event: SyntheticEvent<HTMLDetailsElement>) {
    const currentGroup = event.currentTarget;
    if (!currentGroup.open || !navRef.current) {
      if (currentGroup === menuGroupRef.current) {
        setMenuStyle(null);
      }
      return;
    }

    navRef.current.querySelectorAll("details").forEach((group) => {
      if (group !== currentGroup) {
        group.removeAttribute("open");
      }
    });

    if (currentGroup === menuGroupRef.current) {
      window.requestAnimationFrame(() => {
        updateMenuPosition();
      });
    }
  }

  function runMenuAction(event: MouseEvent<HTMLButtonElement>, action: () => void) {
    action();
    const group = event.currentTarget.closest("details");
    if (group) {
      group.removeAttribute("open");
    }
  }

  const headerClassName = [
    "app-header",
    "studio-topbar",
    props.focusMode ? "focus-mode" : "",
    `app-header-view-${props.diagramView}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      <div className="studio-topbar-brand" aria-label="Brand">
        <div className="studio-topbar-mark" aria-hidden="true">
          ER
        </div>
        <div className="studio-topbar-brand-copy">
          <strong>{props.appTitle}</strong>
          <span>v{props.appVersion}</span>
        </div>
      </div>

      <div className="studio-topbar-project" aria-label="Progetto attivo">
        <span className="studio-topbar-project-meta">
          {getWorkspaceTitle(props, t)} / {getWorkspaceMeta(props)}
        </span>
        <strong>{props.diagramName}</strong>
      </div>

      <div className="studio-topbar-actions">
        {isErView ? (
          <div className="studio-topbar-toggle-group" role="group" aria-label="Pannelli laterali">
            <button
              type="button"
              className={props.codePanelOpen ? "studio-topbar-toggle active" : "studio-topbar-toggle"}
              onClick={props.onToggleCodePanel}
              aria-pressed={props.codePanelOpen}
            >
              Code
            </button>
            <button
              type="button"
              className={props.notesPanelOpen ? "studio-topbar-toggle active" : "studio-topbar-toggle"}
              onClick={props.onToggleNotesPanel}
              aria-pressed={props.notesPanelOpen}
            >
              Notes
            </button>
          </div>
        ) : null}

        {isErView ? (
          <div className="studio-topbar-toggle-group" role="group" aria-label={t("header.editorModeGroupLabel")}>
            <button
              type="button"
              className={props.mode === "edit" ? "studio-topbar-toggle active" : "studio-topbar-toggle"}
              onClick={() => props.onModeChange("edit")}
              aria-pressed={props.mode === "edit"}
            >
              {t("header.modes.edit")}
            </button>
            <button
              type="button"
              className={props.mode === "view" ? "studio-topbar-toggle active" : "studio-topbar-toggle"}
              onClick={() => props.onModeChange("view")}
              aria-pressed={props.mode === "view"}
            >
              {t("header.modes.view")}
            </button>
          </div>
        ) : null}

        <button type="button" className="studio-topbar-button" onClick={props.onNewProject}>
          New
        </button>
        <button type="button" className="studio-topbar-button" onClick={props.onLoadProject}>
          Open
        </button>
        <button type="button" className="studio-topbar-button" onClick={props.onSaveProject}>
          Save
        </button>

        <nav ref={navRef} className="studio-topbar-menu" aria-label={t("header.secondaryActionsLabel")}>
          <details ref={menuGroupRef} className="nav-group nav-group-menu" onToggle={handleGroupToggle}>
            <summary>Menu</summary>
            <div
              className="nav-menu nav-menu-floating"
              style={
                menuStyle
                  ? {
                      top: `${menuStyle.top}px`,
                      left: `${menuStyle.left}px`,
                      width: `${menuStyle.width}px`,
                      maxHeight: `${menuStyle.maxHeight}px`,
                    }
                  : { visibility: "hidden" }
              }
            >
              <div className="nav-menu-section">
                <div className="nav-menu-label">Workflow</div>
                <button type="button" onClick={(event) => runMenuAction(event, () => props.onDiagramViewChange("er"))}>
                  MODEL
                </button>
                <button
                  type="button"
                  onClick={(event) => runMenuAction(event, () => props.onDiagramViewChange("translation"))}
                >
                  TRANSLATION
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onOpenLogicalWorkflow)}>
                  SCHEMA
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onOpenSql)}>
                  SQL panel
                </button>
                {isTranslationView ? (
                  <button type="button" onClick={(event) => runMenuAction(event, props.onResetTranslation)}>
                    Reset translation
                  </button>
                ) : null}
                {isLogicalView ? (
                  <>
                    <button type="button" onClick={(event) => runMenuAction(event, props.onGenerateLogicalModel)}>
                      {props.logicalOutOfDate ? "Riallinea schema" : "Rigenera schema"}
                    </button>
                    <button type="button" onClick={(event) => runMenuAction(event, props.onAutoLayoutLogical)}>
                      Auto layout
                    </button>
                    <button type="button" onClick={(event) => runMenuAction(event, props.onFitLogical)}>
                      Fit canvas
                    </button>
                  </>
                ) : null}
              </div>

              <div className="nav-menu-section">
                <div className="nav-menu-label">Workspace</div>
                {isErView ? (
                  <button type="button" onClick={(event) => runMenuAction(event, props.onToggleCodePanel)}>
                    {props.codePanelOpen ? "Hide code" : "Show code"}
                  </button>
                ) : null}
                {isErView ? (
                  <button type="button" onClick={(event) => runMenuAction(event, props.onToggleNotesPanel)}>
                    {props.notesPanelOpen ? "Hide notes" : "Show notes"}
                  </button>
                ) : null}
                <button type="button" onClick={(event) => runMenuAction(event, props.onToggleFocusMode)}>
                  {props.focusMode ? "Disable focus" : "Enable focus"}
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onToggleToolRail)}>
                  {props.toolRailCollapsed ? "Expand toolbar" : "Collapse toolbar"}
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onResetErs)}>
                  Reset ERS source
                </button>
              </div>

              <div className="nav-menu-section">
                <div className="nav-menu-label">Edit</div>
                <button type="button" onClick={(event) => runMenuAction(event, props.onUndo)} disabled={!props.canUndo}>
                  {t("common.actions.undo")}
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onRedo)} disabled={!props.canRedo}>
                  {t("common.actions.redo")}
                </button>
              </div>

              <div className="nav-menu-section">
                <div className="nav-menu-label">File</div>
                <button type="button" onClick={(event) => runMenuAction(event, props.onNewProject)}>
                  {t("header.menu.actions.newProject")}
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onLoadProject)}>
                  {t("header.menu.actions.loadProject")}
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onLoadErs)}>
                  {t("header.menu.actions.loadErs")}
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onSaveProject)}>
                  {t("header.menu.actions.saveProject")}
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onSaveErs)}>
                  {t("header.menu.actions.saveErs")}
                </button>
              </div>

              <div className="nav-menu-section">
                <div className="nav-menu-label">Export</div>
                <button type="button" onClick={(event) => runMenuAction(event, props.onExportPng)}>
                  PNG
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onExportSvg)}>
                  SVG
                </button>
              </div>

              <div className="nav-menu-section">
                <div className="nav-menu-label">Help</div>
                <button type="button" onClick={(event) => runMenuAction(event, props.onOpenErsGuide)}>
                  ERS guide
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onWhatsNew)}>
                  What's new
                </button>
                <button type="button" onClick={(event) => runMenuAction(event, props.onAbout)}>
                  About
                </button>
              </div>

              <div className="nav-menu-section">
                <div className="nav-menu-label">
                  {t("header.menu.sections.language")} / {getLanguageLabel(locale)}
                </div>
                {SUPPORTED_LOCALES.map((language) => (
                  <button
                    key={language}
                    type="button"
                    onClick={(event) =>
                      runMenuAction(event, () => {
                        setLocale(language);
                      })
                    }
                    aria-pressed={locale === language}
                  >
                    {getLanguageMenuLabel(language)}
                    {locale === language ? " *" : ""}
                  </button>
                ))}
              </div>
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}
