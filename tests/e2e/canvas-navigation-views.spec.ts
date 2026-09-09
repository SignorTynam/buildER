import AxeBuilder from "@axe-core/playwright";
import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";
import type { DiagramDocument, DiagramEdge, DiagramNode } from "../../src/types/diagram";
import { parseDiagram, serializeDiagram } from "../../src/utils/diagram";
import { createEmptyErTranslationWorkspace } from "../../src/utils/erTranslation";
import {
  applyLogicalTranslationChoice,
  buildLogicalTranslationOverview,
  createEmptyLogicalWorkspace,
  getLogicalTranslationChoicesForItem,
} from "../../src/utils/logicalTranslation";
import { createEmptyProjectVersioningState, serializeProjectFile } from "../../src/utils/projectFile";
import { createEmptySchemaDocument, createProjectFromSchema } from "../../src/utils/projectExplorer";

const VIEWPORT = { x: 180, y: 110, zoom: 1 };

function createNavigationProject(): string {
  const entities: Array<Extract<DiagramNode, { type: "entity" }>> = [
    {
      id: "student", type: "entity", label: "STUDENT", x: 80, y: 90, width: 160, height: 80,
      internalIdentifiers: [{ id: "student-pk", attributeIds: ["student-id"] }],
      relationshipParticipations: [],
    },
    {
      id: "course", type: "entity", label: "COURSE", x: 620, y: 360, width: 160, height: 80,
      internalIdentifiers: [{ id: "course-pk", attributeIds: ["course-id"] }],
      relationshipParticipations: [],
    },
  ];
  const attributes: Array<Extract<DiagramNode, { type: "attribute" }>> = [
    { id: "student-id", type: "attribute", label: "id", x: 20, y: 10, width: 100, height: 40, isIdentifier: true },
    { id: "student-name", type: "attribute", label: "name", x: 20, y: 220, width: 100, height: 40 },
    { id: "course-id", type: "attribute", label: "id", x: 820, y: 280, width: 100, height: 40, isIdentifier: true },
    { id: "course-title", type: "attribute", label: "title", x: 820, y: 500, width: 100, height: 40 },
  ];
  const edges: DiagramEdge[] = [
    { id: "student-id-edge", type: "attribute", sourceId: "student-id", targetId: "student", label: "", lineStyle: "solid" },
    { id: "student-name-edge", type: "attribute", sourceId: "student-name", targetId: "student", label: "", lineStyle: "solid" },
    { id: "course-id-edge", type: "attribute", sourceId: "course-id", targetId: "course", label: "", lineStyle: "solid" },
    { id: "course-title-edge", type: "attribute", sourceId: "course-title", targetId: "course", label: "", lineStyle: "solid" },
  ];
  const diagram = parseDiagram(serializeDiagram({
    meta: { name: "navigation", version: 3 }, notes: "", nodes: [...entities, ...attributes], edges,
  } satisfies DiagramDocument));
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  let logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  for (let guard = 0; guard < 20; guard += 1) {
    const overview = buildLogicalTranslationOverview(translationWorkspace.translatedDiagram, logicalWorkspace);
    const item = overview.itemsByStep.entities.find((candidate) => candidate.status === "pending");
    if (!item) break;
    const choices = getLogicalTranslationChoicesForItem(overview, item);
    const choice = choices.find((candidate) => candidate.recommended) ?? choices[0];
    if (!choice) throw new Error(`Missing logical choice for ${item.label}.`);
    logicalWorkspace = applyLogicalTranslationChoice(
      translationWorkspace.translatedDiagram,
      logicalWorkspace,
      choice,
      item.targetType,
      item.id,
    );
  }

  const schema = createEmptySchemaDocument("navigation.erschema");
  schema.diagram = diagram;
  schema.translationWorkspace = translationWorkspace;
  schema.logicalWorkspace = logicalWorkspace;
  schema.logicalGenerated = true;
  schema.logicalStage = "schema";
  schema.view = { ...schema.view, current: "logical", logicalViewport: VIEWPORT, translationViewport: VIEWPORT };
  const explorer = createProjectFromSchema("Navigation project", schema);
  const activeFile = explorer.files[explorer.project.activeFileId ?? ""];
  if (!activeFile || activeFile.kind !== "schema") throw new Error("Missing navigation schema.");
  return serializeProjectFile({
    diagram: activeFile.schema.diagram,
    translationWorkspace: activeFile.schema.translationWorkspace,
    logicalWorkspace: activeFile.schema.logicalWorkspace,
    logicalGenerated: true,
    logicalStage: "schema",
    diagramView: "logical",
    viewport: VIEWPORT,
    translationViewport: VIEWPORT,
    logicalViewport: VIEWPORT,
    workspace: activeFile.schema.workspace,
    versioning: createEmptyProjectVersioningState(),
    project: explorer.project,
    files: explorer.files,
    explorerView: explorer.view,
  });
}

