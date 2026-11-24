import { describe, expect, it } from "vitest";
import { createBeat, createEmptyScore, createNote, createTrack } from "./factory";
import { checkInvariants } from "./invariants";

describe("score invariants", () => {
  it("[A9] rejects an absent string and a duplicate in the same beat", () => {
    const score = guitarScore();
    score.tracks[0].bars[0].voices[0].beats[0].notes = [createNote(7, 0), createNote(7, 1)];
    expect(checkInvariants(score)).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "string-range", severity: "fatal" }),
      expect.objectContaining({ code: "string-collision", severity: "fatal" })
    ]));
  });

  it("treats incomplete bars as warnings while editing", () => {
    const score = guitarScore();
    score.tracks[0].bars[0].voices[0].beats[0].duration = 4;
    expect(checkInvariants(score).filter(({ severity }) => severity === "fatal")).toHaveLength(0);
    expect(checkInvariants(score)).toContainEqual(expect.objectContaining({ code: "bar-length", severity: "warning" }));
  });
});

function guitarScore() {
  const score = createEmptyScore();
  const track = createTrack(undefined, 1);
  track.bars[0].voices[0].beats = [createBeat({ duration: 1, rest: true })];
  score.tracks.push(track);
  return score;
}
