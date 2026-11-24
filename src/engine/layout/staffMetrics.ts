import type { Stylesheet, Track } from "../../model/types";
import {
  STANDARD_STAFF_HEIGHT,
  TAB_LINE_GAP,
  TAB_RHYTHM_GAP,
  TAB_RHYTHM_STEM_LENGTH,
  TAB_STAFF_TOP_GAP
} from "./metrics";

export interface StaffBand {
  kind: "standard" | "tab" | "slash" | "percussion";
  top: number;
  height: number;
  marginAbove: number;
  marginBelow: number;
}

export function trackStack(track: Track, _style: Stylesheet): { bands: StaffBand[]; height: number } {
  const standard: StaffBand = {
    kind: "standard",
    top: 0,
    height: STANDARD_STAFF_HEIGHT,
    marginAbove: 0,
    marginBelow: TAB_STAFF_TOP_GAP
  };
  const tab: StaffBand = {
    kind: "tab",
    top: standard.height + standard.marginBelow,
    height: Math.max(0, track.tuning.strings.length - 1) * TAB_LINE_GAP,
    marginAbove: 0,
    marginBelow: TAB_RHYTHM_GAP + TAB_RHYTHM_STEM_LENGTH
  };

  return { bands: [standard, tab], height: tab.top + tab.height + tab.marginBelow };
}
