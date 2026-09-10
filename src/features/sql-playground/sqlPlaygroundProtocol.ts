import type {
  SqlPopulationApplyResult,
  SqlPopulationConfig,
  SqlPopulationErrorCode,
  SqlPopulationPlanPreview,
} from "./sqlDataPopulationTypes";

export type SqlPlaygroundOperation =
  | "initialize"
  | "create-schema"
  | "open-database"
  | "execute"
  | "plan-population"
  | "apply-population"
  | "inspect-schema"
  | "reverse-database"
  | "restore-database"
  | "reset"
  | "export"
  | "close-session"
  | "dispose";

export interface SqlBlobValue {
  kind: "blob";
  byteLength: number;
}

export type SqlResultValue = string | number | bigint | null | SqlBlobValue;

export interface SqlStatementResult {
  statementIndex: number;
  sql: string;
  kind: "rows" | "changes";
  columns: string[];
  rows: SqlResultValue[][];
  rowCount: number;
  truncated: boolean;
  changes: number;
  lastInsertRowId?: string;
  durationMs: number;
}

export interface SqlPlaygroundErrorPayload {
  operation: SqlPlaygroundOperation;
  message: string;
  statementIndex?: number;
  technicalDetail?: string;
  code?: SqlPopulationErrorCode;
  context?: Record<string, string | number>;
  recoverable: boolean;
}

export type SqlPlaygroundRequestPayload =
  | { type: "initialize" }
  | { type: "create-schema"; sessionId: string; sql: string; schemaChecksum: string }
  | { type: "open-database"; sessionId: string; fileName: string; fileSize: number; bytes: ArrayBuffer }
  | { type: "execute"; sessionId: string; sql: string; maxRows: number }
  | ({ type: "plan-population"; sessionId: string } & SqlPopulationConfig)
  | { type: "apply-population"; sessionId: string; planId: string }
  | { type: "inspect-schema"; sessionId: string }
  | { type: "reverse-database"; sessionId: string }
  | { type: "restore-database"; sessionId: string }
  | { type: "reset"; sessionId: string; sql: string; schemaChecksum: string }
  | { type: "export"; sessionId: string }
  | { type: "close-session"; sessionId: string }
  | { type: "dispose" };

export type SqlPlaygroundRequest = SqlPlaygroundRequestPayload & { requestId: string };

export type SqlPlaygroundResponsePayload =
  | { type: "initialized"; sqliteVersion: string }
  | { type: "schema-ready"; sessionId: string; schemaChecksum: string }
  | {
      type: "database-opened";
      sessionId: string;
      fileName: string;
      fileSize: number;
      metadata: import("./sqlExplorerTypes").SqlExplorerMetadata;
      schemaSignature: string;
      schemaVersion: number;
      applicationId: number;
      userVersion: number;
    }
  | {
      type: "execution-complete";
      sessionId: string;
      results: SqlStatementResult[];
      databaseChanged: boolean;
      schemaChanged: boolean;
      durationMs: number;
    }
  | ({ type: "population-planned" } & SqlPopulationPlanPreview)
  | ({ type: "population-applied" } & SqlPopulationApplyResult)
  | {
      type: "schema-inspected";
      sessionId: string;
      metadata: import("./sqlExplorerTypes").SqlExplorerMetadata;
    }
  | {
      type: "database-reversed";
      sessionId: string;
      metadata: import("./sqlExplorerTypes").SqlExplorerMetadata;
      schemaSignature: string;
    }
  | {
      type: "database-restored";
      sessionId: string;
      metadata: import("./sqlExplorerTypes").SqlExplorerMetadata;
      schemaSignature: string;
    }
  | { type: "export-complete"; sessionId: string; bytes: ArrayBuffer }
  | { type: "session-closed"; sessionId: string }
  | { type: "disposed" }
  | { type: "error"; error: SqlPlaygroundErrorPayload };

export type SqlPlaygroundResponse = SqlPlaygroundResponsePayload & { requestId: string };

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPopulationContext(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((entry) => isString(entry) || isFiniteNumber(entry));
}

function isPopulationWarning(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return value.code === "population-row-limit"
    && isString(value.tableName)
    && isPopulationContext(value.messageContext);
}

function isPopulationSummary(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isString(value.tableName)
    && isInteger(value.requestedRows)
    && isInteger(value.generatedRows);
}

