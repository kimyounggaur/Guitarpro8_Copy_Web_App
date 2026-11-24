import { expect } from "@playwright/test";
import { focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[B12] Ctrl+= changes zoom without modifying note duration", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  await focusScore(page);
  const before = await state(page);

  await page.keyboard.press("Control+=");
  const { score } = await state(page);
  expect(score.documentSettings.zoom).toBe(before.score.documentSettings.zoom + 10);

  test.fail(true, "R2 distinguishes zoom modifiers from note length shortcuts.");
  expect(score.tracks[0].bars[0].voices[0].beats[0].duration).toBe(4);
});

test("[B12] the physical X key toggles a dead note in a Korean input layout", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  await focusScore(page);

  await page.evaluate(() => {
    document.activeElement?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "ㅌ", code: "KeyX", bubbles: true, cancelable: true
    }));
  });

  test.fail(true, "R2 resolves letter shortcuts by physical key in the score viewport.");
  const { score } = await state(page);
  expect(score.tracks[0].bars[0].voices[0].beats[0].notes[0].deadNote).toBe(true);
});
