import { useEffect, useRef } from "react";
import { translate, type MessageKey, type TranslationParams } from "../i18n";
import { useI18n } from "../i18n/useI18n";
import type { DiagramDocument } from "../types/diagram";
import { CONNECTOR_CARDINALITY_PRESETS } from "../utils/cardinality";

export type CardinalityDialogTarget =
  | { kind: "attribute"; attributeId: string }
  | { kind: "connector"; edgeId: string };

export interface CardinalityDialogState {
  mode: "edit" | "create-connector";
  target: CardinalityDialogTarget;
  initialValue: string;
  presetValue: string;
  customValue: string;
  error: string;
  createdEdgeWasTemporary?: boolean;
  previousDiagramBeforeTemporary?: DiagramDocument;
}

interface CardinalityModalProps {
  state: CardinalityDialogState;
  sourceLabel?: string;
  targetLabel?: string;
  contextLabel?: string;
  onPresetChange: (value: string) => void;
  onCustomValueChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export interface CardinalityModalKeyboardEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  repeat?: boolean;
  defaultPrevented?: boolean;
}

export function shouldConfirmCardinalityModalFromKeyboard(
  event: CardinalityModalKeyboardEventLike,
): boolean {
  return (
    event.key === "Enter" &&
    event.defaultPrevented !== true &&
    event.isComposing !== true &&
    event.repeat !== true &&
    event.ctrlKey !== true &&
    event.metaKey !== true &&
    event.altKey !== true
  );
}

export function shouldCancelCardinalityModalFromKeyboard(
  event: CardinalityModalKeyboardEventLike,
): boolean {
  return (
    event.key === "Escape" &&
    event.defaultPrevented !== true &&
    event.isComposing !== true
  );
}

const PRESET_DESCRIPTION_KEYS: Record<string, MessageKey> = {
  "(0,1)": "cardinalityModal.presets.optionalMaxOne",
  "(1,1)": "cardinalityModal.presets.requiredOne",
  "(0,N)": "cardinalityModal.presets.optionalMany",
  "(1,N)": "cardinalityModal.presets.requiredMany",
};

const translateDefaultItalian = (key: MessageKey) => translate(key, undefined, "it");

export function getCardinalityModalPrimaryLabel(
  state: Pick<CardinalityDialogState, "createdEdgeWasTemporary" | "mode">,
  t: (key: MessageKey) => string = translateDefaultItalian,
): string {
  return state.mode === "create-connector" || state.createdEdgeWasTemporary === true
    ? t("cardinalityModal.primary.createConnector")
    : t("cardinalityModal.primary.save");
}

function getSubtitle(
  state: CardinalityDialogState,
  t: (key: MessageKey, params?: TranslationParams) => string,
  sourceLabel?: string,
  targetLabel?: string,
  contextLabel?: string,
): string {
  if (contextLabel) {
    return contextLabel;
  }

  if (state.target.kind === "attribute") {
    return sourceLabel
      ? t("cardinalityModal.subtitle.attributeWithLabel", { label: sourceLabel })
      : t("cardinalityModal.subtitle.attributeSelected");
  }

  if (state.createdEdgeWasTemporary) {
    return sourceLabel && targetLabel
      ? t("cardinalityModal.subtitle.completeConnectorWithLabels", { source: sourceLabel, target: targetLabel })
      : t("cardinalityModal.subtitle.completeConnector");
  }

  return sourceLabel && targetLabel
    ? t("cardinalityModal.subtitle.editConnectorWithLabels", { source: sourceLabel, target: targetLabel })
    : t("cardinalityModal.subtitle.editConnector");
}

export function CardinalityModal(props: CardinalityModalProps) {
  const { t } = useI18n();
  const { state } = props;
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      primaryButtonRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    function handleDocumentKeyDown(event: KeyboardEvent) {
      if (shouldConfirmCardinalityModalFromKeyboard(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        props.onSubmit();
        return;
      }

      if (shouldCancelCardinalityModalFromKeyboard(event)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        props.onCancel();
      }
    }

    document.addEventListener("keydown", handleDocumentKeyDown, true);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown, true);
  }, [props.onSubmit, props.onCancel]);

  const subtitle = getSubtitle(state, t, props.sourceLabel, props.targetLabel, props.contextLabel);
  const isCustom = state.presetValue === "custom";
  const primaryLabel = getCardinalityModalPrimaryLabel(state, t);

  return (
    <div className="designer-modal-backdrop" role="presentation" onClick={props.onCancel}>
      <section
        className="designer-cardinality-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cardinality-dialog-title"
        aria-describedby="cardinality-dialog-subtitle"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="designer-cardinality-modal__header">
          <div>
            <div className="designer-cardinality-modal__eyebrow">
              <span className="designer-cardinality-modal__badge">
                {state.createdEdgeWasTemporary ? t("cardinalityModal.badge.newConnector") : t("cardinalityModal.badge.edit")}
              </span>
            </div>
            <h2 id="cardinality-dialog-title">{t("cardinalityModal.title")}</h2>
            <p id="cardinality-dialog-subtitle" className="designer-cardinality-modal__subtitle">
              {subtitle}
            </p>
          </div>
        </header>

        <form
          className="designer-cardinality-modal__body"
          onSubmit={(event) => {
            event.preventDefault();
            props.onSubmit();
          }}
        >
          {state.target.kind === "connector" ? (
            <div className="designer-cardinality-visual" aria-hidden="true">
              <span>{props.sourceLabel ?? t("cardinalityModal.visual.entityFallback")}</span>
              <i />
              <strong>{t("cardinalityModal.visual.cardinality")}</strong>
              <i />
              <span>{props.targetLabel ?? t("cardinalityModal.visual.relationshipFallback")}</span>
            </div>
          ) : null}

          <div className="designer-cardinality-grid" role="radiogroup" aria-label={t("cardinalityModal.presets.aria")}>
            {CONNECTOR_CARDINALITY_PRESETS.map((preset) => (
              <label
                key={preset}
                className={`designer-cardinality-option${state.presetValue === preset ? " active" : ""}`}
              >
                <input
                  type="radio"
                  name="cardinality"
                  checked={state.presetValue === preset}
                  onChange={() => props.onPresetChange(preset)}
                />
                <span>{preset}</span>
                <small>{t(PRESET_DESCRIPTION_KEYS[preset])}</small>
              </label>
            ))}
          </div>

          <label className={`designer-cardinality-custom${isCustom ? " active" : ""}`}>
            <span className="designer-cardinality-custom__radio">
              <input
                type="radio"
                name="cardinality"
                checked={isCustom}
                onChange={() => props.onPresetChange("custom")}
              />
              {t("cardinalityModal.custom.label")}
            </span>
            <input
              value={state.customValue}
              placeholder="0,N"
              onFocus={() => props.onPresetChange("custom")}
              onChange={(event) => props.onCustomValueChange(event.target.value)}
              aria-label={t("cardinalityModal.custom.aria")}
            />
            <small>{t("cardinalityModal.custom.help")}</small>
          </label>

          {state.error ? <p className="designer-cardinality-error">{state.error}</p> : null}

          <footer className="designer-cardinality-actions">
            <button type="button" className="designer-cardinality-button secondary" onClick={props.onCancel}>
              {t("cardinalityModal.cancel")}
            </button>
            <button ref={primaryButtonRef} type="submit" className="designer-cardinality-button primary">
              {primaryLabel}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
