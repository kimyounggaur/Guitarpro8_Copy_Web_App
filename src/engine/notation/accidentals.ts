import { keyAlteration, type PitchAlter, type SpelledPitch } from "./pitchSpelling";

export const ACCIDENTAL_GLYPHS = {
  [-2]: "accidentalDoubleFlat",
  [-1]: "accidentalFlat",
  [0]: "accidentalNatural",
  [1]: "accidentalSharp",
  [2]: "accidentalDoubleSharp"
} as const;

export interface AccidentalNote {
  id: string;
  pitch: SpelledPitch;
  position: number;
  tiedFromPrevious?: boolean;
  forceAccidental?: boolean;
}

export interface AccidentalMark {
  id: string;
  glyph: typeof ACCIDENTAL_GLYPHS[PitchAlter];
  position: number;
  column: number;
}

export function layoutAccidentals(beats: readonly (readonly AccidentalNote[])[], fifths: number): AccidentalMark[] {
  const state = new Map<string, PitchAlter>();
  const marks: AccidentalMark[] = [];

  for (const beat of beats) {
    const changes: Omit<AccidentalMark, "column">[] = [];
    for (const note of [...beat].sort((first, second) => first.position - second.position)) {
      const { step, octave, alter } = note.pitch;
      const key = `${step}:${octave}`;
      const current = state.get(key) ?? keyAlteration(step, fifths);

      // A tie entering this measure doesn't change its accidental state for
      // subsequent attacks. An explicit courtesy marking still prints.
      if (!note.tiedFromPrevious) {
        state.set(key, alter);
      }

      if (note.forceAccidental || (!note.tiedFromPrevious && alter !== current)) {
        changes.push({ id: note.id, glyph: ACCIDENTAL_GLYPHS[alter], position: note.position });
      }
    }

    const lowestInColumn: number[] = [];
    for (const change of changes.reverse()) {
      const openColumn = lowestInColumn.findIndex((lowest) => lowest - change.position >= 6);
      const column = openColumn < 0 ? lowestInColumn.length : openColumn;
      lowestInColumn[column] = change.position;
      marks.push({ ...change, column });
    }
  }
  return marks;
}
