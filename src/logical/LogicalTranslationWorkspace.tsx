import { useEffect, useMemo, useRef, useState } from "react";
import type { DiagramDocument, Viewport } from "../types/diagram";
import type {
  LogicalSelection,
  LogicalTranslationArtifactRef,
  LogicalTranslationChoice,
  LogicalTranslationItem,
  LogicalTranslationStep,
  LogicalWorkspaceDocument,
} from "../types/logical";
import {
  LOGICAL_TRANSLATION_STEPS,
  buildLogicalTranslationOverview,
  getLogicalTranslationChoicesForItem,
  getLogicalTranslationStepCompletion,
} from "../utils/logicalTranslation";
import { LogicalTransformationCanvas } from "./LogicalTransformationCanvas";

interface LogicalTranslationWorkspaceProps {
  sourceDiagram: DiagramDocument;
  workspace: LogicalWorkspaceDocument;
  viewport: Viewport;
  selection: LogicalSelection;
  fitRequestToken: number;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: LogicalSelection) => void;
  onApplyChoice: (item: LogicalTranslationItem, choice: LogicalTranslationChoice) => void;
  onResetTranslation: () => void;
  onPreviewModel: (model: LogicalWorkspaceDocument["model"]) => void;
  onCommitModel: (nextModel: LogicalWorkspaceDocument["model"], previousModel: LogicalWorkspaceDocument["model"]) => void;
  onRenameTable: (tableId: string, nextName: string) => void;
  onRenameColumn: (tableId: string, columnId: string, nextName: string) => void;
}

const ALL_LOGICAL_STEPS: LogicalTranslationStep[] = [
  "entities",
  "weak-entities",
  "relationships",
  "multivalued-attributes",
  "generalizations",
  "review",
];

function getPreferredItem(items: LogicalTranslationItem[]): LogicalTranslationItem | null {
  return items.find((item) => item.status === "pending") ?? items.find((item) => item.status === "invalid") ?? items[0] ?? null;
}

function getStepTotalsLabel(totals: { total: number; pending: number; applied: number; invalid: number }): string {
  if (totals.total === 0) {
    return "nessun elemento";
  }

  if (totals.invalid > 0) {
    return `${totals.invalid} da rivedere`;
  }

  if (totals.pending > 0) {
    return `${totals.pending} da fissare`;
  }

  return "completato";
}

function buildTargetKey(item: Pick<LogicalTranslationItem, "targetType" | "id">): string {
  return `${item.targetType}:${item.id}`;
}

function parseTargetKey(key: string): { targetType: LogicalTranslationItem["targetType"]; targetId: string } | null {
  const separatorIndex = key.indexOf(":");
  if (separatorIndex < 1 || separatorIndex === key.length - 1) {
    return null;
  }

  const targetType = key.slice(0, separatorIndex);
  const targetId = key.slice(separatorIndex + 1);
  if (
    targetType !== "entity" &&
    targetType !== "weak-entity" &&
    targetType !== "relationship" &&
    targetType !== "attribute" &&
    targetType !== "generalization"
  ) {
    return null;
  }

  return {
    targetType,
    targetId,
  };
}

function findItemByTargetKey(overview: ReturnType<typeof buildLogicalTranslationOverview>, targetKey: string): LogicalTranslationItem | null {
  const parsed = parseTargetKey(targetKey);
  if (!parsed) {
    return null;
  }

  for (const step of ALL_LOGICAL_STEPS) {
    const match = overview.itemsByStep[step].find(
      (item) => item.targetType === parsed.targetType && item.id === parsed.targetId,
    );
    if (match) {
      return match;
    }
  }

  return null;
}

function getPreferredStep(
  overview: ReturnType<typeof buildLogicalTranslationOverview>,
  completion: ReturnType<typeof getLogicalTranslationStepCompletion>,
): LogicalTranslationStep {
  const openStep = LOGICAL_TRANSLATION_STEPS.find((step) => {
    if (step.id === "review") {
      return false;
    }

    const totals = completion[step.id];
    return totals != null && (totals.pending > 0 || totals.invalid > 0);
  });

  if (openStep) {
    return openStep.id;
  }

  return "review";
}

function describeSelectedElement(workspace: LogicalWorkspaceDocument, selection: LogicalSelection): string | null {
  if (selection.nodeId) {
    return workspace.transformation.nodes.find((node) => node.id === selection.nodeId)?.label ?? null;
  }

  if (selection.edgeId) {
    return workspace.transformation.edges.find((edge) => edge.id === selection.edgeId)?.label || "Collegamento";
  }

  return null;
}

