import type { model } from '@coderline/alphatab/core';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  class Events<T = void> {
    listeners = new Set<(event: T) => void>();
    on(listener: (event: T) => void) { this.listeners.add(listener); }
    off(listener: (event: T) => void) { this.listeners.delete(listener); }
    emit(event: T) { for (const listener of [...this.listeners]) listener(event); }
  }
  const instances: Api[] = [];
  class Api {
    postRenderFinished = new Events(); error = new Events(); playerReady = new Events();
    playerStateChanged = new Events<{ state: number; stopped: boolean }>();
    playerPositionChanged = new Events<{ currentTick: number; endTick: number; currentTime: number; endTime: number; modifiedTempo: number; isSeek: boolean }>();
    isReadyForPlayback = false; tickPosition = 0; timePosition = 0; endTick = 8000; endTime = 5000;
    playbackSpeed = 1; isLooping = false; playbackRange: unknown = null;
    score: model.Score | null = null; masterVolume = 1;
    destroy = vi.fn(); renderScore = vi.fn((score: model.Score) => { this.score = score; }); updateSettings = vi.fn();
    changeTrackMute = vi.fn(); changeTrackSolo = vi.fn(); changeTrackVolume = vi.fn();
    play = vi.fn(() => true); pause = vi.fn(); stop = vi.fn();
    constructor(readonly host: unknown, readonly settings: { core: Record<string, unknown>; player: Record<string, unknown> }) { instances.push(this); }
  }
  return { Api, instances, configure: vi.fn() };
});
vi.mock('@coderline/alphatab', () => ({ AlphaTabApi: fake.Api, PlayerMode: { EnabledSynthesizer: 2 }, synth: { PlayerState: { Playing: 1 } } }));
vi.mock('../src/browser-audio-runtime.js', () => ({ configureAudioRuntime: fake.configure }));
import { AlphaTabScoreAdapter } from '../src/index.js';
import type { TransportEvent } from '@guitar-practice/core';

