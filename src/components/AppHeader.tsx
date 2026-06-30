import { useEffect, useRef, useState } from "react";
import type { WorkspaceView } from "../types/translation";
import { SUPPORTED_LOCALES } from "../i18n";
import { useI18n } from "../i18n/useI18n";
import { StudioIcon } from "./icons/StudioIcon";

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
  onDiagramNameChange?: (name: string) => void;
}

type HeaderMenuId = "file" | "code" | "reverse" | "errors" | "export";

interface HeaderCommandItem {
  label: string;
  action: () => void;
  disabled?: boolean;
  badge?: string;
}

export function AppHeader(props: AppHeaderProps) {
  const { locale, setLocale, getLanguageMenuLabel, t } = useI18n();
  const [draftName, setDraftName] = useState(props.diagramName);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [activeCommandMenu, setActiveCommandMenu] = useState<HeaderMenuId | null>(null);
  const languageMenuRef = useRef<HTMLDivElement | null>(null);
  const commandMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const activeElement = typeof document === "undefined" ? null : document.activeElement;
    if (activeElement?.getAttribute("data-project-name-input") !== "true") {
      setDraftName(props.diagramName);
    }
  }, [props.diagramName]);

  useEffect(() => {
    if ((!languageMenuOpen && !activeCommandMenu) || typeof document === "undefined") {
      return undefined;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Node && languageMenuRef.current?.contains(target)) {
        return;
      }
      if (target instanceof Node && commandMenuRef.current?.contains(target)) {
        return;
      }
      setLanguageMenuOpen(false);
      setActiveCommandMenu(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setLanguageMenuOpen(false);
        setActiveCommandMenu(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeCommandMenu, languageMenuOpen]);

  function commitProjectName() {
    const trimmed = draftName.trim() || t("appHeader.defaultProjectName");
    setDraftName(trimmed);
    if (trimmed !== props.diagramName) {
      props.onDiagramNameChange?.(trimmed);
    }
  }

  function runHeaderCommand(action: () => void) {
    setActiveCommandMenu(null);
    action();
  }

  const headerMenus: Array<{ id: HeaderMenuId; label: string; items: HeaderCommandItem[] }> = [
    {
      id: "file",
      label: t("appHeader.menus.file"),
      items: [
        { label: t("appHeader.commands.newProject"), action: props.onNewProject },
        { label: t("appHeader.commands.openProject"), action: props.onLoadProject },
        { label: t("appHeader.commands.saveProject"), action: props.onSaveProject },
        { label: t("appHeader.commands.newSchema"), action: props.onNewSchema },
        { label: t("appHeader.commands.importSchema"), action: props.onImportSchema },
        { label: t("appHeader.commands.exportCurrentSchema"), action: props.onExportCurrentSchema },
        { label: t("appHeader.commands.downloadErs"), action: props.onSaveErs },
        { label: t("appHeader.commands.renameProject"), action: props.onRenameProject },
      ],
    },
    {
      id: "code",
      label: t("appHeader.menus.code"),
      items: [
        {
          label: props.codePanelOpen ? t("appHeader.commands.closeCode") : t("appHeader.commands.openCode"),
          action: props.onToggleCodePanel,
        },
        { label: t("appHeader.commands.regenerateErs"), action: props.onRegenerateErs },
        { label: t("appHeader.commands.downloadErs"), action: props.onSaveErs },
      ],
    },
    {
      id: "reverse",
      label: t("appHeader.menus.reverse"),
      items: [
        { label: t("appHeader.commands.openSqlReverse"), action: props.onOpenSqlReverseWorkflow },
        { label: t("appHeader.commands.importSql"), action: props.onImportSql },
      ],
    },
    {
      id: "errors",
      label: t("appHeader.menus.errors"),
      items: [
        {
          label: t("appHeader.commands.openErrors"),
          action: props.onOpenErrorsPanel,
          badge: props.issueCount > 0 ? String(props.issueCount) : undefined,
        },
        {
          label: props.showDiagnostics
            ? t("appHeader.commands.hideDiagnostics")
            : t("appHeader.commands.showDiagnostics"),
          action: props.onToggleDiagnostics,
        },
      ],
    },
    {
      id: "export",
      label: t("appHeader.menus.export"),
      items: [
        { label: t("appHeader.commands.exportPng"), action: props.onExportPng },
        { label: t("appHeader.commands.exportJpeg"), action: props.onExportJpeg },
        { label: t("appHeader.commands.exportSvg"), action: props.onExportSvg },
        { label: t("appHeader.commands.exportProject"), action: props.onSaveProject },
        { label: t("appHeader.commands.exportCurrentSchema"), action: props.onExportCurrentSchema },
        { label: t("appHeader.commands.exportSql"), action: props.onExportSql, disabled: props.diagramView !== "logical" },
      ],
    },
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

      <nav className="app-command-bar" aria-label={t("appHeader.commandBarAria")} ref={commandMenuRef}>
        {headerMenus.map((menu) => (
          <div className="app-command-menu" key={menu.id}>
            <button
              type="button"
              className={activeCommandMenu === menu.id ? "active" : ""}
              aria-haspopup="menu"
              aria-expanded={activeCommandMenu === menu.id}
              onClick={() => setActiveCommandMenu((current) => (current === menu.id ? null : menu.id))}
            >
              <span>{menu.label}</span>
              {menu.id === "errors" && props.issueCount > 0 ? (
                <span className="app-command-menu__badge" title={t("appHeader.commands.errorBadge", { count: props.issueCount, warnings: props.warningCount })}>
                  {props.issueCount}
                </span>
              ) : null}
            </button>
            {activeCommandMenu === menu.id ? (
              <div className="app-command-menu__panel" role="menu">
                {menu.items.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    role="menuitem"
                    disabled={item.disabled}
                    onClick={() => runHeaderCommand(item.action)}
                  >
                    <span>{item.label}</span>
                    {item.badge ? <span className="app-command-menu__badge">{item.badge}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </nav>

      <div className="designer-topbar-actions">
        <button
          type="button"
          onClick={props.onNewProject}
          aria-label={t("appHeader.actions.newProjectAria")}
          data-testid="app-header-new-project"
        >
          <StudioIcon name="newProject" aria-hidden="true" />
          <span className="desktop-label">{t("appHeader.actions.newProject")}</span>
          <span className="mobile-label" aria-hidden="true">{t("appHeader.actions.newProjectShort")}</span>
        </button>
        <button
          type="button"
          onClick={props.onLoadProject}
          aria-label={t("appHeader.actions.openProjectAria")}
          data-testid="app-header-open-project"
        >
          <StudioIcon name="openProject" aria-hidden="true" />
          <span className="desktop-label">{t("appHeader.actions.openProject")}</span>
          <span className="mobile-label" aria-hidden="true">{t("appHeader.actions.openProjectShort")}</span>
        </button>
        <button
          type="button"
          className={props.hasUncommittedChanges ? "designer-versioning-button has-uncommitted" : "designer-versioning-button"}
          onClick={props.onOpenVersioningPanel}
          aria-label={
            props.hasUncommittedChanges
              ? t("appHeader.actions.versioningDirtyAria", { count: props.versioningCommitCount })
              : t("appHeader.actions.versioningCleanAria", { count: props.versioningCommitCount })
          }
          title={
            props.hasUncommittedChanges
              ? t("appHeader.actions.versioningDirtyAria", { count: props.versioningCommitCount })
              : t("appHeader.actions.versioningCleanAria", { count: props.versioningCommitCount })
          }
          data-testid="app-header-versioning"
        >
          <StudioIcon name="history" aria-hidden="true" />
          <span className="desktop-label">{t("versioning.versions")}</span>
          {props.versioningCommitCount > 0 ? (
            <span className="versioning-count-badge" aria-label={t("versioning.commitCount", { count: props.versioningCommitCount })}>
              {props.versioningCommitCount}
            </span>
          ) : null}
          {props.hasUncommittedChanges ? (
            <span className="versioning-dot" aria-label={t("versioning.uncommittedChanges")} />
          ) : null}
        </button>
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
