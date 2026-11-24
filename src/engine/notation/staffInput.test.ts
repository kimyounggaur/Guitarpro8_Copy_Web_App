import { expect, it } from "vitest";
import { createTrack } from "../../model/factory";
import { chooseFretForPitch, moveStaffPitch, resolveStaffInput } from "./staffInput";

const cMajor = { key: "C", mode: "major" } as const;

it("[B11] places written A4 on the third guitar string at fret 2", () => {
  const track = { ...createTrack(), kind: "stringed", clef: "treble8vb" } as const;
  expect(resolveStaffInput(track, {
    clef: "treble8vb", position: 3, key: cMajor, concertTone: false, preferredString: 3
  })).toEqual({ kind: "stringed", string: 3, fret: 2 });
});

it("[B11] uses partial capo and avoids an occupied string before choosing the nearest fretting position", () => {
  const track = { ...createTrack(), kind: "stringed", clef: "treble8vb" } as const;
  track.tuning.partialCapo = { fret: 2, strings: [3] };
  expect(chooseFretForPitch(track, 57, { preferredString: 3 })).toEqual({ string: 3, fret: 0 });
  expect(chooseFretForPitch(track, 57, { preferredString: 3, occupiedStrings: new Set([3]), previousFret: 12 }))
    .toEqual({ string: 5, fret: 12 });
  expect(chooseFretForPitch(track, 27)).toBeNull();
});

it("[B11] keeps chromatic cursor pitch when note names share the same staff position", () => {
  const initial = { position: 5, clef: "treble", key: cMajor } as const;
  const chromatic = moveStaffPitch(initial, 1, true);
  expect(chromatic).toEqual({ position: 5, writtenMidi: 73 });
  expect(moveStaffPitch({ ...initial, ...chromatic }, 1, true)).toEqual({ position: 6, writtenMidi: 74 });
  expect(moveStaffPitch({ ...initial, ...chromatic }, 1, false)).toEqual({ position: 6 });
});

it("[C7] enters C2 in the lower grand staff as a pitched note", () => {
  const track = { ...createTrack(), kind: "pitched", clef: "grand" } as const;
  expect(resolveStaffInput(track, {
    clef: "bass", position: -4, key: cMajor, concertTone: false
  })).toEqual({ kind: "pitched", midiPitch: 36 });
});

it("[B4] inputs the drum mapped to the selected staff position", () => {
  const track = { ...createTrack(), kind: "percussion", clef: "percussion" } as const;
  expect(resolveStaffInput(track, {
    clef: "percussion", position: -6, key: cMajor, concertTone: false
  })).toEqual({ kind: "percussion", midiNumber: 36, articulation: "normal" });
});

it("[B11] reverses instrument transposition and ottava exactly once", () => {
  const track = { ...createTrack(), kind: "pitched", clef: "treble" } as const;
  track.transpositionTonality.soundingOffset = -2;
  const options = { clef: "treble", position: -2, key: cMajor, ottava: "8va" } as const;
  expect(resolveStaffInput(track, { ...options, concertTone: false })).toEqual({ kind: "pitched", midiPitch: 70 });
  expect(resolveStaffInput(track, { ...options, concertTone: true })).toEqual({ kind: "pitched", midiPitch: 72 });
});
