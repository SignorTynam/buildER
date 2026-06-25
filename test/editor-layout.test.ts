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
const allCssSource = `${editorCssSource}\n${panelsCssSource}`;

function cssBlock(selector: string): string {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = editorCssSource.match(new RegExp(`${escapedSelector}\\s*\\{[\\s\\S]*?\\}`));
  assert.ok(match, `${selector} should exist`);
  return match[0];
}

test("ER code panel renders as a drawer inside the canvas region", () => {
  assert.doesNotMatch(appSource, /designer-workspace code-open/);
  assert.match(appSource, /<div className="designer-workspace">/);
  assert.match(
    appSource,
    /<div className=\{codePanelOpen \? "designer-canvas-region code-drawer-open" : "designer-canvas-region"\}>/,
  );

  const erWorkspaceStart = appSource.indexOf('<div className="designer-workspace">');
  const canvasRegionStart = appSource.indexOf("designer-canvas-region code-drawer-open", erWorkspaceStart);
  const codeDrawerStart = appSource.indexOf('className="designer-code-drawer"', canvasRegionStart);
  const codePanelStart = appSource.indexOf("<CodePanel", codeDrawerStart);
  const quickActionsStart = appSource.indexOf("designer-quick-actions-bar", codePanelStart);

  assert.notEqual(erWorkspaceStart, -1, "ER designer workspace should exist");
  assert.notEqual(canvasRegionStart, -1, "ER canvas region should own the open state class");
  assert.notEqual(codeDrawerStart, -1, "Code drawer wrapper should exist");
  assert.notEqual(codePanelStart, -1, "CodePanel should be rendered inside the drawer");
  assert.notEqual(quickActionsStart, -1, "quick actions should render after the drawer overlay");
  assert.ok(canvasRegionStart > erWorkspaceStart);
  assert.ok(codeDrawerStart > canvasRegionStart);
  assert.ok(codePanelStart > codeDrawerStart);
  assert.ok(quickActionsStart > codePanelStart);
});

test("ER code drawer does not activate the legacy technical side panel layout", () => {
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

test("ER code drawer CSS keeps the workspace at one canvas column", () => {
  assert.doesNotMatch(allCssSource, /designer-workspace\.code-open[\s\S]*grid-template-columns:\s*minmax\(320px,\s*25vw\)\s+minmax\(0,\s*1fr\)/);
  assert.match(editorCssSource, /\.designer-code-drawer\s*\{/);

  const workspaceBlock = cssBlock(".designer-workspace");
  assert.match(workspaceBlock, /display:\s*grid/);
  assert.match(workspaceBlock, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});

test("ER canvas region remains full size when the code drawer is open", () => {
  const canvasRegionBlock = cssBlock(".designer-canvas-region");
  const codeDrawerBlock = cssBlock(".designer-code-drawer");

  assert.match(canvasRegionBlock, /position:\s*relative/);
  assert.match(canvasRegionBlock, /width:\s*100%/);
  assert.match(canvasRegionBlock, /height:\s*100%/);
  assert.match(canvasRegionBlock, /min-width:\s*0/);
  assert.match(canvasRegionBlock, /min-height:\s*0/);
  assert.match(canvasRegionBlock, /overflow:\s*hidden/);
  assert.match(codeDrawerBlock, /position:\s*absolute/);
  assert.doesNotMatch(codeDrawerBlock, /width:\s*100%/);
  assert.match(editorCssSource, /\.designer-canvas-region\.code-drawer-open \.designer-context-toolbar/);
  assert.match(editorCssSource, /\.designer-canvas-region\.code-drawer-open \.designer-quick-actions-bar/);
});
