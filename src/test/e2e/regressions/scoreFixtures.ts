import { createBeat, createEmptyScore, createMasterBar, createNote, createTrack } from "../../../model/factory";

export function guitarWithBars(barFrets: ReadonlyArray<ReadonlyArray<number>>) {
  const score = createEmptyScore();
  score.meta.title = "Guitar regression";
  score.masterBars = barFrets.map(() => createMasterBar());
  const guitar = createTrack(undefined, barFrets.length);
  guitar.id = "test-guitar";
  guitar.bars.forEach((bar, index) => {
    bar.voices[0].beats = barFrets[index].map((fret) => createBeat({ rest: false, notes: [createNote(1, fret)] }));
  });
  score.tracks = [guitar];
  return score;
}
