import { parseChordSymbol, transposeChordSymbol } from "../../model/chords";
import { assignFingerings, handPosition } from "../../model/fingering";
import { keyFifths, keyFromFifths } from "../../model/keys";
import { frettedMidiPitch, isMidiPitch, trackNoteMidiPitch } from "../../model/trackKind";
import { DIATONIC_STEPS, keyAlteration, midiForSpelledPitch, spellPitch, type PitchAlter } from "../notation/pitchSpelling";
import { diatonicIndex } from "../notation/staffPosition";
import type { KeySignature, Note, Score, Track } from "../../model/types";
import type { CursorPosition, SelectionRange } from "../editing/types";

export type TransposeRange = "selection" | "allBars";
export type TransposeTarget = "currentTrack" | "allTracks";
export type TransposeMode = "semitones" | "chromatic" | "diatonic";

export interface TransposeOptions {
  range: TransposeRange;
  target: TransposeTarget;
  mode: TransposeMode;
  semitones: number;
  chromaticInterval: number;
  chromaticQuality: "minor" | "major" | "perfect" | "diminished" | "augmented";
  chromaticDirection: "up" | "down";
  chromaticOctaves: number;
  diatonicSteps: number;
  includeChordNames: boolean;
  includeKeySignatures?: boolean;
}

export function transposeScore(
  score: Score,
  cursor: CursorPosition,
  selection: SelectionRange | null,
  options: TransposeOptions
): number {
  const semitones = semitonesForOptions(options);
  const barRange = barRangeForOptions(score, cursor, selection, options.range);
  let unchangedNotes = 0;

  for (const track of score.tracks) {
    if (track.kind === "percussion" || (options.target === "currentTrack" && track.id !== cursor.trackId)) continue;
    const previousFrets = [0, 0, 0, 0];

    for (let barIndex = barRange.start; barIndex <= barRange.end; barIndex += 1) {
      const bar = track.bars[barIndex];
      const key = score.masterBars[barIndex]?.keySignature;
      if (!bar || !key) continue;

      const pitchTarget = (midi: number) => options.mode === "diatonic"
        ? transposeDiatonicPitch(midi, key, options.diatonicSteps)
        : midi + semitones;

      bar.voices.forEach((voice, voiceIndex) => {
        for (const beat of voice.beats) {
          if (options.includeChordNames && beat.chordId) {
            const chord = parseChordSymbol(beat.chordId);
            if (chord) {
              const rootMidi = chord.root + 60;
              beat.chordId = transposeChordSymbol(beat.chordId, pitchTarget(rootMidi) - rootMidi);
            }
          }

          if (track.kind === "stringed") {
            for (const grace of beat.graceNotes) {
              const pitch = frettedMidiPitch(track.tuning, grace.string, grace.fret);
              const midi = pitch === null ? null : pitchTarget(pitch);
              const [placement] = assignFingerings(track.tuning, [{
                midi: isMidiPitch(midi) ? midi : null,
                preferredString: grace.string,
                fallback: grace
              }], previousFrets[voiceIndex], 30);
              if (placement?.matched) {
                grace.string = placement.string;
                grace.fret = placement.fret;
              } else {
                unchangedNotes += 1;
              }
            }
          }
          unchangedNotes += transposeNotes(track, beat.notes, pitchTarget, previousFrets[voiceIndex]);
          if (track.kind === "stringed" && beat.notes.length > 0) previousFrets[voiceIndex] = handPosition(beat.notes);
        }
      });
    }
  }

  if (options.includeKeySignatures && options.target === "allTracks" && options.mode !== "diatonic") {
    for (let index = barRange.start; index <= barRange.end; index += 1) {
      const bar = score.masterBars[index];
      if (bar) bar.keySignature = transposeKeySignature(bar.keySignature, semitones);
    }
  }
  return unchangedNotes;
}

