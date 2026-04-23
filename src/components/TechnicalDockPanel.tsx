import type { ReactNode } from "react";
import { CodePanel } from "./CodePanel";
import { NotesPanel } from "./NotesPanel";

export type TechnicalPanelTab = "review" | "code" | "notes" | "sql";

interface CodePanelConfig {
  code: string;
  placeholder?: string;
  editable?: boolean;
  parseError?: string;
  onCodeChange?: (value: string) => void;
}

interface NotesPanelConfig {
  notes: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}

interface TechnicalDockPanelProps {
  activeTab: TechnicalPanelTab;
  availableTabs: TechnicalPanelTab[];
  code?: CodePanelConfig;
  notes?: NotesPanelConfig;
  review?: ReactNode;
  sql?: ReactNode;
  onTabChange: (tab: TechnicalPanelTab) => void;
  onClose: () => void;
}

const TAB_LABELS: Record<TechnicalPanelTab, string> = {
  review: "Review",
  code: "Code",
  notes: "Notes",
  sql: "SQL",
};

const TAB_DESCRIPTIONS: Record<TechnicalPanelTab, string> = {
  review: "Stato operativo del workspace corrente.",
  code: "Rappresentazione ERS sincronizzata con il diagramma.",
  notes: "Annotazioni di progetto leggere e non invasive.",
  sql: "Codice SQL generato dallo schema logico.",
};

export function TechnicalDockPanel(props: TechnicalDockPanelProps) {
  const activeTab = props.availableTabs.includes(props.activeTab) ? props.activeTab : props.availableTabs[0] ?? "review";

  return (
    <aside className={`technical-dock-panel technical-dock-panel-${activeTab}`} aria-label="Pannello tecnico">
      <header className="technical-dock-head">
        <div className="technical-dock-title">
          <span className="technical-side-panel-kicker">Technical dock</span>
          <h2>{TAB_LABELS[activeTab]}</h2>
          <p>{TAB_DESCRIPTIONS[activeTab]}</p>
        </div>

        <button type="button" className="technical-side-panel-close" onClick={props.onClose}>
          Hide
        </button>
      </header>

      <div className="technical-dock-tabs" role="tablist" aria-label="Sezioni pannello tecnico">
        {props.availableTabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={tab === activeTab ? "technical-dock-tab active" : "technical-dock-tab"}
            onClick={() => props.onTabChange(tab)}
            role="tab"
            aria-selected={tab === activeTab}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      <div className="technical-dock-body">
        {activeTab === "code" && props.code ? (
          <CodePanel
            code={props.code.code}
            editable={props.code.editable}
            parseError={props.code.parseError}
            onCodeChange={props.code.onCodeChange}
            placeholder={props.code.placeholder}
            embedded
          />
        ) : null}

        {activeTab === "notes" && props.notes ? (
          <NotesPanel
            notes={props.notes.notes}
            editable={props.notes.editable}
            onChange={props.notes.onChange}
            embedded
          />
        ) : null}

        {activeTab === "review" ? props.review : null}
        {activeTab === "sql" ? props.sql : null}
      </div>
    </aside>
  );
}
