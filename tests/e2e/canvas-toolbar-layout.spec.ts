import { expect, test, type Page } from "@playwright/test";
import { applyViewport, ensureDrawerClosed, seedProjectWithSchema } from "./utils/erSchemaProject";

/**
 * La toolbox ER usa due layout intenzionalmente diversi:
 *
 * - desktop (> 899px): colonna verticale a sinistra;
 * - compact (<= 899px): barra orizzontale inferiore.
 *
 * Una selezione aggiunge i comandi contestuali e forza lo scroll nei viewport
 * con meno spazio: entrambi gli orientamenti devono segnalarlo ai bordi.
 */
const DESKTOP_VIEWPORTS = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
];

const COMPACT_VIEWPORTS = [
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 360, height: 800 },
];

interface ToolbarGeometry {
  commands: number;
  direction: string;
  rows: number;
  columns: number;
  hiddenX: number;
  hiddenY: number;
  horizontalFade: boolean;
  verticalFade: boolean;
  insideCanvas: boolean;
  firstButton: { x: number; y: number } | null;
  secondButton: { x: number; y: number } | null;
}

async function readToolbar(page: Page): Promise<ToolbarGeometry> {
  return page.evaluate(() => {
    const toolbar = document.querySelector<HTMLElement>(".designer-context-toolbar.designer-er-toolbar");
    if (!toolbar) throw new Error("toolbar assente");
    const canvas = document.querySelector<HTMLElement>(".designer-canvas-region");
    if (!canvas) throw new Error("canvas assente");

    const bounds = toolbar.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();
    const buttons = Array.from(toolbar.querySelectorAll<HTMLElement>("button"));
    const buttonBounds = buttons.map((button) => button.getBoundingClientRect());

    return {
      commands: buttons.length,
      direction: getComputedStyle(toolbar).flexDirection,
      rows: new Set(buttonBounds.map((rect) => Math.round(rect.top))).size,
      columns: new Set(buttonBounds.map((rect) => Math.round(rect.left))).size,
      hiddenX: Math.max(0, toolbar.scrollWidth - toolbar.clientWidth),
      hiddenY: Math.max(0, toolbar.scrollHeight - toolbar.clientHeight),
      horizontalFade: toolbar.hasAttribute("data-scroll-start") || toolbar.hasAttribute("data-scroll-end"),
      verticalFade: toolbar.hasAttribute("data-scroll-top") || toolbar.hasAttribute("data-scroll-bottom"),
      insideCanvas:
        bounds.left >= canvasBounds.left - 1 &&
        bounds.right <= canvasBounds.right + 1 &&
        bounds.top >= canvasBounds.top - 1 &&
        bounds.bottom <= canvasBounds.bottom + 1,
      firstButton: buttonBounds[0] ? { x: buttonBounds[0].x, y: buttonBounds[0].y } : null,
      secondButton: buttonBounds[1] ? { x: buttonBounds[1].x, y: buttonBounds[1].y } : null,
    };
  });
}

async function seedSelectedEntity(page: Page): Promise<void> {
  await seedProjectWithSchema(page, DESKTOP_VIEWPORTS[0]);
  await ensureDrawerClosed(page);

  const codeButton = page.locator(".project-activity-rail").getByRole("button", { name: "Code", exact: true });
  await codeButton.click();
  const editor = page.getByRole("textbox", { name: /Editor/i });
  await editor.fill("entity Customer");
  await expect(page.locator(".diagram-node")).toHaveCount(1);
  await codeButton.click();
  await selectEntity(page);
}

async function selectEntity(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Fit the whole diagram" }).click();
  await page.locator(".diagram-node").first().click();
  await expect
    .poll(async () => (await readToolbar(page)).commands, { timeout: 10_000 })
    .toBeGreaterThan(8);
}

async function trySelectEntity(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Fit the whole diagram" }).click();
  await page.locator(".diagram-node").first().click({ timeout: 3_000 }).catch(() => undefined);
}

test("ER toolbox is a vertical left column on desktop", async ({ page }) => {
  test.slow();
  await seedSelectedEntity(page);

  for (const viewport of DESKTOP_VIEWPORTS) {
    await applyViewport(page, viewport);
    await ensureDrawerClosed(page);
    await selectEntity(page);
    const geometry = await readToolbar(page);

    expect(geometry.direction, `orientamento errato a ${viewport.width}x${viewport.height}`).toBe("column");
    expect(geometry.columns, `i comandi non condividono la stessa colonna a ${viewport.width}px`).toBe(1);
    expect(geometry.rows, `i comandi non sono impilati a ${viewport.width}px`).toBe(geometry.commands);
    expect(geometry.firstButton).not.toBeNull();
    expect(geometry.secondButton).not.toBeNull();
    expect(Math.abs(geometry.secondButton!.x - geometry.firstButton!.x)).toBeLessThanOrEqual(1);
    expect(geometry.secondButton!.y).toBeGreaterThan(geometry.firstButton!.y);
    expect(geometry.hiddenX).toBe(0);
    expect(geometry.insideCanvas, "la toolbar esce dall'area del canvas").toBe(true);

    if (geometry.hiddenY > 0) {
      expect(geometry.verticalFade, `manca la sfumatura verticale a ${viewport.width}px`).toBe(true);
    }
  }
});

test("ER toolbox keeps the horizontal bottom layout on compact viewports", async ({ page }) => {
  test.slow();
  await seedSelectedEntity(page);

  for (const viewport of COMPACT_VIEWPORTS) {
    await applyViewport(page, viewport);
    await ensureDrawerClosed(page);
    await trySelectEntity(page);
    const geometry = await readToolbar(page);

    expect(geometry.direction, `orientamento errato a ${viewport.width}x${viewport.height}`).toBe("row");
    expect(geometry.rows, `la toolbar compact non resta su una riga a ${viewport.width}px`).toBe(1);
    expect(geometry.firstButton).not.toBeNull();
    expect(geometry.secondButton).not.toBeNull();
    expect(Math.abs(geometry.secondButton!.y - geometry.firstButton!.y)).toBeLessThanOrEqual(1);
    expect(geometry.secondButton!.x).toBeGreaterThan(geometry.firstButton!.x);
    expect(geometry.hiddenY).toBeLessThanOrEqual(1);
    expect(geometry.insideCanvas, "la toolbar esce dall'area del canvas").toBe(true);

    if (geometry.hiddenX > 0) {
      expect(geometry.horizontalFade, `manca la sfumatura orizzontale a ${viewport.width}px`).toBe(true);
    }
  }

  await applyViewport(page, { width: 390, height: 844 });
  await ensureDrawerClosed(page);
  const phone = await readToolbar(page);
  expect(phone.hiddenX, "a 390px la toolbar dovrebbe eccedere la larghezza").toBeGreaterThan(0);
  expect(phone.horizontalFade, "a 390px manca la sfumatura di scorrimento").toBe(true);
});
