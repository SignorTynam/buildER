import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type {
  AttributeNode,
  DiagramDocument,
  EntityNode,
  ExternalIdentifier,
  ExternalIdentifierImportPart,
} from "../types/diagram";
import {
  getEntityDirectAttributes,
  getEligibleImportedIdentifierParts,
  getExternalIdentifierImportedAttributes,
  getExternalIdentifierImportedPartAttributes,
  getExternalIdentifierKind,
  type ExternalIdentifierImportPartOption,
} from "../utils/diagram";
import { CollapsiblePanel, EmptyStateCard } from "../components/panels";

interface ExternalIdentifierSectionProps {
  entity: EntityNode;
  diagram: DiagramDocument;
  onEntityChange: (entityId: string, patch: Partial<EntityNode>) => void;
  readOnly?: boolean;
}

interface ExternalIdentifierModalProps {
  options: ExternalIdentifierImportPartOption[];
  localAttributes: AttributeNode[];
  initialSelectionKeys?: string[];
  initialLocalAttributeIds?: string[];
  onCancel: () => void;
  onConfirm: (selectionKeys: string[], localAttributeIds: string[]) => void;
}

function createExternalIdentifierId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `externalIdentifier-${Math.random().toString(36).slice(2, 11)}`;
}

function buildOptionKey(option: Pick<ExternalIdentifierImportPart, "relationshipId" | "sourceEntityId" | "importedIdentifierId">): string {
  return [option.relationshipId, option.sourceEntityId, option.importedIdentifierId].join("::");
}

function filterEligibleLocalAttributes(
  entity: EntityNode,
  attributes: AttributeNode[],
  currentIdentifiers: ExternalIdentifier[],
  excludedIdentifierIndex?: number,
): AttributeNode[] {
  const usedAttributeIds = new Set<string>();
  const internalIdentifierAttributeIds = new Set(
    (entity.internalIdentifiers ?? []).flatMap((identifier) => identifier.attributeIds),
  );

  currentIdentifiers.forEach((identifier, index) => {
    if (index === excludedIdentifierIndex) {
      return;
    }

    identifier.localAttributeIds.forEach((attributeId) => usedAttributeIds.add(attributeId));
  });

  return attributes.filter((attribute) => {
    if (attribute.isMultivalued === true) {
      return false;
    }

    if (attribute.isIdentifier === true || attribute.isCompositeInternal === true) {
      return false;
    }

    if (internalIdentifierAttributeIds.has(attribute.id)) {
      return false;
    }

    if (usedAttributeIds.has(attribute.id)) {
      return false;
    }

    return true;
  });
}

