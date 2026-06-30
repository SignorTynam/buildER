import type { SchemaFileDocument } from "../utils/projectSchemaFile";

export type ProjectExplorerNodeKind = "folder" | "schema" | "text" | "sql" | "unknown";

export interface ProjectExplorerNode {
  id: string;
  name: string;
  kind: ProjectExplorerNodeKind;
  parentId: string | null;
  children?: string[];
  fileId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWorkspaceFileBase {
  id: string;
  name: string;
  kind: ProjectExplorerNodeKind;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectSchemaWorkspaceFile extends ProjectWorkspaceFileBase {
  kind: "schema";
  schema: SchemaFileDocument;
}

export interface ProjectTextWorkspaceFile extends ProjectWorkspaceFileBase {
  kind: "text" | "sql" | "unknown";
  content: string;
}

export type ProjectWorkspaceFile = ProjectSchemaWorkspaceFile | ProjectTextWorkspaceFile;

export interface ProjectExplorerProject {
  id: string;
  name: string;
  rootId: string;
  activeFileId: string | null;
  fileTree: ProjectExplorerNode[];
}

export interface ProjectExplorerViewState {
  activeFileId: string | null;
  explorerOpen: boolean;
  explorerWidth: number;
  expandedFolderIds: string[];
}
