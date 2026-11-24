import type { DisplayMode, Score, Stylesheet } from "../../model/types";
import { normalizeStylesheet, renderHeaderToken, resolvePageMetrics, type PageMetrics } from "../../model/stylesheet";
import { validateBarDurations } from "../validate";
import { createMeasureContents } from "./measureContents";
import { trackLayoutInputs, type LayoutCache } from "./layoutCache";
import { layoutPages } from "./pageLayout";
import type { SceneGraph, ScenePrimitive } from "./sceneGraph";
import { breakSystems } from "./systemBreaker";
import { SYSTEM_LABEL_WIDTH } from "./metrics";
import { systemPrimitives } from "./trackScene";

export interface LayoutScoreOptions {
  cache?: LayoutCache;
  displayMode?: DisplayMode;
  concertTone?: boolean;
  groupHorizontalSystems?: boolean;
}

export function layoutScore(score: Score, options: LayoutScoreOptions = {}): SceneGraph {
  const { cache } = options;
  const stylesheet = cache?.stylesheet(score.stylesheet) ?? normalizeStylesheet(score.stylesheet);
  const metrics = resolvePageMetrics(stylesheet, options.displayMode);
  const contents = cache?.measureContents(score, stylesheet.notation) ?? createMeasureContents(score, stylesheet.notation);
  const width = metrics.contentWidth - SYSTEM_LABEL_WIDTH;
  const systems = cache?.breakSystems(contents, width, stylesheet.page) ?? breakSystems(contents, width, stylesheet.page);
  const groupSystems = options.groupHorizontalSystems && options.displayMode === "horizontal-screen";
  const concertTone = options.concertTone ?? score.documentSettings.concertTone;
  let durationIssues: ReturnType<typeof validateBarDurations> | undefined;
  const sharedInputs = cache && [
    stylesheet,
    metrics.trackGap,
    concertTone,
    score.masterBars[0]?.anacrusis,
    score.masterBars.at(-1)?.anacrusis,
    ...score.tracks.flatMap(trackLayoutInputs)
  ];
  const pages = layoutPages(systems, score.tracks, stylesheet, metrics, (system) => {
    const draw = () => systemPrimitives(score, system.measures, 0, 0, {
      durationIssues: durationIssues ??= validateBarDurations(score),
      concertTone,
      trackGap: metrics.trackGap,
      stylesheet,
      cache
    });
    return cache && sharedInputs ? cache.drawSystem(score, system, sharedInputs, draw) : draw();
  }, groupSystems);

  const scenePages = pages.map((page) => {
    const draw = () => ({
      id: `page-${page.index}`,
      width: page.width,
      height: page.height,
      primitives: [
        pageBackground(page.index, page.width, page.height, metrics),
        ...pageTextPrimitives(score, stylesheet, metrics, page.index, pages.length, page.height),
        ...page.primitives
      ]
    });
    return cache?.page(page.index, [score.meta, stylesheet, page.width, page.height, pages.length,
      metrics.marginLeft, metrics.marginRight, metrics.marginTop, metrics.marginBottom], page.primitives, draw) ?? draw();
  });
  cache?.finishPages(scenePages.length);
  return { pages: scenePages };
}

function pageBackground(
  pageIndex: number,
  width: number,
  height: number,
  metrics: PageMetrics
): ScenePrimitive {
  return {
    id: `page-${pageIndex}-background`,
    type: "rect",
    x: 0,
    y: 0,
    width,
    height,
    fill: metrics.pageFill,
    stroke: metrics.pageStroke,
    strokeWidth: metrics.pageStrokeWidth
  };
}

