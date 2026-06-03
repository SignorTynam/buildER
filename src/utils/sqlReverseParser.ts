import {
  DEFAULT_SQL_REVERSE_OPTIONS,
  type SqlCheckConstraintDefinition,
  type SqlColumnConstraintDefinition,
  type SqlColumnDefinition,
  type SqlDataTypeDefinition,
  type SqlDefaultValueDefinition,
  type SqlForeignKeyDefinition,
  type SqlIdentifier,
  type SqlPrimaryKeyDefinition,
  type SqlReverseIssue,
  type SqlReverseIssueCode,
  type SqlReverseOptions,
  type SqlReverseParseResult,
  type SqlSchemaModel,
  type SqlSourceSpan,
  type SqlTableDefinition,
  type SqlUniqueConstraintDefinition,
  type SqlUnsupportedConstraintDefinition,
  type SqlUnsupportedStatement,
  type SqlUnsupportedStatementKind,
} from "../types/sqlReverse";

interface ParseContext {
  options: Required<SqlReverseOptions>;
  issues: SqlReverseIssue[];
  nextIssueIndex: number;
}

interface ParsedStatement {
  index: number;
  raw: string;
  cleaned: string;
  start: number;
  end: number;
}

interface ParsedCreateTableName {
  identifier: SqlIdentifier;
  name: string;
  rawName: string;
  schemaName?: string;
}

interface BodyItem {
  text: string;
  start: number;
  end: number;
}

interface ConstraintPrefix {
  name?: string;
  definition: string;
}

interface ParsedReferenceTarget {
  tableName: string;
  schemaName?: string;
  columnNames: string[];
  onDelete?: string;
  onUpdate?: string;
}

interface ConsumedIdentifier {
  identifier: SqlIdentifier;
  length: number;
}

interface ConsumedReferenceTarget extends ParsedCreateTableName {
  tableName: string;
  length: number;
}

const COLUMN_CONSTRAINT_KEYWORDS = [
  "CONSTRAINT",
  "PRIMARY",
  "NOT",
  "NULL",
  "UNIQUE",
  "DEFAULT",
  "REFERENCES",
  "CHECK",
  "GENERATED",
  "AUTO_INCREMENT",
  "AUTOINCREMENT",
  "IDENTITY",
  "COLLATE",
  "DEFERRABLE",
  "INITIALLY",
] as const;

const TABLE_CONSTRAINT_START = /^(?:CONSTRAINT\s+("[^"]+"|`[^`]+`|\[[^\]]+\]|\S+)\s+)?(?:PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK)\b/i;

export function parseSqlSchema(
  sourceSql: string,
  options?: SqlReverseOptions,
): SqlReverseParseResult {
  const resolvedOptions: Required<SqlReverseOptions> = {
    ...DEFAULT_SQL_REVERSE_OPTIONS,
    ...options,
  };
  const context: ParseContext = {
    options: resolvedOptions,
    issues: [],
    nextIssueIndex: 1,
  };
  const statements = splitSqlStatements(sourceSql);
  const tables: SqlTableDefinition[] = [];
  const unsupportedStatements: SqlUnsupportedStatement[] = [];

  statements.forEach((statement) => {
    if (isCreateTableStatement(statement.cleaned)) {
      const table = parseCreateTableStatement(statement, tables.length + 1, context);
      if (table) {
        tables.push(table);
      }
      return;
    }

    const unsupported = buildUnsupportedStatement(statement);
    if (resolvedOptions.preserveUnsupportedStatements) {
      unsupportedStatements.push(unsupported);
    }
    addIssue(context, {
      level: "warning",
      code: unsupportedIssueCode(unsupported.kind),
      message: unsupported.reason,
      statementIndex: statement.index,
      rawFragment: statement.raw,
    });
  });

  validateDuplicateTables(tables, context);
  validateReferences(tables, context);

  const model: SqlSchemaModel = {
    id: "sql-schema-1",
    dialect: resolvedOptions.dialect,
    sourceName: resolvedOptions.sourceName,
    sourceSql,
    tables,
    unsupportedStatements,
    issues: context.issues,
    meta: {
      generatedAt: new Date().toISOString(),
      tableCount: tables.length,
      statementCount: statements.length,
      supportedStatementCount: tables.length,
      unsupportedStatementCount: unsupportedStatements.length,
    },
  };

  return {
    model,
    issues: context.issues,
  };
}

function splitSqlStatements(sourceSql: string): ParsedStatement[] {
  const statements: ParsedStatement[] = [];
  let start = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  let backtickQuoted = false;
  let bracketQuoted = false;
  let lineComment = false;
  let blockComment = false;

  function pushStatement(end: number): void {
    const raw = sourceSql.slice(start, end).trim();
    if (raw.length === 0) {
      start = end + 1;
      return;
    }

    const leadingWhitespace = sourceSql.slice(start, end).search(/\S/);
    const statementStart = start + (leadingWhitespace < 0 ? 0 : leadingWhitespace);
    statements.push({
      index: statements.length,
      raw,
      cleaned: stripSqlComments(raw),
      start: statementStart,
      end,
    });
    start = end + 1;
  }

  for (let index = 0; index < sourceSql.length; index += 1) {
    const char = sourceSql[index] ?? "";
    const next = sourceSql[index + 1] ?? "";

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (!singleQuoted && !doubleQuoted && !backtickQuoted && !bracketQuoted) {
      if (char === "-" && next === "-") {
        lineComment = true;
        index += 1;
        continue;
      }
      if (char === "/" && next === "*") {
        blockComment = true;
        index += 1;
        continue;
      }
    }

    if (singleQuoted) {
      if (char === "'" && next === "'") {
        index += 1;
      } else if (char === "'") {
        singleQuoted = false;
      }
      continue;
    }

    if (doubleQuoted) {
      if (char === "\"" && next === "\"") {
        index += 1;
      } else if (char === "\"") {
        doubleQuoted = false;
      }
      continue;
    }

    if (backtickQuoted) {
      if (char === "`" && next === "`") {
        index += 1;
      } else if (char === "`") {
        backtickQuoted = false;
      }
      continue;
    }

    if (bracketQuoted) {
      if (char === "]" && next === "]") {
        index += 1;
      } else if (char === "]") {
        bracketQuoted = false;
      }
      continue;
    }

    if (char === "'") {
      singleQuoted = true;
      continue;
    }
    if (char === "\"") {
      doubleQuoted = true;
      continue;
    }
    if (char === "`") {
      backtickQuoted = true;
      continue;
    }
    if (char === "[") {
      bracketQuoted = true;
      continue;
    }
    if (char === ";") {
      pushStatement(index);
    }
  }

  pushStatement(sourceSql.length);
  return statements;
}

function stripSqlComments(sql: string): string {
  let result = "";
  let singleQuoted = false;
  let doubleQuoted = false;
  let backtickQuoted = false;
  let bracketQuoted = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index] ?? "";
    const next = sql[index + 1] ?? "";

    if (lineComment) {
      if (char === "\n") {
        lineComment = false;
        result += char;
      } else {
        result += " ";
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        result += "  ";
        blockComment = false;
        index += 1;
      } else {
        result += char === "\n" ? "\n" : " ";
      }
      continue;
    }

    if (!singleQuoted && !doubleQuoted && !backtickQuoted && !bracketQuoted) {
      if (char === "-" && next === "-") {
        result += "  ";
        lineComment = true;
        index += 1;
        continue;
      }
      if (char === "/" && next === "*") {
        result += "  ";
        blockComment = true;
        index += 1;
        continue;
      }
    }

    result += char;

    if (singleQuoted) {
      if (char === "'" && next === "'") {
        result += next;
        index += 1;
      } else if (char === "'") {
        singleQuoted = false;
      }
      continue;
    }
    if (doubleQuoted) {
      if (char === "\"" && next === "\"") {
        result += next;
        index += 1;
      } else if (char === "\"") {
        doubleQuoted = false;
      }
      continue;
    }
    if (backtickQuoted) {
      if (char === "`" && next === "`") {
        result += next;
        index += 1;
      } else if (char === "`") {
        backtickQuoted = false;
      }
      continue;
    }
    if (bracketQuoted) {
      if (char === "]" && next === "]") {
        result += next;
        index += 1;
      } else if (char === "]") {
        bracketQuoted = false;
      }
      continue;
    }

    if (char === "'") {
      singleQuoted = true;
    } else if (char === "\"") {
      doubleQuoted = true;
    } else if (char === "`") {
      backtickQuoted = true;
    } else if (char === "[") {
      bracketQuoted = true;
    }
  }

  return result;
}

