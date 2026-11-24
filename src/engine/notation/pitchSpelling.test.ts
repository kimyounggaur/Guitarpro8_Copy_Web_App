import { describe, expect, it } from "vitest";
import { keyFifths, keyFromFifths } from "../../model/keys";
import { midiForSpelledPitch, spellPitch, type PitchStep } from "./pitchSpelling";

describe("key signatures", () => {
  it("round trips all major signatures and the explicitly named minor tonics", () => {
    for (let fifths = -7; fifths <= 7; fifths += 1) {
      expect(keyFifths(keyFromFifths(fifths, "major"))).toBe(fifths);
      expect(keyFifths(keyFromFifths(fifths, "minor"))).toBe(fifths);
    }
    expect(keyFifths({ key: "C", mode: "minor" })).toBe(0);
    expect(keyFifths({ key: "Cm", mode: "minor" })).toBe(-3);
    expect(keyFifths({ key: "G♭", mode: "major" })).toBe(-6);
  });
});

describe("standard notation pitch spelling", () => {
  it.each<{
    midi: number;
    fifths: number;
    step: PitchStep;
    alter: -1 | 0 | 1;
    octave: number;
  }>([
    { midi: 61, fifths: 0, step: "C", alter: 1, octave: 4 },
    { midi: 70, fifths: -1, step: "B", alter: -1, octave: 4 },
    { midi: 66, fifths: -1, step: "G", alter: -1, octave: 4 },
    { midi: 63, fifths: 4, step: "D", alter: 1, octave: 4 },
    { midi: 71, fifths: -6, step: "C", alter: -1, octave: 5 },
    { midi: 72, fifths: 7, step: "B", alter: 1, octave: 4 },
    { midi: 65, fifths: 1, step: "F", alter: 0, octave: 4 }
  ])("spells $midi at $fifths fifths as $step with alteration $alter", ({ midi, fifths, step, alter, octave }) => {
    const pitch = spellPitch(midi, fifths);
    expect(pitch).toEqual({ step, alter, octave });
    expect(midiForSpelledPitch(pitch)).toBe(midi);
  });

  it("prefers the signature spelling for its own tones and honors a chromatic preference elsewhere", () => {
    expect(spellPitch(66, 1, "flat")).toMatchObject({ step: "F", alter: 1 });
    expect(spellPitch(61, 0, "flat")).toMatchObject({ step: "D", alter: -1 });
    expect(spellPitch(66, -1, "sharp")).toMatchObject({ step: "F", alter: 1 });
  });

  it("round trips written semitones including ottava offsets outside the MIDI byte range", () => {
    for (let midi = -24; midi <= 151; midi += 1) {
      for (let fifths = -7; fifths <= 7; fifths += 1) {
        expect(midiForSpelledPitch(spellPitch(midi, fifths))).toBe(midi);
      }
    }
  });
});
