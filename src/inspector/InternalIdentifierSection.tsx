import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type {
  AttributeNode,
  DiagramDocument,
  EntityNode,
  InternalIdentifier,
} from "../types/diagram";
import { CollapsiblePanel, EmptyStateCard } from "../components/panels";

interface InternalIdentifierSectionProps {
  entity: EntityNode;
  diagram: DiagramDocument;
  onEntityChange: (
    entityId: string,
    patch: Partial<EntityNode>,
    attributePatches: Record<string, Partial<AttributeNode>>,
  ) => void;
  readOnly?: boolean;
}

interface IdentifierModalProps {
  attributes: AttributeNode[];
  initialSelection?: string[];
  onCancel: () => void;
  onConfirm: (selectedIds: string[]) => void;
}

function createInternalIdentifierId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `internalIdentifier-${Math.random().toString(36).slice(2, 11)}`;
}

function getEntityAttributes(entity: EntityNode, diagram: DiagramDocument): AttributeNode[] {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const ids = new Set<string>();

  diagram.edges.forEach((edge) => {
    if (edge.type !== "attribute") {
      return;
    }

    if (edge.sourceId === entity.id) {
      const candidate = nodeMap.get(edge.targetId);
      if (candidate?.type === "attribute") {
        ids.add(candidate.id);
      }
      return;
    }

    if (edge.targetId === entity.id) {
      const candidate = nodeMap.get(edge.sourceId);
      if (candidate?.type === "attribute") {
        ids.add(candidate.id);
      }
    }
  });

  return Array.from(ids)
    .map((attributeId) => nodeMap.get(attributeId))
    .filter((node): node is AttributeNode => node?.type === "attribute")
    .sort((left, right) => left.label.localeCompare(right.label, "it", { sensitivity: "base" }));
}

function filterEligibleAttributes(
  attrs: AttributeNode[],
  currentIdentifiers: InternalIdentifier[],
  externalIdentifierAttributeIds: Set<string>,
  excludedIdentifierIndex?: number,
): AttributeNode[] {
  const used = new Set<string>();

  currentIdentifiers.forEach((identifier, index) => {
    if (index === excludedIdentifierIndex) {
      return;
    }

    identifier.attributeIds.forEach((attributeId) => used.add(attributeId));
  });

  return attrs.filter((attribute) => {
    if (attribute.isMultivalued === true) {
      return false;
    }

    if (attribute.isIdentifier === true) {
      return false;
    }

    if (used.has(attribute.id)) {
      return false;
    }

    if (externalIdentifierAttributeIds.has(attribute.id)) {
      return false;
    }

    return true;
  });
}

function IdentifierModal({
  attributes,
  initialSelection = [],
  onCancel,
  onConfirm,
}: IdentifierModalProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelection));

  function toggle(attributeId: string) {
    const next = new Set(selected);
    if (next.has(attributeId)) {
      next.delete(attributeId);
    } else {
      next.add(attributeId);
    }
    setSelected(next);
  }

  const modalContent = (
    <div className="help-modal-backdrop" role="dialog" aria-modal="true" aria-label="Identificatore interno">
      <div className="help-modal action-modal">
        <div className="help-modal-head">
          <h2>Crea o modifica identificatore interno</h2>
          <button type="button" className="help-close" onClick={onCancel}>
            Chiudi
          </button>
        </div>

        <div className="action-modal-content">
          <p>
            Seleziona uno o piu attributi. Un solo attributo crea un identificatore semplice, due o piu attributi
            creano un identificatore composto.
          </p>

          <div className="modal-attribute-list">
            {attributes.map((attribute) => (
              <label key={attribute.id} className="field checkbox-field">
                <span>{attribute.label}</span>
                <input
                  type="checkbox"
                  checked={selected.has(attribute.id)}
                  onChange={() => toggle(attribute.id)}
                />
              </label>
            ))}
            {attributes.length === 0 ? <p className="action-hint">Nessun attributo disponibile.</p> : null}
          </div>

          <div className="action-modal-actions">
            <button type="button" onClick={onCancel}>
              Annulla
            </button>
            <button
              type="button"
              onClick={() => onConfirm(Array.from(selected))}
              disabled={selected.size === 0}
            >
              Salva
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}

