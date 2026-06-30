import { useMemo } from "react";
import type { CSSProperties, PointerEvent } from "react";
import type {
  ProjectExplorerNode,
  ProjectExplorerProject,
  ProjectExplorerViewState,
  ProjectWorkspaceFile,
} from "../../types/projectExplorer";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";
import { ProjectExplorerTreeItem } from "./ProjectExplorerTreeItem";

interface ProjectExplorerProps {
  project: ProjectExplorerProject;
  files: Record<string, ProjectWorkspaceFile>;
  view: ProjectExplorerViewState;
  embedded?: boolean;
  onOpenFile: (fileId: string) => void;
  onCreateSchema: (parentId: string) => void;
  onCreateTextFile: (parentId: string) => void;
  onCreateSqlFile?: (parentId: string) => void;
  onCreateFolder: (parentId: string) => void;
  onRename: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onToggleFolder: (folderId: string) => void;
  onCollapseAll: () => void;
  onToggleOpen: () => void;
  onResizeStart: (event: PointerEvent<HTMLDivElement>) => void;
}

export function ProjectExplorer(props: ProjectExplorerProps) {
  const { t } = useI18n();
  const nodesById = useMemo(
    () => new Map(props.project.fileTree.map((node) => [node.id, node])),
    [props.project.fileTree],
  );
  const root = nodesById.get(props.project.rootId);
  const rootChildren = (root?.children ?? [])
    .map((childId) => nodesById.get(childId))
    .filter((node): node is ProjectExplorerNode => Boolean(node));
  const expandedFolderIds = useMemo(() => new Set(props.view.expandedFolderIds), [props.view.expandedFolderIds]);
  const labels = {
    rename: t("projectExplorer.actions.rename"),
    delete: t("projectExplorer.actions.delete"),
    newSchema: t("projectExplorer.actions.newSchema"),
    newTextFile: t("projectExplorer.actions.newTextFile"),
    newSqlFile: t("projectExplorer.actions.newSqlFile"),
    newFolder: t("projectExplorer.actions.newFolder"),
  };

  if (!props.embedded && !props.view.explorerOpen) {
    return (
      <aside className="project-explorer project-explorer--collapsed" aria-label={t("projectExplorer.title")}>
        <button
          type="button"
          className="project-explorer-collapsed-button"
          onClick={props.onToggleOpen}
          title={t("projectExplorer.actions.open")}
          aria-label={t("projectExplorer.actions.open")}
        >
          <StudioIcon name="panelLeft" />
        </button>
      </aside>
    );
  }

  return (
    <aside
      className={props.embedded ? "project-explorer project-explorer--embedded" : "project-explorer"}
      style={props.embedded ? undefined : ({ "--project-explorer-width": `${props.view.explorerWidth}px` } as CSSProperties)}
      aria-label={t("projectExplorer.title")}
    >
      <div className="project-explorer-header">
        <div>
          <h2>{t("projectExplorer.title")}</h2>
          <span>{props.project.name}</span>
        </div>
        <div className="project-explorer-header__actions" aria-label={t("projectExplorer.actions.aria")}>
          <button type="button" title={labels.newSchema} onClick={() => props.onCreateSchema(props.project.rootId)}>
            <StudioIcon name="newProject" />
          </button>
          <button type="button" title={labels.newTextFile} onClick={() => props.onCreateTextFile(props.project.rootId)}>
            <StudioIcon name="fileText" />
          </button>
          <button type="button" title={labels.newSqlFile} onClick={() => (props.onCreateSqlFile ?? props.onCreateTextFile)(props.project.rootId)}>
            <StudioIcon name="database" />
          </button>
          <button type="button" title={labels.newFolder} onClick={() => props.onCreateFolder(props.project.rootId)}>
            <StudioIcon name="openProject" />
          </button>
          <button type="button" title={t("projectExplorer.actions.collapseAll")} onClick={props.onCollapseAll}>
            <StudioIcon name="moveToTop" />
          </button>
          <button type="button" title={t("projectExplorer.actions.close")} onClick={props.onToggleOpen}>
            <StudioIcon name="panelLeft" />
          </button>
        </div>
      </div>

      <div className="project-explorer-tree" role="tree" aria-label={t("projectExplorer.treeAria")}>
        {root ? (
          <ul className="project-explorer-list">
            <ProjectExplorerTreeItem
              node={root}
              depth={0}
              activeFileId={props.view.activeFileId}
              expanded={expandedFolderIds.has(root.id)}
              childrenNodes={rootChildren}
              nodesById={nodesById}
              files={props.files}
              expandedFolderIds={expandedFolderIds}
              labels={labels}
              onOpenFile={props.onOpenFile}
              onToggleFolder={props.onToggleFolder}
              onRename={props.onRename}
              onDelete={props.onDelete}
              onCreateSchema={props.onCreateSchema}
              onCreateTextFile={props.onCreateTextFile}
              onCreateSqlFile={props.onCreateSqlFile}
              onCreateFolder={props.onCreateFolder}
            />
          </ul>
        ) : (
          <div className="project-explorer-empty">
            <StudioIcon name="openProject" aria-hidden="true" />
            <strong>{t("projectExplorer.empty.title")}</strong>
            <button type="button" onClick={() => props.onCreateSchema(props.project.rootId)}>
              {t("projectExplorer.empty.createSchema")}
            </button>
          </div>
        )}
      </div>

      {!props.embedded ? (
        <div
          className="project-explorer-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label={t("projectExplorer.resizeAria")}
          onPointerDown={props.onResizeStart}
        />
      ) : null}
    </aside>
  );
}
