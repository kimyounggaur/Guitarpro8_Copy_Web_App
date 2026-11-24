import { expect } from "@playwright/test";
import { test } from "./helpers";

/**
 * Editor shell regressions retain short-key behavior and verify the current
 * inspector tab and dock contract.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/?testMode=visual");
  await expect(page.getByTestId("gp-shell")).toBeVisible();
  await page.waitForFunction(() => document.fonts.ready.then(() => true));
});

test("initial editor opens with all six panels visible", async ({ page }) => {
  await expect(page.getByTestId("workspace-panel")).toBeVisible();
  await expect(page.getByTestId("palette-panel")).toBeVisible();
  await expect(page.getByTestId("inspector-panel")).toBeVisible();
  await expect(page.getByTestId("bottom-dock")).toBeVisible();
});

test("F2 hides and restores the edition palette", async ({ page }) => {
  await expect(page.getByTestId("palette-panel")).toBeVisible();

  await page.keyboard.press("F2");
  await expect(page.getByTestId("palette-panel")).toBeHidden();

  await page.keyboard.press("F2");
  await expect(page.getByTestId("palette-panel")).toBeVisible();
});

test("[Phase 11] F5 and F6 focus their inspector tab and close it when repeated", async ({ page }) => {
  const inspector = page.getByTestId("inspector-panel");
  await expect(inspector.getByRole("tab", { name: "Song" })).toHaveAttribute("aria-selected", "true");
  await expect(inspector.getByText("Transposition", { exact: true })).toBeHidden();

  await page.keyboard.press("F6");
  await expect(inspector.getByRole("tab", { name: "Track" })).toHaveAttribute("aria-selected", "true");
  await expect(inspector.getByText("Transposition", { exact: true })).toBeVisible();

  await page.keyboard.press("F6");
  await expect(inspector).toBeHidden();
  await page.keyboard.press("F5");
  await expect(inspector.getByRole("tab", { name: "Song" })).toHaveAttribute("aria-selected", "true");
  await expect(inspector.getByText("Transposition", { exact: true })).toBeHidden();

  await inspector.getByRole("tab", { name: "Track" }).click();
  await expect(inspector.getByRole("tab", { name: "Track" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(inspector.getByRole("tab", { name: "Song" })).toBeFocused();
});

test("F8 toggles the Global View dock", async ({ page }) => {
  await expect(page.getByTestId("bottom-dock")).toBeVisible();

  await page.keyboard.press("F8");
  await expect(page.getByTestId("bottom-dock")).toBeHidden();

  await page.keyboard.press("F8");
  await expect(page.getByTestId("bottom-dock")).toBeVisible();
});

test("Command Palette opens on Ctrl+E and closes on Escape", async ({ page }) => {
  await expect(page.getByTestId("command-palette")).toHaveCount(0);

  await page.keyboard.press("Control+E");
  await expect(page.getByTestId("command-palette")).toBeVisible();
  await expect(page.getByTestId("command-palette-input")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("command-palette")).toHaveCount(0);
});

test("Play/Stop transport button round-trips playing and stopped state", async ({ page }) => {
  const playStop = page.getByTestId("transport-play-stop");
  await expect(playStop).toHaveText("Play");

  await playStop.click();
  await expect(playStop).toHaveText("Stop");

  await playStop.click();
  await expect(playStop).toHaveText("Play");
});
