import { expect } from "@playwright/test";
import { guitarWithBars } from "./regressions/scoreFixtures";
import { focusScore, openApp, state, test } from "./helpers";

test("[C2] registered suggestions execute the registered ID and hide commands for another staff", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[3, 5]]) });
  await focusScore(page);
  await page.keyboard.press("Control+e");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  const input = palette.getByRole("textbox", { name: "Search commands" });
  await input.fill("note.inputStandard");
  await expect(palette.getByRole("button", { name: /Enter staff note/ })).toHaveCount(0);
  await input.fill("note.effect.dead");
  await palette.getByRole("button", { name: /^Dead note Effects$/i }).click();
  await expect(palette).toBeHidden();
  expect((await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].deadNote).toBe(true);
});

test("[C2] expression and action suggestions use their respective input modes", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[3, 5]]) });
  await focusScore(page);
  await page.keyboard.press("Control+Shift+e");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  const input = palette.getByRole("textbox", { name: "Search commands" });
  await input.fill("> ff");
  await palette.getByRole("button", { name: /^ff Set dynamic ff$/i }).click();
  await expect(palette).toBeHidden();
  expect((await state(page)).score.tracks[0].bars[0].voices[0].beats[0].notes[0].dynamic).toBe(6);

  await page.keyboard.press("Control+Alt+e");
  await input.fill("@ zoom in");
  await palette.getByRole("button", { name: /View > Zoom In/ }).click();
  await expect(palette).toBeHidden();
  expect((await state(page)).view.zoom).toBe(105);
});

test("[C2] flow mode applies a command while keeping the palette open", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[3, 5]]) });
  await focusScore(page);
  await page.keyboard.press("Control+e");
  const palette = page.getByRole("dialog", { name: "Command palette" });
  const input = palette.getByRole("textbox", { name: "Search commands" });
  await input.fill("flow");
  await input.press("Enter");
  await expect(palette.getByRole("button", { name: "Flow", exact: true })).toHaveAttribute("aria-pressed", "true");
  await input.fill("add-bar 1");
  await input.press("Enter");
  await expect(palette).toBeVisible();
  expect((await state(page)).score.masterBars).toHaveLength(2);
});
