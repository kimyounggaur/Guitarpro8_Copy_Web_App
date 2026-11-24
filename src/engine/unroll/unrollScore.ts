import { barTheoreticalTicks } from "../../model/derive";
import type { DirectionJump, DirectionTarget, MasterBar, Score } from "../../model/types";

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

interface RepeatSection {
  start: number;
  end: number;
  passes: number;
}

type MainJump = "DaCapo" | "DalSegno" | "DalSegnoSegno";
type ArmedCoda = "Coda" | "DoubleCoda" | null;

export function unrollScore(score: Score, options: UnrollOptions = {}): UnrollResult {
  const bars = score.masterBars;
  const masks = effectiveEndings(bars);
  const { starts, closes } = planRepeats(bars, masks);
  let maxPasses = 1;
  for (const repeat of closes.values()) maxPasses = Math.max(maxPasses, repeat.passes);
  const maxSegments = options.maxSegments ?? bars.length * maxPasses * 4;
  const stepLimit = bars.length * maxPasses * 8;
  const targets = directionTargets(bars);
  const hasDalSegno = bars.some((bar) => bar.directionJumps.includes("DalSegno"));

  const segments: PlaybackSegment[] = [];
  const warnings: string[] = [];
  const passBySection = new Map<RepeatSection, number>();
  const visits = new Map<number, number>();
  const usedJumps = new Set<string>();
  let jumped = false;
  let usedDalSegno = false;
  let coda: ArmedCoda = null;
  let fine = false;
  let barIndex = 0;
  let totalTicks = 0;
  let steps = 0;

  while (barIndex >= 0 && barIndex < bars.length) {
    if (++steps > stepLimit) {
      warnings.push(`Playback unroll stopped at ${segments.length} segments to avoid an infinite direction loop.`);
      break;
    }

    const bar = bars[barIndex];
    for (const section of passBySection.keys()) {
      if (barIndex < section.start || barIndex > section.end) passBySection.delete(section);
    }
    for (const section of starts.get(barIndex) ?? []) {
      if (!passBySection.has(section)) passBySection.set(section, jumped ? section.passes : 1);
    }

    // A direction may enter a repeat between its opening and closing marks.
    // On that pass, use the applicable final ending without repeating the body.
    const innermost = [...passBySection.keys()].pop() ?? (jumped ? enclosingSection(closes, barIndex) : undefined);
    const pass = innermost ? passBySection.get(innermost) ?? innermost.passes : 1;
    if (masks[barIndex] && (pass > 8 || (masks[barIndex] & (1 << (pass - 1))) === 0)) {
      barIndex++;
      continue;
    }

    if (segments.length >= maxSegments) {
      warnings.push(`Playback unroll stopped at ${segments.length} segments to avoid an infinite direction loop.`);
      break;
    }

    const visit = (visits.get(barIndex) ?? 0) + 1;
    visits.set(barIndex, visit);
    const durationTicks = barTheoreticalTicks(bar);
    segments.push({ sequenceIndex: segments.length, barIndex, startTick: totalTicks, durationTicks, pass, visit });
    totalTicks += durationTicks;

    if (fine && bar.directionTargets.includes("Fine")) break;
    if (coda && bar.directionJumps.includes(coda === "Coda" ? "DaCoda" : "DaDoubleCoda")) {
      const destination = targets.get(coda)?.find((target) => target > barIndex);
      if (destination !== undefined) {
        coda = null;
        passBySection.clear();
        barIndex = destination;
        continue;
      }
      warnings.push(`To ${coda} at bar ${barIndex + 1} has no following target.`);
      coda = null;
    }

    const repeat = closes.get(barIndex);
    const repeatPass = repeat ? passBySection.get(repeat) : undefined;
    if (!jumped && repeat && repeatPass !== undefined && repeatPass < repeat.passes) {
      passBySection.set(repeat, repeatPass + 1);
      for (const section of passBySection.keys()) {
        if (section !== repeat && section.start >= repeat.start && section.end < repeat.end) {
          passBySection.delete(section);
        }
      }
      barIndex = repeat.start;
      continue;
    }

    let destination: number | undefined;
    if (jumped || !innermost || pass >= innermost.passes) {
      for (const jump of bar.directionJumps) {
        if (!isMainJump(jump)) continue;
        if (jump === "DalSegnoSegno" && hasDalSegno && !usedDalSegno) continue;
        const key = `${barIndex}:${jump}`;
        if (usedJumps.has(key)) continue;
        usedJumps.add(key);

        if (jump === "DaCapo") {
          destination = bars[0]?.anacrusis && bars.length > 1 ? 1 : 0;
        } else {
          const target = jump === "DalSegno" ? "Segno" : "SegnoSegno";
          const candidates = targets.get(target) ?? [];
          destination = candidates.filter((index) => index < barIndex).pop() ?? candidates[0];
          if (destination === undefined) warnings.push(`${jump} at bar ${barIndex + 1} has no ${target} target.`);
        }

        if (destination === undefined) continue;
        usedDalSegno ||= jump === "DalSegno";
        jumped = true;
        fine = bar.directionJumps.includes("AlFine");
        coda = bar.directionJumps.includes("AlDoubleCoda") ? "DoubleCoda"
          : bar.directionJumps.includes("AlCoda") ? "Coda" : null;
        passBySection.clear();
        break;
      }
    }

    barIndex = destination ?? barIndex + 1;
  }
  return { segments, totalTicks, warnings };
}

