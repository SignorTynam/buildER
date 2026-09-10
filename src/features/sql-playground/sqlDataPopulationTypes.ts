export const SQL_POPULATION_DEFAULT_ROWS = 20;
export const SQL_POPULATION_MIN_ROWS = 1;
export const SQL_POPULATION_MAX_ROWS = 100;
export const SQL_POPULATION_DEFAULT_SEED = 42;
export const SQL_POPULATION_MIN_SEED = 0;
export const SQL_POPULATION_MAX_SEED = 0xffff_ffff;

export type SqlPopulationAffinity = "INTEGER" | "TEXT" | "BLOB" | "REAL" | "NUMERIC";
export type SqlPopulationValue = string | number | bigint | null | Uint8Array;

export interface SqlPopulationConfig {
  rowsPerTable: number;
  seed: number;
}

export type SqlPopulationErrorCode =
  | "population-session-not-generated"
  | "population-database-not-ready"
  | "population-database-not-empty"
  | "population-schema-stale"
  | "population-plan-stale"
  | "population-unresolved-foreign-key"
  | "population-invalid-foreign-key-target"
  | "population-unsatisfiable-unique"
  | "population-unsupported-generated-key"
  | "population-unsupported-unique-index"
  | "population-foreign-key-check-failed"
  | "population-invalid-config"
  | "population-apply-failed";

export interface SqlPopulationMessageContext {
  [key: string]: string | number;
}

export interface SqlPopulationWarning {
  code: "population-row-limit";
  tableName: string;
  messageContext: SqlPopulationMessageContext;
}

export interface SqlPopulationTableSummary {
  tableName: string;
  requestedRows: number;
  generatedRows: number;
}

export interface SqlPopulationPlanPreview {
  planId: string;
  sessionId: string;
  seed: number;
  rowsPerTable: number;
  schemaSignature: string;
  tableCount: number;
  totalRows: number;
  tables: SqlPopulationTableSummary[];
  warnings: SqlPopulationWarning[];
  previewSql: string;
}

export interface SqlPopulationTableRows {
  tableName: string;
  columns: string[];
  rows: SqlPopulationValue[][];
}

export interface SqlPopulationRowCount {
  tableName: string;
  rowCount: number;
}

export interface SqlPopulationPlan extends SqlPopulationPlanPreview {
  tableOrder: string[];
  tableRows: SqlPopulationTableRows[];
  preconditionRowCounts: SqlPopulationRowCount[];
  usesDeferredForeignKeys: boolean;
}

export interface SqlPopulationApplyResult {
  planId: string;
  sessionId: string;
  tableCount: number;
  rowsInserted: number;
}

export class SqlPopulationError extends Error {
  readonly code: SqlPopulationErrorCode;
  readonly context: SqlPopulationMessageContext;
  readonly technicalDetail?: string;

  constructor(
    code: SqlPopulationErrorCode,
    message: string,
    context: SqlPopulationMessageContext = {},
    technicalDetail?: string,
  ) {
    super(message);
    this.name = "SqlPopulationError";
    this.code = code;
    this.context = context;
    this.technicalDetail = technicalDetail;
  }
}
