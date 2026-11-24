import { expect, it } from "vitest";
import { layoutScore } from "../engine/layout/layoutScore";
import { createDemoScore } from "./demoScore";
import { createDefaultStylesheet, resolvePageMetrics, withPaperSize } from "./stylesheet";

it.each([
  ["A4", 794, 1123],
  ["Letter", 816, 1056],
  ["Legal", 816, 1344],
  ["A3", 1123, 1587]
])("[C3] %s changes page size in preview and landscape", (paper, width, height) => {
  const score = createDemoScore();
  score.stylesheet.page = withPaperSize(score.stylesheet.page, paper);
  expect(layoutScore(score).pages[0]).toMatchObject({ width, height });
  score.stylesheet.page.orientation = "landscape";
  expect(layoutScore(score).pages[0]).toMatchObject({ width: height, height: width });
});

it("[C3] preserves custom dimensions, page margins, and score title sizing", () => {
  const score = createDemoScore();
  const stylesheet = createDefaultStylesheet();
  stylesheet.page = withPaperSize({ ...stylesheet.page, width: 840, height: 1200, marginLeft: 84 }, "Custom");
  stylesheet.texts.titleSize = 30;
  stylesheet.systems.systemGap = 62;
  score.stylesheet = stylesheet;

  expect(resolvePageMetrics(stylesheet)).toMatchObject({
    pageWidth: 840, pageHeight: 1200, marginLeft: 84, contentWidth: 700, systemGap: 62
  });
  const first = layoutScore(score).pages[0];
  expect(first.primitives.find(({ id }) => id.endsWith("header-title"))).toMatchObject({ fontSize: 30 });
});
