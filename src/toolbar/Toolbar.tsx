import type { ReactNode } from "react";
import type {
  AttributeNode,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EditorMode,
  SelectionState,
  ToolKind,
  ValidationIssue,
} from "../types/diagram";
import { getConnectorParticipation, getConnectorParticipationContext } from "../utils/cardinality";
import { canAttributeBecomeComposite, canAttributeHaveCardinality } from "../utils/diagram";

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
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onCreateEntity?: () => void;
  onCreateRelationship?: () => void;
  onSaveErs?: () => void;
  onOpenCardinality?: () => void;
  onOpenRole?: () => void;
  onToggleSimpleIdentifier?: () => void;
  onOpenCompositeIdentifier?: () => void;
  onOpenMixedIdentifier?: () => void;
  onOpenExternalIdentifier?: () => void;
  onOpenInheritanceType?: () => void;
  onRemoveFromHierarchy?: () => void;
  onRemoveExternalIdentifier?: () => void;
  onToolChange: (tool: ToolKind) => void;
  onDuplicateSelection: () => void;
  onDeleteSelection: () => void;
  onCreateAttributeForSelection: () => void;
  onRenameSelection: () => void;
  onOpenTranslation: () => void;
  onExportSvg: () => void;
  onEntityInternalIdentifiersChange?: unknown;
  onEntityExternalIdentifiersChange?: unknown;
  onNodeChange?: unknown;
  onNodesChange?: unknown;
  onEdgeChange?: unknown;
  onAlign?: unknown;
  onIssueSelect?: unknown;
  onToggleCollapse?: unknown;
}

type ToolbarCommand = {
  key: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
};

type IconName =
  | "undo"
  | "redo"
  | "entity"
  | "relationship"
  | "attribute"
  | "parent"
  | "connect"
  | "rename"
  | "delete"
  | "card"
  | "role"
  | "translate"
  | "export"
  | "save"
  | "simpleId"
  | "compositeId"
  | "externalId"
  | "removeHierarchy"
  | "type";

function ToolIcon({ name }: { name: IconName }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg className="designer-toolbar-svg" viewBox="0 0 24 24" aria-hidden="true">
      {name === "undo" ? <path {...common} d="M9 8H4v5M5 9a8 8 0 1 1 2 8" /> : null}
      {name === "redo" ? <path {...common} d="M15 8h5v5M19 9a8 8 0 1 0-2 8" /> : null}
      {name === "entity" ? <rect {...common} x="5" y="7" width="14" height="10" /> : null}
      {name === "relationship" ? <path {...common} d="M12 4 21 12 12 20 3 12 12 4z" /> : null}
      {name === "attribute" ? (
        <>
          <path {...common} d="M4 12h7" />
          <circle {...common} cx="16" cy="12" r="4.5" />
        </>
      ) : null}
      {name === "parent" ? <path {...common} d="M12 5v12M6 17h12" /> : null}
      {name === "connect" ? (
        <>
          <circle {...common} cx="7" cy="7" r="2.5" />
          <circle {...common} cx="17" cy="17" r="2.5" />
          <path {...common} d="M9 9l6 6" />
        </>
      ) : null}
      {name === "rename" ? (
        <>
          <path {...common} d="M4 20h5L20 9l-5-5L4 15v5z" />
          <path {...common} d="M13 6l5 5" />
        </>
      ) : null}
      {name === "delete" ? (
        <>
          <path {...common} d="M6 7h12M9 7V5h6v2M9 11v6M15 11v6" />
          <path {...common} d="M8 7l1 13h6l1-13" />
        </>
      ) : null}
      {name === "card" ? (
        <>
          <rect {...common} x="4" y="7" width="16" height="10" rx="2" />
          <text className="designer-toolbar-svg-text" x="12" y="14" textAnchor="middle">
            1,N
          </text>
        </>
      ) : null}
      {name === "role" ? (
        <text className="designer-toolbar-svg-text" x="12" y="14" textAnchor="middle">
          R
        </text>
      ) : null}
      {name === "translate" ? (
        <>
          <path {...common} d="M4 5h9M8 5c0 5 3 8 7 10M12 5c0 4-3 7-8 10" />
          <path {...common} d="M14 19l3-8 3 8M15 16h4" />
        </>
      ) : null}
      {name === "export" ? (
        <>
          <path {...common} d="M12 4v10M8 10l4 4 4-4" />
          <path {...common} d="M5 18h14" />
        </>
      ) : null}
      {name === "save" ? (
        <>
          <path {...common} d="M5 4h12l2 2v14H5V4z" />
          <path {...common} d="M8 4v6h8V4M8 20v-6h8v6" />
        </>
      ) : null}
      {name === "simpleId" ? <circle cx="12" cy="12" r="5" fill="currentColor" /> : null}
      {name === "compositeId" ? (
        <>
          <circle cx="8" cy="12" r="3.5" fill="currentColor" />
          <circle cx="16" cy="12" r="3.5" fill="currentColor" />
        </>
      ) : null}
      {name === "externalId" ? (
        <>
          <circle {...common} cx="9" cy="12" r="4" />
          <circle cx="16" cy="12" r="3.5" fill="currentColor" />
        </>
      ) : null}
      {name === "removeHierarchy" ? (
        <>
          <path {...common} d="M12 5v9M7 14h10" />
          <path {...common} d="M5 20 19 4" />
        </>
      ) : null}
      {name === "type" ? (
        <text className="designer-toolbar-svg-text" x="12" y="14" textAnchor="middle">
          ISA
        </text>
      ) : null}
    </svg>
  );
}

