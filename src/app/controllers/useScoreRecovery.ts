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
    let timer: number | undefined;
    let idle: number | undefined;
    let lastWrite: { documentId: string; revision: number } | undefined;

    const cancelPending = () => {
      window.clearTimeout(timer);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      idle = undefined;
    };
    const onFailure = () => {
      if (active) setAvailable(false);
    };
    const flush = () => {
      cancelPending();
      const state = useDocumentStore.getState();
      if (!state.dirty) return;
      if (lastWrite?.documentId === state.activeId && lastWrite.revision === state.revision) return;

      lastWrite = { documentId: state.activeId, revision: state.revision };
      const savedAt = new Date();
      try {
        // Start the IndexedDB operation now, including for pagehide.
        void saveRecoverySnapshot({
          documentId: state.activeId,
          revision: state.revision,
          title: state.score.meta.title || "Untitled Score",
          schemaVersion: CURRENT_SCHEMA_VERSION,
          savedAt: savedAt.toISOString(),
          payload: writeScoreFile(state.score, state.activeId, savedAt)
        }).catch(onFailure);
      } catch {
        onFailure();
      }
    };
    const schedule = () => {
      cancelPending();
      timer = window.setTimeout(() => {
        if (typeof window.requestIdleCallback === "function") {
          idle = window.requestIdleCallback(flush, { timeout: 250 });
        } else {
          flush();
        }
      }, 2000);
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const unsubscribe = useDocumentStore.subscribe((state, previous) => {
      if (state.activeId === previous.activeId && state.revision === previous.revision) return;
      cancelPending();
      lastWrite = undefined;
      if (state.dirty) {
        schedule();
      } else if (previous.dirty && state.activeId === previous.activeId) {
        const through = new Date().toISOString();
        void discardRecoverySnapshot(state.activeId, through).catch(onFailure);
      }
    });
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", flush);
    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", flush);
      cancelPending();
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
    listenWhenDirty(useDocumentStore.getState().dirty);
    const unsubscribe = useDocumentStore.subscribe((state, previous) => {
      if (state.dirty !== previous.dirty) listenWhenDirty(state.dirty);
    });
    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);

  return { snapshots, setSnapshots, available };
}
