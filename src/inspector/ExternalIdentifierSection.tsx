import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type {
  AttributeNode,
  DiagramDocument,
  EntityNode,
  ExternalIdentifier,
  InternalIdentifier,
} from "../types/diagram";
import {
  getEntityDirectAttributes,
  getExternalIdentifierImportedAttributes,
  getExternalIdentifierKind,
  getExternalIdentifierSourceEntity,
} from "../utils/diagram";
import { CollapsiblePanel, EmptyStateCard } from "../components/panels";

interface ExternalIdentifierSectionProps {
  entity: EntityNode;
  diagram: DiagramDocument;
  onEntityChange: (entityId: string, patch: Partial<EntityNode>) => void;
  readOnly?: boolean;
}

interface ExternalIdentifierOption {
  relationshipId: string;
  relationshipLabel: string;
  sourceEntityId: string;
  sourceEntityLabel: string;
  importedIdentifierId: string;
  importedIdentifierLabel: string;
}

interface ExternalIdentifierModalProps {
  options: ExternalIdentifierOption[];
  localAttributes: AttributeNode[];
  initialSelectionKey?: string;
  initialLocalAttributeIds?: string[];
  onCancel: () => void;
  onConfirm: (selectionKey: string, localAttributeIds: string[]) => void;
}

function createExternalIdentifierId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `externalIdentifier-${Math.random().toString(36).slice(2, 11)}`;
}

function buildOptionKey(option: Pick<ExternalIdentifierOption, "relationshipId" | "sourceEntityId" | "importedIdentifierId">): string {
  return [option.relationshipId, option.sourceEntityId, option.importedIdentifierId].join("::");
}

function describeInternalIdentifier(
  identifier: InternalIdentifier,
  attributesById: Map<string, AttributeNode>,
): string {
  return identifier.attributeIds
    .map((attributeId) => attributesById.get(attributeId)?.label ?? attributeId)
    .join(", ");
}

