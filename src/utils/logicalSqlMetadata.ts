import {
  SQL_DATA_TYPE_OPTIONS,
  type LogicalColumn,
  type LogicalModel,
  type LogicalUniqueConstraint,
  type SupportedSqlDataType,
} from "../types/logical";

export interface LogicalColumnSqlPatch {
  name?: string;
  dataType?: string;
  isNullable?: boolean;
  isUnique?: boolean;
  defaultValue?: string | null;
  length?: number | null;
  precision?: number | null;
  scale?: number | null;
}

export interface SqlTypePickerOption {
  value: SupportedSqlDataType;
  label: string;
}

export const SQL_TYPE_PICKER_OPTIONS: readonly SqlTypePickerOption[] = [
  { value: "INTEGER", label: "INTEGER" },
  { value: "TEXT", label: "TEXT" },
  { value: "VARCHAR", label: "VARCHAR(100)" },
  { value: "REAL", label: "REAL" },
  { value: "NUMERIC", label: "NUMERIC" },
  { value: "DATE", label: "DATE" },
  { value: "DATETIME", label: "DATETIME" },
  { value: "BLOB", label: "BLOB" },
  { value: "JSON", label: "JSON" },
  { value: "BOOLEAN", label: "BOOLEAN" },
] as const;

const INTEGER_NAME_HINT = /(^|_)(id|ids?|codice|code|num|number|key|chiave)(_|$)/i;
const DATE_NAME_HINT = /(^|_)(data|date)(_|$)/i;
const DATETIME_NAME_HINT = /(^|_)(ora|datetime|timestamp|time)(_|$)/i;
const BOOLEAN_NAME_HINT = /(^|_)(flag|is|has|attivo|abilitato|enabled)(_|$)/i;

interface ResolvedSqlType {
  dataType: string;
  length: number | null;
  precision: number | null;
  scale: number | null;
}

function normalizeIdentifierToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizePositiveInteger(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function normalizeNonNegativeInteger(value: unknown): number | null {
  const numeric = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function isSupportedSqlDataType(value: string): value is SupportedSqlDataType {
  return (SQL_DATA_TYPE_OPTIONS as readonly string[]).includes(value);
}

function inferSqlTypeFromName(name: string): ResolvedSqlType {
  const normalized = normalizeIdentifierToken(name);
  if (!normalized) {
    return {
      dataType: "VARCHAR",
      length: 100,
      precision: null,
      scale: null,
    };
  }

  if (BOOLEAN_NAME_HINT.test(normalized)) {
    return {
      dataType: "BOOLEAN",
      length: null,
      precision: null,
      scale: null,
    };
  }

  if (DATETIME_NAME_HINT.test(normalized)) {
    return {
      dataType: "DATETIME",
      length: null,
      precision: null,
      scale: null,
    };
  }

  if (DATE_NAME_HINT.test(normalized)) {
    return {
      dataType: "DATE",
      length: null,
      precision: null,
      scale: null,
    };
  }

  if (INTEGER_NAME_HINT.test(normalized)) {
    return {
      dataType: "INTEGER",
      length: null,
      precision: null,
      scale: null,
    };
  }

  return {
    dataType: "VARCHAR",
    length: 100,
    precision: null,
    scale: null,
  };
}

function parseInlineSqlType(value: string | undefined): ResolvedSqlType | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  const varcharMatch = normalized.match(/^VARCHAR\s*\((\d+)\)$/);
  if (varcharMatch) {
    return {
      dataType: "VARCHAR",
      length: normalizePositiveInteger(varcharMatch[1]) ?? 100,
      precision: null,
      scale: null,
    };
  }

  const numericMatch = normalized.match(/^NUMERIC\s*\((\d+)\s*,\s*(\d+)\)$/);
  if (numericMatch) {
    const precision = normalizePositiveInteger(numericMatch[1]) ?? 10;
    const scaleCandidate = normalizeNonNegativeInteger(numericMatch[2]);
    const scale = scaleCandidate == null ? Math.min(2, precision) : Math.min(scaleCandidate, precision);
    return {
      dataType: "NUMERIC",
      length: null,
      precision,
      scale,
    };
  }

  if (normalized === "VARCHAR") {
    return {
      dataType: "VARCHAR",
      length: null,
      precision: null,
      scale: null,
    };
  }

  if (normalized === "NUMERIC") {
    return {
      dataType: "NUMERIC",
      length: null,
      precision: null,
      scale: null,
    };
  }

  if (isSupportedSqlDataType(normalized)) {
    return {
      dataType: normalized,
      length: null,
      precision: null,
      scale: null,
    };
  }

  return {
    dataType: normalized,
    length: null,
    precision: null,
    scale: null,
  };
}

function normalizeSqlTypeParameters(parts: ResolvedSqlType, column: LogicalColumn): ResolvedSqlType {
  if (parts.dataType === "VARCHAR") {
    return {
      dataType: "VARCHAR",
      length: normalizePositiveInteger(parts.length ?? column.length) ?? 100,
      precision: null,
      scale: null,
    };
  }

  if (parts.dataType === "NUMERIC") {
    const precision = normalizePositiveInteger(parts.precision ?? column.precision) ?? 10;
    const scaleCandidate = normalizeNonNegativeInteger(parts.scale ?? column.scale);
    const scale = scaleCandidate == null ? Math.min(2, precision) : Math.min(scaleCandidate, precision);

    return {
      dataType: "NUMERIC",
      length: null,
      precision,
      scale,
    };
  }

  return {
    dataType: parts.dataType,
    length: null,
    precision: null,
    scale: null,
  };
}

function hasOwn<T extends object, K extends PropertyKey>(value: T, key: K): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function normalizeDefaultValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveSqlType(column: LogicalColumn): ResolvedSqlType {
  const parsed = parseInlineSqlType(column.dataType);
  const inferred = inferSqlTypeFromName(column.name);
  const resolved = parsed ?? inferred;
  return normalizeSqlTypeParameters(resolved, column);
}

function isColumnTypeReferenceLocked(column: LogicalColumn): boolean {
  return column.isForeignKey && column.references.length > 0;
}

function copyTypeMetadata(source: LogicalColumn, target: LogicalColumn): LogicalColumn {
  return {
    ...target,
    dataType: source.dataType,
    length: source.length,
    precision: source.precision,
    scale: source.scale,
  };
}

function buildSingleColumnUniqueSignature(tableId: string, columnId: string): string {
  return `${tableId}|${columnId}`;
}

function extractUniqueConstraintSequence(id: string): number | null {
  const match = id.match(/^unique-(\d+)$/);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function allocateUniqueConstraintId(existingConstraints: LogicalUniqueConstraint[]): string {
  const nextSequence =
    existingConstraints
      .map((constraint) => extractUniqueConstraintSequence(constraint.id))
      .filter((value): value is number => value != null)
      .reduce((max, value) => Math.max(max, value), 0) + 1;

  return `unique-${nextSequence}`;
}

function applySingleColumnUniqueToggle(
  model: LogicalModel,
  tableId: string,
  columnId: string,
  enabled: boolean,
): LogicalModel {
  const targetTable = model.tables.find((table) => table.id === tableId);
  const targetColumn = targetTable?.columns.find((column) => column.id === columnId);
  if (!targetColumn || targetColumn.isPrimaryKey) {
    return model;
  }

  const signature = buildSingleColumnUniqueSignature(tableId, columnId);
  const currentSingleSignatures = new Set(
    model.uniqueConstraints
      .filter((constraint) => constraint.columnIds.length === 1)
      .map((constraint) => buildSingleColumnUniqueSignature(constraint.tableId, constraint.columnIds[0])),
  );

  if (enabled && !currentSingleSignatures.has(signature)) {
    return {
      ...model,
      uniqueConstraints: [
        ...model.uniqueConstraints,
        {
          id: allocateUniqueConstraintId(model.uniqueConstraints),
          tableId,
          columnIds: [columnId],
          originLabel: "manual-sql-unique",
        },
      ],
    };
  }

  if (!enabled && currentSingleSignatures.has(signature)) {
    return {
      ...model,
      uniqueConstraints: model.uniqueConstraints.filter(
        (constraint) =>
          !(constraint.tableId === tableId && constraint.columnIds.length === 1 && constraint.columnIds[0] === columnId),
      ),
    };
  }

  return model;
}

export function isColumnTypeLockedByReference(column: LogicalColumn): boolean {
  return isColumnTypeReferenceLocked(column);
}

export function isColumnEffectivelyUnique(column: LogicalColumn): boolean {
  return column.isPrimaryKey || column.isUnique === true;
}

export function isTypeUniquenessLocked(_dataType: string | undefined): boolean {
  return false;
}

export function requiresLength(dataType: string | undefined): boolean {
  return dataType?.trim().toUpperCase() === "VARCHAR";
}

export function requiresPrecisionScale(dataType: string | undefined): boolean {
  return dataType?.trim().toUpperCase() === "NUMERIC";
}

export function normalizeLogicalColumnSqlMetadata(column: LogicalColumn): LogicalColumn {
  const resolvedType = resolveSqlType(column);
  const normalizedNullable = column.isPrimaryKey ? false : column.isNullable;

  return {
    ...column,
    dataType: resolvedType.dataType,
    length: resolvedType.length,
    precision: resolvedType.precision,
    scale: resolvedType.scale,
    defaultValue: normalizeDefaultValue(column.defaultValue),
    isNullable: normalizedNullable,
  };
}

export function normalizeLogicalModelSqlMetadata(model: LogicalModel): LogicalModel {
  const normalizedTables = model.tables.map((table) => ({
    ...table,
    columns: table.columns.map((column) => normalizeLogicalColumnSqlMetadata(column)),
  }));

  const columnById = new Map<string, LogicalColumn>();
  normalizedTables.forEach((table) => {
    table.columns.forEach((column) => {
      columnById.set(column.id, column);
    });
  });

  model.foreignKeys.forEach((foreignKey) => {
    foreignKey.mappings.forEach((mapping) => {
      const fromColumn = columnById.get(mapping.fromColumnId);
      const toColumn = columnById.get(mapping.toColumnId);
      if (!fromColumn || !toColumn) {
        return;
      }

      const syncedTarget = normalizeLogicalColumnSqlMetadata(toColumn);
      const syncedSource = copyTypeMetadata(syncedTarget, fromColumn);
      columnById.set(mapping.fromColumnId, normalizeLogicalColumnSqlMetadata(syncedSource));
    });
  });

  const fkSynchronizedTables = normalizedTables.map((table) => ({
    ...table,
    columns: table.columns.map((column) => columnById.get(column.id) ?? column),
  }));

  const uniqueColumnIdsByTableId = new Map<string, Set<string>>();
  model.uniqueConstraints.forEach((constraint) => {
    const bucket = uniqueColumnIdsByTableId.get(constraint.tableId) ?? new Set<string>();
    constraint.columnIds.forEach((columnId) => bucket.add(columnId));
    uniqueColumnIdsByTableId.set(constraint.tableId, bucket);
  });

  const uniquenessAlignedTables = fkSynchronizedTables.map((table) => {
    const constrainedColumnIds = uniqueColumnIdsByTableId.get(table.id) ?? new Set<string>();
    return {
      ...table,
      columns: table.columns.map((column) => ({
        ...column,
        isUnique: column.isUnique === true || constrainedColumnIds.has(column.id),
      })),
    };
  });

  return {
    ...model,
    tables: uniquenessAlignedTables,
  };
}

export function updateLogicalColumnSqlMetadata(
  model: LogicalModel,
  tableId: string,
  columnId: string,
  patch: LogicalColumnSqlPatch,
): LogicalModel {
  const uniqueToggle = hasOwn(patch, "isUnique") && typeof patch.isUnique === "boolean" ? patch.isUnique : null;

  const nextModel: LogicalModel = {
    ...model,
    tables: model.tables.map((table) => {
      if (table.id !== tableId) {
        return table;
      }

      return {
        ...table,
        columns: table.columns.map((column) => {
          if (column.id !== columnId) {
            return column;
          }

          const nextColumn: LogicalColumn = { ...column };
          if (hasOwn(patch, "name") && typeof patch.name === "string" && patch.name.trim().length > 0) {
            nextColumn.name = patch.name.trim();
          }
          if (hasOwn(patch, "dataType") && patch.dataType !== undefined) {
            nextColumn.dataType = patch.dataType;
          }
          if (hasOwn(patch, "isNullable") && typeof patch.isNullable === "boolean") {
            nextColumn.isNullable = patch.isNullable;
          }
          if (hasOwn(patch, "isUnique") && typeof patch.isUnique === "boolean") {
            nextColumn.isUnique = patch.isUnique;
          }
          if (hasOwn(patch, "defaultValue")) {
            nextColumn.defaultValue = patch.defaultValue ?? null;
          }
          if (hasOwn(patch, "length")) {
            nextColumn.length = patch.length ?? null;
          }
          if (hasOwn(patch, "precision")) {
            nextColumn.precision = patch.precision ?? null;
          }
          if (hasOwn(patch, "scale")) {
            nextColumn.scale = patch.scale ?? null;
          }

          return nextColumn;
        }),
      };
    }),
  };

  const withUniqueConstraints =
    uniqueToggle == null
      ? nextModel
      : applySingleColumnUniqueToggle(nextModel, tableId, columnId, uniqueToggle);

  return normalizeLogicalModelSqlMetadata(withUniqueConstraints);
}

export function formatSqlType(column: LogicalColumn): string {
  const resolved = resolveSqlType(column);

  if (resolved.dataType === "VARCHAR") {
    return `VARCHAR(${resolved.length ?? 100})`;
  }

  if (resolved.dataType === "NUMERIC") {
    const precision = resolved.precision ?? 10;
    const scale = resolved.scale == null ? Math.min(2, precision) : Math.min(resolved.scale, precision);
    return `NUMERIC(${precision},${scale})`;
  }

  return resolved.dataType;
}
