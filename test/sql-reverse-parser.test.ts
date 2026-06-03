import assert from "node:assert/strict";
import test from "node:test";

import { parseSqlSchema } from "../src/utils/sqlReverseParser.ts";

test("sql reverse parser: parses create table columns and inline constraints", () => {
  const result = parseSqlSchema(`
    CREATE TABLE Student (
      id INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  assert.equal(result.model.dialect, "generic");
  assert.equal(result.model.tables.length, 1);
  assert.equal(result.model.meta.tableCount, 1);
  assert.equal(result.model.meta.statementCount, 1);
  assert.equal(result.issues.length, 0);

  const table = result.model.tables[0];
  assert.equal(table?.name, "Student");
  assert.equal(table?.primaryKey?.columnNames[0], "id");
  assert.deepEqual(
    table?.columns.map((column) => [column.name, column.dataType?.name, column.dataType?.args, column.isPrimaryKey, column.isNullable, column.isUnique]),
    [
      ["id", "INTEGER", [], true, false, false],
      ["name", "VARCHAR", [255], false, false, false],
      ["email", "TEXT", [], false, true, true],
      ["created_at", "DATETIME", [], false, true, false],
    ],
  );
  assert.equal(table?.columns[3]?.defaultValue?.raw, "DEFAULT CURRENT_TIMESTAMP");
});

test("sql reverse parser: parses table-level primary key, foreign key, unique and check", () => {
  const result = parseSqlSchema(`
    CREATE TABLE Course (
      id INTEGER PRIMARY KEY,
      code TEXT UNIQUE
    );

    CREATE TABLE Enrollment (
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      grade NUMERIC(4, 2),
      CONSTRAINT pk_enrollment PRIMARY KEY (student_id, course_id),
      CONSTRAINT fk_enrollment_course FOREIGN KEY (course_id) REFERENCES Course(id) ON DELETE CASCADE ON UPDATE NO ACTION,
      UNIQUE (student_id, grade),
      CHECK (grade >= 0)
    );
  `);

  assert.equal(result.issues.length, 0);
  const enrollment = result.model.tables.find((table) => table.name === "Enrollment");
  assert.ok(enrollment);
  assert.deepEqual(enrollment.primaryKey?.columnNames, ["student_id", "course_id"]);
  assert.equal(enrollment.columns.find((column) => column.name === "student_id")?.isPrimaryKey, true);
  assert.equal(enrollment.columns.find((column) => column.name === "course_id")?.isForeignKey, true);
  assert.equal(enrollment.foreignKeys.length, 1);
  assert.equal(enrollment.foreignKeys[0]?.name, "fk_enrollment_course");
  assert.deepEqual(enrollment.foreignKeys[0]?.fromColumnNames, ["course_id"]);
  assert.equal(enrollment.foreignKeys[0]?.toTableName, "Course");
  assert.deepEqual(enrollment.foreignKeys[0]?.toColumnNames, ["id"]);
  assert.equal(enrollment.foreignKeys[0]?.onDelete, "CASCADE");
  assert.equal(enrollment.foreignKeys[0]?.onUpdate, "NO ACTION");
  assert.deepEqual(enrollment.uniqueConstraints[0]?.columnNames, ["student_id", "grade"]);
  assert.equal(enrollment.checkConstraints[0]?.expression, "grade >= 0");
});

test("sql reverse parser: preserves quoted identifiers and schema names", () => {
  const result = parseSqlSchema(
    'CREATE TABLE "school"."Student Profile" (`Student Id` INTEGER PRIMARY KEY, [Display Name] VARCHAR(80));',
    { dialect: "postgresql", sourceName: "quoted.sql" },
  );

  const table = result.model.tables[0];
  assert.equal(result.model.dialect, "postgresql");
  assert.equal(result.model.sourceName, "quoted.sql");
  assert.equal(table?.schemaName, "school");
  assert.equal(table?.name, "Student Profile");
  assert.equal(table?.identifier.quoted, true);
  assert.equal(table?.identifier.quoteStyle, "double");
  assert.equal(table?.columns[0]?.name, "Student Id");
  assert.equal(table?.columns[0]?.identifier.quoteStyle, "backtick");
  assert.equal(table?.columns[1]?.name, "Display Name");
  assert.equal(table?.columns[1]?.identifier.quoteStyle, "bracket");
});

test("sql reverse parser: records unsupported statements without parsing UI or conversion artifacts", () => {
  const result = parseSqlSchema(`
    CREATE TABLE Student (id INTEGER);
    CREATE INDEX idx_student_id ON Student(id);
    ALTER TABLE Student ADD COLUMN name TEXT;
    INSERT INTO Student(id) VALUES (1);
  `);

  assert.equal(result.model.tables.length, 1);
  assert.deepEqual(
    result.model.unsupportedStatements.map((statement) => statement.kind),
    ["create-index", "alter-table", "insert"],
  );
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["UNSUPPORTED_INDEX", "UNSUPPORTED_ALTER_TABLE", "UNSUPPORTED_STATEMENT"],
  );
  assert.equal(result.model.meta.supportedStatementCount, 1);
  assert.equal(result.model.meta.unsupportedStatementCount, 3);
});

test("sql reverse parser: can omit unsupported statement preservation while keeping issues", () => {
  const result = parseSqlSchema("DROP TABLE Student;", { preserveUnsupportedStatements: false });

  assert.equal(result.model.unsupportedStatements.length, 0);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "UNSUPPORTED_STATEMENT");
});

test("sql reverse parser: reports duplicates and unresolved references", () => {
  const result = parseSqlSchema(`
    CREATE TABLE Student (
      id INTEGER,
      id TEXT
    );
    CREATE TABLE Student (
      other_id INTEGER REFERENCES MissingTable(id)
    );
  `);

  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["DUPLICATE_COLUMN_NAME", "DUPLICATE_TABLE_NAME", "UNRESOLVED_REFERENCE"],
  );
});

test("sql reverse parser: reports unsupported column and table constraints", () => {
  const result = parseSqlSchema(`
    CREATE TABLE Student (
      id INTEGER COLLATE nocase,
      CONSTRAINT unsupported_constraint EXCLUDE (id WITH =)
    );
  `);

  const table = result.model.tables[0];
  assert.equal(table?.unsupportedConstraints.length, 1);
  assert.equal(table?.columns[0]?.constraints.some((constraint) => constraint.kind === "unsupported"), true);
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ["UNSUPPORTED_COLUMN_CONSTRAINT", "UNSUPPORTED_TABLE_CONSTRAINT"],
  );
});

test("sql reverse parser: keeps commas inside types, defaults and checks", () => {
  const result = parseSqlSchema(`
    CREATE TABLE Invoice (
      id INTEGER PRIMARY KEY,
      amount NUMERIC(10, 2) DEFAULT ROUND(0, 2),
      note TEXT CHECK (note IN ('a,b', 'c'))
    );
  `);

  const invoice = result.model.tables[0];
  assert.deepEqual(invoice?.columns[1]?.dataType?.args, [10, 2]);
  assert.equal(invoice?.columns[1]?.defaultValue?.value, "ROUND(0, 2)");
  assert.equal(invoice?.columns[2]?.constraints.some((constraint) => constraint.kind === "check"), true);
});

test("sql reverse parser: keeps semicolons inside string defaults", () => {
  const result = parseSqlSchema(`
    CREATE TABLE MessageTemplate (
      id INTEGER PRIMARY KEY,
      body TEXT DEFAULT 'hello; goodbye'
    );
  `);

  assert.equal(result.model.meta.statementCount, 1);
  assert.equal(result.model.tables.length, 1);
  assert.equal(result.issues.length, 0);
  assert.equal(result.model.tables[0]?.columns[1]?.defaultValue?.value, "'hello; goodbye'");
});

test("sql reverse parser: comments do not break foreign key parsing", () => {
  const result = parseSqlSchema(`
    -- Referenced table.
    CREATE TABLE Department (
      id INTEGER PRIMARY KEY
    );

    CREATE TABLE Employee (
      id INTEGER PRIMARY KEY,
      department_id INTEGER, -- nullable by design
      /* table-level relationship */
      FOREIGN KEY (department_id) REFERENCES Department(id)
    );
  `);

  const employee = result.model.tables.find((table) => table.name === "Employee");
  assert.equal(result.issues.length, 0);
  assert.equal(employee?.foreignKeys.length, 1);
  assert.deepEqual(employee?.foreignKeys[0]?.fromColumnNames, ["department_id"]);
  assert.equal(employee?.foreignKeys[0]?.toTableName, "Department");
});

test("sql reverse parser: parses inline foreign keys", () => {
  const result = parseSqlSchema(`
    CREATE TABLE Department (
      id INTEGER PRIMARY KEY
    );

    CREATE TABLE Employee (
      id INTEGER PRIMARY KEY,
      department_id INTEGER REFERENCES Department(id)
    );
  `);

  const employee = result.model.tables.find((table) => table.name === "Employee");
  const departmentId = employee?.columns.find((column) => column.name === "department_id");
  assert.equal(result.issues.length, 0);
  assert.equal(departmentId?.isForeignKey, true);
  assert.equal(employee?.foreignKeys.length, 1);
  assert.deepEqual(employee?.foreignKeys[0]?.fromColumnNames, ["department_id"]);
  assert.deepEqual(employee?.foreignKeys[0]?.toColumnNames, ["id"]);
});

test("sql reverse parser: parses named table-level unique constraints", () => {
  const result = parseSqlSchema(`
    CREATE TABLE UserAccount (
      id INTEGER PRIMARY KEY,
      tenant_id INTEGER NOT NULL,
      email TEXT NOT NULL,
      CONSTRAINT uq_user_tenant_email UNIQUE (tenant_id, email)
    );
  `);

  const account = result.model.tables[0];
  assert.equal(result.issues.length, 0);
  assert.equal(account?.uniqueConstraints.length, 1);
  assert.equal(account?.uniqueConstraints[0]?.name, "uq_user_tenant_email");
  assert.deepEqual(account?.uniqueConstraints[0]?.columnNames, ["tenant_id", "email"]);
});
