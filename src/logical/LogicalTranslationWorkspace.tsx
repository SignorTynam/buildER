import { useMemo, useState } from "react";
import type { DiagramDocument, Viewport } from "../types/diagram";
import type {
  LogicalColumn,
  LogicalSelection,
  LogicalStage,
  LogicalTranslationChoice,
  LogicalTranslationItem,
  LogicalTranslationRuleKind,
  LogicalTranslationStep,
  LogicalWorkspaceDocument,
} from "../types/logical";
import { useI18n } from "../i18n/useI18n";
import {
  LOGICAL_TRANSLATION_STEPS,
  buildLogicalTranslationOverview,
  getLogicalTranslationChoicesForItem,
  getLogicalTranslationStepCompletion,
} from "../utils/logicalTranslation";
import {
  SQL_TYPE_PICKER_OPTIONS,
  isColumnEffectivelyUnique,
  isColumnTypeLockedByReference,
  type LogicalColumnSqlPatch,
} from "../utils/logicalSqlMetadata";
import { generateLogicalSql } from "../utils/logicalSql";
import { LogicalTransformationCanvas } from "./LogicalTransformationCanvas";

type LogicalBulkStep = Extract<LogicalTranslationStep, "entities" | "weak-entities" | "relationships" | "multivalued-attributes">;
type ColumnMoveDirection = "up" | "down" | "top" | "bottom";

interface LogicalTranslationWorkspaceProps {
  sourceDiagram: DiagramDocument;
  workspace: LogicalWorkspaceDocument;
  logicalStage: LogicalStage;
  viewport: Viewport;
  selection: LogicalSelection;
  sidePanelHidden?: boolean;
  typeMode: boolean;
  panelMode: "review" | "sql";
  fitRequestToken: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: LogicalSelection) => void;
  onTypeModeChange: (nextValue: boolean) => void;
  onPanelModeChange: (nextValue: "review" | "sql") => void;
  onApplyChoice: (item: LogicalTranslationItem, choice: LogicalTranslationChoice) => void;
  onApplyBulkFix: (step: LogicalBulkStep) => void;
  onResetTranslation: () => void;
  onDone: () => void;
  onOpenDesign: () => void;
  onExportProject: () => void;
  onSaveSql: () => void;
  onPreviewModel: (model: LogicalWorkspaceDocument["model"]) => void;
  onCommitModel: (nextModel: LogicalWorkspaceDocument["model"], previousModel: LogicalWorkspaceDocument["model"]) => void;
  onRenameTable: (tableId: string, nextName: string) => void;
  onRenameColumn: (tableId: string, columnId: string, nextName: string) => void;
  onUpdateColumnSql: (tableId: string, columnId: string, patch: LogicalColumnSqlPatch) => void;
  onMoveColumn: (tableId: string, columnId: string, direction: ColumnMoveDirection) => void;
}

const ORDERED_BULK_STEPS: LogicalBulkStep[] = ["entities", "weak-entities", "relationships", "multivalued-attributes"];

const CHOICE_PRIORITY: Record<LogicalTranslationRuleKind, number> = {
  "entity-table-internal": 10,
  "entity-table-external": 20,
  "weak-entity-table": 25,
  "relationship-foreign-key": 30,
  "relationship-table": 40,
  "multivalued-table": 50,
  "generalization-table-per-type": 60,
  "generalization-subtypes-only": 70,
  "generalization-single-table": 80,
  "entity-table-without-key": 90,
};

function buildTargetKey(item: Pick<LogicalTranslationItem, "targetType" | "id">): string {
  return `${item.targetType}:${item.id}`;
}

function isOpenTranslationItem(item: LogicalTranslationItem): boolean {
  return item.status === "pending" || item.status === "invalid";
}

function chooseLogicalChoice(choices: LogicalTranslationChoice[]): LogicalTranslationChoice | null {
  return [...choices].sort((left, right) => {
    const leftScore = (left.recommended ? 0 : 100) + (CHOICE_PRIORITY[left.rule] ?? 999);
    const rightScore = (right.recommended ? 0 : 100) + (CHOICE_PRIORITY[right.rule] ?? 999);
    return leftScore === rightScore ? left.id.localeCompare(right.id) : leftScore - rightScore;
  })[0] ?? null;
}

