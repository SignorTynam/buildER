import { StudioIcon } from "../../components/icons/StudioIcon";
import { Badge, Button, Tooltip, type BadgeTone } from "../../components/ui";
import { useI18n } from "../../i18n/useI18n";
import type { GeneratedSqlPlaygroundSessionState } from "./sqlPlaygroundState";

function getStatusPresentation(session: GeneratedSqlPlaygroundSessionState): { key: string; tone: BadgeTone } {
  switch (session.status) {
    case "loading-engine":
      return { key: "sqlPlayground.status.loadingEngine", tone: "info" };
    case "creating-database":
      return { key: "sqlPlayground.status.creatingDatabase", tone: "info" };
    case "planning-data":
      return { key: "sqlPlayground.status.planningData", tone: "info" };
    case "populating-data":
      return { key: "sqlPlayground.status.populatingData", tone: "info" };
    case "ready":
    case "running":
      return { key: "sqlPlayground.status.ready", tone: "success" };
    case "stale":
      return { key: "sqlPlayground.status.stale", tone: "warning" };
    case "schema-error":
      return { key: "sqlPlayground.status.schemaError", tone: "danger" };
    case "runtime-error":
      return {
        key: session.error?.operation === "initialize"
          ? "sqlPlayground.status.initializationError"
          : "sqlPlayground.status.runtimeError",
        tone: "danger",
      };
    case "opening-database":
    case "verifying-database":
    case "restoring":
    case "exporting":
      return { key: "sqlPlayground.status.loadingEngine", tone: "info" };
    case "modified":
    case "exported":
      return { key: "sqlPlayground.status.ready", tone: "success" };
    case "idle":
    case "engine-ready":
      return { key: "sqlPlayground.status.notCreated", tone: "neutral" };
  }
}

interface SqlPlaygroundHeaderProps {
  session: GeneratedSqlPlaygroundSessionState;
  executeDisabled?: boolean;
  onCreateDatabase?: () => void;
  onRecreateDatabase?: () => void;
  onExecute?: () => void;
  onGenerateData?: () => void;
  onDownload?: () => void;
}

export function SqlPlaygroundHeader({
  session,
  executeDisabled = true,
  onCreateDatabase,
  onRecreateDatabase,
  onExecute,
  onGenerateData,
  onDownload,
}: SqlPlaygroundHeaderProps) {
  const { t } = useI18n();
  const presentation = getStatusPresentation(session);
  const busy = session.status === "loading-engine"
    || session.status === "creating-database"
    || session.status === "running"
    || session.status === "planning-data"
    || session.status === "populating-data";
  const generateDataDisabled = !session.databaseReady || session.status === "stale" || busy;
  const interactive = Boolean(onCreateDatabase || onRecreateDatabase || onExecute || onGenerateData || onDownload);
  return (
    <header className="sql-playground-command-bar" aria-label={t("sqlPlayground.actionsLabel")}>
      <div className="sql-playground-command-bar__primary">
        <span className="sql-playground-command-bar__icon" aria-hidden="true">
          <StudioIcon name="database" />
        </span>
        <h1>{t("sqlPlayground.title")}</h1>
        <span className="sql-playground-command-bar__status" aria-live="polite" aria-atomic="true">
          <Badge tone={presentation.tone}>{t(presentation.key)}</Badge>
        </span>
        {interactive ? (
          <>
            {!session.databaseReady ? (
              <Button
                variant="primary"
                size="sm"
                iconLeft="database"
                loading={session.status === "creating-database"}
                disabled={session.status === "loading-engine"}
                onClick={onCreateDatabase}
              >
                <span className="sql-playground-command-bar__action-label">{t("sqlPlayground.createDatabase")}</span>
              </Button>
            ) : (
              <Button
                variant={session.status === "stale" ? "primary" : "secondary"}
                size="sm"
                iconLeft="refresh"
                loading={session.status === "creating-database"}
                onClick={onRecreateDatabase}
              >
                <span className="sql-playground-command-bar__action-label">{t("sqlPlayground.recreateDatabase")}</span>
              </Button>
            )}
            <Tooltip label={t("sqlPlayground.population.generateDataTooltip")} position="bottom">
              {(aria) => (
                <Button
                  className="sql-playground-command-bar__population"
                  variant="secondary"
                  size="sm"
                  iconLeft="sparkles"
                  loading={session.status === "planning-data" || session.status === "populating-data"}
                  disabled={generateDataDisabled}
                  onClick={onGenerateData}
                  {...aria}
                >
                  <span className="sql-playground-command-bar__action-label sql-playground-command-bar__population-label">
                    {t("sqlPlayground.population.generateData")}
                  </span>
                </Button>
              )}
            </Tooltip>
            <Tooltip label={t("sqlPlayground.executeTooltip")} position="bottom">
              {(aria) => (
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft="code"
                  loading={session.status === "running"}
                  disabled={executeDisabled}
                  onClick={onExecute}
                  {...aria}
                >
                  <span className="sql-playground-command-bar__action-label">{t("sqlPlayground.execute")}</span>
                </Button>
              )}
            </Tooltip>
            <Tooltip label={t("sqlPlayground.downloadDatabase")} position="bottom">
              {(aria) => (
                <Button
                  className="sql-playground-command-bar__download"
                  variant="secondary"
                  size="sm"
                  iconLeft="download"
                  disabled={!session.databaseReady || busy}
                  onClick={onDownload}
                  {...aria}
                >
                  <span className="sql-playground-command-bar__action-label sql-playground-command-bar__download-label">{t("sqlPlayground.downloadDatabase")}</span>
                </Button>
              )}
            </Tooltip>
          </>
        ) : null}
      </div>
      <div className="sql-playground-command-bar__metadata">
        <strong title={session.schemaName}>{session.schemaName}</strong>
        {session.sqliteVersion ? <span>SQLite {session.sqliteVersion}</span> : null}
        <Tooltip label={t("sqlPlayground.sessionNotice")} position="bottom">
          {(aria) => (
            <span className="sql-playground-command-bar__info" role="img" aria-label={t("sqlPlayground.sessionNotice")} tabIndex={0} {...aria}>
              <StudioIcon name="info" aria-hidden="true" />
            </span>
          )}
        </Tooltip>
      </div>
    </header>
  );
}
