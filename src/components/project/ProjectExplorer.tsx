import { useMemo, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import type {
  ProjectExplorerNode,
  ProjectExplorerProject,
  ProjectExplorerViewState,
  ProjectWorkspaceFile,
} from "../../types/projectExplorer";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";
import { ProjectExplorerContextMenu } from "./ProjectExplorerContextMenu";
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
  onSelectNode: (nodeId: string) => void;
}

export function ProjectExplorer(props: ProjectExplorerProps) {
  const { t } = useI18n();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; nodeId: string | null } | null>(null);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const nodesById = useMemo(
    () => new Map(props.project.fileTree.map((node) => [node.id, node])),
    [props.project.fileTree],
  );
  const root = nodesById.get(props.project.rootId);
  const rootChildren = (root?.children ?? [])
    .map((childId) => nodesById.get(childId))
    .filter((node): node is ProjectExplorerNode => Boolean(node));
  const expandedFolderIds = useMemo(() => new Set(props.view.expandedFolderIds), [props.view.expandedFolderIds]);
  const selectedNode = props.view.selectedNodeId ? nodesById.get(props.view.selectedNodeId) : undefined;
  const selectedTargetFolderId =
    selectedNode?.kind === "folder"
      ? selectedNode.id
      : selectedNode?.parentId ?? props.project.rootId;
  const contextNode = contextMenu?.nodeId ? nodesById.get(contextMenu.nodeId) ?? null : null;
  const contextTargetFolderId =
    contextNode?.kind === "folder"
      ? contextNode.id
      : contextNode?.parentId ?? props.project.rootId;
  const fileCount = Object.keys(props.files).length;
  const folderCount = props.project.fileTree.filter((node) => node.kind === "folder").length;
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
        <div className="project-explorer-title-block">
          <h2>{t("projectExplorer.title")}</h2>
          <span className="project-explorer-subtitle">{props.project.name}</span>
          <span className="project-explorer-meta">
            {t("projectExplorer.meta", { files: fileCount, folders: folderCount })}
          </span>
        </div>
        <div className="project-explorer-toolbar" aria-label={t("projectExplorer.actions.aria")}>
          <div className="project-explorer-toolbar-group">
          <button
            type="button"
            className="project-explorer-icon-button"
            aria-label={labels.newSchema}
            title={labels.newSchema}
            onClick={() => props.onCreateSchema(selectedTargetFolderId)}
          >
            <StudioIcon name="newProject" />
          </button>
          <button
            type="button"
            className="project-explorer-icon-button"
            aria-label={labels.newFolder}
            title={labels.newFolder}
            onClick={() => props.onCreateFolder(selectedTargetFolderId)}
          >
            <StudioIcon name="openProject" />
          </button>
          </div>
          <div className="project-explorer-toolbar-group">
          <button
            type="button"
            className="project-explorer-icon-button"
            aria-label={t("projectExplorer.actions.collapseAll")}
            title={t("projectExplorer.actions.collapseAll")}
            onClick={props.onCollapseAll}
          >
            <StudioIcon name="moveToTop" />
          </button>
          <button
            type="button"
            className="project-explorer-icon-button"
            aria-label={t("projectExplorer.actions.more")}
            title={t("projectExplorer.actions.more")}
            aria-haspopup="menu"
            aria-expanded={moreMenuOpen}
            onClick={() => setMoreMenuOpen((current) => !current)}
          >
            <StudioIcon name="menu" />
          </button>
          </div>
          {moreMenuOpen ? (
            <div className="project-explorer-more-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => { props.onCreateTextFile(selectedTargetFolderId); setMoreMenuOpen(false); }}>
                <StudioIcon name="fileText" aria-hidden="true" />
                <span>{labels.newTextFile}</span>
              </button>
              <button type="button" role="menuitem" onClick={() => { (props.onCreateSqlFile ?? props.onCreateTextFile)(selectedTargetFolderId); setMoreMenuOpen(false); }}>
                <StudioIcon name="database" aria-hidden="true" />
                <span>{labels.newSqlFile}</span>
              </button>
              <div className="project-explorer-more-menu__separator" role="separator" />
              <button type="button" role="menuitem" onClick={() => { props.onToggleOpen(); setMoreMenuOpen(false); }}>
                <StudioIcon name="close" aria-hidden="true" />
                <span>{t("projectExplorer.actions.close")}</span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="project-explorer-tree"
        role="tree"
        aria-label={t("projectExplorer.treeAria")}
        onContextMenu={(event) => {
          event.preventDefault();
          setContextMenu({ x: event.clientX, y: event.clientY, nodeId: null });
        }}
      >
        {root && rootChildren.length > 0 ? (
          <ul className="project-explorer-list">
            <ProjectExplorerTreeItem
              node={root}
              depth={0}
              activeFileId={props.view.activeFileId}
              selectedNodeId={props.view.selectedNodeId}
              expanded={expandedFolderIds.has(root.id)}
              childrenNodes={rootChildren}
              nodesById={nodesById}
              files={props.files}
              expandedFolderIds={expandedFolderIds}
              labels={labels}
              onOpenFile={props.onOpenFile}
              onSelectNode={props.onSelectNode}
              onContextMenu={(node, event) => {
                event.preventDefault();
                event.stopPropagation();
                props.onSelectNode(node.id);
                setContextMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
              }}
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
      <ProjectExplorerContextMenu
        open={Boolean(contextMenu)}
        x={contextMenu?.x ?? 0}
        y={contextMenu?.y ?? 0}
        node={contextNode}
        rootId={props.project.rootId}
        canCreateChildren={!contextNode || contextNode.kind === "folder"}
        onOpen={() => {
          if (contextNode?.fileId) {
            props.onOpenFile(contextNode.fileId);
          }
        }}
        onNewSchema={() => props.onCreateSchema(contextTargetFolderId)}
        onNewTextFile={() => props.onCreateTextFile(contextTargetFolderId)}
        onNewSqlFile={() => (props.onCreateSqlFile ?? props.onCreateTextFile)(contextTargetFolderId)}
        onNewFolder={() => props.onCreateFolder(contextTargetFolderId)}
        onRename={() => {
          if (contextNode) {
            props.onRename(contextNode.id);
          }
        }}
        onDelete={() => {
          if (contextNode) {
            props.onDelete(contextNode.id);
          }
        }}
        onClose={() => setContextMenu(null)}
      />
    </aside>
  );
}
