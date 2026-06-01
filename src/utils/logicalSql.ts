import type { LogicalColumn, LogicalForeignKey, LogicalModel, LogicalTable, LogicalUniqueConstraint } from "../types/logical";
import { formatSqlType } from "./logicalSqlMetadata";

export type LogicalSqlDialect =
  | "generic"
  | "mysql"
  | "mariadb"
  | "sqlserver"
  | "oracle"
  | "postgresql"
  | "sqlite";

export interface LogicalSqlGenerationOptions {
  dialect?: LogicalSqlDialect;
  quoteIdentifiers?: boolean;
}

export const LOGICAL_SQL_DIALECT_OPTIONS: ReadonlyArray<{ value: LogicalSqlDialect; label: string }> = [
  { value: "generic", label: "Generic SQL" },
  { value: "mysql", label: "MySQL" },
  { value: "mariadb", label: "MariaDB" },
  { value: "sqlserver", label: "SQL Server / SSMS" },
  { value: "oracle", label: "Oracle" },
  { value: "postgresql", label: "PostgreSQL" },
  { value: "sqlite", label: "SQLite" },
];

interface SqlRenderContext {
  dialect: LogicalSqlDialect;
  quoteIdentifiers: boolean;
}

function createSqlRenderContext(options: LogicalSqlGenerationOptions = {}): SqlRenderContext {
  return {
    dialect: options.dialect ?? "generic",
    quoteIdentifiers: options.quoteIdentifiers === true,
  };
}

