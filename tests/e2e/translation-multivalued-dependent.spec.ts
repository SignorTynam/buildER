import { Buffer } from "node:buffer";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import type { DiagramDocument } from "../../src/types/diagram";
import { parseDiagram, serializeDiagram } from "../../src/utils/diagram";
import { createEmptyErTranslationWorkspace } from "../../src/utils/erTranslation";
import { createEmptyLogicalWorkspace } from "../../src/utils/logicalTranslation";
import { createEmptyProjectVersioningState, serializeProjectFile } from "../../src/utils/projectFile";
import { createEmptySchemaDocument, createProjectFromSchema } from "../../src/utils/projectExplorer";

const VIEWPORT = { x: 180, y: 110, zoom: 1 };
const SCREENSHOT_DIR = process.env.BUILDER_SCREENSHOT_DIR;

async function captureEvidence(page: Page, filename: string) {
  if (SCREENSHOT_DIR) {
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, filename), fullPage: false });
  }
}

function createDependentProject(): string {
  const diagram = parseDiagram(serializeDiagram({
    meta: { name: "Dependent multivalued", version: 3 },
    notes: "",
    nodes: [
      {
        id: "CON", type: "entity", label: "CON", x: 220, y: 240, width: 160, height: 80,
        internalIdentifiers: [{ id: "con-pk", attributeIds: ["idCon"] }],
        relationshipParticipations: [],
      },
      { id: "idCon", type: "attribute", label: "idCon", x: 80, y: 160, width: 100, height: 40, isIdentifier: true },
      {
        id: "tag", type: "attribute", label: "TAG", x: 500, y: 240, width: 100, height: 40,
        isIdentifier: false, isCompositeInternal: false, isMultivalued: false, cardinality: "(0,3)",
      },
    ],
    edges: [
      { id: "idCon-edge", type: "attribute", sourceId: "idCon", targetId: "CON", label: "", lineStyle: "solid" },
      { id: "tag-edge", type: "attribute", sourceId: "tag", targetId: "CON", label: "", lineStyle: "solid" },
    ],
  } satisfies DiagramDocument));
  const translationWorkspace = createEmptyErTranslationWorkspace(diagram);
  const logicalWorkspace = createEmptyLogicalWorkspace(translationWorkspace.translatedDiagram);
  const schema = createEmptySchemaDocument("dependent.erschema");
  schema.diagram = diagram;
  schema.translationWorkspace = translationWorkspace;
  schema.logicalWorkspace = logicalWorkspace;
  schema.view = { ...schema.view, current: "translation", translationViewport: VIEWPORT };
  const explorer = createProjectFromSchema("Dependent project", schema);
  const activeFile = explorer.files[explorer.project.activeFileId ?? ""];
  if (!activeFile || activeFile.kind !== "schema") throw new Error("Missing dependent schema.");

  return serializeProjectFile({
    diagram,
    translationWorkspace,
    logicalWorkspace,
    logicalGenerated: false,
    logicalStage: "translation",
    diagramView: "translation",
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

async function bootDependentProject(page: Page) {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("dependent-e2e-seeded") === "1") return;
    window.localStorage.clear();
    window.localStorage.setItem("chen-er-diagram-studio:locale", "en");
    window.localStorage.setItem("chen-er-diagram-studio:onboarding-v1:done", "1");
    window.sessionStorage.setItem("dependent-e2e-seeded", "1");
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible({ timeout: 20_000 });
  await page.locator('input[type="file"][accept*=".ersp"]').setInputFiles({
    name: "dependent.ersp",
    mimeType: "application/json",
    buffer: Buffer.from(createDependentProject()),
  });
  await expect(page.locator(".designer-translation-canvas")).toBeVisible();
}

async function openChooser(
  page: Page,
  labels: { fix: string; menu: string } = { fix: "Fix", menu: "Restructuring strategies" },
) {
  const tag = page.locator(".designer-translation-canvas .diagram-node").filter({ hasText: /^TAG$/ });
  await tag.focus();
  await expect(tag).toBeFocused();
  await page.getByRole("toolbar", { name: "Restructuring tools" }).getByRole("button", { name: labels.fix }).click();
  return page.getByRole("menu", { name: labels.menu });
}

test("multivalued chooser explains and applies the owner-scoped strategy", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootDependentProject(page);
  await captureEvidence(page, "dependent-before-desktop-1440x900.png");

  const chooser = await openChooser(page);
  await expect(chooser).toBeVisible();
  await expect(chooser.getByRole("menuitem")).toHaveCount(4);
  await expect(chooser.getByRole("menuitem", { name: /Shared/ })).toContainText("M:N");
  await expect(chooser.getByRole("menuitem", { name: /Owner-scoped/ })).toContainText("Resulting PK: idCon + TAG");
  await expect(chooser.getByRole("menuitem", { name: /Unique/ })).toContainText("global identifier");
  await expect(chooser.getByRole("menuitem", { name: /Expand in entity/ })).toContainText("3 scalar attributes");
  await captureEvidence(page, "dependent-chooser-desktop-1440x900.png");

  await chooser.getByRole("menuitem", { name: /Owner-scoped/ }).focus();
  await expect(chooser.getByRole("menuitem", { name: /Owner-scoped/ })).toBeFocused();
  await page.keyboard.press("Enter");

  await expect(page.locator('.designer-translation-canvas .diagram-node[aria-label="entity node: TAG"]')).toBeAttached();
  await expect(page.locator('.designer-translation-canvas .diagram-node[aria-label="relationship node: HAS_TAG"]')).toBeAttached();
  await page.getByRole("button", { name: "Fit the whole diagram" }).click();
  await captureEvidence(page, "dependent-output-er-desktop-1440x900.png");
  await expect(page.getByRole("menu", { name: "Restructuring strategies" })).toHaveCount(0);
  await page.getByRole("toolbar", { name: "Restructuring tools" }).getByRole("button", { name: "Logic" }).click();
  await expect(page.locator(".designer-logical-canvas")).toBeVisible();
});

test("multivalued chooser stays reachable across required viewports", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootDependentProject(page);
  await page.getByRole("complementary", { name: "Explorer" }).getByRole("button", { name: "Close Explorer" }).click();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const chooser = await openChooser(page);
    await expect(chooser).toBeVisible();
    const geometry = await chooser.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(0);
    expect(geometry.top).toBeGreaterThanOrEqual(0);
    expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
    expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
    const touchTargets = await chooser.getByRole("menuitem").evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().height),
    );
    expect(touchTargets.every((height) => height >= 44)).toBe(true);
    if (viewport.width === 390) {
      await captureEvidence(page, "dependent-chooser-mobile-390x844.png");
    }
    await page.getByRole("toolbar", { name: "Restructuring tools" }).getByRole("button", { name: "Fix" }).click();
  }
});

test("multivalued chooser localizes all strategy semantics", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await bootDependentProject(page);

  for (const locale of [
    { id: "en", fix: "Fix", menu: "Restructuring strategies", dependent: /Owner-scoped/ },
    { id: "it", fix: "Risolvi", menu: "Strategie di ristrutturazione", dependent: /Dipendente/ },
    { id: "sq", fix: "Rregullo", menu: "Strategjitë e ristrukturimit", dependent: /I varur/ },
  ]) {
    await page.evaluate((localeId) => {
      window.localStorage.setItem("chen-er-diagram-studio:locale", localeId);
    }, locale.id);
    await page.reload();
    await expect(page.locator(".designer-translation-canvas")).toBeVisible({ timeout: 20_000 });
    const chooser = await openChooser(page, locale);
    await expect(chooser.getByRole("menuitem", { name: locale.dependent })).toBeVisible();
    await page.getByRole("toolbar", { name: "Restructuring tools" }).getByRole("button", { name: locale.fix }).click();
  }
});
