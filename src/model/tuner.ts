import { NOTE_NAMES_SHARP } from "./chords";
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

export function detectPitchFromBuffer(samples: Float32Array, sampleRate: number): PitchDetection | null {
  const rms = Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / Math.max(1, samples.length));

  if (rms < 0.01) {
    return null;
  }

  let bestOffset = -1;
  let bestCorrelation = 0;
  const minOffset = Math.floor(sampleRate / 1200);
  const maxOffset = Math.min(samples.length - 1, Math.floor(sampleRate / 45));

  for (let offset = minOffset; offset <= maxOffset; offset += 1) {
    let correlation = 0;

    for (let index = 0; index < samples.length - offset; index += 1) {
      correlation += samples[index] * samples[index + offset];
    }

    correlation /= samples.length - offset;

    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    }
  }

  if (bestOffset <= 0 || bestCorrelation < 0.001) {
    return null;
  }

  const frequency = sampleRate / bestOffset;
  const midi = frequencyToMidi(frequency);
  const nearestMidi = Math.round(midi);
  return {
    frequency,
    midi: nearestMidi,
    noteName: midiNoteName(nearestMidi),
    cents: Math.round((midi - nearestMidi) * 100),
    clarity: Math.min(1, bestCorrelation / Math.max(0.0001, rms * rms))
  };
}

export function tuningTargets(tuning: Tuning): TuningTarget[] {
  return tuning.strings.map((midi, lowIndex) => {
    const string = tuning.strings.length - lowIndex;
    const targetMidi = midi + tuning.capo;
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
