import { expect, test } from "@playwright/test";

test("switches app chrome and command menu across Italian, English, and Albanian", async ({ page }) => {
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.addInitScript(() => {
    if (!window.localStorage.getItem("chen-er-diagram-studio:locale")) {
      window.localStorage.setItem("chen-er-diagram-studio:locale", "it");
    }
  });

  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible();

  await expect(page.locator(".app-command-tab", { hasText: "File" })).toHaveClass(/active/);
  await expect(page.locator(".project-activity-file-actions")).toContainText("Nuovo progetto");
  await expect(page.locator(".project-activity-file-actions")).toContainText("Apri progetto");
  await expect(page.locator(".designer-er-toolbar")).toContainText("Selezione");
  await expect(page.locator(".designer-er-toolbar")).toContainText("Entit");
  await expect(page.locator(".designer-er-toolbar")).toContainText("Esporta");

  await page.getByTestId("app-header-menu").click();
  await expect(page.getByTestId("command-menu")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Menu comandi" })).toBeVisible();
  await expect(page.getByTestId("command-menu-search")).toHaveAttribute("placeholder", "Cerca comando...");

  await page.getByTestId("language-command-en").click();
  await expect(page.locator(".project-activity-file-actions")).toContainText("New Project");
  await expect(page.locator(".project-activity-file-actions")).toContainText("Open Project");
  await expect(page.locator(".designer-er-toolbar")).toContainText("Select");
  await expect(page.locator(".designer-er-toolbar")).toContainText("Entity");
  await expect(page.locator(".designer-er-toolbar")).toContainText("Export");
  await expect(page.locator(".designer-er-toolbar")).not.toContainText("Selezione");

  await page.getByTestId("app-header-menu").click();
  await expect(page.getByRole("dialog", { name: "Command menu" })).toBeVisible();
  await expect(page.getByTestId("command-menu-search")).toHaveAttribute("placeholder", "Search command...");
  await expect(page.getByText("Menu comandi")).toHaveCount(0);

  await page.getByTestId("language-command-sq").click();
  await expect(page.locator(".project-activity-file-actions")).toContainText("Projekt i ri");
  await expect(page.locator(".project-activity-file-actions")).toContainText("Hap projekt");
  await expect(page.locator(".designer-er-toolbar")).toContainText("Përzgjedhje");
  await expect(page.locator(".designer-er-toolbar")).toContainText("Entitet");
  await expect(page.locator(".designer-er-toolbar")).toContainText("Eksporto");
  await expect(page.locator(".designer-er-toolbar")).not.toContainText("Nuovo progetto");
  await expect(page.locator(".designer-er-toolbar")).not.toContainText("Selezione");

  await page.getByTestId("app-header-menu").click();
  await expect(page.getByRole("dialog", { name: "Menuja e komandave" })).toBeVisible();
  await expect(page.getByTestId("command-menu-search")).toHaveAttribute("placeholder", "Kërko komandë...");
  await expect(page.getByText("Command menu")).toHaveCount(0);
  await expect(page.getByText("Menu comandi")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.locator(".project-activity-file-actions")).toContainText("Projekt i ri");

  await page.getByTestId("app-header-menu").click();
  await expect(page.getByRole("dialog", { name: "Menuja e komandave" })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});

test("localizes the loading screen from the stored locale", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("chen-er-diagram-studio:locale", "en");
  });

  await page.goto("/");
  await expect(page.getByTestId("app-loading-screen")).toContainText("Preparing workspace...");
  await expect(page.getByTestId("app-loading-tip")).toContainText("Tip:");
  await expect(page.locator(".app-shell")).toBeVisible();
});

test("localizes Albanian loading text from the stored locale", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("chen-er-diagram-studio:locale", "sq");
  });

  await page.goto("/");
  await expect(page.getByTestId("app-loading-screen")).toContainText("Duke përgatitur hapësirën e punës...");
  await expect(page.getByTestId("app-loading-tip")).toContainText("Këshillë:");
  await expect(page.locator(".app-shell")).toBeVisible();
});
