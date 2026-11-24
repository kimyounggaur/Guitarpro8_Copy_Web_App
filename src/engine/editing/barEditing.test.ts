import { expect, it } from "vitest";
import { beatDurationTicks } from "../../model/derive";
import { createBeat, createEmptyScore, createMasterBar, createTrack } from "../../model/factory";
import { validateBarDurations } from "../validate/barDuration";
import {
  cycleKeySignatureAtCursor,
  cycleTimeSignatureAtCursor,
  defaultCursor,
  deleteBarAtCursor,
  insertBarAtCursor,
  insertBarsAt,
  moveRightWithScoreMutation,
  repeatBarAt,
  setKeySignature,
  setTimeSignature
} from "./operations";

function scoreWithBars(count: number) {
  const score = createEmptyScore();
  score.masterBars = Array.from({ length: count }, createMasterBar);
  score.tracks = [createTrack(undefined, count), createTrack(undefined, count)];
  return score;
}

it("[B10] extending at the end inherits meter, key and feel without copying markings", () => {
  const score = scoreWithBars(1);
  const original = score.masterBars[0];
  original.timeSignature.numerator = 3;
  original.keySignature.key = "G";
  original.tripletFeel = "8th";
  original.repeatOpen = true;
  original.repeatClose = 2;
  original.alternateEndings = 1;
  original.doubleBar = true;
  original.section = { letter: "A", name: "Verse", boxed: true };
  original.directionTargets = ["Segno"];
  original.directionJumps = ["DalSegno"];
  original.fermatas = [{ beatTick: 0, glyph: "normal", tempoScale: 0.75 }];
  original.layout.forcedBreak = true;
  score.tracks[0].bars[0].voices[0].beats = Array.from({ length: 3 }, () => createBeat());

  const cursor = moveRightWithScoreMutation(score, { ...defaultCursor(score), beatIndex: 2 });

  expect(cursor).toMatchObject({ barIndex: 1, beatIndex: 0 });
  const created = score.masterBars[1];
  expect(created).toEqual({
    ...createMasterBar(),
    timeSignature: original.timeSignature,
    keySignature: original.keySignature,
    tripletFeel: original.tripletFeel
  });
  expect(created.timeSignature).not.toBe(original.timeSignature);
  for (const track of score.tracks) {
    const rests = track.bars[1].voices[0].beats;
    expect(rests.every((beat) => beat.rest)).toBe(true);
    expect(rests.reduce((length, beat) => length + beatDurationTicks(beat), 0)).toBe(1440);
  }
});

it("[B10] cycling a signature changes the run up to its next distinct value", () => {
  const score = scoreWithBars(6);
  setTimeSignature(score, 5, { numerator: 6, denominator: 8, beamingPreset: "default" }, "thisBarOnly");
  setKeySignature(score, 4, { key: "D", mode: "major" }, "toEnd");
  const cursor = { ...defaultCursor(score), barIndex: 2 };
  score.tracks[0].bars[2].voices[0].beats = Array.from({ length: 4 }, () => createBeat());

  cycleTimeSignatureAtCursor(score, cursor);
  cycleKeySignatureAtCursor(score, cursor);

  expect(score.masterBars.map((bar) => bar.timeSignature.numerator)).toEqual([4, 4, 3, 3, 3, 6]);
  expect(score.masterBars.map((bar) => bar.keySignature.key)).toEqual(["C", "C", "G", "G", "D", "D"]);
  expect(validateBarDurations(score)).toContainEqual(expect.objectContaining({
    barIndex: 2, actual: 1920, expected: 1440
  }));
});

it("[C13] moves master and track automation at and after a bar insertion boundary", () => {
  const score = scoreWithBars(3);
  score.masterBars[0].timeSignature.numerator = 3;
  score.masterAutomations = [{
    type: "tempo",
    scope: "master",
    points: [
      { tick: 0, value: 120, transition: "constant" },
      { tick: 3360, value: 150, transition: "constant" }
    ]
  }];
  score.tracks[0].automations = [{
    type: "volume",
    scope: "track",
    points: [
      { tick: 1439, value: 0.9, transition: "constant" },
      { tick: 1440, value: 0.4, transition: "constant" }
    ]
  }];
  score.tracks[1].automations = [{
    type: "pan", scope: "track", points: [{ tick: 3360, value: -0.5, transition: "constant" }]
  }];

  insertBarAtCursor(score, { ...defaultCursor(score), barIndex: 1 });

  expect(score.masterAutomations[0].points.map((point) => point.tick)).toEqual([0, 4800]);
  expect(score.tracks[0].automations[0].points.map((point) => point.tick)).toEqual([1439, 2880]);
  expect(score.tracks[1].automations[0].points.map((point) => point.tick)).toEqual([4800]);

  deleteBarAtCursor(score, { ...defaultCursor(score), barIndex: 1 });

  expect(score.masterAutomations[0].points.map((point) => point.tick)).toEqual([0, 3360]);
  expect(score.tracks[0].automations[0].points.map((point) => point.tick)).toEqual([1439, 1440]);
  expect(score.tracks[1].automations[0].points.map((point) => point.tick)).toEqual([3360]);
});

it("[C13] removing a bar discards its points and keeps the retained progressive ramp", () => {
  const score = scoreWithBars(3);
  score.masterAutomations = [{
    type: "tempo",
    scope: "master",
    points: [
      { tick: 0, value: 100, transition: "progressive" },
      { tick: 2880, value: 160, transition: "constant" },
      { tick: 4320, value: 135, transition: "constant" }
    ]
  }];
  score.tracks[0].automations = [{
    type: "pan",
    scope: "track",
    points: [
      { tick: 1000, value: 0, transition: "constant" },
      { tick: 1920, value: 0.5, transition: "constant" },
      { tick: 3839, value: 0.8, transition: "constant" },
      { tick: 3840, value: -0.5, transition: "constant" }
    ]
  }];
  deleteBarAtCursor(score, { ...defaultCursor(score), barIndex: 1 });

  expect(score.masterAutomations[0].points.map(({ tick, value }) => [tick, value])).toEqual([[0, 100], [1920, 140], [2400, 135]]);
  expect(score.tracks[0].automations[0].points.map(({ tick, value }) => [tick, value])).toEqual([[1000, 0], [1920, -0.5]]);
});

it("[B10] inserting several bars and duplicating a bar keep per-track bar counts aligned", () => {
  const score = scoreWithBars(2);
  score.masterBars[1].timeSignature.numerator = 3;
  score.masterBars[1].repeatOpen = true;
  insertBarsAt(score, 2, 2);
  repeatBarAt(score, 1, 2);

  expect(score.masterBars.map((bar) => bar.timeSignature.numerator)).toEqual([4, 3, 3, 3, 3, 3]);
  expect(score.masterBars.map((bar) => bar.repeatOpen)).toEqual([false, true, true, true, false, false]);
  expect(score.tracks.map((track) => track.bars.length)).toEqual([6, 6]);
});
