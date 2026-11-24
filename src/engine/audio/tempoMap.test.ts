import { describe, expect, it } from "vitest";
import { createBeat, createEmptyScore, createMasterBar, createTrack } from "../../model/factory";
import { TICKS_PER_QUARTER } from "../../model/types";
import { unrollScore } from "../unroll/unrollScore";
import { buildTempoMap, tempoAutomationPoint } from "./tempoMap";

describe("[B3] tempo map tick and second conversion", () => {
  it.each([
    [140, 200],
    [200, 77],
    [120, 120],
    [120, 120.000001],
    [10, 300]
  ])("round trips across a 16-bar segment from %d BPM to %d BPM", (startBpm, endBpm) => {
    const score = createEmptyScore();
    score.masterBars = Array.from({ length: 17 }, createMasterBar);
    const end = 16 * 4 * TICKS_PER_QUARTER;
    score.masterAutomations = [{
      type: "tempo",
      scope: "master",
      points: [tempoAutomationPoint(0, startBpm, "progressive"), tempoAutomationPoint(end, endBpm)]
    }];
    const map = buildTempoMap(score, unrollScore(score).segments);

    const ticks = [0, end, map.totalTicks, ...Array.from({ length: 100 }, (_, index) =>
      ((index + 1) * 7919) % map.totalTicks + 0.375
    )];
    expect(Math.max(...ticks.map((tick) => Math.abs(map.secondsToTicks(map.ticksToSeconds(tick)) - tick)))).toBeLessThan(0.5);
    expect(map.secondsToTicks(-1)).toBe(0);
    expect(map.secondsToTicks(map.totalSeconds + 1)).toBe(map.totalTicks);
  });
});

describe("[B2] fermata duration", () => {
  it("scales just the notated beat and repeats that hold on each visit", () => {
    const score = createEmptyScore();
    score.tracks = [createTrack()];
    score.masterBars[0].repeatClose = 2;
    score.masterBars[0].fermatas = [{ beatTick: 480, tempoScale: 0.75, glyph: "normal" }];
    score.tracks[0].bars[0].voices[0].beats = [
      createBeat({ duration: 4 }),
      createBeat({ duration: 8 }),
      createBeat({ duration: 8 }),
      createBeat({ duration: 2 })
    ];
    const map = buildTempoMap(score, unrollScore(score).segments);

    for (const offset of [0, 1920]) {
      const timeAt = (tick: number) => map.ticksToSeconds(tick + offset);
      expect(timeAt(480) - timeAt(0)).toBeCloseTo(0.5, 6);
      expect(timeAt(720) - timeAt(480)).toBeCloseTo(0.25 / 0.75, 6);
      expect(timeAt(960) - timeAt(720)).toBeCloseTo(0.25, 6);
      expect(map.secondsToTicks(timeAt(600))).toBeCloseTo(offset + 600, 6);
    }
  });

  it("preserves the underlying ramp before and after a hold", () => {
    const score = createEmptyScore();
    score.masterBars.push(createMasterBar());
    score.masterAutomations = [{
      type: "tempo",
      scope: "master",
      points: [tempoAutomationPoint(0, 120, "progressive"), tempoAutomationPoint(1920, 160)]
    }];
    const segments = unrollScore(score).segments;
    const ordinary = buildTempoMap(score, segments);
    score.masterBars[0].fermatas = [{ beatTick: 480, tempoScale: 0.75, glyph: "normal" }];
    const held = buildTempoMap(score, segments);
    const unscaledDuration = ordinary.ticksToSeconds(960) - ordinary.ticksToSeconds(480);

    expect(held.ticksToSeconds(480)).toBeCloseTo(ordinary.ticksToSeconds(480), 6);
    expect(held.ticksToSeconds(960) - held.ticksToSeconds(480)).toBeCloseTo(unscaledDuration / 0.75, 6);
    expect(held.totalSeconds - ordinary.totalSeconds).toBeCloseTo(unscaledDuration / 0.75 - unscaledDuration, 6);
    expect(held.secondsToTicks(held.ticksToSeconds(600))).toBeCloseTo(600, 6);
  });
});
