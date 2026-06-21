import { CodePanel } from "./CodePanel";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { useI18n } from "../i18n/useI18n";
import { PanelShell, PanelTabs } from "./panels";
import type {
  AttributeNode,
  DiagramDocument,
  DiagramEdge,
  DiagramNode,
  EntityNode,
  EditorMode,
  SelectionState,
  ValidationIssue,
} from "../types/diagram";

export type ErWorkspaceSidebarTab = "properties" | "code" | "notes";

interface ErWorkspaceSidebarProps {
  activeTab: ErWorkspaceSidebarTab;
  diagram: DiagramDocument;
  selection: SelectionState;
  mode: EditorMode;
  issues: ValidationIssue[];
  code: string;
  codeError?: string;
  notes: string;
  onSelectTab: (tab: ErWorkspaceSidebarTab) => void;
  onCodeChange: (value: string) => void;
  onNotesChange: (value: string) => void;
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
  onRenameSelection: () => void;
  onNodeChange: (nodeId: string, patch: Partial<DiagramNode>) => void;
  onNodesChange: (nodeIds: string[], patch: Partial<DiagramNode>) => void;
  onEdgeChange: (edgeId: string, patch: Partial<DiagramEdge>) => void;
  onDiagramChange: (diagram: DiagramDocument) => void;
  onStatusMessageChange?: (message: string) => void;
  onIssueSelect: (issue: ValidationIssue) => void;
}

type Translate = ReturnType<typeof useI18n>["t"];

function getSidebarHeading(tab: ErWorkspaceSidebarTab, t: Translate, parseError?: string) {
  if (tab === "code") {
    return {
      title: t("erWorkspaceSidebar.code.title"),
      description: parseError
        ? t("erWorkspaceSidebar.code.descriptionWithError")
        : t("erWorkspaceSidebar.code.description"),
      status: parseError ? t("erWorkspaceSidebar.code.errorStatus") : t("erWorkspaceSidebar.code.liveStatus"),
      tone: parseError ? "warning" : "neutral",
    };
  }

  if (tab === "notes") {
    return {
      title: t("erWorkspaceSidebar.notes.title"),
      description: t("erWorkspaceSidebar.notes.description"),
      status: t("erWorkspaceSidebar.notes.status"),
      tone: "neutral",
    };
  }

  return {
    title: t("erWorkspaceSidebar.properties.title"),
    description: t("erWorkspaceSidebar.properties.description"),
    status: t("erWorkspaceSidebar.properties.status"),
    tone: "success",
  };
}

export function ErWorkspaceSidebar(props: ErWorkspaceSidebarProps) {
  const { t } = useI18n();
  const heading = getSidebarHeading(props.activeTab, t, props.codeError);

  return (
    <PanelShell className={`workspace-side-panel workspace-side-panel-${props.activeTab}`} ariaLabel={t("erWorkspaceSidebar.aria")}>
      <header className="workspace-side-panel-head">
        <div className="workspace-side-panel-topline">
          <h2>{heading.title}</h2>
          <span className={`workspace-side-panel-status tone-${heading.tone}`}>{heading.status}</span>
        </div>
        {heading.description ? <p className="workspace-side-panel-description">{heading.description}</p> : null}

        <PanelTabs
          activeTab={props.activeTab}
          tabs={[
            { id: "properties", label: t("erWorkspaceSidebar.properties.tab") },
            { id: "code", label: t("erWorkspaceSidebar.code.tab") },
            { id: "notes", label: t("erWorkspaceSidebar.notes.tab") },
          ]}
          className="workspace-side-panel-tabs"
          ariaLabel={t("erWorkspaceSidebar.tabsAria")}
          onTabChange={props.onSelectTab}
        />
      </header>

      <div className="workspace-side-panel-body" data-panel-view={props.activeTab}>
        {props.activeTab === "properties" ? (
          <InspectorPanel
            embedded
            diagram={props.diagram}
            selection={props.selection}
            mode={props.mode}
            issues={props.issues}
            onStatusMessageChange={props.onStatusMessageChange}
            onNodeChange={props.onNodeChange}
            onNodesChange={props.onNodesChange}
            onEdgeChange={props.onEdgeChange}
            onDiagramChange={props.onDiagramChange}
            onDeleteSelection={props.onDeleteSelection}
            onDuplicateSelection={props.onDuplicateSelection}
            onAlign={props.onAlign}
            onCreateAttributeForSelection={props.onCreateAttributeForSelection}
            onEntityInternalIdentifiersChange={props.onEntityInternalIdentifiersChange}
            onEntityExternalIdentifiersChange={props.onEntityExternalIdentifiersChange}
            onIssueSelect={props.onIssueSelect}
            onRenameSelection={props.onRenameSelection}
          />
        ) : props.activeTab === "code" ? (
          <CodePanel
            code={props.code}
            editable={props.mode === "edit"}
            parseError={props.codeError}
            onCodeChange={props.onCodeChange}
            placeholder={t("erWorkspaceSidebar.code.placeholder")}
          />
        ) : (
          <div className="technical-empty-note">{props.notes || t("erWorkspaceSidebar.notes.empty")}</div>
        )}
      </div>
    </PanelShell>
  );
}
