import { expect } from "@playwright/test";
import { openApp, focusScore, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";
import { dropFileOnScore } from "./dropFile";

test("Save As and reopening the original keep both native files and their edits independent", async ({ page }) => {
  const fixture = guitarWithBars([[5]]);
  fixture.meta.title = "File identity study";
  const original = JSON.stringify({
    format: "tabscore/score", schemaVersion: 6, app: { name: "TabScore", version: "0.0.0" },
    documentId: "shared-score-id", savedAt: new Date().toISOString(), score: fixture
  });
  await page.addInitScript((payload: string) => {
    const disk = { original: payload, copy: "" };
    const writes: string[] = [];
    Object.assign(window, { testDisk: disk, testWrites: writes, nextOpen: "original", nextSave: "copy" });
    const target = window as unknown as { nextOpen: keyof typeof disk; nextSave: keyof typeof disk };
    const handle = (entry: keyof typeof disk) => ({
      entry,
      name: "study.tabscore",
      isSameEntry: async (other: { entry: string }) => entry === other.entry,
      getFile: async () => new File([disk[entry]], "study.tabscore", { type: "application/json" }),
      createWritable: async () => {
        let pending = "";
        return {
          write: async (blob: Blob) => { pending = await blob.text(); },
          close: async () => { disk[entry] = pending; writes.push(entry); }
        };
      }
    });
    Object.defineProperty(window, "showSaveFilePicker", { value: async () => handle(target.nextSave) });
    Object.defineProperty(window, "showOpenFilePicker", { value: async () => [handle(target.nextOpen)] });
  }, original);
  const writtenTo = () => page.evaluate(() => (window as unknown as { testWrites: string[] }).testWrites);
  const fret = async () => (await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].fret;
  await openApp(page);
  await page.keyboard.press("Control+o");
  await expect.poll(async () => (await state(page)).score.meta.title).toBe("File identity study");
  await page.keyboard.press("Control+Shift+s");
  await expect.poll(writtenTo).toEqual(["copy"]);
  await focusScore(page);
  await page.keyboard.press("7");
  await expect.poll(fret).toBe(7);

  await page.keyboard.press("Control+o");
  await expect.poll(fret).toBe(5);
  const tabs = page.getByRole("tablist", { name: "Open documents" }).getByRole("tab");
  await expect(tabs).toHaveCount(3);
  await page.keyboard.press("Control+s");
  await expect.poll(writtenTo).toEqual(["copy", "original"]);
  await page.evaluate(() => { (window as unknown as { nextOpen: string }).nextOpen = "copy"; });
  await page.keyboard.press("Control+o");
  await expect.poll(fret).toBe(7);
  await expect(tabs).toHaveCount(3);

  await page.keyboard.press("Control+s");
  await expect.poll(writtenTo).toEqual(["copy", "original", "copy"]);
  const disk = await page.evaluate(() => (window as unknown as { testDisk: Record<string, string> }).testDisk);
  const firstNote = (text: string) => JSON.parse(text).score.tracks[0].bars[0].voices[0].beats[0].notes[0].fret;
  expect(firstNote(disk.original)).toBe(5);
  expect(firstNote(disk.copy)).toBe(7);

  await page.evaluate(() => { (window as unknown as { nextSave: string }).nextSave = "original"; });
  await page.keyboard.press("Control+Shift+s");
  await expect(page.locator(".fileIoStatus")).toHaveText(/open in another tab/);
  expect(await writtenTo()).toEqual(["copy", "original", "copy"]);
});

test("separate drops sharing an embedded ID keep their scores and dirty tabs", async ({ page }) => {
  await openApp(page);
  const dropCopy = (name: string, fret: number) => {
    const score = guitarWithBars([[fret]]);
    score.meta.title = name;
    const payload = JSON.stringify({
      format: "tabscore/score", schemaVersion: 6, app: { name: "TabScore", version: "0.0.0" },
      documentId: "shared-score-id", score
    });
    return dropFileOnScore(page, name + ".tabscore", [...Buffer.from(payload)]);
  };
  await dropCopy("Original", 5);
  await expect.poll(async () => (await state(page)).score.meta.title).toBe("Original");
  await focusScore(page);
  await page.keyboard.press("7");
  await dropCopy("Second copy", 3);
  await expect.poll(async () => (await state(page)).score.meta.title).toBe("Second copy");
  await page.getByRole("tab", { name: /Original/ }).click();
  const first = await state(page);
  expect(first.score.tracks[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(7);
  expect(first.revision.revision).not.toBe(first.revision.savedRevision);
});
