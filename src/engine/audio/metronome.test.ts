import { describe, expect, it } from "vitest";
import { createEmptyScore, createMasterBar } from "../../model/factory";
import { unrollScore } from "../unroll/unrollScore";
import { countInAt, metronomeClicks } from "./metronome";
import { buildTempoMap } from "./tempoMap";

describe("[B5] metronome and count-in meter", () => {
  it.each([[6, 2], [9, 3], [12, 4]])("uses dotted quarter beats in %d/8", (numerator, clicks) => {
    const score = createEmptyScore();
    score.masterBars = [createMasterBar(), createMasterBar()];
    score.masterBars[0].timeSignature = { ...score.masterBars[0].timeSignature, numerator, denominator: 8 };
    score.masterBars[1].timeSignature = { ...score.masterBars[1].timeSignature, numerator: 3, denominator: 4 };
    const { segments } = unrollScore(score);
    const map = buildTempoMap(score, segments);

    const result = metronomeClicks(score, segments, map);
    expect(result.slice(0, clicks).map(({ timeSec }) => timeSec)).toEqual(
      Array.from({ length: clicks }, (_, index) => index * 0.75)
    );
    expect(result.slice(clicks).map(({ timeSec }) => timeSec)).toEqual(
      Array.from({ length: 3 }, (_, index) => clicks * 0.75 + index * 0.5)
    );
    expect(result.filter(({ downbeat }) => downbeat)).toHaveLength(2);

    const countIn = countInAt(score, map, clicks * 0.75);
    expect(countIn.duration).toBe(clicks * 0.75);
    expect(countIn.clicks).toEqual(result.slice(0, clicks));
  });
});
