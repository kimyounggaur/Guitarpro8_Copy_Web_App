import { expect } from "@playwright/test";
import { createBeat } from "../../../model/factory";
import { openApp, test } from "../helpers";
import { guitarWithBars } from "./scoreFixtures";

test("[A5] the score uses loaded Bravura glyphs for a rest and a fermata", async ({ page }) => {
  const score = guitarWithBars([[5]]);
  score.tracks[0].bars[0].voices[0].beats.push(createBeat({ rest: true }));
  score.masterBars[0].fermatas.push({ beatTick: 0, glyph: "medium", tempoScale: 0.75 });
  await openApp(page, { fixture: score });

  const glyphs = page.locator("svg.scorePage text").filter({ hasText: /^[\uE4C0\uE4E5]$/u });
  await expect(glyphs).toHaveCount(2);

  const loadedFaces = await page.evaluate(async () => {
    try {
      return (await document.fonts.load("32px Bravura", "\uE4C0\uE4E5")).map((font) => font.status);
    } catch {
      return [];
    }
  });

  expect(loadedFaces).toContain("loaded");
  for (const glyph of await glyphs.all()) {
    const bounds = await glyph.boundingBox();
    expect(bounds?.width).toBeGreaterThan(0);
    expect(bounds?.height).toBeGreaterThan(0);
  }
});

test("[A5] a failed font request warns and leaves the score usable", async ({ page }) => {
  await page.addInitScript(() => {
    const load = document.fonts.load.bind(document.fonts);
    document.fonts.load = (font, glyphs) => font.includes("Bravura")
      ? Promise.reject(new Error("Interrupted Bravura load"))
      : load(font, glyphs);
  });
  await openApp(page);
  await expect(page.getByText("악보 글꼴을 불러오지 못했습니다.")).toBeVisible();
  await expect(page.getByTestId("gp-shell")).toBeVisible();
});
