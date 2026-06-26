import type {
  AttributeNode,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EntityNode,
  EntityRelationshipParticipation,
  GeneralizationGroup,
  EditorMode,
  IsaCompleteness,
  IsaDisjointness,
  SelectionState,
  ValidationIssue,
} from "../types/diagram";
import {
  CONNECTOR_CARDINALITIES,
  CONNECTOR_CARDINALITY_PLACEHOLDER,
  getAttributeCardinalityOwner,
  getConnectorParticipation,
  getConnectorParticipationContext,
  normalizeSupportedCardinality,
} from "../utils/cardinality";
import {
  assignInheritanceConstraintToGroup,
  canAttributeHaveCardinality,
  deleteGeneralizationGroup,
  getGeneralizationGroupForEdge,
  getGeneralizationGroupsForSupertype,
  removeSubtypeFromGeneralizationGroup,
  updateGeneralizationGroupConstraint,
} from "../utils/diagram";
import { ExternalIdentifierSection } from "./ExternalIdentifierSection";
import { InternalIdentifierSection } from "./InternalIdentifierSection";
import { PanelCard, PanelShell } from "../components/panels";
import type { I18nContextValue } from "../i18n/I18nProvider";
import { useI18n } from "../i18n/useI18n";

interface InspectorPanelProps {
  diagram: DiagramDocument;
  selection: SelectionState;
  mode: EditorMode;
  issues: ValidationIssue[];
  collapsed?: boolean;
  embedded?: boolean;
  hideQuickActions?: boolean;
  onStatusMessageChange?: (message: string) => void;
  onNodeChange: (nodeId: string, patch: Partial<DiagramNode>) => void;
  onNodesChange: (nodeIds: string[], patch: Partial<DiagramNode>) => void;
  onEdgeChange: (edgeId: string, patch: Partial<DiagramEdge>) => void;
  onDiagramChange: (diagram: DiagramDocument) => void;
  onDeleteSelection: () => void;
  onDuplicateSelection: () => void;
  onAlign: (axis: "left" | "center" | "top" | "middle") => void;
  onCreateAttributeForSelection: () => void;
  onEntityInternalIdentifiersChange: (
    entityId: string,
    patch: Partial<EntityNode>,
    attributePatches: Record<string, Partial<AttributeNode>>,
  ) => void;
  onEntityExternalIdentifiersChange: (entityId: string, patch: Partial<EntityNode>) => void;
  onIssueSelect: (issue: ValidationIssue) => void;
  onRenameSelection: () => void;
  onToggleCollapse?: () => void;
}

function findDirectAttributeHost(diagram: DiagramDocument, attributeId: string): DiagramNode | undefined {
  const attributeEdge = diagram.edges.find(
    (edge) => edge.type === "attribute" && (edge.sourceId === attributeId || edge.targetId === attributeId),
  );
  if (!attributeEdge) {
    return undefined;
  }

  const hostId = attributeEdge.sourceId === attributeId ? attributeEdge.targetId : attributeEdge.sourceId;
  return diagram.nodes.find((node) => node.id === hostId);
}

function getSelectionHeading(
  t: I18nContextValue["t"],
  selectedNode?: DiagramNode,
  selectedEdge?: DiagramEdge,
  selectionCount = 0,
): { title: string; subtitle: string } {
  if (selectedNode?.type === "entity") {
    return {
      title: t("inspector.heading.entity.title"),
      subtitle: t("inspector.heading.entity.subtitle"),
    };
  }

  if (selectedNode?.type === "relationship") {
    return {
      title: t("inspector.heading.relationship.title"),
      subtitle: t("inspector.heading.relationship.subtitle"),
    };
  }

  if (selectedNode?.type === "attribute") {
    return {
      title: t("inspector.heading.attribute.title"),
      subtitle: t("inspector.heading.attribute.subtitle"),
    };
  }

  if (selectedEdge) {
    return {
      title: t("inspector.heading.edge.title"),
      subtitle: t("inspector.heading.edge.subtitle"),
    };
  }

  if (selectionCount > 1) {
    return {
      title: t("inspector.heading.multiSelection.title"),
      subtitle: t("inspector.heading.multiSelection.subtitle"),
    };
  }

  return {
    title: t("inspector.heading.canvas.title"),
    subtitle: t("inspector.heading.canvas.subtitle"),
  };
}

