import { expect } from "@playwright/test";
import { emptyGuitar } from "../fixtures";
import { openApp, state, test } from "./helpers";

for (const path of ["/", "/?testMode=visual"]) {
  test(`does not expose the E2E hooks at ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(path === "/" ? page.getByRole("heading", { name: "TabScore" }) : page.getByTestId("gp-shell")).toBeVisible();
    expect(await page.evaluate(() => Object.prototype.hasOwnProperty.call(window, "__GPW_TEST__"))).toBe(false);
  });
}

test("opens a fixture in E2E mode and reads detached score snapshots", async ({ page }) => {
  const fixture = emptyGuitar(4);
  await openApp(page, { fixture });
  const first = await state(page);
  expect(first.score.masterBars).toHaveLength(4);
  expect(first.cursor.trackId).toBe(fixture.tracks[0].id);
  expect(first.selection).toBeNull();

  await page.evaluate(() => {
    window.__GPW_TEST__!.getScore().masterBars.length = 0;
  });
  expect((await state(page)).score.masterBars).toHaveLength(4);
});
