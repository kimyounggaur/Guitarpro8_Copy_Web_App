import { applyPatches, produceWithPatches } from "immer";
import { create } from "zustand";
import { cloneScore, normaliseCursor } from "../engine/editing/operations";
import type { CursorPosition } from "../engine/editing/types";
import { createEmptyScore } from "../model/factory";
import { checkInvariants, type InvariantIssue } from "../model/invariants";
import { newId } from "../model/ids";
import { applyTieRepairs, inspectTies } from "../model/ties";
import type { DocumentViewSettings, Score } from "../model/types";
import { appendEdit, type EditTransaction } from "./history";
import { useViewStore } from "./viewStore";

export interface DocumentTabState {
  id: string;
  title: string;
  dirty: boolean;
  locked: boolean;
}

export interface LoadScoreOptions {
  documentId?: string;
  recovered?: boolean;
  view?: DocumentViewSettings;
}

export interface EditTransactionOptions {
  cursorAfter?: () => CursorPosition;
  coalesceRevision?: number;
  group?: string;
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
  endEditGroup: () => void;
  markSaved: (documentId: string, revision: number) => void;
  transact: (label: string, recipe: (score: Score) => void, options?: EditTransactionOptions) => Score;
  undo: () => Score;
  redo: () => Score;
}

let nextRevision = 0;
let editGroup = 0;
const initialId = newId("doc");
const initialScore = createEmptyScore();

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  score: initialScore,
  ...documentState(initialScore, initialId, nextRevision, nextRevision),
  undoStack: [],
  redoStack: [],
  lastRejection: null,
  loadScore: (score, { documentId = newId("doc"), recovered = false, view } = {}) => {
    const revision = ++nextRevision;
    set({
      score: cloneScore(score),
      ...documentState(score, documentId, revision, recovered ? null : revision),
      undoStack: [],
      redoStack: [],
      lastRejection: null
    });
    useViewStore.getState().setDocumentView(view);
  },
  setScore: (score) =>
    set((state) => ({
      score: cloneScore(score),
      ...documentState(score, state.activeId, ++nextRevision, state.savedRevision),
      undoStack: [],
      redoStack: []
    })),
  endEditGroup: () => { editGroup++; },
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
    const [edited, forward, inverse] = produceWithPatches(state.score, (draft) => {
      recipe(draft);
    });
    if (forward.length === 0) {
      if (state.lastRejection) set({ lastRejection: null });
      if (options?.cursorAfter) {
        view.setCursor(normaliseCursor(state.score, options.cursorAfter()));
      }
      return state.score;
    }

    const tieRepairs = inspectTies(edited);
    const [after, repairs, revertRepairs] = tieRepairs.length > 0
      ? produceWithPatches(edited, (draft) => { applyTieRepairs(draft, tieRepairs); })
      : [edited, [], []] as const;
    const issues = [...tieRepairs.flatMap(({ issue }) => issue ? [issue] : []), ...checkInvariants(after)];
    if (issues.some(({ severity }) => severity === "fatal")) {
      set({ lastRejection: { label, issues } });
      return state.score;
    }

    const revision = ++nextRevision;
    const cursorAfter = normaliseCursor(after, options?.cursorAfter?.() ?? cursorBefore);
    const transaction: EditTransaction = {
      label,
      patches: [...forward, ...repairs],
      inversePatches: [...revertRepairs, ...inverse],
      revisionBefore: state.revision,
      revisionAfter: revision,
      cursorBefore,
      cursorAfter,
      time: Date.now(),
      repeatable: options?.cursorAfter !== undefined,
      group: options?.group === undefined ? undefined : `${editGroup}:${options.group}`
    };
    set({
      score: after,
      lastRejection: null,
      ...documentState(after, state.activeId, revision, state.savedRevision),
      undoStack: appendEdit(state.undoStack, transaction, state.savedRevision, options?.coalesceRevision),
      redoStack: []
    });
    if (options?.cursorAfter) view.setCursor({ ...cursorAfter });

    return after;
  },
  undo: () => {
    const state = get();
    const transaction = state.undoStack[state.undoStack.length - 1];
    if (!transaction) return state.score;

    const score = applyPatches(state.score, transaction.inversePatches);
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

    const score = applyPatches(state.score, transaction.patches);
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
