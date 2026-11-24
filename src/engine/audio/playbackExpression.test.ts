import { describe, expect, it } from "vitest";
import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../model/factory";
import { unrollScore } from "../unroll/unrollScore";
import { compilePlayback } from "./compile";
import { swingBeat } from "./playbackExpression";

function guitarScore(bars = 1) {
  const score = createEmptyScore();
  score.masterBars = Array.from({ length: bars }, createMasterBar);
  score.tracks = [createTrack(undefined, bars)];
  return score;
}

describe("[B2] playback expression", () => {
  it.each([
    ["8th", 8, 240, 320],
    ["16th", 16, 120, 160]
  ] as const)("moves the second %s note to two thirds of the pair", (feel, duration, written, sounded) => {
    const score = guitarScore();
    score.masterBars[0].tripletFeel = feel;
    score.tracks[0].bars[0].voices[0].beats = [0, 4].map((fret) =>
      createBeat({ duration, rest: false, notes: [createNote(1, fret)] })
    );
    const events = compilePlayback(score, unrollScore(score)).events;
    expect(events.map(({ startTick }) => startTick)).toEqual([0, sounded]);
    expect(events.map(({ writtenTick }) => writtenTick)).toEqual([0, written]);
    expect(events[0].durationTicks / events[1].durationTicks).toBeCloseTo(2);
    expect(swingBeat(feel, createBeat({ duration, dots: 1 }), 0, written)).toEqual({ start: 0, duration: written });
  });

  it.each([[12, 12], [7, 19], [19, 19], [5, 24], [24, 24], [4, 28], [9, 28], [16, 28]])(
    "sounds a %s-fret natural harmonic %s semitones above the open string", (fret, interval) => {
      const score = guitarScore();
      score.tracks[0].bars[0].voices[0].beats = [
        createBeat({ rest: false, notes: [{ ...createNote(6, fret), harmonic: { type: "natural", touchFret: fret } }] })
      ];
      expect(compilePlayback(score, unrollScore(score)).events[0].midiPitch).toBe(40 + interval);
    }
  );

  it("plays note content of the preceding two measures when using double simile", () => {
    const score = guitarScore(5);
    score.tracks[0].bars.forEach((bar, index) => {
      bar.voices[0].beats = [createBeat({ duration: 1, rest: false, notes: [createNote(1, index)] })];
    });
    score.masterBars[2].simileMark = "double";
    score.masterBars[4].simileMark = "single";
    const events = compilePlayback(score, unrollScore(score)).events;
    expect(events.map(({ barIndex, midiPitch }) => [barIndex, midiPitch])).toEqual([
      [0, 64], [1, 65], [2, 64], [3, 65], [4, 65]
    ]);
  });

  it("orders strings by stroke direction and time without exceeding the written beat", () => {
    const score = guitarScore();
    const notes = [createNote(1, 0), createNote(6, 0), createNote(3, 0)];
    score.tracks[0].bars[0].voices[0].beats = [
      createBeat({ rest: false, notes, brush: { speed: 2, delay: 0, direction: "down" } }),
      createBeat({ rest: false, notes, arpeggio: { speed: 2, delay: 0, direction: "up" } })
    ];
    const events = compilePlayback(score, unrollScore(score)).events;
    expect(events.map(({ string }) => string)).toEqual([6, 3, 1, 1, 3, 6]);
    expect(events[1].startTick).toBeGreaterThan(events[0].startTick);
    expect(events[4].startTick - events[3].startTick).toBeGreaterThan(events[1].startTick - events[0].startTick);
    expect(events[5].startTick).toBeLessThan(960);
  });

  it("alternates trill pitches and interpolates marked dynamics over the phrase", () => {
    const score = guitarScore();
    score.tracks[0].bars[0].voices[0].beats = [
      createBeat({ duration: 4, rest: false, notes: [{
        ...createNote(1, 0), trill: { secondFret: 2, speed: 16 }
      }] }),
      ...[0, 1, 2].map(() => createBeat({
        duration: 4, rest: false, notes: [createNote(1, 0)], dynamicHairpin: { type: "cresc" }
      }))
    ];
    const events = compilePlayback(score, unrollScore(score)).events;
    expect(events.slice(0, 4).map(({ startTick, midiPitch }) => [startTick, midiPitch])).toEqual([
      [0, 64], [120, 66], [240, 64], [360, 66]
    ]);
    expect(events[4].velocity).toBeLessThan(events[5].velocity);
    expect(events[5].velocity).toBeLessThan(events[6].velocity);
  });
});
