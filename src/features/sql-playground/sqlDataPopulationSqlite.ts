import type { Database, PreparedStatement, SqlValue } from "@sqlite.org/sqlite-wasm";
import { readSqliteSchemaSignature } from "./sqlExplorerIntrospection";
import { quoteSqliteIdentifier } from "./sqliteIdentifier";
import {
  SqlPopulationError,
  type SqlPopulationApplyResult,
  type SqlPopulationPlan,
  type SqlPopulationRowCount,
  type SqlPopulationValue,
} from "./sqlDataPopulationTypes";

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

export function readSqlPopulationRowCounts(
  database: Database,
  tableNames: readonly string[],
): SqlPopulationRowCount[] {
  return [...tableNames]
    .sort((left, right) => left < right ? -1 : left > right ? 1 : 0)
    .map((tableName) => ({
      tableName,
      rowCount: readSingleNumber(database, `SELECT count(*) FROM ${quoteSqliteIdentifier(tableName)};`),
    }));
}

function sameRowCounts(left: readonly SqlPopulationRowCount[], right: readonly SqlPopulationRowCount[]): boolean {
  return left.length === right.length && left.every((entry, index) =>
    entry.tableName === right[index]?.tableName && entry.rowCount === right[index]?.rowCount);
}

function assertPopulationPlanFresh(database: Database, plan: SqlPopulationPlan): void {
  const schemaSignature = readSqliteSchemaSignature(database);
  if (schemaSignature !== plan.schemaSignature) {
    throw new SqlPopulationError(
      "population-schema-stale",
      "The SQLite schema changed after the population preview was created.",
      {},
      `Expected ${plan.schemaSignature}; received ${schemaSignature}.`,
    );
  }
  const currentCounts = readSqlPopulationRowCounts(
    database,
    plan.preconditionRowCounts.map((entry) => entry.tableName),
  );
  if (!sameRowCounts(plan.preconditionRowCounts, currentCounts)) {
    throw new SqlPopulationError(
      "population-plan-stale",
      "The database contents changed after the population preview was created.",
      {},
      `Expected ${JSON.stringify(plan.preconditionRowCounts)}; received ${JSON.stringify(currentCounts)}.`,
    );
  }
}

function asSqlValue(value: SqlPopulationValue): SqlValue {
  return value;
}

function insertPopulationRows(database: Database, plan: SqlPopulationPlan): void {
  const byName = new Map(plan.tableRows.map((table) => [table.tableName, table]));
  plan.tableOrder.forEach((tableName) => {
    const table = byName.get(tableName);
    if (!table || table.rows.length === 0) return;
    if (table.columns.length === 0) {
      table.rows.forEach(() => database.exec(`INSERT INTO ${quoteSqliteIdentifier(table.tableName)} DEFAULT VALUES;`));
      return;
    }
    const placeholders = table.columns.map(() => "?").join(", ");
    const columns = table.columns.map(quoteSqliteIdentifier).join(", ");
    let statement: PreparedStatement | null = null;
    try {
      statement = database.prepare(`INSERT INTO ${quoteSqliteIdentifier(table.tableName)} (${columns}) VALUES (${placeholders});`);
      table.rows.forEach((row) => {
        statement!.bind(row.map(asSqlValue));
        statement!.step();
        statement!.reset(true);
      });
    } finally {
      statement?.finalize();
    }
  });
}

function assertNoForeignKeyViolations(database: Database): void {
  let statement: PreparedStatement | null = null;
  try {
    statement = database.prepare("PRAGMA foreign_key_check;");
    if (statement.step()) {
      const row = statement.get([]).map((value) => String(value ?? "NULL")).join(", ");
      throw new SqlPopulationError(
        "population-foreign-key-check-failed",
        "SQLite reported a foreign key violation in the generated dataset.",
        {},
        row,
      );
    }
  } finally {
    statement?.finalize();
  }
}

export function applySqlPopulationPlan(database: Database, plan: SqlPopulationPlan): SqlPopulationApplyResult {
  database.exec("PRAGMA foreign_keys = ON;");
  if (readSingleNumber(database, "PRAGMA foreign_keys;") !== 1) {
    throw new SqlPopulationError(
      "population-apply-failed",
      "SQLite foreign key enforcement could not be enabled.",
    );
  }
  assertPopulationPlanFresh(database, plan);
  let transactionOpen = false;
  try {
    database.exec("BEGIN IMMEDIATE;");
    transactionOpen = true;
    assertPopulationPlanFresh(database, plan);
    if (plan.usesDeferredForeignKeys) database.exec("PRAGMA defer_foreign_keys = ON;");
    insertPopulationRows(database, plan);
    assertNoForeignKeyViolations(database);
    database.exec("COMMIT;");
    transactionOpen = false;
    return {
      planId: plan.planId,
      sessionId: plan.sessionId,
      tableCount: plan.tableCount,
      rowsInserted: plan.totalRows,
    };
  } catch (error) {
    if (transactionOpen) {
      try {
        database.exec("ROLLBACK;");
      } catch {
        // Preserve the original SQLite failure.
      }
    }
    if (error instanceof SqlPopulationError) throw error;
    throw new SqlPopulationError(
      "population-apply-failed",
      "SQLite rejected the generated dataset. The transaction was rolled back.",
      {},
      error instanceof Error ? error.message : String(error),
    );
  }
}
