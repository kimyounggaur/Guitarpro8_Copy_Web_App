import { DEFAULT_MAX_FRET } from "./invariants";
import { frettedMidiPitch } from "./trackKind";
import type { Tuning } from "./types";

interface Placement {
  string: number;
  fret: number;
}

interface FingeringTarget {
  midi: number | null;
  preferredString?: number;
  maximumFret?: number;
  fallback?: Placement;
}

interface FingeringResult extends Placement {
  matched: boolean;
}

interface Candidate {
  result: FingeringResult | null;
  usedString: number;
  cost: number;
}

export function assignFingerings(
  tuning: Tuning,
  targets: ReadonlyArray<FingeringTarget>,
  previousFret = 0,
  distanceWeight = 0.5
): Array<FingeringResult | null> {
  const candidates = targets.map((target) => candidatesForTarget(tuning, target, previousFret, distanceWeight));
  const cheapestByState = new Map<number, number>();
  const working: Array<FingeringResult | null> = [];
  const maskSize = 1 << tuning.strings.length;
  let bestCost = Infinity;
  let best: Array<FingeringResult | null> = [];

  function search(index: number, usedStrings: number, cost: number): void {
    const state = index * maskSize + usedStrings;
    if (cost >= bestCost || cost >= (cheapestByState.get(state) ?? Infinity)) return;
    cheapestByState.set(state, cost);
    if (index === targets.length) {
      best = [...working];
      bestCost = cost;
      return;
    }

    for (const candidate of candidates[index]) {
      if (usedStrings & candidate.usedString) continue;
      working[index] = candidate.result;
      search(index + 1, usedStrings | candidate.usedString, cost + candidate.cost);
    }
  }

  search(0, 0, 0);
  return best.length === targets.length ? best : targets.map(() => null);
}

export function handPosition(notes: ReadonlyArray<Placement>): number {
  return notes.reduce((lowest, { fret }) => fret > 0 && (lowest === 0 || fret < lowest) ? fret : lowest, 0);
}

function candidatesForTarget(tuning: Tuning, target: FingeringTarget, previousFret: number, distanceWeight: number): Candidate[] {
  const candidates: Candidate[] = [];
  if (target.midi !== null) {
    for (let string = 1; string <= tuning.strings.length; string += 1) {
      const open = frettedMidiPitch(tuning, string, 0);
      if (open === null) continue;
      const fret = target.midi - open;
      if (!Number.isInteger(fret) || fret < 0 || fret > (target.maximumFret ?? DEFAULT_MAX_FRET)) continue;
      const moved = target.preferredString !== undefined && target.preferredString !== string;
      candidates.push({
        result: { string, fret, matched: true },
        usedString: 1 << (string - 1),
        cost: (moved ? 10_000 : 0) + fret + Math.abs(fret - previousFret) * distanceWeight
      });
    }
  }
  candidates.sort((left, right) => left.cost - right.cost);
  const fallback = target.fallback;
  candidates.push({
    result: fallback ? { string: fallback.string, fret: fallback.fret, matched: false } : null,
    usedString: fallback ? 1 << (fallback.string - 1) : 0,
    cost: 100_000
  });
  return candidates;
}
