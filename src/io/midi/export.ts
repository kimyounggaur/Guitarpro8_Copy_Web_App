import { writeMidi, type MidiEvent } from "midi-file";
import { compilePlayback } from "../../engine/audio/compile";
import { unrollScore, type PlaybackSegment, type UnrollResult } from "../../engine/unroll/unrollScore";
import { barTheoreticalTicks } from "../../model/derive";
import { INSTRUMENT_DEFINITIONS } from "../../model/instruments";
import { keyFifths } from "../../model/keys";
import { TICKS_PER_QUARTER, type Score, type Track } from "../../model/types";

interface TimedEvent {
  tick: number;
  event: MidiEvent;
}

export function exportStandardMidi(score: Score, options: { expandRepeats?: boolean } = {}): Uint8Array {
  const order = options.expandRepeats === false ? writtenOrder(score) : unrollScore(score);
  const compiled = compilePlayback(score, order);
  const tempoTrack: TimedEvent[] = [at(0, { type: "trackName", meta: true, text: "Tempo", deltaTime: 0 })];

  const tempoTicks = new Set<number>([0]);
  for (const segment of compiled.tempoMap.sections) {
    tempoTicks.add(segment.startTick);
    if (segment.transition === "progressive") {
      for (let tick = segment.startTick + TICKS_PER_QUARTER / 4; tick < segment.endTick; tick += TICKS_PER_QUARTER / 4) {
        tempoTicks.add(tick);
      }
    }
  }
  for (const tick of tempoTicks) {
    tempoTrack.push(at(tick, {
      type: "setTempo", meta: true, deltaTime: 0,
      microsecondsPerBeat: Math.min(0xffffff, Math.round(60_000_000 / Math.max(1, compiled.tempoMap.bpmAtTick(tick))))
    }));
  }

  let previousMeter = "";
  let previousKey = "";
  for (const segment of order.segments) {
    const { timeSignature: meter, keySignature: key } = score.masterBars[segment.barIndex];
    const meterName = `${meter.numerator}/${meter.denominator}`;
    const fifths = keyFifths(key);
    const keyName = `${fifths}:${key.mode}`;
    if (meterName !== previousMeter) {
      tempoTrack.push(at(segment.startTick, {
        type: "timeSignature", meta: true, deltaTime: 0, numerator: meter.numerator,
        denominator: meter.denominator, metronome: 24, thirtyseconds: 8
      }));
      previousMeter = meterName;
    }
    if (keyName !== previousKey) {
      tempoTrack.push(at(segment.startTick, {
        type: "keySignature", meta: true, deltaTime: 0, key: fifths, scale: key.mode === "minor" ? 1 : 0
      }));
      previousKey = keyName;
    }
  }

  const remainingChannels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
  const channelsByProgram = new Map<number, number>();
  const tracks = score.tracks.map((track) => {
    const program = gmProgram(track);
    const channel = track.kind === "percussion" ? 9 : remainingChannels.shift() ?? channelsByProgram.get(program);
    if (channel === undefined) throw new Error("This score needs more than 15 distinct MIDI instrument channels.");
    if (channel !== 9) channelsByProgram.set(program, channel);
    const events: TimedEvent[] = [at(0, { type: "trackName", meta: true, deltaTime: 0, text: utf8TrackName(track.name) })];
    if (channel !== 9) events.push(at(0, { type: "programChange", deltaTime: 0, channel, programNumber: program }));

    for (const note of compiled.events) {
      if (note.trackId !== track.id) continue;
      const start = Math.round(note.startTick);
      const end = Math.max(start + 1, Math.round(note.startTick + note.durationTicks));
      const noteNumber = Math.max(0, Math.min(127, Math.round(note.midiPitch)));
      events.push(at(start, { type: "noteOn", deltaTime: 0, channel, noteNumber, velocity: Math.max(1, Math.min(127, Math.round(note.velocity))) }));
      events.push(at(end, { type: "noteOff", deltaTime: 0, channel, noteNumber, velocity: 0 }));
    }
    return toDeltas(events, order.totalTicks);
  });
  return Uint8Array.from(writeMidi({
    header: { format: 1, numTracks: tracks.length + 1, ticksPerBeat: TICKS_PER_QUARTER },
    tracks: [toDeltas(tempoTrack, order.totalTicks), ...tracks]
  }));
}

function at(tick: number, event: MidiEvent): TimedEvent {
  return { tick: Math.round(tick), event };
}

function toDeltas(events: TimedEvent[], endTick: number): MidiEvent[] {
  let previous = 0;
  const ordered = events.sort((a, b) => a.tick - b.tick || priority(a.event) - priority(b.event))
    .map(({ tick, event }) => {
      const deltaTime = tick - previous;
      previous = tick;
      return { ...event, deltaTime };
    });
  ordered.push({ type: "endOfTrack", meta: true, deltaTime: Math.max(0, Math.round(endTick) - previous) });
  return ordered;
}

function priority(event: MidiEvent): number {
  if (event.type === "noteOn") return 3;
  if (event.type === "noteOff") return 2;
  if (event.type === "programChange" || event.type === "controller") return 1;
  return 0;
}

function writtenOrder(score: Score): UnrollResult {
  let tick = 0;
  const segments: PlaybackSegment[] = score.masterBars.map((bar, barIndex) => {
    const durationTicks = barTheoreticalTicks(bar);
    const segment = { barIndex, sequenceIndex: barIndex, startTick: tick, durationTicks, pass: 1, visit: 1 };
    tick += durationTicks;
    return segment;
  });
  return { segments, totalTicks: tick, warnings: [] };
}

function gmProgram(track: Track): number {
  const match = /^gm-(\d+)$/.exec(track.sounds[0]?.id ?? "");
  if (match) return Math.min(127, Number(match[1]));
  const definition = INSTRUMENT_DEFINITIONS.find(({ name }) => name === track.name);
  return definition?.gmProgram ?? (track.kind === "pitched" ? 0 : track.icon === "bass" ? 34 : 25);
}

function utf8TrackName(name: string): string {
  // midi-file writes each character as one byte. Feed it encoded UTF-8 bytes.
  return Array.from(new TextEncoder().encode(name), (byte) => String.fromCharCode(byte)).join("");
}
