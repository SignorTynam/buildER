import type { SqlExplorerMetadata, SqlExplorerTable } from "./sqlExplorerTypes";
import { quoteSqliteIdentifier } from "./sqliteIdentifier";
import { resolveSqliteForeignKeyGroups } from "./sqliteMetadataNormalization";
import {
  SQL_POPULATION_MAX_ROWS,
  SQL_POPULATION_MAX_SEED,
  SQL_POPULATION_MIN_ROWS,
  type SqlPopulationAffinity,
  type SqlPopulationConfig,
  SqlPopulationError,
  type SqlPopulationPlan,
  type SqlPopulationPlanPreview,
  type SqlPopulationRowCount,
  type SqlPopulationTableRows,
  type SqlPopulationValue,
  type SqlPopulationWarning,
} from "./sqlDataPopulationTypes";

interface NormalizedPopulationColumn {
  name: string;
  position: number;
  declaredType: string;
  affinity: SqlPopulationAffinity;
  notNull: boolean;
  defaultValue: string | null;
  primaryKeyPosition: number;
  generated: boolean;
  hidden: number;
  integerPrimaryKey: boolean;
  constrained: boolean;
}

interface NormalizedPopulationUniqueKey {
  id: string;
  columns: string[];
  primary: boolean;
}

interface NormalizedPopulationForeignKey {
  id: number;
  toTable: string;
  mappings: Array<{ fromColumn: string; toColumn: string }>;
  optional: boolean;
}

interface NormalizedPopulationTable {
  name: string;
  columns: NormalizedPopulationColumn[];
  insertColumns: NormalizedPopulationColumn[];
  uniqueKeys: NormalizedPopulationUniqueKey[];
  foreignKeys: NormalizedPopulationForeignKey[];
}

interface MutablePopulationTable {
  table: NormalizedPopulationTable;
  rows: Array<Map<string, SqlPopulationValue>>;
}

const DATE_EPOCH_UTC = Date.UTC(2020, 0, 1);
const DAY_MILLISECONDS = 86_400_000;

function stableTextCompare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sameIdentifier(left: string, right: string): boolean {
  return left.toLocaleLowerCase() === right.toLocaleLowerCase();
}

function findColumn(columns: readonly NormalizedPopulationColumn[], name: string): NormalizedPopulationColumn | undefined {
  return columns.find((column) => sameIdentifier(column.name, name));
}

function findTable(tables: readonly NormalizedPopulationTable[], name: string): NormalizedPopulationTable | undefined {
  return tables.find((table) => sameIdentifier(table.name, name));
}

export function getSqliteAffinity(declaredType: string): SqlPopulationAffinity {
  const normalized = declaredType.trim().toUpperCase();
  if (normalized.includes("INT")) return "INTEGER";
  if (normalized.includes("CHAR") || normalized.includes("CLOB") || normalized.includes("TEXT")) return "TEXT";
  if (normalized.length === 0 || normalized.includes("BLOB")) return "BLOB";
  if (normalized.includes("REAL") || normalized.includes("FLOA") || normalized.includes("DOUB")) return "REAL";
  return "NUMERIC";
}

export function validateSqlPopulationConfig(config: SqlPopulationConfig): SqlPopulationConfig {
  if (!Number.isInteger(config.rowsPerTable)
    || config.rowsPerTable < SQL_POPULATION_MIN_ROWS
    || config.rowsPerTable > SQL_POPULATION_MAX_ROWS
    || !Number.isInteger(config.seed)
    || config.seed < 0
    || config.seed > SQL_POPULATION_MAX_SEED) {
    throw new SqlPopulationError(
      "population-invalid-config",
      "The population configuration is invalid.",
      { rowsPerTable: config.rowsPerTable, seed: config.seed },
    );
  }
  return { rowsPerTable: config.rowsPerTable, seed: config.seed >>> 0 };
}

