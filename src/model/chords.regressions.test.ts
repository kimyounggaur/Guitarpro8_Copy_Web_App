import { expect, it } from "vitest";
import { enumerateChordVoicings, parseChordSymbol, transposeChordSymbol } from "./chords";
import { createTrack } from "./factory";
import { frettedMidiPitch } from "./trackKind";

const chords: Array<[string, number[]]> = [
  ["A", [0, 4, 7]],
  ["Am", [0, 3, 7]],
  ["AM", [0, 4, 7]],
  ["Amin", [0, 3, 7]],
  ["Am7", [0, 3, 7, 10]],
  ["A-7", [0, 3, 7, 10]],
  ["AmMaj7", [0, 3, 7, 11]],
  ["AmM7", [0, 3, 7, 11]],
  ["Amaj7", [0, 4, 7, 11]],
  ["AM7", [0, 4, 7, 11]],
  ["AΔ7", [0, 4, 7, 11]],
  ["A7", [0, 4, 7, 10]],
  ["Adom7", [0, 4, 7, 10]],
  ["Am7b5", [0, 3, 6, 10]],
  ["Aø", [0, 3, 6, 10]],
  ["Aø7", [0, 3, 6, 10]],
  ["Adim7", [0, 3, 6, 9]],
  ["A°7", [0, 3, 6, 9]],
  ["Ao7", [0, 3, 6, 9]],
  ["Aaug", [0, 4, 8]],
  ["A+", [0, 4, 8]],
  ["Asus2", [0, 2, 7]],
  ["Asus4", [0, 5, 7]],
  ["A7sus4", [0, 5, 7, 10]],
  ["A9", [0, 4, 7, 10, 14]],
  ["Am9", [0, 3, 7, 10, 14]],
  ["AmMaj9", [0, 3, 7, 11, 14]],
  ["A6", [0, 4, 7, 9]],
  ["Am6", [0, 3, 7, 9]],
  ["A69", [0, 4, 7, 9, 14]],
  ["Cadd9", [0, 4, 7, 14]],
  ["Cadd11", [0, 4, 7, 17]],
  ["C/G", [0, 4, 7]],
  ["F#m7", [0, 3, 7, 10]],
  ["Bb7#9", [0, 4, 7, 10, 15]],
  ["E7b9", [0, 4, 7, 10, 13]],
  ["D13", [0, 4, 7, 10, 14, 17, 21]],
  ["C7b5#9", [0, 4, 6, 10, 15]],
  ["C13#11", [0, 4, 7, 10, 14, 18, 21]],
  ["C7b9#9", [0, 4, 7, 10, 13, 15]]
];

it.each(chords)("[B6] parses %s with its expected chord intervals", (symbol, intervals) => {
  expect(parseChordSymbol(symbol)?.intervals).toEqual(intervals);
});

it("[B6] returns no chord for unsupported words or extra inversion separators", () => {
  for (const invalid of ["Bminorish", "not a chord", "C7#4", "C99", "C/G/E", "C/"]) {
    expect(parseChordSymbol(invalid)).toBeNull();
  }
});

it("[B6] preserves alterations and slash bass on transpose", () => {
  expect(transposeChordSymbol("Bb7♯9/F", 2)).toBe("C7#9/G");
  expect(parseChordSymbol("C/G")?.bass).toBe(7);
  expect(parseChordSymbol("Am")?.pitchClasses).toEqual([0, 4, 9]);
});

it("[B6] places slash bass as the lowest sounding note and supports a compact 13th chord", () => {
  const tuning = createTrack().tuning;
  const inverted = parseChordSymbol("C/G")!;
  const voicing = enumerateChordVoicings(tuning, inverted)[0];
  expect(voicing).toBeDefined();
  const pitches = voicing.notes.map((note) => frettedMidiPitch(tuning, note.string, note.fret)!);
  expect(Math.min(...pitches) % 12).toBe(7);

  const extended = parseChordSymbol("D13")!;
  const compact = enumerateChordVoicings(tuning, extended)[0];
  expect(compact).toBeDefined();
  expect(compact.notes.map((note) => note.pitchClass)).toEqual(expect.arrayContaining([2, 6, 0, 11]));
});
