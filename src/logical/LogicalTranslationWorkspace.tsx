import { useEffect, useMemo, useRef, useState } from "react";
import type { DiagramDocument, Viewport } from "../types/diagram";
import type {
  LogicalColumn,
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
import {
  formatSqlType,
  isColumnEffectivelyUnique,
  type LogicalColumnSqlPatch,
} from "../utils/logicalSqlMetadata";
import { generateLogicalSql } from "../utils/logicalSql";
import { LogicalTransformationCanvas } from "./LogicalTransformationCanvas";
import { PanelHeader, PanelSection, PanelShell, PanelTabs, PanelStepCard, WarningCard } from "../components/panels";

interface LogicalTranslationWorkspaceProps {
  sourceDiagram: DiagramDocument;
  workspace: LogicalWorkspaceDocument;
  viewport: Viewport;
  selection: LogicalSelection;
  sidePanelHidden?: boolean;
  typeMode: boolean;
  panelMode: "review" | "sql";
  fitRequestToken: number;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: LogicalSelection) => void;
  onTypeModeChange: (nextValue: boolean) => void;
  onPanelModeChange: (nextValue: "review" | "sql") => void;
  onApplyChoice: (item: LogicalTranslationItem, choice: LogicalTranslationChoice) => void;
  onResetTranslation: () => void;
  onPreviewModel: (model: LogicalWorkspaceDocument["model"]) => void;
  onCommitModel: (nextModel: LogicalWorkspaceDocument["model"], previousModel: LogicalWorkspaceDocument["model"]) => void;
  onRenameTable: (tableId: string, nextName: string) => void;
  onRenameColumn: (tableId: string, columnId: string, nextName: string) => void;
  onUpdateColumnSql: (tableId: string, columnId: string, patch: LogicalColumnSqlPatch) => void;
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

function findSelectedLogicalColumn(
  workspace: LogicalWorkspaceDocument,
  selection: LogicalSelection,
): { tableId: string; tableName: string; column: LogicalColumn } | null {
  if (!selection.columnId) {
    return null;
  }

  for (const table of workspace.model.tables) {
    const column = table.columns.find((candidate) => candidate.id === selection.columnId);
    if (column) {
      return {
        tableId: table.id,
        tableName: table.name,
        column,
      };
    }
  }

  return null;
}

function downloadSqlPreview(sql: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const blob = new Blob([sql], { type: "text/sql;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "logical-model.sql";
  anchor.click();
  window.URL.revokeObjectURL(url);
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
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  const selectedColumnContext = useMemo(
    () => findSelectedLogicalColumn(props.workspace, props.selection),
    [props.workspace, props.selection],
  );
  const sqlPreview = useMemo(() => generateLogicalSql(props.workspace.model), [props.workspace.model]);
  const [sqlCopyStatus, setSqlCopyStatus] = useState<"idle" | "copied" | "error">("idle");
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
  const selectedConflicts = selectedItem
    ? props.workspace.translation.conflicts.filter(
        (conflict) => conflict.targetType === selectedItem.targetType && conflict.targetId === selectedItem.id,
      )
    : [];

  const activeTargetKeys = useMemo(() => stepItems.map((item) => buildTargetKey(item)), [stepItems]);
  const focusedTargetKey = selectedItem ? buildTargetKey(selectedItem) : null;

  const showSqlPanel = props.panelMode === "sql";
  const showReviewPanel = !showSqlPanel;

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

  async function copySqlPreview(): Promise<void> {
    if (typeof navigator === "undefined") {
      setSqlCopyStatus("error");
      return;
    }

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(sqlPreview);
      } else {
        throw new Error("Clipboard API unavailable");
      }

      setSqlCopyStatus("copied");
      window.setTimeout(() => setSqlCopyStatus("idle"), 1400);
    } catch {
      setSqlCopyStatus("error");
      window.setTimeout(() => setSqlCopyStatus("idle"), 1800);
    }
  }

  return (
    <>
      <PanelShell className="toolbar-panel translation-step-rail studio-side-rail" ariaLabel="Workflow logico manuale">
        <div className="translation-step-list">
          {LOGICAL_TRANSLATION_STEPS.map((step) => {
            const totals = completion[step.id] ?? { total: 0, pending: 0, applied: 0, invalid: 0 };
            const hasWarnings = totals.invalid > 0;
            return (
              <PanelStepCard
                key={step.id}
                className={hasWarnings ? "translation-step-button attention" : "translation-step-button"}
                active={activeStep === step.id}
                tone={hasWarnings ? "warning" : totals.total === 0 ? "neutral" : totals.pending > 0 ? "warning" : "success"}
                onClick={() => {
                  setActiveStep(step.id);
                  setSelectedItemId(getPreferredItem(overview.itemsByStep[step.id] ?? [])?.id ?? null);
              }}
            >
              <span className="translation-step-button-label">{step.label}</span>
            </PanelStepCard>
            );
          })}
        </div>

        <button type="button" className="translation-reset-button studio-button studio-button-secondary" onClick={props.onResetTranslation}>
          Reset trasformazione logica
        </button>
      </PanelShell>

      <section className="workspace-main logical-main">
        <div className="translation-canvas-card canvas-panel">
          <div className="translation-stage-canvas translation-stage-canvas-single">
            <LogicalTransformationCanvas
              workspace={props.workspace}
              selection={props.selection}
              viewport={props.viewport}
              typeMode={props.typeMode}
              fitRequestToken={props.fitRequestToken}
              activeTargetKeys={activeTargetKeys}
              focusedTargetKey={focusedTargetKey}
              onViewportChange={props.onViewportChange}
              onSelectionChange={props.onSelectionChange}
              onPreviewModel={props.onPreviewModel}
              onCommitModel={props.onCommitModel}
              onRenameTable={props.onRenameTable}
              onRenameColumn={props.onRenameColumn}
              onUpdateColumnSql={props.onUpdateColumnSql}
            />
          </div>
        </div>
      </section>

      {!props.sidePanelHidden ? (
      <PanelShell
        className={sidePanelCollapsed ? "inspector-panel translation-panel translation-panel-collapsed" : "inspector-panel translation-panel"}
        ariaLabel={showSqlPanel ? "Pannello SQL del modello logico" : "Inspector modello logico"}
        collapsed={sidePanelCollapsed}
      >
        {sidePanelCollapsed ? (
          <button
            type="button"
            className="translation-panel-reopen"
            onClick={() => setSidePanelCollapsed(false)}
            aria-label="Mostra review schema"
          >
            Mostra
          </button>
        ) : (
        <>
        <PanelHeader
          title={showSqlPanel ? "SQL" : "Review schema"}
          actionLabel="Nascondi"
          onAction={() => setSidePanelCollapsed(true)}
          className="panel-shell-head"
        />

        <PanelSection className="translation-panel-section translation-panel-tabs-section">
          <PanelTabs
            activeTab={props.panelMode}
            tabs={[
              { id: "review", label: "Review" },
              { id: "sql", label: "SQL" },
            ]}
            className="translation-panel-tabs"
            ariaLabel="Sezioni del pannello logico"
            onTabChange={props.onPanelModeChange}
          />
        </PanelSection>

        {showReviewPanel ? (
          <>
        <PanelSection className="translation-panel-section logical-type-mode-section">
          <div className="logical-type-mode-row">
            <div className="logical-type-mode-copy">
              <strong>Type Mode</strong>
              {selectedColumnContext ? (
                <span>{selectedColumnContext.tableName}.{selectedColumnContext.column.name}</span>
              ) : null}
            </div>
            <button
              type="button"
              className={props.typeMode ? "logical-type-toggle active" : "logical-type-toggle"}
              onClick={() => props.onTypeModeChange(!props.typeMode)}
              aria-pressed={props.typeMode}
            >
              <span className="logical-type-toggle-dot" aria-hidden="true" />
              {props.typeMode ? "On" : "Off"}
            </button>
          </div>

          {props.typeMode && selectedColumnContext ? (
            <div className="translation-sql-column-status">
              <strong>
                {selectedColumnContext.tableName}.{selectedColumnContext.column.name}
              </strong>
              <span>{formatSqlType(selectedColumnContext.column)}</span>
              <span>
                {selectedColumnContext.column.isPrimaryKey
                  ? "PK"
                  : selectedColumnContext.column.isForeignKey
                    ? "FK"
                    : "COL"}
                {isColumnEffectivelyUnique(selectedColumnContext.column) ? " · UQ" : ""}
                {selectedColumnContext.column.isNullable ? " · NULL" : " · NOT NULL"}
              </span>
            </div>
          ) : null}
        </PanelSection>

        {activeStep !== "review" ? (
          <>
            {stepItems.length > 0 ? (
            <PanelSection className="translation-panel-section">
              <div className="translation-section-head">
                <h3>Oggetti da risolvere</h3>
                <span className="translation-inline-counter">{stepItems.length}</span>
              </div>

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
                  </button>
                ))}
              </div>
            </PanelSection>
            ) : null}

            {selectedItem ? (
              <>
                <PanelSection className="translation-panel-section">
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
                      </button>
                    ))}
                  </div>
                </PanelSection>

                {selectedConflicts.length > 0 ? (
                  <PanelSection className="translation-panel-section">
                    <h3>Warning aperti</h3>
                    <div className="translation-warning-list">
                      {selectedConflicts.map((conflict) => (
                          <WarningCard key={conflict.id} level={conflict.level} className={`translation-warning-item level-${conflict.level}`}>
                            {conflict.message}
                          </WarningCard>
                        ))}
                    </div>
                  </PanelSection>
                ) : null}
              </>
            ) : null}
          </>
        ) : (
          props.workspace.translation.conflicts.length > 0 ? (
            <section className="translation-panel-section">
              <h3>Conflitti e warning</h3>
              <div className="translation-warning-list">
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
        ) : (
          <>
            <PanelSection className="translation-panel-section translation-sql-preview-section">
              <div className="translation-sql-actions">
                <button type="button" onClick={() => void copySqlPreview()}>
                  {sqlCopyStatus === "copied" ? "Copiato" : sqlCopyStatus === "error" ? "Errore copia" : "Copia SQL"}
                </button>
                <button type="button" onClick={() => downloadSqlPreview(sqlPreview)}>
                  Download .sql
                </button>
              </div>
              <textarea
                className="translation-sql-preview"
                readOnly
                value={sqlPreview}
                spellCheck={false}
                aria-label="Anteprima SQL del modello logico"
              />
            </PanelSection>
          </>
        )}
        </>
        )}
      </PanelShell>
      ) : null}
    </>
  );
}
