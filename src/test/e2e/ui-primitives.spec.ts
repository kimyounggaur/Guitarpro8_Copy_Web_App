import { expect, test } from "@playwright/test";

test.beforeEach(async ({page})=>{await page.goto("/src/test/fixtures/primitives/");});

test("icons, pointer and focus tooltips, and typed toolbar commands", async ({page})=>{
  await expect(page.getByRole("img",{name:"Home symbol"})).toBeVisible();
  const icon=page.getByRole("button",{name:"Inspect"});
  await icon.hover(); await expect(page.getByRole("tooltip")).toHaveText("Inspect F6");
  await page.mouse.move(0,0); await expect(page.getByRole("tooltip")).toHaveCount(0);
  await icon.focus(); await expect(page.getByRole("tooltip")).toBeVisible();
  await expect(icon).toHaveAttribute("aria-pressed","true");
  await expect(page.getByRole("button",{name:"Delete"})).toBeDisabled();
  await page.getByRole("button",{name:"Tuner"}).click(); await expect(page.locator("output")).toHaveText("tools.tuner");
});

test("submenu, disabled controls, typeahead, and dismiss",async({page})=>{
  const actions=page.getByRole("button",{name:"Actions"});
  await actions.click(); await expect(page.getByRole("menuitemcheckbox",{name:"Grid"})).toBeFocused();
  await page.keyboard.press("ArrowDown"); await expect(page.getByRole("menuitem",{name:"More"})).toBeFocused();
  await page.keyboard.press("ArrowRight"); await expect(page.getByRole("menuitem",{name:"Print"})).toBeFocused();
  await page.keyboard.press("ArrowLeft"); await expect(page.getByRole("menuitem",{name:"More"})).toBeFocused();
  await page.keyboard.press("s"); await expect(page.getByRole("menuitem",{name:/Save/})).toBeFocused();
  await page.keyboard.press("Home"); await expect(page.getByRole("menuitemcheckbox")).toBeFocused();
  await page.keyboard.press("End"); await page.keyboard.press("Space"); await expect(page.locator("output")).toHaveText("save");
  await page.keyboard.press("Escape"); await expect(actions).toBeFocused();
  await actions.click(); await page.getByRole("heading").click(); await expect(page.getByRole("menu")).toHaveCount(0);
});

test("modal focus restoration, manual tabs, segments and adjustable separator",async({page})=>{
  const opener=page.getByRole("button",{name:"Open dialog"});await opener.click();
  const dialog=page.getByRole("dialog",{name:"Score properties"});
  await expect(dialog.getByRole("button",{name:"First"})).toBeFocused();await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button",{name:"Close"})).toBeFocused();await page.keyboard.press("Escape");await expect(opener).toBeFocused();
  const first=page.getByRole("tab",{name:"Score"}),second=page.getByRole("tab",{name:"Mix"});
  await first.focus();await page.keyboard.press("ArrowRight"); await expect(second).toBeFocused();await expect(first).toHaveAttribute("aria-selected","true");
  await page.keyboard.press("Enter");await expect(page.getByRole("tabpanel")).toHaveText("Track levels");
  await page.getByRole("radio",{name:"Pencil"}).focus();await page.keyboard.press("ArrowRight");await expect(page.getByRole("radio",{name:"Select"})).toBeChecked();
  const split=page.getByRole("separator",{name:"Panel size"});await split.focus();await page.keyboard.press("Shift+ArrowRight");await expect(split).toHaveAttribute("aria-valuenow","30");
});