function isCreateTableStatement(sql: string): boolean {
  return /^\s*CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\b/i.test(sql);
}

function parseCreateTableStatement(
  statement: ParsedStatement,
  ordinal: number,
  context: ParseContext,
): SqlTableDefinition | null {
  const openParenIndex = findTopLevelChar(statement.cleaned, "(", 0);
  if (openParenIndex < 0) {
    addIssue(context, {
      level: "error",
      code: "INVALID_CREATE_TABLE",
      message: "CREATE TABLE statement is missing a column definition list.",
      statementIndex: statement.index,
      rawFragment: statement.raw,
    });
    return null;
  }

  const closeParenIndex = findMatchingParen(statement.cleaned, openParenIndex);
  if (closeParenIndex < 0) {
    addIssue(context, {
      level: "error",
      code: "INVALID_CREATE_TABLE",
      message: "CREATE TABLE statement has an unterminated column definition list.",
      statementIndex: statement.index,
      rawFragment: statement.raw,
    });
    return null;
  }

  const namePart = statement.cleaned.slice(0, openParenIndex).replace(
    /^\s*CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i,
    "",
  ).trim();
  const tableName = parseCreateTableName(namePart);
  if (!tableName) {
    addIssue(context, {
      level: "error",
      code: "MISSING_TABLE_NAME",
      message: "CREATE TABLE statement is missing a table name.",
      statementIndex: statement.index,
      rawFragment: statement.raw,
    });
    return null;
  }

  const tableId = `sql-table-${ordinal}`;
  const sourceSpan: SqlSourceSpan = {
    start: statement.start,
    end: statement.end,
  };
  const table: SqlTableDefinition = {
    id: tableId,
    name: tableName.name,
    rawName: tableName.rawName,
    schemaName: tableName.schemaName,
    identifier: tableName.identifier,
    columns: [],
    foreignKeys: [],
    uniqueConstraints: [],
    checkConstraints: [],
    unsupportedConstraints: [],
    rawCreateStatement: statement.raw,
    sourceSpan,
  };

  const body = statement.cleaned.slice(openParenIndex + 1, closeParenIndex);
  splitTopLevelComma(body).forEach((item, itemIndex) => {
    parseCreateTableBodyItem({
      item,
      itemIndex,
      table,
      statement,
      bodyOffset: openParenIndex + 1,
      context,
    });
  });
  applyTableConstraintsToColumns(table);
  validateDuplicateColumns(table, context);

  const tableOptions = statement.cleaned.slice(closeParenIndex + 1).trim();
  if (tableOptions.length > 0) {
    addIssue(context, {
      level: "warning",
      code: "UNSUPPORTED_TABLE_OPTION",
      message: `Unsupported CREATE TABLE option: ${tableOptions}`,
      statementIndex: statement.index,
      tableId,
      rawFragment: tableOptions,
    });
  }

  return table;
}

