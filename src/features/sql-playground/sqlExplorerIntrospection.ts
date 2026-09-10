import type { Database, PreparedStatement, SqlValue } from "@sqlite.org/sqlite-wasm";
import type {
  SqlExplorerColumn,
  SqlExplorerDatabase,
  SqlExplorerForeignKey,
  SqlExplorerIndex,
  SqlExplorerMetadata,
  SqlExplorerTable,
  SqlExplorerTrigger,
  SqlExplorerView,
} from "./sqlExplorerTypes";
import { quoteSqliteIdentifier } from "./sqliteIdentifier";

type SqlRow = SqlValue[];

function asNumber(value: SqlValue | undefined): number {
  return typeof value === "bigint" ? Number(value) : Number(value ?? 0);
}

function asString(value: SqlValue | undefined): string {
  return value == null ? "" : String(value);
}

function asNullableString(value: SqlValue | undefined): string | null {
  return value == null ? null : String(value);
}

export { quoteSqliteIdentifier } from "./sqliteIdentifier";

function queryRows(database: Database, sql: string, bindings: readonly SqlValue[] = []): SqlRow[] {
  let statement: PreparedStatement | null = null;
  try {
    statement = database.prepare(sql);
    if (bindings.length > 0) statement.bind(bindings);
    const rows: SqlRow[] = [];
    while (statement.step()) rows.push(statement.get([]));
    return rows;
  } finally {
    statement?.finalize();
  }
}

function readForeignKeys(database: Database, databaseName: string, tableName: string): SqlExplorerForeignKey[] {
  return queryRows(
    database,
    "SELECT id, seq, \"from\", \"table\", \"to\", on_update, on_delete, match FROM pragma_foreign_key_list(?, ?) ORDER BY id, seq",
    [tableName, databaseName],
  ).map((row) => ({
    id: asNumber(row[0]),
    sequence: asNumber(row[1]),
    fromColumn: asString(row[2]),
    toTable: asString(row[3]),
    toColumn: asNullableString(row[4]),
    onUpdate: asString(row[5]),
    onDelete: asString(row[6]),
    match: asString(row[7]),
  }));
}

function readIndexes(database: Database, databaseName: string, tableName: string): SqlExplorerIndex[] {
  return queryRows(
    database,
    "SELECT name, \"unique\", origin, partial FROM pragma_index_list(?, ?) ORDER BY name",
    [tableName, databaseName],
  ).map((row) => {
    const name = asString(row[0]);
    const indexColumnRows = queryRows(
      database,
      "SELECT seqno, cid, name, \"key\" FROM pragma_index_xinfo(?, ?) WHERE \"key\" = 1 ORDER BY seqno",
      [name, databaseName],
    );
    const columns = indexColumnRows
      .map((columnRow) => asNullableString(columnRow[2]))
      .filter((columnName): columnName is string => columnName !== null);
    const expressionColumns = indexColumnRows
      .filter((columnRow) => asNullableString(columnRow[2]) === null)
      .map((columnRow) => asNumber(columnRow[0]));
    const sql = asNullableString(queryRows(
      database,
      `SELECT sql FROM ${quoteSqliteIdentifier(databaseName)}.sqlite_schema WHERE type = 'index' AND name = ?`,
      [name],
    )[0]?.[0]);
    return {
      name,
      tableName,
      unique: asNumber(row[1]) === 1,
      origin: asString(row[2]),
      partial: asNumber(row[3]) === 1,
      columns,
      expressionColumns,
      sql,
    };
  });
}

function readTable(database: Database, databaseName: string, name: string, sql: string | null): SqlExplorerTable {
  const foreignKeys = readForeignKeys(database, databaseName, name);
  const referencesByColumn = new Map<string, SqlExplorerForeignKey[]>();
  foreignKeys.forEach((foreignKey) => {
    const references = referencesByColumn.get(foreignKey.fromColumn) ?? [];
    references.push(foreignKey);
    referencesByColumn.set(foreignKey.fromColumn, references);
  });
  const columns: SqlExplorerColumn[] = queryRows(
    database,
    "SELECT cid, name, type, \"notnull\", dflt_value, pk, hidden FROM pragma_table_xinfo(?, ?) ORDER BY cid",
    [name, databaseName],
  ).map((row) => {
    const columnName = asString(row[1]);
    const primaryKeyPosition = asNumber(row[5]);
    return {
      position: asNumber(row[0]),
      name: columnName,
      dataType: asString(row[2]),
      notNull: asNumber(row[3]) === 1 || primaryKeyPosition > 0,
      defaultValue: asNullableString(row[4]),
      primaryKeyPosition,
      references: (referencesByColumn.get(columnName) ?? []).map((foreignKey) => ({
        foreignKeyId: foreignKey.id,
        table: foreignKey.toTable,
        column: foreignKey.toColumn,
      })),
      hidden: asNumber(row[6]),
      generated: asNumber(row[6]) === 2 || asNumber(row[6]) === 3,
    };
  });
  return {
    name,
    sql,
    columns,
    foreignKeys,
    indexes: readIndexes(database, databaseName, name),
    virtual: /^\s*CREATE\s+VIRTUAL\s+TABLE\b/i.test(sql ?? ""),
  };
}

function inspectDatabase(database: Database, sequence: number, name: string, file: string): SqlExplorerDatabase {
  const schemaRows = queryRows(
    database,
    `SELECT type, name, tbl_name, sql FROM ${quoteSqliteIdentifier(name)}.sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name`,
  );
  const tables: SqlExplorerTable[] = [];
  const views: SqlExplorerView[] = [];
  const triggers: SqlExplorerTrigger[] = [];

  schemaRows.forEach((row) => {
    const type = asString(row[0]);
    const objectName = asString(row[1]);
    const tableName = asString(row[2]);
    const sql = asNullableString(row[3]);
    if (type === "table") tables.push(readTable(database, name, objectName, sql));
    else if (type === "view") views.push({ name: objectName, sql });
    else if (type === "trigger") triggers.push({ name: objectName, tableName, sql });
  });

  const indexes = tables.flatMap((table) => table.indexes);
  return { sequence, name, file, tables, views, indexes, triggers };
}

export function inspectSqliteSchema(database: Database): SqlExplorerMetadata {
  const databases = queryRows(database, "PRAGMA database_list;").map((row) => ({
    sequence: asNumber(row[0]),
    name: asString(row[1]),
    file: asString(row[2]),
  }));
  return {
    databases: databases.map((entry) => inspectDatabase(database, entry.sequence, entry.name, entry.file)),
  };
}

export function readSqliteSchemaSignature(database: Database): string {
  const databases = queryRows(database, "PRAGMA database_list;").map((row) => asString(row[1]));
  return databases
    .map((name) => {
      const rows = queryRows(database, `PRAGMA ${quoteSqliteIdentifier(name)}.schema_version;`);
      return `${name}:${asNumber(rows[0]?.[0])}`;
    })
    .join("|");
}
