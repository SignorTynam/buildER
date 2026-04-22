import { CodePanel } from "./CodePanel";
import { NotesPanel } from "./NotesPanel";
import { InspectorPanel } from "../inspector/InspectorPanel";
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
  onIssueSelect: (issue: ValidationIssue) => void;
}

function getSidebarHeading(tab: ErWorkspaceSidebarTab, parseError?: string) {
  if (tab === "code") {
    return {
      title: "Diagram code",
      description: parseError ? "Correggi il sorgente ERS per riallineare canvas e codice." : "",
      status: parseError ? "Errore ERS" : "ERS live",
      tone: parseError ? "warning" : "neutral",
    };
  }

  if (tab === "notes") {
    return {
      title: "Note",
      description: "",
      status: "Appunti",
      tone: "neutral",
    };
  }

  return {
    title: "Inspector",
    description: "",
    status: "Regole ER",
    tone: "success",
  };
}

export function ErWorkspaceSidebar(props: ErWorkspaceSidebarProps) {
  const heading = getSidebarHeading(props.activeTab, props.codeError);

  return (
    <aside className={`workspace-side-panel workspace-side-panel-${props.activeTab}`} aria-label="Pannello laterale ER">
      <header className="workspace-side-panel-head">
        <div className="workspace-side-panel-topline">
          <h2>{heading.title}</h2>
          <span className={`workspace-side-panel-status tone-${heading.tone}`}>{heading.status}</span>
        </div>
        {heading.description ? <p className="workspace-side-panel-description">{heading.description}</p> : null}

        <div className="workspace-side-panel-tabs" role="group" aria-label="Selettore sezione pannello laterale">
          <button
            type="button"
            className={props.activeTab === "properties" ? "workspace-side-tab active" : "workspace-side-tab"}
            onClick={() => props.onSelectTab("properties")}
            aria-pressed={props.activeTab === "properties"}
          >
            Proprieta
          </button>
          <button
            type="button"
            className={props.activeTab === "code" ? "workspace-side-tab active" : "workspace-side-tab"}
            onClick={() => props.onSelectTab("code")}
            aria-pressed={props.activeTab === "code"}
          >
            Codice
          </button>
          <button
            type="button"
            className={props.activeTab === "notes" ? "workspace-side-tab active" : "workspace-side-tab"}
            onClick={() => props.onSelectTab("notes")}
            aria-pressed={props.activeTab === "notes"}
          >
            Note
          </button>
        </div>
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
    </aside>
  );
}
