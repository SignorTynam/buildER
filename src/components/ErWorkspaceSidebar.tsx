import { CodePanel } from "./CodePanel";
import { NotesPanel } from "./NotesPanel";
import { InspectorPanel } from "../inspector/InspectorPanel";
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
  onIssueSelect: (issue: ValidationIssue) => void;
}

function getSidebarHeading(tab: ErWorkspaceSidebarTab, parseError?: string) {
  if (tab === "code") {
    return {
      title: "Sorgente ERS",
      description: parseError ? "Correggi il sorgente ERS per riallineare canvas e codice." : "Modifica la rappresentazione testuale del diagramma.",
      status: parseError ? "Errore ERS" : "ERS live",
      tone: parseError ? "warning" : "neutral",
    };
  }

  if (tab === "notes") {
    return {
      title: "Note",
      description: "Annotazioni non strutturali e promemoria di lavoro.",
      status: "Appunti",
      tone: "neutral",
    };
  }

  return {
    title: "Inspector ER",
    description: "Proprieta, regole e warning dell'elemento selezionato.",
    status: "Regole ER",
    tone: "success",
  };
}

export function ErWorkspaceSidebar(props: ErWorkspaceSidebarProps) {
  const heading = getSidebarHeading(props.activeTab, props.codeError);

  return (
    <PanelShell className={`workspace-side-panel workspace-side-panel-${props.activeTab}`} ariaLabel="Pannello laterale ER">
      <header className="workspace-side-panel-head">
        <div className="workspace-side-panel-topline">
          <h2>{heading.title}</h2>
          <span className={`workspace-side-panel-status tone-${heading.tone}`}>{heading.status}</span>
        </div>
        {heading.description ? <p className="workspace-side-panel-description">{heading.description}</p> : null}

        <PanelTabs
          activeTab={props.activeTab}
          tabs={[
            { id: "properties", label: "Inspector ER" },
            { id: "code", label: "Sorgente ERS" },
            { id: "notes", label: "Note" },
          ]}
          className="workspace-side-panel-tabs"
          ariaLabel="Selettore sezione pannello laterale"
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
            placeholder="Inserisci il codice ERS"
          />
        ) : (
          <NotesPanel notes={props.notes} editable={props.mode === "edit"} onChange={props.onNotesChange} />
        )}
      </div>
    </PanelShell>
  );
}
