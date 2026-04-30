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
import { PanelHeader, PanelSection, PanelShell, PanelStepCard, WarningCard } from "../components/panels";

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
            <PanelStepCard
              key={step.id}
              className={step.blocked ? "translation-step-button attention" : "translation-step-button"}
              active={activeStep === step.id}
              tone={step.blocked ? "warning" : step.total === 0 ? "neutral" : step.pending > 0 ? "warning" : "success"}
              onClick={() => {
                setActiveStep(step.id);
                setSelectedItemId(getPreferredItem(overview.itemsByStep[step.id])?.id ?? null);
              }}
            >
              <span className="translation-step-button-label">{step.label}</span>
            </PanelStepCard>
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
        {sidePanelCollapsed ? (
          <button
            type="button"
            className="translation-panel-reopen"
            onClick={() => setSidePanelCollapsed(false)}
            aria-label="Mostra review traduzione"
          >
            Mostra
          </button>
        ) : (
        <>
        <PanelHeader
          title="Review traduzione"
          actionLabel="Nascondi"
          onAction={() => setSidePanelCollapsed(true)}
          className="panel-shell-head"
        />

        {activeStepOverview?.blockReason ? (
          <PanelSection className="translation-panel-section translation-panel-summary">
            <WarningCard level="warning">{activeStepOverview.blockReason}</WarningCard>
          </PanelSection>
        ) : null}

        {activeStep !== "review" ? (
          <>
            {stepItems.length > 0 ? (
            <section className="translation-panel-section">
              <div className="translation-section-head">
                <h3>Oggetti da risolvere</h3>
                <span className="translation-inline-counter">{stepItems.length}</span>
              </div>

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
            </section>
            ) : null}

            {selectedItem ? (
              <>
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
          props.workspace.translation.conflicts.length > 0 ? (
            <section className="translation-panel-section">
              <h3>Conflitti e warning</h3>
              <div className="translation-warning-list" role="list">
                {props.workspace.translation.conflicts.map((conflict) => (
                  <WarningCard key={conflict.id} level={conflict.level} className={`translation-warning-item level-${conflict.level}`}>
                    {conflict.message}
                  </WarningCard>
                ))}
              </div>
            </section>
          ) : (
            <section className="translation-panel-section translation-empty-panel">
              <p>Nessun elemento da mostrare.</p>
            </section>
          )
        )}
        </>
        )}
      </PanelShell>
      ) : null}
    </>
  );
}