function pageTextPrimitives(
  score: Score,
  stylesheet: Stylesheet,
  metrics: PageMetrics,
  pageIndex: number,
  pageCount: number,
  pageHeight: number
): ScenePrimitive[] {
  const primitives: ScenePrimitive[] = [];
  const headerVisible =
    stylesheet.headerFooter.headerVisibility === "everyPage" ||
    (stylesheet.headerFooter.headerVisibility === "firstPage" && pageIndex === 0);
  const footerVisible =
    stylesheet.headerFooter.footerVisibility === "everyPage" ||
    (stylesheet.headerFooter.footerVisibility === "firstPage" && pageIndex === 0);

  if (headerVisible) {
    const title =
      pageIndex === 0
        ? renderHeaderToken(stylesheet.headerFooter.firstPageTitle, score, pageIndex, pageCount)
        : renderHeaderToken(stylesheet.headerFooter.centerHeader, score, pageIndex, pageCount);
    const subtitle =
      pageIndex === 0
        ? renderHeaderToken(stylesheet.headerFooter.firstPageSubtitle, score, pageIndex, pageCount)
        : "";
    const sideY = Math.max(18, metrics.marginTop - 18);

    primitives.push(
      ...optionalText(
        `page-${pageIndex}-header-left`,
        renderHeaderToken(stylesheet.headerFooter.leftHeader, score, pageIndex, pageCount),
        metrics.marginLeft,
        sideY,
        stylesheet.texts.bodySize,
        "start",
        stylesheet.symbols.textColor,
        stylesheet.texts.bodyFont
      ),
      ...optionalText(
        `page-${pageIndex}-header-right`,
        renderHeaderToken(stylesheet.headerFooter.rightHeader, score, pageIndex, pageCount),
        metrics.pageWidth - metrics.marginRight,
        sideY,
        stylesheet.texts.bodySize,
        "end",
        stylesheet.symbols.textColor,
        stylesheet.texts.bodyFont
      ),
      ...optionalText(
        `page-${pageIndex}-header-title`,
        title,
        metrics.pageWidth / 2,
        Math.max(24, metrics.marginTop - 30),
        stylesheet.texts.titleSize,
        "middle",
        stylesheet.symbols.textColor,
        stylesheet.texts.titleFont,
        {
          kind: "header",
          ref: {},
          bbox: { x: metrics.pageWidth / 2 - 140, y: metrics.marginTop - 52, width: 280, height: 32 }
        }
      ),
      ...optionalText(
        `page-${pageIndex}-header-subtitle`,
        subtitle,
        metrics.pageWidth / 2,
        Math.max(38, metrics.marginTop - 10),
        stylesheet.texts.subtitleSize,
        "middle",
        stylesheet.symbols.mutedTextColor,
        stylesheet.texts.subtitleFont
      )
    );
  }

  if (footerVisible) {
    const footerY = pageHeight - Math.max(20, metrics.marginBottom / 2);

    primitives.push(
      ...optionalText(
        `page-${pageIndex}-footer-left`,
        stylesheet.headerFooter.showCopyright
          ? renderHeaderToken(stylesheet.headerFooter.leftFooter, score, pageIndex, pageCount)
          : "",
        metrics.marginLeft,
        footerY,
        stylesheet.texts.bodySize,
        "start",
        stylesheet.symbols.mutedTextColor,
        stylesheet.texts.bodyFont
      ),
      ...optionalText(
        `page-${pageIndex}-footer-center`,
        stylesheet.headerFooter.showPageNumbers
          ? renderHeaderToken(stylesheet.headerFooter.centerFooter, score, pageIndex, pageCount)
          : "",
        metrics.pageWidth / 2,
        footerY,
        stylesheet.texts.bodySize,
        "middle",
        stylesheet.symbols.mutedTextColor,
        stylesheet.texts.bodyFont
      ),
      ...optionalText(
        `page-${pageIndex}-footer-right`,
        renderHeaderToken(stylesheet.headerFooter.rightFooter, score, pageIndex, pageCount),
        metrics.pageWidth - metrics.marginRight,
        footerY,
        stylesheet.texts.bodySize,
        "end",
        stylesheet.symbols.mutedTextColor,
        stylesheet.texts.bodyFont
      )
    );
  }

  return primitives;
}

function optionalText(
  id: string,
  text: string,
  x: number,
  y: number,
  fontSize: number,
  anchor: "start" | "middle" | "end",
  fill: string,
  fontFamily?: string,
  hit?: ScenePrimitive["hit"]
): ScenePrimitive[] {
  if (!text) {
    return [];
  }

  return [
    {
      id,
      type: "text",
      x,
      y,
      text,
      fill,
      fontSize,
      fontFamily,
      anchor,
      hit
    } satisfies ScenePrimitive
  ];
}
