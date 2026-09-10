import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import "./sql-data-population.test.ts";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import type { LogicalColumn, LogicalModel, LogicalTable } from "../src/types/logical.ts";
import { SqlPlaygroundManager } from "../src/features/sql-playground/SqlPlaygroundManager.ts";
import type { SqlPlaygroundRequest, SqlPlaygroundResponse } from "../src/features/sql-playground/sqlPlaygroundProtocol.ts";
import { isSqlPlaygroundRequest, isSqlPlaygroundResponse } from "../src/features/sql-playground/sqlPlaygroundProtocol.ts";
import { generateLogicalSql } from "../src/utils/logicalSql.ts";
import {
  buildSqlPlaygroundSessionId,
  countSqlResultSets,
  createSqlPlaygroundSessionState,
  createSqliteDownloadName,
  downloadSqliteDatabase,
  formatSqlResultValue,
  getSqlPlaygroundStatus,
  hashSqlSchema,
  limitSqlRows,
  normalizeSqlPlaygroundError,
} from "../src/utils/sqlPlayground.ts";
import { createSchemaWorkspaceFile, createTextWorkspaceFile } from "../src/utils/projectExplorer.ts";
import {
  resolveSqlFileDatabaseName,
  resolveSqlPlaygroundSchema,
  stripSqlFileDatabaseContext,
} from "../src/utils/sqlFileWorkspace.ts";

function column(id: string, name: string, overrides: Partial<LogicalColumn> = {}): LogicalColumn {
  return {
    id,
    name,
    isPrimaryKey: false,
    isForeignKey: false,
    isNullable: true,
    dataType: "TEXT",
    references: [],
    ...overrides,
  };
}

test("SQL file schema resolution is deterministic and never selects the first of many", () => {
  const first = createSchemaWorkspaceFile("First.erschema");
  const second = createSchemaWorkspaceFile("Second.erschema");
  const sql = createTextWorkspaceFile("query.sql", "sql", "SELECT 1;");
  const files = { [second.id]: second, [sql.id]: sql, [first.id]: first };

  assert.deepEqual(resolveSqlPlaygroundSchema({
    files,
    activePlaygroundSchemaId: first.id,
    lastPlaygroundSchemaId: second.id,
  }), { status: "resolved", schemaFileId: first.id });
  assert.deepEqual(resolveSqlPlaygroundSchema({
    files,
    activePlaygroundSchemaId: "deleted",
    lastPlaygroundSchemaId: second.id,
  }), { status: "resolved", schemaFileId: second.id });
  assert.deepEqual(resolveSqlPlaygroundSchema({
    files,
    activePlaygroundSchemaId: null,
    lastPlaygroundSchemaId: null,
  }), { status: "ambiguous" });
  assert.deepEqual(resolveSqlPlaygroundSchema({
    files: { [sql.id]: sql, [first.id]: first },
    activePlaygroundSchemaId: null,
    lastPlaygroundSchemaId: null,
  }), { status: "resolved", schemaFileId: first.id });
  assert.deepEqual(resolveSqlPlaygroundSchema({
    files: { [sql.id]: sql },
    activePlaygroundSchemaId: null,
    lastPlaygroundSchemaId: null,
  }), { status: "missing" });
});

test("SQL file database names are resolved from declarations and qualified objects", () => {
  assert.equal(resolveSqlFileDatabaseName("CREATE DATABASE IF NOT EXISTS `student portal`;"), "student portal");
  assert.equal(resolveSqlFileDatabaseName('USE "analytics";\nSELECT 1;'), "analytics");
  assert.equal(resolveSqlFileDatabaseName("ATTACH DATABASE 'cache.sqlite' AS [cache];"), "cache");
  assert.equal(resolveSqlFileDatabaseName("SELECT * FROM reporting.events;"), "reporting");
  assert.equal(resolveSqlFileDatabaseName("-- USE ignored\nSELECT 1;"), null);
  assert.equal(
    stripSqlFileDatabaseContext("CREATE DATABASE demo;\nUSE demo;\nCREATE TABLE Person (id INTEGER);"),
    "CREATE TABLE Person (id INTEGER);",
  );
});

