import { expect, it } from "vitest";
import { defaultCursor, insertBarAtCursor, tieCurrentNoteFromPrevious } from "../engine/editing/operations";
import { layoutScore } from "../engine/layout/layoutScore";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "./factory";
import { findTieOrigin, normalizeTies } from "./ties";

function scoreWithTie() {
  const score = createEmptyScore();
  const track = createTrack(undefined, 2);
  score.masterBars = [createMasterBar(), createMasterBar()];
  score.tracks = [track];
  const first = createNote(2, 5);
  const second = { ...createNote(2, 7), tiedFromPrevious: true };
  track.bars[0].voices[0].beats = [createBeat({ duration: 1, rest: false, notes: [first] })];
  track.bars[1].voices[0].beats = [createBeat({ duration: 1, rest: false, notes: [second] })];
  return { score, first, second, track };
}

it("[B1] resolves across a barline and realigns the fret", () => {
  const { score, second, track } = scoreWithTie();
  const end = { trackId: track.id, barIndex: 1, voiceIndex: 0, beatIndex: 0, noteIndex: 0 };
  expect(findTieOrigin(score, end)).toEqual({ ...end, barIndex: 0 });
  expect(normalizeTies(score)).toEqual([]);
  expect(second.fret).toBe(5);
});

it("[B1] removes a tie if its original note is deleted or separated by a rest", () => {
  const a = scoreWithTie();
  a.track.bars[0].voices[0].beats[0].notes = [];
  expect(normalizeTies(a.score)).toMatchObject([{ code: "tie-orphan", severity: "warning" }]);
  expect(a.second.tiedFromPrevious).toBeUndefined();

  const b = scoreWithTie();
  insertBarAtCursor(b.score, { ...defaultCursor(b.score), barIndex: 1 });
  expect(normalizeTies(b.score)).toMatchObject([{ code: "tie-orphan" }]);
  expect(b.second.tiedFromPrevious).toBeUndefined();
});

it("[B1] fills an empty beat from the selected previous string and never self-ties", () => {
  const { score, track } = scoreWithTie();
  const initial = { ...defaultCursor(score), string: 2 };
  tieCurrentNoteFromPrevious(score, initial);
  expect(track.bars[0].voices[0].beats[0].notes[0].tiedFromPrevious).toBeUndefined();

  const empty = createBeat({ duration: 1 });
  track.bars[1].voices[0].beats = [empty];
  tieCurrentNoteFromPrevious(score, { ...initial, barIndex: 1 });
  expect(empty.rest).toBe(false);
  expect(empty.notes).toMatchObject([{ string: 2, fret: 5, tiedFromPrevious: true }]);
});

it("[B1] draws two half arcs across a system break and removes both after deleting the original", () => {
  const { score, track } = scoreWithTie();
  score.masterBars[0].layout.forcedBreak = true;
  normalizeTies(score);
  const arcs = () => layoutScore(score).pages.flatMap(({ primitives }) => primitives)
    .filter(({ id }) => id.endsWith("-tie-start") || id.endsWith("-tie-end"))
    .map(({ id }) => id);

  expect(arcs()).toEqual([
    `${track.id}-0-0-0-0-tie-end`,
    `${track.id}-1-0-0-0-tie-start`
  ]);
  track.bars[0].voices[0].beats[0].notes = [];
  normalizeTies(score);
  expect(arcs()).toEqual([]);
});
