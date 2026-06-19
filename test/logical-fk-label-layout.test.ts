import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { boundsIntersect } from "../src/utils/edgeLabelLayout.ts";
import {
  chooseLogicalForeignKeyLabelPlacement,
  wrapLogicalForeignKeyLabel,
  type LogicalFkLabelReservedBox,
} from "../src/utils/logicalForeignKeyLabelLayout.ts";

test("wrapLogicalForeignKeyLabel manda label lunga su più righe", () => {
  const result = wrapLogicalForeignKeyLabel(
    "id_insegnamento, id_piano_studi -> PIANO_STUDI(id_piano_studi, id_studente)",
    { maxCharsPerLine: 30, maxLines: 3 },
  );

  assert.ok(result.lines.length > 1);
  assert.ok(result.lines.length <= 3);
  assert.equal(result.fullLabel.includes("id_insegnamento"), true);
  assert.equal(result.displayLabel.includes("→"), true);
});

test("wrapLogicalForeignKeyLabel limita l'ellissi all'ultima riga", () => {
  const result = wrapLogicalForeignKeyLabel(
    "INSEGNAMENTO_id_insegnamento -> INSEGNAMENTO.id_insegnamento",
    { maxCharsPerLine: 18, maxLines: 3 },
  );

  assert.ok(result.lines.length <= 3);
  assert.equal(result.lines.slice(0, -1).some((line) => line.includes("\u2026")), false);
});

test("chooseLogicalForeignKeyLabelPlacement evita una tabella sopra il punto default", () => {
  const blockingTable = { id: "table-blocking", kind: "table", x: 80, y: -30, width: 160, height: 80 } satisfies LogicalFkLabelReservedBox;
  const placement = chooseLogicalForeignKeyLabelPlacement({
    edgeId: "fk-1",
    routePoints: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ],
    defaultPoint: { x: 150, y: 0 },
    fullLabel: "id_studente -> STUDENTE.id_studente",
    reservedBoxes: [blockingTable],
    alreadyPlacedBoxes: [],
  });

  assert.equal(boundsIntersect(placement.bounds, blockingTable), false);
});

test("chooseLogicalForeignKeyLabelPlacement evita label FK già posizionata", () => {
  const commonOptions = {
    routePoints: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ],
    defaultPoint: { x: 150, y: 0 },
    fullLabel: "id_studente -> STUDENTE.id_studente",
    reservedBoxes: [],
  };
  const first = chooseLogicalForeignKeyLabelPlacement({
    edgeId: "fk-1",
    ...commonOptions,
    alreadyPlacedBoxes: [],
  });
  const second = chooseLogicalForeignKeyLabelPlacement({
    edgeId: "fk-2",
    ...commonOptions,
    alreadyPlacedBoxes: [
      {
        id: "fk-1:label",
        kind: "label",
        ...first.bounds,
      },
    ],
  });

  assert.notDeepEqual(second.bounds, first.bounds);
  assert.equal(boundsIntersect(first.bounds, second.bounds), false);
});

test("chooseLogicalForeignKeyLabelPlacement restituisce fallback finito anche se tutto è occupato", () => {
  const placement = chooseLogicalForeignKeyLabelPlacement({
    edgeId: "fk-dense",
    routePoints: [
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ],
    defaultPoint: { x: 150, y: 0 },
    fullLabel: "id_a -> A.id",
    reservedBoxes: [
      { id: "dense", kind: "table", x: -1000, y: -1000, width: 2000, height: 2000 },
    ],
    alreadyPlacedBoxes: [],
  });

  assert.ok(Number.isFinite(placement.point.x));
  assert.ok(Number.isFinite(placement.point.y));
  assert.ok(placement.width > 0);
  assert.ok(placement.height > 0);
});

test("LogicalTransformationCanvas mantiene layer separati e tspan multilinea", () => {
  const source = readFileSync("src/logical/LogicalTransformationCanvas.tsx", "utf8");

  assert.equal(source.includes("logical-edge-path-layer"), true);
  assert.equal(source.includes("logical-edge-label-layer"), true);
  assert.equal(source.includes("<tspan"), true);
});