function selectArtifact(
  artifact: LogicalTranslationArtifactRef,
  workspace: LogicalWorkspaceDocument,
  onSelectionChange: LogicalTranslationWorkspaceProps["onSelectionChange"],
): void {
  if (artifact.kind === "table") {
    onSelectionChange({ nodeId: artifact.id, columnId: null, edgeId: null });
    return;
  }

  if (artifact.kind === "column") {
    const table = workspace.model.tables.find((candidate) =>
      candidate.columns.some((column) => column.id === artifact.id),
    );
    onSelectionChange({
      nodeId: table?.id ?? null,
      columnId: artifact.id,
      edgeId: null,
    });
    return;
  }

  if (artifact.kind === "edge") {
    const edge = workspace.model.edges.find((candidate) => candidate.id === artifact.id);
    onSelectionChange({
      nodeId: edge?.fromTableId ?? null,
      columnId: null,
      edgeId: artifact.id,
    });
    return;
  }

  if (artifact.kind === "foreignKey") {
    const edge = workspace.model.edges.find((candidate) => candidate.foreignKeyId === artifact.id);
    onSelectionChange({
      nodeId: edge?.fromTableId ?? null,
      columnId: null,
      edgeId: edge?.id ?? null,
    });
    return;
  }

  const constraint = workspace.model.uniqueConstraints.find((candidate) => candidate.id === artifact.id);
  onSelectionChange({
    nodeId: constraint?.tableId ?? null,
    columnId: null,
    edgeId: null,
  });
}

