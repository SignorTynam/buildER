import { useEffect, useRef } from "react";
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

const PRESET_DESCRIPTIONS: Record<string, string> = {
  "(0,1)": "opzionale, al massimo una",
  "(1,1)": "obbligatoria, una sola",
  "(0,N)": "opzionale, molte",
  "(1,N)": "obbligatoria, molte",
};

export function getCardinalityModalPrimaryLabel(state: Pick<CardinalityDialogState, "createdEdgeWasTemporary" | "mode">): string {
  return state.mode === "create-connector" || state.createdEdgeWasTemporary === true
    ? "Crea collegamento"
    : "Salva cardinalita";
}

function getSubtitle(state: CardinalityDialogState, sourceLabel?: string, targetLabel?: string, contextLabel?: string): string {
  if (contextLabel) {
    return contextLabel;
  }

  if (state.target.kind === "attribute") {
    return sourceLabel
      ? `Imposta la cardinalita dell'attributo ${sourceLabel}`
      : "Imposta la cardinalita dell'attributo selezionato";
  }

  if (state.createdEdgeWasTemporary) {
    return sourceLabel && targetLabel
      ? `Completa il collegamento tra ${sourceLabel} e ${targetLabel}`
      : "Completa il nuovo collegamento";
  }

  return sourceLabel && targetLabel
    ? `Modifica la partecipazione di ${sourceLabel} in ${targetLabel}`
    : "Modifica la cardinalita del collegamento";
}

export function CardinalityModal(props: CardinalityModalProps) {
  const { state } = props;
  const primaryButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    primaryButtonRef.current?.focus();
  }, []);

  const subtitle = getSubtitle(state, props.sourceLabel, props.targetLabel, props.contextLabel);
  const isCustom = state.presetValue === "custom";
  const primaryLabel = getCardinalityModalPrimaryLabel(state);

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
                {state.createdEdgeWasTemporary ? "Nuovo collegamento" : "Modifica"}
              </span>
            </div>
            <h2 id="cardinality-dialog-title">Configura cardinalita</h2>
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
              <span>{props.sourceLabel ?? "Entita"}</span>
              <i />
              <strong>cardinalita</strong>
              <i />
              <span>{props.targetLabel ?? "Relazione"}</span>
            </div>
          ) : null}

          <div className="designer-cardinality-grid" role="radiogroup" aria-label="Preset cardinalita">
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
                <small>{PRESET_DESCRIPTIONS[preset]}</small>
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
              Personalizzata
            </span>
            <input
              value={state.customValue}
              placeholder="0,N"
              onFocus={() => props.onPresetChange("custom")}
              onChange={(event) => props.onCustomValueChange(event.target.value)}
              aria-label="Cardinalita personalizzata"
            />
            <small>Accetta forme come 0,N, (1,N) o 1..4.</small>
          </label>

          {state.error ? <p className="designer-cardinality-error">{state.error}</p> : null}

          <footer className="designer-cardinality-actions">
            <button type="button" className="designer-cardinality-button secondary" onClick={props.onCancel}>
              Annulla
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
