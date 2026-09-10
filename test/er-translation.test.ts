import assert from "node:assert/strict";
import test from "node:test";

import type { AttributeNode, DiagramDocument, DiagramEdge, DiagramNode, EntityNode } from "../src/types/diagram.ts";
import { getPreferredNodeSizeForLabel, validateDiagram } from "../src/utils/diagram.ts";
import { parseErsDiagram } from "../src/utils/ers.ts";
import {
  applyCompositeAttributeTranslation,
  applyErTranslationChoice,
  applyGeneralizationTranslation,
  applySimpleMultivaluedAttributeTranslation,
  buildErTranslationOverview,
  canOpenLogicalView,
  createEmptyErTranslationWorkspace,
  getErTranslationChoicesForItem,
  refreshErTranslationWorkspace,
} from "../src/utils/erTranslation.ts";
import type { ErTranslationChoice, ErTranslationDecision } from "../src/types/translation.ts";
import { SUPPORTED_LOCALES, translate } from "../src/i18n/index.ts";
import { withTestLocale } from "./utils/i18nTestUtils.ts";

function createEntity(
  id: string,
  label: string,
  attributeIds: string[] = [],
): EntityNode {
  return {
    id,
    type: "entity",
    label,
    x: 0,
    y: 0,
    width: 160,
    height: 80,
    internalIdentifiers:
      attributeIds.length > 0
        ? [
            {
              id: `${id}-pk`,
              attributeIds,
            },
          ]
        : [],
    externalIdentifiers: [],
    relationshipParticipations: [],
  };
}

function createAttribute(
  id: string,
  label: string,
  options: Partial<AttributeNode> = {},
): AttributeNode {
  return {
    id,
    type: "attribute",
    label,
    x: 0,
    y: 0,
    width: 100,
    height: 40,
    isIdentifier: false,
    isCompositeInternal: false,
    isMultivalued: false,
    ...options,
  };
}

function createAttributeEdge(id: string, sourceId: string, targetId: string): DiagramEdge {
  return {
    id,
    type: "attribute",
    sourceId,
    targetId,
    label: "",
    lineStyle: "solid",
  };
}

function createInheritanceEdge(id: string, subtypeId: string, supertypeId: string, groupId?: string): DiagramEdge {
  return {
    id,
    type: "inheritance",
    sourceId: subtypeId,
    targetId: supertypeId,
    label: "",
    lineStyle: "solid",
    isaCompleteness: "partial",
    isaDisjointness: "disjoint",
    generalizationGroupId: groupId,
  };
}

function getDirectEntityAttributes(diagram: DiagramDocument, entityId: string): AttributeNode[] {
  const nodeById = new Map(diagram.nodes.map((node) => [node.id, node]));
  return diagram.edges
    .filter((edge) => edge.type === "attribute" && (edge.sourceId === entityId || edge.targetId === entityId))
    .map((edge) => nodeById.get(edge.sourceId === entityId ? edge.targetId : edge.sourceId))
    .filter((node): node is AttributeNode => node?.type === "attribute");
}

function assertNoDanglingReferences(diagram: DiagramDocument) {
  const nodeIds = new Set(diagram.nodes.map((node) => node.id));
  diagram.edges.forEach((edge) => {
    assert.equal(nodeIds.has(edge.sourceId), true, `dangling edge source: ${edge.id}`);
    assert.equal(nodeIds.has(edge.targetId), true, `dangling edge target: ${edge.id}`);
  });
  (diagram.generalizationGroups ?? []).forEach((group) => {
    assert.equal(nodeIds.has(group.supertypeId), true, `dangling generalization supertype: ${group.id}`);
    group.subtypeIds.forEach((subtypeId) => {
      assert.equal(nodeIds.has(subtypeId), true, `dangling generalization subtype: ${group.id}`);
    });
  });
}

function getEntity(diagram: DiagramDocument, entityId: string): EntityNode {
  const entity = diagram.nodes.find((node): node is EntityNode => node.id === entityId && node.type === "entity");
  assert.ok(entity, `missing entity ${entityId}`);
  return entity;
}

function getRelationshipByLabel(diagram: DiagramDocument, label: string) {
  const relationship = diagram.nodes.find((node) => node.type === "relationship" && node.label === label);
  assert.ok(relationship, `missing relationship ${label}`);
  return relationship;
}

function getConnectorCardinality(diagram: DiagramDocument, entityId: string, relationshipId: string): string | undefined {
  const entity = getEntity(diagram, entityId);
  const edge = diagram.edges.find(
    (candidate) =>
      candidate.type === "connector" &&
      ((candidate.sourceId === entityId && candidate.targetId === relationshipId) ||
        (candidate.sourceId === relationshipId && candidate.targetId === entityId)),
  );
  assert.ok(edge, `missing connector between ${entityId} and ${relationshipId}`);
  return entity.relationshipParticipations?.find((participation) => participation.id === edge.participationId)
    ?.cardinality;
}

function assertSubstitutionRelationship(diagram: DiagramDocument, subtypeId: string) {
  const relationship = getRelationshipByLabel(diagram, `IS_${subtypeId}`);
  assert.equal(getConnectorCardinality(diagram, "ENTITY1", relationship.id), "(0,1)");
  assert.equal(getConnectorCardinality(diagram, subtypeId, relationship.id), "(1,1)");

  const subtype = getEntity(diagram, subtypeId);
  const externalIdentifiers = subtype.externalIdentifiers ?? [];
  assert.equal(externalIdentifiers.length, 1);
  assert.equal(externalIdentifiers[0].importedParts.length, 1);
  assert.equal(externalIdentifiers[0].importedParts[0].relationshipId, relationship.id);
  assert.equal(externalIdentifiers[0].importedParts[0].sourceEntityId, "ENTITY1");
  assert.equal(externalIdentifiers[0].importedParts[0].importedIdentifierId, "ENTITY1-pk");
  assert.deepEqual(externalIdentifiers[0].localAttributeIds, []);
}

function assertSimpleMultivaluedFix(
  diagram: DiagramDocument,
  attributeLabel: string,
  ownerCardinality: string,
  attributeEntityCardinality: string,
) {
  const attributeEntityLabel = attributeLabel.toUpperCase();
  const relationshipLabel = `HAS_${attributeEntityLabel}`;
  const attributeEntity = diagram.nodes.find(
    (node): node is EntityNode => node.type === "entity" && node.label === attributeEntityLabel,
  );
  assert.ok(attributeEntity, `missing entity ${attributeEntityLabel}`);

  const relationship = getRelationshipByLabel(diagram, relationshipLabel);
  const directOwnerAttributes = getDirectEntityAttributes(diagram, "ENTITY1").map((attribute) => attribute.label);
  assert.equal(directOwnerAttributes.includes(attributeLabel), false);
  assert.equal(directOwnerAttributes.includes("Attribute2"), true);
  assert.equal(directOwnerAttributes.includes("Attribute5"), true);

  const keyAttribute = getDirectEntityAttributes(diagram, attributeEntity.id).find(
    (attribute) => attribute.label === attributeLabel,
  );
  assert.ok(keyAttribute, `missing key attribute ${attributeLabel}`);
  assert.equal(keyAttribute.isIdentifier, true);
  assert.equal(keyAttribute.cardinality, undefined);
  assert.deepEqual(attributeEntity.internalIdentifiers?.[0]?.attributeIds, [keyAttribute.id]);
  assert.equal(getConnectorCardinality(diagram, "ENTITY1", relationship.id), ownerCardinality);
  assert.equal(getConnectorCardinality(diagram, attributeEntity.id, relationship.id), attributeEntityCardinality);
  assertNoDanglingReferences(diagram);
}

function getExpandedChoice(diagram: DiagramDocument, attributeId: string): ErTranslationChoice | undefined {
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const overview = buildErTranslationOverview(workspace);
  const item = overview.itemsByStep["composite-attributes"].find((candidate) => candidate.id === attributeId);
  if (!item) {
    return undefined;
  }

  return getErTranslationChoicesForItem(workspace, item).find(
    (choice) => choice.rule === "simple-multivalued-expanded",
  );
}

function assertExpandedAttributes(
  diagram: DiagramDocument,
  expected: Array<{ label: string; cardinality: string }>,
) {
  const generated = getDirectEntityAttributes(diagram, "ENTITY1").filter((attribute) =>
    expected.some((candidate) => candidate.label === attribute.label),
  );

  assert.deepEqual(
    generated.map((attribute) => ({ label: attribute.label, cardinality: attribute.cardinality })),
    expected,
  );
  generated.forEach((attribute) => {
    assert.equal(attribute.isMultivalued, false, `${attribute.label} must not stay multivalued`);
    assert.equal(attribute.isCompositeInternal, false, `${attribute.label} must stay simple`);
    assert.equal(attribute.isIdentifier, false, `${attribute.label} must not become an identifier`);
    assert.deepEqual(
      { width: attribute.width, height: attribute.height },
      getPreferredNodeSizeForLabel("attribute", attribute.label),
    );
  });
  assert.equal(new Set(generated.map((attribute) => attribute.id)).size, expected.length);
  assert.equal(diagram.nodes.some((node) => node.type === "entity" && node.label !== "ENTITY1"), false);
  assert.equal(diagram.nodes.some((node) => node.type === "relationship"), false);
  assertNoDanglingReferences(diagram);
}

function assertSplitAttribute(
  diagram: DiagramDocument,
  label: string,
  expectedCardinality: string | undefined,
  expectedIsMultivalued: boolean,
): AttributeNode {
  const attribute = diagram.nodes.find(
    (node): node is AttributeNode => node.type === "attribute" && node.label === label,
  );
  assert.ok(attribute, `missing split attribute ${label}`);
  assert.equal(attribute.cardinality, expectedCardinality);
  assert.equal(attribute.isMultivalued, expectedIsMultivalued);
  assert.equal(attribute.isCompositeInternal, false);
  if (!expectedIsMultivalued) {
    assert.deepEqual(
      { width: attribute.width, height: attribute.height },
      getPreferredNodeSizeForLabel("attribute", attribute.label),
    );
  }
  assert.equal(
    getDirectEntityAttributes(diagram, "ENTITY1").some((candidate) => candidate.id === attribute.id),
    true,
    `${label} must be connected directly to ENTITA1`,
  );
  return attribute;
}

function assertSplitThenSimpleMultivaluedFix(
  rule: "simple-multivalued-unique" | "simple-multivalued-shared",
  expectedAttributeEntityCardinality: string,
) {
  const splitDiagram = applyCompositeAttributeTranslation(
    createSplitCompositeAttributeDiagram({ rootCardinality: "(0,N)", rootIsMultivalued: true }),
    "attr-root",
    "composite-split",
  );
  const splitAttribute = assertSplitAttribute(splitDiagram, "ATTRIBUTO1_ATTRIBUTO3", "(0,N)", false);
  const fixedDiagram = applySimpleMultivaluedAttributeTranslation(splitDiagram, splitAttribute.id, rule);

  const relationship = getRelationshipByLabel(fixedDiagram, "HAS_ATTRIBUTO1_ATTRIBUTO3");
  const attributeEntity = fixedDiagram.nodes.find(
    (node): node is EntityNode => node.type === "entity" && node.label === "ATTRIBUTO1_ATTRIBUTO3",
  );
  assert.ok(attributeEntity);
  assert.equal(getConnectorCardinality(fixedDiagram, "ENTITY1", relationship.id), "(0,N)");
  assert.equal(getConnectorCardinality(fixedDiagram, attributeEntity.id, relationship.id), expectedAttributeEntityCardinality);
}

