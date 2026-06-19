import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExternalIdentifierGroupingFrameLayout,
  buildExternalIdentifierGroupingPath,
  buildExternalIdentifierGroupingRoutePoints,
  buildImportedOnlyExternalIdentifierLayout,
  extendOpenRouteEndpoints,
  getStableLocalIdentifierMarkerPoint,
} from "../src/canvas/DiagramCanvas.tsx";
import type { AttributeNode, Bounds, DiagramDocument, EntityNode, Point } from "../src/types/diagram.ts";
import {
  getEligibleLocalExternalIdentifierAttributes,
  getEligibleImportedIdentifierParts,
  removeExternalIdentifierFromEntity,
  synchronizeExternalIdentifiers,
  validateDiagram,
} from "../src/utils/diagram.ts";

function point(x: number, y: number): Point {
  return { x, y };
}

function buildExternalIdentifierRemovalDiagram(): DiagramDocument {
  return {
    meta: { name: "Remove external id", version: 3 },
    notes: "",
    nodes: [
      {
        id: "source-1",
        type: "entity",
        label: "SOURCE1",
        x: 80,
        y: 80,
        width: 140,
        height: 64,
        internalIdentifiers: [{ id: "source-1-id", attributeIds: ["source-attr-1"] }],
        relationshipParticipations: [{ id: "source-1-r1", relationshipId: "rel-1", cardinality: "(1,N)" }],
      },
      {
        id: "source-2",
        type: "entity",
        label: "SOURCE2",
        x: 80,
        y: 260,
        width: 140,
        height: 64,
        internalIdentifiers: [{ id: "source-2-id", attributeIds: ["source-attr-2"] }],
        relationshipParticipations: [{ id: "source-2-r2", relationshipId: "rel-2", cardinality: "(1,N)" }],
      },
      {
        id: "host",
        type: "entity",
        label: "HOST",
        x: 360,
        y: 160,
        width: 140,
        height: 64,
        relationshipParticipations: [
          { id: "host-r1", relationshipId: "rel-1", cardinality: "(1,1)" },
          { id: "host-r2", relationshipId: "rel-2", cardinality: "(1,1)" },
        ],
        externalIdentifiers: [
          {
            id: "external-1",
            importedParts: [
              {
                id: "external-1-part",
                relationshipId: "rel-1",
                sourceEntityId: "source-1",
                importedIdentifierId: "source-1-id",
              },
            ],
            localAttributeIds: [],
          },
          {
            id: "external-2",
            importedParts: [
              {
                id: "external-2-part",
                relationshipId: "rel-2",
                sourceEntityId: "source-2",
                importedIdentifierId: "source-2-id",
              },
            ],
            localAttributeIds: ["local-attr"],
          },
        ],
      },
      { id: "rel-1", type: "relationship", label: "REL1", x: 250, y: 120, width: 130, height: 78 },
      { id: "rel-2", type: "relationship", label: "REL2", x: 250, y: 300, width: 130, height: 78 },
      { id: "source-attr-1", type: "attribute", label: "ID1", x: 70, y: 20, width: 120, height: 32 },
      { id: "source-attr-2", type: "attribute", label: "ID2", x: 70, y: 380, width: 120, height: 32 },
      { id: "local-attr", type: "attribute", label: "LOCAL", x: 380, y: 260, width: 120, height: 32 },
    ],
    edges: [
      { id: "source-attr-edge-1", type: "attribute", sourceId: "source-1", targetId: "source-attr-1", label: "", lineStyle: "solid" },
      { id: "source-attr-edge-2", type: "attribute", sourceId: "source-2", targetId: "source-attr-2", label: "", lineStyle: "solid" },
      { id: "local-attr-edge", type: "attribute", sourceId: "host", targetId: "local-attr", label: "", lineStyle: "solid" },
      { id: "connector-1", type: "connector", sourceId: "source-1", targetId: "rel-1", label: "", lineStyle: "solid", participationId: "source-1-r1" },
      { id: "connector-2", type: "connector", sourceId: "host", targetId: "rel-1", label: "", lineStyle: "solid", participationId: "host-r1" },
      { id: "connector-3", type: "connector", sourceId: "source-2", targetId: "rel-2", label: "", lineStyle: "solid", participationId: "source-2-r2" },
      { id: "connector-4", type: "connector", sourceId: "host", targetId: "rel-2", label: "", lineStyle: "solid", participationId: "host-r2" },
    ],
  };
}