export function parseSqlPopulationRows(value: string): number | null {
  if (!/^\d+$/u.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= SQL_POPULATION_MIN_ROWS && parsed <= SQL_POPULATION_MAX_ROWS
    ? parsed
    : null;
}

export function parseSqlPopulationSeed(value: string): number | null {
  if (!/^\d+$/u.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 && parsed <= SQL_POPULATION_MAX_SEED
    ? parsed
    : null;
}

export function deterministicPopulationUint(seed: number, ...parts: Array<string | number>): number {
  let hash = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  const text = parts.map(String).join("\u001f");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash = (hash + 0x6d2b79f5) >>> 0;
  let value = hash;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return (value ^ (value >>> 14)) >>> 0;
}

function normalizeUniqueKeys(table: SqlExplorerTable): NormalizedPopulationUniqueKey[] {
  const primaryColumns = table.columns
    .filter((column) => column.primaryKeyPosition > 0)
    .sort((left, right) => left.primaryKeyPosition - right.primaryKeyPosition)
    .map((column) => column.name);
  const keys: NormalizedPopulationUniqueKey[] = primaryColumns.length > 0
    ? [{ id: `pk:${table.name}`, columns: primaryColumns, primary: true }]
    : [];

  table.indexes
    .filter((index) => index.unique && index.origin !== "pk")
    .sort((left, right) => stableTextCompare(left.name, right.name))
    .forEach((index) => {
      if (index.partial || index.expressionColumns.length > 0 || index.columns.length === 0) {
        throw new SqlPopulationError(
          "population-unsupported-unique-index",
          `Unique index ${index.name} cannot be populated safely.`,
          { tableName: table.name, indexName: index.name },
        );
      }
      keys.push({ id: `unique:${index.name}`, columns: [...index.columns], primary: false });
    });
  return keys;
}

function normalizeTables(metadata: SqlExplorerMetadata): NormalizedPopulationTable[] {
  const main = metadata.databases.find((database) => database.name === "main");
  if (!main) {
    throw new SqlPopulationError("population-database-not-ready", "The main SQLite database is not available.");
  }
  const sourceTables = main.tables
    .filter((table) => !table.virtual && !table.name.toLocaleLowerCase().startsWith("sqlite_"))
    .sort((left, right) => stableTextCompare(left.name, right.name));
  const normalized: NormalizedPopulationTable[] = sourceTables.map((table) => {
    const uniqueKeys = normalizeUniqueKeys(table);
    const primaryKey = uniqueKeys.find((key) => key.primary) ?? null;
    const foreignKeyGroups = resolveSqliteForeignKeyGroups(metadata, "main", table.foreignKeys);
    const constrainedNames = new Set([
      ...uniqueKeys.flatMap((key) => key.columns),
      ...foreignKeyGroups.flatMap((group) => group.mappings.map((mapping) => mapping.fromColumn)),
    ].map((name) => name.toLocaleLowerCase()));
    const columns = table.columns
      .slice()
      .sort((left, right) => left.position - right.position || stableTextCompare(left.name, right.name))
      .map((column) => ({
        name: column.name,
        position: column.position,
        declaredType: column.dataType,
        affinity: getSqliteAffinity(column.dataType),
        notNull: column.notNull || column.primaryKeyPosition > 0,
        defaultValue: column.defaultValue,
        primaryKeyPosition: column.primaryKeyPosition,
        generated: column.generated,
        hidden: column.hidden,
        integerPrimaryKey: primaryKey?.columns.length === 1
          && primaryKey.columns.some((name) => sameIdentifier(name, column.name))
          && column.dataType.trim().toUpperCase() === "INTEGER",
        constrained: constrainedNames.has(column.name.toLocaleLowerCase()),
      }));
    const insertColumns = columns.filter((column) => column.hidden === 0
      && !column.generated
      && !(column.defaultValue !== null && !column.constrained));
    columns.filter((column) => column.generated && column.constrained).forEach((column) => {
      throw new SqlPopulationError(
        "population-unsupported-generated-key",
        `Generated column ${table.name}.${column.name} participates in a key or foreign key.`,
        { tableName: table.name, columnName: column.name },
      );
    });
    const foreignKeys: NormalizedPopulationForeignKey[] = foreignKeyGroups.map((group) => {
      if (group.unresolved || !group.targetTable) {
        throw new SqlPopulationError(
          "population-unresolved-foreign-key",
          `Foreign key ${table.name} → ${group.toTable} has an unresolved target.`,
          { tableName: table.name, targetTable: group.toTable, foreignKeyId: group.id },
        );
      }
      const mappings = group.mappings.map((mapping) => {
        const from = columns.find((column) => sameIdentifier(column.name, mapping.fromColumn));
        const to = mapping.toColumn;
        if (!from || !to) {
          throw new SqlPopulationError(
            "population-unresolved-foreign-key",
            `Foreign key ${table.name} → ${group.toTable} has an unresolved column.`,
            { tableName: table.name, targetTable: group.toTable, foreignKeyId: group.id },
          );
        }
        return { fromColumn: from.name, toColumn: to };
      });
      return {
        id: group.id,
        toTable: group.targetTable.name,
        mappings,
        optional: mappings.every((mapping) => !findColumn(columns, mapping.fromColumn)?.notNull),
      };
    });
    return { name: table.name, columns, insertColumns, uniqueKeys, foreignKeys };
  });

  normalized.forEach((table) => table.foreignKeys.forEach((foreignKey) => {
    const target = findTable(normalized, foreignKey.toTable);
    if (!target) {
      throw new SqlPopulationError(
        "population-unresolved-foreign-key",
        `Foreign key ${table.name} → ${foreignKey.toTable} targets an ineligible table.`,
        { tableName: table.name, targetTable: foreignKey.toTable, foreignKeyId: foreignKey.id },
      );
    }
    const targetColumns = foreignKey.mappings.map((mapping) => mapping.toColumn);
    const isReferencable = target.uniqueKeys.some((key) => key.columns.length === targetColumns.length
      && key.columns.every((column, index) => sameIdentifier(column, targetColumns[index])));
    if (!isReferencable) {
      throw new SqlPopulationError(
        "population-invalid-foreign-key-target",
        `Foreign key ${table.name} → ${foreignKey.toTable} does not target a primary or unique key.`,
        { tableName: table.name, targetTable: foreignKey.toTable, foreignKeyId: foreignKey.id },
      );
    }
    foreignKey.mappings.forEach((mapping) => {
      const targetColumn = findColumn(target.columns, mapping.toColumn);
      if (!targetColumn || targetColumn.generated) {
        throw new SqlPopulationError(
          targetColumn?.generated ? "population-unsupported-generated-key" : "population-unresolved-foreign-key",
          `Foreign key ${table.name} → ${foreignKey.toTable} cannot use ${mapping.toColumn}.`,
          { tableName: table.name, targetTable: foreignKey.toTable, columnName: mapping.toColumn },
        );
      }
    });
  }));
  return normalized;
}

export function findPopulationStronglyConnectedComponents(
  nodes: readonly string[],
  dependencies: ReadonlyMap<string, readonly string[]>,
): string[][] {
  let nextIndex = 0;
  const indexes = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];

  function visit(node: string): void {
    indexes.set(node, nextIndex);
    lowLinks.set(node, nextIndex);
    nextIndex += 1;
    stack.push(node);
    onStack.add(node);
    const targets = [...(dependencies.get(node) ?? [])].sort(stableTextCompare);
    targets.forEach((target) => {
      if (!indexes.has(target)) {
        visit(target);
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, lowLinks.get(target) ?? 0));
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node) ?? 0, indexes.get(target) ?? 0));
      }
    });
    if (lowLinks.get(node) !== indexes.get(node)) return;
    const component: string[] = [];
    let current: string | undefined;
    do {
      current = stack.pop();
      if (current === undefined) break;
      onStack.delete(current);
      component.push(current);
    } while (current !== node);
    components.push(component.sort(stableTextCompare));
  }

  [...nodes].sort(stableTextCompare).forEach((node) => {
    if (!indexes.has(node)) visit(node);
  });
  return components.sort((left, right) => stableTextCompare(left[0] ?? "", right[0] ?? ""));
}