function ExternalIdentifierModal({
  options,
  localAttributes,
  initialSelectionKeys = [],
  initialLocalAttributeIds = [],
  onCancel,
  onConfirm,
}: ExternalIdentifierModalProps) {
  const [selectedOptionKeys, setSelectedOptionKeys] = useState<Set<string>>(
    () => new Set(initialSelectionKeys),
  );
  const [selectedLocalAttributeIds, setSelectedLocalAttributeIds] = useState<Set<string>>(
    () => new Set(initialLocalAttributeIds),
  );

  function toggleImportedPart(optionKey: string) {
    const nextSelection = new Set(selectedOptionKeys);
    if (nextSelection.has(optionKey)) {
      nextSelection.delete(optionKey);
    } else {
      nextSelection.add(optionKey);
    }
    setSelectedOptionKeys(nextSelection);
  }

  function toggleLocalAttribute(attributeId: string) {
    const nextSelection = new Set(selectedLocalAttributeIds);
    if (nextSelection.has(attributeId)) {
      nextSelection.delete(attributeId);
    } else {
      nextSelection.add(attributeId);
    }
    setSelectedLocalAttributeIds(nextSelection);
  }

  const selectedImportedCount = selectedOptionKeys.size;
  const kindLabel = selectedLocalAttributeIds.size > 0 ? "importato + locale" : "solo importato";

  const modalContent = (
    <div className="help-modal-backdrop" role="dialog" aria-modal="true" aria-label="Identificatore esterno">
      <div className="help-modal action-modal">
        <div className="help-modal-head">
          <h2>Crea o modifica identificatore esterno</h2>
          <button type="button" className="help-close" onClick={onCancel}>
            Chiudi
          </button>
        </div>

        <div className="action-modal-content">
          <div className="context-card-title">Parti importate eleggibili</div>
          <div className="modal-attribute-list">
            {options.map((option) => {
              const optionKey = buildOptionKey(option);
              return (
                <label key={optionKey} className="field checkbox-field">
                  <span>{option.sourceEntityLabel} via {option.relationshipLabel}: {option.importedIdentifierLabel}</span>
                  <input
                    type="checkbox"
                    checked={selectedOptionKeys.has(optionKey)}
                    onChange={() => toggleImportedPart(optionKey)}
                  />
                </label>
              );
            })}
            {options.length === 0 ? (
              <p className="action-hint">
                Nessuna parte importata disponibile: servono relazioni con cardinalita lato host (1,1) e sorgenti con identificatore interno.
              </p>
            ) : null}
          </div>

          <div className="context-card-title">Attributi locali dell'host</div>
          <div className="modal-attribute-list">
            {localAttributes.map((attribute) => (
              <label key={attribute.id} className="field checkbox-field">
                <span>{attribute.label}</span>
                <input
                  type="checkbox"
                  checked={selectedLocalAttributeIds.has(attribute.id)}
                  onChange={() => toggleLocalAttribute(attribute.id)}
                />
              </label>
            ))}
            {localAttributes.length === 0 ? (
              <p className="action-hint">Nessun attributo locale eleggibile: puoi creare solo un identificatore importato puro.</p>
            ) : null}
          </div>

          <p className="action-hint">Tipo risultante: {kindLabel}. Parti importate selezionate: {selectedImportedCount}.</p>

          <div className="action-modal-actions">
            <button type="button" onClick={onCancel}>
              Annulla
            </button>
            <button
              type="button"
              onClick={() => onConfirm(Array.from(selectedOptionKeys), Array.from(selectedLocalAttributeIds))}
              disabled={selectedOptionKeys.size === 0}
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

export function ExternalIdentifierSection({
  entity,
  diagram,
  onEntityChange,
  readOnly,
}: ExternalIdentifierSectionProps) {
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const externalIdentifiers = entity.externalIdentifiers ?? [];
  const directAttributes = useMemo(
    () =>
      getEntityDirectAttributes(diagram, entity.id).sort((left, right) =>
        left.label.localeCompare(right.label, "it", { sensitivity: "base" }),
      ),
    [diagram, entity.id],
  );
  const importOptions = useMemo(() => getEligibleImportedIdentifierParts(diagram, entity.id), [diagram, entity.id]);
  const canAddExternalIdentifier = importOptions.length > 0;

  const selectedExternalIdentifier =
    modalIndex !== null && modalIndex < externalIdentifiers.length ? externalIdentifiers[modalIndex] : undefined;
  const selectedOptionKeys = selectedExternalIdentifier
    ? selectedExternalIdentifier.importedParts.map((part) => buildOptionKey(part))
    : [];
  const selectableLocalAttributes = useMemo(() => {
    if (modalIndex === null) {
      return [] as AttributeNode[];
    }

    const editingIndex = modalIndex < externalIdentifiers.length ? modalIndex : undefined;
    const eligible = filterEligibleLocalAttributes(entity, directAttributes, externalIdentifiers, editingIndex);
    const byId = new Map(eligible.map((attribute) => [attribute.id, attribute]));

    selectedExternalIdentifier?.localAttributeIds.forEach((attributeId) => {
      const selectedAttribute = directAttributes.find((attribute) => attribute.id === attributeId);
      if (selectedAttribute) {
        byId.set(selectedAttribute.id, selectedAttribute);
      }
    });

    return Array.from(byId.values()).sort((left, right) =>
      left.label.localeCompare(right.label, "it", { sensitivity: "base" }),
    );
  }, [directAttributes, entity, externalIdentifiers, modalIndex, selectedExternalIdentifier]);

  function applyUpdate(nextIdentifiers: ExternalIdentifier[]) {
    onEntityChange(entity.id, {
      externalIdentifiers: nextIdentifiers.length > 0 ? nextIdentifiers : undefined,
    });
  }

  function handleSave(selectionKeys: string[], localAttributeIds: string[]) {
    if (modalIndex === null) {
      return;
    }

    const selectedOptions = selectionKeys
      .map((selectionKey) => importOptions.find((option) => buildOptionKey(option) === selectionKey))
      .filter((option): option is ExternalIdentifierImportPartOption => option !== undefined);
    if (selectedOptions.length === 0) {
      return;
    }

    const selectedOptionKeySet = new Set<string>();
    const importedParts = selectedOptions
      .filter((option) => {
        const optionKey = buildOptionKey(option);
        if (selectedOptionKeySet.has(optionKey)) {
          return false;
        }
        selectedOptionKeySet.add(optionKey);
        return true;
      })
      .map((option) => {
        const previousPart = selectedExternalIdentifier?.importedParts.find(
          (part) => buildOptionKey(part) === buildOptionKey(option),
        );
        return {
          id: previousPart?.id ?? createExternalIdentifierId(),
          relationshipId: option.relationshipId,
          sourceEntityId: option.sourceEntityId,
          importedIdentifierId: option.importedIdentifierId,
        };
      });
    const selectableAttributeIds = new Set(selectableLocalAttributes.map((attribute) => attribute.id));
    const normalizedLocalAttributeIds = localAttributeIds.filter((attributeId) => selectableAttributeIds.has(attributeId));
    const nextIdentifiers = [...externalIdentifiers];
    const previousIdentifier = modalIndex < externalIdentifiers.length ? externalIdentifiers[modalIndex] : undefined;

    const nextIdentifier: ExternalIdentifier = {
      ...previousIdentifier,
      id: previousIdentifier?.id ?? createExternalIdentifierId(),
      importedParts,
      localAttributeIds: normalizedLocalAttributeIds,
    };

    if (modalIndex >= externalIdentifiers.length) {
      nextIdentifiers.push(nextIdentifier);
    } else {
      nextIdentifiers[modalIndex] = nextIdentifier;
    }

    setModalIndex(null);
    applyUpdate(nextIdentifiers);
  }

  function handleDelete(index: number) {
    const nextIdentifiers = [...externalIdentifiers];
    nextIdentifiers.splice(index, 1);
    applyUpdate(nextIdentifiers);
  }

  return (
    <CollapsiblePanel title="Identificatori esterni" defaultOpen className="context-card identifier-section identifier-section-external">
      <div className="identifier-list">
        {externalIdentifiers.map((identifier, index) => {
          const importedAttributes = getExternalIdentifierImportedAttributes(diagram, identifier);
          const importedLabel = importedAttributes.map((attribute) => attribute.label).join(" + ");
          const localLabel = identifier.localAttributeIds
            .map((attributeId) => directAttributes.find((attribute) => attribute.id === attributeId)?.label ?? attributeId)
            .join(" + ");
          const relationLabel = identifier.importedParts
            .map((part) => diagram.nodes.find((node) => node.id === part.relationshipId && node.type === "relationship")?.label ?? part.relationshipId)
            .join(", ");
          const kind = getExternalIdentifierKind(identifier);
          const kindLabel = kind === "imported_only" ? "Importato" : "Importato + locale";
          const importedPartLabels = identifier.importedParts.map((part) => {
            const sourceEntity = diagram.nodes.find((node) => node.id === part.sourceEntityId && node.type === "entity");
            const attributes = getExternalIdentifierImportedPartAttributes(diagram, part).map((attribute) => attribute.label).join(" + ");
            return sourceEntity ? `${sourceEntity.label}: ${attributes || part.importedIdentifierId}` : part.importedIdentifierId;
          });

          return (
            <div key={identifier.id} className="identifier-row identifier-row-external">
              <div className="identifier-main">
                <span className="identifier-attrs">
                  {importedPartLabels.length > 0 ? importedPartLabels.join(" + ") : importedLabel}
                  {localLabel ? ` + ${localLabel}` : ""}
                </span>
                <span className="identifier-meta">via {relationLabel}</span>
              </div>
              <span className="identifier-type">{kindLabel}</span>
              {!readOnly ? (
                <span className="identifier-actions">
                  <button type="button" onClick={() => setModalIndex(index)}>
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

        {externalIdentifiers.length === 0 ? (
          <EmptyStateCard className="action-hint">Nessun identificatore esterno definito.</EmptyStateCard>
        ) : null}
      </div>

      {!readOnly ? (
        <button
          type="button"
          className="identifier-add-button"
          onClick={() => setModalIndex(externalIdentifiers.length)}
          disabled={!canAddExternalIdentifier}
        >
          + Identificatore esterno
        </button>
      ) : null}

      {!readOnly && !canAddExternalIdentifier ? (
        <p className="action-hint">
          Nessuna parte importata disponibile: servono relazioni con cardinalita lato host (1,1) e sorgenti con identificatore interno.
        </p>
      ) : null}

      {modalIndex !== null ? (
        <ExternalIdentifierModal
          options={importOptions}
          localAttributes={selectableLocalAttributes}
          initialSelectionKeys={selectedOptionKeys}
          initialLocalAttributeIds={selectedExternalIdentifier?.localAttributeIds}
          onCancel={() => setModalIndex(null)}
          onConfirm={handleSave}
        />
      ) : null}
    </CollapsiblePanel>
  );
}
