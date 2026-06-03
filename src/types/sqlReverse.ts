export type SqlReverseDialect =
  | "generic"
  | "sqlite"
  | "postgresql"
  | "mysql"
  | "sqlserver";

export type SqlReverseIssueLevel = "warning" | "error";

export type SqlReverseIssueCode =
  | "UNSUPPORTED_STATEMENT"
  | "UNSUPPORTED_TABLE_OPTION"
  | "UNSUPPORTED_COLUMN_CONSTRAINT"
  | "UNSUPPORTED_TABLE_CONSTRAINT"
  | "DUPLICATE_TABLE_NAME"
  | "DUPLICATE_COLUMN_NAME"
  | "MISSING_TABLE_NAME"
  | "MISSING_COLUMN_NAME"
  | "MISSING_COLUMN_TYPE"
  | "INVALID_CREATE_TABLE"
  | "INVALID_PRIMARY_KEY"
  | "INVALID_FOREIGN_KEY"
  | "INVALID_UNIQUE_CONSTRAINT"
  | "UNRESOLVED_REFERENCE"
  | "UNSUPPORTED_ALTER_TABLE"
  | "UNSUPPORTED_INDEX"
  | "PARSER_RECOVERY";

/** Problem collected while turning raw SQL into the intermediate schema model. */
export interface SqlReverseIssue {
  id: string;
  level: SqlReverseIssueLevel;
  code: SqlReverseIssueCode;
  message: string;
  statementIndex?: number;
  tableId?: string;
  columnId?: string;
  constraintId?: string;
  rawFragment?: string;
}

export interface SqlSourceSpan {
  start: number;
  end: number;
  line?: number;
  column?: number;
}

export interface SqlIdentifier {
  name: string;
  rawName: string;
  quoted: boolean;
  quoteStyle?: "double" | "backtick" | "bracket";
}

export interface SqlDataTypeDefinition {
  raw: string;
  name: string;
  args: number[];
  normalizedName?: string;
}

export interface SqlDefaultValueDefinition {
  raw: string;
  value?: string;
}

/** Column-level SQL definition normalized enough for later logical and ER conversion. */
export interface SqlColumnDefinition {
  id: string;
  tableId: string;
  name: string;
  rawName: string;
  identifier: SqlIdentifier;
  dataType?: SqlDataTypeDefinition;
  isNullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  isUnique: boolean;
  isGenerated?: boolean;
  autoIncrement?: boolean;
  defaultValue?: SqlDefaultValueDefinition;
  constraints: SqlColumnConstraintDefinition[];
  sourceSpan?: SqlSourceSpan;
  rawDefinition?: string;
}

export type SqlColumnConstraintKind =
  | "primary-key"
  | "foreign-key"
  | "unique"
  | "not-null"
  | "null"
  | "default"
  | "check"
  | "references"
  | "generated"
  | "auto-increment"
  | "unsupported";

export interface SqlColumnConstraintDefinition {
  id: string;
  kind: SqlColumnConstraintKind;
  name?: string;
  raw: string;
  sourceSpan?: SqlSourceSpan;
}

export interface SqlPrimaryKeyDefinition {
  id: string;
  name?: string;
  tableId: string;
  columnNames: string[];
  raw?: string;
  sourceSpan?: SqlSourceSpan;
}

/** Foreign key metadata, including referential actions needed by later conversions. */
export interface SqlForeignKeyDefinition {
  id: string;
  name?: string;
  fromTableId: string;
  fromColumnNames: string[];
  toTableName: string;
  toSchemaName?: string;
  toColumnNames: string[];
  onDelete?: string;
  onUpdate?: string;
  raw?: string;
  sourceSpan?: SqlSourceSpan;
}

export interface SqlUniqueConstraintDefinition {
  id: string;
  name?: string;
  tableId: string;
  columnNames: string[];
  raw?: string;
  sourceSpan?: SqlSourceSpan;
}

export interface SqlCheckConstraintDefinition {
  id: string;
  name?: string;
  tableId: string;
  expression: string;
  raw?: string;
  sourceSpan?: SqlSourceSpan;
}

export type SqlTableConstraintKind =
  | "primary-key"
  | "foreign-key"
  | "unique"
  | "check"
  | "unsupported";

export type SqlTableConstraintDefinition =
  | SqlPrimaryKeyDefinition
  | SqlForeignKeyDefinition
  | SqlUniqueConstraintDefinition
  | SqlCheckConstraintDefinition
  | SqlUnsupportedConstraintDefinition;

export interface SqlUnsupportedConstraintDefinition {
  id: string;
  tableId: string;
  kind: "unsupported";
  name?: string;
  raw: string;
  reason?: string;
  sourceSpan?: SqlSourceSpan;
}

/** Table extracted from CREATE TABLE, with parsed columns and table-level constraints. */
export interface SqlTableDefinition {
  id: string;
  name: string;
  rawName: string;
  schemaName?: string;
  identifier: SqlIdentifier;
  columns: SqlColumnDefinition[];
  primaryKey?: SqlPrimaryKeyDefinition;
  foreignKeys: SqlForeignKeyDefinition[];
  uniqueConstraints: SqlUniqueConstraintDefinition[];
  checkConstraints: SqlCheckConstraintDefinition[];
  unsupportedConstraints: SqlUnsupportedConstraintDefinition[];
  rawCreateStatement?: string;
  sourceSpan?: SqlSourceSpan;
}

export type SqlUnsupportedStatementKind =
  | "alter-table"
  | "create-index"
  | "create-view"
  | "create-trigger"
  | "insert"
  | "update"
  | "delete"
  | "drop"
  | "other";

export interface SqlUnsupportedStatement {
  id: string;
  kind: SqlUnsupportedStatementKind;
  raw: string;
  reason: string;
  sourceSpan?: SqlSourceSpan;
}

/** Complete intermediate representation produced from a SQL schema source. */
export interface SqlSchemaModel {
  id: string;
  dialect: SqlReverseDialect;
  sourceName?: string;
  sourceSql: string;
  tables: SqlTableDefinition[];
  unsupportedStatements: SqlUnsupportedStatement[];
  issues: SqlReverseIssue[];
  meta: {
    generatedAt: string;
    tableCount: number;
    statementCount: number;
    supportedStatementCount: number;
    unsupportedStatementCount: number;
  };
}

export interface SqlReverseParseResult {
  model: SqlSchemaModel;
  issues: SqlReverseIssue[];
}

/** Options reserved for the SQL reverse-engineering pipeline and later conversions. */
export interface SqlReverseOptions {
  dialect?: SqlReverseDialect;
  sourceName?: string;
  preserveUnsupportedStatements?: boolean;
  inferManyToManyTables?: boolean;
  keepForeignKeyColumnsAsAttributes?: boolean;
}

export const DEFAULT_SQL_REVERSE_OPTIONS: Required<SqlReverseOptions> = {
  dialect: "generic",
  sourceName: "Imported SQL schema",
  preserveUnsupportedStatements: true,
  inferManyToManyTables: true,
  keepForeignKeyColumnsAsAttributes: true,
};

export type SqlReverseObjectKind =
  | "schema"
  | "table"
  | "column"
  | "primary-key"
  | "foreign-key"
  | "unique"
  | "check"
  | "unsupported";

export interface SqlReverseObjectRef {
  kind: SqlReverseObjectKind;
  id: string;
  label: string;
}
