import { expect } from "@playwright/test";
import { clickToolbarControl, openApp, test } from "../helpers";

const desktops = [
  { width: 1024, height: 768 },
  { width: 1280, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 }
];

for (const viewport of desktops) {
  test(`[A3] ${viewport.width}px desktop retains the primary controls within the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openApp(page);

    await expect.poll(() => page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )).toBeLessThanOrEqual(0);
    await expect(page.getByTestId("transport-play-stop")).toBeInViewport({ ratio: 1 });
    await expect(page.getByTitle(/^Undo\b/)).toBeInViewport({ ratio: 1 });
    await expect(page.getByTitle("Metronome", { exact: true })).toBeInViewport({ ratio: 1 });

    await clickToolbarControl(page, /^Add Track\b/);
    await expect(page.getByRole("region", { name: "Track system" })).toBeVisible();
  });
}

test("[A3] keyboard can reach and dismiss the overflow panel after resizing", async ({ page }) => {
  await page.setViewportSize({ width: 2400, height: 1080 });
  await openApp(page);
  await expect(page.getByTitle(/^Add Track\b/)).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 768 });
  const more = page.getByRole("button", { name: "More toolbar controls" });
  await expect(more).toBeVisible();
  await expect(page.getByTitle(/^Add Track\b/)).toBeHidden();
  await more.focus();
  await page.keyboard.press("Enter");
  await expect(more).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Tab");
  await expect(page.locator(".toolbarOverflowPanel button:focus")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(more).toBeFocused();
  await expect(more).toHaveAttribute("aria-expanded", "false");

  await page.setViewportSize({ width: 2400, height: 1080 });
  await expect(page.getByTitle(/^Add Track\b/)).toBeVisible();
});

test("[A3] a narrow viewport shows the editing notice and retains score view and playback", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 768 });
  await openApp(page);
  await expect(page.getByText("편집 기능은 가로 1024px 이상 화면에서 지원합니다")).toBeVisible();
  await expect(page.getByTestId("palette-panel")).toBeHidden();
  await expect(page.getByTestId("inspector-panel")).toBeHidden();
  await expect(page.getByTestId("workspace-panel")).toBeVisible();

  const play = page.getByTestId("transport-play-stop");
  await expect(play).toBeInViewport({ ratio: 1 });
  await play.click();
  await expect(play).toHaveText("Stop");
  await play.click();
  await expect(play).toHaveText("Play");
});
