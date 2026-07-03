import { describe, expect, it } from "vitest";
import { noteMidiPitch } from "./derive";
import { createBeat, createNote, createTrack } from "./factory";
import {
  DRUM_MAPPINGS,
  INSTRUMENT_DEFINITIONS,
  instrumentById,
  retuneTrack,
  tuningMatchesPreset
} from "./instruments";

describe("Phase 8 track system", () => {
  it("ships a broad preset library for the track wizard", () => {
    expect(INSTRUMENT_DEFINITIONS.length).toBeGreaterThanOrEqual(20);
    expect(instrumentById("guitar").notationTypes).toContain("tab");
    expect(instrumentById("bass").tuningLabel).toBe("E A D G");
    expect(instrumentById("drums").icon).toBe("drums");
  });

  it("retunes with different keep and adjust fingering behavior", () => {
    const keepTrack = trackWithLowE();
    const adjustTrack = trackWithLowE();
    const dropD = {
      ...keepTrack.tuning,
      strings: [38, 45, 50, 55, 59, 64],
      label: "D A D G B E"
    };

    retuneTrack(keepTrack, structuredClone(dropD), "keep-fingering");
    retuneTrack(adjustTrack, structuredClone(dropD), "adjust-fingering");

    expect(keepTrack.bars[0].voices[0].beats[0].notes[0]).toMatchObject({ string: 6, fret: 0 });
    expect(noteMidiPitch(keepTrack.bars[0].voices[0].beats[0].notes[0], keepTrack)).toBe(38);
    expect(adjustTrack.bars[0].voices[0].beats[0].notes[0]).toMatchObject({ string: 6, fret: 2 });
    expect(noteMidiPitch(adjustTrack.bars[0].voices[0].beats[0].notes[0], adjustTrack)).toBe(40);
  });

  it("matches tuning presets and creates transposing instrument metadata", () => {
    const clarinet = instrumentById("clarinet-bb");
    const track = createTrack(
      {
        name: clarinet.name,
        shortName: clarinet.shortName,
        color: clarinet.color,
        icon: clarinet.icon,
        strings: clarinet.tuning,
        tuningLabel: clarinet.tuningLabel,
        notationTypes: clarinet.notationTypes,
        staffConfig: clarinet.staffConfig,
        stringed: clarinet.stringed,
        soundingOffset: clarinet.soundingOffset,
        gmProgram: clarinet.gmProgram
      },
      1
    );

    expect(track.interpretation.stringed).toBe(false);
    expect(track.transpositionTonality.soundingOffset).toBe(-2);
    expect(tuningMatchesPreset([38, 45, 50, 55, 59, 64])?.name).toBe("Drop D");
  });

  it("uses GM drum mappings as direct MIDI note numbers", () => {
    const snare = DRUM_MAPPINGS.find((mapping) => mapping.id === "snare");
    const drumTrack = createTrack(
      {
        name: "Drum Kit",
        shortName: "Dr.",
        color: "#dc2626",
        icon: "drums",
        strings: [36, 38, 42],
        tuningLabel: "GM Kit",
        notationTypes: ["standard"],
        staffConfig: "single",
        stringed: false,
        gmProgram: 0
      },
      1
    );
    const note = createNote(1, 0);

    note.midiNumber = snare?.midiNumber;
    note.articulation = "rimshot";

    expect(snare?.articulations).toContain("rimshot");
    expect(noteMidiPitch(note, drumTrack)).toBe(38);
  });
});

function trackWithLowE() {
  const track = createTrack(undefined, 1);
  track.bars[0].voices[0].beats = [
    createBeat({ duration: 4, rest: false, notes: [createNote(6, 0)] })
  ];
  return track;
}
