import { describe, expect, it, vi } from 'vitest';
import { MixerController, TransportController, initialMixerState, initialTransportState } from '@guitar-practice/core';
import type { MixerEvent, TransportEvent } from '@guitar-practice/core';
import { captureCurrentSessionState, parseCurrentSessionState, restoreMixer, restoreTransport } from '../src/app/current-session-state.js';

const snapshot = () => ({
  view: { mode: 'tab' as const, scale: 1.25 },
  transport: { tick: 400, speed: 0.5, a: 200, b: 700, loop: true },
  mixer: { masterVolume: 0.42, tracks: [{ index: 0, volume: 0.33, muted: true, solo: true }] },
});

describe('stato corrente ripristinabile', () => {
  it('valida i valori persistiti e rifiuta snapshot corrotti', () => {
    const valid = snapshot(); expect(parseCurrentSessionState(valid)).toEqual(valid);
    for (const value of [null, {}, { ...valid, view: { mode: 'bad', scale: 10 } },
      { ...valid, transport: { ...valid.transport, a: 800 } },
      { ...valid, transport: { ...valid.transport, tick: NaN } },
      { ...valid, transport: { ...valid.transport, loop: 'true' } },
      { ...valid, mixer: { masterVolume: 2, tracks: [] } },
      { ...valid, mixer: { masterVolume: 1, tracks: [valid.mixer.tracks[0], valid.mixer.tracks[0]] } },
      { ...valid, mixer: { masterVolume: 1, tracks: [{ index: -1, muted: true, solo: false, volume: 1 }] } }]) {
      expect(parseCurrentSessionState(value)).toBeNull();
    }
    expect(parseCurrentSessionState(captureCurrentSessionState(valid.view, initialTransportState(), initialMixerState()))).not.toBeNull();
  });

  it('conserva la visibilità e accetta snapshot precedenti senza il campo', () => {
    const saved = snapshot();
    expect(parseCurrentSessionState(saved)).not.toBeNull();
    const withVisibility = { ...saved, view: { ...saved.view, hiddenTracks: [0, 2] } };
    expect(parseCurrentSessionState(withVisibility)?.view.hiddenTracks).toEqual([0, 2]);
    expect(captureCurrentSessionState(withVisibility.view, initialTransportState(), initialMixerState()).view.hiddenTracks).toEqual([0, 2]);
    expect(parseCurrentSessionState({ ...saved, view: { ...saved.view, hiddenTracks: [-1] } })).toBeNull();
  });

  it('ripristina con comandi core, senza Play, rispettando il bordo B esclusivo', () => {
    let receive: (event: TransportEvent) => void = () => {};
    const port = { subscribeTransport: (listener: typeof receive) => { receive = listener; return () => {}; },
      play: vi.fn(() => true), pause: vi.fn(), stop: vi.fn(), seek: vi.fn(), setSpeed: vi.fn(), setLoop: vi.fn() };
    const controller = new TransportController(port);
    receive({ type: 'preparing' });
    receive({ type: 'position', isSeek: true, position: { tick: 0, endTick: 1000, timeMs: 0, durationMs: 1000, tempo: 120 } });
    receive({ type: 'ready' });
    restoreTransport(controller, { ...snapshot().transport, tick: 700 });
    expect(controller.state).toMatchObject({ status: 'stopped', a: 200, b: 700, loop: true, speed: 0.5 });
    expect(port.seek).toHaveBeenLastCalledWith(200); expect(port.play).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('ignora range oltre la durata reale e limita il seek al documento', () => {
    let receive: (event: TransportEvent) => void = () => {};
    const port = { subscribeTransport: (listener: typeof receive) => { receive = listener; return () => {}; },
      play: vi.fn(() => true), pause: vi.fn(), stop: vi.fn(), seek: vi.fn(), setSpeed: vi.fn(), setLoop: vi.fn() };
    const controller = new TransportController(port);
    receive({ type: 'preparing' });
    receive({ type: 'position', isSeek: true, position: { tick: 0, endTick: 100, timeMs: 0, durationMs: 1000, tempo: 120 } });
    receive({ type: 'ready' }); restoreTransport(controller, snapshot().transport);
    expect(controller.state).toMatchObject({ a: 0, b: 100, loop: false, error: null });
    expect(port.seek).toHaveBeenCalledWith(100); expect(port.setLoop).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('ripristina mixer con tracce collegate senza invertire due volte i toggle', () => {
    let receive: (event: MixerEvent) => void = () => {};
    const port = { subscribeMixer: (listener: typeof receive) => { receive = listener; return () => {}; },
      setTrackMute: vi.fn(), setTrackSolo: vi.fn(), setTrackVolume: vi.fn(), setMasterVolume: vi.fn() };
    const controller = new MixerController(port);
    receive({ type: 'ready', tracks: [0, 1].map((index) => ({ index, name: String(index), defaultVolume: 1, linkedTrackIndexes: [0, 1] })) });
    restoreMixer(controller, { masterVolume: 0.42, tracks: [0, 1, 99].map((index) => ({ index, muted: true, solo: true, volume: 0.33 })) });
    expect(controller.state.masterVolume).toBe(0.42);
    expect(controller.state.tracks.every((track) => track.muted && track.solo && track.volume === 0.33)).toBe(true);
    expect(port.setTrackMute).toHaveBeenCalledTimes(3); // 2 iniziali + 1 gruppo ripristinato
    expect(port.setTrackSolo).toHaveBeenCalledTimes(3);
    controller.dispose();
  });
});
