import { test, expect } from "@playwright/test";

/**
 * Full-shell screenshot golden per viewport project (see
 * playwright.config.ts — this spec runs once under each of the
 * visual-{1024x768,1280x768,1440x900,1920x1080} projects). Deliberately
 * changing shell dimensions (menu/toolbar/tab height, panel widths, dock
 * height) must fail this test — that is the whole point of the harness.
 */
test("editor shell golden screenshot", async ({ page }, info) => {
  await page.goto("/?testMode=visual");
  await expect(page.getByTestId("gp-shell")).toBeVisible();
  await page.waitForFunction(() => document.fonts.ready.then(() => true));

  const anchors = await page.evaluate(() => {
    const size = (selector: string) => {
      const bounds = document.querySelector(selector)?.getBoundingClientRect();
      return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } : null;
    };
    return {
      viewport: innerWidth,
      menu: size(".menuBar"), toolbar: size(".toolbar"), tabs: size(".tabScoreDocumentStrip"),
      palette: size("#editor-palette-dock"), inspector: size("#editor-inspector-dock"),
      global: size("#editor-global-dock"), workspace: size(".scoreViewport"), page: size(".scorePage"),
      lcd: size(".lcd")
    };
  });
  await info.attach("shell-anchors.json", { body: JSON.stringify(anchors), contentType: "application/json" });

  // Playwright auto-suffixes the snapshot filename with the project name
  // (visual-1024x768, visual-1280x768, ...) and platform, so one call here
  // produces one golden per viewport project.
  await expect(page).toHaveScreenshot("editor-shell.png", {
    fullPage: true,
    animations: "disabled"
  });
});
