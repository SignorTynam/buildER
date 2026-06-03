import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { DiagramDocument, DiagramNode } from "../src/types/diagram.ts";
import type { SqlReverseDialect } from "../src/types/sqlReverse.ts";
import { reverseSqlToDiagram } from "../src/utils/sqlReverseDiagram.ts";
import { reverseSqlToLogicalModel } from "../src/utils/sqlReverseLogical.ts";
import { parseSqlSchema } from "../src/utils/sqlReverseParser.ts";

function readExample(fileName: string): string {
  return readFileSync(new URL(`../examples/sql-reverse/${fileName}`, import.meta.url), "utf8");
}

function findNode<T extends DiagramNode["type"]>(
  diagram: DiagramDocument,
  type: T,
  label: string,
): Extract<DiagramNode, { type: T }> | undefined {
  return diagram.nodes.find((node): node is Extract<DiagramNode, { type: T }> => {
    return node.type === type && node.label === label;
  });
}

function attributeOwnerId(diagram: DiagramDocument, attributeId: string): string | undefined {
  return diagram.edges.find((edge) => {
    return edge.type === "attribute" && (edge.sourceId === attributeId || edge.targetId === attributeId);
  })?.sourceId;
}

function assertValidDiagram(diagram: DiagramDocument): void {
  const nodeIds = new Set<string>();
  diagram.nodes.forEach((node) => {
    assert.equal(nodeIds.has(node.id), false, `duplicate node id ${node.id}`);
    nodeIds.add(node.id);
    assert.equal(Number.isFinite(node.x), true, `${node.id} x is not finite`);
    assert.equal(Number.isFinite(node.y), true, `${node.id} y is not finite`);
    assert.equal(node.width > 0, true, `${node.id} width is not positive`);
    assert.equal(node.height > 0, true, `${node.id} height is not positive`);
  });

  const edgeIds = new Set<string>();
  diagram.edges.forEach((edge) => {
    assert.equal(edgeIds.has(edge.id), false, `duplicate edge id ${edge.id}`);
    edgeIds.add(edge.id);
    assert.equal(nodeIds.has(edge.sourceId), true, `${edge.id} has missing source ${edge.sourceId}`);
    assert.equal(nodeIds.has(edge.targetId), true, `${edge.id} has missing target ${edge.targetId}`);
  });
}

test("sql reverse integration: university example reaches a valid ER diagram", () => {
  const sql = readExample("university.sql");
  const parsed = parseSqlSchema(sql, { sourceName: "university.sql" });
  const logical = reverseSqlToLogicalModel(sql, { sourceName: "university.sql" });
  const diagramResult = reverseSqlToDiagram(sql, { sourceName: "university.sql" });

  assert.equal(parsed.model.tables.length, 3);
  assert.equal(parsed.issues.filter((issue) => issue.level === "error").length, 0);
  assert.equal(logical.model.tables.find((table) => table.name === "Enrollment")?.kind, "associative");

  const enrollment = findNode(diagramResult.diagram, "relationship", "Enrollment");
  const student = findNode(diagramResult.diagram, "entity", "Student");
  const course = findNode(diagramResult.diagram, "entity", "Course");
  const enrolledOn = findNode(diagramResult.diagram, "attribute", "enrolled_on");
  const studentId = findNode(diagramResult.diagram, "attribute", "student_id");
  const courseId = findNode(diagramResult.diagram, "attribute", "course_id");

  assert.ok(enrollment);
  assert.ok(student);
  assert.ok(course);
  assert.ok(enrolledOn);
  assert.equal(attributeOwnerId(diagramResult.diagram, enrolledOn.id), enrollment.id);
  assert.equal(studentId, undefined);
  assert.equal(courseId, undefined);
  assertValidDiagram(diagramResult.diagram);
});

test("sql reverse integration: bundled examples parse and convert without errors", () => {
  const examples: Array<{ fileName: string; dialect?: SqlReverseDialect }> = [
    { fileName: "university.sql" },
    { fileName: "library.sql" },
    { fileName: "company.sql" },
    { fileName: "mysql-style.sql", dialect: "mysql" },
  ];

  examples.forEach(({ fileName, dialect }) => {
    const sql = readExample(fileName);
    const parsed = parseSqlSchema(sql, { dialect, sourceName: fileName });
    const diagramResult = reverseSqlToDiagram(sql, { dialect, sourceName: fileName });

    assert.equal(parsed.model.tables.length > 0, true, `${fileName} has no tables`);
    assert.equal(parsed.issues.filter((issue) => issue.level === "error").length, 0, `${fileName} has parser errors`);
    assert.equal(diagramResult.logicalIssues.filter((issue) => issue.level === "error").length, 0, `${fileName} has logical errors`);
    assert.equal(diagramResult.diagram.nodes.some((node) => node.type === "entity"), true, `${fileName} has no entities`);
    assertValidDiagram(diagramResult.diagram);
  });
});
