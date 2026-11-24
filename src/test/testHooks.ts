import { defaultCursor } from "../engine/editing/operations";
import type { CursorPosition, SelectionRange } from "../engine/editing/types";
import { readScoreFile } from "../io/fileFormat";
import type { Score } from "../model/types";
import { useDocumentStore } from "../store/documentStore";
import { usePlaybackStore } from "../store/playbackStore";
import { useViewStore } from "../store/viewStore";

interface GpwTestHooks {
  getScore(): Score;
  getCursor(): CursorPosition;
  getSelection(): SelectionRange | null;
  getPlayback(): { status: string; positionSec: number };
  getRevision(): { revision: number; savedRevision: number | null };
  loadScoreJson(json: string): void;
}

declare global {
  interface Window {
    __GPW_TEST__?: GpwTestHooks;
  }
}

export function installTestHooks(): void {
  window.__GPW_TEST__ = {
    getScore: () => structuredClone(useDocumentStore.getState().score),
    getCursor: () => structuredClone(useViewStore.getState().cursor),
    getSelection: () => structuredClone(useViewStore.getState().selection),
    getPlayback: () => {
      const { status, currentTimeSec } = usePlaybackStore.getState();
      return { status, positionSec: currentTimeSec };
    },
    getRevision: () => {
      const state = useDocumentStore.getState();
      if ("revision" in state && typeof state.revision === "number" && "savedRevision" in state) {
        return { revision: state.revision, savedRevision: typeof state.savedRevision === "number" ? state.savedRevision : null };
      }
      // The v1 store only exposes history and the unsaved flag.
      return { revision: state.undoStack.length, savedRevision: state.dirty ? null : state.undoStack.length };
    },
    loadScoreJson: (json) => {
      const { score, documentId } = readScoreFile(json);
      useDocumentStore.getState().loadScore(score, { documentId });
      const view = useViewStore.getState();
      view.setSelection(null);
      view.setCursor(defaultCursor(score));
    }
  };
}