function createCollapseUpDiagram(options: { childAttributes?: boolean; existingType?: boolean } = {}): DiagramDocument {
  const groupId = "G_ENTITY";
  const nodes: DiagramNode[] = [
    createEntity("ENTITY1", "ENTITY1", ["Attribute9"]),
    createAttribute("Attribute9", "Attribute9", { isIdentifier: true }),
    createAttribute("Attribute8", "Attribute8"),
    createAttribute("Attribute10", "Attribute10"),
    createEntity("ENTITY2", "ENTITY2"),
    createEntity("ENTITY3", "ENTITY3"),
  ];
  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-Attribute9", "Attribute9", "ENTITY1"),
    createAttributeEdge("edge-Attribute8", "Attribute8", "ENTITY1"),
    createAttributeEdge("edge-Attribute10", "Attribute10", "ENTITY1"),
    createInheritanceEdge("edge-isa-ENTITY2", "ENTITY2", "ENTITY1", groupId),
    createInheritanceEdge("edge-isa-ENTITY3", "ENTITY3", "ENTITY1", groupId),
  ];

  if (options.existingType) {
    nodes.push(createAttribute("AttributeType", "G_ENTITY"));
    edges.push(createAttributeEdge("edge-AttributeType", "AttributeType", "ENTITY1"));
  }

  if (options.childAttributes) {
    nodes.push(createAttribute("Attribute13", "Attribute13"), createAttribute("Attribute14", "Attribute14"));
    edges.push(
      createAttributeEdge("edge-Attribute13", "Attribute13", "ENTITY2"),
      createAttributeEdge("edge-Attribute14", "Attribute14", "ENTITY3"),
    );
  }

  return {
    meta: {
      name: "Collapse up",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
    generalizationGroups: [
      {
        id: groupId,
        supertypeId: "ENTITY1",
        subtypeIds: ["ENTITY2", "ENTITY3"],
        isaCompleteness: "partial",
        isaDisjointness: "disjoint",
      },
    ],
  };
}

function createVehicleCollapseUpDiagram(
  cardinality: string | undefined,
  options: { isMultivalued?: boolean } = {},
): DiagramDocument {
  const groupId = "G_VEICOLO";
  return {
    meta: {
      name: "Vehicle collapse up cardinality",
      version: 1,
    },
    notes: "",
    nodes: [
      createEntity("VEICOLO", "VEICOLO"),
      createEntity("AUTO", "AUTO"),
      createEntity("MOTO", "MOTO"),
      createAttribute("optional", "optional", {
        cardinality,
        isMultivalued: options.isMultivalued ?? false,
      }),
    ],
    edges: [
      createAttributeEdge("edge-optional", "optional", "AUTO"),
      createInheritanceEdge("edge-isa-AUTO", "AUTO", "VEICOLO", groupId),
      createInheritanceEdge("edge-isa-MOTO", "MOTO", "VEICOLO", groupId),
    ],
    generalizationGroups: [
      {
        id: groupId,
        supertypeId: "VEICOLO",
        subtypeIds: ["AUTO", "MOTO"],
        isaCompleteness: "partial",
        isaDisjointness: "disjoint",
      },
    ],
  };
}

function createSameConstraintMultiHierarchyDiagram(): DiagramDocument {
  return parseErsDiagram(`entity PERSONA {
  identifier CF
  attribute ATTRIBUTO1
}
entity UOMO
entity DONNA
entity PROFESSORE
entity STUDENTE

generalization G_SESSO (t, e) PERSONA {
  UOMO,
  DONNA
}

generalization G_RUOLO (t, e) PERSONA {
  PROFESSORE,
  STUDENTE
}`);
}

function createDifferentConstraintMultiHierarchyDiagram(): DiagramDocument {
  return parseErsDiagram(`entity PERSONA {
  identifier CF
  attribute ATTRIBUTO1
}
entity UOMO
entity DONNA
entity PROFESSORE
entity STUDENTE

generalization G_SESSO (t, e) PERSONA {
  UOMO
  DONNA
}

generalization G_RUOLO (p, o) PERSONA {
  PROFESSORE
  STUDENTE
}`);
}

function createOrderedWorkflowDiagram(): DiagramDocument {
  const nodes: DiagramNode[] = [
    createEntity("entity-persona", "PERSONA", ["attr-codice"]),
    createAttribute("attr-codice", "Codice", { isIdentifier: true }),
    createEntity("entity-impiegato", "IMPIEGATO"),
    createAttribute("attr-stipendio", "Stipendio"),
    createAttribute("attr-indirizzo", "INDIRIZZO", { isMultivalued: true, width: 140, height: 52 }),
    createAttribute("attr-via", "Via"),
  ];

  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-codice", "attr-codice", "entity-persona"),
    createAttributeEdge("edge-stipendio", "attr-stipendio", "entity-impiegato"),
    createAttributeEdge("edge-indirizzo", "attr-indirizzo", "entity-persona"),
    createAttributeEdge("edge-via", "attr-via", "attr-indirizzo"),
    createInheritanceEdge("edge-isa", "entity-impiegato", "entity-persona"),
  ];

  return {
    meta: {
      name: "Workflow ordinato",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
  };
}

function createCompositeDiagram(): DiagramDocument {
  const nodes: DiagramNode[] = [
    createEntity("entity-impiegato", "IMPIEGATO", ["attr-codice"]),
    createAttribute("attr-codice", "Codice", { isIdentifier: true }),
    createAttribute("attr-indirizzo", "INDIRIZZO", { isMultivalued: true, width: 140, height: 52 }),
    createAttribute("attr-localita", "LOCALITA"),
    createAttribute("attr-via", "Via"),
    createAttribute("attr-cap", "CAP"),
  ];

  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-codice", "attr-codice", "entity-impiegato"),
    createAttributeEdge("edge-indirizzo", "attr-indirizzo", "entity-impiegato"),
    createAttributeEdge("edge-localita", "attr-localita", "attr-indirizzo"),
    createAttributeEdge("edge-via", "attr-via", "attr-localita"),
    createAttributeEdge("edge-cap", "attr-cap", "attr-localita"),
  ];

  return {
    meta: {
      name: "Attributo composto",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
  };
}

function createSimpleMultivaluedAttributeDiagram(
  attributeLabel: string,
  cardinality: string,
  options: { composite?: boolean; hierarchy?: boolean; extraAttributeLabels?: string[] } = {},
): DiagramDocument {
  const attributeId = `attr-${attributeLabel.toLowerCase()}`;
  const nodes: DiagramNode[] = [
    createEntity("ENTITY1", "ENTITY1"),
    createAttribute("attr-Attribute2", "Attribute2"),
    createAttribute(attributeId, attributeLabel, {
      cardinality,
      isMultivalued: options.composite === true,
      width: 120,
      height: 44,
    }),
    createAttribute("attr-Attribute5", "Attribute5"),
  ];
  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-Attribute2", "attr-Attribute2", "ENTITY1"),
    createAttributeEdge(`edge-${attributeLabel}`, attributeId, "ENTITY1"),
    createAttributeEdge("edge-Attribute5", "attr-Attribute5", "ENTITY1"),
  ];

  (options.extraAttributeLabels ?? []).forEach((extraLabel) => {
    const extraId = `attr-${extraLabel.toLowerCase()}`;
    nodes.push(createAttribute(extraId, extraLabel));
    edges.push(createAttributeEdge(`edge-${extraLabel}`, extraId, "ENTITY1"));
  });

  if (options.composite) {
    nodes.push(createAttribute(`attr-${attributeLabel}-child`, `${attributeLabel}Child`));
    edges.push(createAttributeEdge(`edge-${attributeLabel}-child`, `attr-${attributeLabel}-child`, attributeId));
  }

  if (options.hierarchy) {
    nodes.push(createEntity("ENTITY2", "ENTITY2"));
    edges.push(createInheritanceEdge("edge-isa-ENTITY2", "ENTITY2", "ENTITY1", "G_ENTITY1"));
  }

  return {
    meta: {
      name: "Simple multivalued attribute",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
    generalizationGroups: options.hierarchy
      ? [
          {
            id: "G_ENTITY1",
            supertypeId: "ENTITY1",
            subtypeIds: ["ENTITY2"],
            isaCompleteness: "partial",
            isaDisjointness: "disjoint",
          },
        ]
      : undefined,
  };
}

function createDependentMultivaluedAttributeDiagram(options: {
  cardinality?: string;
  internalIdentifiers?: Array<{ id: string; attributeIds: string[] }>;
  ownerExternalIdentifier?: boolean;
} = {}): DiagramDocument {
  const diagram = createSimpleMultivaluedAttributeDiagram("TAG", options.cardinality ?? "(0,N)");
  const owner = getEntity(diagram, "ENTITY1");
  owner.internalIdentifiers = options.internalIdentifiers ?? [
    { id: "owner-pk", attributeIds: ["attr-Attribute2"] },
  ];
  diagram.nodes = diagram.nodes.map((node) =>
    node.id === "attr-Attribute2" ||
    owner.internalIdentifiers?.some((identifier) => identifier.attributeIds.includes(node.id))
      ? { ...node, isIdentifier: node.type === "attribute" ? true : undefined }
      : node,
  ) as DiagramNode[];

  if (!options.ownerExternalIdentifier) {
    return diagram;
  }

  owner.internalIdentifiers = [];
  const ownerLocalKey = diagram.nodes.find((node) => node.id === "attr-Attribute2");
  if (ownerLocalKey?.type === "attribute") {
    ownerLocalKey.isIdentifier = false;
  }
  owner.externalIdentifiers = [{
    id: "owner-external-key",
    importedParts: [{
      id: "owner-root-key-part",
      relationshipId: "OWNS_ENTITY1",
      sourceEntityId: "ROOT",
      importedIdentifierId: "ROOT-pk",
    }],
    localAttributeIds: ["attr-Attribute2"],
  }];
  owner.relationshipParticipations = [{
    id: "owner-root-participation",
    relationshipId: "OWNS_ENTITY1",
    cardinality: "(1,1)",
  }];
  const root = createEntity("ROOT", "ROOT", ["root-id"]);
  root.relationshipParticipations = [{
    id: "root-owner-participation",
    relationshipId: "OWNS_ENTITY1",
    cardinality: "(0,N)",
  }];
  diagram.nodes.push(
    root,
    createAttribute("root-id", "rootId", { isIdentifier: true }),
    { id: "OWNS_ENTITY1", type: "relationship", label: "OWNS_ENTITY1", x: 0, y: 0, width: 140, height: 70 },
  );
  diagram.edges.push(
    createAttributeEdge("root-id-edge", "root-id", "ROOT"),
    {
      id: "root-owner-edge",
      type: "connector",
      sourceId: "ROOT",
      targetId: "OWNS_ENTITY1",
      label: "",
      lineStyle: "solid",
      participationId: "root-owner-participation",
    },
    {
      id: "owner-root-edge",
      type: "connector",
      sourceId: "ENTITY1",
      targetId: "OWNS_ENTITY1",
      label: "",
      lineStyle: "solid",
      participationId: "owner-root-participation",
    },
  );
  return diagram;
}

function getDependentChoice(diagram: DiagramDocument, attributeId = "attr-tag") {
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const item = buildErTranslationOverview(workspace).itemsByStep["composite-attributes"].find(
    (candidate) => candidate.id === attributeId,
  );
  assert.ok(item);
  const choice = getErTranslationChoicesForItem(workspace, item).find(
    (candidate) => candidate.rule === "simple-multivalued-dependent",
  );
  assert.ok(choice);
  return { workspace, item, choice };
}

function assertDependentTranslation(
  diagram: DiagramDocument,
  expectedOwnerCardinality: string,
  expectedOwnerIdentifier: { kind: "internal" | "external"; id: string },
) {
  const dependent = diagram.nodes.find(
    (node): node is EntityNode => node.type === "entity" && node.label === "TAG",
  );
  assert.ok(dependent);
  const relationship = getRelationshipByLabel(diagram, "HAS_TAG");
  const tag = getDirectEntityAttributes(diagram, dependent.id).find((attribute) => attribute.label === "TAG");
  assert.ok(tag);
  assert.equal(getConnectorCardinality(diagram, "ENTITY1", relationship.id), expectedOwnerCardinality);
  assert.equal(getConnectorCardinality(diagram, dependent.id, relationship.id), "(1,1)");
  assert.deepEqual(dependent.internalIdentifiers ?? [], []);
  assert.equal(dependent.externalIdentifiers?.length, 1);
  const externalIdentifier = dependent.externalIdentifiers?.[0];
  assert.ok(externalIdentifier);
  assert.deepEqual(externalIdentifier.localAttributeIds, [tag.id]);
  assert.equal(externalIdentifier.importedParts.length, 1);
  assert.equal(externalIdentifier.importedParts[0].relationshipId, relationship.id);
  assert.equal(externalIdentifier.importedParts[0].sourceEntityId, "ENTITY1");
  assert.equal(externalIdentifier.importedParts[0].importedIdentifierId, expectedOwnerIdentifier.id);
  assert.equal(externalIdentifier.importedParts[0].importedIdentifierKind ?? "internal", expectedOwnerIdentifier.kind);
  assert.equal(tag.isMultivalued, false);
  assert.equal(tag.isCompositeInternal, false);
  assert.equal(tag.isIdentifier, false);
  assert.equal(tag.cardinality, undefined);
  assert.equal(getDirectEntityAttributes(diagram, "ENTITY1").some((attribute) => attribute.id === tag.id), false);
  assertNoDanglingReferences(diagram);
  assert.deepEqual(
    validateDiagram(diagram).filter((issue) => issue.level === "warning" || issue.level === "error"),
    [],
  );
}