test("App names and creates a generated Playground database without executing the SQL file", () => {
  const source = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
  const handlerStart = source.indexOf("function handleOpenSqlFileInPlayground");
  const handlerEnd = source.indexOf("function activateSqlPlayground", handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);
  const helperStart = source.indexOf("function openGeneratedSqlPlaygroundQuery");
  const helperEnd = source.indexOf("function handleOpenSqlExplorerQuery", helperStart);
  const helper = source.slice(helperStart, helperEnd);

  assert.match(handler, /resolveSqlPlaygroundSchema/);
  assert.match(handler, /resolveSqlFileDatabaseName/);
  assert.match(handler, /reverseSqlToDiagram/);
  assert.match(handler, /generateLogicalSql/);
  assert.match(handler, /requestPromptDialog/);
  assert.match(handler, /createDatabase:\s*true/);
  assert.match(handler, /file\.content,\s*false/);
  assert.match(handler, /noSchemaWarning/);
  assert.match(handler, /ambiguousSchemaWarning/);
  assert.doesNotMatch(handler, /Object\.values\([^)]*\)\[0\]|Object\.keys\([^)]*\)\[0\]/);
  assert.match(helper, /createSqlPlaygroundSessionState/);
  assert.match(helper, /manager\.setSessionState\(seeded\)/);
  assert.match(helper, /activateSqlPlayground/);
  assert.match(helper, /execute/);
});

function table(id: string, name: string, columns: LogicalColumn[]): LogicalTable {
  return { id, name, kind: "entity", columns, x: 0, y: 0, width: 220, height: 120 };
}

function sqliteCoverageModel(): LogicalModel {
  return {
    meta: { name: "SQLite coverage", generatedAt: "2026-07-19T00:00:00.000Z", sourceDiagramVersion: 1, sourceSignature: "test" },
    tables: [
      table("parent", "parent records", [
        column("parent-a", "key a", { isPrimaryKey: true, isNullable: false, dataType: "INTEGER" }),
        column("parent-b", "key b", { isPrimaryKey: true, isNullable: false, dataType: "INTEGER" }),
        column("parent-name", "select", { isNullable: false, isUnique: true, defaultValue: "'unknown'" }),
      ]),
      table("child", "child", [
        column("child-id", "id", { isPrimaryKey: true, isNullable: false, dataType: "INTEGER" }),
        column("child-a", "parent a", { isForeignKey: true, isNullable: false, dataType: "INTEGER" }),
        column("child-b", "parent b", { isForeignKey: true, isNullable: false, dataType: "INTEGER" }),
        column("optional", "optional value", { isNullable: true }),
      ]),
      { ...table("multivalue", "parent tags", [column("tag-owner", "owner", { isPrimaryKey: true, isNullable: false }), column("tag", "tag", { isPrimaryKey: true, isNullable: false })]), sourceAttributeId: "attribute-tags" },
      { ...table("hierarchy", "employee subtype", [column("employee-id", "id", { isPrimaryKey: true, isNullable: false, dataType: "INTEGER" })]), generatedByDecisionId: "generalization-table-per-type" },
    ],
    foreignKeys: [{
      id: "fk-child-parent",
      name: "fk child parent",
      fromTableId: "child",
      toTableId: "parent",
      mappings: [
        { fromColumnId: "child-a", toColumnId: "parent-a" },
        { fromColumnId: "child-b", toColumnId: "parent-b" },
      ],
      required: true,
      unique: true,
    }],
    uniqueConstraints: [{ id: "uq-parent-name", tableId: "parent", columnIds: ["parent-name"] }],
    edges: [],
    issues: [],
  };
}

test("SQL playground session ids, checksums and stale status are deterministic", () => {
  assert.equal(buildSqlPlaygroundSessionId("project", "schema"), "project:schema");
  assert.equal(hashSqlSchema("SELECT 1;\r\n"), hashSqlSchema("SELECT 1;\n"));
  assert.notEqual(hashSqlSchema("SELECT 1;"), hashSqlSchema("SELECT 2;"));
  assert.equal(getSqlPlaygroundStatus(false, null, "a"), "engine-ready");
  assert.equal(getSqlPlaygroundStatus(true, "a", "a"), "ready");
  assert.equal(getSqlPlaygroundStatus(true, "a", "b"), "stale");
});

