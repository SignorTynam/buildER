import { useEffect, useMemo, useRef, useState } from "react";
import { DiagramCanvas } from "../canvas/DiagramCanvas";
import type { DiagramDocument, SelectionState, Viewport } from "../types/diagram";
import type {
  ErTranslationChoice,
  ErTranslationItem,
  ErTranslationStep,
  ErTranslationWorkspaceDocument,
} from "../types/translation";
import {
  ER_TRANSLATION_STEPS,
  buildErTranslationOverview,
  getErTranslationChoicesForItem,
  getPreferredErTranslationStep,
} from "../utils/erTranslation";
import { validateDiagram } from "../utils/diagram";

interface TranslationWorkspaceProps {
  workspace: ErTranslationWorkspaceDocument;
  viewport: Viewport;
  selection: SelectionState;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: SelectionState) => void;
  onApplyChoice: (item: ErTranslationItem, choice: ErTranslationChoice) => void;
  onResetTranslation: () => void;
  onPreviewDiagram: (diagram: DiagramDocument) => void;
  onCommitDiagram: (diagram: DiagramDocument, previous: DiagramDocument) => void;
}

function getPreferredItem(items: ErTranslationItem[]): ErTranslationItem | null {
  return items.find((item) => item.status === "pending") ?? items[0] ?? null;
}

function getStepTotalsLabel(total: number, pending: number, blocked: boolean): string {
  if (blocked) {
    return "bloccato";
  }

  if (total === 0) {
    return "nessun elemento";
  }

  if (pending > 0) {
    return `${pending} da fissare`;
  }

  return "completato";
}

function describeSelectedElement(workspace: ErTranslationWorkspaceDocument, selection: SelectionState): string | null {
  if (selection.nodeIds.length === 1 && selection.edgeIds.length === 0) {
    return workspace.translatedDiagram.nodes.find((node) => node.id === selection.nodeIds[0])?.label ?? null;
  }

  if (selection.edgeIds.length === 1 && selection.nodeIds.length === 0) {
    return workspace.translatedDiagram.edges.find((edge) => edge.id === selection.edgeIds[0])?.label || "Collegamento";
  }

  return null;
}

