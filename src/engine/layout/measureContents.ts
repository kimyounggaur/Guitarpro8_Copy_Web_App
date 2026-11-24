import { barTheoreticalTicks, beatDurationTicks } from "../../model/derive";
import type { Beat, Score } from "../../model/types";
import { FLAG_WIDTH, NOTE_DOT_RADIUS } from "./metrics";
import type { SystemMeasure } from "./systemBreaker";

export interface BeatPlacement {
  tick: number;
  durationTicks: number;
  extraWidth?: number;
}

export interface MeasureContent {
  barIndex: number;
  expectedTicks: number;
  minWidth: number;
  forcedBreak: boolean;
  preventBreak: boolean;
  beats: BeatPlacement[];
  hasSignatureChange?: boolean;
}

export function createMeasureContents(score: Score): MeasureContent[] {
  return score.masterBars.map((masterBar, barIndex) => {
    const beats = collectBeatPlacements(score, barIndex);
    const expectedTicks = barTheoreticalTicks(masterBar);
    const previous = score.masterBars[barIndex - 1];

    return {
      barIndex,
      expectedTicks,
      minWidth: 0,
      hasSignatureChange: Boolean(previous && (
        previous.timeSignature.numerator !== masterBar.timeSignature.numerator ||
        previous.timeSignature.denominator !== masterBar.timeSignature.denominator ||
        previous.keySignature.key !== masterBar.keySignature.key ||
        previous.keySignature.mode !== masterBar.keySignature.mode
      )),
      forcedBreak: masterBar.layout.forcedBreak,
      preventBreak: masterBar.layout.preventBreak,
      beats
    };
  });
}

export function tickToMeasureX(measure: SystemMeasure, tick: number): number {
  const positions = measure.tickPositions;
  const nextIndex = positions.findIndex((position) => position.tick >= tick);
  if (nextIndex <= 0) {
    return nextIndex === 0 ? positions[0].x : positions.at(-1)?.x ?? 0;
  }
  const first = positions[nextIndex - 1];
  const second = positions[nextIndex];
  const ratio = (tick - first.tick) / (second.tick - first.tick);
  return first.x + (second.x - first.x) * ratio;
}

function beatExtraWidth(beat: Beat): number {
  const accidental = beat.notes.some((note) => note.forceAccidental || note.accidental !== "none");
  return (accidental ? 10 : 0) + beat.dots * NOTE_DOT_RADIUS * 3 + (beat.duration >= 8 ? FLAG_WIDTH : 0);
}

function collectBeatPlacements(score: Score, barIndex: number): BeatPlacement[] {
  const placementsByTick = new Map<number, BeatPlacement>();

  score.tracks.forEach((track) => {
    const bar = track.bars[barIndex];

    bar?.voices.forEach((voice) => {
      let tick = 0;

      voice.beats.forEach((beat) => {
        const durationTicks = beatDurationTicks(beat);
        const previous = placementsByTick.get(tick);

        placementsByTick.set(tick, {
          tick,
          durationTicks: Math.min(previous?.durationTicks ?? Infinity, durationTicks),
          extraWidth: Math.max(previous?.extraWidth ?? 0, beatExtraWidth(beat))
        });

        tick += durationTicks;
      });
    });
  });

  return [...placementsByTick.values()].sort((left, right) => left.tick - right.tick);
}
