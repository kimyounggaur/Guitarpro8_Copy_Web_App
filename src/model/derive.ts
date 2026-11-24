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
  if (note.midiPitch !== undefined) {
    return note.midiPitch;
  }

  if (note.midiNumber !== undefined) {
    return note.midiNumber;
  }

  const pitch = tryNoteMidiPitch(note, track);
  if (pitch === null) {
    throw new Error(`String ${note.string} is outside the track tuning`);
  }
  return pitch;
}

export function tryNoteMidiPitch(note: Note, track: Track): number | null {
  const open = track.tuning.strings[track.tuning.strings.length - note.string];
  const pitch = note.midiPitch ?? note.midiNumber
    ?? (open === undefined ? NaN : open + effectiveCapoForString(note.string, track) + note.fret);
  return Number.isFinite(pitch) ? pitch : null;
}

export function tryWrittenPitch(note: Note, track: Track, options: WrittenPitchOptions): number | null {
  const pitch = tryNoteMidiPitch(note, track);
  return pitch === null ? null : transposeWrittenPitch(pitch, track, options);
}

export function writtenPitch(
  note: Note,
  track: Track,
  options: WrittenPitchOptions
): number {
  return transposeWrittenPitch(noteMidiPitch(note, track), track, options);
}

function transposeWrittenPitch(soundingPitch: number, track: Track, options: WrittenPitchOptions): number {
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

function effectiveCapoForString(stringNumber: number, track: Track): number {
  const partial = track.tuning.partialCapo;

  if (!partial || !partial.strings.includes(stringNumber)) {
    return track.tuning.capo;
  }

  return Math.max(track.tuning.capo, partial.fret);
}
