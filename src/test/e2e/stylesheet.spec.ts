import { expect } from "@playwright/test";
import { focusScore, openApp, state, test } from "./helpers";

test("[C3] Letter paper updates the score and browser print size", async ({ page }) => {
  await page.addInitScript(() => { window.print = () => {}; });
  await openApp(page);
  await focusScore(page);
  await page.keyboard.press("F7");
  const style = page.getByRole("region", { name: "Score stylesheet" });
  await style.getByLabel("Paper").selectOption("Letter");
  expect((await state(page)).score.stylesheet.page).toMatchObject({ paper: "Letter", width: 816, height: 1056 });
  await style.getByRole("button", { name: "Close stylesheet" }).click();
  await page.getByTitle("File I/O", { exact: true }).click();
  await page.getByRole("region", { name: "File import and export" }).getByRole("button", { name: /^PDF/ }).click();
  const printed = page.locator(".printScorePages > section").first();
  await expect(printed).toBeAttached();
  const { width, height } = await printed.evaluate((element) => {
    const style = (element as HTMLElement).style;
    return { width: parseFloat(style.width), height: parseFloat(style.height) };
  });
  expect(width).toBeCloseTo(215.9, 2);
  expect(height).toBeCloseTo(279.4, 2);
});

test("[C3] saves the style for new scores across reloads without restyling the demo", async ({ page }) => {
  await openApp(page);
  await focusScore(page);
  await page.keyboard.press("F7");
  const style = page.getByRole("region", { name: "Score stylesheet" });
  await style.getByLabel("Paper").selectOption("Legal");
  await style.getByRole("button", { name: "Options" }).click();
  await style.getByRole("button", { name: "Save style" }).click();
  await expect(style.getByRole("status")).toHaveText("Default style saved");

  await page.keyboard.press("Control+n");
  const unsaved = page.getByRole("dialog", { name: "Unsaved changes" });
  await unsaved.getByRole("button", { name: "Discard and continue" }).click();
  await expect.poll(async () => (await state(page)).score.stylesheet.page.paper).toBe("Legal");

  await openApp(page);
  expect((await state(page)).score.stylesheet.page.paper).toBe("A4");
  await focusScore(page);
  await page.keyboard.press("Control+n");
  await expect.poll(async () => (await state(page)).score.stylesheet.page.paper).toBe("Legal");
});
