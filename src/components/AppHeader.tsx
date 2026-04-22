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
  const currentViewLabel = props.logicalSqlOpen
    ? "SQL"
    : props.diagramView === "er"
      ? "ER"
      : props.diagramView === "translation"
        ? t("header.views.translation")
        : t("header.views.logical");
  const editorStateLabel = isErView ? t(`header.modes.${props.mode}`) : "Solo ER";
  const workspaceStateLabel =
    isLogicalView && props.logicalOutOfDate
      ? "Modello logico da riallineare"
      : props.logicalSqlOpen
        ? "Anteprima SQL attiva"
      : props.focusMode
        ? "Focus canvas attivo"
        : "Workspace attivo";

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
    const width = Math.min(360, Math.max(280, window.innerWidth - viewportPadding * 2));
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
    props.focusMode ? "focus-mode" : "",
    `app-header-view-${props.diagramView}`,
    isErView ? `app-header-mode-${props.mode}` : "app-header-mode-passive",
  ]
    .filter(Boolean)
    .join(" ");

  const workflowActionLabel = isErView
    ? "Apri traduzione"
    : isTranslationView
      ? "Genera schema logico"
      : props.logicalOutOfDate
        ? "Riallinea logico"
        : props.logicalSqlOpen
          ? "Torna alle decisioni"
          : "Apri SQL";

  function handleWorkflowAction() {
    if (isErView) {
      props.onDiagramViewChange("translation");
      return;
    }

    if (isTranslationView || props.logicalOutOfDate) {
      props.onGenerateLogicalModel();
      return;
    }

    if (props.logicalSqlOpen) {
      props.onOpenLogicalWorkflow();
      return;
    }

    props.onOpenSql();
  }

  return (
    <header className={headerClassName}>
      <div className="app-title-block">
        <div className="app-title-inline">
          <h1>{props.appTitle}</h1>
          <div className="app-version-pill">v{props.appVersion}</div>
          <div className="app-subtitle">{props.diagramName}</div>
        </div>
        <div className="header-title-meta" aria-label="Stato workspace">
          <span className="header-status-pill">{currentViewLabel}</span>
          <span className="header-status-pill">{editorStateLabel}</span>
          <span
            className={
              isLogicalView && props.logicalOutOfDate
                ? "header-status-pill header-status-pill-warning"
                : "header-status-pill header-status-pill-muted"
            }
          >
            {workspaceStateLabel}
          </span>
        </div>
      </div>

      <div className="header-toolbar-row">
        <div className="header-inline-group header-inline-group-primary" role="group" aria-label="Azioni della fase corrente">
          <span className="header-inline-label">Fase corrente</span>
          <button
            type="button"
            className="header-button header-primary-button"
            onClick={handleWorkflowAction}
          >
            {workflowActionLabel}
          </button>
        </div>

        {isErView ? (
          <div className="header-inline-group header-inline-group-mode">
            <span className="header-inline-label">Modalita</span>
            <div className="mode-switch mode-switch-secondary" role="group" aria-label={t("header.editorModeGroupLabel")}>
              <button
                className={props.mode === "edit" && isErView ? "mode-button active" : "mode-button"}
                type="button"
                onClick={() => props.onModeChange("edit")}
                disabled={!isErView}
              >
                {t("header.modes.edit")}
              </button>
              <button
                className={props.mode === "view" && isErView ? "mode-button active" : "mode-button"}
                type="button"
                onClick={() => props.onModeChange("view")}
                disabled={!isErView}
              >
                {t("header.modes.view")}
              </button>
            </div>
          </div>
        ) : null}

        <div className="header-inline-group header-inline-group-menu">
          <nav ref={navRef} className="header-nav" aria-label={t("header.secondaryActionsLabel")}>
            <details ref={menuGroupRef} className="nav-group nav-group-menu" onToggle={handleGroupToggle}>
              <summary>Altro</summary>
              <div
                className="nav-menu nav-menu-wide nav-menu-floating"
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
                  <div className="nav-menu-label">Fase</div>
                  {isTranslationView ? (
                    <button
                      type="button"
                      onClick={(event) => runMenuAction(event, props.onResetTranslation)}
                    >
                      {t("header.quickActions.resetTranslation")}
                    </button>
                  ) : null}
                  {isLogicalView ? (
                    <>
                      <button type="button" onClick={(event) => runMenuAction(event, props.onOpenSql)}>
                        {props.logicalSqlOpen ? "SQL gia aperto" : "Apri SQL"}
                      </button>
                      <button type="button" onClick={(event) => runMenuAction(event, props.onOpenLogicalWorkflow)}>
                        Torna alle decisioni
                      </button>
                      <button
                        type="button"
                        onClick={(event) => runMenuAction(event, props.onGenerateLogicalModel)}
                      >
                        {props.logicalOutOfDate
                          ? t("header.quickActions.resetLogicalOutdated")
                          : t("header.quickActions.resetLogical")}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => runMenuAction(event, props.onAutoLayoutLogical)}
                      >
                        {t("header.quickActions.autoLayout")}
                      </button>
                      <button type="button" onClick={(event) => runMenuAction(event, props.onFitLogical)}>
                        {t("header.quickActions.fitLogical")}
                      </button>
                    </>
                  ) : null}
                </div>

                <div className="nav-menu-section">
                  <div className="nav-menu-label">{t("header.menu.sections.workspace")}</div>
                  {isErView ? (
                    <>
                      <button type="button" onClick={(event) => runMenuAction(event, () => props.onModeChange("edit"))}>
                        Passa a modifica
                      </button>
                      <button type="button" onClick={(event) => runMenuAction(event, () => props.onModeChange("view"))}>
                        Passa a lettura
                      </button>
                    </>
                  ) : null}
                  {isErView ? (
                    <button type="button" onClick={(event) => runMenuAction(event, props.onToggleCodePanel)}>
                      {props.codePanelOpen ? "Chiudi diagram code" : "Apri diagram code"}
                    </button>
                  ) : null}
                  <button type="button" onClick={(event) => runMenuAction(event, props.onToggleNotesPanel)}>
                    {props.notesPanelOpen ? "Chiudi note" : "Apri note"}
                  </button>
                  <button type="button" onClick={(event) => runMenuAction(event, props.onToggleFocusMode)}>
                    {props.focusMode ? "Disattiva focus" : "Attiva focus"}
                  </button>
                  <button type="button" onClick={(event) => runMenuAction(event, props.onToggleToolRail)}>
                    {props.toolRailCollapsed ? "Apri strumenti" : "Comprimi strumenti"}
                  </button>
                  <button type="button" onClick={(event) => runMenuAction(event, props.onResetErs)}>
                    {t("header.menu.actions.regenerateErs")}
                  </button>
                </div>

                <div className="nav-menu-section">
                  <div className="nav-menu-label">Modifica</div>
                  <button
                    type="button"
                    onClick={(event) => runMenuAction(event, props.onUndo)}
                    disabled={!props.canUndo}
                  >
                    {t("common.actions.undo")}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => runMenuAction(event, props.onRedo)}
                    disabled={!props.canRedo}
                  >
                    {t("common.actions.redo")}
                  </button>
                </div>

                <div className="nav-menu-section">
                  <div className="nav-menu-label">{t("header.menu.sections.file")}</div>
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
                  <div className="nav-menu-label">{t("header.menu.sections.export")}</div>
                  <button type="button" onClick={(event) => runMenuAction(event, props.onExportPng)}>
                    PNG
                  </button>
                  <button type="button" onClick={(event) => runMenuAction(event, props.onExportSvg)}>
                    SVG
                  </button>
                </div>

                <div className="nav-menu-section">
                  <div className="nav-menu-label">{t("header.menu.sections.help")}</div>
                  <button type="button" onClick={(event) => runMenuAction(event, props.onOpenErsGuide)}>
                    {t("header.menu.actions.ersGuide")}
                  </button>
                  <button type="button" onClick={(event) => runMenuAction(event, props.onAbout)}>
                    {t("header.menu.actions.about")}
                  </button>
                  <button type="button" onClick={(event) => runMenuAction(event, props.onWhatsNew)}>
                    {t("header.menu.actions.whatsNew")}
                  </button>
                </div>

                <div className="nav-menu-section">
                  <div className="nav-menu-label">
                    {t("header.menu.sections.language")} - {getLanguageLabel(locale)}
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
      </div>
    </header>
  );
}
