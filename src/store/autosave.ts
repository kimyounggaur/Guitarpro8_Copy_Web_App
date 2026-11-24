const DATABASE_NAME = "tabscore-recovery";
const STORE_NAME = "snapshots";
const RECENT_STORE_NAME = "recent";
const MAX_SNAPSHOTS = 10;

export interface RecoverySnapshot {
  documentId: string;
  title: string;
  savedAt: string;
  revision: number;
  schemaVersion: number;
  payload: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, 2);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
      if (!request.result.objectStoreNames.contains(RECENT_STORE_NAME)) request.result.createObjectStore(RECENT_STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction<Result>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, done: (result: Result) => void) => void,
  storeName = STORE_NAME
): Promise<Result> {
  const database = await openDatabase();
  try {
    return await new Promise<Result>((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      let result: Result;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
      operation(transaction.objectStore(storeName), (value) => {
        result = value;
      });
    });
  } finally {
    database.close();
  }
}

function newestFirst(records: RecoverySnapshot[]): RecoverySnapshot[] {
  return records.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function listRecoverySnapshots(): Promise<RecoverySnapshot[]> {
  return runTransaction("readonly", (store, done) => {
    const request: IDBRequest<RecoverySnapshot[]> = store.getAll();
    request.onsuccess = () => done(newestFirst(request.result));
  });
}

export function saveRecoverySnapshot(snapshot: RecoverySnapshot): Promise<void> {
  return runTransaction("readwrite", (store, done) => {
    const request: IDBRequest<RecoverySnapshot[]> = store.getAll();
    request.onsuccess = () => {
      const requiredKey = `doc:${snapshot.documentId}`;
      const existing = request.result.find((record) => record.documentId === snapshot.documentId);
      if (!existing || existing.savedAt <= snapshot.savedAt) {
        store.put(snapshot, requiredKey);
        const remaining = request.result.filter((record) => record.documentId !== snapshot.documentId);
        for (const record of newestFirst([...remaining, snapshot]).slice(MAX_SNAPSHOTS)) {
          store.delete(`doc:${record.documentId}`);
        }
      }
      done();
    };
  });
}

export function discardRecoverySnapshot(documentId: string, through: string): Promise<void> {
  return runTransaction("readwrite", (store, done) => {
    const key = `doc:${documentId}`;
    const request: IDBRequest<RecoverySnapshot | undefined> = store.get(key);
    request.onsuccess = () => {
      if (request.result && request.result.savedAt <= through) store.delete(key);
      done();
    };
  });
}

export interface RecentScore {
  version: 1;
  id: string;
  title: string;
  artist: string;
  fileName: string;
  source: "Opened file" | "Saved file";
  lastOpened: string;
  pinned: boolean;
  payload: string;
}

function isRecentScore(record: unknown): record is RecentScore {
  if (!record || typeof record !== "object" || !("version" in record) || record.version !== 1) return false;
  const value: Record<string, unknown> = { ...record };
  return ["id", "title", "artist", "fileName", "lastOpened", "payload"].every((key) => typeof value[key] === "string")
    && typeof value.pinned === "boolean" && (value.source === "Opened file" || value.source === "Saved file");
}

export function listRecentScores(): Promise<RecentScore[]> {
  return runTransaction("readonly", (store, done) => {
    const request: IDBRequest<unknown[]> = store.getAll();
    request.onsuccess = () => done(request.result.filter(isRecentScore));
  }, RECENT_STORE_NAME);
}

export function rememberRecentScore(record: Omit<RecentScore, "version" | "pinned">, touched = new Date().toISOString()): Promise<void> {
  return runTransaction("readwrite", (store, done) => {
    const request: IDBRequest<unknown> = store.get(record.id);
    request.onsuccess = () => {
      const current = isRecentScore(request.result) ? request.result : null;
      store.put({ ...record, version: 1, pinned: current?.pinned ?? false, lastOpened: touched }, record.id);
      done();
    };
  }, RECENT_STORE_NAME);
}

export function setRecentScorePin(id: string, pinned: boolean): Promise<void> {
  return runTransaction("readwrite", (store, done) => {
    const request: IDBRequest<unknown> = store.get(id);
    request.onsuccess = () => {
      if (isRecentScore(request.result)) store.put({ ...request.result, pinned }, id);
      done();
    };
  }, RECENT_STORE_NAME);
}

export function clearRecentScores(): Promise<void> {
  return runTransaction("readwrite", (store, done) => {
    const request = store.clear();
    request.onsuccess = () => done();
  }, RECENT_STORE_NAME);
}