export function InternalIdentifierSection({
  entity,
  diagram,
  onEntityChange,
  readOnly,
}: InternalIdentifierSectionProps) {
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const attributes = useMemo(() => getEntityAttributes(entity, diagram), [diagram, entity]);
  const internalIdentifiers = entity.internalIdentifiers ?? [];
  const externalIdentifierAttributeIds = useMemo(
    () => new Set((entity.externalIdentifiers ?? []).flatMap((identifier) => identifier.localAttributeIds)),
    [entity.externalIdentifiers],
  );
  const canAddIdentifier = useMemo(
    () => filterEligibleAttributes(attributes, internalIdentifiers, externalIdentifierAttributeIds).length > 0,
    [attributes, externalIdentifierAttributeIds, internalIdentifiers],
  );

  const selectedAttributeIds =
    modalIndex !== null && modalIndex < internalIdentifiers.length
      ? internalIdentifiers[modalIndex].attributeIds
      : [];

  const selectableAttributes = useMemo(() => {
    if (modalIndex === null) {
      return [] as AttributeNode[];
    }

    const editingIndex = modalIndex < internalIdentifiers.length ? modalIndex : undefined;
    const eligible = filterEligibleAttributes(
      attributes,
      internalIdentifiers,
      externalIdentifierAttributeIds,
      editingIndex,
    );
    const byId = new Map(eligible.map((attribute) => [attribute.id, attribute]));

    selectedAttributeIds.forEach((attributeId) => {
      const selected = attributes.find((attribute) => attribute.id === attributeId);
      if (selected) {
        byId.set(selected.id, selected);
      }
    });

    return Array.from(byId.values()).sort((left, right) =>
      left.label.localeCompare(right.label, "it", { sensitivity: "base" }),
    );
  }, [attributes, externalIdentifierAttributeIds, internalIdentifiers, modalIndex, selectedAttributeIds]);

  function applyUpdate(nextIdentifiers: InternalIdentifier[]) {
    const attributePatches: Record<string, Partial<AttributeNode>> = {};
    const simpleIdentifierAttributeIds = new Set<string>();
    const compositeIdentifierAttributeIds = new Set<string>();

    nextIdentifiers.forEach((identifier) => {
      if (identifier.attributeIds.length === 1) {
        simpleIdentifierAttributeIds.add(identifier.attributeIds[0]);
        return;
      }

      identifier.attributeIds.forEach((attributeId) => compositeIdentifierAttributeIds.add(attributeId));
    });

    attributes.forEach((attribute) => {
      attributePatches[attribute.id] = {
        isIdentifier: simpleIdentifierAttributeIds.has(attribute.id),
        isCompositeInternal: compositeIdentifierAttributeIds.has(attribute.id),
      };
    });

    onEntityChange(
      entity.id,
      {
        internalIdentifiers: nextIdentifiers.length > 0 ? nextIdentifiers : undefined,
      },
      attributePatches,
    );
  }

  function handleAdd() {
    setModalIndex(internalIdentifiers.length);
  }

  function handleEdit(index: number) {
    setModalIndex(index);
  }

  function handleDelete(index: number) {
    const nextIdentifiers = [...internalIdentifiers];
    nextIdentifiers.splice(index, 1);
    applyUpdate(nextIdentifiers);
  }

  function handleSave(selectedIds: string[]) {
    if (modalIndex === null) {
      return;
    }

    const selectableIdSet = new Set(selectableAttributes.map((attribute) => attribute.id));
    const normalizedSelectedIds = selectedIds.filter((attributeId) => selectableIdSet.has(attributeId));
    if (normalizedSelectedIds.length === 0) {
      return;
    }

    const nextIdentifiers = [...internalIdentifiers];
    if (modalIndex >= internalIdentifiers.length) {
      nextIdentifiers.push({
        id: createInternalIdentifierId(),
        attributeIds: normalizedSelectedIds,
      });
    } else {
      nextIdentifiers[modalIndex] = {
        ...nextIdentifiers[modalIndex],
        attributeIds: normalizedSelectedIds,
      };
    }

    setModalIndex(null);
    applyUpdate(nextIdentifiers);
  }

  return (
    <CollapsiblePanel title="Identificatori interni" defaultOpen className="context-card identifier-section identifier-section-internal">
      <div className="identifier-list">
        {internalIdentifiers.map((identifier, index) => {
          const labels = identifier.attributeIds
            .map((attributeId) => attributes.find((attribute) => attribute.id === attributeId)?.label ?? attributeId)
            .join(", ");
          const type = identifier.attributeIds.length === 1 ? "Semplice" : "Composto";

          return (
            <div key={identifier.id} className="identifier-row identifier-row-internal">
              <div className="identifier-main">
                <span className="identifier-attrs">{labels || "Identificatore senza attributi"}</span>
              </div>
              <span className="identifier-type">{type}</span>
              {!readOnly ? (
                <span className="identifier-actions">
                  <button type="button" onClick={() => handleEdit(index)}>
                    Modifica
                  </button>
                  <button type="button" onClick={() => handleDelete(index)}>
                    Elimina
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}

        {internalIdentifiers.length === 0 ? (
          <EmptyStateCard className="action-hint">Nessun identificatore interno definito.</EmptyStateCard>
        ) : null}
      </div>

      {!readOnly ? (
        <button
          type="button"
          className="identifier-add-button"
          onClick={handleAdd}
          disabled={!canAddIdentifier}
        >
          + Identificatore
        </button>
      ) : null}

      {modalIndex !== null ? (
        <IdentifierModal
          attributes={selectableAttributes}
          initialSelection={selectedAttributeIds}
          onCancel={() => setModalIndex(null)}
          onConfirm={handleSave}
        />
      ) : null}
    </CollapsiblePanel>
  );
}
