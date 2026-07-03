import { barTheoreticalTicks, beatDurationTicks } from "../../model/derive";
import type { Score } from "../../model/types";

export interface BarDurationIssue {
  trackId: string;
  trackName: string;
  barIndex: number;
  voiceIndex: number;
  expectedTicks: number;
  actualTicks: number;
  deltaTicks: number;
}

export function checkBarDurations(score: Score): BarDurationIssue[] {
  const issues: BarDurationIssue[] = [];

  score.tracks.forEach((track) => {
    track.bars.forEach((bar, barIndex) => {
      const masterBar = score.masterBars[barIndex];
      const expectedTicks = masterBar ? barTheoreticalTicks(masterBar) : 0;

      bar.voices.forEach((voice, voiceIndex) => {
        if (voice.beats.length === 0) {
          return;
        }

        const actualTicks = voice.beats.reduce((sum, beat) => sum + beatDurationTicks(beat), 0);

        if (Math.round(actualTicks) !== Math.round(expectedTicks)) {
          issues.push({
            trackId: track.id,
            trackName: track.shortName || track.name,
            barIndex,
            voiceIndex,
            expectedTicks,
            actualTicks,
            deltaTicks: actualTicks - expectedTicks
          });
        }
      });
    });
  });

  return issues;
}
