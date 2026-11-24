import { noteTieIdentity } from "../../model/trackKind";
import { beatDurationTicks, tryNoteMidiPitch } from "../../model/derive";
import { TICKS_PER_QUARTER, type Beat, type Note, type Score } from "../../model/types";
import type { PlaybackSegment, UnrollResult } from "../unroll/unrollScore";
import { buildTempoMap, writtenBarStarts, type PlaybackSpeedOverride, type TempoMap } from "./tempoMap";
import { hairpinVelocity, naturalHarmonicInterval, resolveSimileBar, strokeOffsets, swingBeat } from "./playbackExpression";

export interface NoteEvent {
  id: string;
  timeSec: number;
  durationSec: number;
  startTick: number;
  writtenTick: number;
  durationTicks: number;
  midiPitch: number;
  percussion?: boolean;
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
  trill?: { secondPitch: number; ticksPerStroke: number };
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

interface SoundingNote {
  event: NoteEvent;
  endTick: number;
}

export function compilePlayback(
  score: Score,
  unrolled: UnrollResult,
  speedOverride: PlaybackSpeedOverride = { mode: "relative", percent: 100 }
): PlaybackCompilation {
  const tempoMap = buildTempoMap(score, unrolled.segments, speedOverride);
  const writtenStarts = writtenBarStarts(score);
  const soundingNotes = new Map<string, SoundingNote>();
  const events = unrolled.segments.flatMap((segment) =>
    compileSegment(score, segment, tempoMap, writtenStarts, soundingNotes)
  );
  const voicedEvents = events.flatMap((event) => expandTrill(event, tempoMap));
  for (const event of voicedEvents) {
    if (event.noteIndex >= 0) {
      const endSec = tempoMap.ticksToSeconds(event.startTick + event.durationTicks);
      event.durationSec = Math.max(0.035, endSec - event.timeSec);
    }
  }
  const sortedEvents = voicedEvents.sort((left, right) => left.timeSec - right.timeSec || left.midiPitch - right.midiPitch);
  return assemblePlaybackCompilation(unrolled, sortedEvents, tempoMap);
}

export function assemblePlaybackCompilation(unrolled: UnrollResult, events: NoteEvent[], tempoMap: TempoMap): PlaybackCompilation {
  return {
    events,
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
  soundingNotes: Map<string, SoundingNote>
): NoteEvent[] {
  const events: NoteEvent[] = [];
  const writtenStart = writtenStarts[segment.barIndex] ?? 0;
  const sourceBar = resolveSimileBar(score.masterBars, segment.barIndex);
  const feel = score.masterBars[segment.barIndex].tripletFeel;

  score.tracks.forEach((track) => {
    const bar = track.bars[sourceBar];

    bar?.voices.forEach((voice, voiceIndex) => {
      let beatTick = 0;

      voice.beats.forEach((beat, beatIndex) => {
        const writtenDuration = beatDurationTicks(beat);
        const rhythm = swingBeat(feel, beat, beatTick, writtenDuration);
        const durationTicks = Math.min(segment.durationTicks - rhythm.start, rhythm.duration);
        const startTick = segment.startTick + rhythm.start;
        const writtenTick = writtenStart + beatTick;

        if (!beat.rest && durationTicks > 0) {
          beat.graceNotes.forEach((grace, graceIndex) => {
            const graceTick = Math.max(segment.startTick, startTick - (grace.onBeat ? 0 : TICKS_PER_QUARTER / 16));
            const graceWrittenTick = Math.max(writtenStart, writtenTick - (grace.onBeat ? 0 : TICKS_PER_QUARTER / 16));
            const midiPitch = tryNoteMidiPitch(defaultNote(grace.string, grace.fret), track);
            if (midiPitch === null) return;
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
              effects: { ...defaultEffects(), hopo: true, attackSec: 0.002 }
            });
          });

          const offsets = strokeOffsets(beat, durationTicks);
          beat.notes.forEach((note, noteIndex) => {
            const offset = offsets[noteIndex];
            const velocityOffset = hairpinVelocity(voice.beats, beatIndex, offset);
            const event = noteEvent(
                score,
                track.id,
                segment,
                beat,
                note,
                voiceIndex,
                beatIndex,
                noteIndex,
                startTick + offset,
                writtenTick,
                durationTicks - offset,
                velocityOffset,
                tempoMap
            );
            if (!event) return;

            const key = JSON.stringify([track.id, voiceIndex, noteTieIdentity(note, track)]);
            const previous = soundingNotes.get(key);
            const endTick = startTick + durationTicks;
            if (note.tiedFromPrevious && previous
              && Math.abs(previous.endTick - startTick) < 1e-6
              && previous.event.midiPitch === event.midiPitch) {
              previous.event.durationTicks = endTick - previous.event.startTick;
              previous.endTick = endTick;
            } else {
              events.push(event);
              soundingNotes.set(key, { event, endTick });
            }
          });
        }

        beatTick += writtenDuration;
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
  velocityOffset: number,
  tempoMap: TempoMap
): NoteEvent | null {
  const track = score.tracks.find((candidate) => candidate.id === trackId);

  if (!track) {
    throw new Error(`Unknown track for playback: ${trackId}`);
  }

  const midiPitch = tryNoteMidiPitch(note, track);
  if (midiPitch === null) return null;

  const effects = noteEffects(note, beat);
  let soundingPitch = midiPitch;
  if (track.kind === "stringed" && note.harmonic?.type === "natural") {
    const openPitch = tryNoteMidiPitch({ ...note, fret: 0 }, track);
    if (openPitch === null) return null;
    soundingPitch = openPitch + naturalHarmonicInterval(note.harmonic);
    effects.harmonicShift = soundingPitch - midiPitch;
  } else if (track.kind !== "percussion") {
    soundingPitch += effects.harmonicShift;
  }
  if (track.kind === "stringed" && note.trill) {
    const secondPitch = tryNoteMidiPitch({ ...note, fret: note.trill.secondFret }, track);
    if (secondPitch !== null) {
      effects.trill = { secondPitch, ticksPerStroke: TICKS_PER_QUARTER * 4 / note.trill.speed };
    }
  }
  const durationMultiplier = durationMultiplierForNote(note);
  const effectiveDurationTicks = Math.max(TICKS_PER_QUARTER / 32, durationTicks * durationMultiplier);
  const timeSec = tempoMap.ticksToSeconds(startTick);

  return {
    id: `${track.id}-${segment.sequenceIndex}-${voiceIndex}-${beatIndex}-${noteIndex}`,
    timeSec,
    durationSec: 0,
    startTick,
    writtenTick,
    durationTicks: effectiveDurationTicks,
    midiPitch: soundingPitch,
    percussion: track.kind === "percussion",
    velocity: clamp(velocityForNote(note) + velocityOffset, 1, 127),
    trackId: track.id,
    barIndex: segment.barIndex,
    voiceIndex,
    beatIndex,
    noteIndex,
    string: note.string,
    effects
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
    fadeIn: note.fadeIn || note.volumeSwell,
    fadeOut: note.fadeOut,
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

function expandTrill(event: NoteEvent, tempoMap: TempoMap): NoteEvent[] {
  const trill = event.effects.trill;
  if (!trill || trill.ticksPerStroke <= 0 || !Number.isFinite(trill.ticksPerStroke)) return [event];

  const expanded: NoteEvent[] = [];
  for (let offset = 0; offset < event.durationTicks; offset += trill.ticksPerStroke) {
    const startTick = event.startTick + offset;
    expanded.push({
      ...event,
      id: `${event.id}-trill-${expanded.length}`,
      startTick,
      timeSec: tempoMap.ticksToSeconds(startTick),
      durationTicks: Math.min(trill.ticksPerStroke, event.durationTicks - offset),
      midiPitch: expanded.length % 2 ? trill.secondPitch : event.midiPitch
    });
  }
  return expanded;
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