const ISA_CONSTRAINT_OPTIONS: Array<{
  value: string;
  completeness: IsaCompleteness;
  disjointness: IsaDisjointness;
  labelKey: Parameters<I18nContextValue["t"]>[0];
}> = [
  { value: "t,e", completeness: "total", disjointness: "disjoint", labelKey: "inspector.isa.constraints.totalDisjoint" },
  { value: "t,o", completeness: "total", disjointness: "overlap", labelKey: "inspector.isa.constraints.totalOverlap" },
  { value: "p,e", completeness: "partial", disjointness: "disjoint", labelKey: "inspector.isa.constraints.partialDisjoint" },
  { value: "p,o", completeness: "partial", disjointness: "overlap", labelKey: "inspector.isa.constraints.partialOverlap" },
];

function formatIsaConstraint(
  completeness: IsaCompleteness | undefined,
  disjointness: IsaDisjointness | undefined,
  t: I18nContextValue["t"],
): string {
  if (!completeness || !disjointness) {
    return t("inspector.isa.missingConstraint");
  }
  return `(${completeness === "total" ? "t" : "p"},${disjointness === "disjoint" ? "e" : "o"})`;
}

function parseIsaConstraint(value: string): { completeness: IsaCompleteness; disjointness: IsaDisjointness } {
  const [completeness, disjointness] = value.split(",");
  return {
    completeness: completeness === "t" ? "total" : "partial",
    disjointness: disjointness === "o" ? "overlap" : "disjoint",
  };
}

