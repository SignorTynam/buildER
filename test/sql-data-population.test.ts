import assert from "node:assert/strict";
import test from "node:test";
import sqlite3InitModule, { type Database } from "@sqlite.org/sqlite-wasm";
import {
  createSqlPopulationPreview,
  deterministicPopulationUint,
  enumeratePopulationMixedRadix,
  findPopulationStronglyConnectedComponents,
  formatSqlPopulationLiteral,
  getSqliteAffinity,
  limitSqlPopulationRowsByCapacity,
  parseSqlPopulationRows,
  parseSqlPopulationSeed,
  planSqlPopulation,
} from "../src/features/sql-playground/sqlDataPopulation.ts";
import {
  applySqlPopulationPlan,
  readSqlPopulationRowCounts,
} from "../src/features/sql-playground/sqlDataPopulationSqlite.ts";
import { SqlPopulationError } from "../src/features/sql-playground/sqlDataPopulationTypes.ts";
import { inspectSqliteSchema, readSqliteSchemaSignature } from "../src/features/sql-playground/sqlExplorerIntrospection.ts";
import { quoteSqliteIdentifier } from "../src/features/sql-playground/sqliteIdentifier.ts";

function tableNames(database: Database): string[] {
  const metadata = inspectSqliteSchema(database);
  return metadata.databases.find((entry) => entry.name === "main")?.tables
    .filter((table) => !table.virtual)
    .map((table) => table.name) ?? [];
}

function createPlan(database: Database, rowsPerTable = 5, seed = 42, sessionId = "project:schema") {
  return planSqlPopulation({
    sessionId,
    config: { rowsPerTable, seed },
    metadata: inspectSqliteSchema(database),
    schemaSignature: readSqliteSchemaSignature(database),
    rowCounts: readSqlPopulationRowCounts(database, tableNames(database)),
  });
}

function queryRows(database: Database, sql: string): unknown[][] {
  return database.exec({ sql, rowMode: "array", returnValue: "resultRows" }) as unknown[][];
}

function assertPopulationCode(action: () => unknown, code: SqlPopulationError["code"]): void {
  assert.throws(action, (error: unknown) => error instanceof SqlPopulationError && error.code === code);
}

test("SQLite affinity, config parsing, and deterministic sub-seeds cover declared types", () => {
  const cases = new Map([
    ["INTEGER", "INTEGER"],
    ["INT", "INTEGER"],
    ["VARCHAR(80)", "TEXT"],
    ["TEXT", "TEXT"],
    ["CLOB", "TEXT"],
    ["REAL", "REAL"],
    ["FLOAT", "REAL"],
    ["DOUBLE", "REAL"],
    ["BLOB", "BLOB"],
    ["", "BLOB"],
    ["NUMERIC", "NUMERIC"],
    ["BOOLEAN", "NUMERIC"],
    ["DATE", "NUMERIC"],
    ["DATETIME", "NUMERIC"],
  ]);
  cases.forEach((expected, declared) => assert.equal(getSqliteAffinity(declared), expected));
  assert.equal(parseSqlPopulationRows("20"), 20);
  assert.equal(parseSqlPopulationRows(""), null);
  assert.equal(parseSqlPopulationRows("1.5"), null);
  assert.equal(parseSqlPopulationRows("0"), null);
  assert.equal(parseSqlPopulationRows("101"), null);
  assert.equal(parseSqlPopulationSeed("0"), 0);
  assert.equal(parseSqlPopulationSeed("4294967295"), 0xffff_ffff);
  assert.equal(parseSqlPopulationSeed("-1"), null);
  assert.equal(parseSqlPopulationSeed("4294967296"), null);
  assert.equal(deterministicPopulationUint(42, "table", "column", 1), deterministicPopulationUint(42, "table", "column", 1));
  assert.notEqual(deterministicPopulationUint(42, "table", "column", 1), deterministicPopulationUint(43, "table", "column", 1));
});

