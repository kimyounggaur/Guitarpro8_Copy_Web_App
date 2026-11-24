import { beforeEach, describe, expect, it } from "vitest";
import { createBeat, createEmptyScore, createNote, createTrack } from "../model/factory";
import { useDocumentStore } from "./documentStore";
import { useViewStore } from "./viewStore";

beforeEach(() => {
  const score = createEmptyScore();
  score.tracks.push(createTrack(), createTrack());
  const notes = [
    createNote(1, 5),
    { ...createNote(1, 5), tiedFromPrevious: true },
    { ...createNote(1, 5), tiedFromPrevious: true }
  ];
  score.tracks[0].bars[0].voices[0].beats = notes.map((note) => createBeat({ rest: false, notes: [note] }));
  useDocumentStore.getState().loadScore(score);
});

describe("[C5] patch-based undo", () => {
  it("groups a title editing session and restores forward and inverse patches in order", () => {
    const store = useDocumentStore.getState();
    for (const title of ["H", "He", "Hel", "Hell", "Hello"]) {
      store.transact("Edit song info", (draft) => { draft.meta.title = title; }, { group: "song-info:title" });
    }
    store.endEditGroup();

    expect(useDocumentStore.getState().undoStack).toHaveLength(1);
    expect(store.undo().meta.title).toBe("");
    expect(store.redo().meta.title).toBe("Hello");

    store.transact("Edit song info", (draft) => { draft.meta.title = "New title"; }, { group: "song-info:title" });
    expect(useDocumentStore.getState().undoStack).toHaveLength(2);
    expect(store.undo().meta.title).toBe("Hello");
  });

  it("keeps unrelated tracks shared and includes repaired ties in the same history step", () => {
    const store = useDocumentStore.getState();
    const changed = store.transact("Set fret", (draft) => {
      draft.tracks[0].bars[0].voices[0].beats[0].notes[0].fret = 7;
    });
    const frets = (score: typeof changed) => score.tracks[0].bars[0].voices[0].beats.map((beat) => beat.notes[0].fret);
    expect(changed.tracks[1]).toBe(store.score.tracks[1]);
    expect(frets(changed)).toEqual([7, 7, 7]);
    expect(frets(store.undo())).toEqual([5, 5, 5]);
    expect(frets(store.redo())).toEqual([7, 7, 7]);
  });

  it("keeps zoom and display mode independent of dirty state and undo", () => {
    const before = useDocumentStore.getState();
    const view = useViewStore.getState();
    view.setZoom(125);
    view.setDisplayMode("horizontal-page");

    expect(useDocumentStore.getState()).toBe(before);
    expect(before.undoStack).toHaveLength(0);
    expect(before.dirty).toBe(false);
    expect(useViewStore.getState()).toMatchObject({ zoom: 125, displayMode: "horizontal-page" });
  });
});
