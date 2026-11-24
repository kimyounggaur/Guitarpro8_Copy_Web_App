import { describe, expect, it } from "vitest";
import { createEmptyScore, createTrack } from "../../model/factory";
import { createDefaultMixerState, faderToGain, normalizeVolume, resolveTrackOutput, toggleEffectSlot } from "./mixer";

describe("track output and automation", () => {
  it("applies solo mute masks before gain calculation", () => {
    const score = scoreWithTwoTracks();
    const mixer = createDefaultMixerState(score.tracks);
    const [guitar, bass] = score.tracks;
    mixer.tracks[bass.id].solo = true;
    expect(resolveTrackOutput(mixer, guitar.id, null).muted).toBe(true);
    expect(resolveTrackOutput(mixer, bass.id, null).muted).toBe(false);
  });

  it("uses manual gain and pan and reduces unfocused tracks", () => {
    const score = scoreWithTwoTracks();
    const [guitar, bass] = score.tracks;
    const mixer = createDefaultMixerState(score.tracks);
    mixer.tracks[guitar.id].volume = 0.75;
    mixer.tracks[guitar.id].pan = 0.25;
    mixer.master.focusPercent = 50;
    const focused = resolveTrackOutput(mixer, guitar.id, guitar.id);
    const unfocused = resolveTrackOutput(mixer, bass.id, guitar.id);
    expect(focused).toMatchObject({ gain: 0.75, pan: 0.25 });
    expect(unfocused.gain).toBeLessThan(focused.gain);
  });

  it("toggles effect slots while respecting the chain cap", () => {
    const score = scoreWithTwoTracks();
    const mixer = createDefaultMixerState(score.tracks);
    const guitar = mixer.tracks[score.tracks[0].id];
    expect(guitar).toMatchObject({ eq: "flat", effectChain: [] });
    const driven = toggleEffectSlot(guitar.effectChain, "overdrive");
    const dry = toggleEffectSlot(driven, "overdrive");
    const delayed = toggleEffectSlot(dry, "delay");
    expect(dry.some((slot) => slot.type === "overdrive")).toBe(false);
    expect(delayed.some((slot) => slot.type === "delay")).toBe(true);
    expect(delayed.length).toBeLessThanOrEqual(6);
  });

  it("[A8] normalizes old percentages before applying the squared fader curve", () => {
    expect(normalizeVolume(1.2)).toBe(1);
    expect(normalizeVolume(1.08)).toBe(1);
    expect(normalizeVolume(85)).toBe(0.85);
    expect(faderToGain(0.75)).toBe(0.5625);
  });
});

function scoreWithTwoTracks() {
  const score = createEmptyScore();
  score.tracks = [createTrack(), createTrack()];
  return score;
}
