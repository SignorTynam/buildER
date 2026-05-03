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
  onToggleSimpleIdentifier?: () => void;
  onOpenCompositeIdentifier?: () => void;
  onOpenMixedIdentifier?: () => void;
  onOpenExternalIdentifier?: () => void;
  onOpenInheritanceType?: () => void;
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
  icon: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  active?: boolean;
};

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

function isEntityRelationshipConnector(diagram: DiagramDocument, edge: DiagramEdge): boolean {
  if (edge.type !== "connector") {
    return false;
  }

  const nodeMap = new Map(diagram.nodes.map((node) => [node.id, node]));
  return getConnectorParticipationContext(nodeMap.get(edge.sourceId), nodeMap.get(edge.targetId)) !== undefined;
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
  const attributeContext = selectedAttribute ? getAttributeContext(props.diagram, selectedAttribute) : undefined;
  const compositeSelection = getCompositeSelectionContext(props.diagram, props.selection);

  const baseCommands: ToolbarCommand[] = [
    { key: "undo", label: "Undo", icon: "↶", onClick: () => props.onUndo?.(), disabled: !props.canUndo },
    { key: "redo", label: "Redo", icon: "↷", onClick: () => props.onRedo?.(), disabled: !props.canRedo },
  ];

  let contextCommands: ToolbarCommand[] = [];

  if (props.selectionItemCount === 0) {
    contextCommands = [
      { key: "entity", label: "Entity", icon: "□", onClick: () => props.onCreateEntity?.(), disabled: !canEdit },
      { key: "relation", label: "Relation", icon: "◇", onClick: () => props.onCreateRelationship?.(), disabled: !canEdit },
      { key: "translate", label: "Translate", icon: "▤", onClick: props.onOpenTranslation },
      { key: "export", label: "Export", icon: "▧", onClick: props.onExportSvg },
      { key: "save", label: "Save", icon: "▣", onClick: () => props.onSaveErs?.() },
    ];
  } else if (props.selection.nodeIds.length >= 2 && props.selection.edgeIds.length === 0) {
    contextCommands = [
      {
        key: "composite-id",
        label: "Composite Id",
        icon: "●●",
        onClick: () => props.onOpenCompositeIdentifier?.(),
        disabled: !canEdit || !compositeSelection.valid,
        title: compositeSelection.title,
      },
      { key: "delete", label: "Delete", icon: "×", onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (props.selectedNode?.type === "entity") {
    contextCommands = [
      { key: "parent", label: "To Parent", icon: "┴", onClick: () => props.onToolChange("inheritance"), disabled: !canEdit },
      { key: "attribute", label: "Attribute", icon: "─○", onClick: props.onCreateAttributeForSelection, disabled: !canEdit },
      { key: "rename", label: "Rename", icon: "✎", onClick: props.onRenameSelection, disabled: !canEdit },
      { key: "delete", label: "Delete", icon: "×", onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (props.selectedNode?.type === "relationship") {
    contextCommands = [
      { key: "connect", label: "Connect", icon: "⟂", onClick: () => props.onToolChange("connector"), disabled: !canEdit },
      { key: "attribute", label: "Attribute", icon: "─○", onClick: props.onCreateAttributeForSelection, disabled: !canEdit },
      { key: "rename", label: "Rename", icon: "✎", onClick: props.onRenameSelection, disabled: !canEdit },
      { key: "delete", label: "Delete", icon: "×", onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (selectedAttribute && attributeContext?.isMultivalueElement) {
    contextCommands = [
      { key: "rename", label: "Rename", icon: "✎", onClick: props.onRenameSelection, disabled: !canEdit },
      { key: "delete", label: "Delete", icon: "×", onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (selectedAttribute?.isMultivalued === true) {
    contextCommands = [
      { key: "card", label: "Card", icon: selectedAttribute.cardinality ?? "(1,1)", onClick: () => props.onOpenCardinality?.(), disabled: !canEdit },
      { key: "rename", label: "Rename", icon: "✎", onClick: props.onRenameSelection, disabled: !canEdit },
      { key: "delete", label: "Delete", icon: "×", onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (selectedAttribute) {
    const idDisabledTitle = attributeContext?.eligibleForInternalId
      ? undefined
      : "Disponibile solo per attributi semplici collegati direttamente a un'entita.";
    contextCommands = [
      { key: "subattribute", label: "Subattribute", icon: "─○", onClick: props.onCreateAttributeForSelection, disabled: !canEdit },
      {
        key: "simple-id",
        label: "Simple Id",
        icon: "●",
        onClick: () => props.onToggleSimpleIdentifier?.(),
        disabled: !canEdit || !attributeContext?.eligibleForInternalId,
        title: idDisabledTitle,
      },
      {
        key: "composite-id",
        label: "Composite Id",
        icon: "●●",
        onClick: () => props.onOpenCompositeIdentifier?.(),
        disabled: true,
        title: "Seleziona almeno due attributi semplici con Ctrl/Cmd+click.",
      },
      { key: "card", label: "Card", icon: selectedAttribute.cardinality ?? "(1,1)", onClick: () => props.onOpenCardinality?.(), disabled: !canEdit },
      { key: "rename", label: "Rename", icon: "✎", onClick: props.onRenameSelection, disabled: !canEdit },
      { key: "delete", label: "Delete", icon: "×", onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (props.selectedEdge && isEntityRelationshipConnector(props.diagram, props.selectedEdge)) {
    const mixedDisabled = !connectorHasCardinalityOneOne(props.diagram, props.selectedEdge);
    contextCommands = [
      { key: "external-id", label: "External Id", icon: "●", onClick: () => props.onOpenExternalIdentifier?.(), disabled: !canEdit },
      {
        key: "mixed-id",
        label: "Mixed Id",
        icon: "◒",
        onClick: () => props.onOpenMixedIdentifier?.(),
        disabled: !canEdit || mixedDisabled,
        title: mixedDisabled ? "L'identificatore esterno misto richiede cardinalita 1,1 sull'entita." : undefined,
      },
      { key: "card", label: "Card", icon: "Card", onClick: () => props.onOpenCardinality?.(), disabled: !canEdit },
      { key: "delete", label: "Delete", icon: "×", onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else if (props.selectedEdge?.type === "inheritance") {
    const completeness = props.selectedEdge.isaCompleteness === "total" ? "t" : "p";
    const disjointness = props.selectedEdge.isaDisjointness === "overlap" ? "o" : "e";
    contextCommands = [
      { key: "type", label: "Type", icon: `(${completeness},${disjointness})`, onClick: () => props.onOpenInheritanceType?.(), disabled: !canEdit },
      { key: "delete", label: "Delete", icon: "×", onClick: props.onDeleteSelection, disabled: !canEdit },
    ];
  } else {
    contextCommands = [
      { key: "delete", label: "Delete", icon: "×", onClick: props.onDeleteSelection, disabled: !canEdit },
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
