import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type {
  AttributeNode,
  DiagramDocument,
  EntityNode,
  ExternalIdentifier,
  ExternalIdentifierImportPart,
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
  initialSelectedOptionKeys?: string[];
  initialLocalAttributeIds?: string[];
  onCancel: () => void;
  onConfirm: (selectedOptionKeys: string[], localAttributeIds: string[]) => void;
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
  initialSelectedOptionKeys = [],
  initialLocalAttributeIds = [],
  onCancel,
  onConfirm,
}: ExternalIdentifierModalProps) {
  const [selectedOptionKeys, setSelectedOptionKeys] = useState<Set<string>>(
    () => new Set(initialSelectedOptionKeys.length > 0 ? initialSelectedOptionKeys : (options[0] ? [buildOptionKey(options[0])] : [])),
  );
  const [selectedLocalAttributeIds, setSelectedLocalAttributeIds] = useState<Set<string>>(
    () => new Set(initialLocalAttributeIds),
  );

  function toggleOption(optionKey: string) {
    const nextSelection = new Set(selectedOptionKeys);
    if (nextSelection.has(optionKey)) {
      nextSelection.delete(optionKey);
    } else {
      nextSelection.add(optionKey);
    }
    setSelectedOptionKeys(nextSelection);
  }

  function toggle(attributeId: string) {
    const nextSelection = new Set(selectedLocalAttributeIds);
    if (nextSelection.has(attributeId)) {
      nextSelection.delete(attributeId);
    } else {
      nextSelection.add(attributeId);
    }
    setSelectedLocalAttributeIds(nextSelection);
  }

  const selectedOptions = options.filter((option) => selectedOptionKeys.has(buildOptionKey(option)));
  const kindLabel = selectedLocalAttributeIds.size > 0 ? "importato + locale" : "solo importato";
  const isValid = selectedOptionKeys.size > 0;

  const modalContent = (
    <div className="help-modal-backdrop" role="dialog" aria-modal="true" aria-label="Identificatore esterno misto">
      <div className="help-modal action-modal">
        <div className="help-modal-head">
          <h2>Crea o modifica identificatore esterno misto</h2>
          <button type="button" className="help-close" onClick={onCancel}>
            Chiudi
          </button>
        </div>

        <div className="action-modal-content">
          <div className="context-card-title">Parti importate eleggibili</div>
          <div className="modal-attribute-list">
            {options.map((option) => (
              <label key={buildOptionKey(option)} className="field checkbox-field">
                <span>{option.sourceEntityLabel} via {option.relationshipLabel}: {option.importedIdentifierLabel}</span>
                <input
                  type="checkbox"
                  checked={selectedOptionKeys.has(buildOptionKey(option))}
                  onChange={() => toggleOption(buildOptionKey(option))}
                />
              </label>
            ))}
            {options.length === 0 ? (
              <p className="action-hint">Nessuna parte importata disponibile.</p>
            ) : null}
          </div>

          {selectedOptions.length > 0 ? (
            <p className="action-hint">
              Selezionati: {selectedOptions.map((opt) => `"${opt.sourceEntityLabel}" via "${opt.relationshipLabel}"`).join(", ")}.
            </p>
          ) : null}

          <div className="context-card-title" style={{ marginTop: "20px" }}>Attributi locali dell'host</div>
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
              <p className="action-hint">Nessun attributo locale eleggibile.</p>
            ) : null}
          </div>

          <p className="action-hint">Tipo risultante: {kindLabel}.</p>

          <div className="action-modal-actions">
            <button type="button" onClick={onCancel}>
              Annulla
            </button>
            <button
              type="button"
              onClick={() => onConfirm(Array.from(selectedOptionKeys), Array.from(selectedLocalAttributeIds))}
              disabled={!isValid}
            >
              Crea
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
  const canAddExternalIdentifier = importOptions.length > 0 && externalIdentifiers.length === 0;

  const selectedExternalIdentifier =
    modalIndex !== null && modalIndex < externalIdentifiers.length ? externalIdentifiers[modalIndex] : undefined;
  
  const selectedOptionKeys = selectedExternalIdentifier
    ? selectedExternalIdentifier.importedParts.map((part) => 
        buildOptionKey({
          relationshipId: part.relationshipId,
          sourceEntityId: part.sourceEntityId,
          importedIdentifierId: part.importedIdentifierId,
        })
      )
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
      isWeak: nextIdentifiers.length > 0 ? true : false,
    });
  }

  function handleSave(selectedOptionKeys: string[], localAttributeIds: string[]) {
    if (modalIndex === null || selectedOptionKeys.length === 0) {
      return;
    }

    const selectedOptions = importOptions.filter((option) => selectedOptionKeys.includes(buildOptionKey(option)));
    if (selectedOptions.length === 0) {
      return;
    }

    const selectableAttributeIds = new Set(selectableLocalAttributes.map((attribute) => attribute.id));
    const normalizedLocalAttributeIds = localAttributeIds.filter((attributeId) => selectableAttributeIds.has(attributeId));
    const nextIdentifiers = [...externalIdentifiers];
    const previousIdentifier = modalIndex < externalIdentifiers.length ? externalIdentifiers[modalIndex] : undefined;
    
    const importedParts = selectedOptions.map((option) => ({
      relationshipId: option.relationshipId,
      sourceEntityId: option.sourceEntityId,
      importedIdentifierId: option.importedIdentifierId,
    }));

    const nextIdentifier: ExternalIdentifier = {
      id: previousIdentifier?.id ?? createExternalIdentifierId(),
      importedParts,
      localAttributeIds: normalizedLocalAttributeIds,
    };

    if (modalIndex >= externalIdentifiers.length) {
      if (externalIdentifiers.length > 0) {
        setModalIndex(null);
        return;
      }
      nextIdentifiers.push(nextIdentifier);
    } else {
      nextIdentifiers[modalIndex] = nextIdentifier;
    }

    setModalIndex(null);
    applyUpdate(nextIdentifiers);
  }
      }
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
          // Support both new format (importedParts) and legacy format (single relationshipId)
          const importedParts = identifier.importedParts || (identifier.relationshipId ? [{
            relationshipId: identifier.relationshipId,
            sourceEntityId: identifier.sourceEntityId,
            importedIdentifierId: identifier.importedIdentifierId,
          }] : []);
          
          const importedLabels = importedParts.map((part) => {
            const sourceEntity = diagram.nodes.find((node) => node.id === part.sourceEntityId && node.type === "entity");
            if (sourceEntity?.type !== "entity") {
              return null;
            }
            const importedIdentifier = sourceEntity.internalIdentifiers?.find((i) => i.id === part.importedIdentifierId);
            if (!importedIdentifier) {
              return null;
            }
            const sourceAttributes = Array.from(
              (new Map(getEntityDirectAttributes(diagram, sourceEntity.id).map((a) => [a.id, a]))).values(),
            );
            const attrLabels = importedIdentifier.attributeIds
              .map((aId) => sourceAttributes.find((a) => a.id === aId)?.label)
              .filter(Boolean)
              .join(", ");
            return `${sourceEntity.label}: ${attrLabels || part.importedIdentifierId}`;
          }).filter(Boolean);
          
          const localLabel = identifier.localAttributeIds
            .map((attributeId) => directAttributes.find((attribute) => attribute.id === attributeId)?.label ?? attributeId)
            .join(", ");
          
          const relationLabels = importedParts.map((part) => {
            const rel = diagram.nodes.find((node) => node.id === part.relationshipId && node.type === "relationship");
            return rel?.label || part.relationshipId;
          }).join(", ");
          
          const kind = getExternalIdentifierKind(identifier);
          const kindLabel = kind === "imported_only" ? "Importato" : "Importato + locale";

          return (
            <div key={identifier.id} className="identifier-row identifier-row-external">
              <div className="identifier-main">
                <span className="identifier-attrs">
                  {importedLabels.length > 0 ? importedLabels.join(" + ") : "Nessun importato"}
                  {localLabel ? ` + ${localLabel}` : ""}
                </span>
                <span className="identifier-meta">via {relationLabels}</span>
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
          {externalIdentifiers.length > 0
            ? "Questa entita ha gia un identificatore esterno o misto."
            : "Servono una relazione identificante valida e almeno un identificatore interno disponibile sulla sorgente."}
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
