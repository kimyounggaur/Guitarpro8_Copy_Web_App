import { tryNoteMidiPitch } from "../../model/derive";
import type { Note, Stylesheet, Track } from "../../model/types";
import type { Clef } from "../notation/staffPosition";
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
  clef?: Clef;
  splitAt?: number;
  side?: "upper" | "lower";
}

export function trackStack(track: Track, style: Stylesheet): { bands: StaffBand[]; height: number } {
  const bands: StaffBand[] = [];
  let height = 0;
  function add(band: Omit<StaffBand, "top" | "marginAbove">) {
    bands.push({ ...band, top: height, marginAbove: 0 });
    height += band.height + band.marginBelow;
  }

  if (track.kind === "percussion") {
    add({ kind: "percussion", clef: "percussion", height: STANDARD_STAFF_HEIGHT, marginBelow: 18 });
    return { bands, height };
  }

  const notation = track.notationTypes;
  const tab = notation.includes("tab") && !(style.systems.hideTabForStandardOnly && track.kind !== "stringed");
  if (notation.includes("standard") || !notation.length) {
    if (track.clef === "grand" || track.staffConfig === "grand") {
      add({ kind: "standard", clef: "treble", side: "upper", splitAt: 60, height: STANDARD_STAFF_HEIGHT, marginBelow: TAB_STAFF_TOP_GAP });
      add({ kind: "standard", clef: "bass", side: "lower", splitAt: 60, height: STANDARD_STAFF_HEIGHT, marginBelow: TAB_STAFF_TOP_GAP });
    } else {
      add({ kind: "standard", clef: track.clef ?? "treble", height: STANDARD_STAFF_HEIGHT, marginBelow: TAB_STAFF_TOP_GAP });
    }
  }

  if (tab) {
    add({
      kind: "tab",
      height: Math.max(0, track.tuning.strings.length - 1) * TAB_LINE_GAP,
      marginBelow: TAB_RHYTHM_GAP + TAB_RHYTHM_STEM_LENGTH
    });
  }
  if (notation.includes("slash")) {
    add({ kind: "slash", height: STANDARD_STAFF_HEIGHT, marginBelow: TAB_STAFF_TOP_GAP });
  }
  if (!bands.length) {
    add({ kind: "standard", clef: "treble", height: STANDARD_STAFF_HEIGHT, marginBelow: TAB_STAFF_TOP_GAP });
  }

  return { bands, height };
}

export function noteBelongsToBand(track: Track, note: Note, band: StaffBand): boolean {
  if (band.splitAt === undefined) return true;
  const pitch = tryNoteMidiPitch(note, track);
  if (pitch === null) return false;
  return band.side === "upper" ? pitch >= band.splitAt : pitch < band.splitAt;
}
