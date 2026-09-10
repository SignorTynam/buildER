import AxeBuilder from "@axe-core/playwright";
import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

async function boot(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("chen-er-diagram-studio:locale", "it");
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible({ timeout: 20_000 });
}

async function createSqliteFixture(): Promise<Buffer> {
  const sqlite = await sqlite3InitModule();
  const database = new sqlite.oo1.DB(":memory:");
  try {
    database.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE "STUDENT" ("id" INTEGER PRIMARY KEY, "name" TEXT NOT NULL UNIQUE);
      CREATE TABLE "COURSE" ("id" INTEGER PRIMARY KEY, "title" TEXT NOT NULL);
      CREATE TABLE "ENROLLMENT" (
        "student_id" INTEGER NOT NULL REFERENCES "STUDENT"("id"),
        "course_id" INTEGER NOT NULL REFERENCES "COURSE"("id"),
        PRIMARY KEY ("student_id", "course_id")
      );
      INSERT INTO "STUDENT" ("id", "name") VALUES (1, 'Ada');
      CREATE VIEW "STUDENT_NAMES" AS SELECT "name" FROM "STUDENT";
    `);
    return Buffer.from(sqlite.capi.sqlite3_js_db_export(database.pointer));
  } finally {
    database.close();
  }
}

test("opens, edits, exports, restores, and reverse-engineers a real SQLite database without a project", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  const sqliteBytes = await createSqliteFixture();

  await page.getByRole("button", { name: /Apri database SQLite/ }).click();
  await page.locator(`input[type="file"][accept*=".sqlite"]`).setInputFiles({
    name: "students.sqlite",
    mimeType: "application/vnd.sqlite3",
    buffer: sqliteBytes,
  });
  await expect(page.locator(".database-workspace")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".database-workspace").getByRole("button", { name: "Genera dati", exact: true })).toHaveCount(0);
  await expect(page.getByText("Database pronto", { exact: true })).toBeVisible();
  await expect(page.locator(".project-file-tab.active")).toContainText("Database");

  const editor = page.getByRole("textbox", { name: "Editor query SQL" });
  await editor.fill(`SELECT name FROM "STUDENT" ORDER BY id;`);
  await editor.press("Control+Enter");
  await expect(page.getByRole("cell", { name: "Ada", exact: true })).toBeVisible();

  await editor.fill(`INSERT INTO "STUDENT" ("id", "name") VALUES (2, 'Grace');`);
  await editor.press("Control+Enter");
  await expect(page.getByText("Database modificato", { exact: true })).toBeVisible();

  const modifiedDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Salva copia", exact: true }).click();
  const modifiedDownload = await modifiedDownloadPromise;
  expect(modifiedDownload.suggestedFilename()).toContain("modified.sqlite");
  await expect(page.getByText("Copia esportata", { exact: true })).toBeVisible();

  await editor.fill(`DELETE FROM "STUDENT" WHERE id = 1;`);
  await editor.press("Control+Enter");
  await page.getByRole("button", { name: "Ripristina originale", exact: true }).click();
  const restoreDialog = page.getByRole("dialog", { name: "Ripristinare il database originale?" });
  await restoreDialog.getByRole("button", { name: "Ripristina originale", exact: true }).click();
  await expect(page.getByText("Database pronto", { exact: true })).toBeVisible({ timeout: 20_000 });
  await editor.fill(`SELECT COUNT(*) AS total FROM "STUDENT";`);
  await editor.press("Control+Enter");
  await expect(page.getByRole("cell", { name: "1", exact: true })).toBeVisible();

  await page.locator(".database-workspace").getByRole("button", { name: "Reverse Engineering", exact: true }).click();
  const wizard = page.getByRole("dialog", { name: "Reverse Engineering del database" });
  await expect(wizard).toBeVisible();
  await expect(wizard.getByText("main.STUDENT", { exact: true })).toBeVisible();
  const axe = await new AxeBuilder({ page }).include(".database-reverse-wizard").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
  await page.keyboard.press("Escape");

  await editor.fill(`INSERT INTO "STUDENT" ("id", "name") VALUES (3, 'Linus');`);
  await editor.press("Control+Enter");
  await page.locator(".project-file-tab.active .project-file-tab__close").click();
  const closeDialog = page.getByRole("dialog", { name: "Modifiche non salvate" });
  await expect(closeDialog).toBeVisible();
  await closeDialog.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(page.locator(".database-workspace")).toBeVisible();

  await page.locator(".project-file-tab.active .project-file-tab__close").click();
  const closeDownloadPromise = page.waitForEvent("download");
  await page.getByRole("dialog", { name: "Modifiche non salvate" }).getByRole("button", { name: "Salva copia", exact: true }).click();
  await closeDownloadPromise;
  await expect(page.locator(".database-workspace")).toHaveCount(0);
  await expect(page.locator(".no-project-welcome-page")).toBeVisible();
});

test("rejects a renamed text file without creating a database tab", async ({ page }) => {
  await boot(page);
  await page.getByRole("button", { name: /Apri database SQLite/ }).click();
  await page.locator(`input[type="file"][accept*=".sqlite"]`).setInputFiles({
    name: "not-a-database.db",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("plain text"),
  });
  // Fase L3: il toast non e' piu' role="alert" (niente live region annidate dentro aria-live).
  // L'errore resta visibile nel toast ed e' annunciato dalla region assertiva dedicata.
  await expect(
    page.locator(".workspace-toast").filter({ hasText: /non contiene un database SQLite valido/i }),
  ).toBeVisible();
  await expect(page.locator('.workspace-toast-announcer[aria-live="assertive"]')).toContainText(
    /non contiene un database SQLite valido/i,
  );
  await expect(page.locator(".database-workspace")).toHaveCount(0);
});

test("SQL Explorer adds databases and its session selector activates the matching workspace", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  const sqliteBytes = await createSqliteFixture();

  await page.getByRole("button", { name: /Apri database SQLite/ }).click();
  await page.locator(`input[type="file"][accept*=".sqlite"]`).setInputFiles({
    name: "first-university.sqlite",
    mimeType: "application/vnd.sqlite3",
    buffer: sqliteBytes,
  });
  await expect(page.locator(".project-file-tab.active")).toContainText("Database · first-university.sqlite", { timeout: 20_000 });

  await page.getByRole("button", { name: "SQL Explorer", exact: true }).click();
  const explorer = page.locator(".sql-explorer-panel");
  await expect(explorer).toBeVisible();
  const addDatabase = explorer.getByRole("button", { name: "Aggiungi database", exact: true });
  await expect(addDatabase).toBeVisible();

  const chooserPromise = page.waitForEvent("filechooser");
  await addDatabase.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: "second-university.sqlite",
    mimeType: "application/vnd.sqlite3",
    buffer: sqliteBytes,
  });
  await expect(page.locator(".project-file-tab.active")).toContainText("Database · second-university.sqlite", { timeout: 20_000 });

  const sessionSelect = explorer.getByRole("combobox", { name: "Sessione database" });
  await expect(sessionSelect.locator("option")).toHaveCount(2);
  await sessionSelect.selectOption({ label: "first-university.sqlite · Database importato" });
  await expect(page.locator(".project-file-tab.active")).toContainText("Database · first-university.sqlite");
  await expect(page.locator(".database-workspace")).toContainText("first-university.sqlite");

  await sessionSelect.selectOption({ label: "second-university.sqlite · Database importato" });
  await expect(page.locator(".project-file-tab.active")).toContainText("Database · second-university.sqlite");
  await expect(page.locator(".database-workspace")).toContainText("second-university.sqlite");
});

test("styles every Database Reverse Engineering step and its completion state", async ({ page }) => {
  test.setTimeout(120_000);
  await boot(page);
  const sqliteBytes = await createSqliteFixture();

  await page.getByRole("button", { name: /Apri database SQLite/ }).click();
  await page.locator(`input[type="file"][accept*=".sqlite"]`).setInputFiles({
    name: "reverse-style.sqlite",
    mimeType: "application/vnd.sqlite3",
    buffer: sqliteBytes,
  });
  await expect(page.locator(".database-workspace")).toBeVisible({ timeout: 20_000 });
  await page.locator(".database-workspace").getByRole("button", { name: "Reverse Engineering", exact: true }).click();

  const wizard = page.getByRole("dialog", { name: "Reverse Engineering del database" });
  await expect(wizard).toBeVisible();
  await expect(wizard.locator(".database-reverse-progress .is-current")).toContainText("Analisi database");
  await expect(wizard.locator(".database-reverse-summary > div").first()).toHaveCSS("border-radius", "6px");

  await wizard.getByRole("button", { name: "Continua", exact: true }).click();
  await expect(wizard.getByRole("region", { name: "Anteprima modello logico" })).toBeVisible();
  await wizard.getByRole("button", { name: "Continua", exact: true }).click();
  const erPreview = wizard.getByRole("region", { name: "Anteprima diagramma ER" });
  await expect(erPreview).toBeVisible();
  const previewColors = await erPreview.evaluate((element) => {
    const canvas = element.querySelector(".diagram-canvas");
    const node = element.querySelector(".diagram-node rect");
    const chip = element.querySelector(".edge-label-chip");
    return {
      canvas: canvas ? getComputedStyle(canvas).backgroundColor : "",
      node: node ? getComputedStyle(node).fill : "",
      chip: chip ? getComputedStyle(chip).fill : null,
    };
  });
  expect(previewColors.node).toBe(previewColors.canvas);
  if (previewColors.chip) expect(previewColors.chip).toBe(previewColors.canvas);

  await wizard.getByRole("button", { name: "Continua", exact: true }).click();
  await expect(wizard.getByRole("group", { name: "Destinazione" })).toBeVisible();
  await expect(wizard.locator(".database-reverse-choice.is-selected")).toHaveCount(1);
  await expect(wizard.locator(".database-reverse-destination__fields")).toBeVisible();

  await wizard.getByRole("button", { name: "Crea schema", exact: true }).click();
  await expect(wizard.getByText("Reverse Engineering completato", { exact: true })).toBeVisible({ timeout: 20_000 });
  await expect(wizard.locator(".database-reverse-complete__hero")).toBeVisible();
  const axe = await new AxeBuilder({ page }).include(".database-reverse-wizard").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(axe.violations).toEqual([]);
});
