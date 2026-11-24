import { expect, it } from "vitest";
import { createEmptyScore, createNote, createTrack } from "../../model/factory";
import { INSTRUMENT_DEFINITIONS } from "../../model/instruments";
import { noteBelongsToBand, trackStack } from "./staffMetrics";

const style = createEmptyScore().stylesheet;

it("[C7] respects tablature-only notation and measures only its band", () => {
  const track = createTrack();
  const standardAndTab = trackStack(track, style);
  track.notationTypes = ["tab"];
  const tabOnly = trackStack(track, style);
  expect(tabOnly.bands.map(({ kind }) => kind)).toEqual(["tab"]);
  expect(tabOnly.height).toBeLessThan(standardAndTab.height);
});

it("[C7] splits a piano's notes at MIDI 60 and retains the full low register", () => {
  const piano = INSTRUMENT_DEFINITIONS.find(({ id }) => id === "piano")!;
  const track = createTrack({ ...piano, strings: piano.tuning });
  const [upper, lower] = trackStack(track, style).bands;
  expect([upper.clef, lower.clef]).toEqual(["treble", "bass"]);
  for (const pitch of [36, 59, 60, 64]) {
    const note = { ...createNote(), midiPitch: pitch };
    expect(noteBelongsToBand(track, note, upper)).toBe(pitch >= 60);
    expect(noteBelongsToBand(track, note, lower)).toBe(pitch < 60);
  }
});

it("[B4] ignores tablature preferences for a percussion staff", () => {
  const drums = INSTRUMENT_DEFINITIONS.find(({ id }) => id === "drums")!;
  const track = createTrack({ ...drums, strings: drums.tuning });
  track.notationTypes = ["standard", "tab"];
  expect(trackStack(track, style).bands).toMatchObject([{ kind: "percussion", clef: "percussion" }]);
});
