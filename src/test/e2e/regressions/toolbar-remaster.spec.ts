import { expect } from "@playwright/test";
import { openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("LCD changes tracks while the global panel is closed", async ({ page }) => {
  await openApp(page);
  const global = page.getByTitle(/^Global View/);
  if ((await global.getAttribute("aria-pressed")) === "true") await global.click();
  const track = page.getByRole("button", { name: /Choose track/ });
  await track.click();
  const choices = page.getByRole("menu", { name: "Choose track" }).getByRole("menuitemcheckbox");
  const index = (await choices.count()) - 1,
    id = (await state(page)).score.tracks[index].id;
  await choices.nth(index).click();
  expect((await state(page)).cursor.trackId).toBe(id);
  await expect(track).toHaveAttribute("aria-expanded", "false");
});

test("a 1024px toolbar exposes state, speed and an incomplete bar", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  await expect(page.locator(".lcdWarning")).toHaveAttribute("title", /Voice 1:/);
  for (const title of ["Metronome", "Count-in", "Loop"]) {
    const button = page.locator(".toolbar").getByRole("button", { name: title, exact: true });
    const old = await button.getAttribute("aria-pressed");
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", old === "true" ? "false" : "true");
  }
  const speed = page.getByRole("button", { name: /Playback speed/ });
  await speed.click();
  const range = page.getByRole("slider", { name: /Playback speed/ });
  await range.focus();
  await range.press("End");
  await expect(speed).toHaveText("200%");
  await range.press("Home");
  await expect(speed).toHaveText("25%");
  await range.press("Escape");
  await expect(speed).toBeFocused();
  for (const button of await page.locator(".toolbar button svg").locator("..").all()) {
    await expect(button).toHaveAccessibleName(/.+/);
  }
});

test("line input reports permission rejection and can be tried again", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: () => Promise.reject(new DOMException("Permission denied", "NotAllowedError")) }
    });
  });
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openApp(page);
  const monitor = page.getByTitle("Monitor line input", { exact: true });
  if (!(await monitor.isVisible())) await page.getByRole("button", { name: "More toolbar controls" }).click();
  await monitor.click();
  await expect(page.getByRole("alert")).toContainText("Allow microphone access");
  await page.getByRole("button", { name: "Dismiss notice" }).click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
