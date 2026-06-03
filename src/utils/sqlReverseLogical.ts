import type {
  LogicalColumn,
  LogicalEdge,
  LogicalForeignKey,
  LogicalIssue,
  LogicalModel,
  LogicalTable,
  LogicalUniqueConstraint,
} from "../types/logical";
import {
  DEFAULT_SQL_REVERSE_OPTIONS,
  type SqlColumnDefinition,
  type SqlForeignKeyDefinition,
  type SqlReverseIssue,
  type SqlReverseOptions,
  type SqlSchemaModel,
  type SqlTableDefinition,
  type SqlUniqueConstraintDefinition,
} from "../types/sqlReverse";
import { parseSqlSchema } from "./sqlReverseParser";

export interface SqlReverseLogicalResult {
  model: LogicalModel;
  sqlModel: SqlSchemaModel;
  issues: SqlReverseIssue[];
}

interface NormalizedSqlDataType {
  dataType?: string;
  length: number | null;
  precision: number | null;
  scale: number | null;
}

interface ConversionContext {
  sqlModel: SqlSchemaModel;
  tableBySqlId: Map<string, LogicalTable>;
  tableBySqlName: Map<string, LogicalTable>;
  sqlTableByLogicalId: Map<string, SqlTableDefinition>;
  columnBySqlId: Map<string, LogicalColumn>;
  columnBySqlName: Map<string, LogicalColumn>;
  logicalIssues: LogicalIssue[];
  nextIssueIndex: number;
}

export function convertSqlSchemaToLogicalModel(
  sqlModel: SqlSchemaModel,
  options?: SqlReverseOptions,
): SqlReverseLogicalResult {
  const resolvedOptions: Required<SqlReverseOptions> = {
    ...DEFAULT_SQL_REVERSE_OPTIONS,
    ...options,
  };
  const context: ConversionContext = {
    sqlModel,
    tableBySqlId: new Map(),
    tableBySqlName: new Map(),
    sqlTableByLogicalId: new Map(),
    columnBySqlId: new Map(),
    columnBySqlName: new Map(),
    logicalIssues: [],
    nextIssueIndex: 1,
  };

  const tables = sqlModel.tables.map((sqlTable, tableIndex) => convertSqlTable(sqlTable, tableIndex, context));
  const uniqueConstraints = sqlModel.tables.flatMap((sqlTable, tableIndex) =>
    convertUniqueConstraints(sqlTable, tableIndex, context),
  );
  const foreignKeys = sqlModel.tables.flatMap((sqlTable, tableIndex) =>
    convertForeignKeys(sqlTable, tableIndex, context),
  );
  const edges = foreignKeys.map((foreignKey, index): LogicalEdge => ({
    id: `logical-edge-${index + 1}`,
    foreignKeyId: foreignKey.id,
    fromTableId: foreignKey.fromTableId,
    toTableId: foreignKey.toTableId,
    label: foreignKey.name,
  }));

  if (resolvedOptions.inferManyToManyTables) {
    tables.forEach((table) => {
      const sqlTable = context.sqlTableByLogicalId.get(table.id);
      if (!sqlTable) {
        return;
      }
      const tableForeignKeys = foreignKeys.filter((foreignKey) => foreignKey.fromTableId === table.id);
      table.kind = isAssociativeTable(sqlTable, tableForeignKeys) ? "associative" : "entity";
    });
  }

  const model: LogicalModel = {
    meta: {
      name: sqlModel.sourceName ?? resolvedOptions.sourceName,
      generatedAt: new Date().toISOString(),
      sourceDiagramVersion: 1,
      sourceSignature: buildSqlReverseSourceSignature(sqlModel),
    },
    tables,
    foreignKeys,
    uniqueConstraints,
    edges,
    issues: context.logicalIssues,
  };

  return {
    model,
    sqlModel,
    issues: sqlModel.issues,
  };
}

export function reverseSqlToLogicalModel(
  sourceSql: string,
  options?: SqlReverseOptions,
): SqlReverseLogicalResult {
  const parsed = parseSqlSchema(sourceSql, options);
  const converted = convertSqlSchemaToLogicalModel(parsed.model, options);

  return {
    ...converted,
    issues: parsed.issues,
  };
}