function effectiveEndings(bars: MasterBar[]): number[] {
  const endings: number[] = [];
  bars.forEach((bar, index) => {
    const previous = index > 0 && !bars[index - 1].repeatClose && !bar.repeatOpen
      ? endings[index - 1]
      : 0;
    endings.push(bar.alternateEndings || previous);
  });
  return endings;
}

function planRepeats(bars: MasterBar[], masks: number[]) {
  const open: number[] = [];
  const closes = new Map<number, RepeatSection>();
  const sections: RepeatSection[] = [];
  let recentStart = 0;
  let previousClose: { index: number; section: RepeatSection } | undefined;

  bars.forEach((bar, index) => {
    if (bar.repeatOpen) {
      open.push(index);
      previousClose = undefined;
    }
    if (bar.repeatClose < 1) {
      if (!masks[index]) previousClose = undefined;
      return;
    }

    const sharesEnding = previousClose && masks[index] !== 0 && masks[previousClose.index] !== 0;
    const passes = Math.floor(bar.repeatClose);
    const section = sharesEnding && previousClose
      ? previousClose.section
      : { start: open.pop() ?? recentStart, end: index, passes };
    if (!sharesEnding) sections.push(section);
    section.end = index;
    section.passes = Math.max(section.passes, passes);
    closes.set(index, section);
    recentStart = section.start;
    previousClose = { index, section };
  });

  const starts = new Map<number, RepeatSection[]>();
  for (const section of sections) {
    // A final numbered ending can continue after that repeat's last close.
    while (masks[section.end + 1] && !bars[section.end + 1].repeatOpen && !closes.has(section.end + 1)) {
      section.end++;
    }
    const atStart = starts.get(section.start) ?? [];
    atStart.push(section);
    starts.set(section.start, atStart);
  }
  for (const atStart of starts.values()) atStart.sort((a, b) => b.end - a.end);

  return { starts, closes };
}

function enclosingSection(closes: Map<number, RepeatSection>, barIndex: number): RepeatSection | undefined {
  let enclosing: RepeatSection | undefined;
  for (const section of closes.values()) {
    if (section.start <= barIndex && barIndex <= section.end && (!enclosing || section.start >= enclosing.start)) {
      enclosing = section;
    }
  }
  return enclosing;
}

function isMainJump(jump: DirectionJump): jump is MainJump {
  return jump === "DaCapo" || jump === "DalSegno" || jump === "DalSegnoSegno";
}

function directionTargets(bars: MasterBar[]): Map<DirectionTarget, number[]> {
  const targets = new Map<DirectionTarget, number[]>();
  bars.forEach((bar, index) => {
    for (const name of bar.directionTargets) {
      const positions = targets.get(name) ?? [];
      positions.push(index);
      targets.set(name, positions);
    }
  });
  return targets;
}