function buildImportOptions(entity: EntityNode, diagram: DiagramDocument): ExternalIdentifierOption[] {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const sourceOptions = new Map<string, ExternalIdentifierOption>();

  diagram.edges.forEach((edge) => {
    if (edge.type !== "connector") {
      return;
    }

    const relationshipId = edge.sourceId === entity.id ? edge.targetId : edge.targetId === entity.id ? edge.sourceId : null;
    if (!relationshipId) {
      return;
    }

    const relationshipNode = nodeMap.get(relationshipId);
    if (relationshipNode?.type !== "relationship") {
      return;
    }

    const participantEntityIds = diagram.edges
      .filter(
        (candidate) =>
          candidate.type === "connector" &&
          (candidate.sourceId === relationshipNode.id || candidate.targetId === relationshipNode.id),
      )
      .map((candidate) => (candidate.sourceId === relationshipNode.id ? candidate.targetId : candidate.sourceId))
      .filter((candidateId, index, source) => source.indexOf(candidateId) === index);

    if (participantEntityIds.length !== 2) {
      return;
    }

    const sourceEntity = participantEntityIds
      .map((entityId) => nodeMap.get(entityId))
      .find((candidate): candidate is EntityNode => candidate?.type === "entity" && candidate.id !== entity.id);
    if (!sourceEntity) {
      return;
    }

    const sourceAttributesById = new Map(
      getEntityDirectAttributes(diagram, sourceEntity.id).map((attribute) => [attribute.id, attribute]),
    );

    (sourceEntity.internalIdentifiers ?? []).forEach((identifier) => {
      if (identifier.attributeIds.length === 0) {
        return;
      }

      const option: ExternalIdentifierOption = {
        relationshipId: relationshipNode.id,
        relationshipLabel: relationshipNode.label,
        sourceEntityId: sourceEntity.id,
        sourceEntityLabel: sourceEntity.label,
        importedIdentifierId: identifier.id,
        importedIdentifierLabel: describeInternalIdentifier(identifier, sourceAttributesById),
      };
      sourceOptions.set(buildOptionKey(option), option);
    });
  });

  return Array.from(sourceOptions.values()).sort((left, right) => {
    const leftLabel = `${left.sourceEntityLabel} ${left.relationshipLabel} ${left.importedIdentifierLabel}`;
    const rightLabel = `${right.sourceEntityLabel} ${right.relationshipLabel} ${right.importedIdentifierLabel}`;
    return leftLabel.localeCompare(rightLabel, "it", { sensitivity: "base" });
  });
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
  initialSelectionKey,
  initialLocalAttributeIds = [],
  onCancel,
  onConfirm,
}: ExternalIdentifierModalProps) {
  const [selectedOptionKey, setSelectedOptionKey] = useState<string>(
    () =>
      initialSelectionKey ??
      (options[0]
        ? buildOptionKey(options[0])
        : buildOptionKey({
            relationshipId: "",
            sourceEntityId: "",
            importedIdentifierId: "",
          })),
  );
  const [selectedLocalAttributeIds, setSelectedLocalAttributeIds] = useState<Set<string>>(
    () => new Set(initialLocalAttributeIds),
  );

  function toggle(attributeId: string) {
    const nextSelection = new Set(selectedLocalAttributeIds);
    if (nextSelection.has(attributeId)) {
      nextSelection.delete(attributeId);
    } else {
      nextSelection.add(attributeId);
    }
    setSelectedLocalAttributeIds(nextSelection);
  }

  const selectedOption = options.find((option) => buildOptionKey(option) === selectedOptionKey);
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
          <label className="field">
            <span>Parte importata</span>
            <select value={selectedOptionKey} onChange={(event) => setSelectedOptionKey(event.target.value)}>
              {options.map((option) => (
                <option key={buildOptionKey(option)} value={buildOptionKey(option)}>
                  {option.sourceEntityLabel} via {option.relationshipLabel}: {option.importedIdentifierLabel}
                </option>
              ))}
            </select>
          </label>

          <p className="action-hint">
            {selectedOption
              ? `Importa l'identificatore "${selectedOption.importedIdentifierLabel}" da "${selectedOption.sourceEntityLabel}" tramite "${selectedOption.relationshipLabel}".`
              : "Nessuna sorgente disponibile."}
          </p>

          <div className="context-card-title">Attributi locali dell'host</div>
          <div className="modal-attribute-list">
            {localAttributes.map((attribute) => (
              <label key={attribute.id} className="field checkbox-field">
                <span>{attribute.label}</span>
                <input
                  type="checkbox"
                  checked={selectedLocalAttributeIds.has(attribute.id)}
                  onChange={() => toggle(attribute.id)}
                />
              </label>
            ))}
            {localAttributes.length === 0 ? (
              <p className="action-hint">Nessun attributo locale eleggibile: puoi creare solo un identificatore importato puro.</p>
            ) : null}
          </div>

          <p className="action-hint">Tipo risultante: {kindLabel}.</p>

          <div className="action-modal-actions">
            <button type="button" onClick={onCancel}>
              Annulla
            </button>
            <button
              type="button"
              onClick={() => onConfirm(selectedOptionKey, Array.from(selectedLocalAttributeIds))}
              disabled={!selectedOption}
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
  const importOptions = useMemo(() => buildImportOptions(entity, diagram), [diagram, entity]);
  const canAddExternalIdentifier = importOptions.length > 0;

  const selectedExternalIdentifier =
    modalIndex !== null && modalIndex < externalIdentifiers.length ? externalIdentifiers[modalIndex] : undefined;
  const selectedOptionKey = selectedExternalIdentifier
    ? buildOptionKey({
        relationshipId: selectedExternalIdentifier.relationshipId,
        sourceEntityId: selectedExternalIdentifier.sourceEntityId,
        importedIdentifierId: selectedExternalIdentifier.importedIdentifierId,
      })
    : importOptions[0]
      ? buildOptionKey(importOptions[0])
      : undefined;
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

  function handleSave(selectionKey: string, localAttributeIds: string[]) {
    if (modalIndex === null) {
      return;
    }

    const selectedOption = importOptions.find((option) => buildOptionKey(option) === selectionKey);
    if (!selectedOption) {
      return;
    }

    const selectableAttributeIds = new Set(selectableLocalAttributes.map((attribute) => attribute.id));
    const normalizedLocalAttributeIds = localAttributeIds.filter((attributeId) => selectableAttributeIds.has(attributeId));
    const nextIdentifiers = [...externalIdentifiers];
    const previousIdentifier = modalIndex < externalIdentifiers.length ? externalIdentifiers[modalIndex] : undefined;
    const baseIdentifier: ExternalIdentifier =
      previousIdentifier &&
      previousIdentifier.relationshipId === selectedOption.relationshipId &&
      previousIdentifier.sourceEntityId === selectedOption.sourceEntityId &&
      previousIdentifier.importedIdentifierId === selectedOption.importedIdentifierId
        ? previousIdentifier
        : {
            id: previousIdentifier?.id ?? createExternalIdentifierId(),
            relationshipId: selectedOption.relationshipId,
            sourceEntityId: selectedOption.sourceEntityId,
            importedIdentifierId: selectedOption.importedIdentifierId,
            localAttributeIds: [],
          };

    const nextIdentifier: ExternalIdentifier = {
      ...baseIdentifier,
      relationshipId: selectedOption.relationshipId,
      sourceEntityId: selectedOption.sourceEntityId,
      importedIdentifierId: selectedOption.importedIdentifierId,
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
    <CollapsiblePanel title="Identificatori esterni" defaultOpen className="context-card">
      <div className="identifier-list">
        {externalIdentifiers.map((identifier, index) => {
          const sourceEntity = getExternalIdentifierSourceEntity(diagram, identifier);
          const importedAttributes = getExternalIdentifierImportedAttributes(diagram, identifier);
          const importedLabel = importedAttributes.map((attribute) => attribute.label).join(", ");
          const localLabel = identifier.localAttributeIds
            .map((attributeId) => directAttributes.find((attribute) => attribute.id === attributeId)?.label ?? attributeId)
            .join(", ");
          const relationLabel =
            diagram.nodes.find((node) => node.id === identifier.relationshipId && node.type === "relationship")?.label ??
            identifier.relationshipId;
          const kind = getExternalIdentifierKind(identifier);

          return (
            <div key={identifier.id} className="identifier-row">
              <span className="identifier-attrs">
                {sourceEntity ? `${sourceEntity.label}: ${importedLabel || identifier.importedIdentifierId}` : identifier.importedIdentifierId}
                {localLabel ? ` + ${localLabel}` : ""}
              </span>
              <span className="identifier-type">
                {kind === "imported_only" ? "solo importato" : "importato + locale"} via {relationLabel}
              </span>
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
          + Aggiungi identificatore esterno
        </button>
      ) : null}

      {!readOnly && !canAddExternalIdentifier ? (
        <p className="action-hint">
          Servono una relazione identificante valida e almeno un identificatore interno disponibile sulla sorgente.
        </p>
      ) : null}

      {modalIndex !== null ? (
        <ExternalIdentifierModal
          options={importOptions}
          localAttributes={selectableLocalAttributes}
          initialSelectionKey={selectedOptionKey}
          initialLocalAttributeIds={selectedExternalIdentifier?.localAttributeIds}
          onCancel={() => setModalIndex(null)}
          onConfirm={handleSave}
        />
      ) : null}
    </CollapsiblePanel>
  );
}