const bytes = () => new Uint8Array(readFileSync(new URL('../../../tests/fixtures/alphatab/notes.gp3', import.meta.url)));
function setup() {
  const adapter = new AlphaTabScoreAdapter({ replaceChildren: vi.fn() } as unknown as HTMLElement, {
    fontDirectory: '/font/', audio: { scriptFile: 'http://localhost/assets/alphatab/alphaTab.mjs', soundFont: '/sonivox.sf2', scrollElement: {} as HTMLElement },
  });
  const events: TransportEvent[] = []; adapter.subscribeTransport((event) => events.push(event));
  return { adapter, events };
}
const latest = () => fake.instances.at(-1)!;
beforeEach(() => { fake.instances.length = 0; vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('port playback alphaTab', () => {
  it('prepara audio dopo rendering, forza il synth e converte eventi senza esporre modelli', async () => {
    const { adapter, events } = setup(); const load = adapter.load(bytes()); const api = latest();
    expect(api.updateSettings).not.toHaveBeenCalled();
    api.postRenderFinished.emit(); await load;
    expect(api.settings.player).toMatchObject({ playerMode: 2, soundFont: '/sonivox.sf2', enableUserInteraction: false });
    expect(events.at(-1)).toEqual({ type: 'preparing' });
    api.playerReady.emit(); expect(events.at(-1)).toEqual({ type: 'ready' });
    expect(events.at(-2)).toEqual({ type: 'position', isSeek: true, position: { tick: 0, endTick: 8000, timeMs: 0, durationMs: 5000, tempo: 0 } });
    api.playerStateChanged.emit({ state: 1, stopped: false }); expect(events.at(-1)).toEqual({ type: 'state', status: 'playing' });
    api.playerStateChanged.emit({ state: 0, stopped: false }); expect(events.at(-1)).toEqual({ type: 'state', status: 'paused' });
    api.playerStateChanged.emit({ state: 0, stopped: true }); expect(events.at(-1)).toEqual({ type: 'state', status: 'stopped' });
    adapter.play(); adapter.pause(); adapter.stop(); adapter.seek(300); adapter.setSpeed(0.5);
    expect(api.play).toHaveBeenCalledOnce(); expect(api.pause).toHaveBeenCalledOnce(); expect(api.stop).toHaveBeenCalledOnce();
    expect(api.tickPosition).toBe(300); expect(api.playbackSpeed).toBe(0.5);
    adapter.setLoop({ startTick: 100, endTick: 700 }, 400);
    expect(api.isLooping).toBe(true); expect(api.playbackRange).toEqual({ startTick: 100, endTick: 700 }); expect(api.tickPosition).toBe(400);
    adapter.setLoop(null, 400); expect(api.isLooping).toBe(false); expect(api.playbackRange).toBeNull();
    adapter.destroy(); expect(vi.getTimerCount()).toBe(0);
  });

  it('un errore audio non invalida il documento renderizzato e può essere recuperato con un nuovo file', async () => {
    const { adapter, events } = setup(); const load = adapter.load(bytes()); const api = latest();
    api.postRenderFinished.emit(); expect((await load).barCount).toBe(1);
    api.error.emit(); expect(events.at(-1)).toEqual({ type: 'error', error: 'audio-unavailable' });
    expect(api.destroy).not.toHaveBeenCalled();
    const second = adapter.load(bytes()); latest().postRenderFinished.emit(); await second; latest().playerReady.emit();
    expect(events.at(-1)).toEqual({ type: 'ready' });
    expect(api.destroy).toHaveBeenCalledOnce(); adapter.destroy();
  });

  it('limita preparazione audio e cancella eventi tardivi e timer al cambio documento', async () => {
    const { adapter, events } = setup(); const load = adapter.load(bytes()); const api = latest();
    api.postRenderFinished.emit(); await load;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(events.at(-1)).toEqual({ type: 'error', error: 'prepare-timeout' });
    const lateReady = [...api.playerReady.listeners][0]!;
    const latePosition = [...api.playerPositionChanged.listeners][0]!;
    adapter.reset(); const count = events.length;
    lateReady(); latePosition({ currentTick: 1, endTick: 10, currentTime: 1, endTime: 10, modifiedTempo: 120, isSeek: true });
    expect(events).toHaveLength(count); expect(api.playerReady.listeners.size).toBe(0);
    expect(api.playerPositionChanged.listeners.size).toBe(0); expect(api.error.listeners.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0); adapter.destroy();
  });
});

it('il mixer usa soltanto API pubbliche, riferimenti alle tracce corretti e reset al nuovo file', async () => {
  const { adapter } = setup(); const events: import('@guitar-practice/core').MixerEvent[] = [];
  adapter.subscribeMixer((event) => events.push(event));
  const load = adapter.load(bytes()); const api = latest(); api.postRenderFinished.emit(); await load;
  expect(() => adapter.setMasterVolume(0.5)).toThrow('audio-unavailable');
  api.isReadyForPlayback = true; api.playerReady.emit();
  expect(events.at(-1)).toMatchObject({ type: 'ready', tracks: [{ index: 0, linkedTrackIndexes: [0] }] });
  adapter.setTrackMute([0], true); adapter.setTrackSolo([0], true); adapter.setTrackVolume([0], 0.3); adapter.setMasterVolume(0.4);
  expect(api.changeTrackMute).toHaveBeenCalledWith([api.score!.tracks[0]], true);
  expect(api.changeTrackSolo).toHaveBeenCalledWith([api.score!.tracks[0]], true);
  expect(api.changeTrackVolume).toHaveBeenCalledWith([api.score!.tracks[0]], 0.3); expect(api.masterVolume).toBe(0.4);
  expect(() => adapter.setTrackMute([99], true)).toThrow('invalid-track');
  api.error.emit(); expect(events.at(-1)).toEqual({ type: 'unavailable' });
  adapter.reset(); expect(events.at(-1)).toEqual({ type: 'reset' }); adapter.destroy();
});
