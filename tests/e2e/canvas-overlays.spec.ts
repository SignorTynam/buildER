import { expect, test, type Page } from "@playwright/test";
import { confirmNewProjectDialog } from "./utils/newProject";
import { ensureDrawerClosed, seedProjectWithSchema } from "./utils/erSchemaProject";

/**
 * Le tre sovrapposizioni della rifinitura.
 *
 * 1. Minimap e HUD dello zoom sono due card flottanti impilate nello stesso
 *    angolo, ancorate pero da regole diverse (var(--space-6) contro 28px
 *    hardcoded, replicato in quattro `!important` fra due file): i bordi destri
 *    restavano disallineati di 4px.
 * 2. Con il diagramma vuoto la minimap disegnava comunque il rettangolo di
 *    viewport, che non inquadra nulla e tagliava a meta il testo dello stato
 *    vuoto.
 * 3. Il dock del tour si posava sulla Welcome coprendo 245px dei 256 della
 *    colonna dei suggerimenti.
 */

async function overlayGeometry(page: Page) {
  return page.evaluate(() => {
    const hud = document.querySelector<HTMLElement>(".canvas-viewport-hud");
    const minimap = document.querySelector<HTMLElement>(".canvas-minimap");
    if (!hud || !minimap) throw new Error("HUD o minimap assenti");
    const hudBounds = hud.getBoundingClientRect();
    const minimapBounds = minimap.getBoundingClientRect();
    return {
      rightGap: Math.abs(hudBounds.right - minimapBounds.right),
      verticalGap: Math.round(hudBounds.top - minimapBounds.bottom),
      hasViewportRect: document.querySelector(".canvas-minimap__viewport") != null,
      hasEmptyState: document.querySelector(".canvas-minimap__empty") != null,
    };
  });
}

test("the minimap and the zoom HUD share one right edge", async ({ page }) => {
  await seedProjectWithSchema(page);
  await ensureDrawerClosed(page);

  const geometry = await overlayGeometry(page);
  expect(
    geometry.rightGap,
    `i bordi destri delle due card flottanti differiscono di ${geometry.rightGap}px`,
  ).toBeLessThanOrEqual(0.5);
  // Impilate, non sovrapposte.
  expect(geometry.verticalGap).toBeGreaterThan(0);
});

test("an empty minimap shows its message without a viewport rectangle across it", async ({ page }) => {
  await seedProjectWithSchema(page);
  await ensureDrawerClosed(page);

  const empty = await overlayGeometry(page);
  expect(empty.hasEmptyState, "lo schema appena creato deve dare la minimap vuota").toBe(true);
  expect(
    empty.hasViewportRect,
    "il rettangolo di viewport non ha nulla da inquadrare e attraversa il testo",
  ).toBe(false);

  // Con dei nodi il rettangolo deve tornare: e l'unico indicatore di dove si
  // sta guardando, toglierlo sempre sarebbe una regressione peggiore.
  const codeButton = page.locator(".project-activity-rail").getByRole("button", { name: "Code", exact: true });
  await codeButton.click();
  await page.getByRole("textbox", { name: /Editor/i }).fill("entity Customer");
  await expect(page.locator(".diagram-node")).toHaveCount(1);
  await codeButton.click();

  await expect.poll(async () => (await overlayGeometry(page)).hasViewportRect).toBe(true);
  expect((await overlayGeometry(page)).hasEmptyState).toBe(false);
});

test("the onboarding dock never sits on the welcome columns", async ({ page }) => {
  // Il tour si apre solo su una sessione nuova, non su una ripristinata.
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("chen-er-diagram-studio:locale", "en");
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const createProject = page.locator(".no-project-welcome-page .workspace-welcome-action-card--primary");
  await expect(createProject).toBeVisible({ timeout: 20_000 });
  await createProject.click();
  await confirmNewProjectDialog(page);

  await expect(page.locator(".workspace-onboarding-dock")).toBeVisible();

  const overlaps = await page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>(".workspace-onboarding-dock");
    if (!dock) throw new Error("dock assente");
    const dockBounds = dock.getBoundingClientRect();
    return Array.from(
      document.querySelectorAll<HTMLElement>(".workspace-welcome-panel, .workspace-welcome-grid > *"),
    ).map((panel) => {
      const bounds = panel.getBoundingClientRect();
      return {
        name: panel.className.split(" ").slice(0, 2).join("."),
        overlap: Math.round(
          Math.max(0, Math.min(dockBounds.right, bounds.right) - Math.max(dockBounds.left, bounds.left)),
        ),
      };
    });
  });

  expect(overlaps.length, "nessuna colonna della Welcome trovata").toBeGreaterThan(0);
  const covered = overlaps.filter((entry) => entry.overlap > 0);
  expect(
    covered,
    `il dock del tour copre: ${covered.map((c) => `${c.name} ${c.overlap}px`).join(", ")}`,
  ).toEqual([]);
});
