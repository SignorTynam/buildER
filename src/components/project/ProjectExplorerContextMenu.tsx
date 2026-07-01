import { useEffect } from "react";
import type { ProjectExplorerNode } from "../../types/projectExplorer";
import { useI18n } from "../../i18n/useI18n";
import { StudioIcon } from "../icons/StudioIcon";

interface ProjectExplorerContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  node: ProjectExplorerNode | null;
  rootId: string;
  canCreateChildren: boolean;
  onOpen: () => void;
  onNewSchema: () => void;
  onNewTextFile: () => void;
  onNewSqlFile: () => void;
  onNewFolder: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ProjectExplorerContextMenu({
  open,
  x,
  y,
  node,
  rootId,
  canCreateChildren,
  onOpen,
  onNewSchema,
  onNewTextFile,
  onNewSqlFile,
  onNewFolder,
  onRename,
  onDelete,
  onClose,
}: ProjectExplorerContextMenuProps) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    function handlePointerDown() {
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  const canDelete = Boolean(node && node.id !== rootId);
  const viewportWidth = typeof window === "undefined" ? 1024 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 768 : window.innerHeight;
  const left = Math.min(x, Math.max(0, viewportWidth - 230));
  const top = Math.min(y, Math.max(0, viewportHeight - 250));

  function run(action: () => void) {
    action();
    onClose();
  }

  return (
    <div
      className="project-explorer-context-menu"
      role="menu"
      style={{ left, top }}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {node && node.kind !== "folder" ? (
        <button type="button" role="menuitem" onClick={() => run(onOpen)}>
          <StudioIcon name="openProject" aria-hidden="true" />
          <span>{t("projectExplorer.contextMenu.open")}</span>
        </button>
      ) : null}
      {canCreateChildren ? (
        <>
          <button type="button" role="menuitem" onClick={() => run(onNewSchema)}>
            <StudioIcon name="newProject" aria-hidden="true" />
            <span>{t("projectExplorer.contextMenu.newSchema")}</span>
          </button>
          <button type="button" role="menuitem" onClick={() => run(onNewTextFile)}>
            <StudioIcon name="fileText" aria-hidden="true" />
            <span>{t("projectExplorer.contextMenu.newTextFile")}</span>
          </button>
          <button type="button" role="menuitem" onClick={() => run(onNewSqlFile)}>
            <StudioIcon name="database" aria-hidden="true" />
            <span>{t("projectExplorer.contextMenu.newSqlFile")}</span>
          </button>
          <button type="button" role="menuitem" onClick={() => run(onNewFolder)}>
            <StudioIcon name="openProject" aria-hidden="true" />
            <span>{t("projectExplorer.contextMenu.newFolder")}</span>
          </button>
        </>
      ) : null}
      {node ? (
        <>
          <div className="project-explorer-context-menu__separator" role="separator" />
          <button type="button" role="menuitem" onClick={() => run(onRename)}>
            <StudioIcon name="rename" aria-hidden="true" />
            <span>{t("projectExplorer.contextMenu.rename")}</span>
          </button>
          <button type="button" role="menuitem" disabled={!canDelete} onClick={() => run(onDelete)}>
            <StudioIcon name="delete" aria-hidden="true" />
            <span>{t("projectExplorer.contextMenu.delete")}</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