export function InspectorPanel(props: InspectorPanelProps) {
  const { t } = useI18n();
  const isEmbedded = props.embedded === true;
  const showQuickActions = props.hideQuickActions !== true && !isEmbedded;
  const isCollapsed = props.collapsed === true && !isEmbedded;
  const canEdit = true;
  const selectedNodeCount = props.selection.nodeIds.length;
  const selectedEdgeCount = props.selection.edgeIds.length;
  const selectionCount = selectedNodeCount + selectedEdgeCount;
  const canAlign = canEdit && selectedNodeCount >= 2;

  const selectedNode =
    selectedNodeCount === 1 && selectedEdgeCount === 0
      ? props.diagram.nodes.find((node) => node.id === props.selection.nodeIds[0])
      : undefined;
  const selectedEdge =
    selectedEdgeCount === 1 && selectedNodeCount === 0
      ? props.diagram.edges.find((edge) => edge.id === props.selection.edgeIds[0])
      : undefined;

  const attributeHost =
    selectedNode?.type === "attribute" ? findDirectAttributeHost(props.diagram, selectedNode.id) : undefined;
  const selectedAttributeEntityHost =
    selectedNode?.type === "attribute" && attributeHost?.type === "entity" ? attributeHost : undefined;
  const selectedAttributeIsInternalIdentifier =
    selectedNode?.type === "attribute" &&
    selectedAttributeEntityHost !== undefined &&
    (
      selectedNode.isCompositeInternal === true ||
      (selectedAttributeEntityHost.internalIdentifiers ?? []).some((identifier) =>
        identifier.attributeIds.includes(selectedNode.id),
      )
    );
  const selectedAttributeCanHaveCardinality =
    selectedNode?.type === "attribute" ? canAttributeHaveCardinality(props.diagram, selectedNode) : false;

  const heading = getSelectionHeading(t, selectedNode, selectedEdge, selectionCount);
  const isIdleContext = selectionCount === 0;
  const canRenameCurrentSelection = selectedNode !== undefined || selectedEdge?.type === "inheritance";

  function assignConstraint(edgeId: string, value: string) {
    const { completeness, disjointness } = parseIsaConstraint(value);
    props.onDiagramChange(assignInheritanceConstraintToGroup(props.diagram, edgeId, completeness, disjointness));
  }

  function updateGroupConstraint(groupId: string, value: string) {
    const { completeness, disjointness } = parseIsaConstraint(value);
    const nextDiagram = updateGeneralizationGroupConstraint(props.diagram, groupId, completeness, disjointness);
    const previousCount = props.diagram.generalizationGroups?.length ?? 0;
    const nextCount = nextDiagram.generalizationGroups?.length ?? 0;
    const stillExists = nextDiagram.generalizationGroups?.some((group) => group.id === groupId) ?? false;
    if (props.onStatusMessageChange && !stillExists && nextCount < previousCount) {
      props.onStatusMessageChange(t("inspector.isa.mergedStatus"));
    }
    props.onDiagramChange(nextDiagram);
  }

  function renderGroupSummary(group: GeneralizationGroup, currentSubtypeId?: string) {
    const subtypes = group.subtypeIds
      .map((subtypeId) => props.diagram.nodes.find((node) => node.id === subtypeId))
      .filter((node): node is EntityNode => node?.type === "entity");
    const value = `${group.isaCompleteness === "total" ? "t" : "p"},${group.isaDisjointness === "overlap" ? "o" : "e"}`;

    return (
      <div key={group.id} className="context-card-list">
        <strong>{group.label ?? t("inspector.isa.groupFallback", { constraint: formatIsaConstraint(group.isaCompleteness, group.isaDisjointness, t) })}</strong>
        <span>{formatIsaConstraint(group.isaCompleteness, group.isaDisjointness, t)}</span>
        <label className="field">
          <span>{t("inspector.isa.editConstraint")}</span>
          <select value={value} disabled={!canEdit} onChange={(event) => updateGroupConstraint(group.id, event.target.value)}>
            {ISA_CONSTRAINT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </label>
        {subtypes.map((subtype) => (
          <div key={subtype.id} className="context-row">
            <span>{subtype.label}</span>
            <button
              type="button"
              disabled={!canEdit}
              onClick={() => props.onDiagramChange(removeSubtypeFromGeneralizationGroup(props.diagram, group.id, subtype.id))}
            >
              {currentSubtypeId === subtype.id ? t("inspector.isa.detachFromGroup") : t("inspector.isa.removeSubtype")}
            </button>
          </div>
        ))}
        {subtypes.length === 0 ? <span>{t("inspector.isa.noSubtypes")}</span> : null}
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => props.onDiagramChange(deleteGeneralizationGroup(props.diagram, group.id))}
        >
          {t("inspector.isa.deleteGroup")}
        </button>
      </div>
    );
  }

  function renderEntityGeneralizations(entity: EntityNode) {
    const supertypeGroups = getGeneralizationGroupsForSupertype(props.diagram, entity.id);
    const subtypeEdges = props.diagram.edges.filter(
      (edge): edge is Extract<DiagramEdge, { type: "inheritance" }> => edge.type === "inheritance" && edge.sourceId === entity.id,
    );

    return (
      <>
        <section className="context-card">
          <div className="context-card-title">{t("inspector.isa.hierarchies")}</div>
          <div className="inspector-stack">
            {supertypeGroups.length > 0
              ? supertypeGroups.map((group) => renderGroupSummary(group))
              : <p className="action-hint">{t("inspector.isa.noSupertypeGroups")}</p>}
          </div>
        </section>
        {subtypeEdges.length > 0 ? (
          <section className="context-card">
            <div className="context-card-title">{t("inspector.isa.subtypeParticipation")}</div>
            <div className="inspector-stack">
              {subtypeEdges.map((edge) => {
                const parent = props.diagram.nodes.find((node) => node.id === edge.targetId);
                const group = getGeneralizationGroupForEdge(props.diagram, edge.id);
                return (
                  <div key={edge.id} className="context-card-list">
                    <strong>{parent?.label ?? edge.targetId}</strong>
                    <span>{group ? formatIsaConstraint(group.isaCompleteness, group.isaDisjointness, t) : t("inspector.isa.unconfiguredHierarchy")}</span>
                    {group ? (
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => props.onDiagramChange(removeSubtypeFromGeneralizationGroup(props.diagram, group.id, entity.id))}
                      >
                        {t("inspector.isa.detachFromGroup")}
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
      </>
    );
  }

  if (isCollapsed) {
    if (isIdleContext) {
      return (
        <PanelShell className="inspector-panel collapsed inspector-panel-idle" ariaLabel={t("inspector.panel.contextPanel")} collapsed>
          <div className="panel-head-row panel-head-row-compact">
            <button
              type="button"
              className="panel-toggle"
              onClick={props.onToggleCollapse}
              aria-label={t("inspector.panel.expandContextPanel")}
              title={t("common.actions.expand")}
            >
              {"<"}
            </button>
          </div>
        </PanelShell>
      );
    }

    return (
      <PanelShell className="inspector-panel collapsed" ariaLabel={t("inspector.panel.contextPanel")} collapsed>
        <div className="panel-head-row panel-head-row-compact">
          <button
            type="button"
            className="panel-toggle"
            onClick={props.onToggleCollapse}
            aria-label={t("inspector.panel.expandContextPanel")}
            title={t("common.actions.expand")}
          >
            {"<"}
          </button>
        </div>

        <div className="inspector-compact-stack">
          <div className="inspector-compact-card">
            <strong>{heading.title}</strong>
            <span>{t("inspector.panel.compactSelectionCount", { count: selectionCount })}</span>
          </div>
        </div>
      </PanelShell>
    );
  }

  function renderSelectionActions() {
    if (!showQuickActions) {
      return null;
    }

    return (
      <section className="context-card">
        <div className="context-card-title">{t("inspector.quickActions.title")}</div>
        <div className="action-grid">
          {selectedNode && (selectedNode.type === "entity" || selectedNode.type === "relationship" || selectedNode.type === "attribute") ? (
            <button type="button" onClick={props.onCreateAttributeForSelection} disabled={!canEdit}>
              {selectedNode.type === "attribute" ? t("inspector.quickActions.addSubAttribute") : t("inspector.quickActions.addAttribute")}
            </button>
          ) : null}
          {canRenameCurrentSelection ? (
            <button type="button" onClick={props.onRenameSelection} disabled={!canEdit}>
              {t("inspector.quickActions.rename")}
            </button>
          ) : null}
          {selectionCount > 0 ? (
            <button type="button" onClick={props.onDuplicateSelection} disabled={!canEdit}>
              {t("inspector.quickActions.duplicate")}
            </button>
          ) : null}
          {selectionCount > 0 ? (
            <button type="button" onClick={props.onDeleteSelection} disabled={!canEdit}>
              {t("inspector.quickActions.delete")}
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  function renderMultiSelection() {
    return (
      <>
        {showQuickActions ? (
          <section className="context-card">
            <div className="context-card-title">{t("inspector.multiSelection.title")}</div>
            <div className="action-grid">
              <button type="button" onClick={() => props.onAlign("left")} disabled={!canAlign}>
                {t("inspector.multiSelection.alignLeft")}
              </button>
              <button type="button" onClick={() => props.onAlign("center")} disabled={!canAlign}>
                {t("inspector.multiSelection.alignCenter")}
              </button>
              <button type="button" onClick={() => props.onAlign("top")} disabled={!canAlign}>
                {t("inspector.multiSelection.alignTop")}
              </button>
              <button type="button" onClick={() => props.onAlign("middle")} disabled={!canAlign}>
                {t("inspector.multiSelection.alignMiddle")}
              </button>
              <button type="button" onClick={props.onDuplicateSelection} disabled={!canEdit}>
                {t("inspector.multiSelection.duplicateSelection")}
              </button>
              <button type="button" onClick={props.onDeleteSelection} disabled={!canEdit}>
                {t("inspector.multiSelection.deleteSelection")}
              </button>
            </div>
            {!canAlign ? <p className="action-hint">{t("inspector.multiSelection.needTwoNodes")}</p> : null}
          </section>
        ) : null}
      </>
    );
  }

  function renderNodeContext(node: DiagramNode) {
    if (node.type === "entity") {
      type EntityParticipationRow = {
        edge: Extract<DiagramEdge, { type: "connector" }>;
        relationship: Extract<DiagramNode, { type: "relationship" }>;
        participationId: string | undefined;
        cardinality: EntityRelationshipParticipation["cardinality"];
        duplicateCount: number;
      };

      const connectorRows = props.diagram.edges
        .filter((edge): edge is Extract<DiagramEdge, { type: "connector" }> => edge.type === "connector")
        .map((edge) => {
          const sourceNode = props.diagram.nodes.find((candidate) => candidate.id === edge.sourceId);
          const targetNode = props.diagram.nodes.find((candidate) => candidate.id === edge.targetId);
          const context = getConnectorParticipationContext(sourceNode, targetNode);
          if (!context || context.entity.id !== node.id) {
            return null;
          }

          const sameRelationshipEdges = props.diagram.edges.filter(
            (candidate) =>
              candidate.type === "connector" &&
              candidate.id !== edge.id &&
              ((candidate.sourceId === node.id &&
                candidate.targetId === context.relationship.id) ||
                (candidate.targetId === node.id && candidate.sourceId === context.relationship.id)),
          ).length;

          return {
            edge,
            relationship: context.relationship,
            participationId: edge.participationId,
            cardinality:
              node.relationshipParticipations?.find((participation) => participation.id === edge.participationId)
                ?.cardinality,
            duplicateCount: sameRelationshipEdges,
          };
        })
        .filter((row): row is EntityParticipationRow => row !== null);

      return (
        <>
          <section className="context-card">
            <div className="context-card-title">{t("inspector.entity.settings")}</div>
            <div className="inspector-stack">
              <label className="field">
                <span>{t("inspector.entity.name")}</span>
                <input
                  value={node.label}
                  disabled={!canEdit}
                  onChange={(event) => props.onNodeChange(node.id, { label: event.target.value })}
                />
              </label>
              {connectorRows.length > 0 ? (
                connectorRows.map((row, index) => (
                  <label key={row.edge.id} className="field">
                    <span>
                      {t("inspector.entity.cardinalityForRelationship", { relationship: row.relationship.label })}
                      {row.duplicateCount > 0 ? ` #${index + 1}` : ""}
                    </span>
                    <select
                      value={row.cardinality ?? CONNECTOR_CARDINALITY_PLACEHOLDER}
                      disabled={!canEdit || !row.participationId}
                      onChange={(event) =>
                        props.onNodeChange(node.id, {
                          relationshipParticipations: (node.relationshipParticipations ?? []).map((participation) =>
                            participation.id === row.participationId
                              ? {
                                  ...participation,
                                  cardinality: normalizeSupportedCardinality(
                                    event.target.value === CONNECTOR_CARDINALITY_PLACEHOLDER
                                      ? undefined
                                      : event.target.value,
                                  ),
                                }
                              : participation,
                          ),
                        })
                      }
                    >
                      <option value={CONNECTOR_CARDINALITY_PLACEHOLDER}>{t("inspector.entity.selectCardinality")}</option>
                      {CONNECTOR_CARDINALITIES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                ))
              ) : (
                <p className="action-hint">{t("inspector.entity.noParticipations")}</p>
              )}
            </div>
          </section>
          <InternalIdentifierSection
            entity={node}
            diagram={props.diagram}
            readOnly={!canEdit}
            onEntityChange={props.onEntityInternalIdentifiersChange}
          />
          {renderEntityGeneralizations(node)}
          <ExternalIdentifierSection
            entity={node}
            diagram={props.diagram}
            readOnly={!canEdit}
            onEntityChange={props.onEntityExternalIdentifiersChange}
          />
          {renderSelectionActions()}
        </>
      );
    }

    if (node.type === "relationship") {
      return (
        <>
          <section className="context-card">
            <div className="context-card-title">{t("inspector.relationship.status")}</div>
            <p className="action-hint">
              {t("inspector.relationship.externalIdentifiersManagedOnHost")}
            </p>
          </section>
          {renderSelectionActions()}
        </>
      );
    }

    if (node.type === "attribute") {
      return (
        <>
          <section className="context-card">
            <div className="context-card-title">{t("inspector.attribute.settings")}</div>
            <div className="inspector-stack">
              <label className="field">
                <span>{t("inspector.attribute.name")}</span>
                <input
                  value={node.label}
                  disabled={!canEdit}
                  onChange={(event) => props.onNodeChange(node.id, { label: event.target.value })}
                />
              </label>
              <label className="field">
                <span>{t("inspector.attribute.cardinality")}</span>
                <select
                  value={node.cardinality ?? ""}
                  disabled={!canEdit || !selectedAttributeCanHaveCardinality}
                  onChange={(event) =>
                    props.onNodeChange(node.id, {
                      cardinality: normalizeSupportedCardinality(event.target.value || undefined),
                    })
                  }
                >
                  <option value="">{t("inspector.attribute.noCardinality")}</option>
                  {CONNECTOR_CARDINALITIES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
          {selectedAttributeIsInternalIdentifier ? (
            <section className="context-card">
              <div className="context-card-title">{t("inspector.attribute.status")}</div>
              <p className="action-hint">{t("inspector.attribute.internalIdentifierNotice")}</p>
            </section>
          ) : null}
          {!selectedAttributeCanHaveCardinality && !selectedAttributeIsInternalIdentifier ? (
            <section className="context-card">
              <div className="context-card-title">{t("inspector.attribute.status")}</div>
              <p className="action-hint">{t("inspector.attribute.identifierNotice")}</p>
            </section>
          ) : null}
          {renderSelectionActions()}
        </>
      );
    }

    return renderSelectionActions();
  }

  function renderEdgeContext(edge: DiagramEdge) {
    const sourceNode = props.diagram.nodes.find((node) => node.id === edge.sourceId);
    const targetNode = props.diagram.nodes.find((node) => node.id === edge.targetId);
    const attributeOwner =
      edge.type === "attribute" ? getAttributeCardinalityOwner(sourceNode, targetNode) : undefined;
    const connectorContext =
      edge.type === "connector" ? getConnectorParticipationContext(sourceNode, targetNode) : undefined;
    const connectorParticipation =
      edge.type === "connector" ? getConnectorParticipation(edge, sourceNode, targetNode) : undefined;
    const connectorParticipationId =
      edge.type === "connector" ? edge.participationId ?? `participation-${edge.id}` : undefined;

    function updateConnectorRole(value: string) {
      if (edge.type !== "connector" || !connectorContext || !connectorParticipationId) {
        return;
      }

      const normalizedRole = value.trim().length > 0 ? value : undefined;
      const nextNodes = props.diagram.nodes.map((node) => {
        if (node.id !== connectorContext.entity.id || node.type !== "entity") {
          return node;
        }

        const participations = node.relationshipParticipations ?? [];
        const existing = participations.find((participation) => participation.id === connectorParticipationId);
        return {
          ...node,
          relationshipParticipations: existing
            ? participations.map((participation) =>
                participation.id === connectorParticipationId
                  ? {
                      ...participation,
                      relationshipId: connectorContext.relationship.id,
                      role: normalizedRole,
                    }
                  : participation,
              )
            : [
                ...participations,
                {
                  id: connectorParticipationId,
                  relationshipId: connectorContext.relationship.id,
                  role: normalizedRole,
                },
              ],
        };
      });
      const nextEdges = props.diagram.edges.map((candidate) =>
        candidate.id === edge.id && candidate.type === "connector" && candidate.participationId !== connectorParticipationId
          ? { ...candidate, participationId: connectorParticipationId }
          : candidate,
      );

      props.onDiagramChange({
        ...props.diagram,
        nodes: nextNodes,
        edges: nextEdges,
      });
    }

    return (
      <>
        <section className="context-card">
          <div className="context-card-title">{t("inspector.edge.settings")}</div>
          <div className="inspector-stack">
            {edge.type === "connector" && connectorContext ? (
              <p className="action-hint">
                {t("inspector.edge.connectorCardinalityManagedOnEntity", { entity: connectorContext.entity.label })}
              </p>
            ) : null}

            {edge.type === "connector" && connectorContext ? (
              <label className="field">
                <span>{t("inspector.edge.role")}</span>
                <input
                  value={connectorParticipation?.role ?? ""}
                  disabled={!canEdit}
                  onChange={(event) => updateConnectorRole(event.target.value)}
                />
              </label>
            ) : null}

            {edge.type === "attribute" && attributeOwner ? (
              <p className="action-hint">
                {t("inspector.edge.attributeCardinalityManagedOnAttribute", { attribute: attributeOwner.label })}
              </p>
            ) : null}

            {edge.type === "attribute" && !attributeOwner ? (
              <p className="action-hint">
                {t("inspector.edge.attributeOwnerMissing")}
              </p>
            ) : null}

            {edge.type === "inheritance" ? (
              (() => {
                const group = getGeneralizationGroupForEdge(props.diagram, edge.id);
                const currentValue =
                  group?.isaCompleteness && group.isaDisjointness
                    ? `${group.isaCompleteness === "total" ? "t" : "p"},${group.isaDisjointness === "overlap" ? "o" : "e"}`
                    : "t,e";
                return group ? (
                  <>
                    <p className="action-hint">
                      {t("inspector.isa.branchBelongsToGroup", { constraint: formatIsaConstraint(group.isaCompleteness, group.isaDisjointness, t) })}
                    </p>
                    {renderGroupSummary(group, edge.sourceId)}
                  </>
                ) : (
                  <>
                    <div className="context-card-title">{t("inspector.isa.unconfiguredHierarchy")}</div>
                    <p className="action-hint">
                      {t("inspector.isa.childParentSummary", { child: sourceNode?.label ?? edge.sourceId, parent: targetNode?.label ?? edge.targetId })}
                    </p>
                    <label className="field">
                      <span>{t("inspector.isa.constraint")}</span>
                      <select
                        value={currentValue}
                        disabled={!canEdit}
                        onChange={(event) => assignConstraint(edge.id, event.target.value)}
                      >
                        {ISA_CONSTRAINT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(option.labelKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" disabled={!canEdit} onClick={() => assignConstraint(edge.id, currentValue)}>
                      {t("inspector.isa.assignConstraint")}
                    </button>
                  </>
                );
              })()
            ) : null}

            <label className="field">
              <span>{t("inspector.edge.lineStyle")}</span>
              <select
                value={edge.lineStyle}
                disabled={!canEdit}
                onChange={(event) =>
                  props.onEdgeChange(edge.id, {
                    lineStyle: event.target.value as DiagramEdge["lineStyle"],
                  })
                }
              >
                <option value="solid">{t("inspector.edge.lineStyleSolid")}</option>
                <option value="dashed">{t("inspector.edge.lineStyleDashed")}</option>
              </select>
            </label>
          </div>
        </section>
        {renderSelectionActions()}
      </>
    );
  }

  return (
    <PanelShell
      className={
        isEmbedded
          ? "inspector-panel inspector-panel-context inspector-panel-embedded"
          : "inspector-panel inspector-panel-context"
      }
      ariaLabel={t("inspector.panel.propertiesPanel")}
    >
      {!isEmbedded ? (
        <>
          <div className="panel-head-row">
            <div>
              <div className="panel-heading">{heading.title}</div>
              <p className="panel-subheading">{heading.subtitle}</p>
            </div>
            <button
              type="button"
              className="panel-toggle"
              onClick={props.onToggleCollapse}
              aria-label={t("inspector.panel.collapseContextPanel")}
              title={t("common.actions.collapse")}
            >
              {">"}
            </button>
          </div>

          <PanelCard className="context-card context-card-hero">
            <div className="context-card-title">{t("inspector.panel.activeSelectionCount", { count: selectionCount })}</div>
            <p className="context-card-subtitle">
              {selectionCount === 0
                ? t("inspector.panel.emptyHero")
                : t("inspector.panel.scopedHero")}
            </p>
          </PanelCard>
        </>
      ) : null}

      {selectedNode ? renderNodeContext(selectedNode) : null}
      {selectedEdge ? renderEdgeContext(selectedEdge) : null}
      {!selectedNode && !selectedEdge && selectionCount > 1 ? renderMultiSelection() : null}
      {!selectedNode && !selectedEdge && selectionCount === 0 ? (
        <section className="context-card">
          <div className="context-card-title">{t("inspector.quickGuide.title")}</div>
          <div className="context-card-list">
            <span>{t("inspector.quickGuide.create")}</span>
            <span>{t("inspector.quickGuide.select")}</span>
            <span>{t("inspector.quickGuide.addAttributes")}</span>
          </div>
        </section>
      ) : null}
    </PanelShell>
  );
}
