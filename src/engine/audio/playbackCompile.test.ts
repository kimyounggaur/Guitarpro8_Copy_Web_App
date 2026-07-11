import { describe, expect, it } from "vitest";
import { createBeat, createEmptyScore, createNote, createTrack } from "../../model/factory";
import { unrollScore } from "../unroll/unrollScore";
import { compilePlayback } from "./compile";
import { createDefaultMixerState } from "./mixer";
import { buildTempoMap, tempoAutomationPoint } from "./tempoMap";

describe("Phase 6 tempo map and playback compiler", () => {
  it("maps ticks to seconds with relative speed", () => {
    const score = scoreWithOneTrack();
    const unrolled = unrollScore(score);
    const tempoMap = buildTempoMap(score, unrolled.segments, { mode: "relative", percent: 50 });

    expect(tempoMap.ticksToSeconds(480)).toBeCloseTo(1, 5);
    expect(tempoMap.secondsToTicks(1)).toBeCloseTo(480, 5);
  });

  it("compiles note events with dynamic velocity and timing", () => {
    const score = scoreWithOneTrack();
    const note = createNote(1, 3);
    note.dynamic = 6;
    note.accent = "accent";
    score.tracks[0].bars[0].voices[0].beats = [
      createBeat({ duration: 4, rest: false, notes: [note] })
    ];

    const compilation = compilePlayback(score, unrollScore(score));

    expect(compilation.events).toHaveLength(1);
    expect(compilation.events[0]).toMatchObject({
      barIndex: 0,
      string: 1,
      midiPitch: 67
    });
    expect(compilation.events[0].velocity).toBeGreaterThan(100);
    expect(compilation.events[0].durationSec).toBeGreaterThan(0);
  });

  it("attaches mixer automation to compiled note events", () => {
    const score = scoreWithOneTrack();
    const trackId = score.tracks[0].id;
    const mixer = createDefaultMixerState(score.tracks);

    mixer.tracks[trackId].volume = 1;
    mixer.tracks[trackId].pan = 0;
    score.masterAutomations = [
      {
        type: "volume",
        scope: "master",
        points: [{ tick: 0, value: 0.8, transition: "constant" }]
      }
    ];
    score.tracks[0].automations = [
      {
        type: "volume",
        scope: "track",
        points: [{ tick: 0, value: 0.5, transition: "constant" }]
      },
      {
        type: "pan",
        scope: "track",
        points: [{ tick: 0, value: -0.25, transition: "constant" }]
      }
    ];

    const compilation = compilePlayback(score, unrollScore(score), { mode: "relative", percent: 100 }, mixer, trackId);

    expect(compilation.events[0].writtenTick).toBe(0);
    expect(compilation.events[0].mix.gain).toBeCloseTo(0.4, 5);
    expect(compilation.events[0].mix.pan).toBeCloseTo(-0.25, 5);
  });

  it("repeats written tempo automation on repeated playback segments", () => {
    const score = scoreWithOneTrack();
    score.masterAutomations = [
      {
        type: "tempo",
        scope: "master",
        points: [tempoAutomationPoint(0, 90), tempoAutomationPoint(480, 150, "progressive")]
      }
    ];
    score.masterBars[0].repeatOpen = true;
    score.masterBars[0].repeatClose = 2;

    const tempoMap = buildTempoMap(score, unrollScore(score).segments);

    expect(tempoMap.points.map((point) => point.bpm)).toEqual(expect.arrayContaining([90, 150]));
    expect(tempoMap.points.length).toBeGreaterThanOrEqual(4);
  });
});

function scoreWithOneTrack() {
  const score = createEmptyScore();
  score.tracks = [createTrack(undefined, 1)];
  score.tracks[0].bars[0].voices[0].beats = [
    createBeat({ duration: 1, rest: false, notes: [createNote(1, 0)] })
  ];
  return score;
}
