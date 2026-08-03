import { expect, test, type Page } from "@playwright/test";
import { applyViewport, ensureDrawerClosed, seedProjectWithSchema } from "./utils/erSchemaProject";

/**
 * Geometria della toolbar del canvas.
 *
 * In colonna non ci stava: un pulsante icona+etichetta occupa 56px e con una
 * selezione attiva i comandi contestuali arrivano a 14, cioe ~780px di altezza
 * contro i 470 disponibili a 1280x720. Restavano visibili 7 comandi su 13, e a
 * quella risoluzione non entrava nemmeno la palette a riposo. In riga gli
 * stessi 14 comandi chiedono ~947px.
 *
 * Le asserzioni sono due: la barra e una riga sola a ogni larghezza, e dove il
 * canvas e abbastanza largo nessun comando resta fuori. Altrove si pretende la
 * sfumatura di scorrimento: il troncamento muto e il difetto originale.
 */

/** Dove i 14 comandi ci stanno tutti, senza scorrere (con l'Explorer chiuso). */
const FULL_FIT = [
  { width: 1440, height: 900 },
  { width: 1280, height: 720 },
];

/**
 * Dove la larghezza puo non bastare.
 *
 * A 1024x768 con l'Explorer chiuso il canvas e largo 958px contro i ~947
 * richiesti: ci sta per un soffio con 13 comandi e sfora di una ventina di
 * pixel con 14. Con l'Explorer aperto restano fuori ~280px. Sono numeri che
 * dipendono dalla lingua — le etichette tradotte cambiano larghezza — quindi
 * qui non si pretende che entri, si pretende che lo scorrimento si veda.
 */
const SCROLLS = [
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

interface ToolbarGeometry {
  commands: number;
  rows: number;
  hiddenPx: number;
  fades: boolean;
  insideCanvas: boolean;
}

async function readToolbar(page: Page): Promise<ToolbarGeometry> {
  return page.evaluate(() => {
    const toolbar = document.querySelector<HTMLElement>('[aria-label="ER toolbar"]');
    if (!toolbar) throw new Error("toolbar assente");
    const canvas = document.querySelector<HTMLElement>(".designer-canvas-region");
    if (!canvas) throw new Error("canvas assente");

    const bounds = toolbar.getBoundingClientRect();
    const canvasBounds = canvas.getBoundingClientRect();
    const buttons = Array.from(toolbar.querySelectorAll<HTMLElement>("button"));
    // Una riga sola: tutti i pulsanti condividono lo stesso bordo superiore.
    const tops = new Set(buttons.map((button) => Math.round(button.getBoundingClientRect().top)));

    return {
      commands: buttons.length,
      rows: tops.size,
      hiddenPx: Math.max(0, toolbar.scrollWidth - toolbar.clientWidth),
      fades:
        toolbar.hasAttribute("data-scroll-start") || toolbar.hasAttribute("data-scroll-end"),
      insideCanvas:
        bounds.left >= canvasBounds.left - 1 &&
        bounds.right <= canvasBounds.right + 1 &&
        bounds.top >= canvasBounds.top - 1 &&
        bounds.bottom <= canvasBounds.bottom + 1,
    };
  });
}

/** Semina uno schema con un'entita selezionata: e lo stato con piu comandi. */
async function seedSelectedEntity(page: Page): Promise<void> {
  await seedProjectWithSchema(page, FULL_FIT[0]);
  await ensureDrawerClosed(page);

  const codeButton = page.locator(".project-activity-rail").getByRole("button", { name: "Code", exact: true });
  await codeButton.click();
  const editor = page.getByRole("textbox", { name: /Editor/i });
  await editor.fill("entity Customer");
  await expect(page.locator(".diagram-node")).toHaveCount(1);
  await codeButton.click();

  await selectEntity(page);
}

/**
 * I comandi contestuali (Rename, Delete, To Parent...) esistono solo con una
 * selezione: senza, la barra non e nello stato che ci interessa misurare. Va
 * rifatto dopo ogni reload, che azzera la selezione.
 */
async function selectEntity(page: Page): Promise<void> {
  await page.locator(".diagram-node").first().click();
  await expect
    .poll(async () => (await readToolbar(page)).commands, { timeout: 10_000 })
    .toBeGreaterThan(8);
}

/**
 * Sui viewport stretti il nodo puo restare fuori dall'inquadratura e non essere
 * cliccabile. La selezione li e un di piu: le invarianti sotto esame (una riga
 * sola, dentro il canvas, se scorre lo dice) valgono con qualunque numero di
 * comandi, quindi si prova e si tira dritto.
 */
async function trySelectEntity(page: Page): Promise<void> {
  await page
    .locator(".diagram-node")
    .first()
    .click({ timeout: 3_000 })
    .catch(() => undefined);
}

test("every canvas command fits in one row on the wide desktops", async ({ page }) => {
  test.slow();
  await seedSelectedEntity(page);

  for (const viewport of FULL_FIT) {
    await page.setViewportSize(viewport);
    await ensureDrawerClosed(page);
    const geometry = await readToolbar(page);

    expect(
      geometry.rows,
      `a ${viewport.width}x${viewport.height} la toolbar occupa ${geometry.rows} righe invece di una`,
    ).toBe(1);
    expect(
      geometry.hiddenPx,
      `a ${viewport.width}x${viewport.height} restano fuori ${geometry.hiddenPx}px di comandi su ${geometry.commands}`,
    ).toBe(0);
    expect(geometry.insideCanvas, "la toolbar esce dall'area del canvas").toBe(true);
  }
});

test("where the width really is not enough the toolbar shows its scroll edge", async ({ page }) => {
  test.slow();
  await seedSelectedEntity(page);

  for (const viewport of SCROLLS) {
    await applyViewport(page, viewport);
    // Sotto soglia il drawer riparte aperto e il suo scrim copre il canvas.
    await ensureDrawerClosed(page);
    await trySelectEntity(page);
    const geometry = await readToolbar(page);

    expect(geometry.rows, "la toolbar deve restare una riga sola anche da stretta").toBe(1);
    expect(geometry.insideCanvas, "la toolbar esce dall'area del canvas").toBe(true);
    // Condizionale di proposito: a 1024 il totale oscilla tra 13 e 14 comandi
    // (Undo sparisce quando la cronologia e vuota) e con 13 ci sta. Quello che
    // non deve succedere mai e il troncamento muto, il difetto originale.
    if (geometry.hiddenPx > 0) {
      expect(
        geometry.fades,
        `a ${viewport.width}px restano fuori ${geometry.hiddenPx}px senza sfumatura di scorrimento`,
      ).toBe(true);
    }
  }

  // Su telefono lo scorrimento c'e di sicuro: qui la sfumatura va pretesa,
  // altrimenti il controllo qui sopra passerebbe anche senza mai esercitarla.
  await applyViewport(page, { width: 390, height: 844 });
  await ensureDrawerClosed(page);
  await trySelectEntity(page);
  const phone = await readToolbar(page);
  expect(phone.hiddenPx, "a 390px la toolbar dovrebbe eccedere la larghezza").toBeGreaterThan(0);
  expect(phone.fades, "a 390px manca la sfumatura di scorrimento").toBe(true);
});