function buildSharedLocalExternalIdentifierDiagram(): DiagramDocument {
  return {
    meta: { name: "Identificatori esterni condivisi", version: 3 },
    notes: "",
    nodes: [
      {
        id: "ENTITA1",
        type: "entity",
        label: "ENTITA1",
        x: 80,
        y: 80,
        width: 140,
        height: 64,
        internalIdentifiers: [{ id: "ENTITA1-id", attributeIds: ["ATTRIBUTO1"] }],
        relationshipParticipations: [{ id: "p-entita1-relazione1", relationshipId: "RELAZIONE1", cardinality: "(1,N)" }],
      },
      {
        id: "ENTITA2",
        type: "entity",
        label: "ENTITA2",
        x: 360,
        y: 180,
        width: 140,
        height: 64,
        relationshipParticipations: [
          { id: "p-entita2-relazione1", relationshipId: "RELAZIONE1", cardinality: "(1,1)" },
          { id: "p-entita2-relazione2", relationshipId: "RELAZIONE2", cardinality: "(1,1)" },
        ],
        externalIdentifiers: [
          {
            id: "ext-1",
            importedParts: [
              {
                id: "ext-part-1",
                relationshipId: "RELAZIONE1",
                sourceEntityId: "ENTITA1",
                importedIdentifierId: "ENTITA1-id",
              },
            ],
            localAttributeIds: ["ATTRIBUTO6", "ATTRIBUTO6"],
          },
          {
            id: "ext-duplicate",
            importedParts: [
              {
                id: "ext-part-duplicate",
                relationshipId: "RELAZIONE1",
                sourceEntityId: "ENTITA1",
                importedIdentifierId: "ENTITA1-id",
              },
            ],
            localAttributeIds: ["ATTRIBUTO6"],
          },
          {
            id: "ext-2",
            importedParts: [
              {
                id: "ext-part-2",
                relationshipId: "RELAZIONE2",
                sourceEntityId: "ENTITA3",
                importedIdentifierId: "ENTITA3-id",
              },
            ],
            localAttributeIds: ["ATTRIBUTO6"],
          },
        ],
      },
      {
        id: "ENTITA3",
        type: "entity",
        label: "ENTITA3",
        x: 660,
        y: 80,
        width: 140,
        height: 64,
        internalIdentifiers: [{ id: "ENTITA3-id", attributeIds: ["ATTRIBUTO11"] }],
        relationshipParticipations: [{ id: "p-entita3-relazione2", relationshipId: "RELAZIONE2", cardinality: "(1,N)" }],
      },
      { id: "RELAZIONE1", type: "relationship", label: "RELAZIONE1", x: 250, y: 120, width: 130, height: 78 },
      { id: "RELAZIONE2", type: "relationship", label: "RELAZIONE2", x: 520, y: 120, width: 130, height: 78 },
      { id: "ATTRIBUTO1", type: "attribute", label: "ATTRIBUTO1", x: 70, y: 20, width: 150, height: 28 },
      { id: "ATTRIBUTO6", type: "attribute", label: "ATTRIBUTO6", x: 360, y: 280, width: 150, height: 28 },
      { id: "ATTRIBUTO11", type: "attribute", label: "ATTRIBUTO11", x: 650, y: 20, width: 150, height: 28 },
    ],
    edges: [
      { id: "attr-1", type: "attribute", sourceId: "ENTITA1", targetId: "ATTRIBUTO1", label: "", lineStyle: "solid" },
      { id: "attr-6", type: "attribute", sourceId: "ENTITA2", targetId: "ATTRIBUTO6", label: "", lineStyle: "solid" },
      { id: "attr-11", type: "attribute", sourceId: "ENTITA3", targetId: "ATTRIBUTO11", label: "", lineStyle: "solid" },
      {
        id: "connector-1",
        type: "connector",
        sourceId: "ENTITA1",
        targetId: "RELAZIONE1",
        label: "",
        lineStyle: "solid",
        participationId: "p-entita1-relazione1",
      },
      {
        id: "connector-2",
        type: "connector",
        sourceId: "RELAZIONE1",
        targetId: "ENTITA2",
        label: "",
        lineStyle: "solid",
        participationId: "p-entita2-relazione1",
      },
      {
        id: "connector-3",
        type: "connector",
        sourceId: "ENTITA2",
        targetId: "RELAZIONE2",
        label: "",
        lineStyle: "solid",
        participationId: "p-entita2-relazione2",
      },
      {
        id: "connector-4",
        type: "connector",
        sourceId: "RELAZIONE2",
        targetId: "ENTITA3",
        label: "",
        lineStyle: "solid",
        participationId: "p-entita3-relazione2",
      },
    ],
  };
}

