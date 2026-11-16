import { describe, expect, it, vi } from 'vitest';
import { MixerController } from '../src/mixer.js';
import type { MixerEvent, MixerPort } from '../src/mixer.js';

class Port implements MixerPort {
  listener?: (event: MixerEvent) => void;
  subscribeMixer(listener: (event: MixerEvent) => void) { this.listener = listener; return () => { this.listener = undefined; }; }
  setTrackMute = vi.fn(); setTrackSolo = vi.fn(); setTrackVolume = vi.fn(); setMasterVolume = vi.fn();
  emit(event: MixerEvent) { this.listener?.(event); }
}
const definitions = [0, 1, 2].map((index) => ({ index, name: `Track ${index}`, defaultVolume: 0.75, linkedTrackIndexes: [index] }));
function setup() { const port = new Port(); const controller = new MixerController(port); port.emit({ type: 'ready', tracks: definitions }); return { port, controller }; }

describe('mixer sintetizzato nel core', () => {
  it('disabilita comandi prima di ready, inizializza i default e pubblica snapshot immutabili', () => {
    const port = new Port(); const controller = new MixerController(port);
    controller.toggleMute(0); controller.setMasterVolume(0.5); expect(port.setMasterVolume).not.toHaveBeenCalled();
    port.emit({ type: 'ready', tracks: definitions });
    expect(controller.state).toMatchObject({ available: true, masterVolume: 1, error: null });
    expect(controller.state.tracks[0]).toMatchObject({ muted: false, solo: false, volume: 0.75, excluded: false });
    expect(port.setTrackVolume).toHaveBeenCalledWith([1], 0.75);
    expect(Object.isFrozen(controller.state.tracks[0])).toBe(true);
    expect(Object.isFrozen(controller.state.tracks[0]!.linkedTrackIndexes)).toBe(true);
  });
  it('il solo è cumulativo, il mute resta prevalente e uscire dall’ultimo solo ripristina le altre tracce', () => {
    const { controller, port } = setup();
    controller.toggleMute(1); controller.toggleSolo(0); controller.toggleSolo(1);
    expect(controller.state.tracks.map((t) => [t.muted, t.solo, t.excluded])).toEqual([[false,true,false],[true,true,true],[false,false,true]]);
    controller.toggleMute(1); expect(controller.state.tracks[1]!.excluded).toBe(false);
    controller.toggleSolo(0); expect(controller.state.tracks[0]!.excluded).toBe(true);
    controller.toggleSolo(1); expect(controller.state.tracks.every((t) => !t.excluded)).toBe(true);
    expect(port.setTrackSolo).toHaveBeenCalledWith([0], true); expect(port.setTrackSolo).toHaveBeenCalledWith([1], false);
    controller.toggleMute(0); controller.toggleMute(2);
    expect(controller.state.tracks.map((t) => t.muted)).toEqual([true,false,true]);
  });
  it('modifica volumi indipendenti e master senza alterare mute/solo', () => {
    const { controller, port } = setup();
    controller.toggleMute(1); controller.toggleSolo(0); controller.setVolume(0, 0); controller.setVolume(2, 1); controller.setMasterVolume(0.4);
    expect(controller.state.tracks.map((t) => t.volume)).toEqual([0,0.75,1]);
    expect(controller.state.tracks[1]!.muted).toBe(true); expect(controller.state.tracks[0]!.solo).toBe(true);
    expect(port.setTrackVolume).toHaveBeenLastCalledWith([2], 1); expect(controller.state.masterVolume).toBe(0.4);
  });
  it('rifiuta valori fuori range, tracce inesistenti ed errori del port senza pubblicare valori falsi', () => {
    const { controller, port } = setup(); port.setTrackVolume.mockClear();
    for (const value of [-0.1, 1.01, NaN, Infinity]) { controller.setVolume(0, value); controller.setMasterVolume(value); }
    expect(controller.state.error).toBe('invalid-volume'); expect(port.setTrackVolume).not.toHaveBeenCalled();
    port.setTrackMute.mockClear(); controller.toggleMute(77); expect(port.setTrackMute).not.toHaveBeenCalled();
    port.setTrackMute.mockImplementation(() => { throw new Error('engine'); }); controller.toggleMute(0);
    expect(controller.state.tracks[0]!.muted).toBe(false); expect(controller.state.error).toBe('mixer-failed');
  });
  it('i controlli di canali condivisi restano collegati e coerenti', () => {
    const { controller, port } = setup(); port.emit({ type: 'reset' });
    port.emit({ type: 'ready', tracks: definitions.map((t) => ({ ...t, linkedTrackIndexes: t.index < 2 ? [0,1] : [2] })) });
    controller.toggleMute(1); controller.toggleSolo(0); controller.setVolume(1, 0.2);
    expect(controller.state.tracks.slice(0,2).map((t) => [t.muted,t.solo,t.volume])).toEqual([[true,true,0.2],[true,true,0.2]]);
    expect(port.setTrackVolume).toHaveBeenLastCalledWith([0,1], 0.2);
    expect(controller.state.tracks[2]!.volume).toBe(0.75);
  });
  it('ready ripetuto riapplica lo stato; nuovo documento ripristina default, mute/solo e master', () => {
    const { controller, port } = setup(); controller.toggleSolo(1); controller.toggleMute(0); controller.setMasterVolume(0.2); controller.setVolume(1, 0.4);
    port.emit({ type: 'ready', tracks: definitions });
    expect(controller.state.tracks[1]!.solo).toBe(true); expect(port.setMasterVolume).toHaveBeenLastCalledWith(0.2);
    port.emit({ type: 'reset' }); expect(controller.state.tracks).toHaveLength(0); expect(controller.state.masterVolume).toBe(1);
    port.emit({ type: 'ready', tracks: [definitions[0]!] }); expect(controller.state.tracks).toHaveLength(1);
    expect(controller.state.tracks[0]).toMatchObject({ muted: false, solo: false, volume: 0.75 });
  });
  it('errore audio e dispose bloccano comandi/eventi tardivi', () => {
    const { controller, port } = setup(); port.emit({ type: 'unavailable' }); port.setTrackSolo.mockClear(); controller.toggleSolo(0);
    expect(port.setTrackSolo).not.toHaveBeenCalled();
    const queued = port.listener!; const listener = vi.fn(); controller.subscribe(listener); controller.dispose();
    queued({ type: 'reset' }); controller.setMasterVolume(0.5); expect(listener).toHaveBeenCalledTimes(1);
    expect(port.listener).toBeUndefined(); expect(() => controller.subscribe(listener)).toThrow('session-closed');
  });
});
