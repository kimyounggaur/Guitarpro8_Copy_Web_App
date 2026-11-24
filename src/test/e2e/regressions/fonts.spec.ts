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

  test.fail(true, "R3 bundles Bravura to render SMuFL private-use glyphs on clean systems.");
  expect(loadedFaces).toContain("loaded");
  for (const glyph of await glyphs.all()) {
    const bounds = await glyph.boundingBox();
    expect(bounds?.width).toBeGreaterThan(0);
    expect(bounds?.height).toBeGreaterThan(0);
  }
});