async function bootProject(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("chen-er-diagram-studio:locale", "it");
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.locator('input[type="file"][accept*=".ersp"]').setInputFiles({
    name: "navigation.ersp",
    mimeType: "application/json",
    buffer: Buffer.from(createNavigationProject()),
  });
  await expect(page.locator(".project-file-tab.active")).toContainText("navigation.erschema");
}

function diagramNodeSnapshot(page: Page) {
  return page.locator(".diagram-node").evaluateAll((nodes) =>
    nodes.map((node) => {
      const shape = node.querySelector("rect, ellipse, polygon");
      return [node.getAttribute("aria-label"), ...["x", "y", "cx", "cy", "points"].map((name) => shape?.getAttribute(name))];
    }),
  );
}

function logicalTableSnapshot(page: Page) {
  return page.locator(".logical-table").evaluateAll((nodes) =>
    nodes.map((node) => {
      const shape = node.querySelector(".logical-table-body");
      return [node.getAttribute("aria-label"), shape?.getAttribute("x"), shape?.getAttribute("y")];
    }),
  );
}

async function expectNavigationSurface(page: Page, canvasSelector: string) {
  const canvas = page.locator(canvasSelector);
  const hud = canvas.getByRole("group", { name: "Controlli viewport" });
  await expect(hud.getByRole("button")).toHaveCount(5);
  await expect(hud.getByRole("button", { name: "Inquadra l'intero diagramma" })).toBeVisible();
  await expect(hud.getByRole("button", { name: "Inquadra la selezione corrente" })).toBeVisible();
  const targetSizes = await hud.getByRole("button").evaluateAll((buttons) =>
    buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    }),
  );
  expect(targetSizes.every(({ width, height }) => width >= 32 && height >= 32)).toBe(true);
  await expect(canvas.getByRole("complementary", { name: "Minimappa" })).toBeVisible();
  const accessibility = await new AxeBuilder({ page }).include(canvasSelector).analyze();
  expect(accessibility.violations).toEqual([]);
}

async function expectToolbarOrientation(page: Page, expected: "column" | "row") {
  const toolbar = page.locator(".designer-context-toolbar");
  const geometry = await toolbar.evaluate((toolbar) => {
    const buttons = Array.from(toolbar.querySelectorAll<HTMLElement>("button"));
    const buttonBounds = buttons.map((button) => button.getBoundingClientRect());
    const bounds = toolbar.getBoundingClientRect();
    const canvas = toolbar.closest<HTMLElement>(".designer-canvas-region")?.getBoundingClientRect();
    return {
      direction: getComputedStyle(toolbar).flexDirection,
      rows: new Set(buttonBounds.map((rect) => Math.round(rect.top))).size,
      columns: new Set(buttonBounds.map((rect) => Math.round(rect.left))).size,
      buttons: buttons.length,
      insideCanvas:
        canvas != null &&
        bounds.left >= canvas.left - 1 &&
        bounds.right <= canvas.right + 1 &&
        bounds.top >= canvas.top - 1 &&
        bounds.bottom <= canvas.bottom + 1,
    };
  });

  expect(geometry.direction).toBe(expected);
  expect(geometry.insideCanvas).toBe(true);
  if (expected === "column") {
    expect(geometry.columns).toBe(1);
    expect(geometry.rows).toBe(geometry.buttons);
  } else {
    expect(geometry.rows).toBe(1);
  }
}

