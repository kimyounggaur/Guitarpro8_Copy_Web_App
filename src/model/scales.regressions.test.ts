import { expect, it } from "vitest";
import { SCALE_DEFINITIONS, searchScales } from "./scales";

it("[B7] lists one row per root-relative pitch set and keeps equivalent names searchable", () => {
  const masks = SCALE_DEFINITIONS.map(({ intervals }) =>
    intervals.reduce((mask, pitchClass) => mask | (1 << pitchClass), 0));
  expect(new Set(masks).size).toBe(masks.length);
  expect(searchScales({ query: "Ukrainian Dorian" }).map((scale) => scale.name)).toEqual(["Romanian minor"]);
  expect(searchScales({ query: "Mixolydian b6" }).map((scale) => scale.name)).toEqual(["Hindu"]);
  expect(searchScales({ query: "Ionian no 6" })).toEqual([]);
});

it.each([
  ["Major scale", [0, 2, 4, 5, 7, 9, 11]],
  ["Locrian", [0, 1, 3, 5, 6, 8, 10]],
  ["Natural Minor", [0, 2, 3, 5, 7, 8, 10]],
  ["Harmonic minor", [0, 2, 3, 5, 7, 8, 11]],
  ["Melodic minor", [0, 2, 3, 5, 7, 9, 11]],
  ["Major pentatonic", [0, 2, 4, 7, 9]],
  ["Minor pentatonic", [0, 3, 5, 7, 10]],
  ["Blues", [0, 3, 5, 6, 7, 10]],
  ["Whole tone", [0, 2, 4, 6, 8, 10]],
  ["Diminished whole-half", [0, 2, 3, 5, 6, 8, 9, 11]],
  ["Diminished half-whole", [0, 1, 3, 4, 6, 7, 9, 10]],
])("[B7] maps %s to its documented semitone intervals", (name, expected) => {
  expect(searchScales({ query: name })[0]?.intervals).toEqual(expected);
});

it("[B7] includes all seven rotations of both minor parent collections", () => {
  for (const intervals of [[0, 2, 3, 5, 7, 8, 11], [0, 2, 3, 5, 7, 9, 11]]) {
    for (const tonic of intervals) {
      const mode = intervals.map((note) => (note - tonic + 12) % 12).sort((a, b) => a - b);
      const found = SCALE_DEFINITIONS.some((scale) => scale.intervals.join(",") === mode.join(","));
      expect(found, mode.join(",")).toBe(true);
    }
  }
});
