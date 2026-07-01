import type { ReactNode } from "react";
import { StudioIcon } from "../icons/StudioIcon";

interface ProjectActivityPanelHeaderProps {
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
  children?: ReactNode;
}

export function ProjectActivityPanelHeader({
  title,
  subtitle,
  closeLabel,
  onClose,
  children,
}: ProjectActivityPanelHeaderProps) {
  return (
    <header className="project-activity-section__header project-activity-section__header--with-close">
      <div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="project-activity-section__header-actions">
        {children}
        <button type="button" className="project-activity-header-close" onClick={onClose} aria-label={closeLabel}>
          <StudioIcon name="close" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
