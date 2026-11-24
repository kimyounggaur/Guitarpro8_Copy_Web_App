import { describe, expect, it } from "vitest";
import { createBeat, createEmptyScore, createNote, createTrack } from "../../model/factory";
import { unrollScore } from "../unroll/unrollScore";
import { compilePlayback } from "./compile";
import { drumPatchFor } from "./drumSynth";

describe("[B4] GM percussion synthesis", () => {
  it("uses downward pitch envelopes for the two kicks and for the six toms", () => {
    for (const key of [35, 36, 41, 43, 45, 47, 48, 50]) {
      const patch = drumPatchFor(key);
      expect(patch.tone).toBeDefined();
      expect(patch.tone!.startHz).toBeGreaterThan(patch.tone!.endHz);
      expect(patch.noise).toBeUndefined();
    }
    expect(drumPatchFor(41).tone!.endHz).toBeLessThan(drumPatchFor(50).tone!.endHz);
  });

  it("keeps snare tone with a noise component, and hats and cymbals on the noise path", () => {
    for (const key of [37, 38, 40]) {
      expect(drumPatchFor(key).tone).toBeDefined();
      expect(drumPatchFor(key).noise).toBeDefined();
    }
    for (const key of [42, 44, 46, 49, 51, 52]) {
      expect(drumPatchFor(key).tone).toBeUndefined();
      expect(drumPatchFor(key).noise).toBeDefined();
    }
    expect(drumPatchFor(42).hat).toBe("closed");
    expect(drumPatchFor(44).seconds).toBeGreaterThan(drumPatchFor(42).seconds);
    expect(drumPatchFor(46).hat).toBe("open");
    expect(drumPatchFor(46).seconds).toBeGreaterThan(drumPatchFor(44).seconds);
  });
});

it("[B4] compiles the GM note number on a percussion track", () => {
  const score = createEmptyScore();
  const track = createTrack({
    name: "Drum Kit", shortName: "Dr.", icon: "drums", color: "#000",
    strings: [], tuningLabel: "GM drums", kind: "percussion", clef: "percussion"
  });
  score.tracks = [track];
  track.bars[0].voices[0].beats = [
    createBeat({
      rest: false,
      notes: [{ ...createNote(1, 0), midiNumber: 46 }]
    })
  ];
  expect(compilePlayback(score, unrollScore(score)).events).toMatchObject([
    { trackId: track.id, midiPitch: 46, percussion: true }
  ]);
});
