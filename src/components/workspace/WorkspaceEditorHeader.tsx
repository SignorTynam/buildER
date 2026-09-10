import type { ProjectWorkspaceFile } from "../../types/projectExplorer";
import type { WorkspaceView } from "../../types/translation";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";
import { Tooltip } from "../ui/Tooltip";

interface WorkspaceEditorHeaderProps {
  file: ProjectWorkspaceFile;
  view: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  onOpenSqlPlayground?: () => void;
  onStartSqlReverse?: () => void;
}

/**
 * Barra di contesto dell'editor: solo le azioni della vista corrente.
 *
 * Il percorso del file non vive piu qui. Nome e progetto sono gia sulla tab
 * attiva e nella status bar, quindi la riga ripeteva la stessa informazione
 * accanto ai comandi; ora la barra parte da sinistra con i comandi allineati
 * alle tab. "Mostra in Explorer" resta nel menu contestuale della tab.
 */
export function WorkspaceEditorHeader({
  file,
  view,
  onViewChange,
  onOpenSqlPlayground,
  onStartSqlReverse,
}: WorkspaceEditorHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="editor-context-bar">
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
      </div>
    </div>
  );
}
