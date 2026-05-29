import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { DiagramDocument, Viewport } from "../types/diagram";
import type {
  LogicalColumn,
  LogicalSelection,
  LogicalStage,
  LogicalTableKind,
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
  findEntityKeySelectionRequests,
  getLogicalTranslationChoicesForItem,
  getLogicalTranslationStepCompletion,
  type LogicalEntityKeySelectionRequest,
} from "../utils/logicalTranslation";
import {
  buildEntityKeyChoicePreviewData,
  getNextEntityKeyModalIndex,
  getPreviousEntityKeyModalIndex,
} from "../utils/logicalKeyPreview";
import {
  SQL_TYPE_PICKER_OPTIONS,
  isColumnEffectivelyUnique,
  isColumnTypeLockedByReference,
  type LogicalColumnSqlPatch,
} from "../utils/logicalSqlMetadata";
import { generateLogicalSql } from "../utils/logicalSql";
import { EntityKeyChoicePreview } from "./EntityKeyChoicePreview";
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
  notesPanelOpen?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: LogicalSelection) => void;
  onTypeModeChange: (nextValue: boolean) => void;
  onPanelModeChange: (nextValue: "review" | "sql") => void;
  onToggleNotesPanel?: () => void;
  onApplyChoice: (item: LogicalTranslationItem, choice: LogicalTranslationChoice) => void;
  onApplyBulkFix: (step: LogicalBulkStep, options?: { choiceIdsByTargetKey?: Record<string, string> }) => void;
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

function toDomId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-");
}

function formatEntityKeyChoiceTitle(choice: LogicalTranslationChoice): string {
  return choice.label.replace(/^Tabella con PK\s+/i, "PK ").replace(/^Tabella con\s+/i, "");
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

function highlightSql(sql: string, model: LogicalWorkspaceDocument["model"]): string {
  const tableKindByName = new Map<string, LogicalTableKind>();
  model.tables.forEach((table) => tableKindByName.set(table.name, table.kind));

  let placeholderIndex = 0;
  const placeholderMap = new Map<string, string>();
  const makePlaceholder = (quotedName: string, kind: LogicalTableKind) => {
    const placeholder = `__SQL_NAME_${placeholderIndex += 1}__`;
    const className = kind === "entity" ? "sql-token-entity" : "sql-token-relationship";
    placeholderMap.set(placeholder, `<span class="${className}">${escapeHtml(quotedName)}</span>`);
    return placeholder;
  };

  const tagTableName = (match: string, quotedName: string) => {
    const unquoted = quotedName.slice(1, -1).replace(/""/g, '"');
    const kind = tableKindByName.get(unquoted);
    if (!kind) {
      return match;
    }
    const placeholder = makePlaceholder(quotedName, kind);
    return match.replace(quotedName, placeholder);
  };

  let taggedSql = sql.replace(/\bCREATE\s+TABLE\s+("(?:""|[^"])+")/gi, tagTableName);
  taggedSql = taggedSql.replace(/\bREFERENCES\s+("(?:""|[^"])+")/gi, tagTableName);

  const escaped = escapeHtml(taggedSql);
  let highlighted = escaped.replace(
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

  placeholderMap.forEach((value, placeholder) => {
    highlighted = highlighted.split(placeholder).join(value);
  });

  return highlighted;
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

function ToolbarIcon(props: { name: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (props.name === "undo") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M9 14 4 9l5-5" /><path {...common} d="M4 9h10a6 6 0 0 1 6 6v1" /></svg>;
  }
  if (props.name === "redo") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m15 14 5-5-5-5" /><path {...common} d="M20 9H10a6 6 0 0 0-6 6v1" /></svg>;
  }
  if (props.name === "reset") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M3 12a9 9 0 1 0 3-6.7" /><path {...common} d="M3 4v5h5" /></svg>;
  }
  if (props.name === "fix") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="m14.7 6.3 3-3 3 3-3 3" /><path {...common} d="M4 20l7.6-7.6" /><path {...common} d="m13 5 6 6" /><path {...common} d="M4 8h5" /><path {...common} d="M6.5 5.5v5" /></svg>;
  }
  if (props.name === "design") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="4" y="4" width="6" height="6" /><rect {...common} x="14" y="4" width="6" height="6" /><rect {...common} x="4" y="14" width="6" height="6" /><path {...common} d="M10 7h4M7 10v4M17 10v4M10 17h4" /></svg>;
  }
  if (props.name === "done") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><circle {...common} cx="12" cy="12" r="9" /><path {...common} d="m7.5 12.3 3 3L17 8.8" /></svg>;
  }
  if (props.name === "export") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3v12" /><path {...common} d="m7 10 5 5 5-5" /><path {...common} d="M5 19h14" /></svg>;
  }
  if (props.name === "save") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M5 4h12l2 2v14H5z" /><path {...common} d="M8 4v6h8V4" /><path {...common} d="M8 20v-6h8v6" /></svg>;
  }
  if (props.name === "unique") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M7 12a5 5 0 0 1 10 0v2" /><path {...common} d="M7 14a5 5 0 0 0 10 0" /><path {...common} d="M12 17v3" /></svg>;
  }
  if (props.name === "type") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><rect {...common} x="5" y="4" width="14" height="16" /><path {...common} d="M8 8h8M8 12h8M8 16h5" /></svg>;
  }
  if (props.name === "move") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M12 3v18" /><path {...common} d="m8 7 4-4 4 4" /><path {...common} d="m8 17 4 4 4-4" /></svg>;
  }
  if (props.name === "rename") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 20h4l10-10-4-4L4 16z" /><path {...common} d="m13 7 4 4" /></svg>;
  }
  if (props.name === "show") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M4 5h12v14H4z" /><path {...common} d="m13 9 4 3-4 3" /><path {...common} d="M17 12H8" /></svg>;
  }
  if (props.name === "notes") {
    return <svg viewBox="0 0 24 24" aria-hidden="true"><path {...common} d="M6 4h10l2 2v14H6z" /><path {...common} d="M16 4v4h4" /><path {...common} d="M9 12h6M9 16h5" /></svg>;
  }

  return null;
}

