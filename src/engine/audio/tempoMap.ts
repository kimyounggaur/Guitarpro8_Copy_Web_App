import { barTheoreticalTicks } from "../../model/derive";
import { TICKS_PER_QUARTER, type AutomationPoint, type Score } from "../../model/types";
import type { PlaybackSegment } from "../unroll/unrollScore";

export type PlaybackSpeedOverride =
  | { mode: "relative"; percent: number }
  | { mode: "fixedBpm"; bpm: number }
  | { mode: "progressive"; fromPercent: number; toPercent: number; loopCount: number; step: number };

export interface TempoPoint {
  tick: number;
  bpm: number;
  transition: "constant" | "progressive";
}

export interface TempoSection {
  startTick: number;
  endTick: number;
  startBpm: number;
  endBpm: number;
  transition: "constant" | "progressive";
  startSec: number;
  endSec: number;
}

export interface TempoMap {
  points: TempoPoint[];
  sections: TempoSection[];
  totalTicks: number;
  totalSeconds: number;
  ticksToSeconds: (tick: number) => number;
  secondsToTicks: (seconds: number) => number;
}

const DEFAULT_TEMPO = 120;

export function buildTempoMap(
  score: Score,
  segments: PlaybackSegment[],
  speedOverride: PlaybackSpeedOverride = { mode: "relative", percent: 100 }
): TempoMap {
  const totalTicks = segments.reduce((max, segment) => Math.max(max, segment.startTick + segment.durationTicks), 0);
  const points =
    speedOverride.mode === "fixedBpm"
      ? [{ tick: 0, bpm: clampTempo(speedOverride.bpm), transition: "constant" as const }]
      : collectTempoPoints(score, segments, speedOverride);
  const sections = buildTempoSections(points, totalTicks);

  return {
    points,
    sections,
    totalTicks,
    totalSeconds: sections[sections.length - 1]?.endSec ?? 0,
    ticksToSeconds: (tick) => ticksToSeconds(sections, clamp(tick, 0, totalTicks)),
    secondsToTicks: (seconds) => secondsToTicks(sections, Math.max(0, seconds))
  };
}

function collectTempoPoints(
  score: Score,
  segments: PlaybackSegment[],
  speedOverride: PlaybackSpeedOverride
): TempoPoint[] {
  const tempoAutomation = score.masterAutomations.find(
    (automation) => automation.type === "tempo" && automation.scope === "master"
  );
  const writtenStarts = writtenBarStarts(score);
  const basePoints = tempoAutomation?.points.length
    ? tempoAutomation.points
    : [{ tick: 0, value: DEFAULT_TEMPO, transition: "constant" as const }];
  const points: TempoPoint[] = [{ tick: 0, bpm: speedAdjustedTempo(DEFAULT_TEMPO, speedOverride), transition: "constant" }];

  segments.forEach((segment) => {
    const writtenStart = writtenStarts[segment.barIndex] ?? 0;
    const writtenEnd = writtenStart + segment.durationTicks;

    basePoints.forEach((point) => {
      if (point.tick < writtenStart || point.tick >= writtenEnd) {
        return;
      }

      points.push({
        tick: segment.startTick + point.tick - writtenStart,
        bpm: speedAdjustedTempo(point.value, speedOverride),
        transition: point.transition
      });
    });
  });

  return dedupeTempoPoints(points);
}

function buildTempoSections(points: TempoPoint[], totalTicks: number): TempoSection[] {
  const sorted = dedupeTempoPoints(points);
  let elapsed = 0;
  const sections: TempoSection[] = [];

  if (totalTicks <= 0) {
    return [];
  }

  for (let index = 0; index < sorted.length; index += 1) {
    const point = sorted[index];
    const next = sorted[index + 1];
    const startTick = clamp(point.tick, 0, totalTicks);
    const endTick = clamp(next?.tick ?? totalTicks, startTick, totalTicks);
    const startBpm = point.bpm;
    const endBpm = next?.bpm ?? point.bpm;
    const transition = point.transition;
    const duration = secondsForTickRange(endTick - startTick, startBpm, endBpm, transition);

    sections.push({
      startTick,
      endTick,
      startBpm,
      endBpm,
      transition,
      startSec: elapsed,
      endSec: elapsed + duration
    });
    elapsed += duration;
  }

  return sections.filter((section) => section.endTick > section.startTick);
}

