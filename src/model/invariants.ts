import { isMidiPitch } from "./trackKind";
import { validateBarDurations } from "../engine/validate/barDuration";
import { barTheoreticalTicks } from "./derive";
import type { Score, Tuplet } from "./types";

export type InvariantSeverity = "fatal" | "warning";

export interface InvariantIssue {
  code: string;
  severity: InvariantSeverity;
  message: string;
  location?: { trackId?: string; barIndex?: number; voiceIndex?: number; beatIndex?: number };
}

const durations = new Set<number>([1, 2, 4, 8, 16, 32, 64]);
const dots = new Set<number>([0, 1, 2]);
export const DEFAULT_MAX_FRET = 24;

export function checkInvariants(score: Score): InvariantIssue[] {
  const issues: InvariantIssue[] = [];
  const trackIds = new Set<string>();
  const scoreTicks = score.masterBars.reduce((total, bar) => total + barTheoreticalTicks(bar), 0);

  for (const track of score.tracks) {
    const trackId = track.id;
    if (!trackId.trim() || trackIds.has(trackId)) {
      issues.push({ code: "track-id-unique", severity: "fatal", message: "트랙 ID가 비어 있거나 중복됩니다.", location: { trackId } });
    }
    trackIds.add(trackId);

    if (track.bars.length !== score.masterBars.length) {
      issues.push({ code: "bars-count", severity: "fatal", message: "트랙의 마디 수가 곡의 마디 수와 다릅니다.", location: { trackId } });
    }

    track.bars.forEach((bar, barIndex) => {
      if (bar.voices.length !== 4) {
        issues.push({ code: "voices-count", severity: "fatal", message: "한 마디에는 네 성부가 필요합니다.", location: { trackId, barIndex } });
      }

      bar.voices.forEach((voice, voiceIndex) => {
        voice.beats.forEach((beat, beatIndex) => {
          const location = { trackId, barIndex, voiceIndex, beatIndex };
          if (!durations.has(beat.duration) || !dots.has(beat.dots) || !validTuplet(beat.tuplet)) {
            issues.push({ code: "duration-valid", severity: "fatal", message: "올바른 음 길이, 점 또는 잇단음 값이 필요합니다.", location });
          }

          if (track.kind !== "stringed") {
            const isDrum = track.kind === "percussion";
            if (beat.notes.some((note) => !isMidiPitch(isDrum ? note.midiNumber : note.midiPitch))) {
              issues.push({
                code: isDrum ? "drum-midi" : "pitched-midi",
                severity: "fatal",
                message: isDrum ? "타악기 음에 올바른 MIDI 번호가 필요합니다." : "음표에 올바른 MIDI 음높이가 필요합니다.",
                location
              });
            }
            return;
          }

          const usedStrings = new Set<number>();
          for (const note of beat.notes) {
            if (!Number.isInteger(note.string) || note.string < 1 || note.string > track.tuning.strings.length) {
              issues.push({ code: "string-range", severity: "fatal", message: "악기의 줄 수를 벗어난 음이 있습니다.", location });
            }
            if (!Number.isInteger(note.fret) || note.fret < 0 || note.fret > DEFAULT_MAX_FRET) {
              issues.push({ code: "fret-range", severity: "fatal", message: "악기의 프렛 범위를 벗어난 음이 있습니다.", location });
            }
            if (usedStrings.has(note.string)) {
              issues.push({ code: "string-collision", severity: "fatal", message: "한 박의 같은 줄에 여러 음이 있습니다.", location });
            }
            usedStrings.add(note.string);
          }
        });
      });
    });

    for (const automation of track.automations) {
      if (automation.points.some(({ tick }) => !Number.isFinite(tick) || tick < 0 || tick > scoreTicks)) {
        issues.push({ code: "automation-range", severity: "warning", message: "트랙 자동화가 곡의 길이를 벗어났습니다.", location: { trackId } });
      }
    }
  }

  for (const automation of score.masterAutomations) {
    if (automation.points.some(({ tick }) => !Number.isFinite(tick) || tick < 0 || tick > scoreTicks)) {
      issues.push({ code: "automation-range", severity: "warning", message: "곡 자동화가 곡의 길이를 벗어났습니다." });
    }
  }

  if (!issues.some(({ code }) => code === "duration-valid")) {
    for (const { trackId, barIndex, voiceIndex } of validateBarDurations(score)) {
      issues.push({ code: "bar-length", severity: "warning", message: "박자표와 마디의 음 길이 합계가 다릅니다.", location: { trackId, barIndex, voiceIndex } });
    }
  }

  return issues;
}

function validTuplet(tuplet: Tuplet | undefined): boolean {
  const seen = new Set<Tuplet>();
  while (tuplet) {
    if (seen.has(tuplet) || !Number.isInteger(tuplet.n) || tuplet.n < 1 || !Number.isInteger(tuplet.m) || tuplet.m < 1) {
      return false;
    }
    seen.add(tuplet);
    tuplet = tuplet.parent;
  }
  return true;
}
