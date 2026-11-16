import { describe, expect, it, vi } from 'vitest';
import { TransportController } from '../src/transport.js';
import type { TransportEvent, TransportPort } from '../src/transport.js';

class Port implements TransportPort {
  listener: ((event: TransportEvent) => void) | undefined;
  subscribeTransport(listener: (event: TransportEvent) => void) {
    this.listener = listener;
    return () => { this.listener = undefined; };
  }
  emit(event: TransportEvent) { this.listener?.(event); }
  play = vi.fn(() => true);
  pause = vi.fn();
  stop = vi.fn();
  seek = vi.fn();
  setSpeed = vi.fn();
  setLoop = vi.fn();
  position(tick = 100) {
    this.emit({ type: 'position', isSeek: true, position: { tick, endTick: 1000, timeMs: tick * 3,
      durationMs: 3000, tempo: 120 } });
  }
}
function setup() {
  const port = new Port();
  const controller = new TransportController(port);
  port.emit({ type: 'preparing' }); port.position(0); port.emit({ type: 'ready' });
  return { port, controller };
}

describe('trasporto autorevole nel core', () => {
  it('ignora comandi prima della preparazione, pubblica snapshot immutabili e attende gli eventi del player', () => {
    const port = new Port(); const controller = new TransportController(port);
    const listener = vi.fn(); controller.subscribe(listener);
    controller.play(); expect(port.play).not.toHaveBeenCalled();
    port.emit({ type: 'preparing' }); controller.play(); expect(port.play).not.toHaveBeenCalled();
    port.position(0); port.emit({ type: 'ready' });
    expect(controller.state).toMatchObject({ status: 'stopped', a: 0, b: 1000 });
    controller.play(); expect(port.play).toHaveBeenCalledOnce();
    expect(controller.state.status).toBe('stopped');
    port.emit({ type: 'state', status: 'playing' });
    expect(controller.state.status).toBe('playing');
    expect(Object.isFrozen(controller.state)).toBe(true);
    controller.pause(); expect(controller.state.status).toBe('playing');
    port.emit({ type: 'state', status: 'paused' }); controller.stop();
    expect(port.pause).toHaveBeenCalledOnce(); expect(port.stop).toHaveBeenCalledOnce();
    port.emit({ type: 'state', status: 'stopped' }); expect(controller.state.status).toBe('stopped');
  });

  it('valida velocità e seek, separando tick e millisecondi senza conversioni BPM', () => {
    const { port, controller } = setup();
    controller.seek(-5); expect(port.seek).toHaveBeenLastCalledWith(0);
    controller.seek(1200); expect(port.seek).toHaveBeenLastCalledWith(1000);
    controller.seek(NaN); expect(controller.state.error).toBe('invalid-command');
    controller.setSpeed(0.5); expect(port.setSpeed).toHaveBeenCalledWith(0.5);
    expect(controller.state.speed).toBe(0.5);
    for (const value of [0, 3, Infinity, NaN]) controller.setSpeed(value);
    expect(port.setSpeed).toHaveBeenCalledTimes(1);
    port.position(500); expect(controller.state).toMatchObject({ tick: 500, timeMs: 1500 });
  });

  it('modifica A/B durante il playback preservando posizione e stato', () => {
    const { port, controller } = setup();
    port.emit({ type: 'state', status: 'playing' }); port.position(400);
    controller.toggleLoop();
    controller.setPoint('a', 200); controller.setPoint('b', 700);
    expect(port.setLoop).toHaveBeenLastCalledWith({ startTick: 200, endTick: 700 }, 400);
    expect(controller.state).toMatchObject({ status: 'playing', a: 200, b: 700, loop: true });
    controller.setPoint('b', 300);
    expect(port.setLoop).toHaveBeenLastCalledWith({ startTick: 200, endTick: 300 }, 200);
    controller.setPoint('a', 250);
    expect(port.setLoop).toHaveBeenLastCalledWith({ startTick: 250, endTick: 300 }, 250);
    controller.seek(300); expect(port.seek).toHaveBeenLastCalledWith(250);
    controller.seek(1); expect(port.seek).toHaveBeenLastCalledWith(250);
    controller.toggleLoop(); expect(port.setLoop).toHaveBeenLastCalledWith(null, 400);
    expect(port.pause).not.toHaveBeenCalled(); expect(port.play).not.toHaveBeenCalled();
  });

  it('rifiuta intervalli invalidi senza alterare il loop attivo', () => {
    const { port, controller } = setup();
    controller.setPoint('a', 200); controller.setPoint('b', 600); controller.toggleLoop();
    port.setLoop.mockClear();
    for (const [point, tick] of [['a', 600], ['a', -1], ['b', 200], ['b', 1001], ['b', NaN]] as const) {
      controller.setPoint(point, tick);
      expect(controller.state).toMatchObject({ a: 200, b: 600, loop: true, error: 'invalid-loop' });
    }
    expect(port.setLoop).not.toHaveBeenCalled();
  });

  it('imposta i punti dalla posizione confermata e non invia range fino ad attivazione', () => {
    const { port, controller } = setup();
    port.position(100); controller.setPoint('a');
    port.position(900); controller.setPoint('b');
    expect(controller.state).toMatchObject({ a: 100, b: 900 });
    expect(port.setLoop).not.toHaveBeenCalled();
    controller.toggleLoop(); expect(port.setLoop).toHaveBeenCalledWith({ startTick: 100, endTick: 900 }, 100);
  });

  it('reset azzera anche velocità e loop; errori audio non modificano lo stato del documento', () => {
    const { port, controller } = setup();
    controller.setSpeed(0.5); controller.toggleLoop();
    port.emit({ type: 'error', error: 'audio-unavailable' });
    controller.play(); expect(port.play).not.toHaveBeenCalled();
    port.emit({ type: 'ready' }); expect(controller.state.status).toBe('error');
    port.emit({ type: 'reset' });
    expect(controller.state).toMatchObject({ status: 'idle', speed: 1, loop: false, a: null, b: null, error: null });
    port.emit({ type: 'preparing' }); port.position(0); port.emit({ type: 'ready' });
    expect(controller.state.status).toBe('stopped');
  });

  it('ignora campioni tardivi dopo pausa/stop ma accetta seek espliciti', () => {
    const { port, controller } = setup();
    port.emit({ type: 'state', status: 'playing' }); port.position(500);
    port.emit({ type: 'state', status: 'paused' });
    const late = { tick: 600, endTick: 1000, timeMs: 1800, durationMs: 3000, tempo: 120 };
    port.emit({ type: 'position', isSeek: false, position: late });
    expect(controller.state.tick).toBe(500);
    port.position(0); port.emit({ type: 'state', status: 'stopped' });
    port.emit({ type: 'position', isSeek: false, position: late });
    expect(controller.state.tick).toBe(0);
    port.emit({ type: 'position', isSeek: true, position: late });
    expect(controller.state.tick).toBe(600);
  });

  it('gestisce rifiuti ed eccezioni del player e ignora eventi dopo dispose', () => {
    const { port, controller } = setup();
    port.play.mockReturnValue(false); controller.play();
    expect(controller.state.error).toBe('audio-unavailable');
    port.pause.mockImplementation(() => { throw new Error('diagnostica'); });
    controller.pause(); expect(controller.state).toMatchObject({ status: 'error', error: 'playback-failed' });
    const listener = vi.fn(); controller.subscribe(listener);
    const queued = port.listener!; controller.dispose();
    queued({ type: 'reset' }); controller.seek(NaN); controller.play();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(port.listener).toBeUndefined();
    expect(() => controller.subscribe(listener)).toThrow('session-closed');
  });
});
