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
  const openStringPitch = stringPitch(note.string, track);
  return openStringPitch + effectiveCapoForString(note.string, track) + note.fret;
}

export function writtenPitch(
  note: Note,
  track: Track,
  options: WrittenPitchOptions
): number {
  const soundingPitch = noteMidiPitch(note, track);
  const transposedPitch = options.concertTone
    ? soundingPitch
    : soundingPitch - track.transpositionTonality.soundingOffset;

  return transposedPitch + ottavaOffsets[options.ottava ?? "none"];
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

function stringPitch(stringNumber: number, track: Track): number {
  const index = track.tuning.strings.length - stringNumber;
  const pitch = track.tuning.strings[index];

  if (pitch === undefined) {
    throw new Error(`String ${stringNumber} is outside the track tuning`);
  }

  return pitch;
}

function effectiveCapoForString(stringNumber: number, track: Track): number {
  const partial = track.tuning.partialCapo;

  if (!partial || !partial.strings.includes(stringNumber)) {
    return track.tuning.capo;
  }

  return Math.max(track.tuning.capo, partial.fret);
}
