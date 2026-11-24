import { expect } from "@playwright/test";
import { openApp, test, state } from "../helpers";

test("[C1] menus list working actions and dispatch through the editor", async ({ page }) => {
  await openApp(page);
  const nav = page.getByRole("navigation", { name: "Application menus" });
  const bars = (await state(page)).score.masterBars.length;
  await nav.getByRole("button", { name: "Bar", exact: true }).click();
  await nav.getByRole("button", { name: /Insert Bar/ }).click();
  expect((await state(page)).score.masterBars).toHaveLength(bars + 1);
  await nav.getByRole("button", { name: "File", exact: true }).click();
  await expect(nav.getByRole("button", { name: /Preferences/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(nav.getByRole("button", { name: "File", exact: true })).toBeFocused();
  await expect(page.getByTestId("tab-add")).toBeEnabled();
});

test("[C2] command search omits unsupported commands and executes an available one", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("Control+e");
  const search = page.getByTestId("command-palette-input");
  await search.fill("lyrics");
  await expect(page.getByRole("dialog", { name: "Command palette" }).getByRole("button", { name: /lyrics/i })).toHaveCount(0);
  const bars = (await state(page)).score.masterBars.length;
  await search.fill("add-bar 2");
  await search.press("Enter");
  expect((await state(page)).score.masterBars).toHaveLength(bars + 2);
});

test("[C8] planning-only features are hidden while working chords remain reachable", async ({ page }) => {
  await openApp(page);
  const edition = page.getByRole("complementary", { name: "Edition palette" });
  await expect(edition.getByText("Design", { exact: true })).toHaveCount(0);
  await expect(edition.getByText("Lyrics", { exact: true })).toHaveCount(0);
  const nav = page.getByRole("navigation", { name: "Application menus" });
  await nav.getByRole("button", { name: "Tools", exact: true }).click();
  await nav.getByRole("button", { name: /^Chords/ }).click();
  await expect(page.getByRole("region", { name: "Tools", exact: true })).toBeVisible();
});
