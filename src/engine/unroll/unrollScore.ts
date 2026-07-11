import { barTheoreticalTicks } from "../../model/derive";
import type { DirectionJump, DirectionTarget, Score } from "../../model/types";

export interface PlaybackSegment {
  sequenceIndex: number;
  barIndex: number;
  startTick: number;
  durationTicks: number;
  pass: number;
  visit: number;
}

export interface UnrollResult {
  segments: PlaybackSegment[];
  totalTicks: number;
  warnings: string[];
}

export interface UnrollOptions {
  maxSegments?: number;
}

interface RepeatFrame {
  startIndex: number;
  pass: number;
  total?: number;
}

interface DirectionState {
  codaArmed: boolean;
  fineArmed: boolean;
  usedJumps: Set<string>;
}

const DEFAULT_MAX_SEGMENTS = 512;

export function unrollScore(score: Score, options: UnrollOptions = {}): UnrollResult {
  const maxSegments = options.maxSegments ?? DEFAULT_MAX_SEGMENTS;
  const segments: PlaybackSegment[] = [];
  const warnings: string[] = [];
  const repeatStack: RepeatFrame[] = [];
  const visits = new Map<number, number>();
  const directionState: DirectionState = {
    codaArmed: false,
    fineArmed: false,
    usedJumps: new Set()
  };
  const targetMap = buildDirectionTargetMap(score);
  let barIndex = 0;
  let totalTicks = 0;

  while (barIndex >= 0 && barIndex < score.masterBars.length) {
    if (segments.length >= maxSegments) {
      warnings.push(`Playback unroll stopped at ${maxSegments} segments to avoid an infinite direction loop.`);
      break;
    }

    const masterBar = score.masterBars[barIndex];
    const activeRepeat = repeatStack[repeatStack.length - 1] ?? null;
    const pass = activeRepeat?.pass ?? 1;

    if (masterBar.repeatOpen && activeRepeat?.startIndex !== barIndex) {
      repeatStack.push({ startIndex: barIndex, pass: 1 });
    }

    const repeatAfterOpen = repeatStack[repeatStack.length - 1] ?? null;
    const effectivePass = repeatAfterOpen?.pass ?? pass;
    const included = shouldPlayAlternateEnding(masterBar.alternateEndings, effectivePass);
    const visit = (visits.get(barIndex) ?? 0) + 1;
    visits.set(barIndex, visit);

    if (included) {
      const durationTicks = barTheoreticalTicks(masterBar);
      segments.push({
        sequenceIndex: segments.length,
        barIndex,
        startTick: totalTicks,
        durationTicks,
        pass: effectivePass,
        visit
      });
      totalTicks += durationTicks;
    }

    let nextBar = barIndex + 1;

    if (included || masterBar.alternateEndings === 0) {
      nextBar = applyRepeatClose(masterBar.repeatClose, barIndex, repeatStack, nextBar);
    }

    if (
      included &&
      masterBar.alternateEndings > 0 &&
      masterBar.repeatClose <= 0 &&
      repeatAfterOpen?.total !== undefined &&
      repeatAfterOpen.pass >= repeatAfterOpen.total
    ) {
      repeatStack.pop();
    }

    if (included) {
      const directionNext = applyDirections(
        score,
        barIndex,
        nextBar,
        directionState,
        targetMap,
        warnings
      );

      if (directionNext === "stop") {
        break;
      }

      nextBar = directionNext;
    }

    barIndex = nextBar;
  }

  return { segments, totalTicks, warnings };
}

function applyRepeatClose(
  repeatClose: number,
  barIndex: number,
  repeatStack: RepeatFrame[],
  defaultNext: number
): number {
  if (repeatClose <= 0) {
    return defaultNext;
  }

  const activeRepeat = repeatStack[repeatStack.length - 1];
  const totalPasses = Math.max(2, repeatClose);

  if (!activeRepeat) {
    repeatStack.push({ startIndex: 0, pass: 2, total: totalPasses });
    return totalPasses > 1 ? 0 : defaultNext;
  }

  activeRepeat.total = totalPasses;

  if (activeRepeat.pass < totalPasses) {
    activeRepeat.pass += 1;
    return activeRepeat.startIndex;
  }

  repeatStack.pop();
  void barIndex;
  return defaultNext;
}

function applyDirections(
  score: Score,
  barIndex: number,
  defaultNext: number,
  state: DirectionState,
  targets: Map<DirectionTarget, number[]>,
  warnings: string[]
): number | "stop" {
  const masterBar = score.masterBars[barIndex];

  if (state.fineArmed && masterBar.directionTargets.includes("Fine")) {
    return "stop";
  }

  if (state.codaArmed && hasCodaTarget(masterBar.directionTargets)) {
    const destination = firstTarget(targets, "Coda") ?? firstTarget(targets, "DoubleCoda");
    state.codaArmed = false;

    if (destination !== undefined && destination !== barIndex) {
      return destination;
    }
  }

  for (const jump of masterBar.directionJumps) {
    const key = `${barIndex}:${jump}`;

    if (jump === "AlCoda" || jump === "AlDoubleCoda") {
      state.codaArmed = true;
      continue;
    }

    if (jump === "AlFine") {
      state.fineArmed = true;
      continue;
    }

    if (state.usedJumps.has(key)) {
      continue;
    }

    state.usedJumps.add(key);

    if (jump === "DaCapo") {
      state.fineArmed = masterBar.directionJumps.includes("AlFine") || state.fineArmed;
      state.codaArmed = masterBar.directionJumps.includes("AlCoda") || state.codaArmed;
      return score.masterBars[0]?.anacrusis ? 1 : 0;
    }

    if (jump === "DalSegno" || jump === "DalSegnoSegno") {
      const target = jump === "DalSegno" ? "Segno" : "SegnoSegno";
      const destination = lastTarget(targets, target);

      if (destination !== undefined) {
        state.fineArmed = masterBar.directionJumps.includes("AlFine") || state.fineArmed;
        state.codaArmed = masterBar.directionJumps.includes("AlCoda") || state.codaArmed;
        return destination;
      }

      warnings.push(`${jump} at bar ${barIndex + 1} has no ${target} target.`);
    }

    if (jump === "DaCoda" || jump === "DaDoubleCoda") {
      const target = jump === "DaCoda" ? "Coda" : "DoubleCoda";
      const destination = firstTarget(targets, target);

      if (destination !== undefined) {
        return destination;
      }

      warnings.push(`${jump} at bar ${barIndex + 1} has no ${target} target.`);
    }
  }

  return defaultNext;
}

function shouldPlayAlternateEnding(mask: number, pass: number): boolean {
  return mask === 0 || (mask & (1 << (pass - 1))) !== 0;
}

function buildDirectionTargetMap(score: Score): Map<DirectionTarget, number[]> {
  const targets = new Map<DirectionTarget, number[]>();

  score.masterBars.forEach((masterBar, barIndex) => {
    masterBar.directionTargets.forEach((target) => {
      targets.set(target, [...(targets.get(target) ?? []), barIndex]);
    });
  });

  return targets;
}

function firstTarget(targets: Map<DirectionTarget, number[]>, target: DirectionTarget): number | undefined {
  return targets.get(target)?.[0];
}

function lastTarget(targets: Map<DirectionTarget, number[]>, target: DirectionTarget): number | undefined {
  const indexes = targets.get(target);
  return indexes?.[indexes.length - 1];
}

function hasCodaTarget(targets: DirectionTarget[]): boolean {
  return targets.includes("Coda") || targets.includes("DoubleCoda");
}