function createSplitCompositeAttributeDiagram(options: {
  rootCardinality?: string;
  rootIsMultivalued?: boolean;
  extraLeaf?: boolean;
  nested?: boolean;
} = {}): DiagramDocument {
  const nodes: DiagramNode[] = [
    createEntity("ENTITY1", "ENTITA1"),
    createAttribute("attr-2", "ATTRIBUTO2"),
    createAttribute("attr-root", "ATTRIBUTO1", {
      isMultivalued: options.rootIsMultivalued ?? false,
      cardinality: options.rootCardinality,
      isCompositeInternal: true,
    }),
    createAttribute("attr-child", "ATTRIBUTO3"),
  ];
  const edges: DiagramEdge[] = [
    createAttributeEdge("edge-attr-2", "attr-2", "ENTITY1"),
    createAttributeEdge("edge-root", "attr-root", "ENTITY1"),
    createAttributeEdge("edge-child", "attr-child", "attr-root"),
  ];

  if (options.extraLeaf) {
    nodes.push(createAttribute("attr-child-2", "ATTRIBUTO4"));
    edges.push(createAttributeEdge("edge-child-2", "attr-child-2", "attr-root"));
  }

  if (options.nested) {
    nodes.push(createAttribute("attr-nested-leaf", "ATTRIBUTO4"));
    edges.push(createAttributeEdge("edge-nested-leaf", "attr-nested-leaf", "attr-child"));
  }

  return {
    meta: {
      name: "Split composto multivalore",
      version: 1,
    },
    notes: "",
    nodes,
    edges,
  };
}

function createLayoutRegressionDiagram(): DiagramDocument {
  const entity = {
    ...createEntity("entity-viaggio", "VIAGGIO", ["attr-codice"]),
    x: 120,
    y: 80,
    width: 180,
    height: 72,
  };
  const relationship = {
    id: "rel-tratta",
    type: "relationship" as const,
    label: "TRATTA",
    x: 410,
    y: 92,
    width: 128,
    height: 74,
  };
  const code = {
    ...createAttribute("attr-codice", "codViaggio", { isIdentifier: true }),
    x: 92,
    y: 216,
    width: 118,
    height: 36,
  };
  const date = {
    ...createAttribute("attr-partenza", "dataOraPartenza"),
    x: 330,
    y: 228,
    width: 154,
    height: 38,
  };
  const connector: DiagramEdge = {
    id: "edge-viaggio-tratta",
    type: "connector",
    sourceId: entity.id,
    targetId: relationship.id,
    label: "",
    lineStyle: "solid",
    manualOffset: 24,
  };

  return {
    meta: { name: "Layout regression", version: 1 },
    notes: "Keep this layout stable.",
    nodes: [entity, relationship, code, date],
    edges: [
      createAttributeEdge("edge-codice", code.id, entity.id),
      createAttributeEdge("edge-partenza", entity.id, date.id),
      connector,
    ],
  };
}

function assertSameNodeLayout(actual: DiagramDocument, expected: DiagramDocument) {
  const expectedNodes = new Map(expected.nodes.map((node) => [node.id, node]));

  actual.nodes.forEach((node) => {
    const expectedNode = expectedNodes.get(node.id);
    assert.ok(expectedNode, `missing source node ${node.id}`);
    assert.deepEqual(
      { x: node.x, y: node.y, width: node.width, height: node.height },
      { x: expectedNode.x, y: expectedNode.y, width: expectedNode.width, height: expectedNode.height },
    );
  });
}

test("ER translation workspace without decisions preserves source diagram layout", () => {
  const sourceDiagram = createLayoutRegressionDiagram();
  const workspace = createEmptyErTranslationWorkspace(sourceDiagram);

  assertSameNodeLayout(workspace.translatedDiagram, sourceDiagram);
});

test("refreshErTranslationWorkspace without decisions keeps current ER layout unchanged", () => {
  const sourceDiagram = createLayoutRegressionDiagram();
  const previousWorkspace = createEmptyErTranslationWorkspace(sourceDiagram);
  const shiftedWorkspace = {
    ...previousWorkspace,
    translatedDiagram: {
      ...previousWorkspace.translatedDiagram,
      nodes: previousWorkspace.translatedDiagram.nodes.map((node) => ({
        ...node,
        x: node.x + 500,
        y: node.y + 500,
      })),
    },
  };

  const workspace = refreshErTranslationWorkspace(sourceDiagram, shiftedWorkspace);

  assertSameNodeLayout(workspace.translatedDiagram, sourceDiagram);
});

test("refreshErTranslationWorkspace resets stale decisions when source signature changes", () => {
  const sourceDiagram = createLayoutRegressionDiagram();
  const baseWorkspace = createEmptyErTranslationWorkspace(sourceDiagram);
  const staleDecision: ErTranslationDecision = {
    id: "stale-generalization-decision",
    targetType: "generalization",
    targetId: "old-generalization",
    step: "generalizations",
    rule: "generalization-collapse-up",
    summary: "Old decision",
    appliedAt: "2024-01-01T00:00:00.000Z",
    status: "applied",
  };
  const previousWorkspace = {
    ...baseWorkspace,
    translation: {
      ...baseWorkspace.translation,
      decisions: [staleDecision],
    },
  };
  const changedSourceDiagram = {
    ...sourceDiagram,
    nodes: sourceDiagram.nodes.map((node) =>
      node.id === "entity-viaggio" ? { ...node, x: node.x + 72 } : node,
    ),
  };

  const workspace = refreshErTranslationWorkspace(changedSourceDiagram, previousWorkspace);

  assert.deepEqual(workspace.translation.decisions, []);
  assertSameNodeLayout(workspace.translatedDiagram, changedSourceDiagram);
});

test("GeneralizationGroup condivisi e separati producono item distinti nella overview", () => {
  const diagram = parseErsDiagram(`entity PERSONA {
  identifier CF
}
entity UOMO
entity DONNA
entity IMPIEGATO
entity STUDENTE

generalization G_SESSO PERSONA (t,e) {
  UOMO
  DONNA
}
generalization G_RUOLO PERSONA (p,o) {
  IMPIEGATO
  STUDENTE
}`);

  const workspace = createEmptyErTranslationWorkspace(diagram);
  const overview = buildErTranslationOverview(workspace);
  const generalizations = overview.itemsByStep.generalizations;

  assert.equal(generalizations.length, 2);
  assert.equal(generalizations.some((item) => item.id === "G_SESSO"), true);
  assert.equal(generalizations.some((item) => item.id === "G_RUOLO"), true);
});

test("GeneralizationGroup con stesso padre e stessi vincoli restano item distinti nella overview", () => {
  const diagram = createSameConstraintMultiHierarchyDiagram();
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const overview = buildErTranslationOverview(workspace);
  const generalizations = overview.itemsByStep.generalizations;

  assert.equal(generalizations.length, 2);
  assert.equal(generalizations.some((item) => item.id === "G_SESSO"), true);
  assert.equal(generalizations.some((item) => item.id === "G_RUOLO"), true);
});

test("collapse up risolve gerarchie compatibili e crea un discriminatore per gruppo", () => {
  const translated = applyGeneralizationTranslation(createSameConstraintMultiHierarchyDiagram(), {
    supertypeId: "G_SESSO",
    rule: "generalization-collapse-up",
  });

  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "PERSONA"), true);
  ["UOMO", "DONNA", "PROFESSORE", "STUDENTE"].forEach((entityId) => {
    assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === entityId), false, `${entityId} should be removed`);
  });

  const labels = getDirectEntityAttributes(translated, "PERSONA").map((attribute) => attribute.label);
  assert.equal(labels.includes("CF"), true);
  assert.equal(labels.includes("ATTRIBUTO1"), true);
  assert.equal(labels.includes("G_SESSO"), true);
  assert.equal(labels.includes("G_RUOLO"), true);
  assert.equal(labels.includes("Type"), false);
  assert.equal(translated.edges.some((edge) => edge.type === "inheritance"), false);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_SESSO" || group.id === "G_RUOLO"), false);
  assert.deepEqual(validateDiagram(translated).filter((issue) => issue.level === "error"), []);
});

test("collapse down copia attributi del padre in tutte le figlie delle gerarchie compatibili", () => {
  const translated = applyGeneralizationTranslation(createSameConstraintMultiHierarchyDiagram(), {
    supertypeId: "G_SESSO",
    rule: "generalization-collapse-down",
  });

  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "PERSONA"), false);
  ["UOMO", "DONNA", "PROFESSORE", "STUDENTE"].forEach((entityId) => {
    const entity = getEntity(translated, entityId);
    const labels = getDirectEntityAttributes(translated, entityId).map((attribute) => attribute.label);
    assert.equal(labels.includes("CF"), true, `${entityId} missing CF`);
    assert.equal(labels.includes("ATTRIBUTO1"), true, `${entityId} missing ATTRIBUTO1`);
    assert.equal(labels.includes("Type"), false);
    assert.ok(entity.internalIdentifiers?.some((identifier) => identifier.attributeIds.length > 0), `${entityId} missing inherited identifier`);
  });
  assert.equal(translated.edges.some((edge) => edge.type === "inheritance"), false);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_SESSO" || group.id === "G_RUOLO"), false);
  assert.deepEqual(validateDiagram(translated).filter((issue) => issue.level === "error"), []);
});

test("collapse up su gerarchia disjoint lascia aperta quella con vincoli diversi", () => {
  const translated = applyGeneralizationTranslation(createDifferentConstraintMultiHierarchyDiagram(), {
    supertypeId: "G_SESSO",
    rule: "generalization-collapse-up",
  });

  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "PERSONA"), true);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "UOMO"), false);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "DONNA"), false);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "PROFESSORE"), true);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "STUDENTE"), true);

  const labels = getDirectEntityAttributes(translated, "PERSONA").map((attribute) => attribute.label);
  assert.equal(labels.includes("G_SESSO"), true);
  assert.equal(labels.includes("Type"), false);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_RUOLO"), true);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_SESSO"), false);
  assert.equal(
    translated.edges.some(
      (edge) =>
        edge.type === "inheritance" &&
        edge.sourceId === "PROFESSORE" &&
        edge.targetId === "PERSONA" &&
        edge.generalizationGroupId === "G_RUOLO",
    ),
    true,
  );
  assert.equal(
    translated.edges.some(
      (edge) =>
        edge.type === "inheritance" &&
        edge.sourceId === "STUDENTE" &&
        edge.targetId === "PERSONA" &&
        edge.generalizationGroupId === "G_RUOLO",
    ),
    true,
  );
  assertNoDanglingReferences(translated);
  assert.deepEqual(validateDiagram(translated).filter((issue) => issue.level === "error"), []);
});

test("collapse down e bloccato se esiste una gerarchia diversa ancora aperta", () => {
  assert.throws(
    () =>
      applyGeneralizationTranslation(createDifferentConstraintMultiHierarchyDiagram(), {
        supertypeId: "G_SESSO",
        rule: "generalization-collapse-down",
      }),
    (error) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /Collasso verso il basso non disponibile/);
      assert.match(error.message, /G_RUOLO/);
      assert.match(error.message, /PERSONA/);
      return true;
    },
  );
});

test("collapse up su gerarchia overlap crea flag per sottotipo", () => {
  const translated = applyGeneralizationTranslation(createDifferentConstraintMultiHierarchyDiagram(), {
    supertypeId: "G_RUOLO",
    rule: "generalization-collapse-up",
  });

  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "PERSONA"), true);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "PROFESSORE"), false);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "STUDENTE"), false);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "UOMO"), true);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.id === "DONNA"), true);

  const labels = getDirectEntityAttributes(translated, "PERSONA").map((attribute) => attribute.label);
  ["CF", "ATTRIBUTO1", "is_PROFESSORE", "is_STUDENTE"].forEach((label) => {
    assert.equal(labels.includes(label), true, `missing ${label}`);
  });
  assert.equal(labels.includes("Type"), false);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_SESSO"), true);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_RUOLO"), false);
  assertNoDanglingReferences(translated);
  assert.deepEqual(validateDiagram(translated).filter((issue) => issue.level === "error"), []);
});

