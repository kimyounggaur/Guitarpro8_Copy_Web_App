import AxeBuilder from "@axe-core/playwright";
import { expect } from "@playwright/test";
import { test } from "../helpers";

test("the dark Home launcher and template preview have no severe accessibility violations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "TabScore" })).toBeVisible();
  await page.getByRole("button", { name: /Templates/ }).click();
  await expect(page.locator(".homeThumbnail svg")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }))).toEqual([]);
});