function isPopulationPlan(value: Record<string, unknown>): boolean {
  return isString(value.planId)
    && value.planId.length > 0
    && isString(value.sessionId)
    && value.sessionId.length > 0
    && isInteger(value.seed)
    && isInteger(value.rowsPerTable)
    && isString(value.schemaSignature)
    && isInteger(value.tableCount)
    && isInteger(value.totalRows)
    && Array.isArray(value.tables)
    && value.tables.every(isPopulationSummary)
    && Array.isArray(value.warnings)
    && value.warnings.every(isPopulationWarning)
    && isString(value.previewSql);
}

function isErrorPayload(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return isString(value.operation)
    && isString(value.message)
    && typeof value.recoverable === "boolean"
    && (value.statementIndex === undefined || isInteger(value.statementIndex))
    && (value.technicalDetail === undefined || isString(value.technicalDetail))
    && (value.code === undefined || isString(value.code))
    && (value.context === undefined || isPopulationContext(value.context));
}

export function isSqlPlaygroundRequest(value: unknown): value is SqlPlaygroundRequest {
  if (!isRecord(value) || !isString(value.requestId) || !isString(value.type)) return false;
  switch (value.type) {
    case "initialize":
    case "dispose":
      return true;
    case "create-schema":
    case "reset":
      return isString(value.sessionId) && isString(value.sql) && isString(value.schemaChecksum);
    case "open-database":
      return isString(value.sessionId) && isString(value.fileName) && isFiniteNumber(value.fileSize) && value.bytes instanceof ArrayBuffer;
    case "execute":
      return isString(value.sessionId) && isString(value.sql) && isInteger(value.maxRows);
    case "plan-population":
      return isString(value.sessionId) && isInteger(value.rowsPerTable) && isInteger(value.seed);
    case "apply-population":
      return isString(value.sessionId) && isString(value.planId) && value.planId.length > 0;
    case "inspect-schema":
    case "reverse-database":
    case "restore-database":
    case "export":
    case "close-session":
      return isString(value.sessionId);
    default:
      return false;
  }
}

export function isSqlPlaygroundResponse(value: unknown): value is SqlPlaygroundResponse {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.requestId !== "string" || typeof candidate.type !== "string") return false;
  switch (candidate.type) {
    case "initialized":
      return typeof candidate.sqliteVersion === "string";
    case "schema-ready":
      return typeof candidate.sessionId === "string" && typeof candidate.schemaChecksum === "string";
    case "database-opened":
      return typeof candidate.sessionId === "string"
        && typeof candidate.fileName === "string"
        && typeof candidate.fileSize === "number"
        && isMetadata(candidate.metadata)
        && typeof candidate.schemaSignature === "string"
        && typeof candidate.schemaVersion === "number"
        && typeof candidate.applicationId === "number"
        && typeof candidate.userVersion === "number";
    case "execution-complete":
      return typeof candidate.sessionId === "string"
        && Array.isArray(candidate.results)
        && typeof candidate.databaseChanged === "boolean"
        && typeof candidate.schemaChanged === "boolean"
        && typeof candidate.durationMs === "number";
    case "population-planned":
      return isPopulationPlan(candidate);
    case "population-applied":
      return isString(candidate.sessionId)
        && isString(candidate.planId)
        && candidate.planId.length > 0
        && isInteger(candidate.tableCount)
        && isInteger(candidate.rowsInserted);
    case "schema-inspected": {
      const metadata = candidate.metadata;
      return typeof candidate.sessionId === "string"
        && typeof metadata === "object"
        && metadata !== null
        && Array.isArray((metadata as Record<string, unknown>).databases);
    }
    case "database-reversed":
    case "database-restored":
      return typeof candidate.sessionId === "string"
        && isMetadata(candidate.metadata)
        && typeof candidate.schemaSignature === "string";
    case "export-complete":
      return typeof candidate.sessionId === "string" && candidate.bytes instanceof ArrayBuffer;
    case "session-closed":
      return typeof candidate.sessionId === "string";
    case "disposed":
      return true;
    case "error":
      return isErrorPayload(candidate.error);
    default:
      return false;
  }
}

function isMetadata(value: unknown): boolean {
  return typeof value === "object"
    && value !== null
    && Array.isArray((value as Record<string, unknown>).databases);
}
