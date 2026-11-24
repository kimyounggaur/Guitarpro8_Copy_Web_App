import { describe, expect, it } from "vitest";
import { noteMidiPitch, tryNoteMidiPitch, writtenPitch } from "./derive";
import { createBeat, createEmptyScore, createNote, createTrack } from "./factory";
import { normalizeTies } from "./ties";

describe("track-specific pitch and notation", () => {
  it("[B14] recomputes guitar pitch when the fret changes, even with old MIDI data present", () => {
    const guitar = createTrack();
    const note = { ...createNote(6, 0), midiPitch: 81 };
    expect(writtenPitch(note, guitar, { concertTone: false })).toBe(52);
    note.fret = 2;
    expect(noteMidiPitch(note, guitar)).toBe(42);
    expect(writtenPitch(note, guitar, { concertTone: false })).toBe(54);
  });

  it("[C7] keeps C2 distinct from other simultaneous piano pitches when resolving ties", () => {
    const score = createEmptyScore();
    const piano = createTrack({
      name: "Piano", shortName: "Pno.", icon: "piano", color: "#000",
      tuningLabel: "Keyboard", strings: [48, 52, 55, 60, 64], stringed: false, staffConfig: "grand"
    });
    const lowC = { ...createNote(0, -1), midiPitch: 36 };
    const middleC = { ...createNote(0, -1), midiPitch: 60 };
    const wrongPitch = { ...middleC, tiedFromPrevious: true };
    const rightPitch = { ...lowC, tiedFromPrevious: true };
    piano.bars[0].voices[0].beats = [
      createBeat({ rest: false, notes: [lowC] }),
      createBeat({ rest: false, notes: [rightPitch, wrongPitch] })
    ];
    score.tracks.push(piano);

    expect(noteMidiPitch(lowC, piano)).toBe(36);
    expect(noteMidiPitch(middleC, piano)).toBe(60);
    expect(tryNoteMidiPitch(createNote(), piano)).toBeNull();
    expect(normalizeTies(score)).toHaveLength(1);
    expect(rightPitch.tiedFromPrevious).toBe(true);
    expect(wrongPitch.tiedFromPrevious).toBeFalsy();
  });
});
