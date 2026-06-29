import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import test from "node:test";

const PROJECT_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_ROOT = join(PROJECT_ROOT, "src");

function listFiles(root: string, predicate: (filePath: string) => boolean): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(root, entry);
    const stats = statSync(entryPath);
    if (stats.isDirectory()) {
      files.push(...listFiles(entryPath, predicate));
    } else if (predicate(entryPath)) {
      files.push(entryPath);
    }
  }

  return files;
}

const cssFiles = listFiles(SRC_ROOT, (filePath) => filePath.endsWith(".css"));
const tsxFiles = listFiles(SRC_ROOT, (filePath) => filePath.endsWith(".tsx"));
const approvedRoundedIconSelectors = [
  ".designer-topbar-actions .designer-icon-button",
  ".studio-modal__close",
  ".help-close",
  ".notes-modal-close",
  ".entity-key-modal-close",
  ".command-palette-close",
  ".shortcuts-sheet-close",
  ".command-palette-title-icon",
  ".command-palette-item-icon",
  ".errors-modal-heading-icon",
  ".errors-modal-item-icon",
  ".errors-modal-diagnostics-icon",
  ".versioning-status-icon",
  ".versioning-restore-icon",
];

function readProjectFile(filePath: string): string {
  return readFileSync(filePath, "utf8");
}

function displayPath(filePath: string): string {
  return relative(PROJECT_ROOT, filePath).replace(/\\/g, "/");
}

test("ui radius tokens are zero", () => {
  const requiredTokens = [
    "--studio-radius-sm",
    "--studio-radius-md",
    "--studio-radius-lg",
    "--studio-radius-xl",
    "--studio-radius-panel",
    "--editor-radius-sm",
    "--editor-radius-md",
    "--editor-radius-lg",
    "--panel-radius",
  ];
  const cssByPath = new Map(cssFiles.map((filePath) => [displayPath(filePath), readProjectFile(filePath)]));
  const allCss = [...cssByPath.values()].join("\n");

  for (const token of requiredTokens) {
    assert.match(allCss, new RegExp(`${token.replaceAll("-", "\\-")}\\s*:\\s*0\\s*;`), `${token} must be set to 0`);
  }

  const nonZeroRadiusTokens: string[] = [];
  for (const [filePath, content] of cssByPath) {
    for (const match of content.matchAll(/(--[A-Za-z0-9_-]*radius[A-Za-z0-9_-]*)\s*:\s*([^;]+);/g)) {
      if (match[2].trim() !== "0") {
        nonZeroRadiusTokens.push(`${filePath}: ${match[1]}: ${match[2].trim()}`);
      }
    }
  }

  assert.deepEqual(nonZeroRadiusTokens, []);
});

function isApprovedRoundedIconSelector(selectorText: string): boolean {
  const selectors = selectorText
    .split(",")
    .map((selector) => selector.trim())
    .filter(Boolean);
  return selectors.every((selector) => approvedRoundedIconSelectors.includes(selector));
}

test("css does not define rounded ui border radius outside approved icon exceptions", () => {
  const invalidDeclarations: string[] = [];

  for (const filePath of cssFiles) {
    const content = readProjectFile(filePath);
    for (const match of content.matchAll(/([^{}]+)\{([^{}]*border-radius\s*:\s*([^;]+);[^{}]*)\}/g)) {
      const selectorText = match[1].trim();
      const value = match[3].trim();
      if (value !== "0" && value !== "0 !important" && !isApprovedRoundedIconSelector(selectorText)) {
        invalidDeclarations.push(`${displayPath(filePath)}: ${selectorText} { border-radius: ${value}; }`);
      }
    }
  }

  assert.deepEqual(invalidDeclarations, []);
});

test("approved rounded icon exceptions stay explicit", () => {
  const indexCss = readProjectFile(join(SRC_ROOT, "index.css"));

  assert.match(
    indexCss,
    /\.designer-topbar-actions \.designer-icon-button,[\s\S]*\.shortcuts-sheet-close\s*\{\s*border-radius:\s*999px !important;\s*\}/,
  );
  assert.match(
    indexCss,
    /\.command-palette-title-icon,[\s\S]*\.versioning-restore-icon\s*\{\s*border-radius:\s*10px !important;\s*\}/,
  );
});

test("tsx files do not use inline borderRadius", () => {
  const offenders: string[] = [];

  for (const filePath of tsxFiles) {
    const content = readProjectFile(filePath);
    if (/borderRadius|["']border-radius["']/.test(content)) {
      offenders.push(displayPath(filePath));
    }
  }

  assert.deepEqual(offenders, []);
});
