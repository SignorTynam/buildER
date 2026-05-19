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
  selectedNode?: DiagramNode,
  selectedEdge?: DiagramEdge,
  selectionCount = 0,
): { title: string; subtitle: string } {
  if (selectedNode?.type === "entity") {
    return {
      title: "Entita",
      subtitle: "Modifica solo le proprieta dell'entita corrente e aggiungi attributi quando serve.",
    };
  }

  if (selectedNode?.type === "relationship") {
    return {
      title: "Associazione",
      subtitle: "Pannello focalizzato sull'associazione selezionata e sui suoi attributi collegati.",
    };
  }

  if (selectedNode?.type === "attribute") {
    return {
      title: "Attributo",
      subtitle: "Sono visibili solo le opzioni dell'attributo attivo.",
    };
  }

  if (selectedEdge) {
    return {
      title: "Collegamento",
      subtitle: "Configura soltanto il link selezionato.",
    };
  }

  if (selectionCount > 1) {
    return {
      title: "Selezione multipla",
      subtitle: "Azioni di gruppo per riallineare o ripulire la selezione.",
    };
  }

  return {
    title: "Canvas",
    subtitle: "Seleziona un elemento per vedere solo le impostazioni pertinenti.",
  };
}

const ISA_CONSTRAINT_OPTIONS: Array<{
  value: string;
  completeness: IsaCompleteness;
  disjointness: IsaDisjointness;
  label: string;
}> = [
  { value: "t,e", completeness: "total", disjointness: "disjoint", label: "(t,e) - totale esclusiva" },
  { value: "t,o", completeness: "total", disjointness: "overlap", label: "(t,o) - totale sovrapposta" },
  { value: "p,e", completeness: "partial", disjointness: "disjoint", label: "(p,e) - parziale esclusiva" },
  { value: "p,o", completeness: "partial", disjointness: "overlap", label: "(p,o) - parziale sovrapposta" },
];

