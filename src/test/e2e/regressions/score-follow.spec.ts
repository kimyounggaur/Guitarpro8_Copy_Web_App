import { expect } from "@playwright/test";
import { openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[B5] score following pauses after a manual scroll and resumes on a later cursor move", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.clock.install();
  await openApp(page, { fixture: guitarWithBars(Array.from({ length: 48 }, () => [0, 2, 4, 5])) });
  const viewport = page.getByRole("application", { name: "Editable score" });
  const scrollTop = () => viewport.evaluate((element) => element.scrollTop);

  await viewport.dispatchEvent("wheel", { deltaY: 100 });
  const manualPosition = await scrollTop();
  await page.getByTitle("Last bar").click();
  await expect.poll(async () => (await state(page)).cursor.barIndex).toBe(47);
  await page.clock.runFor(100);
  expect(await scrollTop()).toBe(manualPosition);

  await page.clock.fastForward(3100);
  await page.getByTitle(/Previous bar/).click();
  await page.clock.runFor(100);
  expect(await scrollTop()).toBeGreaterThan(manualPosition);
});
