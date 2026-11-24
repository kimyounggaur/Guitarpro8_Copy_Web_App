import { expect, it } from "vitest";
import { layoutAccidentals, type AccidentalNote } from "./accidentals";

function note(
  id: string,
  alter: -2 | -1 | 0 | 1 | 2,
  position = 8,
  octave = 5
): AccidentalNote {
  return { id, position, pitch: { step: "F", alter, octave } };
}

it("tracks alterations per staff octave and cancels the G major F-sharp once", () => {
  const marks = layoutAccidentals([
    [note("numericF", 1)],
    [note("firstNatural", 0)],
    [note("repeatedNatural", 0)],
    [note("anotherOctave", 0, 1, 4)],
    [note("restoredSharp", 1)]
  ], 1);

  expect(marks.map(({ id, glyph }) => [id, glyph])).toEqual([
    ["firstNatural", "accidentalNatural"],
    ["anotherOctave", "accidentalNatural"],
    ["restoredSharp", "accidentalSharp"]
  ]);
});

it("suppresses tie continuations and keeps courtesy accidentals", () => {
  const marks = layoutAccidentals([
    [{ ...note("previousBarTie", 0), tiedFromPrevious: true }],
    [{ ...note("courtesy", 0), tiedFromPrevious: true, forceAccidental: true }],
    [note("freshAttack", 0)],
    [{ ...note("forcedRepeat", 0), forceAccidental: true }]
  ], 1);

  expect(marks.map(({ id }) => id)).toEqual(["courtesy", "freshAttack", "forcedRepeat"]);
});

it("stacks nearby alterations in left columns and reuses the first column after six steps", () => {
  const bottom = { ...note("bottom", -1, 0, 4), pitch: { step: "E", alter: -1, octave: 4 } } as const;
  const middle = note("middle", 1, 5, 4);
  const top = note("top", 1, 8);
  expect(layoutAccidentals([[bottom, top, middle]], 0).map(({ id, column }) => [id, column])).toEqual([
    ["top", 0],
    ["middle", 1],
    ["bottom", 0]
  ]);
});
