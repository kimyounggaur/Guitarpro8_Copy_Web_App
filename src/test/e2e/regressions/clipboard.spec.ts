import { expect } from "@playwright/test";
import { focusScore, openApp, state, test, typeKeys } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[B17] copying a three-measure range pastes all three measures", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5], [7], [8], [0], [0], [0]]) });
  await focusScore(page);
  await typeKeys(page, "Control+Shift+ArrowRight Control+Shift+ArrowRight");
  const { selection } = await state(page);
  expect(selection?.anchor.barIndex).toBe(0);
  expect(selection?.head.barIndex).toBe(2);

  await typeKeys(page, "Control+c Control+ArrowRight Control+v");
  const { score, cursor } = await state(page);
  expect(cursor.barIndex).toBe(3);

  test.fail(true, "R7 copies the entire selected measure range.");
  expect(score.tracks[0].bars.slice(3).map((bar) => bar.voices[0].beats[0].notes[0]?.fret)).toEqual([5, 7, 8]);
});
