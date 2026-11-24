import type { InvariantIssue } from "./invariants";
import type { Beat, NoteRef, Score, Track } from "./types";

export type NotePath = NoteRef;

type BeatPath = Pick<NotePath, "barIndex" | "voiceIndex" | "beatIndex">;

export function previousTieBeat(track: Track, path: BeatPath): { barIndex: number; beatIndex: number; beat: Beat } | null {
  const barIndex = path.beatIndex === 0 ? path.barIndex - 1 : path.barIndex;
  const beats = track.bars[barIndex]?.voices[path.voiceIndex]?.beats;
  const beatIndex = path.beatIndex === 0 ? (beats?.length ?? 0) - 1 : path.beatIndex - 1;
  const beat = beats?.[beatIndex];
  return beat && !beat.rest ? { barIndex, beatIndex, beat } : null;
}

export function findTieOrigin(score: Score, path: NotePath): NotePath | null {
  const track = score.tracks.find(({ id }) => id === path.trackId);
  return track ? findTrackTieOrigin(track, path) : null;
}

export function findTrackTieOrigin(track: Track, path: NotePath): NotePath | null {
  const destination = track.bars[path.barIndex]?.voices[path.voiceIndex]?.beats[path.beatIndex];
  const note = destination?.notes[path.noteIndex];
  if (path.trackId !== track.id || !destination || destination.rest || !note) return null;
  const previous = previousTieBeat(track, path);
  if (!previous) return null;
  const noteIndex = previous.beat.notes.findIndex(({ string }) => string === note.string);
  return noteIndex < 0 ? null : {
    ...path,
    barIndex: previous.barIndex,
    beatIndex: previous.beatIndex,
    noteIndex
  };
}

export function normalizeTies(score: Score): InvariantIssue[] {
  const warnings: InvariantIssue[] = [];
  for (const track of score.tracks) {
    track.bars.forEach((bar, barIndex) => {
      bar.voices.forEach((voice, voiceIndex) => {
        voice.beats.forEach((beat, beatIndex) => {
          beat.notes.forEach((note, noteIndex) => {
            if (!note.tiedFromPrevious) return;
            const location = { trackId: track.id, barIndex, voiceIndex, beatIndex };
            const origin = findTrackTieOrigin(track, { ...location, noteIndex });
            if (origin) {
              note.fret = track.bars[origin.barIndex].voices[origin.voiceIndex].beats[origin.beatIndex].notes[origin.noteIndex].fret;
            } else {
              delete note.tiedFromPrevious;
              warnings.push({
                code: "tie-orphan",
                severity: "warning",
                message: "A tie has no preceding note on the same string and was removed.",
                location
              });
            }
          });
        });
      });
    });
  }
  return warnings;
}
