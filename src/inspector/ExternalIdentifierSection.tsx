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
  getEligibleLocalExternalIdentifierAttributes,
  getEligibleImportedIdentifierParts,
  getExternalIdentifierImportedAttributes,
  getExternalIdentifierImportedPartAttributes,
  getExternalIdentifierKind,
  type ExternalIdentifierImportPartOption,
} from "../utils/diagram";
import { CollapsiblePanel, EmptyStateCard } from "../components/panels";
import { useI18n } from "../i18n/useI18n";

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

function buildOptionKey(option: Pick<ExternalIdentifierImportPart, "relationshipId" | "sourceEntityId" | "importedIdentifierId" | "importedIdentifierKind">): string {
  return [option.relationshipId, option.sourceEntityId, option.importedIdentifierKind ?? "internal", option.importedIdentifierId].join("::");
}

function ExternalIdentifierModal({
  options,
  localAttributes,
  initialSelectionKeys = [],
  initialLocalAttributeIds = [],
  onCancel,
  onConfirm,
}: ExternalIdentifierModalProps) {
  const { t } = useI18n();
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
  const kindLabel =
    selectedLocalAttributeIds.size > 0
      ? t("inspector.externalIdentifierSection.kindImportedLocalLower")
      : t("inspector.externalIdentifierSection.kindImportedOnlyLower");

  const modalContent = (
    <div className="help-modal-backdrop" role="dialog" aria-modal="true" aria-label={t("inspector.externalIdentifierSection.aria")}>
      <div className="help-modal action-modal">
        <div className="help-modal-head">
          <h2>{t("inspector.externalIdentifierSection.modalTitle")}</h2>
          <button type="button" className="help-close" onClick={onCancel}>
            {t("inspector.externalIdentifierSection.close")}
          </button>
        </div>

        <div className="action-modal-content">
          <div className="context-card-title">{t("inspector.externalIdentifierSection.eligibleImportedParts")}</div>
          <div className="modal-attribute-list">
            {options.map((option) => {
              const optionKey = buildOptionKey(option);
              return (
                <label key={optionKey} className="field checkbox-field">
                  <span>
                    {t("inspector.externalIdentifierSection.importedPartOption", {
                      source: option.sourceEntityLabel,
                      relationship: option.relationshipLabel,
                      identifier: option.importedIdentifierLabel,
                    })}
                  </span>
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
                {t("inspector.externalIdentifierSection.noImportedParts")}
              </p>
            ) : null}
          </div>

          <div className="context-card-title">{t("inspector.externalIdentifierSection.hostLocalAttributes")}</div>
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
              <p className="action-hint">{t("inspector.externalIdentifierSection.noLocalAttributes")}</p>
            ) : null}
          </div>

          <p className="action-hint">
            {t("inspector.externalIdentifierSection.resultSummary", {
              kind: kindLabel,
              count: selectedImportedCount,
            })}
          </p>

          <div className="action-modal-actions">
            <button type="button" onClick={onCancel}>
              {t("inspector.externalIdentifierSection.cancel")}
            </button>
            <button
              type="button"
              onClick={() => onConfirm(Array.from(selectedOptionKeys), Array.from(selectedLocalAttributeIds))}
              disabled={selectedOptionKeys.size === 0}
            >
              {t("inspector.externalIdentifierSection.save")}
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
  const { locale, t } = useI18n();
  const [modalIndex, setModalIndex] = useState<number | null>(null);
  const externalIdentifiers = entity.externalIdentifiers ?? [];
  const directAttributes = useMemo(
    () =>
      getEntityDirectAttributes(diagram, entity.id).sort((left, right) =>
        left.label.localeCompare(right.label, locale, { sensitivity: "base" }),
      ),
    [diagram, entity.id, locale],
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

    const eligible = getEligibleLocalExternalIdentifierAttributes(entity, directAttributes);
    const byId = new Map(eligible.map((attribute) => [attribute.id, attribute]));

    selectedExternalIdentifier?.localAttributeIds.forEach((attributeId) => {
      const selectedAttribute = directAttributes.find((attribute) => attribute.id === attributeId);
      if (selectedAttribute) {
        byId.set(selectedAttribute.id, selectedAttribute);
      }
    });

    return Array.from(byId.values()).sort((left, right) =>
      left.label.localeCompare(right.label, locale, { sensitivity: "base" }),
    );
  }, [directAttributes, entity, externalIdentifiers, locale, modalIndex, selectedExternalIdentifier]);

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
          ...(option.importedIdentifierKind === "external" ? { importedIdentifierKind: "external" as const } : {}),
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
    <CollapsiblePanel title={t("inspector.externalIdentifierSection.title")} defaultOpen className="context-card identifier-section identifier-section-external">
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
          const kindLabel =
            kind === "imported_only"
              ? t("inspector.externalIdentifierSection.kindImportedOnly")
              : t("inspector.externalIdentifierSection.kindImportedLocal");
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
                <span className="identifier-meta">
                  {t("inspector.externalIdentifierSection.viaRelationship", { relationship: relationLabel })}
                </span>
              </div>
              <span className="identifier-type">{kindLabel}</span>
              {!readOnly ? (
                <span className="identifier-actions">
                  <button type="button" onClick={() => setModalIndex(index)}>
                    {t("inspector.externalIdentifierSection.edit")}
                  </button>
                  <button type="button" onClick={() => handleDelete(index)}>
                    {t("inspector.externalIdentifierSection.delete")}
                  </button>
                </span>
              ) : null}
            </div>
          );
        })}

        {externalIdentifiers.length === 0 ? (
          <EmptyStateCard className="action-hint">
            {t("inspector.externalIdentifierSection.empty")}
          </EmptyStateCard>
        ) : null}
      </div>

      {!readOnly ? (
        <button
          type="button"
          className="identifier-add-button"
          onClick={() => setModalIndex(externalIdentifiers.length)}
          disabled={!canAddExternalIdentifier}
        >
          {t("inspector.externalIdentifierSection.add")}
        </button>
      ) : null}

      {!readOnly && !canAddExternalIdentifier ? (
        <p className="action-hint">
          {t("inspector.externalIdentifierSection.noImportedParts")}
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
