import type { NoteRef, Track } from "../../model/types";
import { MUSIC_FONT_FAMILY, SMUFL } from "../render/smufl";
import {
  BARLINE_BOTTOM_PADDING,
  BARLINE_TOP_PADDING,
  STAFF_LINE_GAP,
  SYSTEM_LABEL_WIDTH,
  TAB_LINE_GAP
} from "./metrics";
import type { HitMetadata, ScenePrimitive } from "./sceneGraph";

export function trackLabel(track: Track, trackIndex: number, x: number, y: number): ScenePrimitive {
  return {
    id: `${track.id}-label`,
    type: "text",
    x: x + 6,
    y: y + 18,
    text: trackIndex === 0 ? track.shortName : track.name,
    fill: track.color,
    fontSize: 12,
    hit: {
      kind: "track",
      ref: { trackId: track.id },
      bbox: { x, y, width: SYSTEM_LABEL_WIDTH - 4, height: 24 }
    }
  };
}

export function standardStaffLines(
  trackId: string,
  x1: number,
  x2: number,
  y: number
): ScenePrimitive[] {
  return Array.from({ length: 5 }, (_, index) => ({
    id: `${trackId}-standard-line-${index}`,
    type: "line" as const,
    x1,
    y1: y + index * STAFF_LINE_GAP,
    x2,
    y2: y + index * STAFF_LINE_GAP,
    stroke: "#202020",
    strokeWidth: 1
  }));
}

export function tabStaffLines(
  trackId: string,
  x1: number,
  x2: number,
  y: number,
  stringCount: number
): ScenePrimitive[] {
  return Array.from({ length: stringCount }, (_, index) => ({
    id: `${trackId}-tab-line-${index}`,
    type: "line" as const,
    x1,
    y1: y + index * TAB_LINE_GAP,
    x2,
    y2: y + index * TAB_LINE_GAP,
    stroke: "#202020",
    strokeWidth: 1
  }));
}

export function clefPrimitive(trackId: string, x: number, y: number): ScenePrimitive {
  return {
    id: `${trackId}-clef`,
    type: "text",
    x,
    y,
    text: SMUFL.gClef,
    fill: "#111827",
    fontSize: 34,
    fontFamily: MUSIC_FONT_FAMILY,
    hit: { kind: "clef", ref: { trackId }, bbox: { x, y: y - 34, width: 28, height: 40 } }
  };
}

export function tabLabelPrimitive(trackId: string, x: number, y: number): ScenePrimitive {
  return {
    id: `${trackId}-tab-label`,
    type: "text",
    x,
    y,
    text: "TAB",
    fill: "#111827",
    fontSize: 12,
    hit: { kind: "clef", ref: { trackId }, bbox: { x, y: y - 12, width: 28, height: 16 } }
  };
}

export function timeSignaturePrimitive(
  trackId: string,
  barIndex: number,
  x: number,
  y: number,
  numerator: number,
  denominator: number
): ScenePrimitive {
  return {
    id: `${trackId}-${barIndex}-timesig`,
    type: "text",
    x,
    y: y + STAFF_LINE_GAP * 2.5,
    text: `${numerator}/${denominator}`,
    fill: "#111827",
    fontSize: 12,
    anchor: "middle",
    hit: { kind: "timeSig", ref: { trackId, barIndex }, bbox: { x: x - 12, y, width: 24, height: 30 } }
  };
}

export function keySignaturePrimitive(
  trackId: string,
  barIndex: number,
  x: number,
  y: number,
  keyName: string
): ScenePrimitive {
  return {
    id: `${trackId}-${barIndex}-keysig`,
    type: "text",
    x,
    y: y + STAFF_LINE_GAP * 2.5,
    text: keyName,
    fill: "#111827",
    fontSize: 12,
    anchor: "middle",
    hit: { kind: "keySig", ref: { trackId, barIndex }, bbox: { x: x - 8, y, width: 16, height: 30 } }
  };
}

export function barlinePrimitive(
  trackId: string,
  barIndex: number,
  x: number,
  top: number,
  bottom: number,
  stroke = "#111827"
): ScenePrimitive {
  return {
    id: `${trackId}-${barIndex}-barline-${x}`,
    type: "line",
    x1: x,
    y1: top - BARLINE_TOP_PADDING,
    x2: x,
    y2: bottom + BARLINE_BOTTOM_PADDING,
    stroke,
    strokeWidth: 1,
    hit: { kind: "bar", ref: { trackId, barIndex }, bbox: { x: x - 3, y: top, width: 6, height: bottom - top } }
  };
}

export function barHitRect(
  trackId: string,
  barIndex: number,
  x: number,
  y: number,
  width: number,
  bottom: number
): ScenePrimitive {
  return {
    id: `${trackId}-${barIndex}-hit`,
    type: "rect",
    x,
    y,
    width,
    height: bottom - y,
    fill: "transparent",
    hit: { kind: "bar", ref: { trackId, barIndex }, bbox: { x, y, width, height: bottom - y } }
  };
}

export function beatHit(ref: Partial<NoteRef>, x: number, y: number): HitMetadata {
  return {
    kind: "beat",
    ref,
    bbox: { x: x - 8, y: y - 10, width: 16, height: 44 }
  };
}

export function durationErrorRect(
  trackId: string,
  barIndex: number,
  x: number,
  y: number,
  width: number,
  height: number
): ScenePrimitive {
  return {
    id: `${trackId}-${barIndex}-duration-error`,
    type: "rect",
    x,
    y,
    width,
    height,
    fill: "rgba(239, 68, 68, 0.07)",
    stroke: "#ef4444",
    strokeWidth: 1.5,
    radius: 2,
    hit: { kind: "bar", ref: { trackId, barIndex }, bbox: { x, y, width, height } }
  };
}
