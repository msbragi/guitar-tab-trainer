import '@angular/compiler';
import { DOCUMENT } from '@angular/common';
import { Injector, runInInjectionContext } from '@angular/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PracticeBarPick, TransportEvent, MixerEvent } from '@guitar-practice/core';

const fake = vi.hoisted(() => {
  const instances: Adapter[] = [];
  class Adapter {
    transport: ((event: TransportEvent) => void) | undefined;
    mixer: ((event: MixerEvent) => void) | undefined;
    picking: ((pick: PracticeBarPick) => void) | null = null;
    constructor() { instances.push(this); }
    subscribeTransport(listener: (event: TransportEvent) => void) { this.transport = listener; return () => { this.transport = undefined; }; }
    subscribeMixer(listener: (event: MixerEvent) => void) { this.mixer = listener; return () => { this.mixer = undefined; }; }
    reset() { this.picking = null; this.transport?.({ type: 'reset' }); this.mixer?.({ type: 'reset' }); }
    destroy() { this.reset(); }
    load = vi.fn(async (_bytes: Uint8Array) => {
      this.transport?.({ type: 'preparing' });
      this.transport?.({ type: 'position', isSeek: true, position: { tick: 0, endTick: 19200, timeMs: 0, durationMs: 10000, tempo: 120 } });
      this.transport?.({ type: 'ready' });
      return { title: 'Song', artist: '', barCount: 5, tracks: [{ index: 0, name: 'Guitar' }] };
    });
    playbackBars() { return Array.from({ length: 5 }, (_, index) => ({ barIndex: index, occurrence: 1,
      startTick: index * 3840, endTick: (index + 1) * 3840, numerator: 4, denominator: 4, tempo: index === 0 ? 90 : 120 })); }
    play = vi.fn(() => true); pause = vi.fn(); stop = vi.fn(); seek = vi.fn(); setSpeed = vi.fn(); setPlaybackRange = vi.fn();
    setTrackMute = vi.fn(); setTrackSolo = vi.fn(); setTrackVolume = vi.fn(); setMasterVolume = vi.fn();
    setPracticePicking(listener: typeof this.picking) { this.picking = listener; }
    setPracticeTicks = vi.fn(); highlightPractice = vi.fn(); clearPracticeHighlight = vi.fn();
    setPracticeView = vi.fn(async (_range: { startBar: number; endBar: number } | null) => {});
  }
  return { Adapter, instances };
});
vi.mock('@guitar-practice/alphatab-adapter', () => ({ AlphaTabScoreAdapter: fake.Adapter }));
import { ScoreSession } from '../src/app/score-session.js';
import { CountIn } from '../src/app/practice/count-in.js';

const cleanups: (() => void)[] = [];
afterEach(() => { for (const cleanup of cleanups.splice(0)) cleanup(); fake.instances.length = 0; vi.restoreAllMocks(); });

async function setup() {
  const document = { baseURI: 'http://localhost/', addEventListener: vi.fn(), removeEventListener: vi.fn(),
    defaultView: { crypto: { randomUUID: () => 'test-document' }, addEventListener: vi.fn(), removeEventListener: vi.fn() } };
  const injector = Injector.create({ providers: [{ provide: DOCUMENT, useValue: document }] });
  const session = runInInjectionContext(injector, () => new ScoreSession());
  cleanups.push(session.attach({ closest: () => null } as unknown as HTMLElement), () => injector.destroy());
  const bytes = new Uint8Array([1, 2, 3]);
  const file = { name: 'song.gp', arrayBuffer: async () => bytes.slice().buffer } as File;
  await session.open(file);
  return { session, adapter: fake.instances.at(-1)!, bytes, file };
}
const selection = { trackIndex: 0, from: 1, to: 2, leadInBars: 1, preparation: 'context' as const, countIn: false };
function choose(session: ScoreSession, adapter: InstanceType<typeof fake.Adapter>) {
  session.beginPractice(); adapter.picking!({ trackIndex: 0, barIndex: 1 }); adapter.picking!({ trackIndex: 0, barIndex: 2 });
}

