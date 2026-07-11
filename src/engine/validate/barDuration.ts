import { barTheoreticalTicks, beatDurationTicks } from "../../model/derive";
import type { Score } from "../../model/types";

export interface BarDurationIssue {
  trackId: string;
  barIndex: number;
  voiceIndex: number;
  actual: number;
  expected: number;
}

export function validateBarDurations(score: Score): BarDurationIssue[] {
  const issues: BarDurationIssue[] = [];

  for (const track of score.tracks) {
    track.bars.forEach((bar, barIndex) => {
      const masterBar = score.masterBars[barIndex];

      if (!masterBar || isAnacrusisExempt(score, barIndex)) {
        return;
      }

      const expected = barTheoreticalTicks(masterBar);

      bar.voices.forEach((voice, voiceIndex) => {
        if (voice.beats.length === 0) {
          return;
        }

        const actual = voice.beats.reduce(
          (total, beat) => total + beatDurationTicks(beat),
          0
        );

        if (!nearlyEqual(actual, expected)) {
          issues.push({
            trackId: track.id,
            barIndex,
            voiceIndex,
            actual,
            expected
          });
        }
      });
    });
  }

  return issues;
}

function isAnacrusisExempt(score: Score, barIndex: number): boolean {
  const lastBarIndex = score.masterBars.length - 1;
  const hasAnacrusis =
    score.masterBars[0]?.anacrusis || score.masterBars[lastBarIndex]?.anacrusis;

  return Boolean(hasAnacrusis && (barIndex === 0 || barIndex === lastBarIndex));
}

function nearlyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) < 0.00001;
}
