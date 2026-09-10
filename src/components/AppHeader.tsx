import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LOCALES } from "../i18n";
import { useI18n } from "../i18n/useI18n";
import type { WorkspaceView } from "../types/translation";
import { StudioIcon } from "./icons/StudioIcon";
import { Tooltip } from "./ui";
import type { ProjectActivityId } from "./project/ProjectActivityPanel";

type TopbarMenuId = "file" | "importExport" | "info" | "help" | "language";

interface AppHeaderProps {
  appTitle: string;
  appVersion: string;
  projectName?: string;
  saveState?: "saved" | "modified" | "saving" | "error";
  diagramView: WorkspaceView;
  logicalSqlOpen: boolean;
  codePanelOpen: boolean;
  logicalOutOfDate: boolean;
  focusMode: boolean;
  hasUncommittedChanges: boolean;
  versioningCommitCount: number;
  issueCount: number;
  warningCount: number;
  showDiagnostics: boolean;
  activeActivityPanel: ProjectActivityId;
  hasProject: boolean;
  onNewProject: () => void;
  onCloseProject: () => void;
  onShowWelcome: () => void;
  onNewSchema: () => void;
  onNewNote: () => void;
  onNewSql: () => void;
  onNewFolder: () => void;
  onImportSchema: () => void;
  onImportErs: () => void;
  onExportCurrentSchema: () => void;
  onOpenVersioningPanel: () => void;
  onToggleCodePanel: () => void;
  onRegenerateErs: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onSaveErs: () => void;
  onOpenSqlReverseWorkflow: () => void;
  onImportSql: () => void;
  onOpenSqliteDatabase: () => void;
  onOpenErrorsPanel: () => void;
  onToggleDiagnostics: () => void;
  onExportPng: () => void;
  onExportJpeg: () => void;
  onExportSvg: () => void;
  onExportSql: () => void;
  onOpenCommandMenu: () => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  onOpenAbout: () => void;
  onOpenReleaseCenter: () => void;
  unreadReleaseCount: number;
  onActivityPanelSelect: (panel: ProjectActivityId) => void;
  onCreateCommit: () => void;
}