function parseCreateTableBodyItem(input: {
  item: BodyItem;
  itemIndex: number;
  table: SqlTableDefinition;
  statement: ParsedStatement;
  bodyOffset: number;
  context: ParseContext;
}): void {
  const trimmed = input.item.text.trim();
  if (trimmed.length === 0) {
    return;
  }

  if (/^CONSTRAINT\b/i.test(trimmed) || TABLE_CONSTRAINT_START.test(trimmed)) {
    parseTableConstraint(input.table, trimmed, input.itemIndex, input.context, input.statement.index);
    return;
  }

  const column = parseColumnDefinition({
    rawDefinition: trimmed,
    table: input.table,
    columnIndex: input.table.columns.length,
    sourceSpan: {
      start: input.statement.start + input.bodyOffset + input.item.start,
      end: input.statement.start + input.bodyOffset + input.item.end,
    },
    statementIndex: input.statement.index,
    context: input.context,
  });
  if (column) {
    input.table.columns.push(column);
  }
}

function parseColumnDefinition(input: {
  rawDefinition: string;
  table: SqlTableDefinition;
  columnIndex: number;
  sourceSpan: SqlSourceSpan;
  statementIndex: number;
  context: ParseContext;
}): SqlColumnDefinition | null {
  const consumedName = consumeIdentifier(input.rawDefinition);
  if (!consumedName) {
    addIssue(input.context, {
      level: "error",
      code: "MISSING_COLUMN_NAME",
      message: `Column definition is missing a column name in table ${input.table.name}.`,
      statementIndex: input.statementIndex,
      tableId: input.table.id,
      rawFragment: input.rawDefinition,
    });
    return null;
  }

  const rest = input.rawDefinition.slice(consumedName.length).trim();
  const constraintStart = findFirstTopLevelKeyword(rest, COLUMN_CONSTRAINT_KEYWORDS);
  const rawDataType = (constraintStart >= 0 ? rest.slice(0, constraintStart) : rest).trim();
  const constraintText = (constraintStart >= 0 ? rest.slice(constraintStart) : "").trim();
  const columnId = `${input.table.id}-column-${input.columnIndex + 1}`;
  const constraints = parseColumnConstraints({
    text: constraintText,
    columnId,
  });
  const defaultValue = parseDefaultValue(constraintText);
  const hasPrimaryKey = /\bPRIMARY\s+KEY\b/i.test(constraintText);
  const hasForeignKey = /\bREFERENCES\b/i.test(constraintText);
  const hasUnique = /\bUNIQUE\b/i.test(constraintText);
  const hasNotNull = /\bNOT\s+NULL\b/i.test(constraintText);
  const hasExplicitNull = hasStandaloneNullConstraint(constraintText);
  const dataType = rawDataType.length > 0 ? parseDataType(rawDataType) : undefined;

  if (!dataType) {
    addIssue(input.context, {
      level: "warning",
      code: "MISSING_COLUMN_TYPE",
      message: `Column ${consumedName.identifier.name} has no explicit SQL type.`,
      statementIndex: input.statementIndex,
      tableId: input.table.id,
      columnId,
      rawFragment: input.rawDefinition,
    });
  }

  const column: SqlColumnDefinition = {
    id: columnId,
    tableId: input.table.id,
    name: consumedName.identifier.name,
    rawName: consumedName.identifier.rawName,
    identifier: consumedName.identifier,
    dataType,
    isNullable: hasPrimaryKey ? false : !hasNotNull || hasExplicitNull,
    isPrimaryKey: hasPrimaryKey,
    isForeignKey: hasForeignKey,
    isUnique: hasUnique,
    isGenerated: /\bGENERATED\b/i.test(constraintText),
    autoIncrement: /\b(?:AUTO_INCREMENT|AUTOINCREMENT|IDENTITY)\b/i.test(constraintText),
    defaultValue,
    constraints,
    sourceSpan: input.sourceSpan,
    rawDefinition: input.rawDefinition,
  };

  constraints
    .filter((constraint) => constraint.kind === "unsupported")
    .forEach((constraint) => {
      addIssue(input.context, {
        level: "warning",
        code: "UNSUPPORTED_COLUMN_CONSTRAINT",
        message: `Unsupported column constraint on ${input.table.name}.${column.name}.`,
        statementIndex: input.statementIndex,
        tableId: input.table.id,
        columnId,
        constraintId: constraint.id,
        rawFragment: constraint.raw,
      });
    });

  const referenceTarget = hasForeignKey ? parseReferenceTarget(constraintText) : null;
  if (referenceTarget) {
    input.table.foreignKeys.push({
      id: `${input.table.id}-fk-${input.table.foreignKeys.length + 1}`,
      fromTableId: input.table.id,
      fromColumnNames: [column.name],
      toTableName: referenceTarget.tableName,
      toSchemaName: referenceTarget.schemaName,
      toColumnNames: referenceTarget.columnNames,
      onDelete: referenceTarget.onDelete,
      onUpdate: referenceTarget.onUpdate,
      raw: constraintText,
      sourceSpan: input.sourceSpan,
    });
  }

  return column;
}

