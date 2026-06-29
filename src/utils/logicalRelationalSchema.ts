import type { LogicalModel } from "../types/logical";

const COMBINING_LOW_LINE = "\u0332";

export function underlineRelationalIdentifier(value: string): string {
  return Array.from(value).map((character) => (character === ":" ? character : `${character}${COMBINING_LOW_LINE}`)).join("");
}

export function generateLogicalRelationalSchema(model: LogicalModel): string {
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

  return model.tables
    .map((table) => {
      const attributes = table.columns.map((column) => {
        const columnName = column.isPrimaryKey ? underlineRelationalIdentifier(column.name) : column.name;
        const targetTableName = column.isForeignKey ? referencedTableNameByColumnId.get(column.id) : undefined;
        return targetTableName ? `${columnName}:${targetTableName}` : columnName;
      });

      return `${table.name}( ${attributes.join(", ")} )`;
    })
    .join("\n\n");
}
