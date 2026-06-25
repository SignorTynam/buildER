import { useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import type {
  AttributeNode,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EditorMode,
  IdentifierSelection,
  SelectionState,
  ToolKind,
  ValidationIssue,
} from "../types/diagram";
import { StudioIcon } from "../components/icons/StudioIcon";
import { FloatingExportMenu } from "../components/FloatingExportMenu";
import type { MessageKey } from "../i18n";
import { useI18n } from "../i18n/useI18n";
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
  onExportJpeg: () => void;
  onOpenCardinality?: () => void;
  onOpenRole?: () => void;
  onToggleSimpleIdentifier?: () => void;
  onOpenCompositeIdentifier?: () => void;
  onOpenMixedIdentifier?: () => void;
  onOpenInheritanceType?: () => void;
  onRemoveFromHierarchy?: () => void;
  onRemoveExternalIdentifier?: () => void;
  onToolChange: (tool: ToolKind) => void;
  onDuplicateSelection: () => void;
  onDeleteSelection: () => void;
  selectedIdentifier?: IdentifierSelection | null;
  onDeleteIdentifierSelection: () => void;
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
  buttonRef?: RefObject<HTMLButtonElement>;
  ariaHasPopup?: "menu";
  ariaExpanded?: boolean;
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

export function findSimpleInternalIdentifierForAttribute(
  diagram: DiagramDocument,
  attributeId: string,
): { hostEntityId: string; internalIdentifierId: string } | null {
  for (const node of diagram.nodes) {
    if (node.type !== "entity") {
      continue;
    }

    const identifier = (node.internalIdentifiers ?? []).find(
      (candidate) => candidate.attributeIds.length === 1 && candidate.attributeIds[0] === attributeId,
    );

    if (identifier) {
      return {
        hostEntityId: node.id,
        internalIdentifierId: identifier.id,
      };
    }
  }

  return null;
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
    attribute.isIdentifier !== true &&
    attribute.isCompositeInternal !== true &&
    !isMultivalueElement &&
    !usedInternalAttributeIds.has(attribute.id) &&
    !usedExternalAttributeIds.has(attribute.id) &&
    findSimpleInternalIdentifierForAttribute(diagram, attribute.id) === null;

  return {
    host,
    isMultivalueElement,
    eligibleForInternalId,
  };
}

function getCompositeSelectionContext(
  diagram: DiagramDocument,
  selection: SelectionState,
  t: (key: MessageKey) => string,
): { valid: boolean; title?: string } {
  if (selection.edgeIds.length > 0 || selection.nodeIds.length < 2) {
    return { valid: false, title: t("toolbar.commands.compositeId.selectTwoSimple") };
  }

  const contexts = selection.nodeIds.map((nodeId) => {
    const attribute = diagram.nodes.find(
      (node): node is AttributeNode => node.id === nodeId && node.type === "attribute",
    );
    return attribute ? { attribute, host: findAttributeHost(diagram, attribute.id) } : null;
  });
  if (contexts.some((context) => context === null)) {
    return { valid: false, title: t("toolbar.commands.compositeId.attributesOnly") };
  }

  const validContexts = contexts as Array<{ attribute: AttributeNode; host: DiagramNode | undefined }>;
  const host = validContexts[0]?.host;
  if (!host || host.type !== "entity" || validContexts.some((context) => context.host?.id !== host.id)) {
    return { valid: false, title: t("toolbar.commands.compositeId.sameEntity") };
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
    : { valid: false, title: t("toolbar.commands.compositeId.simpleUnused") };
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
      ref={command.buttonRef}
      onClick={command.onClick}
      disabled={command.disabled}
      title={command.title ?? command.label}
      aria-label={command.ariaLabel ?? command.label}
      aria-haspopup={command.ariaHasPopup}
      aria-expanded={command.ariaExpanded}
    >
      <span className="designer-toolbar-icon" aria-hidden="true">{command.icon}</span>
      <span className="designer-toolbar-label">{command.label}</span>
    </button>
  );
}

export function Toolbar(props: ToolbarProps) {
  const { t } = useI18n();
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportButtonRef = useRef<HTMLButtonElement | null>(null);
  const canEdit = props.mode === "edit";
  const hasIdentifierSelection = props.selectedIdentifier != null;
  const hasSelection = props.selectionItemCount > 0 && !hasIdentifierSelection;
  const selectedAttribute = props.selectedNode?.type === "attribute" ? props.selectedNode : undefined;
  const selectedAttributeCanHaveCardinality =
    selectedAttribute !== undefined && canAttributeHaveCardinality(props.diagram, selectedAttribute);
  const selectedAttributeCanCreateSubattribute =
    selectedAttribute !== undefined && canAttributeBecomeComposite(props.diagram, selectedAttribute);
  const attributeContext = selectedAttribute ? getAttributeContext(props.diagram, selectedAttribute) : undefined;
  const selectedSimpleIdentifier = selectedAttribute
    ? findSimpleInternalIdentifierForAttribute(props.diagram, selectedAttribute.id)
    : null;
  const hasSelectedSimpleIdentifier = selectedSimpleIdentifier !== null;
  const compositeSelection = getCompositeSelectionContext(props.diagram, props.selection, t);
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
  const hasNoSelection = props.selectionItemCount === 0;
  const hasSingleNodeSelection =
    props.selectionItemCount === 1 &&
    props.selection.nodeIds.length === 1 &&
    props.selection.edgeIds.length === 0;
  const canCreateAttributeForSelection =
    canEdit &&
    hasSingleNodeSelection &&
    props.selectedNode?.type === "entity";
  const canStartConnectorFromSelection = canEdit && hasSingleNodeSelection && props.selectedNode?.type === "relationship";
  const canStartIsaFromSelection = canEdit && hasSingleNodeSelection && props.selectedNode?.type === "entity";

  const navigateCommands: ToolbarCommand[] = [
    { key: "primary-select", label: t("toolbar.commands.select.label"), icon: <StudioIcon name="select" />, onClick: () => props.onToolChange("select"), active: props.activeTool === "select", ariaLabel: t("toolbar.commands.select.aria") },
    { key: "primary-move", label: t("toolbar.commands.pan.label"), icon: <StudioIcon name="pan" />, onClick: () => props.onToolChange("move"), active: props.activeTool === "move", ariaLabel: t("toolbar.commands.pan.aria") },
  ];

  const createCommands: ToolbarCommand[] = [
    ...(hasNoSelection
      ? [
          {
            key: "primary-entity",
            label: t("toolbar.commands.entity.label"),
            icon: <StudioIcon name="entity" />,
            onClick: () => props.onToolChange("entity"),
            disabled: !canEdit,
            active: props.activeTool === "entity",
            ariaLabel: t("toolbar.commands.entity.aria"),
          } satisfies ToolbarCommand,
          {
            key: "primary-relation",
            label: t("toolbar.commands.relationship.label"),
            icon: <StudioIcon name="relationship" />,
            onClick: () => props.onToolChange("relationship"),
            disabled: !canEdit,
            active: props.activeTool === "relationship",
            ariaLabel: t("toolbar.commands.relationship.aria"),
          } satisfies ToolbarCommand,
        ]
      : []),
    ...(canCreateAttributeForSelection
      ? [
          {
            key: "primary-attribute",
            label: t("toolbar.commands.attribute.label"),
            icon: <StudioIcon name="attribute" />,
            onClick: props.onCreateAttributeForSelection,
            ariaLabel: t("toolbar.commands.attribute.aria"),
          } satisfies ToolbarCommand,
        ]
      : []),
  ];

  const connectCommands: ToolbarCommand[] = [
    ...(canStartConnectorFromSelection
      ? [
          {
            key: "primary-connect",
            label: t("toolbar.commands.connect.label"),
            icon: <StudioIcon name="connector" />,
            onClick: () => props.onToolChange("connector"),
            active: props.activeTool === "connector",
            ariaLabel: t("toolbar.commands.connect.aria"),
          } satisfies ToolbarCommand,
        ]
      : []),
    ...(canStartIsaFromSelection
      ? [
          {
            key: "primary-isa",
            label: t("toolbar.commands.isa.label"),
            icon: <StudioIcon name="isa" />,
            onClick: () => props.onToolChange("inheritance"),
            active: props.activeTool === "inheritance",
            ariaLabel: t("toolbar.commands.isa.aria"),
          } satisfies ToolbarCommand,
        ]
      : []),
  ];

  const historyClipboardCommands: ToolbarCommand[] = [
    { key: "undo", label: t("common.actions.undo"), icon: <StudioIcon name="undo" />, onClick: () => props.onUndo?.(), disabled: !props.canUndo },
    { key: "redo", label: t("common.actions.redo"), icon: <StudioIcon name="redo" />, onClick: () => props.onRedo?.(), disabled: !props.canRedo },
    ...(hasIdentifierSelection || hasSelectedSimpleIdentifier
      ? [
          {
            key: "delete-identifier",
            label: t("toolbar.commands.deleteIdentifier.label"),
            icon: <StudioIcon name="delete" />,
            onClick: props.onDeleteIdentifierSelection,
            disabled: !canEdit,
            title: t("toolbar.commands.deleteIdentifier.title"),
          } satisfies ToolbarCommand,
        ]
      : []),
    ...(hasSelection
      ? [
          {
            key: "duplicate",
            label: t("common.actions.duplicate"),
            icon: <StudioIcon name="duplicate" />,
            onClick: props.onDuplicateSelection,
            disabled: !canEdit,
          } satisfies ToolbarCommand,
        ]
      : []),
  ];

  const workflowCommands: ToolbarCommand[] = [
    { key: "translate", label: t("toolbar.commands.translate.label"), icon: <StudioIcon name="translate" />, onClick: props.onOpenTranslation },
    {
      key: "export",
      label: t("toolbar.commands.export.label"),
      icon: <StudioIcon name="export" />,
      onClick: () => setExportMenuOpen((current) => !current),
      active: exportMenuOpen,
      buttonRef: exportButtonRef,
      ariaHasPopup: "menu",
      ariaExpanded: exportMenuOpen,
    },
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
            label: t("toolbar.commands.rename.label"),
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
            label: t("common.actions.delete"),
            icon: <StudioIcon name="delete" />,
            onClick: props.onDeleteSelection,
            disabled: !canEdit,
          } satisfies ToolbarCommand,
        ]
      : []),
  ];

  let detailCommands: ToolbarCommand[] = [];

  if (hasIdentifierSelection || props.selectionItemCount === 0) {
    detailCommands = [];
  } else if (props.selection.nodeIds.length >= 2 && props.selection.edgeIds.length === 0) {
    detailCommands = [
      {
        key: "composite-id",
        label: t("toolbar.commands.compositeId.label"),
        icon: <StudioIcon name="compositeId" />,
        onClick: () => props.onOpenCompositeIdentifier?.(),
        disabled: !canEdit || !compositeSelection.valid,
        title: compositeSelection.title,
      },
    ];
  } else if (props.selectedNode?.type === "entity") {
    detailCommands = [
      { key: "parent", label: t("toolbar.commands.toParent.label"), icon: <StudioIcon name="parent" />, onClick: () => props.onToolChange("inheritance"), disabled: !canEdit },
      ...(selectedEntityIsInHierarchy
        ? [
            {
              key: "remove-hierarchy",
              label: t("toolbar.commands.removeHierarchy.label"),
              icon: <StudioIcon name="removeHierarchy" />,
              onClick: () => props.onRemoveFromHierarchy?.(),
              title: t("toolbar.commands.removeHierarchy.title"),
            } satisfies ToolbarCommand,
          ]
        : []),
    ];
  } else if (props.selectedNode?.type === "relationship") {
    detailCommands = [];
  } else if (selectedAttribute) {
    const idDisabledTitle = attributeContext?.eligibleForInternalId
      ? undefined
      : t("toolbar.commands.simpleId.titleUnavailable");
    detailCommands = [
      {
        key: "subattribute",
        label: t("toolbar.commands.subattribute.label"),
        icon: <StudioIcon name="attribute" />,
        onClick: props.onCreateAttributeForSelection,
        disabled: !canEdit || !selectedAttributeCanCreateSubattribute,
        title: selectedAttributeCanCreateSubattribute
          ? undefined
          : t("toolbar.commands.subattribute.titleUnavailable"),
      },
      ...(hasSelectedSimpleIdentifier
        ? []
        : [
            {
              key: "simple-id",
              label: t("toolbar.commands.simpleId.label"),
              icon: <StudioIcon name="simpleId" />,
              onClick: () => props.onToggleSimpleIdentifier?.(),
              disabled: !canEdit || !attributeContext?.eligibleForInternalId,
              title: idDisabledTitle,
            } satisfies ToolbarCommand,
          ]),
      {
        key: "composite-id",
        label: t("toolbar.commands.compositeId.label"),
        icon: <StudioIcon name="compositeId" />,
        onClick: () => props.onOpenCompositeIdentifier?.(),
        disabled: true,
        title: t("toolbar.commands.compositeId.selectTwoSimple"),
      },
      ...(selectedAttributeCanHaveCardinality
        ? [
            {
              key: "card",
              label: t("toolbar.commands.card.label"),
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
        label: t("toolbar.commands.externalIdUnified.label"),
        icon: <StudioIcon name="externalId" />,
        onClick: () => props.onOpenMixedIdentifier?.(),
        disabled: !canEdit || mixedDisabled,
        title: mixedDisabled ? t("toolbar.commands.externalIdUnified.titleCardinalityRequired") : undefined,
      },
      { key: "card", label: t("toolbar.commands.card.label"), icon: <StudioIcon name="cardinality" />, onClick: () => props.onOpenCardinality?.(), disabled: !canEdit },
      { key: "role", label: t("toolbar.commands.role.label"), icon: <StudioIcon name="role" />, onClick: () => props.onOpenRole?.(), disabled: !canEdit },
    ];
  } else if (props.selectedEdge?.type === "inheritance") {
    const constraintTitle =
      props.selectedEdge.isaCompleteness && props.selectedEdge.isaDisjointness
        ? `(${props.selectedEdge.isaCompleteness === "total" ? "t" : "p"},${props.selectedEdge.isaDisjointness === "overlap" ? "o" : "e"})`
        : t("toolbar.commands.type.missingConstraint");
    detailCommands = [
      {
        key: "type",
        label: t("toolbar.commands.type.label"),
        icon: <StudioIcon name="isa" />,
        onClick: () => props.onOpenInheritanceType?.(),
        disabled: !canEdit,
        title: constraintTitle,
      },
    ];
  } else {
    detailCommands = [];
  }

  const renderCommands = (groupKey: string, commands: ToolbarCommand[]) =>
    commands.map((command) => <CommandButton key={`${groupKey}-${command.key}`} command={command} />);

  return (
    <>
      <nav className="designer-context-toolbar designer-er-toolbar" aria-label={t("toolbar.commands.aria")}>
        {renderCommands("navigate", navigateCommands)}
        {createCommands.length > 0 ? (
          <>
            <span className="designer-toolbar-separator" aria-hidden="true" />
            {renderCommands("create", createCommands)}
          </>
        ) : null}
        {connectCommands.length > 0 ? (
          <>
            <span className="designer-toolbar-separator" aria-hidden="true" />
            {renderCommands("connect", connectCommands)}
          </>
        ) : null}
        <span className="designer-toolbar-separator" aria-hidden="true" />
        {renderCommands("edit", editCommands)}
        {detailCommands.length > 0 ? (
          <>
            <span className="designer-toolbar-separator" aria-hidden="true" />
            {renderCommands("details", detailCommands)}
          </>
        ) : null}
        <span className="designer-toolbar-separator designer-toolbar-spacer" aria-hidden="true" />
        {renderCommands("workflow", workflowCommands)}
      </nav>
      <FloatingExportMenu
        open={exportMenuOpen}
        anchorRef={exportButtonRef}
        ariaLabel={t("toolbar.export.aria")}
        onClose={() => setExportMenuOpen(false)}
        items={[
          {
            key: "project",
            label: t("toolbar.export.project"),
            onClick: () => props.onSaveProject?.(),
            disabled: !props.onSaveProject,
            title: !props.onSaveProject ? "Export progetto non disponibile." : undefined,
          },
          {
            key: "diagram-code",
            label: t("toolbar.export.diagramCode"),
            onClick: () => props.onSaveErs?.(),
            disabled: !props.onSaveErs,
            title: !props.onSaveErs ? "Export ERS non disponibile." : undefined,
          },
          { key: "png", label: t("toolbar.export.png"), onClick: props.onExportPng },
          { key: "jpeg", label: t("toolbar.export.jpeg"), onClick: props.onExportJpeg },
          { key: "svg", label: t("toolbar.export.svg"), onClick: props.onExportSvg },
        ]}
      />
    </>
  );
}
