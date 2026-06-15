import { useEffect, useState } from "react";
import type { WorkspaceView } from "../types/translation";
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
  const { t } = useI18n();
  const [draftName, setDraftName] = useState(props.diagramName);

  useEffect(() => {
    const activeElement = typeof document === "undefined" ? null : document.activeElement;
    if (activeElement?.getAttribute("data-project-name-input") !== "true") {
      setDraftName(props.diagramName);
    }
  }, [props.diagramName]);

  function commitProjectName() {
    const trimmed = draftName.trim() || t("appHeader.defaultProjectName");
    setDraftName(trimmed);
    if (trimmed !== props.diagramName) {
      props.onDiagramNameChange?.(trimmed);
    }
  }

  return (
    <header className={`designer-topbar app-header-view-${props.diagramView}`}>
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
          className="designer-icon-button"
          onClick={props.onOpenShortcuts}
          title={t("appHeader.actions.helpTitle")}
          aria-label={t("appHeader.actions.helpAria")}
          data-testid="app-header-help"
        >
          <StudioIcon name="help" aria-hidden="true" />
        </button>
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
