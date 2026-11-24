import { expect, it } from "vitest";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { resolvePageMetrics } from "../../model/stylesheet";
import { layoutScore } from "./layoutScore";
import { createMeasureContents } from "./measureContents";
import { NOTE_HEAD_WIDTH, SYSTEM_LABEL_WIDTH } from "./metrics";
import { primitiveBounds } from "./pageStacker";
import { breakSystems } from "./systemBreaker";

function scoreWithTracks(tracks: number, bars: number) {
  const score = createEmptyScore();
  score.masterBars = Array.from({ length: bars }, createMasterBar);
  score.tracks = Array.from({ length: tracks }, () => createTrack(undefined, bars));
  return score;
}

it("[A6] measured systems keep extruding symbols and other tracks inside the page", () => {
  const score = scoreWithTracks(2, 2);
  score.masterBars[0].layout.forcedBreak = true;
  score.masterBars[0].section = { letter: "A", name: "Verse", boxed: true };
  score.masterBars[1].fermatas = [{ beatTick: 0, glyph: "normal", tempoScale: 0.75 }];
  for (const track of score.tracks) {
    for (const bar of track.bars) {
      bar.voices[0].beats = Array.from({ length: 4 }, () =>
        createBeat({ rest: false, notes: [createNote(6, 0)] })
      );
    }
  }

  const { pages } = layoutScore(score);
  expect(pages).toHaveLength(1);
  const { primitives, width, height } = pages[0];
  const systemStaff = primitives.flatMap((primitive) => (
    primitive.type === "line" && primitive.id === `${score.tracks[0].id}-standard-line-0` ? [primitive.y1] : []
  ));

  expect(systemStaff).toHaveLength(2);
  const firstSystemBottom = Math.max(...primitives.flatMap((primitive) => (
    primitive.hit?.ref.barIndex === 0 ? [primitive.hit.bbox.y + primitive.hit.bbox.height] : []
  )));
  expect(firstSystemBottom).toBeLessThan(systemStaff[1]);
  for (const primitive of primitives) {
    const { x, y, width: w, height: h } = primitiveBounds(primitive);
    expect(x).toBeGreaterThanOrEqual(-0.5);
    expect(y).toBeGreaterThanOrEqual(-0.5);
    expect(x + w).toBeLessThanOrEqual(width + 0.5);
    expect(y + h).toBeLessThanOrEqual(height + 0.5);
  }
});

it("[A6] expanded systems justify their right edges and reserve changed signatures", () => {
  const score = scoreWithTracks(1, 3);
  score.stylesheet.page.firstSystemIndent = 20;
  score.masterBars[1].layout.forcedBreak = true;
  score.masterBars[1].keySignature.key = "G";
  const metrics = resolvePageMetrics(score.stylesheet);
  const contentWidth = metrics.contentWidth - SYSTEM_LABEL_WIDTH;
  const first = breakSystems(createMeasureContents(score), contentWidth, score.stylesheet.page)[0];

  expect(first.measures[0].x).toBe(20);
  expect(first.measures[1].showsSignature).toBe(true);
  expect(Math.abs(first.width - contentWidth)).toBeLessThanOrEqual(0.5);
});

it("[A6] adjacent short notes retain at least a note head of horizontal space", () => {
  const score = scoreWithTracks(1, 1);
  score.tracks[0].bars[0].voices[0].beats = Array.from({ length: 8 }, () =>
    createBeat({ duration: 64, rest: false, notes: [createNote(1, 0)] })
  );

  const heads = layoutScore(score).pages[0].primitives.flatMap((primitive) =>
    primitive.type === "ellipse" && primitive.hit?.kind === "note" ? [primitive.cx] : []
  );

  expect(heads).toHaveLength(8);
  expect(heads.slice(1).every((position, index) => position - heads[index] >= NOTE_HEAD_WIDTH)).toBe(true);
});

it("[A6] large page systems show the size warning and continuous layout remains unscaled", () => {
  const score = scoreWithTracks(12, 1);
  const reduced = layoutScore(score).pages[0].primitives;
  expect(reduced.find((primitive) => primitive.id === "system-0-scale")).toMatchObject({
    text: expect.stringContaining("exceeds")
  });

  score.documentSettings.displayMode = "vertical-screen";
  const continuous = layoutScore(score).pages[0];
  expect(continuous.height).toBeGreaterThan(1500);
  expect(continuous.primitives.some((primitive) => primitive.id === "system-0-scale")).toBe(false);
});
