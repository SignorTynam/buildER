import assert from "node:assert/strict";
import test from "node:test";

import type {
  AttributeNode,
  DiagramDocument,
  DiagramNode,
  EntityNode,
  RelationshipNode,
} from "../src/types/diagram.ts";
import {
  buildAttributeLayoutBounds,
  FIXED_ATTRIBUTE_MARKER_GAP,
  getAttributeMarkerCenter,
  getDirectAttributeLayoutSide,
} from "../src/utils/attributeLayout.ts";
import { perimeterDistance } from "../src/utils/sqlReverseAttributeLayout.ts";
import { reverseSqlToDiagram } from "../src/utils/sqlReverseDiagram.ts";

interface TestBounds {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getBounds(node: DiagramNode): TestBounds {
  return {
    id: node.id,
    x: node.x,
    y: node.y,
    width: node.width,
    height: node.height,
  };
}

export function boundsOverlap(a: TestBounds, b: TestBounds, padding = 0): boolean {
  return (
    a.x < b.x + b.width + padding
    && a.x + a.width + padding > b.x
    && a.y < b.y + b.height + padding
    && a.y + a.height + padding > b.y
  );
}

export function nodesByType<T extends DiagramNode["type"]>(
  diagram: DiagramDocument,
  type: T,
): Array<Extract<DiagramNode, { type: T }>> {
  return diagram.nodes.filter((node): node is Extract<DiagramNode, { type: T }> => node.type === type);
}

export function findAttributeOwner(
  diagram: DiagramDocument,
  attributeId: string,
): EntityNode | RelationshipNode | undefined {
  const edge = diagram.edges.find((candidate) => {
    return candidate.type === "attribute"
      && (candidate.sourceId === attributeId || candidate.targetId === attributeId);
  });
  if (!edge) {
    return undefined;
  }
  const ownerId = edge.sourceId === attributeId ? edge.targetId : edge.sourceId;
  const owner = diagram.nodes.find((node) => node.id === ownerId);
  return owner?.type === "entity" || owner?.type === "relationship" ? owner : undefined;
}

function attributeLayoutBounds(
  diagram: DiagramDocument,
  attribute: AttributeNode,
): ReturnType<typeof buildAttributeLayoutBounds> | null {
  const owner = findAttributeOwner(diagram, attribute.id);
  if (!owner) {
    return null;
  }
  return buildAttributeLayoutBounds(owner, attribute);
}

export function assertGeneratedAttributesHaveOwnersAndBounds(diagram: DiagramDocument): void {
  const attributes = nodesByType(diagram, "attribute");

  attributes.forEach((attribute) => {
    const owner = findAttributeOwner(diagram, attribute.id);
    assert.ok(owner, `${attribute.label} has no owner`);
    const attributeBounds = attributeLayoutBounds(diagram, attribute);
    assert.ok(attributeBounds, `${attribute.label} has no layout bounds`);
    assert.ok(attributeBounds.width > 0, `${attribute.label} has invalid layout width`);
    assert.ok(attributeBounds.height > 0, `${attribute.label} has invalid layout height`);
  });
}

export function assertFixedGeneratedAttributeDistances(diagram: DiagramDocument): void {
  nodesByType(diagram, "attribute").forEach((attribute) => {
    const owner = findAttributeOwner(diagram, attribute.id);
    assert.ok(owner, `${attribute.label} has no owner`);
    assert.ok(
      Math.abs(perimeterDistance(owner, attribute) - FIXED_ATTRIBUTE_MARKER_GAP) <= 0.001,
      `${attribute.label} is not at the fixed marker gap`,
    );
  });
}

export function assertCompactAttributeDistances(
  diagram: DiagramDocument,
  options: { maxDistance: number; averageDistance: number },
): void {
  const attributes = nodesByType(diagram, "attribute");
  const distances = attributes.map((attribute) => {
    const owner = findAttributeOwner(diagram, attribute.id);
    assert.ok(owner, `${attribute.label} has no owner`);
    return perimeterDistance(owner, attribute);
  });

  const maxDistance = Math.max(...distances);
  const averageDistance = distances.reduce((sum, distance) => sum + distance, 0) / distances.length;

  assert.ok(
    maxDistance <= options.maxDistance,
    `max attribute distance ${maxDistance.toFixed(1)} exceeds ${options.maxDistance}`,
  );
  assert.ok(
    averageDistance <= options.averageDistance,
    `average attribute distance ${averageDistance.toFixed(1)} exceeds ${options.averageDistance}`,
  );
}

function sideCountsForOwner(owner: EntityNode | RelationshipNode, attributes: AttributeNode[]): Map<string, number> {
  const counts = new Map<string, number>();
  attributes.forEach((attribute) => {
    const side = getDirectAttributeLayoutSide(owner, attribute);
    counts.set(side, (counts.get(side) ?? 0) + 1);
  });
  return counts;
}

function buildLargeUniversitySchemaSql(): string {
  return `
    CREATE TABLE DIPARTIMENTO (
      id INTEGER PRIMARY KEY,
      codice VARCHAR(20) NOT NULL UNIQUE,
      nome VARCHAR(120) NOT NULL,
      descrizione_breve VARCHAR(255),
      indirizzo_sede VARCHAR(180),
      telefono VARCHAR(40),
      email VARCHAR(160)
    );

    CREATE TABLE EDIFICIO (
      id INTEGER PRIMARY KEY,
      codice VARCHAR(20) NOT NULL UNIQUE,
      nome VARCHAR(120) NOT NULL,
      indirizzo VARCHAR(180) NOT NULL,
      dipartimento_id INTEGER NOT NULL,
      FOREIGN KEY (dipartimento_id) REFERENCES DIPARTIMENTO(id)
    );

    CREATE TABLE AULA (
      id INTEGER PRIMARY KEY,
      codice VARCHAR(20) NOT NULL UNIQUE,
      nome VARCHAR(120) NOT NULL,
      capienza INTEGER NOT NULL,
      piano INTEGER,
      edificio_id INTEGER NOT NULL,
      FOREIGN KEY (edificio_id) REFERENCES EDIFICIO(id)
    );

    CREATE TABLE CORSOLAUREA (
      id INTEGER PRIMARY KEY,
      codice VARCHAR(20) NOT NULL UNIQUE,
      titolo VARCHAR(160) NOT NULL,
      livello VARCHAR(40) NOT NULL,
      crediti_totali INTEGER NOT NULL,
      dipartimento_id INTEGER NOT NULL,
      FOREIGN KEY (dipartimento_id) REFERENCES DIPARTIMENTO(id)
    );

    CREATE TABLE CURRICULUM (
      id INTEGER PRIMARY KEY,
      codice VARCHAR(20) NOT NULL UNIQUE,
      nome VARCHAR(160) NOT NULL,
      anno_inizio INTEGER NOT NULL,
      anno_fine INTEGER,
      corso_laurea_id INTEGER NOT NULL,
      FOREIGN KEY (corso_laurea_id) REFERENCES CORSOLAUREA(id)
    );

    CREATE TABLE DOCENTE (
      id INTEGER PRIMARY KEY,
      matricola VARCHAR(20) NOT NULL UNIQUE,
      nome VARCHAR(80) NOT NULL,
      cognome VARCHAR(80) NOT NULL,
      email VARCHAR(160) UNIQUE,
      telefono VARCHAR(40),
      dipartimento_id INTEGER NOT NULL,
      FOREIGN KEY (dipartimento_id) REFERENCES DIPARTIMENTO(id)
    );

    CREATE TABLE INSEGNAMENTO (
      id INTEGER PRIMARY KEY,
      codice VARCHAR(20) NOT NULL UNIQUE,
      titolo VARCHAR(180) NOT NULL,
      crediti INTEGER NOT NULL,
      semestre VARCHAR(20),
      docente_id INTEGER NOT NULL,
      curriculum_id INTEGER NOT NULL,
      FOREIGN KEY (docente_id) REFERENCES DOCENTE(id),
      FOREIGN KEY (curriculum_id) REFERENCES CURRICULUM(id)
    );

    CREATE TABLE LEZIONE (
      id INTEGER PRIMARY KEY,
      data_lezione DATE NOT NULL,
      ora_inizio TIME NOT NULL,
      ora_fine TIME NOT NULL,
      argomento VARCHAR(255),
      insegnamento_id INTEGER NOT NULL,
      aula_id INTEGER NOT NULL,
      FOREIGN KEY (insegnamento_id) REFERENCES INSEGNAMENTO(id),
      FOREIGN KEY (aula_id) REFERENCES AULA(id)
    );

    CREATE TABLE SESSIONEESAME (
      id INTEGER PRIMARY KEY,
      codice VARCHAR(20) NOT NULL UNIQUE,
      data_inizio DATE NOT NULL,
      data_fine DATE NOT NULL,
      insegnamento_id INTEGER NOT NULL,
      FOREIGN KEY (insegnamento_id) REFERENCES INSEGNAMENTO(id)
    );

    CREATE TABLE APPELLO (
      id INTEGER PRIMARY KEY,
      data_appello DATE NOT NULL,
      ora_inizio TIME NOT NULL,
      ora_fine TIME NOT NULL,
      aula_id INTEGER NOT NULL,
      sessione_esame_id INTEGER NOT NULL,
      FOREIGN KEY (aula_id) REFERENCES AULA(id),
      FOREIGN KEY (sessione_esame_id) REFERENCES SESSIONEESAME(id)
    );

    CREATE TABLE STUDENTE (
      id INTEGER PRIMARY KEY,
      matricola VARCHAR(20) NOT NULL UNIQUE,
      nome VARCHAR(80) NOT NULL,
      cognome VARCHAR(80) NOT NULL,
      email VARCHAR(160) UNIQUE,
      data_immatricolazione DATE,
      corso_laurea_id INTEGER NOT NULL,
      FOREIGN KEY (corso_laurea_id) REFERENCES CORSOLAUREA(id)
    );

    CREATE TABLE ESITOESAME (
      id INTEGER PRIMARY KEY,
      voto NUMERIC(4, 2),
      lode BOOLEAN DEFAULT FALSE,
      data_registrazione DATE,
      studente_id INTEGER NOT NULL,
      appello_id INTEGER NOT NULL,
      FOREIGN KEY (studente_id) REFERENCES STUDENTE(id),
      FOREIGN KEY (appello_id) REFERENCES APPELLO(id)
    );

    CREATE TABLE PIANOSTUDIO (
      id INTEGER PRIMARY KEY,
      anno_accademico VARCHAR(20) NOT NULL,
      stato VARCHAR(40) NOT NULL,
      studente_id INTEGER NOT NULL,
      curriculum_id INTEGER NOT NULL,
      FOREIGN KEY (studente_id) REFERENCES STUDENTE(id),
      FOREIGN KEY (curriculum_id) REFERENCES CURRICULUM(id)
    );

    CREATE TABLE TESI (
      id INTEGER PRIMARY KEY,
      titolo VARCHAR(220) NOT NULL,
      argomento VARCHAR(255),
      data_consegna DATE,
      voto_finale NUMERIC(4, 2),
      studente_id INTEGER NOT NULL,
      relatore_id INTEGER NOT NULL,
      FOREIGN KEY (studente_id) REFERENCES STUDENTE(id),
      FOREIGN KEY (relatore_id) REFERENCES DOCENTE(id)
    );
  `;
}

test("sql reverse attribute layout: large university schema stays compact and fixed-distance", () => {
  const sql = buildLargeUniversitySchemaSql();
  const first = reverseSqlToDiagram(sql).diagram;
  const second = reverseSqlToDiagram(sql).diagram;

  first.nodes.forEach((node) => {
    assert.equal(Number.isFinite(node.x), true, `${node.id} x is not finite`);
    assert.equal(Number.isFinite(node.y), true, `${node.id} y is not finite`);
    assert.equal(node.x > 0, true, `${node.id} x is not positive`);
    assert.equal(node.y > 0, true, `${node.id} y is not positive`);
  });

  assertGeneratedAttributesHaveOwnersAndBounds(first);
  assertFixedGeneratedAttributeDistances(first);
  assertCompactAttributeDistances(first, { maxDistance: 280, averageDistance: 170 });

  const firstCoordinates = first.nodes
    .map((node) => ({ id: node.id, x: node.x, y: node.y }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const secondCoordinates = second.nodes
    .map((node) => ({ id: node.id, x: node.x, y: node.y }))
    .sort((left, right) => left.id.localeCompare(right.id));
  assert.deepEqual(secondCoordinates, firstCoordinates);
});

test("sql reverse attribute layout: owner with many attributes uses multiple sides", () => {
  const columns = Array.from({ length: 16 }, (_, index) => {
    const columnNumber = String(index + 1).padStart(2, "0");
    return `col_${columnNumber} VARCHAR(80)`;
  }).join(",\n      ");

  const result = reverseSqlToDiagram(`
    CREATE TABLE DenseEntity (
      id INTEGER PRIMARY KEY,
      ${columns}
    );
  `);

  const owner = result.diagram.nodes.find(
    (node): node is EntityNode => node.type === "entity" && node.label === "DenseEntity",
  );
  assert.ok(owner);

  const attributes = nodesByType(result.diagram, "attribute").filter((attribute) => {
    return findAttributeOwner(result.diagram, attribute.id)?.id === owner.id;
  });
  const counts = sideCountsForOwner(owner, attributes);

  assert.equal(attributes.length, 17);
  assert.ok(counts.size >= 3, "expected at least three sides");
  assert.notEqual(counts.get("right"), attributes.length);
  assert.notEqual(counts.get("bottom"), attributes.length);
  assertGeneratedAttributesHaveOwnersAndBounds(result.diagram);
  assertFixedGeneratedAttributeDistances(result.diagram);
  const distances = attributes.map((attribute) => perimeterDistance(owner, attribute));
  assert.ok(Math.max(...distances) <= FIXED_ATTRIBUTE_MARKER_GAP + 1, `max distance ${Math.max(...distances)} exceeds fixed gap`);
  assert.ok(
    distances.reduce((sum, distance) => sum + distance, 0) / distances.length <= FIXED_ATTRIBUTE_MARKER_GAP + 1,
    "average distance too high for dense owner",
  );
});

test("sql reverse attribute layout: dense foreign key hub keeps central attributes near owner", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE Hub (
      id INTEGER PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      title VARCHAR(160) NOT NULL,
      description VARCHAR(255),
      status VARCHAR(40),
      created_at DATE,
      updated_at DATE
    );

    CREATE TABLE SatelliteA (
      id INTEGER PRIMARY KEY,
      hub_id INTEGER NOT NULL,
      note_a VARCHAR(120),
      FOREIGN KEY (hub_id) REFERENCES Hub(id)
    );

    CREATE TABLE SatelliteB (
      id INTEGER PRIMARY KEY,
      hub_id INTEGER NOT NULL,
      note_b VARCHAR(120),
      FOREIGN KEY (hub_id) REFERENCES Hub(id)
    );

    CREATE TABLE SatelliteC (
      id INTEGER PRIMARY KEY,
      hub_id INTEGER NOT NULL,
      note_c VARCHAR(120),
      FOREIGN KEY (hub_id) REFERENCES Hub(id)
    );

    CREATE TABLE SatelliteD (
      id INTEGER PRIMARY KEY,
      hub_id INTEGER NOT NULL,
      note_d VARCHAR(120),
      FOREIGN KEY (hub_id) REFERENCES Hub(id)
    );

    CREATE TABLE SatelliteE (
      id INTEGER PRIMARY KEY,
      hub_id INTEGER NOT NULL,
      note_e VARCHAR(120),
      FOREIGN KEY (hub_id) REFERENCES Hub(id)
    );
  `);

  const hub = result.diagram.nodes.find((node): node is EntityNode => node.type === "entity" && node.label === "Hub");
  assert.ok(hub);

  const hubAttributes = nodesByType(result.diagram, "attribute").filter((attribute) => {
    return findAttributeOwner(result.diagram, attribute.id)?.id === hub.id;
  });
  const hubDistances = hubAttributes.map((attribute) => perimeterDistance(hub, attribute));

  assert.ok(Math.max(...hubDistances) <= FIXED_ATTRIBUTE_MARKER_GAP + 1);
  assertGeneratedAttributesHaveOwnersAndBounds(result.diagram);
  assertFixedGeneratedAttributeDistances(result.diagram);
});

test("sql reverse attribute layout: long labels keep real bounds at fixed distance", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE ExtremelyVerboseOperationalAuditTrailEntry (
      extremely_verbose_operational_audit_trail_entry_id INTEGER PRIMARY KEY,
      human_readable_description_for_the_audit_event VARCHAR(255),
      regulatory_context_for_the_audit_event VARCHAR(255),
      extended_metadata_payload_for_downstream_processing VARCHAR(255)
    );
  `);

  const owner = result.diagram.nodes.find(
    (node): node is EntityNode => node.type === "entity" && node.label === "ExtremelyVerboseOperationalAuditTrailEntry",
  );
  assert.ok(owner);

  const attributes = nodesByType(result.diagram, "attribute").filter((attribute) => {
    return findAttributeOwner(result.diagram, attribute.id)?.id === owner.id;
  });

  attributes.forEach((attribute) => {
    assert.ok(attribute.width > 112);
    const marker = getAttributeMarkerCenter(attribute);
    const bounds = buildAttributeLayoutBounds(owner, attribute);
    assert.ok(bounds.width > 0);
    assert.ok(bounds.height > 0);
    assert.ok(marker.x > 0 && marker.y > 0);
  });

  assertGeneratedAttributesHaveOwnersAndBounds(result.diagram);
  assertFixedGeneratedAttributeDistances(result.diagram);
  assertCompactAttributeDistances(result.diagram, { maxDistance: 190, averageDistance: 135 });
});

test("sql reverse attribute layout: single owner with up to ten attributes stays within compact thresholds", () => {
  const result = reverseSqlToDiagram(`
    CREATE TABLE CompactTable (
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

  const owner = result.diagram.nodes.find(
    (node): node is EntityNode => node.type === "entity" && node.label === "CompactTable",
  );
  assert.ok(owner);

  const ownerAttributes = nodesByType(result.diagram, "attribute").filter((attribute) => {
    return findAttributeOwner(result.diagram, attribute.id)?.id === owner.id;
  });
  const distances = ownerAttributes.map((attribute) => perimeterDistance(owner, attribute));

  assert.equal(ownerAttributes.length, 11);
  assert.ok(Math.max(...distances) <= FIXED_ATTRIBUTE_MARKER_GAP + 1);
  assert.ok(distances.reduce((sum, distance) => sum + distance, 0) / distances.length <= FIXED_ATTRIBUTE_MARKER_GAP + 1);
  assertGeneratedAttributesHaveOwnersAndBounds(result.diagram);
  assertFixedGeneratedAttributeDistances(result.diagram);
});