function parseTableConstraint(
  table: SqlTableDefinition,
  raw: string,
  itemIndex: number,
  context: ParseContext,
  statementIndex: number,
): void {
  const prefixed = parseConstraintPrefix(raw);
  const definition = prefixed.definition.trim();
  const constraintId = `${table.id}-constraint-${itemIndex + 1}`;

  if (/^PRIMARY\s+KEY\b/i.test(definition)) {
    const columnNames = parseFirstColumnList(definition);
    if (columnNames.length === 0) {
      addIssue(context, {
        level: "error",
        code: "INVALID_PRIMARY_KEY",
        message: `Primary key constraint in table ${table.name} has no columns.`,
        statementIndex,
        tableId: table.id,
        constraintId,
        rawFragment: raw,
      });
      return;
    }
    table.primaryKey = {
      id: constraintId,
      name: prefixed.name,
      tableId: table.id,
      columnNames,
      raw,
    };
    return;
  }

  if (/^FOREIGN\s+KEY\b/i.test(definition)) {
    const fromColumnNames = parseFirstColumnList(definition);
    const referenceTarget = parseReferenceTarget(definition);
    if (fromColumnNames.length === 0 || !referenceTarget) {
      addIssue(context, {
        level: "error",
        code: "INVALID_FOREIGN_KEY",
        message: `Foreign key constraint in table ${table.name} is incomplete.`,
        statementIndex,
        tableId: table.id,
        constraintId,
        rawFragment: raw,
      });
      return;
    }
    table.foreignKeys.push({
      id: constraintId,
      name: prefixed.name,
      fromTableId: table.id,
      fromColumnNames,
      toTableName: referenceTarget.tableName,
      toSchemaName: referenceTarget.schemaName,
      toColumnNames: referenceTarget.columnNames,
      onDelete: referenceTarget.onDelete,
      onUpdate: referenceTarget.onUpdate,
      raw,
    });
    return;
  }

  if (/^UNIQUE\b/i.test(definition)) {
    const columnNames = parseFirstColumnList(definition);
    if (columnNames.length === 0) {
      addIssue(context, {
        level: "error",
        code: "INVALID_UNIQUE_CONSTRAINT",
        message: `Unique constraint in table ${table.name} has no columns.`,
        statementIndex,
        tableId: table.id,
        constraintId,
        rawFragment: raw,
      });
      return;
    }
    table.uniqueConstraints.push({
      id: constraintId,
      name: prefixed.name,
      tableId: table.id,
      columnNames,
      raw,
    });
    return;
  }

  if (/^CHECK\b/i.test(definition)) {
    table.checkConstraints.push({
      id: constraintId,
      name: prefixed.name,
      tableId: table.id,
      expression: parseParenthesizedExpression(definition) ?? definition,
      raw,
    });
    return;
  }

  table.unsupportedConstraints.push({
    id: constraintId,
    tableId: table.id,
    kind: "unsupported",
    name: prefixed.name,
    raw,
    reason: "Unsupported table constraint.",
  });
  addIssue(context, {
    level: "warning",
    code: "UNSUPPORTED_TABLE_CONSTRAINT",
    message: `Unsupported table constraint in table ${table.name}.`,
    statementIndex,
    tableId: table.id,
    constraintId,
    rawFragment: raw,
  });
}

function parseConstraintPrefix(raw: string): ConstraintPrefix {
  const trimmed = raw.trim();
  if (!/^CONSTRAINT\b/i.test(trimmed)) {
    return { definition: trimmed };
  }

  const withoutKeyword = trimmed.replace(/^CONSTRAINT\b/i, "").trimStart();
  const consumedName = consumeIdentifier(withoutKeyword);
  if (!consumedName) {
    return { definition: withoutKeyword };
  }

  return {
    name: consumedName.identifier.name,
    definition: withoutKeyword.slice(consumedName.length).trimStart(),
  };
}

function parseColumnConstraints(input: {
  text: string;
  columnId: string;
}): SqlColumnConstraintDefinition[] {
  const text = input.text.trim();
  if (text.length === 0) {
    return [];
  }

  const constraints: SqlColumnConstraintDefinition[] = [];
  let nextIndex = 1;

  function add(kind: SqlColumnConstraintDefinition["kind"], raw: string, name?: string): void {
    constraints.push({
      id: `${input.columnId}-constraint-${nextIndex}`,
      kind,
      name,
      raw: raw.trim(),
    });
    nextIndex += 1;
  }

  if (/\bPRIMARY\s+KEY\b/i.test(text)) {
    add("primary-key", matchRaw(text, /\bPRIMARY\s+KEY\b[^,]*/i));
  }
  if (/\bREFERENCES\b/i.test(text)) {
    add("references", matchRaw(text, /\bREFERENCES\b[\s\S]*/i));
  }
  if (/\bUNIQUE\b/i.test(text)) {
    add("unique", matchRaw(text, /\bUNIQUE\b/i));
  }
  if (/\bNOT\s+NULL\b/i.test(text)) {
    add("not-null", matchRaw(text, /\bNOT\s+NULL\b/i));
  } else if (hasStandaloneNullConstraint(text)) {
    add("null", matchRaw(text, /\bNULL\b/i));
  }
  if (/\bDEFAULT\b/i.test(text)) {
    add("default", parseDefaultClause(text) ?? matchRaw(text, /\bDEFAULT\b[\s\S]*/i));
  }
  if (/\bCHECK\b/i.test(text)) {
    add("check", matchRaw(text, /\bCHECK\b[\s\S]*/i));
  }
  if (/\bGENERATED\b/i.test(text)) {
    add("generated", matchRaw(text, /\bGENERATED\b[\s\S]*/i));
  }
  if (/\b(?:AUTO_INCREMENT|AUTOINCREMENT|IDENTITY)\b/i.test(text)) {
    add("auto-increment", matchRaw(text, /\b(?:AUTO_INCREMENT|AUTOINCREMENT|IDENTITY)\b/i));
  }

  const unsupportedMatch = text.match(/\b(?:COLLATE|DEFERRABLE|INITIALLY|ON\s+CONFLICT)\b/i);
  if (unsupportedMatch) {
    add("unsupported", unsupportedMatch[0]);
  }

  return constraints;
}