function buildPopulationTableOrder(tables: readonly NormalizedPopulationTable[]): {
  order: string[];
  usesDeferredForeignKeys: boolean;
} {
  const names = tables.map((table) => table.name);
  const dependencies = new Map<string, string[]>(tables.map((table) => [
    table.name,
    [...new Set(table.foreignKeys.map((foreignKey) => foreignKey.toTable))].sort(stableTextCompare),
  ]));
  const components = findPopulationStronglyConnectedComponents(names, dependencies);
  const componentByTable = new Map<string, number>();
  components.forEach((component, index) => component.forEach((tableName) => componentByTable.set(tableName, index)));
  const componentDependencies = new Map<number, number[]>();
  components.forEach((_, index) => componentDependencies.set(index, []));
  tables.forEach((table) => table.foreignKeys.forEach((foreignKey) => {
    const child = componentByTable.get(table.name);
    const parent = componentByTable.get(foreignKey.toTable);
    if (child === undefined || parent === undefined || child === parent) return;
    const current = componentDependencies.get(child) ?? [];
    if (!current.includes(parent)) current.push(parent);
    componentDependencies.set(child, current.sort((left, right) => stableTextCompare(components[left][0], components[right][0])));
  }));
  const orderedComponents: number[] = [];
  const visited = new Set<number>();
  function visitComponent(index: number): void {
    if (visited.has(index)) return;
    visited.add(index);
    (componentDependencies.get(index) ?? []).forEach(visitComponent);
    orderedComponents.push(index);
  }
  components.map((_, index) => index)
    .sort((left, right) => stableTextCompare(components[left][0], components[right][0]))
    .forEach(visitComponent);
  const usesDeferredForeignKeys = components.some((component) => component.length > 1)
    || tables.some((table) => table.foreignKeys.some((foreignKey) => sameIdentifier(table.name, foreignKey.toTable)));
  return { order: orderedComponents.flatMap((index) => components[index]), usesDeferredForeignKeys };
}

