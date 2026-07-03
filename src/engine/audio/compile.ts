import { beatDurationTicks, noteMidiPitch } from "../../model/derive";
import { TICKS_PER_QUARTER, type Beat, type Note, type Score } from "../../model/types";
import type { PlaybackSegment, UnrollResult } from "../unroll/unrollScore";
import { buildTempoMap, type PlaybackSpeedOverride, type TempoMap } from "./tempoMap";

export interface NoteEvent {
  id: string;
  timeSec: number;
  durationSec: number;
  startTick: number;
  durationTicks: number;
  midiPitch: number;
  velocity: number;
  trackId: string;
  barIndex: number;
  voiceIndex: number;
  beatIndex: number;
  noteIndex: number;
  string: number;
  effects: NoteEventEffects;
}

export interface NoteEventEffects {
  dead: boolean;
  ghost: boolean;
  palmMute: boolean;
  letRing: boolean;
  staccato: boolean;
  accent: Note["accent"];
  vibrato: Note["vibrato"];
  bend: boolean;
  slide: boolean;
  harmonic: boolean;
}

export interface PlaybackPosition {
  timeSec: number;
  tick: number;
  barIndex: number;
  segmentIndex: number;
}

export interface PlaybackCompilation {
  events: NoteEvent[];
  segments: PlaybackSegment[];
  tempoMap: TempoMap;
  totalSeconds: number;
  totalTicks: number;
  warnings: string[];
  positionAtSecond: (seconds: number) => PlaybackPosition;
  secondAtBar: (barIndex: number) => number;
}

export function compilePlayback(
  score: Score,
  unrolled: UnrollResult,
  speedOverride: PlaybackSpeedOverride = { mode: "relative", percent: 100 }
): PlaybackCompilation {
  const tempoMap = buildTempoMap(score, unrolled.segments, speedOverride);
  const events = unrolled.segments.flatMap((segment) => compileSegment(score, segment, tempoMap));
  const sortedEvents = events.sort((left, right) => left.timeSec - right.timeSec || left.midiPitch - right.midiPitch);

  return {
    events: sortedEvents,
    segments: unrolled.segments,
    tempoMap,
    totalSeconds: tempoMap.totalSeconds,
    totalTicks: tempoMap.totalTicks,
    warnings: unrolled.warnings,
    positionAtSecond: (seconds) => positionAtSecond(unrolled.segments, tempoMap, seconds),
    secondAtBar: (barIndex) => secondAtBar(unrolled.segments, tempoMap, barIndex)
  };
}

function compileSegment(score: Score, segment: PlaybackSegment, tempoMap: TempoMap): NoteEvent[] {
  const events: NoteEvent[] = [];

  score.tracks.forEach((track) => {
    const bar = track.bars[segment.barIndex];

    bar?.voices.forEach((voice, voiceIndex) => {
      let beatTick = 0;

      voice.beats.forEach((beat, beatIndex) => {
        const durationTicks = beatDurationTicks(beat);
        const startTick = segment.startTick + beatTick;

        if (!beat.rest) {
          beat.graceNotes.forEach((grace, graceIndex) => {
            const graceTick = Math.max(segment.startTick, startTick - (grace.onBeat ? 0 : TICKS_PER_QUARTER / 16));
            const midiPitch = noteMidiPitch({ ...defaultNote(grace.string, grace.fret), string: grace.string, fret: grace.fret }, track);
            events.push({
              id: `${track.id}-${segment.sequenceIndex}-${voiceIndex}-${beatIndex}-grace-${graceIndex}`,
              timeSec: tempoMap.ticksToSeconds(graceTick),
              durationSec: 0.045,
              startTick: graceTick,
              durationTicks: TICKS_PER_QUARTER / 24,
              midiPitch,
              velocity: 52,
              trackId: track.id,
              barIndex: segment.barIndex,
              voiceIndex,
              beatIndex,
              noteIndex: -1,
              string: grace.string,
              effects: defaultEffects()
            });
          });

          beat.notes.forEach((note, noteIndex) => {
            if (note.tieOrigin) {
              return;
            }

            events.push(noteEvent(score, track.id, segment, beat, note, voiceIndex, beatIndex, noteIndex, startTick, durationTicks, tempoMap));
          });
        }

        beatTick += durationTicks;
      });
    });
  });

  return events;
}

