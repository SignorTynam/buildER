import { expect, test } from "@playwright/test";
import { applyViewport, ensureDrawerClosed, seedProjectWithSchema } from "./utils/erSchemaProject";

/**
 * Il selettore Conceptual/Translation/Logical in modalita compatta.
 *
 * Sotto i 680px la barra di contesto passa a icon-only nascondendo lo span
 * dell'etichetta. Il view switcher pero non aveva icone: restavano tre
 * pulsanti vuoti da 18x24px, distinguibili solo dalla `title`, che al tocco
 * non esiste. Da qui le tre asserzioni: nome accessibile, qualcosa di
 * visibile dentro il pulsante, bersaglio adeguato.
 */

/** `--size-input`, la misura che la topbar compatta usa gia per le sue icone. */
const MIN_TOUCH_TARGET = 32;

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

interface SwitcherButton {
  accessibleName: string;
  width: number;
  height: number;
  iconVisible: boolean;
  labelVisible: boolean;
}

async function readSwitcher(page: import("@playwright/test").Page): Promise<SwitcherButton[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".editor-view-switcher button")).map((button) => {
      const bounds = button.getBoundingClientRect();
      const icon = button.querySelector<HTMLElement>(".studio-icon");
      const label = button.querySelector<HTMLElement>("span");
      return {
        // `title` non conta: su un telefono non c'e hover che la faccia uscire.
        accessibleName: (button.getAttribute("aria-label") ?? "").trim(),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        iconVisible: icon != null && window.getComputedStyle(icon).display !== "none",
        labelVisible: label != null && window.getComputedStyle(label).display !== "none",
      };
    }),
  );
}

test("the compact view switcher keeps a name, a visible mark, and a real target", async ({ page }) => {
  await seedProjectWithSchema(page, PHONE);
  // Sotto soglia il drawer e modale e il suo scrim copre la barra di contesto:
  // la misura va presa sulla barra come la vede chi ci deve arrivare.
  await ensureDrawerClosed(page);

  const buttons = await readSwitcher(page);
  expect(buttons).toHaveLength(3);

  for (const button of buttons) {
    expect(button.accessibleName, "un pulsante del view switcher senza nome accessibile").not.toBe("");
    expect(
      button.iconVisible || button.labelVisible,
      `"${button.accessibleName}" non mostra ne icona ne etichetta: il pulsante e vuoto`,
    ).toBe(true);
    expect(
      Math.min(button.width, button.height),
      `"${button.accessibleName}" e ${button.width}x${button.height}px, sotto il bersaglio minimo`,
    ).toBeGreaterThanOrEqual(MIN_TOUCH_TARGET);
  }

  // In icon-only le etichette sono nascoste: tocca all'icona distinguere le tre viste.
  expect(buttons.every((button) => button.iconVisible)).toBe(true);
  expect(buttons.every((button) => !button.labelVisible)).toBe(true);
  expect(new Set(buttons.map((button) => button.accessibleName)).size).toBe(3);
});

test("the compact view switcher still changes view when tapped", async ({ page }) => {
  await seedProjectWithSchema(page, PHONE);
  await ensureDrawerClosed(page);

  const switcher = page.locator(".editor-view-switcher button");
  await expect(switcher.first()).toHaveAttribute("aria-pressed", "true");

  // Terzo pulsante: la vista logica. Senza etichetta visibile resta comunque
  // l'unico modo di raggiungerla dalla barra di contesto.
  await switcher.nth(2).click();

  await expect(switcher.nth(2)).toHaveAttribute("aria-pressed", "true");
  await expect(switcher.first()).toHaveAttribute("aria-pressed", "false");
});

test("above the breakpoint the view switcher stays a labelled segmented control", async ({ page }) => {
  // Due boot per attraversare la soglia, e sotto Playwright ognuno e ritardato.
  test.slow();
  await seedProjectWithSchema(page, PHONE);
  await applyViewport(page, DESKTOP);

  const buttons = await readSwitcher(page);
  expect(buttons).toHaveLength(3);

  // Sul desktop c'e spazio per il testo, che resta piu chiaro di tre simboli
  // affiancati: l'icona serve solo alla modalita compatta.
  expect(buttons.every((button) => button.labelVisible)).toBe(true);
  expect(buttons.every((button) => !button.iconVisible)).toBe(true);
});