test("external identifier: synchronize keeps distinct mixed identifiers sharing the same local attribute", () => {
  const synchronized = synchronizeExternalIdentifiers(buildSharedLocalExternalIdentifierDiagram());
  const entity2 = synchronized.nodes.find((node): node is EntityNode => node.id === "ENTITA2" && node.type === "entity");

  assert.ok(entity2);
  assert.equal(entity2.externalIdentifiers?.length, 2);
  assert.deepEqual(
    entity2.externalIdentifiers?.map((identifier) => identifier.id).sort(),
    ["ext-1", "ext-2"],
  );
  entity2.externalIdentifiers?.forEach((identifier) => {
    assert.deepEqual(identifier.localAttributeIds, ["ATTRIBUTO6"]);
  });
  assert.deepEqual(
    entity2.externalIdentifiers?.map((identifier) => identifier.importedParts[0]?.relationshipId).sort(),
    ["RELAZIONE1", "RELAZIONE2"],
  );
  assert.deepEqual(
    validateDiagram(synchronized).filter((issue) => issue.id.includes("external-identifier")),
    [],
  );
});

test("external identifier modal: local attribute stays eligible when another external identifier already uses it", () => {
  const diagram = buildSharedLocalExternalIdentifierDiagram();
  const entity2 = diagram.nodes.find((node): node is EntityNode => node.id === "ENTITA2" && node.type === "entity");
  const attribute6 = diagram.nodes.find((node): node is AttributeNode => node.id === "ATTRIBUTO6" && node.type === "attribute");
  const internalAttribute: AttributeNode = {
    id: "ATTRIBUTO_INTERNO",
    type: "attribute",
    label: "ATTRIBUTO_INTERNO",
    x: 0,
    y: 0,
    width: 150,
    height: 28,
    isIdentifier: true,
  };
  const multivaluedAttribute: AttributeNode = {
    id: "ATTRIBUTO_MULTI",
    type: "attribute",
    label: "ATTRIBUTO_MULTI",
    x: 0,
    y: 0,
    width: 150,
    height: 28,
    isMultivalued: true,
  };

  assert.ok(entity2);
  assert.ok(attribute6);

  const eligibleAttributes = getEligibleLocalExternalIdentifierAttributes(
    {
      ...entity2,
      internalIdentifiers: [{ id: "internal-id", attributeIds: [internalAttribute.id] }],
    },
    [attribute6, internalAttribute, multivaluedAttribute],
  );

  assert.deepEqual(eligibleAttributes.map((attribute) => attribute.id), ["ATTRIBUTO6"]);
});

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

test("mixed external identifier: open frame route extends beyond first and last marker projections", () => {
  const route = [
    { x: 84, y: 140 },
    { x: 84, y: 196 },
    { x: 240, y: 196 },
  ];

  const extended = extendOpenRouteEndpoints(route, 16);

  assert.deepEqual(extended, [
    { x: 84, y: 124 },
    { x: 84, y: 196 },
    { x: 256, y: 196 },
  ]);
});

test("mixed external identifier: frame layout exposes a terminal marker on the extended route", () => {
  const host = {
    id: "CARTA_CREDITO",
    type: "entity" as const,
    label: "CARTA_CREDITO",
    x: 100,
    y: 100,
    width: 200,
    height: 80,
  };

  const layout = buildExternalIdentifierGroupingFrameLayout(host, [
    { kind: "importedRelationship", marker: { x: 84, y: 140 } },
    { kind: "localAttribute", marker: { x: 240, y: 196 } },
  ]);

  assert.ok(layout.pathData.length > 0);
  assert.ok(layout.terminalMarker);
});

