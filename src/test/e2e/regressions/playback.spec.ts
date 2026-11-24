import { expect } from "@playwright/test";
import { focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[A7] seeking during playback keeps transport playing until Space stops it", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars(Array.from({ length: 4 }, () => [0, 2, 4, 5])) });
  const transport = page.getByTestId("transport-play-stop");
  await transport.click();
  await expect(transport).toHaveText("Stop");
  await expect.poll(async () => (await state(page)).playback.positionSec).toBeGreaterThan(0);
  await focusScore(page);

  await page.keyboard.press("Control+ArrowRight");
  const result = await state(page);
  expect(result.cursor.barIndex).toBe(1);

  test.fail(true, "R5 separates seeking from the stop callback for the previous playback.");
  expect(result.playback.status).toBe("playing");
  await page.keyboard.press("Space");
  await expect(transport).toHaveText("Play");
});
