import { expect } from "@playwright/test";
import { availableMenuGroups } from "../../../commands/menus";
import { openApp, state, test } from "../helpers";

test("menu keyboard navigation, nested file actions and save-as share the desktop dispatch", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "showSaveFilePicker", { value: undefined }));
  await openApp(page);
  const nav = page.getByRole("navigation", { name: "Application menus" });
  const file = nav.getByRole("button", { name: "File", exact: true });
  await file.focus();
  await page.keyboard.press("End");
  await expect(nav.getByRole("button", { name: "Help", exact: true })).toBeFocused();
  await page.keyboard.type("fi");
  await expect(file).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(nav.getByRole("button", { name: /^New/ })).toBeFocused();
  await page.keyboard.press("End");
  await expect(nav.getByRole("button", { name: /^Print/ })).toBeFocused();
  await page.keyboard.press("Home");
  await page.keyboard.type("imp");
  const submenu = nav.getByRole("button", { name: "Import", exact: true });
  await expect(submenu).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(nav.getByRole("button", { name: /Import ASCII/ })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(submenu).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowRight");
  await expect(nav.getByRole("button", { name: "Edit", exact: true })).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(nav.getByRole("button", { name: "Edit", exact: true })).toBeFocused();
  await file.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Home");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(nav.getByRole("button", { name: /^Save As/ })).toBeFocused();
  const download = page.waitForEvent("download");
  await page.keyboard.press("Enter");
  expect((await download).suggestedFilename()).toMatch(/\.tabscore$/);
  await expect(file).toBeFocused();
});

test("View checkmarks track the selected panels and display mode; unavailable actions cannot run", async ({ page }) => {
  await openApp(page);
  const nav = page.getByRole("navigation", { name: "Application menus" });
  const view = nav.getByRole("button", { name: "View", exact: true });
  await view.click();
  const palette = nav.getByRole("button", { name: /Show Edition Palette/ });
  await expect(palette).toHaveAttribute("aria-pressed", "true");
  await palette.click();
  await expect(page.getByRole("complementary", { name: "Edition palette" })).toHaveCount(0);
  await view.click();
  await expect(palette).toHaveAttribute("aria-pressed", "false");
  await nav.getByRole("button", { name: "Horizontal Page", exact: true }).click();
  await expect.poll(async () => (await state(page)).view.displayMode).toBe("horizontal-page");
  await view.click();
  await expect(nav.getByRole("button", { name: "Horizontal Page", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Escape");
  const help = nav.getByRole("button", { name: "Help", exact: true });
  await help.click();
  const missing = nav.getByRole("button", { name: "About", exact: true });
  await expect(missing).toBeDisabled();
  const before = await state(page);
  await missing.evaluate(button => (button as HTMLButtonElement).click());
  expect((await state(page)).revision).toEqual(before.revision);
});

test("a menu command and its score shortcut update the same document history", async ({ page }) => {
  await openApp(page);
  const nav = page.getByRole("navigation", { name: "Application menus" });
  const bars = (await state(page)).score.masterBars.length;
  await nav.getByRole("button", { name: "Bar", exact: true }).click();
  await nav.getByRole("button", { name: "Insert Bar", exact: true }).click();
  expect((await state(page)).score.masterBars).toHaveLength(bars + 1);
  const score = page.getByRole("application", { name: "Editable score" });
  await score.focus();
  await page.keyboard.press("Control+z");
  expect((await state(page)).score.masterBars).toHaveLength(bars);
  await page.keyboard.press("Insert");
  expect((await state(page)).score.masterBars).toHaveLength(bars + 1);
  await nav.getByRole("button", { name: "Edit", exact: true }).click();
  await nav.getByRole("button", { name: "Undo", exact: true }).click();
  expect((await state(page)).score.masterBars).toHaveLength(bars);
});

test("all File actions exposed by the shared menu tree are reachable in the desktop menu", async ({ page }) => {
  const fileGroup = availableMenuGroups(new Set()).find(group => group.name === "File");
  expect(fileGroup).toBeDefined();
  const expected = fileGroup!.actions.map(action => action.id);
  await openApp(page);
  const nav = page.getByRole("navigation", { name: "Application menus" });
  await nav.getByRole("button", { name: "File", exact: true }).click();
  const visibleIds = () => nav.locator("ul button[data-menu-key]").evaluateAll(buttons =>
    buttons.map(button => button.getAttribute("data-menu-key")));
  const reachable = new Set(await visibleIds());
  for (const parent of ["Import", "Export"]) {
    await nav.getByRole("button", { name: parent, exact: true }).click();
    for (const id of await visibleIds()) reachable.add(id);
    await page.keyboard.press("Escape");
  }
  expect(expected.filter(id => !reachable.has(id))).toEqual([]);
});