test("SQL values distinguish NULL, empty strings, BLOBs, numbers and long text", () => {
  assert.deepEqual(formatSqlResultValue(null), { display: "NULL", fullValue: "NULL", kind: "null", truncated: false });
  assert.equal(formatSqlResultValue(42).kind, "number");
  assert.equal(formatSqlResultValue("").display, "\"\"");
  assert.equal(formatSqlResultValue({ kind: "blob", byteLength: 128 }).display, "[BLOB · 128 byte]");
  const long = formatSqlResultValue("abcdef", 3);
  assert.equal(long.display, "abc…");
  assert.equal(long.fullValue, "abcdef");
  assert.equal(long.truncated, true);
});

test("row limits, multiple result sets and errors remain structured", () => {
  assert.deepEqual(limitSqlRows([1, 2, 3], 2), { rows: [1, 2], truncated: true });
  assert.equal(countSqlResultSets([
    { statementIndex: 0, sql: "select 1", kind: "rows", columns: ["1"], rows: [[1]], rowCount: 1, truncated: false, changes: 0, durationMs: 1 },
    { statementIndex: 1, sql: "update t", kind: "changes", columns: [], rows: [], rowCount: 0, truncated: false, changes: 1, durationMs: 1 },
  ]), 1);
  assert.deepEqual(normalizeSqlPlaygroundError("execute", new Error("syntax error")), {
    operation: "execute",
    message: "syntax error",
    recoverable: true,
  });
});

test("SQLite download names are safe and object URLs are always revoked", () => {
  assert.equal(createSqliteDownloadName("Università.erschema"), "universita.sqlite");
  let clicked = false;
  let removed = false;
  let revoked = "";
  const anchor = {
    href: "",
    download: "",
    hidden: false,
    click: () => { clicked = true; },
    remove: () => { removed = true; },
  };
  const fakeDocument = {
    createElement: () => anchor,
    body: { appendChild: () => undefined },
  } as unknown as Document;
  const fileName = downloadSqliteDatabase(new ArrayBuffer(4), "My schema.erschema", {
    documentRef: fakeDocument,
    urlApi: {
      createObjectURL: () => "blob:test",
      revokeObjectURL: (url) => { revoked = url; },
    },
  });
  assert.equal(fileName, "my-schema.sqlite");
  assert.equal(anchor.download, fileName);
  assert.equal(clicked, true);
  assert.equal(removed, true);
  assert.equal(revoked, "blob:test");
});

test("generated quoted SQLite schema executes composite PK/FK, UNIQUE, nullable and defaults", async () => {
  const sqlite = await sqlite3InitModule();
  const database = new sqlite.oo1.DB(":memory:");
  try {
    const sql = generateLogicalSql(sqliteCoverageModel(), { dialect: "sqlite", quoteIdentifiers: true });
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(sql);
    database.exec(`INSERT INTO "parent records" ("key a", "key b") VALUES (1, 2);`);
    database.exec(`INSERT INTO "child" ("id", "parent a", "parent b", "optional value") VALUES (10, 1, 2, NULL);`);
    const rows = database.exec({ sql: `SELECT "select" FROM "parent records";`, rowMode: "array", returnValue: "resultRows" });
    assert.deepEqual(rows, [["unknown"]]);
    assert.throws(
      () => database.exec(`INSERT INTO "child" ("id", "parent a", "parent b") VALUES (11, 9, 9);`),
      /FOREIGN KEY constraint failed/i,
    );
    assert.match(sql, /PRIMARY KEY \("key a", "key b"\)/);
    assert.match(sql, /UNIQUE \("parent a", "parent b"\)/);
    assert.match(sql, /CREATE TABLE "parent tags"/);
    assert.match(sql, /CREATE TABLE "employee subtype"/);
  } finally {
    database.close();
  }
});

