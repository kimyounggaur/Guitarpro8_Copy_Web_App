import { barTheoreticalTicks, beatDurationTicks, noteMidiPitch } from "../model/derive";
import { createBar, createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../model/factory";
import { TICKS_PER_QUARTER, type BeatDuration, type Score, type Track } from "../model/types";

interface MidiNoteEvent {
  start: number;
  duration: number;
  pitch: number;
  velocity: number;
}

interface MidiTimedEvent {
  tick: number;
  bytes: number[];
}

export function exportMidi(score: Score): Uint8Array {
  const tempoTrack = createTrackChunk([
    { tick: 0, bytes: [0xff, 0x03, 0x06, ...asciiBytes("Tempo")] },
    { tick: 0, bytes: [0xff, 0x51, 0x03, ...tempoBytes(firstTempo(score))] },
    { tick: 0, bytes: [0xff, 0x58, 0x04, score.masterBars[0]?.timeSignature.numerator ?? 4, denominatorPower(score.masterBars[0]?.timeSignature.denominator ?? 4), 24, 8] }
  ]);
  const scoreTracks = score.tracks.map((track, index) => createTrackChunk(trackToMidiEvents(score, track, index)));
  const chunks = [tempoTrack, ...scoreTracks];
  const header = [
    ...asciiBytes("MThd"),
    0, 0, 0, 6,
    0, 1,
    (chunks.length >> 8) & 0xff,
    chunks.length & 0xff,
    (TICKS_PER_QUARTER >> 8) & 0xff,
    TICKS_PER_QUARTER & 0xff
  ];

  return new Uint8Array([...header, ...chunks.flatMap((chunk) => [...chunk])]);
}

export function importMidi(bytes: Uint8Array): Score {
  if (textAt(bytes, 0, 4) !== "MThd") {
    throw new Error("The selected file is not a standard MIDI file.");
  }

  const trackCount = readUInt16(bytes, 10);
  const division = readUInt16(bytes, 12) || TICKS_PER_QUARTER;
  const score = createEmptyScore();
  score.meta.title = "Imported MIDI";
  score.tracks = [];
  score.masterBars = Array.from({ length: 1 }, () => createMasterBar());
  let offset = 14;

  for (let trackIndex = 0; trackIndex < trackCount && offset < bytes.length; trackIndex += 1) {
    if (textAt(bytes, offset, 4) !== "MTrk") {
      break;
    }

    const length = readUInt32(bytes, offset + 4);
    const data = bytes.slice(offset + 8, offset + 8 + length);
    const notes = parseMidiTrack(data, division);

    if (notes.length > 0) {
      score.tracks.push(notesToTrack(notes, score.masterBars.length, score.tracks.length));
      const requiredBars = Math.ceil((Math.max(...notes.map((note) => note.start + note.duration)) || TICKS_PER_QUARTER * 4) / (TICKS_PER_QUARTER * 4));
      while (score.masterBars.length < requiredBars) {
        score.masterBars.push(createMasterBar());
      }
    }

    offset += 8 + length;
  }

  if (score.tracks.length === 0) {
    score.tracks.push(createTrack(undefined, score.masterBars.length));
  }

  score.tracks.forEach((track) => {
    while (track.bars.length < score.masterBars.length) {
      track.bars.push(createBar());
    }
  });

  return score;
}

function trackToMidiEvents(score: Score, track: Track, trackIndex: number): MidiTimedEvent[] {
  const channel = track.icon === "drums" ? 9 : trackIndex % 15;
  const events: MidiTimedEvent[] = [
    { tick: 0, bytes: [0xff, 0x03, track.name.length, ...asciiBytes(track.name)] },
    { tick: 0, bytes: [0xc0 | channel, gmProgramForTrack(track)] }
  ];
  let barStart = 0;

  score.masterBars.forEach((masterBar, barIndex) => {
    const bar = track.bars[barIndex];

    bar?.voices.forEach((voice) => {
      let beatStart = 0;

      voice.beats.forEach((beat) => {
        const duration = Math.round(beatDurationTicks(beat));

        if (!beat.rest) {
          beat.notes.forEach((note) => {
            if (note.tieOrigin) {
              return;
            }

            const pitch = clampMidi(noteMidiPitch(note, track));
            const velocity = velocityForDynamic(note.dynamic);
            const start = barStart + beatStart;
            const end = start + Math.max(1, Math.round(duration * (note.staccato ? 0.55 : 0.92)));
            events.push({ tick: start, bytes: [0x90 | channel, pitch, velocity] });
            events.push({ tick: end, bytes: [0x80 | channel, pitch, 0] });
          });
        }

        beatStart += duration;
      });
    });

    barStart += barTheoreticalTicks(masterBar);
  });

  return events.sort((left, right) => left.tick - right.tick || left.bytes[0] - right.bytes[0]);
}

function createTrackChunk(events: MidiTimedEvent[]): Uint8Array {
  const sorted = [...events].sort((left, right) => left.tick - right.tick);
  let lastTick = 0;
  const body: number[] = [];

  sorted.forEach((event) => {
    body.push(...writeVarLen(Math.max(0, event.tick - lastTick)), ...event.bytes);
    lastTick = event.tick;
  });

  body.push(0, 0xff, 0x2f, 0);
  return new Uint8Array([...asciiBytes("MTrk"), ...uint32Bytes(body.length), ...body]);
}

function parseMidiTrack(data: Uint8Array, division: number): MidiNoteEvent[] {
  const notes: MidiNoteEvent[] = [];
  const open = new Map<string, { tick: number; velocity: number }>();
  let offset = 0;
  let tick = 0;
  let runningStatus = 0;

  while (offset < data.length) {
    const delta = readVarLen(data, offset);
    offset = delta.offset;
    tick += Math.round((delta.value / division) * TICKS_PER_QUARTER);
    let status = data[offset++];

    if (status < 0x80) {
      offset -= 1;
      status = runningStatus;
    } else {
      runningStatus = status;
    }

    if (status === 0xff) {
      const metaType = data[offset++];
      const length = readVarLen(data, offset);
      offset = length.offset + length.value;
      if (metaType === 0x2f) break;
      continue;
    }

    if (status === 0xf0 || status === 0xf7) {
      const length = readVarLen(data, offset);
      offset = length.offset + length.value;
      continue;
    }

    const command = status & 0xf0;
    const channel = status & 0x0f;
    const data1 = data[offset++] ?? 0;
    const hasSecond = command !== 0xc0 && command !== 0xd0;
    const data2 = hasSecond ? data[offset++] ?? 0 : 0;

    if (command === 0x90 && data2 > 0) {
      open.set(`${channel}:${data1}`, { tick, velocity: data2 });
    }

    if (command === 0x80 || (command === 0x90 && data2 === 0)) {
      const key = `${channel}:${data1}`;
      const start = open.get(key);

      if (start) {
        notes.push({
          start: start.tick,
          duration: Math.max(TICKS_PER_QUARTER / 8, tick - start.tick),
          pitch: data1,
          velocity: start.velocity
        });
        open.delete(key);
      }
    }
  }

  return notes;
}

function notesToTrack(notes: MidiNoteEvent[], masterBarCount: number, index: number): Track {
  const track = createTrack(undefined, masterBarCount);
  track.id = `midi-track-${index + 1}`;
  track.name = `MIDI Track ${index + 1}`;
  track.shortName = `MIDI ${index + 1}`;
  track.bars = Array.from({ length: masterBarCount }, () => createBar());

  notes.forEach((event) => {
    const barIndex = Math.floor(event.start / (TICKS_PER_QUARTER * 4));
    while (track.bars.length <= barIndex) {
      track.bars.push(createBar());
    }
    const voice = track.bars[barIndex].voices[0];
    const note = createNote(1, Math.max(0, event.pitch - 64));
    note.midiPitch = event.pitch;
    note.dynamic = dynamicFromVelocity(event.velocity);
    voice.beats.push(createBeat({ duration: durationFromTicks(event.duration), rest: false, notes: [note] }));
  });

  track.bars.forEach((bar) => {
    if (bar.voices[0].beats.length === 0) {
      bar.voices[0].beats = [createBeat({ duration: 1, rest: true })];
    }
  });

  return track;
}

function durationFromTicks(ticks: number): BeatDuration {
  if (ticks >= TICKS_PER_QUARTER * 4) return 1;
  if (ticks >= TICKS_PER_QUARTER * 2) return 2;
  if (ticks >= TICKS_PER_QUARTER) return 4;
  if (ticks >= TICKS_PER_QUARTER / 2) return 8;
  if (ticks >= TICKS_PER_QUARTER / 4) return 16;
  if (ticks >= TICKS_PER_QUARTER / 8) return 32;
  return 64;
}

function firstTempo(score: Score): number {
  return score.masterAutomations.find((automation) => automation.type === "tempo")?.points[0]?.value ?? 120;
}

function tempoBytes(bpm: number): number[] {
  const mpqn = Math.round(60000000 / Math.max(1, bpm));
  return [(mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff];
}

function denominatorPower(denominator: number): number {
  return Math.max(0, Math.round(Math.log2(denominator)));
}

function gmProgramForTrack(track: Track): number {
  const gm = /^gm-(\d+)$/.exec(track.sounds[0]?.id ?? "");
  return gm ? Math.max(0, Math.min(127, Number(gm[1]) - 1)) : track.icon === "bass" ? 33 : track.icon === "drums" ? 0 : 24;
}

function velocityForDynamic(dynamic: number): number {
  return [36, 46, 56, 68, 80, 94, 108, 122][dynamic] ?? 80;
}

function dynamicFromVelocity(velocity: number): 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  return Math.max(0, Math.min(7, Math.round((velocity - 36) / 12))) as 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

function clampMidi(value: number): number {
  return Math.max(0, Math.min(127, Math.round(value)));
}

function readVarLen(bytes: Uint8Array, offset: number): { value: number; offset: number } {
  let value = 0;
  let current = 0;

  do {
    current = bytes[offset++] ?? 0;
    value = (value << 7) | (current & 0x7f);
  } while ((current & 0x80) !== 0 && offset < bytes.length);

  return { value, offset };
}

function writeVarLen(value: number): number[] {
  let buffer = value & 0x7f;
  const bytes = [];

  while ((value >>= 7)) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }

  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) {
      buffer >>= 8;
    } else {
      break;
    }
  }

  return bytes;
}

function asciiBytes(value: string): number[] {
  return Array.from(value).map((char) => char.charCodeAt(0) & 0x7f);
}

function uint32Bytes(value: number): number[] {
  return [(value >> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function readUInt16(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function readUInt32(bytes: Uint8Array, offset: number): number {
  return (((bytes[offset] ?? 0) << 24) >>> 0) + ((bytes[offset + 1] ?? 0) << 16) + ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0);
}

function textAt(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.slice(offset, offset + length));
}
