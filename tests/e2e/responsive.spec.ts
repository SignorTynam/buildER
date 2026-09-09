import { expect, test, type Page } from "@playwright/test";
import { confirmNewProjectDialog } from "./utils/newProject";
import { dismissDrawerByScrim, ensureDrawerOpen, seedProjectWithSchema } from "./utils/erSchemaProject";
import {
  describeProbe,
  probeControls,
  ER_EDITOR_CONTROL_GROUPS,
} from "./utils/reachability";

/**
 * Fase D2: verifica responsive assertiva (niente snapshot pixel, che sarebbero
 * fragili al rendering dei font). Per ogni breakpoint controlla che il layout
 * non produca scroll orizzontale e che i controlli chiave restino usabili.
 *
 * L'app dichiara cinque breakpoint: 1180/900/680 in responsive.css e 860/640
 * nei file legacy. Le larghezze qui sotto attraversano ognuna di quelle fasce.
 */
const VIEWPORTS = [
  { name: "desktop-1280", width: 1280, height: 860 },
  { name: "laptop-1000", width: 1000, height: 800 },
  { name: "tablet-880", width: 880, height: 800 },
  { name: "narrow-860", width: 860, height: 760 },
  { name: "small-660", width: 660, height: 720 },
  { name: "mobile-640", width: 640, height: 720 },
];

/**
 * Matrice obbligatoria di `docs/agents/RESPONSIVE_UI.md`. I VIEWPORTS qui
 * sopra attraversano i confini di breakpoint e restano; questa invece e la
 * lista di classi di dispositivo su cui l'editor va esercitato davvero.
 */
const REQUIRED_VIEWPORTS = [
  { name: "wide-desktop-1920x1080", width: 1920, height: 1080 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
  { name: "compact-desktop-1024x768", width: 1024, height: 768 },
  { name: "tablet-portrait-768x1024", width: 768, height: 1024 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "narrow-mobile-360x800", width: 360, height: 800 },
];

async function bootWithProject(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("chen-er-diagram-studio:locale", "en");
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible({ timeout: 20_000 });
  const createButton = page.getByRole("button", { name: /Create new project/i });
  if (await createButton.count()) {
    await createButton.first().click();
    await confirmNewProjectDialog(page);
  }
  await expect(page.locator(".workspace-welcome-page")).toBeVisible();
}

/** Scroll orizzontale del documento: sintomo classico di layout che sfonda. */
async function horizontalOverflow(page: Page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollWidth: doc.scrollWidth, clientWidth: doc.clientWidth };
  });
}

/** Elementi che sporgono oltre il bordo destro della finestra. */
async function clippedElements(page: Page) {
  return page.evaluate(() => {
    const selectors = [
      ".app-header",
      ".bottom-status-bar",
      ".project-file-tabs",
      ".workspace-welcome-page__content",
      ".project-activity-rail",
    ];
    const offenders: string[] = [];
    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      // 1px di tolleranza per gli arrotondamenti del layout
      if (rect.right > window.innerWidth + 1) {
        offenders.push(`${selector} (right ${Math.round(rect.right)} > ${window.innerWidth})`);
      }
    }
    return offenders;
  });
}

