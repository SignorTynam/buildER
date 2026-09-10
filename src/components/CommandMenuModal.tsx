import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { SUPPORTED_LOCALES } from "../i18n";
import { useI18n } from "../i18n/useI18n";
import type { ProjectOpenTab, ProjectWorkspaceFile } from "../types/projectExplorer";
import type { WorkspaceView } from "../types/translation";
import {
  rankCommandPaletteEntries,
  type CommandPaletteSearchEntry,
} from "../utils/commandPalette";
import { StudioIcon, type StudioIconName } from "./icons/StudioIcon";

interface CommandMenuModalProps {
  diagramView: WorkspaceView;
  logicalSqlOpen: boolean;
  sqlPlaygroundOpen: boolean;
  codePanelOpen: boolean;
  errorsPanelOpen: boolean;
  explorerOpen: boolean;
  versioningOpen: boolean;
  reverseOpen: boolean;
  canUndo: boolean;
  canRedo: boolean;
  canExportLogicalSql: boolean;
  logicalOutOfDate: boolean;
  focusMode: boolean;
  showDiagnostics: boolean;
  hasUncommittedChanges: boolean;
  toolRailCollapsed: boolean;
  selectionItemCount: number;
  editMode: boolean;
  hasProject: boolean;
  hasActiveSchema: boolean;
  projectFiles: ProjectWorkspaceFile[];
  projectFilePaths: Record<string, string>;
  openTabs: ProjectOpenTab[];
  activeFileId: string | null;
  onClose: (restoreFocus?: boolean) => void;
  onOpenProjectFile: (fileId: string) => void;
  onOpenShortcuts: () => void;
  onOpenSettings: () => void;
  onDiagramViewChange: (view: WorkspaceView) => void;
  onOpenSql: () => void;
  onOpenSqlPlayground: () => void;
  onOpenSqliteDatabase: () => void;
  onSaveImportedDatabase: () => void;
  onRestoreImportedDatabase: () => void;
  onReverseImportedDatabase: () => void;
  hasImportedDatabase: boolean;
  onOpenLogicalWorkflow: () => void;
  onNewProject: () => void;
  onCloseProject: () => void;
  onShowWelcome: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopySelection: () => void;
  onPasteSelection: () => void;
  onDuplicateSelection: () => void;
  onDeleteSelection: () => void;
  onRenameSelection: () => void;
  onGenerateLogicalModel: () => void;
  onResetTranslation: () => void;
  onFitAll: () => void;
  onFitSelection: () => void;
  onResetZoom: () => void;
  onToggleMinimap: () => void;
  canAutoLayoutCurrent: boolean;
  onAutoLayoutCurrent: () => void;
  canAutoLayoutSelection: boolean;
  onAutoLayoutSelection: () => void;
  onOpenSqlReverseWorkflow: () => void;
  onOpenExplorer: () => void;
  onOpenErrorsPanel: () => void;
  onOpenVersioningPanel: () => void;
  onToggleDiagnostics: () => void;
  onToggleCodePanel: () => void;
  onSaveProject: () => void;
  onNewSchema: () => void;
  onNewNote: () => void;
  onNewSql: () => void;
  onNewFolder: () => void;
  onImportSchema: () => void;
  onImportSql: () => void;
  onExportCurrentSchema: () => void;
  onSaveErs: () => void;
  onExportSql: () => void;
  onLoadProject: () => void;
  onLoadErs: () => void;
  onExportPng: () => void;
  onExportJpeg: () => void;
  onExportSvg: () => void;
  onResetErs: () => void;
  onAbout: () => void;
  onOpenReleaseCenter: () => void;
  onToggleFocusMode: () => void;
  onToggleToolRail: () => void;
}

type CommandCategory = "workflow" | "workspace" | "edit" | "file" | "help" | "language";

export interface CommandPaletteEntry extends CommandPaletteSearchEntry {
  icon: StudioIconName;
  categoryId: CommandCategory | "openFiles" | "files" | "commands";
  status?: string;
  testId?: string;
  action: () => void;
}

interface CommandPaletteGroup {
  id: string;
  label: string;
  entries: CommandPaletteEntry[];
}

function getFileIcon(file: ProjectWorkspaceFile): StudioIconName {
  if (file.kind === "schema") return "schema";
  if (file.kind === "sql") return "code";
  return "fileText";
}

