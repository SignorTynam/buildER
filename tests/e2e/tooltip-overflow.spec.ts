import { expect, test, type Page } from "@playwright/test";
import { ensureDrawerClosed, seedProjectWithSchema } from "./utils/erSchemaProject";

/**
 * Il tooltip nascosto non deve occupare spazio.
 *
 * Con `visibility: hidden` il nodo conservava la sua scatola — larga fino a
 * 260px e posizionata fuori dall'ancora — e in un contenitore scrollabile
 * quella scatola finiva nel calcolo dell'overflow. Il pannello Errori aveva
 * cosi una scrollbar orizzontale permanente da 15px su una lista di solo testo,
 * causata unicamente dai tooltip dormienti delle sue righe. Il primitivo e
 * condiviso, quindi il difetto era latente in ogni pannello scrollabile con un
 * pulsante con tooltip.
 *
 * Le due meta del contratto vanno tenute insieme: sparire dal layout, ma
 * restare annunciabile. Il nodo resta nel DOM perche `aria-describedby` possa
 * risolverlo anche da nascosto.
 */

async function seedWorkspaceWithWarnings(page: Page): Promise<void> {
  await seedProjectWithSchema(page, { width: 1440, height: 900 });
  await ensureDrawerClosed(page);

  const codeButton = page.locator(".project-activity-rail").getByRole("button", { name: "Code", exact: true });
  await codeButton.click();
  // Un'entita isolata basta a produrre warning di validazione, cioe righe nel
  // pannello Errori, cioe pulsanti con tooltip dentro una lista scrollabile.
  await page.getByRole("textbox", { name: /Editor/i }).fill("entity Customer");
  await expect(page.locator(".diagram-node")).toHaveCount(1);
  await codeButton.click();
}

test("a dormant tooltip adds no scroll to the panel that hosts it", async ({ page }) => {
  test.slow();
  await seedWorkspaceWithWarnings(page);

  await page.locator('.project-activity-button[aria-label="Errors"]').click();
  const list = page.locator(".errors-panel__list");
  await expect(list).toBeVisible();
  await expect(list.locator(".errors-panel__row").first()).toBeVisible();
  // Il puntatore lontano da qualunque ancora: qui i tooltip devono dormire.
  await page.mouse.move(900, 700);

  const geometry = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(".errors-panel__list");
    if (!element) throw new Error("lista errori assente");
    const tooltips = Array.from(document.querySelectorAll<HTMLElement>(".ui-tooltip"));
    return {
      overflowX: element.scrollWidth - element.clientWidth,
      tooltips: tooltips.length,
      laidOut: tooltips.filter((tooltip) => window.getComputedStyle(tooltip).display !== "none").length,
    };
  });

  expect(geometry.tooltips, "nessun tooltip in pagina: il test non sta misurando nulla").toBeGreaterThan(0);
  expect(
    geometry.laidOut,
    `${geometry.laidOut} tooltip dormienti occupano ancora una scatola nel layout`,
  ).toBe(0);
  expect(
    geometry.overflowX,
    `la lista errori scorre in orizzontale di ${geometry.overflowX}px senza contenuto che lo giustifichi`,
  ).toBe(0);
});

test("the tooltip still shows on hover and stays announceable while hidden", async ({ page }) => {
  test.slow();
  await seedWorkspaceWithWarnings(page);

  // Da nascosto: fuori dal layout ma ancora risolvibile da aria-describedby,
  // che e il motivo per cui il nodo non viene smontato.
  const hidden = await page.evaluate(() => {
    const button = document.querySelector<HTMLElement>(".editor-context-button");
    if (!button) throw new Error("pulsante con tooltip assente");
    const id = button.getAttribute("aria-describedby");
    const target = id ? document.getElementById(id) : null;
    return {
      resolves: target != null,
      display: target ? window.getComputedStyle(target).display : null,
      text: target?.textContent?.trim() ?? "",
    };
  });

  expect(hidden.resolves, "aria-describedby non risolve piu il nodo del tooltip").toBe(true);
  expect(hidden.display).toBe("none");
  expect(hidden.text, "il testo annunciato dal tooltip e sparito").not.toBe("");

  const anchor = page.locator(".editor-context-button").locator("xpath=..");
  await anchor.hover();

  const tooltip = page.locator(".ui-tooltip", { hasText: hidden.text }).first();
  await expect(tooltip).toBeVisible();
});
