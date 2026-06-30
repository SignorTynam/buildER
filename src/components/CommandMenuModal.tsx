import { useMemo, useState } from "react";
import type { WorkspaceView } from "../types/translation";
import { SUPPORTED_LOCALES, type Locale } from "../i18n";
import { useI18n } from "../i18n/useI18n";
import { StudioIcon, type StudioIconName } from "./icons/StudioIcon";

interface CommandMenuModalProps {
  appTitle: string;
  appVersion: string;
  diagramName: string;
  diagramView: WorkspaceView;
  logicalSqlOpen: boolean;
  codePanelOpen: boolean;
  notesPanelOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  logicalOutOfDate: boolean;
  focusMode: boolean;
  hasUncommittedChanges: boolean;
  toolRailCollapsed: boolean;
  selectionItemCount: number;
  onClose: () => void;
  onOpenShortcuts: () => void;
  onDiagramViewChange: (view: WorkspaceView) => void;
  onOpenSql: () => void;
  onOpenLogicalWorkflow: () => void;
  onNewProject: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicateSelection: () => void;
  onDeleteSelection: () => void;
  onRenameSelection: () => void;
  onGenerateLogicalModel: () => void;
  onResetTranslation: () => void;
  onAutoLayoutLogical: () => void;
  onFitLogical: () => void;
  onOpenSqlReverseWorkflow: () => void;
  onOpenVersioningPanel: () => void;
  onToggleCodePanel: () => void;
  onToggleNotesPanel: () => void;
  onSaveProject: () => void;
  onNewSchema: () => void;
  onImportSchema: () => void;
  onExportCurrentSchema: () => void;
  onSaveErs: () => void;
  onLoadProject: () => void;
  onLoadErs: () => void;
  onExportPng: () => void;
  onExportJpeg: () => void;
  onExportSvg: () => void;
  onResetErs: () => void;
  onAbout: () => void;
  onWhatsNew: () => void;
  onToggleFocusMode: () => void;
  onToggleToolRail: () => void;
}

type CommandCategory = "workflow" | "workspace" | "edit" | "file" | "help" | "language";

type CommandMenuItem = {
  id: string;
  category: CommandCategory;
  label: string;
  detail?: string;
  shortcut?: string;
  icon: StudioIconName;
  disabled?: boolean;
  active?: boolean;
  testId?: string;
  action: () => void;
};