function transposeNotes(
  track: Track, notes: Note[], pitchTarget: (pitch: number) => number, previousFret: number
): number {
  const targets = notes.map((note) => {
    const pitch = trackNoteMidiPitch(note, track);
    const midi = pitch === null ? null : pitchTarget(pitch);
    return isMidiPitch(midi) ? midi : null;
  });

  if (track.kind === "pitched") {
    return targets.reduce<number>((failures, midi, index) => {
      if (midi === null) return failures + 1;
      notes[index].midiPitch = midi;
      return failures;
    }, 0);
  }

  const placements = assignFingerings(track.tuning, targets.map((midi, index) => ({
    midi,
    preferredString: notes[index].string,
    fallback: notes[index]
  })), previousFret, 30);
  return placements.reduce<number>((failures, placement, index) => {
    if (!placement?.matched) return failures + 1;
    notes[index].string = placement.string;
    notes[index].fret = placement.fret;
    return failures;
  }, 0);
}

function transposeDiatonicPitch(midi: number, key: KeySignature, steps: number): number {
  const fifths = keyFifths(key);
  const pitch = spellPitch(midi, fifths);
  const index = diatonicIndex(pitch) + Math.round(steps);
  const octave = Math.floor(index / DIATONIC_STEPS.length);
  const step = DIATONIC_STEPS[index - octave * DIATONIC_STEPS.length];
  const chromaticOffset = pitch.alter - keyAlteration(pitch.step, fifths);
  return midiForSpelledPitch({ step, octave, alter: (keyAlteration(step, fifths) + chromaticOffset) as PitchAlter });
}

function transposeKeySignature(key: KeySignature, semitones: number): KeySignature {
  if (semitones % 12 === 0) return key;
  const source = keyFifths(key);
  const wanted = mod12(7 * source + semitones);
  const choices = Array.from({ length: 15 }, (_, index) => index - 7)
    .filter((candidate) => mod12(7 * candidate) === wanted);
  const fifths = choices.sort((left, right) => Math.abs(left) - Math.abs(right) ||
    (source < 0 ? left - right : right - left))[0];
  return keyFromFifths(fifths, key.mode);
}

function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}

export function semitonesForOptions(options: TransposeOptions): number {
  if (options.mode === "semitones") {
    return clamp(Math.round(options.semitones), -24, 24);
  }

  if (options.mode === "chromatic") {
    const base = chromaticSemitone(options.chromaticInterval, options.chromaticQuality);
    const direction = options.chromaticDirection === "up" ? 1 : -1;
    return direction * (base + Math.max(0, options.chromaticOctaves) * 12);
  }

  return diatonicSemitones(options.diatonicSteps);
}

function barRangeForOptions(
  score: Score,
  cursor: CursorPosition,
  selection: SelectionRange | null,
  range: TransposeRange
): { start: number; end: number } {
  if (range === "selection" && selection) {
    return {
      start: Math.max(0, Math.min(selection.anchor.barIndex, selection.head.barIndex)),
      end: Math.min(score.masterBars.length - 1, Math.max(selection.anchor.barIndex, selection.head.barIndex))
    };
  }

  if (range === "selection") {
    return { start: cursor.barIndex, end: cursor.barIndex };
  }

  return { start: 0, end: Math.max(0, score.masterBars.length - 1) };
}

function chromaticSemitone(
  interval: number,
  quality: TransposeOptions["chromaticQuality"]
): number {
  const majorOrPerfect: Record<number, number> = {
    1: 0,
    2: 2,
    3: 4,
    4: 5,
    5: 7,
    6: 9,
    7: 11
  };
  const base = majorOrPerfect[clamp(interval, 1, 7)] ?? 0;
  const perfectInterval = interval === 1 || interval === 4 || interval === 5;

  if (quality === "perfect") {
    return base;
  }

  if (quality === "minor" && !perfectInterval) {
    return Math.max(0, base - 1);
  }

  if (quality === "diminished") {
    return Math.max(0, base - (perfectInterval ? 1 : 2));
  }

  if (quality === "augmented") {
    return base + 1;
  }

  return base;
}

function diatonicSemitones(steps: number): number {
  const majorDegrees = [0, 2, 4, 5, 7, 9, 11];
  const sign = steps < 0 ? -1 : 1;
  const absolute = Math.abs(Math.round(steps));
  const octaves = Math.floor(absolute / 7);
  const degree = absolute % 7;
  return sign * (octaves * 12 + majorDegrees[degree]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
