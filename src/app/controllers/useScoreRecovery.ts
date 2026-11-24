import { useEffect, useState } from "react";
import { CURRENT_SCHEMA_VERSION, writeScoreFile } from "../../io/fileFormat";
import {
  discardRecoverySnapshot,
  listRecoverySnapshots,
  saveRecoverySnapshot,
  type RecoverySnapshot
} from "../../store/autosave";
import { useDocumentStore } from "../../store/documentStore";

export function useScoreRecovery() {
  const [snapshots, setSnapshots] = useState<RecoverySnapshot[] | null>(null);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    let active = true;
    listRecoverySnapshots().then(
      (records) => {
        if (active) setSnapshots(records);
      },
      () => {
        if (active) {
          setAvailable(false);
          setSnapshots([]);
        }
      }
    );
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!available) return;

    let active = true;
    const timers = new Map<string, number>();
    const lastWrites = new Map<string, number>();

    function cancel(id: string) {
      window.clearTimeout(timers.get(id));
      timers.delete(id);
    }
    const onFailure = () => {
      if (active) setAvailable(false);
    };
    const flushDocument = (id: string) => {
      cancel(id);
      const state = useDocumentStore.getState().getSession(id);
      if (!state || state.revision === state.savedRevision || lastWrites.get(id) === state.revision) return;
      lastWrites.set(id, state.revision);
      const savedAt = new Date();
      try {
        void saveRecoverySnapshot({
          documentId: id, revision: state.revision, title: state.score.meta.title || "Untitled Score",
          schemaVersion: CURRENT_SCHEMA_VERSION, savedAt: savedAt.toISOString(),
          payload: writeScoreFile(state.score, id, savedAt, { zoom: state.view.zoom, displayMode: state.view.displayMode })
        }).catch(onFailure);
      } catch { onFailure(); }
    };
    const flush = () => {
      for (const { id, dirty } of useDocumentStore.getState().documents) if (dirty) flushDocument(id);
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const unsubscribe = useDocumentStore.subscribe((state, previous) => {
      for (const tab of state.documents) {
        const lastTab = previous.documents.find(({ id }) => id === tab.id);
        if (tab.dirty && tab.id === state.activeId && (state.activeId !== previous.activeId || state.revision !== previous.revision)) {
          cancel(tab.id);
          timers.set(tab.id, window.setTimeout(() => flushDocument(tab.id), 2000));
        } else if (!tab.dirty && lastTab?.dirty) {
          cancel(tab.id);
          lastWrites.delete(tab.id);
          void discardRecoverySnapshot(tab.id, new Date().toISOString()).catch(onFailure);
        }
      }
      for (const { id } of previous.documents) {
        if (!state.documents.some((tab) => tab.id === id)) {
          cancel(id);
          lastWrites.delete(id);
        }
      }
    });
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      for (const id of timers.keys()) cancel(id);
    };
  }, [available]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };
    const listenWhenDirty = (dirty: boolean) => {
      if (dirty) {
        window.addEventListener("beforeunload", beforeUnload);
      } else {
        window.removeEventListener("beforeunload", beforeUnload);
      }
    };
    listenWhenDirty(useDocumentStore.getState().documents.some(({ dirty }) => dirty));
    const unsubscribe = useDocumentStore.subscribe((state, previous) => {
      const dirty = state.documents.some((tab) => tab.dirty);
      if (dirty !== previous.documents.some((tab) => tab.dirty)) listenWhenDirty(dirty);
    });
    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);

  return { snapshots, setSnapshots, available };
}
