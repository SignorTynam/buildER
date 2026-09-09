import type { ProjectWorkspaceFile } from "../../types/projectExplorer";
import type { WorkspaceView } from "../../types/translation";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";
import { Tooltip } from "../ui/Tooltip";

interface WorkspaceEditorHeaderProps {
  projectName: string;
  file: ProjectWorkspaceFile;
  path: string;
  view: WorkspaceView;
  onReveal: () => void;
  onViewChange: (view: WorkspaceView) => void;
  onOpenSqlPlayground?: () => void;
  onStartSqlReverse?: () => void;
}

export function WorkspaceEditorHeader({
  projectName,
  file,
  path,
  view,
  onReveal,
  onViewChange,
  onOpenSqlPlayground,
  onStartSqlReverse,
}: WorkspaceEditorHeaderProps) {
  const { t } = useI18n();
  const pathSegments = path.split("/").filter(Boolean);
  const typeLabel = file.kind === "schema"
    ? t("workspaceChrome.fileTypes.schema")
    : file.kind === "sql"
      ? t("workspaceChrome.fileTypes.sql")
      : t("workspaceChrome.fileTypes.text");

  return (
    <div className="editor-context-bar">
      <nav className="editor-breadcrumb" aria-label={t("workspaceChrome.breadcrumbAria")} title={`${projectName} / ${path}`}>
        <span className="editor-breadcrumb__segment">{projectName}</span>
        {pathSegments.map((segment, index) => (
          <span key={`${segment}-${index}`} className="editor-breadcrumb__segment">
            <span className="editor-breadcrumb__separator" aria-hidden="true">/</span>
            {segment}
          </span>
        ))}
        <span className="editor-breadcrumb__type">{typeLabel}</span>
      </nav>

      <div className="editor-context-actions">
        {file.kind === "schema" ? (
          <div className="editor-view-switcher" role="group" aria-label={t("workspaceChrome.viewSwitcherAria")}>
            {([
              ["er", "entity", t("workspaceChrome.views.conceptual")],
              ["translation", "translate", t("workspaceChrome.views.translation")],
              ["logical", "database", t("workspaceChrome.views.logical")],
            ] as const).map(([value, icon, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                // Sotto 680px l'etichetta si nasconde e resta la sola icona:
                // senza aria-label il pulsante perderebbe il nome accessibile.
                aria-label={label}
                onClick={() => onViewChange(value)}
                title={label}
              >
                <StudioIcon name={icon} size={15} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        ) : null}
        {file.kind === "sql" && onOpenSqlPlayground ? (
          <Tooltip label={t("workspaceChrome.sqlActions.openPlaygroundTooltip")} position="bottom">
            {(aria) => (
              <button
                type="button"
                className="editor-context-button editor-context-button--sql"
                onClick={onOpenSqlPlayground}
                aria-label={t("workspaceChrome.sqlActions.openPlayground")}
                {...aria}
              >
                <StudioIcon name="database" size={15} aria-hidden="true" />
                <span>{t("workspaceChrome.sqlActions.openPlayground")}</span>
              </button>
            )}
          </Tooltip>
        ) : null}
        {file.kind === "sql" && onStartSqlReverse ? (
          <Tooltip label={t("workspaceChrome.sqlActions.startReverseTooltip")} position="bottom">
            {(aria) => (
              <button
                type="button"
                className="editor-context-button editor-context-button--sql"
                onClick={onStartSqlReverse}
                aria-label={t("workspaceChrome.sqlActions.startReverse")}
                {...aria}
              >
                <StudioIcon name="databaseReverse" size={15} aria-hidden="true" />
                <span>{t("workspaceChrome.sqlActions.startReverse")}</span>
              </button>
            )}
          </Tooltip>
        ) : null}
        <Tooltip label={t("workspaceChrome.revealInExplorer")} position="bottom">
          {(aria) => (
            <button
              type="button"
              className="editor-context-button"
              onClick={onReveal}
              aria-label={t("workspaceChrome.revealInExplorer")}
              {...aria}
            >
              <StudioIcon name="panelLeft" size={15} aria-hidden="true" />
              <span>{t("workspaceChrome.reveal")}</span>
            </button>
          )}
        </Tooltip>
      </div>
    </div>
  );
}

