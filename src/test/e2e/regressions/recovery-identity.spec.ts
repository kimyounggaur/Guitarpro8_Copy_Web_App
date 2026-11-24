import { expect } from "@playwright/test";
import { focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("recovering a snapshot for an open score keeps its disk tab, file handle and newer edits", async ({ page }) => {
  const id = "shared-recovery-id";
  const date = "2026-01-01T12:00:00.000Z";
  function native(title: string, fret: number) {
    const score = guitarWithBars([[fret]]);
    score.meta.title = title;
    return JSON.stringify({ format: "tabscore/score", schemaVersion: 6, app: { name: "TabScore", version: "0" }, documentId: id, score });
  }
  await page.addInitScript((text: string) => {
    const handle = {
      getFile: async () => new File([text], "original.tabscore"),
      createWritable: async () => ({
        write: async (blob: Blob) => { Object.assign(window, { savedOriginal: await blob.text() }); },
        close: async () => {}
      })
    };
    Object.defineProperty(window, "showOpenFilePicker", { value: async () => [handle] });
    Object.defineProperty(window, "showSaveFilePicker", { value: async () => { throw new DOMException("Cancelled", "AbortError"); } });
  }, native("Disk performance", 5));

  await openApp(page);
  await page.keyboard.press("Control+o");
  await expect.poll(async () => (await state(page)).score.meta.title).toBe("Disk performance");
  await page.evaluate(async record => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tabscore-recovery");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("snapshots", "readwrite");
      tx.objectStore("snapshots").put(record, "doc:" + record.documentId);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  }, { documentId: id, revision: 22, savedAt: date, title: "Recovered performance",
    schemaVersion: 6, payload: native("Recovered performance", 7) });

  const tabs = page.getByRole("tablist", { name: "Open documents" }).getByRole("tab");
  async function recover() {
    await page.getByRole("button", { name: "Home", exact: true }).click();
    await page.getByRole("button", { name: "Recent files", exact: true }).click();
    const row = page.getByRole("dialog", { name: "Recover unsaved work" }).getByRole("listitem")
      .filter({ has: page.locator(`time[datetime="${date}"]`) });
    await row.getByRole("button", { name: "Recover", exact: true }).click();
    await expect.poll(async () => (await state(page)).score.meta.title).toBe("Recovered performance");
  }
  const fret = async () => (await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].fret;
  await recover();
  expect(await fret()).toBe(7);
  await expect(tabs).toHaveCount(3);
  await recover();
  await expect(tabs).toHaveCount(3);

  await focusScore(page);
  await page.keyboard.press("9");
  await expect.poll(fret).toBe(9);
  await recover();
  expect(await fret()).toBe(7);
  await expect(tabs).toHaveCount(4);
  await tabs.nth(2).click();
  expect(await fret()).toBe(9);
  await tabs.nth(1).click();
  expect(await fret()).toBe(5);
  await page.keyboard.press("Control+s");
  await expect.poll(() => page.evaluate(() => (window as unknown as { savedOriginal?: string }).savedOriginal ?? "")).toContain("Disk performance");
});
