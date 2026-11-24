import { barTheoreticalTicks, beatDurationTicks } from "../../model/derive";
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
  bpmAtTick: (tick: number) => number;
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
  const sections = applyFermatas(buildTempoSections(points, totalTicks), fermataRanges(score, segments));

  return {
    points,
    sections,
    totalTicks,
    totalSeconds: sections[sections.length - 1]?.endSec ?? 0,
    ticksToSeconds: (tick) => ticksToSeconds(sections, clamp(tick, 0, totalTicks)),
    bpmAtTick: (tick) => {
      const position = clamp(tick, 0, totalTicks);
      const section = sections.find((item) => position < item.endTick) ?? sections[sections.length - 1];
      return section ? bpmAt(section, position) : points[0]?.bpm ?? DEFAULT_TEMPO;
    },
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

interface FermataRange {
  startTick: number;
  endTick: number;
  scale: number;
}

function fermataRanges(score: Score, segments: PlaybackSegment[]): FermataRange[] {
  return segments.flatMap((segment) => {
    const bar = score.masterBars[segment.barIndex];
    return bar.fermatas.flatMap(({ beatTick, tempoScale }) => {
      if (!(beatTick >= 0 && beatTick < segment.durationTicks && tempoScale > 0 && Number.isFinite(tempoScale))) {
        return [];
      }

      const duration = notatedBeatTicks(score, segment.barIndex, beatTick)
        ?? TICKS_PER_QUARTER * 4 / bar.timeSignature.denominator;
      return [{
        startTick: segment.startTick + beatTick,
        endTick: segment.startTick + Math.min(segment.durationTicks, beatTick + duration),
        scale: tempoScale
      }];
    });
  });
}

function notatedBeatTicks(score: Score, barIndex: number, beatTick: number): number | undefined {
  let restDuration: number | undefined;
  for (const track of score.tracks) {
    for (const voice of track.bars[barIndex]?.voices ?? []) {
      let tick = 0;
      for (const beat of voice.beats) {
        const duration = beatDurationTicks(beat);
        if (tick === beatTick) {
          if (!beat.rest) return duration;
          restDuration = Math.min(restDuration ?? duration, duration);
          break;
        }
        tick += duration;
        if (tick > beatTick) break;
      }
    }
  }
  return restDuration;
}

function applyFermatas(sections: TempoSection[], ranges: FermataRange[]): TempoSection[] {
  if (!ranges.length) return sections;

  let elapsed = 0;
  return sections.flatMap((section) => {
    const overlapping = ranges.filter((range) => range.startTick < section.endTick && range.endTick > section.startTick);
    const boundaries = [...new Set([
      section.startTick,
      section.endTick,
      ...overlapping.flatMap((range) => [
        Math.max(section.startTick, range.startTick),
        Math.min(section.endTick, range.endTick)
      ])
    ])].sort((a, b) => a - b);
    return boundaries.slice(0, -1).map((startTick, index) => {
      const endTick = boundaries[index + 1];
      const scale = overlapping.find((range) => range.startTick <= startTick && range.endTick > startTick)?.scale ?? 1;
      const startBpm = bpmAt(section, startTick) * scale;
      const endBpm = bpmAt(section, endTick) * scale;
      const startSec = elapsed;
      elapsed += secondsForTickRange(endTick - startTick, startBpm, endBpm, section.transition);

      return { startTick, endTick, startBpm, endBpm, transition: section.transition, startSec, endSec: elapsed };
    });
  });
}

function bpmAt(section: TempoSection, tick: number): number {
  if (section.transition === "constant") return section.startBpm;
  const progress = (tick - section.startTick) / (section.endTick - section.startTick);
  return section.startBpm + (section.endBpm - section.startBpm) * progress;
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

  if (seconds <= section.startSec) return section.startTick;
  if (seconds >= section.endSec) return section.endTick;

  const elapsed = seconds - section.startSec;
  const sectionTicks = section.endTick - section.startTick;
  const bpmDelta = section.endBpm - section.startBpm;
  const ticks = section.transition === "constant" || bpmDelta === 0
    ? (elapsed * section.startBpm * TICKS_PER_QUARTER) / 60
    : (sectionTicks * section.startBpm / bpmDelta) *
      Math.expm1(elapsed * bpmDelta / ((sectionTicks / TICKS_PER_QUARTER) * 60));

  return section.startTick + clamp(ticks, 0, sectionTicks);
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

  const bpmDelta = endBpm - startBpm;
  const relativeChange = (bpmDelta * ticks) / (sectionTicks * startBpm);
  return ((sectionTicks / TICKS_PER_QUARTER) * 60 * Math.log1p(relativeChange)) / bpmDelta;
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

export function writtenBarStarts(score: Score): number[] {
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

export function writtenTempoMap(score: Score, speedOverride: PlaybackSpeedOverride): TempoMap {
  const starts = writtenBarStarts(score);
  const segments = score.masterBars.map((bar, index) => ({
    sequenceIndex: index,
    barIndex: index,
    startTick: starts[index],
    durationTicks: barTheoreticalTicks(bar),
    pass: 1,
    visit: 1
  }));
  return buildTempoMap(score, segments, speedOverride);
}

export function setMeasureTempo(score: Score, barIndex: number, bpm: number): void {
  const tick = writtenBarStarts(score)[barIndex];
  if (tick === undefined) return;
  let tempo = score.masterAutomations.find((automation) =>
    automation.type === "tempo" && automation.scope === "master"
  );
  if (!tempo) {
    tempo = { type: "tempo", scope: "master", points: [] };
    score.masterAutomations.push(tempo);
  }
  const value = clampTempo(bpm);
  const point = tempo.points.find((item) => item.tick === tick);
  if (point) {
    point.value = value;
  } else {
    tempo.points.push(tempoAutomationPoint(tick, value));
    tempo.points.sort((left, right) => left.tick - right.tick);
  }
}
