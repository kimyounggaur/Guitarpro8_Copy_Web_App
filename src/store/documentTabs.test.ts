import { describe, expect, it } from "vitest";
import { emptyGuitar } from "../test/fixtures";
import { useDocumentStore } from "./documentStore";
import { useViewStore } from "./viewStore";

const store = useDocumentStore.getState;
const view = useViewStore.getState;

describe("document tabs", () => {
  it("restores a tab's history, cursor, selection and view independently", () => {
    store().loadScore(emptyGuitar(2), { documentId: "first" });
    const first = store().score.tracks[0].id;
    const originalCursor = { ...view().cursor, barIndex: 1 };
    const selection = { anchor: originalCursor, head: originalCursor };
    view().setCursor(originalCursor);
    view().setSelection(selection);
    view().setZoom(130);
    view().setTrackVisible(first, false);
    view().setMultiVoiceEdit(true);
    view().setMultiTrackView(false);
    store().transact("Set first title", (score) => { score.meta.title = "First"; });
    const firstRevision = store().revision;
    store().undo();
    view().setSelection(selection);

    store().loadScore(emptyGuitar(1), { documentId: "second", mode: "tab" });
    expect(view()).toMatchObject({ zoom: 100, selection: null, trackVisibility: {}, multiVoiceEdit: false, multiTrackView: true });
    expect(store().undoStack).toHaveLength(0);
    store().transact("Set second title", (score) => { score.meta.title = "Second"; });
    const secondRevision = store().revision;

    store().markSaved("second", secondRevision);
    expect(store().selectDocument("first")).toBe(true);
    expect(view()).toMatchObject({
      cursor: originalCursor, selection, zoom: 130, trackVisibility: { [first]: false }, multiVoiceEdit: true, multiTrackView: false
    });
    expect(store().redoStack).toHaveLength(1);
    store().redo();
    expect(store().revision).toBe(firstRevision);
    expect(store().score.meta.title).toBe("First");

    store().markSaved("first", firstRevision);
    store().selectDocument("second");
    expect(store()).toMatchObject({ activeId: "second", dirty: false, revision: secondRevision });
    expect(store().score.meta.title).toBe("Second");
    expect(store().undoStack).toHaveLength(1);
  });

  it("reuses the stable ID of an already open score and chooses the adjacent tab after close", () => {
    store().loadScore(emptyGuitar(1), { documentId: "first" });
    store().loadScore(emptyGuitar(1), { documentId: "second", mode: "tab" });
    store().transact("Rename", (score) => { score.meta.title = "Edited second"; });
    store().loadScore(emptyGuitar(1), { documentId: "third", mode: "tab", locked: true });
    store().transact("Rename", (score) => { score.meta.title = "Blocked"; });
    expect(store().score.meta.title).not.toBe("Blocked");
    expect(store().documents.at(-1)?.locked).toBe(true);

    store().loadScore(emptyGuitar(1), { documentId: "second", mode: "tab" });
    expect(store().documents).toHaveLength(3);
    expect(store().score.meta.title).toBe("Edited second");
    expect(store().dirty).toBe(true);

    store().closeDocument("second");
    expect(store().activeId).toBe("third");
    expect(store().getSession("second")).toBeUndefined();
    store().closeDocument("third");
    expect(store().activeId).toBe("first");
    store().closeDocument("first");
    expect(store().documents).toHaveLength(0);
    expect(store().score.tracks).toHaveLength(0);
  });
});