export function LogicalTranslationWorkspace(props: LogicalTranslationWorkspaceProps) {
  const overview = useMemo(
    () => buildLogicalTranslationOverview(props.sourceDiagram, props.workspace),
    [props.sourceDiagram, props.workspace],
  );
  const completion = useMemo(() => getLogicalTranslationStepCompletion(overview), [overview]);
  const [activeStep, setActiveStep] = useState<LogicalTranslationStep>(() => getPreferredStep(overview, completion));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const selectedElementLabel = useMemo(
    () => describeSelectedElement(props.workspace, props.selection),
    [props.workspace, props.selection],
  );
  const selectedTargetKeyRef = useRef<string | null>(null);

  const stepItems = overview.itemsByStep[activeStep] ?? [];
  const selectedItem = useMemo(
    () => stepItems.find((item) => item.id === selectedItemId) ?? getPreferredItem(stepItems),
    [selectedItemId, stepItems],
  );
  const selectedChoices = useMemo(
    () => (selectedItem ? getLogicalTranslationChoicesForItem(overview, selectedItem) : []),
    [overview, selectedItem],
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

  const activeTargetKeys = useMemo(() => stepItems.map((item) => buildTargetKey(item)), [stepItems]);
  const focusedTargetKey = selectedItem ? buildTargetKey(selectedItem) : null;

  const pendingCount = LOGICAL_TRANSLATION_STEPS.filter((step) => step.id !== "review").reduce(
    (sum, step) => sum + (completion[step.id]?.pending ?? 0),
    0,
  );

  useEffect(() => {
    const preferredStep = getPreferredStep(overview, completion);
    const hasActiveStep = LOGICAL_TRANSLATION_STEPS.some((step) => step.id === activeStep);
    if (!hasActiveStep || (activeStep !== "review" && (overview.itemsByStep[activeStep] ?? []).length === 0)) {
      setActiveStep(preferredStep);
    }
  }, [activeStep, completion, overview]);

  useEffect(() => {
    if (!stepItems.find((item) => item.id === selectedItemId)) {
      setSelectedItemId(getPreferredItem(stepItems)?.id ?? null);
    }
  }, [selectedItemId, stepItems]);

  useEffect(() => {
    const targetKey = selectedItem ? buildTargetKey(selectedItem) : null;
    if (!targetKey || !selectedItem || selectedTargetKeyRef.current === targetKey) {
      return;
    }

    selectedTargetKeyRef.current = targetKey;

    const transformedNode = props.workspace.transformation.nodes.find((node) => node.id === selectedItem.id);
    if (!transformedNode) {
      return;
    }

    props.onSelectionChange({ nodeId: transformedNode.id, columnId: null, edgeId: null });
  }, [props, selectedItem]);

  useEffect(() => {
    const selectedNode = props.selection.nodeId
      ? props.workspace.transformation.nodes.find((node) => node.id === props.selection.nodeId)
      : undefined;
    const selectedEdge = props.selection.edgeId
      ? props.workspace.transformation.edges.find((edge) => edge.id === props.selection.edgeId)
      : undefined;
    const relatedKeys = selectedNode?.relatedTargetKeys ?? selectedEdge?.relatedTargetKeys ?? [];

    const matchedItem = relatedKeys
      .map((key) => findItemByTargetKey(overview, key))
      .find((item): item is LogicalTranslationItem => item !== null);
    if (!matchedItem) {
      return;
    }

    setActiveStep(matchedItem.step);
    setSelectedItemId(matchedItem.id);
  }, [overview, props.selection, props.workspace.transformation.edges, props.workspace.transformation.nodes]);

  return (
    <>
      <aside className="toolbar-panel translation-step-rail" aria-label="Workflow logico manuale">
        <div className="translation-step-rail-header">
          <span>Trasformazione logica</span>
          <strong>
            {pendingCount > 0
              ? `${pendingCount} fix logici ancora da applicare`
              : props.workspace.translation.conflicts.length > 0
                ? `${props.workspace.translation.conflicts.length} warning da risolvere`
                : "workflow logico allineato"}
          </strong>
        </div>

        <div className="translation-step-list">
          {LOGICAL_TRANSLATION_STEPS.map((step) => {
            const totals = completion[step.id] ?? { total: 0, pending: 0, applied: 0, invalid: 0 };
            const hasWarnings = totals.invalid > 0;
            return (
              <button
                key={step.id}
                type="button"
                className={
                  activeStep === step.id
                    ? "translation-step-button active"
                    : hasWarnings
                      ? "translation-step-button attention"
                      : "translation-step-button"
                }
                onClick={() => {
                  setActiveStep(step.id);
                  setSelectedItemId(getPreferredItem(overview.itemsByStep[step.id] ?? [])?.id ?? null);
                }}
              >
                <span className="translation-step-button-label">{step.label}</span>
                <span className="translation-step-button-meta">{getStepTotalsLabel(totals)}</span>
              </button>
            );
          })}
        </div>

        <button type="button" className="translation-reset-button" onClick={props.onResetTranslation}>
          Reset trasformazione logica
        </button>
      </aside>

      <section className="workspace-main logical-main">
        <div className="translation-canvas-card canvas-panel">
          <header className="translation-stage-header">
            <div>
              <span className="translation-stage-eyebrow">Canvas Logico</span>
              <h2>Trasformazione ER tradotto -&gt; Logico</h2>
            </div>
            <div className="translation-stage-summary">
              <span>{props.workspace.model.tables.length} tabelle logiche materializzate</span>
              <strong>{props.workspace.translation.conflicts.length} warning attivi</strong>
            </div>
          </header>

          <div className="translation-stage-canvas translation-stage-canvas-single">
            <LogicalTransformationCanvas
              workspace={props.workspace}
              selection={props.selection}
              viewport={props.viewport}
              fitRequestToken={props.fitRequestToken}
              activeTargetKeys={activeTargetKeys}
              focusedTargetKey={focusedTargetKey}
              onViewportChange={props.onViewportChange}
              onSelectionChange={props.onSelectionChange}
              onPreviewModel={props.onPreviewModel}
              onCommitModel={props.onCommitModel}
              onRenameTable={props.onRenameTable}
              onRenameColumn={props.onRenameColumn}
            />
          </div>
        </div>
      </section>

      <aside className="inspector-panel translation-panel" aria-label="Pannello decisioni logiche">
        <section className="translation-panel-section">
          <span className="translation-panel-eyebrow">Step corrente</span>
          <h2>{LOGICAL_TRANSLATION_STEPS.find((step) => step.id === activeStep)?.label}</h2>
          <p>{LOGICAL_TRANSLATION_STEPS.find((step) => step.id === activeStep)?.description}</p>
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
                <div className="translation-item-list">
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
                      {item.currentSummary ? <span className="translation-choice-preview">{item.currentSummary}</span> : null}
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

                  <div className="translation-choice-list">
                    {selectedChoices.map((choice) => (
                      <button
                        key={choice.id}
                        type="button"
                        className={choice.recommended ? "translation-choice-card recommended" : "translation-choice-card"}
                        onClick={() => props.onApplyChoice(selectedItem, choice)}
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
                    <div className="translation-artifact-list">
                      {selectedMappings.flatMap((mapping) =>
                        mapping.artifacts.map((artifact) => (
                          <button
                            key={`${mapping.decisionId}-${artifact.kind}-${artifact.id}`}
                            type="button"
                            className="translation-artifact-chip"
                            onClick={() => selectArtifact(artifact, props.workspace, props.onSelectionChange)}
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
                    <div className="translation-warning-list">
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
                {LOGICAL_TRANSLATION_STEPS.filter((step) => step.id !== "review").map((step) => {
                  const totals = completion[step.id] ?? { total: 0, pending: 0, applied: 0, invalid: 0 };
                  return (
                    <div key={step.id} className="translation-review-card" role="listitem">
                      <strong>{step.label}</strong>
                      <span>{totals.applied} decisioni applicate</span>
                      <span>{totals.pending} ancora aperti</span>
                      {totals.invalid > 0 ? <span>{totals.invalid} da rivedere</span> : null}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="translation-panel-section">
              <h3>Decisioni applicate</h3>
              {props.workspace.translation.decisions.length > 0 ? (
                <div className="translation-decision-list">
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
                <div className="translation-warning-list">
                  {props.workspace.translation.conflicts.map((conflict) => (
                    <div key={conflict.id} className={`translation-warning-item level-${conflict.level}`}>
                      {conflict.message}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="translation-empty-hint">Nessun conflitto aperto nella trasformazione logica corrente.</div>
              )}
            </section>
          </>
        )}
      </aside>
    </>
  );
}
