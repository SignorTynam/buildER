import type {
  SqlColumnDefinition,
  SqlDataTypeDefinition,
  SqlForeignKeyDefinition,
  SqlReverseIssue,
  SqlSchemaModel,
  SqlTableDefinition,
  SqlUniqueConstraintDefinition,
} from "../../../types/sqlReverse";
import { autoLayoutLogicalModel } from "../../../utils/logicalLayout";
import { convertLogicalModelToDiagram } from "../../../utils/sqlReverseDiagram";
import { convertSqlSchemaToLogicalModel } from "../../../utils/sqlReverseLogical";
import type {
  SqliteReverseAnalysisResult,
  SqliteReverseOptions,
  SqliteUnconvertedDefinition,
} from "../databaseWorkspaceTypes";
import type {
  SqlExplorerDatabase,
  SqlExplorerForeignKey,
  SqlExplorerIndex,
  SqlExplorerMetadata,
  SqlExplorerTable,
} from "../../sql-playground/sqlExplorerTypes";
import { resolveSqliteForeignKeyGroups } from "../../sql-playground/sqliteMetadataNormalization";

export function getSqliteTableId(databaseName: string, tableName: string): string {
  return `sqlite-table:${encodeURIComponent(databaseName)}:${encodeURIComponent(tableName)}`;
}

function identifier(name: string) {
  return { name, rawName: name, quoted: false as const };
}

function dataType(raw: string): SqlDataTypeDefinition | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const match = value.match(/^([^()]+?)(?:\(([^)]*)\))?$/);
  const name = (match?.[1] ?? value).trim();
  const args = (match?.[2] ?? "")
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isFinite(part));
  return { raw: value, name, normalizedName: name.toUpperCase(), args };
}

function issue(
  id: string,
  message: string,
  tableId?: string,
  code: SqlReverseIssue["code"] = "PARSER_RECOVERY",
): SqlReverseIssue {
  return { id, level: "warning", code, message, tableId };
}

function buildForeignKey(
  metadata: SqlExplorerMetadata,
  database: SqlExplorerDatabase,
  table: SqlExplorerTable,
  tableId: string,
  rows: SqlExplorerForeignKey[],
  issues: SqlReverseIssue[],
): SqlForeignKeyDefinition {
  const first = rows[0];
  const resolved = resolveSqliteForeignKeyGroups(metadata, database.name, rows)[0];
  const toColumnNames = resolved.mappings.map((mapping) => mapping.toColumn ?? "");
  if (toColumnNames.some((name) => !name)) {
    issues.push(issue(
      `sqlite-fk-unresolved-${tableId}-${first.id}`,
      `Foreign key ${table.name} → ${first.toTable} has an unresolved target column.`,
      tableId,
      "UNRESOLVED_REFERENCE",
    ));
  }
  return {
    id: `sqlite-fk-${tableId}-${first.id}`,
    fromTableId: tableId,
    fromColumnNames: rows.map((row) => row.fromColumn),
    toTableName: first.toTable,
    toSchemaName: database.name,
    toColumnNames: toColumnNames.filter(Boolean),
    onUpdate: first.onUpdate,
    onDelete: first.onDelete,
  };
}

function isConvertibleUnique(index: SqlExplorerIndex): boolean {
  return index.unique
    && index.origin !== "pk"
    && !index.partial
    && index.expressionColumns.length === 0
    && index.columns.length > 0;
}

function buildUnique(index: SqlExplorerIndex, tableId: string): SqlUniqueConstraintDefinition {
  return {
    id: `sqlite-unique-${tableId}-${encodeURIComponent(index.name)}`,
    name: index.name,
    tableId,
    columnNames: index.columns,
    raw: index.sql ?? undefined,
  };
}

