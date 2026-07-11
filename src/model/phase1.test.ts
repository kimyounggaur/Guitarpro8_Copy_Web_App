import { describe, expect, it } from "vitest";
import { validateBarDurations, validateStructure } from "../engine/validate";
import { barTheoreticalTicks, beatDurationTicks, noteMidiPitch, writtenPitch } from "./derive";
import {
  createBar,
  createBeat,
  createEmptyScore,
  createMasterBar,
  createNote,
  createTrack
} from "./factory";
import type { Bar, Beat, Score } from "./types";

describe("Phase 1 model derivations", () => {
  it("calculates quarter-note ticks at 480", () => {
    expect(beatDurationTicks(createBeat({ duration: 4 }))).toBe(480);
  });

  it("calculates whole-note ticks", () => {
    expect(beatDurationTicks(createBeat({ duration: 1 }))).toBe(1920);
  });

  it("adds one dot as half the base value", () => {
    expect(beatDurationTicks(createBeat({ duration: 4, dots: 1 }))).toBe(720);
  });

  it("adds double dots as three quarters of the base value", () => {
    expect(beatDurationTicks(createBeat({ duration: 4, dots: 2 }))).toBe(840);
  });

  it("calculates triplet eighth-note ticks", () => {
    const beat = createBeat({ duration: 8, tuplet: { n: 3, m: 2 } });
    expect(beatDurationTicks(beat)).toBe(160);
  });

  it("multiplies nested tuplet ratios recursively", () => {
    const beat = createBeat({
      duration: 4,
      tuplet: { n: 5, m: 4, parent: { n: 3, m: 2 } }
    });
    expect(beatDurationTicks(beat)).toBe(256);
  });

  it("calculates 4/4 theoretical bar ticks", () => {
    expect(barTheoreticalTicks(createMasterBar())).toBe(1920);
  });

  it("calculates 6/8 theoretical bar ticks", () => {
    const masterBar = createMasterBar();
    masterBar.timeSignature = { numerator: 6, denominator: 8, beamingPreset: "default" };
    expect(barTheoreticalTicks(masterBar)).toBe(1440);
  });

  it("derives MIDI pitch from string and fret", () => {
    const track = createTrack();
    expect(noteMidiPitch(createNote(6, 0), track)).toBe(40);
  });

  it("adds capo to MIDI pitch", () => {
    const track = createTrack();
    track.tuning.capo = 2;
    expect(noteMidiPitch(createNote(6, 3), track)).toBe(45);
  });

  it("uses partial capo on selected strings", () => {
    const track = createTrack();
    track.tuning.partialCapo = { fret: 5, strings: [2] };
    expect(noteMidiPitch(createNote(2, 0), track)).toBe(64);
  });

  it("keeps the higher capo when partial capo is lower than capo", () => {
    const track = createTrack();
    track.tuning.capo = 5;
    track.tuning.partialCapo = { fret: 3, strings: [2] };
    expect(noteMidiPitch(createNote(2, 0), track)).toBe(64);
  });

  it("converts sounding pitch to written pitch for transposing instruments", () => {
    const track = createTrack();
    track.transpositionTonality = { soundingOffset: -2 };
    expect(writtenPitch(createNote(2, 1), track, { concertTone: false })).toBe(62);
  });

  it("applies ottava notation to written pitch", () => {
    const track = createTrack();
    expect(writtenPitch(createNote(2, 1), track, { concertTone: true, ottava: "8va" })).toBe(48);
  });
});

describe("Phase 1 validators", () => {
  it("detects incomplete bars", () => {
    const score = scoreWithTrack();
    score.tracks[0].bars[0] = barWithVoiceBeats([createBeat({ duration: 4 })]);

    const issues = validateBarDurations(score);

    expect(issues[0]).toMatchObject({ actual: 480, expected: 1920 });
  });

  it("accepts complete 4/4 bars", () => {
    const score = scoreWithTrack();
    score.tracks[0].bars[0] = completeBar([4, 4, 4, 4]);

    expect(validateBarDurations(score)).toHaveLength(0);
  });

  it("excludes grace notes from bar duration", () => {
    const score = scoreWithTrack();
    score.tracks[0].bars[0] = completeBar([4, 4, 4, 4], {
      graceNotes: [{ string: 1, fret: 0, onBeat: false }]
    });

    expect(validateBarDurations(score)).toHaveLength(0);
  });

  it("exempts first or last anacrusis bars from duration errors", () => {
    const score = scoreWithTrack();
    score.masterBars[0].anacrusis = true;

    expect(validateBarDurations(score)).toHaveLength(0);
  });

  it("detects track and master bar count mismatch", () => {
    const score = scoreWithTrack();
    score.masterBars.push(createMasterBar());

    expect(validateStructure(score)).toContainEqual(
      expect.objectContaining({ type: "bar-count-mismatch" })
    );
  });

  it("rejects single-bar simile on the first bar", () => {
    const score = createEmptyScore();
    score.masterBars[0].simileMark = "single";

    expect(validateStructure(score)).toContainEqual(
      expect.objectContaining({ type: "simile-invalid", barIndex: 0 })
    );
  });

  it("rejects double-bar simile on the first two bars", () => {
    const score = createEmptyScore();
    score.masterBars.push(createMasterBar());
    score.masterBars[1].simileMark = "double";

    expect(validateStructure(score)).toContainEqual(
      expect.objectContaining({ type: "simile-invalid", barIndex: 1 })
    );
  });

  it("detects invalid tuning string counts", () => {
    const score = scoreWithTrack();
    score.tracks[0].tuning.strings = [40, 45];

    expect(validateStructure(score)).toContainEqual(
      expect.objectContaining({ type: "tuning-string-count-invalid" })
    );
  });

  it("detects track-level tempo automations", () => {
    const score = scoreWithTrack();
    score.tracks[0].automations.push({
      type: "tempo",
      scope: "track",
      points: [{ tick: 0, value: 120, transition: "constant" }]
    });

    expect(validateStructure(score)).toContainEqual(
      expect.objectContaining({ type: "tempo-automation-scope-invalid" })
    );
  });

  it("detects duplicate grace notes on the same string", () => {
    const score = scoreWithTrack();
    score.tracks[0].bars[0].voices[0].beats.push(
      createBeat({
        graceNotes: [
          { string: 1, fret: 0, onBeat: false },
          { string: 1, fret: 2, onBeat: true }
        ]
      })
    );

    expect(validateStructure(score)).toContainEqual(
      expect.objectContaining({ type: "duplicate-grace-note-string" })
    );
  });
});

function scoreWithTrack(): Score {
  const score = createEmptyScore();
  score.tracks.push(createTrack(undefined, score.masterBars.length));
  return score;
}

function completeBar(durations: [4, 4, 4, 4], firstBeatOptions: Partial<Beat> = {}): Bar {
  return barWithVoiceBeats(
    durations.map((duration, index) =>
      createBeat(index === 0 ? { duration, ...firstBeatOptions } : { duration })
    )
  );
}

function barWithVoiceBeats(beats: Beat[]): Bar {
  const bar = createBar();
  bar.voices = [
    { beats: cloneBeats(beats) },
    { beats: cloneBeats(beats) },
    { beats: cloneBeats(beats) },
    { beats: cloneBeats(beats) }
  ];
  return bar;
}

function cloneBeats(beats: Beat[]): Beat[] {
  return beats.map((beat) => ({ ...beat, notes: [...beat.notes], graceNotes: [...beat.graceNotes] }));
}
