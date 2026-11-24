import { expect } from "@playwright/test";
import { openApp, test } from "../helpers";

test("[A3] a 1024px desktop retains the main controls within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page);
  const play = page.getByTestId("transport-play-stop");
  const undo = page.getByTitle("Undo Ctrl+Z");
  await expect(play).toBeVisible();
  await expect(undo).toBeVisible();
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth
  }));

  test.fail(true, "R3 moves lower-priority tools into an overflow menu.");
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
  await expect(play).toBeInViewport({ ratio: 1 });
  await expect(undo).toBeInViewport({ ratio: 1 });
});