function buildTable(
  metadata: SqlExplorerMetadata,
  database: SqlExplorerDatabase,
  table: SqlExplorerTable,
  issues: SqlReverseIssue[],
): SqlTableDefinition {
  const tableId = getSqliteTableId(database.name, table.name);
  const foreignKeys = resolveSqliteForeignKeyGroups(metadata, database.name, table.foreignKeys).map((group) => {
    const rows = table.foreignKeys.filter((foreignKey) => foreignKey.id === group.id);
    return buildForeignKey(metadata, database, table, tableId, rows, issues);
  });
  const uniqueConstraints = table.indexes.filter(isConvertibleUnique).map((index) => buildUnique(index, tableId));
  const foreignKeyColumns = new Set(foreignKeys.flatMap((foreignKey) => foreignKey.fromColumnNames));
  const singleUniqueColumns = new Set(
    uniqueConstraints.filter((constraint) => constraint.columnNames.length === 1).map((constraint) => constraint.columnNames[0]),
  );
  const columns: SqlColumnDefinition[] = table.columns
    .filter((column) => column.hidden !== 1)
    .map((column) => ({
      id: `sqlite-column-${tableId}-${column.position}`,
      tableId,
      name: column.name,
      rawName: column.name,
      identifier: identifier(column.name),
      dataType: dataType(column.dataType),
      isNullable: column.primaryKeyPosition > 0 ? false : !column.notNull,
      isPrimaryKey: column.primaryKeyPosition > 0,
      isForeignKey: foreignKeyColumns.has(column.name),
      isUnique: singleUniqueColumns.has(column.name),
      isGenerated: column.generated,
      defaultValue: column.defaultValue === null ? undefined : { raw: column.defaultValue, value: column.defaultValue },
      constraints: [],
    }));
  const primaryKeyColumns = table.columns
    .filter((column) => column.primaryKeyPosition > 0)
    .sort((left, right) => left.primaryKeyPosition - right.primaryKeyPosition)
    .map((column) => column.name);
  if (primaryKeyColumns.length === 0) {
    issues.push(issue(
      `sqlite-no-pk-${tableId}`,
      `Table ${table.name} has no primary key and will be converted without an internal identifier.`,
      tableId,
      "INVALID_PRIMARY_KEY",
    ));
  }
  table.indexes.filter((index) => index.unique && !isConvertibleUnique(index)).forEach((index) => {
    issues.push(issue(
      `sqlite-index-warning-${tableId}-${encodeURIComponent(index.name)}`,
      `Index ${index.name} is partial or expression-based and was preserved without being converted to a simple UNIQUE constraint.`,
      tableId,
      "UNSUPPORTED_INDEX",
    ));
  });
  return {
    id: tableId,
    name: table.name,
    rawName: table.name,
    schemaName: database.name,
    identifier: identifier(table.name),
    columns,
    primaryKey: primaryKeyColumns.length > 0 ? {
      id: `sqlite-pk-${tableId}`,
      tableId,
      columnNames: primaryKeyColumns,
    } : undefined,
    foreignKeys,
    uniqueConstraints,
    checkConstraints: [],
    unsupportedConstraints: [],
    rawCreateStatement: table.sql ?? undefined,
  };
}

function collectUnconverted(metadata: SqlExplorerMetadata, selectedIds: ReadonlySet<string>): SqliteUnconvertedDefinition[] {
  return metadata.databases.flatMap((database) => {
    const views = database.views.flatMap((view) => view.sql ? [{
      id: `sqlite-view-${database.name}-${view.name}`,
      databaseName: database.name,
      name: view.name,
      kind: "view" as const,
      sql: view.sql,
      reason: "SQLite views are preserved as SQL definitions.",
    }] : []);
    const triggers = database.triggers.flatMap((trigger) => trigger.sql ? [{
      id: `sqlite-trigger-${database.name}-${trigger.name}`,
      databaseName: database.name,
      name: trigger.name,
      kind: "trigger" as const,
      sql: trigger.sql,
      reason: "SQLite triggers are preserved as SQL definitions.",
    }] : []);
    const indexes = database.indexes.flatMap((index) => {
      const selected = selectedIds.has(getSqliteTableId(database.name, index.tableName));
      if (!selected || !index.sql || (isConvertibleUnique(index) && !index.partial)) return [];
      return [{
        id: `sqlite-index-${database.name}-${index.name}`,
        databaseName: database.name,
        name: index.name,
        kind: "index" as const,
        sql: index.sql,
        reason: "The index cannot be represented as a simple logical UNIQUE constraint.",
      }];
    });
    const virtualTables = database.tables.flatMap((table) => {
      if (!table.virtual || !table.sql) return [];
      return [{
        id: `sqlite-virtual-${database.name}-${table.name}`,
        databaseName: database.name,
        name: table.name,
        kind: "virtual-table" as const,
        sql: table.sql,
        reason: "Virtual tables require an SQLite module and are not converted to entities.",
      }];
    });
    return [...views, ...triggers, ...indexes, ...virtualTables];
  });
}

