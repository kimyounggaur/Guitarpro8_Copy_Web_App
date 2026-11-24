import { expect } from "@playwright/test";
import { focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[A1] right moves to the new beat in an unfinished measure", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  await focusScore(page);

  await page.keyboard.press("ArrowRight");
  const result = await state(page);
  expect(result.score.tracks[0].bars[0].voices[0].beats).toHaveLength(2);

  test.fail(true, "R2 must keep the cursor returned by score-extending navigation.");
  expect(result.cursor.beatIndex).toBe(1);
});

test("[A1] right at the end enters the newly appended measure", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[0, 0, 0, 5]]) });
  await focusScore(page);
  await page.keyboard.press("End");
  expect((await state(page)).cursor.beatIndex).toBe(3);

  await page.keyboard.press("ArrowRight");
  const result = await state(page);
  expect(result.score.masterBars).toHaveLength(2);

  test.fail(true, "R2 must normalize the cursor using the appended measure.");
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
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("7");
  await page.clock.runFor(350);
  const { score, cursor } = await state(page);
  expect(cursor.beatIndex).toBe(1);

  test.fail(true, "R2 must discard the two-digit fret candidate when the cursor moves.");
  expect(score.tracks[0].bars[0].voices[0].beats.slice(0, 2).map((beat) => beat.notes[0]?.fret)).toEqual([5, 7]);
});
