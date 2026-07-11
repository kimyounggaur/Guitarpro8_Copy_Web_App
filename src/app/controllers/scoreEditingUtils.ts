// Pure score/cursor helpers shared by more than one controller (see
// docs/ui-remaster/00-component-map.md §1 for the original App.tsx line
// ranges these were extracted from). Kept dependency-free of React and of
// any controller so both useEditorController and useCommandController can
// import them without risking a circular import.
import { createBeat } from "../../model/factory";
import type { Score } from "../../model/types";
import type { CursorPosition, SelectionRange } from "../../engine/editing/types";

/**
 * Returns the beat at the cursor, growing the voice's beat list with empty
 * quarter-note beats if the cursor currently points past the end of it.
 * Mutates `score` in place (expected to be called inside a `transact`
 * recipe) and returns null when the cursor's track/bar/voice do not exist.
 */
export function ensureBeatAtCursor(score: Score, cursor: CursorPosition) {
  const track = score.tracks.find((candidate) => candidate.id === cursor.trackId);
  const voice = track?.bars[cursor.barIndex]?.voices[cursor.voiceIndex];

  if (!voice) {
    return null;
  }

  while (voice.beats.length <= cursor.beatIndex) {
    voice.beats.push(createBeat({ duration: 4 }));
  }

  return voice.beats[cursor.beatIndex];
}

/** Resolves the inclusive bar range implied by the current selection, or a
 * single-bar range at the cursor when there is no selection. */
export function selectedBarRange(
  score: Score,
  cursor: CursorPosition,
  selection: SelectionRange | null
): { start: number; end: number } {
  if (!selection) {
    return { start: cursor.barIndex, end: cursor.barIndex };
  }

  return {
    start: Math.max(0, Math.min(selection.anchor.barIndex, selection.head.barIndex)),
    end: Math.min(score.masterBars.length - 1, Math.max(selection.anchor.barIndex, selection.head.barIndex))
  };
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}
