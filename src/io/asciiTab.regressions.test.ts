import { expect, test } from "vitest";
import { importAsciiTab } from "./asciiTab";

const system = ["e|--2--|", "B|-----|", "G|-----|", "D|-----|", "A|-----|", "E|-----|"];

test("[A9] ASCII systems concatenate their bars on one six-string track", () => {
  const score = importAsciiTab([...system, "", ...system].join("\n"));
  expect(score.tracks).toHaveLength(1);
  expect(score.tracks[0].tuning.strings).toHaveLength(6);
  expect(score.masterBars).toHaveLength(2);
  expect(score.tracks[0].bars).toHaveLength(2);
  expect(score.tracks[0].bars[1].voices[0].beats[0].notes[0]).toMatchObject({ string: 1, fret: 2 });
});

test("[A9] an inconsistent ASCII system identifies its number", () => {
  expect(() => importAsciiTab([...system, "", ...system.slice(0, 5)].join("\n"))).toThrow(/2번째 묶음의 줄 수/);
});
