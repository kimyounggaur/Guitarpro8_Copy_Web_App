import { expect, it } from "vitest";
import { createBeat, createEmptyScore, createNote, createTrack } from "../../model/factory";
import { trackNoteMidiPitch } from "../../model/trackKind";
import { defaultCursor } from "../editing/operations";
import { transposeScore, type TransposeOptions } from "./transpose";

const base: TransposeOptions = {
  range: "allBars", target: "currentTrack", mode: "semitones", semitones: -2,
  chromaticInterval: 2, chromaticQuality: "major", chromaticDirection: "down", chromaticOctaves: 0,
  diatonicSteps: 2, includeChordNames: true
};

it("[B8] reports a note below the tuning and transposes the other notes without string collisions", () => {
  const score = createEmptyScore();
  const track = createTrack();
  score.tracks = [track];
  const beat = createBeat({
    rest: false, chordId: "Em", notes: [createNote(6, 0), createNote(3, 0), createNote(2, 0), createNote(1, 0)]
  });
  track.bars[0].voices[0].beats = [beat];

  expect(transposeScore(score, defaultCursor(score), null, base)).toBe(1);
  expect(beat.notes.map((note) => trackNoteMidiPitch(note, track))).toEqual([40, 53, 57, 62]);
  expect(new Set(beat.notes.map((note) => note.string)).size).toBe(4);
  expect(beat.chordId).toBe("Dm");
});

it("[B8] moves E to G by two diatonic degrees in C major", () => {
  const score = createEmptyScore();
  const track = createTrack();
  score.tracks = [track];
  const beat = createBeat({ rest: false, notes: [createNote(1, 0)], chordId: "Em" });
  track.bars[0].voices[0].beats = [beat];
  expect(transposeScore(score, defaultCursor(score), null, { ...base, mode: "diatonic" })).toBe(0);
  expect(trackNoteMidiPitch(beat.notes[0], track)).toBe(67);
  expect(beat.chordId).toBe("Gm");
});

it("[B8] preserves the chromatic alteration during a diatonic transposition", () => {
  const score = createEmptyScore();
  score.masterBars[0].keySignature = { key: "G", mode: "major" };
  const track = createTrack();
  score.tracks = [track];
  const beat = createBeat({ rest: false, notes: [createNote(1, 1)] }); // F natural against F sharp.
  track.bars[0].voices[0].beats = [beat];
  transposeScore(score, defaultCursor(score), null, { ...base, mode: "diatonic", diatonicSteps: 1 });
  expect(trackNoteMidiPitch(beat.notes[0], track)).toBe(66); // G flat against G natural.
});

it("[B8] can transpose the master key signature with all tracks", () => {
  const score = createEmptyScore();
  score.tracks = [createTrack()];
  score.masterBars[0].keySignature = { key: "Am", mode: "minor" };
  transposeScore(score, defaultCursor(score), null, { ...base, target: "allTracks", semitones: 2, includeKeySignatures: true });
  expect(score.masterBars[0].keySignature).toEqual({ key: "Bm", mode: "minor" });
});
