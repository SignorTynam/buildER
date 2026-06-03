import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument, DiagramEdge, DiagramNode, EntityNode } from "../src/types/diagram.ts";
import { reverseSqlToDiagram } from "../src/utils/sqlReverseDiagram.ts";

function findNode<T extends DiagramNode["type"]>(
  diagram: DiagramDocument,
  type: T,
  label: string,
): Extract<DiagramNode, { type: T }> | undefined {
  return diagram.nodes.find((node): node is Extract<DiagramNode, { type: T }> => {
    return node.type === type && node.label === label;
  });
}

function assertValidEdges(diagram: DiagramDocument): void {
  const nodeIds = new Set(diagram.nodes.map((node) => node.id));
  diagram.edges.forEach((edge) => {
    assert.equal(nodeIds.has(edge.sourceId), true, `${edge.id} has missing source ${edge.sourceId}`);
    assert.equal(nodeIds.has(edge.targetId), true, `${edge.id} has missing target ${edge.targetId}`);
  });
}

function connectorEdges(diagram: DiagramDocument): DiagramEdge[] {
  return diagram.edges.filter((edge) => edge.type === "connector");
}

function participationCardinality(
  entity: EntityNode,
  relationshipId: string,
): string | undefined {
  return entity.relationshipParticipations?.find((participation) => participation.relationshipId === relationshipId)?.cardinality;
}

test("sql reverse diagram: converts a single table into entity and attributes", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE Student (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE
    );
  `);

  const student = findNode(result.diagram, "entity", "Student");
  const id = findNode(result.diagram, "attribute", "id");
  const name = findNode(result.diagram, "attribute", "name");
  const email = findNode(result.diagram, "attribute", "email");

  assert.ok(student);
  assert.ok(id);
  assert.ok(name);
  assert.ok(email);
  assert.equal(result.diagram.nodes.filter((node) => node.type === "entity").length, 1);
  assert.equal(id.isIdentifier, true);
  assert.deepEqual(student.internalIdentifiers?.[0]?.attributeIds, [id.id]);
  assert.equal(result.diagram.edges.some((edge) => edge.type === "attribute" && edge.sourceId === student.id && edge.targetId === id.id), true);
  assert.equal(result.diagram.edges.some((edge) => edge.type === "attribute" && edge.sourceId === student.id && edge.targetId === name.id), true);
  assert.equal(result.diagram.edges.some((edge) => edge.type === "attribute" && edge.sourceId === student.id && edge.targetId === email.id), true);
  assertValidEdges(result.diagram);
});

test("sql reverse diagram: converts foreign key into relationship with cardinalities", () => {
  const result = reverseSqlToDiagram(`
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

  const course = findNode(result.diagram, "entity", "Course");
  const lesson = findNode(result.diagram, "entity", "Lesson");
  const relationship = result.diagram.nodes.find((node) => node.type === "relationship");

  assert.ok(course);
  assert.ok(lesson);
  assert.ok(relationship);
  assert.equal(connectorEdges(result.diagram).length, 2);
  assert.equal(
    lesson.relationshipParticipations?.find((participation) => participation.relationshipId === relationship.id)?.cardinality,
    "(1,1)",
  );
  assert.equal(
    course.relationshipParticipations?.find((participation) => participation.relationshipId === relationship.id)?.cardinality,
    "(0,N)",
  );
  assertValidEdges(result.diagram);
});

test("sql reverse diagram: converts associative table into many-to-many relationship", () => {
  const result = reverseSqlToDiagram(`
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

  const student = findNode(result.diagram, "entity", "Student");
  const course = findNode(result.diagram, "entity", "Course");
  const enrollmentEntity = findNode(result.diagram, "entity", "Enrollment");
  const enrollment = findNode(result.diagram, "relationship", "Enrollment");
  const enrolledAt = findNode(result.diagram, "attribute", "enrolled_at");
  const studentId = findNode(result.diagram, "attribute", "student_id");
  const courseId = findNode(result.diagram, "attribute", "course_id");

  assert.ok(student);
  assert.ok(course);
  assert.equal(enrollmentEntity, undefined);
  assert.ok(enrollment);
  assert.ok(enrolledAt);
  assert.equal(studentId, undefined);
  assert.equal(courseId, undefined);
  assert.equal(
    result.diagram.edges.some((edge) => edge.type === "connector" && edge.sourceId === enrollment.id && edge.targetId === student.id),
    true,
  );
  assert.equal(
    result.diagram.edges.some((edge) => edge.type === "connector" && edge.sourceId === enrollment.id && edge.targetId === course.id),
    true,
  );
  assert.equal(
    result.diagram.edges.some((edge) => edge.type === "attribute" && edge.sourceId === enrollment.id && edge.targetId === enrolledAt.id),
    true,
  );
  assertValidEdges(result.diagram);
});

test("sql reverse diagram: keeps fk columns as attributes when option is true", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE Course (
      id INTEGER PRIMARY KEY
    );

    CREATE TABLE Lesson (
      id INTEGER PRIMARY KEY,
      course_id INTEGER NOT NULL,
      FOREIGN KEY (course_id) REFERENCES Course(id)
    );
  `, { keepForeignKeyColumnsAsAttributes: true });

  const lesson = findNode(result.diagram, "entity", "Lesson");
  const courseId = findNode(result.diagram, "attribute", "course_id");

  assert.ok(lesson);
  assert.ok(courseId);
  assert.equal(result.diagram.edges.some((edge) => edge.type === "attribute" && edge.sourceId === lesson.id && edge.targetId === courseId.id), true);
});