test("worker protocol keeps SQLite off the React thread and finalizes statements", () => {
  const worker = readFileSync(new URL("../src/features/sql-playground/sqlite.worker.ts", import.meta.url), "utf8");
  const manager = readFileSync(new URL("../src/features/sql-playground/SqlPlaygroundManager.ts", import.meta.url), "utf8");
  assert.match(worker, /sqlite3_complete/);
  assert.match(worker, /statement\?\.finalize\(\)/);
  assert.match(worker, /new sqliteApi\.oo1\.DB\(":memory:"\)/);
  assert.match(worker, /populationPlans\.delete\(request\.sessionId\)/);
  assert.match(worker, /applySqlPopulationPlan/);
  assert.match(manager, /planPopulation/);
  assert.match(manager, /applyPopulation/);
  assert.match(manager, /new Worker\(new URL\("\.\/sqlite\.worker\.ts", import\.meta\.url\)/);
  assert.doesNotMatch(manager, /@sqlite\.org\/sqlite-wasm/);
});

test("worker protocol rejects unexpected and incomplete responses", () => {
  assert.equal(isSqlPlaygroundResponse({ requestId: "1", type: "schema-inspected", metadata: { databases: [] }, sessionId: "p:s" }), true);
  assert.equal(isSqlPlaygroundResponse({ requestId: "1", type: "schema-inspected", metadata: null, sessionId: "p:s" }), false);
  assert.equal(isSqlPlaygroundResponse({ requestId: "1", type: "execution-complete", results: [] }), false);
  assert.equal(isSqlPlaygroundResponse({
    requestId: "1",
    type: "population-planned",
    planId: "population-1",
    sessionId: "p:s",
    seed: 42,
    rowsPerTable: 20,
    schemaSignature: "main:1",
    tableCount: 1,
    totalRows: 20,
    tables: [{ tableName: "sample", requestedRows: 20, generatedRows: 20 }],
    warnings: [],
    previewSql: "BEGIN IMMEDIATE; COMMIT;",
  }), true);
  assert.equal(isSqlPlaygroundResponse({ requestId: "1", type: "population-planned", sessionId: "p:s" }), false);
  assert.equal(isSqlPlaygroundResponse({ requestId: "1", type: "population-applied", sessionId: "p:s", rowsInserted: 20, tableCount: 1 }), false);
  assert.equal(isSqlPlaygroundResponse({ requestId: "1", type: "population-applied", sessionId: "p:s", planId: "population-1", rowsInserted: 20, tableCount: 1 }), true);
  assert.equal(isSqlPlaygroundRequest({ requestId: "1", type: "plan-population", sessionId: "p:s", rowsPerTable: 20, seed: 42 }), true);
  assert.equal(isSqlPlaygroundRequest({ requestId: "1", type: "plan-population", rowsPerTable: 20, seed: 42 }), false);
  assert.equal(isSqlPlaygroundRequest({ requestId: "1", type: "apply-population", sessionId: "p:s", planId: "population-1" }), true);
  assert.equal(isSqlPlaygroundRequest({ requestId: "1", type: "apply-population", sessionId: "p:s" }), false);
  assert.equal(isSqlPlaygroundResponse({ requestId: "1", type: "unknown" }), false);
});

test("manager isolates temporary session state and closes the worker cleanly", async () => {
  const originalWorker = Object.getOwnPropertyDescriptor(globalThis, "Worker");
  const requests: SqlPlaygroundRequest[] = [];
  let terminated = false;

  class FakeWorker {
    onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
    onerror: ((event: ErrorEvent) => void) | null = null;

    postMessage(request: SqlPlaygroundRequest): void {
      requests.push(request);
      let response: SqlPlaygroundResponse;
      switch (request.type) {
        case "initialize":
          response = { requestId: request.requestId, type: "initialized", sqliteVersion: "3.test" };
          break;
        case "create-schema":
        case "reset":
          response = { requestId: request.requestId, type: "schema-ready", sessionId: request.sessionId, schemaChecksum: request.schemaChecksum };
          break;
        case "execute":
          response = { requestId: request.requestId, type: "execution-complete", sessionId: request.sessionId, results: [], databaseChanged: true, schemaChanged: true, durationMs: 1 };
          break;
        case "inspect-schema":
          response = { requestId: request.requestId, type: "schema-inspected", sessionId: request.sessionId, metadata: { databases: [] } };
          break;
        case "plan-population":
          response = {
            requestId: request.requestId,
            type: "population-planned",
            planId: `population-${request.sessionId}`,
            sessionId: request.sessionId,
            seed: request.seed,
            rowsPerTable: request.rowsPerTable,
            schemaSignature: "main:1",
            tableCount: 1,
            totalRows: request.rowsPerTable,
            tables: [{ tableName: "sample", requestedRows: request.rowsPerTable, generatedRows: request.rowsPerTable }],
            warnings: [],
            previewSql: "BEGIN IMMEDIATE; COMMIT;",
          };
          break;
        case "apply-population":
          response = {
            requestId: request.requestId,
            type: "population-applied",
            planId: request.planId,
            sessionId: request.sessionId,
            tableCount: 1,
            rowsInserted: 20,
          };
          break;
        case "export":
          response = { requestId: request.requestId, type: "export-complete", sessionId: request.sessionId, bytes: new ArrayBuffer(8) };
          break;
        case "close-session":
          response = { requestId: request.requestId, type: "session-closed", sessionId: request.sessionId };
          break;
        case "dispose":
          response = { requestId: request.requestId, type: "disposed" };
          break;
      }
      queueMicrotask(() => this.onmessage?.({ data: response } as MessageEvent<unknown>));
    }

    terminate(): void {
      terminated = true;
    }
  }

  Object.defineProperty(globalThis, "Worker", { configurable: true, value: FakeWorker });
  try {
    const manager = new SqlPlaygroundManager();
    const first = createSqlPlaygroundSessionState({ sessionId: "project:first", schemaFileId: "first", schemaName: "First", currentGeneratedChecksum: "a" });
    const second = createSqlPlaygroundSessionState({ sessionId: "project:second", schemaFileId: "second", schemaName: "Second", currentGeneratedChecksum: "b" });
    manager.setSessionState(first);
    manager.setSessionState(second);
    assert.equal(manager.getSessionState("project:first")?.schemaName, "First");
    assert.equal(manager.getSessionState("project:second")?.schemaName, "Second");

    assert.equal(await manager.initialize(), "3.test");
    assert.equal(await manager.initialize(), "3.test");
    assert.equal(requests.filter((request) => request.type === "initialize").length, 1);
    await manager.createSchema("project:first", "CREATE TABLE t(id);", "a", false);
    const events: string[] = [];
    const unsubscribe = manager.subscribe((event) => events.push(event.type));
    assert.equal((await manager.execute("project:first", "INSERT INTO t VALUES (1);", 500)).databaseChanged, true);
    assert.deepEqual(await manager.inspectSchema("project:first"), { databases: [] });
    const populationPlan = await manager.planPopulation("project:first", { rowsPerTable: 20, seed: 42 });
    assert.equal(populationPlan.planId, "population-project:first");
    assert.equal((await manager.applyPopulation("project:first", populationPlan.planId)).rowsInserted, 20);
    assert.deepEqual(events, ["execution-complete", "schema-changed", "population-planned", "population-applied"]);
    unsubscribe();
    await manager.execute("project:first", "SELECT 1;", 500);
    assert.deepEqual(events, ["execution-complete", "schema-changed", "population-planned", "population-applied"]);
    assert.equal((await manager.exportDatabase("project:first")).byteLength, 8);
    await manager.closeSession("project:first");
    assert.equal(manager.getSessionState("project:first"), undefined);
    assert.notEqual(manager.getSessionState("project:second"), undefined);
    await manager.dispose();
    assert.equal(manager.getSessionState("project:second"), undefined);
    assert.equal(terminated, true);
    assert.equal(requests.at(-1)?.type, "dispose");
  } finally {
    if (originalWorker) Object.defineProperty(globalThis, "Worker", originalWorker);
    else Reflect.deleteProperty(globalThis, "Worker");
  }
});
