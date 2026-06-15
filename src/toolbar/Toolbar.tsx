import { useState } from "react";
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
import { StudioIcon } from "../components/icons/StudioIcon";
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
  onSaveProject?: () => void;
  onSaveErs?: () => void;
  onExportPng: () => void;
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
  onCopySelection: () => void;
  onPasteSelection: () => void;
  onDuplicateSelection: () => void;
  canPasteSelection?: boolean;
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
  className?: string;
  ariaLabel?: string;
};

type ToolbarSection = {
  key: string;
  label: string;
  commands: ToolbarCommand[];
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
  const className = [
    "designer-toolbar-button",
    command.active ? "active" : "",
    command.className ?? "",
  ].filter(Boolean).join(" ");

  return (
    <button
      type="button"
      className={className}
      onClick={command.onClick}
      disabled={command.disabled}
      title={command.title ?? command.label}
      aria-label={command.ariaLabel ?? command.label}
    >
      <span className="designer-toolbar-icon" aria-hidden="true">{command.icon}</span>
      <span className="designer-toolbar-label">{command.label}</span>
    </button>
  );
}

export function Toolbar(props: ToolbarProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const canEdit = props.mode === "edit";
  const hasSelection = props.selectionItemCount > 0;
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

  const navigateCommands: ToolbarCommand[] = [
    { key: "primary-select", label: "Select", icon: <StudioIcon name="select" />, onClick: () => props.onToolChange("select"), active: props.activeTool === "select", ariaLabel: "Seleziona elementi" },
    { key: "primary-move", label: "Pan", icon: <StudioIcon name="pan" />, onClick: () => props.onToolChange("move"), active: props.activeTool === "move", ariaLabel: "Sposta il viewport" },
  ];

  const createCommands: ToolbarCommand[] = [
    { key: "primary-entity", label: "Entity", icon: <StudioIcon name="entity" />, onClick: () => props.onToolChange("entity"), disabled: !canEdit, active: props.activeTool === "entity", ariaLabel: "Strumento entita" },
    { key: "primary-relation", label: "Relation", icon: <StudioIcon name="relationship" />, onClick: () => props.onToolChange("relationship"), disabled: !canEdit, active: props.activeTool === "relationship", ariaLabel: "Strumento relazione" },
    { key: "primary-attribute", label: "Attribute", icon: <StudioIcon name="attribute" />, onClick: () => props.onToolChange("attribute"), disabled: !canEdit, active: props.activeTool === "attribute", ariaLabel: "Strumento attributo" },
  ];

  const connectCommands: ToolbarCommand[] = [
    { key: "primary-connect", label: "Connect", icon: <StudioIcon name="connector" />, onClick: () => props.onToolChange("connector"), disabled: !canEdit, active: props.activeTool === "connector", ariaLabel: "Strumento collegamento" },
    { key: "primary-isa", label: "ISA", icon: <StudioIcon name="isa" />, onClick: () => props.onToolChange("inheritance"), disabled: !canEdit, active: props.activeTool === "inheritance", ariaLabel: "Strumento generalizzazione ISA" },
  ];

  const historyClipboardCommands: ToolbarCommand[] = [
    { key: "undo", label: "Undo", icon: <StudioIcon name="undo" />, onClick: () => props.onUndo?.(), disabled: !props.canUndo },
    { key: "redo", label: "Redo", icon: <StudioIcon name="redo" />, onClick: () => props.onRedo?.(), disabled: !props.canRedo },
    ...(hasSelection
      ? [
          {
            key: "copy",
            label: "Copy",
            icon: <StudioIcon name="copy" />,
            onClick: props.onCopySelection,
          } satisfies ToolbarCommand,
        ]
      : []),
    {
      key: "paste",
      label: "Paste",
      icon: <StudioIcon name="paste" />,
      onClick: props.onPasteSelection,
      disabled: !canEdit || !props.canPasteSelection,
      title: props.canPasteSelection ? "Incolla selezione ER" : "Nessuna selezione ER copiata.",
    },
    ...(hasSelection
      ? [
          {
            key: "duplicate",
            label: "Duplicate",
            icon: <StudioIcon name="duplicate" />,
            onClick: props.onDuplicateSelection,
            disabled: !canEdit,
          } satisfies ToolbarCommand,
        ]
      : []),
  ];

  const workflowCommands: ToolbarCommand[] = [
    { key: "translate", label: "Translate", icon: <StudioIcon name="translate" />, onClick: props.onOpenTranslation },
    { key: "export", label: "Export", icon: <StudioIcon name="export" />, onClick: () => setExportMenuOpen((current) => !current) },
  ];

  const selectionCanRename =
    props.selectionItemCount === 1 &&
    props.selection.edgeIds.length === 0 &&
    props.selectedNode !== undefined;
  const editCommands: ToolbarCommand[] = [
    ...historyClipboardCommands,
    ...(selectionCanRename
      ? [
          {
            key: "rename",
            label: "Rename",
            icon: <StudioIcon name="rename" />,
            onClick: props.onRenameSelection,
            disabled: !canEdit,
          } satisfies ToolbarCommand,
        ]
      : []),
    ...(hasSelection
      ? [
          {
            key: "delete",
            label: "Delete",
            icon: <StudioIcon name="delete" />,
            onClick: props.onDeleteSelection,
            disabled: !canEdit,
          } satisfies ToolbarCommand,
        ]
      : []),
  ];

  let detailCommands: ToolbarCommand[] = [];

  if (props.selectionItemCount === 0) {
    detailCommands = [];
  } else if (props.selection.nodeIds.length >= 2 && props.selection.edgeIds.length === 0) {
    detailCommands = [
      {
        key: "composite-id",
        label: "Composite Id",
        icon: <StudioIcon name="compositeId" />,
        onClick: () => props.onOpenCompositeIdentifier?.(),
        disabled: !canEdit || !compositeSelection.valid,
        title: compositeSelection.title,
      },
    ];
  } else if (props.selectedNode?.type === "entity") {
    detailCommands = [
      { key: "parent", label: "To Parent", icon: <StudioIcon name="parent" />, onClick: () => props.onToolChange("inheritance"), disabled: !canEdit },
      ...(selectedEntityIsInHierarchy
        ? [
            {
              key: "remove-hierarchy",
              label: "Remove ISA",
              icon: <StudioIcon name="removeHierarchy" />,
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
              icon: <StudioIcon name="externalId" />,
              onClick: () => props.onRemoveExternalIdentifier?.(),
              disabled: !canEdit,
              title: "Remove the external identifier from this entity",
            } satisfies ToolbarCommand,
          ]
        : []),
    ];
  } else if (props.selectedNode?.type === "relationship") {
    detailCommands = [];
  } else if (selectedAttribute) {
    const idDisabledTitle = attributeContext?.eligibleForInternalId
      ? undefined
      : "Disponibile solo per attributi semplici collegati direttamente a un'entita.";
    detailCommands = [
      ...(selectedAttribute.isMultivalued !== true
        ? [
            {
              key: "subattribute",
              label: "Subattribute",
              icon: <StudioIcon name="attribute" />,
              onClick: props.onCreateAttributeForSelection,
              disabled: !canEdit || !selectedAttributeCanCreateSubattribute,
              title: selectedAttributeCanCreateSubattribute
                ? undefined
                : "Un attributo figlio di un attributo composto non puo diventare composto.",
            } satisfies ToolbarCommand,
          ]
        : []),
      {
        key: "simple-id",
        label: "Simple Id",
        icon: <StudioIcon name="simpleId" />,
        onClick: () => props.onToggleSimpleIdentifier?.(),
        disabled: !canEdit || !attributeContext?.eligibleForInternalId,
        title: idDisabledTitle,
      },
      {
        key: "composite-id",
        label: "Composite Id",
        icon: <StudioIcon name="compositeId" />,
        onClick: () => props.onOpenCompositeIdentifier?.(),
        disabled: true,
        title: "Seleziona almeno due attributi semplici con Ctrl/Cmd+click.",
      },
      ...(selectedAttributeCanHaveCardinality
        ? [
            {
              key: "card",
              label: "Card",
              icon: <StudioIcon name="cardinality" />,
              onClick: () => props.onOpenCardinality?.(),
              disabled: !canEdit,
            } satisfies ToolbarCommand,
          ]
        : []),
    ];
  } else if (props.selectedEdge && isEntityRelationshipConnector(props.diagram, props.selectedEdge)) {
    const mixedDisabled = !connectorHasCardinalityOneOne(props.diagram, props.selectedEdge);
    detailCommands = [
      {
        key: "external-id",
        label: "External Id",
        icon: <StudioIcon name="externalId" />,
        onClick: () => props.onOpenExternalIdentifier?.(),
        disabled: !canEdit,
      },
      {
        key: "mixed-id",
        label: "Mixed Id",
        icon: <StudioIcon name="compositeId" />,
        onClick: () => props.onOpenMixedIdentifier?.(),
        disabled: !canEdit || mixedDisabled,
        title: mixedDisabled ? "L'identificatore esterno misto richiede cardinalita 1,1 sull'entita." : undefined,
      },
      { key: "card", label: "Card", icon: <StudioIcon name="cardinality" />, onClick: () => props.onOpenCardinality?.(), disabled: !canEdit },
      { key: "role", label: "Role", icon: <StudioIcon name="role" />, onClick: () => props.onOpenRole?.(), disabled: !canEdit },
    ];
  } else if (props.selectedEdge?.type === "inheritance") {
    const constraintTitle =
      props.selectedEdge.isaCompleteness && props.selectedEdge.isaDisjointness
        ? `(${props.selectedEdge.isaCompleteness === "total" ? "t" : "p"},${props.selectedEdge.isaDisjointness === "overlap" ? "o" : "e"})`
        : "Vincolo mancante";
    detailCommands = [
      {
        key: "type",
        label: "Type",
        icon: <StudioIcon name="isa" />,
        onClick: () => props.onOpenInheritanceType?.(),
        disabled: !canEdit,
        title: constraintTitle,
      },
    ];
  } else {
    detailCommands = [];
  }

  const toolbarSections: ToolbarSection[] = [
    { key: "navigate", label: "Navigate", commands: navigateCommands },
    { key: "create", label: "Create", commands: createCommands },
    { key: "connect", label: "Connect", commands: connectCommands },
    { key: "edit", label: "Edit", commands: editCommands },
    { key: "details", label: "Details", commands: detailCommands },
    { key: "workflow", label: "Workflow", commands: workflowCommands },
  ].filter((section) => section.commands.length > 0);

  return (
    <nav className="designer-context-toolbar" aria-label="ER toolbar">
      {toolbarSections.map((section) => (
        <section
          key={section.key}
          className={`designer-toolbar-section designer-toolbar-section-${section.key}`}
          aria-labelledby={`designer-toolbar-section-${section.key}`}
        >
          <h3 id={`designer-toolbar-section-${section.key}`} className="designer-toolbar-section-title">
            {section.label}
          </h3>
          <div className="designer-toolbar-section-grid">
            {section.commands.map((command) => (
              <CommandButton key={`${section.key}-${command.key}`} command={command} />
            ))}
          </div>
        </section>
      ))}
      {exportMenuOpen ? (
        <div className="designer-export-popover" role="menu" aria-label="Export ER">
          <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); props.onSaveProject?.(); }}>
            ER Studio Project
          </button>
          <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); props.onSaveErs?.(); }}>
            Diagram Code
          </button>
          <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); props.onExportPng(); }}>
            PNG
          </button>
          <button type="button" role="menuitem" onClick={() => { setExportMenuOpen(false); props.onExportSvg(); }}>
            SVG
          </button>
        </div>
      ) : null}
    </nav>
  );
}
