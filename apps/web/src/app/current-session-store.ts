import { parseCurrentSessionState } from './current-session-state.js';
import type { CurrentSessionState } from './current-session-state.js';

export interface CurrentSessionFile {
  readonly id: string;
  readonly name: string;
  readonly bytes: Uint8Array;
}
export interface StoredCurrentSession {
  readonly file: CurrentSessionFile;
  readonly state: CurrentSessionState | null;
}
const databaseName = 'guitar-practice.current-session';
const storeName = 'current';

/** Una sola copia web corrente. Errori/quota/permessi non impediscono la pratica. */
export class CurrentSessionStore {
  private database: Promise<IDBDatabase | null> | undefined;
  private closed = false;
  constructor(private readonly factory: IDBFactory | undefined) {}

  private open(): Promise<IDBDatabase | null> {
    if (this.closed || !this.factory) return Promise.resolve(null);
    return this.database ??= new Promise((resolve) => {
      let finished = false;
      const finish = (database: IDBDatabase | null) => {
        if (finished) { database?.close(); return; }
        finished = true; clearTimeout(timeout); resolve(database);
      };
      // Non trattenere il caricamento se un'altra scheda blocca l'apertura.
      const timeout = setTimeout(() => finish(null), 1500);
      try {
        const request = this.factory!.open(databaseName, 1);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(storeName)) request.result.createObjectStore(storeName);
        };
        request.onerror = () => finish(null);
        request.onblocked = () => finish(null);
        request.onsuccess = () => {
          const database = request.result;
          database.onversionchange = () => { database.close(); this.closed = true; };
          if (this.closed) { database.close(); finish(null); } else finish(database);
        };
      } catch { finish(null); }
    });
  }

  async read(): Promise<StoredCurrentSession | null> {
    const database = await this.open();
    if (!database) return null;
    try {
      return await new Promise<StoredCurrentSession | null>((resolve) => {
        const transaction = database.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const file = store.get('file');
        const state = store.get('state');
        transaction.onabort = transaction.onerror = () => resolve(null);
        transaction.oncomplete = () => {
          const value = file.result as Partial<CurrentSessionFile> | undefined;
          if (!value || typeof value.id !== 'string' || typeof value.name !== 'string'
            || !(value.bytes instanceof Uint8Array) || !value.bytes.length) { resolve(null); return; }
          const snapshot = state.result as { id?: unknown; value?: unknown } | undefined;
          resolve({ file: value as CurrentSessionFile,
            state: snapshot?.id === value.id ? parseCurrentSessionState(snapshot.value) : null });
        };
      });
    } catch { return null; }
  }

  async replace(file: CurrentSessionFile, state: CurrentSessionState): Promise<void> {
    await this.write((store) => {
      store.put(file, 'file');
      store.put({ id: file.id, value: state }, 'state');
    });
  }

  async update(id: string, state: CurrentSessionState): Promise<void> {
    await this.write((store) => {
      const request = store.get('state');
      request.onsuccess = () => {
        // Un vecchio timer/una vecchia scheda non può associare il suo stato a un nuovo GP.
        try {
          if ((request.result as { id?: unknown } | undefined)?.id === id) store.put({ id, value: state }, 'state');
        } catch { store.transaction.abort(); }
      };
    });
  }

  private async write(action: (store: IDBObjectStore) => void): Promise<void> {
    const database = await this.open();
    if (!database) return;
    try {
      await new Promise<void>((resolve) => {
        const transaction = database.transaction(storeName, 'readwrite');
        transaction.oncomplete = transaction.onabort = transaction.onerror = () => resolve();
        try { action(transaction.objectStore(storeName)); } catch { transaction.abort(); }
      });
    } catch { /* Lo storage è facoltativo. */ }
  }

  close(): void {
    this.closed = true;
    void this.database?.then((database) => database?.close());
  }
}
