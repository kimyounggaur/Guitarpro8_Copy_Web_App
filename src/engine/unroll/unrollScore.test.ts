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
