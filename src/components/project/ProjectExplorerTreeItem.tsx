import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import type { ProjectExplorerNode, ProjectWorkspaceFile } from "../../types/projectExplorer";
import { StudioIcon, type StudioIconName } from "../icons/StudioIcon";

interface ProjectExplorerTreeItemProps {
  node: ProjectExplorerNode;
  depth: number;
  activeFileId: string | null;
  selectedNodeId: string | null;
  expanded: boolean;
  file?: ProjectWorkspaceFile;
  childrenNodes: ProjectExplorerNode[];
  nodesById: Map<string, ProjectExplorerNode>;
  files: Record<string, ProjectWorkspaceFile>;
  expandedFolderIds: Set<string>;
  labels: {
    rename: string;
    delete: string;
    newSchema: string;
    newTextFile: string;
    newSqlFile: string;
    newFolder: string;
  };
  onOpenFile: (fileId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onContextMenu: (node: ProjectExplorerNode, event: ReactMouseEvent) => void;
  onToggleFolder: (folderId: string) => void;
  onRename: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onCreateSchema: (parentId: string) => void;
  onCreateTextFile: (parentId: string) => void;
  onCreateSqlFile?: (parentId: string) => void;
  onCreateFolder: (parentId: string) => void;
}

function getProjectNodeIcon(node: ProjectExplorerNode): StudioIconName {
  if (node.kind === "folder") {
    return "openProject";
  }
  if (node.kind === "schema") {
    return "entity";
  }
  if (node.kind === "sql") {
    return "database";
  }
  if (node.kind === "text") {
    return "fileText";
  }
  return "type";
}

function getProjectFileExtensionLabel(node: ProjectExplorerNode, file?: ProjectWorkspaceFile): string {
  if (node.kind === "folder") {
    return "folder";
  }

  const name = file?.name ?? node.name;
  if (node.kind === "schema") {
    return ".erschema";
  }
  if (node.kind === "sql") {
    return ".sql";
  }
  if (node.kind === "text") {
    return ".txt";
  }

  const extension = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  return extension || "file";
}

function getProjectFileKindLabel(node: ProjectExplorerNode): string {
  if (node.kind === "schema") return "Schema";
  if (node.kind === "sql") return "SQL";
  if (node.kind === "text") return "Text";
  if (node.kind === "folder") return "Folder";
  return "File";
}

export function ProjectExplorerTreeItem(props: ProjectExplorerTreeItemProps) {
  const isFolder = props.node.kind === "folder";
  const isActive = props.node.fileId != null && props.node.fileId === props.activeFileId;
  const isSelected = props.node.id === props.selectedNodeId;
  const extensionLabel = getProjectFileExtensionLabel(props.node, props.file);
  const childCount = props.childrenNodes.length;
  const rowClassName = [
    "project-explorer-item",
    isFolder ? "folder" : "file",
    isActive ? "active" : "",
    isSelected ? "selected" : "",
  ].filter(Boolean).join(" ");

  function stopAndRun(event: ReactMouseEvent, action: () => void) {
    event.preventDefault();
    event.stopPropagation();
    action();
  }

  function activateNode() {
    props.onSelectNode(props.node.id);
    if (isFolder) {
      props.onToggleFolder(props.node.id);
    } else if (props.node.fileId) {
      props.onOpenFile(props.node.fileId);
    }
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    activateNode();
  }

  return (
    <li className="project-explorer-node">
      <div
        className={rowClassName}
        style={{ "--project-explorer-depth": props.depth } as CSSProperties}
        role="treeitem"
        tabIndex={0}
        aria-expanded={isFolder ? props.expanded : undefined}
        aria-selected={isSelected}
        aria-current={isActive ? "page" : undefined}
        aria-label={`${props.node.name}, ${getProjectFileKindLabel(props.node)}`}
        onContextMenu={(event) => props.onContextMenu(props.node, event)}
        onKeyDown={handleKeyDown}
        onClick={activateNode}
      >
        <div className="project-explorer-item__main">
          {isFolder ? (
            <button
              type="button"
              className="project-explorer-item__chevron"
              aria-label={props.expanded ? "Collapse folder" : "Expand folder"}
              onClick={(event) => stopAndRun(event, () => props.onToggleFolder(props.node.id))}
            >
              <StudioIcon name={props.expanded ? "arrowDown" : "arrowRight"} aria-hidden="true" />
            </button>
          ) : (
            <span className="project-explorer-item__chevron" aria-hidden="true" />
          )}
          <span className="project-explorer-item__icon" aria-hidden="true">
            <StudioIcon name={getProjectNodeIcon(props.node)} />
          </span>
          <span className="project-explorer-item__name" title={props.node.name}>{props.node.name}</span>
          <span className="project-explorer-item__extension">{extensionLabel}</span>
          {isFolder && childCount === 0 ? <span className="project-explorer-item__empty">empty</span> : null}
        </div>
        <span className="project-explorer-item__actions">
          {isFolder ? (
            <>
              <button type="button" title={props.labels.newSchema} onClick={(event) => stopAndRun(event, () => props.onCreateSchema(props.node.id))}>
                <StudioIcon name="newProject" />
              </button>
              <button type="button" title={props.labels.newFolder} onClick={(event) => stopAndRun(event, () => props.onCreateFolder(props.node.id))}>
                <StudioIcon name="openProject" />
              </button>
            </>
          ) : null}
          <button type="button" title={props.labels.rename} onClick={(event) => stopAndRun(event, () => props.onRename(props.node.id))}>
            <StudioIcon name="rename" />
          </button>
          <button type="button" title={props.labels.delete} onClick={(event) => stopAndRun(event, () => props.onDelete(props.node.id))}>
            <StudioIcon name="delete" />
          </button>
        </span>
      </div>

      {isFolder && props.expanded && props.childrenNodes.length > 0 ? (
        <ul className="project-explorer-children">
          {props.childrenNodes.map((child) => (
            <ProjectExplorerTreeItem
              key={child.id}
              {...props}
              node={child}
              depth={props.depth + 1}
              expanded={props.expandedFolderIds.has(child.id)}
              file={child.fileId ? props.files[child.fileId] : undefined}
              childrenNodes={(child.children ?? [])
                .map((childId) => props.nodesById.get(childId))
                .filter((candidate): candidate is ProjectExplorerNode => Boolean(candidate))}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