test("SCC and mixed-radix enumeration are stable and capacity-bounded", () => {
  const dependencies = new Map<string, string[]>([
    ["A", ["B"]],
    ["B", ["C"]],
    ["C", ["A"]],
    ["D", ["D"]],
  ]);
  assert.deepEqual(findPopulationStronglyConnectedComponents(["D", "C", "B", "A"], dependencies), [["A", "B", "C"], ["D"]]);
  const combinations = enumeratePopulationMixedRadix([3, 2], 10);
  assert.deepEqual(combinations, [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1]]);
  assert.equal(new Set(combinations.map((tuple) => tuple.join(":"))).size, 6);
  assert.deepEqual(limitSqlPopulationRowsByCapacity("junction", 10, combinations.length), {
    generatedRows: 6,
    warning: {
      code: "population-row-limit",
      tableName: "junction",
      messageContext: { requestedRows: 10, generatedRows: 6 },
    },
  });
});

test("preview quoting covers identifiers, apostrophes, NULL, numbers, and BLOB values", () => {
  assert.equal(quoteSqliteIdentifier('odd"name'), '"odd""name"');
  assert.equal(formatSqlPopulationLiteral(null), "NULL");
  assert.equal(formatSqlPopulationLiteral(12.5), "12.5");
  assert.equal(formatSqlPopulationLiteral("O'Reilly"), "'O''Reilly'");
  assert.equal(formatSqlPopulationLiteral(new Uint8Array([1, 2, 255])), "X'0102FF'");
  const preview = createSqlPopulationPreview([{
    tableName: 'odd"name',
    columns: ["value"],
    rows: [["O'Reilly"]],
  }], ['odd"name'], true);
  assert.match(preview, /PRAGMA foreign_keys = ON;/);
  assert.match(preview, /BEGIN IMMEDIATE;/);
  assert.match(preview, /PRAGMA defer_foreign_keys = ON;/);
  assert.match(preview, /INSERT INTO "odd""name"/);
  assert.match(preview, /'O''Reilly'/);
  assert.match(preview, /PRAGMA foreign_key_check;/);
  assert.match(preview, /COMMIT;/);
});

test("same schema and config produces an identical plan while a different seed changes values", async () => {
  const sqlite = await sqlite3InitModule();
  const database = new sqlite.oo1.DB(":memory:");
  try {
    database.exec(`CREATE TABLE sample(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email VARCHAR(120) UNIQUE NOT NULL,
      active BOOLEAN NOT NULL,
      created_at DATETIME NOT NULL,
      payload JSON,
      bytes BLOB
    );`);
    const first = createPlan(database, 20, 42);
    const second = createPlan(database, 20, 42);
    const changed = createPlan(database, 20, 43);
    assert.deepEqual(first, second);
    assert.equal(first.planId, second.planId);
    assert.equal(first.previewSql, second.previewSql);
    assert.notEqual(first.previewSql, changed.previewSql);
    assert.doesNotMatch(first.previewSql, /Math\.random/);
  } finally {
    database.close();
  }
});

