import { describe, expect, it } from "vitest";
import { createDemoScore } from "../model/demoScore";
import { useDocumentStore } from "./documentStore";

function reset() {
  useDocumentStore.getState().loadScore(createDemoScore());
  return useDocumentStore.getState();
}

function changeTitle(title: string) {
  useDocumentStore.getState().transact("Change title", (score) => {
    score.meta.title = title;
  });
  return useDocumentStore.getState();
}

describe("[A10] document save and history revisions", () => {
  it("marks the written revision and restores clean state on undo", () => {
    reset();
    const written = changeTitle("Written version");
    const current = changeTitle("Later edits");
    current.markSaved(written.activeId, written.revision);
    expect(useDocumentStore.getState().dirty).toBe(true);

    useDocumentStore.getState().undo();
    expect(useDocumentStore.getState()).toMatchObject({ dirty: false, revision: written.revision });
    expect(useDocumentStore.getState().documents[0]).toMatchObject({ dirty: false, title: "Written version" });

    useDocumentStore.getState().redo();
    expect(useDocumentStore.getState()).toMatchObject({ dirty: true, revision: current.revision });
  });

  it("assigns a fresh revision when an undo is followed by a different edit", () => {
    reset();
    const written = changeTitle("Original edit");
    written.markSaved(written.activeId, written.revision);
    useDocumentStore.getState().undo();

    const replacement = changeTitle("Replacement edit");
    expect(replacement.revision).not.toBe(written.revision);
    expect(replacement.dirty).toBe(true);
    expect(replacement.redoStack).toHaveLength(0);
  });
});
