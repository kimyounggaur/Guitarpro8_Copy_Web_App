import type { MeasureContent } from "./measureContents";
import { BEAT_MIN_GAP, NOTE_HEAD_WIDTH } from "./metrics";

export const MEASURE_LEFT_PADDING = 16;
export const MEASURE_RIGHT_PADDING = 14;
export const SIGNATURE_WIDTH = 48;

export function shortestBeat(measures: readonly MeasureContent[]): number {
  let shortest = Infinity;
  for (const measure of measures) {
    for (const beat of measure.beats) {
      if (beat.durationTicks > 0) {
        shortest = Math.min(shortest, beat.durationTicks);
      }
    }
  }
  return Number.isFinite(shortest) ? shortest : 1;
}

export function measureSpacing(
  measure: MeasureContent,
  shortestTicks: number,
  rhythmProportion: number,
  minMeasureWidth: number,
  systemStart: boolean
) {
  const showsSignature = systemStart || Boolean(measure.hasSignatureChange);
  const measured = systemStart ? measure.signatureWidths?.system : measure.signatureWidths?.change;
  const left = MEASURE_LEFT_PADDING + (showsSignature ? measured ?? SIGNATURE_WIDTH : 0);
  const fixed = left + MEASURE_RIGHT_PADDING;
  const sensitivity = Math.max(0, rhythmProportion) * 0.35;
  const gaps = measure.beats.map((beat) => Math.max(
    NOTE_HEAD_WIDTH * 1.6 + (beat.extraWidth ?? 0),
    BEAT_MIN_GAP * (1 + sensitivity * Math.log2(Math.max(1, beat.durationTicks / shortestTicks)))
  ));
  const rhythmicWidth = gaps.reduce((sum, gap) => sum + gap, 0);
  const ideal = Math.max(fixed + rhythmicWidth, minMeasureWidth, measure.minWidth);
  const stretch = rhythmicWidth > 0 ? (ideal - fixed) / rhythmicWidth : 1;
  return { ideal, fixed, left, gaps: gaps.map((gap) => gap * stretch), showsSignature };
}
