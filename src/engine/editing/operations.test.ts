import { describe, expect, it } from "vitest";
import { createBeat, createEmptyScore, createNote, createTrack } from "../../model/factory";
import { useDocumentStore } from "../../store/documentStore";
import {
  defaultCursor,
  inputFret,
  moveRightWithScoreMutation,
  setDynamicAtCursor,
  shouldMutateOnMoveRight,
  tieCurrentNoteToNext,
  toggleBarSymbolAtCursor,
  toggleBeatEffectAtCursor,
  toggleNoteEffectAtCursor,
  toggleTripletAtCursor
} from "./operations";

describe("Phase 3 editing operations", () => {
  it("inputs tablature fret numbers at the cursor string", () => {
    const score = scoreWithTrack();
    const cursor = defaultCursor(score);

    inputFret(score, { ...cursor, string: 2 }, 7);

    const beat = score.tracks[0].bars[0].voices[0].beats[0];
    expect(beat.rest).toBe(false);
    expect(beat.notes).toContainEqual(expect.objectContaining({ string: 2, fret: 7 }));
  });

  it("adds a matching-duration beat when moving right in an incomplete bar", () => {
    const score = scoreWithTrack();
    const cursor = defaultCursor(score);
    score.tracks[0].bars[0].voices[0].beats = [createBeat({ duration: 8 })];

    expect(shouldMutateOnMoveRight(score, cursor)).toBe(true);
    const next = moveRightWithScoreMutation(score, cursor);

    expect(next).toMatchObject({ barIndex: 0, beatIndex: 1 });
    expect(score.tracks[0].bars[0].voices[0].beats[1]).toMatchObject({
      duration: 8,
      rest: true
    });
  });

  it("adds a new bar on right arrow at the complete score end", () => {
    const score = scoreWithTrack();
    score.tracks[0].bars[0].voices[0].beats = [
      createBeat({ duration: 4 }),
      createBeat({ duration: 4 }),
      createBeat({ duration: 4 }),
      createBeat({ duration: 4 })
    ];

    const next = moveRightWithScoreMutation(score, {
      ...defaultCursor(score),
      beatIndex: 3
    });

    expect(score.masterBars).toHaveLength(2);
    expect(score.tracks[0].bars).toHaveLength(2);
    expect(next).toMatchObject({ barIndex: 1, beatIndex: 0 });
  });

  it("creates tie references between adjacent beats", () => {
    const score = scoreWithTrack();
    const cursor = defaultCursor(score);
    const first = createBeat({ duration: 2, rest: false, notes: [createNote(2, 5)] });
    const second = createBeat({ duration: 2, rest: false, notes: [createNote(2, 5)] });
    score.tracks[0].bars[0].voices[0].beats = [first, second];

    tieCurrentNoteToNext(score, { ...cursor, string: 2 });

    expect(first.notes[0].tieDestination).toMatchObject({ beatIndex: 1, noteIndex: 0 });
    expect(second.notes[0].tieOrigin).toMatchObject({ beatIndex: 0, noteIndex: 0 });
  });

  it("keeps undo and redo as score transactions", () => {
    const score = scoreWithTrack();
    const store = useDocumentStore.getState();
    store.loadScore(score);

    useDocumentStore.getState().transact("Triplet", (draft) => {
      toggleTripletAtCursor(draft, defaultCursor(draft));
    });

    expect(useDocumentStore.getState().score.tracks[0].bars[0].voices[0].beats[0].tuplet).toEqual({
      n: 3,
      m: 2
    });

    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState().score.tracks[0].bars[0].voices[0].beats[0].tuplet).toBeUndefined();

    useDocumentStore.getState().redo();
    expect(useDocumentStore.getState().score.tracks[0].bars[0].voices[0].beats[0].tuplet).toEqual({
      n: 3,
      m: 2
    });
  });

  it("toggles phase 5 master-bar symbols", () => {
    const score = scoreWithTrack();
    const cursor = defaultCursor(score);

    toggleBarSymbolAtCursor(score, cursor, "repeatOpen");
    toggleBarSymbolAtCursor(score, cursor, "alternateEnding");
    toggleBarSymbolAtCursor(score, cursor, "fermata");

    expect(score.masterBars[0].repeatOpen).toBe(true);
    expect(score.masterBars[0].alternateEndings).toBe(1);
    expect(score.masterBars[0].fermatas[0]).toMatchObject({ beatTick: 0 });
  });

  it("toggles phase 5 note and beat effects", () => {
    const score = scoreWithTrack();
    const cursor = { ...defaultCursor(score), string: 2 };
    score.tracks[0].bars[0].voices[0].beats[0] = createBeat({
      duration: 4,
      rest: false,
      notes: [createNote(2, 5)]
    });

    toggleNoteEffectAtCursor(score, cursor, "bend");
    toggleNoteEffectAtCursor(score, cursor, "palmMute");
    setDynamicAtCursor(score, cursor, 6);
    toggleBeatEffectAtCursor(score, cursor, "brushDown");

    const beat = score.tracks[0].bars[0].voices[0].beats[0];
    expect(beat.notes[0].bend?.points).toHaveLength(2);
    expect(beat.notes[0].palmMute).toBe(true);
    expect(beat.notes[0].dynamic).toBe(6);
    expect(beat.brush).toMatchObject({ direction: "down" });
  });
});

function scoreWithTrack() {
  const score = createEmptyScore();
  score.tracks = [createTrack(undefined, score.masterBars.length)];
  score.tracks[0].bars[0].voices[0].beats = [createBeat({ duration: 4 })];
  return score;
}