function convertSqlTable(
  sqlTable: SqlTableDefinition,
  tableIndex: number,
  context: ConversionContext,
): LogicalTable {
  const tableId = `logical-table-${tableIndex + 1}`;
  const columns = sqlTable.columns.map((sqlColumn, columnIndex) =>
    convertSqlColumn(sqlColumn, sqlTable, tableIndex, columnIndex),
  );
  const table: LogicalTable = {
    id: tableId,
    name: sqlTable.name,
    kind: "entity",
    originLabel: buildTableOriginLabel(sqlTable),
    columns,
    x: 80 + (tableIndex % 3) * 320,
    y: 80 + Math.floor(tableIndex / 3) * 220,
    width: 260,
    height: Math.max(160, 80 + columns.length * 28),
  };

  context.tableBySqlId.set(sqlTable.id, table);
  context.tableBySqlName.set(buildSqlTableLookupKey(sqlTable.schemaName, sqlTable.name), table);
  context.tableBySqlName.set(buildSqlTableLookupKey(undefined, sqlTable.name), table);
  context.sqlTableByLogicalId.set(table.id, sqlTable);
  columns.forEach((column, columnIndex) => {
    const sqlColumn = sqlTable.columns[columnIndex];
    if (!sqlColumn) {
      return;
    }
    context.columnBySqlId.set(sqlColumn.id, column);
    context.columnBySqlName.set(buildSqlColumnLookupKey(sqlTable.id, sqlColumn.name), column);
  });

  if (!columns.some((column) => column.isPrimaryKey)) {
    addLogicalIssue(context, {
      level: "warning",
      code: "ENTITY_WITHOUT_PK",
      message: `Table ${sqlTable.name} has no primary key.`,
      tableId,
    });
  }

  return table;
}

function convertSqlColumn(
  sqlColumn: SqlColumnDefinition,
  sqlTable: SqlTableDefinition,
  tableIndex: number,
  columnIndex: number,
): LogicalColumn {
  const normalizedType = normalizeSqlDataType(sqlColumn);
  const isUnique = sqlColumn.isUnique || isColumnCoveredBySingleColumnUnique(sqlTable, sqlColumn.name);

  return {
    id: `logical-column-${tableIndex + 1}-${columnIndex + 1}`,
    name: sqlColumn.name,
    originLabel: `${buildTableOriginLabel(sqlTable)}.${sqlColumn.name}`,
    isPrimaryKey: sqlColumn.isPrimaryKey,
    isForeignKey: sqlColumn.isForeignKey,
    isUnique,
    isNullable: sqlColumn.isNullable,
    isGenerated: sqlColumn.isGenerated,
    dataType: normalizedType.dataType,
    defaultValue: sqlColumn.defaultValue?.value ?? null,
    length: normalizedType.length,
    precision: normalizedType.precision,
    scale: normalizedType.scale,
    references: [],
  };
}

function convertUniqueConstraints(
  sqlTable: SqlTableDefinition,
  tableIndex: number,
  context: ConversionContext,
): LogicalUniqueConstraint[] {
  const logicalTable = context.tableBySqlId.get(sqlTable.id);
  if (!logicalTable) {
    return [];
  }

  return sqlTable.uniqueConstraints
    .map((constraint, constraintIndex) => convertUniqueConstraint(
      constraint,
      sqlTable,
      tableIndex,
      constraintIndex,
      logicalTable.id,
      context,
    ))
    .filter((constraint): constraint is LogicalUniqueConstraint => constraint !== null);
}

function convertUniqueConstraint(
  constraint: SqlUniqueConstraintDefinition,
  sqlTable: SqlTableDefinition,
  tableIndex: number,
  constraintIndex: number,
  logicalTableId: string,
  context: ConversionContext,
): LogicalUniqueConstraint | null {
  const columnIds = constraint.columnNames
    .map((columnName) => context.columnBySqlName.get(buildSqlColumnLookupKey(sqlTable.id, columnName))?.id)
    .filter((columnId): columnId is string => typeof columnId === "string");

  if (columnIds.length === 0) {
    return null;
  }

  if (columnIds.length === 1) {
    const column = findLogicalColumnById(context, columnIds[0]);
    if (column) {
      column.isUnique = true;
    }
  }

  return {
    id: `logical-unique-${tableIndex + 1}-${constraintIndex + 1}`,
    tableId: logicalTableId,
    columnIds,
    originLabel: constraint.name ?? `UNIQUE(${constraint.columnNames.join(", ")})`,
  };
}

function convertForeignKeys(
  sqlTable: SqlTableDefinition,
  tableIndex: number,
  context: ConversionContext,
): LogicalForeignKey[] {
  return sqlTable.foreignKeys
    .map((foreignKey, foreignKeyIndex) => convertForeignKey(foreignKey, sqlTable, tableIndex, foreignKeyIndex, context))
    .filter((foreignKey): foreignKey is LogicalForeignKey => foreignKey !== null);
}