interface ForeignKeyConstraintMapping {
  foreignKeys: NormalizedPopulationForeignKey[];
  capacity: number;
}

function findForeignKeyConstraint(
  table: NormalizedPopulationTable,
  key: NormalizedPopulationUniqueKey,
  rowCounts: ReadonlyMap<string, number>,
): ForeignKeyConstraintMapping | null {
  const participating = table.foreignKeys.filter((foreignKey) => foreignKey.mappings.some((mapping) =>
    key.columns.some((column) => sameIdentifier(column, mapping.fromColumn))));
  if (participating.length === 0) return null;
  const coveredColumns = participating.flatMap((foreignKey) => foreignKey.mappings.map((mapping) => mapping.fromColumn));
  const complete = key.columns.every((column) => coveredColumns.some((covered) => sameIdentifier(column, covered)))
    && coveredColumns.every((covered) => key.columns.some((column) => sameIdentifier(column, covered)));
  if (!complete) return null;
  const duplicateColumn = coveredColumns.some((column, index) => coveredColumns
    .some((candidate, candidateIndex) => candidateIndex !== index && sameIdentifier(column, candidate)));
  if (duplicateColumn) {
    throw new SqlPopulationError(
      "population-unsatisfiable-unique",
      `Unique key ${key.id} overlaps multiple foreign keys in ${table.name}.`,
      { tableName: table.name, constraint: key.id },
    );
  }
  const foreignKeys = participating.sort((left, right) => left.id - right.id);
  const capacity = foreignKeys.reduce((product, foreignKey) => product * (rowCounts.get(foreignKey.toTable) ?? 0), 1);
  return { foreignKeys, capacity };
}

function resolvePopulationRowCounts(
  tables: readonly NormalizedPopulationTable[],
  requestedRows: number,
): { rowCounts: Map<string, number>; warnings: SqlPopulationWarning[] } {
  const rowCounts = new Map(tables.map((table) => [table.name, requestedRows]));
  for (let iteration = 0; iteration < tables.length + 1; iteration += 1) {
    let changed = false;
    tables.forEach((table) => {
      const current = rowCounts.get(table.name) ?? requestedRows;
      const capacity = table.uniqueKeys.reduce((minimum, key) => {
        const constraint = findForeignKeyConstraint(table, key, rowCounts);
        return constraint ? Math.min(minimum, constraint.capacity) : minimum;
      }, requestedRows);
      const next = Math.min(current, capacity);
      if (next !== current) {
        rowCounts.set(table.name, next);
        changed = true;
      }
    });
    if (!changed) break;
  }
  const warnings = tables.flatMap((table) => {
    const limited = limitSqlPopulationRowsByCapacity(table.name, requestedRows, rowCounts.get(table.name) ?? 0);
    return limited.warning ? [limited.warning] : [];
  });
  return { rowCounts, warnings };
}

