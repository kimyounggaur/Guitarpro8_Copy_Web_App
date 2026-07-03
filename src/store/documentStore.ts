import { create } from "zustand";
import { cloneScore } from "../engine/editing/operations";
import { createEmptyScore } from "../model/factory";
import type { Score } from "../model/types";

export interface EditTransaction {
  label: string;
  before: Score;
  after: Score;
}

export interface DocumentTabState {
  id: string;
  title: string;
  dirty: boolean;
  locked: boolean;
}

interface DocumentStore {
  score: Score;
  dirty: boolean;
  documents: DocumentTabState[];
  activeId: string;
  undoStack: EditTransaction[];
  redoStack: EditTransaction[];
  loadScore: (score: Score) => void;
  setScore: (score: Score) => void;
  transact: (label: string, recipe: (score: Score) => void) => Score;
  undo: () => Score;
  redo: () => Score;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  score: createEmptyScore(),
  dirty: false,
  documents: [{ id: "demo", title: "Phase 3 Demo", dirty: false, locked: false }],
  activeId: "demo",
  undoStack: [],
  redoStack: [],
  loadScore: (score) =>
    set({
      score: cloneScore(score),
      dirty: false,
      documents: [{ id: "demo", title: score.meta.title || "Untitled", dirty: false, locked: false }],
      activeId: "demo",
      undoStack: [],
      redoStack: []
    }),
  setScore: (score) =>
    set((state) => ({
      score: cloneScore(score),
      dirty: true,
      documents: markActiveDirty(state.documents, state.activeId, true)
    })),
  transact: (label, recipe) => {
    const before = cloneScore(get().score);
    const after = cloneScore(before);
    recipe(after);

    set((state) => ({
      score: after,
      dirty: true,
      documents: markActiveDirty(state.documents, state.activeId, true),
      undoStack: [...state.undoStack, { label, before, after: cloneScore(after) }],
      redoStack: []
    }));

    return after;
  },
  undo: () => {
    const state = get();
    const transaction = state.undoStack[state.undoStack.length - 1];

    if (!transaction) {
      return state.score;
    }

    const score = cloneScore(transaction.before);
    set({
      score,
      dirty: state.undoStack.length > 1,
      documents: markActiveDirty(state.documents, state.activeId, state.undoStack.length > 1),
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, transaction]
    });

    return score;
  },
  redo: () => {
    const state = get();
    const transaction = state.redoStack[state.redoStack.length - 1];

    if (!transaction) {
      return state.score;
    }

    const score = cloneScore(transaction.after);
    set({
      score,
      dirty: true,
      documents: markActiveDirty(state.documents, state.activeId, true),
      undoStack: [...state.undoStack, transaction],
      redoStack: state.redoStack.slice(0, -1)
    });

    return score;
  }
}));

function markActiveDirty(
  documents: DocumentTabState[],
  activeId: string,
  dirty: boolean
): DocumentTabState[] {
  return documents.map((document) =>
    document.id === activeId ? { ...document, dirty } : document
  );
}
