import { useMemo, useRef, useState } from "react";
import { DiagramCanvas } from "../canvas/DiagramCanvas";
import type { DiagramDocument, DiagramEdge, DiagramHighlights, SelectionState, Viewport } from "../types/diagram";
import type { ErTranslationChoice, ErTranslationItem, ErTranslationWorkspaceDocument } from "../types/translation";
import {
  buildErTranslationOverview,
  canOpenLogicalView,
  getErTranslationChoicesForItem,
} from "../utils/erTranslation";
import { validateDiagram } from "../utils/diagram";
import { useI18n } from "../i18n/useI18n";

interface TranslationWorkspaceProps {
  workspace: ErTranslationWorkspaceDocument;
  viewport: Viewport;
  selection: SelectionState;
  sidePanelHidden?: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onViewportChange: (viewport: Viewport) => void;
  onSelectionChange: (selection: SelectionState) => void;
  onApplyChoice: (item: ErTranslationItem, choice: ErTranslationChoice) => void;
  onResetTranslation: () => void;
  onOpenDesign: () => void;
  onOpenLogical: () => void;
  onExportProject: () => void;
  onSaveRestructuredErs: () => void;
  onPreviewDiagram: (diagram: DiagramDocument) => void;
  onCommitDiagram: (diagram: DiagramDocument, previous: DiagramDocument) => void;
}

function getAllItems(workspace: ErTranslationWorkspaceDocument): ErTranslationItem[] {
  const overview = buildErTranslationOverview(workspace);
  return [...overview.itemsByStep.generalizations, ...overview.itemsByStep["composite-attributes"]];
}

function getSelectionItem(workspace: ErTranslationWorkspaceDocument, selection: SelectionState): ErTranslationItem | null {
  const items = getAllItems(workspace);
  const selectedNodeId = selection.nodeIds[0];
  if (selectedNodeId) {
    return items.find((item) => item.id === selectedNodeId) ?? null;
  }

  const selectedEdgeId = selection.edgeIds[0];
  if (!selectedEdgeId) {
    return null;
  }

  const edge = workspace.translatedDiagram.edges.find((candidate) => candidate.id === selectedEdgeId);
  if (edge?.type !== "inheritance") {
    return null;
  }

  return items.find((item) => item.targetType === "generalization" && item.id === edge.generalizationGroupId) ?? null;
}

function getChoiceOrder(choice: ErTranslationChoice): number {
  const order: Record<string, number> = {
    "generalization-collapse-up": 1,
    "generalization-collapse-down": 2,
    "generalization-substitution": 3,
    "composite-split": 1,
    "composite-merge": 2,
  };
  return order[choice.rule] ?? 99;
}

function getChoiceIcon(choice: ErTranslationChoice): string {
  if (choice.rule === "generalization-collapse-up") {
    return "Up";
  }
  if (choice.rule === "generalization-collapse-down") {
    return "Dn";
  }
  if (choice.rule === "generalization-substitution") {
    return "Sub";
  }
  if (choice.rule === "composite-split") {
    return "Split";
  }
  return "Merge";
}

function buildTranslationHighlights(
  workspace: ErTranslationWorkspaceDocument,
  selectedItem: ErTranslationItem | null,
): DiagramHighlights {
  const overview = buildErTranslationOverview(workspace);
  const pendingNodeIds: string[] = [];
  const pendingEdgeIds: string[] = [];
  const blockedNodeIds: string[] = [];
  const blockedEdgeIds: string[] = [];
  const selectedNodeIds: string[] = [];
  const selectedEdgeIds: string[] = [];
  const groupEdges = new Map<string, DiagramEdge[]>();

  workspace.translatedDiagram.edges.forEach((edge) => {
    if (edge.type === "inheritance" && edge.generalizationGroupId) {
      groupEdges.set(edge.generalizationGroupId, [...(groupEdges.get(edge.generalizationGroupId) ?? []), edge]);
    }
  });

  overview.itemsByStep.generalizations.forEach((item) => {
    const edgeIds = (groupEdges.get(item.id) ?? []).map((edge) => edge.id);
    if (item.status === "pending") {
      pendingEdgeIds.push(...edgeIds);
    } else if (item.status === "blocked") {
      blockedEdgeIds.push(...edgeIds);
    }
  });

  overview.itemsByStep["composite-attributes"].forEach((item) => {
    if (item.status === "pending") {
      pendingNodeIds.push(item.id);
    } else if (item.status === "blocked") {
      blockedNodeIds.push(item.id);
    }
  });

  if (selectedItem?.targetType === "attribute") {
    selectedNodeIds.push(selectedItem.id);
  } else if (selectedItem?.targetType === "generalization") {
    selectedEdgeIds.push(...(groupEdges.get(selectedItem.id) ?? []).map((edge) => edge.id));
  }

  return { pendingNodeIds, pendingEdgeIds, blockedNodeIds, blockedEdgeIds, selectedNodeIds, selectedEdgeIds };
}

function ToolbarButton(props: {
  label: string;
  icon: string;
  disabled?: boolean;
  title?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={props.active ? "designer-toolbar-button active" : "designer-toolbar-button"}
      disabled={props.disabled}
      title={props.title}
      onClick={props.onClick}
    >
      <span className="designer-toolbar-icon" aria-hidden="true">
        {props.icon}
      </span>
      <span className="designer-toolbar-label">{props.label}</span>
    </button>
  );
}

