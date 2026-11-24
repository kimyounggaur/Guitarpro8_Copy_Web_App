import { describe, expect, it } from "vitest";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { unrollScore } from "./unrollScore";

describe("Phase 6 playback unroller", () => {
  it("unrolls repeat open/close sections", () => {
    const score = scoreWithBars(3);
    score.masterBars[0].repeatOpen = true;
    score.masterBars[1].repeatClose = 2;

    const result = unrollScore(score);

    expect(result.segments.map((segment) => segment.barIndex)).toEqual([0, 1, 0, 1, 2]);
    expect(result.warnings).toEqual([]);
  });

  it("honors alternate ending masks across repeat passes", () => {
    const score = scoreWithBars(4);
    score.masterBars[0].repeatOpen = true;
    score.masterBars[1].alternateEndings = 1;
    score.masterBars[1].repeatClose = 2;
    score.masterBars[2].alternateEndings = 2;

    const result = unrollScore(score);

    expect(result.segments.map((segment) => segment.barIndex)).toEqual([0, 1, 0, 2, 3]);
  });

  it("handles D.C. al Fine as a one-shot direction jump", () => {
    const score = scoreWithBars(4);
    score.masterBars[1].directionTargets = ["Fine"];
    score.masterBars[3].directionJumps = ["DaCapo", "AlFine"];

    const result = unrollScore(score);

    expect(result.segments.map((segment) => segment.barIndex)).toEqual([0, 1, 2, 3, 0, 1]);
  });
});

function scoreWithBars(count: number) {
  const score = createEmptyScore();
  score.masterBars = Array.from({ length: count }, () => createMasterBar());
  score.tracks = [createTrack(undefined, count)];
  score.tracks[0].bars.forEach((bar, index) => {
    bar.voices[0].beats = [
      createBeat({ duration: 1, rest: false, notes: [createNote(1, index)] })
    ];
  });
  return score;
}

describe("[B2] repeat and direction state transitions", () => {
  it("extends a first ending through its unmarked closing bar", () => {
    const score = scoreWithBars(5);
    score.masterBars[0].repeatOpen = true;
    score.masterBars[1].alternateEndings = 1;
    score.masterBars[2].repeatClose = 2;
    score.masterBars[3].alternateEndings = 2;

    const result = unrollScore(score);
    expect(result.segments.map(({ barIndex }) => barIndex + 1)).toEqual([1, 2, 3, 1, 4, 5]);
    expect(result.segments.map(({ pass }) => pass)).toEqual([1, 1, 1, 2, 2, 2]);
  });

  it("honors the total count and an implicit repeat from the first bar", () => {
    const score = scoreWithBars(3);
    score.masterBars[1].repeatClose = 3;

    expect(unrollScore(score).segments.map(({ barIndex }) => barIndex + 1)).toEqual([1, 2, 1, 2, 1, 2, 3]);
  });

  it("starts the inner repeat again on each outer pass", () => {
    const score = scoreWithBars(3);
    score.masterBars[0].repeatOpen = true;
    score.masterBars[1].repeatOpen = true;
    score.masterBars[1].repeatClose = 2;
    score.masterBars[2].repeatClose = 3;

    expect(unrollScore(score).segments.map(({ barIndex }) => barIndex + 1)).toEqual([
      1, 2, 2, 3, 1, 2, 2, 3, 1, 2, 2, 3
    ]);
  });

  it("supports two close marks referring to one starting bar", () => {
    const score = scoreWithBars(3);
    score.masterBars[0].repeatOpen = true;
    score.masterBars[0].repeatClose = 2;
    score.masterBars[1].repeatClose = 2;

    expect(unrollScore(score).segments.map(({ barIndex }) => barIndex + 1)).toEqual([1, 1, 2, 1, 1, 2, 3]);
  });

  it("shares pass counts across closing bars in alternate endings", () => {
    const score = scoreWithBars(4);
    score.masterBars[0].repeatOpen = true;
    score.masterBars[1].alternateEndings = 1 | 4;
    score.masterBars[1].repeatClose = 4;
    score.masterBars[2].alternateEndings = 2;
    score.masterBars[2].repeatClose = 4;
    score.masterBars[3].alternateEndings = 8;

    expect(unrollScore(score).segments.map(({ barIndex }) => barIndex + 1)).toEqual([1, 2, 1, 3, 1, 2, 1, 4]);
  });

  it("does not play the pickup or repeat the body a second time after D.C.", () => {
    const score = scoreWithBars(4);
    score.masterBars[0].anacrusis = true;
    score.masterBars[1].repeatOpen = true;
    score.masterBars[2].repeatClose = 2;
    score.masterBars[3].directionJumps = ["DaCapo"];

    expect(unrollScore(score).segments.map(({ barIndex }) => barIndex + 1)).toEqual([1, 2, 3, 2, 3, 4, 2, 3, 4]);
  });

  it("executes only the armed Coda instruction and distinguishes Double Coda", () => {
    const score = scoreWithBars(6);
    score.masterBars[1].directionJumps = ["DaCoda", "DaDoubleCoda"];
    score.masterBars[2].directionJumps = ["DaCapo", "AlDoubleCoda"];
    score.masterBars[3].directionTargets = ["Coda"];
    score.masterBars[4].directionTargets = ["DoubleCoda"];

    expect(unrollScore(score).segments.map(({ barIndex }) => barIndex + 1)).toEqual([1, 2, 3, 1, 2, 5, 6]);
  });

  it("stops within the caller's segment cap and returns the accumulated length", () => {
    const score = scoreWithBars(3);
    score.masterBars[1].repeatClose = 6;

    const result = unrollScore(score, { maxSegments: 3 });
    expect(result.segments).toHaveLength(3);
    expect(result.segments.map(({ startTick }) => startTick)).toEqual([0, 1920, 3840]);
    expect(result.totalTicks).toBe(5760);
    expect(result.warnings).toHaveLength(1);
  });
});