export function AppHeader(props: AppHeaderProps) {
  const { locale, setLocale, getLanguageMenuLabel, t } = useI18n();
  const [activeTopbarMenu, setActiveTopbarMenu] = useState<TopbarMenuId | null>(null);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);
  const importExportMenuRef = useRef<HTMLDivElement | null>(null);
  const infoMenuRef = useRef<HTMLDivElement | null>(null);
  const helpMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeTopbarMenu || typeof document === "undefined") {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      const topbarMenuRefs = [
        fileMenuRef,
        importExportMenuRef,
        infoMenuRef,
        helpMenuRef,
        languageMenuRef,
      ];
      if (target instanceof Node && topbarMenuRefs.some((ref) => ref.current?.contains(target))) {
        return;
      }
      setActiveTopbarMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActiveTopbarMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeTopbarMenu]);

  function toggleTopbarMenu(menu: TopbarMenuId) {
    setActiveTopbarMenu((current) => (current === menu ? null : menu));
  }

  function runTopbarMenuAction(action: () => void) {
    setActiveTopbarMenu(null);
    action();
  }

  return (
    <header className={`designer-topbar app-command-topbar app-header-view-${props.diagramView}`}>
      <div className="app-command-topbar__left">
        <div className="designer-brand app-command-topbar__brand" aria-label={t("appHeader.brandAria")}>
          <strong>{props.appTitle}</strong>
          <span>v{props.appVersion}</span>
        </div>
        <div className="app-file-menu app-topbar-menu" ref={fileMenuRef}>
          <button
            type="button"
            className="app-file-menu__trigger app-topbar-menu__trigger"
            aria-haspopup="menu"
            aria-expanded={activeTopbarMenu === "file"}
            onClick={() => toggleTopbarMenu("file")}
            data-testid="app-header-file-menu"
          >
            {t("fileMenu.file")}
          </button>

          {activeTopbarMenu === "file" ? (
            <div
              className="app-file-menu__panel app-topbar-menu__panel"
              role="menu"
              aria-label={t("fileMenu.file")}
              data-menu-block="file"
            >
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onNewProject)}>{t("fileMenu.newProject")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onCloseProject)} disabled={!props.hasProject}>{t("fileMenu.closeProject")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onLoadProject)}>{t("fileMenu.openProject")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onSaveProject)} disabled={!props.hasProject}>{t("fileMenu.saveProject")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onShowWelcome)} disabled={!props.hasProject}>{t("fileMenu.showWelcome")}</button>
              <div className="app-file-menu__separator app-topbar-menu__separator" role="separator" />
              <span className="app-file-menu__section app-topbar-menu__section">{t("fileMenu.newFile")}</span>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onNewSchema)} disabled={!props.hasProject}>{t("fileMenu.newSchema")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onNewNote)} disabled={!props.hasProject}>{t("fileMenu.newNote")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onNewSql)} disabled={!props.hasProject}>{t("fileMenu.newSql")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onNewFolder)} disabled={!props.hasProject}>{t("fileMenu.newFolder")}</button>
            </div>
          ) : null}
        </div>

        <div className="app-topbar-menu" ref={importExportMenuRef}>
          <button
            type="button"
            className="app-topbar-menu__trigger"
            aria-haspopup="menu"
            aria-expanded={activeTopbarMenu === "importExport"}
            onClick={() => toggleTopbarMenu("importExport")}
            data-testid="app-header-import-export-menu"
          >
            {t("fileMenu.importExport")}
          </button>

          {activeTopbarMenu === "importExport" ? (
            <div
              className="app-topbar-menu__panel"
              role="menu"
              aria-label={t("fileMenu.importExport")}
              data-menu-block="import-export"
            >
              <span className="app-topbar-menu__section">{t("fileMenu.import")}</span>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onImportSchema)}>{t("fileMenu.importSchema")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onImportErs)}>{t("fileMenu.importErs")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onImportSql)} disabled={!props.hasProject}>{t("fileMenu.importSql")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onOpenSqliteDatabase)}>{t("databaseWorkspace.openDatabase")}</button>
              <div className="app-topbar-menu__separator" role="separator" />
              <span className="app-topbar-menu__section">{t("fileMenu.export")}</span>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onSaveProject)} disabled={!props.hasProject}>{t("fileMenu.exportProject")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onExportCurrentSchema)} disabled={!props.hasProject}>{t("fileMenu.exportSchema")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onSaveErs)} disabled={!props.hasProject}>{t("fileMenu.exportErs")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onExportSql)} disabled={!props.hasProject}>{t("fileMenu.exportSql")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onExportPng)} disabled={!props.hasProject}>{t("fileMenu.exportPng")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onExportJpeg)} disabled={!props.hasProject}>{t("fileMenu.exportJpeg")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onExportSvg)} disabled={!props.hasProject}>{t("fileMenu.exportSvg")}</button>
            </div>
          ) : null}
        </div>

        <div className="app-topbar-menu" ref={infoMenuRef}>
          <button
            type="button"
            className="app-topbar-menu__trigger"
            aria-haspopup="menu"
            aria-expanded={activeTopbarMenu === "info"}
            onClick={() => toggleTopbarMenu("info")}
            data-testid="app-header-info-menu"
          >
            {t("fileMenu.about")}
          </button>

          {activeTopbarMenu === "info" ? (
            <div
              className="app-topbar-menu__panel app-topbar-menu__panel--compact"
              role="menu"
              aria-label={t("fileMenu.about")}
              data-menu-block="info"
            >
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onOpenCommandMenu)}>{t("fileMenu.menu")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onOpenReleaseCenter)}>{t("releases.header.label")}</button>
            </div>
          ) : null}
        </div>

      </div>

      <div className="app-command-topbar__center">
        <div className="app-project-context" title={props.projectName ?? t("workspaceChrome.noProject")}>
          <span className="app-project-context__name">
            {props.hasProject ? props.projectName ?? t("workspaceChrome.untitledProject") : t("workspaceChrome.noProject")}
          </span>
          {props.hasProject ? (
            <span
              className={`app-project-context__state is-${props.saveState ?? (props.hasUncommittedChanges ? "modified" : "saved")}`}
              title={props.saveState === "saving"
                ? t("workspaceChrome.saveState.saving")
                : props.saveState === "error"
                  ? t("workspaceChrome.saveState.error")
                  : props.hasUncommittedChanges
                    ? t("workspaceChrome.saveState.modified")
                    : t("workspaceChrome.saveState.saved")}
            >
              <span aria-hidden="true">{props.hasUncommittedChanges ? "●" : "✓"}</span>
              {props.saveState === "saving" || props.saveState === "error" ? (
                props.saveState === "saving"
                  ? t("workspaceChrome.saveState.saving")
                  : t("workspaceChrome.saveState.error")
              ) : (
                <span className="visually-hidden-chrome-state">
                  {props.hasUncommittedChanges
                    ? t("workspaceChrome.saveState.modified")
                    : t("workspaceChrome.saveState.saved")}
                </span>
              )}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="app-command-search"
          onClick={props.onOpenCommandMenu}
          title={t("workspaceChrome.commandSearchTooltip")}
          aria-label={t("workspaceChrome.commandSearchAria")}
        >
          <StudioIcon name="search" size={15} aria-hidden="true" />
          <span>{t("workspaceChrome.commandSearch")}</span>
          <kbd>Ctrl K</kbd>
        </button>
      </div>

      <div className="designer-topbar-actions">
        <Tooltip position="bottom" label={t("releases.header.tooltip")}>
          <button
            type="button"
            className="designer-icon-button release-center-button"
            onClick={props.onOpenReleaseCenter}
            aria-label={t("releases.header.ariaLabel", { count: props.unreadReleaseCount })}
            data-testid="app-header-release-center"
          >
            <StudioIcon name="sparkles" aria-hidden="true" />
            <span className="release-center-button__label">{t("releases.header.label")}</span>
            {props.unreadReleaseCount > 0 ? (
              <span className="release-center-button__badge" aria-label={t("releases.header.unreadAria", { count: props.unreadReleaseCount })}>
                {props.unreadReleaseCount > 9 ? "9+" : props.unreadReleaseCount}
              </span>
            ) : null}
          </button>
        </Tooltip>
        <Tooltip position="bottom" label={t("settings.open")}>
          <button
            type="button"
            className="designer-icon-button"
            onClick={props.onOpenSettings}
            aria-label={t("settings.open")}
            data-testid="app-header-settings"
          >
            <StudioIcon name="settings" aria-hidden="true" />
          </button>
        </Tooltip>
        <div className="app-topbar-menu app-topbar-menu--help" ref={helpMenuRef}>
          <Tooltip position="bottom" label={t("appHeader.actions.helpTitle")}>
            <button
              type="button"
              className="designer-icon-button app-topbar-menu__icon-trigger"
              onClick={() => toggleTopbarMenu("help")}
              aria-label={t("appHeader.actions.helpAria")}
              aria-haspopup="menu"
              aria-expanded={activeTopbarMenu === "help"}
              data-testid="app-header-help-menu"
            >
              <StudioIcon name="help" aria-hidden="true" />
            </button>
          </Tooltip>

          {activeTopbarMenu === "help" ? (
            <div
              className="app-topbar-menu__panel app-topbar-menu__panel--compact app-topbar-menu__panel--right"
              role="menu"
              aria-label={t("fileMenu.help")}
              data-menu-block="help"
            >
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onOpenShortcuts)}>{t("fileMenu.shortcuts")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onOpenReleaseCenter)}>{t("releases.header.label")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onOpenAbout)}>{t("fileMenu.about")}</button>
            </div>
          ) : null}
        </div>

        <div className="designer-language-menu app-topbar-menu" ref={languageMenuRef}>
          <Tooltip position="bottom" label={t("appHeader.actions.languageTitle")}>
            <button
              type="button"
              className="designer-icon-button app-topbar-menu__icon-trigger"
              onClick={() => toggleTopbarMenu("language")}
              aria-label={t("appHeader.actions.languageAria")}
              aria-haspopup="menu"
              aria-expanded={activeTopbarMenu === "language"}
              data-testid="app-header-language"
            >
              <StudioIcon name="globe" aria-hidden="true" />
            </button>
          </Tooltip>

          {activeTopbarMenu === "language" ? (
            <div
              className="designer-language-menu__panel app-topbar-menu__panel app-topbar-menu__panel--right"
              role="menu"
              aria-label={t("appHeader.actions.languageMenuAria")}
              data-testid="app-header-language-menu"
            >
              {SUPPORTED_LOCALES.map((language) => (
                <button
                  key={language}
                  type="button"
                  role="menuitemradio"
                  aria-checked={locale === language}
                  className={
                    locale === language
                      ? "designer-language-menu__item active"
                      : "designer-language-menu__item"
                  }
                  onClick={() => runTopbarMenuAction(() => setLocale(language))}
                  data-testid={`app-header-language-${language}`}
                >
                  <span>{getLanguageMenuLabel(language)}</span>
                  {locale === language ? (
                    <StudioIcon name="done" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <Tooltip position="bottom" label={t("appHeader.actions.menuTitle")}>
          <button
            type="button"
            className="designer-icon-button"
            onClick={props.onOpenCommandMenu}
            aria-label={t("appHeader.actions.menuAria")}
            data-testid="app-header-menu"
          >
            <StudioIcon name="menu" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    </header>
  );
}
