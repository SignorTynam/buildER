import { InspectorPanel } from "../inspector/InspectorPanel";
import type {
  AttributeNode,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EntityNode,
  EditorMode,
  SelectionState,
  ToolKind,
  ValidationIssue,
} from "../types/diagram";
import { useI18n } from "../i18n/useI18n";
import { getToolDefinitions } from "../utils/toolConfig";

const PRIMARY_TOOLS: ToolKind[] = [
  "select",
  "move",
  "entity",
  "relationship",
  "attribute",
  "connector",
  "inheritance",
];

type ToolbarContext = "empty" | "node" | "edge" | "multi";

interface ToolbarProps {
  diagram: DiagramDocument;
  selection: SelectionState;
  activeTool: ToolKind;
  mode: EditorMode;
  collapsed: boolean;
  showPropertiesInspector?: boolean;
  selectionItemCount: number;
  issues: ValidationIssue[];
  selectedNode?: DiagramNode;
  selectedEdge?: DiagramEdge;
  onToolChange: (tool: ToolKind) => void;
  onDuplicateSelection: () => void;
  onDeleteSelection: () => void;
  onCreateAttributeForSelection: () => void;
  onEntityInternalIdentifiersChange: (
    entityId: string,
    patch: Partial<EntityNode>,
    attributePatches: Record<string, Partial<AttributeNode>>,
  ) => void;
  onEntityExternalIdentifiersChange: (entityId: string, patch: Partial<EntityNode>) => void;
  onRenameSelection: () => void;
  onNodeChange: (nodeId: string, patch: Partial<DiagramNode>) => void;
  onNodesChange: (nodeIds: string[], patch: Partial<DiagramNode>) => void;
  onEdgeChange: (edgeId: string, patch: Partial<DiagramEdge>) => void;
  onAlign: (axis: "left" | "center" | "top" | "middle") => void;
  onIssueSelect: (issue: ValidationIssue) => void;
  onToggleCollapse: () => void;
  onOpenTranslation: () => void;
  onExportSvg: () => void;
}

