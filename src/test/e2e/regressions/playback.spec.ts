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

  expect(result.playback.status).toBe("playing");
  await page.keyboard.press("Space");
  await expect(transport).toHaveText("Play");
});

test("[B5] playback wraps at the selected measures while the transport keeps playing", async ({ page }) => {
  const score = guitarWithBars(Array.from({ length: 4 }, () => [0, 2, 4, 5]));
  score.masterAutomations = [{
    type: "tempo", scope: "master", points: [{ tick: 0, value: 300, transition: "constant" }]
  }];
  await openApp(page, { fixture: score });
  await focusScore(page);
  await page.keyboard.press("Control+ArrowRight");
  await page.keyboard.press("Control+Shift+ArrowRight");
  expect((await state(page)).selection).toMatchObject({
    anchor: { barIndex: 1 }, head: { barIndex: 2 }
  });
  await page.getByTitle("Loop", { exact: false }).first().click();
  const transport = page.getByTestId("transport-play-stop");
  await transport.click();
  await expect(transport).toHaveText("Stop");
  await expect.poll(async () => (await state(page)).playback.positionSec).toBeGreaterThan(2);
  await expect.poll(async () => (await state(page)).playback.positionSec).toBeLessThan(1.6);
  expect((await state(page)).playback.status).toBe("playing");
});
