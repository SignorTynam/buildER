import type { SqlPlaygroundErrorPayload, SqlStatementResult } from "./sqlPlaygroundProtocol";
import type { SqlDatabaseSessionSource } from "../database-workspace/databaseWorkspaceTypes";

export type SqlPlaygroundStatus =
  | "idle"
  | "loading-engine"
  | "engine-ready"
  | "creating-database"
  | "opening-database"
  | "verifying-database"
  | "ready"
  | "modified"
  | "exporting"
  | "exported"
  | "restoring"
  | "stale"
  | "running"
  | "planning-data"
  | "populating-data"
  | "schema-error"
  | "runtime-error";

interface SqlDatabaseSessionStateBase {
  sessionId: string;
  source: SqlDatabaseSessionSource;
  query: string;
  status: SqlPlaygroundStatus;
  databaseReady: boolean;
  sqliteVersion: string | null;
  results: SqlStatementResult[];
  resultsPanelHeight: number;
  resultsPanelCollapsed: boolean;
  error: SqlPlaygroundErrorPayload | null;
}

export interface GeneratedSqlPlaygroundSessionState extends SqlDatabaseSessionStateBase {
  source: Extract<SqlDatabaseSessionSource, { kind: "generated-schema" }>;
  schemaFileId: string;
  schemaName: string;
  schemaChecksum: string | null;
  currentGeneratedChecksum: string;
  hasUserDataChanges: boolean;
}

export interface ImportedSqlDatabaseSessionState extends SqlDatabaseSessionStateBase {
  source: Extract<SqlDatabaseSessionSource, { kind: "imported-sqlite" }>;
  fileName: string;
  fileSize: number;
  schemaSignature: string;
  hasSessionChanges: boolean;
  hasUnexportedChanges: boolean;
  lastExportedAt: string | null;
}

export type SqlPlaygroundSessionState = GeneratedSqlPlaygroundSessionState | ImportedSqlDatabaseSessionState;

export function isImportedSqlDatabaseSession(
  state: SqlPlaygroundSessionState | undefined,
): state is ImportedSqlDatabaseSessionState {
  return state?.source.kind === "imported-sqlite";
}
