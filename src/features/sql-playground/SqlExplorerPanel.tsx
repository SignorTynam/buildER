import { ProjectActivityPanelHeader } from "../../components/project/ProjectActivityPanelHeader";
import { StudioIcon } from "../../components/icons/StudioIcon";
import { PanelEmptyState } from "../../components/workspace/WorkspacePanel";
import { Button, Modal, Tooltip } from "../../components/ui";
import { useI18n } from "../../i18n/useI18n";
import { useMemo, useState, type ReactNode } from "react";
import type { SqlPlaygroundManager } from "./SqlPlaygroundManager";
import type { SqlPlaygroundSessionState } from "./sqlPlaygroundState";
import { SqlExplorerTree } from "./SqlExplorerTree";
import { useSqlExplorer } from "./useSqlExplorer";

interface SqlExplorerPanelProps {
  manager: SqlPlaygroundManager | null;
  sessionId: string | null;
  schemaName: string | null;
  hasProject: boolean;
  hasSchema: boolean;
  onOpenPlayground: () => void;
  sessions?: SqlPlaygroundSessionState[];
  onSessionChange?: (sessionId: string) => void;
  onOpenDatabase?: () => void;
  onReverseDatabase?: (sessionId: string) => void;
  onOpenQuery?: (sessionId: string, query: string, execute: boolean) => void;
  onClose: () => void;
}

