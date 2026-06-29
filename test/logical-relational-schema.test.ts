import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { LogicalColumn, LogicalModel } from "../src/types/logical.ts";
import {
  buildLogicalRelationalSchemaRows,
  generateLogicalRelationalSchema,
  underlineRelationalIdentifier,
} from "../src/utils/logicalRelationalSchema.ts";

function createColumn(
  id: string,
  name: string,
  options: Partial<Pick<LogicalColumn, "isPrimaryKey" | "isForeignKey">> = {},
): LogicalColumn {
  return {
    id,
    name,
    isPrimaryKey: options.isPrimaryKey === true,
    isForeignKey: options.isForeignKey === true,
    isNullable: true,
    references: [],
  };
}

function createModel(overrides: Partial<LogicalModel>): LogicalModel {
  return {
    meta: {
      name: "Relational schema test",
      generatedAt: "2026-06-29T00:00:00.000Z",
      sourceDiagramVersion: 1,
      sourceSignature: "test",
    },
    tables: [],
    foreignKeys: [],
    uniqueConstraints: [],
    edges: [],
    issues: [],
    ...overrides,
  };
}

test("underlines relational primary key identifiers", () => {
  assert.equal(underlineRelationalIdentifier("id"), "i\u0332d\u0332");
  assert.equal(
    underlineRelationalIdentifier("id_course"),
    "i\u0332d\u0332_\u0332c\u0332o\u0332u\u0332r\u0332s\u0332e\u0332",
  );
});

test("generates simple relational schema", () => {
  const model = createModel({
    tables: [
      {
        id: "course",
        name: "COURSE",
        kind: "entity",
        x: 0,
        y: 0,
        width: 220,
        height: 160,
        columns: [
          createColumn("course-id", "id", { isPrimaryKey: true }),
          createColumn("course-code", "code"),
          createColumn("course-title", "title"),
          createColumn("course-credits", "credits"),
        ],
      },
    ],
  });

  assert.equal(generateLogicalRelationalSchema(model), "COURSE( i\u0332d\u0332, code, title, credits )");
});

test("renders foreign keys with column colon table syntax", () => {
  const model = createModel({
    tables: [
      {
        id: "course",
        name: "COURSE",
        kind: "entity",
        x: 0,
        y: 0,
        width: 180,
        height: 120,
        columns: [createColumn("course-id", "id", { isPrimaryKey: true })],
      },
      {
        id: "student",
        name: "STUDENT",
        kind: "entity",
        x: 0,
        y: 0,
        width: 180,
        height: 120,
        columns: [createColumn("student-id", "id", { isPrimaryKey: true })],
      },
      {
        id: "enrollment",
        name: "ENROLLMENT",
        kind: "relationship",
        x: 0,
        y: 0,
        width: 240,
        height: 160,
        columns: [
          createColumn("enrollment-course-id", "id_course", { isPrimaryKey: true, isForeignKey: true }),
          createColumn("enrollment-student-id", "id_student", { isPrimaryKey: true, isForeignKey: true }),
          createColumn("enrollment-date", "enrolled_on"),
          createColumn("enrollment-grade", "grade"),
        ],
      },
    ],
    foreignKeys: [
      {
        id: "fk-enrollment-course",
        name: "ENROLLMENT_COURSE_FK",
        fromTableId: "enrollment",
        toTableId: "course",
        mappings: [{ fromColumnId: "enrollment-course-id", toColumnId: "course-id" }],
        required: true,
      },
      {
        id: "fk-enrollment-student",
        name: "ENROLLMENT_STUDENT_FK",
        fromTableId: "enrollment",
        toTableId: "student",
        mappings: [{ fromColumnId: "enrollment-student-id", toColumnId: "student-id" }],
        required: true,
      },
    ],
  });

  const schema = generateLogicalRelationalSchema(model);

  assert.match(
    schema,
    /ENROLLMENT\( i\u0332d\u0332_\u0332c\u0332o\u0332u\u0332r\u0332s\u0332e\u0332:COURSE, i\u0332d\u0332_\u0332s\u0332t\u0332u\u0332d\u0332e\u0332n\u0332t\u0332:STUDENT, enrolled_on, grade \)/,
  );
  assert.doesNotMatch(schema, /->|REFERENCES|FOREIGN KEY/);
});

test("does not underline referenced table name", () => {
  const schema = generateLogicalRelationalSchema(createModel({
    tables: [
      {
        id: "course",
        name: "COURSE",
        kind: "entity",
        x: 0,
        y: 0,
        width: 180,
        height: 120,
        columns: [createColumn("course-id", "id", { isPrimaryKey: true })],
      },
      {
        id: "enrollment",
        name: "ENROLLMENT",
        kind: "relationship",
        x: 0,
        y: 0,
        width: 180,
        height: 120,
        columns: [createColumn("enrollment-course-id", "id_course", { isPrimaryKey: true, isForeignKey: true })],
      },
    ],
    foreignKeys: [
      {
        id: "fk-enrollment-course",
        name: "ENROLLMENT_COURSE_FK",
        fromTableId: "enrollment",
        toTableId: "course",
        mappings: [{ fromColumnId: "enrollment-course-id", toColumnId: "course-id" }],
        required: true,
      },
    ],
  }));

  assert.match(schema, /:COURSE/);
  assert.doesNotMatch(schema, /:C\u0332/);
});

test("handles missing foreign key mapping safely", () => {
  const model = createModel({
    tables: [
      {
        id: "enrollment",
        name: "ENROLLMENT",
        kind: "relationship",
        x: 0,
        y: 0,
        width: 180,
        height: 120,
        columns: [createColumn("enrollment-course-id", "id_course", { isForeignKey: true })],
      },
    ],
  });

  const schema = generateLogicalRelationalSchema(model);

  assert.equal(schema, "ENROLLMENT( id_course )");
  assert.doesNotMatch(schema, /undefined/);
});

test("builds structured rows so UI punctuation stays outside primary key styling", () => {
  const model = createModel({
    tables: [
      {
        id: "course",
        name: "COURSE",
        kind: "entity",
        x: 0,
        y: 0,
        width: 180,
        height: 120,
        columns: [
          createColumn("course-id", "id", { isPrimaryKey: true }),
          createColumn("course-code", "code"),
        ],
      },
    ],
  });

  assert.deepEqual(buildLogicalRelationalSchemaRows(model), [
    {
      tableName: "COURSE",
      attributes: [
        { columnName: "id", isPrimaryKey: true, targetTableName: undefined },
        { columnName: "code", isPrimaryKey: false, targetTableName: undefined },
      ],
    },
  ]);
});

test("logical workspace exposes relational schema preview controls", () => {
  const source = readFileSync(new URL("../src/logical/LogicalTranslationWorkspace.tsx", import.meta.url), "utf8");

  assert.match(source, /generateLogicalRelationalSchema/);
  assert.match(source, /buildLogicalRelationalSchemaRows/);
  assert.match(source, /logical\.designer\.sqlTab/);
  assert.match(source, /logical\.designer\.relationalSchemaTab/);
  assert.match(source, /key: "relational-schema"/);
  assert.match(source, /designer-relational-schema-primary-key/);
});