export function TranslationWorkspace(props: TranslationWorkspaceProps) {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [canvasStatus, setCanvasStatus] = useState("");
  const [fixOpen, setFixOpen] = useState(false);
  const overview = useMemo(() => buildErTranslationOverview(props.workspace), [props.workspace]);
  const logicalAccess = useMemo(() => canOpenLogicalView(props.workspace), [props.workspace]);
  const selectedItem = useMemo(
    () => getSelectionItem(props.workspace, props.selection),
    [props.workspace, props.selection],
  );
  const selectedChoices = useMemo(
    () =>
      selectedItem
        ? getErTranslationChoicesForItem(props.workspace, selectedItem).sort((left, right) => getChoiceOrder(left) - getChoiceOrder(right))
        : [],
    [props.workspace, selectedItem],
  );
  const translatedIssues = useMemo(() => validateDiagram(props.workspace.translatedDiagram), [props.workspace.translatedDiagram]);
  const highlights = useMemo(() => buildTranslationHighlights(props.workspace, selectedItem), [props.workspace, selectedItem]);
  const generalizationPending = overview.itemsByStep.generalizations.filter((item) => item.status === "pending").length;
  const attributePending = overview.itemsByStep["composite-attributes"].filter((item) => item.status === "pending").length;
  const blockedAttribute = selectedItem?.status === "blocked" ? selectedItem.blockedReason : undefined;
  const fixDisabled = !selectedItem || selectedItem.status === "blocked" || selectedChoices.length === 0;
  const fixTitle =
    blockedAttribute ?? (!selectedItem ? t("translation.restructuring.selectTarget") : undefined);
  const unavailableMessage = t("translation.restructuring.unavailable");

  return (
    <div className="designer-workspace designer-translation-view">
      <div className="designer-stage-label">{t("translation.restructuring.stageLabel")}</div>

      <div className="designer-context-toolbar designer-translation-toolbar" role="toolbar" aria-label="Restructuring tools">
        <ToolbarButton label={t("translation.restructuring.undo")} icon="U" disabled={!props.canUndo} onClick={props.onUndo} />
        <ToolbarButton label={t("translation.restructuring.redo")} icon="R" disabled={!props.canRedo} onClick={props.onRedo} />
        <ToolbarButton label={t("translation.restructuring.reset")} icon="Rs" onClick={props.onResetTranslation} />
        <span className="designer-toolbar-separator" aria-hidden="true" />
        {selectedItem ? (
          <ToolbarButton
            label={t("translation.restructuring.fix")}
            icon="Fx"
            active={fixOpen}
            disabled={fixDisabled}
            title={fixTitle}
            onClick={() => setFixOpen((value) => !value)}
          />
        ) : null}
        <ToolbarButton label={t("translation.restructuring.design")} icon="D" onClick={props.onOpenDesign} />
        <ToolbarButton
          label={t("translation.restructuring.translate")}
          icon="Tr"
          disabled={!logicalAccess.allowed}
          title={logicalAccess.allowed ? undefined : logicalAccess.reason ?? t("translation.restructuring.completeFirst")}
          onClick={props.onOpenLogical}
        />
        <ToolbarButton label={t("translation.restructuring.export")} icon="Ex" onClick={props.onExportProject} />
        <ToolbarButton label={t("translation.restructuring.save")} icon="S" onClick={props.onSaveRestructuredErs} />
      </div>

      {fixOpen && selectedItem ? (
        <div className="designer-fix-popover" aria-label="Fix options">
          {selectedChoices.map((choice) => {
            const disabled = selectedItem.status === "blocked" || Boolean(choice.disabledReason);
            return (
              <button
                key={choice.id}
                type="button"
                className={choice.recommended ? "designer-fix-choice recommended" : "designer-fix-choice"}
                disabled={disabled}
                title={choice.disabledReason ?? choice.warning ?? choice.description}
                onClick={() => {
                  props.onApplyChoice(selectedItem, choice);
                  setFixOpen(false);
                }}
              >
                <span className="designer-fix-choice-icon" aria-hidden="true">
                  {getChoiceIcon(choice)}
                </span>
                <span className="designer-fix-choice-main">
                  <span className="designer-fix-choice-label">{choice.label}</span>
                  {choice.recommended ? <span className="designer-fix-badge">{t("translation.restructuring.recommended")}</span> : null}
                  {choice.warning && !choice.disabledReason ? <span className="designer-fix-warning">{choice.warning}</span> : null}
                  {choice.disabledReason ? <span className="designer-fix-disabled-reason">{choice.disabledReason}</span> : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
      
      <div className="designer-canvas-region designer-translation-canvas">
        <DiagramCanvas
          diagram={props.workspace.translatedDiagram}
          selection={props.selection}
          tool="select"
          mode="edit"
          viewport={props.viewport}
          issues={translatedIssues}
          statusMessage={canvasStatus}
          svgRef={svgRef}
          translationHighlights={highlights}
          onViewportChange={props.onViewportChange}
          onSelectionChange={(selection) => {
            setFixOpen(false);
            props.onSelectionChange(selection);
          }}
          onPreviewDiagram={props.onPreviewDiagram}
          onCommitDiagram={props.onCommitDiagram}
          onCreateNode={() => ""}
          onCreateEdge={() => ({ success: false, message: unavailableMessage })}
          onOpenCardinality={() => {}}
          onToolChange={() => {}}
          onCreateExternalIdentifier={() => ({ success: false, message: unavailableMessage })}
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
  );
}
