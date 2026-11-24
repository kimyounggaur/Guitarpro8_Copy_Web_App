import type { HitKind } from "../layout/sceneGraph";
import type { Clef } from "../notation/staffPosition";
import type { Score } from "../../model/types";
import { normaliseCursor } from "./operations";
import type { CursorPosition } from "./types";

const clefs = new Set<unknown>(["treble", "treble8vb", "bass", "bass8vb", "percussion"]);

function isClef(value: unknown): value is Clef {
  return clefs.has(value);
}

export function cursorFromHit(
  score: Score,
  current: CursorPosition,
  kind: HitKind,
  ref: Record<string, unknown>,
  pageY?: number
): CursorPosition {
  const trackId = typeof ref.trackId === "string" ? ref.trackId : current.trackId;
  const barIndex = typeof ref.barIndex === "number" ? ref.barIndex : current.barIndex;
  const voiceIndex = typeof ref.voiceIndex === "number" ? ref.voiceIndex : current.voiceIndex;
  const beatIndex = typeof ref.beatIndex === "number" ? ref.beatIndex : current.beatIndex;
  const noteIndex = typeof ref.noteIndex === "number" ? ref.noteIndex : null;
  const track = score.tracks.find((candidate) => candidate.id === trackId);
  const note = noteIndex === null ? undefined : track?.bars[barIndex]?.voices[voiceIndex]?.beats[beatIndex]?.notes[noteIndex];
  const staffKind = ref.staffKind === "standard" || ref.staffKind === "tab" ? ref.staffKind : current.staffKind;

  let staffLine = typeof ref.staffLine === "number" ? ref.staffLine : current.staffLine;
  if (kind === "staffInput" && pageY !== undefined && typeof ref.staffTop === "number" && typeof ref.staffSpace === "number" && ref.staffSpace > 0) {
    staffLine = Math.round(8 - 2 * (pageY - ref.staffTop) / ref.staffSpace);
  }
  const staffClef = isClef(ref.staffClef) ? ref.staffClef : current.staffClef;

  return normaliseCursor(score, {
    ...current,
    trackId,
    barIndex,
    voiceIndex,
    beatIndex,
    string: note?.string ?? current.string,
    staffKind,
    staffLine,
    staffClef,
    writtenMidi: typeof ref.writtenMidi === "number" ? ref.writtenMidi : undefined
  });
}