function normalizeCommandSearch(value: string, locale: Locale) {
  return value
    .trim()
    .toLocaleLowerCase(locale)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function commandMatches(item: CommandMenuItem, query: string, categoryLabel: string, locale: Locale) {
  if (!query) {
    return true;
  }

  return normalizeCommandSearch(
    `${item.label} ${item.detail ?? ""} ${item.shortcut ?? ""} ${categoryLabel}`,
    locale,
  ).includes(query);
}

function CommandPaletteItem({ item, onRun }: { item: CommandMenuItem; onRun: (item: CommandMenuItem) => void }) {
  const className = [
    "command-palette-item",
    item.active ? "active" : "",
    item.disabled ? "disabled" : "",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={className}
      onClick={() => onRun(item)}
      disabled={item.disabled}
      aria-pressed={item.active ? true : undefined}
      data-testid={item.testId}
    >
      <span className="command-palette-item-icon" aria-hidden="true">
        <StudioIcon name={item.icon} />
      </span>
      <span className="command-palette-item-copy">
        <span className="command-palette-item-title">{item.label}</span>
        {item.detail ? <span className="command-palette-item-detail">{item.detail}</span> : null}
      </span>
      {item.shortcut ? <kbd className="command-palette-kbd">{item.shortcut}</kbd> : null}
      {item.active ? (
        <span className="command-palette-active-mark" aria-hidden="true">
          <StudioIcon name="done" />
        </span>
      ) : null}
    </button>
  );
}

export function CommandMenuModal(props: CommandMenuModalProps) {
  const { locale, setLocale, getLanguageMenuLabel, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | CommandCategory>("all");
  const isErView = props.diagramView === "er";
  const isTranslationView = props.diagramView === "translation";
  const isLogicalView = props.diagramView === "logical";

  const categoryLabels: Record<CommandCategory, string> = useMemo(
    () => ({
      workflow: t("commandMenu.categories.workflow"),
      workspace: t("commandMenu.categories.workspace"),
      edit: t("commandMenu.categories.edit"),
      file: t("commandMenu.categories.file"),
      help: t("commandMenu.categories.help"),
      language: t("commandMenu.categories.language"),
    }),
    [t],
  );

  const categoryFilters: Array<{ id: "all" | CommandCategory; label: string }> = useMemo(
    () => [
      { id: "all", label: t("commandMenu.categories.all") },
      { id: "workflow", label: categoryLabels.workflow },
      { id: "workspace", label: categoryLabels.workspace },
      { id: "edit", label: categoryLabels.edit },
      { id: "file", label: categoryLabels.file },
      { id: "help", label: categoryLabels.help },
      { id: "language", label: categoryLabels.language },
    ],
    [categoryLabels, t],
  );

  function runCommand(action: () => void) {
    action();
    props.onClose();
  }

  const commands: CommandMenuItem[] = useMemo(
    () => [
      {
        id: "workflow-er",
        category: "workflow",
        label: t("commandMenu.commands.workflowEr.label"),
        detail: t("commandMenu.commands.workflowEr.detail"),
        icon: "entity",
        active: props.diagramView === "er",
        action: () => props.onDiagramViewChange("er"),
      },
      {
        id: "workflow-translation",
        category: "workflow",
        label: t("commandMenu.commands.workflowTranslation.label"),
        detail: t("commandMenu.commands.workflowTranslation.detail"),
        icon: "translate",
        active: props.diagramView === "translation",
        action: () => props.onDiagramViewChange("translation"),
      },
      {
        id: "workflow-logical",
        category: "workflow",
        label: t("commandMenu.commands.workflowLogical.label"),
        detail: t("commandMenu.commands.workflowLogical.detail"),
        icon: "database",
        active: props.diagramView === "logical" && !props.logicalSqlOpen,
        action: props.onOpenLogicalWorkflow,
      },
      {
        id: "workflow-sql",
        category: "workflow",
        label: t("commandMenu.commands.workflowSql.label"),
        detail: t("commandMenu.commands.workflowSql.detail"),
        icon: "code",
        active: props.diagramView === "logical" && props.logicalSqlOpen,
        action: props.onOpenSql,
      },
      {
        id: "workflow-reset-translation",
        category: "workflow",
        label: t("commandMenu.commands.workflowResetTranslation.label"),
        detail: t("commandMenu.commands.workflowResetTranslation.detail"),
        icon: "reset",
        disabled: !isTranslationView,
        action: props.onResetTranslation,
      },
      {
        id: "workflow-generate-schema",
        category: "workflow",
        label: props.logicalOutOfDate
          ? t("commandMenu.commands.workflowRealignSchema.label")
          : t("commandMenu.commands.workflowGenerateSchema.label"),
        detail: t("commandMenu.commands.workflowGenerateSchema.detail"),
        icon: "refresh",
        disabled: !isLogicalView,
        action: props.onGenerateLogicalModel,
      },
      {
        id: "workflow-auto-layout",
        category: "workflow",
        label: t("commandMenu.commands.workflowAutoLayout.label"),
        detail: t("commandMenu.commands.workflowAutoLayout.detail"),
        icon: "fix",
        disabled: !isLogicalView,
        action: props.onAutoLayoutLogical,
      },
      {
        id: "workflow-fit-logical",
        category: "workflow",
        label: t("commandMenu.commands.workflowFitLogical.label"),
        detail: t("commandMenu.commands.workflowFitLogical.detail"),
        icon: "fit",
        disabled: !isLogicalView,
        action: props.onFitLogical,
      },
      {
        id: "workspace-sql-reverse",
        category: "workspace",
        label: t("commandMenu.commands.workspaceSqlReverse.label"),
        detail: t("commandMenu.commands.workspaceSqlReverse.detail"),
        icon: "databaseReverse",
        disabled: !isErView,
        action: props.onOpenSqlReverseWorkflow,
      },
      {
        id: "workspace-versioning",
        category: "workspace",
        label: t("commandMenu.commands.workspaceVersioning.label"),
        detail: props.hasUncommittedChanges
          ? t("versioning.uncommittedChanges")
          : t("commandMenu.commands.workspaceVersioning.detail"),
        icon: "history",
        active: props.hasUncommittedChanges,
        action: props.onOpenVersioningPanel,
      },
      {
        id: "workspace-code",
        category: "workspace",
        label: props.codePanelOpen
          ? t("commandMenu.commands.workspaceCodeHide.label")
          : t("commandMenu.commands.workspaceCodeShow.label"),
        detail: t("commandMenu.commands.workspaceCodeShow.detail"),
        icon: "code",
        active: props.codePanelOpen,
        action: props.onToggleCodePanel,
      },
      {
        id: "workspace-notes",
        category: "workspace",
        label: props.notesPanelOpen
          ? t("commandMenu.commands.workspaceNotesHide.label")
          : t("commandMenu.commands.workspaceNotesShow.label"),
        detail: t("commandMenu.commands.workspaceNotesShow.detail"),
        icon: "notes",
        active: props.notesPanelOpen,
        action: props.onToggleNotesPanel,
      },
      {
        id: "workspace-focus",
        category: "workspace",
        label: props.focusMode
          ? t("commandMenu.commands.workspaceFocusDisable.label")
          : t("commandMenu.commands.workspaceFocusEnable.label"),
        detail: t("commandMenu.commands.workspaceFocusEnable.detail"),
        shortcut: "Ctrl/Cmd .",
        icon: "focus",
        active: props.focusMode,
        action: props.onToggleFocusMode,
      },
      {
        id: "workspace-tool-rail",
        category: "workspace",
        label: props.toolRailCollapsed
          ? t("commandMenu.commands.workspaceToolRailExpand.label")
          : t("commandMenu.commands.workspaceToolRailCollapse.label"),
        detail: t("commandMenu.commands.workspaceToolRailExpand.detail"),
        icon: "panelLeft",
        active: props.toolRailCollapsed,
        action: props.onToggleToolRail,
      },
      {
        id: "edit-undo",
        category: "edit",
        label: t("commandMenu.commands.editUndo.label"),
        shortcut: "Ctrl/Cmd Z",
        icon: "undo",
        disabled: !props.canUndo,
        action: props.onUndo,
      },
      {
        id: "edit-redo",
        category: "edit",
        label: t("commandMenu.commands.editRedo.label"),
        shortcut: "Ctrl/Cmd Y",
        icon: "redo",
        disabled: !props.canRedo,
        action: props.onRedo,
      },
      {
        id: "edit-duplicate",
        category: "edit",
        label: t("commandMenu.commands.editDuplicate.label"),
        shortcut: "Ctrl/Cmd D",
        icon: "duplicate",
        disabled: !isErView || props.selectionItemCount === 0,
        action: props.onDuplicateSelection,
      },
      {
        id: "edit-rename",
        category: "edit",
        label: t("commandMenu.commands.editRename.label"),
        shortcut: "Enter",
        icon: "rename",
        disabled: !isErView || props.selectionItemCount !== 1,
        action: props.onRenameSelection,
      },
      {
        id: "edit-delete",
        category: "edit",
        label: t("commandMenu.commands.editDelete.label"),
        shortcut: "Del",
        icon: "delete",
        disabled: !isErView || props.selectionItemCount === 0,
        action: props.onDeleteSelection,
      },
      {
        id: "file-new-project",
        category: "file",
        label: t("commandMenu.commands.fileNewProject.label"),
        icon: "newProject",
        action: props.onNewProject,
      },
      {
        id: "file-open-project",
        category: "file",
        label: t("commandMenu.commands.fileOpenProject.label"),
        icon: "openProject",
        action: props.onLoadProject,
      },
      {
        id: "file-open-ers",
        category: "file",
        label: t("commandMenu.commands.fileOpenErs.label"),
        icon: "upload",
        action: props.onLoadErs,
      },
      {
        id: "file-save-project",
        category: "file",
        label: t("commandMenu.commands.fileSaveProject.label"),
        shortcut: "Ctrl/Cmd S",
        icon: "save",
        action: props.onSaveProject,
      },
      {
        id: "file-new-schema",
        category: "file",
        label: t("commandMenu.commands.fileNewSchema.label"),
        icon: "newProject",
        action: props.onNewSchema,
      },
      {
        id: "file-import-schema",
        category: "file",
        label: t("commandMenu.commands.fileImportSchema.label"),
        icon: "upload",
        action: props.onImportSchema,
      },
      {
        id: "file-export-schema",
        category: "file",
        label: t("commandMenu.commands.fileExportSchema.label"),
        icon: "download",
        action: props.onExportCurrentSchema,
      },
      {
        id: "file-download-ers",
        category: "file",
        label: t("commandMenu.commands.fileDownloadErs.label"),
        icon: "download",
        action: props.onSaveErs,
      },
      {
        id: "file-export-png",
        category: "file",
        label: t("commandMenu.commands.fileExportPng.label"),
        icon: "image",
        action: props.onExportPng,
      },
      {
        id: "file-export-jpeg",
        category: "file",
        label: t("commandMenu.commands.fileExportJpeg.label"),
        icon: "image",
        action: props.onExportJpeg,
      },
      {
        id: "file-export-svg",
        category: "file",
        label: t("commandMenu.commands.fileExportSvg.label"),
        icon: "fileImage",
        action: props.onExportSvg,
      },
      {
        id: "file-reset-ers",
        category: "file",
        label: t("commandMenu.commands.fileResetErs.label"),
        icon: "refresh",
        action: props.onResetErs,
      },
      {
        id: "help-shortcuts",
        category: "help",
        label: t("commandMenu.commands.helpShortcuts.label"),
        detail: t("commandMenu.commands.helpShortcuts.detail"),
        icon: "keyboard",
        action: props.onOpenShortcuts,
      },
      {
        id: "help-whats-new",
        category: "help",
        label: t("commandMenu.commands.helpWhatsNew.label"),
        icon: "history",
        action: props.onWhatsNew,
      },
      {
        id: "help-about",
        category: "help",
        label: t("commandMenu.commands.helpAbout.label"),
        icon: "info",
        action: props.onAbout,
      },
      ...SUPPORTED_LOCALES.map((language): CommandMenuItem => ({
        id: `language-${language}`,
        category: "language",
        label: getLanguageMenuLabel(language),
        detail:
          language === locale
            ? t("commandMenu.language.active")
            : t("commandMenu.language.change"),
        icon: language === locale ? "done" : "globe",
        active: locale === language,
        testId: `language-command-${language}`,
        action: () => {
          setLocale(language);
        },
      })),
    ],
    [
      getLanguageMenuLabel,
      isErView,
      isLogicalView,
      isTranslationView,
      locale,
      props,
      setLocale,
      t,
    ],
  );
  const normalizedQuery = normalizeCommandSearch(searchQuery, locale);
  const visibleCommands = commands.filter(
    (item) =>
      (activeCategory === "all" || item.category === activeCategory) &&
      commandMatches(item, normalizedQuery, categoryLabels[item.category], locale),
  );
  const groupedCommands = categoryFilters.filter((filter) => filter.id !== "all")
    .map((filter) => ({
      id: filter.id as CommandCategory,
      label: filter.label,
      commands: visibleCommands.filter((item) => item.category === filter.id),
    }))
    .filter((group) => group.commands.length > 0);

  return (
    <div className="studio-modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="studio-modal studio-modal--wide command-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-menu-title"
        onClick={(event) => event.stopPropagation()}
        data-testid="command-menu"
      >
        <div className="command-palette">
          <div className="command-palette-header">
            <div className="command-palette-title-row">
              <span className="command-palette-title-icon" aria-hidden="true">
                <StudioIcon name="menu" />
              </span>
              <div>
                <h2 id="command-menu-title" className="command-palette-title">{t("commandMenu.title")}</h2>
                <p className="command-palette-subtitle">
                  {t("commandMenu.subtitle", {
                    appTitle: props.appTitle,
                    appVersion: props.appVersion,
                    diagramName: props.diagramName,
                  })}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="studio-modal__close command-palette-close"
              onClick={props.onClose}
              aria-label={t("commandMenu.closeAria")}
            >
              <StudioIcon name="close" aria-hidden="true" />
            </button>
          </div>

          <div className="command-palette-controls">
            <label className="command-palette-search">
              <StudioIcon name="search" aria-hidden="true" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("commandMenu.searchPlaceholder")}
                aria-label={t("commandMenu.searchAria")}
                data-testid="command-menu-search"
                autoFocus
              />
            </label>
            <div className="command-palette-tabs" aria-label={t("commandMenu.filterAria")}>
              {categoryFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={filter.id === activeCategory ? "command-palette-tab active" : "command-palette-tab"}
                  onClick={() => setActiveCategory(filter.id)}
                  aria-pressed={filter.id === activeCategory}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="command-palette-list" aria-live="polite">
            {groupedCommands.length > 0 ? (
              groupedCommands.map((group) => (
                <section key={group.id} className="command-palette-section" aria-labelledby={`command-palette-section-${group.id}`}>
                  <div className="command-palette-section-label" id={`command-palette-section-${group.id}`}>
                    {group.label}
                  </div>
                  <div className="command-palette-section-list">
                    {group.commands.map((item) => (
                      <CommandPaletteItem key={item.id} item={item} onRun={(command) => runCommand(command.action)} />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="command-palette-empty" role="status">
                <StudioIcon name="search" aria-hidden="true" />
                <strong>{t("commandMenu.emptyTitle")}</strong>
                <span>{t("commandMenu.emptyDescription")}</span>
              </div>
            )}
          </div>

          <div className="command-palette-footer">
            {t("commandMenu.visibleCount", { count: visibleCommands.length })}
          </div>
        </div>
      </div>
    </div>
  );
}