test("real SQLite population supports PK, AUTOINCREMENT, composite FK, defaults, generated columns, self FK, and no-PK tables", async () => {
  const sqlite = await sqlite3InitModule();
  const database = new sqlite.oo1.DB(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(`
      CREATE TABLE parent(
        a INTEGER,
        b INTEGER,
        name TEXT NOT NULL UNIQUE,
        created TEXT NOT NULL DEFAULT 'from-default',
        PRIMARY KEY(a, b)
      );
      CREATE TABLE child(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pa INTEGER NOT NULL,
        pb INTEGER NOT NULL,
        note TEXT,
        FOREIGN KEY(pa, pb) REFERENCES parent(a, b)
      );
      CREATE TABLE employee(
        id INTEGER PRIMARY KEY,
        manager_id INTEGER REFERENCES employee(id),
        name TEXT NOT NULL
      );
      CREATE TABLE generated_value(
        id INTEGER PRIMARY KEY,
        source TEXT NOT NULL,
        doubled TEXT GENERATED ALWAYS AS (source || source) STORED
      );
      CREATE TABLE log_entry(message TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE text_key(code TEXT PRIMARY KEY, label TEXT NOT NULL);
      CREATE TABLE composite_unique(id INTEGER PRIMARY KEY, part_a TEXT NOT NULL, part_b INTEGER NOT NULL, UNIQUE(part_a, part_b));
    `);
    const plan = createPlan(database, 6, 42);
    const childPlan = plan.tableRows.find((table) => table.tableName === "child");
    const generatedPlan = plan.tableRows.find((table) => table.tableName === "generated_value");
    const parentPlan = plan.tableRows.find((table) => table.tableName === "parent");
    assert.deepEqual(childPlan?.columns, ["id", "pa", "pb", "note"]);
    assert.deepEqual(generatedPlan?.columns, ["id", "source"]);
    assert.equal(parentPlan?.columns.includes("created"), false);
    assert.equal(plan.usesDeferredForeignKeys, true);

    const applied = applySqlPopulationPlan(database, plan);
    assert.equal(applied.rowsInserted, 42);
    assert.deepEqual(queryRows(database, "PRAGMA foreign_key_check;"), []);
    assert.deepEqual(queryRows(database, "SELECT COUNT(*) FROM parent;"), [[6]]);
    assert.deepEqual(queryRows(database, "SELECT COUNT(*) FROM child;"), [[6]]);
    assert.deepEqual(queryRows(database, "SELECT COUNT(*) FROM employee WHERE manager_id IS NULL;"), [[1]]);
    assert.deepEqual(queryRows(database, "SELECT COUNT(*) FROM parent WHERE created = 'from-default';"), [[6]]);
    assert.deepEqual(queryRows(database, "SELECT COUNT(*) FROM generated_value WHERE doubled = source || source;"), [[6]]);
    assert.deepEqual(queryRows(database, "SELECT COUNT(*) FROM log_entry;"), [[6]]);
    assert.deepEqual(queryRows(database, "SELECT COUNT(DISTINCT code) FROM text_key;"), [[6]]);
    assert.deepEqual(queryRows(database, "SELECT COUNT(*) FROM (SELECT part_a, part_b FROM composite_unique GROUP BY part_a, part_b);"), [[6]]);
  } finally {
    database.close();
  }
});

test("foreign keys resolve implicit target PKs and named UNIQUE targets", async () => {
  const sqlite = await sqlite3InitModule();
  const database = new sqlite.oo1.DB(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(`
      CREATE TABLE parent(a INTEGER, b TEXT, external_code TEXT UNIQUE, PRIMARY KEY(a, b));
      CREATE TABLE implicit_child(id INTEGER PRIMARY KEY, pa INTEGER, pb TEXT, FOREIGN KEY(pa, pb) REFERENCES parent);
      CREATE TABLE unique_child(id INTEGER PRIMARY KEY, parent_code TEXT NOT NULL UNIQUE REFERENCES parent(external_code));
    `);
    const metadata = inspectSqliteSchema(database);
    const implicit = metadata.databases[0].tables.find((table) => table.name === "implicit_child");
    assert.equal(implicit?.foreignKeys.every((foreignKey) => foreignKey.toColumn === null), true);
    const plan = createPlan(database, 5, 9);
    applySqlPopulationPlan(database, plan);
    assert.deepEqual(queryRows(database, "PRAGMA foreign_key_check;"), []);
    assert.deepEqual(queryRows(database, "SELECT COUNT(DISTINCT parent_code) FROM unique_child;"), [[5]]);
  } finally {
    database.close();
  }
});

