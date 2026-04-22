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
  canUndo: boolean;
  canRedo: boolean;
  selectionItemCount: number;
  issues: ValidationIssue[];
  selectedNode?: DiagramNode;
  selectedEdge?: DiagramEdge;
  onToolChange: (tool: ToolKind) => void;
  onUndo: () => void;
  onRedo: () => void;
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

function ActionIcon({
  kind,
}: {
  kind: "rename" | "delete" | "duplicate" | "attribute" | "weak" | "identifier" | "multivalue";
}) {
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

  if (kind === "weak") {
    return (
      <svg viewBox="0 0 24 24" className="tool-icon" aria-hidden="true">
        <rect x="3" y="6" width="18" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <rect x="6.5" y="9" width="11" height="6" fill="none" stroke="currentColor" strokeWidth="1.8" />
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
      <circle cx="8" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <line x1="11.5" y1="12" x2="20" y2="12" stroke="currentColor" strokeWidth="1.8" />
      <line x1="15.5" y1="8" x2="15.5" y2="16" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function getAttributeHostLabel(
  selectedNode?: DiagramNode,
  selectionItemCount?: number,
  diagram?: DiagramDocument,
) {
  if (!selectedNode || selectedNode.type !== "attribute" || !diagram) {
    return null;
  }

  const attributeEdge = diagram.edges.find(
    (edge) => edge.type === "attribute" && (edge.sourceId === selectedNode.id || edge.targetId === selectedNode.id),
  );
  if (!attributeEdge) {
    return selectionItemCount && selectionItemCount > 1 ? null : null;
  }

  const hostId = attributeEdge.sourceId === selectedNode.id ? attributeEdge.targetId : attributeEdge.sourceId;
  const hostNode = diagram.nodes.find((node) => node.id === hostId);
  return hostNode?.label.toUpperCase() ?? null;
}

function getContextSummary(
  t: ReturnType<typeof useI18n>["t"],
  diagram: DiagramDocument,
  selectedNode: DiagramNode | undefined,
  selectedEdge: DiagramEdge | undefined,
  selectionItemCount: number,
): { title: string; subtitle: string } {
  if (selectedNode?.type === "entity") {
    return {
      title: t("toolbar.context.entitySelected"),
      subtitle: "Le azioni rapide restano sopra. Le proprieta e le regole ER di questa entita sono nel pannello sotto.",
    };
  }

  if (selectedNode?.type === "relationship") {
    return {
      title: t("toolbar.context.relationshipSelected"),
      subtitle: "Usa le azioni contestuali per intervenire subito e il pannello proprieta per dettagli e regole collegate.",
    };
  }

  if (selectedNode?.type === "attribute") {
    const hostLabel = getAttributeHostLabel(selectedNode, selectionItemCount, diagram);
    return {
      title: hostLabel ? t("toolbar.context.attributeOf", { label: hostLabel }) : t("toolbar.context.attributeSelected"),
      subtitle: "Il rail separa chiaramente azioni rapide e impostazioni dell'attributo per evitare competizione tra comandi e regole.",
    };
  }

  if (selectedEdge) {
    return {
      title: t("toolbar.context.edgeSelected"),
      subtitle: "Le azioni rapide modificano il link selezionato. Le proprieta del collegamento restano nella sezione dedicata sotto.",
    };
  }

  if (selectionItemCount > 1) {
    return {
      title: t("toolbar.context.multiSelection"),
      subtitle: "Allineamenti e pulizia della selezione restano contestuali, ma gli strumenti base non scompaiono piu.",
    };
  }

  return {
    title: t("toolbar.context.canvas"),
    subtitle: "Gli strumenti principali di modellazione restano sempre visibili. Seleziona un elemento per far comparire azioni rapide e proprieta.",
  };
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
  const contextSummary = getContextSummary(
    t,
    props.diagram,
    props.selectedNode,
    props.selectedEdge,
    props.selectionItemCount,
  );
  const selectionTargetIds = new Set([...props.selection.nodeIds, ...props.selection.edgeIds]);
  const selectionIssues = props.issues.filter((issue) => selectionTargetIds.has(issue.targetId));
  const visibleIssues = selectionIssues.length > 0 ? selectionIssues : context === "empty" ? props.issues.slice(0, 4) : [];
  const showPropertiesInspector = !props.collapsed;

  function renderContextActions() {
    if (context === "empty") {
      if (props.collapsed) {
        return null;
      }

      return (
        <section className="toolbar-section toolbar-section-context">
          <div className="toolbar-section-head">
            <div className="toolbar-section-label">{t("toolbar.sections.selectionActions")}</div>
            <span className="toolbar-section-meta">Contestuali</span>
          </div>
          <div className="toolbar-empty-hint">
            Seleziona un nodo o un collegamento per vedere comandi rapidi senza perdere gli strumenti base.
          </div>
        </section>
      );
    }

    if (context === "node") {
      return (
        <section className="toolbar-section toolbar-section-context">
          <div className="toolbar-section-head">
            <div className="toolbar-section-label">{t("toolbar.sections.selectionActions")}</div>
            <span className="toolbar-section-meta">Azioni rapide</span>
          </div>
          <div className="toolbar-list toolbar-list-tight">
            {props.selectedNode && props.selectedNode.type === "entity" ? (() => {
              const selectedEntity = props.selectedNode;
              return (
                <button
                  type="button"
                  className={selectedEntity.isWeak ? "toolbar-action-button active" : "toolbar-action-button"}
                  onClick={() => props.onNodeChange(selectedEntity.id, { isWeak: !selectedEntity.isWeak })}
                  disabled={!canEdit}
                  title={t("toolbar.actions.weakEntity")}
                >
                  <ActionIcon kind="weak" />
                  <span className="tool-label">{t("toolbar.actions.weakEntity")}</span>
                </button>
              );
            })() : null}
            {props.selectedNode && props.selectedNode.type === "attribute" ? (() => {
              const attrNode = props.selectedNode;
              const isLinkedToRel = props.diagram.edges.some((edge) => {
                if (edge.type !== "attribute") {
                  return false;
                }

                const isLinked = edge.sourceId === attrNode.id || edge.targetId === attrNode.id;
                if (!isLinked) {
                  return false;
                }

                const hostId = edge.sourceId === attrNode.id ? edge.targetId : edge.sourceId;
                const hostNode = props.diagram.nodes.find((node) => node.id === hostId);
                return hostNode?.type === "relationship";
              });

              return (
                <>
                  {!attrNode.isMultivalued && !attrNode.isCompositeInternal ? (
                    <button
                      type="button"
                      className={attrNode.isIdentifier ? "toolbar-action-button active" : "toolbar-action-button"}
                      onClick={() => props.onNodeChange(attrNode.id, { isIdentifier: !attrNode.isIdentifier })}
                      disabled={!canEdit || isLinkedToRel}
                      title={t("toolbar.actions.identifierAttribute")}
                    >
                      <ActionIcon kind="identifier" />
                      <span className="tool-label">{t("toolbar.actions.identifier")}</span>
                    </button>
                  ) : null}
                  {!attrNode.isIdentifier && !attrNode.isCompositeInternal ? (
                    <button
                      type="button"
                      className={attrNode.isMultivalued ? "toolbar-action-button active" : "toolbar-action-button"}
                      onClick={() => props.onNodeChange(attrNode.id, { isMultivalued: !attrNode.isMultivalued })}
                      disabled={!canEdit}
                      title={t("toolbar.actions.multivaluedAttribute")}
                    >
                      <ActionIcon kind="multivalue" />
                      <span className="tool-label">{t("toolbar.actions.multivalued")}</span>
                    </button>
                  ) : null}
                </>
              );
            })() : null}
            {props.selectedNode &&
            (props.selectedNode.type === "entity" ||
              props.selectedNode.type === "relationship" ||
              props.selectedNode.type === "attribute") ? (
              <button
                type="button"
                className="toolbar-action-button"
                onClick={props.onCreateAttributeForSelection}
                disabled={!canEdit}
                title={
                  props.selectedNode.type === "attribute"
                    ? t("toolbar.actions.addSubAttribute")
                    : t("toolbar.actions.addAttribute")
                }
              >
                <ActionIcon kind="attribute" />
                <span className="tool-label">
                  {props.selectedNode.type === "attribute"
                    ? t("toolbar.actions.subAttribute")
                    : t("toolbar.actions.addAttribute")}
                </span>
              </button>
            ) : null}
            <button
              type="button"
              className="toolbar-action-button"
              onClick={props.onRenameSelection}
              disabled={!canEdit}
              title={t("toolbar.actions.renameSelection")}
            >
              <ActionIcon kind="rename" />
              <span className="tool-label">{t("common.actions.rename")}</span>
            </button>
            <button
              type="button"
              className="toolbar-action-button"
              onClick={props.onDuplicateSelection}
              disabled={!canEdit}
              title={t("toolbar.actions.duplicateSelection")}
            >
              <ActionIcon kind="duplicate" />
              <span className="tool-label">{t("common.actions.duplicate")}</span>
            </button>
            <button
              type="button"
              className="toolbar-action-button"
              onClick={props.onDeleteSelection}
              disabled={!canEdit}
              title={t("toolbar.actions.deleteSelection")}
            >
              <ActionIcon kind="delete" />
              <span className="tool-label">{t("common.actions.delete")}</span>
            </button>
          </div>
        </section>
      );
    }

    if (context === "edge") {
      return (
        <section className="toolbar-section toolbar-section-context">
          <div className="toolbar-section-head">
            <div className="toolbar-section-label">{t("toolbar.sections.edgeActions")}</div>
            <span className="toolbar-section-meta">Azioni rapide</span>
          </div>
          <div className="toolbar-list toolbar-list-tight">
            <button
              type="button"
              className="toolbar-action-button"
              onClick={props.onRenameSelection}
              disabled={!canEdit}
              title={t("toolbar.actions.renameEdge")}
            >
              <ActionIcon kind="rename" />
              <span className="tool-label">{t("common.actions.rename")}</span>
            </button>
            <button
              type="button"
              className="toolbar-action-button"
              onClick={props.onDuplicateSelection}
              disabled={!canEdit}
              title={t("toolbar.actions.duplicateEdge")}
            >
              <ActionIcon kind="duplicate" />
              <span className="tool-label">{t("common.actions.duplicate")}</span>
            </button>
            <button
              type="button"
              className="toolbar-action-button"
              onClick={props.onDeleteSelection}
              disabled={!canEdit}
              title={t("toolbar.actions.deleteEdge")}
            >
              <ActionIcon kind="delete" />
              <span className="tool-label">{t("common.actions.delete")}</span>
            </button>
          </div>
        </section>
      );
    }

    return (
      <section className="toolbar-section toolbar-section-context">
        <div className="toolbar-section-head">
          <div className="toolbar-section-label">{t("toolbar.sections.multiActions")}</div>
          <span className="toolbar-section-meta">Selezione multipla</span>
        </div>
        <div className="toolbar-list toolbar-list-tight">
          {!props.collapsed ? (
            <>
              <button
                type="button"
                className="toolbar-action-button toolbar-action-button-text"
                onClick={() => props.onAlign("left")}
                disabled={!canEdit}
                title={t("toolbar.actions.alignLeft")}
              >
                <span className="tool-label">{t("toolbar.actions.alignLeftShort")}</span>
              </button>
              <button
                type="button"
                className="toolbar-action-button toolbar-action-button-text"
                onClick={() => props.onAlign("center")}
                disabled={!canEdit}
                title={t("toolbar.actions.alignCenter")}
              >
                <span className="tool-label">{t("toolbar.actions.alignCenterShort")}</span>
              </button>
              <button
                type="button"
                className="toolbar-action-button toolbar-action-button-text"
                onClick={() => props.onAlign("top")}
                disabled={!canEdit}
                title={t("toolbar.actions.alignTop")}
              >
                <span className="tool-label">{t("toolbar.actions.alignTopShort")}</span>
              </button>
              <button
                type="button"
                className="toolbar-action-button toolbar-action-button-text"
                onClick={() => props.onAlign("middle")}
                disabled={!canEdit}
                title={t("toolbar.actions.alignMiddle")}
              >
                <span className="tool-label">{t("toolbar.actions.alignMiddleShort")}</span>
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="toolbar-action-button"
            onClick={props.onDuplicateSelection}
            disabled={!canEdit}
            title={t("toolbar.actions.duplicateSelection")}
          >
            <ActionIcon kind="duplicate" />
            <span className="tool-label">{t("common.actions.duplicate")}</span>
          </button>
          <button
            type="button"
            className="toolbar-action-button"
            onClick={props.onDeleteSelection}
            disabled={!canEdit}
            title={t("toolbar.actions.deleteSelection")}
          >
            <ActionIcon kind="delete" />
            <span className="tool-label">{t("common.actions.delete")}</span>
          </button>
        </div>
      </section>
    );
  }

  function renderIssuesSection() {
    if (visibleIssues.length === 0) {
      if (props.collapsed) {
        return null;
      }

      return (
        <section className="toolbar-section toolbar-section-feedback">
          <div className="toolbar-section-head">
            <div className="toolbar-section-label">Regole ER</div>
            <span className="toolbar-section-meta">Verifica</span>
          </div>
          <div className="toolbar-empty-hint">
            Nessun warning contestuale visibile. Le regole e i vincoli della selezione restano sotto, nel pannello proprieta.
          </div>
        </section>
      );
    }

    return (
      <section className="toolbar-section toolbar-section-feedback">
        <div className="toolbar-section-head">
          <div className="toolbar-section-label">Regole ER</div>
          <span className="toolbar-section-meta">{visibleIssues.length}</span>
        </div>
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
                {issue.level === "error" ? "Errore" : "Avviso"}
              </span>
              <span className="toolbar-issue-message">{issue.message}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <aside
      className={
        props.collapsed
          ? `toolbar-panel collapsed toolbar-panel-context-${context}`
          : `toolbar-panel toolbar-panel-context-${context}`
      }
    >
      <div className={props.collapsed ? "panel-head-row panel-head-row-compact" : "panel-head-row"}>
        {!props.collapsed ? (
          <div>
            <div className="panel-heading">{contextSummary.title}</div>
            <p className="panel-subheading">{contextSummary.subtitle}</p>
          </div>
        ) : (
          <div className="toolbar-collapsed-summary" aria-hidden="true">
            {props.selectionItemCount > 0 ? String(props.selectionItemCount) : activeToolDefinition?.shortcut.toUpperCase() ?? "T"}
          </div>
        )}
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

      {!props.collapsed ? (
        <section className="toolbar-section toolbar-section-banner toolbar-section-status">
          <div className="toolbar-context-banner">
            <span className="toolbar-context-badge">
              {activeToolDefinition?.label ?? props.activeTool}
            </span>
            <div>
              <strong>{contextSummary.title}</strong>
              <p>
                Strumenti di base sempre disponibili. Azioni rapide al centro, proprieta e regole ER nella sezione finale.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="toolbar-section toolbar-section-primary">
        <div className="toolbar-section-head">
          <div className="toolbar-section-label">{t("toolbar.sections.tools")}</div>
          {!props.collapsed ? (
            <span className="toolbar-section-meta">
              {activeToolDefinition ? `${activeToolDefinition.label} - ${activeToolDefinition.shortcut.toUpperCase()}` : props.activeTool}
            </span>
          ) : null}
        </div>
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
      {renderIssuesSection()}

      {showPropertiesInspector ? (
        <section className="toolbar-section toolbar-properties-shell toolbar-section-properties">
          <div className="toolbar-section-head">
            <div className="toolbar-section-label">Proprieta e regole</div>
            <span className="toolbar-section-meta">Punto principale di modifica</span>
          </div>
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