function findAttributeHost(diagram: DiagramDocument, attributeId: string): DiagramNode | undefined {
  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  const edge = diagram.edges.find(
    (candidate) =>
      candidate.type === "attribute" &&
      (candidate.sourceId === attributeId || candidate.targetId === attributeId),
  );
  if (!edge) {
    return undefined;
  }

  return nodeMap.get(edge.sourceId === attributeId ? edge.targetId : edge.sourceId);
}

function getAttributeContext(diagram: DiagramDocument, attribute: AttributeNode) {
  const host = findAttributeHost(diagram, attribute.id);
  const isMultivalueElement = host?.type === "attribute" && host.isMultivalued === true;
  const hostEntity = host?.type === "entity" ? host : undefined;
  const usedInternalAttributeIds = new Set(
    hostEntity?.internalIdentifiers?.flatMap((identifier) => identifier.attributeIds) ?? [],
  );
  const usedExternalAttributeIds = new Set(
    hostEntity?.externalIdentifiers?.flatMap((identifier) => identifier.localAttributeIds) ?? [],
  );
  const eligibleForInternalId =
    host?.type === "entity" &&
    attribute.isMultivalued !== true &&
    !isMultivalueElement &&
    !usedExternalAttributeIds.has(attribute.id) &&
    (!usedInternalAttributeIds.has(attribute.id) || attribute.isIdentifier === true);

  return {
    host,
    isMultivalueElement,
    eligibleForInternalId,
  };
}

function getCompositeSelectionContext(diagram: DiagramDocument, selection: SelectionState): { valid: boolean; title?: string } {
  if (selection.edgeIds.length > 0 || selection.nodeIds.length < 2) {
    return { valid: false, title: "Seleziona almeno due attributi semplici con Ctrl/Cmd+click." };
  }

  const contexts = selection.nodeIds.map((nodeId) => {
    const attribute = diagram.nodes.find(
      (node): node is AttributeNode => node.id === nodeId && node.type === "attribute",
    );
    return attribute ? { attribute, host: findAttributeHost(diagram, attribute.id) } : null;
  });
  if (contexts.some((context) => context === null)) {
    return { valid: false, title: "Composite Id richiede solo attributi." };
  }

  const validContexts = contexts as Array<{ attribute: AttributeNode; host: DiagramNode | undefined }>;
  const host = validContexts[0]?.host;
  if (!host || host.type !== "entity" || validContexts.some((context) => context.host?.id !== host.id)) {
    return { valid: false, title: "Gli attributi devono appartenere alla stessa entita." };
  }

  const usedInternal = new Set((host.internalIdentifiers ?? []).flatMap((identifier) => identifier.attributeIds));
  const usedExternal = new Set((host.externalIdentifiers ?? []).flatMap((identifier) => identifier.localAttributeIds));
  const valid = validContexts.every(
    ({ attribute }) =>
      attribute.isMultivalued !== true &&
      attribute.isIdentifier !== true &&
      !usedInternal.has(attribute.id) &&
      !usedExternal.has(attribute.id),
  );

  return valid
    ? { valid: true }
    : { valid: false, title: "Usa solo attributi semplici non gia usati in identificatori." };
}

function getConnectorContext(diagram: DiagramDocument, edge: DiagramEdge | undefined) {
  if (!edge || edge.type !== "connector") {
    return undefined;
  }

  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  return getConnectorParticipationContext(nodeMap.get(edge.sourceId), nodeMap.get(edge.targetId));
}

function isEntityRelationshipConnector(diagram: DiagramDocument, edge: DiagramEdge): boolean {
  return getConnectorContext(diagram, edge) !== undefined;
}

function connectorHasCardinalityOneOne(diagram: DiagramDocument, edge: DiagramEdge): boolean {
  if (edge.type !== "connector") {
    return false;
  }

  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  return getConnectorParticipation(edge, nodeMap.get(edge.sourceId), nodeMap.get(edge.targetId))?.cardinality === "(1,1)";
}

