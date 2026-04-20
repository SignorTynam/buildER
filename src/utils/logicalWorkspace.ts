import type {
  LogicalModel,
  LogicalWorkspaceDocument,
} from "../types/logical";
import type { DiagramDocument } from "../types/diagram";
import {
  buildLogicalSourceSignature as buildLogicalTranslationSourceSignature,
  createEmptyLogicalModel as createEmptyLogicalTranslationModel,
  createEmptyLogicalWorkspace as createEmptyLogicalTranslationWorkspace,
  refreshLogicalWorkspace as refreshLogicalTranslationWorkspace,
  updateLogicalWorkspaceModel as updateLogicalTranslationWorkspaceModel,
} from "./logicalTranslation";

export {
  buildLogicalTranslationSourceSignature as buildLogicalSourceSignature,
  createEmptyLogicalTranslationModel as createEmptyLogicalModel,
};

export function createEmptyLogicalWorkspace(
  diagram: DiagramDocument,
  previousWorkspace?: LogicalWorkspaceDocument,
): LogicalWorkspaceDocument {
  return createEmptyLogicalTranslationWorkspace(diagram, previousWorkspace);
}

export function refreshLogicalWorkspace(
  diagram: DiagramDocument,
  workspace?: LogicalWorkspaceDocument,
): LogicalWorkspaceDocument {
  const baseWorkspace = workspace ?? createEmptyLogicalTranslationWorkspace(diagram);
  return refreshLogicalTranslationWorkspace(diagram, baseWorkspace);
}

export function updateLogicalWorkspaceModel(
  diagram: DiagramDocument,
  workspace: LogicalWorkspaceDocument,
  nextModel: LogicalModel,
): LogicalWorkspaceDocument {
  return updateLogicalTranslationWorkspaceModel(diagram, workspace, nextModel);
}
