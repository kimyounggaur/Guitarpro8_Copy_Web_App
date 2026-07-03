import { transposeChordSymbol } from "../../model/chords";
import type { Score } from "../../model/types";
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
}

export function transposeScore(
  score: Score,
  cursor: CursorPosition,
  selection: SelectionRange | null,
  options: TransposeOptions
): void {
  const semitones = semitonesForOptions(options);
  const barRange = barRangeForOptions(score, cursor, selection, options.range);
  const targetTrackIds =
    options.target === "allTracks"
      ? new Set(score.tracks.map((track) => track.id))
      : new Set([cursor.trackId].filter((trackId): trackId is string => Boolean(trackId)));

  score.tracks
    .filter((track) => targetTrackIds.has(track.id))
    .forEach((track) => {
      for (let barIndex = barRange.start; barIndex <= barRange.end; barIndex += 1) {
        const bar = track.bars[barIndex];

        if (!bar) {
          continue;
        }

        bar.voices.forEach((voice) => {
          voice.beats.forEach((beat) => {
            if (options.includeChordNames && beat.chordId) {
              beat.chordId = transposeChordSymbol(beat.chordId, semitones);
            }

            beat.notes.forEach((note) => {
              note.fret = Math.max(0, note.fret + semitones);
            });
          });
        });
      }
    });
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
