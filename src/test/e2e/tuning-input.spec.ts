import { expect } from "@playwright/test";
import { createEmptyScore, createTrack } from "../../model/factory";
import { instrumentById } from "../../model/instruments";
import { clickToolbarControl, openApp, state, test } from "./helpers";

test("[C14] tuning selects a pitch by name and applies semitone changes as MIDI values", async ({ page }) => {
  const score = createEmptyScore();
  score.tracks = [createTrack()];
  await openApp(page, { fixture: score });
  await clickToolbarControl(page, "Tuning");

  const tuning = page.getByRole("region", { name: "Track system" });
  const lowString = tuning.getByRole("combobox", { name: "String 6 note", exact: true });
  await expect(lowString.locator("option:checked")).toHaveText("E2");
  await tuning.getByRole("button", { name: "Raise string 6 by one semitone" }).click();
  await expect(lowString.locator("option:checked")).toHaveText("F2");
  await tuning.getByRole("button", { name: "Lower string 6 by one semitone" }).click();
  await expect(lowString.locator("option:checked")).toHaveText("E2");
  await lowString.selectOption({ label: "D2" });
  await tuning.getByRole("button", { name: "Apply", exact: true }).click();
  expect((await state(page)).score.tracks[0].tuning.strings[0]).toBe(38);
});

test("[C14] a renamed cello lists only matching presets", async ({ page }) => {
  const score = createEmptyScore();
  const cello = instrumentById("cello");
  score.tracks = [createTrack({ ...cello, strings: cello.tuning })];
  score.tracks[0].name = "Low harmony";
  await openApp(page, { fixture: score });
  await clickToolbarControl(page, "Tuning");
  const tuning = page.getByRole("region", { name: "Track system" });

  await expect(tuning.getByRole("button", { name: /Cello Standard/ })).toBeVisible();
  await expect(tuning.getByRole("button", { name: /Viola Standard|Bass Standard|Ukulele Standard/ })).toHaveCount(0);
  await expect(tuning.getByRole("combobox", { name: "String 4 note" }).locator("option:checked")).toHaveText("C2");
});
