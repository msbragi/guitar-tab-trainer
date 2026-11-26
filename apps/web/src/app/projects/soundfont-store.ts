import type { GuitarProgramMap } from './sf2-presets.js';

export type SoundFontSlot = 'base' | 'guitar';

export interface StoredSoundFont {
  readonly name: string;
  readonly bytes: Uint8Array;
}

export interface StoredSoundFonts {
  readonly base: StoredSoundFont | null;
  readonly guitar: StoredSoundFont | null;
  readonly guitarMap: GuitarProgramMap | null;
}

const DATABASE_NAME = 'guitar-practice-soundfonts-v1';
const DATABASE_VERSION = 1;
const STORE_NAME = 'soundfonts';

/** Checks for a minimal valid SoundFont 2 RIFF/sfbk header. */
export function isValidSf2Bytes(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  return (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // RIFF
    bytes[8] === 0x73 && bytes[9] === 0x66 && bytes[10] === 0x62 && bytes[11] === 0x6b // sfbk
  );
}

/**
 * Local IndexedDB store for user-selected .sf2 SoundFonts with transparent
 * in-memory fallback when IndexedDB is unavailable or blocked.
 */
export class SoundFontStore {
  private databasePromise: Promise<IDBDatabase | null> | undefined;
  private closed = false;
  private readonly fallback = new Map<SoundFontSlot, StoredSoundFont>();
  private fallbackMap: GuitarProgramMap | null = null;

  constructor(private readonly factory: IDBFactory | undefined) {}

  private openDatabase(): Promise<IDBDatabase | null> {
    if (this.closed || !this.factory) return Promise.resolve(null);
    return (this.databasePromise ??= new Promise((resolve) => {
      let finished = false;
      const finish = (db: IDBDatabase | null) => {
        if (finished) {
          db?.close();
          return;
        }
        finished = true;
        clearTimeout(timeout);
        resolve(db);
      };
      const timeout = setTimeout(() => finish(null), 1500);
      try {
        const request = this.factory!.open(DATABASE_NAME, DATABASE_VERSION);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(STORE_NAME)) {
            request.result.createObjectStore(STORE_NAME);
          }
        };
        request.onerror = () => finish(null);
        request.onblocked = () => finish(null);
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            this.closed = true;
          };
          if (this.closed) {
            db.close();
            finish(null);
          } else {
            finish(db);
          }
        };
      } catch {
        finish(null);
      }
    }));
  }

  async readAll(): Promise<StoredSoundFonts> {
    const db = await this.openDatabase();
    if (!db) {
      const base = this.fallback.get('base');
      const guitar = this.fallback.get('guitar');
      return {
        base: base ? { name: base.name, bytes: new Uint8Array(base.bytes) } : null,
        guitar: guitar ? { name: guitar.name, bytes: new Uint8Array(guitar.bytes) } : null,
        guitarMap: this.fallbackMap ? { ...this.fallbackMap } : null,
      };
    }
    try {
      return await new Promise<StoredSoundFonts>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const baseReq = store.get('base');
        const guitarReq = store.get('guitar');
        const mapReq = store.get('guitarMap');
        tx.onabort = tx.onerror = () => resolve({ base: null, guitar: null, guitarMap: null });
        tx.oncomplete = () => {
          resolve({
            base: parseStored(baseReq.result),
            guitar: parseStored(guitarReq.result),
            guitarMap: parseMap(mapReq.result),
          });
        };
      });
    } catch {
      return { base: null, guitar: null, guitarMap: null };
    }
  }

  async saveGuitarMap(map: GuitarProgramMap | null): Promise<void> {
    const db = await this.openDatabase();
    if (!db) {
      this.fallbackMap = map ? { ...map } : null;
      return;
    }
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = tx.onabort = tx.onerror = () => resolve();
        try {
          if (map) tx.objectStore(STORE_NAME).put({ ...map }, 'guitarMap');
          else tx.objectStore(STORE_NAME).delete('guitarMap');
        } catch {
          tx.abort();
        }
      });
    } catch {
      this.fallbackMap = map ? { ...map } : null;
    }
  }

  async save(slot: SoundFontSlot, item: StoredSoundFont): Promise<void> {
    const copy: StoredSoundFont = { name: item.name, bytes: new Uint8Array(item.bytes) };
    const db = await this.openDatabase();
    if (!db) {
      this.fallback.set(slot, copy);
      return;
    }
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = tx.onabort = tx.onerror = () => resolve();
        try {
          tx.objectStore(STORE_NAME).put(copy, slot);
        } catch {
          tx.abort();
        }
      });
    } catch {
      this.fallback.set(slot, copy);
    }
  }

  async remove(slot: SoundFontSlot): Promise<void> {
    const db = await this.openDatabase();
    if (!db) {
      this.fallback.delete(slot);
      return;
    }
    try {
      await new Promise<void>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = tx.onabort = tx.onerror = () => resolve();
        try {
          tx.objectStore(STORE_NAME).delete(slot);
        } catch {
          tx.abort();
        }
      });
    } catch {
      this.fallback.delete(slot);
    }
  }

  close(): void {
    this.closed = true;
    void this.databasePromise?.then((db) => db?.close());
  }
}

function parseStored(value: unknown): StoredSoundFont | null {
  const item = value as Partial<StoredSoundFont> | undefined;
  if (!item || typeof item.name !== 'string' || !(item.bytes instanceof Uint8Array) || !item.bytes.byteLength) {
    return null;
  }
  return { name: item.name, bytes: new Uint8Array(item.bytes) };
}

function parseMap(value: unknown): GuitarProgramMap | null {
  if (!value || typeof value !== 'object') return null;
  const out: Record<number, number | null> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = Number(k);
    if (!Number.isInteger(key)) continue;
    if (v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0)) {
      out[key] = v;
    }
  }
  return Object.keys(out).length ? out : null;
}
