import { expect } from "@playwright/test";
import { big100x8 } from "../../fixtures";
import { focusScore, openApp, state, test } from "../helpers";

test("[Phase 5] dock handles support keyboard and pointer resizing, reset, and persisted sizes", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page);
  const workspace = page.getByTestId("workspace-panel");
  const layout = page.getByRole("separator", { name: "Resize edition palette" });
  const track = page.getByRole("separator", { name: "Resize inspector" });
  const global = page.getByRole("separator", { name: "Resize global view" });
  await expect(layout).toHaveAttribute("aria-valuenow", "184");
  await expect(global).toHaveAttribute("aria-valuenow", "166");

  await layout.focus();
  await page.keyboard.press("Shift+ArrowRight");
  await expect(layout).toHaveAttribute("aria-valuenow", "208");
  await track.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(track).toHaveAttribute("aria-valuenow", "240");

  const handle = (await global.boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 - 24, { steps: 5 });
  await page.mouse.up();
  await expect(global).toHaveAttribute("aria-valuenow", "190");

  expect((await workspace.boundingBox())!.width).toBeGreaterThanOrEqual(420);
  expect((await state(page)).revision.savedRevision).toBe((await state(page)).revision.revision);

  await page.reload();
  await expect(layout).toHaveAttribute("aria-valuenow", "208");
  await expect(track).toHaveAttribute("aria-valuenow", "240");
  await expect(global).toHaveAttribute("aria-valuenow", "190");
  await layout.dblclick();
  await expect(layout).toHaveAttribute("aria-valuenow", "184");

  await focusScore(page);
  const original = (await workspace.boundingBox())!.width;
  await page.keyboard.press("F2");
  await expect(layout).toBeHidden();
  expect((await workspace.boundingBox())!.width).toBeGreaterThan(original);
});

test("[Phase 5] invalid persisted widths are constrained without reducing the score area", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("tabscore.editor-layout.v1",
    JSON.stringify({ version: 1, sizes: { left: 5000, right: "incorrect", global: -250 } })));
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page);
  await expect(page.getByRole("separator", { name: "Resize edition palette" })).toHaveAttribute("aria-valuenow", "300");
  await expect(page.getByRole("separator", { name: "Resize inspector" })).toHaveAttribute("aria-valuenow", "232");
  await expect(page.getByRole("separator", { name: "Resize global view" })).toHaveAttribute("aria-valuenow", "86");
  expect((await page.getByTestId("workspace-panel").boundingBox())!.width).toBeGreaterThanOrEqual(420);
});

test("[Phase 9] edition palette tracks selected note durations and preserves collapsed groups", async ({ page }) => {
  await openApp(page, { fixture: big100x8() });
  const palette = page.getByTestId("palette-panel");
  const rhythm = palette.getByRole("button", { name: "Note symbols" });
  await expect(rhythm).toHaveAttribute("aria-expanded", "true");
  await palette.getByRole("button", { name: "8 note", exact: true }).click();
  await expect(palette.getByRole("button", { name: "8 note", exact: true })).toHaveAttribute("aria-pressed", "true");

  const noteValue = palette.getByRole("button", { name: "4 note", exact: true });
  await noteValue.focus();
  await page.keyboard.press("ArrowRight");
  await expect(palette.getByRole("button", { name: "8 note", exact: true })).toBeFocused();

  await rhythm.click();
  await expect(rhythm).toHaveAttribute("aria-expanded", "false");
  await focusScore(page);
  await page.keyboard.press("F2");
  await expect(palette).toBeHidden();
  await page.keyboard.press("F2");
  await expect(rhythm).toHaveAttribute("aria-expanded", "false");
});

test("[Phase 10] modifier wheel and Fit page change workspace zoom without editing the document", async ({ page }) => {
  await openApp(page);
  const revision = (await state(page)).revision;
  const viewport = page.getByRole("application", { name: "Editable score" });
  await viewport.dispatchEvent("wheel", { ctrlKey: true, deltaY: -9 });
  await expect.poll(async () => (await state(page)).view.zoom).toBe(105);
  await page.getByRole("button", { name: "Fit page" }).click();
  await expect.poll(async () => (await state(page)).view.zoom).toBeLessThan(105);
  expect((await state(page)).revision).toEqual(revision);
});

test("[Phase 11] track delete requires confirmation and refuses to delete the remaining track", async ({ page }) => {
  await openApp(page);
  await page.keyboard.press("F6");
  const inspector = page.getByTestId("inspector-panel");
  const remove = inspector.getByRole("button", { name: "Delete", exact: true });
  const prior = (await state(page)).score.tracks.length;
  expect(prior).toBeGreaterThan(1);
  await remove.click();
  const confirm = page.getByRole("alertdialog", { name: "Delete track" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Cancel" }).click();
  expect((await state(page)).score.tracks).toHaveLength(prior);
  await remove.click();
  await confirm.getByRole("button", { name: "Delete track" }).click();
  await expect.poll(async () => (await state(page)).score.tracks.length).toBe(prior - 1);
  for (let count = prior - 1; count > 1; count -= 1) {
    await remove.click();
    await confirm.getByRole("button", { name: "Delete track" }).click();
    await expect.poll(async () => (await state(page)).score.tracks.length).toBe(count - 1);
  }
  await expect(remove).toBeDisabled();
});

test("[Phase 12] mixer headers stay pinned to their corresponding measure rows", async ({ page }) => {
  await openApp(page, { fixture: big100x8() });
  const dock = page.getByRole("region", { name: "Global view" });
  const first = dock.locator(".globalTrackRow").nth(6);
  const measures = dock.locator(".globalMeasureRow").nth(7);
  const bounds = await first.boundingBox();
  expect(bounds?.y).toBeCloseTo((await measures.boundingBox())!.y);
  await dock.evaluate((element) => element.scrollTo({ left: 1500, top: 110, behavior: "instant" }));
  const after = (await first.boundingBox())!;
  expect(after.x).toBeCloseTo(bounds!.x);
  expect(after.y).toBeCloseTo((await measures.boundingBox())!.y);
  expect(await dock.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);

  await dock.getByRole("slider", { name: "Master volume" }).focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await state(page)).score.masterMix.volume).toBe(0.99);
});
