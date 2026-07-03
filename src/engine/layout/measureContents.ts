import { barTheoreticalTicks, beatDurationTicks } from "../../model/derive";
import type { Score } from "../../model/types";
import { BEAT_MIN_GAP, MEASURE_MIN_WIDTH } from "./metrics";

export interface BeatPlacement {
  tick: number;
  durationTicks: number;
}

export interface MeasureContent {
  barIndex: number;
  expectedTicks: number;
  minWidth: number;
  forcedBreak: boolean;
  preventBreak: boolean;
  beats: BeatPlacement[];
}

export function createMeasureContents(score: Score): MeasureContent[] {
  return score.masterBars.map((masterBar, barIndex) => {
    const beats = collectBeatPlacements(score, barIndex);
    const expectedTicks = barTheoreticalTicks(masterBar);
    const beatCount = Math.max(beats.length, 1);

    return {
      barIndex,
      expectedTicks,
      minWidth: Math.max(MEASURE_MIN_WIDTH, beatCount * BEAT_MIN_GAP + 28),
      forcedBreak: masterBar.layout.forcedBreak,
      preventBreak: masterBar.layout.preventBreak,
      beats
    };
  });
}

export function tickToMeasureX(measure: MeasureContent, tick: number, width: number): number {
  if (measure.expectedTicks <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(width, (tick / measure.expectedTicks) * width));
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
          durationTicks: Math.max(previous?.durationTicks ?? 0, durationTicks)
        });

        tick += durationTicks;
      });
    });
  });

  return [...placementsByTick.values()].sort((left, right) => left.tick - right.tick);
}
