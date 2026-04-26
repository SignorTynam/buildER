import type { ToolKind } from "../types/diagram";
import { translate } from "../i18n";

export interface ToolDefinition {
  tool: ToolKind;
  label: string;
  description: string;
  shortcut: string;
}

const TOOL_DEFINITION_CONFIG: Array<{
  tool: ToolKind;
  labelKey: Parameters<typeof translate>[0];
  descriptionKey: Parameters<typeof translate>[0];
  shortcut: string;
}> = [
  {
    tool: "select",
    labelKey: "toolbar.tools.select",
    descriptionKey: "toolbar.toolDescriptions.select",
    shortcut: "v",
  },
  {
    tool: "move",
    labelKey: "toolbar.tools.move",
    descriptionKey: "toolbar.toolDescriptions.move",
    shortcut: "s",
  },
  {
    tool: "entity",
    labelKey: "toolbar.tools.entity",
    descriptionKey: "toolbar.toolDescriptions.entity",
    shortcut: "e",
  },
  {
    tool: "relationship",
    labelKey: "toolbar.tools.relationship",
    descriptionKey: "toolbar.toolDescriptions.relationship",
    shortcut: "r",
  },
  {
    tool: "attribute",
    labelKey: "toolbar.tools.attribute",
    descriptionKey: "toolbar.toolDescriptions.attribute",
    shortcut: "a",
  },
  {
    tool: "connector",
    labelKey: "toolbar.tools.connector",
    descriptionKey: "toolbar.toolDescriptions.connector",
    shortcut: "c",
  },
  {
    tool: "inheritance",
    labelKey: "toolbar.tools.inheritance",
    descriptionKey: "toolbar.toolDescriptions.inheritance",
    shortcut: "g",
  },
  {
    tool: "delete",
    labelKey: "toolbar.tools.delete",
    descriptionKey: "toolbar.toolDescriptions.delete",
    shortcut: "x",
  },
];

export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITION_CONFIG.map((item) => ({
    tool: item.tool,
    label: translate(item.labelKey),
    description: translate(item.descriptionKey),
    shortcut: item.shortcut,
  }));
}

export const TOOL_BY_SHORTCUT: Record<string, ToolKind> = TOOL_DEFINITION_CONFIG.reduce(
  (result, item) => {
    result[item.shortcut] = item.tool;
    return result;
  },
  {} as Record<string, ToolKind>,
);

export function getToolLabelsByKind(): Record<ToolKind, string> {
  return getToolDefinitions().reduce(
    (result, item) => {
      result[item.tool] = item.label;
      return result;
    },
    {} as Record<ToolKind, string>,
  );
}

export function getToolLabel(tool: ToolKind): string {
  return getToolLabelsByKind()[tool];
}
