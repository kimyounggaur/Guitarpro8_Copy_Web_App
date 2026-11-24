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

  const dialog = page.getByRole("dialog", { name: "Unsaved changes" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
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

  await expect(page.getByText("Unsaved changes", { exact: true })).toBeHidden();
  const { revision, savedRevision } = (await state(page)).revision;
  expect(savedRevision).toBe(revision);
  expect(await page.evaluate(() => !window.dispatchEvent(new Event("beforeunload", { cancelable: true })))).toBe(false);
});


test("[A10] a fresh page offers to recover the edited score from IndexedDB", async ({ page, context }) => {
  const fixture = guitarWithBars([[5]]);
  fixture.meta.title = "Autosaved guitar study";
  await openApp(page, { fixture });
  await focusScore(page);
  await page.keyboard.press("x");
  await expect.poll(async () => (await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].deadNote).toBe(true);
  const score = (await state(page)).score;

  await expect.poll(() => page.evaluate(async () => {
    return await new Promise<number>((resolve, reject) => {
      const database = indexedDB.open("tabscore-recovery", 1);
      database.onerror = () => reject(database.error);
      database.onsuccess = () => {
        const db = database.result;
        const operation = db.transaction("snapshots").objectStore("snapshots").count();
        operation.onsuccess = () => { db.close(); resolve(operation.result); };
        operation.onerror = () => { db.close(); reject(operation.error); };
      };
    });
  }), { timeout: 7000 }).toBe(1);

  const receivingPage = await context.newPage();
  await receivingPage.goto("/?testMode=e2e");
  const recovery = receivingPage.getByRole("dialog", { name: "Recover unsaved work" });
  await expect(recovery).toBeVisible();
  await expect(recovery.getByText(fixture.meta.title)).toBeVisible();
  await recovery.getByRole("button", { name: "Recover" }).click();
  await expect(recovery).toBeHidden();
  await expect.poll(async () => (await state(receivingPage)).score).toEqual(score);
  expect((await state(receivingPage)).revision.savedRevision).toBeNull();
});

test("[A10] cancelling the save picker keeps the current edit when choosing Save and continue", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "showSaveFilePicker", {
      value: async () => { throw new DOMException("Cancelled", "AbortError"); }
    });
  });
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  await focusScore(page);
  await page.keyboard.press("x");
  await expect.poll(async () => (await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].deadNote).toBe(true);
  const previous = await state(page);

  await page.keyboard.press("Control+n");
  const dialog = page.getByRole("dialog", { name: "Unsaved changes" });
  await dialog.getByRole("button", { name: "Save and continue" }).click();
  await expect(dialog).toBeHidden();
  await expect.poll(() => state(page)).toEqual(previous);
});
