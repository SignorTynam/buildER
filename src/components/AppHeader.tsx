import { useEffect, useState } from "react";
import type { WorkspaceView } from "../types/translation";

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
  onOpenShortcuts: () => void;
  onDiagramNameChange?: (name: string) => void;
}

export function AppHeader(props: AppHeaderProps) {
  const [draftName, setDraftName] = useState(props.diagramName);

  useEffect(() => {
    const activeElement = typeof document === "undefined" ? null : document.activeElement;
    if (activeElement?.getAttribute("data-project-name-input") !== "true") {
      setDraftName(props.diagramName);
    }
  }, [props.diagramName]);

  function commitProjectName() {
    const trimmed = draftName.trim() || "ER project";
    setDraftName(trimmed);
    if (trimmed !== props.diagramName) {
      props.onDiagramNameChange?.(trimmed);
    }
  }

  return (
    <header className={`designer-topbar app-header-view-${props.diagramView}`}>
      <div className="designer-brand" aria-label="Brand">
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
        aria-label="Project name"
      />

      <div className="designer-topbar-actions">
        <button type="button" onClick={props.onNewProject} aria-label="Crea nuovo progetto">
          <span className="desktop-label">NEW PROJECT</span>
          <span className="mobile-label" aria-hidden="true">NEW</span>
        </button>
        <button type="button" onClick={props.onLoadProject} aria-label="Apri progetto">
          <span className="desktop-label">OPEN PROJECT</span>
          <span className="mobile-label" aria-hidden="true">OPEN</span>
        </button>
        <button
          type="button"
          className="designer-icon-button"
          onClick={props.onOpenShortcuts}
          title="Help"
          aria-label="Apri scorciatoie e aiuto"
        >
          ?
        </button>
        <button
          type="button"
          className="designer-icon-button"
          onClick={props.onOpenCommandMenu}
          title="Menu"
          aria-label="Apri menu comandi"
        >
          =
        </button>
      </div>
    </header>
  );
}
