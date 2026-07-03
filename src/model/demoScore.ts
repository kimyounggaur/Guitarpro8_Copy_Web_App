import { createBar, createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "./factory";
import type { Beat, Score } from "./types";

const guitarPattern = [
  [6, 0],
  [5, 2],
  [4, 2],
  [3, 1]
] as const;

const bassPattern = [
  [4, 0],
  [4, 2],
  [3, 0],
  [3, 2]
] as const;

export function createDemoScore(): Score {
  const score = createEmptyScore();
  score.meta.title = "Phase 2a Demo Score";
  score.masterBars = Array.from({ length: 8 }, () => createMasterBar());
  score.masterBars[3].layout.forcedBreak = true;

  const guitar = createTrack(undefined, score.masterBars.length);
  guitar.name = "Guitar";
  guitar.shortName = "Gtr.";
  guitar.color = "#2563eb";

  const bass = createTrack(
    {
      name: "Bass",
      shortName: "Bs.",
      color: "#c2410c",
      icon: "bass",
      strings: [28, 33, 38, 43],
      tuningLabel: "E A D G"
    },
    score.masterBars.length
  );
  bass.notationTypes = ["standard", "tab"];

  score.tracks = [guitar, bass];

  score.tracks.forEach((track, trackIndex) => {
    track.bars = score.masterBars.map((_, barIndex) =>
      demoBar(trackIndex === 0 ? guitarPattern : bassPattern, barIndex)
    );
  });

  return score;
}

function demoBar(pattern: readonly (readonly [number, number])[], barIndex: number) {
  const bar = createBar();
  const rotation = barIndex % pattern.length;
  const beats: Beat[] = pattern.map((_, index) => {
    const [string, fret] = pattern[(index + rotation) % pattern.length];
    const note = createNote(string, fret + (barIndex % 3));
    return createBeat({ duration: 4, rest: false, notes: [note] });
  });

  bar.voices[0].beats = beats;
  return bar;
}