test("sequenza overlap up e disjoint down elimina il padre senza riferimenti residui", () => {
  const step1 = applyGeneralizationTranslation(createDifferentConstraintMultiHierarchyDiagram(), {
    supertypeId: "G_RUOLO",
    rule: "generalization-collapse-up",
  });
  const step2 = applyGeneralizationTranslation(step1, {
    supertypeId: "G_SESSO",
    rule: "generalization-collapse-down",
  });

  assert.equal(step2.nodes.some((node) => node.type === "entity" && node.id === "PERSONA"), false);
  assert.equal(step2.nodes.some((node) => node.type === "entity" && node.id === "UOMO"), true);
  assert.equal(step2.nodes.some((node) => node.type === "entity" && node.id === "DONNA"), true);
  assert.equal(step2.nodes.some((node) => node.type === "entity" && node.id === "PROFESSORE"), false);
  assert.equal(step2.nodes.some((node) => node.type === "entity" && node.id === "STUDENTE"), false);

  ["UOMO", "DONNA"].forEach((entityId) => {
    const entity = getEntity(step2, entityId);
    const labels = getDirectEntityAttributes(step2, entityId).map((attribute) => attribute.label);
    ["CF", "ATTRIBUTO1", "is_PROFESSORE", "is_STUDENTE"].forEach((label) => {
      assert.equal(labels.includes(label), true, `${entityId} missing ${label}`);
    });
    assert.equal(labels.includes("Type"), false);

    const attributeById = new Map(step2.nodes.map((node) => [node.id, node]));
    const identifierLabels = (entity.internalIdentifiers ?? [])
      .flatMap((identifier) => identifier.attributeIds)
      .map((attributeId) => attributeById.get(attributeId))
      .filter((node): node is AttributeNode => node?.type === "attribute")
      .map((attribute) => attribute.label);
    assert.equal(identifierLabels.includes("CF"), true, `${entityId} missing inherited CF identifier`);
  });

  assert.equal(step2.edges.some((edge) => edge.type === "inheritance"), false);
  assert.equal((step2.generalizationGroups ?? []).length, 0);
  assertNoDanglingReferences(step2);
  assert.deepEqual(validateDiagram(step2).filter((issue) => issue.level === "error"), []);
});

test("overview disabilita collapse down se il padre ha gerarchie diverse ancora aperte", () => {
  const workspace = createEmptyErTranslationWorkspace(createDifferentConstraintMultiHierarchyDiagram());
  const overview = buildErTranslationOverview(workspace);
  const sessoItem = overview.itemsByStep.generalizations.find((item) => item.id === "G_SESSO");
  assert.ok(sessoItem);

  const collapseDownChoice = getErTranslationChoicesForItem(workspace, sessoItem).find(
    (choice) => choice.rule === "generalization-collapse-down",
  );
  assert.ok(collapseDownChoice);
  assert.equal(collapseDownChoice.recommended, false);
  assert.match(collapseDownChoice.disabledReason ?? "", /Collasso verso il basso non disponibile/);
  assert.match(collapseDownChoice.disabledReason ?? "", /G_RUOLO/);
});

test("collapse up si applica solo al gruppo selezionato anche con stesso parent", () => {
  const diagram = parseErsDiagram(`entity PERSONA {
  identifier CF
  attribute Nome
}
entity UOMO {
  attribute Barba
}
entity DONNA {
  attribute Maternita
}
entity IMPIEGATO
entity STUDENTE

generalization G_SESSO PERSONA (t,e) {
  UOMO
  DONNA
}
generalization G_RUOLO PERSONA (p,o) {
  IMPIEGATO
  STUDENTE
}`);

  const translated = applyGeneralizationTranslation(diagram, {
    supertypeId: "G_SESSO",
    rule: "generalization-collapse-up",
  });

  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.label === "UOMO"), false);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.label === "DONNA"), false);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.label === "IMPIEGATO"), true);
  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.label === "STUDENTE"), true);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_RUOLO"), true);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_SESSO"), false);
});

test("collapse up con figlie senza attributi aggiunge il discriminatore del gruppo e rimuove la gerarchia", () => {
  const translated = applyGeneralizationTranslation(createCollapseUpDiagram(), {
    supertypeId: "G_ENTITY",
    rule: "generalization-collapse-up",
  });

  assert.equal(translated.nodes.some((node) => node.id === "ENTITY2"), false);
  assert.equal(translated.nodes.some((node) => node.id === "ENTITY3"), false);
  assert.equal(translated.edges.some((edge) => edge.type === "inheritance"), false);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_ENTITY"), false);

  const entity1 = translated.nodes.find((node): node is EntityNode => node.id === "ENTITY1" && node.type === "entity");
  assert.ok(entity1);
  const attributes = getDirectEntityAttributes(translated, "ENTITY1");
  const labels = attributes.map((attribute) => attribute.label);
  assert.deepEqual(new Set(labels), new Set(["Attribute9", "Attribute8", "Attribute10", "G_ENTITY"]));

  const typeAttribute = attributes.find((attribute) => attribute.label === "G_ENTITY");
  assert.ok(typeAttribute);
  assert.equal(typeAttribute.isIdentifier, false);
  assert.equal(typeAttribute.cardinality, undefined);
  assert.equal(attributes.some((attribute) => attribute.label === "Type"), false);
  assert.deepEqual(entity1.internalIdentifiers?.[0]?.attributeIds, ["Attribute9"]);
  assertNoDanglingReferences(translated);
});

test("collapse up con figlie con attributi importa gli attributi come opzionali e aggiunge il discriminatore del gruppo", () => {
  const translated = applyGeneralizationTranslation(createCollapseUpDiagram({ childAttributes: true }), {
    supertypeId: "G_ENTITY",
    rule: "generalization-collapse-up",
  });

  assert.equal(translated.nodes.some((node) => node.id === "ENTITY2"), false);
  assert.equal(translated.nodes.some((node) => node.id === "ENTITY3"), false);
  assert.equal(translated.edges.some((edge) => edge.type === "inheritance"), false);

  const attributes = getDirectEntityAttributes(translated, "ENTITY1");
  const labels = attributes.map((attribute) => attribute.label);
  assert.deepEqual(
    new Set(labels),
    new Set(["Attribute9", "Attribute8", "Attribute10", "G_ENTITY", "Attribute13", "Attribute14"]),
  );

  const typeAttribute = attributes.find((attribute) => attribute.label === "G_ENTITY");
  assert.ok(typeAttribute);
  assert.equal(typeAttribute.isIdentifier, false);
  assert.equal(attributes.some((attribute) => attribute.label === "Type"), false);

  ["Attribute13", "Attribute14"].forEach((label) => {
    const attribute = attributes.find((candidate) => candidate.label === label);
    assert.ok(attribute, `missing imported attribute ${label}`);
    assert.equal(attribute.cardinality, "(0,1)");
    assert.equal(attribute.isIdentifier, false);
  });

  const entity1 = translated.nodes.find((node): node is EntityNode => node.id === "ENTITY1" && node.type === "entity");
  assert.ok(entity1);
  assert.deepEqual(entity1.internalIdentifiers?.[0]?.attributeIds, ["Attribute9"]);
  assertNoDanglingReferences(translated);
});

test("collapse up preserva cardinalita e flag di un attributo semplice multivalore (0,N)", () => {
  const translated = applyGeneralizationTranslation(
    createVehicleCollapseUpDiagram("(0,N)", { isMultivalued: true }),
    {
      supertypeId: "G_VEICOLO",
      rule: "generalization-collapse-up",
    },
  );

  assert.equal(translated.nodes.some((node) => node.id === "AUTO"), false);
  assert.equal(translated.nodes.some((node) => node.id === "MOTO"), false);
  assert.equal(translated.edges.some((edge) => edge.type === "inheritance"), false);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_VEICOLO"), false);

  const optional = getDirectEntityAttributes(translated, "VEICOLO").find(
    (attribute) => attribute.id === "optional",
  );
  assert.ok(optional);
  assert.equal(optional.label, "optional");
  assert.equal(optional.cardinality, "(0,N)");
  assert.equal(optional.isMultivalued, true);
  assertNoDanglingReferences(translated);
});

test("workspace rileva dopo collapse up il Fix per l'attributo multivalore importato", () => {
  const source = createVehicleCollapseUpDiagram("(0,N)", { isMultivalued: true });
  let workspace = createEmptyErTranslationWorkspace(source);
  let overview = buildErTranslationOverview(workspace);
  const hierarchyItem = overview.itemsByStep.generalizations.find((item) => item.id === "G_VEICOLO");
  assert.ok(hierarchyItem);
  const collapseUpChoice = getErTranslationChoicesForItem(workspace, hierarchyItem).find(
    (choice) => choice.rule === "generalization-collapse-up",
  );
  assert.ok(collapseUpChoice);

  workspace = applyErTranslationChoice(
    source,
    workspace,
    collapseUpChoice,
    hierarchyItem.targetType,
    hierarchyItem.id,
  );
  overview = buildErTranslationOverview(workspace);

  const optionalItem = overview.itemsByStep["composite-attributes"].find((item) => item.id === "optional");
  assert.ok(optionalItem);
  assert.equal(optionalItem.status, "pending");
  assert.equal(overview.steps.find((step) => step.id === "composite-attributes")?.completed, false);
  assert.deepEqual(
    getErTranslationChoicesForItem(workspace, optionalItem)
      .map((choice) => choice.rule)
      .sort(),
    ["simple-multivalued-shared", "simple-multivalued-unique"],
  );
});

test("Fix Shared dopo collapse up conserva (0,N) sul lato del supertipo owner", () => {
  const collapsed = applyGeneralizationTranslation(
    createVehicleCollapseUpDiagram("(0,N)", { isMultivalued: true }),
    {
      supertypeId: "G_VEICOLO",
      rule: "generalization-collapse-up",
    },
  );
  const translated = applySimpleMultivaluedAttributeTranslation(
    collapsed,
    "optional",
    "simple-multivalued-shared",
  );

  assert.equal(getDirectEntityAttributes(translated, "VEICOLO").some((attribute) => attribute.id === "optional"), false);
  const attributeEntity = translated.nodes.find(
    (node): node is EntityNode => node.type === "entity" && node.label === "OPTIONAL",
  );
  assert.ok(attributeEntity);
  const relationship = getRelationshipByLabel(translated, "HAS_OPTIONAL");
  assert.equal(getConnectorCardinality(translated, "VEICOLO", relationship.id), "(0,N)");
  assert.equal(getConnectorCardinality(translated, attributeEntity.id, relationship.id), "(1,N)");
  assert.equal(
    getDirectEntityAttributes(translated, attributeEntity.id).some(
      (attribute) => attribute.id === "optional" && attribute.isIdentifier,
    ),
    true,
  );
  assertNoDanglingReferences(translated);
});

test("collapse up rende opzionale un attributo scalare (1,1) e usa (0,1) se la cardinalita manca", () => {
  for (const cardinality of ["(1,1)", undefined]) {
    const translated = applyGeneralizationTranslation(createVehicleCollapseUpDiagram(cardinality), {
      supertypeId: "G_VEICOLO",
      rule: "generalization-collapse-up",
    });
    const optional = getDirectEntityAttributes(translated, "VEICOLO").find(
      (attribute) => attribute.id === "optional",
    );
    assert.ok(optional);
    assert.equal(optional.cardinality, "(0,1)");
  }
});

test("collapse up rende opzionale un attributo multivalore obbligatorio (1,N)", () => {
  const translated = applyGeneralizationTranslation(createVehicleCollapseUpDiagram("(1,N)"), {
    supertypeId: "G_VEICOLO",
    rule: "generalization-collapse-up",
  });
  const optional = getDirectEntityAttributes(translated, "VEICOLO").find(
    (attribute) => attribute.id === "optional",
  );
  assert.ok(optional);
  assert.equal(optional.cardinality, "(0,N)");
});

test("collapse up preserva un massimo numerico maggiore di uno", () => {
  const translated = applyGeneralizationTranslation(createVehicleCollapseUpDiagram("(1,5)"), {
    supertypeId: "G_VEICOLO",
    rule: "generalization-collapse-up",
  });
  const optional = getDirectEntityAttributes(translated, "VEICOLO").find(
    (attribute) => attribute.id === "optional",
  );
  assert.ok(optional);
  assert.equal(optional.cardinality, "(0,5)");
});

