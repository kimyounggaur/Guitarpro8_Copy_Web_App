import { parseMidi } from "midi-file";
import { barTheoreticalTicks } from "../../model/derive";
import { createBar, createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { INSTRUMENT_DEFINITIONS } from "../../model/instruments";
import { keyFromFifths } from "../../model/keys";
import { chooseFretForPitch } from "../../engine/notation/staffInput";
import { TICKS_PER_QUARTER, type Beat, type BeatDuration, type KeySignature, type Note, type Score, type TimeSignature, type Track } from "../../model/types";

interface TimedNote {
  start: number;
  end: number;
  pitch: number;
  velocity: number;
}

interface MidiPart {
  name: string;
  channel: number;
  program: number;
  notes: TimedNote[];
}

interface Change<T> {
  tick: number;
  value: T;
}

export function importStandardMidi(bytes: Uint8Array, options: { detectTriplets?: boolean } = {}): Score {
  const midi = parseMidi(bytes);
  const division = midi.header.ticksPerBeat;
  if (!division || midi.header.format === 2) throw new Error("This MIDI file uses an unsupported time format.");
  const toTicks = (tick: number) => Math.round(tick * TICKS_PER_QUARTER / division);
  const meters: Change<TimeSignature>[] = [];
  const keys: Change<KeySignature>[] = [];
  const tempos: Change<number>[] = [];
  const channelPrograms = Array.from({ length: 16 }, () => 0);
  const parts: MidiPart[] = [];

  for (const source of midi.tracks) {
    const partName = source.find((event) => event.type === "trackName");
    const name = partName ? decodeName(partName.text) : "";
    const active = new Map<string, { part: MidiPart; start: number; velocity: number }[]>();
    const byChannelProgram = new Map<string, MidiPart>();
    let sourceTick = 0;

    for (const event of source) {
      sourceTick += event.deltaTime;
      const tick = toTicks(sourceTick);
      switch (event.type) {
        case "timeSignature":
          if (event.numerator > 0 && [1, 2, 4, 8, 16, 32, 64].includes(event.denominator)) {
            meters.push({ tick, value: { ...createMasterBar().timeSignature, numerator: event.numerator, denominator: event.denominator as BeatDuration } });
          }
          break;
        case "keySignature":
          keys.push({ tick, value: keyFromFifths(event.key, event.scale === 1 ? "minor" : "major") });
          break;
        case "setTempo":
          if (event.microsecondsPerBeat > 0) tempos.push({ tick, value: 60_000_000 / event.microsecondsPerBeat });
          break;
        case "programChange":
          channelPrograms[event.channel] = event.programNumber;
          break;
        case "noteOn":
        case "noteOff": {
          const noteKey = `${event.channel}:${event.noteNumber}`;
          const pending = active.get(noteKey) ?? [];
          if (event.type === "noteOn" && event.velocity > 0) {
            const program = channelPrograms[event.channel];
            const partKey = `${event.channel}:${program}`;
            let part = byChannelProgram.get(partKey);
            if (!part) {
              part = { channel: event.channel, program, name, notes: [] };
              byChannelProgram.set(partKey, part);
              parts.push(part);
            }
            pending.push({ part, start: tick, velocity: event.velocity });
            active.set(noteKey, pending);
          } else {
            const note = pending.shift();
            if (note && tick > note.start) note.part.notes.push({ start: note.start, end: tick, pitch: event.noteNumber, velocity: note.velocity });
          }
          break;
        }
      }
    }
  }

  const score = createEmptyScore();
  score.meta.title = "Imported MIDI";
  const lastNote = parts.reduce((end, part) => part.notes.reduce((latest, note) => Math.max(latest, note.end), end), 0);
  const lastChange = [...meters, ...keys, ...tempos].reduce((end, { tick }) => Math.max(end, tick), 0);
  meters.sort((left, right) => left.tick - right.tick);
  keys.sort((left, right) => left.tick - right.tick);
  tempos.sort((left, right) => left.tick - right.tick);
  const barStarts: number[] = [];
  let currentMeter = createMasterBar().timeSignature;
  let currentKey = createMasterBar().keySignature;
  let meterIndex = 0;
  let keyIndex = 0;
  score.masterBars = [];
  for (let start = 0; start < Math.max(1, lastNote, lastChange + 1);) {
    while (meters[meterIndex] && meters[meterIndex].tick <= start) currentMeter = meters[meterIndex++].value;
    while (keys[keyIndex] && keys[keyIndex].tick <= start) currentKey = keys[keyIndex++].value;
    const bar = createMasterBar();
    bar.timeSignature = { ...currentMeter };
    bar.keySignature = { ...currentKey };
    barStarts.push(start);
    score.masterBars.push(bar);
    start += barTheoreticalTicks(bar);
    if (score.masterBars.length >= 100_000) throw new Error("This MIDI file contains too many bars.");
  }
  if (tempos.length) {
    const atTick = new Map(tempos.map(({ tick, value }) => [tick, value]));
    if (!atTick.has(0)) atTick.set(0, 120);
    score.masterAutomations.push({
      scope: "master", type: "tempo",
      points: [...atTick].sort(([a], [b]) => a - b).map(([tick, value]) => ({ tick, value, transition: "constant" }))
    });
  }

  score.tracks = parts.filter(({ notes }) => notes.length > 0).map((part, index) =>
    partToTrack(part, index, score, barStarts, options.detectTriplets === true));
  if (!score.tracks.length) score.tracks.push(createTrack(undefined, score.masterBars.length));
  return score;
}

function partToTrack(part: MidiPart, index: number, score: Score, starts: number[], detectTriplets: boolean): Track {
  const definition = part.channel === 9
    ? INSTRUMENT_DEFINITIONS.find(({ id }) => id === "drums")
    : INSTRUMENT_DEFINITIONS.find(({ gmProgram, category }) => gmProgram === part.program && category !== "Drums");
  const track = createTrack(definition ? { ...definition, strings: definition.tuning } : undefined, score.masterBars.length);
  track.name = part.name || definition?.name || `MIDI Track ${index + 1}`;
  track.sounds = [{ id: `gm-${part.program}`, name: `GM ${part.program}` }];
  if (!definition || (track.kind === "stringed" && part.notes.some(({ pitch }) => !chooseFretForPitch(track, pitch, {})))) {
    track.kind = "pitched";
    track.interpretation.stringed = false;
    track.clef = "treble";
    track.notationTypes = ["standard"];
  }

  track.bars = starts.map(() => createBar());
  const notes = part.notes.sort((a, b) => a.start - b.start || a.end - b.end);
  const lastBarEnd = starts[starts.length - 1] + barTheoreticalTicks(score.masterBars[starts.length - 1]);
  const groups: { start: number; end: number; notes: Note[] }[] = [];
  let firstAttack = -Infinity;
  for (const event of notes) {
    if (event.start - firstAttack > 10) firstAttack = event.start;
    const start = Math.min(lastBarEnd - 30, quantize(firstAttack, detectTriplets));
    const end = Math.min(lastBarEnd, Math.max(start + (detectTriplets ? 20 : 30), quantize(event.end, detectTriplets)));
    const chord = groups[groups.length - 1];
    const group = chord?.start === start && chord.end === end ? chord : { start, end, notes: [] };
    let note = createNote(0, -1);
    if (track.kind === "percussion") {
      if (group.notes.some(({ midiNumber }) => midiNumber === event.pitch)) continue;
      note.midiNumber = event.pitch;
    } else if (track.kind === "pitched") {
      if (group.notes.some(({ midiPitch }) => midiPitch === event.pitch)) continue;
      note.midiPitch = event.pitch;
    } else {
      const placement = chooseFretForPitch(track, event.pitch, { occupiedStrings: new Set(group.notes.map(({ string }) => string)) });
      if (!placement) throw new Error(`An imported MIDI chord cannot be played on the selected tuning at tick ${start}.`);
      note = createNote(placement.string, placement.fret);
    }
    const dynamic = Math.max(0, Math.min(7, Math.round((event.velocity - 32) / 13)));
    note.dynamic = dynamic as Note["dynamic"];
    group.notes.push(note);
    if (group !== chord) groups.push(group);
  }

  const ends = [0, 0, 0, 0];
  const positions = starts.map(() => [0, 0, 0, 0]);
  for (const group of groups) {
    const voiceIndex = ends.findIndex((end) => end <= group.start);
    if (voiceIndex < 0) throw new Error("An imported MIDI track requires more than four overlapping voices.");
    ends[voiceIndex] = group.end;
    for (let barIndex = locateBar(starts, group.start); barIndex < starts.length && starts[barIndex] < group.end; barIndex++) {
      const barStart = starts[barIndex];
      const start = Math.max(barStart, group.start) - barStart;
      const end = Math.min(group.end - barStart, barTheoreticalTicks(score.masterBars[barIndex]));
      const voice = track.bars[barIndex].voices[voiceIndex];
      voice.beats.push(...createSpan(start - positions[barIndex][voiceIndex], []));
      voice.beats.push(...createSpan(end - start, group.notes, barStart > group.start));
      positions[barIndex][voiceIndex] = end;
    }
  }
  track.bars.forEach((bar, i) => bar.voices.forEach((voice, v) => {
    if (v === 0 || voice.beats.length) {
      voice.beats.push(...createSpan(barTheoreticalTicks(score.masterBars[i]) - positions[i][v], []));
    }
  }));
  return track;
}

function quantize(tick: number, triplets: boolean): number {
  const regular = Math.round(tick / 120) * 120;
  const ternary = Math.round(tick / 80) * 80;
  return triplets && Math.abs(tick - ternary) < Math.abs(tick - regular) ? ternary : regular;
}

function locateBar(starts: number[], tick: number): number {
  let low = 0;
  let high = starts.length;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (starts[mid] <= tick) low = mid;
    else high = mid;
  }
  return low;
}

const durations: BeatDuration[] = [1, 2, 4, 8, 16, 32, 64];

function createSpan(length: number, notes: Note[], continuation = false): Beat[] {
  const result: Beat[] = [];
  for (let remaining = length; remaining > 0;) {
    const duration = durations.find((value) => 1920 / value <= remaining) ?? 64;
    const base = 1920 / duration;
    const ticks = Math.min(base, remaining);
    result.push(createBeat({
      duration, rest: notes.length === 0,
      notes: notes.map((note) => ({ ...note, tiedFromPrevious: continuation || result.length > 0 || undefined })),
      tuplet: ticks === base ? undefined : { n: base, m: ticks }
    }));
    remaining -= ticks;
  }
  return result;
}

function decodeName(text: string): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(text, (character) => character.charCodeAt(0)));
  } catch {
    return text;
  }
}
