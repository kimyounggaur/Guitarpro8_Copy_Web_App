import { Midi } from "@tonejs/midi";
import { parseMidi, writeMidi, type MidiEvent } from "midi-file";
import { expect, it } from "vitest";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { tryNoteMidiPitch } from "../../model/derive";
import { INSTRUMENT_DEFINITIONS } from "../../model/instruments";
import { exportStandardMidi } from "./export";
import { importStandardMidi } from "./import";

it("[B14] writes UTF-8 names, zero-based flute program and actual tempo events", () => {
  const score = createEmptyScore();
  const flute = INSTRUMENT_DEFINITIONS.find(({ id }) => id === "flute")!;
  const track = createTrack({ ...flute, strings: flute.tuning }, 1);
  track.name = "플루트";
  track.bars[0].voices[0].beats = [createBeat({ notes: [{ ...createNote(0, -1), midiPitch: 69 }], rest: false })];
  score.tracks = [track];
  score.masterAutomations = [{
    type: "tempo", scope: "master", points: [120, 140, 100].map((value, i) => ({ value, tick: i * 480, transition: "constant" }))
  }];
  const bytes = exportStandardMidi(score);
  const parsed = parseMidi(bytes);
  expect(parsed.header).toMatchObject({ format: 1, ticksPerBeat: 480, numTracks: 2 });
  expect(parsed.tracks[0].filter(({ type }) => type === "setTempo")).toHaveLength(3);
  expect(parsed.tracks[1].slice(0, 3).map(({ type }) => type)).toEqual(["trackName", "programChange", "noteOn"]);
  expect(parsed.tracks[1][1]).toMatchObject({ programNumber: 73 });
  expect(new Midi(bytes).tracks[0].instrument.number).toBe(73);
  expect(importStandardMidi(bytes).tracks[0].name).toBe("플루트");
});

it("[B14] imports a co-timed chord and ties the note over a barline", () => {
  const events: MidiEvent[] = [
    { type: "timeSignature", deltaTime: 0, numerator: 3, denominator: 4, metronome: 24, thirtyseconds: 8 },
    { type: "programChange", deltaTime: 0, channel: 0, programNumber: 25 },
    { type: "noteOn", deltaTime: 1200, channel: 0, noteNumber: 55, velocity: 80 },
    { type: "noteOn", deltaTime: 7, channel: 0, noteNumber: 59, velocity: 80 },
    { type: "noteOff", deltaTime: 473, channel: 0, noteNumber: 55, velocity: 0 },
    { type: "noteOff", deltaTime: 0, channel: 0, noteNumber: 59, velocity: 0 },
    { type: "endOfTrack", deltaTime: 0 }
  ];
  const score = importStandardMidi(Uint8Array.from(writeMidi({ header: { format: 0, ticksPerBeat: 480, numTracks: 1 }, tracks: [events] })));
  expect(score.masterBars.map(({ timeSignature }) => timeSignature.numerator)).toEqual([3, 3]);
  const track = score.tracks[0];
  expect(track.bars[0].voices[0].beats[0].rest).toBe(true);
  const attack = track.bars[0].voices[0].beats.find(({ rest }) => !rest)!;
  const continuation = track.bars[1].voices[0].beats[0];
  expect(attack.notes.map((note) => tryNoteMidiPitch(note, track))).toEqual([55, 59]);
  expect(continuation.notes.every(({ tiedFromPrevious }) => tiedFromPrevious)).toBe(true);
  attack.notes[0].fret += 1;
  expect(tryNoteMidiPitch(attack.notes[0], track)).toBe(56);
});

it("[B14] uses the percussion channel and honors the expanded repeat option", () => {
  const score = createEmptyScore();
  score.masterBars = [createMasterBar(), createMasterBar()];
  score.masterBars[0].repeatOpen = true;
  score.masterBars[1].repeatClose = 2;
  const drums = INSTRUMENT_DEFINITIONS.find(({ id }) => id === "drums")!;
  const track = createTrack({ ...drums, strings: drums.tuning }, 2);
  for (const bar of track.bars) {
    bar.voices[0].beats = [createBeat({ rest: false, notes: [{ ...createNote(0, -1), midiNumber: 36 }] })];
  }
  score.tracks = [track];
  const noteOns = (bytes: Uint8Array) => parseMidi(bytes).tracks[1].filter(({ type }) => type === "noteOn");
  const expanded = noteOns(exportStandardMidi(score));
  expect(expanded).toHaveLength(4);
  expect(expanded.every((event) => event.type === "noteOn" && event.channel === 9)).toBe(true);
  expect(noteOns(exportStandardMidi(score, { expandRepeats: false }))).toHaveLength(2);
});