test("collapse up riusa il discriminatore del gruppo se esiste gia sul padre", () => {
  const translated = applyGeneralizationTranslation(createCollapseUpDiagram({ existingType: true }), {
    supertypeId: "G_ENTITY",
    rule: "generalization-collapse-up",
  });

  const typeAttributes = getDirectEntityAttributes(translated, "ENTITY1").filter(
    (attribute) => attribute.label === "G_ENTITY",
  );
  assert.equal(typeAttributes.length, 1);
  assert.equal(typeAttributes[0]?.id, "AttributeType");
});

test("collapse up non promuove gli identificatori delle figlie sul padre", () => {
  const diagram = createCollapseUpDiagram({ childAttributes: true });
  const withSubtypeIdentifier: DiagramDocument = {
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      if (node.id === "Attribute13" && node.type === "attribute") {
        return { ...node, isIdentifier: true };
      }

      if (node.id === "ENTITY2" && node.type === "entity") {
        return {
          ...node,
          internalIdentifiers: [{ id: "ENTITY2-pk", attributeIds: ["Attribute13"] }],
        };
      }

      return node;
    }),
  };

  const translated = applyGeneralizationTranslation(withSubtypeIdentifier, {
    supertypeId: "G_ENTITY",
    rule: "generalization-collapse-up",
  });
  const entity1 = translated.nodes.find((node): node is EntityNode => node.id === "ENTITY1" && node.type === "entity");
  const attribute13 = getDirectEntityAttributes(translated, "ENTITY1").find(
    (attribute) => attribute.label === "Attribute13",
  );

  assert.ok(entity1);
  assert.ok(attribute13);
  assert.equal(attribute13.isIdentifier, false);
  assert.equal(attribute13.cardinality, "(0,1)");
  assert.deepEqual(entity1.internalIdentifiers?.[0]?.attributeIds, ["Attribute9"]);
});

test("sostituzione generalizzazione con figlie con attributi crea relazioni IS e preserva attributi locali", () => {
  const translated = applyGeneralizationTranslation(createCollapseUpDiagram({ childAttributes: true }), {
    supertypeId: "G_ENTITY",
    rule: "generalization-substitution",
  });

  assert.ok(getEntity(translated, "ENTITY1"));
  assert.ok(getEntity(translated, "ENTITY2"));
  assert.ok(getEntity(translated, "ENTITY3"));
  assert.equal(translated.edges.some((edge) => edge.type === "inheritance"), false);
  assert.equal(translated.generalizationGroups?.some((group) => group.id === "G_ENTITY"), false);
  assert.equal(translated.nodes.some((node) => node.type === "attribute" && node.label === "Type"), false);

  assert.deepEqual(
    new Set(getDirectEntityAttributes(translated, "ENTITY1").map((attribute) => attribute.label)),
    new Set(["Attribute9", "Attribute8", "Attribute10"]),
  );
  assert.deepEqual(
    new Set(getDirectEntityAttributes(translated, "ENTITY2").map((attribute) => attribute.label)),
    new Set(["Attribute13"]),
  );
  assert.deepEqual(
    new Set(getDirectEntityAttributes(translated, "ENTITY3").map((attribute) => attribute.label)),
    new Set(["Attribute14"]),
  );
  assert.deepEqual(getEntity(translated, "ENTITY1").internalIdentifiers?.[0]?.attributeIds, ["Attribute9"]);

  assertSubstitutionRelationship(translated, "ENTITY2");
  assertSubstitutionRelationship(translated, "ENTITY3");
  assertNoDanglingReferences(translated);
});

test("sostituzione generalizzazione con figlie senza attributi mantiene le figlie e non crea attributi artificiali", () => {
  const translated = applyGeneralizationTranslation(createCollapseUpDiagram(), {
    supertypeId: "G_ENTITY",
    rule: "generalization-substitution",
  });

  assert.ok(getEntity(translated, "ENTITY1"));
  assert.ok(getEntity(translated, "ENTITY2"));
  assert.ok(getEntity(translated, "ENTITY3"));
  assert.equal(translated.edges.some((edge) => edge.type === "inheritance"), false);
  assert.equal(translated.nodes.some((node) => node.type === "attribute" && node.label === "Type"), false);
  assert.deepEqual(getDirectEntityAttributes(translated, "ENTITY2"), []);
  assert.deepEqual(getDirectEntityAttributes(translated, "ENTITY3"), []);

  assertSubstitutionRelationship(translated, "ENTITY2");
  assertSubstitutionRelationship(translated, "ENTITY3");
  assertNoDanglingReferences(translated);
});

test("sostituzione non duplica relazioni IS, connector o identificatori esterni gia presenti", () => {
  const base = createCollapseUpDiagram();
  const diagramWithExistingSubstitution: DiagramDocument = {
    ...base,
    edges: [
      ...base.edges,
      {
        id: "edge-ENTITY1-IS_ENTITY2",
        type: "connector",
        sourceId: "ENTITY1",
        targetId: "relationship-IS_ENTITY2",
        label: "",
        lineStyle: "solid",
        participationId: "part-ENTITY1-IS_ENTITY2",
      },
      {
        id: "edge-ENTITY2-IS_ENTITY2",
        type: "connector",
        sourceId: "ENTITY2",
        targetId: "relationship-IS_ENTITY2",
        label: "",
        lineStyle: "solid",
        participationId: "part-ENTITY2-IS_ENTITY2",
      },
    ],
    nodes: base.nodes
      .map((node) => {
        if (node.id === "ENTITY1" && node.type === "entity") {
          return {
            ...node,
            relationshipParticipations: [
              ...(node.relationshipParticipations ?? []),
              {
                id: "part-ENTITY1-IS_ENTITY2",
                relationshipId: "relationship-IS_ENTITY2",
                cardinality: "(0,N)",
              },
            ],
          };
        }

        if (node.id === "ENTITY2" && node.type === "entity") {
          return {
            ...node,
            relationshipParticipations: [
              ...(node.relationshipParticipations ?? []),
              {
                id: "part-ENTITY2-IS_ENTITY2",
                relationshipId: "relationship-IS_ENTITY2",
                cardinality: "(0,N)",
              },
            ],
            externalIdentifiers: [
              {
                id: "external-ENTITY2-IS_ENTITY2",
                relationshipId: "relationship-IS_ENTITY2",
                sourceEntityId: "ENTITY1",
                importedIdentifierId: "ENTITY1-pk",
                localAttributeIds: [],
              },
            ],
          };
        }

        return node;
      })
      .concat({
        id: "relationship-IS_ENTITY2",
        type: "relationship",
        label: "IS_ENTITY2",
        x: 160,
        y: 160,
        width: 130,
        height: 78,
      }),
  };

  const translated = applyGeneralizationTranslation(diagramWithExistingSubstitution, {
    supertypeId: "G_ENTITY",
    rule: "generalization-substitution",
  });

  assert.equal(translated.nodes.filter((node) => node.type === "relationship" && node.label === "IS_ENTITY2").length, 1);
  assert.equal(
    translated.edges.filter(
      (edge) =>
        edge.type === "connector" &&
        (edge.sourceId === "relationship-IS_ENTITY2" || edge.targetId === "relationship-IS_ENTITY2"),
    ).length,
    2,
  );
  assert.equal((getEntity(translated, "ENTITY2").externalIdentifiers ?? []).length, 1);
  assertSubstitutionRelationship(translated, "ENTITY2");
  assertSubstitutionRelationship(translated, "ENTITY3");
});

test("la pipeline ER->ER blocca gli attributi composti finche esistono generalizzazioni aperte", () => {
  const diagram = createOrderedWorkflowDiagram();
  let workspace = createEmptyErTranslationWorkspace(diagram);
  let overview = buildErTranslationOverview(workspace);

  assert.equal(overview.steps.find((step) => step.id === "generalizations")?.pending, 1);
  assert.equal(overview.itemsByStep["composite-attributes"][0]?.status, "blocked");
  assert.match(
    overview.itemsByStep["composite-attributes"][0]?.blockedReason ?? "",
    /Risolvi prima le generalizzazioni/i,
  );
  assert.equal(canOpenLogicalView(workspace).allowed, false);

  const generalizationItem = overview.itemsByStep.generalizations[0];
  assert.ok(generalizationItem);
  const generalizationChoice = getErTranslationChoicesForItem(workspace, generalizationItem).find(
    (choice) => choice.rule === "generalization-collapse-up",
  );
  assert.ok(generalizationChoice);

  workspace = applyErTranslationChoice(
    diagram,
    workspace,
    generalizationChoice,
    generalizationItem.targetType,
    generalizationItem.id,
  );
  overview = buildErTranslationOverview(workspace);

  assert.equal(overview.itemsByStep.generalizations.length, 0);
  assert.equal(overview.itemsByStep["composite-attributes"][0]?.status, "pending");
  assert.equal(canOpenLogicalView(workspace).allowed, false);

  const compositeItem = overview.itemsByStep["composite-attributes"][0];
  assert.ok(compositeItem);
  const compositeChoice = getErTranslationChoicesForItem(workspace, compositeItem).find(
    (choice) => choice.rule === "composite-split",
  );
  assert.ok(compositeChoice);

  workspace = applyErTranslationChoice(diagram, workspace, compositeChoice, compositeItem.targetType, compositeItem.id);

  assert.equal(canOpenLogicalView(workspace).allowed, true);
  assert.equal(workspace.translatedDiagram.edges.some((edge) => edge.type === "inheritance"), false);
  assert.equal(
    buildErTranslationOverview(workspace).itemsByStep["composite-attributes"].length,
    0,
  );
});

test("attributo semplice multivalore Attribute3 (1,N) mostra Fix Unique/Shared", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("Attribute3", "(1,N)");
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const overview = buildErTranslationOverview(workspace);
  const item = overview.itemsByStep["composite-attributes"].find((candidate) => candidate.id === "attr-attribute3");
  assert.ok(item);

  const choices = getErTranslationChoicesForItem(workspace, item);
  assert.deepEqual(
    choices.map((choice) => choice.label).sort(),
    ["Shared", "Unique"],
  );
  assert.deepEqual(
    choices.map((choice) => choice.rule).sort(),
    ["simple-multivalued-shared", "simple-multivalued-unique"],
  );
});

test("Dependent importa l'identificatore interno owner e preserva cardinalita e stato attributo", () => {
  for (const cardinality of ["(0,N)", "(1,N)", "(0,7)", "(3,7)"]) {
    const diagram = createDependentMultivaluedAttributeDiagram({ cardinality });
    const { choice } = getDependentChoice(diagram);
    assert.deepEqual(choice.configuration, {
      ownerIdentifierKind: "internal",
      ownerIdentifierId: "owner-pk",
    });
    assert.notEqual(choice.recommended, true);

    const translated = applySimpleMultivaluedAttributeTranslation(
      diagram,
      "attr-tag",
      "simple-multivalued-dependent",
      choice.configuration,
    );
    assertDependentTranslation(translated, cardinality, { kind: "internal", id: "owner-pk" });

    if (cardinality === "(0,7)") {
      const choices = getErTranslationChoicesForItem(
        createEmptyErTranslationWorkspace(diagram),
        buildErTranslationOverview(createEmptyErTranslationWorkspace(diagram)).itemsByStep["composite-attributes"][0],
      );
      assert.equal(choices.some((candidate) => candidate.rule === "simple-multivalued-expanded"), true);
    }
  }
});

test("Dependent importa l'intero identificatore interno composto dell'owner", () => {
  const diagram = createDependentMultivaluedAttributeDiagram({
    internalIdentifiers: [{ id: "owner-composite-pk", attributeIds: ["attr-Attribute2", "attr-Attribute5"] }],
  });
  const { choice } = getDependentChoice(diagram);
  assert.match(choice.previewLines?.[0] ?? "", /Attribute2 \+ Attribute5 \+ TAG/);

  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-tag",
    "simple-multivalued-dependent",
    choice.configuration,
  );
  assertDependentTranslation(translated, "(0,N)", { kind: "internal", id: "owner-composite-pk" });
});

