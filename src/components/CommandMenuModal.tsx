import type { ToolKind } from "../types/diagram";
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
  technicalPanelOpen: boolean;
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
  onToggleReviewPanel: () => void;
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
      aria-pressed={active ? true : undefined}
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
                label="Modello ER"
                detail="Canvas concettuale"
                active={props.diagramView === "er"}
                onClick={() => runCommand(() => props.onDiagramViewChange("er"))}
              />
              <CommandButton
                label="Traduzione"
                detail="Passi ER intermedi"
                active={props.diagramView === "translation"}
                onClick={() => runCommand(() => props.onDiagramViewChange("translation"))}
              />
              <CommandButton
                label="Schema logico"
                detail="Tabelle, chiavi e vincoli"
                active={props.diagramView === "logical" && !props.logicalSqlOpen}
                onClick={() => runCommand(props.onOpenLogicalWorkflow)}
              />
              <CommandButton
                label="SQL"
                detail="Anteprima dello schema"
                active={props.diagramView === "logical" && props.logicalSqlOpen}
                onClick={() => runCommand(props.onOpenSql)}
              />
              <CommandButton
                label="Reset traduzione"
                detail="Riparti dai passi ER"
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
                label="Adatta canvas logico"
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
                label={props.technicalPanelOpen ? "Nascondi dock tecnico" : "Mostra Review"}
                detail={props.technicalPanelOpen ? "Chiude Review, Code o Notes" : "Warning ed errori del modello"}
                shortcut="Ctrl/Cmd I"
                disabled={!isErView}
                onClick={() => runCommand(props.onToggleReviewPanel)}
              />
                <CommandButton
                 label={props.codePanelOpen ? "Nascondi Code" : "Mostra Code"}
                  detail="Tab ERS nel dock tecnico"
                  disabled={false}
                  onClick={() => runCommand(props.onToggleCodePanel)}
                />
                <CommandButton
                 label={props.notesPanelOpen ? "Nascondi Notes" : "Mostra Notes"}
                  detail="Annotazioni nel tab dedicato"
                  disabled={false}
                  onClick={() => runCommand(props.onToggleNotesPanel)}
                />
              <CommandButton
                label={props.focusMode ? "Disattiva focus" : "Attiva focus"}
                detail="Nascondi pannelli non necessari"
                shortcut="Ctrl/Cmd ."
                onClick={() => runCommand(props.onToggleFocusMode)}
              />
              <CommandButton
                label={props.toolRailCollapsed ? "Espandi strumenti" : "Comprimi strumenti"}
                detail="Cambia densita della rail"
                onClick={() => runCommand(props.onToggleToolRail)}
              />
            </div>
          </section>

          <section className="command-menu-section command-menu-section-wide">
            <div className="command-menu-section-title">Strumenti ER</div>
            <div className="command-menu-tool-grid">
              {toolDefinitions.map((tool) => {
                const disabled = !isErView;
                return (
                  <CommandButton
                    key={tool.tool}
                    label={tool.label}
                    detail={tool.description}
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
                label="Annulla"
                shortcut="Ctrl/Cmd Z"
                disabled={!props.canUndo}
                onClick={() => runCommand(props.onUndo)}
              />
              <CommandButton
                label="Ripeti"
                shortcut="Ctrl/Cmd Y"
                disabled={!props.canRedo}
                onClick={() => runCommand(props.onRedo)}
              />
              <CommandButton
                label="Duplica selezione"
                shortcut="Ctrl/Cmd D"
                disabled={!isErView || props.selectionItemCount === 0}
                onClick={() => runCommand(props.onDuplicateSelection)}
              />
              <CommandButton
                label="Rinomina selezione"
                shortcut="Enter"
                disabled={!isErView || props.selectionItemCount !== 1}
                onClick={() => runCommand(props.onRenameSelection)}
              />
              <CommandButton
                label="Elimina selezione"
                shortcut="Del"
                disabled={!isErView || props.selectionItemCount === 0}
                onClick={() => runCommand(props.onDeleteSelection)}
              />
            </div>
          </section>

          <section className="command-menu-section">
            <div className="command-menu-section-title">File ed export</div>
            <div className="command-menu-list">
              <CommandButton label="Nuovo progetto" onClick={() => runCommand(props.onNewProject)} />
              <CommandButton label="Apri progetto" onClick={() => runCommand(props.onLoadProject)} />
              <CommandButton label="Apri ERS" onClick={() => runCommand(props.onLoadErs)} />
              <CommandButton label="Salva progetto" shortcut="Ctrl/Cmd S" onClick={() => runCommand(props.onSaveProject)} />
              <CommandButton label="Scarica ERS" onClick={() => runCommand(props.onSaveErs)} />
              <CommandButton label="Export PNG" onClick={() => runCommand(props.onExportPng)} />
              <CommandButton label="Export SVG" onClick={() => runCommand(props.onExportSvg)} />
              <CommandButton label="Rigenera sorgente ERS" onClick={() => runCommand(props.onResetErs)} />
            </div>
          </section>

          <section className="command-menu-section">
            <div className="command-menu-section-title">Help</div>
            <div className="command-menu-list">
              <CommandButton label="Scorciatoie tastiera" detail="Comandi supportati" onClick={() => runCommand(props.onOpenShortcuts)} />
              <CommandButton label="Guida ERS" onClick={() => runCommand(props.onOpenErsGuide)} />
              <CommandButton label="Novita" onClick={() => runCommand(props.onWhatsNew)} />
              <CommandButton label="Informazioni" onClick={() => runCommand(props.onAbout)} />
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
