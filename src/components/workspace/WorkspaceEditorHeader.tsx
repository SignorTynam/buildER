import type { ProjectWorkspaceFile } from "../../types/projectExplorer";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";
import { Tooltip } from "../ui/Tooltip";

interface WorkspaceEditorHeaderProps {
  file: ProjectWorkspaceFile;
  onOpenSqlPlayground?: () => void;
  onStartSqlReverse?: () => void;
}

/**
 * Barra di contesto dell'editor: le azioni dei file SQL, e nient'altro.
 *
 * Il selettore Concettuale/Traduzione/Logico non vive piu qui: le tre viste si
 * raggiungono dalla palette comandi e dal comando "Traduci" della toolbar ER,
 * quindi la riga restava sopra il canvas a ripetere una scelta gia disponibile.
 * Senza azioni da mostrare la barra non si disegna affatto, cosi lo schema
 * guadagna la sua altezza invece di ereditare una striscia vuota.
 */
export function WorkspaceEditorHeader({
  file,
  onOpenSqlPlayground,
  onStartSqlReverse,
}: WorkspaceEditorHeaderProps) {
  const { t } = useI18n();

  const showPlayground = file.kind === "sql" && onOpenSqlPlayground != null;
  const showReverse = file.kind === "sql" && onStartSqlReverse != null;
  if (!showPlayground && !showReverse) {
    return null;
  }

  return (
    <div className="editor-context-bar">
      <div className="editor-context-actions">
        {showPlayground ? (
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
        {showReverse ? (
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