function convertForeignKey(
  sqlForeignKey: SqlForeignKeyDefinition,
  sqlTable: SqlTableDefinition,
  tableIndex: number,
  foreignKeyIndex: number,
  context: ConversionContext,
): LogicalForeignKey | null {
  const fromTable = context.tableBySqlId.get(sqlForeignKey.fromTableId);
  const toTable = findTargetLogicalTable(sqlForeignKey, context);
  if (!fromTable || !toTable) {
    return null;
  }

  const fromColumns = sqlForeignKey.fromColumnNames
    .map((columnName) => context.columnBySqlName.get(buildSqlColumnLookupKey(sqlTable.id, columnName)))
    .filter((column): column is LogicalColumn => typeof column !== "undefined");
  const targetSqlTable = context.sqlTableByLogicalId.get(toTable.id);
  const toColumns = targetSqlTable
    ? sqlForeignKey.toColumnNames
      .map((columnName) => context.columnBySqlName.get(buildSqlColumnLookupKey(targetSqlTable.id, columnName)))
      .filter((column): column is LogicalColumn => typeof column !== "undefined")
    : [];

  if (fromColumns.length === 0 || toColumns.length === 0 || fromColumns.length !== toColumns.length) {
    addLogicalIssue(context, {
      level: "error",
      code: "INVALID_TRANSFORMATION",
      message: `Foreign key ${sqlForeignKey.name ?? sqlForeignKey.id} could not be mapped to logical columns.`,
      tableId: fromTable.id,
    });
    return null;
  }

  const foreignKeyId = `logical-fk-${tableIndex + 1}-${foreignKeyIndex + 1}`;
  const foreignKey: LogicalForeignKey = {
    id: foreignKeyId,
    name: sqlForeignKey.name ?? `${fromTable.name}_${toTable.name}_fk`,
    fromTableId: fromTable.id,
    toTableId: toTable.id,
    mappings: fromColumns.map((fromColumn, mappingIndex) => ({
      fromColumnId: fromColumn.id,
      toColumnId: toColumns[mappingIndex]?.id ?? "",
    })),
    required: fromColumns.every((column) => !column.isNullable),
    unique: areColumnsPrimaryKey(fromColumns) || areColumnsCoveredByUniqueConstraint(fromTable, fromColumns, context),
  };

  foreignKey.mappings.forEach((mapping) => {
    const fromColumn = findLogicalColumnById(context, mapping.fromColumnId);
    if (!fromColumn) {
      return;
    }
    fromColumn.isForeignKey = true;
    fromColumn.references.push({
      foreignKeyId,
      targetTableId: foreignKey.toTableId,
      targetColumnId: mapping.toColumnId,
    });
  });

  return foreignKey;
}

function normalizeSqlDataType(sqlColumn: SqlColumnDefinition): NormalizedSqlDataType {
  const rawName = sqlColumn.dataType?.normalizedName ?? sqlColumn.dataType?.name.toUpperCase();
  if (!rawName) {
    return {
      dataType: undefined,
      length: null,
      precision: null,
      scale: null,
    };
  }

  const baseName = rawName.trim().toUpperCase();
  const dataType = normalizeSqlTypeName(baseName);
  const args = sqlColumn.dataType?.args ?? [];
  const length = args.length === 1 && isLengthType(dataType) ? args[0] ?? null : null;
  const precision = args.length >= 2 && dataType === "NUMERIC" ? args[0] ?? null : null;
  const scale = args.length >= 2 && dataType === "NUMERIC" ? args[1] ?? null : null;

  return {
    dataType,
    length,
    precision,
    scale,
  };
}

function normalizeSqlTypeName(baseName: string): string {
  if (["INTEGER", "INT", "BIGINT", "SMALLINT", "SERIAL", "BIGSERIAL", "SMALLSERIAL"].includes(baseName)) {
    return "INTEGER";
  }
  if (["TEXT", "CLOB"].includes(baseName)) {
    return "TEXT";
  }
  if (["VARCHAR", "VARCHAR2", "CHAR", "CHARACTER", "NVARCHAR", "NCHAR"].includes(baseName)) {
    return "VARCHAR";
  }
  if (["REAL", "FLOAT", "DOUBLE", "DOUBLE PRECISION"].includes(baseName)) {
    return "REAL";
  }
  if (["NUMERIC", "DECIMAL", "NUMBER"].includes(baseName)) {
    return "NUMERIC";
  }
  if (baseName === "DATE") {
    return "DATE";
  }
  if (["DATETIME", "TIMESTAMP", "TIME"].includes(baseName)) {
    return "DATETIME";
  }
  if (["BOOLEAN", "BOOL", "BIT"].includes(baseName)) {
    return "BOOLEAN";
  }
  if (["BLOB", "BYTEA", "VARBINARY"].includes(baseName)) {
    return "BLOB";
  }
  if (["JSON", "JSONB"].includes(baseName)) {
    return "JSON";
  }
  return baseName;
}

