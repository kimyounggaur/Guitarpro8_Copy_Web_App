import { beatDurationTicks } from "../../model/derive";
import { TICKS_PER_QUARTER, type Beat, type MasterBar, type Note } from "../../model/types";

export function swingBeat(
  feel: MasterBar["tripletFeel"],
  beat: Beat,
  start: number,
  duration: number
): { start: number; duration: number } {
  const swingDuration = feel === "8th" ? 8 : feel === "16th" ? 16 : null;
  if (beat.duration !== swingDuration || beat.dots || beat.tuplet) return { start, duration };
  const pairDuration = duration * 2;
  const phase = start % pairDuration;
  const epsilon = 1e-6;
  if (phase < epsilon || pairDuration - phase < epsilon) {
    return { start, duration: pairDuration * 2 / 3 };
  }
  if (Math.abs(phase - duration) < epsilon) {
    return { start: start + duration / 3, duration: pairDuration / 3 };
  }
  return { start, duration };
}

export function resolveSimileBar(bars: MasterBar[], barIndex: number): number {
  let source = barIndex;
  while (source > 0) {
    const mark = bars[source].simileMark;
    if (mark === "single") {
      source--;
    } else if (source >= 2 && (mark === "double" || (source >= 3 && bars[source - 1].simileMark === "double"))) {
      source -= 2;
    } else {
      break;
    }
  }
  return source;
}

export function strokeOffsets(beat: Beat, duration: number): number[] {
  const stroke = beat.arpeggio ?? beat.brush;
  if (!stroke || beat.notes.length < 2) return beat.notes.map(() => 0);

  const unit = TICKS_PER_QUARTER / (beat.arpeggio ? 8 : 32);
  const delay = Math.min(Math.max(0, stroke.delay) * unit, duration * 0.35);
  const interval = Math.min(Math.max(0, stroke.speed) * unit, (duration * 0.85 - delay) / (beat.notes.length - 1));
  const ordered = beat.notes.map((note, index) => ({ note, index }));
  ordered.sort((a, b) => {
    const direction = stroke.direction === "down" ? 1 : -1;
    const strings = b.note.string - a.note.string;
    const pitches = (a.note.midiPitch ?? 0) - (b.note.midiPitch ?? 0);
    return (strings || pitches) * direction;
  });

  const offsets: number[] = [];
  ordered.forEach(({ index }, rank) => {
    offsets[index] = delay + rank * interval;
  });
  return offsets;
}

export function hairpinVelocity(beats: Beat[], index: number, phase: number): number {
  const type = beats[index]?.dynamicHairpin?.type;
  if (!type) return 0;
  let first = index;
  let last = index;
  while (first > 0 && beats[first - 1].dynamicHairpin?.type === type) first--;
  while (last + 1 < beats.length && beats[last + 1].dynamicHairpin?.type === type) last++;

  const run = beats.slice(first, last + 1);
  const total = run.reduce((sum, beat) => sum + beatDurationTicks(beat), 0);
  const elapsed = run.slice(0, index - first).reduce((sum, beat) => sum + beatDurationTicks(beat), phase);
  const direction = type === "cresc" ? 1 : -1;
  return Math.round((elapsed / total - 0.5) * 24 * direction);
}

export function naturalHarmonicInterval(harmonic: NonNullable<Note["harmonic"]>): number {
  const fret = harmonic.touchFret;
  if (fret === 7 || fret === 19) return 19;
  if (fret === 5 || fret === 24) return 24;
  if (fret === 4 || fret === 9 || fret === 16) return 28;
  return 12;
}
