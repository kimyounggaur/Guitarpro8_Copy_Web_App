import { expect } from "@playwright/test";
import { focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[A1] right moves to the new beat in an unfinished measure", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  await focusScore(page);

  await page.keyboard.press("ArrowRight");
  const result = await state(page);
  expect(result.score.tracks[0].bars[0].voices[0].beats).toHaveLength(2);

  expect(result.cursor.beatIndex).toBe(1);
  await page.keyboard.press("Control+z");
  expect((await state(page)).cursor.beatIndex).toBe(0);
  await page.keyboard.press("Control+y");
  expect((await state(page)).cursor.beatIndex).toBe(1);
});

test("[A1] right at the end enters the newly appended measure", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[0, 0, 0, 5]]) });
  await focusScore(page);
  await page.keyboard.press("End");
  expect((await state(page)).cursor.beatIndex).toBe(3);

  await page.keyboard.press("ArrowRight");
  const result = await state(page);
  expect(result.score.masterBars).toHaveLength(2);

  expect(result.cursor.barIndex).toBe(1);
  expect(result.cursor.beatIndex).toBe(0);
});

test("[A2] quick 5, right, 7 edits two separate beats", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[0, 0, 0, 0]]) });
  await focusScore(page);
  await page.clock.install();
  const pauseTime = await page.evaluate(() => Date.now() + 100);
  await page.clock.pauseAt(pauseTime);

  await page.keyboard.press("5");
  expect((await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0]?.fret).toBe(5);
  await page.clock.runFor(40);
  await page.keyboard.press("ArrowRight");
  await page.clock.runFor(40);
  await page.keyboard.press("7");
  await page.clock.runFor(40);
  await page.keyboard.press("ArrowRight");
  await page.clock.runFor(40);
  await page.keyboard.press("8");
  const { score, cursor } = await state(page);
  expect(cursor.beatIndex).toBe(2);
  expect(score.tracks[0].bars[0].voices[0].beats.slice(0, 3).map((beat) => beat.notes[0]?.fret)).toEqual([5, 7, 8]);
  await page.keyboard.press("ArrowRight");
  expect((await state(page)).cursor.beatIndex).toBe(3);
});

test("[A2] two fret digits at one position are one undoable edit", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[0]]) });
  await focusScore(page);
  await page.clock.install();
  const fret = async () => (await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0]?.fret;

  await page.keyboard.press("1");
  expect(await fret()).toBe(1);
  await page.clock.runFor(40);
  await page.keyboard.press("2");
  expect(await fret()).toBe(12);
  await page.keyboard.press("Control+z");
  expect(await fret()).toBe(0);
  await page.keyboard.press("Control+y");
  expect(await fret()).toBe(12);

  await page.keyboard.press("1");
  await page.clock.runFor(500);
  await page.keyboard.press("2");
  expect(await fret()).toBe(2);
  await page.clock.runFor(500);
  await page.keyboard.press("3");
  await page.clock.runFor(40);
  await page.keyboard.press("5");
  expect(await fret()).toBe(5);
});

test("[B1] L at an unsupported first note leaves the score intact and links the second", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5, 7]]) });
  await focusScore(page);
  const before = await state(page);
  await page.keyboard.press("l");
  await expect(page.getByText("There is no preceding note on the same string to tie.")).toBeVisible();
  expect((await state(page)).score).toEqual(before.score);

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("l");
  const after = (await state(page)).score.tracks[0].bars[0].voices[0].beats;
  expect(after[0].notes[0]).not.toHaveProperty("tiedFromPrevious");
  expect(after[1].notes[0]).toMatchObject({ fret: 5, tiedFromPrevious: true });
});
