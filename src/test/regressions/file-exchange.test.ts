// @vitest-environment jsdom
import { expect, it } from "vitest";
import { exportAsciiTab } from "../../io/asciiTab";
import { exportMidi } from "../../io/midi";
import { exportMusicXml, importMusicXml } from "../../io/musicXml";
import { noteMidiPitch } from "../../model/derive";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { instrumentById } from "../../model/instruments";

it("[B13] MusicXML preserves the previous measure's time signature when attributes are omitted", () => {
  const score = createEmptyScore();
  score.masterBars = [createMasterBar(), createMasterBar()];
  score.tracks = [createTrack(undefined, 2)];
  score.masterBars.forEach((bar) => { bar.timeSignature.numerator = 3; });
  score.tracks[0].bars.forEach((bar) => { bar.voices[0].beats = [createBeat({ duration: 2, dots: 1 })]; });

  const reopened = importMusicXml(exportMusicXml(score));
  expect(reopened.masterBars.map(({ timeSignature }) =>
    [timeSignature.numerator, timeSignature.denominator]
  )).toEqual([[3, 4], [3, 4]]);
});

it("[B13] MusicXML imports pitched notes with attributes and groups chord members", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <score-partwise version="4.0">
    <part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
    <part id="P1"><measure number="1">
      <attributes><divisions>4</divisions><time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note dynamics="50"><pitch><step>G</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
      <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>16</duration><type>whole</type></note>
    </measure></part>
  </score-partwise>`;

  const { tracks: [track] } = importMusicXml(xml);
  const { beats } = track.bars[0].voices[0];
  expect(beats).toHaveLength(1);
  expect(beats[0].notes.map((note) => noteMidiPitch(note, track)).sort((a, b) => a - b)).toEqual([64, 67]);
});

it("[B14] the MIDI tempo track contains structurally valid meta events", () => {
  const bytes = exportMidi(createEmptyScore());
  expect(new TextDecoder().decode(bytes.slice(14, 18))).toBe("MTrk");

  const length = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(18);
  const track = bytes.slice(22, 22 + length);
  const types: number[] = [];
  let offset = 0;

  while (offset < track.length) {
    offset = variableLength(track, offset).end;
    expect(track[offset++]).toBe(0xff);
    types.push(track[offset++]);
    const eventLength = variableLength(track, offset);
    offset = eventLength.end + eventLength.value;
    expect(offset).toBeLessThanOrEqual(track.length);
  }
  expect(types).toContain(0x51);
  expect(types.at(-1)).toBe(0x2f);
});

it("[B14] a flute's program 73 is set before its first note-on", () => {
  const score = createEmptyScore();
  const flute = instrumentById("flute");
  const track = createTrack({ ...flute, strings: flute.tuning });
  score.tracks = [track];
  track.bars[0].voices[0].beats = [
    createBeat({ duration: 1, rest: false, notes: [{ ...createNote(), midiPitch: 72 }] })
  ];

  const bytes = exportMidi(score);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const instrumentTrackOffset = 22 + view.getUint32(18);
  const instrumentLength = view.getUint32(instrumentTrackOffset + 4);
  const dataStart = instrumentTrackOffset + 8;
  const data = bytes.slice(dataStart, dataStart + instrumentLength);
  const programOffset = data.findIndex((byte) => (byte & 0xf0) === 0xc0);
  const noteOnOffset = data.findIndex((byte) => (byte & 0xf0) === 0x90);
  expect(programOffset).toBeGreaterThanOrEqual(0);
  expect(data[programOffset + 1]).toBe(73);
  expect(noteOnOffset).toBeGreaterThan(programOffset);
});

function variableLength(bytes: Uint8Array, start: number): { value: number; end: number } {
  let value = 0;
  for (let index = start; index < Math.min(start + 4, bytes.length); index += 1) {
    const byte = bytes[index];
    value = (value << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) {
      return { value, end: index + 1 };
    }
  }
  throw new Error("Unterminated MIDI variable-length quantity");
}

it("[B15] ASCII TAB default output wraps long parts to 80-column systems", () => {
  const score = createEmptyScore();
  const barCount = 40;
  score.masterBars = Array.from({ length: barCount }, createMasterBar);
  const track = createTrack(undefined, barCount);
  score.tracks = [track];
  track.bars.forEach((bar) => {
    bar.voices[0].beats = [createBeat({ duration: 1, rest: false, notes: [createNote(1, 12)] })];
  });

  const systems = exportAsciiTab(score).split("\n").filter((line) => /^\s*[A-Ge](?:#|b)?\|/.test(line));
  expect(systems.length).toBeGreaterThan(6);
  expect(systems.every((line) => line.length <= 80 && line.endsWith("|"))).toBe(true);
  expect(systems.filter((line) => /^\s*e\|/i.test(line) && line.includes("12")).join("").match(/12/g)).toHaveLength(barCount);
});