export function convertSqliteMetadataToSqlSchemaModel(
  metadata: SqlExplorerMetadata,
  options: SqliteReverseOptions,
  sourceName = "Imported SQLite database",
): { model: SqlSchemaModel; issues: SqlReverseIssue[]; unconvertedDefinitions: SqliteUnconvertedDefinition[] } {
  const selectedIds = new Set(options.selectedTableIds);
  const issues: SqlReverseIssue[] = [];
  const tables = metadata.databases.flatMap((database) => database.tables
    .filter((table) => selectedIds.has(getSqliteTableId(database.name, table.name)))
    .filter((table) => !table.virtual)
    .map((table) => buildTable(metadata, database, table, issues)));
  const selectedTableNames = new Set(tables.map((table) => `${table.schemaName ?? "main"}.${table.name}`.toLocaleLowerCase()));
  tables.forEach((table) => table.foreignKeys.forEach((foreignKey) => {
    const target = `${foreignKey.toSchemaName ?? "main"}.${foreignKey.toTableName}`.toLocaleLowerCase();
    if (!selectedTableNames.has(target)) {
      issues.push(issue(
        `sqlite-unselected-fk-${foreignKey.id}`,
        `Foreign key ${foreignKey.id} points to the unselected table ${foreignKey.toTableName}.`,
        table.id,
        "UNRESOLVED_REFERENCE",
      ));
    }
  }));
  const unconvertedDefinitions = collectUnconverted(metadata, selectedIds);
  const sourceSql = [
    ...tables.map((table) => table.rawCreateStatement).filter((sql): sql is string => Boolean(sql)),
    ...unconvertedDefinitions.map((definition) => definition.sql),
  ].join("\n\n");
  const model: SqlSchemaModel = {
    id: `sqlite-schema-${tables.map((table) => table.id).join("-") || "empty"}`,
    dialect: "sqlite",
    sourceName,
    sourceSql,
    tables,
    unsupportedStatements: unconvertedDefinitions.map((definition) => ({
      id: definition.id,
      kind: definition.kind === "view" ? "create-view" : definition.kind === "trigger" ? "create-trigger" : "create-index",
      raw: definition.sql,
      reason: definition.reason,
    })),
    issues,
    meta: {
      generatedAt: new Date().toISOString(),
      tableCount: tables.length,
      statementCount: tables.length + unconvertedDefinitions.length,
      supportedStatementCount: tables.length,
      unsupportedStatementCount: unconvertedDefinitions.length,
    },
  };
  return { model, issues, unconvertedDefinitions };
}

export function buildSqliteReverseAnalysis(input: {
  sessionId: string;
  fileName: string;
  fileSize: number;
  schemaSignature: string;
  metadata: SqlExplorerMetadata;
  options: SqliteReverseOptions;
}): SqliteReverseAnalysisResult {
  const converted = convertSqliteMetadataToSqlSchemaModel(input.metadata, input.options, input.fileName);
  const logical = convertSqlSchemaToLogicalModel(converted.model, {
    dialect: "sqlite",
    sourceName: input.fileName,
    inferManyToManyTables: input.options.inferManyToManyTables,
    keepForeignKeyColumnsAsAttributes: input.options.keepForeignKeyColumnsAsAttributes,
  });
  const logicalModel = autoLayoutLogicalModel(logical.model, {
    direction: "left-right",
    marginX: 220,
    marginY: 180,
    gapX: 460,
    gapY: 280,
  });
  const diagram = convertLogicalModelToDiagram(logicalModel, {
    dialect: "sqlite",
    sourceName: input.fileName,
    inferManyToManyTables: input.options.inferManyToManyTables,
    keepForeignKeyColumnsAsAttributes: input.options.keepForeignKeyColumnsAsAttributes,
  });
  return {
    sessionId: input.sessionId,
    fileName: input.fileName,
    fileSize: input.fileSize,
    schemaSignature: input.schemaSignature,
    metadata: input.metadata,
    selectedTableIds: input.options.selectedTableIds,
    sqlModel: converted.model,
    logicalModel,
    diagram: diagram.diagram,
    issues: converted.issues,
    logicalIssues: diagram.logicalIssues,
    unconvertedDefinitions: converted.unconvertedDefinitions,
  };
}

export function createReverseExtrasSql(result: SqliteReverseAnalysisResult): string {
  return result.unconvertedDefinitions
    .map((definition) => `-- ${definition.kind.toUpperCase()}: ${definition.name}\n-- ${definition.reason}\n${definition.sql.trim().replace(/;?$/, ";")}`)
    .join("\n\n");
}