function getFileExtension(name: string): string {
  const match = name.match(/\.[^.]+$/);
  return match?.[0] ?? "";
}

function getOptionId(entryId: string): string {
  return `command-palette-option-${entryId.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function CommandPaletteOption({
  entry,
  selected,
  onSelect,
  onRun,
}: {
  entry: CommandPaletteEntry;
  selected: boolean;
  onSelect: (entry: CommandPaletteEntry) => void;
  onRun: (entry: CommandPaletteEntry) => void;
}) {
  const className = [
    "command-palette-item",
    selected ? "selected" : "",
    entry.active ? "active" : "",
    entry.disabled ? "disabled" : "",
  ].filter(Boolean).join(" ");

  return (
    <div
      id={getOptionId(entry.id)}
      className={className}
      role="option"
      aria-selected={selected}
      aria-disabled={entry.disabled ? true : undefined}
      data-entry-kind={entry.kind}
      data-testid={entry.testId}
      onMouseEnter={() => {
        if (!entry.disabled) onSelect(entry);
      }}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        if (!entry.disabled) onRun(entry);
      }}
    >
      <span className="command-palette-item-icon" aria-hidden="true">
        <StudioIcon name={entry.icon} />
      </span>
      <span className="command-palette-item-copy">
        <span className="command-palette-item-title">{entry.label}</span>
        {entry.detail ? <span className="command-palette-item-detail">{entry.detail}</span> : null}
      </span>
      <span className="command-palette-item-meta">
        {entry.status ? <span className="command-palette-item-status">{entry.status}</span> : null}
        {entry.shortcut ? <kbd className="command-palette-kbd">{entry.shortcut}</kbd> : null}
      </span>
      {entry.active ? (
        <span className="command-palette-active-mark" aria-hidden="true">
          <StudioIcon name="done" />
        </span>
      ) : null}
    </div>
  );
}

export function CommandMenuModal(props: CommandMenuModalProps) {
  const { locale, setLocale, getLanguageMenuLabel, t } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const isErView = props.diagramView === "er";
  const isTranslationView = props.diagramView === "translation";
  const isLogicalView = props.diagramView === "logical";
  const canEditErSelection = props.hasActiveSchema && isErView && props.editMode;

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

  const commands = useMemo<CommandPaletteEntry[]>(() => [
    {
      id: "command-workflow-er", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.workflowEr.label"), detail: t("commandMenu.commands.workflowEr.detail"),
      icon: "entity", disabled: !props.hasActiveSchema, active: props.diagramView === "er", order: 0,
      action: () => props.onDiagramViewChange("er"),
    },
    {
      id: "command-workflow-translation", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.workflowTranslation.label"), detail: t("commandMenu.commands.workflowTranslation.detail"),
      icon: "translate", disabled: !props.hasActiveSchema, active: props.diagramView === "translation", order: 1,
      action: () => props.onDiagramViewChange("translation"),
    },
    {
      id: "command-workflow-logical", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.workflowLogical.label"), detail: t("commandMenu.commands.workflowLogical.detail"),
      icon: "database", disabled: !props.hasActiveSchema, active: isLogicalView && !props.logicalSqlOpen, order: 2,
      action: props.onOpenLogicalWorkflow,
    },
    {
      id: "command-workflow-sql", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.workflowSql.label"), detail: t("commandMenu.commands.workflowSql.detail"),
      icon: "code", disabled: !props.hasActiveSchema, active: isLogicalView && props.logicalSqlOpen, order: 3,
      action: props.onOpenSql,
    },
    {
      id: "command-workflow-sql-playground", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.workflowSqlPlayground.label"), detail: t("commandMenu.commands.workflowSqlPlayground.detail"),
      icon: "database", disabled: !props.hasActiveSchema, active: props.sqlPlaygroundOpen, order: 4,
      action: props.onOpenSqlPlayground,
    },
    {
      id: "command-workflow-reset-translation", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.workflowResetTranslation.label"), detail: t("commandMenu.commands.workflowResetTranslation.detail"),
      icon: "reset", disabled: !isTranslationView, order: 4, action: props.onResetTranslation,
    },
    {
      id: "command-workflow-generate-schema", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: props.logicalOutOfDate ? t("commandMenu.commands.workflowRealignSchema.label") : t("commandMenu.commands.workflowGenerateSchema.label"),
      detail: t("commandMenu.commands.workflowGenerateSchema.detail"), icon: "refresh", disabled: !isLogicalView,
      order: 5, action: props.onGenerateLogicalModel,
    },
    {
      id: "command-view-fit-all", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.viewFitAll.label"), detail: t("commandMenu.commands.viewFitAll.detail"),
      icon: "fit", disabled: !props.hasActiveSchema, order: 8, action: props.onFitAll,
    },
    {
      id: "command-view-fit-selection", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.viewFitSelection.label"), detail: t("commandMenu.commands.viewFitSelection.detail"),
      icon: "focus", disabled: !props.hasActiveSchema, order: 9, action: props.onFitSelection,
    },
    {
      id: "command-view-reset", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.viewReset.label"), detail: t("commandMenu.commands.viewReset.detail"),
      icon: "reset", disabled: !props.hasActiveSchema, order: 10, action: props.onResetZoom,
    },
    {
      id: "command-view-toggle-minimap", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.viewToggleMinimap.label"), detail: t("commandMenu.commands.viewToggleMinimap.detail"),
      icon: "minimap", disabled: !props.hasActiveSchema, order: 11, action: props.onToggleMinimap,
    },
    {
      id: "command-view-auto-layout", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.viewAutoLayout.label"), detail: t("commandMenu.commands.viewAutoLayout.detail"),
      icon: "fix", disabled: !props.hasActiveSchema || !props.canAutoLayoutCurrent, order: 12,
      action: props.onAutoLayoutCurrent,
    },
    {
      id: "command-view-auto-layout-selection", kind: "command", categoryId: "workflow", category: categoryLabels.workflow,
      label: t("commandMenu.commands.viewAutoLayoutSelection.label"), detail: t("commandMenu.commands.viewAutoLayoutSelection.detail"),
      icon: "fix", disabled: !props.canAutoLayoutSelection, order: 13,
      action: props.onAutoLayoutSelection,
    },
    {
      id: "command-workspace-explorer", kind: "command", categoryId: "workspace", category: categoryLabels.workspace,
      label: t("commandMenu.commands.workspaceExplorer.label"), detail: t("commandMenu.commands.workspaceExplorer.detail"),
      icon: "panelLeft", disabled: !props.hasProject, active: props.explorerOpen, order: 100, action: props.onOpenExplorer,
    },
    {
      id: "command-workspace-sql-reverse", kind: "command", categoryId: "workspace", category: categoryLabels.workspace,
      label: t("commandMenu.commands.workspaceSqlReverse.label"), detail: t("commandMenu.commands.workspaceSqlReverse.detail"),
      icon: "databaseReverse", disabled: !props.hasProject, active: props.reverseOpen, order: 101,
      action: props.onOpenSqlReverseWorkflow,
    },
    {
      id: "command-workspace-versioning", kind: "command", categoryId: "workspace", category: categoryLabels.workspace,
      label: t("commandMenu.commands.workspaceVersioning.label"),
      detail: props.hasUncommittedChanges ? t("versioning.uncommittedChanges") : t("commandMenu.commands.workspaceVersioning.detail"),
      icon: "history", disabled: !props.hasProject, active: props.versioningOpen, order: 102,
      action: props.onOpenVersioningPanel,
    },
    {
      id: "command-workspace-code", kind: "command", categoryId: "workspace", category: categoryLabels.workspace,
      label: props.codePanelOpen ? t("commandMenu.commands.workspaceCodeHide.label") : t("commandMenu.commands.workspaceCodeShow.label"),
      detail: t("commandMenu.commands.workspaceCodeShow.detail"), icon: "code", disabled: !props.hasActiveSchema,
      active: props.codePanelOpen, order: 103, action: props.onToggleCodePanel,
    },
    {
      id: "command-workspace-errors", kind: "command", categoryId: "workspace", category: categoryLabels.workspace,
      label: t("commandMenu.commands.workspaceErrors.label"), detail: t("commandMenu.commands.workspaceErrors.detail"),
      icon: "errors", disabled: !props.hasActiveSchema, active: props.errorsPanelOpen, order: 105,
      action: props.onOpenErrorsPanel,
    },
    {
      id: "command-workspace-diagnostics", kind: "command", categoryId: "workspace", category: categoryLabels.workspace,
      label: props.showDiagnostics ? t("commandMenu.commands.workspaceDiagnosticsDisable.label") : t("commandMenu.commands.workspaceDiagnosticsEnable.label"),
      detail: t("commandMenu.commands.workspaceDiagnosticsEnable.detail"), icon: "warning", disabled: !props.hasActiveSchema,
      active: props.showDiagnostics, order: 106, action: props.onToggleDiagnostics,
    },
    {
      id: "command-workspace-focus", kind: "command", categoryId: "workspace", category: categoryLabels.workspace,
      label: props.focusMode ? t("commandMenu.commands.workspaceFocusDisable.label") : t("commandMenu.commands.workspaceFocusEnable.label"),
      detail: t("commandMenu.commands.workspaceFocusEnable.detail"), shortcut: "Ctrl/Cmd .", icon: "focus",
      disabled: !props.hasProject, active: props.focusMode, order: 107, action: props.onToggleFocusMode,
    },
    {
      id: "command-workspace-tool-rail", kind: "command", categoryId: "workspace", category: categoryLabels.workspace,
      label: props.toolRailCollapsed ? t("commandMenu.commands.workspaceToolRailExpand.label") : t("commandMenu.commands.workspaceToolRailCollapse.label"),
      detail: t("commandMenu.commands.workspaceToolRailExpand.detail"), icon: "panelLeft", disabled: !props.hasActiveSchema,
      active: props.toolRailCollapsed, order: 108, action: props.onToggleToolRail,
    },
    {
      id: "command-edit-undo", kind: "command", categoryId: "edit", category: categoryLabels.edit,
      label: t("commandMenu.commands.editUndo.label"), shortcut: "Ctrl/Cmd Z", icon: "undo",
      disabled: !props.canUndo, order: 200, action: props.onUndo,
    },
    {
      id: "command-edit-redo", kind: "command", categoryId: "edit", category: categoryLabels.edit,
      label: t("commandMenu.commands.editRedo.label"), shortcut: "Ctrl/Cmd Y", icon: "redo",
      disabled: !props.canRedo, order: 201, action: props.onRedo,
    },
    {
      id: "command-edit-copy", kind: "command", categoryId: "edit", category: categoryLabels.edit,
      label: t("commandMenu.commands.editCopy.label"), shortcut: "Ctrl/Cmd C", icon: "copy",
      disabled: !canEditErSelection || props.selectionItemCount === 0, order: 202, action: props.onCopySelection,
    },
    {
      id: "command-edit-paste", kind: "command", categoryId: "edit", category: categoryLabels.edit,
      label: t("commandMenu.commands.editPaste.label"), shortcut: "Ctrl/Cmd V", icon: "paste",
      disabled: !canEditErSelection, order: 203, action: props.onPasteSelection,
    },
    {
      id: "command-edit-duplicate", kind: "command", categoryId: "edit", category: categoryLabels.edit,
      label: t("commandMenu.commands.editDuplicate.label"), shortcut: "Ctrl/Cmd D", icon: "duplicate",
      disabled: !canEditErSelection || props.selectionItemCount === 0, order: 204, action: props.onDuplicateSelection,
    },
    {
      id: "command-edit-rename", kind: "command", categoryId: "edit", category: categoryLabels.edit,
      label: t("commandMenu.commands.editRename.label"), shortcut: "Enter", icon: "rename",
      disabled: !canEditErSelection || props.selectionItemCount !== 1, order: 205, action: props.onRenameSelection,
    },
    {
      id: "command-edit-delete", kind: "command", categoryId: "edit", category: categoryLabels.edit,
      label: t("commandMenu.commands.editDelete.label"), shortcut: "Del", icon: "delete",
      disabled: !canEditErSelection || props.selectionItemCount === 0, order: 206, action: props.onDeleteSelection,
    },
    {
      id: "command-file-new-project", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileNewProject.label"), icon: "newProject", order: 300, action: props.onNewProject,
    },
    {
      id: "command-file-open-project", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileOpenProject.label"), icon: "openProject", order: 301, action: props.onLoadProject,
    },
    {
      id: "command-file-save-project", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileSaveProject.label"), shortcut: "Ctrl/Cmd S", icon: "save",
      disabled: !props.hasProject, order: 302, action: props.onSaveProject,
    },
    {
      id: "command-file-close-project", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileCloseProject.label"), icon: "close", disabled: !props.hasProject,
      order: 303, action: props.onCloseProject,
    },
    {
      id: "command-file-show-welcome", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileShowWelcome.label"), icon: "info", disabled: !props.hasProject,
      order: 304, action: props.onShowWelcome,
    },
    {
      id: "command-file-new-schema", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileNewSchema.label"), icon: "schema", disabled: !props.hasProject,
      order: 305, action: props.onNewSchema,
    },
    {
      id: "command-file-new-note", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileNewNote.label"), icon: "fileText", disabled: !props.hasProject,
      order: 306, action: props.onNewNote,
    },
    {
      id: "command-file-new-sql", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileNewSql.label"), icon: "code", disabled: !props.hasProject,
      order: 307, action: props.onNewSql,
    },
    {
      id: "command-file-new-folder", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileNewFolder.label"), icon: "folderPlus", disabled: !props.hasProject,
      order: 308, action: props.onNewFolder,
    },
    {
      id: "command-file-import-schema", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileImportSchema.label"), icon: "upload", order: 309, action: props.onImportSchema,
    },
    {
      id: "command-file-open-ers", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileOpenErs.label"), icon: "upload", order: 310, action: props.onLoadErs,
    },
    {
      id: "command-file-open-sqlite", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("databaseWorkspace.openDatabase"), detail: t("databaseWorkspace.openDatabaseDescription"), icon: "database",
      order: 311, action: props.onOpenSqliteDatabase,
    },
    {
      id: "command-file-save-database-copy", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("databaseWorkspace.saveCopy"), detail: t("databaseWorkspace.commandDetails.saveCopy"), icon: "download",
      disabled: !props.hasImportedDatabase, order: 312, action: props.onSaveImportedDatabase,
    },
    {
      id: "command-file-restore-database", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("databaseWorkspace.restoreOriginal"), detail: t("databaseWorkspace.commandDetails.restore"), icon: "refresh",
      disabled: !props.hasImportedDatabase, order: 313, action: props.onRestoreImportedDatabase,
    },
    {
      id: "command-file-reverse-database", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("databaseWorkspace.reverseEngineering"), detail: t("databaseWorkspace.commandDetails.reverse"), icon: "databaseReverse",
      disabled: !props.hasImportedDatabase, order: 314, action: props.onReverseImportedDatabase,
    },
    {
      id: "command-file-import-sql", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileImportSql.label"), icon: "databaseReverse", disabled: !props.hasProject,
      order: 311, action: props.onImportSql,
    },
    {
      id: "command-file-export-project", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileExportProject.label"), icon: "download", disabled: !props.hasProject,
      order: 312, action: props.onSaveProject,
    },
    {
      id: "command-file-export-schema", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileExportSchema.label"), icon: "download", disabled: !props.hasActiveSchema,
      order: 313, action: props.onExportCurrentSchema,
    },
    {
      id: "command-file-download-ers", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileDownloadErs.label"), icon: "download", disabled: !props.hasActiveSchema,
      order: 314, action: props.onSaveErs,
    },
    {
      id: "command-file-export-sql", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileExportSql.label"), icon: "database", disabled: !props.canExportLogicalSql,
      order: 315, action: props.onExportSql,
    },
    {
      id: "command-file-export-png", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileExportPng.label"), icon: "image", disabled: !props.hasActiveSchema,
      order: 316, action: props.onExportPng,
    },
    {
      id: "command-file-export-jpeg", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileExportJpeg.label"), icon: "image", disabled: !props.hasActiveSchema,
      order: 317, action: props.onExportJpeg,
    },
    {
      id: "command-file-export-svg", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileExportSvg.label"), icon: "fileImage", disabled: !props.hasActiveSchema,
      order: 318, action: props.onExportSvg,
    },
    {
      id: "command-file-reset-ers", kind: "command", categoryId: "file", category: categoryLabels.file,
      label: t("commandMenu.commands.fileResetErs.label"), icon: "refresh", disabled: !props.hasActiveSchema,
      order: 319, action: props.onResetErs,
    },
    {
      id: "command-help-shortcuts", kind: "command", categoryId: "help", category: categoryLabels.help,
      label: t("commandMenu.commands.helpShortcuts.label"), detail: t("commandMenu.commands.helpShortcuts.detail"),
      icon: "keyboard", order: 400, action: props.onOpenShortcuts,
    },
    {
      id: "command-open-settings", kind: "command", categoryId: "workspace", category: categoryLabels.workspace,
      label: t("settings.title"), detail: t("settings.subtitle"),
      icon: "settings", order: 100, action: props.onOpenSettings,
    },
    {
      id: "command-help-whats-new", kind: "command", categoryId: "help", category: categoryLabels.help,
      label: t("releases.center.title"), icon: "sparkles", order: 401, action: props.onOpenReleaseCenter,
    },
    {
      id: "command-help-about", kind: "command", categoryId: "help", category: categoryLabels.help,
      label: t("commandMenu.commands.helpAbout.label"), icon: "info", order: 402, action: props.onAbout,
    },
    ...SUPPORTED_LOCALES.map((language, index): CommandPaletteEntry => ({
      id: `command-language-${language}`,
      kind: "command",
      categoryId: "language",
      category: categoryLabels.language,
      label: getLanguageMenuLabel(language),
      detail: language === locale ? t("commandMenu.language.active") : t("commandMenu.language.change"),
      icon: language === locale ? "done" : "globe",
      active: locale === language,
      order: 500 + index,
      testId: `language-command-${language}`,
      action: () => setLocale(language),
    })),
  ], [
    canEditErSelection,
    categoryLabels,
    getLanguageMenuLabel,
    isLogicalView,
    isTranslationView,
    locale,
    props,
    setLocale,
    t,
  ]);

  const fileEntries = useMemo<CommandPaletteEntry[]>(() => {
    const openFileIds = new Set(
      props.openTabs.flatMap((tab) => tab.kind === "file" && tab.fileId ? [tab.fileId] : []),
    );
    return props.projectFiles.map((file, index) => {
      const path = props.projectFilePaths[file.id] ?? file.name;
      const active = file.id === props.activeFileId;
      const open = openFileIds.has(file.id);
      const fileType = t(`workspaceChrome.fileTypes.${file.kind === "schema" || file.kind === "sql" || file.kind === "text" ? file.kind : "file"}`);
      return {
        id: `file-${file.id}`,
        kind: "file",
        categoryId: "files",
        category: t("commandMenu.sections.files"),
        label: file.name,
        detail: path,
        path,
        fileType,
        extension: getFileExtension(file.name),
        icon: getFileIcon(file),
        active,
        open,
        status: active
          ? t("commandMenu.fileStates.active")
          : open
            ? t("commandMenu.fileStates.open")
            : undefined,
        order: index,
        action: () => props.onOpenProjectFile(file.id),
      };
    });
  }, [props.activeFileId, props.onOpenProjectFile, props.openTabs, props.projectFilePaths, props.projectFiles, t]);

  const openFileEntries = useMemo(() => {
    const byFileId = new Map(fileEntries.map((entry) => [entry.id.slice("file-".length), entry]));
    const orderedIds = [
      props.activeFileId,
      ...props.openTabs.flatMap((tab) => tab.kind === "file" && tab.fileId ? [tab.fileId] : []),
    ].filter((fileId): fileId is string => Boolean(fileId));
    const seen = new Set<string>();
    return orderedIds.flatMap((fileId, index) => {
      if (seen.has(fileId)) return [];
      seen.add(fileId);
      const entry = byFileId.get(fileId);
      return entry ? [{ ...entry, order: index, categoryId: "openFiles" as const }] : [];
    });
  }, [fileEntries, props.activeFileId, props.openTabs]);

  const groups = useMemo<CommandPaletteGroup[]>(() => {
    if (!searchQuery.trim()) {
      const commandGroups = (Object.keys(categoryLabels) as CommandCategory[]).flatMap((categoryId) => {
        const entries = commands.filter((entry) => entry.categoryId === categoryId);
        return entries.length > 0 ? [{ id: categoryId, label: categoryLabels[categoryId], entries }] : [];
      });
      return [
        ...(openFileEntries.length > 0
          ? [{ id: "openFiles", label: t("commandMenu.sections.openFiles"), entries: openFileEntries }]
          : []),
        ...commandGroups,
      ];
    }

    const ranked = rankCommandPaletteEntries([...fileEntries, ...commands], searchQuery, locale);
    const files = ranked.filter((entry) => entry.kind === "file");
    const commandResults = ranked.filter((entry) => entry.kind === "command");
    const rankedGroups: Record<"file" | "command", CommandPaletteGroup> = {
      file: { id: "files", label: t("commandMenu.sections.files"), entries: files },
      command: { id: "commands", label: t("commandMenu.sections.commands"), entries: commandResults },
    };
    const firstKind = ranked[0]?.kind;
    const order: Array<"file" | "command"> = firstKind === "command" ? ["command", "file"] : ["file", "command"];
    return order.map((kind) => rankedGroups[kind]).filter((group) => group.entries.length > 0);
  }, [categoryLabels, commands, fileEntries, locale, openFileEntries, searchQuery, t]);

  const visibleEntries = useMemo(() => groups.flatMap((group) => group.entries), [groups]);
  const executableEntries = useMemo(() => visibleEntries.filter((entry) => !entry.disabled), [visibleEntries]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedEntryId((current) =>
      current && executableEntries.some((entry) => entry.id === current)
        ? current
        : executableEntries[0]?.id ?? null,
    );
  }, [executableEntries]);

  useEffect(() => {
    if (!selectedEntryId) return;
    listRef.current
      ?.querySelector<HTMLElement>(`#${getOptionId(selectedEntryId)}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedEntryId]);

  function runEntry(entry: CommandPaletteEntry) {
    if (entry.disabled) return;
    props.onClose(false);
    entry.action();
  }

  function moveSelection(direction: 1 | -1) {
    if (executableEntries.length === 0) return;
    const currentIndex = executableEntries.findIndex((entry) => entry.id === selectedEntryId);
    const fallbackIndex = direction === 1 ? -1 : 0;
    const nextIndex = (currentIndex === -1 ? fallbackIndex : currentIndex) + direction;
    const wrappedIndex = (nextIndex + executableEntries.length) % executableEntries.length;
    setSelectedEntryId(executableEntries[wrappedIndex]?.id ?? null);
  }

  function handleInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const selected = executableEntries.find((entry) => entry.id === selectedEntryId);
      if (selected) runEntry(selected);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      props.onClose(true);
    }
  }

  const resultCount = visibleEntries.length;
  const activeDescendant = selectedEntryId ? getOptionId(selectedEntryId) : undefined;

  return (
    <div
      className="command-palette-catcher"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.onClose(true);
      }}
    >
      <div
        className="command-modal command-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t("commandMenu.paletteAria")}
        data-testid="command-menu"
      >
        <label className="command-palette-search" htmlFor="command-palette-input">
          <StudioIcon name="search" aria-hidden="true" />
          <input
            ref={inputRef}
            id="command-palette-input"
            type="search"
            role="combobox"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={t("commandMenu.searchPlaceholder")}
            aria-label={t("commandMenu.searchAria")}
            aria-expanded="true"
            aria-controls="command-palette-listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeDescendant}
            autoComplete="off"
            data-testid="command-menu-search"
          />
          <kbd className="command-palette-search-shortcut">Ctrl K</kbd>
        </label>

        <div
          ref={listRef}
          id="command-palette-listbox"
          className="command-palette-list"
          role="listbox"
          aria-label={t("commandMenu.resultsAria")}
        >
          {groups.length > 0 ? (
            groups.map((group) => (
              <section
                key={group.id}
                className="command-palette-section"
                role="group"
                aria-labelledby={`command-palette-section-${group.id}`}
              >
                <div className="command-palette-section-label" id={`command-palette-section-${group.id}`}>
                  {group.label}
                </div>
                <div className="command-palette-section-list">
                  {group.entries.map((entry) => (
                    <CommandPaletteOption
                      key={entry.id}
                      entry={entry}
                      selected={entry.id === selectedEntryId}
                      onSelect={(nextEntry) => setSelectedEntryId(nextEntry.id)}
                      onRun={runEntry}
                    />
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

        <div className="command-palette-live" aria-live="polite">
          {t("commandMenu.visibleCount", { count: resultCount })}
        </div>
        <footer className="command-palette-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd>{t("commandMenu.hints.navigate")}</span>
          <span><kbd>Enter</kbd>{t("commandMenu.hints.run")}</span>
          <span><kbd>Esc</kbd>{t("commandMenu.hints.close")}</span>
        </footer>
      </div>
    </div>
  );
}
