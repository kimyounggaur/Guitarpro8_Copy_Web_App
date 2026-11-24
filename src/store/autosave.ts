const DATABASE_NAME = "tabscore-recovery";
const STORE_NAME = "snapshots";
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
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runTransaction<Result>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, done: (result: Result) => void) => void
): Promise<Result> {
  const database = await openDatabase();
  try {
    return await new Promise<Result>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, mode);
      let result: Result;
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(transaction.error);
      transaction.onerror = () => reject(transaction.error);
      operation(transaction.objectStore(STORE_NAME), (value) => {
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
