import type {
  SqlExplorerForeignKey,
  SqlExplorerMetadata,
  SqlExplorerTable,
} from "./sqlExplorerTypes";

export interface ResolvedSqliteForeignKeyMapping {
  fromColumn: string;
  toColumn: string | null;
  sequence: number;
}

export interface ResolvedSqliteForeignKeyGroup {
  id: number;
  toTable: string;
  onUpdate: string;
  onDelete: string;
  match: string;
  mappings: ResolvedSqliteForeignKeyMapping[];
  targetTable: SqlExplorerTable | undefined;
  unresolved: boolean;
}

function stableTextCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function groupSqliteForeignKeys(rows: readonly SqlExplorerForeignKey[]): SqlExplorerForeignKey[][] {
  const groups = new Map<number, SqlExplorerForeignKey[]>();
  [...rows]
    .sort((left, right) => left.id - right.id || left.sequence - right.sequence)
    .forEach((row) => groups.set(row.id, [...(groups.get(row.id) ?? []), row]));
  return [...groups.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, group]) => group);
}

export function findSqliteTable(
  metadata: SqlExplorerMetadata,
  databaseName: string,
  tableName: string,
): SqlExplorerTable | undefined {
  const database = metadata.databases.find((entry) => entry.name === databaseName)
    ?? metadata.databases.find((entry) => entry.name === "main");
  return database?.tables
    .slice()
    .sort((left, right) => stableTextCompare(left.name, right.name))
    .find((table) => table.name.toLocaleLowerCase() === tableName.toLocaleLowerCase());
}

export function resolveSqliteForeignKeyGroups(
  metadata: SqlExplorerMetadata,
  databaseName: string,
  rows: readonly SqlExplorerForeignKey[],
): ResolvedSqliteForeignKeyGroup[] {
  return groupSqliteForeignKeys(rows).map((group) => {
    const first = group[0];
    const targetTable = findSqliteTable(metadata, databaseName, first.toTable);
    const targetPrimaryKey = targetTable?.columns
      .filter((column) => column.primaryKeyPosition > 0)
      .sort((left, right) => left.primaryKeyPosition - right.primaryKeyPosition);
    const mappings = group.map((row, index) => ({
      fromColumn: row.fromColumn,
      toColumn: row.toColumn ?? targetPrimaryKey?.[index]?.name ?? null,
      sequence: row.sequence,
    }));
    return {
      id: first.id,
      toTable: first.toTable,
      onUpdate: first.onUpdate,
      onDelete: first.onDelete,
      match: first.match,
      mappings,
      targetTable,
      unresolved: targetTable === undefined || mappings.some((mapping) => mapping.toColumn === null),
    };
  });
}
