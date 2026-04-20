import type { LogicalColumn, LogicalForeignKey, LogicalModel, LogicalTable, LogicalUniqueConstraint } from "../types/logical";
import { formatSqlType } from "./logicalSqlMetadata";

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function joinIdentifierList(values: string[]): string {
  return values.map(quoteIdentifier).join(", ");
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
): string | null {
  const columnById = buildColumnLookup(table);
  const columnNames = constraint.columnIds
    .map((columnId) => columnById.get(columnId)?.name)
    .filter((name): name is string => typeof name === "string");

  return columnNames.length > 0 ? `UNIQUE (${joinIdentifierList(columnNames)})` : null;
}

function renderForeignKey(
  foreignKey: LogicalForeignKey,
  tableById: Map<string, LogicalTable>,
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

  return `FOREIGN KEY (${joinIdentifierList(fromColumnNames)}) REFERENCES ${quoteIdentifier(toTable.name)} (${joinIdentifierList(toColumnNames)})`;
}

export function generateLogicalSql(model: LogicalModel): string {
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

  return model.tables
    .map((table) => {
      const primaryKeyColumns = table.columns.filter((column) => column.isPrimaryKey);
      const lines = table.columns.map((column) => {
        const dataType = formatSqlType(column);
        const notNull = column.isNullable ? "" : " NOT NULL";
        const defaultClause =
          typeof column.defaultValue === "string" && column.defaultValue.trim().length > 0
            ? ` DEFAULT ${column.defaultValue.trim()}`
            : "";
        return `${quoteIdentifier(column.name)} ${dataType}${notNull}${defaultClause}`;
      });

      if (primaryKeyColumns.length > 0) {
        lines.push(`PRIMARY KEY (${joinIdentifierList(primaryKeyColumns.map((column) => column.name))})`);
      }

      const renderedUniqueConstraints = (uniqueConstraintsByTableId.get(table.id) ?? [])
        .map((constraint) => renderUniqueConstraint(constraint, table))
        .filter((line): line is string => line !== null);
      const renderedUniqueSignatures = new Set(
        (uniqueConstraintsByTableId.get(table.id) ?? []).map((constraint) => buildUniqueConstraintSignature(constraint.columnIds)),
      );
      lines.push(...renderedUniqueConstraints);

      table.columns
        .filter((column) => column.isUnique && !column.isPrimaryKey)
        .forEach((column) => {
          const signature = buildUniqueConstraintSignature([column.id]);
          if (renderedUniqueSignatures.has(signature)) {
            return;
          }

          lines.push(`UNIQUE (${joinIdentifierList([column.name])})`);
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
              lines.push(`UNIQUE (${joinIdentifierList(columnNames)})`);
              renderedUniqueSignatures.add(signature);
            }
          }
        }

        const renderedForeignKey = renderForeignKey(foreignKey, tableById);
        if (renderedForeignKey) {
          lines.push(renderedForeignKey);
        }
      });

      return `CREATE TABLE ${quoteIdentifier(table.name)} (\n  ${lines.join(",\n  ")}\n);`;
    })
    .join("\n\n");
}
