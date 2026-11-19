import { afterEach, describe, expect, it, vi } from 'vitest';
import { CurrentSessionStore } from '../src/app/current-session-store.js';

afterEach(() => vi.useRealTimers());
describe('apertura storage corrente facoltativo', () => {
  it('gestisce assenza di IndexedDB ed eccezioni di autorizzazione', async () => {
    expect(await new CurrentSessionStore(undefined).read()).toBeNull();
    const store = new CurrentSessionStore({ open: () => { throw Error('denied'); } } as unknown as IDBFactory);
    expect(await store.read()).toBeNull(); store.close();
  });
  it('non attende indefinitamente e chiude un database arrivato dopo il timeout', async () => {
    vi.useFakeTimers();
    const database = { close: vi.fn() };
    const request = { result: database } as unknown as IDBOpenDBRequest;
    const store = new CurrentSessionStore({ open: () => request } as unknown as IDBFactory);
    const read = store.read();
    await vi.advanceTimersByTimeAsync(1500); expect(await read).toBeNull();
    request.onsuccess?.call(request, new Event('success'));
    expect(database.close).toHaveBeenCalledOnce(); store.close();
  });
  it('gestisce apertura bloccata e chiusura mentre il recupero è pendente', async () => {
    vi.useFakeTimers();
    for (const blocked of [true, false]) {
      const database = { close: vi.fn() };
      const request = { result: database } as unknown as IDBOpenDBRequest;
      const store = new CurrentSessionStore({ open: () => request } as unknown as IDBFactory);
      const read = store.read();
      if (blocked) request.onblocked?.call(request, new Event('blocked') as IDBVersionChangeEvent);
      else store.close();
      request.onsuccess?.call(request, new Event('success'));
      expect(await read).toBeNull(); expect(database.close).toHaveBeenCalled();
      store.close();
    }
  });
});