test("Dependent espone choice distinte e deterministiche per piu candidate key", () => {
  const diagram = createDependentMultivaluedAttributeDiagram({
    internalIdentifiers: [
      { id: "owner-secondary-key", attributeIds: ["attr-Attribute5"] },
      { id: "owner-primary-key", attributeIds: ["attr-Attribute2"] },
    ],
  });
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const item = buildErTranslationOverview(workspace).itemsByStep["composite-attributes"][0];
  const dependentChoices = getErTranslationChoicesForItem(workspace, item).filter(
    (choice) => choice.rule === "simple-multivalued-dependent",
  );

  assert.deepEqual(
    dependentChoices.map((choice) => choice.configuration),
    [
      { ownerIdentifierKind: "internal", ownerIdentifierId: "owner-primary-key" },
      { ownerIdentifierKind: "internal", ownerIdentifierId: "owner-secondary-key" },
    ],
  );
  assert.equal(new Set(dependentChoices.map((choice) => choice.label)).size, 2);
  assert.deepEqual(
    getErTranslationChoicesForItem(workspace, item).filter((choice) => choice.rule === "simple-multivalued-dependent"),
    dependentChoices,
  );
});

test("Dependent supporta un identifier owner esterno e ne conserva il kind", () => {
  const diagram = createDependentMultivaluedAttributeDiagram({ ownerExternalIdentifier: true });
  const { choice } = getDependentChoice(diagram);
  assert.deepEqual(choice.configuration, {
    ownerIdentifierKind: "external",
    ownerIdentifierId: "owner-external-key",
  });

  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-tag",
    "simple-multivalued-dependent",
    choice.configuration,
  );
  assertDependentTranslation(translated, "(0,N)", { kind: "external", id: "owner-external-key" });
});

test("Dependent non viene proposta senza identifier owner importabile e non esiste external-only", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("TAG", "(0,N)");
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const item = buildErTranslationOverview(workspace).itemsByStep["composite-attributes"][0];
  const choices = getErTranslationChoicesForItem(workspace, item);

  assert.equal(choices.some((choice) => choice.rule === "simple-multivalued-dependent"), false);
  assert.equal(choices.some((choice) => choice.rule === ("simple-multivalued-external-only" as never)), false);
});

test("Dependent replaya la configuration e rende esplicito un identifier owner diventato invalido", () => {
  const diagram = createDependentMultivaluedAttributeDiagram();
  const { workspace, item, choice } = getDependentChoice(diagram);
  const applied = applyErTranslationChoice(diagram, workspace, choice, item.targetType, item.id);
  assert.deepEqual(applied.translation.decisions[0].configuration, choice.configuration);
  assert.deepEqual(applied.translation.conflicts, []);
  assertDependentTranslation(applied.translatedDiagram, "(0,N)", { kind: "internal", id: "owner-pk" });

  const replayed = refreshErTranslationWorkspace(diagram, JSON.parse(JSON.stringify(applied)) as typeof applied);
  assert.deepEqual(replayed.translation.conflicts, []);
  assert.deepEqual(replayed.translation.decisions[0].configuration, choice.configuration);

  const changedDiagram = {
    ...diagram,
    nodes: diagram.nodes.map((node) => {
      if (node.id === "ENTITY1" && node.type === "entity") {
        return { ...node, internalIdentifiers: [] };
      }
      if (node.id === "attr-Attribute2" && node.type === "attribute") {
        return { ...node, isIdentifier: false };
      }
      return node;
    }),
  };
  const invalid = refreshErTranslationWorkspace(changedDiagram, applied);
  assert.equal(invalid.translation.decisions.length, 0);
  assert.equal(invalid.translation.conflicts.length, 1);
  assert.match(invalid.translation.conflicts[0].message, /non e piu coerente/i);
  assert.equal(invalid.translatedDiagram.nodes.some((node) => node.type === "entity" && node.label === "TAG"), false);
});

test("Dependent gestisce collisioni di label e ID in modo deterministico", () => {
  const diagram = createDependentMultivaluedAttributeDiagram();
  diagram.nodes.push(
    createEntity("TAG", "TAG"),
    { id: "relationship-HAS_TAG", type: "relationship", label: "HAS_TAG", x: 0, y: 0, width: 120, height: 70 },
    createEntity("TAG (2)", "ALTRO"),
  );
  diagram.edges.push({
    id: "connector-ENTITY1-relationship-HAS_TAG (2)",
    type: "attribute",
    sourceId: "TAG",
    targetId: "TAG (2)",
    label: "",
    lineStyle: "solid",
  });
  const { choice } = getDependentChoice(diagram);
  const translate = () => applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-tag",
    "simple-multivalued-dependent",
    choice.configuration,
  );
  const translated = translate();

  assert.equal(translated.nodes.some((node) => node.type === "entity" && node.label === "TAG (2)"), true);
  assert.equal(translated.nodes.some((node) => node.type === "relationship" && node.label === "HAS_TAG (2)"), true);
  assert.equal(new Set(translated.nodes.map((node) => node.id)).size, translated.nodes.length);
  assert.equal(new Set(translated.edges.map((edge) => edge.id)).size, translated.edges.length);
  assert.deepEqual(translate(), translated);
});

test("Fix Shared su Attribute3 (1,N) crea entita e relazione con lato nuova entita (1,N)", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("Attribute3", "(1,N)");
  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-attribute3",
    "simple-multivalued-shared",
  );

  assertSimpleMultivaluedFix(translated, "Attribute3", "(1,N)", "(1,N)");
});

test("Fix Unique su Attribute3 (1,N) crea entita e relazione con lato nuova entita (1,1)", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("Attribute3", "(1,N)");
  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-attribute3",
    "simple-multivalued-unique",
  );

  assertSimpleMultivaluedFix(translated, "Attribute3", "(1,N)", "(1,1)");
});

test("Fix Shared su Attribute4 (0,N) preserva (0,N) sul lato owner", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("Attribute4", "(0,N)");
  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-attribute4",
    "simple-multivalued-shared",
  );

  assertSimpleMultivaluedFix(translated, "Attribute4", "(0,N)", "(1,N)");
});

test("Fix Unique su Attribute4 (0,N) preserva (0,N) sul lato owner", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("Attribute4", "(0,N)");
  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-attribute4",
    "simple-multivalued-unique",
  );

  assertSimpleMultivaluedFix(translated, "Attribute4", "(0,N)", "(1,1)");
});

test("Fix Unique/Shared dimensiona entita e relazione generate con le regole ER standard", () => {
  for (const mode of ["simple-multivalued-unique", "simple-multivalued-shared"] as const) {
    const diagram = createSimpleMultivaluedAttributeDiagram("ATTRIBUTO1_ATTRIBUTO3", "(0,N)");
    const translated = applySimpleMultivaluedAttributeTranslation(
      diagram,
      "attr-attributo1_attributo3",
      mode,
    );
    const generatedEntity = translated.nodes.find(
      (node): node is EntityNode => node.type === "entity" && node.label === "ATTRIBUTO1_ATTRIBUTO3",
    );
    const generatedRelationship = translated.nodes.find(
      (node) => node.type === "relationship" && node.label === "HAS_ATTRIBUTO1_ATTRIBUTO3",
    );
    const keyAttribute = generatedEntity
      ? getDirectEntityAttributes(translated, generatedEntity.id).find((attribute) => attribute.label === "ATTRIBUTO1_ATTRIBUTO3")
      : undefined;

    assert.ok(generatedEntity);
    assert.ok(generatedRelationship);
    assert.ok(keyAttribute);
    assert.deepEqual(
      { width: generatedEntity.width, height: generatedEntity.height },
      getPreferredNodeSizeForLabel("entity", generatedEntity.label),
    );
    assert.deepEqual(
      { width: generatedRelationship.width, height: generatedRelationship.height },
      getPreferredNodeSizeForLabel("relationship", generatedRelationship.label),
    );
    assert.deepEqual(
      { width: keyAttribute.width, height: keyAttribute.height },
      getPreferredNodeSizeForLabel("attribute", keyAttribute.label),
    );
  }
});

test("attributo composto con cardinalita non espone Fix Unique/Shared", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("Attribute3", "(1,N)", { composite: true });
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const overview = buildErTranslationOverview(workspace);
  const item = overview.itemsByStep["composite-attributes"].find((candidate) => candidate.id === "attr-attribute3");
  assert.ok(item);

  const choices = getErTranslationChoicesForItem(workspace, item);
  assert.equal(choices.some((choice) => choice.rule === "simple-multivalued-shared"), false);
  assert.equal(choices.some((choice) => choice.rule === "simple-multivalued-unique"), false);
});

test("Fix su attributo semplice multivalore e bloccato se esistono gerarchie non risolte", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("Attribute3", "(1,N)", { hierarchy: true });
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const overview = buildErTranslationOverview(workspace);
  const item = overview.itemsByStep["composite-attributes"].find((candidate) => candidate.id === "attr-attribute3");
  assert.ok(item);
  assert.equal(item.status, "blocked");
  assert.match(
    item.blockedReason ?? "",
    /Prima di correggere gli attributi multivalore devi risolvere tutte le gerarchie/i,
  );

  assert.throws(
    () =>
      applySimpleMultivaluedAttributeTranslation(
        diagram,
        "attr-attribute3",
        "simple-multivalued-shared",
      ),
    /Prima di correggere gli attributi multivalore devi risolvere tutte le gerarchie/i,
  );
  assert.equal(diagram.nodes.some((node) => node.type === "entity" && node.label === "ATTRIBUTE3"), false);
  assert.equal(diagram.nodes.some((node) => node.type === "relationship" && node.label === "HAS_ATTRIBUTE3"), false);
});

test("Espandi nell'entita e disponibile e consigliata per (0,2)", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("ATTRIBUTO2", "(0,2)");
  const choice = getExpandedChoice(diagram, "attr-attributo2");

  assert.ok(choice, "la strategia di espansione deve essere disponibile per (0,2)");
  assert.equal(choice.recommended, true);
  assert.match(choice.description, /\b2\b/);

  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-attributo2",
    "simple-multivalued-expanded",
  );

  assertExpandedAttributes(translated, [
    { label: "ATTRIBUTO2_1", cardinality: "(0,1)" },
    { label: "ATTRIBUTO2_2", cardinality: "(0,1)" },
  ]);
});

test("Espandi nell'entita resta consigliata sulla soglia (0,5)", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("ATTRIBUTO2", "(0,5)");
  const choice = getExpandedChoice(diagram, "attr-attributo2");

  assert.ok(choice);
  assert.equal(choice.recommended, true);

  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-attributo2",
    "simple-multivalued-expanded",
  );

  assertExpandedAttributes(
    translated,
    Array.from({ length: 5 }, (_unused, index) => ({
      label: `ATTRIBUTO2_${index + 1}`,
      cardinality: "(0,1)",
    })),
  );
});

test("Espandi nell'entita e disponibile ma non consigliata da (0,6) a (0,10)", () => {
  for (const max of [6, 10]) {
    const diagram = createSimpleMultivaluedAttributeDiagram("ATTRIBUTO2", `(0,${max})`);
    const choice = getExpandedChoice(diagram, "attr-attributo2");

    assert.ok(choice, `la strategia deve essere disponibile per (0,${max})`);
    assert.notEqual(choice.recommended, true, `(0,${max}) non deve essere consigliata`);

    const translated = applySimpleMultivaluedAttributeTranslation(
      diagram,
      "attr-attributo2",
      "simple-multivalued-expanded",
    );

    assertExpandedAttributes(
      translated,
      Array.from({ length: max }, (_unused, index) => ({
        label: `ATTRIBUTO2_${index + 1}`,
        cardinality: "(0,1)",
      })),
    );
  }
});

test("Espandi nell'entita non e applicabile oltre il limite (0,11) e con massimo N", () => {
  for (const cardinality of ["(0,11)", "(0,N)", "(1,N)"]) {
    const diagram = createSimpleMultivaluedAttributeDiagram("ATTRIBUTO2", cardinality);
    const workspace = createEmptyErTranslationWorkspace(diagram);
    const overview = buildErTranslationOverview(workspace);
    const item = overview.itemsByStep["composite-attributes"].find(
      (candidate) => candidate.id === "attr-attributo2",
    );
    assert.ok(item, `${cardinality} deve restare un attributo multivalore da correggere`);

    const choices = getErTranslationChoicesForItem(workspace, item);
    assert.deepEqual(
      choices.map((choice) => choice.rule).sort(),
      ["simple-multivalued-shared", "simple-multivalued-unique"],
      `${cardinality} non deve esporre la terza strategia`,
    );

    assert.throws(
      () =>
        applySimpleMultivaluedAttributeTranslation(
          diagram,
          "attr-attributo2",
          "simple-multivalued-expanded",
        ),
      /non consente l'espansione nell'entita/,
    );
  }
});

