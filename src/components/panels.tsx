import { useState } from "react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n/useI18n";

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

export interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  children?: ReactNode;
}

export function PanelHeader({ title, subtitle, actionLabel, onAction, className, children }: PanelHeaderProps) {
  return (
    <header className={joinClasses("panel-header", className)}>
      <div className="panel-header-main">
        <div className="panel-header-copy">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {actionLabel && onAction ? (
          <button type="button" className="panel-hide-button panel-header-action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
      {children ? <div className="panel-header-extra">{children}</div> : null}
    </header>
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
          aria-current={tab.id === activeTab ? "page" : undefined}
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
        <span className={open ? "collapsible-panel-chevron open" : "collapsible-panel-chevron"} aria-hidden="true">
          &gt;
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

type PanelTone = "neutral" | "success" | "warning" | "error" | "info";

interface PanelCardBaseProps {
  className?: string;
  active?: boolean;
  tone?: PanelTone;
  onClick?: () => void;
  title?: string;
  status?: string;
  subtitle?: string;
  ariaLabel?: string;
  children?: ReactNode;
}

export function PanelCard({
  className,
  active,
  tone = "neutral",
  onClick,
  title,
  status,
  subtitle,
  ariaLabel,
  children,
}: PanelCardBaseProps) {
  const isInteractive = onClick !== undefined;
  const Component = isInteractive ? "button" : "div";
  const content = title ? (
    <>
      <div className="panel-card-copy">
        <strong>{title}</strong>
        {status ? <span className="panel-card-status">{status}</span> : null}
        {subtitle ? <span className="panel-card-subtitle">{subtitle}</span> : null}
      </div>
      {children ? <div className="panel-card-content">{children}</div> : null}
    </>
  ) : (
    children
  );

  return (
    <Component
      type={isInteractive ? "button" : undefined}
      className={joinClasses("panel-card", `tone-${tone}`, active ? "active" : "", isInteractive ? "is-interactive" : "", className)}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={isInteractive && active ? true : undefined}
    >
      {content}
    </Component>
  );
}

interface PanelStepCardProps extends PanelCardBaseProps {}

export function PanelStepCard(props: PanelStepCardProps) {
  return <PanelCard {...props} className={joinClasses("panel-step-card", props.className)} />;
}

interface WorkspaceViewBarProps {
  children: ReactNode;
  className?: string;
}

export function WorkspaceViewBar({ children, className }: WorkspaceViewBarProps) {
  return (
    <nav className={joinClasses("workspace-view-bar", className)} aria-label="Viste workspace">
      {children}
    </nav>
  );
}

interface WorkspaceViewButtonProps {
  children: ReactNode;
  active?: boolean;
  badge?: number;
  onClick: () => void;
  className?: string;
  ariaLabel?: string;
}

export function WorkspaceViewButton({
  children,
  active,
  badge,
  onClick,
  className,
  ariaLabel,
}: WorkspaceViewButtonProps) {
  const hasBadge = typeof badge === "number" && badge > 0;

  return (
    <button
      type="button"
      className={joinClasses("workspace-view-button", active ? "active" : "", className)}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      aria-label={ariaLabel}
    >
      <span>{children}</span>
      {hasBadge ? <span className="workspace-view-badge">{badge}</span> : null}
    </button>
  );
}

interface WarningCardProps {
  children: ReactNode;
  type?: PanelTone;
  level?: PanelTone;
  className?: string;
  onClick?: () => void;
}

export function WarningCard({ children, type, level, className, onClick }: WarningCardProps) {
  const { t } = useI18n();
  const tone = type ?? level ?? "warning";
  const label =
    tone === "error"
      ? t("common.status.error")
      : tone === "success"
        ? t("common.status.success")
        : tone === "info"
          ? t("common.status.info")
          : t("common.status.warning");
  const content = (
    <>
      <span className="warning-card-label">{label}</span>
      <span className="warning-card-message">{children}</span>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={joinClasses("warning-card", `tone-${tone}`, className)} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={joinClasses("warning-card", `tone-${tone}`, className)}>{content}</div>;
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