test("Translate and Logic toolboxes match the ER desktop and compact orientations", async ({ page }) => {
  test.setTimeout(60_000);
  await bootProject(page);

  await expectToolbarOrientation(page, "column");
  await page.getByRole("group", { name: "Vista dello schema" }).getByRole("button", { name: "Traduzione" }).click();
  await expectToolbarOrientation(page, "column");

  await page.setViewportSize({ width: 768, height: 1024 });
  await expect.poll(() => page.locator(".designer-context-toolbar").evaluate((toolbar) => getComputedStyle(toolbar).flexDirection)).toBe("row");
  await expectToolbarOrientation(page, "row");
  await page.keyboard.press("Escape");
  await page.getByRole("group", { name: "Vista dello schema" }).getByRole("button", { name: "Logico" }).click();
  await expectToolbarOrientation(page, "row");
});

test("Translate and Logic expose complete canvas navigation and reversible auto-layout", async ({ page }) => {
  test.setTimeout(60_000);
  await bootProject(page);

  await page.getByRole("group", { name: "Vista dello schema" }).getByRole("button", { name: "Traduzione" }).click();
  await expectNavigationSurface(page, ".designer-translation-canvas");
  const translationBefore = await diagramNodeSnapshot(page);
  await page.getByRole("toolbar", { name: "Restructuring tools" }).getByRole("button", { name: "Organizza" }).click();
  let dialog = page.getByRole("dialog", { name: "Organizzare il diagramma tradotto?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Organizza", exact: true }).click();
  await expect.poll(() => diagramNodeSnapshot(page)).not.toEqual(translationBefore);
  await page.getByRole("toolbar", { name: "Restructuring tools" }).getByRole("button", { name: "Annulla" }).click();
  await expect.poll(() => diagramNodeSnapshot(page)).toEqual(translationBefore);
  await page.getByTestId("app-header-menu").click();
  await page.getByTestId("command-menu-search").fill("Inquadra");
  await expect(page.getByRole("option", { name: /Inquadra tutto/ })).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("option", { name: /Inquadra selezione/ })).not.toHaveAttribute("aria-disabled", "true");
  await page.keyboard.press("Escape");

  await page.getByRole("group", { name: "Vista dello schema" }).getByRole("button", { name: "Logico" }).click();
  await expectNavigationSurface(page, ".designer-logical-canvas");
  const logicalCanvas = page.locator(".logical-canvas-panel");
  await logicalCanvas.locator('[aria-label="Tabella STUDENT"] .logical-table-header').click();
  const beforeSelectionFit = await logicalCanvas.locator("g[data-export-world]").getAttribute("transform");
  await logicalCanvas.press("Shift+2");
  await expect.poll(() => logicalCanvas.locator("g[data-export-world]").getAttribute("transform")).not.toBe(beforeSelectionFit);

  const logicalBefore = await logicalTableSnapshot(page);
  await page.getByRole("toolbar", { name: "Strumenti schema logico" }).getByRole("button", { name: "Organizza" }).click();
  dialog = page.getByRole("dialog", { name: "Organizzare il diagramma logico?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Annulla" }).click();
  await logicalCanvas.press("Shift+L");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Organizza", exact: true }).click();
  await expect.poll(() => logicalTableSnapshot(page)).not.toEqual(logicalBefore);
  await page.getByRole("toolbar", { name: "Strumenti schema logico" }).getByRole("button", { name: "Annulla" }).click();
  await expect.poll(() => logicalTableSnapshot(page)).toEqual(logicalBefore);

  await page.getByTestId("app-header-menu").click();
  await page.getByTestId("command-menu-search").fill("Inquadra");
  await expect(page.getByRole("option", { name: /Inquadra tutto/ })).not.toHaveAttribute("aria-disabled", "true");
  await expect(page.getByRole("option", { name: /Inquadra selezione/ })).not.toHaveAttribute("aria-disabled", "true");
});

test("Translate and Logic minimaps default to collapsed below 860px", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 760 });
  await bootProject(page);
  await expect(page.getByRole("button", { name: "Mostra minimappa" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Minimappa" })).toHaveCount(0);

  await page.getByRole("complementary", { name: "Explorer" }).getByRole("button", { name: "Chiudi Explorer" }).click();
  await page.getByRole("group", { name: "Vista dello schema" }).getByRole("button", { name: "Traduzione" }).click();
  await expect(page.getByRole("button", { name: "Mostra minimappa" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Minimappa" })).toHaveCount(0);
});