function parseDataType(rawDataType: string): SqlDataTypeDefinition {
  const raw = rawDataType.trim();
  const openParenIndex = findTopLevelChar(raw, "(", 0);
  const closeParenIndex = openParenIndex >= 0 ? findMatchingParen(raw, openParenIndex) : -1;
  const name = (openParenIndex >= 0 ? raw.slice(0, openParenIndex) : raw).trim();
  const args =
    openParenIndex >= 0 && closeParenIndex > openParenIndex
      ? splitTopLevelComma(raw.slice(openParenIndex + 1, closeParenIndex))
        .map((part) => Number(part.text.trim()))
        .filter((value) => Number.isFinite(value))
      : [];

  return {
    raw,
    name,
    args,
    normalizedName: name.toUpperCase(),
  };
}

function parseDefaultValue(constraintText: string): SqlDefaultValueDefinition | undefined {
  const raw = parseDefaultClause(constraintText);
  if (!raw) {
    return undefined;
  }

  return {
    raw,
    value: raw.replace(/^DEFAULT\b/i, "").trim(),
  };
}

function parseDefaultClause(text: string): string | null {
  const defaultIndex = findFirstTopLevelKeyword(text, ["DEFAULT"]);
  if (defaultIndex < 0) {
    return null;
  }

  const afterDefaultStart = defaultIndex + "DEFAULT".length;
  const followingKeyword = findFirstTopLevelKeyword(text.slice(afterDefaultStart), [
    "CONSTRAINT",
    "PRIMARY",
    "NOT",
    "NULL",
    "UNIQUE",
    "REFERENCES",
    "CHECK",
    "GENERATED",
    "AUTO_INCREMENT",
    "AUTOINCREMENT",
    "IDENTITY",
    "COLLATE",
    "DEFERRABLE",
    "INITIALLY",
  ]);
  const end = followingKeyword >= 0 ? afterDefaultStart + followingKeyword : text.length;
  return text.slice(defaultIndex, end).trim();
}

function parseCreateTableName(namePart: string): ParsedCreateTableName | null {
  if (namePart.length === 0) {
    return null;
  }

  const parts = splitQualifiedIdentifier(namePart);
  const tableRawName = parts[parts.length - 1]?.trim();
  if (!tableRawName) {
    return null;
  }

  const tableIdentifier = parseIdentifier(tableRawName);
  return {
    identifier: tableIdentifier,
    name: tableIdentifier.name,
    rawName: tableIdentifier.rawName,
    schemaName: parts.length > 1 ? parseIdentifier(parts[parts.length - 2] ?? "").name : undefined,
  };
}

function parseIdentifier(rawIdentifier: string): SqlIdentifier {
  const trimmed = rawIdentifier.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return {
      name: trimmed.slice(1, -1).replace(/""/g, "\""),
      rawName: trimmed,
      quoted: true,
      quoteStyle: "double",
    };
  }
  if (trimmed.startsWith("`") && trimmed.endsWith("`")) {
    return {
      name: trimmed.slice(1, -1).replace(/``/g, "`"),
      rawName: trimmed,
      quoted: true,
      quoteStyle: "backtick",
    };
  }
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return {
      name: trimmed.slice(1, -1).replace(/]]/g, "]"),
      rawName: trimmed,
      quoted: true,
      quoteStyle: "bracket",
    };
  }

  return {
    name: trimmed,
    rawName: trimmed,
    quoted: false,
  };
}

function consumeIdentifier(text: string): ConsumedIdentifier | null {
  const leadingWhitespace = text.match(/^\s*/)?.[0].length ?? 0;
  const trimmed = text.slice(leadingWhitespace);
  if (trimmed.length === 0) {
    return null;
  }

  const first = trimmed[0] ?? "";
  if (first === "\"") {
    const end = findQuotedEnd(trimmed, "\"");
    if (end < 0) {
      return null;
    }
    const rawName = trimmed.slice(0, end + 1);
    return {
      identifier: parseIdentifier(rawName),
      length: leadingWhitespace + rawName.length,
    };
  }
  if (first === "`") {
    const end = findQuotedEnd(trimmed, "`");
    if (end < 0) {
      return null;
    }
    const rawName = trimmed.slice(0, end + 1);
    return {
      identifier: parseIdentifier(rawName),
      length: leadingWhitespace + rawName.length,
    };
  }
  if (first === "[") {
    const end = findBracketQuotedEnd(trimmed);
    if (end < 0) {
      return null;
    }
    const rawName = trimmed.slice(0, end + 1);
    return {
      identifier: parseIdentifier(rawName),
      length: leadingWhitespace + rawName.length,
    };
  }

  const match = trimmed.match(/^[^\s(),]+/);
  if (!match) {
    return null;
  }

  return {
    identifier: parseIdentifier(match[0]),
    length: leadingWhitespace + match[0].length,
  };
}

function splitQualifiedIdentifier(text: string): string[] {
  const parts: string[] = [];
  let start = 0;
  let doubleQuoted = false;
  let backtickQuoted = false;
  let bracketQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const next = text[index + 1] ?? "";

    if (doubleQuoted) {
      if (char === "\"" && next === "\"") {
        index += 1;
      } else if (char === "\"") {
        doubleQuoted = false;
      }
      continue;
    }
    if (backtickQuoted) {
      if (char === "`" && next === "`") {
        index += 1;
      } else if (char === "`") {
        backtickQuoted = false;
      }
      continue;
    }
    if (bracketQuoted) {
      if (char === "]" && next === "]") {
        index += 1;
      } else if (char === "]") {
        bracketQuoted = false;
      }
      continue;
    }

    if (char === "\"") {
      doubleQuoted = true;
    } else if (char === "`") {
      backtickQuoted = true;
    } else if (char === "[") {
      bracketQuoted = true;
    } else if (char === ".") {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }

  parts.push(text.slice(start).trim());
  return parts.filter((part) => part.length > 0);
}

