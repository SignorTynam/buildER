import { expect, test } from "@playwright/test";
import { confirmNewProjectDialog } from "./utils/newProject";

test("welcome, empty actions, and compact header stay balanced", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("chen-er-diagram-studio:locale", "sq");
    // Il tour va tenuto fuori: finche e aperto la Welcome passa di proposito a
    // due colonne per lasciare il posto al dock, che altrimenti si posa sulla
    // colonna dei suggerimenti. Qui si misura la disposizione a regime, e la
    // dipendenza dall'onboarding era incidentale — questo test non lo nomina.
    // L'arrangiamento con tour aperto e coperto da canvas-overlays.spec.ts.
    window.localStorage.setItem("chen-er-diagram-studio:onboarding-v1:done", "1");
  });

  await page.setViewportSize({ width: 1295, height: 861 });
  await page.goto("/");

  const createProject = page.locator(
    ".no-project-welcome-page .workspace-welcome-action-card--primary",
  );
  await expect(createProject).toHaveCount(1);
  await createProject.click();
  await confirmNewProjectDialog(page);

  await expect(page.locator(".workspace-welcome-page")).toBeVisible();
  await expect(page.locator(".workspace-welcome-workflow")).toHaveCount(0);
  await expect(page.locator(".workspace-welcome-tips")).toBeVisible();

  const desktopColumns = await page.evaluate(() => {
    const project = document.querySelector<HTMLElement>(".workspace-welcome-project");
    const tips = document.querySelector<HTMLElement>(".workspace-welcome-tips");
    if (!project || !tips) return null;
    return {
      projectLeft: project.getBoundingClientRect().left,
      tipsLeft: tips.getBoundingClientRect().left,
    };
  });
  expect(desktopColumns).not.toBeNull();
  expect(desktopColumns!.tipsLeft).toBeGreaterThan(desktopColumns!.projectLeft);

  const closeWelcome = page.locator(".project-file-tab__close");
  await expect(closeWelcome).toHaveCount(1);
  await closeWelcome.click();
  await expect(page.locator(".workspace-empty-editor")).toBeVisible();

  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 1180, height: 800 },
    { width: 1179, height: 800 },
    { width: 1024, height: 800 },
    { width: 901, height: 800 },
    { width: 900, height: 800 },
    { width: 703, height: 861 },
    { width: 640, height: 861 },
    { width: 582, height: 861 },
    { width: 480, height: 800 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    const headerWorkspaceGap = await page.evaluate(() => {
      const header = document.querySelector<HTMLElement>(".designer-topbar");
      const workspace = document.querySelector<HTMLElement>(".app-workspace-region");
      if (!header || !workspace) return Number.NaN;
      return workspace.getBoundingClientRect().top - header.getBoundingClientRect().bottom;
    });
    expect(Math.abs(headerWorkspaceGap)).toBeLessThanOrEqual(0.5);
  }

  for (const viewport of [
    { width: 703, height: 861 },
    { width: 582, height: 861 },
    { width: 390, height: 844 },
    { width: 320, height: 568 },
  ]) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => {
      const headerButtons = Array.from(
        document.querySelectorAll<HTMLElement>(".designer-topbar-actions .designer-icon-button"),
      ).filter((button) => button.getBoundingClientRect().width > 0);
      const actions = Array.from(
        document.querySelectorAll<HTMLElement>(".workspace-empty-editor__button"),
      );
      const panel = document.querySelector<HTMLElement>(".workspace-empty-editor__panel");
      const activityPanel = document.querySelector<HTMLElement>(".project-activity-panel");

      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        activityPanelWidth: activityPanel?.getBoundingClientRect().width ?? 0,
        headerSizes: headerButtons.map((button) => button.getBoundingClientRect().width),
        actionWidths: actions.map((button) => button.getBoundingClientRect().width),
        panelWidth: panel?.getBoundingClientRect().width ?? 0,
      };
    });

    expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth + 1);
    expect(geometry.activityPanelWidth).toBeLessThanOrEqual(49);
    expect(geometry.headerSizes.every((size) => size <= 32)).toBe(true);
    expect(new Set(geometry.actionWidths.map(Math.round)).size).toBeGreaterThan(1);
    expect(geometry.actionWidths.every((size) => size < geometry.panelWidth)).toBe(true);
  }

  await page.setViewportSize({ width: 582, height: 861 });
  const activityButton = page.locator(".project-activity-button").first();
  const activityPanel = page.locator(".project-activity-panel");
  if (!(await activityPanel.evaluate((element) => element.classList.contains("project-activity-panel--collapsed")))) {
    await activityButton.click();
  }
  await expect(page.locator(".project-activity-panel--collapsed")).toBeVisible();

  await activityButton.click();
  await expect(page.locator(".project-activity-panel--collapsed")).toHaveCount(0);

  const openDrawerGeometry = await page.evaluate(() => {
    const activityPanel = document.querySelector<HTMLElement>(".project-activity-panel");
    const activityContent = document.querySelector<HTMLElement>(".project-activity-content");
    const panelBounds = activityPanel?.getBoundingClientRect();
    const contentBounds = activityContent?.getBoundingClientRect();
    return {
      panelWidth: panelBounds?.width ?? 0,
      panelRight: panelBounds?.right ?? 0,
      contentLeft: contentBounds?.left ?? 0,
      contentRight: contentBounds?.right ?? 0,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(openDrawerGeometry.panelWidth).toBeLessThanOrEqual(49);
  expect(openDrawerGeometry.contentLeft).toBeCloseTo(openDrawerGeometry.panelRight, 1);
  expect(openDrawerGeometry.contentRight).toBeLessThan(openDrawerGeometry.viewportWidth);

  await activityButton.click();
  await expect(page.locator(".project-activity-panel--collapsed")).toBeVisible();
});