test("Espandi nell'entita preserva il minimo (3,7) con attributi obbligatori e opzionali", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("ATTRIBUTO2", "(3,7)");
  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-attributo2",
    "simple-multivalued-expanded",
  );

  assertExpandedAttributes(
    translated,
    Array.from({ length: 7 }, (_unused, index) => ({
      label: `ATTRIBUTO2_${index + 1}`,
      cardinality: index < 3 ? "(1,1)" : "(0,1)",
    })),
  );
});

test("Espandi nell'entita rende tutti gli attributi obbligatori quando minimo e massimo coincidono (7,7)", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("ATTRIBUTO2", "(7,7)");
  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-attributo2",
    "simple-multivalued-expanded",
  );

  assertExpandedAttributes(
    translated,
    Array.from({ length: 7 }, (_unused, index) => ({
      label: `ATTRIBUTO2_${index + 1}`,
      cardinality: "(1,1)",
    })),
  );
});

test("Espandi nell'entita di (0,7) crea sette attributi opzionali senza nuove entita", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("ATTRIBUTO2", "(0,7)");
  const choice = getExpandedChoice(diagram, "attr-attributo2");

  assert.ok(choice);
  assert.notEqual(choice.recommended, true);
  assert.match(choice.previewLines?.[0] ?? "", /\b7\b/);

  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-attributo2",
    "simple-multivalued-expanded",
  );

  assertExpandedAttributes(
    translated,
    Array.from({ length: 7 }, (_unused, index) => ({
      label: `ATTRIBUTO2_${index + 1}`,
      cardinality: "(0,1)",
    })),
  );
});

test("Espandi nell'entita non sovrascrive attributi omonimi gia presenti", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("ATTRIBUTO2", "(0,3)", {
    extraAttributeLabels: ["ATTRIBUTO2_1"],
  });
  const expand = () =>
    applySimpleMultivaluedAttributeTranslation(
      diagram,
      "attr-attributo2",
      "simple-multivalued-expanded",
    );
  const translated = expand();
  const ownerAttributes = getDirectEntityAttributes(translated, "ENTITY1");
  const labels = ownerAttributes.map((attribute) => attribute.label).sort();

  assert.equal(
    ownerAttributes.some(
      (attribute) => attribute.id === "attr-attributo2_1" && attribute.label === "ATTRIBUTO2_1",
    ),
    true,
    "l'attributo preesistente non deve essere sovrascritto",
  );
  assert.deepEqual(labels, [
    "ATTRIBUTO2_1",
    "ATTRIBUTO2_1 (2)",
    "ATTRIBUTO2_2",
    "ATTRIBUTO2_3",
    "Attribute2",
    "Attribute5",
  ]);
  assert.equal(new Set(translated.nodes.map((node) => node.id)).size, translated.nodes.length);
  assert.equal(new Set(translated.edges.map((edge) => edge.id)).size, translated.edges.length);
  assert.deepEqual(expand(), translated, "la trasformazione deve essere deterministica");
  assertNoDanglingReferences(translated);
});

test("Espandi nell'entita rimuove l'attributo multivalore originale e il suo edge", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("ATTRIBUTO2", "(0,3)");
  const translated = applySimpleMultivaluedAttributeTranslation(
    diagram,
    "attr-attributo2",
    "simple-multivalued-expanded",
  );

  assert.equal(translated.nodes.some((node) => node.id === "attr-attributo2"), false);
  assert.equal(translated.nodes.some((node) => node.label === "ATTRIBUTO2"), false);
  assert.equal(translated.edges.some((edge) => edge.id === "edge-ATTRIBUTO2"), false);
  assert.equal(
    translated.edges.some(
      (edge) => edge.sourceId === "attr-attributo2" || edge.targetId === "attr-attributo2",
    ),
    false,
  );
  getDirectEntityAttributes(translated, "ENTITY1")
    .filter((attribute) => attribute.label.startsWith("ATTRIBUTO2_"))
    .forEach((attribute) => {
      assert.equal(
        translated.edges.some(
          (edge) =>
            edge.type === "attribute" &&
            ((edge.sourceId === attribute.id && edge.targetId === "ENTITY1") ||
              (edge.targetId === attribute.id && edge.sourceId === "ENTITY1")),
        ),
        true,
        `missing ownership edge for ${attribute.label}`,
      );
    });
  assert.equal(getEntity(translated, "ENTITY1").relationshipParticipations?.length ?? 0, 0);
  assertNoDanglingReferences(translated);
});

test("Espandi nell'entita non altera il comportamento di Unique e Shared su cardinalita finite", () => {
  const shared = applySimpleMultivaluedAttributeTranslation(
    createSimpleMultivaluedAttributeDiagram("Attribute3", "(0,7)"),
    "attr-attribute3",
    "simple-multivalued-shared",
  );
  const unique = applySimpleMultivaluedAttributeTranslation(
    createSimpleMultivaluedAttributeDiagram("Attribute3", "(0,7)"),
    "attr-attribute3",
    "simple-multivalued-unique",
  );

  assertSimpleMultivaluedFix(shared, "Attribute3", "(0,7)", "(1,N)");
  assertSimpleMultivaluedFix(unique, "Attribute3", "(0,7)", "(1,1)");
});

test("Espandi nell'entita applicata dal workspace chiude l'item e sopravvive al replay delle decisioni", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("ATTRIBUTO2", "(0,7)");
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const item = buildErTranslationOverview(workspace).itemsByStep["composite-attributes"].find(
    (candidate) => candidate.id === "attr-attributo2",
  );
  assert.ok(item);

  const choice = getErTranslationChoicesForItem(workspace, item).find(
    (candidate) => candidate.rule === "simple-multivalued-expanded",
  );
  assert.ok(choice);

  const applied = applyErTranslationChoice(diagram, workspace, choice, "attribute", item.id);
  assert.deepEqual(applied.translation.conflicts, []);
  assert.equal(applied.translation.decisions.length, 1);
  assert.equal(applied.translation.decisions[0].rule, "simple-multivalued-expanded");
  assert.equal(buildErTranslationOverview(applied).itemsByStep["composite-attributes"].length, 0);
  assert.equal(canOpenLogicalView(applied).allowed, true);
  assertExpandedAttributes(
    applied.translatedDiagram,
    Array.from({ length: 7 }, (_unused, index) => ({
      label: `ATTRIBUTO2_${index + 1}`,
      cardinality: "(0,1)",
    })),
  );

  const roundTripped = JSON.parse(JSON.stringify(applied)) as typeof applied;
  const replayed = refreshErTranslationWorkspace(diagram, roundTripped);
  assert.deepEqual(replayed.translation.conflicts, []);
  assert.equal(replayed.translation.decisions[0].rule, "simple-multivalued-expanded");
  assert.deepEqual(
    getDirectEntityAttributes(replayed.translatedDiagram, "ENTITY1")
      .map((attribute) => attribute.label)
      .sort(),
    getDirectEntityAttributes(applied.translatedDiagram, "ENTITY1")
      .map((attribute) => attribute.label)
      .sort(),
  );
});

test("le decisioni Unique e Shared salvate prima della feature restano applicabili", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("Attribute3", "(1,N)");
  const legacyDecision: ErTranslationDecision = {
    id: "translation-attribute-attr-attribute3",
    targetType: "attribute",
    targetId: "attr-attribute3",
    step: "composite-attributes",
    rule: "simple-multivalued-shared",
    summary: "legacy",
    appliedAt: new Date(0).toISOString(),
    status: "applied",
  };
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const restored = refreshErTranslationWorkspace(diagram, {
    ...workspace,
    translation: { ...workspace.translation, decisions: [legacyDecision] },
  });

  assert.deepEqual(restored.translation.conflicts, []);
  assertSimpleMultivaluedFix(restored.translatedDiagram, "Attribute3", "(1,N)", "(1,N)");
});

test("le etichette di Espandi nell'entita sono localizzate in ogni lingua supportata", () => {
  const keys = [
    "translation.simpleMultivalued.expanded.label",
    "translation.simpleMultivalued.expanded.description",
    "translation.simpleMultivalued.expanded.summary",
    "translation.simpleMultivalued.expanded.preview",
  ] as const;

  for (const locale of SUPPORTED_LOCALES) {
    for (const key of keys) {
      const value = translate(key, { name: "ATTRIBUTO2", owner: "ENTITY1", count: 7 }, locale);
      assert.notEqual(value, key, `${locale}.${key} non risolve`);
      assert.notEqual(value.trim(), "", `${locale}.${key} e vuoto`);
    }

    withTestLocale(locale, () => {
      const choice = getExpandedChoice(
        createSimpleMultivaluedAttributeDiagram("ATTRIBUTO2", "(0,7)"),
        "attr-attributo2",
      );
      assert.ok(choice);
      assert.equal(
        choice.label,
        translate("translation.simpleMultivalued.expanded.label", undefined, locale),
      );
      assert.match(choice.description, /\b7\b/);
      assert.match(choice.summary, /ATTRIBUTO2/);
    });
  }

  assert.equal(
    translate("translation.simpleMultivalued.expanded.label", undefined, "it"),
    "Espandi nell'entità",
  );
});

test("attributo semplice non multivalore non espone Fix Unique/Shared", () => {
  const diagram = createSimpleMultivaluedAttributeDiagram("Attribute5", "(1,1)");
  const workspace = createEmptyErTranslationWorkspace(diagram);
  const overview = buildErTranslationOverview(workspace);
  assert.equal(overview.itemsByStep["composite-attributes"].some((item) => item.id === "attr-attribute5"), false);
});

test("Split di attributo composto multivalore preserva cardinalita (0,N)", () => {
  const translated = applyCompositeAttributeTranslation(
    createSplitCompositeAttributeDiagram({ rootCardinality: "(0,N)", rootIsMultivalued: true }),
    "attr-root",
    "composite-split",
  );

  assertSplitAttribute(translated, "ATTRIBUTO1_ATTRIBUTO3", "(0,N)", false);
  assert.equal(translated.nodes.some((node) => node.id === "attr-root"), false);
  assertNoDanglingReferences(translated);
});

test("Split di attributo composto multivalore preserva cardinalita (1,N)", () => {
  const translated = applyCompositeAttributeTranslation(
    createSplitCompositeAttributeDiagram({ rootCardinality: "(1,N)", rootIsMultivalued: true }),
    "attr-root",
    "composite-split",
  );

  assertSplitAttribute(translated, "ATTRIBUTO1_ATTRIBUTO3", "(1,N)", false);
});

test("Split di attributo composto non multivalore non inventa cardinalita", () => {
  const translated = applyCompositeAttributeTranslation(
    createSplitCompositeAttributeDiagram(),
    "attr-root",
    "composite-split",
  );

  assertSplitAttribute(translated, "ATTRIBUTO1_ATTRIBUTO3", undefined, false);
});

test("Split di composto multivalore con piu leaf copia cardinalita su ogni attributo generato", () => {
  const translated = applyCompositeAttributeTranslation(
    createSplitCompositeAttributeDiagram({ rootCardinality: "(0,N)", rootIsMultivalued: true, extraLeaf: true }),
    "attr-root",
    "composite-split",
  );

  assertSplitAttribute(translated, "ATTRIBUTO1_ATTRIBUTO3", "(0,N)", false);
  assertSplitAttribute(translated, "ATTRIBUTO1_ATTRIBUTO4", "(0,N)", false);
});

test("Split di composto multivalore annidato eredita la cardinalita del root", () => {
  const translated = applyCompositeAttributeTranslation(
    createSplitCompositeAttributeDiagram({ rootCardinality: "(0,N)", rootIsMultivalued: true, nested: true }),
    "attr-root",
    "composite-split",
  );

  assertSplitAttribute(translated, "ATTRIBUTO1_ATTRIBUTO3_ATTRIBUTO4", "(0,N)", false);
});

test("Split seguito da Fix Unique usa la cardinalita preservata", () => {
  assertSplitThenSimpleMultivaluedFix("simple-multivalued-unique", "(1,1)");
});

