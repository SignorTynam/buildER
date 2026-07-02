import { useEffect, useRef, useState } from "react";
import { SUPPORTED_LOCALES } from "../i18n";
import { useI18n } from "../i18n/useI18n";
import type { WorkspaceView } from "../types/translation";
import { StudioIcon } from "./icons/StudioIcon";
import type { ProjectActivityId } from "./project/ProjectActivityPanel";

type TopbarMenuId = "file" | "importExport" | "help" | "language";

interface AppHeaderProps {
  appTitle: string;
  appVersion: string;
  diagramName: string;
  diagramView: WorkspaceView;
  logicalSqlOpen: boolean;
  codePanelOpen: boolean;
  notesPanelOpen: boolean;
  logicalOutOfDate: boolean;
  focusMode: boolean;
  hasUncommittedChanges: boolean;
  versioningCommitCount: number;
  issueCount: number;
  warningCount: number;
  showDiagnostics: boolean;
  activeActivityPanel: ProjectActivityId;
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
  onRenameProject: () => void;
  onOpenVersioningPanel: () => void;
  onToggleCodePanel: () => void;
  onToggleNotesPanel: () => void;
  onRegenerateErs: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onSaveErs: () => void;
  onOpenSqlReverseWorkflow: () => void;
  onImportSql: () => void;
  onOpenErrorsPanel: () => void;
  onToggleDiagnostics: () => void;
  onExportPng: () => void;
  onExportJpeg: () => void;
  onExportSvg: () => void;
  onExportSql: () => void;
  onOpenCommandMenu: () => void;
  onOpenShortcuts: () => void;
  onOpenAbout: () => void;
  onOpenWhatsNew: () => void;
  onActivityPanelSelect: (panel: ProjectActivityId) => void;
  onCreateCommit: () => void;
  onDiagramNameChange?: (name: string) => void;
}

export function AppHeader(props: AppHeaderProps) {
  const { locale, setLocale, getLanguageMenuLabel, t } = useI18n();
  const [draftName, setDraftName] = useState(props.diagramName);
  const [activeTopbarMenu, setActiveTopbarMenu] = useState<TopbarMenuId | null>(null);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);
  const importExportMenuRef = useRef<HTMLDivElement | null>(null);
  const helpMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const activeElement = typeof document === "undefined" ? null : document.activeElement;
    if (activeElement?.getAttribute("data-project-name-input") !== "true") {
      setDraftName(props.diagramName);
    }
  }, [props.diagramName]);

  useEffect(() => {
    if (!activeTopbarMenu || typeof document === "undefined") {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      const topbarMenuRefs = [
        fileMenuRef,
        importExportMenuRef,
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

  function commitProjectName() {
    const trimmed = draftName.trim() || t("appHeader.defaultProjectName");
    setDraftName(trimmed);
    if (trimmed !== props.diagramName) {
      props.onDiagramNameChange?.(trimmed);
    }
  }

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
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onCloseProject)}>{t("fileMenu.closeProject")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onLoadProject)}>{t("fileMenu.openProject")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onSaveProject)}>{t("fileMenu.saveProject")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onShowWelcome)}>{t("fileMenu.showWelcome")}</button>
              <div className="app-file-menu__separator app-topbar-menu__separator" role="separator" />
              <span className="app-file-menu__section app-topbar-menu__section">{t("fileMenu.newFile")}</span>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onNewSchema)}>{t("fileMenu.newSchema")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onNewNote)}>{t("fileMenu.newNote")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onNewSql)}>{t("fileMenu.newSql")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onNewFolder)}>{t("fileMenu.newFolder")}</button>
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
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onImportSql)}>{t("fileMenu.importSql")}</button>
              <div className="app-topbar-menu__separator" role="separator" />
              <span className="app-topbar-menu__section">{t("fileMenu.export")}</span>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onSaveProject)}>{t("fileMenu.exportProject")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onExportCurrentSchema)}>{t("fileMenu.exportSchema")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onSaveErs)}>{t("fileMenu.exportErs")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onExportSql)}>{t("fileMenu.exportSql")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onExportPng)}>{t("fileMenu.exportPng")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onExportJpeg)}>{t("fileMenu.exportJpeg")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onExportSvg)}>{t("fileMenu.exportSvg")}</button>
            </div>
          ) : null}
        </div>

        <input
          data-project-name-input="true"
          className="designer-project-name"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitProjectName}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          aria-label={t("appHeader.projectNameAria")}
        />
      </div>

      <div className="designer-brand app-command-topbar__brand" aria-label={t("appHeader.brandAria")}>
        <strong>{props.appTitle}</strong>
        <span>v{props.appVersion}</span>
      </div>

      <div className="designer-topbar-actions">
        <div className="app-topbar-menu app-topbar-menu--help" ref={helpMenuRef}>
          <button
            type="button"
            className="designer-icon-button app-topbar-menu__icon-trigger"
            onClick={() => toggleTopbarMenu("help")}
            title={t("appHeader.actions.helpTitle")}
            aria-label={t("appHeader.actions.helpAria")}
            aria-haspopup="menu"
            aria-expanded={activeTopbarMenu === "help"}
            data-testid="app-header-help-menu"
          >
            <StudioIcon name="help" aria-hidden="true" />
          </button>

          {activeTopbarMenu === "help" ? (
            <div
              className="app-topbar-menu__panel app-topbar-menu__panel--compact app-topbar-menu__panel--right"
              role="menu"
              aria-label={t("fileMenu.help")}
              data-menu-block="help"
            >
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onOpenShortcuts)}>{t("fileMenu.shortcuts")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onOpenWhatsNew)}>{t("fileMenu.whatsNew")}</button>
              <button type="button" role="menuitem" onClick={() => runTopbarMenuAction(props.onOpenAbout)}>{t("fileMenu.about")}</button>
            </div>
          ) : null}
        </div>

        <div className="designer-language-menu app-topbar-menu" ref={languageMenuRef}>
          <button
            type="button"
            className="designer-icon-button app-topbar-menu__icon-trigger"
            onClick={() => toggleTopbarMenu("language")}
            title={t("appHeader.actions.languageTitle")}
            aria-label={t("appHeader.actions.languageAria")}
            aria-haspopup="menu"
            aria-expanded={activeTopbarMenu === "language"}
            data-testid="app-header-language"
          >
            <StudioIcon name="globe" aria-hidden="true" />
          </button>

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

        <button
          type="button"
          className="designer-icon-button"
          onClick={props.onOpenCommandMenu}
          title={t("appHeader.actions.menuTitle")}
          aria-label={t("appHeader.actions.menuAria")}
          data-testid="app-header-menu"
        >
          <StudioIcon name="menu" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