function quoteIdentifier(value: string, context: SqlRenderContext): string {
  if (!context.quoteIdentifiers) {
    return value;
  }

  if (context.dialect === "mysql" || context.dialect === "mariadb") {
    return `\`${value.replace(/`/g, "``")}\``;
  }

  if (context.dialect === "sqlserver") {
    return `[${value.replace(/]/g, "]]")}]`;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function joinIdentifierList(values: string[], context: SqlRenderContext): string {
  return values.map((value) => quoteIdentifier(value, context)).join(", ");
}

function buildColumnLookup(table: LogicalTable): Map<string, LogicalColumn> {
  return new Map(table.columns.map((column) => [column.id, column]));
}

function buildUniqueConstraintSignature(columnIds: string[]): string {
  return [...new Set(columnIds)].sort((left, right) => left.localeCompare(right)).join("|");
}

function renderUniqueConstraint(
  constraint: LogicalUniqueConstraint,
  table: LogicalTable,
  context: SqlRenderContext,
): string | null {
  const columnById = buildColumnLookup(table);
  const columnNames = constraint.columnIds
    .map((columnId) => columnById.get(columnId)?.name)
    .filter((name): name is string => typeof name === "string");

  return columnNames.length > 0 ? `UNIQUE (${joinIdentifierList(columnNames, context)})` : null;
}

function renderForeignKey(
  foreignKey: LogicalForeignKey,
  tableById: Map<string, LogicalTable>,
  context: SqlRenderContext,
): string | null {
  const fromTable = tableById.get(foreignKey.fromTableId);
  const toTable = tableById.get(foreignKey.toTableId);
  if (!fromTable || !toTable) {
    return null;
  }

  const fromColumnById = buildColumnLookup(fromTable);
  const toColumnById = buildColumnLookup(toTable);
  const fromColumnNames = foreignKey.mappings
    .map((mapping) => fromColumnById.get(mapping.fromColumnId)?.name)
    .filter((name): name is string => typeof name === "string");
  const toColumnNames = foreignKey.mappings
    .map((mapping) => toColumnById.get(mapping.toColumnId)?.name)
    .filter((name): name is string => typeof name === "string");

  if (fromColumnNames.length === 0 || fromColumnNames.length !== toColumnNames.length) {
    return null;
  }

  return `FOREIGN KEY (${joinIdentifierList(fromColumnNames, context)}) REFERENCES ${quoteIdentifier(toTable.name, context)} (${joinIdentifierList(toColumnNames, context)})`;
}

function formatSqlTypeForDialect(column: LogicalColumn, dialect: LogicalSqlDialect): string {
  const baseType = formatSqlType(column);
  const upperBaseType = baseType.toUpperCase();

  if (dialect === "oracle") {
    if (upperBaseType === "BOOLEAN") {
      return "NUMBER(1)";
    }
    if (upperBaseType === "DATETIME") {
      return "TIMESTAMP";
    }
    if (upperBaseType === "TEXT") {
      return "CLOB";
    }
    if (upperBaseType === "BLOB") {
      return "BLOB";
    }
    if (upperBaseType === "JSON") {
      return "CLOB";
    }
  }

  if (dialect === "sqlserver") {
    if (upperBaseType === "INTEGER") {
      return "INT";
    }
    if (upperBaseType === "BOOLEAN") {
      return "BIT";
    }
    if (upperBaseType === "TEXT") {
      return "NVARCHAR(MAX)";
    }
    if (upperBaseType === "BLOB") {
      return "VARBINARY(MAX)";
    }
    if (upperBaseType === "JSON") {
      return "NVARCHAR(MAX)";
    }
  }

  if (dialect === "mysql" || dialect === "mariadb") {
    if (upperBaseType === "INTEGER") {
      return "INT";
    }
  }

  return baseType;
}

function sortTablesByForeignKeyDependencies(model: LogicalModel): LogicalTable[] {
  const tableById = new Map(model.tables.map((table) => [table.id, table]));
  const dependenciesByTableId = new Map<string, Set<string>>();
  model.tables.forEach((table) => dependenciesByTableId.set(table.id, new Set()));

  model.foreignKeys.forEach((foreignKey) => {
    if (foreignKey.fromTableId === foreignKey.toTableId) {
      return;
    }
    if (!tableById.has(foreignKey.fromTableId) || !tableById.has(foreignKey.toTableId)) {
      return;
    }
    dependenciesByTableId.get(foreignKey.fromTableId)?.add(foreignKey.toTableId);
  });

  const ordered: LogicalTable[] = [];
  const orderedIds = new Set<string>();
  const temporaryIds = new Set<string>();

  function visit(table: LogicalTable): void {
    if (orderedIds.has(table.id)) {
      return;
    }
    if (temporaryIds.has(table.id)) {
      return;
    }

    temporaryIds.add(table.id);
    (dependenciesByTableId.get(table.id) ?? new Set()).forEach((dependencyId) => {
      const dependency = tableById.get(dependencyId);
      if (dependency) {
        visit(dependency);
      }
    });
    temporaryIds.delete(table.id);
    orderedIds.add(table.id);
    ordered.push(table);
  }

  model.tables.forEach(visit);
  return ordered;
}

export function generateLogicalSql(model: LogicalModel, options: LogicalSqlGenerationOptions = {}): string {
  const context = createSqlRenderContext(options);
  const tableById = new Map(model.tables.map((table) => [table.id, table]));
  const foreignKeysByTableId = new Map<string, LogicalForeignKey[]>();
  model.foreignKeys.forEach((foreignKey) => {
    const bucket = foreignKeysByTableId.get(foreignKey.fromTableId) ?? [];
    bucket.push(foreignKey);
    foreignKeysByTableId.set(foreignKey.fromTableId, bucket);
  });

  const uniqueConstraintsByTableId = new Map<string, LogicalUniqueConstraint[]>();
  model.uniqueConstraints.forEach((constraint) => {
    const bucket = uniqueConstraintsByTableId.get(constraint.tableId) ?? [];
    bucket.push(constraint);
    uniqueConstraintsByTableId.set(constraint.tableId, bucket);
  });

  return sortTablesByForeignKeyDependencies(model)
    .map((table) => {
      const primaryKeyColumns = table.columns.filter((column) => column.isPrimaryKey);
      const lines = table.columns.map((column) => {
        const dataType = formatSqlTypeForDialect(column, context.dialect);
        const notNull = column.isNullable ? "" : " NOT NULL";
        const defaultClause =
          typeof column.defaultValue === "string" && column.defaultValue.trim().length > 0
            ? ` DEFAULT ${column.defaultValue.trim()}`
            : "";
        return `${quoteIdentifier(column.name, context)} ${dataType}${notNull}${defaultClause}`;
      });

      if (primaryKeyColumns.length > 0) {
        lines.push(`PRIMARY KEY (${joinIdentifierList(primaryKeyColumns.map((column) => column.name), context)})`);
      }

      const renderedUniqueConstraints = (uniqueConstraintsByTableId.get(table.id) ?? [])
        .map((constraint) => renderUniqueConstraint(constraint, table, context))
        .filter((line): line is string => line !== null);
      const renderedUniqueSignatures = new Set(
        (uniqueConstraintsByTableId.get(table.id) ?? []).map((constraint) => buildUniqueConstraintSignature(constraint.columnIds)),
      );
      const columnsCoveredByTableUniqueConstraints = new Set(
        (uniqueConstraintsByTableId.get(table.id) ?? []).flatMap((constraint) => constraint.columnIds),
      );
      lines.push(...renderedUniqueConstraints);

      table.columns
        .filter((column) => column.isUnique && !column.isPrimaryKey)
        .forEach((column) => {
          if (columnsCoveredByTableUniqueConstraints.has(column.id)) {
            return;
          }

          const signature = buildUniqueConstraintSignature([column.id]);
          if (renderedUniqueSignatures.has(signature)) {
            return;
          }

          lines.push(`UNIQUE (${joinIdentifierList([column.name], context)})`);
          renderedUniqueSignatures.add(signature);
        });

      (foreignKeysByTableId.get(table.id) ?? []).forEach((foreignKey) => {
        if (foreignKey.unique) {
          const signature = buildUniqueConstraintSignature(foreignKey.mappings.map((mapping) => mapping.fromColumnId));
          if (!renderedUniqueSignatures.has(signature)) {
            const columnNames = foreignKey.mappings
              .map((mapping) => table.columns.find((column) => column.id === mapping.fromColumnId)?.name)
              .filter((name): name is string => typeof name === "string");
            if (columnNames.length > 0) {
              lines.push(`UNIQUE (${joinIdentifierList(columnNames, context)})`);
              renderedUniqueSignatures.add(signature);
            }
          }
        }

        const renderedForeignKey = renderForeignKey(foreignKey, tableById, context);
        if (renderedForeignKey) {
          lines.push(renderedForeignKey);
        }
      });

      return `CREATE TABLE ${quoteIdentifier(table.name, context)} (\n  ${lines.join(",\n  ")}\n);`;
    })
    .join("\n\n");
}