function ticksToSeconds(sections: TempoSection[], tick: number): number {
  const section = sectionForTick(sections, tick);

  if (!section) {
    return 0;
  }

  return (
    section.startSec +
    secondsForTickRange(tick - section.startTick, section.startBpm, section.endBpm, section.transition, section.endTick - section.startTick)
  );
}

function secondsToTicks(sections: TempoSection[], seconds: number): number {
  const section =
    sections.find((candidate) => seconds >= candidate.startSec && seconds <= candidate.endSec) ??
    sections[sections.length - 1];

  if (!section) {
    return 0;
  }

  if (section.transition === "constant" || section.startBpm === section.endBpm) {
    const sec = clamp(seconds - section.startSec, 0, section.endSec - section.startSec);
    return section.startTick + (sec * section.startBpm * TICKS_PER_QUARTER) / 60;
  }

  const ratio = section.endBpm / section.startBpm;
  const durationTicks = section.endTick - section.startTick;
  const normalizedSec = clamp(seconds - section.startSec, 0, section.endSec - section.startSec);
  const quarterSecondsAtStart = 60 / section.startBpm;
  const normalized =
    Math.exp((normalizedSec * Math.log(ratio)) / ((durationTicks / TICKS_PER_QUARTER) * quarterSecondsAtStart)) - 1;

  return section.startTick + (durationTicks * normalized) / (ratio - 1);
}

function secondsForTickRange(
  ticks: number,
  startBpm: number,
  endBpm: number,
  transition: "constant" | "progressive",
  sectionTicks = ticks
): number {
  if (ticks <= 0) {
    return 0;
  }

  if (transition === "constant" || startBpm === endBpm || sectionTicks <= 0) {
    return (ticks / TICKS_PER_QUARTER) * (60 / startBpm);
  }

  const start = startBpm;
  const end = startBpm + ((endBpm - startBpm) * ticks) / sectionTicks;
  const bpmDelta = endBpm - startBpm;
  return ((sectionTicks / TICKS_PER_QUARTER) * 60 * Math.log(end / start)) / bpmDelta;
}

function sectionForTick(sections: TempoSection[], tick: number): TempoSection | undefined {
  return (
    sections.find((section) => tick >= section.startTick && tick <= section.endTick) ??
    sections[sections.length - 1]
  );
}

function dedupeTempoPoints(points: TempoPoint[]): TempoPoint[] {
  const byTick = new Map<number, TempoPoint>();
  points.forEach((point) => {
    byTick.set(point.tick, { ...point, bpm: clampTempo(point.bpm) });
  });
  return [...byTick.values()].sort((left, right) => left.tick - right.tick);
}

function speedAdjustedTempo(bpm: number, speedOverride: PlaybackSpeedOverride): number {
  if (speedOverride.mode === "relative") {
    return clampTempo(bpm * (clamp(speedOverride.percent, 10, 300) / 100));
  }

  if (speedOverride.mode === "progressive") {
    return clampTempo(bpm * (clamp(speedOverride.fromPercent, 10, 300) / 100));
  }

  return clampTempo(speedOverride.bpm);
}

function writtenBarStarts(score: Score): number[] {
  let tick = 0;
  return score.masterBars.map((masterBar) => {
    const start = tick;
    tick += barTheoreticalTicks(masterBar);
    return start;
  });
}

function clampTempo(bpm: number): number {
  return clamp(bpm, 10, 300);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function tempoAutomationPoint(tick: number, bpm: number, transition: AutomationPoint["transition"] = "constant"): AutomationPoint {
  return { tick, value: bpm, transition };
}