function ToolbarButton(props: {
  label: string;
  icon: ReactNode;
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
      <span className="designer-toolbar-icon designer-toolbar-svg" aria-hidden="true">
        {props.icon}
      </span>
      <span className="designer-toolbar-label">{props.label}</span>
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
  const canvasViewMode = props.logicalStage === "schema" && props.panelMode === "sql" ? "schema" : "transformation";
  const [fixMenuOpen, setFixMenuOpen] = useState(false);
  const [moveMenuOpen, setMoveMenuOpen] = useState(false);
  const [entityKeySelectionModal, setEntityKeySelectionModal] = useState<{
    requests: LogicalEntityKeySelectionRequest[];
    selectedChoiceIdsByTargetKey: Record<string, string>;
    currentIndex: number;
  } | null>(null);
  const entityKeyModalRef = useRef<HTMLElement | null>(null);

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
  const entityKeyModalOpen = entityKeySelectionModal != null;
  const entityKeySelectionTotalCount = entityKeySelectionModal?.requests.length ?? 0;
  const entityKeySelectionCompletedCount =
    entityKeySelectionModal?.requests.filter((request) => entityKeySelectionModal.selectedChoiceIdsByTargetKey[request.targetKey]).length ?? 0;
  const entityKeySelectionComplete = entityKeySelectionTotalCount > 0 && entityKeySelectionCompletedCount === entityKeySelectionTotalCount;
  const currentEntityKeyRequest = entityKeySelectionModal?.requests[entityKeySelectionModal.currentIndex] ?? null;
  const currentEntityKeySelectedChoiceId = currentEntityKeyRequest
    ? entityKeySelectionModal?.selectedChoiceIdsByTargetKey[currentEntityKeyRequest.targetKey]
    : undefined;
  const currentEntityKeyChoices = currentEntityKeyRequest?.choices ?? [];
  const currentEntityKeyPreviewChoice =
    currentEntityKeyChoices.find((choice) => choice.id === currentEntityKeySelectedChoiceId) ?? currentEntityKeyChoices[0] ?? null;
  const currentEntityKeyChoiceConfirmed = Boolean(
    currentEntityKeyRequest && currentEntityKeySelectedChoiceId === currentEntityKeyPreviewChoice?.id,
  );
  const currentEntityKeyPreviewData = currentEntityKeyRequest
    ? buildEntityKeyChoicePreviewData({
        diagram: props.sourceDiagram,
        request: currentEntityKeyRequest,
        choice: currentEntityKeyPreviewChoice,
      })
    : null;
  const currentEntityKeyPage = (entityKeySelectionModal?.currentIndex ?? 0) + 1;
  const entityKeyModalTitleId = "entity-key-modal-title";
  const entityKeyModalDescriptionId = "entity-key-modal-description";

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

  useEffect(() => {
    if (!entityKeyModalOpen || typeof window === "undefined") {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEntityKeySelectionModal(null);
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") {
        return;
      }

      if (event.key === "ArrowLeft") {
        setEntityKeySelectionModal((current) =>
          current ? { ...current, currentIndex: getPreviousEntityKeyModalIndex(current.currentIndex) } : current,
        );
      } else if (event.key === "ArrowRight") {
        setEntityKeySelectionModal((current) =>
          current
            ? { ...current, currentIndex: getNextEntityKeyModalIndex(current.currentIndex, current.requests.length) }
            : current,
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [entityKeyModalOpen]);

  useEffect(() => {
    if (!entityKeyModalOpen || typeof window === "undefined") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      entityKeyModalRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [entityKeyModalOpen]);

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

  function handleBulkFixClick(step: LogicalBulkStep): void {
    if (step !== "entities") {
      props.onApplyBulkFix(step);
      return;
    }

    const requests = findEntityKeySelectionRequests(props.sourceDiagram, props.workspace);
    if (requests.length > 0) {
      setEntityKeySelectionModal({
        requests,
        selectedChoiceIdsByTargetKey: {},
        currentIndex: 0,
      });
      return;
    }

    props.onApplyBulkFix(step);
  }

  function confirmEntityKeySelection(): void {
    if (!entityKeySelectionModal) {
      return;
    }

    props.onApplyBulkFix("entities", {
      choiceIdsByTargetKey: entityKeySelectionModal.selectedChoiceIdsByTargetKey,
    });
    setEntityKeySelectionModal(null);
  }

  function goToPreviousEntityKeyPage(): void {
    setEntityKeySelectionModal((current) =>
      current ? { ...current, currentIndex: getPreviousEntityKeyModalIndex(current.currentIndex) } : current,
    );
  }

  function goToNextEntityKeyPage(): void {
    setEntityKeySelectionModal((current) =>
      current
        ? { ...current, currentIndex: getNextEntityKeyModalIndex(current.currentIndex, current.requests.length) }
        : current,
    );
  }

  function toggleSql(): void {
    props.onPanelModeChange(sqlOpen ? "review" : "sql");
  }

  async function copySql(): Promise<void> {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(sqlPreview);
    }
  }

  function renderCommonLeadButtons(includeReset = true) {
    return (
      <>
        <ToolbarButton label={t("translation.restructuring.undo")} icon={<ToolbarIcon name="undo" />} disabled={!props.canUndo} onClick={props.onUndo} />
        <ToolbarButton label={t("translation.restructuring.redo")} icon={<ToolbarIcon name="redo" />} disabled={!props.canRedo} onClick={props.onRedo} />
        {includeReset ? (
          <ToolbarButton label={t("translation.restructuring.reset")} icon={<ToolbarIcon name="reset" />} onClick={props.onResetTranslation} />
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
              icon={<ToolbarIcon name="fix" />}
              active={fixMenuOpen}
              disabled={!preferredChoice}
              title={!preferredChoice ? t("logical.designer.notFixable") : undefined}
              onClick={applySingleFix}
            />
            <ToolbarButton
              label={t("logical.designer.rename")}
              icon={<ToolbarIcon name="rename" />}
              onClick={() => selectedTranslationItem && renameWithPrompt(t("logical.designer.rename"), selectedTranslationItem.label, () => undefined)}
            />
          </>
        ) : null}
        {nextBulkStep ? (
          <ToolbarButton label={bulkLabel} icon={<ToolbarIcon name="fix" />} onClick={() => handleBulkFixClick(nextBulkStep)} />
        ) : null}
        <ToolbarButton label={t("translation.restructuring.design")} icon={<ToolbarIcon name="design" />} onClick={props.onOpenDesign} />
        <ToolbarButton
          label={t("logical.designer.done")}
          icon={<ToolbarIcon name="done" />}
          disabled={doneDisabled}
          title={doneDisabled ? t("logical.designer.completeBeforeSchema") : undefined}
          onClick={props.onDone}
        />
        <ToolbarButton label={t("translation.restructuring.export")} icon={<ToolbarIcon name="export" />} onClick={props.onExportProject} />
        <ToolbarButton
          label={t("translation.restructuring.save")}
          icon={<ToolbarIcon name="save" />}
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
    const showEditTools = showColumnTools || showTableTools;
    const uniqueLocked = selectedColumn?.isPrimaryKey === true;
    const typeLocked = selectedColumn ? isColumnTypeLockedByReference(selectedColumn) : false;

    return (
      <div className="designer-context-toolbar designer-logical-toolbar" role="toolbar" aria-label="Logical schema tools">
        {renderCommonLeadButtons(!showEditTools)}
        {showEditTools ? (
          <>
            <ToolbarButton
              label={t("logical.designer.unique")}
              icon={<ToolbarIcon name="unique" />}
              disabled={!selectedColumnContext || uniqueLocked}
              title={
                !selectedColumnContext
                  ? undefined
                  : uniqueLocked
                    ? t("logical.designer.primaryKeyUnique")
                    : undefined
              }
              onClick={() =>
                selectedColumnContext
                  ? props.onUpdateColumnSql(selectedColumnContext.tableId, selectedColumnContext.column.id, {
                      isUnique: !isColumnEffectivelyUnique(selectedColumnContext.column),
                    })
                  : undefined
              }
            />
            <ToolbarButton
              label={t("logical.designer.type")}
              icon={<ToolbarIcon name="type" />}
              active={props.typeMode}
              disabled={!selectedColumnContext || typeLocked}
              title={
                !selectedColumnContext
                  ? undefined
                  : typeLocked
                    ? t("logical.designer.typeInherited")
                    : undefined
              }
              onClick={() => props.onTypeModeChange(!props.typeMode)}
            />
            <ToolbarButton
              label={t("logical.designer.move")}
              icon={<ToolbarIcon name="move" />}
              active={moveMenuOpen}
              onClick={() => {
                if (selectedColumnContext) {
                  setMoveMenuOpen((current) => !current);
                }
              }}
            />
            <ToolbarButton
              label={t("logical.designer.rename")}
              icon={<ToolbarIcon name="rename" />}
              onClick={() =>
                selectedColumnContext
                  ? renameWithPrompt(t("logical.designer.renameColumn"), selectedColumnContext.column.name, (nextName) =>
                      props.onRenameColumn(selectedColumnContext.tableId, selectedColumnContext.column.id, nextName),
                    )
                  : selectedTable
                    ? renameWithPrompt(t("logical.designer.renameTable"), selectedTable.name, (nextName) =>
                        props.onRenameTable(selectedTable.id, nextName),
                      )
                    : undefined
              }
            />
          </>
        ) : null}
        <ToolbarButton
          label={sqlOpen ? t("logical.designer.hideSql") : t("logical.designer.showSql")}
          icon={<ToolbarIcon name="show" />}
          active={sqlOpen}
          disabled={props.logicalStage !== "schema"}
          onClick={toggleSql}
        />
        {!showEditTools ? (
          <>
            <ToolbarButton
              label={t("logical.designer.fixEntities")}
              icon={<ToolbarIcon name="fix" />}
              disabled={!nextBulkStep}
              onClick={() => nextBulkStep && handleBulkFixClick(nextBulkStep)}
            />
            <ToolbarButton label={t("translation.restructuring.design")} icon={<ToolbarIcon name="design" />} onClick={props.onOpenDesign} />
            <ToolbarButton
              label={t("logical.designer.done")}
              icon={<ToolbarIcon name="done" />}
              disabled={doneDisabled}
              title={doneDisabled ? t("logical.designer.completeBeforeSchema") : undefined}
              onClick={props.onDone}
            />
            <ToolbarButton label={t("translation.restructuring.export")} icon={<ToolbarIcon name="export" />} onClick={props.onExportProject} />
            <ToolbarButton label={t("translation.restructuring.save")} icon={<ToolbarIcon name="save" />} onClick={props.onSaveSql} />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className={["designer-workspace", "designer-logical-view", sqlOpen ? "sql-open" : ""].filter(Boolean).join(" ")}>
      <div className={["designer-canvas-region", "designer-logical-canvas", sqlOpen ? "sql-open" : ""].filter(Boolean).join(" ")}>
        {props.logicalStage === "schema" && props.onToggleNotesPanel ? (
          <button
            type="button"
            className="designer-side-toggle designer-side-toggle-right designer-logical-notes-toggle"
            onClick={props.onToggleNotesPanel}
            title={props.notesPanelOpen ? "Chiudi note" : "Apri note"}
          >
            <span aria-hidden="true">N</span>
            {props.notesPanelOpen ? "Hide" : "Notes"}
          </button>
        ) : null}

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

        {entityKeySelectionModal ? (
          <div
            className="entity-key-modal-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setEntityKeySelectionModal(null);
              }
            }}
          >
            <section
              ref={entityKeyModalRef}
              className="entity-key-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby={entityKeyModalTitleId}
              aria-describedby={entityKeyModalDescriptionId}
              tabIndex={-1}
            >
              <header className="entity-key-modal-header">
                <div>
                  <h2 id={entityKeyModalTitleId} className="entity-key-modal-title">
                    Scegli la chiave primaria
                  </h2>
                  <p id={entityKeyModalDescriptionId} className="entity-key-modal-description">
                    Seleziona quale identificatore diventera la PK. Gli altri identificatori candidati saranno tradotti come UNIQUE NOT NULL.
                  </p>
                  <span className="entity-key-modal-progress">
                    <span aria-live="polite">
                      Entita {currentEntityKeyPage} di {entityKeySelectionTotalCount}
                      {currentEntityKeyRequest ? ` - ${currentEntityKeyRequest.item.label}` : ""}
                    </span>
                    <span>{entityKeySelectionCompletedCount} scelte completate su {entityKeySelectionTotalCount}</span>
                  </span>
                </div>
                <button
                  type="button"
                  className="entity-key-modal-close"
                  aria-label="Annulla scelta chiave primaria"
                  onClick={() => setEntityKeySelectionModal(null)}
                >
                  X
                </button>
              </header>
              <div className="entity-key-modal-body">
                {currentEntityKeyRequest ? (
                  <>
                    <section className="entity-key-modal-choice-pane">
                      <div className="entity-key-current-entity-head">
                        <span className="entity-key-current-entity-kicker">Entita corrente</span>
                        <h3>{currentEntityKeyRequest.item.label}</h3>
                        <p>{currentEntityKeyRequest.choices.length} identificatori candidati</p>
                      </div>

                      <div className="entity-key-option-list">
                        {currentEntityKeyRequest.choices.map((choice) => {
                          const selected = currentEntityKeySelectedChoiceId === choice.id;
                          const inputId = `entity-key-${toDomId(currentEntityKeyRequest.targetKey)}-${toDomId(choice.id)}`;
                          const choicePreview = buildEntityKeyChoicePreviewData({
                            diagram: props.sourceDiagram,
                            request: currentEntityKeyRequest,
                            choice,
                          });
                          return (
                            <label
                              key={choice.id}
                              htmlFor={inputId}
                              className={["entity-key-option", selected ? "entity-key-option-selected" : ""].filter(Boolean).join(" ")}
                            >
                              <input
                                id={inputId}
                                className="entity-key-option-radio"
                                type="radio"
                                name={`primary-key-${currentEntityKeyRequest.targetKey}`}
                                checked={selected}
                                onChange={() =>
                                  setEntityKeySelectionModal((current) =>
                                    current
                                      ? {
                                          ...current,
                                          selectedChoiceIdsByTargetKey: {
                                            ...current.selectedChoiceIdsByTargetKey,
                                            [currentEntityKeyRequest.targetKey]: choice.id,
                                          },
                                        }
                                      : current,
                                  )
                                }
                              />
                              <span className="entity-key-option-content">
                                <span className="entity-key-option-kind">{choicePreview.kindLabel}</span>
                                <strong className="entity-key-option-title">{choicePreview.title}</strong>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </section>

                    <section className="entity-key-modal-preview-pane">
                      <div className="entity-key-preview-pane-head">
                        <span>Risultato della scelta</span>
                        <strong>{currentEntityKeyPreviewData?.title ?? "Nessuna alternativa"}</strong>
                        <small>
                          {currentEntityKeyChoiceConfirmed
                            ? `Questa alternativa verra applicata a ${currentEntityKeyRequest.item.label}.`
                            : "Anteprima della prima alternativa. Seleziona una card a sinistra per confermare."}
                        </small>
                      </div>
                      <div className="entity-key-preview-canvas">
                        <EntityKeyChoicePreview
                          diagram={props.sourceDiagram}
                          request={currentEntityKeyRequest}
                          choice={currentEntityKeyPreviewChoice}
                          confirmed={currentEntityKeyChoiceConfirmed}
                        />
                      </div>
                    </section>
                  </>
                ) : null}
              </div>

              <footer className="entity-key-modal-footer">
                <div className="entity-key-modal-footer-status" aria-live="polite">
                  <strong>Entita {currentEntityKeyPage} di {entityKeySelectionTotalCount}</strong>
                  <span>
                    {entityKeySelectionComplete
                      ? "Tutte le entita sono pronte per la conversione."
                      : currentEntityKeyRequest && currentEntityKeySelectedChoiceId
                        ? `${currentEntityKeyRequest.item.label} completata.`
                        : currentEntityKeyRequest
                          ? `Seleziona una chiave primaria per ${currentEntityKeyRequest.item.label}.`
                        : "Seleziona una chiave primaria per ogni entita."}
                  </span>
                </div>
                <div className="entity-key-modal-footer-actions">
                  <button
                    type="button"
                    disabled={(entityKeySelectionModal?.currentIndex ?? 0) === 0}
                    onClick={goToPreviousEntityKeyPage}
                  >
                    Precedente
                  </button>
                  <button
                    type="button"
                    className={
                      currentEntityKeySelectedChoiceId && (entityKeySelectionModal?.currentIndex ?? 0) < entityKeySelectionTotalCount - 1
                        ? "entity-key-next-highlight"
                        : undefined
                    }
                    disabled={(entityKeySelectionModal?.currentIndex ?? 0) >= entityKeySelectionTotalCount - 1}
                    onClick={goToNextEntityKeyPage}
                  >
                    Prossima
                  </button>
                  <button type="button" onClick={() => setEntityKeySelectionModal(null)}>
                    Annulla
                  </button>
                  <button
                    type="button"
                    disabled={!entityKeySelectionComplete}
                    title={!entityKeySelectionComplete ? "Completa una scelta per ogni entita." : undefined}
                    onClick={confirmEntityKeySelection}
                  >
                    Applica Fix Entities
                  </button>
                </div>
              </footer>
            </section>
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
                dangerouslySetInnerHTML={{ __html: highlightSql(sqlPreview, props.workspace.model) }}
              />
            </aside>
          ) : null}

          <section className="designer-logical-stage">
            <LogicalTransformationCanvas
              sourceDiagram={props.sourceDiagram}
              workspace={props.workspace}
              selection={props.selection}
              viewport={props.viewport}
              typeMode={props.logicalStage === "schema" ? props.typeMode : false}
              fitRequestToken={props.fitRequestToken}
              autoFitOnMount={props.logicalStage === "schema"}
              activeTargetKeys={highlightedTargetKeys}
              focusedTargetKey={selectedTargetKey}
              viewMode={canvasViewMode}
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
                onClick={() => {
                  props.onUpdateColumnSql(selectedColumnContext.tableId, selectedColumnContext.column.id, {
                    dataType: option.value,
                    length: option.value === "VARCHAR" ? 100 : null,
                    precision: null,
                    scale: null,
                  });
                  props.onTypeModeChange(false);
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
