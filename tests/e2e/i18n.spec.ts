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

  await expect(page.getByTestId("app-header-new-project")).toContainText("Nuovo progetto");
  await expect(page.getByTestId("app-header-open-project")).toContainText("Apri progetto");

  await page.getByTestId("app-header-menu").click();
  await expect(page.getByTestId("command-menu")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Menu comandi" })).toBeVisible();
  await expect(page.getByTestId("command-menu-search")).toHaveAttribute("placeholder", "Cerca comando...");

  await page.getByTestId("language-command-en").click();
  await expect(page.getByTestId("app-header-new-project")).toContainText("New project");
  await expect(page.getByTestId("app-header-open-project")).toContainText("Open project");

  await page.getByTestId("app-header-menu").click();
  await expect(page.getByRole("dialog", { name: "Command menu" })).toBeVisible();
  await expect(page.getByTestId("command-menu-search")).toHaveAttribute("placeholder", "Search command...");
  await expect(page.getByText("Menu comandi")).toHaveCount(0);

  await page.getByTestId("language-command-sq").click();
  await expect(page.getByTestId("app-header-new-project")).toContainText("Projekt i ri");
  await expect(page.getByTestId("app-header-open-project")).toContainText("Hap projektin");

  await page.getByTestId("app-header-menu").click();
  await expect(page.getByRole("dialog", { name: "Menuja e komandave" })).toBeVisible();
  await expect(page.getByTestId("command-menu-search")).toHaveAttribute("placeholder", "Kërko komandë...");
  await expect(page.getByText("Command menu")).toHaveCount(0);
  await expect(page.getByText("Menu comandi")).toHaveCount(0);

  await page.reload();
  await expect(page.locator(".app-shell")).toBeVisible();
  await expect(page.getByTestId("app-header-new-project")).toContainText("Projekt i ri");

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
