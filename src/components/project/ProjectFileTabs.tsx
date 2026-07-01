import type { ProjectOpenTab, ProjectWorkspaceFile } from "../../types/projectExplorer";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon, type StudioIconName } from "../icons/StudioIcon";

interface ProjectFileTabsProps {
  tabs: ProjectOpenTab[];
  activeTabId: string | null;
  files: Record<string, ProjectWorkspaceFile>;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewFile?: () => void;
}

function getFileIcon(file?: ProjectWorkspaceFile): StudioIconName {
  if (!file) {
    return "info";
  }
  if (file.kind === "schema") {
    return "entity";
  }
  if (file.kind === "sql") {
    return "database";
  }
  if (file.kind === "text") {
    return "fileText";
  }
  return "type";
}

function getTabTitle(tab: ProjectOpenTab, files: Record<string, ProjectWorkspaceFile>, welcomeLabel: string): string {
  if (tab.kind === "welcome") {
    return welcomeLabel;
  }
  return tab.fileId ? files[tab.fileId]?.name ?? tab.title : tab.title;
}

export function ProjectFileTabs({
  tabs,
  activeTabId,
  files,
  onSelectTab,
  onCloseTab,
  onNewFile,
}: ProjectFileTabsProps) {
  const { t } = useI18n();

  return (
    <div className="project-file-tabs" role="tablist" aria-label={t("projectTabs.label")}>
      <div className="project-file-tabs__scroller">
        {tabs.map((tab) => {
          const file = tab.kind === "file" && tab.fileId ? files[tab.fileId] : undefined;
          const title = getTabTitle(tab, files, t("projectTabs.welcome"));
          const active = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={["project-file-tab", active ? "active" : "", tab.dirty ? "dirty" : ""].filter(Boolean).join(" ")}
              onMouseDown={(event) => {
                if (event.button === 1) {
                  event.preventDefault();
                  onCloseTab(tab.id);
                }
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                aria-current={active ? "page" : undefined}
                aria-label={tab.dirty ? `${title}, ${t("projectTabs.unsaved")}` : title}
                onClick={() => onSelectTab(tab.id)}
                title={title}
              >
                <StudioIcon name={tab.kind === "welcome" ? "info" : getFileIcon(file)} aria-hidden="true" />
                <span className="project-file-tab__title">{title}</span>
                {tab.dirty ? <span className="project-file-tab__dirty" aria-label={t("projectTabs.unsaved")} /> : null}
              </button>
              <button
                type="button"
                className="project-file-tab__close"
                aria-label={t("projectTabs.closeAria", { name: title })}
                onClick={(event) => {
                  event.stopPropagation();
                  onCloseTab(tab.id);
                }}
              >
                <StudioIcon name="close" aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
      {onNewFile ? (
        <button type="button" className="project-file-tabs__new" onClick={onNewFile} aria-label={t("projectTabs.newFile")}>
          <StudioIcon name="newProject" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
