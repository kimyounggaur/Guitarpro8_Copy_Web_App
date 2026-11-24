import { expect, it } from "vitest";
import { decodeClipboardText, encodeClipboardText } from "../../io/clipboardText";
import { checkInvariants } from "../../model/invariants";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { copyScoreRange, DEFAULT_PASTE, pasteScoreRange } from "./clipboard";
import { defaultCursor } from "./operations";

function fixture(bars = 4) {
  const score = createEmptyScore();
  score.masterBars = Array.from({ length: bars }, createMasterBar);
  score.tracks = [createTrack(undefined, bars), createTrack(undefined, bars)];
  score.tracks[0].bars.forEach((bar, index) => {
    bar.voices[0].beats = [
      createBeat({ duration: 2, rest: false, notes: [createNote(1, index + 1)] }),
      createBeat({ duration: 2, rest: false, notes: [createNote(1, index + 5)] })
    ];
  });
  return score;
}

it("[B17] copies three measures in score order for a backwards selection and extends all tracks", () => {
  const score = fixture();
  const cursor = defaultCursor(score);
  const payload = copyScoreRange(score, cursor, {
    anchor: { ...cursor, barIndex: 2 }, head: cursor, unit: "bar"
  }, "single")!;
  expect(pasteScoreRange(score, { ...cursor, barIndex: 3 }, payload, DEFAULT_PASTE)).toBe(true);
  expect(score.tracks.map((track) => track.bars.length)).toEqual([6, 6]);
  expect(score.tracks[0].bars.slice(3).map((bar) => bar.voices[0].beats[0].notes[0].fret)).toEqual([1, 2, 3]);
  expect(checkInvariants(score).filter(({ severity }) => severity === "fatal")).toEqual([]);
});

it("[B17] pastes an effects-only beat without overwriting its pitch or rhythm", () => {
  const score = fixture();
  const cursor = defaultCursor(score);
  score.tracks[0].bars[0].voices[0].beats[0].notes[0].palmMute = true;
  const target = score.tracks[0].bars[1].voices[0].beats[1];
  target.duration = 4;
  const payload = copyScoreRange(score, cursor, { anchor: cursor, head: cursor, unit: "beat" }, "single")!;
  pasteScoreRange(score, { ...cursor, barIndex: 1, beatIndex: 1 }, payload, {
    ...DEFAULT_PASTE, content: "effects"
  });
  expect(score.tracks[0].bars[1].voices[0].beats[1]).toMatchObject({
    duration: 4, notes: [{ fret: 6, palmMute: true }]
  });
});

it("[B17] inserts repeated note ranges without replacing the destination measures", () => {
  const score = fixture();
  const cursor = defaultCursor(score);
  score.tracks[0].bars[0].voices[0].beats[0].notes[0].palmMute = true;
  const payload = copyScoreRange(score, cursor, null, "single")!;
  pasteScoreRange(score, { ...cursor, barIndex: 2 }, payload, {
    repeatCount: 2, insert: true, content: "notes"
  });
  expect(score.tracks.map((track) => track.bars.length)).toEqual([6, 6]);
  expect(score.tracks[0].bars.slice(2).map((bar) => bar.voices[0].beats[0].notes[0].fret)).toEqual([1, 1, 3, 4]);
  expect(score.tracks[0].bars[2].voices[0].beats[0].notes[0].palmMute).toBe(false);
});

it("[B17] serializes typed clipboard text and rejects arbitrary system clipboard data", () => {
  const score = fixture();
  const cursor = defaultCursor(score);
  const clipboard = copyScoreRange(score, cursor, null, "multitrack")!;
  expect(decodeClipboardText(encodeClipboardText(clipboard))).toMatchObject({
    wholeBars: true, mode: "multitrack", tracks: [
      { kind: "stringed", bars: [expect.objectContaining({ voices: expect.any(Array) })] },
      { kind: "stringed", bars: [expect.objectContaining({ voices: expect.any(Array) })] }
    ]
  });
  expect(decodeClipboardText('{"bars":[]}')).toBeNull();
  expect(decodeClipboardText("TAB-SCORE-CLIPBOARD/1\n{}")).toBeNull();
});
