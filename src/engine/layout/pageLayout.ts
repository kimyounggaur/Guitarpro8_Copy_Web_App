import {
  CONTENT_HEIGHT,
  CONTENT_WIDTH,
  HEADER_HEIGHT,
  PAGE_MARGIN_TOP,
  SYSTEM_GAP,
  TAB_LINE_GAP,
  TAB_STAFF_TOP_GAP,
  TRACK_GAP,
  STANDARD_STAFF_HEIGHT
} from "./metrics";
import type { LayoutSystem } from "./systemBreaker";

export interface PageSystem {
  system: LayoutSystem;
  x: number;
  y: number;
  height: number;
}

export interface LayoutPage {
  index: number;
  systems: PageSystem[];
}

export function layoutPages(systems: LayoutSystem[], trackCount: number): LayoutPage[] {
  const pages: LayoutPage[] = [];
  let pageSystems: PageSystem[] = [];
  let y = PAGE_MARGIN_TOP + HEADER_HEIGHT;
  const systemHeight = calculateSystemHeight(trackCount);

  for (const system of systems) {
    if (pageSystems.length > 0 && y + systemHeight > CONTENT_HEIGHT) {
      pages.push({ index: pages.length, systems: pageSystems });
      pageSystems = [];
      y = PAGE_MARGIN_TOP + HEADER_HEIGHT;
    }

    pageSystems.push({
      system,
      x: 0,
      y,
      height: systemHeight
    });
    y += systemHeight + SYSTEM_GAP;
  }

  if (pageSystems.length > 0) {
    pages.push({ index: pages.length, systems: pageSystems });
  }

  return pages;
}

export function calculateSystemHeight(trackCount: number): number {
  const tabHeight = TAB_LINE_GAP * 5;
  const singleTrackHeight = STANDARD_STAFF_HEIGHT + TAB_STAFF_TOP_GAP + tabHeight;
  return Math.max(1, trackCount) * singleTrackHeight + Math.max(0, trackCount - 1) * TRACK_GAP;
}

export { CONTENT_WIDTH };