function parseFirstColumnList(text: string): string[] {
  const openParenIndex = findTopLevelChar(text, "(", 0);
  if (openParenIndex < 0) {
    return [];
  }
  const closeParenIndex = findMatchingParen(text, openParenIndex);
  if (closeParenIndex < 0) {
    return [];
  }

  return splitTopLevelComma(text.slice(openParenIndex + 1, closeParenIndex))
    .map((part) => parseIdentifier(part.text.trim()).name)
    .filter((name) => name.length > 0);
}

function parseParenthesizedExpression(text: string): string | null {
  const openParenIndex = findTopLevelChar(text, "(", 0);
  if (openParenIndex < 0) {
    return null;
  }
  const closeParenIndex = findMatchingParen(text, openParenIndex);
  if (closeParenIndex < 0) {
    return null;
  }
  return text.slice(openParenIndex + 1, closeParenIndex).trim();
}

function parseReferenceTarget(text: string): ParsedReferenceTarget | null {
  const referencesIndex = findFirstTopLevelKeyword(text, ["REFERENCES"]);
  if (referencesIndex < 0) {
    return null;
  }

  const afterReferences = text.slice(referencesIndex + "REFERENCES".length).trimStart();
  const target = consumeQualifiedReferenceTarget(afterReferences);
  if (!target) {
    return null;
  }

  const remaining = afterReferences.slice(target.length).trimStart();
  let columnNames: string[] = [];
  let afterColumns = remaining;
  if (remaining.startsWith("(")) {
    const closeParenIndex = findMatchingParen(remaining, 0);
    if (closeParenIndex >= 0) {
      columnNames = splitTopLevelComma(remaining.slice(1, closeParenIndex))
        .map((part) => parseIdentifier(part.text.trim()).name)
        .filter((name) => name.length > 0);
      afterColumns = remaining.slice(closeParenIndex + 1);
    }
  }

  return {
    tableName: target.tableName,
    schemaName: target.schemaName,
    columnNames,
    onDelete: parseReferentialAction(afterColumns, "DELETE"),
    onUpdate: parseReferentialAction(afterColumns, "UPDATE"),
  };
}

