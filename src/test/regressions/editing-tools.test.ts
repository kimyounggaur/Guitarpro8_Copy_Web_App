import { expect, it } from "vitest";
import { defaultCursor } from "../../engine/editing/operations";
import { transposeScore } from "../../engine/tools/transpose";
import { parseChordSymbol } from "../../model/chords";
import { noteMidiPitch } from "../../model/derive";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { retuneTrack } from "../../model/instruments";
import { SCALE_DEFINITIONS } from "../../model/scales";
import { centsBetween, detectPitchFromBuffer, midiToFrequency } from "../../model/tuner";
import { useDocumentStore } from "../../store/documentStore";

it("[B6] Am is the minor triad A, C, E", () => {
  expect(parseChordSymbol("Am")?.pitchClasses).toEqual([0, 4, 9]);
});

it("[B7] the scale catalogue has one entry for each unique pitch set", () => {
  const signatures = SCALE_DEFINITIONS.map(({ intervals }) => [...new Set(intervals.map((n) => n % 12))]
    .sort((a, b) => a - b).join(","));
  expect(new Set(signatures).size).toBe(signatures.length);
});

it("[B8] an open Em voicing transposes down a tone by changing strings", () => {
  const score = createEmptyScore();
  const track = createTrack();
  score.tracks = [track];
  const notes = [createNote(3, 0), createNote(2, 0), createNote(1, 0)];
  track.bars[0].voices[0].beats = [createBeat({ duration: 1, rest: false, notes, chordId: "Em" })];

  transposeScore(score, defaultCursor(score), null, {
    range: "allBars",
    target: "currentTrack",
    mode: "semitones",
    semitones: -2,
    chromaticInterval: 2,
    chromaticQuality: "major",
    chromaticDirection: "down",
    chromaticOctaves: 0,
    diatonicSteps: 1,
    includeChordNames: true
  });

  const result = track.bars[0].voices[0].beats[0];
  expect(result.notes.map((note) => noteMidiPitch(note, track)).sort((a, b) => a - b)).toEqual([53, 57, 62]);
  expect(new Set(result.notes.map((note) => note.string)).size).toBe(3);
  expect(result.chordId).toBe("Dm");
});

it("[B9] reapplying the same tuning keeps the player's chosen fingering", () => {
  const track = createTrack();
  track.bars[0].voices[0].beats = [
    createBeat({ duration: 1, rest: false, notes: [createNote(2, 5), createNote(1, 0)] })
  ];
  const before = structuredClone(track);
  retuneTrack(track, structuredClone(track.tuning), "adjust-fingering");
  expect(track).toEqual(before);
});

it("[B18] an edit in a 100-bar, 8-track score retains untouched bar objects", () => {
  const score = createEmptyScore();
  score.masterBars = Array.from({ length: 100 }, createMasterBar);
  score.tracks = Array.from({ length: 8 }, () => createTrack(undefined, 100));
  const baselineStore = useDocumentStore.getState();

  try {
    baselineStore.loadScore(score);
    const before = useDocumentStore.getState().score;
    const after = baselineStore.transact("Enter note", (draft) => {
      draft.tracks[0].bars[0].voices[0].beats = [
        createBeat({ duration: 1, rest: false, notes: [createNote(1, 5)] })
      ];
    });

    expect(after.tracks[0].bars[0]).not.toBe(before.tracks[0].bars[0]);
    expect(after.tracks[0].bars[99]).toBe(before.tracks[0].bars[99]);
    expect(after.tracks[7]).toBe(before.tracks[7]);
  } finally {
    useDocumentStore.setState(baselineStore);
  }
});

it("[B19] the tuner detects low B0 with harmonics within two cents", () => {
  const sampleRate = 48_000;
  const frequency = midiToFrequency(23);
  const samples = Float32Array.from({ length: 4_096 }, (_, index) => {
    const phase = 2 * Math.PI * frequency * index / sampleRate;
    return 0.5 * Math.sin(phase) + 0.15 * Math.sin(2 * phase) + 0.08 * Math.sin(3 * phase);
  });

  const detected = detectPitchFromBuffer(samples, sampleRate);
  expect(detected?.midi).toBe(23);
  expect(Math.abs(centsBetween(detected?.frequency ?? 0, frequency))).toBeLessThanOrEqual(2);
});
