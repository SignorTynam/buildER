import type { EditorMode, ToolKind } from "../types/diagram";
import type { WorkspaceView } from "../types/translation";
import { SUPPORTED_LOCALES } from "../i18n";
import { useI18n } from "../i18n/useI18n";
import { getToolDefinitions } from "../utils/toolConfig";

interface CommandMenuModalProps {
  appTitle: string;
  appVersion: string;
  diagramName: string;
  diagramView: WorkspaceView;
  activeTool: ToolKind;
  logicalSqlOpen: boolean;
  codePanelOpen: boolean;
  notesPanelOpen: boolean;
  mode: EditorMode;
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
  onModeChange: (mode: EditorMode) => void;
  onToolChange: (tool: ToolKind) => void;
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

interface CommandButtonProps {
  label: string;
  detail?: string;
  shortcut?: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}

function CommandButton({ label, detail, shortcut, disabled, active, onClick }: CommandButtonProps) {
  return (
    <button
      type="button"
      className={active ? "command-menu-item active" : "command-menu-item"}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="command-menu-item-copy">
        <strong>{label}</strong>
        {detail ? <span>{detail}</span> : null}
      </span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

export function CommandMenuModal(props: CommandMenuModalProps) {
  const { locale, setLocale, getLanguageLabel, getLanguageMenuLabel } = useI18n();
  const toolDefinitions = getToolDefinitions();
  const isErView = props.diagramView === "er";
  const isTranslationView = props.diagramView === "translation";
  const isLogicalView = props.diagramView === "logical";

  function runCommand(action: () => void) {
    action();
    props.onClose();
  }

  function runToolCommand(tool: ToolKind) {
    props.onToolChange(tool);
    props.onClose();
  }

  return (
    <div className="help-modal-backdrop command-modal-backdrop" role="presentation" onClick={props.onClose}>
      <div
        className="help-modal command-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-menu-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="help-modal-head command-modal-head">
          <div>
            <h2 id="command-menu-title">Menu comandi</h2>
            <p>
              {props.appTitle} {props.appVersion} - {props.diagramName}
            </p>
          </div>
          <button type="button" className="help-close" onClick={props.onClose} aria-label="Chiudi menu comandi">
            X
          </button>
        </div>

        <div className="command-modal-content">
          <section className="command-menu-section">
            <div className="command-menu-section-title">Workflow</div>
            <div className="command-menu-list">
              <CommandButton
                label="MODEL"
                detail="Progettazione ER concettuale"
                active={props.diagramView === "er"}
                onClick={() => runCommand(() => props.onDiagramViewChange("er"))}
              />
              <CommandButton
                label="TRANSLATION"
                detail="Workflow tecnico ER -> ER tradotto"
                active={props.diagramView === "translation"}
                onClick={() => runCommand(() => props.onDiagramViewChange("translation"))}
              />
              <CommandButton
                label="SCHEMA"
                detail="Schema logico relazionale"
                active={props.diagramView === "logical" && !props.logicalSqlOpen}
                onClick={() => runCommand(props.onOpenLogicalWorkflow)}
              />
              <CommandButton
                label="SQL panel"
                detail="Apri SQL dentro lo schema logico"
                active={props.diagramView === "logical" && props.logicalSqlOpen}
                onClick={() => runCommand(props.onOpenSql)}
              />
              <CommandButton
                label="Reset translation"
                detail="Riparti dal workflow di traduzione"
                disabled={!isTranslationView}
                onClick={() => runCommand(props.onResetTranslation)}
              />
              <CommandButton
                label={props.logicalOutOfDate ? "Riallinea schema" : "Rigenera schema"}
                detail="Aggiorna il modello logico"
                disabled={!isLogicalView}
                onClick={() => runCommand(props.onGenerateLogicalModel)}
              />
              <CommandButton
                label="Auto layout logico"
                detail="Ridistribuisci le tabelle"
                disabled={!isLogicalView}
                onClick={() => runCommand(props.onAutoLayoutLogical)}
              />
              <CommandButton
                label="Fit logical canvas"
                detail="Centra e adatta lo schema"
                disabled={!isLogicalView}
                onClick={() => runCommand(props.onFitLogical)}
              />
            </div>
          </section>

          <section className="command-menu-section">
            <div className="command-menu-section-title">Workspace</div>
            <div className="command-menu-list">
              <CommandButton
                label={props.codePanelOpen ? "Hide code" : "Show code"}
                detail="Dock tecnico ERS"
                shortcut="Ctrl/Cmd I"
                disabled={!isErView}
                onClick={() => runCommand(props.onToggleCodePanel)}
              />
              <CommandButton
                label={props.notesPanelOpen ? "Hide notes" : "Show notes"}
                detail="Annotazioni del progetto"
                disabled={!isErView}
                onClick={() => runCommand(props.onToggleNotesPanel)}
              />
              <CommandButton
                label={props.focusMode ? "Disable focus" : "Enable focus"}
                detail="Nascondi pannelli non necessari"
                shortcut="Ctrl/Cmd ."
                onClick={() => runCommand(props.onToggleFocusMode)}
              />
              <CommandButton
                label={props.toolRailCollapsed ? "Expand toolbar" : "Collapse toolbar"}
                detail="Compatta la rail strumenti"
                onClick={() => runCommand(props.onToggleToolRail)}
              />
              <CommandButton
                label="Edit mode"
                detail="Abilita modifiche ER"
                active={isErView && props.mode === "edit"}
                disabled={!isErView}
                onClick={() => runCommand(() => props.onModeChange("edit"))}
              />
              <CommandButton
                label="Read mode"
                detail="Navigazione senza modifiche"
                active={isErView && props.mode === "view"}
                disabled={!isErView}
                onClick={() => runCommand(() => props.onModeChange("view"))}
              />
            </div>
          </section>

          <section className="command-menu-section command-menu-section-wide">
            <div className="command-menu-section-title">Strumenti ER</div>
            <div className="command-menu-tool-grid">
              {toolDefinitions.map((tool) => {
                const disabled = !isErView || (props.mode === "view" && tool.tool !== "select" && tool.tool !== "move");
                return (
                  <CommandButton
                    key={tool.tool}
                    label={tool.label}
                    detail={tool.tool === "delete" ? "Tool di cancellazione" : "Attiva strumento canvas"}
                    shortcut={tool.shortcut.toUpperCase()}
                    active={isErView && props.activeTool === tool.tool}
                    disabled={disabled}
                    onClick={() => runToolCommand(tool.tool)}
                  />
                );
              })}
            </div>
          </section>

          <section className="command-menu-section">
            <div className="command-menu-section-title">Edit</div>
            <div className="command-menu-list">
              <CommandButton
                label="Undo"
                shortcut="Ctrl/Cmd Z"
                disabled={!props.canUndo}
                onClick={() => runCommand(props.onUndo)}
              />
              <CommandButton
                label="Redo"
                shortcut="Ctrl/Cmd Y"
                disabled={!props.canRedo}
                onClick={() => runCommand(props.onRedo)}
              />
              <CommandButton
                label="Duplicate selection"
                shortcut="Ctrl/Cmd D"
                disabled={!isErView || props.selectionItemCount === 0}
                onClick={() => runCommand(props.onDuplicateSelection)}
              />
              <CommandButton
                label="Rename selection"
                shortcut="Enter"
                disabled={!isErView || props.selectionItemCount !== 1}
                onClick={() => runCommand(props.onRenameSelection)}
              />
              <CommandButton
                label="Delete selection"
                shortcut="Del"
                disabled={!isErView || props.selectionItemCount === 0}
                onClick={() => runCommand(props.onDeleteSelection)}
              />
            </div>
          </section>

          <section className="command-menu-section">
            <div className="command-menu-section-title">File ed export</div>
            <div className="command-menu-list">
              <CommandButton label="New project" onClick={() => runCommand(props.onNewProject)} />
              <CommandButton label="Open project" onClick={() => runCommand(props.onLoadProject)} />
              <CommandButton label="Open ERS" onClick={() => runCommand(props.onLoadErs)} />
              <CommandButton label="Save project" shortcut="Ctrl/Cmd S" onClick={() => runCommand(props.onSaveProject)} />
              <CommandButton label="Download ERS" onClick={() => runCommand(props.onSaveErs)} />
              <CommandButton label="Export PNG" onClick={() => runCommand(props.onExportPng)} />
              <CommandButton label="Export SVG" onClick={() => runCommand(props.onExportSvg)} />
              <CommandButton label="Reset ERS source" onClick={() => runCommand(props.onResetErs)} />
            </div>
          </section>

          <section className="command-menu-section">
            <div className="command-menu-section-title">Help</div>
            <div className="command-menu-list">
              <CommandButton label="Keyboard shortcuts" detail="Scorciatoie del progetto" onClick={() => runCommand(props.onOpenShortcuts)} />
              <CommandButton label="ERS guide" onClick={() => runCommand(props.onOpenErsGuide)} />
              <CommandButton label="What's new" onClick={() => runCommand(props.onWhatsNew)} />
              <CommandButton label="About" onClick={() => runCommand(props.onAbout)} />
            </div>
          </section>

          <section className="command-menu-section">
            <div className="command-menu-section-title">Lingua: {getLanguageLabel(locale)}</div>
            <div className="command-menu-list">
              {SUPPORTED_LOCALES.map((language) => (
                <CommandButton
                  key={language}
                  label={getLanguageMenuLabel(language)}
                  active={locale === language}
                  onClick={() =>
                    runCommand(() => {
                      setLocale(language);
                    })
                  }
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
