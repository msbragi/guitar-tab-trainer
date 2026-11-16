import { describe, expect, it, vi } from 'vitest';
import { ScoreController, ScoreLoadError } from '../src/index.js';
import type { ScoreLoader, ScoreSource, ScoreSummary } from '../src/index.js';

const summary: ScoreSummary = {
  title: 'Esercizio', artist: '', barCount: 2,
  tracks: [{ index: 0, name: 'Chitarra' }],
};
const source = (bytes = new Uint8Array([1, 2, 3])): ScoreSource => ({
  name: 'esercizio.gp5', read: async () => bytes,
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe('ScoreController senza UI o motore musicale', () => {
  it('pubblica idle, loading e ready con soli metadati applicativi', async () => {
    const load = vi.fn(async () => summary);
    const controller = new ScoreController({ load });
    const states: string[] = [];
    controller.subscribe((state) => states.push(state.status));
    expect(await controller.load(source())).toBe(true);
    expect(states).toEqual(['idle', 'loading', 'ready']);
    expect(controller.state).toEqual({ status: 'ready', fileName: 'esercizio.gp5', score: summary });
    expect(load).toHaveBeenCalledOnce();
  });

  it('protegge i byte originali anche da un loader che li modifica', async () => {
    const original = new Uint8Array([1, 2, 3]);
    const controller = new ScoreController({ load: async (bytes) => {
      bytes.fill(0);
      return summary;
    } });
    await controller.load(source(original));
    expect([...original]).toEqual([1, 2, 3]);
  });

  it('non invoca il motore per file vuoti', async () => {
    const load = vi.fn(async () => summary);
    const controller = new ScoreController({ load });
    expect(await controller.load(source(new Uint8Array()))).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(controller.state).toMatchObject({ status: 'error', code: 'empty-file', message: 'empty-file' });
  });

  it('gestisce un errore di lettura e consente un nuovo caricamento', async () => {
    const controller = new ScoreController({ load: async () => summary });
    await controller.load({ name: 'negato.gp', read: async () => { throw new Error('Lettura negata.'); } });
    expect(controller.state).toMatchObject({ status: 'error', message: 'Lettura negata.' });
    expect(await controller.load(source())).toBe(true);
    expect(controller.state.status).toBe('ready');
  });

  it('propaga un errore di importazione leggibile e non conserva metadati precedenti', async () => {
    const load = vi.fn<ScoreLoader['load']>().mockResolvedValueOnce(summary)
      .mockRejectedValueOnce(new ScoreLoadError('invalid-score'));
    const controller = new ScoreController({ load });
    await controller.load(source());
    await controller.load(source());
    expect(controller.state).toEqual({ status: 'error', fileName: 'esercizio.gp5', code: 'invalid-score', message: 'invalid-score' });
  });

  it('normalizza errori che non sono istanze di Error', async () => {
    const controller = new ScoreController({ load: async () => { throw 'errore'; } });
    await controller.load(source());
    expect(controller.state).toMatchObject({ status: 'error', code: 'load-failed', message: 'load-failed' });
  });

  it('ignora richieste concorrenti senza leggere il secondo file', async () => {
    const pending = deferred<ScoreSummary>();
    const controller = new ScoreController({ load: () => pending.promise });
    const first = controller.load(source());
    const read = vi.fn(async () => new Uint8Array([4]));
    expect(await controller.load({ name: 'secondo.gp', read })).toBe(false);
    expect(read).not.toHaveBeenCalled();
    pending.resolve(summary);
    expect(await first).toBe(true);
  });

  it('rimuove le sottoscrizioni e ignora completamenti dopo la chiusura', async () => {
    const pending = deferred<ScoreSummary>();
    const controller = new ScoreController({ load: () => pending.promise });
    const observer = vi.fn();
    const unsubscribe = controller.subscribe(observer);
    unsubscribe();
    const first = controller.load(source());
    await Promise.resolve();
    controller.dispose();
    pending.resolve(summary);
    expect(await first).toBe(false);
    expect(observer).toHaveBeenCalledOnce();
    expect(await controller.load(source())).toBe(false);
    expect(() => controller.subscribe(observer)).toThrow('session-closed');
  });

  it('non avvia il motore se la sessione si chiude durante la lettura', async () => {
    const bytes = deferred<Uint8Array>();
    const load = vi.fn(async () => summary);
    const controller = new ScoreController({ load });
    const first = controller.load({ name: 'lento.gp', read: () => bytes.promise });
    controller.dispose();
    bytes.resolve(new Uint8Array([1]));
    expect(await first).toBe(false);
    expect(load).not.toHaveBeenCalled();
  });
});
