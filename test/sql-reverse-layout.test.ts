import assert from "node:assert/strict";
import test from "node:test";

import type { DiagramDocument, DiagramNode } from "../src/types/diagram.ts";
import { reverseSqlToDiagram } from "../src/utils/sqlReverseDiagram.ts";

interface TestBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function getBounds(node: DiagramNode): TestBounds {
  return {
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

function overlaps(a: TestBounds, b: TestBounds, padding = 0): boolean {
  return (
    a.x < b.x + b.width + padding
    && a.x + a.width + padding > b.x
    && a.y < b.y + b.height + padding
    && a.y + a.height + padding > b.y
  );
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

function nodesByType<T extends DiagramNode["type"]>(
  diagram: DiagramDocument,
  type: T,
): Array<Extract<DiagramNode, { type: T }>> {
  return diagram.nodes.filter((node): node is Extract<DiagramNode, { type: T }> => node.type === type);
}

function attributeOwnerId(diagram: DiagramDocument, attributeId: string): string | undefined {
  return diagram.edges.find((edge) => {
    return edge.type === "attribute" && (edge.sourceId === attributeId || edge.targetId === attributeId);
  })?.sourceId;
}

function assertValidEdges(diagram: DiagramDocument): void {
  const nodeIds = new Set(diagram.nodes.map((node) => node.id));
  diagram.edges.forEach((edge) => {
    assert.equal(nodeIds.has(edge.sourceId), true, `${edge.id} has missing source ${edge.sourceId}`);
    assert.equal(nodeIds.has(edge.targetId), true, `${edge.id} has missing target ${edge.targetId}`);
  });
}

test("sql reverse layout: deterministic coordinates", () => {
  const sql = `
    CREATE TABLE Department (id INTEGER PRIMARY KEY);
    CREATE TABLE Employee (
      id INTEGER PRIMARY KEY,
      department_id INTEGER,
      FOREIGN KEY (department_id) REFERENCES Department(id)
    );
    CREATE TABLE Project (
      id INTEGER PRIMARY KEY,
      owner_id INTEGER,
      FOREIGN KEY (owner_id) REFERENCES Employee(id)
    );
    CREATE TABLE Task (
      id INTEGER PRIMARY KEY,
      project_id INTEGER,
      FOREIGN KEY (project_id) REFERENCES Project(id)
    );
  `;
  const first = reverseSqlToDiagram(sql).diagram.nodes
    .map((node) => ({ id: node.id, label: node.label, type: node.type, x: node.x, y: node.y }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const second = reverseSqlToDiagram(sql).diagram.nodes
    .map((node) => ({ id: node.id, label: node.label, type: node.type, x: node.x, y: node.y }))
    .sort((left, right) => left.id.localeCompare(right.id));

  assert.deepEqual(second, first);
});

test("sql reverse layout: entities do not overlap", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE A (id INTEGER PRIMARY KEY);
    CREATE TABLE B (id INTEGER PRIMARY KEY, a_id INTEGER, FOREIGN KEY (a_id) REFERENCES A(id));
    CREATE TABLE C (id INTEGER PRIMARY KEY, a_id INTEGER, FOREIGN KEY (a_id) REFERENCES A(id));
    CREATE TABLE D (id INTEGER PRIMARY KEY, b_id INTEGER, FOREIGN KEY (b_id) REFERENCES B(id));
    CREATE TABLE E (id INTEGER PRIMARY KEY, b_id INTEGER, FOREIGN KEY (b_id) REFERENCES B(id));
    CREATE TABLE F (id INTEGER PRIMARY KEY, c_id INTEGER, FOREIGN KEY (c_id) REFERENCES C(id));
  `);
  const entities = nodesByType(result.diagram, "entity");

  entities.forEach((entity, index) => {
    entities.slice(index + 1).forEach((other) => {
      assert.equal(overlaps(getBounds(entity), getBounds(other), 20), false, `${entity.label} overlaps ${other.label}`);
    });
  });
});

test("sql reverse layout: attributes do not overlap their owner", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE WideTable (
      id INTEGER PRIMARY KEY,
      col_01 TEXT,
      col_02 TEXT,
      col_03 TEXT,
      col_04 TEXT,
      col_05 TEXT,
      col_06 TEXT,
      col_07 TEXT,
      col_08 TEXT,
      col_09 TEXT,
      col_10 TEXT
    );
  `);
  const owner = findNode(result.diagram, "entity", "WideTable");
  assert.ok(owner);

  nodesByType(result.diagram, "attribute").forEach((attribute) => {
    if (attributeOwnerId(result.diagram, attribute.id) === owner.id) {
      assert.equal(overlaps(getBounds(attribute), getBounds(owner), 12), false, `${attribute.label} overlaps owner`);
    }
  });
});

test("sql reverse layout: attributes are distributed around wide tables", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE WideTable (
      id INTEGER PRIMARY KEY,
      col_01 TEXT,
      col_02 TEXT,
      col_03 TEXT,
      col_04 TEXT,
      col_05 TEXT,
      col_06 TEXT,
      col_07 TEXT,
      col_08 TEXT,
      col_09 TEXT,
      col_10 TEXT
    );
  `);
  const attributes = nodesByType(result.diagram, "attribute");
  const distinctX = new Set(attributes.map((attribute) => attribute.x));
  const distinctY = new Set(attributes.map((attribute) => attribute.y));

  assert.equal(distinctX.size >= 3 || distinctY.size >= 3, true);
});

test("sql reverse layout: foreign key relationship is outside connected entities", () => {
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
  const relationship = nodesByType(result.diagram, "relationship")[0];
  assert.ok(course);
  assert.ok(lesson);
  assert.ok(relationship);

  assert.equal(overlaps(getBounds(relationship), getBounds(course), 16), false);
  assert.equal(overlaps(getBounds(relationship), getBounds(lesson), 16), false);
});

test("sql reverse layout: associative relationship is outside connected entities", () => {
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
  assert.ok(student);
  assert.ok(course);
  assert.equal(enrollmentEntity, undefined);
  assert.ok(enrollment);

  assert.equal(overlaps(getBounds(enrollment), getBounds(student), 16), false);
  assert.equal(overlaps(getBounds(enrollment), getBounds(course), 16), false);
});

test("sql reverse layout: self foreign key relationship is outside the entity", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE Employee (
      id INTEGER PRIMARY KEY,
      manager_id INTEGER,
      name TEXT,
      FOREIGN KEY (manager_id) REFERENCES Employee(id)
    );
  `);
  const employee = findNode(result.diagram, "entity", "Employee");
  const relationship = nodesByType(result.diagram, "relationship")[0];
  assert.ok(employee);
  assert.ok(relationship);

  assert.equal(overlaps(getBounds(relationship), getBounds(employee), 16), false);
});

test("sql reverse layout: large ten-table chain has finite deterministic coordinates and valid edges", () => {
  const sql = Array.from({ length: 10 }, (_, index) => {
    const tableNumber = index + 1;
    if (tableNumber === 1) {
      return "CREATE TABLE Chain01 (id INTEGER PRIMARY KEY);";
    }
    const previous = `Chain${String(tableNumber - 1).padStart(2, "0")}`;
    const current = `Chain${String(tableNumber).padStart(2, "0")}`;
    return `
      CREATE TABLE ${current} (
        id INTEGER PRIMARY KEY,
        previous_id INTEGER NOT NULL,
        FOREIGN KEY (previous_id) REFERENCES ${previous}(id)
      );
    `;
  }).join("\n");

  const first = reverseSqlToDiagram(sql).diagram;
  const second = reverseSqlToDiagram(sql).diagram;
  const firstCoordinates = first.nodes
    .map((node) => ({ id: node.id, type: node.type, label: node.label, x: node.x, y: node.y }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const secondCoordinates = second.nodes
    .map((node) => ({ id: node.id, type: node.type, label: node.label, x: node.x, y: node.y }))
    .sort((left, right) => left.id.localeCompare(right.id));

  assert.equal(nodesByType(first, "entity").length, 10);
  assert.equal(nodesByType(first, "relationship").length, 9);
  first.nodes.forEach((node) => {
    assert.equal(Number.isFinite(node.x), true, `${node.id} x is not finite`);
    assert.equal(Number.isFinite(node.y), true, `${node.id} y is not finite`);
    assert.equal(node.x > 0, true, `${node.id} x is not positive`);
    assert.equal(node.y > 0, true, `${node.id} y is not positive`);
  });
  assert.deepEqual(secondCoordinates, firstCoordinates);
  assertValidEdges(first);
});

test("sql reverse layout: long labels resize nodes and keep direct attributes separated", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE ExtremelyVerboseOperationalAuditTrailEntry (
      extremely_verbose_operational_audit_trail_entry_id INTEGER PRIMARY KEY,
      human_readable_description_for_the_audit_event TEXT,
      regulatory_context_for_the_audit_event TEXT
    );
  `);

  const entity = findNode(result.diagram, "entity", "ExtremelyVerboseOperationalAuditTrailEntry");
  const idAttribute = findNode(result.diagram, "attribute", "extremely_verbose_operational_audit_trail_entry_id");
  const directAttributes = nodesByType(result.diagram, "attribute").filter((attribute) => {
    return entity && attributeOwnerId(result.diagram, attribute.id) === entity.id;
  });

  assert.ok(entity);
  assert.ok(idAttribute);
  assert.equal(entity.width > 140, true);
  assert.equal(idAttribute.width > 112, true);
  directAttributes.forEach((attribute, index) => {
    assert.equal(overlaps(getBounds(attribute), getBounds(entity), 12), false, `${attribute.label} overlaps entity`);
    directAttributes.slice(index + 1).forEach((other) => {
      assert.equal(overlaps(getBounds(attribute), getBounds(other), 12), false, `${attribute.label} overlaps ${other.label}`);
    });
  });
});
