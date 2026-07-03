import { describe, expect, it } from "vitest";
import { createBeat, createEmptyScore, createNote, createTrack } from "./factory";
import { enumerateChordVoicings, parseChordSymbol } from "./chords";
import { SCALE_DEFINITIONS, matchScalesFromPitchClasses, searchScales } from "./scales";
import { detectPitchFromBuffer, nearestTuningTarget } from "./tuner";
import { transposeScore, semitonesForOptions, type TransposeOptions } from "../engine/tools/transpose";

describe("Phase 9 tool engines", () => {
  it("parses chord names and enumerates tuning-aware voicings", () => {
    const track = createTrack(undefined, 1);
    const chord = parseChordSymbol("F#m7b5");

    expect(chord?.rootName).toBe("F#");
    expect(chord?.quality).toBe("m7b5");

    const voicings = enumerateChordVoicings(track.tuning, chord!, { limit: 8, maxFret: 12 });

    expect(voicings.length).toBeGreaterThan(0);
    expect(voicings[0].notes.length).toBeGreaterThanOrEqual(3);
  });

  it("provides a large searchable scale catalog and selection matching", () => {
    expect(SCALE_DEFINITIONS.length).toBeGreaterThanOrEqual(200);
    expect(searchScales({ query: "blues" }).some((scale) => scale.name.toLowerCase().includes("blues"))).toBe(true);

    const matches = matchScalesFromPitchClasses([0, 2, 4, 5, 7, 9, 11], 0, 3);

    expect(matches[0].matchPercent).toBe(100);
  });

  it("detects a sine-wave tuner pitch near A2", () => {
    const sampleRate = 44100;
    const samples = new Float32Array(2048);
    const track = createTrack(undefined, 1);

    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.sin((Math.PI * 2 * 110 * index) / sampleRate) * 0.8;
    }

    const pitch = detectPitchFromBuffer(samples, sampleRate);
    const target = pitch ? nearestTuningTarget(track.tuning, pitch.frequency) : null;

    expect(pitch?.frequency).toBeCloseTo(110, 0);
    expect(target?.noteName).toBe("A2");
  });

  it("applies semitone, chromatic, and diatonic transposition differently", () => {
    const score = createEmptyScore();
    score.tracks = [createTrack(undefined, 1)];
    score.tracks[0].bars[0].voices[0].beats = [
      createBeat({ duration: 4, rest: false, notes: [createNote(1, 3)], chordId: "C" })
    ];
    const cursor = {
      trackId: score.tracks[0].id,
      barIndex: 0,
      voiceIndex: 0,
      beatIndex: 0,
      string: 1,
      staffLine: 0,
      staffKind: "tab" as const
    };
    const base: TransposeOptions = {
      range: "selection",
      target: "currentTrack",
      mode: "semitones",
      semitones: 1,
      chromaticInterval: 3,
      chromaticQuality: "minor",
      chromaticDirection: "up",
      chromaticOctaves: 0,
      diatonicSteps: 2,
      includeChordNames: true
    };

    expect(semitonesForOptions({ ...base, mode: "semitones", semitones: 1 })).toBe(1);
    expect(semitonesForOptions({ ...base, mode: "chromatic" })).toBe(3);
    expect(semitonesForOptions({ ...base, mode: "diatonic" })).toBe(4);

    transposeScore(score, cursor, null, { ...base, mode: "chromatic" });

    expect(score.tracks[0].bars[0].voices[0].beats[0].notes[0].fret).toBe(6);
    expect(score.tracks[0].bars[0].voices[0].beats[0].chordId).toBe("D#");
  });
});
