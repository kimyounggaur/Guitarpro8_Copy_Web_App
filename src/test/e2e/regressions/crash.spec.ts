import { expect } from "@playwright/test";
import { createNote } from "../../../model/factory";
import { clickToolbarControl, openApp, state, test } from "../helpers";
import { dropFileOnScore } from "./dropFile";
import { guitarWithBars } from "./scoreFixtures";

test("[A9] reducing the string count preserves the editor and asks what to do with affected notes", async ({ page }) => {
  const score = guitarWithBars([[0]]);
  score.tracks[0].bars[0].voices[0].beats[0].notes = [createNote(6, 3)];
  await openApp(page, { fixture: score });

  await clickToolbarControl(page, "Tuning");
  const tuning = page.getByRole("region", { name: "Track system" });
  await tuning.getByRole("spinbutton", { name: "Strings", exact: true }).fill("5");
  await tuning.getByRole("button", { name: "Apply", exact: true }).click();

  const confirmation = page.getByRole("alertdialog", { name: "줄 수 변경 확인" });
  await expect(page.getByTestId("gp-shell")).toBeVisible();
  await expect(confirmation).toBeVisible();
  expect((await state(page)).score.tracks[0].tuning.strings).toHaveLength(6);

  await confirmation.getByRole("button", { name: "취소" }).click();
  await expect(confirmation).toBeHidden();
  expect((await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].string).toBe(6);

  await tuning.getByRole("button", { name: "Apply", exact: true }).click();
  await confirmation.getByRole("button", { name: "삭제" }).click();
  await expect(confirmation).toBeHidden();
  await expect(page.getByTestId("gp-shell")).toBeVisible();
  const result = (await state(page)).score.tracks[0];
  expect(result.tuning.strings).toHaveLength(5);
  expect(result.bars[0].voices[0].beats[0].notes).toHaveLength(0);
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

  expect(await page.getByTestId("gp-shell").isVisible()).toBe(true);
  expect(score.tracks[0].tuning.strings).toHaveLength(6);
  expect(score.tracks[0].bars.map((bar) => bar.voices[0].beats[0].notes[0]?.fret)).toEqual([5, 7]);
});
