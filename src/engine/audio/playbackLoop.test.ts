import { describe, expect, it } from "vitest";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { unrollScore } from "../unroll/unrollScore";
import { type NoteEvent, compilePlayback } from "./compile";
import { getPlaybackLoop, PlaybackEventQueue, wrappedPlaybackSecond } from "./playbackLoop";
import { defaultCursor } from "../editing/operations";

describe("[B5] selected playback looping", () => {
  it("finds the complete range between selected bars and wraps at the selected end", () => {
    const score = createEmptyScore();
    score.masterBars = Array.from({ length: 4 }, createMasterBar);
    const track = createTrack(undefined, 4);
    score.tracks = [track];
    for (const bar of track.bars) {
      bar.voices[0].beats = [createBeat({ duration: 1, rest: false, notes: [createNote(1, 5)] })];
    }
    const compilation = compilePlayback(score, unrollScore(score));
    const cursor = defaultCursor(score);
    const loop = getPlaybackLoop(compilation, {
      anchor: { ...cursor, barIndex: 2 }, head: { ...cursor, barIndex: 1 }
    }, 0);
    expect(loop).toEqual({ startSec: 2, endSec: 6 });
    expect(wrappedPlaybackSecond(5.95, loop)).toBe(5.95);
    expect(wrappedPlaybackSecond(6.125, loop)).toBe(2.125);
  });

  it("queues the next pass in the current scheduling window without losing or duplicating events", () => {
    const event = (timeSec: number, durationSec: number) => ({ timeSec, durationSec } as NoteEvent);
    const queue = new PlaybackEventQueue([
      event(0, 0.1), event(2, 0.5), event(5.95, 0.4), event(6, 0.5)
    ], 2, 8, { startSec: 2, endSec: 6 });

    expect(queue.takeThrough(2.15, 2).map(({ startSec }) => startSec)).toEqual([2]);
    const during = queue.takeThrough(6.1, 5.92);
    expect(during.map(({ startSec }) => startSec)).toEqual([5.95, 6]);
    expect(during[0].durationSec).toBeCloseTo(0.05);
    expect(queue.takeThrough(6.2, 5.95)).toEqual([]);
  });
});
