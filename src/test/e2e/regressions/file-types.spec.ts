import { expect } from "@playwright/test";
import { openApp, state, test } from "../helpers";
import { dropFileOnScore } from "./dropFile";

test("[B16] a binary Guitar Pro drop offers MusicXML import guidance", async ({ page }) => {
  await openApp(page);
  const before = await state(page);

  // A ZIP local-file header identifies the unsupported GP7/8 family.
  await dropFileOnScore(page, "binary-score.gp", [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
  const status = page.locator(".fileIoStatus");
  await expect(status).toBeVisible();
  await expect(status).not.toHaveText(/and PDF are ready\.$/);
  expect((await state(page)).score.meta.title).toBe(before.score.meta.title);

});

test("[B16] native export downloads the score with its own extension", async ({ page }) => {
  await openApp(page);
  await page.getByTitle("File I/O").click();

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Save", exact: true }).click()
  ]);

  expect(download.suggestedFilename()).toMatch(/\.tabscore$/);
});
