import { expect, test } from "@playwright/test";
import { seedProjectWithSchema } from "./utils/erSchemaProject";

async function openWorkspaceView(page: Parameters<typeof seedProjectWithSchema>[0], label: "ER model" | "Translation" | "Logical schema") {
  await page.getByTestId("app-header-menu").click();
  const search = page.getByTestId("command-menu-search");
  await search.fill(label);
  await expect(page.getByRole("option", { name: new RegExp(`^${label}\\b`) })).toBeVisible();
  await search.press("Enter");
  await expect(page.getByTestId("command-menu")).toBeHidden();
}

/**
 * Struttura del documento per chi non usa il mouse.
 *
 * Tre difetti distinti, tutti invisibili guardando lo schermo:
 * - nessun landmark `main` con uno schema aperto: l'intera pagina restava
 *   fuori da un main, e la scorciatoia "vai al contenuto" degli screen reader
 *   non aveva bersaglio;
 * - nessuno skip link: da tastiera servivano oltre quaranta Tab per arrivare
 *   alla superficie di lavoro;
 * - `<html lang>` fisso a "en": italiano e albanese venivano pronunciati con
 *   voce e regole inglesi.
 */

test("the workspace exposes exactly one main landmark and a heading", async ({ page }) => {
  test.slow();
  await seedProjectWithSchema(page);

  const landmarks = await page.evaluate(() => ({
    mains: Array.from(document.querySelectorAll("main, [role=main]")).map((element) => ({
      label: element.getAttribute("aria-label"),
      id: element.id,
    })),
    h1s: Array.from(document.querySelectorAll("h1")).map((element) => element.textContent?.trim() ?? ""),
  }));

  // Piu di un main e ambiguo quanto nessuno: le superfici interne (welcome,
  // empty editor, editor di testo) devono restare `section`.
  expect(landmarks.mains).toHaveLength(1);
  expect(landmarks.mains[0].id).toBe("workspace-main");
  expect(landmarks.h1s).toHaveLength(1);
  expect(landmarks.h1s[0]).toContain("Schema.erschema");

  // Anche cambiando vista il canvas resta intestato.
  for (const view of ["Translation", "Logical schema", "ER model"] as const) {
    await openWorkspaceView(page, view);
    await expect(page.locator("h1")).toHaveCount(1);
  }
});

test("the skip link is the first stop and moves focus to the workspace", async ({ page }) => {
  test.slow();
  await seedProjectWithSchema(page);

  const skipLink = page.locator(".skip-link");

  // Fuori schermo finche non riceve il focus.
  const hiddenTop = await skipLink.evaluate((element) => element.getBoundingClientRect().top);
  expect(hiddenTop).toBeLessThan(0);

  // Primo Tab del documento: deve essere lo skip link, non l'header.
  // Serve un documento appena caricato — dopo un click il browser riprende la
  // navigazione sequenziale dall'ultimo elemento toccato, non dall'inizio.
  await page.reload();
  await expect(page.locator('[aria-label="ER toolbar"]')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();

  // La comparsa e animata: si attende che la transizione si assesti invece di
  // misurare il primo frame.
  await expect
    .poll(
      () => skipLink.evaluate((element) => element.getBoundingClientRect().top),
      { message: "lo skip link deve comparire quando riceve il focus" },
    )
    .toBeGreaterThanOrEqual(0);

  await page.keyboard.press("Enter");
  await expect(page.locator("#workspace-main")).toBeFocused();
  // Niente fragment in cronologia: in una SPA cambierebbe il link condiviso.
  expect(new URL(page.url()).hash).toBe("");
});

test("the document language follows the interface language", async ({ page }) => {
  test.slow();
  await seedProjectWithSchema(page);

  // Il seed forza `en`; l'attributo deve gia essere allineato al primo paint.
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("button", { name: "Change interface language" }).click();
  await page.getByRole("menuitemradio", { name: /Shqip/ }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "sq");

  // E deve sopravvivere a un reload, non solo al cambio a caldo.
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "sq");
});
