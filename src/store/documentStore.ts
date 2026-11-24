import { applyPatches, produceWithPatches } from "immer";
import { create } from "zustand";
import { cloneScore, defaultCursor, normaliseCursor } from "../engine/editing/operations";
import type { CursorPosition, SelectionRange } from "../engine/editing/types";
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
  mode?: "tab";
  locked?: boolean;
}

export interface EditTransactionOptions {
  cursorAfter?: () => CursorPosition;
  coalesceRevision?: number;
  group?: string;
}

export interface DocumentSession {
  score: Score;
  revision: number;
  savedRevision: number | null;
  undoStack: EditTransaction[];
  redoStack: EditTransaction[];
  view: DocumentViewSettings & { cursor: CursorPosition; selection: SelectionRange | null; trackVisibility: Record<string, boolean> };
}

interface DocumentStore {
  score: Score;
  revision: number;
  savedRevision: number | null;
  dirty: boolean;
  documents: DocumentTabState[];
  activeId: string;
  inactive: Record<string, DocumentSession>;
  getSession: (id: string) => DocumentSession | undefined;
  selectDocument: (id: string) => boolean;
  closeDocument: (id: string) => void;
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
  documents: [],
  inactive: {},
  getSession: (id) => {
    const state = get();
    if (!state.documents.some((tab) => tab.id === id)) return undefined;
    return id === state.activeId ? captureSession(state) : state.inactive[id];
  },
  selectDocument: (id) => {
    const state = get();
    if (id === state.activeId) return false;
    const target = state.inactive[id];
    if (!target) return false;
    const inactive = { ...state.inactive };
    if (state.documents.some((tab) => tab.id === state.activeId)) {
      inactive[state.activeId] = captureSession(state);
    }
    delete inactive[id];
    restoreView(target);
    editGroup++;
    set({ ...sessionState(target, id, state.documents), inactive });
    return true;
  },
  closeDocument: (id) => {
    const state = get();
    const index = state.documents.findIndex((tab) => tab.id === id);
    if (index < 0) return;
    const documents = state.documents.filter((tab) => tab.id !== id);
    const inactive = { ...state.inactive };
    delete inactive[id];
    if (id !== state.activeId) {
      set({ documents, inactive });
      return;
    }
    const next = documents[Math.min(index, documents.length - 1)];
    const target = next && inactive[next.id];
    if (next && target) {
      delete inactive[next.id];
      restoreView(target);
      editGroup++;
      set({ ...sessionState(target, next.id, documents), inactive });
    } else {
      const empty = createEmptyScore();
      const revision = ++nextRevision;
      useViewStore.getState().setDocumentView();
      useViewStore.getState().setCursor(defaultCursor(empty));
      useViewStore.getState().setSelection(null);
      set({ score: empty, ...documentState(empty, newId("doc"), revision, revision), documents, inactive, undoStack: [], redoStack: [], lastRejection: null });
    }
  },
  undoStack: [],
  redoStack: [],
  lastRejection: null,
  loadScore: (score, { documentId = newId("doc"), recovered = false, view, mode, locked = false } = {}) => {
    const state = get();
    if (mode === "tab" && state.documents.some((tab) => tab.id === documentId)) {
      state.selectDocument(documentId);
      return;
    }
    const revision = ++nextRevision;
    const savedRevision = recovered ? null : revision;
    const documents = mode === "tab" ? state.documents : [];
    const inactive = mode === "tab" ? { ...state.inactive } : {};
    if (mode === "tab" && documents.some((tab) => tab.id === state.activeId)) {
      inactive[state.activeId] = captureSession(state);
    }
    const documentView = useViewStore.getState();
    documentView.setDocumentView(view);
    documentView.setCursor(defaultCursor(score));
    documentView.setSelection(null);
    editGroup++;
    set({
      score: cloneScore(score),
      ...documentState(score, documentId, revision, savedRevision, [...documents,
        { id: documentId, title: score.meta.title || "Untitled", dirty: revision !== savedRevision, locked }
      ]),
      inactive,
      undoStack: [],
      redoStack: [],
      lastRejection: null
    });
  },
  setScore: (score) =>
    set((state) => ({
      score: cloneScore(score),
      ...documentState(score, state.activeId, ++nextRevision, state.savedRevision, state.documents),
      undoStack: [],
      redoStack: []
    })),
  endEditGroup: () => { editGroup++; },
  markSaved: (documentId, revision) => {
    const state = get();
    if (state.activeId === documentId) {
      set(documentState(state.score, state.activeId, state.revision, revision, state.documents));
    } else {
      const session = state.inactive[documentId];
      if (!session) return;
      set({
        inactive: { ...state.inactive, [documentId]: { ...session, savedRevision: revision } },
        documents: state.documents.map((tab) => tab.id === documentId
          ? { ...tab, dirty: session.revision !== revision } : tab)
      });
    }
  },
  transact: (label, recipe, options) => {
    const state = get();
    if (state.documents.find((tab) => tab.id === state.activeId)?.locked) return state.score;
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

    const tieRepairs = inspectTies(edited, true);
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
      ...documentState(after, state.activeId, revision, state.savedRevision, state.documents),
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
      ...documentState(score, state.activeId, transaction.revisionBefore, state.savedRevision, state.documents),
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
      ...documentState(score, state.activeId, transaction.revisionAfter, state.savedRevision, state.documents),
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
  savedRevision: number | null,
  documents: DocumentTabState[] = []
) {
  const dirty = revision !== savedRevision;
  return {
    activeId: documentId,
    revision,
    savedRevision,
    dirty,
    documents: documents.map((tab) => tab.id === documentId
      ? { ...tab, title: score.meta.title || "Untitled", dirty } : tab)
  };
}

function captureSession(state: DocumentStore): DocumentSession {
  const { cursor, selection, trackVisibility, zoom, displayMode } = useViewStore.getState();
  return {
    score: state.score, revision: state.revision, savedRevision: state.savedRevision,
    undoStack: state.undoStack, redoStack: state.redoStack,
    view: { cursor, selection, trackVisibility, zoom, displayMode }
  };
}

function restoreView(session: DocumentSession): void {
  const { cursor, selection, trackVisibility, zoom, displayMode } = session.view;
  useViewStore.setState({
    zoom, displayMode, trackVisibility,
    cursor: normaliseCursor(session.score, cursor),
    selection: selection ? { ...selection, anchor: normaliseCursor(session.score, selection.anchor), head: normaliseCursor(session.score, selection.head) } : null
  });
}

function sessionState(session: DocumentSession, id: string, documents: DocumentTabState[]) {
  return {
    score: session.score,
    ...documentState(session.score, id, session.revision, session.savedRevision, documents),
    undoStack: session.undoStack,
    redoStack: session.redoStack,
    lastRejection: null
  };
}
