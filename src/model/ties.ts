import { noteTieIdentity } from "./trackKind";
import type { InvariantIssue } from "./invariants";
import type { Bar, Beat, NoteRef, Score, Track } from "./types";

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
  const identity = noteTieIdentity(note, track);
  const noteIndex = previous.beat.notes.findIndex((candidate) => noteTieIdentity(candidate, track) === identity);
  return noteIndex < 0 ? null : {
    ...path,
    barIndex: previous.barIndex,
    beatIndex: previous.beatIndex,
    noteIndex
  };
}

interface TieRepair {
  trackIndex: number;
  path: NotePath;
  fret?: number;
  issue?: InvariantIssue;
}

// Only the immutable editor transaction path can reuse a previous scan.
const barsWithoutTies = new WeakSet<Bar>();

export function inspectTies(score: Score, immutable = false): TieRepair[] {
  const repairs: TieRepair[] = [];
  const correctedFrets = new Map<object, number>();
  score.tracks.forEach((track, trackIndex) => {
    track.bars.forEach((bar, barIndex) => {
      if (immutable && barsWithoutTies.has(bar)) return;

      let hasTies = false;
      bar.voices.forEach((voice, voiceIndex) => {
        voice.beats.forEach((beat, beatIndex) => {
          beat.notes.forEach((note, noteIndex) => {
            if (!note.tiedFromPrevious) return;
            hasTies = true;
            const location = { trackId: track.id, barIndex, voiceIndex, beatIndex };
            const path = { ...location, noteIndex };
            const origin = findTrackTieOrigin(track, path);
            if (!origin) {
              repairs.push({ trackIndex, path, issue: {
                code: "tie-orphan",
                severity: "warning",
                message: "A tie has no preceding note on the same string and was removed.",
                location
              } });
            } else if (track.kind === "stringed") {
              const predecessor = track.bars[origin.barIndex].voices[origin.voiceIndex].beats[origin.beatIndex].notes[origin.noteIndex];
              const fret = correctedFrets.get(predecessor) ?? predecessor.fret;
              if (fret !== note.fret) {
                correctedFrets.set(note, fret);
                repairs.push({ trackIndex, path, fret });
              }
            }
          });
        });
      });
      if (immutable && !hasTies) barsWithoutTies.add(bar);
    });
  });
  return repairs;
}

export function applyTieRepairs(score: Score, repairs: TieRepair[]): void {
  for (const { trackIndex, path, fret, issue } of repairs) {
    const note = score.tracks[trackIndex].bars[path.barIndex].voices[path.voiceIndex]
      .beats[path.beatIndex].notes[path.noteIndex];
    if (issue) delete note.tiedFromPrevious;
    else if (fret !== undefined) note.fret = fret;
  }
}

export function normalizeTies(score: Score): InvariantIssue[] {
  const repairs = inspectTies(score);
  applyTieRepairs(score, repairs);
  return repairs.flatMap(({ issue }) => issue ? [issue] : []);
}
