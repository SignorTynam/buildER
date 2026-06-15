import { useMemo, useState } from "react";
import type { WorkspaceView } from "../types/translation";
import { SUPPORTED_LOCALES } from "../i18n";
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
  action: () => void;
};

const CATEGORY_LABELS: Record<CommandCategory, string> = {
  workflow: "Workflow",
  workspace: "Workspace",
  edit: "Edit",
  file: "File",
  help: "Help",
  language: "Lingua",
};

const CATEGORY_FILTERS: Array<{ id: "all" | CommandCategory; label: string }> = [
  { id: "all", label: "Tutti" },
  { id: "workflow", label: CATEGORY_LABELS.workflow },
  { id: "workspace", label: CATEGORY_LABELS.workspace },
  { id: "edit", label: CATEGORY_LABELS.edit },
  { id: "file", label: CATEGORY_LABELS.file },
  { id: "help", label: CATEGORY_LABELS.help },
  { id: "language", label: CATEGORY_LABELS.language },
];

function normalizeCommandSearch(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("it-IT")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function commandMatches(item: CommandMenuItem, query: string) {
  if (!query) {
    return true;
  }

  return normalizeCommandSearch(
    `${item.label} ${item.detail ?? ""} ${item.shortcut ?? ""} ${CATEGORY_LABELS[item.category]}`,
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
  const { locale, setLocale, getLanguageMenuLabel } = useI18n();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | CommandCategory>("all");
  const isErView = props.diagramView === "er";
  const isTranslationView = props.diagramView === "translation";
  const isLogicalView = props.diagramView === "logical";

  function runCommand(action: () => void) {
    action();
    props.onClose();
  }

  const commands: CommandMenuItem[] = useMemo(
    () => [
      {
        id: "workflow-er",
        category: "workflow",
        label: "Modello ER",
        detail: "Canvas concettuale",
        icon: "entity",
        active: props.diagramView === "er",
        action: () => props.onDiagramViewChange("er"),
      },
      {
        id: "workflow-translation",
        category: "workflow",
        label: "Traduzione",
        detail: "Passi ER intermedi",
        icon: "translate",
        active: props.diagramView === "translation",
        action: () => props.onDiagramViewChange("translation"),
      },
      {
        id: "workflow-logical",
        category: "workflow",
        label: "Schema logico",
        detail: "Tabelle, chiavi e vincoli",
        icon: "database",
        active: props.diagramView === "logical" && !props.logicalSqlOpen,
        action: props.onOpenLogicalWorkflow,
      },
      {
        id: "workflow-sql",
        category: "workflow",
        label: "SQL",
        detail: "Anteprima dello schema",
        icon: "code",
        active: props.diagramView === "logical" && props.logicalSqlOpen,
        action: props.onOpenSql,
      },
      {
        id: "workflow-reset-translation",
        category: "workflow",
        label: "Reset traduzione",
        detail: "Riparti dai passi ER",
        icon: "reset",
        disabled: !isTranslationView,
        action: props.onResetTranslation,
      },
      {
        id: "workflow-generate-schema",
        category: "workflow",
        label: props.logicalOutOfDate ? "Riallinea schema" : "Rigenera schema",
        detail: "Aggiorna il modello logico",
        icon: "refresh",
        disabled: !isLogicalView,
        action: props.onGenerateLogicalModel,
      },
      {
        id: "workflow-auto-layout",
        category: "workflow",
        label: "Auto layout logico",
        detail: "Ridistribuisci le tabelle",
        icon: "fix",
        disabled: !isLogicalView,
        action: props.onAutoLayoutLogical,
      },
      {
        id: "workflow-fit-logical",
        category: "workflow",
        label: "Adatta canvas logico",
        detail: "Centra e adatta lo schema",
        icon: "fit",
        disabled: !isLogicalView,
        action: props.onFitLogical,
      },
      {
        id: "workspace-sql-reverse",
        category: "workspace",
        label: "Reverse Engineering SQL",
        detail: "Importa CREATE TABLE con workflow guidato",
        icon: "databaseReverse",
        disabled: !isErView,
        action: props.onOpenSqlReverseWorkflow,
      },
      {
        id: "workspace-code",
        category: "workspace",
        label: props.codePanelOpen ? "Nascondi Code" : "Mostra Code",
        detail: "Editor ERS nel workspace",
        icon: "code",
        active: props.codePanelOpen,
        action: props.onToggleCodePanel,
      },
      {
        id: "workspace-notes",
        category: "workspace",
        label: props.notesPanelOpen ? "Nascondi Notes" : "Mostra Notes",
        detail: "Annotazioni nel tab dedicato",
        icon: "notes",
        active: props.notesPanelOpen,
        action: props.onToggleNotesPanel,
      },
      {
        id: "workspace-focus",
        category: "workspace",
        label: props.focusMode ? "Disattiva focus" : "Attiva focus",
        detail: "Nascondi pannelli non necessari",
        shortcut: "Ctrl/Cmd .",
        icon: "focus",
        active: props.focusMode,
        action: props.onToggleFocusMode,
      },
      {
        id: "workspace-tool-rail",
        category: "workspace",
        label: props.toolRailCollapsed ? "Espandi strumenti" : "Comprimi strumenti",
        detail: "Cambia densita della rail",
        icon: "panelLeft",
        active: props.toolRailCollapsed,
        action: props.onToggleToolRail,
      },
      {
        id: "edit-undo",
        category: "edit",
        label: "Annulla",
        shortcut: "Ctrl/Cmd Z",
        icon: "undo",
        disabled: !props.canUndo,
        action: props.onUndo,
      },
      {
        id: "edit-redo",
        category: "edit",
        label: "Ripeti",
        shortcut: "Ctrl/Cmd Y",
        icon: "redo",
        disabled: !props.canRedo,
        action: props.onRedo,
      },
      {
        id: "edit-duplicate",
        category: "edit",
        label: "Duplica selezione",
        shortcut: "Ctrl/Cmd D",
        icon: "duplicate",
        disabled: !isErView || props.selectionItemCount === 0,
        action: props.onDuplicateSelection,
      },
      {
        id: "edit-rename",
        category: "edit",
        label: "Rinomina selezione",
        shortcut: "Enter",
        icon: "rename",
        disabled: !isErView || props.selectionItemCount !== 1,
        action: props.onRenameSelection,
      },
      {
        id: "edit-delete",
        category: "edit",
        label: "Elimina selezione",
        shortcut: "Del",
        icon: "delete",
        disabled: !isErView || props.selectionItemCount === 0,
        action: props.onDeleteSelection,
      },
      {
        id: "file-new-project",
        category: "file",
        label: "Nuovo progetto",
        icon: "newProject",
        action: props.onNewProject,
      },
      {
        id: "file-open-project",
        category: "file",
        label: "Apri progetto",
        icon: "openProject",
        action: props.onLoadProject,
      },
      {
        id: "file-open-ers",
        category: "file",
        label: "Apri ERS",
        icon: "upload",
        action: props.onLoadErs,
      },
      {
        id: "file-save-project",
        category: "file",
        label: "Salva progetto",
        shortcut: "Ctrl/Cmd S",
        icon: "save",
        action: props.onSaveProject,
      },
      {
        id: "file-download-ers",
        category: "file",
        label: "Scarica ERS",
        icon: "download",
        action: props.onSaveErs,
      },
      {
        id: "file-export-png",
        category: "file",
        label: "Export PNG",
        icon: "image",
        action: props.onExportPng,
      },
      {
        id: "file-export-svg",
        category: "file",
        label: "Export SVG",
        icon: "fileImage",
        action: props.onExportSvg,
      },
      {
        id: "file-reset-ers",
        category: "file",
        label: "Rigenera sorgente ERS",
        icon: "refresh",
        action: props.onResetErs,
      },
      {
        id: "help-shortcuts",
        category: "help",
        label: "Scorciatoie tastiera",
        detail: "Comandi supportati",
        icon: "keyboard",
        action: props.onOpenShortcuts,
      },
      {
        id: "help-ers-guide",
        category: "help",
        label: "Guida ERS",
        icon: "bookOpen",
        action: props.onOpenErsGuide,
      },
      {
        id: "help-whats-new",
        category: "help",
        label: "Novita",
        icon: "history",
        action: props.onWhatsNew,
      },
      {
        id: "help-about",
        category: "help",
        label: "Informazioni",
        icon: "info",
        action: props.onAbout,
      },
      ...SUPPORTED_LOCALES.map((language): CommandMenuItem => ({
        id: `language-${language}`,
        category: "language",
        label: getLanguageMenuLabel(language),
        detail: language === locale ? "Lingua attiva" : "Cambia lingua interfaccia",
        icon: language === locale ? "done" : "globe",
        active: locale === language,
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
    ],
  );
  const normalizedQuery = normalizeCommandSearch(searchQuery);
  const visibleCommands = commands.filter(
    (item) => (activeCategory === "all" || item.category === activeCategory) && commandMatches(item, normalizedQuery),
  );
  const groupedCommands = CATEGORY_FILTERS.filter((filter) => filter.id !== "all")
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
      >
        <div className="command-palette">
          <div className="command-palette-header">
            <div className="command-palette-title-row">
              <span className="command-palette-title-icon" aria-hidden="true">
                <StudioIcon name="menu" />
              </span>
              <div>
                <h2 id="command-menu-title" className="command-palette-title">Menu comandi</h2>
                <p className="command-palette-subtitle">
                  {props.appTitle} {props.appVersion} - {props.diagramName}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="studio-modal__close command-palette-close"
              onClick={props.onClose}
              aria-label="Chiudi menu comandi"
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
                placeholder="Cerca comando..."
                aria-label="Cerca comando"
                autoFocus
              />
            </label>
            <div className="command-palette-tabs" aria-label="Filtra comandi">
              {CATEGORY_FILTERS.map((filter) => (
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
                <strong>Nessun comando trovato</strong>
                <span>Prova con un altro termine o cambia categoria.</span>
              </div>
            )}
          </div>

          <div className="command-palette-footer">
            {visibleCommands.length} {visibleCommands.length === 1 ? "comando" : "comandi"} visibili
          </div>
        </div>
      </div>
    </div>
  );
}
