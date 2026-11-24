import { normalizeVolume } from "../../model/mix";
import type { Automation, Score } from "../../model/types";
import type { PlaybackCompilation } from "./compile";
import { writtenBarStarts } from "./tempoMap";

export interface MixerPoint {
  timeSec: number;
  value: number;
  ramp: boolean;
}

export interface MixerAutomation {
  master: MixerPoint[];
  tracks: Record<string, { volume: MixerPoint[]; pan: MixerPoint[]; masterPan: MixerPoint[] }>;
}

const EPSILON = 1e-6;

export function compileMixerAutomation(score: Score, compilation: PlaybackCompilation): MixerAutomation {
  const written = writtenBarStarts(score);
  const masterPan = compileLane(score.masterAutomations, "pan", compilation, written);
  return {
    master: compileLane(score.masterAutomations, "volume", compilation, written),
    tracks: Object.fromEntries(score.tracks.map((track) => {
      const trackPan = compileLane(track.automations, "pan", compilation, written);
      return [track.id, {
        volume: compileLane(track.automations, "volume", compilation, written),
        pan: combinePan(masterPan, trackPan),
        masterPan
      }];
    }))
  };
}

function compileLane(
  automations: Automation[], type: "pan" | "volume", compilation: PlaybackCompilation, written: number[]
): MixerPoint[] {
  const lane = automations.find((automation) => automation.type === type);
  if (!lane?.points.length) return [];

  const decode = type === "volume" ? normalizeVolume : (value: number) => Math.max(-1, Math.min(1, value));
  const points = [...lane.points].sort((left, right) => left.tick - right.tick)
    .map((point) => ({ timeSec: point.tick, value: decode(point.value), ramp: false }));
  points.forEach((point, index) => {
    point.ramp = index > 0 && lane.points.some((source) =>
      source.tick === points[index - 1].timeSec && source.transition === "progressive");
  });

  return compilation.segments.flatMap((segment) => {
    const begin = written[segment.barIndex] ?? 0;
    const end = begin + segment.durationTicks;
    function pointAt(tick: number, isBeginning: boolean): MixerPoint {
      const { value, ramp } = mixerValueAt(points, tick, type === "volume" ? 1 : 0);
      return {
        timeSec: compilation.tempoMap.ticksToSeconds(segment.startTick + tick - begin),
        value,
        ramp: !isBeginning && ramp
      };
    }
    const inside = points.filter(({ timeSec }) => timeSec > begin && timeSec < end - EPSILON)
      .map(({ timeSec }) => pointAt(timeSec, false));
    return [pointAt(begin, true), ...inside, pointAt(end - EPSILON, false)];
  });
}

function combinePan(master: MixerPoint[], track: MixerPoint[]): MixerPoint[] {
  const times = [...new Set([...master, ...track].map(({ timeSec }) => timeSec))].sort((a, b) => a - b);
  return times.map((timeSec) => {
    const lhs = mixerValueAt(master, timeSec, 0);
    const rhs = mixerValueAt(track, timeSec, 0);
    return { timeSec, value: lhs.value + rhs.value, ramp: lhs.ramp || rhs.ramp };
  });
}

export function mixerValueAt(points: MixerPoint[], timeSec: number, fallback: number): { value: number; ramp: boolean } {
  if (!points.length) return { value: fallback, ramp: false };
  const after = points.findIndex((point) => point.timeSec >= timeSec);
  if (after === 0) return { value: points[0].value, ramp: false };
  if (after < 0) return { value: points[points.length - 1].value, ramp: false };
  const next = points[after];
  if (next.timeSec === timeSec) return { value: next.value, ramp: next.ramp };
  const before = points[after - 1];
  if (!next.ramp) return { value: before.value, ramp: false };
  const weight = (timeSec - before.timeSec) / (next.timeSec - before.timeSec);
  return { value: before.value + (next.value - before.value) * weight, ramp: true };
}
