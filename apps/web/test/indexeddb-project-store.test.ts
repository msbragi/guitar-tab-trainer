import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StudyProject, VariantMediaPayload } from '@guitar-practice/study-project';
import { IndexedDbStudyProjectStore } from '../src/app/projects/indexeddb-project-store.js';

function makeProject(id: string, lastOpenedAt = '2026-11-21T10:00:00.000Z'): StudyProject {
  return {
    id,
    fileName: `${id}.gp5`,
    title: `Song ${id}`,
    artist: 'Artist',
    trackCount: 2,
    barCount: 8,
    favorite: false,
    phraseCount: 0,
    lastOpenedAt,
    createdAt: '2026-11-21T09:00:00.000Z',
    phrases: [],
  };
}

function createFakeIdbFactory(): IDBFactory {
  const stores = new Map<string, Map<string, unknown>>();

  const makeRequest = <T>(getter: () => T): IDBRequest<T> => {
    const req = {
      result: undefined as unknown as T,
      error: null,
      onsuccess: null as ((ev: Event) => void) | null,
      onerror: null as ((ev: Event) => void) | null,
    };
    queueMicrotask(() => {
      try {
        req.result = getter();
        req.onsuccess?.(new Event('success'));
      } catch (err) {
        req.error = err as DOMException;
        req.onerror?.(new Event('error'));
      }
    });
    return req as unknown as IDBRequest<T>;
  };

  const makeStore = (name: string) => {
    const map = stores.get(name)!;
    return {
      get: (key: string) => makeRequest(() => map.get(key)),
      getKey: (key: string) => makeRequest(() => (map.has(key) ? key : undefined)),
      getAll: () => makeRequest(() => [...map.values()]),
      put: (val: { id: string }) => makeRequest(() => {
        map.set(val.id, val);
        return val.id;
      }),
      delete: (key: string) => makeRequest(() => {
        map.delete(key);
        return undefined;
      }),
      index: (indexName: string) => ({
        getAllKeys: (projectId: string) =>
          makeRequest(() => {
            if (indexName !== 'byProjectId') return [];
            return [...map.entries()]
              .filter(([, value]) => (value as { projectId?: string }).projectId === projectId)
              .map(([k]) => k);
          }),
      }),
    };
  };

  const db = {
    objectStoreNames: {
      contains: (name: string) => stores.has(name),
    },
    createObjectStore: (name: string) => {
      stores.set(name, new Map());
      return {
        createIndex: vi.fn(),
      };
    },
    transaction: (_storeNames: string | string[]) => {
      const tx = {
        oncomplete: null as (() => void) | null,
        onabort: null as (() => void) | null,
        onerror: null as (() => void) | null,
        error: null,
        abort: () => {
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore: (name: string) => makeStore(name),
      };
      setTimeout(() => tx.oncomplete?.(), 0);
      return tx;
    },
    close: vi.fn(),
    onversionchange: null as (() => void) | null,
  };

  return {
    open: () => {
      const req = {
        result: db,
        onupgradeneeded: null as (() => void) | null,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onblocked: null as (() => void) | null,
      };
      queueMicrotask(() => {
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req as unknown as IDBOpenDBRequest;
    },
  } as unknown as IDBFactory;
}

afterEach(() => vi.useRealTimers());

describe('IndexedDbStudyProjectStore', () => {
  it('esegue fallback trasparente su InMemoryStudyProjectStore se IndexedDB non è disponibile', async () => {
    const store = new IndexedDbStudyProjectStore(undefined);
    const project = makeProject('p1');
    const bytes = new Uint8Array([1, 2, 3, 4]);

    await store.saveProject(project, bytes);
    const list = await store.listProjects();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe('p1');

    const loaded = await store.loadProject('p1');
    expect(loaded?.project.title).toBe('Song p1');
    expect(Array.from(loaded?.scoreBytes ?? [])).toEqual([1, 2, 3, 4]);

    const toggled = await store.toggleFavorite('p1');
    expect(toggled?.favorite).toBe(true);

    await store.deleteProject('p1');
    expect(await store.listProjects()).toHaveLength(0);
    store.close();
  });

  it('esegue fallback se open() lancia un errore di autorizzazione', async () => {
    const factory = {
      open: () => {
        throw new Error('SecurityError');
      },
    } as unknown as IDBFactory;
    const store = new IndexedDbStudyProjectStore(factory);
    await store.saveProject(makeProject('p2'), new Uint8Array([9, 8]));
    expect(await store.listProjects()).toHaveLength(1);
    store.close();
  });

  it('salva, elenca, aggiorna preferiti, gestisce media ed elimina su IndexedDB', async () => {
    const store = new IndexedDbStudyProjectStore(createFakeIdbFactory());
    const p1 = makeProject('p1', '2026-11-21T10:00:00.000Z');
    const p2 = makeProject('p2', '2026-11-21T12:00:00.000Z');

    await store.saveProject(p1, new Uint8Array([10, 20]));
    await store.saveProject(p2, new Uint8Array([30, 40]));

    const list = await store.listProjects();
    expect(list.map((p) => p.id)).toEqual(['p2', 'p1']);

    const toggled = await store.toggleFavorite('p1', true);
    expect(toggled?.favorite).toBe(true);

    const media: VariantMediaPayload = {
      id: 'm1',
      projectId: 'p1',
      phraseId: 'ph1',
      variantId: 'v1',
      mimeType: 'audio/midi',
      bytes: new Uint8Array([0x4d, 0x54, 0x68, 0x64]),
    };
    await store.saveMedia(media);
    const loadedMedia = await store.loadMedia('m1');
    expect(Array.from(loadedMedia?.bytes ?? [])).toEqual([0x4d, 0x54, 0x68, 0x64]);

    await store.deleteProject('p1');
    expect(await store.loadProject('p1')).toBeNull();
    expect(await store.loadMedia('m1')).toBeNull();
    expect((await store.listProjects()).map((p) => p.id)).toEqual(['p2']);

    store.close();
  });

  it('richiede i byte GP per un nuovo progetto anche su IndexedDB', async () => {
    const store = new IndexedDbStudyProjectStore(createFakeIdbFactory());
    await expect(store.saveProject(makeProject('missing'))).rejects.toThrow(/Missing Guitar Pro bytes/);
    store.close();
  });
});
