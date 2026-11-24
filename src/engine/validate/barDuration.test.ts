import { expect, it } from "vitest";
import { createBeat, createEmptyScore, createMasterBar, createTrack } from "../../model/factory";
import { checkInvariants } from "../../model/invariants";
import { validateBarDurations } from "./barDuration";

it("[D6] reports the same incomplete voices used for editing warnings and cleanup", () => {
  const score = createEmptyScore();
  score.masterBars = Array.from({ length: 3 }, createMasterBar);
  score.masterBars[0].anacrusis = true;
  const track = createTrack(undefined, 3);
  score.tracks = [track];
  for (const bar of track.bars) bar.voices[0].beats = [createBeat()];
  const location = { trackId: track.id, barIndex: 1, voiceIndex: 0 };

  expect(validateBarDurations(score)).toEqual([
    { ...location, trackName: track.shortName, actual: 480, expected: 1920 }
  ]);
  expect(checkInvariants(score).filter(({ code }) => code === "bar-length")).toEqual([
    expect.objectContaining({ location, severity: "warning" })
  ]);
});
