import { expect } from "@playwright/test";
import { focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[C4] the LCD shows the cursor tempo and edits the automation at that measure start", async ({ page }) => {
  const score = guitarWithBars([[0, 2, 4, 5], [0, 2, 4, 5], [0, 2, 4, 5]]);
  score.masterAutomations = [{
    type: "tempo",
    scope: "master",
    points: [
      { tick: 0, value: 96, transition: "constant" },
      { tick: 1920, value: 140, transition: "constant" },
      { tick: 2040, value: 150, transition: "constant" }
    ]
  }];
  await openApp(page, { fixture: score });
  const lcd = page.getByTestId("lcd-tempo");
  await expect(lcd).toHaveText("♩ 96");
  await focusScore(page);
  await page.keyboard.press("Control+ArrowRight");
  await expect(lcd).toHaveText("♩ 140");
  await lcd.click();
  const tempoInput = page.getByRole("spinbutton", { name: "Tempo BPM" });
  await tempoInput.fill("132");
  await tempoInput.press("Enter");
  await expect(lcd).toHaveText("♩ 132");
  expect((await state(page)).score.masterAutomations[0].points).toEqual([
    { tick: 0, value: 96, transition: "constant" },
    { tick: 1920, value: 132, transition: "constant" },
    { tick: 2040, value: 150, transition: "constant" }
  ]);
});
