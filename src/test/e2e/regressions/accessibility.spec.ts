import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";
import { focusScore, openApp, test } from "../helpers";

async function verifyCriticalAccessibility(page: Page) {
  const { violations } = await new AxeBuilder({ page }).setLegacyMode().analyze();
  const severe = violations
    .filter(({ impact }) => impact === "critical" || impact === "serious")
    .map(({ id, impact, nodes }) => ({ id, impact, targets: nodes.map(({ target }) => target) }));
  expect(severe).toEqual([]);
}

test("[C9] the editor, toolbar overflow and command palette have no severe accessibility violations", async ({ page }) => {
  await openApp(page);
  await verifyCriticalAccessibility(page);

  await page.getByRole("button", { name: "More toolbar controls" }).click();
  await verifyCriticalAccessibility(page);
  await page.keyboard.press("Escape");

  await focusScore(page);
  await page.keyboard.press("Control+e");
  const commandDialog = page.getByRole("dialog", { name: "Command palette" });
  await expect(commandDialog).toBeVisible();
  await expect(commandDialog.getByRole("textbox", { name: "Search commands" })).toBeFocused();
  await verifyCriticalAccessibility(page);
  await page.keyboard.press("Shift+Tab");
  await expect(commandDialog.locator(":focus")).toHaveCount(1);
  await page.keyboard.press("Tab");
  await expect(commandDialog.getByRole("textbox", { name: "Search commands" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(commandDialog).toBeHidden();
  await expect(page.getByRole("application", { name: "Editable score" })).toBeFocused();
});

test("[C9] the unsaved dialog confines keyboard focus and restores the opener", async ({ page }) => {
  await openApp(page);
  const viewport = page.getByRole("application", { name: "Editable score" });
  await focusScore(page);
  await page.keyboard.press("4");
  await page.keyboard.press("Control+n");
  const dialog = page.getByRole("dialog", { name: "Unsaved changes" });
  await expect(dialog).toBeVisible();
  await verifyCriticalAccessibility(page);

  const cancel = dialog.getByRole("button", { name: "Cancel" });
  await cancel.focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "Save and continue" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(viewport).toBeFocused();
});
