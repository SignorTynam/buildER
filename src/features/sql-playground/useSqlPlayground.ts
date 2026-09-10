import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createSqlPlaygroundSessionState,
  downloadSqliteDatabase,
  getSqlPlaygroundStatus,
  hashSqlSchema,
  SQL_PLAYGROUND_DEFAULT_RESULTS_HEIGHT,
  normalizeSqlPlaygroundError,
  SQL_PLAYGROUND_MAX_ROWS,
} from "../../utils/sqlPlayground";
import { SqlPlaygroundClientError, type SqlPlaygroundManager } from "./SqlPlaygroundManager";
import type { GeneratedSqlPlaygroundSessionState } from "./sqlPlaygroundState";
import type {
  SqlPopulationApplyResult,
  SqlPopulationConfig,
  SqlPopulationPlanPreview,
} from "./sqlDataPopulationTypes";

interface UseSqlPlaygroundOptions {
  manager: SqlPlaygroundManager;
  sessionId: string;
  schemaFileId: string;
  schemaName: string;
  generatedSql: string;
}

export function useSqlPlayground({
  manager,
  sessionId,
  schemaFileId,
  schemaName,
  generatedSql,
}: UseSqlPlaygroundOptions) {
  const currentGeneratedChecksum = useMemo(() => hashSqlSchema(generatedSql), [generatedSql]);
  const [session, setSession] = useState<GeneratedSqlPlaygroundSessionState>(() => {
    const candidate = manager.getSessionState(sessionId);
    const stored = candidate?.source.kind === "generated-schema"
      ? candidate as GeneratedSqlPlaygroundSessionState
      : undefined;
    const initial = stored
      ? {
          ...stored,
          schemaName,
          currentGeneratedChecksum,
          resultsPanelHeight: stored.resultsPanelHeight ?? SQL_PLAYGROUND_DEFAULT_RESULTS_HEIGHT,
          resultsPanelCollapsed: stored.resultsPanelCollapsed ?? false,
        }
      : createSqlPlaygroundSessionState({ sessionId, schemaFileId, schemaName, currentGeneratedChecksum });
    manager.setSessionState(initial);
    return initial;
  });

  const updateSession = useCallback(
    (updater: (current: GeneratedSqlPlaygroundSessionState) => GeneratedSqlPlaygroundSessionState) => {
      setSession((current) => {
        const next = updater(current);
        manager.setSessionState(next);
        return next;
      });
    },
    [manager],
  );

  useEffect(() => {
    let cancelled = false;
    updateSession((current) => ({ ...current, status: "loading-engine", error: null }));
    void manager.initialize().then(
      (sqliteVersion) => {
        if (cancelled) return;
        updateSession((current) => ({
          ...current,
          sqliteVersion,
          status: getSqlPlaygroundStatus(
            current.databaseReady,
            current.schemaChecksum,
            current.currentGeneratedChecksum,
          ),
          error: null,
        }));
      },
      (error) => {
        if (cancelled) return;
        updateSession((current) => ({
          ...current,
          status: "runtime-error",
          error: normalizeSqlPlaygroundError("initialize", error),
        }));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [manager, updateSession]);

  useEffect(() => {
    updateSession((current) => ({
      ...current,
      schemaName,
      source: { ...current.source, schemaName },
      currentGeneratedChecksum,
      status:
        current.status === "creating-database"
          || current.status === "running"
          || current.status === "planning-data"
          || current.status === "populating-data"
          || current.status === "loading-engine"
          ? current.status
          : getSqlPlaygroundStatus(current.databaseReady, current.schemaChecksum, currentGeneratedChecksum),
    }));
  }, [currentGeneratedChecksum, schemaName, updateSession]);

  const setQuery = useCallback(
    (query: string) => updateSession((current) => ({ ...current, query })),
    [updateSession],
  );

  const setResultsPanelHeight = useCallback(
    (resultsPanelHeight: number) => updateSession((current) => ({ ...current, resultsPanelHeight })),
    [updateSession],
  );

  const setResultsPanelCollapsed = useCallback(
    (resultsPanelCollapsed: boolean) => updateSession((current) => ({ ...current, resultsPanelCollapsed })),
    [updateSession],
  );

  const createDatabase = useCallback(
    async (reset = false) => {
      updateSession((current) => ({ ...current, status: "creating-database", error: null }));
      try {
        await manager.createSchema(sessionId, generatedSql, currentGeneratedChecksum, reset);
        updateSession((current) => ({
          ...current,
          status: "ready",
          databaseReady: true,
          schemaChecksum: currentGeneratedChecksum,
          source: { ...current.source, schemaChecksum: currentGeneratedChecksum },
          currentGeneratedChecksum,
          hasUserDataChanges: false,
          results: [],
          error: null,
        }));
      } catch (error) {
        const normalized = error instanceof SqlPlaygroundClientError
          ? error.payload
          : normalizeSqlPlaygroundError(reset ? "reset" : "create-schema", error);
        updateSession((current) => ({ ...current, status: "schema-error", error: normalized }));
        return false;
      }
      return true;
    },
    [currentGeneratedChecksum, generatedSql, manager, sessionId, updateSession],
  );

  const planPopulation = useCallback(
    async (config: SqlPopulationConfig): Promise<SqlPopulationPlanPreview> => {
      updateSession((current) => ({ ...current, status: "planning-data", error: null }));
      try {
        const plan = await manager.planPopulation(sessionId, config);
        updateSession((current) => ({ ...current, status: "ready", error: null }));
        return plan;
      } catch (error) {
        updateSession((current) => ({ ...current, status: "ready", error: null }));
        throw error;
      }
    },
    [manager, sessionId, updateSession],
  );

  const applyPopulation = useCallback(
    async (planId: string): Promise<SqlPopulationApplyResult> => {
      updateSession((current) => ({ ...current, status: "populating-data", error: null }));
      try {
        const result = await manager.applyPopulation(sessionId, planId);
        updateSession((current) => ({
          ...current,
          status: "ready",
          hasUserDataChanges: true,
          results: [],
          error: null,
        }));
        return result;
      } catch (error) {
        updateSession((current) => ({ ...current, status: "ready", error: null }));
        throw error;
      }
    },
    [manager, sessionId, updateSession],
  );

  const execute = useCallback(
    async (sql: string) => {
      if (!sql.trim()) return;
      updateSession((current) => ({ ...current, status: "running", error: null }));
      try {
        const response = await manager.execute(sessionId, sql, SQL_PLAYGROUND_MAX_ROWS);
        updateSession((current) => ({
          ...current,
          status: getSqlPlaygroundStatus(true, current.schemaChecksum, current.currentGeneratedChecksum),
          results: response.results,
          hasUserDataChanges: current.hasUserDataChanges || response.databaseChanged,
          error: null,
        }));
      } catch (error) {
        const normalized = error instanceof SqlPlaygroundClientError
          ? error.payload
          : normalizeSqlPlaygroundError("execute", error);
        updateSession((current) => ({ ...current, status: "runtime-error", error: normalized }));
      }
    },
    [manager, sessionId, updateSession],
  );

  const downloadDatabase = useCallback(async () => {
    try {
      const bytes = await manager.exportDatabase(sessionId);
      downloadSqliteDatabase(bytes, schemaName);
      return true;
    } catch (error) {
      const normalized = error instanceof SqlPlaygroundClientError
        ? error.payload
        : normalizeSqlPlaygroundError("export", error);
      updateSession((current) => ({ ...current, status: "runtime-error", error: normalized }));
      return false;
    }
  }, [manager, schemaName, sessionId, updateSession]);

  return {
    session,
    setQuery,
    setResultsPanelHeight,
    setResultsPanelCollapsed,
    createDatabase,
    planPopulation,
    applyPopulation,
    execute,
    downloadDatabase,
  };
}
