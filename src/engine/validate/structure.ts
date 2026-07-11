import { MAX_STRING_COUNT, MIN_STRING_COUNT, VOICES_PER_BAR, type Score } from "../../model/types";

export type StructureIssueType =
  | "bar-count-mismatch"
  | "voice-count-invalid"
  | "simile-invalid"
  | "tuning-string-count-invalid"
  | "tempo-automation-scope-invalid"
  | "duplicate-grace-note-string";

export interface StructureIssue {
  type: StructureIssueType;
  trackId?: string;
  barIndex?: number;
  voiceIndex?: number;
  message: string;
}

export function validateStructure(score: Score): StructureIssue[] {
  const issues: StructureIssue[] = [];
  validateTrackBarCounts(score, issues);
  validateSimileMarks(score, issues);
  validateTrackDetails(score, issues);
  validateTempoAutomations(score, issues);
  return issues;
}

function validateTrackBarCounts(score: Score, issues: StructureIssue[]): void {
  for (const track of score.tracks) {
    if (track.bars.length !== score.masterBars.length) {
      issues.push({
        type: "bar-count-mismatch",
        trackId: track.id,
        message: "Track bar count must match master bar count"
      });
    }
  }
}

function validateSimileMarks(score: Score, issues: StructureIssue[]): void {
  score.masterBars.forEach((masterBar, barIndex) => {
    if (masterBar.simileMark === "single" && barIndex === 0) {
      issues.push({
        type: "simile-invalid",
        barIndex,
        message: "Single-bar simile is not allowed on the first bar"
      });
    }

    if (masterBar.simileMark === "double" && barIndex < 2) {
      issues.push({
        type: "simile-invalid",
        barIndex,
        message: "Double-bar simile is not allowed on bars 1 or 2"
      });
    }
  });
}

function validateTrackDetails(score: Score, issues: StructureIssue[]): void {
  for (const track of score.tracks) {
    if (
      track.tuning.strings.length < MIN_STRING_COUNT ||
      track.tuning.strings.length > MAX_STRING_COUNT
    ) {
      issues.push({
        type: "tuning-string-count-invalid",
        trackId: track.id,
        message: "Tuning must contain 3 to 10 strings"
      });
    }

    track.bars.forEach((bar, barIndex) => {
      if (bar.voices.length !== VOICES_PER_BAR) {
        issues.push({
          type: "voice-count-invalid",
          trackId: track.id,
          barIndex,
          message: "Each bar must contain exactly four voices"
        });
      }

      bar.voices.forEach((voice, voiceIndex) => {
        voice.beats.forEach((beat) => {
          const graceStrings = new Set<number>();

          for (const graceNote of beat.graceNotes) {
            if (graceStrings.has(graceNote.string)) {
              issues.push({
                type: "duplicate-grace-note-string",
                trackId: track.id,
                barIndex,
                voiceIndex,
                message: "Only one grace note per string is allowed on a beat"
              });
            }

            graceStrings.add(graceNote.string);
          }
        });
      });
    });
  }
}

function validateTempoAutomations(score: Score, issues: StructureIssue[]): void {
  for (const automation of score.masterAutomations) {
    if (automation.type === "tempo" && automation.scope !== "master") {
      issues.push({
        type: "tempo-automation-scope-invalid",
        message: "Tempo automation must use master scope"
      });
    }
  }

  for (const track of score.tracks) {
    for (const automation of track.automations) {
      if (automation.type === "tempo") {
        issues.push({
          type: "tempo-automation-scope-invalid",
          trackId: track.id,
          message: "Tempo automation cannot be stored on a track"
        });
      }
    }
  }
}