test("junction enumeration and one-to-one UNIQUE foreign keys do not reuse constrained tuples", async () => {
  const sqlite = await sqlite3InitModule();
  const database = new sqlite.oo1.DB(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(`
      CREATE TABLE left_parent(id INTEGER PRIMARY KEY);
      CREATE TABLE right_parent(id INTEGER PRIMARY KEY);
      CREATE TABLE junction(
        left_id INTEGER NOT NULL REFERENCES left_parent(id),
        right_id INTEGER NOT NULL REFERENCES right_parent(id),
        PRIMARY KEY(left_id, right_id)
      );
      CREATE TABLE profile(
        id INTEGER PRIMARY KEY,
        left_id INTEGER NOT NULL UNIQUE REFERENCES left_parent(id)
      );
    `);
    const plan = createPlan(database, 5, 42);
    applySqlPopulationPlan(database, plan);
    assert.deepEqual(queryRows(database, "SELECT COUNT(*) FROM junction;"), [[5]]);
    assert.deepEqual(queryRows(database, "SELECT COUNT(*) FROM (SELECT left_id, right_id FROM junction GROUP BY left_id, right_id);"), [[5]]);
    assert.deepEqual(queryRows(database, "SELECT COUNT(DISTINCT left_id) FROM profile;"), [[5]]);
  } finally {
    database.close();
  }
});

test("cyclic A-B-C foreign keys commit with deferred enforcement and deterministic key pools", async () => {
  const sqlite = await sqlite3InitModule();
  const database = new sqlite.oo1.DB(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(`
      CREATE TABLE A(id INTEGER PRIMARY KEY, b_id INTEGER NOT NULL REFERENCES B(id));
      CREATE TABLE B(id INTEGER PRIMARY KEY, c_id INTEGER NOT NULL REFERENCES C(id));
      CREATE TABLE C(id INTEGER PRIMARY KEY, a_id INTEGER NOT NULL REFERENCES A(id));
    `);
    const plan = createPlan(database, 4, 42);
    assert.equal(plan.usesDeferredForeignKeys, true);
    assert.match(plan.previewSql, /PRAGMA defer_foreign_keys = ON/);
    applySqlPopulationPlan(database, plan);
    assert.deepEqual(queryRows(database, "PRAGMA foreign_key_check;"), []);
    assert.deepEqual(queryRows(database, "SELECT (SELECT COUNT(*) FROM A), (SELECT COUNT(*) FROM B), (SELECT COUNT(*) FROM C);"), [[4, 4, 4]]);
  } finally {
    database.close();
  }
});

test("a two-table A-B cycle commits without disabling foreign keys", async () => {
  const sqlite = await sqlite3InitModule();
  const database = new sqlite.oo1.DB(":memory:");
  try {
    database.exec("PRAGMA foreign_keys = ON;");
    database.exec(`
      CREATE TABLE pair_a(id INTEGER PRIMARY KEY, b_id INTEGER NOT NULL REFERENCES pair_b(id));
      CREATE TABLE pair_b(id INTEGER PRIMARY KEY, a_id INTEGER NOT NULL REFERENCES pair_a(id));
    `);
    const plan = createPlan(database, 3, 42);
    applySqlPopulationPlan(database, plan);
    assert.deepEqual(queryRows(database, "PRAGMA foreign_key_check;"), []);
    assert.deepEqual(queryRows(database, "PRAGMA foreign_keys;"), [[1]]);
  } finally {
    database.close();
  }
});

test("population rejects non-empty data and stale schema or row-count preconditions", async () => {
  const sqlite = await sqlite3InitModule();
  const database = new sqlite.oo1.DB(":memory:");
  try {
    database.exec("CREATE TABLE item(id INTEGER PRIMARY KEY, name TEXT NOT NULL);");
    const staleDataPlan = createPlan(database, 3, 42);
    database.exec("INSERT INTO item(id, name) VALUES (1, 'manual');");
    assertPopulationCode(() => applySqlPopulationPlan(database, staleDataPlan), "population-plan-stale");
    assertPopulationCode(() => createPlan(database, 3, 42), "population-database-not-empty");
    assert.deepEqual(queryRows(database, "SELECT name FROM item;"), [["manual"]]);

    database.exec("DELETE FROM item;");
    const staleSchemaPlan = createPlan(database, 3, 42);
    database.exec("ALTER TABLE item ADD COLUMN note TEXT;");
    assertPopulationCode(() => applySqlPopulationPlan(database, staleSchemaPlan), "population-schema-stale");
    assert.deepEqual(queryRows(database, "SELECT COUNT(*) FROM item;"), [[0]]);
  } finally {
    database.close();
  }
});