test("Split seguito da Fix Shared usa la cardinalita preservata", () => {
  assertSplitThenSimpleMultivaluedFix("simple-multivalued-shared", "(1,N)");
});

test("applyGeneralizationTranslation risolve la gerarchia ISA dentro l'ER tradotto", () => {
  const translated = applyGeneralizationTranslation(createOrderedWorkflowDiagram(), {
    supertypeId: "entity-persona",
    rule: "generalization-collapse-up",
  });

  assert.equal(translated.nodes.some((node) => node.id === "entity-impiegato"), false);
  assert.equal(translated.edges.some((edge) => edge.type === "inheritance"), false);

  const stipendioNode = translated.nodes.find((node) => node.type === "attribute" && node.label === "Stipendio");
  assert.ok(stipendioNode);
  const stipendioOwnerEdge = translated.edges.find(
    (edge) =>
      edge.type === "attribute" &&
      ((edge.sourceId === stipendioNode.id && edge.targetId === "entity-persona") ||
        (edge.targetId === stipendioNode.id && edge.sourceId === "entity-persona")),
  );
  assert.ok(stipendioOwnerEdge);
});

test("applyCompositeAttributeTranslation espande ricorsivamente i foglia sull'owner ER", () => {
  const translated = applyCompositeAttributeTranslation(
    createCompositeDiagram(),
    "attr-indirizzo",
    "composite-split",
  );

  assert.equal(translated.nodes.some((node) => node.id === "attr-indirizzo"), false);
  assert.equal(translated.nodes.some((node) => node.id === "attr-localita"), false);

  const expectedLeafLabels = ["INDIRIZZO_LOCALITA_Via", "INDIRIZZO_LOCALITA_CAP"];
  expectedLeafLabels.forEach((label) => {
    const node = translated.nodes.find((candidate) => candidate.type === "attribute" && candidate.label === label);
    assert.ok(node, `Attributo foglia tradotto non trovato: ${label}`);
    assert.equal(node.isMultivalued, false);
    const ownerEdge = translated.edges.find(
      (edge) =>
        edge.type === "attribute" &&
        ((edge.sourceId === node.id && edge.targetId === "entity-impiegato") ||
          (edge.targetId === node.id && edge.sourceId === "entity-impiegato")),
    );
    assert.ok(ownerEdge, `Collegamento owner mancante per ${label}`);
  });
});

test("applyGeneralizationTranslation con collapse verso il basso risolve gerarchia senza attributi orfani, espande connector mantenendo l'identificatore", () => {
  const ersCode = `entity ARGOMENTO {
  attribute titolo
  identifier IDArgomento
  attribute tags
}

entity ARG_TEORICO {
  attribute libro
}

entity ARG_PRATICO {
  attribute dispensa
}

generalization G_ARG ARGOMENTO (t,e) {
  ARG_TEORICO
  ARG_PRATICO
}

relation PARTECIPAZIONE ARGOMENTO "(0,N)" STATISTICA "(1,1)"
entity STATISTICA {
  attribute someAttr
}`;

  const diagram = parseErsDiagram(ersCode);
  const supertypeNode = diagram.nodes.find((n) => n.type === "entity" && n.label === "ARGOMENTO");
  assert.ok(supertypeNode);

  const translated = applyGeneralizationTranslation(diagram, {
    supertypeId: supertypeNode.id,
    rule: "generalization-collapse-down",
  });

  // 1. The supertype ARGOMENTO does not exist in translated.nodes
  assert.equal(
    translated.nodes.some((n) => n.id === supertypeNode.id),
    false,
  );

  // 2. No orphaned attributes originally belonging to the supertype
  const teorico = translated.nodes.find((n) => n.type === "entity" && n.label === "ARG_TEORICO") as EntityNode;
  const pratico = translated.nodes.find((n) => n.type === "entity" && n.label === "ARG_PRATICO") as EntityNode;
  assert.ok(teorico);
  assert.ok(pratico);

  // 3. The subtypes contain the expected inherited attributes
  const getSubtypeAttributes = (subtypeId: string) => {
    return translated.edges
      .filter((e) => e.type === "attribute" && (e.sourceId === subtypeId || e.targetId === subtypeId))
      .map((e) => {
        const attrId = e.sourceId === subtypeId ? e.targetId : e.sourceId;
        return translated.nodes.find((n) => n.id === attrId)?.label;
      });
  };

  const teoricoAttrs = getSubtypeAttributes(teorico.id);
  const praticoAttrs = getSubtypeAttributes(pratico.id);

  assert.ok(teoricoAttrs.includes("titolo"));
  assert.ok(teoricoAttrs.includes("IDArgomento"));
  assert.ok(teoricoAttrs.includes("tags"));
  assert.ok(teoricoAttrs.includes("libro"));

  assert.ok(praticoAttrs.includes("titolo"));
  assert.ok(praticoAttrs.includes("IDArgomento"));
  assert.ok(praticoAttrs.includes("tags"));
  assert.ok(praticoAttrs.includes("dispensa"));

  // Check no orphaned attribute edges to the old supertype
  assert.equal(
    translated.edges.some(
      (e) => e.type === "attribute" && (e.sourceId === supertypeNode.id || e.targetId === supertypeNode.id),
    ),
    false,
  );

  // 4. Inherited identifier is maintained
  const checkIdentifier = (subtype: EntityNode) => {
    const idEdge = translated.edges.find(
      (e) =>
        e.type === "attribute" &&
        (e.sourceId === subtype.id || e.targetId === subtype.id) &&
        translated.nodes.find((n) => n.id === (e.sourceId === subtype.id ? e.targetId : e.sourceId))?.label ===
          "IDArgomento",
    );
    assert.ok(idEdge);
    const idAttrNodeId = idEdge.sourceId === subtype.id ? idEdge.targetId : idEdge.sourceId;
    const idAttrNode = translated.nodes.find((n) => n.id === idAttrNodeId) as AttributeNode;

    assert.ok(idAttrNode);
    assert.equal(idAttrNode.isIdentifier, true);

    const internalIdentifiers = subtype.internalIdentifiers || [];
    assert.equal(internalIdentifiers.length, 1);
    assert.ok(internalIdentifiers[0].attributeIds.includes(idAttrNode.id));
  };

  checkIdentifier(teorico);
  checkIdentifier(pratico);

  // 5. No residual inheritance edges
  assert.equal(
    translated.edges.some((edge) => edge.type === "inheritance"),
    false,
  );

  // 6. Connector and cardinalities are replicated cleanly
  const partecipazione = translated.nodes.find((n) => n.type === "relationship" && n.label === "PARTECIPAZIONE");
  assert.ok(partecipazione);

  const teoricoParticipation = teorico.relationshipParticipations?.find(
    (p) => p.relationshipId === partecipazione.id,
  );
  assert.ok(teoricoParticipation);
  assert.equal(teoricoParticipation.cardinality, "(0,N)");

  const praticoParticipation = pratico.relationshipParticipations?.find(
    (p) => p.relationshipId === partecipazione.id,
  );
  assert.ok(praticoParticipation);
  assert.equal(praticoParticipation.cardinality, "(0,N)");

  // 7. No blocking structural errors are generated
  const issues = validateDiagram(translated);
  assert.equal(
    issues.filter((i) => i.level === "error").length,
    0,
  );
});

test("applyCompositeAttributeTranslation - test split", () => {
  const diagram: DiagramDocument = {
    nodes: [
      createEntity("entity-persona", "PERSONA"),
      createAttribute("attr-cf", "CF", { isIdentifier: true }),
      createAttribute("attr-dipartimento", "Dipartimento", { isMultivalued: true }),
      createAttribute("attr-nomedip", "NomeDip"),
      createAttribute("attr-numerodip", "NumeroDip"),
    ],
    edges: [
      createAttributeEdge("e-cf", "attr-cf", "entity-persona"),
      createAttributeEdge("e-dip", "attr-dipartimento", "entity-persona"),
      createAttributeEdge("e-nome", "attr-nomedip", "attr-dipartimento"),
      createAttributeEdge("e-num", "attr-numerodip", "attr-dipartimento"),
    ],
  };

  const dipartimentoNode = diagram.nodes.find((n) => n.type === "attribute" && n.label === "Dipartimento");
  assert.ok(dipartimentoNode);

  const translated = applyCompositeAttributeTranslation(diagram, dipartimentoNode.id, "composite-split");

  // assert: Dipartimento node missing
  assert.equal(
    translated.nodes.some((n) => n.id === dipartimentoNode.id),
    false,
  );

  // find entity PERSONA
  const personaNode = translated.nodes.find((n) => n.type === "entity" && n.label === "PERSONA");
  assert.ok(personaNode);

  // expect two simple attributes: NomeDip_Dipartimento and NumeroDip_Dipartimento
  const nomeDipNode = translated.nodes.find((n) => n.type === "attribute" && n.label === "NomeDip_Dipartimento");
  assert.ok(nomeDipNode, "missing NomeDip_Dipartimento");
  const numeroDipNode = translated.nodes.find((n) => n.type === "attribute" && n.label === "NumeroDip_Dipartimento");
  assert.ok(numeroDipNode, "missing NumeroDip_Dipartimento");

  // connected to PERSONA
  const nomeDipEdge = translated.edges.find(
    (e) =>
      e.type === "attribute" &&
      ((e.sourceId === nomeDipNode.id && e.targetId === personaNode.id) ||
        (e.targetId === nomeDipNode.id && e.sourceId === personaNode.id)),
  );
  assert.ok(nomeDipEdge, "NomeDip_Dipartimento not connected to PERSONA");

  const numeroDipEdge = translated.edges.find(
    (e) =>
      e.type === "attribute" &&
      ((e.sourceId === numeroDipNode.id && e.targetId === personaNode.id) ||
        (e.targetId === numeroDipNode.id && e.sourceId === personaNode.id)),
  );
  assert.ok(numeroDipEdge, "NumeroDip_Dipartimento not connected to PERSONA");

  // No orphans, no edges of the compound
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NomeDip"),
    false,
  );
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NumeroDip"),
    false,
  );
});

test("applyCompositeAttributeTranslation - test merge", () => {
  const diagram: DiagramDocument = {
    nodes: [
      createEntity("entity-persona", "PERSONA"),
      createAttribute("attr-cf", "CF", { isIdentifier: true }),
      createAttribute("attr-dipartimento", "Dipartimento", { isMultivalued: true }),
      createAttribute("attr-nomedip", "NomeDip"),
      createAttribute("attr-numerodip", "NumeroDip"),
    ],
    edges: [
      createAttributeEdge("e-cf", "attr-cf", "entity-persona"),
      createAttributeEdge("e-dip", "attr-dipartimento", "entity-persona"),
      createAttributeEdge("e-nome", "attr-nomedip", "attr-dipartimento"),
      createAttributeEdge("e-num", "attr-numerodip", "attr-dipartimento"),
    ],
  };

  const dipartimentoNode = diagram.nodes.find((n) => n.type === "attribute" && n.label === "Dipartimento");
  assert.ok(dipartimentoNode);

  const translated = applyCompositeAttributeTranslation(diagram, dipartimentoNode.id, "composite-merge");

  // assert: Dipartimento is missing
  assert.equal(
    translated.nodes.some((n) => n.id === dipartimentoNode.id),
    false,
  );

  // ONLY ONE simple attribute created on PERSONA named Dipartimento_NomeDip_NumeroDip
  const personaNode = translated.nodes.find((n) => n.type === "entity" && n.label === "PERSONA");
  assert.ok(personaNode);

  const mergedNode = translated.nodes.find((n) => n.type === "attribute" && n.label === "Dipartimento_NomeDip_NumeroDip");
  assert.ok(mergedNode, "missing Dipartimento_NomeDip_NumeroDip");

  const mergedEdge = translated.edges.find(
    (e) =>
      e.type === "attribute" &&
      ((e.sourceId === mergedNode.id && e.targetId === personaNode.id) ||
        (e.targetId === mergedNode.id && e.sourceId === personaNode.id)),
  );
  assert.ok(mergedEdge, "Dipartimento_NomeDip_NumeroDip not connected to PERSONA");

  // None of NomeDip and NumeroDip nodes should exist independently
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NomeDip"),
    false,
  );
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NumeroDip"),
    false,
  );
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NomeDip_Dipartimento"),
    false,
  );
  assert.equal(
    translated.nodes.some((n) => n.type === "attribute" && n.label === "NumeroDip_Dipartimento"),
    false,
  );
});
