import { expect, test } from "@playwright/test";
import { notationVisualNames, notationVisualScore } from "../fixtures/notationVisual";
import { openApp } from "../e2e/helpers";

for (const name of notationVisualNames) {
  test(`notation first page ${name}`, async ({ page, context }, testInfo) => {
    test.skip(testInfo.project.name !== "visual-1440x900", "The notation baseline uses a fixed paper size.");
    await openApp(page, { fixture: notationVisualScore(name) });
    await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    const markup = await page.locator("svg.scorePage").first().evaluate((svg) => {
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.querySelector("[data-score-overlay]")?.remove();
      return clone.outerHTML;
    });
    const paper = await context.newPage();
    await paper.setViewportSize({ width: 794, height: 1123 });
    await paper.goto("/");
    await paper.setContent(`<style>@font-face{font-family:Bravura;src:url(/fonts/bravura/Bravura.woff2) format("woff2")}body{margin:0;background:white}svg{display:block}</style>${markup}`);
    await paper.evaluate(() => document.fonts.ready);
    await expect(paper.locator("svg.scorePage")).toHaveScreenshot(`notation-${name}.png`, { animations: "disabled" });
    await paper.close();
  });
}
