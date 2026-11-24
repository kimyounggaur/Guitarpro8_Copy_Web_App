import { expect, it } from "vitest";
import { createBeat, createNote, createTrack } from "./factory";
import { retuneTrack } from "./instruments";
import { trackNoteMidiPitch } from "./trackKind";

it("[B9] finds a joint pitch-preserving voicing on the new tuning with no doubled strings", () => {
  const track = createTrack();
  const voice = track.bars[0].voices[0];
  voice.beats = [
    createBeat({ rest: false, notes: [createNote(6, 0), createNote(5, 3), createNote(4, 2)] }),
    createBeat({ rest: false, notes: [createNote(1, 4)] })
  ];
  const snapshot = voice.beats.map((beat) => beat.notes.map((note) => trackNoteMidiPitch(note, track)));
  const dropD = { ...track.tuning, strings: [38, ...track.tuning.strings.slice(1)] };
  expect(retuneTrack(track, dropD, "adjust-fingering")).toBe(0);
  const newVoice = track.bars[0].voices[0];
  expect(newVoice.beats.map((beat) => beat.notes.map((note) => trackNoteMidiPitch(note, track)))).toEqual(snapshot);
  expect(new Set(newVoice.beats[0].notes.map((note) => note.string)).size).toBe(3);
});

it("[B9] keeps the original tuning if an adjustment would silently discard a note", () => {
  const track = createTrack();
  track.bars[0].voices[0].beats = [createBeat({ rest: false, notes: [createNote(6, 0)] })];
  const before = structuredClone(track);
  const raisedTuning = { ...track.tuning, strings: track.tuning.strings.map((pitch) => pitch + 2) };
  expect(retuneTrack(track, raisedTuning, "adjust-fingering")).toBe(1);
  expect(track).toEqual(before);
});

it("[B9] removes only impossible notes when the user chooses to reduce strings", () => {
  const track = createTrack();
  track.bars[0].voices[0].beats = [createBeat({ rest: false, notes: [createNote(6, 0), createNote(1, 0)] })];
  expect(retuneTrack(track, { ...track.tuning, strings: track.tuning.strings.slice(1) }, "adjust-fingering")).toBe(1);
  expect(track.bars[0].voices[0].beats[0].notes.map((note) => trackNoteMidiPitch(note, track))).toEqual([64]);
});