test("a trigger failure rolls back every prepared INSERT in the population batch", async () => {
  const sqlite = await sqlite3InitModule();
  const database = new sqlite.oo1.DB(":memory:");
  try {
    database.exec(`
      CREATE TABLE guarded(id INTEGER PRIMARY KEY, value TEXT NOT NULL);
      CREATE TRIGGER block_second BEFORE INSERT ON guarded
      WHEN (SELECT count(*) FROM guarded) = 1
      BEGIN
        SELECT RAISE(ABORT, 'blocked by test trigger');
      END;
    `);
    const plan = createPlan(database, 4, 42);
    assertPopulationCode(() => applySqlPopulationPlan(database, plan), "population-apply-failed");
    assert.deepEqual(queryRows(database, "SELECT COUNT(*) FROM guarded;"), [[0]]);
  } finally {
    database.close();
  }
});

test("executing preview SQL is equivalent to applying its structured plan", async () => {
  const sqlite = await sqlite3InitModule();
  const structuredDatabase = new sqlite.oo1.DB(":memory:");
  const previewDatabase = new sqlite.oo1.DB(":memory:");
  const schema = `
    CREATE TABLE author(id INTEGER PRIMARY KEY, email TEXT NOT NULL UNIQUE);
    CREATE TABLE book(id INTEGER PRIMARY KEY, author_id INTEGER NOT NULL REFERENCES author(id), title TEXT NOT NULL);
  `;
  try {
    structuredDatabase.exec(schema);
    previewDatabase.exec(schema);
    const plan = createPlan(structuredDatabase, 5, 77);
    applySqlPopulationPlan(structuredDatabase, plan);
    previewDatabase.exec(plan.previewSql);
    const sql = "SELECT book.id, author.email, book.title FROM book JOIN author ON author.id = book.author_id ORDER BY book.id;";
    assert.deepEqual(queryRows(previewDatabase, sql), queryRows(structuredDatabase, sql));
    assert.deepEqual(queryRows(previewDatabase, "PRAGMA foreign_key_check;"), []);
  } finally {
    structuredDatabase.close();
    previewDatabase.close();
  }
});

test("unsupported unique indexes, generated keys, and unresolved implicit targets fail explicitly", async () => {
  const sqlite = await sqlite3InitModule();
  const cases: Array<{ schema: string; code: SqlPopulationError["code"] }> = [
    {
      schema: "CREATE TABLE t(id INTEGER PRIMARY KEY, email TEXT, active INTEGER); CREATE UNIQUE INDEX uq_partial ON t(email) WHERE active = 1;",
      code: "population-unsupported-unique-index",
    },
    {
      schema: "CREATE TABLE t(id INTEGER PRIMARY KEY, email TEXT); CREATE UNIQUE INDEX uq_expression ON t(lower(email));",
      code: "population-unsupported-unique-index",
    },
    {
      schema: "CREATE TABLE t(source TEXT, generated TEXT GENERATED ALWAYS AS (lower(source)) STORED UNIQUE);",
      code: "population-unsupported-generated-key",
    },
    {
      schema: "CREATE TABLE parent(value TEXT); CREATE TABLE child(value TEXT REFERENCES parent);",
      code: "population-unresolved-foreign-key",
    },
    {
      schema: "CREATE TABLE parent(value TEXT); CREATE TABLE child(value TEXT REFERENCES parent(value));",
      code: "population-invalid-foreign-key-target",
    },
  ];
  for (const entry of cases) {
    const database = new sqlite.oo1.DB(":memory:");
    try {
      database.exec(entry.schema);
      assertPopulationCode(() => createPlan(database, 3, 42), entry.code);
    } finally {
      database.close();
    }
  }
});