function noteEvent(
  score: Score,
  trackId: string,
  segment: PlaybackSegment,
  beat: Beat,
  note: Note,
  voiceIndex: number,
  beatIndex: number,
  noteIndex: number,
  startTick: number,
  durationTicks: number,
  tempoMap: TempoMap
): NoteEvent {
  const track = score.tracks.find((candidate) => candidate.id === trackId);

  if (!track) {
    throw new Error(`Unknown track for playback: ${trackId}`);
  }

  const durationMultiplier = note.staccato || note.deadNote ? 0.45 : note.palmMute ? 0.65 : note.letRing ? 1.15 : 0.92;
  const effectiveDurationTicks = Math.max(TICKS_PER_QUARTER / 32, durationTicks * durationMultiplier);
  const timeSec = tempoMap.ticksToSeconds(startTick);
  const endSec = tempoMap.ticksToSeconds(startTick + effectiveDurationTicks);

  return {
    id: `${track.id}-${segment.sequenceIndex}-${voiceIndex}-${beatIndex}-${noteIndex}`,
    timeSec,
    durationSec: Math.max(0.035, endSec - timeSec),
    startTick,
    durationTicks: effectiveDurationTicks,
    midiPitch: noteMidiPitch(note, track),
    velocity: velocityForNote(note),
    trackId: track.id,
    barIndex: segment.barIndex,
    voiceIndex,
    beatIndex,
    noteIndex,
    string: note.string,
    effects: {
      dead: note.deadNote,
      ghost: note.ghost,
      palmMute: note.palmMute,
      letRing: note.letRing,
      staccato: note.staccato,
      accent: note.accent,
      vibrato: note.vibrato,
      bend: Boolean(note.bend),
      slide: Boolean(note.slide),
      harmonic: Boolean(note.harmonic)
    }
  };
}

function positionAtSecond(segments: PlaybackSegment[], tempoMap: TempoMap, seconds: number): PlaybackPosition {
  const tick = tempoMap.secondsToTicks(seconds);
  const segment =
    segments.find((candidate) => tick >= candidate.startTick && tick < candidate.startTick + candidate.durationTicks) ??
    segments[segments.length - 1];

  return {
    timeSec: seconds,
    tick,
    barIndex: segment?.barIndex ?? 0,
    segmentIndex: segment?.sequenceIndex ?? 0
  };
}

function secondAtBar(segments: PlaybackSegment[], tempoMap: TempoMap, barIndex: number): number {
  const segment = segments.find((candidate) => candidate.barIndex === barIndex) ?? segments[0];
  return tempoMap.ticksToSeconds(segment?.startTick ?? 0);
}

function velocityForNote(note: Note): number {
  const dynamics = [34, 44, 54, 64, 76, 90, 104, 116];
  const accentBoost = note.accent === "heavy" ? 18 : note.accent === "accent" ? 10 : 0;
  const ghostCut = note.ghost ? -22 : 0;
  const deadCut = note.deadNote ? -12 : 0;
  return clamp(dynamics[note.dynamic] + accentBoost + ghostCut + deadCut, 1, 127);
}

function defaultNote(string: number, fret: number): Note {
  return {
    string,
    fret,
    accidental: "none",
    forceAccidental: false,
    dynamic: 4,
    ghost: false,
    accent: "none",
    staccato: false,
    letRing: false,
    palmMute: false,
    deadNote: false,
    hopo: false,
    vibrato: "none",
    fadeIn: false,
    fadeOut: false,
    volumeSwell: false,
    slap: false,
    pop: false,
    deadSlapped: false,
    showStringNumber: false
  };
}

function defaultEffects(): NoteEventEffects {
  return {
    dead: false,
    ghost: false,
    palmMute: false,
    letRing: false,
    staccato: false,
    accent: "none",
    vibrato: "none",
    bend: false,
    slide: false,
    harmonic: false
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