function semanticName(column: NormalizedPopulationColumn): string {
  return column.name.trim().toLocaleLowerCase().replace(/[\s-]+/gu, "_");
}

function humanizeIdentifier(value: string): string {
  const spaced = value.replace(/[_-]+/gu, " ").replace(/\s+/gu, " ").trim();
  return spaced ? spaced[0].toLocaleUpperCase() + spaced.slice(1).toLocaleLowerCase() : "Value";
}

function paddedOrdinal(seed: number, table: string, column: string, rowIndex: number): string {
  const offset = deterministicPopulationUint(seed, table, column, "ordinal") % 900;
  return String(offset + rowIndex + 1).padStart(3, "0");
}

function generatePopulationValue(
  seed: number,
  table: NormalizedPopulationTable,
  column: NormalizedPopulationColumn,
  rowIndex: number,
): SqlPopulationValue {
  const hash = deterministicPopulationUint(seed, table.name, column.name, rowIndex, "value");
  const ordinal = paddedOrdinal(seed, table.name, column.name, rowIndex);
  const name = semanticName(column);
  const declaredType = column.declaredType.trim().toUpperCase();
  const keyMember = column.constrained || column.primaryKeyPosition > 0;

  if (column.integerPrimaryKey) {
    const offset = deterministicPopulationUint(seed, table.name, column.name, "integer-primary-key") % 100_000;
    return offset * 128 + rowIndex + 1;
  }
  if (declaredType.includes("DATETIME") || declaredType.includes("TIMESTAMP") || /(?:created|updated)_at/u.test(name)) {
    return new Date(DATE_EPOCH_UTC + (hash % 2000) * DAY_MILLISECONDS + (rowIndex % 24) * 3_600_000)
      .toISOString().replace(".000Z", "Z");
  }
  if (declaredType === "DATE" || name === "date" || name.endsWith("_date")) {
    return new Date(DATE_EPOCH_UTC + (hash % 2000) * DAY_MILLISECONDS).toISOString().slice(0, 10);
  }
  if (declaredType.includes("JSON") || name.includes("json")) {
    return JSON.stringify({ sample: Number(ordinal), seed: seed >>> 0 });
  }
  if (column.affinity === "BLOB") {
    return new Uint8Array([hash & 0xff, (hash >>> 8) & 0xff, (hash >>> 16) & 0xff, rowIndex & 0xff]);
  }
  if (!keyMember && (declaredType.includes("BOOL") || name === "active" || name === "enabled" || name.startsWith("is_") || name.startsWith("has_"))) {
    return hash % 2;
  }
  if (!keyMember && (name.includes("price") || name.includes("amount") || name.includes("cost"))) {
    return Number(((hash % 90_000) / 100 + 1).toFixed(2));
  }
  if (column.affinity === "INTEGER") return keyMember ? (hash % 10_000_000) * 128 + rowIndex + 1 : hash % 10_000;
  if (column.affinity === "REAL") return keyMember
    ? (hash % 1_000_000) * 128 + rowIndex + 1.25
    : Number(((hash % 100_000) / 100).toFixed(2));
  if (column.affinity === "NUMERIC" && !/(?:name|title|mail|phone|tel)/u.test(name)) {
    return keyMember ? (hash % 10_000_000) * 128 + rowIndex + 1 : hash % 10_000;
  }
  if (name === "email" || name.includes("mail")) return `user${ordinal}@example.test`;
  if (name === "name" || name === "nome" || name === "first_name") return `Name ${ordinal}`;
  if (name === "surname" || name === "cognome" || name === "last_name") return `Surname ${ordinal}`;
  if (name === "title" || name === "titolo") return `${humanizeIdentifier(table.name)} ${ordinal}`;
  if (name.includes("phone") || name.includes("telephone") || name === "tel") return `+1-202-555-${String(1000 + Number(ordinal)).slice(-4)}`;
  return `${humanizeIdentifier(table.name)} ${humanizeIdentifier(column.name)} ${ordinal}`;
}

