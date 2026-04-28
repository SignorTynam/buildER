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
import { EmptyStateCard, PanelSection, PanelShell, WarningCard } from "../components/panels";

interface TranslationWorkspaceProps {
  workspace: ErTranslationWorkspaceDocument;
  viewport: Viewport;
  selection: SelectionState;
  sidePanelHidden?: boolean;
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

export function TranslationWorkspace(props: TranslationWorkspaceProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [canvasStatus, setCanvasStatus] = useState("");
  const overview = useMemo(() => buildErTranslationOverview(props.workspace), [props.workspace]);
  const [activeStep, setActiveStep] = useState<ErTranslationStep>(() => getPreferredErTranslationStep(overview));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);

  const stepItems = overview.itemsByStep[activeStep];
  const selectedItem = useMemo(
    () => stepItems.find((item) => item.id === selectedItemId) ?? getPreferredItem(stepItems),
    [selectedItemId, stepItems],
  );
  const selectedChoices = useMemo(
    () => (selectedItem ? getErTranslationChoicesForItem(props.workspace, selectedItem) : []),
    [props.workspace, selectedItem],
  );
  const selectedConflicts = selectedItem
    ? props.workspace.translation.conflicts.filter(
        (conflict) => conflict.targetType === selectedItem.targetType && conflict.targetId === selectedItem.id,
      )
    : [];

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
  const activeStepOverview = overview.steps.find((step) => step.id === activeStep);

  return (
    <>
      <PanelShell className="toolbar-panel translation-step-rail studio-side-rail" ariaLabel="Workflow di traduzione">
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

        <button type="button" className="translation-reset-button studio-button studio-button-secondary" onClick={props.onResetTranslation}>
          Reset traduzione
        </button>
      </PanelShell>

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

      {!props.sidePanelHidden ? (
      <PanelShell
        className={sidePanelCollapsed ? "inspector-panel translation-panel translation-panel-collapsed" : "inspector-panel translation-panel"}
        ariaLabel="Pannello decisioni di traduzione"
        collapsed={sidePanelCollapsed}
      >
        <div className="panel-head-row panel-head-row-compact panel-shell-head">
          <div>
            <div className="panel-heading">Review traduzione</div>
            {!sidePanelCollapsed ? <p className="panel-subheading">Warning, scelte e stato dello step corrente.</p> : null}
          </div>
          <button
            type="button"
            className="panel-toggle panel-hide-button"
            onClick={() => setSidePanelCollapsed((current) => !current)}
            aria-expanded={!sidePanelCollapsed}
            aria-label={sidePanelCollapsed ? "Mostra pannello traduzione" : "Nascondi pannello traduzione"}
            title={sidePanelCollapsed ? "Mostra" : "Nascondi"}
          >
            {sidePanelCollapsed ? "<" : "Nascondi"}
          </button>
        </div>
        {sidePanelCollapsed ? (
          <div className="panel-collapsed-card">Traduzione</div>
        ) : (
        <>
        {activeStep !== "review" || activeStepOverview?.blockReason ? (
          <PanelSection className="translation-panel-section translation-panel-summary">
            {activeStep !== "review" && activeStepOverview?.description ? <p>{activeStepOverview.description}</p> : null}
            {activeStepOverview?.blockReason ? (
              <WarningCard level="warning">{activeStepOverview.blockReason}</WarningCard>
            ) : null}
          </PanelSection>
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
                <EmptyStateCard className="translation-empty-hint">Nessun elemento da gestire in questo step.</EmptyStateCard>
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

                {selectedConflicts.length > 0 ? (
                  <section className="translation-panel-section">
                    <h3>Warning aperti</h3>
                    <div className="translation-warning-list" role="list">
                      {selectedConflicts.map((conflict) => (
                          <WarningCard key={conflict.id} level={conflict.level} className={`translation-warning-item level-${conflict.level}`}>
                            {conflict.message}
                          </WarningCard>
                        ))}
                    </div>
                  </section>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          <>
            <section
              className={
                props.workspace.translation.conflicts.length > 0
                  ? "translation-panel-section translation-review-summary tone-warning"
                  : "translation-panel-section translation-review-summary tone-success"
              }
            >
              <p>
                {props.workspace.translation.conflicts.length > 0
                  ? "Traduzione da rivedere: risolvi i warning aperti prima di procedere."
                  : "Traduzione completata. Puoi procedere allo schema logico."}
              </p>
            </section>

            <section className="translation-panel-section">
              <h3>Conflitti e warning</h3>
              {props.workspace.translation.conflicts.length > 0 ? (
                <div className="translation-warning-list" role="list">
                  {props.workspace.translation.conflicts.map((conflict) => (
                    <WarningCard key={conflict.id} level={conflict.level} className={`translation-warning-item level-${conflict.level}`}>
                      {conflict.message}
                    </WarningCard>
                  ))}
                </div>
              ) : (
                <EmptyStateCard className="translation-empty-hint">Nessun conflitto aperto nella traduzione corrente.</EmptyStateCard>
              )}
            </section>

          </>
        )}
        </>
        )}
      </PanelShell>
      ) : null}
    </>
  );
}
