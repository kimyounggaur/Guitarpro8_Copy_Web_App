import type { HitKind } from "../layout/sceneGraph";
import type { Score } from "../../model/types";
import { normaliseCursor } from "./operations";
import type { CursorPosition } from "./types";

export function cursorFromHit(
  score: Score,
  current: CursorPosition,
  kind: HitKind,
  ref: Record<string, unknown>
): CursorPosition {
  const trackId = typeof ref.trackId === "string" ? ref.trackId : current.trackId;
  const barIndex = typeof ref.barIndex === "number" ? ref.barIndex : current.barIndex;
  const voiceIndex = typeof ref.voiceIndex === "number" ? ref.voiceIndex : current.voiceIndex;
  const beatIndex = typeof ref.beatIndex === "number" ? ref.beatIndex : current.beatIndex;
  const noteIndex = typeof ref.noteIndex === "number" ? ref.noteIndex : null;
  const track = score.tracks.find((candidate) => candidate.id === trackId);
  const note =
    noteIndex === null
      ? null
      : track?.bars[barIndex]?.voices[voiceIndex]?.beats[beatIndex]?.notes[noteIndex] ?? null;

  return normaliseCursor(score, {
    ...current,
    trackId,
    barIndex,
    voiceIndex,
    beatIndex,
    string: note?.string ?? current.string,
    staffKind: kind === "note" ? current.staffKind : current.staffKind
  });
}
