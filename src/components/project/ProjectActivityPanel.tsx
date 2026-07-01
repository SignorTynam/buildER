import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { StudioIcon, type StudioIconName } from "../icons/StudioIcon";

export type ProjectActivityId = "file" | "code" | "reverse" | "errors" | "version" | "export";

export interface ProjectActivityItem {
  id: ProjectActivityId;
  label: string;
  icon: StudioIconName;
  badge?: number;
}

interface ProjectActivityPanelProps {
  items: ProjectActivityItem[];
  activeId: ProjectActivityId;
  open: boolean;
  width: number;
  title: string;
  closeLabel: string;
  openLabel: string;
  commandMenuLabel: string;
  keyboardShortcutsLabel: string;
  onSelect: (id: ProjectActivityId) => void;
  onToggleOpen: () => void;
  onOpenCommandMenu: () => void;
  onOpenShortcuts: () => void;
  onResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  children: ReactNode;
}

export function ProjectActivityPanel(props: ProjectActivityPanelProps) {
  return (
    <aside
      className={props.open ? "project-activity-panel" : "project-activity-panel project-activity-panel--collapsed"}
      style={{ "--project-explorer-width": `${props.width}px` } as CSSProperties}
      aria-label={props.title}
    >
      <nav className="project-activity-rail" aria-label={props.title}>
        {props.items.map((item) => (
          <button
            key={item.id}
            type="button"
            className={item.id === props.activeId && props.open ? "project-activity-button active" : "project-activity-button"}
            onClick={() => props.onSelect(item.id)}
            aria-label={item.label}
            aria-pressed={item.id === props.activeId && props.open}
            title={item.label}
          >
            <StudioIcon name={item.icon} aria-hidden="true" />
            {typeof item.badge === "number" && item.badge > 0 ? (
              <span className="project-activity-badge" aria-hidden="true">{item.badge}</span>
            ) : null}
          </button>
        ))}
        <div className="project-activity-rail__bottom">
          <button
            type="button"
            className="project-activity-button"
            onClick={props.onOpenCommandMenu}
            aria-label={props.commandMenuLabel}
            title={props.commandMenuLabel}
          >
            <StudioIcon name="menu" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="project-activity-button"
            onClick={props.onOpenShortcuts}
            aria-label={props.keyboardShortcutsLabel}
            title={props.keyboardShortcutsLabel}
          >
            <StudioIcon name="keyboard" aria-hidden="true" />
          </button>
        </div>
      </nav>

      {props.open ? <div className="project-activity-content">{props.children}</div> : null}

      {props.open ? (
        <div
          className="project-explorer-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={props.title}
          onPointerDown={props.onResizeStart}
        />
      ) : null}
    </aside>
  );
}
