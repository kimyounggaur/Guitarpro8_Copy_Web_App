import { expect, it } from "vitest";
import { defaultCursor, insertBarAtCursor } from "../../engine/editing/operations";
import { layoutScore } from "../../engine/layout/layoutScore";
import { barTheoreticalTicks, beatDurationTicks } from "../../model/derive";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { instrumentById } from "../../model/instruments";

it("[A4] a guitar's low open E sits three ledger lines below the treble staff", () => {
  const score = createEmptyScore();
  const track = createTrack();
  score.tracks = [track];
  track.bars[0].voices[0].beats = [createBeat({ duration: 1, rest: false, notes: [createNote(6, 0)] })];

  const { primitives } = layoutScore(score).pages[0];
  const staffTop = primitives.find((primitive) => primitive.id === `${track.id}-standard-line-0`);
  const staffBottom = primitives.find((primitive) => primitive.id === `${track.id}-standard-line-4`);
  const head = primitives.find((primitive) => primitive.type === "ellipse" && primitive.hit?.kind === "note");
  if (staffTop?.type !== "line" || staffBottom?.type !== "line" || head?.type !== "ellipse") {
    throw new Error("Expected a standard staff and its open E note head");
  }

  const staffStep = (staffBottom.y1 - staffTop.y1) / 8;
  expect(head.cy).toBeCloseTo(staffBottom.y1 + 7 * staffStep);
  expect(primitives.filter((primitive) =>
    primitive.type === "line" && primitive.y1 === primitive.y2 &&
    primitive.y1 > staffBottom.y1 && primitive.y1 < head.cy &&
    primitive.x1 < head.cx && primitive.x2 > head.cx
  )).toHaveLength(3);
});

it("[A6] all eight tracks of a page system fit inside the actual page", () => {
  const score = createEmptyScore();
  score.tracks = Array.from({ length: 8 }, () => createTrack());
  const { pages } = layoutScore(score);

  const trackBounds = pages.flatMap((page) => page.primitives.flatMap((primitive) =>
    primitive.hit?.kind === "track"
      ? [{ id: primitive.hit.ref.trackId, bottom: primitive.hit.bbox.y + primitive.hit.bbox.height, pageHeight: page.height }]
      : []
  ));

  expect(new Set(trackBounds.map(({ id }) => id)).size).toBe(8);
  expect(Math.max(...trackBounds.map(({ bottom, pageHeight }) => bottom - pageHeight))).toBeLessThanOrEqual(0);
});

it("[B4] the drum kit uses a percussion staff without a string TAB band", () => {
  const score = createEmptyScore();
  const drum = instrumentById("drums");
  const track = createTrack({
    ...drum,
    strings: drum.tuning,
    tuningLabel: drum.tuningLabel
  });
  score.tracks = [track];
  track.bars[0].voices[0].beats = [
    createBeat({ rest: false, notes: [{ ...createNote(), midiNumber: 36 }] })
  ];

  const { primitives } = layoutScore(score).pages[0];
  expect(primitives.some((primitive) =>
    primitive.hit?.kind === "note" && primitive.hit.ref.trackId === track.id
  )).toBe(true);
  expect(primitives.some((primitive) => primitive.id.startsWith(`${track.id}-tab-line-`))).toBe(false);
});

it("[B10] an inserted bar inherits the surrounding 3/4 meter and G key", () => {
  const score = createEmptyScore();
  const master = createMasterBar();
  master.timeSignature.numerator = 3;
  master.keySignature.key = "G";
  score.masterBars = [master];
  score.tracks = [createTrack()];
  insertBarAtCursor(score, defaultCursor(score));

  expect(score.masterBars.map((bar) => barTheoreticalTicks(bar))).toEqual([1440, 1440]);
  expect(score.masterBars[0].keySignature.key).toBe("G");
  expect(score.tracks[0].bars[0].voices[0].beats.reduce((ticks, beat) =>
    ticks + beatDurationTicks(beat), 0)).toBe(1440);
});