export function TranslationWorkspace(props: TranslationWorkspaceProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [canvasStatus, setCanvasStatus] = useState("");
  const overview = useMemo(() => buildErTranslationOverview(props.workspace), [props.workspace]);
  const [activeStep, setActiveStep] = useState<ErTranslationStep>(() => getPreferredErTranslationStep(overview));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const stepItems = overview.itemsByStep[activeStep];
  const selectedItem = useMemo(
    () => stepItems.find((item) => item.id === selectedItemId) ?? getPreferredItem(stepItems),
    [selectedItemId, stepItems],
  );
  const selectedChoices = useMemo(
    () => (selectedItem ? getErTranslationChoicesForItem(props.workspace, selectedItem) : []),
    [props.workspace, selectedItem],
  );
  const selectedMappings = selectedItem
    ? props.workspace.translation.mappings.filter(
        (mapping) => mapping.targetType === selectedItem.targetType && mapping.targetId === selectedItem.id,
      )
    : [];
  const selectedConflicts = selectedItem
    ? props.workspace.translation.conflicts.filter(
        (conflict) => conflict.targetType === selectedItem.targetType && conflict.targetId === selectedItem.id,
      )
    : [];
  const selectedElementLabel = useMemo(
    () => describeSelectedElement(props.workspace, props.selection),
    [props.selection, props.workspace],
  );

  useEffect(() => {
    const preferredStep = getPreferredErTranslationStep(overview);
    if (!overview.itemsByStep[activeStep] || (activeStep !== "review" && overview.itemsByStep[activeStep].length === 0)) {
      setActiveStep(preferredStep);
    }
  }, [activeStep, overview]);

  useEffect(() => {
    if (!stepItems.find((item) => item.id === selectedItemId)) {
      setSelectedItemId(getPreferredItem(stepItems)?.id ?? null);
    }
  }, [selectedItemId, stepItems]);

  useEffect(() => {
    if (!selectedItem) {
      return;
    }

    props.onSelectionChange({ nodeIds: [selectedItem.id], edgeIds: [] });
  }, [props, selectedItem]);

  useEffect(() => {
    const selectedNodeId = props.selection.nodeIds[0];
    if (!selectedNodeId) {
      return;
    }

    for (const step of ER_TRANSLATION_STEPS) {
      const matched = overview.itemsByStep[step.id].find((item) => item.id === selectedNodeId);
      if (matched) {
        setActiveStep(step.id);
        setSelectedItemId(matched.id);
        return;
      }
    }
  }, [overview, props.selection]);

  const translatedIssues = useMemo(() => validateDiagram(props.workspace.translatedDiagram), [props.workspace.translatedDiagram]);
  const totalPending = ER_TRANSLATION_STEPS.filter((step) => step.id !== "review").reduce(
    (sum, step) => sum + (overview.steps.find((candidate) => candidate.id === step.id)?.pending ?? 0),
    0,
  );

  return (
    <>
      <aside className="toolbar-panel translation-step-rail" aria-label="Workflow di traduzione">
        <div className="translation-step-rail-header">
          <span>Traduzione</span>
          <strong>{overview.isComplete ? "pipeline completata" : `${totalPending} fix ancora da applicare`}</strong>
        </div>

        <div className="translation-step-list" role="list">
          {overview.steps.map((step) => (
            <button
              key={step.id}
              type="button"
              className={
                activeStep === step.id
                  ? "translation-step-button active"
                  : step.blocked
                    ? "translation-step-button attention"
                    : "translation-step-button"
              }
              onClick={() => {
                setActiveStep(step.id);
                setSelectedItemId(getPreferredItem(overview.itemsByStep[step.id])?.id ?? null);
              }}
            >
              <span className="translation-step-button-label">{step.label}</span>
              <span className="translation-step-button-meta">{getStepTotalsLabel(step.total, step.pending, step.blocked)}</span>
            </button>
          ))}
        </div>

        <button type="button" className="translation-reset-button" onClick={props.onResetTranslation}>
          Reset traduzione
        </button>
      </aside>

      <section className="workspace-main logical-main">
        <div className="translation-canvas-card canvas-panel">
          <div className="translation-stage-canvas translation-stage-canvas-single">
            <DiagramCanvas
              diagram={props.workspace.translatedDiagram}
              selection={props.selection}
              tool="select"
              mode="edit"
              viewport={props.viewport}
              issues={translatedIssues}
              statusMessage={canvasStatus}
              svgRef={svgRef}
              onViewportChange={props.onViewportChange}
              onSelectionChange={props.onSelectionChange}
              onPreviewDiagram={props.onPreviewDiagram}
              onCommitDiagram={props.onCommitDiagram}
              onCreateNode={() => ""}
              onCreateEdge={() => ({ success: false, message: "Operazione non disponibile nella vista Traduzione." })}
              onCreateExternalIdentifier={() => ({ success: false, message: "Operazione non disponibile nella vista Traduzione." })}
              onDeleteNode={() => {}}
              onDeleteEdge={() => {}}
              onDeleteSelection={() => {}}
              onDeleteExternalIdentifier={() => {}}
              onRenameNode={() => {}}
              onRenameEdge={() => {}}
              onStatusMessageChange={setCanvasStatus}
            />
          </div>
        </div>
      </section>

      <aside className="inspector-panel translation-panel" aria-label="Pannello decisioni di traduzione">
        <section className="translation-panel-section">
          <span className="translation-panel-eyebrow">Step corrente</span>
          <h2>{overview.steps.find((step) => step.id === activeStep)?.label}</h2>
          <p>{overview.steps.find((step) => step.id === activeStep)?.description}</p>
          {overview.steps.find((step) => step.id === activeStep)?.blockReason ? (
            <div className="translation-warning-item level-warning">
              {overview.steps.find((step) => step.id === activeStep)?.blockReason}
            </div>
          ) : null}
        </section>

        {selectedElementLabel ? (
          <section className="translation-panel-section">
            <div className="translation-section-head">
              <h3>Elemento selezionato</h3>
            </div>
            <p>{selectedElementLabel}</p>
          </section>
        ) : null}

        {activeStep !== "review" ? (
          <>
            <section className="translation-panel-section">
              <div className="translation-section-head">
                <h3>Oggetti da risolvere</h3>
                <span className="translation-inline-counter">{stepItems.length}</span>
              </div>

              {stepItems.length > 0 ? (
                <div className="translation-item-list" role="list">
                  {stepItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={
                        selectedItem?.id === item.id
                          ? `translation-item-card active status-${item.status}`
                          : `translation-item-card status-${item.status}`
                      }
                      onClick={() => setSelectedItemId(item.id)}
                    >
                      <span className="translation-item-title">{item.label}</span>
                      <span className="translation-item-description">{item.description}</span>
                      {item.blockedReason ? <span className="translation-choice-preview">{item.blockedReason}</span> : null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="translation-empty-hint">Nessun elemento da gestire in questo step.</div>
              )}
            </section>

            {selectedItem ? (
              <>
                <section className="translation-panel-section">
                  <div className="translation-section-head">
                    <h3>{selectedItem.label}</h3>
                  </div>
                  <p>{selectedItem.description}</p>
                </section>

                <section className="translation-panel-section">
                  <div className="translation-section-head">
                    <h3>Regole disponibili</h3>
                    <span className="translation-inline-counter">{selectedChoices.length}</span>
                  </div>

                  <div className="translation-choice-list" role="list">
                    {selectedChoices.map((choice) => (
                      <button
                        key={choice.id}
                        type="button"
                        className={choice.recommended ? "translation-choice-card recommended" : "translation-choice-card"}
                        onClick={() => props.onApplyChoice(selectedItem, choice)}
                        disabled={selectedItem.status === "blocked"}
                      >
                        <span className="translation-choice-title">{choice.label}</span>
                        <span className="translation-choice-description">{choice.description}</span>
                        {choice.previewLines && choice.previewLines.length > 0 ? (
                          <span className="translation-choice-preview">{choice.previewLines.join(" ")}</span>
                        ) : null}
                        <span className="translation-choice-summary">{choice.summary}</span>
                      </button>
                    ))}
                  </div>
                </section>

                {selectedMappings.length > 0 ? (
                  <section className="translation-panel-section">
                    <h3>Artefatti generati</h3>
                    <div className="translation-artifact-list" role="list">
                      {selectedMappings.flatMap((mapping) =>
                        mapping.artifacts.map((artifact) => (
                          <button
                            key={`${mapping.decisionId}-${artifact.kind}-${artifact.id}`}
                            type="button"
                            className="translation-artifact-chip"
                            onClick={() => props.onSelectionChange({ nodeIds: artifact.kind === "node" ? [artifact.id] : [], edgeIds: artifact.kind === "edge" ? [artifact.id] : [] })}
                          >
                            <span>{artifact.label}</span>
                            <strong>{artifact.kind}</strong>
                          </button>
                        )),
                      )}
                    </div>
                  </section>
                ) : null}

                {selectedConflicts.length > 0 ? (
                  <section className="translation-panel-section">
                    <h3>Warning aperti</h3>
                    <div className="translation-warning-list" role="list">
                      {selectedConflicts.map((conflict) => (
                        <div key={conflict.id} className={`translation-warning-item level-${conflict.level}`}>
                          {conflict.message}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <>
            <section className="translation-panel-section">
              <div className="translation-review-grid" role="list">
                {overview.steps.filter((step) => step.id !== "review").map((step) => (
                  <div key={step.id} className="translation-review-card" role="listitem">
                    <strong>{step.label}</strong>
                    <span>{step.applied} decisioni applicate</span>
                    <span>{step.pending} ancora aperti</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="translation-panel-section">
              <h3>Decisioni applicate</h3>
              {props.workspace.translation.decisions.length > 0 ? (
                <div className="translation-decision-list" role="list">
                  {props.workspace.translation.decisions.map((decision) => (
                    <div key={decision.id} className={`translation-decision-card status-${decision.status}`}>
                      <strong>{decision.summary}</strong>
                      <span>{decision.rule}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="translation-empty-hint">Nessuna decisione ancora registrata.</div>
              )}
            </section>

            <section className="translation-panel-section">
              <h3>Conflitti e warning</h3>
              {props.workspace.translation.conflicts.length > 0 ? (
                <div className="translation-warning-list" role="list">
                  {props.workspace.translation.conflicts.map((conflict) => (
                    <div key={conflict.id} className={`translation-warning-item level-${conflict.level}`}>
                      {conflict.message}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="translation-empty-hint">Nessun conflitto aperto nella traduzione corrente.</div>
              )}
            </section>
          </>
        )}
      </aside>
    </>
  );
}