function consumeQualifiedReferenceTarget(text: string): ConsumedReferenceTarget | null {
  let end = 0;
  let doubleQuoted = false;
  let backtickQuoted = false;
  let bracketQuoted = false;

  for (; end < text.length; end += 1) {
    const char = text[end] ?? "";
    const next = text[end + 1] ?? "";
    if (doubleQuoted) {
      if (char === "\"" && next === "\"") {
        end += 1;
      } else if (char === "\"") {
        doubleQuoted = false;
      }
      continue;
    }
    if (backtickQuoted) {
      if (char === "`" && next === "`") {
        end += 1;
      } else if (char === "`") {
        backtickQuoted = false;
      }
      continue;
    }
    if (bracketQuoted) {
      if (char === "]" && next === "]") {
        end += 1;
      } else if (char === "]") {
        bracketQuoted = false;
      }
      continue;
    }

    if (char === "\"") {
      doubleQuoted = true;
      continue;
    }
    if (char === "`") {
      backtickQuoted = true;
      continue;
    }
    if (char === "[") {
      bracketQuoted = true;
      continue;
    }
    if (/\s|\(/.test(char)) {
      break;
    }
  }

  const parsed = parseCreateTableName(text.slice(0, end));
  return parsed ? { ...parsed, tableName: parsed.name, length: end } : null;
}

function parseReferentialAction(text: string, action: "DELETE" | "UPDATE"): string | undefined {
  const match = text.match(new RegExp(`\\bON\\s+${action}\\s+(CASCADE|RESTRICT|SET\\s+NULL|SET\\s+DEFAULT|NO\\s+ACTION)\\b`, "i"));
  return match?.[1]?.toUpperCase();
}

function applyTableConstraintsToColumns(table: SqlTableDefinition): void {
  if (!table.primaryKey) {
    const inlinePrimaryKeyColumns = table.columns.filter((column) => column.isPrimaryKey);
    if (inlinePrimaryKeyColumns.length > 0) {
      table.primaryKey = {
        id: `${table.id}-inline-primary-key`,
        tableId: table.id,
        columnNames: inlinePrimaryKeyColumns.map((column) => column.name),
      };
    }
  }

  table.primaryKey?.columnNames.forEach((columnName) => {
    const column = findColumnByName(table, columnName);
    if (column) {
      column.isPrimaryKey = true;
      column.isNullable = false;
    }
  });

  table.foreignKeys.forEach((foreignKey) => {
    foreignKey.fromColumnNames.forEach((columnName) => {
      const column = findColumnByName(table, columnName);
      if (column) {
        column.isForeignKey = true;
      }
    });
  });

  table.uniqueConstraints.forEach((constraint) => {
    if (constraint.columnNames.length !== 1) {
      return;
    }
    const column = findColumnByName(table, constraint.columnNames[0] ?? "");
    if (column) {
      column.isUnique = true;
    }
  });
}

function validateDuplicateTables(tables: SqlTableDefinition[], context: ParseContext): void {
  const seen = new Map<string, SqlTableDefinition>();
  tables.forEach((table) => {
    const key = tableKey(table.schemaName, table.name);
    const previous = seen.get(key);
    if (previous) {
      addIssue(context, {
        level: "error",
        code: "DUPLICATE_TABLE_NAME",
        message: `Duplicate table name ${table.name}.`,
        tableId: table.id,
        rawFragment: table.rawName,
      });
      return;
    }
    seen.set(key, table);
  });
}

function validateDuplicateColumns(table: SqlTableDefinition, context: ParseContext): void {
  const seen = new Map<string, SqlColumnDefinition>();
  table.columns.forEach((column) => {
    const key = normalizeSqlName(column.name);
    const previous = seen.get(key);
    if (previous) {
      addIssue(context, {
        level: "error",
        code: "DUPLICATE_COLUMN_NAME",
        message: `Duplicate column name ${column.name} in table ${table.name}.`,
        tableId: table.id,
        columnId: column.id,
        rawFragment: column.rawName,
      });
      return;
    }
    seen.set(key, column);
  });
}

function validateReferences(tables: SqlTableDefinition[], context: ParseContext): void {
  tables.forEach((table) => {
    table.foreignKeys.forEach((foreignKey) => {
      const targetTable = tables.find((candidate) => tableKey(candidate.schemaName, candidate.name) === tableKey(foreignKey.toSchemaName, foreignKey.toTableName))
        ?? tables.find((candidate) => normalizeSqlName(candidate.name) === normalizeSqlName(foreignKey.toTableName));
      if (!targetTable) {
        addIssue(context, {
          level: "error",
          code: "UNRESOLVED_REFERENCE",
          message: `Foreign key references unknown table ${foreignKey.toTableName}.`,
          tableId: table.id,
          constraintId: foreignKey.id,
          rawFragment: foreignKey.raw,
        });
        return;
      }

      foreignKey.toColumnNames.forEach((columnName) => {
        if (!findColumnByName(targetTable, columnName)) {
          addIssue(context, {
            level: "error",
            code: "UNRESOLVED_REFERENCE",
            message: `Foreign key references unknown column ${targetTable.name}.${columnName}.`,
            tableId: table.id,
            constraintId: foreignKey.id,
            rawFragment: foreignKey.raw,
          });
        }
      });
    });
  });
}

function buildUnsupportedStatement(statement: ParsedStatement): SqlUnsupportedStatement {
  const kind = classifyUnsupportedStatement(statement.cleaned);
  return {
    id: `sql-unsupported-statement-${statement.index + 1}`,
    kind,
    raw: statement.raw,
    reason: unsupportedStatementReason(kind),
    sourceSpan: {
      start: statement.start,
      end: statement.end,
    },
  };
}

function classifyUnsupportedStatement(sql: string): SqlUnsupportedStatementKind {
  if (/^\s*ALTER\s+TABLE\b/i.test(sql)) {
    return "alter-table";
  }
  if (/^\s*CREATE\s+(?:UNIQUE\s+)?INDEX\b/i.test(sql)) {
    return "create-index";
  }
  if (/^\s*CREATE\s+VIEW\b/i.test(sql)) {
    return "create-view";
  }
  if (/^\s*CREATE\s+TRIGGER\b/i.test(sql)) {
    return "create-trigger";
  }
  if (/^\s*INSERT\b/i.test(sql)) {
    return "insert";
  }
  if (/^\s*UPDATE\b/i.test(sql)) {
    return "update";
  }
  if (/^\s*DELETE\b/i.test(sql)) {
    return "delete";
  }
  if (/^\s*DROP\b/i.test(sql)) {
    return "drop";
  }
  return "other";
}

function unsupportedIssueCode(kind: SqlUnsupportedStatementKind): SqlReverseIssueCode {
  if (kind === "alter-table") {
    return "UNSUPPORTED_ALTER_TABLE";
  }
  if (kind === "create-index") {
    return "UNSUPPORTED_INDEX";
  }
  return "UNSUPPORTED_STATEMENT";
}

function unsupportedStatementReason(kind: SqlUnsupportedStatementKind): string {
  switch (kind) {
    case "alter-table":
      return "ALTER TABLE is not supported by the lightweight SQL reverse parser yet.";
    case "create-index":
      return "CREATE INDEX is not converted in this phase.";
    case "create-view":
      return "CREATE VIEW is outside the schema table parser scope.";
    case "create-trigger":
      return "CREATE TRIGGER is outside the schema table parser scope.";
    case "insert":
    case "update":
    case "delete":
      return "DML statements are ignored by the schema parser.";
    case "drop":
      return "DROP statements are ignored by the schema parser.";
    case "other":
      return "Statement is not supported by the lightweight SQL reverse parser yet.";
  }
}

function addIssue(
  context: ParseContext,
  issue: Omit<SqlReverseIssue, "id">,
): void {
  context.issues.push({
    id: `sql-reverse-issue-${context.nextIssueIndex}`,
    ...issue,
  });
  context.nextIssueIndex += 1;
}

function splitTopLevelComma(text: string): BodyItem[] {
  const parts: BodyItem[] = [];
  let start = 0;
  let depth = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  let backtickQuoted = false;
  let bracketQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const next = text[index + 1] ?? "";

    if (singleQuoted) {
      if (char === "'" && next === "'") {
        index += 1;
      } else if (char === "'") {
        singleQuoted = false;
      }
      continue;
    }
    if (doubleQuoted) {
      if (char === "\"" && next === "\"") {
        index += 1;
      } else if (char === "\"") {
        doubleQuoted = false;
      }
      continue;
    }
    if (backtickQuoted) {
      if (char === "`" && next === "`") {
        index += 1;
      } else if (char === "`") {
        backtickQuoted = false;
      }
      continue;
    }
    if (bracketQuoted) {
      if (char === "]" && next === "]") {
        index += 1;
      } else if (char === "]") {
        bracketQuoted = false;
      }
      continue;
    }

    if (char === "'") {
      singleQuoted = true;
      continue;
    }
    if (char === "\"") {
      doubleQuoted = true;
      continue;
    }
    if (char === "`") {
      backtickQuoted = true;
      continue;
    }
    if (char === "[") {
      bracketQuoted = true;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char === "," && depth === 0) {
      parts.push({
        text: text.slice(start, index),
        start,
        end: index,
      });
      start = index + 1;
    }
  }

  parts.push({
    text: text.slice(start),
    start,
    end: text.length,
  });
  return parts;
}