describe('selezione guidata, frammento e fine pratica', () => {
  it('conteggia al tempo del contesto e Fine pratica annulla la preparazione', async () => {
    const start = vi.spyOn(CountIn.prototype, 'start').mockResolvedValue(undefined);
    const { session, adapter } = await setup(); choose(session, adapter);
    await session.startPractice({ ...selection, countIn: true }); session.play();
    expect(start.mock.calls[0]![0]).toMatchObject({ tempo: 90, numerator: 4, denominator: 4, speed: 1 });
    expect(session.countInRemaining()).toBe(4); expect(adapter.play).not.toHaveBeenCalled();
    await session.finishPractice();
    expect(session.countInRemaining()).toBeNull(); expect(session.practiceFlow().phase).toBe('idle');
  });
  it('apre il frammento senza autoplay e Fine pratica ripristina e resetta la sessione', async () => {
    const { session, adapter, bytes } = await setup(); choose(session, adapter);
    await session.startPractice(selection);
    expect(session.practiceFlow().phase).toBe('active');
    expect(adapter.setPracticeView).toHaveBeenLastCalledWith({ startBar: 0, endBar: 2 });
    expect(adapter.play).not.toHaveBeenCalled(); expect(adapter.picking).toBeNull();
    session.play(); expect(adapter.play).toHaveBeenCalledOnce();
    session.seek(99999); expect(adapter.seek).toHaveBeenLastCalledWith(11519);
    await session.finishPractice();
    expect(adapter.setPracticeView).toHaveBeenLastCalledWith(null);
    expect(session.practiceFlow().phase).toBe('idle'); expect(session.practice()).toBeNull();
    expect(session.countInRemaining()).toBeNull(); expect(adapter.picking).toBeNull();
    expect(adapter.setPracticeTicks).toHaveBeenLastCalledWith(null);
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
    session.beginPractice(); expect(session.practiceFlow().phase).toBe('start');
  });
  it('annulla o ricomincia la scelta senza ritagliare la partitura', async () => {
    const { session, adapter } = await setup();
    session.beginPractice(); adapter.picking!({ trackIndex: 0, barIndex: 2 });
    adapter.picking!({ trackIndex: 0, barIndex: 1 }); expect(session.practiceSelectionError()).toBe(true);
    session.restartPracticeSelection(); expect(session.practiceFlow().phase).toBe('start');
    await session.finishPractice(); expect(session.practiceFlow().phase).toBe('idle');
    expect(adapter.setPracticeView).not.toHaveBeenCalled(); expect(adapter.picking).toBeNull();
  });
  it('mantiene il flusso recuperabile se apertura o ripristino del rendering falliscono', async () => {
    const { session, adapter } = await setup(); choose(session, adapter);
    adapter.setPracticeView.mockRejectedValueOnce(new Error('render failed'));
    await session.startPractice(selection);
    expect(session.practiceFlow().phase).toBe('configure'); expect(session.practice()).toBeNull();
    expect(session.viewBusy()).toBe(false); expect(session.viewError()).toBe('render-failed');
    await session.startPractice(selection);
    adapter.setPracticeView.mockRejectedValueOnce(new Error('restore failed'));
    await session.finishPractice(); expect(session.practiceFlow().phase).toBe('active');
    await session.finishPractice(); expect(session.practiceFlow().phase).toBe('idle');
  });
  it('azzera selezione e callback al cambio documento', async () => {
    const { session, adapter, file } = await setup(); choose(session, adapter);
    await session.startPractice(selection); await session.open(file);
    expect(session.practiceFlow().phase).toBe('idle'); expect(session.practice()).toBeNull();
    expect(adapter.picking).toBeNull();
  });
});
