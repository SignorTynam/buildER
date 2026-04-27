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
          <span>v{props.appVersion}</span>
        </div>
      </div>

      <div className="studio-topbar-project" aria-label="Progetto attivo">
        <span className="studio-topbar-project-meta">
          {getWorkspaceTitle(props, t)} / {getWorkspaceMeta(props)}
        </span>
        <strong>{props.diagramName}</strong>
      </div>

      <div className="studio-topbar-actions">
        <div className="studio-topbar-toggle-group" role="group" aria-label="Pannelli laterali">
          <button
            type="button"
            className={props.codePanelOpen ? "studio-topbar-toggle active" : "studio-topbar-toggle"}
            onClick={props.onToggleCodePanel}
            aria-pressed={props.codePanelOpen}
          >
            Code
          </button>
          <button
            type="button"
            className={props.notesPanelOpen ? "studio-topbar-toggle active" : "studio-topbar-toggle"}
            onClick={props.onToggleNotesPanel}
            aria-pressed={props.notesPanelOpen}
          >
            Notes
          </button>
        </div>
        <button type="button" className="studio-topbar-button" onClick={props.onNewProject}>
          New
        </button>
        <button type="button" className="studio-topbar-button" onClick={props.onLoadProject}>
          Open
        </button>
        <button type="button" className="studio-topbar-button" onClick={props.onSaveProject}>
          Save
        </button>
        <button type="button" className="studio-topbar-button" onClick={props.onOpenCommandMenu}>
          Menu
        </button>
      </div>
    </header>
  );
}