export function SqlExplorerPanel({
  manager,
  sessionId,
  schemaName,
  hasProject,
  hasSchema,
  onOpenPlayground,
  sessions = [],
  onSessionChange = () => undefined,
  onOpenDatabase = () => undefined,
  onReverseDatabase = () => undefined,
  onOpenQuery = () => undefined,
  onClose,
}: SqlExplorerPanelProps) {
  const { t } = useI18n();
  const explorer = useSqlExplorer(manager, sessionId);
  const [definition, setDefinition] = useState<{ title: string; sql: string } | null>(null);
  const treeActions = useMemo(() => ({
    openQuery: (query: string, execute: boolean) => { if (sessionId) onOpenQuery(sessionId, query, execute); },
    showDefinition: (title: string, sql: string) => setDefinition({ title, sql }),
    copyName: (name: string) => { void navigator.clipboard?.writeText(name); },
    reverse: () => { if (sessionId) onReverseDatabase(sessionId); },
  }), [onOpenQuery, onReverseDatabase, sessionId]);
  const sessionExists = Boolean(manager && sessionId && manager.getSessionState(sessionId));
  let content: ReactNode = null;

  if (!sessionId) {
    content = hasProject ? (
      <PanelEmptyState
        className="sql-explorer-empty"
        variant="card"
        icon="database"
        title={t("sqlExplorer.empty.noDatabaseTitle")}
        description={t("sqlExplorer.empty.noDatabaseDescription")}
        role="status"
      >
        {hasSchema ? (
          <Button size="sm" variant="primary" iconLeft="database" onClick={onOpenPlayground}>
            {t("sqlExplorer.openPlayground")}
          </Button>
        ) : null}
        <Button size="sm" variant="secondary" iconLeft="database" onClick={onOpenDatabase}>
          {t("sqlExplorer.addDatabase")}
        </Button>
      </PanelEmptyState>
    ) : (
      <PanelEmptyState
        className="sql-explorer-empty"
        variant="card"
        icon="database"
        title={t("sqlExplorer.empty.noProjectTitle")}
        description={t("sqlExplorer.empty.noProjectDescription")}
        role="status"
      />
    );
  } else if (!sessionExists || explorer.status === "idle") {
    content = (
      <PanelEmptyState
        className="sql-explorer-empty"
        variant="card"
        icon="database"
        title={t("sqlExplorer.empty.playgroundClosedTitle")}
        description={t("sqlExplorer.empty.playgroundClosedDescription")}
        role="status"
      >
        <Button size="sm" variant="primary" iconLeft="database" onClick={onOpenPlayground}>
          {t("sqlExplorer.openPlayground")}
        </Button>
      </PanelEmptyState>
    );
  } else if (explorer.status === "database-missing") {
    content = (
      <PanelEmptyState
        className="sql-explorer-empty"
        variant="card"
        icon="database"
        title={t("sqlExplorer.empty.databaseMissingTitle")}
        description={t("sqlExplorer.empty.databaseMissingDescription")}
        role="status"
      >
        <Button size="sm" variant="primary" iconLeft="database" onClick={onOpenPlayground}>
          {t("sqlExplorer.goToPlayground")}
        </Button>
      </PanelEmptyState>
    );
  } else if (explorer.metadata) {
    content = (
      <div className="sql-explorer-tree-region" aria-busy={explorer.status === "loading" || undefined}>
        {explorer.status === "loading" ? (
          <div className="sql-explorer-loading" role="status"><span className="ui-button__spinner" aria-hidden="true" />{t("sqlExplorer.loading")}</div>
        ) : null}
        <SqlExplorerTree metadata={explorer.metadata} schemaName={schemaName ?? t("databaseWorkspace.importedDatabase")} actions={treeActions} />
      </div>
    );
  } else if (explorer.status === "loading") {
    content = <div className="sql-explorer-loading" role="status"><span className="ui-button__spinner" aria-hidden="true" />{t("sqlExplorer.loading")}</div>;
  } else if (explorer.status === "error") {
    content = (
      <div className="sql-explorer-error" role="alert">
        <strong>{t("sqlExplorer.error.title")}</strong>
        <p>{explorer.error?.message ?? t("sqlExplorer.error.description")}</p>
        <Button size="sm" variant="secondary" iconLeft="refresh" onClick={() => void explorer.refresh()}>{t("sqlExplorer.retry")}</Button>
      </div>
    );
  }

  return (
    <section className="project-activity-section sql-explorer-panel" aria-label={t("sqlExplorer.title")}>
      <ProjectActivityPanelHeader title={t("sqlExplorer.title")} closeLabel={t("workspaceActivity.closePanel")} onClose={onClose}>
        <Tooltip label={t("sqlExplorer.refresh")} position="bottom">
          {(aria) => (
            <button
              type="button"
              className="sql-explorer-refresh"
              onClick={() => void explorer.refresh()}
              disabled={explorer.status === "loading" || explorer.status === "idle" || explorer.status === "database-missing"}
              aria-busy={explorer.status === "loading" || undefined}
              aria-label={t("sqlExplorer.refresh")}
              {...aria}
            >
              <StudioIcon name="refresh" aria-hidden="true" />
            </button>
          )}
        </Tooltip>
      </ProjectActivityPanelHeader>
      <div className="sql-explorer-panel__toolbar">
        <Button size="sm" variant="secondary" iconLeft="database" onClick={onOpenDatabase}>
          {t("sqlExplorer.addDatabase")}
        </Button>
      </div>
      {sessions.length > 1 ? (
        <label className="sql-explorer-session-select">
          <span>{t("databaseWorkspace.session")}</span>
          <select className="ui-select" value={sessionId ?? ""} onChange={(event) => onSessionChange(event.target.value)}>
            {sessions.map((session) => (
              <option key={session.sessionId} value={session.sessionId}>
                {session.source.kind === "imported-sqlite"
                  ? `${session.source.fileName} · ${t("databaseWorkspace.importedDatabase")}`
                  : `${session.source.schemaName} · ${t("databaseWorkspace.generatedDatabase")}`}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {schemaName ? <div className="sql-explorer-schema-name" title={schemaName}>
        <span>{schemaName}</span>
        {sessionId && manager?.getSessionState(sessionId)?.source.kind === "imported-sqlite" ? (
          <Button size="sm" variant="ghost" iconLeft="databaseReverse" onClick={() => onReverseDatabase(sessionId)}>{t("databaseWorkspace.reverseEngineering")}</Button>
        ) : null}
      </div> : null}
      <div className="sql-explorer-panel__body">{content}</div>
      <Modal
        open={Boolean(definition)}
        onClose={() => setDefinition(null)}
        title={t("sqlExplorer.actions.definitionTitle", { name: definition?.title ?? "" })}
        size="md"
        footer={<Button variant="primary" onClick={() => setDefinition(null)}>{t("common.actions.close")}</Button>}
      >
        <pre className="sql-explorer-definition"><code>{definition?.sql}</code></pre>
      </Modal>
    </section>
  );
}
