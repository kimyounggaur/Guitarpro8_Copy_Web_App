import { create } from "zustand";
import { cloneScore, normaliseCursor } from "../engine/editing/operations";
import type { CursorPosition } from "../engine/editing/types";
import { createEmptyScore } from "../model/factory";
import { checkInvariants, type InvariantIssue } from "../model/invariants";
import { newId } from "../model/ids";
import { normalizeTies } from "../model/ties";
import type { Score } from "../model/types";
import { useViewStore } from "./viewStore";

export interface EditTransaction {
  label: string;
  before: Score;
  after: Score;
  revisionBefore: number;
  revisionAfter: number;
  cursorBefore: CursorPosition;
  cursorAfter: CursorPosition;
}

export interface DocumentTabState {
  id: string;
  title: string;
  dirty: boolean;
  locked: boolean;
}

export interface LoadScoreOptions {
  documentId?: string;
  recovered?: boolean;
}

export interface EditTransactionOptions {
  cursorAfter?: () => CursorPosition;
  coalesceRevision?: number;
}

interface DocumentStore {
  score: Score;
  revision: number;
  savedRevision: number | null;
  dirty: boolean;
  documents: DocumentTabState[];
  activeId: string;
  undoStack: EditTransaction[];
  redoStack: EditTransaction[];
  lastRejection: { label: string; issues: InvariantIssue[] } | null;
  loadScore: (score: Score, options?: LoadScoreOptions) => void;
  setScore: (score: Score) => void;
  markSaved: (documentId: string, revision: number) => void;
  transact: (label: string, recipe: (score: Score) => void, options?: EditTransactionOptions) => Score;
  undo: () => Score;
  redo: () => Score;
}

let nextRevision = 0;
const initialId = newId("doc");
const initialScore = createEmptyScore();

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  score: initialScore,
  ...documentState(initialScore, initialId, nextRevision, nextRevision),
  undoStack: [],
  redoStack: [],
  lastRejection: null,
  loadScore: (score, { documentId = newId("doc"), recovered = false } = {}) => {
    const revision = ++nextRevision;
    set({
      score: cloneScore(score),
      ...documentState(score, documentId, revision, recovered ? null : revision),
      undoStack: [],
      redoStack: []
    });
  },
  setScore: (score) =>
    set((state) => ({
      score: cloneScore(score),
      ...documentState(score, state.activeId, ++nextRevision, state.savedRevision),
      undoStack: [],
      redoStack: []
    })),
  markSaved: (documentId, revision) => {
    const state = get();
    if (state.activeId === documentId) {
      set(documentState(state.score, state.activeId, state.revision, revision));
    }
  },
  transact: (label, recipe, options) => {
    const state = get();
    const view = useViewStore.getState();
    const cursorBefore = { ...view.cursor };
    const before = cloneScore(state.score);
    const after = cloneScore(before);
    recipe(after);
    const issues = [...normalizeTies(after), ...checkInvariants(after)];
    if (issues.some(({ severity }) => severity === "fatal")) {
      set({ lastRejection: { label, issues } });
      return state.score;
    }
    const revision = ++nextRevision;
    const cursorAfter = normaliseCursor(after, options?.cursorAfter?.() ?? cursorBefore);
    const previous = state.undoStack[state.undoStack.length - 1];
    const coalesce = previous
      && previous.label === label
      && previous.revisionAfter === state.revision
      && options?.coalesceRevision === state.revision
      && state.savedRevision !== state.revision;
    const transaction: EditTransaction = {
      label,
      before: coalesce ? previous.before : before,
      after: cloneScore(after),
      revisionBefore: coalesce ? previous.revisionBefore : state.revision,
      revisionAfter: revision,
      cursorBefore: coalesce ? previous.cursorBefore : cursorBefore,
      cursorAfter
    };

    set({
      score: after,
      lastRejection: null,
      ...documentState(after, state.activeId, revision, state.savedRevision),
      undoStack: [...(coalesce ? state.undoStack.slice(0, -1) : state.undoStack), transaction],
      redoStack: []
    });
    if (options?.cursorAfter) view.setCursor({ ...cursorAfter });

    return after;
  },
  undo: () => {
    const state = get();
    const transaction = state.undoStack[state.undoStack.length - 1];
    if (!transaction) return state.score;

    const score = cloneScore(transaction.before);
    set({
      score,
      ...documentState(score, state.activeId, transaction.revisionBefore, state.savedRevision),
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, transaction]
    });
    const view = useViewStore.getState();
    view.setSelection(null);
    view.setCursor({ ...transaction.cursorBefore });
    return score;
  },
  redo: () => {
    const state = get();
    const transaction = state.redoStack[state.redoStack.length - 1];
    if (!transaction) return state.score;

    const score = cloneScore(transaction.after);
    set({
      score,
      ...documentState(score, state.activeId, transaction.revisionAfter, state.savedRevision),
      undoStack: [...state.undoStack, transaction],
      redoStack: state.redoStack.slice(0, -1)
    });
    const view = useViewStore.getState();
    view.setSelection(null);
    view.setCursor({ ...transaction.cursorAfter });
    return score;
  }
}));

function documentState(
  score: Score,
  documentId: string,
  revision: number,
  savedRevision: number | null
) {
  const dirty = revision !== savedRevision;
  return {
    activeId: documentId,
    revision,
    savedRevision,
    dirty,
    documents: [{ id: documentId, title: score.meta.title || "Untitled", dirty, locked: false }]
  };
}
