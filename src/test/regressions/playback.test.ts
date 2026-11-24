import { expect, it } from "vitest";
import { compilePlayback } from "../../engine/audio/compile";
import { buildNoteMix, createDefaultMixerState } from "../../engine/audio/mixer";
import { buildTempoMap, tempoAutomationPoint } from "../../engine/audio/tempoMap";
import { unrollScore } from "../../engine/unroll/unrollScore";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";

function guitarScore(barCount: number) {
  const score = createEmptyScore();
  score.masterBars = Array.from({ length: barCount }, createMasterBar);
  score.tracks = [createTrack(undefined, barCount)];
  return score;
}

it("[B1] two tied quarter notes compile to one 960-tick sounding event", () => {
  const score = guitarScore(1);
  const track = score.tracks[0];
  track.bars[0].voices[0].beats = [
    createBeat({ rest: false, notes: [createNote(1, 3)] }),
    createBeat({ rest: false, notes: [{ ...createNote(1, 3), tiedFromPrevious: true }] }),
    createBeat({ duration: 2 })
  ];

  const { events } = compilePlayback(score, unrollScore(score));
  expect(events.map(({ startTick, durationTicks }) => [startTick, durationTicks])).toEqual([[0, 960]]);
});

it.fails("[B2] To Coda applies only after the D.S. al Coda jump", () => {
  const score = guitarScore(8);
  score.masterBars[1].directionTargets = ["Segno"];
  score.masterBars[3].directionJumps = ["DaCoda"];
  score.masterBars[5].directionJumps = ["DalSegno", "AlCoda"];
  score.masterBars[6].directionTargets = ["Coda"];

  const order = unrollScore(score).segments.map((segment) => segment.barIndex + 1);
  expect(order).toEqual([1, 2, 3, 4, 5, 6, 2, 3, 4, 7, 8]);
});

it.fails("[B3] a progressive tempo section round trips with less than half a tick of error", () => {
  const score = guitarScore(17);
  const endTick = 16 * 4 * 480;
  score.masterAutomations = [{
    type: "tempo",
    scope: "master",
    points: [tempoAutomationPoint(0, 140, "progressive"), tempoAutomationPoint(endTick, 200)]
  }];
  const map = buildTempoMap(score, unrollScore(score).segments);
  const errors = [1, 480, 2_400, endTick / 2, endTick - 1, endTick]
    .map((tick) => Math.abs(map.secondsToTicks(map.ticksToSeconds(tick)) - tick));
  expect(Math.max(...errors)).toBeLessThan(0.5);
});

it.fails("[A8] legacy 120% volume automation does not drop to roughly 1% gain", () => {
  const score = guitarScore(1);
  const track = score.tracks[0];
  const mixer = createDefaultMixerState(score.tracks);
  mixer.tracks[track.id].volume = 1;
  track.automations = [{
    type: "volume",
    scope: "track",
    points: [{ tick: 0, value: 1.2, transition: "constant" }]
  }];
  expect(buildNoteMix(score, track.id, 0, mixer, null).gain).toBe(1);
});

it.fails("[B5] hiding the notation of a track leaves its sounding gain intact", () => {
  const score = guitarScore(1);
  const { id } = score.tracks[0];
  const mixer = createDefaultMixerState(score.tracks);
  const visible = buildNoteMix(score, id, 0, mixer, null);
  expect(visible.gain).toBeGreaterThan(0);

  mixer.tracks[id].visible = false;
  expect(buildNoteMix(score, id, 0, mixer, null)).toMatchObject({ muted: false, gain: visible.gain });
});
