export const DIATONIC_STEPS = ["C", "D", "E", "F", "G", "A", "B"] as const;
export const SHARP_ORDER = ["F", "C", "G", "D", "A", "E", "B"] as const;
export const FLAT_ORDER = ["B", "E", "A", "D", "G", "C", "F"] as const;

export type PitchStep = typeof DIATONIC_STEPS[number];
export type PitchAlter = -2 | -1 | 0 | 1 | 2;

export interface SpelledPitch {
  step: PitchStep;
  alter: PitchAlter;
  octave: number;
}

const NATURAL_PITCH_CLASS: Readonly<Record<PitchStep, number>> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11
};

export function keyAlteration(step: PitchStep, fifths: number): -1 | 0 | 1 {
  if (fifths > 0 && SHARP_ORDER.indexOf(step) < fifths) return 1;
  if (fifths < 0 && FLAT_ORDER.indexOf(step) < -fifths) return -1;
  return 0;
}

export function spellPitch(midi: number, fifths: number, prefer?: "sharp" | "flat"): SpelledPitch {
  if (!Number.isInteger(midi)) throw new RangeError("A written pitch must be an integer semitone.");

  const pitchClass = mod12(midi);
  for (const step of DIATONIC_STEPS) {
    const alter = keyAlteration(step, fifths);
    if (mod12(NATURAL_PITCH_CLASS[step] + alter) === pitchClass) {
      return spell(step, alter, midi);
    }
  }

  // A natural tone excluded by the key still uses its natural name. For
  // example, F-natural in G major needs a cancellation on F.
  const natural = DIATONIC_STEPS.find((step) => NATURAL_PITCH_CLASS[step] === pitchClass);
  if (natural) return spell(natural, 0, midi);

  const direction = prefer ?? (fifths < 0 ? "flat" : "sharp");
  const alter = direction === "flat" ? -1 : 1;
  const naturalClass = mod12(pitchClass - alter);
  const step = DIATONIC_STEPS.find((candidate) => NATURAL_PITCH_CLASS[candidate] === naturalClass);
  if (!step) throw new RangeError(`Cannot spell pitch ${midi}.`);
  return spell(step, alter, midi);
}

export function midiForSpelledPitch(pitch: SpelledPitch): number {
  return 12 * (pitch.octave + 1) + NATURAL_PITCH_CLASS[pitch.step] + pitch.alter;
}

function spell(step: PitchStep, alter: PitchAlter, midi: number): SpelledPitch {
  return { step, alter, octave: Math.floor((midi - alter) / 12) - 1 };
}

function mod12(value: number): number {
  return ((value % 12) + 12) % 12;
}
