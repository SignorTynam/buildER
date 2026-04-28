import { useState } from "react";
import type { ReactNode } from "react";

function joinClasses(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export interface PanelShellProps {
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
  collapsed?: boolean;
}

export function PanelShell({ children, className, ariaLabel, collapsed }: PanelShellProps) {
  return (
    <aside
      className={joinClasses("panel-shell", collapsed ? "collapsed" : "", className)}
      aria-label={ariaLabel}
    >
      {children}
    </aside>
  );
}

export interface PanelTabDefinition<T extends string> {
  id: T;
  label: string;
}

interface PanelTabsProps<T extends string> {
  activeTab: T;
  tabs: PanelTabDefinition<T>[];
  className?: string;
  ariaLabel: string;
  onTabChange: (tab: T) => void;
}

export function PanelTabs<T extends string>({
  activeTab,
  tabs,
  className,
  ariaLabel,
  onTabChange,
}: PanelTabsProps<T>) {
  return (
    <div className={joinClasses("panel-tabs studio-tabs", className)} role="tablist" aria-label={ariaLabel}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === activeTab ? "panel-tab studio-tab active" : "panel-tab studio-tab"}
          onClick={() => onTabChange(tab.id)}
          role="tab"
          aria-selected={tab.id === activeTab}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

interface PanelSectionProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  className?: string;
}

export function PanelSection({ children, title, subtitle, actions, className }: PanelSectionProps) {
  return (
    <section className={joinClasses("panel-section", className)}>
      {title || subtitle || actions ? (
        <div className="panel-section-head">
          <div className="panel-section-copy">
            {title ? <h3>{title}</h3> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="panel-section-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

interface CollapsiblePanelProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  className?: string;
}

export function CollapsiblePanel({
  children,
  title,
  subtitle,
  defaultOpen = true,
  className,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={joinClasses("collapsible-panel panel-section", className)}>
      <button
        type="button"
        className="collapsible-panel-toggle"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="collapsible-panel-chevron" aria-hidden="true">
          {open ? "v" : ">"}
        </span>
        <span className="collapsible-panel-copy">
          <strong>{title}</strong>
          {subtitle ? <span>{subtitle}</span> : null}
        </span>
      </button>
      {open ? <div className="collapsible-panel-body">{children}</div> : null}
    </section>
  );
}

interface PanelCardProps {
  children: ReactNode;
  className?: string;
}

export function PanelCard({ children, className }: PanelCardProps) {
  return <div className={joinClasses("panel-card", className)}>{children}</div>;
}

interface WarningCardProps {
  children: ReactNode;
  level?: "warning" | "error" | "info" | "success";
  className?: string;
  onClick?: () => void;
}

export function WarningCard({ children, level = "warning", className, onClick }: WarningCardProps) {
  const content = (
    <>
      <span className="warning-card-label">{level === "error" ? "Errore" : level === "success" ? "OK" : level === "info" ? "Info" : "Warning"}</span>
      <span className="warning-card-message">{children}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={joinClasses("warning-card", `level-${level}`, className)} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={joinClasses("warning-card", `level-${level}`, className)}>{content}</div>;
}

interface EmptyStateCardProps {
  children: ReactNode;
  className?: string;
}

export function EmptyStateCard({ children, className }: EmptyStateCardProps) {
  return <div className={joinClasses("empty-state-card", className)}>{children}</div>;
}

interface CommandOptionRowProps {
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  ariaLabel?: string;
  onClick?: () => void;
}

export function CommandOptionRow({
  label,
  shortcut,
  active,
  disabled,
  className,
  title,
  ariaLabel,
  onClick,
}: CommandOptionRowProps) {
  return (
    <button
      type="button"
      className={joinClasses("command-option-row", active ? "active" : "", className)}
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={ariaLabel ?? label}
      aria-pressed={active ? true : undefined}
    >
      <span className="command-option-label">{label}</span>
      {shortcut ? <kbd className="keyboard-badge">{shortcut}</kbd> : null}
    </button>
  );
}
