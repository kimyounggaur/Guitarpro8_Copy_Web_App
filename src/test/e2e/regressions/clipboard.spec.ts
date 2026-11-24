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
  await typeKeys(page, "Control+c Control+ArrowRight Control+Shift+v");

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
  const notes = page.locator('[data-hit-kind="note"][id$="-tab"]');
  const first = await notes.nth(0).boundingBox();
  const second = await notes.nth(1).boundingBox();
  expect(first).not.toBeNull();
  expect(second).not.toBeNull();
  await page.mouse.move(first!.x + first!.width / 2, first!.y + first!.height / 2);
  await page.mouse.down();
  await page.mouse.move(second!.x + second!.width / 2, second!.y + second!.height / 2, { steps: 6 });
  await page.mouse.up();

  const selected = await state(page);
  expect(selected.selection).toMatchObject({ anchor: { barIndex: 0 }, head: { barIndex: 1 } });
  expect(selected.score.tracks[0].bars.map((bar) => bar.voices[0].beats[0].notes[0].fret)).toEqual([5, 7, 8]);
});