for (const viewport of VIEWPORTS) {
  test(`layout holds at ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await bootWithProject(page);

    const screenshot = await page.screenshot({ fullPage: false });
    await testInfo.attach(`welcome-${viewport.name}`, { body: screenshot, contentType: "image/png" });

    const overflow = await horizontalOverflow(page);
    expect(
      overflow.scrollWidth,
      `scroll orizzontale a ${viewport.width}px: ${overflow.scrollWidth} > ${overflow.clientWidth}`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 1);

    const clipped = await clippedElements(page);
    expect(clipped, `elementi oltre il bordo a ${viewport.width}px: ${clipped.join(", ")}`).toEqual([]);

    // Il comando primario resta raggiungibile a ogni larghezza.
    await expect(page.locator(".app-command-search")).toBeVisible();
  });
}

/** Soglia oltre la quale il pannello workspace e una colonna, non un drawer. */
const MODAL_DRAWER_MAX_WIDTH = 900;

/**
 * Il buco che questa suite aveva: si fermava alla Welcome page, quindi non
 * esercitava mai la vera superficie di lavoro (canvas, toolbar contestuale,
 * HUD del viewport, view switcher) e misurava solo bounding box. Una toolbar
 * interamente coperta da un overlay passava senza fiatare.
 *
 * Qui l'editor viene aperto su uno schema e ogni controllo primario viene
 * interrogato con `elementFromPoint`: l'asserzione e "chi riceve davvero il
 * click".
 *
 * Il probe parte con l'Explorer APERTO, che e lo stato in cui l'utente atterra,
 * e la regola si sdoppia sul breakpoint:
 *
 * - sopra i 900px il pannello e una colonna affiancata: non deve coprire
 *   niente, tutti i controlli restano raggiungibili;
 * - sotto i 900px e un drawer modale: puo coprire l'editor, ma solo con lo
 *   scrim o col proprio contenuto, e un singolo click sullo scrim deve
 *   restituire ogni controllo.
 *
 * E la seconda branca a fare da rete: senza scrim cliccabile i controlli
 * risultano coperti da un pannello muto e non c'e modo di recuperarli.
 */
test("ER editor controls stay reachable across the required viewport matrix", async ({ page }, testInfo) => {
  // Un solo seed per tutta la matrice: aprire progetto e schema a ogni
  // viewport moltiplicherebbe i boot dell'app (ritardati di proposito sotto
  // Playwright) e il carico in parallelo farebbe scadere altre suite.
  test.slow();
  await seedProjectWithSchema(page);

  for (const viewport of REQUIRED_VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await ensureDrawerOpen(page);

    const screenshot = await page.screenshot({ fullPage: false });
    await testInfo.attach(`er-editor-${viewport.name}`, { body: screenshot, contentType: "image/png" });

    const overflow = await horizontalOverflow(page);
    expect(
      overflow.scrollWidth,
      `scroll orizzontale a ${viewport.name}: ${overflow.scrollWidth} > ${overflow.clientWidth}`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 1);

    // Una toolbar che scorre senza dirlo sembra troncata: i comandi oltre il
    // bordo diventano invisibili. Se scorre, deve esporre l'affordance.
    const toolbarScroll = await page.evaluate(() => {
      const nav = document.querySelector<HTMLElement>(".designer-context-toolbar");
      if (!nav) return null;
      return {
        overflowsX: nav.scrollWidth - nav.clientWidth > 1,
        overflowsY: nav.scrollHeight - nav.clientHeight > 1,
        hasHorizontalAffordance: nav.hasAttribute("data-scroll-start") || nav.hasAttribute("data-scroll-end"),
        hasVerticalAffordance: nav.hasAttribute("data-scroll-top") || nav.hasAttribute("data-scroll-bottom"),
      };
    });
    if (toolbarScroll?.overflowsX) {
      expect(
        toolbarScroll.hasHorizontalAffordance,
        `a ${viewport.name} la toolbar scorre in orizzontale ma non lo segnala`,
      ).toBe(true);
    }
    if (toolbarScroll?.overflowsY) {
      expect(
        toolbarScroll.hasVerticalAffordance,
        `a ${viewport.name} la toolbar scorre in verticale ma non lo segnala`,
      ).toBe(true);
    }

    const probes = await probeControls(page, ER_EDITOR_CONTROL_GROUPS);

    // Se un gruppo sparisce del tutto il probe diventa vacuo: meglio
    // accorgersene che vedere un test verde su zero controlli.
    const seenGroups = [...new Set(probes.map((probe) => probe.group))].sort();
    expect(seenGroups, `gruppi di controlli assenti a ${viewport.name}`).toEqual(
      ER_EDITOR_CONTROL_GROUPS.map((group) => group.name).sort(),
    );

    if (viewport.width > MODAL_DRAWER_MAX_WIDTH) {
      const unreachable = probes.filter((probe) => !probe.reachable || probe.outsideViewport);
      expect(
        unreachable,
        `col pannello aperto a ${viewport.name} non deve essere coperto nulla: ${unreachable
          .map(describeProbe)
          .join(" | ")}`,
      ).toEqual([]);
      continue;
    }

    // Sotto soglia: cio che copre puo essere solo il drawer o il suo scrim.
    const blockedByStranger = probes.filter(
      (probe) =>
        !probe.reachable &&
        !/project-activity-scrim|project-activity-content|project-explorer|project-activity-panel/.test(
          probe.blockedBy,
        ),
    );
    expect(
      blockedByStranger,
      `a ${viewport.name} qualcosa che non e il drawer copre dei controlli: ${blockedByStranger
        .map(describeProbe)
        .join(" | ")}`,
    ).toEqual([]);

    // E soprattutto: deve esistere una via d'uscita a un solo tocco.
    await dismissDrawerByScrim(page);

    const afterDismiss = await probeControls(page, ER_EDITOR_CONTROL_GROUPS);
    const stillUnreachable = afterDismiss.filter((probe) => !probe.reachable || probe.outsideViewport);
    expect(
      stillUnreachable,
      `controlli non raggiungibili a ${viewport.name} dopo aver chiuso il drawer: ${stillUnreachable
        .map(describeProbe)
        .join(" | ")}`,
    ).toEqual([]);
  }
});

test("explorer stays usable and collapsible at 860px", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 860, height: 760 });
  await bootWithProject(page);

  const explorer = page.locator(".project-explorer");
  await expect(explorer).toBeVisible();

  const width = await explorer.evaluate((el) => el.getBoundingClientRect().width);
  expect(width, "l'explorer non deve occupare piu' di meta' schermo").toBeLessThanOrEqual(860 * 0.6);

  const screenshot = await page.screenshot();
  await testInfo.attach("explorer-860", { body: screenshot, contentType: "image/png" });

  // Il collapse dal rail continua a funzionare.
  await page.locator(".project-activity-button").first().click();
  await expect(page.locator(".project-activity-panel--collapsed")).toBeVisible();
});

test("onboarding stays interactive above the open Explorer at 360px", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await bootWithProject(page);

  const explorer = page.locator(".project-explorer");
  const onboarding = page.getByRole("dialog", { name: "Guided onboarding" });
  const skipTour = onboarding.getByRole("button", { name: "Skip tour" });

  await expect(explorer).toBeVisible();
  await expect(onboarding).toBeVisible();
  await expect(skipTour).toBeVisible();

  const screenshot = await page.screenshot();
  await testInfo.attach("onboarding-explorer-360", { body: screenshot, contentType: "image/png" });

  await skipTour.click();
  await expect(onboarding).toBeHidden();
});
