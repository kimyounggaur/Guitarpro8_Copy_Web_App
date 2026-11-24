import { expect } from "@playwright/test";
import { test } from "../helpers";

test("[C12] starts on the launcher and creates a score with the chosen meter and instrument", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "TabScore" })).toBeVisible();
  await expect(page.getByTestId("gp-shell")).toHaveCount(0);
  await page.getByRole("button", { name: "New score" }).click();
  await page.getByRole("combobox", { name: "Instrument" }).selectOption("bass");
  await page.getByRole("spinbutton", { name: "Beats" }).fill("3");
  await page.getByRole("spinbutton", { name: "Tempo" }).fill("92");
  await page.getByRole("button", { name: "Create score" }).click();
  await expect(page.getByTestId("gp-shell")).toBeVisible();
  await expect(page.getByTestId("tab-bar")).toContainText("Untitled");
  await expect(page.getByTestId("lcd-tempo")).toContainText("92");
  await expect(page.getByText("Bass", { exact: true }).first()).toBeVisible();
});

test("[C12] opens the demo after an explicit choice", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "View demo" }).click();
  await expect(page.getByTestId("gp-shell")).toBeVisible();
});
