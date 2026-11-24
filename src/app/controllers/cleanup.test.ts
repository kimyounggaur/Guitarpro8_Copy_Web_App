import { expect, it } from "vitest";
import { completeVoiceRests, lowerBeatFingerings } from "../../engine/tools/cleanup";
import { beatDurationTicks } from "../../model/derive";
import { createBeat, createMasterBar, createNote, createTrack } from "../../model/factory";
import { trackNoteMidiPitch } from "../../model/trackKind";

it("[B9] fills the 4/4 remainder after beat one with quarter and half rests", () => {
  const voice = { beats: [createBeat({ rest: false, notes: [createNote()] })] };
  completeVoiceRests(voice, createMasterBar());
  expect(voice.beats.map((beat) => [beat.rest, beatDurationTicks(beat)])).toEqual([
    [false, 480], [true, 480], [true, 960]
  ]);
});

it("[B9] simplifies high fingerings without shifting sounding pitch or doubling a string", () => {
  const track = createTrack();
  const beat = createBeat({ rest: false, notes: [createNote(2, 17), createNote(1, 0)] });
  const before = beat.notes.map((note) => trackNoteMidiPitch(note, track));
  lowerBeatFingerings(track, beat, 8);
  expect(beat.notes.map((note) => trackNoteMidiPitch(note, track))).toEqual(before);
  expect(new Set(beat.notes.map((note) => note.string)).size).toBe(2);

  const single = createBeat({ rest: false, notes: [createNote(2, 17)] });
  lowerBeatFingerings(track, single, 8);
  expect(single.notes[0].fret).toBe(12);
  expect(trackNoteMidiPitch(single.notes[0], track)).toBe(76);
});