function ToolIcon({ tool }: { tool: ToolKind }) {
  if (tool === "select") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <path d="M5 4l7.6 14.8 1.8-5.4 5.6-1.9L5 4z" fill="currentColor" />
      </svg>
    );
  }

  if (tool === "move") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <path d="M12 3l2.6 2.6H13v3h-2v-3H9.4L12 3zm0 18l-2.6-2.6H11v-3h2v3h1.6L12 21zM3 12l2.6-2.6V11h3v2h-3v1.6L3 12zm18 0l-2.6 2.6V13h-3v-2h3V9.4L21 12z" fill="currentColor" />
      </svg>
    );
  }

  if (tool === "entity") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <rect x="4" y="6" width="16" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (tool === "relationship") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <polygon points="12,4 20,12 12,20 4,12" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (tool === "connector") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <path d="M5 8h6v8h8" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (tool === "inheritance") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <path d="M12 19V8" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8.5 11L12 7l3.5 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (tool === "attribute") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <circle cx="8" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <line x1="11.5" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
      <path d="M6 7h12M9 7V5h6v2M8 9l1 10h6l1-10" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function UtilityIcon({ kind }: { kind: "rename" | "delete" | "duplicate" | "connect" | "translate" | "export" | "identifier" | "multivalue" | "weak" }) {
  if (kind === "rename") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <path d="M4 20h4l10-10-4-4L4 16v4z" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M12 6l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "delete") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <path d="M6 7h12M9 7V5h6v2M8 9l1 10h6l1-10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "duplicate") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <rect x="8" y="8" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="4" y="4" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "connect") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <path d="M6 8h4v4h4v4h4" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="6" cy="8" r="1.5" fill="currentColor" />
        <circle cx="10" cy="12" r="1.5" fill="currentColor" />
        <circle cx="14" cy="16" r="1.5" fill="currentColor" />
        <circle cx="18" cy="16" r="1.5" fill="currentColor" />
      </svg>
    );
  }

  if (kind === "translate") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <path d="M5 7h10M10 4v3m0 0c0 4-2 7-5 9m5-9c1.2 2.7 3 5 6 7" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M15 10l4 10m-1.2-3h-5.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "export") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <path d="M12 4v10m0 0l-4-4m4 4l4-4M5 18h14" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "identifier") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <circle cx="15" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M13 11L5 19v3h3v-2h2v-2h2v-2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  if (kind === "multivalue") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
      <rect x="3" y="6" width="18" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <rect x="6.5" y="9" width="11" height="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function Toolbar(props: ToolbarProps) {
  const { t } = useI18n();
  const canEdit = props.mode === "edit";
  const toolDefinitions = getToolDefinitions();
  const visibleToolKinds = PRIMARY_TOOLS.includes(props.activeTool)
    ? PRIMARY_TOOLS
    : [...PRIMARY_TOOLS, props.activeTool];
  const availableTools = visibleToolKinds.reduce<typeof toolDefinitions>((result, tool) => {
    const match = toolDefinitions.find((item) => item.tool === tool);
    if (match) {
      result.push(match);
    }
    return result;
  }, []);
  const activeToolDefinition =
    toolDefinitions.find((item) => item.tool === props.activeTool) ??
    availableTools.find((item) => item.tool === props.activeTool);

  const context: ToolbarContext =
    props.selectionItemCount === 0
      ? "empty"
      : props.selectedNode
        ? "node"
        : props.selectedEdge
          ? "edge"
          : "multi";
  const selectionTargetIds = new Set([...props.selection.nodeIds, ...props.selection.edgeIds]);
  const selectionIssues = props.issues.filter((issue) => selectionTargetIds.has(issue.targetId));
  const visibleIssues = selectionIssues.length > 0 ? selectionIssues : props.issues.slice(0, 4);
  const showPropertiesInspector =
    props.showPropertiesInspector !== false && !props.collapsed && props.selectionItemCount > 0;

  function renderQuickButton(
    label: string,
    kind: Parameters<typeof UtilityIcon>[0]["kind"],
    onClick: () => void,
    options?: {
      active?: boolean;
      disabled?: boolean;
      title?: string;
    },
  ) {
    return (
      <button
        type="button"
        className={options?.active ? "toolbar-action-button active" : "toolbar-action-button"}
        onClick={onClick}
        disabled={options?.disabled}
        title={options?.title ?? label}
      >
        <UtilityIcon kind={kind} />
        <span className="tool-label">{label}</span>
      </button>
    );
  }

  function renderContextActions() {
    if (context === "empty") {
      return (
        <section className="toolbar-section toolbar-section-context">
          <div className="toolbar-list toolbar-list-tight">
            {renderQuickButton("Translate", "translate", props.onOpenTranslation, {
              disabled: false,
            })}
            {renderQuickButton("Export", "export", props.onExportSvg)}
          </div>
        </section>
      );
    }

    if (context === "node" && props.selectedNode) {
      if (props.selectedNode.type === "entity") {
        const entity = props.selectedNode;
        return (
          <section className="toolbar-section toolbar-section-context">
            <div className="toolbar-list toolbar-list-tight">
              {renderQuickButton("Attribute", "connect", props.onCreateAttributeForSelection, {
                disabled: !canEdit,
              })}
              {renderQuickButton("Connect", "connect", () => props.onToolChange("connector"), {
                active: props.activeTool === "connector",
                disabled: !canEdit,
              })}
              {renderQuickButton("Weak", "weak", () => props.onNodeChange(entity.id, { isWeak: !entity.isWeak }), {
                active: entity.isWeak === true,
                disabled: !canEdit,
              })}
              {renderQuickButton(t("common.actions.rename"), "rename", props.onRenameSelection, {
                disabled: !canEdit,
              })}
              {renderQuickButton(t("common.actions.delete"), "delete", props.onDeleteSelection, {
                disabled: !canEdit,
              })}
            </div>
          </section>
        );
      }

      if (props.selectedNode.type === "relationship") {
        return (
          <section className="toolbar-section toolbar-section-context">
            <div className="toolbar-list toolbar-list-tight">
              {renderQuickButton("Connect", "connect", () => props.onToolChange("connector"), {
                active: props.activeTool === "connector",
                disabled: !canEdit,
              })}
              {renderQuickButton("Attribute", "connect", props.onCreateAttributeForSelection, {
                disabled: !canEdit,
              })}
              {renderQuickButton(t("common.actions.rename"), "rename", props.onRenameSelection, {
                disabled: !canEdit,
              })}
              {renderQuickButton(t("common.actions.delete"), "delete", props.onDeleteSelection, {
                disabled: !canEdit,
              })}
            </div>
          </section>
        );
      }

      const attribute = props.selectedNode;
      const isLinkedToRel = props.diagram.edges.some((edge) => {
        if (edge.type !== "attribute") {
          return false;
        }

        const isLinked = edge.sourceId === attribute.id || edge.targetId === attribute.id;
        if (!isLinked) {
          return false;
        }

        const hostId = edge.sourceId === attribute.id ? edge.targetId : edge.sourceId;
        const hostNode = props.diagram.nodes.find((node) => node.id === hostId);
        return hostNode?.type === "relationship";
      });

      return (
        <section className="toolbar-section toolbar-section-context">
          <div className="toolbar-list toolbar-list-tight">
            {!attribute.isMultivalued && !attribute.isCompositeInternal
              ? renderQuickButton("Identifier", "identifier", () => props.onNodeChange(attribute.id, { isIdentifier: !attribute.isIdentifier }), {
                  active: attribute.isIdentifier === true,
                  disabled: !canEdit || isLinkedToRel,
                })
              : null}
            {!attribute.isIdentifier && !attribute.isCompositeInternal
              ? renderQuickButton("Multivalue", "multivalue", () => props.onNodeChange(attribute.id, { isMultivalued: !attribute.isMultivalued }), {
                  active: attribute.isMultivalued === true,
                  disabled: !canEdit,
                })
              : null}
            {renderQuickButton("To parent", "connect", () => props.onToolChange("connector"), {
              active: props.activeTool === "connector",
              disabled: !canEdit,
            })}
            {renderQuickButton(t("common.actions.rename"), "rename", props.onRenameSelection, {
              disabled: !canEdit,
            })}
            {renderQuickButton(t("common.actions.delete"), "delete", props.onDeleteSelection, {
              disabled: !canEdit,
            })}
          </div>
        </section>
      );
    }

    if (context === "edge") {
      return (
        <section className="toolbar-section toolbar-section-context">
          <div className="toolbar-list toolbar-list-tight">
            {renderQuickButton(t("common.actions.rename"), "rename", props.onRenameSelection, {
              disabled: !canEdit,
            })}
            {renderQuickButton(t("common.actions.delete"), "delete", props.onDeleteSelection, {
              disabled: !canEdit,
            })}
          </div>
        </section>
      );
    }

    return (
      <section className="toolbar-section toolbar-section-context">
        <div className="toolbar-list toolbar-list-tight">
          <button type="button" className="toolbar-action-button toolbar-action-button-text" onClick={() => props.onAlign("left")} disabled={!canEdit}>
            <span className="tool-label">{t("toolbar.actions.alignLeftShort")}</span>
          </button>
          <button type="button" className="toolbar-action-button toolbar-action-button-text" onClick={() => props.onAlign("center")} disabled={!canEdit}>
            <span className="tool-label">{t("toolbar.actions.alignCenterShort")}</span>
          </button>
          <button type="button" className="toolbar-action-button toolbar-action-button-text" onClick={() => props.onAlign("top")} disabled={!canEdit}>
            <span className="tool-label">{t("toolbar.actions.alignTopShort")}</span>
          </button>
          <button type="button" className="toolbar-action-button toolbar-action-button-text" onClick={() => props.onAlign("middle")} disabled={!canEdit}>
            <span className="tool-label">{t("toolbar.actions.alignMiddleShort")}</span>
          </button>
          {renderQuickButton(t("common.actions.duplicate"), "duplicate", props.onDuplicateSelection, {
            disabled: !canEdit,
          })}
          {renderQuickButton(t("common.actions.delete"), "delete", props.onDeleteSelection, {
            disabled: !canEdit,
          })}
        </div>
      </section>
    );
  }

  return (
    <aside
      className={
        props.collapsed
          ? `toolbar-panel contextual-toolbar collapsed toolbar-panel-context-${context}`
          : `toolbar-panel contextual-toolbar toolbar-panel-context-${context}`
      }
    >
      <div className="panel-head-row panel-head-row-compact">
        {props.collapsed ? (
          <div className="toolbar-collapsed-summary" aria-hidden="true">
            {props.selectionItemCount > 0 ? String(props.selectionItemCount) : activeToolDefinition?.shortcut.toUpperCase() ?? "T"}
          </div>
        ) : null}
        <button
          type="button"
          className="panel-toggle"
          onClick={props.onToggleCollapse}
          aria-label={props.collapsed ? t("toolbar.context.expandActions") : t("toolbar.context.collapseActions")}
          title={props.collapsed ? t("common.actions.expand") : t("common.actions.collapse")}
        >
          {props.collapsed ? ">" : "<"}
        </button>
      </div>

      <section className="toolbar-section toolbar-section-primary">
        <div className="toolbar-list toolbar-list-primary">
          {availableTools.map((item) => {
            const disabled = props.mode === "view" && item.tool !== "select" && item.tool !== "move";
            return (
              <button
                key={item.tool}
                type="button"
                className={props.activeTool === item.tool ? "tool-button active" : "tool-button"}
                onClick={() => props.onToolChange(item.tool)}
                disabled={disabled}
                title={`${item.label} (${item.shortcut.toUpperCase()})`}
                aria-label={item.label}
              >
                <ToolIcon tool={item.tool} />
                <span className="tool-label">{item.label}</span>
                <span className="tool-shortcut">{item.shortcut.toUpperCase()}</span>
              </button>
            );
          })}
        </div>
      </section>

      {renderContextActions()}

      {visibleIssues.length > 0 ? (
        <section className="toolbar-section toolbar-section-feedback">
          <div className="toolbar-issue-list">
            {visibleIssues.map((issue) => (
              <button
                key={issue.id}
                type="button"
                className={
                  issue.level === "error" ? "toolbar-issue-card toolbar-issue-card-error" : "toolbar-issue-card"
                }
                onClick={() => props.onIssueSelect(issue)}
              >
                <span className={issue.level === "error" ? "toolbar-issue-level error" : "toolbar-issue-level warning"}>
                  {issue.level === "error" ? "Error" : "Warn"}
                </span>
                <span className="toolbar-issue-message">{issue.message}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {showPropertiesInspector ? (
        <section className="toolbar-section toolbar-properties-shell toolbar-section-properties">
          <InspectorPanel
            embedded
            hideQuickActions
            diagram={props.diagram}
            selection={props.selection}
            mode={props.mode}
            issues={props.issues}
            onNodeChange={props.onNodeChange}
            onNodesChange={props.onNodesChange}
            onEdgeChange={props.onEdgeChange}
            onDeleteSelection={props.onDeleteSelection}
            onDuplicateSelection={props.onDuplicateSelection}
            onAlign={props.onAlign}
            onCreateAttributeForSelection={props.onCreateAttributeForSelection}
            onEntityInternalIdentifiersChange={props.onEntityInternalIdentifiersChange}
            onEntityExternalIdentifiersChange={props.onEntityExternalIdentifiersChange}
            onIssueSelect={props.onIssueSelect}
            onRenameSelection={props.onRenameSelection}
          />
        </section>
      ) : null}
    </aside>
  );
}