function findTopLevelChar(text: string, target: string, start: number): number {
  let singleQuoted = false;
  let doubleQuoted = false;
  let backtickQuoted = false;
  let bracketQuoted = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (singleQuoted) {
      if (char === "'" && next === "'") {
        index += 1;
      } else if (char === "'") {
        singleQuoted = false;
      }
      continue;
    }
    if (doubleQuoted) {
      if (char === "\"" && next === "\"") {
        index += 1;
      } else if (char === "\"") {
        doubleQuoted = false;
      }
      continue;
    }
    if (backtickQuoted) {
      if (char === "`" && next === "`") {
        index += 1;
      } else if (char === "`") {
        backtickQuoted = false;
      }
      continue;
    }
    if (bracketQuoted) {
      if (char === "]" && next === "]") {
        index += 1;
      } else if (char === "]") {
        bracketQuoted = false;
      }
      continue;
    }

    if (char === "'") {
      singleQuoted = true;
    } else if (char === "\"") {
      doubleQuoted = true;
    } else if (char === "`") {
      backtickQuoted = true;
    } else if (char === "[") {
      bracketQuoted = true;
    } else if (char === target) {
      return index;
    }
  }

  return -1;
}

function findMatchingParen(text: string, openParenIndex: number): number {
  let depth = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  let backtickQuoted = false;
  let bracketQuoted = false;

  for (let index = openParenIndex; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (singleQuoted) {
      if (char === "'" && next === "'") {
        index += 1;
      } else if (char === "'") {
        singleQuoted = false;
      }
      continue;
    }
    if (doubleQuoted) {
      if (char === "\"" && next === "\"") {
        index += 1;
      } else if (char === "\"") {
        doubleQuoted = false;
      }
      continue;
    }
    if (backtickQuoted) {
      if (char === "`" && next === "`") {
        index += 1;
      } else if (char === "`") {
        backtickQuoted = false;
      }
      continue;
    }
    if (bracketQuoted) {
      if (char === "]" && next === "]") {
        index += 1;
      } else if (char === "]") {
        bracketQuoted = false;
      }
      continue;
    }

    if (char === "'") {
      singleQuoted = true;
    } else if (char === "\"") {
      doubleQuoted = true;
    } else if (char === "`") {
      backtickQuoted = true;
    } else if (char === "[") {
      bracketQuoted = true;
    } else if (char === "(") {
      depth += 1;
    } else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function findFirstTopLevelKeyword(text: string, keywords: readonly string[]): number {
  let depth = 0;
  let singleQuoted = false;
  let doubleQuoted = false;
  let backtickQuoted = false;
  let bracketQuoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (singleQuoted) {
      if (char === "'" && next === "'") {
        index += 1;
      } else if (char === "'") {
        singleQuoted = false;
      }
      continue;
    }
    if (doubleQuoted) {
      if (char === "\"" && next === "\"") {
        index += 1;
      } else if (char === "\"") {
        doubleQuoted = false;
      }
      continue;
    }
    if (backtickQuoted) {
      if (char === "`" && next === "`") {
        index += 1;
      } else if (char === "`") {
        backtickQuoted = false;
      }
      continue;
    }
    if (bracketQuoted) {
      if (char === "]" && next === "]") {
        index += 1;
      } else if (char === "]") {
        bracketQuoted = false;
      }
      continue;
    }

    if (char === "'") {
      singleQuoted = true;
      continue;
    }
    if (char === "\"") {
      doubleQuoted = true;
      continue;
    }
    if (char === "`") {
      backtickQuoted = true;
      continue;
    }
    if (char === "[") {
      bracketQuoted = true;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth !== 0 || !isWordBoundary(text[index - 1])) {
      continue;
    }

    const match = keywords.find((keyword) => {
      const candidate = text.slice(index, index + keyword.length);
      return candidate.toUpperCase() === keyword && isWordBoundary(text[index + keyword.length]);
    });
    if (match) {
      return index;
    }
  }

  return -1;
}

function hasStandaloneNullConstraint(text: string): boolean {
  return /\bNULL\b/i.test(text) && !/\bNOT\s+NULL\b/i.test(text);
}

function matchRaw(text: string, regex: RegExp): string {
  return text.match(regex)?.[0] ?? text;
}

function findQuotedEnd(text: string, quote: "\"" | "`"): number {
  for (let index = 1; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (char === quote && next === quote) {
      index += 1;
    } else if (char === quote) {
      return index;
    }
  }
  return -1;
}

function findBracketQuotedEnd(text: string): number {
  for (let index = 1; index < text.length; index += 1) {
    const char = text[index] ?? "";
    const next = text[index + 1] ?? "";
    if (char === "]" && next === "]") {
      index += 1;
    } else if (char === "]") {
      return index;
    }
  }
  return -1;
}

function findColumnByName(table: SqlTableDefinition, columnName: string): SqlColumnDefinition | undefined {
  const normalized = normalizeSqlName(columnName);
  return table.columns.find((column) => normalizeSqlName(column.name) === normalized);
}

function normalizeSqlName(value: string): string {
  return value.trim().toLowerCase();
}

function tableKey(schemaName: string | undefined, tableName: string): string {
  return `${normalizeSqlName(schemaName ?? "")}.${normalizeSqlName(tableName)}`;
}

function isWordBoundary(char: string | undefined): boolean {
  return char === undefined || !/[A-Za-z0-9_$]/.test(char);
}