function valueKey(value: SqlPopulationValue): string {
  if (value === null) return "null";
  if (value instanceof Uint8Array) return `blob:${Array.from(value).join(",")}`;
  return `${typeof value}:${String(value)}`;
}

function tupleKey(values: readonly SqlPopulationValue[]): string {
  return values.map(valueKey).join("\u001e");
}

export function enumeratePopulationMixedRadix(capacities: readonly number[], requested: number): number[][] {
  if (capacities.some((capacity) => !Number.isInteger(capacity) || capacity < 1) || requested < 0) return [];
  const maximum = capacities.reduce((product, capacity) => product * capacity, 1);
  const count = Math.min(requested, maximum);
  return Array.from({ length: count }, (_, rowIndex) => {
    let remainder = rowIndex;
    return capacities.map((capacity) => {
      const digit = remainder % capacity;
      remainder = Math.floor(remainder / capacity);
      return digit;
    });
  });
}

export function limitSqlPopulationRowsByCapacity(
  tableName: string,
  requestedRows: number,
  capacity: number,
): { generatedRows: number; warning: SqlPopulationWarning | null } {
  const generatedRows = Math.max(0, Math.min(requestedRows, capacity));
  return {
    generatedRows,
    warning: generatedRows < requestedRows ? {
      code: "population-row-limit",
      tableName,
      messageContext: { requestedRows, generatedRows },
    } : null,
  };
}

function foreignKeyConstraintForGroup(
  table: NormalizedPopulationTable,
  foreignKey: NormalizedPopulationForeignKey,
  rowCounts: ReadonlyMap<string, number>,
): ForeignKeyConstraintMapping | null {
  return table.uniqueKeys
    .map((key) => findForeignKeyConstraint(table, key, rowCounts))
    .filter((constraint): constraint is ForeignKeyConstraintMapping => constraint !== null
      && constraint.foreignKeys.some((candidate) => candidate.id === foreignKey.id))
    .sort((left, right) => left.capacity - right.capacity
      || left.foreignKeys.length - right.foreignKeys.length
      || left.foreignKeys[0].id - right.foreignKeys[0].id)[0] ?? null;
}

function buildMutableRows(
  tables: readonly NormalizedPopulationTable[],
  rowCounts: ReadonlyMap<string, number>,
  seed: number,
): Map<string, MutablePopulationTable> {
  const mutable = new Map<string, MutablePopulationTable>();
  tables.forEach((table) => {
    const count = rowCounts.get(table.name) ?? 0;
    const rows = Array.from({ length: count }, (_, rowIndex) => new Map(
      table.insertColumns.map((column) => [column.name, generatePopulationValue(seed, table, column, rowIndex)]),
    ));
    mutable.set(table.name, { table, rows });
  });

  tables.forEach((table) => {
    const child = mutable.get(table.name);
    if (!child) return;
    table.foreignKeys.forEach((foreignKey) => {
      const parent = mutable.get(foreignKey.toTable);
      if (!parent || parent.rows.length === 0) {
        throw new SqlPopulationError(
          "population-unresolved-foreign-key",
          `Foreign key ${table.name} → ${foreignKey.toTable} has no parent rows.`,
          { tableName: table.name, targetTable: foreignKey.toTable, foreignKeyId: foreignKey.id },
        );
      }
      const constraint = foreignKeyConstraintForGroup(table, foreignKey, rowCounts);
      const constrainedIndex = constraint?.foreignKeys.findIndex((candidate) => candidate.id === foreignKey.id) ?? -1;
      const stride = constrainedIndex <= 0 ? 1 : constraint!.foreignKeys
        .slice(0, constrainedIndex)
        .reduce((product, candidate) => product * (rowCounts.get(candidate.toTable) ?? 0), 1);
      const selfReference = sameIdentifier(table.name, foreignKey.toTable);
      child.rows.forEach((row, rowIndex) => {
        const shouldUseNull = foreignKey.optional
          && (selfReference ? rowIndex === 0 : deterministicPopulationUint(seed, table.name, foreignKey.id, rowIndex, "optional-fk") % 7 === 0);
        if (shouldUseNull) {
          foreignKey.mappings.forEach((mapping) => row.set(mapping.fromColumn, null));
          return;
        }
        let parentIndex: number;
        if (selfReference) {
          parentIndex = constraint
            ? (foreignKey.optional ? Math.max(0, rowIndex - 1) : rowIndex % parent.rows.length)
            : rowIndex === 0 ? 0 : Math.floor((rowIndex - 1) / 2);
        } else if (constraint) {
          parentIndex = Math.floor(rowIndex / stride) % parent.rows.length;
        } else {
          const offset = deterministicPopulationUint(seed, table.name, foreignKey.id, "fk-offset") % parent.rows.length;
          parentIndex = (rowIndex + offset) % parent.rows.length;
        }
        const parentRow = parent.rows[parentIndex];
        foreignKey.mappings.forEach((mapping) => {
          const value = parentRow.get(mapping.toColumn);
          if (value === undefined) {
            throw new SqlPopulationError(
              "population-unresolved-foreign-key",
              `Foreign key target ${foreignKey.toTable}.${mapping.toColumn} is not insertable.`,
              { tableName: table.name, targetTable: foreignKey.toTable, columnName: mapping.toColumn },
            );
          }
          row.set(mapping.fromColumn, value);
        });
      });
    });
  });
  return mutable;
}

