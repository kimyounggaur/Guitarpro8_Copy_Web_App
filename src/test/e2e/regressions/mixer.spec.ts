import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import { clickToolbarControl, focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[B5] drag previews stay out of history and the saved mixer reopens intact", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined }));
  await openApp(page, { fixture: guitarWithBars([[5, 7]]) });
  const initial = await state(page);
  const strip = page.locator(".globalTrackRow").first();
  const volume = strip.getByRole("slider", { name: /volume/i });
  await volume.scrollIntoViewIfNeeded();
  const bounds = (await volume.boundingBox())!;

  await page.mouse.move(bounds.x + bounds.width * 0.82, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.35, bounds.y + bounds.height / 2, { steps: 6 });
  expect((await state(page)).revision).toEqual(initial.revision);
  await page.mouse.up();
  const edited = await state(page);
  const editedVolume = edited.score.tracks[0].mix.volume;
  expect(editedVolume).toBeLessThan(0.7);
  expect(edited.revision.revision).toBe(initial.revision.revision + 1);

  await focusScore(page);
  await page.keyboard.press("Control+z");
  expect((await state(page)).score.tracks[0].mix.volume).toBe(initial.score.tracks[0].mix.volume);
  await page.keyboard.press("Control+y");
  expect((await state(page)).score.tracks[0].mix.volume).toBe(editedVolume);

  await strip.getByTitle("Visible", { exact: true }).click();
  expect((await state(page)).revision).toEqual(edited.revision);
  await strip.getByTitle("Mute", { exact: true }).click();
  expect((await state(page)).score.tracks[0].mix.mute).toBe(true);

  await clickToolbarControl(page, "File I/O");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  const path = await (await download).path();
  const saved = await readFile(path, "utf8");
  await page.evaluate((json) => window.__GPW_TEST__!.loadScoreJson(json), saved);
  expect((await state(page)).score.tracks[0].mix).toMatchObject({ volume: editedVolume, mute: true });
});
