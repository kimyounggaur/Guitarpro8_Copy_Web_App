import { expect, type Page } from "@playwright/test";
import { focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

async function firstFret(page: Page) {
  return (await state(page)).score.tracks[0].bars[0].voices[0].beats[0]?.notes[0]?.fret;
}

test("document tabs keep independent notes, history, view and playback", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  await focusScore(page);
  const tabbar = page.getByTestId("tab-bar");
  const tabs = tabbar.getByRole("tab");
  await page.keyboard.press("7");
  await page.keyboard.press("Control+=");
  await tabbar.getByTestId("tab-add").click();
  await expect(tabs).toHaveCount(2);
  expect((await state(page)).view.zoom).toBe(100);

  await focusScore(page);
  await page.keyboard.press("3");
  await expect.poll(() => firstFret(page)).toBe(3);
  await page.keyboard.press("Control+Shift+Tab");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
  expect((await state(page)).view.zoom).toBe(105);
  expect(await firstFret(page)).toBe(7);
  await page.keyboard.press("Control+z");
  expect(await firstFret(page)).toBe(5);

  await page.getByTestId("transport-play-stop").click();
  await expect.poll(async () => (await state(page)).playback.status).toBe("playing");
  await tabs.last().click();
  expect((await state(page)).playback.status).toBe("stopped");
  expect(await firstFret(page)).toBe(3);
  await page.keyboard.press("Control+Tab");
  await expect(tabs.first()).toHaveAttribute("aria-selected", "true");
});

test("closing a dirty background tab can cancel or save without changing the active tab", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined }));
  const fixture = guitarWithBars([[5]]);
  fixture.meta.title = "Background exercise";
  await openApp(page, { fixture });
  await focusScore(page);
  await page.keyboard.press("7");
  await page.getByTestId("tab-add").click();
  const tabs = page.getByRole("tablist", { name: "Open documents" }).getByRole("tab");
  const close = page.getByRole("button", { name: "Close Background exercise" });
  await close.click();
  const dialog = page.getByRole("dialog", { name: "Unsaved changes" });
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(tabs).toHaveCount(2);
  await expect(tabs.last()).toHaveAttribute("aria-selected", "true");
  await close.click();
  const downloadPromise = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Save and continue" }).click();
  expect((await downloadPromise).suggestedFilename()).toContain("Background");
  await expect(tabs).toHaveCount(1);
  expect((await state(page)).score.meta.title).toBe("");
  await page.getByRole("button", { name: "Close Untitled" }).click();
  await expect(page.getByRole("heading", { name: "TabScore" })).toBeVisible();
});

test("Home preserves the editor and creates an independent template document", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5], [6]]) });
  await focusScore(page);
  await page.keyboard.press("7");
  const original = await state(page);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await expect(page.getByRole("heading", { name: "TabScore" })).toBeVisible();
  await expect(page.getByTestId("gp-shell")).toBeHidden();
  await page.getByRole("button", { name: "Return to editor" }).click();
  await expect(page.getByTestId("gp-shell")).toBeVisible();
  expect((await state(page)).score).toEqual(original.score);
  expect((await state(page)).cursor).toEqual(original.cursor);

  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("button", { name: /Templates/ }).click();
  await page.getByRole("searchbox", { name: "Search scores" }).fill("piano");
  await expect(page.getByRole("region", { name: "Score preview" }).getByRole("heading", { name: "Piano sketch" })).toBeVisible();
  expect((await state(page)).score).toEqual(original.score);
  await page.getByRole("button", { name: "New from template" }).click();
  await expect(page.getByRole("tab")).toHaveCount(2);
  expect((await state(page)).score.tracks[0].kind).toBe("pitched");
});

test("Home searches, pins, previews and clears recent file entries", async ({ page }) => {
  const score = guitarWithBars([[5]]);
  score.meta.title = "Evening étude";
  score.meta.artist = "Studio";
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined }));
  await openApp(page, { fixture: score });
  await focusScore(page);
  const downloaded = page.waitForEvent("download");
  await page.keyboard.press("Control+s");
  await downloaded;
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tabscore-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return await new Promise<number>((resolve, reject) => {
      const request = db.transaction("recent").objectStore("recent").count();
      request.onsuccess = () => { db.close(); resolve(request.result); };
      request.onerror = () => { db.close(); reject(request.error); };
    });
  })).toBe(1);
  await page.getByRole("button", { name: "Home", exact: true }).click();
  await page.getByRole("searchbox", { name: "Search scores" }).fill("studio");
  await expect(page.getByRole("region", { name: "Score preview" }).getByText("Evening étude")).toBeVisible();
  await page.getByRole("button", { name: "Pin Evening étude" }).click();
  await expect(page.getByRole("button", { name: "Unpin Evening étude" })).toBeVisible();
  await expect(page.locator(".homeThumbnail svg")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear recent files" }).click();
  await expect(page.getByRole("button", { name: "Unpin Evening étude" })).toHaveCount(0);
});
