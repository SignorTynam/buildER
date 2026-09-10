/// <reference lib="webworker" />

import sqlite3InitModule, {
  type Database,
  type PreparedStatement,
  type Sqlite3Static,
  type SqlValue,
} from "@sqlite.org/sqlite-wasm";
import sqliteWasmUrl from "@sqlite.org/sqlite-wasm/sqlite3.wasm?url";
import type {
  SqlPlaygroundErrorPayload,
  SqlPlaygroundOperation,
  SqlPlaygroundRequest,
  SqlPlaygroundResponse,
  SqlResultValue,
  SqlStatementResult,
} from "./sqlPlaygroundProtocol";
import { isSqlPlaygroundRequest } from "./sqlPlaygroundProtocol";
import { inspectSqliteSchema, readSqliteSchemaSignature } from "./sqlExplorerIntrospection";
import { planSqlPopulation, toSqlPopulationPlanPreview } from "./sqlDataPopulation";
import { applySqlPopulationPlan, readSqlPopulationRowCounts } from "./sqlDataPopulationSqlite";
import {
  SqlPopulationError,
  type SqlPopulationPlan,
} from "./sqlDataPopulationTypes";

type WorkerSession =
  | {
      source: "generated-schema";
      database: Database;
      schemaChecksum: string;
    }
  | {
      source: "imported-sqlite";
      database: Database;
      fileName: string;
      fileSize: number;
      originalBytes: Uint8Array;
    };

interface StatementExecutionError extends Error {
  statementIndex?: number;
}

const workerScope: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;
const sessions = new Map<string, WorkerSession>();
const populationPlans = new Map<string, SqlPopulationPlan>();
let sqlite: Sqlite3Static | null = null;
let initialization: Promise<Sqlite3Static> | null = null;
let requestQueue = Promise.resolve();

