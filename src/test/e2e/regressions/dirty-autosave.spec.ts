import { expect } from "@playwright/test";
import { focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[A10] starting a new score asks before discarding an unsaved edit", async ({ page }) => {
  const score = guitarWithBars([[5]]);
  await openApp(page, { fixture: score });
  await focusScore(page);

  await page.keyboard.press("x");
  await expect.poll(async () => (await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].deadNote).toBe(true);
  await page.keyboard.press("Control+n");

  test.fail(true, "R1 guards dirty documents before replacing them.");
  expect(await page.getByRole("dialog").count()).toBe(1);
  expect((await state(page)).score.meta.title).toBe(score.meta.title);
});

test("[A10] a dirty document requests confirmation before closing", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  await focusScore(page);
  await page.keyboard.press("x");
  await expect.poll(async () => (await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].deadNote).toBe(true);
  const prevented = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });

  test.fail(true, "R1 installs beforeunload protection only while edits are unsaved.");
  expect(prevented).toBe(true);
});

test("[A10] starting a native download marks the current edit saved", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined }));
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  await focusScore(page);
  await page.keyboard.press("x");
  await expect.poll(async () => (await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].deadNote).toBe(true);
  await page.getByTitle("File I/O").click();
  await expect(page.getByText("Unsaved changes", { exact: true })).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  expect((await download).suggestedFilename()).toBeTruthy();

  test.fail(true, "R1 records the saved revision when the native download starts.");
  expect(await page.getByText("Unsaved changes", { exact: true }).isVisible()).toBe(false);
});
