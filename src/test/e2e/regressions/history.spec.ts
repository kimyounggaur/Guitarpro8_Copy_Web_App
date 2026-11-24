import { expect } from "@playwright/test";
import { focusScore, openApp, state, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[C5] a title typing session is one undo step and zoom stays clean", async ({ page }) => {
  await openApp(page, { fixture: guitarWithBars([[5]]) });
  const before = await state(page);
  const title = page.getByRole("textbox", { name: /^title$/i });
  await title.fill("");
  await title.pressSequentially("Hello");
  await title.press("Enter");
  expect((await state(page)).score.meta.title).toBe("Hello");

  await focusScore(page);
  await page.keyboard.press("Control+z");
  expect((await state(page)).score.meta.title).toBe(before.score.meta.title);
  await page.keyboard.press("Control+=");
  const after = await state(page);
  expect(after.view.zoom).toBe(before.view.zoom + 5);
  expect(after.revision).toEqual(before.revision);
  await expect(page.getByText("Unsaved changes", { exact: true })).toHaveCount(0);
});
