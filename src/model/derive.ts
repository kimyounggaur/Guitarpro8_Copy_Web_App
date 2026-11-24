import { clefPitchOffset, trackNoteMidiPitch } from "./trackKind";
import {
  TICKS_PER_QUARTER,
  type Beat,
  type MasterBar,
  type Note,
  type Ottava,
  type Track,
  type Tuplet
} from "./types";

export interface WrittenPitchOptions {
  concertTone: boolean;
  ottava?: Ottava;
}

const ottavaOffsets: Record<Ottava, number> = {
  none: 0,
  "8va": -12,
  "8vb": 12,
  "15ma": -24,
  "15mb": 24
};

export function beatDurationTicks(beat: Beat): number {
  const baseTicks = (TICKS_PER_QUARTER * 4) / beat.duration;
  const dottedTicks = baseTicks * dotMultiplier(beat.dots);
  return dottedTicks * tupletMultiplier(beat.tuplet);
}

export function barTheoreticalTicks(masterBar: MasterBar): number {
  return (
    masterBar.timeSignature.numerator *
    TICKS_PER_QUARTER *
    (4 / masterBar.timeSignature.denominator)
  );
}

export function noteMidiPitch(note: Note, track: Track): number {
  const pitch = tryNoteMidiPitch(note, track);
  if (pitch === null) {
    throw new Error(`The note has no valid pitch on the ${track.kind} track.`);
  }
  return pitch;
}

export function tryNoteMidiPitch(note: Note, track: Track): number | null {
  return trackNoteMidiPitch(note, track);
}

export function tryWrittenPitch(note: Note, track: Track, options: WrittenPitchOptions): number | null {
  const pitch = tryNoteMidiPitch(note, track);
  return pitch === null ? null : pitch + writtenPitchOffset(track, options);
}

export function writtenPitch(
  note: Note,
  track: Track,
  options: WrittenPitchOptions
): number {
  return noteMidiPitch(note, track) + writtenPitchOffset(track, options);
}

export function writtenPitchOffset(track: Track, options: WrittenPitchOptions): number {
  const transposition = options.concertTone ? 0 : -track.transpositionTonality.soundingOffset;
  return clefPitchOffset(track.clef) + transposition + ottavaOffsets[options.ottava ?? "none"];
}

function dotMultiplier(dots: number): number {
  if (dots === 1) {
    return 1.5;
  }

  if (dots === 2) {
    return 1.75;
  }

  return 1;
}

function tupletMultiplier(tuplet: Tuplet | undefined): number {
  if (!tuplet) {
    return 1;
  }

  return (tuplet.m / tuplet.n) * tupletMultiplier(tuplet.parent);
}
