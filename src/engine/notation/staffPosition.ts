import { DIATONIC_STEPS, keyAlteration, type SpelledPitch } from "./pitchSpelling";

export type Clef = "treble" | "treble8vb" | "bass" | "bass8vb" | "percussion";

export function diatonicIndex(pitch: SpelledPitch): number {
  return pitch.octave * DIATONIC_STEPS.length + DIATONIC_STEPS.indexOf(pitch.step);
}

export function clefBottomLine(clef: Clef): number {
  return clef === "bass" || clef === "bass8vb" ? 18 : 30;
}

export function clefDisplayOffset(clef: Clef): number {
  return clef === "treble8vb" || clef === "bass8vb" ? 12 : 0;
}

export function staffPosition(written: SpelledPitch, clef: Clef): number {
  return diatonicIndex(written) - clefBottomLine(clef);
}

export function pitchAtStaffPosition(position: number, clef: Clef, fifths: number): SpelledPitch {
  const index = Math.round(position) + clefBottomLine(clef);
  const octave = Math.floor(index / DIATONIC_STEPS.length);
  const step = DIATONIC_STEPS[index - octave * DIATONIC_STEPS.length];
  return { step, alter: keyAlteration(step, fifths), octave };
}

export function ledgerLines(position: number): number[] {
  if (!Number.isFinite(position)) return [];
  const lines: number[] = [];
  for (let line = -2; line >= position; line -= 2) lines.push(line);
  for (let line = 10; line <= position; line += 2) lines.push(line);
  return lines;
}

export function positionToY(position: number, staffTop: number, space: number): number {
  return staffTop + (8 - position) * space / 2;
}
