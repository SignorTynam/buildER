import { type ReactNode, useMemo, useRef, useState } from "react";
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
  notesPanelOpen: boolean;
  onToggleNotesPanel: () => void;
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
  selection: SelectionState,
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
    workspace.translatedDiagram.edges.forEach((edge) => {
      if (edge.type !== "attribute") {
        return;
      }

      const isSelectedEndpoint = edge.sourceId === selectedItem.id || edge.targetId === selectedItem.id;
      if (!isSelectedEndpoint) {
        return;
      }

      const otherNodeId = edge.sourceId === selectedItem.id ? edge.targetId : edge.sourceId;
      const otherNode = workspace.translatedDiagram.nodes.find((node) => node.id === otherNodeId);
      if (otherNode?.type !== "attribute") {
        selectedEdgeIds.push(edge.id);
      }
    });
  } else if (selectedItem?.targetType === "generalization") {
    selectedEdgeIds.push(...(groupEdges.get(selectedItem.id) ?? []).map((edge) => edge.id));
  }

  selection.nodeIds.forEach((nodeId) => {
    if (!selectedNodeIds.includes(nodeId)) {
      selectedNodeIds.push(nodeId);
    }

    const node = workspace.translatedDiagram.nodes.find((candidate) => candidate.id === nodeId);
    workspace.translatedDiagram.edges.forEach((edge) => {
      const touchesNode = edge.sourceId === nodeId || edge.targetId === nodeId;
      if (!touchesNode) {
        return;
      }

      if (node?.type === "attribute") {
        const otherNodeId = edge.sourceId === nodeId ? edge.targetId : edge.sourceId;
        const otherNode = workspace.translatedDiagram.nodes.find((candidate) => candidate.id === otherNodeId);
        if (otherNode?.type === "attribute") {
          return;
        }
      }

      if (!selectedEdgeIds.includes(edge.id)) {
        selectedEdgeIds.push(edge.id);
      }
    });
  });

  selection.edgeIds.forEach((edgeId) => {
    if (!selectedEdgeIds.includes(edgeId)) {
      selectedEdgeIds.push(edgeId);
    }
  });

  return { pendingNodeIds, pendingEdgeIds, blockedNodeIds, blockedEdgeIds, selectedNodeIds, selectedEdgeIds };
}

function ToolbarIcon(props: { name: "undo" | "redo" | "reset" | "design" | "translate" | "export" | "save" | "fix" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg className="designer-toolbar-svg" viewBox="0 0 24 24" aria-hidden="true">
      {props.name === "undo" ? (
        <>
          <path {...common} d="M9 7H4v5" />
          <path {...common} d="M4.5 12A8 8 0 1 0 7 6.2" />
        </>
      ) : props.name === "redo" ? (
        <>
          <path {...common} d="M15 7h5v5" />
          <path {...common} d="M19.5 12A8 8 0 1 1 17 6.2" />
        </>
      ) : props.name === "reset" ? (
        <>
          <path {...common} d="M20 12a8 8 0 1 1-2.35-5.65" />
          <path {...common} d="M20 4v6h-6" />
        </>
      ) : props.name === "design" ? (
        <>
          <rect {...common} x="4" y="4" width="6" height="6" />
          <rect {...common} x="14" y="4" width="6" height="6" />
          <rect {...common} x="4" y="14" width="6" height="6" />
          <path {...common} d="M10 7h4M7 10v4M10 17h4M17 10v4" />
        </>
      ) : props.name === "translate" ? (
        <>
          <rect {...common} x="5" y="4" width="14" height="16" />
          <path {...common} d="M8 8h8M8 12h8M8 16h5" />
        </>
      ) : props.name === "export" ? (
        <>
          <path {...common} d="M12 3v11" />
          <path {...common} d="m8 10 4 4 4-4" />
          <path {...common} d="M5 17v3h14v-3" />
        </>
      ) : props.name === "save" ? (
        <>
          <path {...common} d="M5 4h12l2 2v14H5z" />
          <path {...common} d="M8 4v6h8V4" />
          <path {...common} d="M8 16h8v4H8z" />
        </>
      ) : (
        <>
          <path {...common} d="M7 7h10M7 12h10M7 17h6" />
          <path {...common} d="m16 16 2 2 4-5" />
        </>
      )}
    </svg>
  );
}

