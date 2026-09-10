import { expect, test } from "@playwright/test";
import { confirmNewProjectDialog } from "./utils/newProject";

/**
 * Il livello di movimento e il suo interruttore.
 *
 * Le entrate di dialoghi, menu e toast rendono l'app meno rigida, ma valgono
 * solo se restano spegnibili: chi imposta `prefers-reduced-motion: reduce`
 * deve vedere le stesse superfici, ferme. Il contratto vive in `motion.css` e
 * copre anche le animazioni preesistenti che erano rimaste senza guardia.
 */

const ANIMATED_ON_OPEN = [".ui-modal-backdrop", ".ui-modal"] as const;

async function openNewProjectDialog(page: import("@playwright/test").Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("chen-er-diagram-studio:locale", "en");
    window.localStorage.setItem("chen-er-diagram-studio:onboarding-v1:done", "1");
  });
  await page.goto("/");
  const createProject = page.locator(".no-project-welcome-page .workspace-welcome-action-card--primary");
  await expect(createProject).toBeVisible({ timeout: 20_000 });
  await createProject.click();
  await expect(page.locator(".ui-modal")).toBeVisible();
}

function readAnimations(page: import("@playwright/test").Page, selectors: readonly string[]) {
  return page.evaluate((list) =>
    list.map((selector) => {
      const element = document.querySelector(selector);
      if (!element) return { selector, animationName: "missing" };
      return { selector, animationName: window.getComputedStyle(element).animationName };
    }),
  [...selectors]);
}

test("dialogs and menus enter with the shared motion layer", async ({ page }) => {
  await openNewProjectDialog(page);

  for (const entry of await readAnimations(page, ANIMATED_ON_OPEN)) {
    expect(entry.animationName, `${entry.selector} entra senza animazione`).not.toBe("none");
    expect(entry.animationName, `${entry.selector} non e in pagina`).not.toBe("missing");
  }

  await confirmNewProjectDialog(page);
  await page.locator('[data-testid="app-header-file-menu"]').click();
  const menu = page.locator(".app-file-menu__panel");
  await expect(menu).toBeVisible();
  expect(await menu.evaluate((element) => window.getComputedStyle(element).animationName)).toBe("builder-menu-in");
});

test.describe("with reduced motion", () => {
  test("every entrance is switched off, including the pre-existing ones", async ({ page }) => {
    // Emulazione esplicita sulla pagina: `test.use({ reducedMotion })` non
    // arriva alla pagina in questa configurazione e il test passerebbe a vuoto.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openNewProjectDialog(page);
    expect(
      await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches),
      "l'emulazione reduced-motion non e attiva: il test non misura nulla",
    ).toBe(true);

    for (const entry of await readAnimations(page, ANIMATED_ON_OPEN)) {
      expect(entry.animationName, `${entry.selector} si muove ancora`).toBe("none");
    }

    await confirmNewProjectDialog(page);

    // Menu della topbar e menu contestuale della tab: due strati diversi con
    // due sorgenti diverse (motion.css e context-menu.css), stessa regola.
    await page.locator('[data-testid="app-header-file-menu"]').click();
    const menu = page.locator(".app-file-menu__panel");
    await expect(menu).toBeVisible();
    expect(await menu.evaluate((element) => window.getComputedStyle(element).animationName)).toBe("none");
    await page.keyboard.press("Escape");

    await page.locator(".project-file-tab").first().click({ button: "right" });
    const contextMenu = page.locator(".project-file-tab-menu");
    await expect(contextMenu).toBeVisible();
    expect(await contextMenu.evaluate((element) => window.getComputedStyle(element).animationName)).toBe("none");
  });
});
