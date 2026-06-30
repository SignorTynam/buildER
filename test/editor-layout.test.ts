import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appSource = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const workspaceLayoutStateSource = readFileSync(
  new URL("../src/hooks/useWorkspaceLayoutState.ts", import.meta.url),
  "utf8",
);
const editorCssSource = readFileSync(new URL("../src/styles/editor-refactor.css", import.meta.url), "utf8");
const panelsCssSource = readFileSync(new URL("../src/styles/panels.css", import.meta.url), "utf8");
const projectExplorerCssSource = readFileSync(new URL("../src/styles/project-explorer.css", import.meta.url), "utf8");
const appCommandCssSource = readFileSync(new URL("../src/styles/app-command-bar.css", import.meta.url), "utf8");
const allCssSource = `${editorCssSource}\n${panelsCssSource}\n${projectExplorerCssSource}`;

function cssBlock(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = editorCssSource.match(new RegExp(`${escapedSelector}\\s*\\{[\\s\\S]*?\\}`));
  assert.ok(match, `${selector} should exist`);
  return match[0];
}

test("ER code panel renders inside the unified workspace activity panel", () => {
  assert.doesNotMatch(appSource, /designer-workspace code-open/);
  assert.match(appSource, /<div className="designer-workspace">/);
  assert.match(appSource, /<ProjectActivityPanel/);

  const activityContentStart = appSource.indexOf("const activityPanelContent");
  const codePanelStart = appSource.indexOf("<CodePanel", activityContentStart);
  const activityPanelStart = appSource.indexOf("<ProjectActivityPanel", codePanelStart);
  const erWorkspaceStart = appSource.indexOf('<div className="designer-workspace">', codePanelStart);
  const canvasRegionStart = appSource.indexOf('className="designer-canvas-region"', erWorkspaceStart);

  assert.notEqual(activityContentStart, -1, "activity panel content should be defined");
  assert.notEqual(codePanelStart, -1, "CodePanel should be rendered in the activity panel content");
  assert.notEqual(activityPanelStart, -1, "workspace activity panel should exist");
  assert.notEqual(erWorkspaceStart, -1, "ER designer workspace should exist");
  assert.notEqual(canvasRegionStart, -1, "ER canvas region should remain plain");
  assert.ok(codePanelStart > activityContentStart);
  assert.ok(activityPanelStart > codePanelStart);
  assert.ok(erWorkspaceStart > codePanelStart);
  assert.ok(canvasRegionStart > erWorkspaceStart);
  assert.doesNotMatch(appSource, /designer-code-drawer/);
  assert.doesNotMatch(appSource, /designer-quick-actions-bar/);
});

test("ER code activity panel does not activate the legacy technical side panel layout", () => {
  assert.doesNotMatch(workspaceLayoutStateSource, /const technicalPanelVisible = technicalPanelOpen;/);
  assert.match(
    workspaceLayoutStateSource,
    /const technicalPanelVisible = technicalPanelOpen && technicalPanelTab !== "code";/,
  );

  const erShellBlock = cssBlock(".app-shell-view-er .er-workspace-shell");
  assert.match(erShellBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  assert.doesNotMatch(erShellBlock, /--technical-panel-width/);
  assert.doesNotMatch(erShellBlock, /--technical-panel-resizer-width/);

  const erShellClassStart = appSource.indexOf("const erWorkspaceShellClassName = [");
  const structuredShellClassStart = appSource.indexOf("const structuredWorkspaceShellClassName = [", erShellClassStart);
  const erShellClassBlock = appSource.slice(erShellClassStart, structuredShellClassStart);
  assert.doesNotMatch(erShellClassBlock, /technical-workspace-shell/);
});

test("ER code activity panel CSS keeps the workspace at one canvas column", () => {
  assert.doesNotMatch(allCssSource, /designer-workspace\.code-open[\s\S]*grid-template-columns:\s*minmax\(320px,\s*25vw\)\s+minmax\(0,\s*1fr\)/);
  assert.match(projectExplorerCssSource, /\.project-activity-panel\s*\{/);
  assert.match(projectExplorerCssSource, /\.project-activity-content \.designer-code-dock\s*\{/);

  const workspaceBlock = cssBlock(".designer-workspace");
  assert.match(workspaceBlock, /display:\s*grid/);
  assert.match(workspaceBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("ER canvas region remains full size with the activity panel open", () => {
  const canvasRegionBlock = cssBlock(".designer-canvas-region");

  assert.match(canvasRegionBlock, /position:\s*relative/);
  assert.match(canvasRegionBlock, /width:\s*100%/);
  assert.match(canvasRegionBlock, /height:\s*100%/);
  assert.match(canvasRegionBlock, /min-width:\s*0/);
  assert.match(canvasRegionBlock, /min-height:\s*0/);
  assert.match(canvasRegionBlock, /overflow:\s*hidden/);
  assert.doesNotMatch(appSource, /code-drawer-open/);
  assert.doesNotMatch(editorCssSource, /\.designer-canvas-region\.code-drawer-open \.designer-context-toolbar/);
  assert.doesNotMatch(editorCssSource, /\.designer-canvas-region\.code-drawer-open \.designer-quick-actions-bar/);
});

test("empty workspace renders welcome instead of canvas tooling", () => {
  assert.match(appSource, /const hasOpenSchema = Boolean\(activeSchemaFile\)/);
  assert.match(appSource, /!hasOpenSchema \? \(/);
  assert.match(appSource, /<WorkspaceWelcomePage/);

  const welcomeStart = appSource.indexOf("<WorkspaceWelcomePage");
  const toolbarStart = appSource.indexOf("<Toolbar", welcomeStart);
  assert.ok(toolbarStart > welcomeStart, "Toolbar must stay in the schema-only branch after welcome");
});

test("File menu stacking is above workspace activity and canvas controls", () => {
  assert.match(appCommandCssSource, /\.app-command-topbar[\s\S]*z-index:\s*1000/);
  assert.match(appCommandCssSource, /\.app-file-menu__panel[\s\S]*z-index:\s*10000/);
  assert.doesNotMatch(projectExplorerCssSource, /z-index:\s*10000/);
});
