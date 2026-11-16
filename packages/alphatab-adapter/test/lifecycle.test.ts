import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  class Events {
    listeners = new Set<() => void>();
    on(listener: () => void) { this.listeners.add(listener); }
    off(listener: () => void) { this.listeners.delete(listener); }
    emit() { for (const listener of [...this.listeners]) listener(); }
  }
  const instances: Api[] = [];
  class Api {
    postRenderFinished = new Events();
    error = new Events();
    destroy = vi.fn();
    renderScore = vi.fn();
    constructor(readonly host: unknown, readonly settings: unknown) { instances.push(this); }
  }
  return { Api, instances };
});
vi.mock('@coderline/alphatab', () => ({ AlphaTabApi: fake.Api }));

import { AlphaTabScoreAdapter } from '../src/index.js';

const bytes = () => new Uint8Array(readFileSync(new URL('../../../tests/fixtures/alphatab/notes.gp3', import.meta.url)));
const createAdapter = () => new AlphaTabScoreAdapter({ replaceChildren: vi.fn() } as unknown as HTMLElement, {
  fontDirectory: 'http://localhost/assets/alphatab/font/',
});
const latest = () => fake.instances.at(-1)!;

beforeEach(() => { fake.instances.length = 0; });
afterEach(() => { vi.useRealTimers(); });

describe('ciclo di vita dell’adapter', () => {
  it('attende il rendering, disabilita player e worker, poi sostituisce l’istanza', async () => {
    const adapter = createAdapter();
    const first = adapter.load(bytes());
    const api = latest();
    expect(api.settings).toMatchObject({ core: { useWorkers: false, enableLazyLoading: false }, player: { enablePlayer: false } });
    api.postRenderFinished.emit();
    expect((await first).barCount).toBe(1);
    expect(api.postRenderFinished.listeners.size).toBe(0);
    expect(api.error.listeners.size).toBe(0);
    const second = adapter.load(bytes());
    expect(api.destroy).toHaveBeenCalledOnce();
    latest().postRenderFinished.emit();
    await second;
    adapter.destroy();
    expect(latest().destroy).toHaveBeenCalledOnce();
    await expect(adapter.load(bytes())).rejects.toThrow('session-closed');
  });

  it('propaga gli errori di rendering e distrugge l’istanza fallita', async () => {
    const adapter = createAdapter();
    const pending = adapter.load(bytes());
    const failure = expect(pending).rejects.toThrow('render-failed');
    latest().error.emit();
    await failure;
    expect(latest().destroy).toHaveBeenCalledOnce();
    expect(latest().error.listeners.size).toBe(0);
    adapter.destroy();
  });

  it('annulla un rendering pendente senza distruggere una nuova istanza dopo reset', async () => {
    const adapter = createAdapter();
    const first = adapter.load(bytes());
    const cancelled = expect(first).rejects.toThrow('cancelled');
    adapter.reset();
    const second = adapter.load(bytes());
    const newApi = latest();
    await cancelled;
    expect(newApi.destroy).not.toHaveBeenCalled();
    newApi.postRenderFinished.emit();
    await second;
    adapter.destroy();
  });

  it('rifiuta un caricamento concorrente mantenendo quello già avviato', async () => {
    const adapter = createAdapter();
    const first = adapter.load(bytes());
    await expect(adapter.load(bytes())).rejects.toThrow('busy');
    expect(fake.instances).toHaveLength(1);
    latest().postRenderFinished.emit();
    await first;
    adapter.destroy();
  });

  it('limita l’attesa di rendering e rimuove i listener dopo timeout', async () => {
    vi.useFakeTimers();
    const adapter = createAdapter();
    const pending = adapter.load(bytes());
    const failure = expect(pending).rejects.toThrow('render-timeout');
    await vi.advanceTimersByTimeAsync(30_000);
    await failure;
    expect(latest().destroy).toHaveBeenCalledOnce();
    expect(latest().postRenderFinished.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    adapter.destroy();
  });

  it('la chiusura annulla una richiesta pendente', async () => {
    const adapter = createAdapter();
    const pending = adapter.load(bytes());
    const failure = expect(pending).rejects.toThrow('cancelled');
    adapter.destroy();
    await failure;
    expect(latest().destroy).toHaveBeenCalledOnce();
    expect(latest().error.listeners.size).toBe(0);
  });
});