function isLengthType(dataType: string): boolean {
  return dataType === "VARCHAR" || dataType === "TEXT";
}

function isAssociativeTable(
  table: SqlTableDefinition,
  resolvedForeignKeys: LogicalForeignKey[],
): boolean {
  const primaryKeyColumns = table.columns.filter((column) => column.isPrimaryKey);
  const foreignKeyColumnNames = new Set(
    table.foreignKeys.flatMap((foreignKey) => foreignKey.fromColumnNames.map(normalizeSqlName)),
  );

  return (
    primaryKeyColumns.length >= 2
    && resolvedForeignKeys.length >= 2
    && primaryKeyColumns.every((column) => foreignKeyColumnNames.has(normalizeSqlName(column.name)))
  );
}

function findTargetLogicalTable(
  foreignKey: SqlForeignKeyDefinition,
  context: ConversionContext,
): LogicalTable | undefined {
  return (
    context.tableBySqlName.get(buildSqlTableLookupKey(foreignKey.toSchemaName, foreignKey.toTableName))
    ?? context.tableBySqlName.get(buildSqlTableLookupKey(undefined, foreignKey.toTableName))
  );
}

function isColumnCoveredBySingleColumnUnique(sqlTable: SqlTableDefinition, columnName: string): boolean {
  const normalized = normalizeSqlName(columnName);
  return sqlTable.uniqueConstraints.some((constraint) => {
    return constraint.columnNames.length === 1 && normalizeSqlName(constraint.columnNames[0] ?? "") === normalized;
  });
}

function areColumnsPrimaryKey(columns: LogicalColumn[]): boolean {
  return columns.length > 0 && columns.every((column) => column.isPrimaryKey);
}

function areColumnsCoveredByUniqueConstraint(
  table: LogicalTable,
  columns: LogicalColumn[],
  context: ConversionContext,
): boolean {
  const columnSignature = buildColumnIdSignature(columns.map((column) => column.id));
  if (columns.length === 1 && columns[0]?.isUnique) {
    return true;
  }

  const sqlTable = context.sqlTableByLogicalId.get(table.id);
  if (!sqlTable) {
    return false;
  }

  return sqlTable.uniqueConstraints.some((constraint) => {
    const uniqueColumnIds = constraint.columnNames
      .map((columnName) => context.columnBySqlName.get(buildSqlColumnLookupKey(sqlTable.id, columnName))?.id)
      .filter((columnId): columnId is string => typeof columnId === "string");
    return buildColumnIdSignature(uniqueColumnIds) === columnSignature;
  });
}

function findLogicalColumnById(context: ConversionContext, columnId: string | undefined): LogicalColumn | undefined {
  if (!columnId) {
    return undefined;
  }
  for (const table of context.tableBySqlId.values()) {
    const column = table.columns.find((candidate) => candidate.id === columnId);
    if (column) {
      return column;
    }
  }
  return undefined;
}

function buildSqlReverseSourceSignature(sqlModel: SqlSchemaModel): string {
  const tableNames = sqlModel.tables
    .map((table) => buildTableOriginLabel(table))
    .sort((left, right) => left.localeCompare(right))
    .join("|");
  return `sql-reverse:${sqlModel.tables.length}:${tableNames}`;
}

function buildTableOriginLabel(table: SqlTableDefinition): string {
  return table.schemaName ? `${table.schemaName}.${table.name}` : table.name;
}

function buildSqlTableLookupKey(schemaName: string | undefined, tableName: string): string {
  return `${normalizeSqlName(schemaName ?? "")}.${normalizeSqlName(tableName)}`;
}

function buildSqlColumnLookupKey(tableId: string, columnName: string): string {
  return `${tableId}:${normalizeSqlName(columnName)}`;
}

function buildColumnIdSignature(columnIds: string[]): string {
  return [...columnIds].sort((left, right) => left.localeCompare(right)).join("|");
}

function normalizeSqlName(value: string): string {
  return value.trim().toLowerCase();
}

function addLogicalIssue(
  context: ConversionContext,
  issue: Omit<LogicalIssue, "id">,
): void {
  context.logicalIssues.push({
    id: `logical-issue-${context.nextIssueIndex}`,
    ...issue,
  });
  context.nextIssueIndex += 1;
}
