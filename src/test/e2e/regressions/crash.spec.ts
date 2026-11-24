import { expect } from "@playwright/test";
import { createNote } from "../../../model/factory";
import { openApp, state, test } from "../helpers";
import { dropFileOnScore } from "./dropFile";
import { guitarWithBars } from "./scoreFixtures";

test("[A9] reducing the string count preserves the editor and asks what to do with affected notes", async ({ page }) => {
  const score = guitarWithBars([[0]]);
  score.tracks[0].bars[0].voices[0].beats[0].notes = [createNote(6, 3)];
  await openApp(page, { fixture: score });

  await page.getByTitle("Tuning", { exact: true }).click();
  const tuning = page.getByRole("region", { name: "Track system" });
  await tuning.getByRole("spinbutton", { name: "Strings", exact: true }).fill("5");
  await tuning.getByRole("button", { name: "Apply", exact: true }).click();

  test.fail(true, "R1 prevents a string-count change from leaving the renderer an out-of-range note.");
  expect(await page.getByTestId("gp-shell").isVisible()).toBe(true);
  expect(await page.getByRole("dialog").count()).toBe(1);
});

test("[A9] two ASCII systems import as two measures of one six-string instrument", async ({ page }) => {
  await openApp(page);
  const ascii = [
    "Title: Two systems", "",
    "e|5---|", "B|----|", "G|----|", "D|----|", "A|----|", "E|----|", "",
    "e|7---|", "B|----|", "G|----|", "D|----|", "A|----|", "E|----|", ""
  ].join("\n");
  await dropFileOnScore(page, "two-systems.txt", Array.from(new TextEncoder().encode(ascii)));
  await expect.poll(async () => (await state(page)).score.meta.title).toBe("Two systems");
  const { score } = await state(page);

  test.fail(true, "R1 parses separate systems before joining their measures.");
  expect(await page.getByTestId("gp-shell").isVisible()).toBe(true);
  expect(score.tracks[0].tuning.strings).toHaveLength(6);
  expect(score.tracks[0].bars.map((bar) => bar.voices[0].beats[0].notes[0]?.fret)).toEqual([5, 7]);
});
