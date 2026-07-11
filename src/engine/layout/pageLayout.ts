import {
  CONTENT_WIDTH,
  HEADER_HEIGHT,
  PAGE_HEIGHT,
  PAGE_MARGIN_BOTTOM,
  PAGE_MARGIN_TOP,
  PAGE_MARGIN_X,
  PAGE_WIDTH,
  SYSTEM_GAP,
  TAB_LINE_GAP,
  TAB_STAFF_TOP_GAP,
  TRACK_GAP,
  STANDARD_STAFF_HEIGHT
} from "./metrics";
import type { PageMetrics } from "../../model/stylesheet";
import type { LayoutSystem } from "./systemBreaker";

export interface PageSystem {
  system: LayoutSystem;
  x: number;
  y: number;
  height: number;
}

export interface LayoutPage {
  index: number;
  width: number;
  height: number;
  systems: PageSystem[];
}

export function layoutPages(
  systems: LayoutSystem[],
  trackCount: number,
  metrics: PageMetrics = defaultPageMetrics()
): LayoutPage[] {
  const pages: LayoutPage[] = [];
  let pageSystems: PageSystem[] = [];
  let y = metrics.marginTop + metrics.headerHeight;
  const systemHeight = calculateSystemHeight(trackCount, metrics.trackGap);
  const pageBottom = metrics.pageHeight - metrics.marginBottom;

  for (const system of systems) {
    if (!metrics.continuous && pageSystems.length > 0 && y + systemHeight > pageBottom) {
      pages.push({ index: pages.length, width: metrics.pageWidth, height: metrics.pageHeight, systems: pageSystems });
      pageSystems = [];
      y = metrics.marginTop + metrics.headerHeight;
    }

    pageSystems.push({
      system,
      x: 0,
      y,
      height: systemHeight
    });
    y += systemHeight + metrics.systemGap;
  }

  if (pageSystems.length > 0) {
    pages.push({
      index: pages.length,
      width: metrics.pageWidth,
      height: metrics.continuous ? Math.max(metrics.pageHeight, y + metrics.marginBottom - metrics.systemGap) : metrics.pageHeight,
      systems: pageSystems
    });
  }

  return pages;
}

export function calculateSystemHeight(trackCount: number, trackGap = TRACK_GAP): number {
  const tabHeight = TAB_LINE_GAP * 5;
  const singleTrackHeight = STANDARD_STAFF_HEIGHT + TAB_STAFF_TOP_GAP + tabHeight;
  return Math.max(1, trackCount) * singleTrackHeight + Math.max(0, trackCount - 1) * trackGap;
}

function defaultPageMetrics(): PageMetrics {
  return {
    pageWidth: PAGE_WIDTH,
    pageHeight: PAGE_HEIGHT,
    marginLeft: PAGE_MARGIN_X,
    marginRight: PAGE_MARGIN_X,
    marginTop: PAGE_MARGIN_TOP,
    marginBottom: PAGE_MARGIN_BOTTOM,
    headerHeight: HEADER_HEIGHT,
    contentWidth: CONTENT_WIDTH,
    systemGap: SYSTEM_GAP,
    trackGap: TRACK_GAP,
    continuous: false,
    pageFill: "#fbfaf7",
    pageStroke: "#d8d2c5",
    pageStrokeWidth: 1
  };
}

export { CONTENT_WIDTH };
