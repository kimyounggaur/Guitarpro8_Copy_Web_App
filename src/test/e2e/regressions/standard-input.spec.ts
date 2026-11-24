import { expect, type Locator, type Page } from "@playwright/test";
import { createTrack } from "../../../model/factory";
import { focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[B11] entering written A4 on guitar string 3 produces fret 2", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[]]) });
  await focusScore(page);
  await page.keyboard.press("Tab");
  // Written A4 is the third diatonic step above treble's bottom line (E4).
  for (let step = 0; step < 3; step++) {
    await page.keyboard.press("ArrowUp");
  }
  expect((await state(page)).cursor).toMatchObject({ staffKind: "standard", staffLine: 3 });

  await page.keyboard.press("3");

  const { score } = await state(page);
  expect(score.tracks[0].bars[0].voices[0].beats[0].notes).toEqual([
    expect.objectContaining({ string: 3, fret: 2 })
  ]);
});

test("[B11] sounding pitch follows a chromatic step and Enter chooses a string", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[]]) });
  await focusScore(page);
  await page.keyboard.press("Tab");
  for (let step = 0; step < 3; step++) {
    await page.keyboard.press("ArrowUp");
  }
  await page.keyboard.press("Alt+ArrowUp");
  expect((await state(page)).cursor.writtenMidi).toBe(70);
  await page.keyboard.press("Enter");

  const { score } = await state(page);
  expect(score.tracks[0].bars[0].voices[0].beats[0].notes).toEqual([
    expect.objectContaining({ string: 3, fret: 3 })
  ]);
});

test("[B11] clicking the zoomed staff converts SVG position to a playable guitar note", async ({ page }) => {
  const fixture = guitarWithBars([[]]);
  await openApp(page, { fixture, view: { zoom: 140, displayMode: "vertical-page" } });
  await clickStaffPosition(page, page.locator('[data-hit-kind="staffInput"]').first(), 3);

  const result = await state(page);
  expect(result.cursor).toMatchObject({ staffKind: "standard", staffLine: 3 });
  expect(result.score.tracks[0].bars[0].voices[0].beats[0].notes).toEqual([
    expect.objectContaining({ string: 3, fret: 2 })
  ]);
});

test("[B11] an out-of-range staff note leaves the score and undo revision unchanged", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[]]) });
  await focusScore(page);
  await page.keyboard.press("Tab");
  const before = await state(page);
  for (let step = 0; step < 12; step++) {
    await page.keyboard.press("ArrowDown");
  }
  await page.keyboard.press("Enter");
  await expect(page.getByText("이 음은 지금 튜닝으로 칠 수 없습니다", { exact: true })).toBeVisible();
  const after = await state(page);
  expect(after.score).toEqual(before.score);
  expect(after.revision).toEqual(before.revision);
});

test("[C7] clicking C2 in a piano bass staff stores its full MIDI pitch", async ({ page }) => {
  const score = guitarWithBars([[]]);
  score.tracks = [createTrack({
    name: "Grand Piano",
    shortName: "Piano",
    color: "#3b82f6",
    icon: "piano",
    strings: [],
    tuningLabel: "",
    kind: "pitched",
    clef: "grand",
    staffConfig: "grand",
    notationTypes: ["standard"]
  })];
  await openApp(page, { fixture: score });
  const bass = page.locator(`[data-hit-kind="staffInput"][data-hit-ref*='"staffClef":"bass"']`);
  await clickStaffPosition(page, bass.first(), -4);

  const current = await state(page);
  expect(current.cursor).toMatchObject({ staffKind: "standard", staffClef: "bass", staffLine: -4 });
  expect(current.score.tracks[0].bars[0].voices[0].beats[0].notes).toEqual([
    expect.objectContaining({ midiPitch: 36 })
  ]);
});

async function clickStaffPosition(page: Page, staff: Locator, position: number): Promise<void> {
  await staff.scrollIntoViewIfNeeded();
  const screen = await staff.evaluate((element: SVGGraphicsElement, staffPosition) => {
    const raw = JSON.parse(element.dataset.hitRef ?? "{}") as { staffTop: number; staffSpace: number };
    const transform = element.getScreenCTM();
    const bounds = element.getBBox();
    if (!transform) throw new Error("The staff is not mounted.");
    const y = raw.staffTop + (8 - staffPosition) * raw.staffSpace / 2;
    // Empty measures may contain clef and time signatures at their left edge.
    const point = new DOMPoint(bounds.x + bounds.width * 0.88, y).matrixTransform(transform);
    return { x: point.x, y: point.y };
  }, position);
  await page.mouse.click(screen.x, screen.y);
}
