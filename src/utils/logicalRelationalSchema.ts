import type { LogicalModel } from "../types/logical";

const COMBINING_LOW_LINE = "\u0332";

export interface LogicalRelationalSchemaAttribute {
  columnName: string;
  isPrimaryKey: boolean;
  targetTableName?: string;
}

export interface LogicalRelationalSchemaRow {
  tableName: string;
  attributes: LogicalRelationalSchemaAttribute[];
}

export function underlineRelationalIdentifier(value: string): string {
  return Array.from(value).map((character) => (character === ":" ? character : `${character}${COMBINING_LOW_LINE}`)).join("");
}

export function buildLogicalRelationalSchemaRows(model: LogicalModel): LogicalRelationalSchemaRow[] {
  const tableById = new Map(model.tables.map((table) => [table.id, table]));
  const referencedTableNameByColumnId = new Map<string, string>();

  model.foreignKeys.forEach((foreignKey) => {
    const targetTable = tableById.get(foreignKey.toTableId);
    if (!targetTable) {
      return;
    }

    foreignKey.mappings.forEach((mapping) => {
      referencedTableNameByColumnId.set(mapping.fromColumnId, targetTable.name);
    });
  });

  return model.tables.map((table) => ({
    tableName: table.name,
    attributes: table.columns.map((column) => ({
      columnName: column.name,
      isPrimaryKey: column.isPrimaryKey,
      targetTableName: column.isForeignKey ? referencedTableNameByColumnId.get(column.id) : undefined,
    })),
  }));
}

export function generateLogicalRelationalSchema(model: LogicalModel): string {
  return buildLogicalRelationalSchemaRows(model)
    .map((table) => {
      const attributes = table.attributes.map((attribute) => {
        const columnName = attribute.isPrimaryKey ? underlineRelationalIdentifier(attribute.columnName) : attribute.columnName;
        return attribute.targetTableName ? `${columnName}:${attribute.targetTableName}` : columnName;
      });
      return `${table.tableName}( ${attributes.join(", ")} )`;
    })
    .join("\n\n");
}
