import { expect } from "@playwright/test";
import { focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[B11] entering written A4 on guitar string 3 produces fret 2", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[]]) });
  await focusScore(page);
  await page.keyboard.press("Tab");
  // Written A4 is the third diatonic step above treble's bottom line (E4).
  for (let step = 0; step < 3; step++) {
    await page.keyboard.press("ArrowUp");
  }
  expect((await state(page)).cursor).toMatchObject({ staffKind: "standard", staffLine: 3 });

  await page.keyboard.press("3");

  test.fail(true, "R4 derives the fret from the written staff pitch and the selected guitar string.");
  const { score } = await state(page);
  expect(score.tracks[0].bars[0].voices[0].beats[0].notes).toEqual([
    expect.objectContaining({ string: 3, fret: 2 })
  ]);
});