function validatePlannedRows(mutable: ReadonlyMap<string, MutablePopulationTable>): void {
  mutable.forEach(({ table, rows }) => {
    table.uniqueKeys.forEach((key) => {
      const used = new Set<string>();
      rows.forEach((row) => {
        const tuple = key.columns.map((column) => row.get(column) ?? null);
        if (key.primary && tuple.some((value) => value === null)) {
          throw new SqlPopulationError(
            "population-unsatisfiable-unique",
            `Primary key ${key.id} contains NULL in ${table.name}.`,
            { tableName: table.name, constraint: key.id },
          );
        }
        if (!key.primary && tuple.some((value) => value === null)) return;
        const serialized = tupleKey(tuple);
        if (used.has(serialized)) {
          throw new SqlPopulationError(
            "population-unsatisfiable-unique",
            `Unique key ${key.id} cannot be generated for ${table.name}.`,
            { tableName: table.name, constraint: key.id },
          );
        }
        used.add(serialized);
      });
    });
    table.foreignKeys.forEach((foreignKey) => {
      const parent = mutable.get(foreignKey.toTable);
      if (!parent) return;
      const parentTuples = new Set(parent.rows.map((row) => tupleKey(foreignKey.mappings.map((mapping) => row.get(mapping.toColumn) ?? null))));
      rows.forEach((row) => {
        const tuple = foreignKey.mappings.map((mapping) => row.get(mapping.fromColumn) ?? null);
        if (tuple.some((value) => value === null)) return;
        if (!parentTuples.has(tupleKey(tuple))) {
          throw new SqlPopulationError(
            "population-unresolved-foreign-key",
            `Generated foreign key ${table.name} → ${foreignKey.toTable} is not present in the parent key pool.`,
            { tableName: table.name, targetTable: foreignKey.toTable, foreignKeyId: foreignKey.id },
          );
        }
      });
    });
  });
}

export function formatSqlPopulationLiteral(value: SqlPopulationValue): string {
  if (value === null) return "NULL";
  if (value instanceof Uint8Array) {
    return `X'${Array.from(value).map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase()}'`;
  }
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return `'${value.replace(/'/g, "''")}'`;
}

export function createSqlPopulationPreview(
  tableRows: readonly SqlPopulationTableRows[],
  tableOrder: readonly string[],
  usesDeferredForeignKeys: boolean,
): string {
  const byName = new Map(tableRows.map((table) => [table.tableName, table]));
  const statements = tableOrder.flatMap((tableName) => {
    const table = byName.get(tableName);
    if (!table || table.rows.length === 0) return [];
    if (table.columns.length === 0) {
      return table.rows.map(() => `INSERT INTO ${quoteSqliteIdentifier(table.tableName)} DEFAULT VALUES;`);
    }
    const columns = table.columns.map(quoteSqliteIdentifier).join(", ");
    const values = table.rows.map((row) => `  (${row.map(formatSqlPopulationLiteral).join(", ")})`).join(",\n");
    return [`INSERT INTO ${quoteSqliteIdentifier(table.tableName)} (${columns})\nVALUES\n${values};`];
  });
  return [
    "PRAGMA foreign_keys = ON;",
    "",
    "BEGIN IMMEDIATE;",
    ...(usesDeferredForeignKeys ? ["", "PRAGMA defer_foreign_keys = ON;"] : []),
    ...statements.flatMap((statement) => ["", statement]),
    "",
    "PRAGMA foreign_key_check;",
    "",
    "COMMIT;",
  ].join("\n");
}

