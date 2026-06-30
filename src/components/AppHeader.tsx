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
  onNewSchema: () => void;
  onImportSchema: () => void;
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
  onDiagramNameChange?: (name: string) => void;
}

export function AppHeader(props: AppHeaderProps) {
  const { locale, setLocale, getLanguageMenuLabel, t } = useI18n();
  const [draftName, setDraftName] = useState(props.diagramName);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const activeElement = typeof document === "undefined" ? null : document.activeElement;
    if (activeElement?.getAttribute("data-project-name-input") !== "true") {
      setDraftName(props.diagramName);
    }
  }, [props.diagramName]);

  useEffect(() => {
    if (!languageMenuOpen || typeof document === "undefined") {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && languageMenuRef.current?.contains(target)) {
        return;
      }
      setLanguageMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLanguageMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [languageMenuOpen]);

  function commitProjectName() {
    const trimmed = draftName.trim() || t("appHeader.defaultProjectName");
    setDraftName(trimmed);
    if (trimmed !== props.diagramName) {
      props.onDiagramNameChange?.(trimmed);
    }
  }

  const headerActivities: Array<{ id: ProjectActivityId; label: string }> = [
    { id: "file", label: t("appHeader.menus.file") },
    { id: "code", label: t("appHeader.menus.code") },
    { id: "reverse", label: t("appHeader.menus.reverse") },
    { id: "errors", label: t("appHeader.menus.errors") },
    { id: "version", label: t("appHeader.menus.version") },
    { id: "export", label: t("appHeader.menus.export") },
  ];

  return (
    <header className={`designer-topbar app-command-topbar app-header-view-${props.diagramView}`}>
      <div className="designer-brand" aria-label={t("appHeader.brandAria")}>
        <strong>{props.appTitle}</strong>
        <span>v{props.appVersion}</span>
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

      <nav className="app-command-bar" aria-label={t("appHeader.commandBarAria")}>
        {headerActivities.map((activity) => (
          <button
            key={activity.id}
            type="button"
            className={props.activeActivityPanel === activity.id ? "app-command-tab active" : "app-command-tab"}
            aria-pressed={props.activeActivityPanel === activity.id}
            onClick={() => props.onActivityPanelSelect(activity.id)}
          >
            <span>{activity.label}</span>
            {activity.id === "errors" && props.issueCount > 0 ? (
              <span className="app-command-menu__badge" title={t("appHeader.commands.errorBadge", { count: props.issueCount, warnings: props.warningCount })}>
                  {props.issueCount}
                </span>
            ) : null}
          </button>
        ))}
      </nav>

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
