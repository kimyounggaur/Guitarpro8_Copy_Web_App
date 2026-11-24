import { expect, it } from "vitest";
import { midiForSpelledPitch, spellPitch } from "./pitchSpelling";
import {
  clefBottomLine,
  clefDisplayOffset,
  diatonicIndex,
  ledgerLines,
  pitchAtStaffPosition,
  positionToY,
  staffPosition
} from "./staffPosition";

it("[A4] puts the low open E guitar string below three ledger lines", () => {
  const low = spellPitch(40 + clefDisplayOffset("treble8vb"), 0);
  const high = spellPitch(64 + clefDisplayOffset("treble8vb"), 0);
  expect(low).toEqual({ step: "E", alter: 0, octave: 3 });
  expect(diatonicIndex(low)).toBe(23);
  expect(staffPosition(low, "treble8vb")).toBe(-7);
  expect(ledgerLines(-7)).toEqual([-2, -4, -6]);
  expect(staffPosition(high, "treble8vb")).toBe(7);
  expect(ledgerLines(7)).toEqual([]);
});

it("uses the bass bottom line and centers the top line on staffTop", () => {
  expect(clefBottomLine("bass")).toBe(18);
  expect(staffPosition(spellPitch(43, 0), "bass")).toBe(0);
  expect(clefDisplayOffset("bass8vb")).toBe(12);
  expect(clefDisplayOffset("percussion")).toBe(0);
  expect(positionToY(8, 20, 12)).toBe(20);
  expect(positionToY(0, 20, 12)).toBe(68);
  expect(positionToY(7, 20, 12)).toBe(26);
  expect(ledgerLines(9)).toEqual([]);
  expect(ledgerLines(12)).toEqual([10, 12]);
  expect(ledgerLines(-1)).toEqual([]);
});

it("finds written pitches from both treble and bass positions with accidentals", () => {
  expect(pitchAtStaffPosition(8, "treble", 1)).toEqual({ step: "F", alter: 1, octave: 5 });
  expect(midiForSpelledPitch(pitchAtStaffPosition(-7, "treble8vb", 0))).toBe(52);
  expect(midiForSpelledPitch(pitchAtStaffPosition(0, "bass", 0))).toBe(43);
});