test("mixed external identifier: frame layout separa corsie multiple sulla stessa entita", () => {
  const host = {
    id: "ENTITA1",
    type: "entity" as const,
    label: "ENTITA1",
    x: 100,
    y: 100,
    width: 200,
    height: 80,
  };
  const markers1 = [
    { kind: "importedRelationship" as const, marker: point(316, 140) },
    { kind: "localAttribute" as const, marker: point(200, 84) },
  ];
  const markers2 = [
    { kind: "importedRelationship" as const, marker: point(316, 140) },
    { kind: "localAttribute" as const, marker: point(200, 196) },
  ];

  const layout1 = buildExternalIdentifierGroupingFrameLayout(host, markers1, 0);
  const layout2 = buildExternalIdentifierGroupingFrameLayout(host, markers2, 1);
  const route1 = buildExternalIdentifierGroupingRoutePoints(host, markers1, 0);
  const route2 = buildExternalIdentifierGroupingRoutePoints(host, markers2, 1);

  assert.ok(layout1.pathData.length > 0);
  assert.ok(layout2.pathData.length > 0);
  assert.ok(layout1.terminalMarker);
  assert.ok(layout2.terminalMarker);
  assert.notEqual(layout1.pathData, layout2.pathData);
  assert.equal(route1.some((routePoint) => routePoint.x === 316 || routePoint.y === 84), true);
  assert.equal(route2.some((routePoint) => routePoint.x === 332 || routePoint.y === 212), true);
  assert.equal(route2.some((routePoint) => routePoint.x > 316 || routePoint.y > 196), true);
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

test("mixed external identifier: grouping route stays open and skips sides without markers", () => {
  const host = {
    id: "CARTA_CREDITO",
    type: "entity" as const,
    label: "CARTA_CREDITO",
    x: 100,
    y: 100,
    width: 200,
    height: 80,
  };
  const route = buildExternalIdentifierGroupingRoutePoints(host, [
    { kind: "importedRelationship", marker: point(84, 140) },
    { kind: "importedRelationship", marker: point(200, 196) },
    { kind: "localAttribute", marker: point(180, 84) },
  ]);
  const path = buildExternalIdentifierGroupingPath(host, [
    { kind: "importedRelationship", marker: point(84, 140) },
    { kind: "importedRelationship", marker: point(200, 196) },
    { kind: "localAttribute", marker: point(180, 84) },
  ]);

  assert.deepEqual(route, [
    point(200, 196),
    point(84, 196),
    point(84, 140),
    point(84, 84),
    point(180, 84),
  ]);
  assert.doesNotMatch(path, /316\.0/);
  assert.doesNotMatch(path, /Z/i);
});

test("mixed external identifier: markers on one side produce only that side segment", () => {
  const host = {
    id: "CARTA_CREDITO",
    type: "entity" as const,
    label: "CARTA_CREDITO",
    x: 100,
    y: 100,
    width: 200,
    height: 80,
  };
  const route = buildExternalIdentifierGroupingRoutePoints(host, [
    { kind: "importedRelationship", marker: point(140, 84) },
    { kind: "localAttribute", marker: point(240, 84) },
  ]);

  assert.deepEqual(route, [point(140, 84), point(240, 84)]);
});

test("mixed external identifier: left top bottom markers prefer the marked-side bracket", () => {
  const host = {
    id: "CARTA_CREDITO",
    type: "entity" as const,
    label: "CARTA_CREDITO",
    x: 100,
    y: 100,
    width: 200,
    height: 80,
  };
  const route = buildExternalIdentifierGroupingRoutePoints(host, [
    { kind: "importedRelationship", marker: point(84, 116) },
    { kind: "importedRelationship", marker: point(220, 84) },
    { kind: "localAttribute", marker: point(300, 196) },
  ]);
  const path = buildExternalIdentifierGroupingPath(host, [
    { kind: "importedRelationship", marker: point(84, 116) },
    { kind: "importedRelationship", marker: point(220, 84) },
    { kind: "localAttribute", marker: point(300, 196) },
  ]);

  assert.deepEqual(route, [
    point(300, 196),
    point(84, 196),
    point(84, 116),
    point(84, 84),
    point(220, 84),
  ]);
  assert.match(path, /^M 316\.0 196\.0 L 106\.0 196\.0/);
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

test("removeExternalIdentifierFromEntity removes only the selected external identifier", () => {
  const source = buildExternalIdentifierRemovalDiagram();
  const updated = removeExternalIdentifierFromEntity(source, "host", "external-1");
  const updatedHost = updated.nodes.find((node): node is EntityNode => node.id === "host" && node.type === "entity");

  assert.deepEqual(updatedHost?.externalIdentifiers?.map((identifier) => identifier.id), ["external-2"]);
  assert.equal(updated.nodes.some((node) => node.id === "local-attr" && node.type === "attribute"), true);
  assert.equal(updated.nodes.some((node) => node.id === "rel-1" && node.type === "relationship"), true);
  assert.equal(updated.nodes.some((node) => node.id === "rel-2" && node.type === "relationship"), true);
  assert.equal(updated.edges.some((edge) => edge.id === "connector-1"), true);
  assert.equal(updated.edges.some((edge) => edge.id === "connector-4"), true);
});
