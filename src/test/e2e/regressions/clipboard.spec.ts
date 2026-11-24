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

  expect(score.tracks[0].bars.slice(3).map((bar) => bar.voices[0].beats[0].notes[0]?.fret)).toEqual([5, 7, 8]);
});

test("[B17] special paste inserts repetitions and keeps the original destination", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5], [7], [8]]) });
  await focusScore(page);
  await typeKeys(page, "Control+c Control+ArrowRight");
  await expect.poll(async () => (await state(page)).cursor.barIndex).toBe(1);
  await page.keyboard.press("Control+e");
  const palette = page.getByTestId("command-palette-input");
  await palette.fill("@ clipboard.specialPaste");
  await palette.press("Enter");

  const dialog = page.getByRole("dialog", { name: "Special paste" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("spinbutton", { name: "Repetitions" }).fill("2");
  await dialog.getByRole("checkbox", { name: "Insert measures" }).check();
  await dialog.getByRole("button", { name: "Paste", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const { score } = await state(page);
  expect(score.tracks[0].bars.map((bar) => bar.voices[0].beats[0].notes[0]?.fret)).toEqual([5, 5, 5, 7, 8]);
});

test("[B17] dragging between notes extends the score selection without inserting a note", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5], [7], [8]]) });
  const notes = page.locator('rect[data-hit-kind="note"][id$="-tab-hit"]');
  await notes.nth(1).scrollIntoViewIfNeeded();
  await notes.nth(0).hover();
  const second = await notes.nth(1).boundingBox();
  expect(second).not.toBeNull();
  await page.mouse.down();
  await page.mouse.move(second!.x + second!.width / 2, second!.y + second!.height / 2, { steps: 6 });
  await expect.poll(async () => (await state(page)).selection).toMatchObject({
    anchor: { barIndex: 0 }, head: { barIndex: 1 }
  });
  await page.mouse.up();

  const selected = await state(page);
  expect(selected.selection).toMatchObject({ anchor: { barIndex: 0 }, head: { barIndex: 1 } });
  expect(selected.score.tracks[0].bars.map((bar) => bar.voices[0].beats[0].notes[0].fret)).toEqual([5, 7, 8]);
});
