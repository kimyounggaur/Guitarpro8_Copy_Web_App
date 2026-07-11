import { barTheoreticalTicks, beatDurationTicks, noteMidiPitch } from "../../model/derive";
import { TICKS_PER_QUARTER, type Beat, type Note, type Score } from "../../model/types";
import type { PlaybackSegment, UnrollResult } from "../unroll/unrollScore";
import {
  buildNoteMix,
  createDefaultMixerState,
  type MixerState,
  type NoteMix
} from "./mixer";
import { buildTempoMap, type PlaybackSpeedOverride, type TempoMap } from "./tempoMap";

export interface NoteEvent {
  id: string;
  timeSec: number;
  durationSec: number;
  startTick: number;
  writtenTick: number;
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
  mix: NoteMix;
}

export interface NoteEventEffects {
  dead: boolean;
  ghost: boolean;
  palmMute: boolean;
  letRing: boolean;
  staccato: boolean;
  accent: Note["accent"];
  vibrato: Note["vibrato"];
  hopo: boolean;
  fadeIn: boolean;
  fadeOut: boolean;
  volumeSwell: boolean;
  slap: boolean;
  pop: boolean;
  deadSlapped: boolean;
  pickscrape: boolean;
  bend: boolean;
  bendPoints: Array<{ offset: number; value: number }>;
  slide: Note["slide"] | null;
  harmonic: Note["harmonic"] | null;
  harmonicShift: number;
  wah: Note["wah"] | null;
  tremoloPicking: Note["tremoloPicking"] | null;
  attackSec: number;
  releaseSec: number;
  filter: "none" | "palmMute" | "dead" | "harmonic";
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
  speedOverride: PlaybackSpeedOverride = { mode: "relative", percent: 100 },
  mixer: MixerState = createDefaultMixerState(score.tracks),
  focusedTrackId: string | null = null
): PlaybackCompilation {
  const tempoMap = buildTempoMap(score, unrolled.segments, speedOverride);
  const writtenStarts = writtenBarStarts(score);
  const events = unrolled.segments.flatMap((segment) =>
    compileSegment(score, segment, tempoMap, writtenStarts, mixer, focusedTrackId)
  );
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

function compileSegment(
  score: Score,
  segment: PlaybackSegment,
  tempoMap: TempoMap,
  writtenStarts: number[],
  mixer: MixerState,
  focusedTrackId: string | null
): NoteEvent[] {
  const events: NoteEvent[] = [];
  const writtenStart = writtenStarts[segment.barIndex] ?? 0;

  score.tracks.forEach((track) => {
    const bar = track.bars[segment.barIndex];

    bar?.voices.forEach((voice, voiceIndex) => {
      let beatTick = 0;

      voice.beats.forEach((beat, beatIndex) => {
        const durationTicks = beatDurationTicks(beat);
        const startTick = segment.startTick + beatTick;
        const writtenTick = writtenStart + beatTick;

        if (!beat.rest) {
          beat.graceNotes.forEach((grace, graceIndex) => {
            const graceTick = Math.max(segment.startTick, startTick - (grace.onBeat ? 0 : TICKS_PER_QUARTER / 16));
            const graceWrittenTick = Math.max(writtenStart, writtenTick - (grace.onBeat ? 0 : TICKS_PER_QUARTER / 16));
            const midiPitch = noteMidiPitch({ ...defaultNote(grace.string, grace.fret), string: grace.string, fret: grace.fret }, track);
            events.push({
              id: `${track.id}-${segment.sequenceIndex}-${voiceIndex}-${beatIndex}-grace-${graceIndex}`,
              timeSec: tempoMap.ticksToSeconds(graceTick),
              durationSec: 0.045,
              startTick: graceTick,
              writtenTick: graceWrittenTick,
              durationTicks: TICKS_PER_QUARTER / 24,
              midiPitch,
              velocity: 52,
              trackId: track.id,
              barIndex: segment.barIndex,
              voiceIndex,
              beatIndex,
              noteIndex: -1,
              string: grace.string,
              effects: { ...defaultEffects(), hopo: true, attackSec: 0.002 },
              mix: buildNoteMix(score, track.id, graceWrittenTick, mixer, focusedTrackId)
            });
          });

          beat.notes.forEach((note, noteIndex) => {
            if (note.tieOrigin) {
              return;
            }

            events.push(
              noteEvent(
                score,
                track.id,
                segment,
                beat,
                note,
                voiceIndex,
                beatIndex,
                noteIndex,
                startTick,
                writtenTick,
                durationTicks,
                tempoMap,
                mixer,
                focusedTrackId
              )
            );
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
  writtenTick: number,
  durationTicks: number,
  tempoMap: TempoMap,
  mixer: MixerState,
  focusedTrackId: string | null
): NoteEvent {
  const track = score.tracks.find((candidate) => candidate.id === trackId);

  if (!track) {
    throw new Error(`Unknown track for playback: ${trackId}`);
  }

  const effects = noteEffects(note, beat);
  const durationMultiplier = durationMultiplierForNote(note);
  const effectiveDurationTicks = Math.max(TICKS_PER_QUARTER / 32, durationTicks * durationMultiplier);
  const timeSec = tempoMap.ticksToSeconds(startTick);
  const endSec = tempoMap.ticksToSeconds(startTick + effectiveDurationTicks);

  return {
    id: `${track.id}-${segment.sequenceIndex}-${voiceIndex}-${beatIndex}-${noteIndex}`,
    timeSec,
    durationSec: Math.max(0.035, endSec - timeSec),
    startTick,
    writtenTick,
    durationTicks: effectiveDurationTicks,
    midiPitch: noteMidiPitch(note, track) + effects.harmonicShift,
    velocity: velocityForNote(note),
    trackId: track.id,
    barIndex: segment.barIndex,
    voiceIndex,
    beatIndex,
    noteIndex,
    string: note.string,
    effects,
    mix: buildNoteMix(score, track.id, writtenTick, mixer, focusedTrackId)
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
  const deadCut = note.deadNote || note.deadSlapped ? -12 : 0;
  const hopoCut = note.hopo ? -8 : 0;
  const scrapeCut = note.pickscrape ? -18 : 0;
  const slapBoost = note.slap ? 14 : note.pop ? 10 : 0;
  return clamp(dynamics[note.dynamic] + accentBoost + slapBoost + ghostCut + deadCut + hopoCut + scrapeCut, 1, 127);
}

function noteEffects(note: Note, beat: Beat): NoteEventEffects {
  const vibrato = note.vibrato !== "none" ? note.vibrato : beat.barVibrato;
  const dead = note.deadNote || note.deadSlapped || Boolean(note.pickscrape);
  const harmonic = note.harmonic ?? null;

  return {
    dead,
    ghost: note.ghost,
    palmMute: note.palmMute,
    letRing: note.letRing,
    staccato: note.staccato,
    accent: note.accent,
    vibrato,
    hopo: note.hopo || beat.tapping,
    fadeIn: note.fadeIn || note.volumeSwell || beat.dynamicHairpin?.type === "cresc",
    fadeOut: note.fadeOut || beat.dynamicHairpin?.type === "decresc",
    volumeSwell: note.volumeSwell,
    slap: note.slap,
    pop: note.pop,
    deadSlapped: note.deadSlapped,
    pickscrape: Boolean(note.pickscrape),
    bend: Boolean(note.bend),
    bendPoints: note.bend?.points ?? [],
    slide: note.slide ?? null,
    harmonic,
    harmonicShift: harmonicPitchShift(harmonic),
    wah: note.wah ?? null,
    tremoloPicking: note.tremoloPicking ?? null,
    attackSec: note.hopo || beat.tapping ? 0.002 : note.slap || note.pop ? 0.003 : 0.008,
    releaseSec: note.letRing ? 0.16 : note.palmMute ? 0.035 : note.staccato || dead ? 0.025 : 0.07,
    filter: dead ? "dead" : note.palmMute ? "palmMute" : harmonic ? "harmonic" : "none"
  };
}

function durationMultiplierForNote(note: Note): number {
  if (note.staccato || note.deadNote || note.deadSlapped || note.pickscrape) {
    return 0.42;
  }

  if (note.palmMute) {
    return 0.62;
  }

  if (note.letRing || note.volumeSwell) {
    return 1.18;
  }

  if (note.tremoloPicking) {
    return 0.86;
  }

  return 0.92;
}

function harmonicPitchShift(harmonic: Note["harmonic"] | null): number {
  if (!harmonic) {
    return 0;
  }

  if (harmonic.type === "semi") {
    return 7;
  }

  if (harmonic.type === "tapped" && harmonic.touchFret >= 19) {
    return 19;
  }

  return 12;
}

function writtenBarStarts(score: Score): number[] {
  let tick = 0;
  return score.masterBars.map((masterBar) => {
    const start = tick;
    tick += barTheoreticalTicks(masterBar);
    return start;
  });
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
    hopo: false,
    fadeIn: false,
    fadeOut: false,
    volumeSwell: false,
    slap: false,
    pop: false,
    deadSlapped: false,
    pickscrape: false,
    bend: false,
    bendPoints: [],
    slide: null,
    harmonic: null,
    harmonicShift: 0,
    wah: null,
    tremoloPicking: null,
    attackSec: 0.008,
    releaseSec: 0.06,
    filter: "none"
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
