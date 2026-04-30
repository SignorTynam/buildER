import type { ReactNode } from "react";
import { CodePanel } from "./CodePanel";
import { NotesPanel } from "./NotesPanel";
import { PanelHeader, PanelShell, PanelTabs } from "./panels";

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
  code: "ER Code",
  notes: "Notes",
  sql: "SQL",
};

const EMPTY_TAB_LABELS: Record<TechnicalPanelTab, string> = {
  review: "Nessun elemento da mostrare.",
  code: "Nessun codice disponibile.",
  notes: "Nessuna nota.",
  sql: "Nessuna anteprima SQL.",
};

export function TechnicalDockPanel(props: TechnicalDockPanelProps) {
  const activeTab = props.availableTabs.includes(props.activeTab) ? props.activeTab : props.availableTabs[0] ?? "review";
  const tabs = props.availableTabs.map((tab) => ({ id: tab, label: TAB_LABELS[tab] }));
  const emptyTabState = <div className="technical-empty-note">{EMPTY_TAB_LABELS[activeTab]}</div>;

  return (
    <PanelShell className={`technical-dock-panel technical-dock-panel-${activeTab}`} ariaLabel="Pannello tecnico">
      <PanelHeader
        title={TAB_LABELS[activeTab]}
        actionLabel="Nascondi"
        onAction={props.onClose}
        className="technical-dock-head technical-dock-head-compact"
      >
        <PanelTabs
          activeTab={activeTab}
          tabs={tabs}
          className="technical-dock-tabs"
          ariaLabel="Sezioni pannello tecnico"
          onTabChange={props.onTabChange}
        />
      </PanelHeader>

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
        {activeTab === "code" && !props.code ? emptyTabState : null}

        {activeTab === "notes" && props.notes ? (
          <NotesPanel
            notes={props.notes.notes}
            editable={props.notes.editable}
            onChange={props.notes.onChange}
            embedded
          />
        ) : null}
        {activeTab === "notes" && !props.notes ? emptyTabState : null}

        {activeTab === "review" ? props.review ?? emptyTabState : null}
        {activeTab === "sql" ? props.sql ?? emptyTabState : null}
      </div>
    </PanelShell>
  );
}
