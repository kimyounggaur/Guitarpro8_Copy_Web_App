import { PitchDetector } from "pitchy";
import { NOTE_NAMES_SHARP } from "./chords";
import { frettedMidiPitch } from "./trackKind";
import type { Tuning } from "./types";

export interface PitchDetection {
  frequency: number;
  midi: number;
  noteName: string;
  cents: number;
  clarity: number;
}

export interface TuningTarget {
  string: number;
  frequency: number;
  midi: number;
  noteName: string;
  cents: number;
}

export const TUNER_SAMPLE_COUNT = 4096;
export const DEFAULT_PITCH_CLARITY = 0.9;
export const DEFAULT_TUNER_MEDIAN_COUNT = 5;

let measurement: { length: number; detector: PitchDetector<Float32Array> } | undefined;

export function detectPitchFromBuffer(
  samples: Float32Array,
  sampleRate: number,
  minimumClarity = DEFAULT_PITCH_CLARITY
): PitchDetection | null {
  if (samples.length < 2 || !Number.isFinite(sampleRate) || sampleRate <= 0) {
    return null;
  }
  if (measurement?.length !== samples.length) {
    const detector = PitchDetector.forFloat32Array(samples.length);
    detector.minVolumeAbsolute = 0.01;
    measurement = { detector, length: samples.length };
  }

  const [frequency, clarity] = measurement.detector.findPitch(samples, sampleRate);
  if (!Number.isFinite(frequency) || frequency <= 0 || !Number.isFinite(clarity) || clarity < minimumClarity) {
    return null;
  }
  return pitchDetection(frequency, clarity);
}

export function medianPitch(
  history: readonly PitchDetection[]
): PitchDetection | null {
  if (history.length === 0) return null;
  const ordered = [...history].sort((left, right) => left.frequency - right.frequency);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle];
  return pitchDetection(
    (ordered[middle - 1].frequency + ordered[middle].frequency) / 2,
    Math.min(ordered[middle - 1].clarity, ordered[middle].clarity)
  );
}

function pitchDetection(frequency: number, clarity: number): PitchDetection {
  const pitch = frequencyToMidi(frequency);
  const midi = Math.round(pitch);
  return { frequency, midi, noteName: midiNoteName(midi), cents: Math.round((pitch - midi) * 100), clarity };
}

export function tuningTargets(tuning: Tuning): TuningTarget[] {
  return tuning.strings.map((midi, lowIndex) => {
    const string = tuning.strings.length - lowIndex;
    const targetMidi = frettedMidiPitch(tuning, string, 0) ?? midi + tuning.capo;
    return {
      string,
      midi: targetMidi,
      frequency: midiToFrequency(targetMidi),
      noteName: midiNoteName(targetMidi),
      cents: 0
    };
  });
}

export function nearestTuningTarget(tuning: Tuning, frequency: number): TuningTarget | null {
  const targets = tuningTargets(tuning);

  if (targets.length === 0) {
    return null;
  }

  const nearest = targets.reduce((best, target) =>
    Math.abs(centsBetween(frequency, target.frequency)) < Math.abs(centsBetween(frequency, best.frequency))
      ? target
      : best
  );
  return {
    ...nearest,
    cents: Math.round(centsBetween(frequency, nearest.frequency))
  };
}

export function centsBetween(frequency: number, targetFrequency: number): number {
  return 1200 * Math.log2(frequency / targetFrequency);
}

export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function frequencyToMidi(frequency: number): number {
  return 69 + 12 * Math.log2(frequency / 440);
}

export function midiNoteName(midi: number): string {
  const name = NOTE_NAMES_SHARP[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}