function postResponse(response: SqlPlaygroundResponse, transfer: Transferable[] = []): void {
  workerScope.postMessage(response, transfer);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function createErrorPayload(
  operation: SqlPlaygroundOperation,
  error: unknown,
): SqlPlaygroundErrorPayload {
  const statementIndex =
    typeof error === "object" && error !== null && "statementIndex" in error
      ? Number((error as StatementExecutionError).statementIndex)
      : undefined;
  const normalized = normalizeDatabaseError(operation, error);
  return {
    operation,
    message: normalized.message,
    statementIndex: Number.isInteger(statementIndex) ? statementIndex : undefined,
    technicalDetail: normalized.technicalDetail ?? normalized.code,
    code: normalized.populationCode,
    context: normalized.context,
    recoverable: operation !== "initialize",
  };
}

function normalizeDatabaseError(
  operation: SqlPlaygroundOperation,
  error: unknown,
): {
  message: string;
  code: string;
  technicalDetail?: string;
  populationCode?: SqlPopulationError["code"];
  context?: SqlPopulationError["context"];
} {
  const raw = getErrorMessage(error);
  const name = error instanceof Error ? error.name : "SQLiteError";
  if (error instanceof SqlPopulationError) {
    return {
      message: error.message,
      code: error.name,
      technicalDetail: error.technicalDetail,
      populationCode: error.code,
      context: error.context,
    };
  }
  if (name === "SQLiteIntegrityError") {
    return { message: "SQLite reported an integrity problem in the database.", code: name };
  }
  if (name === "ImportedDatabaseRequiredError") {
    return { message: "The operation is available only for an imported SQLite database.", code: name };
  }
  if (/file is not a database|encrypted|not a database|malformed|unsupported file format/i.test(raw)) {
    return { message: "The file is encrypted, corrupt, or uses an unsupported SQLite format.", code: "EncryptedOrCorruptDatabase" };
  }
  if (operation === "open-database") {
    return { message: "The file does not contain a valid SQLite database.", code: name };
  }
  if (operation === "restore-database") {
    return { message: "The database was not restored. The current local copy remains available.", code: name };
  }
  return { message: raw, code: name };
}

async function initializeSqlite(): Promise<Sqlite3Static> {
  if (sqlite) return sqlite;
  if (!initialization) {
    type InitWithOptions = (options?: { locateFile?: (path: string) => string }) => Promise<Sqlite3Static>;
    initialization = (sqlite3InitModule as InitWithOptions)({
      locateFile: (path) => (path.endsWith(".wasm") ? sqliteWasmUrl : path),
    }).then((initialized) => {
      sqlite = initialized;
      return initialized;
    });
  }
  return initialization;
}

function splitSqlStatements(sqliteApi: Sqlite3Static, sql: string): string[] {
  const statements: string[] = [];
  let start = 0;
  for (let index = 0; index < sql.length; index += 1) {
    if (sql[index] !== ";") continue;
    const candidate = sql.slice(start, index + 1);
    if (sqliteApi.capi.sqlite3_complete(candidate)) {
      statements.push(candidate);
      start = index + 1;
    }
  }
  const tail = sql.slice(start);
  if (tail.trim().length > 0) statements.push(tail);
  return statements;
}

function toResultValue(value: SqlValue): SqlResultValue {
  if (value instanceof Uint8Array) return { kind: "blob", byteLength: value.byteLength };
  if (value instanceof Int8Array) return { kind: "blob", byteLength: value.byteLength };
  if (value instanceof ArrayBuffer) return { kind: "blob", byteLength: value.byteLength };
  return value;
}

function isInsertStatement(sql: string): boolean {
  const withoutLeadingComments = sql
    .replace(/^\s*(?:--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/\s*)*/u, "")
    .trimStart();
  return /^(?:INSERT|REPLACE)\b/i.test(withoutLeadingComments);
}

function executePreparedStatement(
  sqliteApi: Sqlite3Static,
  database: Database,
  statement: PreparedStatement,
  sql: string,
  statementIndex: number,
  maxRows: number,
): SqlStatementResult {
  const startedAt = performance.now();
  const beforeChanges = database.changes(true, true);
  const columns = statement.columnCount > 0 ? statement.getColumnNames([]) : [];
  const rows: SqlResultValue[][] = [];
  const readOnly = sqliteApi.capi.sqlite3_stmt_readonly(statement) !== 0;
  let rowCount = 0;
  let truncated = false;

  while (statement.step()) {
    rowCount += 1;
    if (rows.length < maxRows) {
      rows.push(statement.get([]).map(toResultValue));
    } else {
      truncated = true;
      if (readOnly) break;
    }
  }

  const changesBigInt = database.changes(true, true) - beforeChanges;
  const changes = Number(changesBigInt <= BigInt(Number.MAX_SAFE_INTEGER) ? changesBigInt : BigInt(Number.MAX_SAFE_INTEGER));
  const lastInsertRowId =
    changes > 0 && isInsertStatement(sql) && database.pointer
      ? sqliteApi.capi.sqlite3_last_insert_rowid(database.pointer).toString()
      : undefined;

  return {
    statementIndex,
    sql: sql.trim(),
    kind: columns.length > 0 ? "rows" : "changes",
    columns,
    rows,
    rowCount,
    truncated,
    changes,
    lastInsertRowId,
    durationMs: Math.max(0, performance.now() - startedAt),
  };
}

function executeStatements(
  sqliteApi: Sqlite3Static,
  database: Database,
  sql: string,
  maxRows: number,
): { results: SqlStatementResult[]; databaseChanged: boolean } {
  const results: SqlStatementResult[] = [];
  const statements = splitSqlStatements(sqliteApi, sql);
  let databaseChanged = false;

  statements.forEach((statementSql, statementIndex) => {
    let statement: PreparedStatement | null = null;
    try {
      statement = database.prepare(statementSql);
      const result = executePreparedStatement(sqliteApi, database, statement, statementSql, statementIndex, maxRows);
      results.push(result);
      databaseChanged ||= sqliteApi.capi.sqlite3_stmt_readonly(statement) === 0;
    } catch (error) {
      const message = getErrorMessage(error);
      if (/empty sql/i.test(message)) return;
      const wrapped = new Error(message) as StatementExecutionError;
      wrapped.name = error instanceof Error ? error.name : "SQLiteError";
      wrapped.statementIndex = statementIndex;
      throw wrapped;
    } finally {
      statement?.finalize();
    }
  });

  return { results, databaseChanged };
}

async function createSchemaDatabase(
  sessionId: string,
  sql: string,
  schemaChecksum: string,
): Promise<void> {
  const sqliteApi = await initializeSqlite();
  const temporaryDatabase = new sqliteApi.oo1.DB(":memory:");
  try {
    temporaryDatabase.exec("PRAGMA foreign_keys = ON;");
    executeStatements(sqliteApi, temporaryDatabase, sql, 0);
  } catch (error) {
    temporaryDatabase.close();
    throw error;
  }

  const previous = sessions.get(sessionId);
  populationPlans.delete(sessionId);
  sessions.set(sessionId, { source: "generated-schema", database: temporaryDatabase, schemaChecksum });
  previous?.database.close();
}

function readSingleNumber(database: Database, sql: string): number {
  let statement: PreparedStatement | null = null;
  try {
    statement = database.prepare(sql);
    if (!statement.step()) return 0;
    const value = statement.get([])[0];
    return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
  } finally {
    statement?.finalize();
  }
}

function validateImportedDatabase(database: Database): {
  metadata: ReturnType<typeof inspectSqliteSchema>;
  schemaSignature: string;
  schemaVersion: number;
  applicationId: number;
  userVersion: number;
} {
  database.exec("PRAGMA foreign_keys = ON;");
  const schemaVersion = readSingleNumber(database, "PRAGMA schema_version;");
  const applicationId = readSingleNumber(database, "PRAGMA application_id;");
  const userVersion = readSingleNumber(database, "PRAGMA user_version;");
  let quickCheck: PreparedStatement | null = null;
  try {
    quickCheck = database.prepare("PRAGMA quick_check(1);");
    if (!quickCheck.step() || String(quickCheck.get([])[0] ?? "").toLowerCase() !== "ok") {
      const error = new Error("quick_check failed");
      error.name = "SQLiteIntegrityError";
      throw error;
    }
  } finally {
    quickCheck?.finalize();
  }
  // This query deliberately verifies that the authoritative catalog can be read.
  readSingleNumber(database, "SELECT count(*) FROM sqlite_schema;");
  const metadata = inspectSqliteSchema(database);
  return {
    metadata,
    schemaSignature: readSqliteSchemaSignature(database),
    schemaVersion,
    applicationId,
    userVersion,
  };
}

function deserializeDatabase(sqliteApi: Sqlite3Static, bytes: Uint8Array): Database {
  const database = new sqliteApi.oo1.DB(":memory:");
  const pointer = sqliteApi.wasm.allocFromTypedArray(bytes);
  let sqliteOwnsPointer = false;
  try {
    const databasePointer = database.pointer;
    if (databasePointer == null) throw new Error("The SQLite database is closed.");
    const flags = sqliteApi.capi.SQLITE_DESERIALIZE_FREEONCLOSE
      | sqliteApi.capi.SQLITE_DESERIALIZE_RESIZEABLE;
    const resultCode = sqliteApi.capi.sqlite3_deserialize(
      databasePointer,
      "main",
      pointer,
      bytes.byteLength,
      bytes.byteLength,
      flags,
    );
    // FREEONCLOSE transfers ownership even when sqlite3_deserialize() fails.
    sqliteOwnsPointer = true;
    database.checkRc(resultCode);
    return database;
  } catch (error) {
    database.close();
    if (!sqliteOwnsPointer) sqliteApi.wasm.dealloc(pointer);
    throw error;
  }
}

async function openImportedDatabase(
  sessionId: string,
  fileName: string,
  fileSize: number,
  buffer: ArrayBuffer,
) {
  const sqliteApi = await initializeSqlite();
  const originalBytes = new Uint8Array(buffer).slice();
  const temporaryDatabase = deserializeDatabase(sqliteApi, originalBytes);
  try {
    const validation = validateImportedDatabase(temporaryDatabase);
    const previous = sessions.get(sessionId);
    populationPlans.delete(sessionId);
    sessions.set(sessionId, {
      source: "imported-sqlite",
      database: temporaryDatabase,
      fileName,
      fileSize,
      originalBytes,
    });
    previous?.database.close();
    return validation;
  } catch (error) {
    temporaryDatabase.close();
    throw error;
  }
}

async function restoreImportedDatabase(session: WorkerSession) {
  if (session.source !== "imported-sqlite") {
    const error = new Error("Imported database required");
    error.name = "ImportedDatabaseRequiredError";
    throw error;
  }
  const sqliteApi = await initializeSqlite();
  const temporaryDatabase = deserializeDatabase(sqliteApi, session.originalBytes);
  try {
    const validation = validateImportedDatabase(temporaryDatabase);
    const previousDatabase = session.database;
    session.database = temporaryDatabase;
    previousDatabase.close();
    return validation;
  } catch (error) {
    temporaryDatabase.close();
    throw error;
  }
}

function requireSession(sessionId: string): WorkerSession {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("The SQLite database has not been created for this schema.");
  return session;
}

function requireGeneratedSession(sessionId: string): Extract<WorkerSession, { source: "generated-schema" }> {
  const session = requireSession(sessionId);
  if (session.source !== "generated-schema") {
    throw new SqlPopulationError(
      "population-session-not-generated",
      "Data population is available only for generated SQL Playground sessions.",
      { sessionId },
    );
  }
  return session;
}

async function handleRequest(request: SqlPlaygroundRequest): Promise<void> {
  try {
    switch (request.type) {
      case "initialize": {
        const sqliteApi = await initializeSqlite();
        postResponse({ requestId: request.requestId, type: "initialized", sqliteVersion: sqliteApi.version.libVersion });
        return;
      }
      case "create-schema":
      case "reset": {
        await createSchemaDatabase(request.sessionId, request.sql, request.schemaChecksum);
        postResponse({
          requestId: request.requestId,
          type: "schema-ready",
          sessionId: request.sessionId,
          schemaChecksum: request.schemaChecksum,
        });
        return;
      }
      case "open-database": {
        const validation = await openImportedDatabase(
          request.sessionId,
          request.fileName,
          request.fileSize,
          request.bytes,
        );
        postResponse({
          requestId: request.requestId,
          type: "database-opened",
          sessionId: request.sessionId,
          fileName: request.fileName,
          fileSize: request.fileSize,
          ...validation,
        });
        return;
      }
      case "execute": {
        const sqliteApi = await initializeSqlite();
        const session = requireSession(request.sessionId);
        const startedAt = performance.now();
        const schemaSignatureBefore = readSqliteSchemaSignature(session.database);
        let execution: ReturnType<typeof executeStatements>;
        try {
          execution = executeStatements(sqliteApi, session.database, request.sql, request.maxRows);
        } catch (error) {
          populationPlans.delete(request.sessionId);
          throw error;
        }
        if (execution.databaseChanged) populationPlans.delete(request.sessionId);
        const schemaSignatureAfter = readSqliteSchemaSignature(session.database);
        postResponse({
          requestId: request.requestId,
          type: "execution-complete",
          sessionId: request.sessionId,
          results: execution.results,
          databaseChanged: execution.databaseChanged,
          schemaChanged: schemaSignatureBefore !== schemaSignatureAfter,
          durationMs: Math.max(0, performance.now() - startedAt),
        });
        return;
      }
      case "plan-population": {
        const session = requireGeneratedSession(request.sessionId);
        populationPlans.delete(request.sessionId);
        const metadata = inspectSqliteSchema(session.database);
        const main = metadata.databases.find((database) => database.name === "main");
        const tableNames = (main?.tables ?? [])
          .filter((table) => !table.virtual && !table.name.toLocaleLowerCase().startsWith("sqlite_"))
          .map((table) => table.name);
        const plan = planSqlPopulation({
          sessionId: request.sessionId,
          config: { rowsPerTable: request.rowsPerTable, seed: request.seed },
          metadata,
          schemaSignature: readSqliteSchemaSignature(session.database),
          rowCounts: readSqlPopulationRowCounts(session.database, tableNames),
        });
        populationPlans.set(request.sessionId, plan);
        postResponse({
          requestId: request.requestId,
          type: "population-planned",
          ...toSqlPopulationPlanPreview(plan),
        });
        return;
      }
      case "apply-population": {
        const session = requireGeneratedSession(request.sessionId);
        const plan = populationPlans.get(request.sessionId);
        if (!plan || plan.planId !== request.planId || plan.sessionId !== request.sessionId) {
          throw new SqlPopulationError(
            "population-plan-stale",
            "The population plan is missing, stale, or belongs to another session.",
            { sessionId: request.sessionId, planId: request.planId },
          );
        }
        try {
          const result = applySqlPopulationPlan(session.database, plan);
          postResponse({ requestId: request.requestId, type: "population-applied", ...result });
        } finally {
          populationPlans.delete(request.sessionId);
        }
        return;
      }
      case "inspect-schema": {
        const session = requireSession(request.sessionId);
        postResponse({
          requestId: request.requestId,
          type: "schema-inspected",
          sessionId: request.sessionId,
          metadata: inspectSqliteSchema(session.database),
        });
        return;
      }
      case "reverse-database": {
        const session = requireSession(request.sessionId);
        postResponse({
          requestId: request.requestId,
          type: "database-reversed",
          sessionId: request.sessionId,
          metadata: inspectSqliteSchema(session.database),
          schemaSignature: readSqliteSchemaSignature(session.database),
        });
        return;
      }
      case "restore-database": {
        const session = requireSession(request.sessionId);
        populationPlans.delete(request.sessionId);
        const validation = await restoreImportedDatabase(session);
        postResponse({
          requestId: request.requestId,
          type: "database-restored",
          sessionId: request.sessionId,
          metadata: validation.metadata,
          schemaSignature: validation.schemaSignature,
        });
        return;
      }
      case "export": {
        const sqliteApi = await initializeSqlite();
        const session = requireSession(request.sessionId);
        const databasePointer = session.database.pointer;
        if (databasePointer == null) throw new Error("The SQLite database is closed.");
        const bytes = sqliteApi.capi.sqlite3_js_db_export(databasePointer);
        const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
        postResponse(
          { requestId: request.requestId, type: "export-complete", sessionId: request.sessionId, bytes: buffer },
          [buffer],
        );
        return;
      }
      case "close-session": {
        sessions.get(request.sessionId)?.database.close();
        sessions.delete(request.sessionId);
        populationPlans.delete(request.sessionId);
        postResponse({ requestId: request.requestId, type: "session-closed", sessionId: request.sessionId });
        return;
      }
      case "dispose": {
        sessions.forEach((session) => session.database.close());
        sessions.clear();
        populationPlans.clear();
        postResponse({ requestId: request.requestId, type: "disposed" });
        return;
      }
    }
  } catch (error) {
    postResponse({
      requestId: request.requestId,
      type: "error",
      error: createErrorPayload(request.type, error),
    });
  }
}

workerScope.onmessage = (event: MessageEvent<unknown>) => {
  if (!isSqlPlaygroundRequest(event.data)) return;
  const request = event.data;
  requestQueue = requestQueue.then(() => handleRequest(request));
};
