import type { WorkspaceView } from "../types/translation";
import { useI18n } from "../i18n/useI18n";

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
  onNewProject: () => void;
  onToggleCodePanel: () => void;
  onToggleNotesPanel: () => void;
  onSaveProject: () => void;
  onLoadProject: () => void;
  onOpenCommandMenu: () => void;
}

function getWorkspaceTitle(props: AppHeaderProps, t: ReturnType<typeof useI18n>["t"]): string {
  if (props.diagramView === "translation") {
    return "TRANSLATION";
  }

  if (props.diagramView === "logical") {
    return props.logicalSqlOpen ? "SCHEMA / SQL" : t("header.views.logical").toUpperCase();
  }

  return "MODEL";
}

function getWorkspaceMeta(props: AppHeaderProps): string {
  if (props.diagramView === "logical" && props.logicalOutOfDate) {
    return "schema da riallineare";
  }

  if (props.diagramView === "logical" && props.logicalSqlOpen) {
    return "anteprima sql";
  }

  if (props.diagramView === "translation") {
    return "workflow tecnico";
  }

  return props.focusMode ? "focus canvas" : "editing";
}

export function AppHeader(props: AppHeaderProps) {
  const { t } = useI18n();

  const headerClassName = [
    "app-header",
    "studio-topbar",
    props.focusMode ? "focus-mode" : "",
    `app-header-view-${props.diagramView}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <header className={headerClassName}>
      <div className="studio-topbar-brand" aria-label="Brand">
        <div className="studio-topbar-mark" aria-hidden="true">
          ER
        </div>
        <div className="studio-topbar-brand-copy">
          <strong>{props.appTitle}</strong>
          <span className="studio-topbar-version">v{props.appVersion}</span>
        </div>
      </div>

      <div className="studio-topbar-project" aria-label="Progetto attivo">
        <span className="studio-topbar-project-meta">
          {getWorkspaceTitle(props, t)} / {getWorkspaceMeta(props)}
        </span>
        <strong className="studio-topbar-project-name">{props.diagramName}</strong>
      </div>

      <div className="studio-topbar-actions">
        <div className="studio-topbar-toggle-group" role="group" aria-label="Pannelli laterali">
          <button
            type="button"
            className={props.codePanelOpen ? "studio-topbar-toggle active" : "studio-topbar-toggle"}
            onClick={props.onToggleCodePanel}
            aria-pressed={props.codePanelOpen}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M5 4L1 8l4 4M11 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Code</span>
          </button>
          <button
            type="button"
            className={props.notesPanelOpen ? "studio-topbar-toggle active" : "studio-topbar-toggle"}
            onClick={props.onToggleNotesPanel}
            aria-pressed={props.notesPanelOpen}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3h10v10H3z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 6h6M5 8h6M5 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Notes</span>
          </button>
        </div>
        <div className="studio-topbar-button-group">
          <button type="button" className="studio-topbar-button" onClick={props.onNewProject} title="Nuovo progetto">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>New</span>
          </button>
          <button type="button" className="studio-topbar-button" onClick={props.onLoadProject} title="Apri progetto">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 4v8a1 1 0 001 1h8a1 1 0 001-1V6.5L10.5 4H4a1 1 0 00-1 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 4v3h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span>Open</span>
          </button>
          <button
            type="button"
            className="studio-topbar-button studio-topbar-button-primary"
            onClick={props.onSaveProject}
            title="Salva progetto"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M12 13H4a1 1 0 01-1-1V4a1 1 0 011-1h6l3 3v6a1 1 0 01-1 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10 3v3H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 9h6M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>Save</span>
          </button>
          <button type="button" className="studio-topbar-button studio-topbar-button-menu" onClick={props.onOpenCommandMenu} title="Menu comandi">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="4" r="1" fill="currentColor"/>
              <circle cx="8" cy="8" r="1" fill="currentColor"/>
              <circle cx="8" cy="12" r="1" fill="currentColor"/>
            </svg>
            <span>Menu</span>
          </button>
        </div>
      </div>
    </header>
  );
}