function findItemForSelection(
  workspace: LogicalWorkspaceDocument,
  overview: ReturnType<typeof buildLogicalTranslationOverview>,
  selection: LogicalSelection,
): LogicalTranslationItem | null {
  const selectedNode = selection.nodeId
    ? workspace.transformation.nodes.find((node) => node.id === selection.nodeId)
    : undefined;
  const selectedEdge = selection.edgeId
    ? workspace.transformation.edges.find((edge) => edge.id === selection.edgeId)
    : undefined;
  const relatedKeys = selectedNode?.relatedTargetKeys ?? selectedEdge?.relatedTargetKeys ?? [];
  const allItems = LOGICAL_TRANSLATION_STEPS.flatMap((step) => overview.itemsByStep[step.id] ?? []);
  return allItems.find((item) => relatedKeys.includes(buildTargetKey(item)) && isOpenTranslationItem(item)) ?? null;
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
      return { tableId: table.id, tableName: table.name, column };
    }
  }

  return null;
}

function findSelectedTable(workspace: LogicalWorkspaceDocument, selection: LogicalSelection) {
  if (!selection.nodeId) {
    return null;
  }
  return workspace.model.tables.find((table) => table.id === selection.nodeId) ?? null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightSql(sql: string): string {
  const escaped = escapeHtml(sql);
  return escaped.replace(
    /(--.*$|\/\*[\s\S]*?\*\/|\b(?:CREATE|TABLE|PRIMARY|KEY|FOREIGN|REFERENCES|NOT|NULL|UNIQUE|CONSTRAINT|ON|DELETE|UPDATE|NO|ACTION)\b|\b(?:INTEGER|TEXT|VARCHAR|REAL|NUMERIC|DATE|DATETIME|BLOB|JSON|BOOLEAN)\b)/gim,
    (token) => {
      if (token.startsWith("--") || token.startsWith("/*")) {
        return `<span class="sql-token-comment">${token}</span>`;
      }
      if (/^(INTEGER|TEXT|VARCHAR|REAL|NUMERIC|DATE|DATETIME|BLOB|JSON|BOOLEAN)$/i.test(token)) {
        return `<span class="sql-token-type">${token}</span>`;
      }
      if (/^(NOT|NULL|UNIQUE|CONSTRAINT|ON|DELETE|UPDATE|NO|ACTION)$/i.test(token)) {
        return `<span class="sql-token-modifier">${token}</span>`;
      }
      return `<span class="sql-token-keyword">${token}</span>`;
    },
  );
}

function downloadSql(sql: string): void {
  if (typeof window === "undefined") {
    return;
  }
  const blob = new Blob([sql], { type: "text/sql;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "logical-schema.sql";
  anchor.click();
  window.URL.revokeObjectURL(url);
}

function renameWithPrompt(label: string, currentValue: string, onRename: (nextValue: string) => void): void {
  const nextValue = window.prompt(label, currentValue)?.trim();
  if (nextValue && nextValue !== currentValue) {
    onRename(nextValue);
  }
}

function ToolbarButton(props: {
  label: string;
  icon: string;
  disabled?: boolean;
  active?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "designer-toolbar-button",
        props.active ? "active" : "",
        props.disabled ? "disabled" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={props.disabled}
      title={props.title}
      onClick={props.onClick}
    >
      <span className="designer-toolbar-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span>{props.label}</span>
    </button>
  );
}

export function LogicalTranslationWorkspace(props: LogicalTranslationWorkspaceProps) {
  const { t } = useI18n();
  const overview = useMemo(
    () => buildLogicalTranslationOverview(props.sourceDiagram, props.workspace),
    [props.sourceDiagram, props.workspace],
  );
  const completion = useMemo(() => getLogicalTranslationStepCompletion(overview), [overview]);
  const selectedColumnContext = useMemo(
    () => findSelectedLogicalColumn(props.workspace, props.selection),
    [props.workspace, props.selection],
  );
  const selectedTable = useMemo(
    () => findSelectedTable(props.workspace, props.selection),
    [props.workspace, props.selection],
  );
  const selectedTranslationItem = useMemo(
    () => findItemForSelection(props.workspace, overview, props.selection),
    [overview, props.selection, props.workspace],
  );
  const sqlPreview = useMemo(() => generateLogicalSql(props.workspace.model), [props.workspace.model]);
  const [fixMenuOpen, setFixMenuOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);

  const nextBulkStep = ORDERED_BULK_STEPS.find((step) => {
    const totals = completion[step] ?? { pending: 0, invalid: 0 };
    return totals.pending > 0 || totals.invalid > 0;
  }) ?? null;
  const openItemsForStep =
    nextBulkStep != null ? (overview.itemsByStep[nextBulkStep] ?? []).filter(isOpenTranslationItem) : [];
  const selectedChoices = selectedTranslationItem
    ? getLogicalTranslationChoicesForItem(overview, selectedTranslationItem)
    : [];
  const preferredChoice = chooseLogicalChoice(selectedChoices);
  const logicalPendingCount = ORDERED_BULK_STEPS.reduce((total, step) => {
    const totals = completion[step] ?? { pending: 0, invalid: 0 };
    return total + totals.pending + totals.invalid;
  }, 0);
  const blockingConflicts = props.workspace.translation.conflicts.filter((conflict) => conflict.level === "error");
  const doneDisabled = logicalPendingCount > 0 || blockingConflicts.length > 0;
  const hasSql = props.workspace.model.tables.length > 0;
  const sqlOpen = props.logicalStage === "schema" && props.panelMode === "sql";
  const selectedTargetKey = selectedTranslationItem ? buildTargetKey(selectedTranslationItem) : null;
  const activeTargetKeys = props.logicalStage === "translation" ? openItemsForStep.map(buildTargetKey) : [];
  const highlightedTargetKeys = selectedTargetKey ? [...new Set([...activeTargetKeys, selectedTargetKey])] : activeTargetKeys;

  const bulkLabel =
    nextBulkStep === "entities"
      ? t("logical.designer.fixEntities")
      : nextBulkStep === "weak-entities"
        ? t("logical.designer.fixWeakEntities")
        : nextBulkStep === "relationships"
          ? t("logical.designer.fixRelations")
          : nextBulkStep === "multivalued-attributes"
            ? t("logical.designer.fixMultivalued")
            : t("logical.designer.fix");

  function applySingleFix(): void {
    if (!selectedTranslationItem || !preferredChoice) {
      return;
    }

    if (selectedChoices.length > 1) {
      setFixMenuOpen((current) => !current);
      return;
    }

    props.onApplyChoice(selectedTranslationItem, preferredChoice);
  }

  function toggleSql(): void {
    props.onPanelModeChange(sqlOpen ? "review" : "sql");
  }

  async function copySql(): Promise<void> {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(sqlPreview);
    }
  }

  function renderCommonLeadButtons() {
    return (
      <>
        <ToolbarButton label={t("translation.restructuring.undo")} icon="U" disabled={!props.canUndo} onClick={props.onUndo} />
        <ToolbarButton label={t("translation.restructuring.redo")} icon="R" disabled={!props.canRedo} onClick={props.onRedo} />
        {props.logicalStage === "translation" ? (
          <ToolbarButton label={t("translation.restructuring.reset")} icon="Rs" onClick={props.onResetTranslation} />
        ) : null}
        <span className="designer-toolbar-separator" aria-hidden="true" />
      </>
    );
  }

  function renderTranslationToolbar() {
    const itemIsSelected = selectedTranslationItem != null;
    return (
      <div className="designer-context-toolbar designer-logical-toolbar" role="toolbar" aria-label="Logical translation tools">
        {renderCommonLeadButtons()}
        {itemIsSelected ? (
          <>
            <ToolbarButton
              label={t("logical.designer.fix")}
              icon="Fx"
              active={fixMenuOpen}
              disabled={!preferredChoice}
              title={!preferredChoice ? t("logical.designer.notFixable") : undefined}
              onClick={applySingleFix}
            />
            <ToolbarButton
              label={t("logical.designer.rename")}
              icon="Rn"
              onClick={() => selectedTranslationItem && renameWithPrompt(t("logical.designer.rename"), selectedTranslationItem.label, () => undefined)}
            />
          </>
        ) : null}
        {nextBulkStep ? (
          <ToolbarButton label={bulkLabel} icon="Fx*" onClick={() => props.onApplyBulkFix(nextBulkStep)} />
        ) : null}
        <ToolbarButton label={t("translation.restructuring.design")} icon="D" onClick={props.onOpenDesign} />
        <ToolbarButton
          label={t("logical.designer.done")}
          icon="Ok"
          disabled={doneDisabled}
          title={doneDisabled ? t("logical.designer.completeBeforeSchema") : undefined}
          onClick={props.onDone}
        />
        <ToolbarButton label={t("translation.restructuring.export")} icon="Ex" onClick={props.onExportProject} />
        <ToolbarButton
          label={t("translation.restructuring.save")}
          icon="S"
          disabled={!hasSql}
          title={!hasSql ? t("logical.designer.noSql") : undefined}
          onClick={props.onSaveSql}
        />
      </div>
    );
  }

  function renderSchemaToolbar() {
    const selectedColumn = selectedColumnContext?.column ?? null;
    const showColumnTools = selectedColumnContext != null;
    const showTableTools = !showColumnTools && selectedTable != null;
    const uniqueLocked = selectedColumn?.isPrimaryKey === true;
    const typeLocked = selectedColumn ? isColumnTypeLockedByReference(selectedColumn) : false;

    return (
      <div className="designer-context-toolbar designer-logical-toolbar" role="toolbar" aria-label="Logical schema tools">
        {renderCommonLeadButtons()}
        {showColumnTools && selectedColumnContext ? (
          <>
            <ToolbarButton
              label={t("logical.designer.unique")}
              icon="Uq"
              disabled={uniqueLocked}
              title={uniqueLocked ? t("logical.designer.primaryKeyUnique") : undefined}
              onClick={() =>
                props.onUpdateColumnSql(selectedColumnContext.tableId, selectedColumnContext.column.id, {
                  isUnique: !isColumnEffectivelyUnique(selectedColumnContext.column),
                })
              }
            />
            <ToolbarButton
              label={t("logical.designer.type")}
              icon="Ty"
              active={props.typeMode}
              disabled={typeLocked}
              title={typeLocked ? t("logical.designer.typeInherited") : undefined}
              onClick={() => props.onTypeModeChange(!props.typeMode)}
            />
            <ToolbarButton
              label={t("logical.designer.move")}
              icon="Mv"
              active={moveMenuOpen}
              onClick={() => setMoveMenuOpen((current) => !current)}
            />
            <ToolbarButton
              label={t("logical.designer.rename")}
              icon="Rn"
              onClick={() =>
                renameWithPrompt(t("logical.designer.renameColumn"), selectedColumnContext.column.name, (nextName) =>
                  props.onRenameColumn(selectedColumnContext.tableId, selectedColumnContext.column.id, nextName),
                )
              }
            />
          </>
        ) : null}
        {showTableTools && selectedTable ? (
          <>
            <ToolbarButton label={t("logical.designer.move")} icon="Mv" title={t("logical.designer.dragTable")} />
            <ToolbarButton
              label={t("logical.designer.rename")}
              icon="Rn"
              onClick={() =>
                renameWithPrompt(t("logical.designer.renameTable"), selectedTable.name, (nextName) =>
                  props.onRenameTable(selectedTable.id, nextName),
                )
              }
            />
          </>
        ) : null}
        {!showColumnTools && !showTableTools ? (
          <ToolbarButton label={t("logical.designer.editEr")} icon="D" onClick={props.onOpenDesign} />
        ) : null}
        {showColumnTools || showTableTools ? (
          <ToolbarButton label={t("logical.designer.editEr")} icon="D" onClick={props.onOpenDesign} />
        ) : null}
        <ToolbarButton label={t("translation.restructuring.export")} icon="Ex" onClick={props.onExportProject} />
        <ToolbarButton label={t("translation.restructuring.save")} icon="S" onClick={props.onSaveSql} />
      </div>
    );
  }

  return (
    <div className={["designer-logical-view", sqlOpen ? "sql-open" : ""].filter(Boolean).join(" ")}>
      {props.logicalStage === "schema" ? (
        <button type="button" className="designer-side-toggle designer-side-toggle-left" onClick={toggleSql}>
          <span aria-hidden="true">{sqlOpen ? "H" : "S"}</span>
          <span>{sqlOpen ? t("logical.designer.hideSql") : t("logical.designer.showSql")}</span>
        </button>
      ) : null}

      <div className="designer-stage-label">
        {props.logicalStage === "schema" ? t("logical.designer.schemaStage") : t("logical.designer.translationStage")}
      </div>

      {props.logicalStage === "translation" ? renderTranslationToolbar() : renderSchemaToolbar()}

      {fixMenuOpen && selectedTranslationItem ? (
        <div className="designer-fix-popover designer-logical-fix-popover">
          {selectedChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className="designer-fix-option"
              onClick={() => {
                props.onApplyChoice(selectedTranslationItem, choice);
                setFixMenuOpen(false);
              }}
            >
              <span>{choice.label}</span>
              {choice.recommended ? <span className="designer-fix-badge">{t("translation.restructuring.recommended")}</span> : null}
              <small>{choice.description}</small>
            </button>
          ))}
        </div>
      ) : null}

      {moveMenuOpen && selectedColumnContext ? (
        <div className="designer-fix-popover designer-logical-move-popover">
          {[
            ["up", t("logical.designer.moveUp")],
            ["down", t("logical.designer.moveDown")],
            ["top", t("logical.designer.moveTop")],
            ["bottom", t("logical.designer.moveBottom")],
          ].map(([direction, label]) => (
            <button
              key={direction}
              type="button"
              className="designer-fix-option"
              onClick={() => {
                props.onMoveColumn(
                  selectedColumnContext.tableId,
                  selectedColumnContext.column.id,
                  direction as ColumnMoveDirection,
                );
                setMoveMenuOpen(false);
              }}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className={["designer-logical-workspace", sqlOpen ? "sql-open" : ""].filter(Boolean).join(" ")}>
        {sqlOpen ? (
          <aside className="designer-sql-dock" aria-label="SQL">
            <div className="designer-sql-dock-header">
              <span>SQL</span>
              <div className="designer-sql-actions">
                <button type="button" onClick={copySql}>
                  {t("logical.designer.copySql")}
                </button>
                <button type="button" onClick={() => downloadSql(sqlPreview)}>
                  {t("logical.designer.downloadSql")}
                </button>
              </div>
            </div>
            <pre
              className="designer-sql-output"
              dangerouslySetInnerHTML={{ __html: highlightSql(sqlPreview) }}
            />
          </aside>
        ) : null}

        <section className="designer-logical-canvas">
          {props.logicalStage === "translation" ? (
            <div className="designer-logical-status">
              <span>{bulkLabel}</span>
              <span>{logicalPendingCount} pending</span>
            </div>
          ) : null}
          <LogicalTransformationCanvas
            workspace={props.workspace}
            selection={props.selection}
            viewport={props.viewport}
            typeMode={props.logicalStage === "schema" ? props.typeMode : false}
            fitRequestToken={props.fitRequestToken}
            activeTargetKeys={highlightedTargetKeys}
            focusedTargetKey={selectedTargetKey}
            schemaOnly={props.logicalStage === "schema"}
            onViewportChange={props.onViewportChange}
            onSelectionChange={props.onSelectionChange}
            onPreviewModel={props.onPreviewModel}
            onCommitModel={props.onCommitModel}
            onRenameTable={props.onRenameTable}
            onRenameColumn={props.onRenameColumn}
            onUpdateColumnSql={props.onUpdateColumnSql}
          />
        </section>
      </div>

      {props.logicalStage === "schema" && selectedColumnContext && props.typeMode ? (
        <div className="designer-schema-type-shortcuts" aria-hidden="true">
          {SQL_TYPE_PICKER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                props.onUpdateColumnSql(selectedColumnContext.tableId, selectedColumnContext.column.id, {
                  dataType: option.value,
                  length: option.value === "VARCHAR" ? 100 : null,
                  precision: null,
                  scale: null,
                })
              }
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