function CommandButton({ command }: { command: ToolbarCommand }) {
  return (
    <button
      type="button"
      className={command.active ? "designer-toolbar-button active" : "designer-toolbar-button"}
      onClick={command.onClick}
      disabled={command.disabled}
      title={command.title ?? command.label}
      aria-label={command.label}
    >
      <span className="designer-toolbar-icon" aria-hidden="true">{command.icon}</span>
      <span className="designer-toolbar-label">{command.label}</span>
    </button>
  );
}

export function Toolbar(props: ToolbarProps) {
  const canEdit = props.mode === "edit";
  const selectedAttribute = props.selectedNode?.type === "attribute" ? props.selectedNode : undefined;
  const selectedAttributeCanHaveCardinality =
    selectedAttribute !== undefined && canAttributeHaveCardinality(props.diagram, selectedAttribute);
  const selectedAttributeCanCreateSubattribute =
    selectedAttribute !== undefined && canAttributeBecomeComposite(props.diagram, selectedAttribute);
  const attributeContext = selectedAttribute ? getAttributeContext(props.diagram, selectedAttribute) : undefined;
  const compositeSelection = getCompositeSelectionContext(props.diagram, props.selection);
  const connectorContext = getConnectorContext(props.diagram, props.selectedEdge);
  const selectedEntityIsInHierarchy =
    canEdit &&
    props.selectedNode?.type === "entity" &&
    props.selection.nodeIds.length === 1 &&
    props.selection.edgeIds.length === 0 &&
    (props.diagram.generalizationGroups ?? []).some(
      (group) =>
        group.supertypeId === props.selectedNode?.id ||
        group.subtypeIds.includes(props.selectedNode?.id ?? ""),
    );
  const selectedEntityHasExternalIdentifier =
    props.selectedNode?.type === "entity" && (props.selectedNode.externalIdentifiers ?? []).length > 0;

  const baseCommands: ToolbarCommand[] = [
    { key: "undo", label: "Undo", icon: <ToolIcon name="undo" />, onClick: () => props.onUndo?.(), disabled: !props.canUndo },
    { key: "redo", label: "Redo", icon: <ToolIcon name="redo" />, onClick: () => props.onRedo?.(), disabled: !props.canRedo },
  ];

  let contextCommands: ToolbarCommand[] = [];

  if (props.selectionItemCount === 0) {
    contextCommands = [
      { key: "entity", label: "Entity", icon: <ToolIcon name="entity" />, onClick: () => props.onCreateEntity?.(), disabled: !canEdit },
      { key: "relation", label: "Relation", icon: <ToolIcon name="relationship" />, onClick: () => props.onCreateRelationship?.(), disabled: !canEdit },
      { key: "translate", label: "Translate", icon: <ToolIcon name="translate" />, onClick: props.onOpenTranslation },
      { key: "export", label: "Export", icon: <ToolIcon name="export" />, onClick: props.onExportSvg },
      { key: "save", label: "Save", icon: <ToolIcon name="save" />, onClick: () => props.onSaveErs?.() },
    ];
  } else if (props.selection.nodeIds.length >= 2 && props.selection.edgeIds.length === 0) {
    contextCommands = [
      {
        key: "composite-id",
        label: "Composite Id",
        icon: <ToolIcon name="compositeId" />,
        onClick: () => props.onOpenCompositeIdentifier?.(),
        disabled: !canEdit || !compositeSelection.valid,
        title: compositeSelection.title,
      },
      { key: "delete", label: "Delete", icon: <ToolIcon name="delete" />, onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (props.selectedNode?.type === "entity") {
    contextCommands = [
      { key: "parent", label: "To Parent", icon: <ToolIcon name="parent" />, onClick: () => props.onToolChange("inheritance"), disabled: !canEdit },
      ...(selectedEntityIsInHierarchy
        ? [
            {
              key: "remove-hierarchy",
              label: "Remove ISA",
              icon: <ToolIcon name="removeHierarchy" />,
              onClick: () => props.onRemoveFromHierarchy?.(),
              title: "Remove this entity from its hierarchy",
            } satisfies ToolbarCommand,
          ]
        : []),
      ...(selectedEntityHasExternalIdentifier
        ? [
            {
              key: "remove-external-id",
              label: "Remove Ext Id",
              icon: <ToolIcon name="externalId" />,
              onClick: () => props.onRemoveExternalIdentifier?.(),
              disabled: !canEdit,
              title: "Remove the external identifier from this entity",
            } satisfies ToolbarCommand,
          ]
        : []),
      { key: "attribute", label: "Attribute", icon: <ToolIcon name="attribute" />, onClick: props.onCreateAttributeForSelection, disabled: !canEdit },
      { key: "rename", label: "Rename", icon: <ToolIcon name="rename" />, onClick: props.onRenameSelection, disabled: !canEdit },
      { key: "delete", label: "Delete", icon: <ToolIcon name="delete" />, onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (props.selectedNode?.type === "relationship") {
    contextCommands = [
      { key: "connect", label: "Connect", icon: <ToolIcon name="connect" />, onClick: () => props.onToolChange("connector"), disabled: !canEdit },
      { key: "attribute", label: "Attribute", icon: <ToolIcon name="attribute" />, onClick: props.onCreateAttributeForSelection, disabled: !canEdit },
      { key: "rename", label: "Rename", icon: <ToolIcon name="rename" />, onClick: props.onRenameSelection, disabled: !canEdit },
      { key: "delete", label: "Delete", icon: <ToolIcon name="delete" />, onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (selectedAttribute) {
    const idDisabledTitle = attributeContext?.eligibleForInternalId
      ? undefined
      : "Disponibile solo per attributi semplici collegati direttamente a un'entita.";
    contextCommands = [
      {
        key: selectedAttribute.isMultivalued === true ? "attribute" : "subattribute",
        label: selectedAttribute.isMultivalued === true ? "Attribute" : "Subattribute",
        icon: <ToolIcon name="attribute" />,
        onClick: props.onCreateAttributeForSelection,
        disabled: !canEdit || !selectedAttributeCanCreateSubattribute,
        title: selectedAttributeCanCreateSubattribute
          ? undefined
          : "Un attributo figlio di un attributo composto non puo diventare composto.",
      },
      {
        key: "simple-id",
        label: "Simple Id",
        icon: <ToolIcon name="simpleId" />,
        onClick: () => props.onToggleSimpleIdentifier?.(),
        disabled: !canEdit || !attributeContext?.eligibleForInternalId,
        title: idDisabledTitle,
      },
      {
        key: "composite-id",
        label: "Composite Id",
        icon: <ToolIcon name="compositeId" />,
        onClick: () => props.onOpenCompositeIdentifier?.(),
        disabled: true,
        title: "Seleziona almeno due attributi semplici con Ctrl/Cmd+click.",
      },
      ...(selectedAttributeCanHaveCardinality
        ? [
            {
              key: "card",
              label: "Card",
              icon: <ToolIcon name="card" />,
              onClick: () => props.onOpenCardinality?.(),
              disabled: !canEdit,
            } satisfies ToolbarCommand,
          ]
        : []),
      { key: "rename", label: "Rename", icon: <ToolIcon name="rename" />, onClick: props.onRenameSelection, disabled: !canEdit },
      { key: "delete", label: "Delete", icon: <ToolIcon name="delete" />, onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (props.selectedEdge && isEntityRelationshipConnector(props.diagram, props.selectedEdge)) {
    const mixedDisabled = !connectorHasCardinalityOneOne(props.diagram, props.selectedEdge);
    contextCommands = [
      {
        key: "external-id",
        label: "External Id",
        icon: <ToolIcon name="externalId" />,
        onClick: () => props.onOpenExternalIdentifier?.(),
        disabled: !canEdit,
      },
      {
        key: "mixed-id",
        label: "Mixed Id",
        icon: <ToolIcon name="compositeId" />,
        onClick: () => props.onOpenMixedIdentifier?.(),
        disabled: !canEdit || mixedDisabled,
        title: mixedDisabled ? "L'identificatore esterno misto richiede cardinalita 1,1 sull'entita." : undefined,
      },
      { key: "card", label: "Card", icon: <ToolIcon name="card" />, onClick: () => props.onOpenCardinality?.(), disabled: !canEdit },
      { key: "role", label: "Role", icon: <ToolIcon name="role" />, onClick: () => props.onOpenRole?.(), disabled: !canEdit },
      { key: "delete", label: "Delete", icon: <ToolIcon name="delete" />, onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (props.selectedEdge?.type === "inheritance") {
    const constraintTitle =
      props.selectedEdge.isaCompleteness && props.selectedEdge.isaDisjointness
        ? `(${props.selectedEdge.isaCompleteness === "total" ? "t" : "p"},${props.selectedEdge.isaDisjointness === "overlap" ? "o" : "e"})`
        : "Vincolo mancante";
    contextCommands = [
      {
        key: "type",
        label: "Type",
        icon: <ToolIcon name="type" />,
        onClick: () => props.onOpenInheritanceType?.(),
        disabled: !canEdit,
        title: constraintTitle,
      },
      { key: "delete", label: "Delete", icon: <ToolIcon name="delete" />, onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else {
    contextCommands = [
      { key: "delete", label: "Delete", icon: <ToolIcon name="delete" />, onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  }

  return (
    <nav className="designer-context-toolbar" aria-label="Context toolbar">
      {[...baseCommands, ...contextCommands].map((command) => (
        <CommandButton key={command.key} command={command} />
      ))}
    </nav>
  );
}
