import { describe, expect, it } from "vitest";
import { createEmptyScore, createTrack } from "../../model/factory";
import { buildNoteMix, createDefaultMixerState, toggleEffectSlot } from "./mixer";

describe("Phase 7 mixer and automation", () => {
  it("applies solo mute masks before gain calculation", () => {
    const score = scoreWithTwoTracks();
    const mixer = createDefaultMixerState(score.tracks);
    const [guitar, bass] = score.tracks;

    mixer.tracks[bass.id].solo = true;

    expect(buildNoteMix(score, guitar.id, 0, mixer, null).muted).toBe(true);
    expect(buildNoteMix(score, bass.id, 0, mixer, null).muted).toBe(false);
  });

  it("combines volume, pan, automation, and focus", () => {
    const score = scoreWithTwoTracks();
    const [guitar, bass] = score.tracks;
    const mixer = createDefaultMixerState(score.tracks);

    score.masterAutomations = [
      {
        type: "volume",
        scope: "master",
        points: [{ tick: 0, value: 0.5, transition: "constant" }]
      },
      {
        type: "pan",
        scope: "master",
        points: [{ tick: 0, value: 0.1, transition: "constant" }]
      }
    ];
    guitar.automations = [
      {
        type: "volume",
        scope: "track",
        points: [
          { tick: 0, value: 0.5, transition: "progressive" },
          { tick: 960, value: 1, transition: "constant" }
        ]
      },
      {
        type: "pan",
        scope: "track",
        points: [{ tick: 0, value: -0.2, transition: "constant" }]
      }
    ];
    mixer.tracks[guitar.id].volume = 1;
    mixer.tracks[guitar.id].pan = 0.2;
    mixer.master.focusPercent = 50;

    const focused = buildNoteMix(score, guitar.id, 480, mixer, guitar.id);
    const unfocused = buildNoteMix(score, bass.id, 480, mixer, guitar.id);

    expect(focused.gain).toBeCloseTo(0.375, 5);
    expect(focused.pan).toBeCloseTo(0.1, 5);
    expect(unfocused.gain).toBeLessThan(focused.gain);
  });

  it("toggles effect slots while respecting the chain cap", () => {
    const score = scoreWithTwoTracks();
    const mixer = createDefaultMixerState(score.tracks);
    const trackId = score.tracks[0].id;
    const withoutOverdrive = toggleEffectSlot(mixer, trackId, "overdrive");
    const withDelay = toggleEffectSlot(withoutOverdrive, trackId, "delay");

    expect(withoutOverdrive.tracks[trackId].effectChain.some((slot) => slot.type === "overdrive")).toBe(false);
    expect(withDelay.tracks[trackId].effectChain.some((slot) => slot.type === "delay")).toBe(true);
    expect(withDelay.tracks[trackId].effectChain.length).toBeLessThanOrEqual(6);
  });
});

function scoreWithTwoTracks() {
  const score = createEmptyScore();
  score.tracks = [createTrack(undefined, 1), createTrack(undefined, 1)];
  score.tracks[0].name = "Guitar";
  score.tracks[1].name = "Bass";
  return score;
}
