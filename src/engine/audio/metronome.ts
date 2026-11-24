import { TICKS_PER_QUARTER, type Score, type TimeSignature } from "../../model/types";
import type { PlaybackSegment } from "../unroll/unrollScore";
import type { TempoMap } from "./tempoMap";

export interface TimingClick {
  timeSec: number;
  downbeat: boolean;
}

function pulseTicks(meter: TimeSignature): number {
  const compound = meter.denominator === 8 && [6, 9, 12].includes(meter.numerator);
  return (TICKS_PER_QUARTER * 4 / meter.denominator) * (compound ? 3 : 1);
}

export function metronomeClicks(score: Score, segments: PlaybackSegment[], tempoMap: TempoMap): TimingClick[] {
  return segments.flatMap((segment) => {
    const meter = score.masterBars[segment.barIndex].timeSignature;
    const period = pulseTicks(meter);
    const clicks: TimingClick[] = [];
    for (let offset = 0; offset < segment.durationTicks; offset += period) {
      clicks.push({
        timeSec: tempoMap.ticksToSeconds(segment.startTick + offset),
        downbeat: offset === 0
      });
    }
    return clicks;
  });
}

export function countInAt(score: Score, tempoMap: TempoMap, startSec: number): {
  duration: number;
  clicks: TimingClick[];
} {
  const firstBar = score.masterBars[0];
  if (!firstBar) return { duration: 0, clicks: [] };

  const meter = firstBar.timeSignature;
  const beatTicks = pulseTicks(meter);
  const beatSeconds = (beatTicks / TICKS_PER_QUARTER) * 60 / tempoMap.bpmAtTick(tempoMap.secondsToTicks(startSec));
  const length = meter.numerator * (TICKS_PER_QUARTER * 4 / meter.denominator);
  const count = Math.ceil(length / beatTicks);
  const duration = count * beatSeconds;
  return {
    duration,
    clicks: Array.from({ length: count }, (_, index) => ({
      timeSec: startSec - duration + index * beatSeconds,
      downbeat: index === 0
    }))
  };
}
