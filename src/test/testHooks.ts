import { defaultCursor } from "../engine/editing/operations";
import type { CursorPosition, SelectionRange } from "../engine/editing/types";
import { APP_FILE_FORMAT, CURRENT_SCHEMA_VERSION, readScoreFile } from "../io/fileFormat";
import type { DocumentViewSettings, Score } from "../model/types";
import { useDocumentStore } from "../store/documentStore";
import { usePlaybackStore } from "../store/playbackStore";
import { getDocumentView, useViewStore } from "../store/viewStore";

interface GpwTestHooks {
  getScore(): Score;
  getCursor(): CursorPosition;
  getSelection(): SelectionRange | null;
  getPlayback(): { status: string; positionSec: number };
  getRevision(): { revision: number; savedRevision: number | null };
  getView(): DocumentViewSettings;
  loadScoreJson(json: string, viewOverride?: DocumentViewSettings): void;
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
    getView: getDocumentView,
    loadScoreJson: (json, viewOverride) => {
      const fixture = JSON.parse(json);
      const input = fixture?.format ? json : JSON.stringify({
        format: APP_FILE_FORMAT, schemaVersion: CURRENT_SCHEMA_VERSION,
        app: { name: "TabScore test fixture", version: "0" },
        documentId: "doc_fixture", score: fixture, view: viewOverride
      });
      const { score, documentId, view: storedView } = readScoreFile(input);
      useDocumentStore.getState().loadScore(score, { documentId, view: viewOverride ?? storedView });
      const view = useViewStore.getState();
      view.setSelection(null);
      view.setCursor(defaultCursor(score));
    }
  };
}
