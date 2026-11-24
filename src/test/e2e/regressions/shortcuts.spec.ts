import { expect } from "@playwright/test";
import { clickToolbarControl, focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[B12] Ctrl+= changes zoom without modifying note duration", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  await focusScore(page);
  const before = await state(page);

  await page.keyboard.press("Control+=");
  const { score } = await state(page);
  expect(score.documentSettings.zoom).toBe(before.score.documentSettings.zoom + 10);

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

  const { score } = await state(page);
  expect(score.tracks[0].bars[0].voices[0].beats[0].notes[0].deadNote).toBe(true);
});

test("[B12] the toolbar keeps the score focused and the palette restores focus", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  const scoreViewport = page.getByRole("application", { name: "Editable score" });
  await expect(scoreViewport).toBeFocused();

  await clickToolbarControl(page, "Zoom in Ctrl+=");
  await expect(scoreViewport).toBeFocused();

  await page.keyboard.press("7");
  await page.keyboard.press("Control+E");
  const paletteInput = page.getByTestId("command-palette-input");
  await expect(paletteInput).toBeFocused();

  await page.keyboard.type("text");
  await page.keyboard.press("Control+Z");
  expect((await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(7);
  await page.keyboard.press("Escape");
  await expect(scoreViewport).toBeFocused();

  await page.keyboard.press("Control+Z");
  expect((await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(5);
});
