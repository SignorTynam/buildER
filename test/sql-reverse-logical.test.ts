import assert from "node:assert/strict";
import test from "node:test";

import { convertSqlSchemaToLogicalModel, reverseSqlToLogicalModel } from "../src/utils/sqlReverseLogical.ts";
import { parseSqlSchema } from "../src/utils/sqlReverseParser.ts";

test("sql reverse logical: converts a single table with primary key", () => {
  const result = reverseSqlToLogicalModel(`
    CREATE TABLE Student (
      id INTEGER PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  assert.equal(result.model.tables.length, 1);
  const table = result.model.tables[0];
  assert.equal(table?.name, "Student");
  assert.equal(table?.kind, "entity");

  const id = table?.columns.find((column) => column.name === "id");
  const name = table?.columns.find((column) => column.name === "name");
  const email = table?.columns.find((column) => column.name === "email");
  const createdAt = table?.columns.find((column) => column.name === "created_at");

  assert.equal(id?.isPrimaryKey, true);
  assert.equal(name?.isNullable, false);
  assert.equal(name?.dataType, "VARCHAR");
  assert.equal(name?.length, 255);
  assert.equal(email?.isUnique, true);
  assert.equal(createdAt?.defaultValue, "CURRENT_TIMESTAMP");
  assert.equal(createdAt?.dataType, "DATETIME");
});

test("sql reverse logical: converts foreign keys and logical edges", () => {
  const result = reverseSqlToLogicalModel(`
    CREATE TABLE Course (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL
    );

    CREATE TABLE Lesson (
      id INTEGER PRIMARY KEY,
      course_id INTEGER NOT NULL,
      FOREIGN KEY (course_id) REFERENCES Course(id)
    );
  `);

  assert.equal(result.model.tables.length, 2);
  assert.equal(result.model.foreignKeys.length, 1);
  assert.equal(result.model.edges.length, 1);

  const course = result.model.tables.find((table) => table.name === "Course");
  const lesson = result.model.tables.find((table) => table.name === "Lesson");
  const courseId = course?.columns.find((column) => column.name === "id");
  const lessonCourseId = lesson?.columns.find((column) => column.name === "course_id");
  const foreignKey = result.model.foreignKeys[0];

  assert.equal(lessonCourseId?.isForeignKey, true);
  assert.equal(foreignKey?.required, true);
  assert.deepEqual(lessonCourseId?.references, [{
    foreignKeyId: foreignKey?.id,
    targetTableId: course?.id,
    targetColumnId: courseId?.id,
  }]);
  assert.equal(result.model.edges[0]?.foreignKeyId, foreignKey?.id);
});

test("sql reverse logical: detects associative tables with composite primary keys", () => {
  const result = reverseSqlToLogicalModel(`
    CREATE TABLE Student (
      id INTEGER PRIMARY KEY
    );

    CREATE TABLE Course (
      id INTEGER PRIMARY KEY
    );

    CREATE TABLE Enrollment (
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      enrolled_at DATE,
      PRIMARY KEY (student_id, course_id),
      FOREIGN KEY (student_id) REFERENCES Student(id),
      FOREIGN KEY (course_id) REFERENCES Course(id)
    );
  `);

  const enrollment = result.model.tables.find((table) => table.name === "Enrollment");
  assert.equal(enrollment?.kind, "associative");
  assert.deepEqual(
    enrollment?.columns.filter((column) => column.isPrimaryKey).map((column) => column.name),
    ["student_id", "course_id"],
  );
  assert.equal(result.model.foreignKeys.length, 2);
  assert.equal(result.model.edges.length, 2);
});

test("sql reverse logical: converts table-level unique constraints", () => {
  const result = reverseSqlToLogicalModel(`
    CREATE TABLE UserAccount (
      id INTEGER PRIMARY KEY,
      email TEXT NOT NULL,
      username TEXT NOT NULL,
      UNIQUE (email),
      UNIQUE (username)
    );
  `);

  const table = result.model.tables[0];
  const email = table?.columns.find((column) => column.name === "email");
  const username = table?.columns.find((column) => column.name === "username");

  assert.equal(result.model.uniqueConstraints.length, 2);
  assert.equal(email?.isUnique, true);
  assert.equal(username?.isUnique, true);
});

test("sql reverse logical: reports a logical warning for tables without primary key", () => {
  const result = reverseSqlToLogicalModel(`
    CREATE TABLE LogEntry (
      message TEXT,
      created_at DATETIME
    );
  `);

  const issue = result.model.issues.find((candidate) => candidate.code === "ENTITY_WITHOUT_PK");
  assert.equal(issue?.level, "warning");
  assert.equal(issue?.tableId, result.model.tables[0]?.id);
});

test("sql reverse logical: wrapper returns parsed SQL model and preserves parser warnings", () => {
  const result = reverseSqlToLogicalModel(`
    CREATE TABLE Student (
      id INTEGER PRIMARY KEY
    );
    CREATE INDEX idx_student_id ON Student(id);
  `);

  assert.equal(result.sqlModel.tables.length, 1);
  assert.equal(result.model.tables.length, 1);
  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]?.code, "UNSUPPORTED_INDEX");
});

test("sql reverse logical: converts an already parsed SqlSchemaModel", () => {
  const parsed = parseSqlSchema(`
    CREATE TABLE Product (
      id INTEGER PRIMARY KEY,
      price NUMERIC(10, 2)
    );
  `);
  const result = convertSqlSchemaToLogicalModel(parsed.model);
  const price = result.model.tables[0]?.columns.find((column) => column.name === "price");

  assert.equal(result.sqlModel, parsed.model);
  assert.equal(price?.dataType, "NUMERIC");
  assert.equal(price?.precision, 10);
  assert.equal(price?.scale, 2);
});