function formatIsaConstraint(completeness?: IsaCompleteness, disjointness?: IsaDisjointness): string {
  if (!completeness || !disjointness) {
    return "vincolo mancante";
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

  const heading = getSelectionHeading(selectedNode, selectedEdge, selectionCount);
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
      props.onStatusMessageChange("Gerarchia ISA aggiornata e unificata con il gruppo esistente.");
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
        <strong>{group.label ?? `Gerarchia ISA ${formatIsaConstraint(group.isaCompleteness, group.isaDisjointness)}`}</strong>
        <span>{formatIsaConstraint(group.isaCompleteness, group.isaDisjointness)}</span>
        <label className="field">
          <span>Modifica vincolo</span>
          <select value={value} disabled={!canEdit} onChange={(event) => updateGroupConstraint(group.id, event.target.value)}>
            {ISA_CONSTRAINT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
              {currentSubtypeId === subtype.id ? "Scollega dal gruppo ISA" : "Rimuovi sottotipo"}
            </button>
          </div>
        ))}
        {subtypes.length === 0 ? <span>Nessun sottotipo configurato.</span> : null}
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => props.onDiagramChange(deleteGeneralizationGroup(props.diagram, group.id))}
        >
          Elimina gruppo ISA
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
          <div className="context-card-title">Gerarchie ISA</div>
          <div className="inspector-stack">
            {supertypeGroups.length > 0
              ? supertypeGroups.map((group) => renderGroupSummary(group))
              : <p className="action-hint">Nessuna gerarchia ISA usa questa entita come padre.</p>}
          </div>
        </section>
        {subtypeEdges.length > 0 ? (
          <section className="context-card">
            <div className="context-card-title">Partecipazione come sottotipo</div>
            <div className="inspector-stack">
              {subtypeEdges.map((edge) => {
                const parent = props.diagram.nodes.find((node) => node.id === edge.targetId);
                const group = getGeneralizationGroupForEdge(props.diagram, edge.id);
                return (
                  <div key={edge.id} className="context-card-list">
                    <strong>{parent?.label ?? edge.targetId}</strong>
                    <span>{group ? formatIsaConstraint(group.isaCompleteness, group.isaDisjointness) : "Gerarchia ISA non configurata"}</span>
                    {group ? (
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => props.onDiagramChange(removeSubtypeFromGeneralizationGroup(props.diagram, group.id, entity.id))}
                      >
                        Scollega dal gruppo ISA
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
        <PanelShell className="inspector-panel collapsed inspector-panel-idle" ariaLabel="Pannello contesto" collapsed>
          <div className="panel-head-row panel-head-row-compact">
            <button
              type="button"
              className="panel-toggle"
              onClick={props.onToggleCollapse}
              aria-label="Espandi pannello contesto"
              title="Espandi"
            >
              {"<"}
            </button>
          </div>
        </PanelShell>
      );
    }

    return (
      <PanelShell className="inspector-panel collapsed" ariaLabel="Pannello contesto" collapsed>
        <div className="panel-head-row panel-head-row-compact">
          <button
            type="button"
            className="panel-toggle"
            onClick={props.onToggleCollapse}
            aria-label="Espandi pannello contesto"
            title="Espandi"
          >
            {"<"}
          </button>
        </div>

        <div className="inspector-compact-stack">
          <div className="inspector-compact-card">
            <strong>{heading.title}</strong>
            <span>{selectionCount === 0 ? "Nessuna selezione" : `${selectionCount} elementi`}</span>
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
        <div className="context-card-title">Azioni rapide</div>
        <div className="action-grid">
          {selectedNode && (selectedNode.type === "entity" || selectedNode.type === "relationship" || selectedNode.type === "attribute") ? (
            <button type="button" onClick={props.onCreateAttributeForSelection} disabled={!canEdit}>
              {selectedNode.type === "attribute" ? "Aggiungi sotto-attributo" : "Aggiungi attributo"}
            </button>
          ) : null}
          {canRenameCurrentSelection ? (
            <button type="button" onClick={props.onRenameSelection} disabled={!canEdit}>
              Rinomina
            </button>
          ) : null}
          {selectionCount > 0 ? (
            <button type="button" onClick={props.onDuplicateSelection} disabled={!canEdit}>
              Duplica
            </button>
          ) : null}
          {selectionCount > 0 ? (
            <button type="button" onClick={props.onDeleteSelection} disabled={!canEdit}>
              Elimina
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
            <div className="context-card-title">Azioni di gruppo</div>
            <div className="action-grid">
              <button type="button" onClick={() => props.onAlign("left")} disabled={!canAlign}>
                Allinea a sinistra
              </button>
              <button type="button" onClick={() => props.onAlign("center")} disabled={!canAlign}>
                Allinea al centro
              </button>
              <button type="button" onClick={() => props.onAlign("top")} disabled={!canAlign}>
                Allinea in alto
              </button>
              <button type="button" onClick={() => props.onAlign("middle")} disabled={!canAlign}>
                Allinea a meta
              </button>
              <button type="button" onClick={props.onDuplicateSelection} disabled={!canEdit}>
                Duplica selezione
              </button>
              <button type="button" onClick={props.onDeleteSelection} disabled={!canEdit}>
                Elimina selezione
              </button>
            </div>
            {!canAlign ? <p className="action-hint">Servono almeno due nodi per usare gli allineamenti.</p> : null}
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
            <div className="context-card-title">Impostazioni entita</div>
            <div className="inspector-stack">
              <label className="field">
                <span>Nome entita</span>
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
                      Cardinalita {row.relationship.label}
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
                      <option value={CONNECTOR_CARDINALITY_PLACEHOLDER}>Seleziona cardinalita</option>
                      {CONNECTOR_CARDINALITIES.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                ))
              ) : (
                <p className="action-hint">Nessuna partecipazione relazionale collegata a questa entita.</p>
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
            <div className="context-card-title">Stato associazione</div>
            <p className="action-hint">
              Gli identificatori esterni che dipendono da questa associazione si gestiscono dal pannello dell&apos;entita host.
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
            <div className="context-card-title">Impostazioni attributo</div>
            <div className="inspector-stack">
              <label className="field">
                <span>Nome attributo</span>
                <input
                  value={node.label}
                  disabled={!canEdit}
                  onChange={(event) => props.onNodeChange(node.id, { label: event.target.value })}
                />
              </label>
              <label className="field">
                <span>Cardinalita</span>
                <select
                  value={node.cardinality ?? ""}
                  disabled={!canEdit || !selectedAttributeCanHaveCardinality}
                  onChange={(event) =>
                    props.onNodeChange(node.id, {
                      cardinality: normalizeSupportedCardinality(event.target.value || undefined),
                    })
                  }
                >
                  <option value="">Nessuna cardinalita</option>
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
              <div className="context-card-title">Stato attributo</div>
              <p className="action-hint">Parte di identificatore interno: la cardinalita del nodo viene rimossa.</p>
            </section>
          ) : null}
          {!selectedAttributeCanHaveCardinality && !selectedAttributeIsInternalIdentifier ? (
            <section className="context-card">
              <div className="context-card-title">Stato attributo</div>
              <p className="action-hint">Parte di identificatore: la cardinalita del nodo viene rimossa.</p>
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
          <div className="context-card-title">Impostazioni collegamento</div>
          <div className="inspector-stack">
            {edge.type === "connector" && connectorContext ? (
              <p className="action-hint">
                La cardinalita di questo collegamento si modifica nell&apos;entita "{connectorContext.entity.label}".
              </p>
            ) : null}

            {edge.type === "connector" && connectorContext ? (
              <label className="field">
                <span>Role</span>
                <input
                  value={connectorParticipation?.role ?? ""}
                  disabled={!canEdit}
                  onChange={(event) => updateConnectorRole(event.target.value)}
                />
              </label>
            ) : null}

            {edge.type === "attribute" && attributeOwner ? (
              <p className="action-hint">
                La cardinalita di questo collegamento si modifica nell&apos;attributo "{attributeOwner.label}".
              </p>
            ) : null}

            {edge.type === "attribute" && !attributeOwner ? (
              <p className="action-hint">
                L&apos;attributo associato non e disponibile: ricollega il nodo per ripristinare la proprieta.
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
                      Questo ramo appartiene al gruppo ISA {formatIsaConstraint(group.isaCompleteness, group.isaDisjointness)}.
                    </p>
                    {renderGroupSummary(group, edge.sourceId)}
                  </>
                ) : (
                  <>
                    <div className="context-card-title">Gerarchia ISA non configurata</div>
                    <p className="action-hint">
                      Figlio: "{sourceNode?.label ?? edge.sourceId}". Padre: "{targetNode?.label ?? edge.targetId}".
                    </p>
                    <label className="field">
                      <span>Vincolo ISA</span>
                      <select
                        value={currentValue}
                        disabled={!canEdit}
                        onChange={(event) => assignConstraint(edge.id, event.target.value)}
                      >
                        {ISA_CONSTRAINT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button type="button" disabled={!canEdit} onClick={() => assignConstraint(edge.id, currentValue)}>
                      Assegna vincolo
                    </button>
                  </>
                );
              })()
            ) : null}

            <label className="field">
              <span>Stile linea</span>
              <select
                value={edge.lineStyle}
                disabled={!canEdit}
                onChange={(event) =>
                  props.onEdgeChange(edge.id, {
                    lineStyle: event.target.value as DiagramEdge["lineStyle"],
                  })
                }
              >
                <option value="solid">Continua</option>
                <option value="dashed">Tratteggiata</option>
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
      ariaLabel="Pannello proprieta"
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
              aria-label="Comprimi pannello contesto"
              title="Comprimi"
            >
              {">"}
            </button>
          </div>

          <PanelCard className="context-card context-card-hero">
            <div className="context-card-title">{selectionCount === 0 ? "Nessuna selezione attiva" : `${selectionCount} elementi attivi`}</div>
            <p className="context-card-subtitle">
              {selectionCount === 0
                ? "Usa il rail a sinistra per creare entita o associazioni, poi seleziona l'elemento da rifinire."
                : "Le azioni e i campi qui sotto sono limitati al contesto corrente."}
            </p>
          </PanelCard>
        </>
      ) : null}

      {selectedNode ? renderNodeContext(selectedNode) : null}
      {selectedEdge ? renderEdgeContext(selectedEdge) : null}
      {!selectedNode && !selectedEdge && selectionCount > 1 ? renderMultiSelection() : null}
      {!selectedNode && !selectedEdge && selectionCount === 0 ? (
        <section className="context-card">
          <div className="context-card-title">Guida rapida</div>
          <div className="context-card-list">
            <span>1. Crea entita o associazioni dal rail sinistro.</span>
            <span>2. Seleziona un elemento per far comparire solo il suo pannello dedicato.</span>
            <span>3. Aggiungi attributi direttamente dal contesto dell'host selezionato.</span>
          </div>
        </section>
      ) : null}
    </PanelShell>
  );
}