test("sql reverse diagram: hides fk columns as attributes when option is false", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE Course (
      id INTEGER PRIMARY KEY
    );

    CREATE TABLE Lesson (
      id INTEGER PRIMARY KEY,
      course_id INTEGER NOT NULL,
      FOREIGN KEY (course_id) REFERENCES Course(id)
    );
  `, { keepForeignKeyColumnsAsAttributes: false });

  const courseId = findNode(result.diagram, "attribute", "course_id");

  assert.equal(courseId, undefined);
  assert.equal(result.diagram.nodes.some((node) => node.type === "relationship"), true);
});

test("sql reverse diagram: wrapper preserves parser and logical outputs", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE Student (
      id INTEGER PRIMARY KEY
    );
    CREATE INDEX idx_student_id ON Student(id);
  `);

  assert.ok(result.diagram);
  assert.ok(result.logicalModel);
  assert.ok(result.sqlModel);
  assert.equal(result.issues.some((issue) => issue.code === "UNSUPPORTED_INDEX"), true);
  assert.equal(Array.isArray(result.logicalIssues), true);
});

test("sql reverse diagram: connector participation ids are valid", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE Course (
      id INTEGER PRIMARY KEY
    );

    CREATE TABLE Lesson (
      id INTEGER PRIMARY KEY,
      course_id INTEGER NOT NULL,
      FOREIGN KEY (course_id) REFERENCES Course(id)
    );
  `);
  const entityNodes = result.diagram.nodes.filter((node): node is EntityNode => node.type === "entity");

  connectorEdges(result.diagram).forEach((edge) => {
    const sourceEntity = entityNodes.find((entity) => entity.id === edge.sourceId);
    const targetEntity = entityNodes.find((entity) => entity.id === edge.targetId);
    const entity = sourceEntity ?? targetEntity;
    assert.ok(entity);
    assert.equal(entity.relationshipParticipations?.some((participation) => participation.id === edge.participationId), true);
  });
});

test("sql reverse diagram: unique foreign key creates one-to-one cardinalities", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE UserAccount (
      id INTEGER PRIMARY KEY
    );

    CREATE TABLE UserProfile (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE,
      FOREIGN KEY (user_id) REFERENCES UserAccount(id)
    );
  `);

  const userAccount = findNode(result.diagram, "entity", "UserAccount");
  const userProfile = findNode(result.diagram, "entity", "UserProfile");
  const relationship = result.diagram.nodes.find((node) => node.type === "relationship");

  assert.ok(userAccount);
  assert.ok(userProfile);
  assert.ok(relationship);
  assert.equal(participationCardinality(userProfile, relationship.id), "(1,1)");
  assert.equal(participationCardinality(userAccount, relationship.id), "(0,1)");
  assertValidEdges(result.diagram);
});

test("sql reverse diagram: optional foreign key creates optional cardinalities", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE Department (
      id INTEGER PRIMARY KEY
    );

    CREATE TABLE Employee (
      id INTEGER PRIMARY KEY,
      department_id INTEGER,
      FOREIGN KEY (department_id) REFERENCES Department(id)
    );
  `);

  const department = findNode(result.diagram, "entity", "Department");
  const employee = findNode(result.diagram, "entity", "Employee");
  const relationship = result.diagram.nodes.find((node) => node.type === "relationship");

  assert.ok(department);
  assert.ok(employee);
  assert.ok(relationship);
  assert.equal(participationCardinality(employee, relationship.id), "(0,1)");
  assert.equal(participationCardinality(department, relationship.id), "(0,N)");
  assertValidEdges(result.diagram);
});

test("sql reverse diagram: composite primary key marks all internal identifier attributes", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE OrderLine (
      order_id INTEGER NOT NULL,
      line_number INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER,
      PRIMARY KEY (order_id, line_number, product_id)
    );
  `);

  const orderLine = findNode(result.diagram, "entity", "OrderLine");
  assert.ok(orderLine);

  const identifierAttributeIds = orderLine.internalIdentifiers?.[0]?.attributeIds ?? [];
  const identifierAttributes = result.diagram.nodes.filter((node) => {
    return node.type === "attribute" && identifierAttributeIds.includes(node.id);
  });

  assert.equal(identifierAttributeIds.length, 3);
  assert.equal(identifierAttributes.length, 3);
  identifierAttributes.forEach((attribute) => {
    assert.equal(attribute.isCompositeInternal, true);
  });
});
