import { readFile } from "node:fs/promises";
import { expect } from "@playwright/test";
import { unzipSync, strFromU8 } from "fflate";
import { openApp, test } from "../helpers";

test("[B15] multi-page SVG and PNG contain every page in order", async ({ page }) => {
  await openApp(page);
  await page.getByTitle("File I/O", { exact: true }).click();
  const panel = page.getByRole("region", { name: "File import and export" });

  const svgDownload = page.waitForEvent("download");
  await panel.getByRole("button", { name: /^SVG/ }).click();
  const svg = await svgDownload;
  expect(svg.suggestedFilename()).toMatch(/\.zip$/);
  const archive = unzipSync(await readFile((await svg.path())!));
  const pages = Object.keys(archive);
  expect(pages.length).toBeGreaterThan(1);
  expect(pages).toEqual(pages.map((_, index) => `page-${String(index + 1).padStart(3, "0")}.svg`));
  expect(strFromU8(archive[pages[0]])).toMatch(/<path id="[^"]*(?:clef|rest)[^"]*" d="M/);

  await panel.getByRole("combobox", { name: "PNG scale" }).selectOption("3");
  const pngDownload = page.waitForEvent("download");
  await panel.getByRole("button", { name: /^PNG/ }).click();
  const png = await pngDownload;
  const pngPages = unzipSync(await readFile((await png.path())!));
  expect(Object.keys(pngPages)).toEqual(pages.map((name) => name.replace(/\.svg$/, ".png")));
  const first = pngPages["page-001.png"];
  const view = new DataView(first.buffer, first.byteOffset, first.byteLength);
  const svgWidth = /<svg[^>]*width="([0-9.]+)"/.exec(strFromU8(archive[pages[0]]))?.[1];
  expect(view.getUint32(16)).toBe(Math.round(Number(svgWidth) * 3));
});

test("[C10] browser PDF contains the full printed page count", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Playwright PDF capture uses Chromium.");
  await page.addInitScript(() => { window.print = () => {}; });
  await openApp(page);
  await page.getByTitle("File I/O", { exact: true }).click();
  await page.getByRole("region", { name: "File import and export" }).getByRole("button", { name: /^PDF/ }).click();
  const printed = page.locator(".printScorePages > section");
  const count = await printed.count();
  expect(count).toBeGreaterThan(1);
  const buffer = await page.pdf({ preferCSSPageSize: true });
  expect(buffer.toString("ascii", 0, 4)).toBe("%PDF");
  expect(buffer.toString("latin1").match(/\/Type\s*\/Page\b/g)).toHaveLength(count);
});
