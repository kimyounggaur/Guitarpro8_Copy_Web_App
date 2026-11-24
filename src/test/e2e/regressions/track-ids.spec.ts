import { expect } from "@playwright/test";
import { serializeNativeScore } from "../../../io/nativeScore";
import { createTrack } from "../../../model/factory";
import { focusScore, openApp, state, test } from "../helpers";
import { dropFileOnScore } from "./dropFile";
import { guitarWithBars } from "./scoreFixtures";

test("[A11] adding a track after opening a legacy score preserves unique IDs", async ({ page }) => {
  await openApp(page);
  const legacy = guitarWithBars([[5]]);
  // A score from a previous session may already contain all of these sequential IDs.
  legacy.tracks = Array.from({ length: 8 }, (_, index) => ({
    ...createTrack(undefined, 1),
    id: `track-${index + 1}`,
    name: `Saved guitar ${index + 1}`
  }));
  await dropFileOnScore(page, "saved-score.gp", Array.from(new TextEncoder().encode(serializeNativeScore(legacy))));
  await expect.poll(async () => (await state(page)).score.tracks.length).toBe(8);

  await page.getByTitle(/^Add Track/).click();
  await page.getByRole("region", { name: "Track system" }).getByRole("button", { name: "Create", exact: true }).click();
  const { score, cursor } = await state(page);
  expect(score.tracks).toHaveLength(9);

  test.fail(true, "R1 assigns new IDs independently of the session's legacy sequential counter.");
  expect(new Set(score.tracks.map((track) => track.id)).size).toBe(9);
  expect(cursor.trackId).toBe(score.tracks[8].id);
  await focusScore(page);
  await page.keyboard.press("5");
  await expect.poll(async () => (await state(page)).score.tracks[8].bars[0].voices[0].beats[0]?.notes[0]?.fret).toBe(5);
});
