import type { ReactNode } from "react";
import { CodePanel } from "./CodePanel";
import { useI18n } from "../i18n/useI18n";
import { PanelHeader, PanelShell, PanelTabs } from "./panels";

export type TechnicalPanelTab = "review" | "code" | "notes";

interface CodePanelConfig {
  code: string;
  placeholder?: string;
  editable?: boolean;
  parseError?: string;
  onCodeChange?: (value: string) => void;
}

interface NotesConfig {
  notes: string;
  editable?: boolean;
  onChange?: (value: string) => void;
}

interface TechnicalDockPanelProps {
  activeTab: TechnicalPanelTab;
  availableTabs: TechnicalPanelTab[];
  code?: CodePanelConfig;
  notes?: NotesConfig;
  review?: ReactNode;
  onTabChange: (tab: TechnicalPanelTab) => void;
  onClose: () => void;
}

export function TechnicalDockPanel(props: TechnicalDockPanelProps) {
  const { t } = useI18n();
  const activeTab = props.availableTabs.includes(props.activeTab) ? props.activeTab : props.availableTabs[0] ?? "review";
  const tabLabels: Record<TechnicalPanelTab, string> = {
    review: t("technicalDock.tabs.review"),
    code: t("technicalDock.tabs.code"),
    notes: t("technicalDock.tabs.notes"),
  };
  const emptyTabLabels: Record<TechnicalPanelTab, string> = {
    review: t("technicalDock.empty.review"),
    code: t("technicalDock.empty.code"),
    notes: t("technicalDock.empty.notes"),
  };
  const tabs = props.availableTabs.map((tab) => ({ id: tab, label: tabLabels[tab] }));
  const emptyTabState = <div className="technical-empty-note">{emptyTabLabels[activeTab]}</div>;

  return (
    <PanelShell className={`technical-dock-panel technical-dock-panel-${activeTab}`} ariaLabel={t("technicalDock.aria")}>
      <PanelHeader
        title={tabLabels[activeTab]}
        actionLabel={t("common.actions.hide")}
        onAction={props.onClose}
        className="technical-dock-head technical-dock-head-compact"
      >
        <PanelTabs
          activeTab={activeTab}
          tabs={tabs}
          className="technical-dock-tabs"
          ariaLabel={t("technicalDock.tabsAria")}
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
          <div className="technical-empty-note">{props.notes.notes || emptyTabLabels.notes}</div>
        ) : null}
        {activeTab === "notes" && !props.notes ? emptyTabState : null}

        {activeTab === "review" ? props.review ?? emptyTabState : null}
      </div>
    </PanelShell>
  );
}
