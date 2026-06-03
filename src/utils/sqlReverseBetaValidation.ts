import type { SqlReverseIssue } from "../types/sqlReverse";
import { parseSqlSchema } from "./sqlReverseParser";

export interface SqlReverseBetaValidationResult {
  ok: boolean;
  normalizedSql: string;
  errorMessage: string;
  issues: SqlReverseIssue[];
  unsupportedStatementCount: number;
}

export const SQL_REVERSE_BETA_UNSUPPORTED_MESSAGE =
  "La beta accetta solo CREATE TABLE. Rimuovi gli statement non supportati e riprova.";

export function validateSqlReverseBetaSource(sourceSql: string): SqlReverseBetaValidationResult {
  const normalizedSql = sourceSql.trim();

  if (!normalizedSql) {
    return {
      ok: false,
      normalizedSql,
      errorMessage: "Incolla uno schema SQL prima di analizzarlo.",
      issues: [],
      unsupportedStatementCount: 0,
    };
  }

  if (!/\bCREATE\s+TABLE\b/i.test(normalizedSql)) {
    return {
      ok: false,
      normalizedSql,
      errorMessage: "Incolla almeno una istruzione CREATE TABLE prima di analizzare lo schema.",
      issues: [],
      unsupportedStatementCount: 0,
    };
  }

  const parsed = parseSqlSchema(normalizedSql, { preserveUnsupportedStatements: true });
  if (parsed.model.unsupportedStatements.length > 0) {
    return {
      ok: false,
      normalizedSql,
      errorMessage: SQL_REVERSE_BETA_UNSUPPORTED_MESSAGE,
      issues: parsed.issues,
      unsupportedStatementCount: parsed.model.unsupportedStatements.length,
    };
  }

  return {
    ok: true,
    normalizedSql,
    errorMessage: "",
    issues: parsed.issues,
    unsupportedStatementCount: 0,
  };
}