function ToolbarButton(props: {
  label: string;
  icon: ReactNode;
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
      <span className="designer-toolbar-icon" aria-hidden="true">{props.icon}</span>
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
  const highlights = useMemo(
    () => buildTranslationHighlights(props.workspace, selectedItem, props.selection),
    [props.workspace, selectedItem, props.selection],
  );
  const diagramIssues = useMemo(
    () => validateDiagram(props.workspace.translatedDiagram),
    [props.workspace.translatedDiagram],
  );
  const generalizationPending = overview.itemsByStep.generalizations.filter((item) => item.status === "pending").length;
  const attributePending = overview.itemsByStep["composite-attributes"].filter((item) => item.status === "pending").length;
  const blockedAttribute = selectedItem?.status === "blocked" ? selectedItem.blockedReason : undefined;
  const fixDisabled = !selectedItem || selectedItem.status === "blocked" || selectedChoices.length === 0;
  const fixTitle =
    blockedAttribute ?? (!selectedItem ? t("translation.restructuring.selectTarget") : undefined);
  const unavailableMessage = t("translation.restructuring.unavailable");
  const translateDisabled = !logicalAccess.allowed;
  const translateTitle = translateDisabled
    ? logicalAccess.reason ?? t("translation.restructuring.completeFirst")
    : undefined;

  return (
    <div className="designer-workspace designer-translation-view">
      <div className="designer-canvas-region designer-translation-canvas">
        <div className="designer-context-toolbar designer-translation-toolbar" role="toolbar" aria-label="Restructuring tools">
          <ToolbarButton label={t("translation.restructuring.undo")} icon={<ToolbarIcon name="undo" />} disabled={!props.canUndo} onClick={props.onUndo} />
          <ToolbarButton label={t("translation.restructuring.redo")} icon={<ToolbarIcon name="redo" />} disabled={!props.canRedo} onClick={props.onRedo} />
          <ToolbarButton label={t("translation.restructuring.reset")} icon={<ToolbarIcon name="reset" />} onClick={props.onResetTranslation} />
          <span className="designer-toolbar-separator" aria-hidden="true" />
          {selectedItem ? (
            <ToolbarButton
              label={t("translation.restructuring.fix")}
              icon={<ToolbarIcon name="fix" />}
              active={fixOpen}
              disabled={fixDisabled}
              title={fixTitle}
              onClick={() => setFixOpen((value) => !value)}
            />
          ) : null}
          <ToolbarButton label={t("translation.restructuring.design")} icon={<ToolbarIcon name="design" />} onClick={props.onOpenDesign} />
          <ToolbarButton
            label={t("translation.restructuring.translate")}
            icon={<ToolbarIcon name="translate" />}
            disabled={translateDisabled}
            title={translateTitle}
            onClick={props.onOpenLogical}
          />
          <span className="designer-toolbar-separator designer-toolbar-spacer" aria-hidden="true" />
          <ToolbarButton label={t("translation.restructuring.export")} icon={<ToolbarIcon name="export" />} onClick={props.onExportProject} />
          <ToolbarButton label={t("translation.restructuring.save")} icon={<ToolbarIcon name="save" />} onClick={props.onSaveRestructuredErs} />
        </div>

        <button
          type="button"
          className="designer-side-toggle designer-side-toggle-right designer-translation-notes-toggle"
          onClick={props.onToggleNotesPanel}
          title={props.notesPanelOpen ? "Chiudi note" : "Apri note"}
        >
          <span aria-hidden="true">N</span>
          {props.notesPanelOpen ? "Hide" : "Notes"}
        </button>

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

        <DiagramCanvas
          diagram={props.workspace.translatedDiagram}
          selection={props.selection}
          tool="select"
          mode="edit"
          viewport={props.viewport}
          issues={diagramIssues}
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
          onOpenInheritanceType={() => {}}
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