function serializePlanForId(tableRows: readonly SqlPopulationTableRows[]): string {
  return tableRows.map((table) => [
    table.tableName,
    table.columns.join(","),
    table.rows.map((row) => tupleKey(row)).join(";"),
  ].join("|")).join("\u001d");
}

function publicPlan(plan: SqlPopulationPlan): SqlPopulationPlanPreview {
  const {
    tableOrder: _tableOrder,
    tableRows: _tableRows,
    preconditionRowCounts: _preconditionRowCounts,
    usesDeferredForeignKeys: _usesDeferredForeignKeys,
    ...preview
  } = plan;
  return preview;
}

export function toSqlPopulationPlanPreview(plan: SqlPopulationPlan): SqlPopulationPlanPreview {
  return publicPlan(plan);
}

export function planSqlPopulation(input: {
  sessionId: string;
  config: SqlPopulationConfig;
  metadata: SqlExplorerMetadata;
  schemaSignature: string;
  rowCounts: readonly SqlPopulationRowCount[];
}): SqlPopulationPlan {
  const config = validateSqlPopulationConfig(input.config);
  const tables = normalizeTables(input.metadata);
  const expectedNames = tables.map((table) => table.name);
  const rowCountsByName = new Map(input.rowCounts.map((entry) => [entry.tableName, entry.rowCount]));
  const preconditionRowCounts = expectedNames.map((tableName) => ({
    tableName,
    rowCount: rowCountsByName.get(tableName) ?? 0,
  }));
  const nonEmpty = preconditionRowCounts.filter((entry) => entry.rowCount > 0);
  if (nonEmpty.length > 0) {
    throw new SqlPopulationError(
      "population-database-not-empty",
      "The database contains data and must be recreated before population.",
      { tableCount: nonEmpty.length, rowCount: nonEmpty.reduce((total, entry) => total + entry.rowCount, 0) },
    );
  }
  const { rowCounts, warnings } = resolvePopulationRowCounts(tables, config.rowsPerTable);
  const { order: tableOrder, usesDeferredForeignKeys } = buildPopulationTableOrder(tables);
  const mutable = buildMutableRows(tables, rowCounts, config.seed);
  validatePlannedRows(mutable);
  const tableRows: SqlPopulationTableRows[] = tables.map((table) => {
    const planned = mutable.get(table.name);
    const columns = table.insertColumns.map((column) => column.name);
    return {
      tableName: table.name,
      columns,
      rows: (planned?.rows ?? []).map((row) => columns.map((column) => row.get(column) ?? null)),
    };
  });
  const summaries = tables.map((table) => ({
    tableName: table.name,
    requestedRows: config.rowsPerTable,
    generatedRows: rowCounts.get(table.name) ?? 0,
  }));
  const previewSql = createSqlPopulationPreview(tableRows, tableOrder, usesDeferredForeignKeys);
  const serialized = serializePlanForId(tableRows);
  const planId = `population-${deterministicPopulationUint(config.seed, input.schemaSignature, config.rowsPerTable, serialized)
    .toString(16).padStart(8, "0")}`;
  return {
    planId,
    sessionId: input.sessionId,
    seed: config.seed,
    rowsPerTable: config.rowsPerTable,
    schemaSignature: input.schemaSignature,
    tableCount: tables.length,
    totalRows: summaries.reduce((total, summary) => total + summary.generatedRows, 0),
    tables: summaries,
    warnings,
    previewSql,
    tableOrder,
    tableRows,
    preconditionRowCounts,
    usesDeferredForeignKeys,
  };
}
