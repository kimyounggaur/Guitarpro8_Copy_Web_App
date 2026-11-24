import { expect } from "@playwright/test";
import { big100x8 } from "../../fixtures";
import { focusScore, openApp, test } from "../helpers";

test("[B18] a large score mounts the visible pages and their immediate neighbors", async ({ page }) => {
  await openApp(page, { fixture: big100x8() });
  const slots = page.locator(".scorePageSlot");
  await expect.poll(() => slots.count()).toBeGreaterThan(4);

  const first = slots.first();
  const last = slots.last();
  await expect(first).toHaveAttribute("data-mounted", "true");
  await expect(last).toHaveAttribute("data-mounted", "false");
  const before = await last.evaluate((slot) => ({
    width: slot.clientWidth,
    height: slot.clientHeight
  }));
  expect(before.height).toBeGreaterThan(0);
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveAttribute("data-mounted", "true");
  await expect(first).toHaveAttribute("data-mounted", "false");
  expect(await last.evaluate((slot) => ({
    width: slot.clientWidth,
    height: slot.clientHeight
  }))).toEqual(before);
});

test("[B18] moving the cursor updates the overlay without replacing score primitives", async ({ page }) => {
  await openApp(page, { fixture: big100x8() });
  await focusScore(page);
  const before = await page.evaluate(() => ({
    cursor: window.__GPW_TEST__!.getCursor(),
    revision: window.__GPW_TEST__!.getRevision()
  }));

  const firstPage = page.locator("[data-score-base]").first();
  await firstPage.evaluate((base) => {
    const first = base.firstElementChild;
    if (!first) throw new Error("The first score page is empty.");
    first.setAttribute("data-test-retained-node", "");
  });
  await page.keyboard.press("ArrowDown");
  await expect.poll(() => page.evaluate(() => window.__GPW_TEST__!.getCursor().string)).toBe(before.cursor.string + 1);
  await expect(page.locator("[data-score-overlay]").first()).toBeAttached();
  await expect(page.locator("[data-test-retained-node]")).toHaveCount(1);
  expect(await page.evaluate(() => window.__GPW_TEST__!.getRevision())).toEqual(before.revision);
});

for (const mode of ["horizontal-page", "horizontal-screen"] as const) {
  test(`[B18] ${mode} groups mount and unmount while scrolling along the score`, async ({ page }) => {
    await openApp(page, { fixture: big100x8(), view: { displayMode: mode, zoom: 100 } });
    const slots = page.locator(".scorePageSlot");
    await expect.poll(() => slots.count()).toBeGreaterThan(4);

    const viewport = page.locator(".scoreViewport");
    await expect(page.locator(`.display-${mode}`)).toBeAttached();
    await viewport.evaluate((element) => element.scrollTo({ left: element.scrollWidth, top: 0, behavior: "instant" }));
    await expect(slots.last()).toHaveAttribute("data-mounted", "true");
    await expect(slots.first()).toHaveAttribute("data-mounted", "false");
    expect(await viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  });
}

test("[B18] printing a virtualized score renders all pages", async ({ page }) => {
  await openApp(page, { fixture: big100x8() });
  const slots = page.locator(".scorePageSlot");
  await expect.poll(() => slots.count()).toBeGreaterThan(4);
  const count = await slots.count();
  await expect(slots.last()).toHaveAttribute("data-mounted", "false");

  await page.evaluate(() => {
    window.print = () => {
      const pages = document.querySelectorAll(".printScoreRoot .scorePage").length;
      document.body.dataset.printPages = String(pages);
    };
  });
  await focusScore(page);
  await page.keyboard.press("Control+p");
  await expect(page.locator("body")).toHaveAttribute("data-print-pages", String(count));
});

test("[B18] score following reaches an unmounted page after a keyboard jump", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openApp(page, { fixture: big100x8() });
  const slots = page.locator(".scorePageSlot");
  await expect(slots.last()).toHaveAttribute("data-mounted", "false");

  await focusScore(page);
  await page.keyboard.press("Control+End");
  await expect(slots.last()).toHaveAttribute("data-mounted", "true");
  await expect(slots.last().locator("#editor-cursor-primary")).toBeInViewport();
});
