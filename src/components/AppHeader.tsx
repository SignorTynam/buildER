import { useEffect, useRef, useState } from "react";
import type { WorkspaceView } from "../types/translation";
import { SUPPORTED_LOCALES } from "../i18n";
import { useI18n } from "../i18n/useI18n";
import { StudioIcon } from "./icons/StudioIcon";
import type { ProjectActivityId } from "./project/ProjectActivityPanel";

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
  onActivityPanelSelect: (panel: ProjectActivityId) => void;
  onCreateCommit: () => void;
  onDiagramNameChange?: (name: string) => void;
}

export function AppHeader(props: AppHeaderProps) {
  const { locale, setLocale, getLanguageMenuLabel, t } = useI18n();
  const [draftName, setDraftName] = useState(props.diagramName);
  const [fileMenuOpen, setFileMenuOpen] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const fileMenuRef = useRef<HTMLDivElement | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const activeElement = typeof document === "undefined" ? null : document.activeElement;
    if (activeElement?.getAttribute("data-project-name-input") !== "true") {
      setDraftName(props.diagramName);
    }
  }, [props.diagramName]);

  useEffect(() => {
    if ((!languageMenuOpen && !fileMenuOpen) || typeof document === "undefined") {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && languageMenuRef.current?.contains(target)) {
        return;
      }
      if (target instanceof Node && fileMenuRef.current?.contains(target)) {
        return;
      }
      setLanguageMenuOpen(false);
      setFileMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLanguageMenuOpen(false);
        setFileMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [fileMenuOpen, languageMenuOpen]);

  function commitProjectName() {
    const trimmed = draftName.trim() || t("appHeader.defaultProjectName");
    setDraftName(trimmed);
    if (trimmed !== props.diagramName) {
      props.onDiagramNameChange?.(trimmed);
    }
  }

  function runFileMenuAction(action: () => void) {
    setFileMenuOpen(false);
    action();
  }

  return (
    <header className={`designer-topbar app-command-topbar app-header-view-${props.diagramView}`}>
      <div className="designer-brand" aria-label={t("appHeader.brandAria")}>
        <strong>{props.appTitle}</strong>
        <span>v{props.appVersion}</span>
      </div>

      <div className="app-file-menu" ref={fileMenuRef}>
        <button
          type="button"
          className="app-file-menu__trigger"
          aria-haspopup="menu"
          aria-expanded={fileMenuOpen}
          onClick={() => setFileMenuOpen((open) => !open)}
          data-testid="app-header-file-menu"
        >
          {t("fileMenu.file")}
        </button>
        {fileMenuOpen ? (
          <div className="app-file-menu__panel" role="menu" aria-label={t("fileMenu.file")}>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onNewProject)}>{t("fileMenu.newProject")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onCloseProject)}>{t("fileMenu.closeProject")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onLoadProject)}>{t("fileMenu.openProject")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onSaveProject)}>{t("fileMenu.saveProject")}</button>
            <div className="app-file-menu__separator" role="separator" />
            <span className="app-file-menu__section">{t("fileMenu.newFile")}</span>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onNewSchema)}>{t("fileMenu.newSchema")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onNewNote)}>{t("fileMenu.newNote")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onNewSql)}>{t("fileMenu.newSql")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onNewFolder)}>{t("fileMenu.newFolder")}</button>
            <div className="app-file-menu__separator" role="separator" />
            <span className="app-file-menu__section">{t("fileMenu.import")}</span>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onImportSchema)}>{t("fileMenu.importSchema")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onImportErs)}>{t("fileMenu.importErs")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onImportSql)}>{t("fileMenu.importSql")}</button>
            <div className="app-file-menu__separator" role="separator" />
            <span className="app-file-menu__section">{t("fileMenu.export")}</span>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onSaveProject)}>{t("fileMenu.exportProject")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onExportCurrentSchema)}>{t("fileMenu.exportSchema")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onSaveErs)}>{t("fileMenu.exportErs")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onExportSql)}>{t("fileMenu.exportSql")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onExportPng)}>{t("fileMenu.exportPng")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onExportJpeg)}>{t("fileMenu.exportJpeg")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onExportSvg)}>{t("fileMenu.exportSvg")}</button>
            <div className="app-file-menu__separator" role="separator" />
            <span className="app-file-menu__section">{t("fileMenu.versioning")}</span>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(() => props.onActivityPanelSelect("version"))}>{t("fileMenu.sourceControl")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onCreateCommit)}>{t("fileMenu.createCommit")}</button>
            <button type="button" role="menuitem" onClick={() => runFileMenuAction(props.onOpenVersioningPanel)}>{t("fileMenu.history")}</button>
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

      <div className="designer-topbar-actions">
        <button
          type="button"
          className="designer-icon-button"
          onClick={props.onOpenShortcuts}
          title={t("appHeader.actions.helpTitle")}
          aria-label={t("appHeader.actions.helpAria")}
          data-testid="app-header-help"
        >
          <StudioIcon name="help" aria-hidden="true" />
        </button>
        <div className="designer-language-menu" ref={languageMenuRef}>
          <button
            type="button"
            className="designer-icon-button"
            onClick={() => setLanguageMenuOpen((open) => !open)}
            title={t("appHeader.actions.languageTitle")}
            aria-label={t("appHeader.actions.languageAria")}
            aria-haspopup="menu"
            aria-expanded={languageMenuOpen}
            data-testid="app-header-language"
          >
            <StudioIcon name="globe" aria-hidden="true" />
          </button>

          {languageMenuOpen ? (
            <div
              className="designer-language-menu__panel"
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
                  onClick={() => {
                    setLocale(language);
                    setLanguageMenuOpen(false);
                  }}
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
