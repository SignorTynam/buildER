import AxeBuilder from "@axe-core/playwright";
import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";
import { createPlaygroundProject } from "./utils/sqlPlaygroundProject";

async function bootProject(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("chen-er-diagram-studio:locale", "it");
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.locator('input[type="file"][accept*=".ersp"]').setInputFiles({
    name: "sql-playground.ersp",
    mimeType: "application/json",
    buffer: Buffer.from(createPlaygroundProject()),
  });
  await expect(page.locator(".project-file-tab.active")).toContainText("university.erschema");
}

async function openPlaygroundFromPalette(page: Page): Promise<void> {
  await page.keyboard.press("Control+KeyK");
  const search = page.getByTestId("command-menu-search");
  await search.fill("apri sql playground");
  await expect(page.getByRole("option", { name: /Apri SQL Playground/ })).toBeVisible();
  await search.press("Enter");
  await expect(page.locator(".sql-playground-workspace")).toBeVisible();
}

test("plans, previews, applies, repeats, and safely recreates deterministic sample data", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootProject(page);
  await openPlaygroundFromPalette(page);
  await page.getByRole("button", { name: "Crea database", exact: true }).click();
  await expect(page.getByText("Database pronto", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "output/playwright/sql-population-after-command-bar-desktop.png" });

  const generateData = page.getByRole("button", { name: "Genera dati", exact: true });
  await expect(generateData).toBeEnabled();
  await generateData.click();
  let dialog = page.getByRole("dialog", { name: "Genera dati" });
  await expect(dialog.getByLabel("Righe per tabella")).toHaveValue("20");
  await expect(dialog.getByLabel("Seed")).toHaveValue("42");
  await dialog.getByLabel("Righe per tabella").fill("0");
  await dialog.getByLabel("Seed").fill("4294967296");
  await dialog.getByRole("button", { name: "Genera anteprima", exact: true }).click();
  await expect(dialog.getByText("Inserisci un numero intero da 1 a 100.", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Inserisci un intero unsigned da 0 a 4294967295.", { exact: true })).toBeVisible();
  await dialog.getByLabel("Righe per tabella").fill("20");
  await dialog.getByLabel("Seed").fill("42");
  await page.screenshot({ path: "output/playwright/sql-population-dialog-config-desktop.png" });
  await dialog.getByRole("button", { name: "Genera anteprima", exact: true }).click();
  await expect(dialog.getByText("Righe totali")).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByRole("row", { name: /STUDENT 20 20/ })).toBeVisible();
  await expect(dialog.getByRole("row", { name: /COURSE 20 20/ })).toBeVisible();
  await expect(dialog.getByRole("row", { name: /ENROLLMENT 20 20/ })).toBeVisible();
  const firstPreview = await dialog.getByLabel("Anteprima SQL del dataset generato").textContent();
  expect(firstPreview).toContain("BEGIN IMMEDIATE;");
  expect(firstPreview).toContain('INSERT INTO "STUDENT"');
  await page.screenshot({ path: "output/playwright/sql-population-preview-desktop.png" });
  await dialog.getByRole("button", { name: "Genera e inserisci", exact: true }).click();
  await expect(dialog.getByText("Dati generati", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(dialog.getByText(/Inserite 60 righe in 3 tabelle/)).toBeVisible();
  await page.screenshot({ path: "output/playwright/sql-population-success-desktop.png" });
  await dialog.locator(".ui-modal__footer").getByRole("button", { name: "Chiudi", exact: true }).click();

  await page.getByRole("button", { name: "SQL Explorer", exact: true }).click();
  const explorer = page.locator(".sql-explorer-panel");
  await expect(explorer).toBeVisible();
  await explorer.getByRole("treeitem", { name: /^Tabelle \(3\)/ }).click();
  await expect(explorer.getByRole("treeitem", { name: /^STUDENT/ })).toBeVisible();
  await expect(explorer.getByRole("treeitem", { name: /^COURSE/ })).toBeVisible();
  await expect(explorer.getByRole("treeitem", { name: /^ENROLLMENT/ })).toBeVisible();
  await explorer.locator(".workspace-panel__close").click();

  const editor = page.getByRole("textbox", { name: "Editor query SQL" });
  await editor.fill(`SELECT COUNT(*) AS total FROM "STUDENT";`);
  await editor.press("Control+Enter");
  await expect(page.getByRole("cell", { name: "20", exact: true })).toBeVisible();
  await editor.fill(`SELECT s.name, c.title
FROM "ENROLLMENT" e
JOIN "STUDENT" s ON s.id = e.student_id
JOIN "COURSE" c ON c.id = e.course_id
ORDER BY s.id, c.id
LIMIT 1;`);
  await editor.press("Control+Enter");
  await expect(page.getByRole("columnheader", { name: "name", exact: true })).toBeVisible();
  const firstGeneratedRow = await page.locator(".sql-playground-result tbody tr").first().textContent();
  expect(firstGeneratedRow).toBeTruthy();

  await generateData.click();
  dialog = page.getByRole("dialog", { name: "Genera dati" });
  await dialog.getByRole("button", { name: "Genera anteprima", exact: true }).click();
  await expect(dialog.getByText("Il database contiene dati o modifiche", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "output/playwright/sql-population-destructive-reset-desktop.png" });
  await dialog.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await editor.fill(`SELECT COUNT(*) AS total FROM "STUDENT";`);
  await editor.press("Control+Enter");
  await expect(page.getByRole("cell", { name: "20", exact: true })).toBeVisible();

  await generateData.click();
  dialog = page.getByRole("dialog", { name: "Genera dati" });
  await dialog.getByRole("button", { name: "Genera anteprima", exact: true }).click();
  await expect(dialog.getByText("Il database contiene dati o modifiche", { exact: true })).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole("button", { name: "Ricrea database e genera dati", exact: true }).click();
  await expect(dialog.getByText("Dati generati", { exact: true })).toBeVisible({ timeout: 20_000 });
  await dialog.locator(".ui-modal__footer").getByRole("button", { name: "Chiudi", exact: true }).click();
  await editor.fill(`SELECT s.name, c.title
FROM "ENROLLMENT" e
JOIN "STUDENT" s ON s.id = e.student_id
JOIN "COURSE" c ON c.id = e.course_id
ORDER BY s.id, c.id
LIMIT 1;`);
  await editor.press("Control+Enter");
  await expect(page.getByRole("columnheader", { name: "name", exact: true })).toBeVisible();
  await expect(page.locator(".sql-playground-result tbody tr").first()).toHaveText(firstGeneratedRow!);

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica database", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("university.sqlite");
  const stream = await download.createReadStream();
  let byteLength = 0;
  for await (const chunk of stream) byteLength += chunk.length;
  expect(byteLength).toBeGreaterThan(100);
});

test("cancelling population reset preserves manually inserted data", async ({ page }) => {
  test.setTimeout(120_000);
  await bootProject(page);
  await openPlaygroundFromPalette(page);
  await page.getByRole("button", { name: "Crea database", exact: true }).click();
  await expect(page.getByText("Database pronto", { exact: true })).toBeVisible({ timeout: 20_000 });

  const editor = page.getByRole("textbox", { name: "Editor query SQL" });
  await editor.fill(`INSERT INTO "STUDENT" ("id", "name") VALUES (1, 'Ada');`);
  await editor.press("Control+Enter");
  await expect(page.getByText("1 istruzioni eseguite", { exact: true })).toBeVisible();
  await expect(page.getByText("Righe modificate", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Genera dati", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Genera dati" });
  await dialog.getByRole("button", { name: "Genera anteprima", exact: true }).click();
  await expect(dialog.getByText("Il database contiene dati o modifiche", { exact: true })).toBeVisible({ timeout: 20_000 });
  await dialog.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await editor.fill(`SELECT name FROM "STUDENT" WHERE name = 'Ada';`);
  await editor.press("Control+Enter");
  await expect(page.getByRole("cell", { name: "Ada", exact: true })).toBeVisible();
});

test("runs real SQLite WASM, reports results and constraints, exports, and reopens the session", async ({ page }) => {
  test.setTimeout(60_000);
  await bootProject(page);
  await openPlaygroundFromPalette(page);

  await expect(page.getByText("Database non creato", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Crea database", exact: true }).click();
  await expect(page.getByText("Database pronto", { exact: true })).toBeVisible({ timeout: 20_000 });

  const editor = page.getByRole("textbox", { name: "Editor query SQL" });
  await expect(editor).toContainText("sqlite_master");
  await editor.press("Control+Enter");
  await expect(page.getByRole("cell", { name: "STUDENT", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "COURSE", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "ENROLLMENT", exact: true })).toBeVisible();

  await editor.fill(`INSERT INTO "STUDENT" ("id", "name") VALUES (1, 'Ada');
INSERT INTO "COURSE" ("id", "title") VALUES (10, 'Databases');
INSERT INTO "ENROLLMENT" ("student_id", "course_id") VALUES (1, 10);`);
  await editor.press("Control+Enter");
  await expect(page.getByText("3 istruzioni eseguite", { exact: true })).toBeVisible();
  await expect(page.getByText("Righe modificate", { exact: true })).toHaveCount(3);

  await editor.fill(`SELECT s.name, c.title
FROM "ENROLLMENT" e
JOIN "STUDENT" s ON s.id = e.student_id
JOIN "COURSE" c ON c.id = e.course_id;`);
  await editor.press("Control+Enter");
  await expect(page.getByRole("cell", { name: "Ada", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Databases", exact: true })).toBeVisible();

  await editor.fill(`INSERT INTO "STUDENT" ("id", "name") VALUES (1, 'Duplicate');`);
  await editor.press("Control+Enter");
  await expect(page.getByText(/UNIQUE constraint failed: STUDENT.id/i)).toBeVisible();

  await editor.fill(`INSERT INTO "ENROLLMENT" ("student_id", "course_id") VALUES (99, 10);`);
  await editor.press("Control+Enter");
  await expect(page.getByText(/FOREIGN KEY constraint failed/i)).toBeVisible();

  await page.getByRole("button", { name: /^university\.erschema/ }).click();
  const nameColumn = page.locator(".logical-column-row").filter({ hasText: /^name/ });
  await expect(nameColumn).toBeVisible();
  await nameColumn.click();
  await page.getByRole("toolbar", { name: "Strumenti schema logico" }).getByRole("button", { name: "Tipo" }).click();
  await page.locator(".designer-schema-type-shortcuts button", { hasText: "TEXT" }).click();
  await expect(nameColumn).toContainText("TEXT");
  await page.getByRole("button", { name: /^Playground · university\.erschema/ }).click();
  await expect(page.locator(".ui-badge", { hasText: "Database da aggiornare" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Ricrea database", exact: true }).click();
  const resetDialog = page.getByRole("dialog", { name: "Ricreare il database?" });
  await expect(resetDialog).toBeVisible();
  await resetDialog.getByRole("button", { name: "Ricrea database", exact: true }).click();
  await expect(page.getByText("Database pronto", { exact: true })).toBeVisible({ timeout: 20_000 });
  await editor.fill(`SELECT COUNT(*) AS total FROM "STUDENT";`);
  await editor.press("Control+Enter");
  await expect(page.getByRole("cell", { name: "0", exact: true })).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Scarica database", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("university.sqlite");

  const playgroundTab = page.locator(".project-file-tab.active");
  await expect(playgroundTab).toContainText("Playground · university.erschema");
  await page.getByRole("button", { name: /^Chiudi tab Playground/ }).click();
  await expect(page.locator(".sql-playground-workspace")).toHaveCount(0);
  await openPlaygroundFromPalette(page);
  await expect(editor).toHaveValue(/SELECT COUNT\(\*\) AS total/);
  await expect(page.getByText("Database pronto", { exact: true })).toBeVisible();
});

test("command bar, shared editor, resizable results and SQL Explorer stay integrated", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootProject(page);
  await openPlaygroundFromPalette(page);

  const commandBar = page.locator(".sql-playground-command-bar");
  await expect(commandBar).toHaveCount(1);
  await expect(page.locator(".sql-playground-toolbar")).toHaveCount(0);
  const alignedControls = await commandBar.locator("h1, button").evaluateAll((elements) => elements.map((element) => {
    const box = element.getBoundingClientRect();
    return box.top + box.height / 2;
  }));
  expect(Math.max(...alignedControls) - Math.min(...alignedControls)).toBeLessThan(8);
  await expect(page.locator(".designer-code-line-numbers")).toBeVisible();
  await expect(page.locator(".sql-token-keyword").first()).toBeVisible();

  await page.getByRole("button", { name: "Crea database", exact: true }).click();
  await expect(page.getByText("Database pronto", { exact: true })).toBeVisible({ timeout: 20_000 });
  const editor = page.getByRole("textbox", { name: "Editor query SQL" });
  await editor.fill(`INSERT INTO "STUDENT" ("id", "name") VALUES (1, 'Ada');
INSERT INTO "STUDENT" ("id", "name") VALUES (2, 'Luca');
INSERT INTO "STUDENT" ("id", "name") VALUES (3, 'Mira');`);
  await page.getByRole("button", { name: "Esegui", exact: true }).click();
  await editor.fill(`SELECT id, name FROM "STUDENT" ORDER BY id;`);
  await editor.press("Control+Enter");
  await expect(page.getByRole("rowheader")).toHaveText(["1", "2", "3"]);

  const splitter = page.getByRole("separator", { name: "Ridimensiona pannello risultati" });
  const editorRegion = page.locator(".sql-playground-editor");
  const resultsPanel = page.locator(".sql-playground-results");
  const splitterBox = await splitter.boundingBox();
  const editorBefore = await editorRegion.boundingBox();
  const resultsBefore = await resultsPanel.boundingBox();
  expect(splitterBox && editorBefore && resultsBefore).toBeTruthy();
  await page.mouse.move(splitterBox!.x + splitterBox!.width / 2, splitterBox!.y + splitterBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(splitterBox!.x + splitterBox!.width / 2, splitterBox!.y - 72);
  await page.mouse.up();
  const editorAfterDrag = await editorRegion.boundingBox();
  const resultsAfterDrag = await resultsPanel.boundingBox();
  expect(resultsAfterDrag!.height).toBeGreaterThan(resultsBefore!.height + 40);
  expect(editorAfterDrag!.height).toBeLessThan(editorBefore!.height - 40);
  await splitter.focus();
  const beforeKeyboard = (await resultsPanel.boundingBox())!.height;
  await splitter.press("ArrowDown");
  expect((await resultsPanel.boundingBox())!.height).toBeLessThan(beforeKeyboard);

  const expandedHeight = (await editorRegion.boundingBox())!.height;
  await page.getByRole("button", { name: "Nascondi risultati" }).click();
  await expect(resultsPanel).toHaveClass(/is-collapsed/);
  expect((await editorRegion.boundingBox())!.height).toBeGreaterThan(expandedHeight);
  await page.getByRole("button", { name: "Mostra risultati" }).click();
  await expect(resultsPanel).not.toHaveClass(/is-collapsed/);

  const railButtons = page.locator(".project-activity-rail > .ui-tooltip-anchor > .project-activity-button");
  const labels = await railButtons.evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
  expect(labels.indexOf("SQL Explorer")).toBe(labels.indexOf("Export") - 1);
  await page.getByRole("button", { name: "SQL Explorer", exact: true }).click();
  const explorer = page.locator(".sql-explorer-panel");
  await expect(explorer).toBeVisible();
  await expect(explorer.getByRole("treeitem", { name: /^main/ })).toBeVisible();
  await explorer.getByRole("treeitem", { name: /^Tabelle \(3\)/ }).click();
  await expect(explorer.getByRole("treeitem", { name: /^STUDENT/ })).toBeVisible();
  await explorer.getByRole("treeitem", { name: /^STUDENT/ }).click();
  await explorer.getByRole("treeitem", { name: /^Colonne \(2\)/ }).click();
  await expect(explorer.getByRole("treeitem", { name: /^id INTEGER.*Chiave primaria/ })).toBeVisible();
  await explorer.getByRole("treeitem", { name: /^ENROLLMENT/ }).click();
  await explorer.getByRole("treeitem", { name: /^Chiavi esterne \(2\)/ }).click();
  await expect(explorer.getByRole("treeitem", { name: /→ STUDENT\.id/ })).toBeVisible();

  await editor.fill("CREATE TABLE TEST_TABLE (id INTEGER PRIMARY KEY, value TEXT NOT NULL);");
  await editor.press("Control+Enter");
  await expect(explorer.getByRole("treeitem", { name: /^Tabelle \(4\)/ })).toBeVisible();
  await expect(explorer.getByRole("treeitem", { name: /^TEST_TABLE/ })).toBeVisible();
  await editor.fill("DROP TABLE TEST_TABLE;");
  await editor.press("Control+Enter");
  await expect(explorer.getByRole("treeitem", { name: /^Tabelle \(3\)/ })).toBeVisible();
  await expect(explorer.getByRole("treeitem", { name: /^TEST_TABLE/ })).toHaveCount(0);
  await explorer.locator(".workspace-panel__close").click();
  await expect(page.locator(".sql-playground-workspace")).toBeVisible();

  const axe = await new AxeBuilder({ page })
    .include(".sql-playground-workspace")
    .include(".project-activity-panel")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(axe.violations).toEqual([]);
});

test("population dialog remains contained across required viewports and passes WCAG A/AA", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootProject(page);
  await openPlaygroundFromPalette(page);
  await page.getByRole("button", { name: "Crea database", exact: true }).click();
  await expect(page.getByText("Database pronto", { exact: true })).toBeVisible({ timeout: 20_000 });
  const workspace = page.locator(".sql-playground-workspace");
  await page.getByRole("button", { name: "Genera dati", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Genera dati" });
  const requiredViewports = [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ];
  for (const viewport of requiredViewports) {
    await page.setViewportSize(viewport);
    await expect(workspace).toBeVisible();
    await expect(dialog.getByLabel("Righe per tabella")).toBeVisible();
    await expect(dialog.getByLabel("Seed")).toBeVisible();
    await expect(dialog.locator(".ui-modal__footer")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await dialog.getByRole("button", { name: "Genera anteprima", exact: true }).click();
  await expect(dialog.getByLabel("Anteprima SQL del dataset generato")).toBeVisible({ timeout: 20_000 });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
    { width: 360, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(workspace).toBeVisible();
    await expect(dialog.getByLabel("Anteprima SQL del dataset generato")).toBeVisible();
    await expect(dialog.locator(".ui-modal__footer")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await workspace.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await dialog.getByLabel("Anteprima SQL del dataset generato").evaluate((element) => getComputedStyle(element).overflowX)).toBe("auto");
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "output/playwright/sql-population-preview-mobile-390x844.png" });
  const results = await new AxeBuilder({ page })
    .include(".sql-playground-workspace")
    .include(".sql-population-dialog")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("SQL Explorer remains contained across supported viewports and passes the existing WCAG A/AA scan", async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await bootProject(page);
  await openPlaygroundFromPalette(page);
  await page.getByRole("button", { name: "Crea database", exact: true }).click();
  await expect(page.getByText("Database pronto", { exact: true })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "SQL Explorer", exact: true }).click();
  const workspace = page.locator(".sql-playground-workspace");
  const explorer = page.locator(".sql-explorer-panel");
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1180, height: 760 },
    { width: 900, height: 760 },
    { width: 720, height: 760 },
    { width: 582, height: 760 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(workspace).toBeVisible();
    await expect(explorer).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    expect(await workspace.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    expect(await explorer.locator(".sql-explorer-panel__body").evaluate((element) => getComputedStyle(element).overflowX)).toBe("auto");
  }
  const results = await new AxeBuilder({ page })
    .include(".sql-playground-workspace")
    .include(".sql-explorer-panel")
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
