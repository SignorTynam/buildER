import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExternalIdentifierGroupingPath,
  buildImportedOnlyExternalIdentifierLayout,
  getStableLocalIdentifierMarkerPoint,
} from "../src/canvas/DiagramCanvas.tsx";
import type { Bounds, DiagramDocument, Point } from "../src/types/diagram.ts";
import { getEligibleImportedIdentifierParts } from "../src/utils/diagram.ts";

function point(x: number, y: number): Point {
  return { x, y };
}

test("external identifier imported-only: vertical layout anchors near the host top side and avoids the cardinality label", () => {
  const hostBounds: Bounds = { x: 200, y: 300, width: 160, height: 70 };
  const layout = buildImportedOnlyExternalIdentifierLayout(
    hostBounds,
    point(280, 300),
    point(280, 220),
    point(300, 260),
  );

  assert.equal(layout.junction?.y, 282);
  assert.ok((layout.marker.x ?? 0) < (layout.junction?.x ?? 0));
  assert.equal(layout.marker.y, layout.junction?.y);
});

test("external identifier imported-only: horizontal layout anchors near the host left side and avoids the cardinality label", () => {
  const hostBounds: Bounds = { x: 500, y: 200, width: 160, height: 70 };
  const layout = buildImportedOnlyExternalIdentifierLayout(
    hostBounds,
    point(500, 235),
    point(420, 235),
    point(460, 214),
  );

  assert.equal(layout.junction?.x, 482);
  assert.ok(layout.marker.y > (layout.junction?.y ?? 0));
  assert.equal(layout.marker.x, layout.junction?.x);
});

test("external identifier imported-only: diagonal layout remains anchored to the host-facing side", () => {
  const hostBounds: Bounds = { x: 100, y: 300, width: 160, height: 70 };
  const layout = buildImportedOnlyExternalIdentifierLayout(
    hostBounds,
    point(260, 320),
    point(340, 260),
    point(275, 312),
  );

  assert.equal(layout.junction?.x, 278);
  assert.ok(layout.marker.x < (layout.junction?.x ?? 0));
  assert.ok(layout.marker.y < (layout.junction?.y ?? 0));
});

test("external identifier imported-only: layout does not expose manual offset controls", () => {
  const hostBounds: Bounds = { x: 200, y: 300, width: 160, height: 70 };
  const layout = buildImportedOnlyExternalIdentifierLayout(
    hostBounds,
    point(280, 300),
    point(280, 220),
    point(300, 260),
  );

  assert.equal("offsetDirection" in layout, false);
  assert.equal("offsetMin" in layout, false);
  assert.equal("offsetMax" in layout, false);
});

test("mixed external identifier: local marker stays anchored near the host when attribute moves farther", () => {
  const host = {
    id: "CARTA_CREDITO",
    type: "entity" as const,
    label: "CARTA_CREDITO",
    x: 100,
    y: 100,
    width: 200,
    height: 80,
  };
  const nearAttribute = {
    id: "Num_Carta",
    type: "attribute" as const,
    label: "Num_Carta",
    x: 360,
    y: 126,
    width: 120,
    height: 28,
  };
  const farAttribute = {
    ...nearAttribute,
    x: 760,
  };

  assert.deepEqual(
    getStableLocalIdentifierMarkerPoint(host, farAttribute),
    getStableLocalIdentifierMarkerPoint(host, nearAttribute),
  );
});

test("mixed external identifier: grouping path uses a curved connector for local attribute markers", () => {
  const host = {
    id: "CARTA_CREDITO",
    type: "entity" as const,
    label: "CARTA_CREDITO",
    x: 100,
    y: 100,
    width: 200,
    height: 80,
  };
  const path = buildExternalIdentifierGroupingPath(host, [
    { kind: "importedRelationship", marker: point(200, 82) },
    { kind: "importedRelationship", marker: point(200, 198) },
    { kind: "localAttribute", marker: point(328, 140) },
  ]);

  assert.match(path, / C /);
});

test("mixed external identifier options include multiple mandatory unique sources", () => {
  const diagram: DiagramDocument = {
    meta: { name: "Carta credito", version: 3 },
    notes: "",
    nodes: [
      {
        id: "PERSONA",
        type: "entity",
        label: "PERSONA",
        x: 0,
        y: 0,
        width: 140,
        height: 64,
        internalIdentifiers: [{ id: "PERSONA-id", attributeIds: ["CF"] }],
        relationshipParticipations: [{ id: "p-persona-possiede", relationshipId: "POSSIEDE", cardinality: "(0,N)" }],
      },
      {
        id: "BANCA",
        type: "entity",
        label: "BANCA",
        x: 0,
        y: 0,
        width: 140,
        height: 64,
        internalIdentifiers: [{ id: "BANCA-id", attributeIds: ["IdBanca"] }],
        relationshipParticipations: [{ id: "p-banca-produce", relationshipId: "PRODUCE", cardinality: "(0,N)" }],
      },
      {
        id: "CARTA_CREDITO",
        type: "entity",
        label: "CARTA_CREDITO",
        x: 0,
        y: 0,
        width: 180,
        height: 64,
        relationshipParticipations: [
          { id: "p-carta-possiede", relationshipId: "POSSIEDE", cardinality: "(1,1)" },
          { id: "p-carta-produce", relationshipId: "PRODUCE", cardinality: "(1,1)" },
        ],
      },
      { id: "POSSIEDE", type: "relationship", label: "POSSIEDE", x: 0, y: 0, width: 130, height: 78 },
      { id: "PRODUCE", type: "relationship", label: "PRODUCE", x: 0, y: 0, width: 130, height: 78 },
      { id: "CF", type: "attribute", label: "CF", x: 0, y: 0, width: 80, height: 28, isIdentifier: true },
      { id: "IdBanca", type: "attribute", label: "IdBanca", x: 0, y: 0, width: 100, height: 28, isIdentifier: true },
      { id: "Num_Carta", type: "attribute", label: "Num_Carta", x: 0, y: 0, width: 120, height: 28 },
    ],
    edges: [
      { id: "e-persona-possiede", type: "connector", sourceId: "PERSONA", targetId: "POSSIEDE", label: "", lineStyle: "solid", participationId: "p-persona-possiede" },
      { id: "e-carta-possiede", type: "connector", sourceId: "CARTA_CREDITO", targetId: "POSSIEDE", label: "", lineStyle: "solid", participationId: "p-carta-possiede" },
      { id: "e-banca-produce", type: "connector", sourceId: "BANCA", targetId: "PRODUCE", label: "", lineStyle: "solid", participationId: "p-banca-produce" },
      { id: "e-carta-produce", type: "connector", sourceId: "CARTA_CREDITO", targetId: "PRODUCE", label: "", lineStyle: "solid", participationId: "p-carta-produce" },
      { id: "e-persona-cf", type: "attribute", sourceId: "PERSONA", targetId: "CF", label: "", lineStyle: "solid" },
      { id: "e-banca-id", type: "attribute", sourceId: "BANCA", targetId: "IdBanca", label: "", lineStyle: "solid" },
      { id: "e-carta-num", type: "attribute", sourceId: "CARTA_CREDITO", targetId: "Num_Carta", label: "", lineStyle: "solid" },
    ],
  };

  const labels = getEligibleImportedIdentifierParts(diagram, "CARTA_CREDITO").map(
    (option) => `${option.sourceEntityLabel} via ${option.relationshipLabel}: ${option.importedIdentifierLabel}`,
  );

  assert.deepEqual(labels, ["BANCA via PRODUCE: IdBanca", "PERSONA via POSSIEDE: CF"]);
});
