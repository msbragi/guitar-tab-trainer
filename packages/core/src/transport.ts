/** Tick nella sequenza eseguita (ripetizioni incluse), mai indice di battuta. */
export interface TransportPosition {
  readonly tick: number;
  readonly endTick: number;
  /** Millisecondi riportati dal player, alla velocità corrente. */
  readonly timeMs: number;
  readonly durationMs: number;
  readonly tempo: number;
}

export type TransportError = 'audio-unavailable' | 'prepare-timeout' | 'playback-failed' | 'invalid-loop' | 'invalid-command';
export type TransportStatus = 'idle' | 'preparing' | 'stopped' | 'playing' | 'paused' | 'error';
export interface TransportState extends TransportPosition {
  readonly status: TransportStatus;
  readonly speed: number;
  readonly loop: boolean;
  readonly a: number | null;
  readonly b: number | null;
  readonly error: TransportError | null;
}

export type TransportEvent =
  | { readonly type: 'preparing' | 'reset' | 'ready' }
  | { readonly type: 'seek-request'; readonly tick: number }
  | { readonly type: 'position'; readonly position: TransportPosition; readonly isSeek: boolean }
  | { readonly type: 'state'; readonly status: 'playing' | 'paused' | 'stopped' }
  | { readonly type: 'error'; readonly error: TransportError };

/** Port posseduto dal core. Nessun tipo DOM o alphaTab attraversa il confine. */
export interface TransportPort {
  subscribeTransport(listener: (event: TransportEvent) => void): () => void;
  play(): boolean;
  pause(): void;
  stop(): void;
  seek(tick: number): void;
  setSpeed(factor: number): void;
  setLoop(range: { readonly startTick: number; readonly endTick: number } | null, tick: number): void;
}

export function initialTransportState(): TransportState {
  return Object.freeze({ status: 'idle', tick: 0, endTick: 0, timeMs: 0, durationMs: 0,
    tempo: 0, speed: 1, loop: false, a: null, b: null, error: null });
}

/** Unica rappresentazione applicativa del trasporto. Nessun clock concorrente. */
export class TransportController {
  private current = initialTransportState();
  private readonly listeners = new Set<(state: TransportState) => void>();
  private readonly unsubscribe: () => void;
  private disposed = false;

  constructor(private readonly port: TransportPort) {
    this.unsubscribe = port.subscribeTransport((event) => this.receive(event));
  }
  get state(): TransportState { return this.current; }
  subscribe(listener: (state: TransportState) => void): () => void {
    if (this.disposed) throw new Error('session-closed');
    this.listeners.add(listener); listener(this.current);
    return () => { this.listeners.delete(listener); };
  }
  play(): void { this.command(() => { if (!this.port.play()) this.patch({ error: 'audio-unavailable' }); }); }
  pause(): void { this.command(() => this.port.pause()); }
  stop(): void { this.command(() => this.port.stop()); }
  seek(tick: number): void {
    if (!Number.isFinite(tick)) { this.patch({ error: 'invalid-command' }); return; }
    this.command(() => this.port.seek(this.limitTick(tick)));
  }
  setSpeed(speed: number): void {
    if (!Number.isFinite(speed) || speed < 0.25 || speed > 2) {
      this.patch({ error: 'invalid-command' }); return;
    }
    this.command(() => { this.port.setSpeed(speed); this.patch({ speed }); });
  }
  setPoint(point: 'a' | 'b', tick = this.current.tick): void {
    if (!this.ready()) return;
    const a = point === 'a' ? tick : this.current.a;
    const b = point === 'b' ? tick : this.current.b;
    if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)
      || a < 0 || b > this.current.endTick || a >= b) {
      this.patch({ error: 'invalid-loop' }); return;
    }
    this.command(() => {
      this.patch({ a, b });
      if (this.current.loop) this.applyLoop();
    });
  }
  toggleLoop(): void {
    if (!this.ready()) return;
    this.command(() => { this.patch({ loop: !this.current.loop }); this.applyLoop(); });
  }
  dispose(): void {
    this.disposed = true; this.unsubscribe(); this.listeners.clear();
  }
  private applyLoop(): void {
    const { a, b, loop } = this.current;
    this.port.setLoop(loop && a !== null && b !== null ? { startTick: a, endTick: b } : null,
      this.limitTick(this.current.tick));
  }
  private limitTick(tick: number): number {
    const { loop, a, b, endTick } = this.current;
    const start = loop ? a ?? 0 : 0;
    const end = loop ? b ?? endTick : endTick;
    // Il bordo destro del loop è esclusivo: un seek a B riparte da A.
    return loop && tick >= end ? start : Math.max(start, Math.min(end, tick));
  }
  private ready(): boolean {
    return !this.disposed && ['stopped', 'paused', 'playing'].includes(this.current.status);
  }
  private command(action: () => void): void {
    if (!this.ready()) return;
    this.patch({ error: null });
    try { action(); } catch { this.patch({ status: 'error', error: 'playback-failed' }); }
  }
  private receive(event: TransportEvent): void {
    if (this.disposed) return;
    switch (event.type) {
      case 'reset': this.current = initialTransportState(); this.patch({}); break;
      case 'preparing': this.current = initialTransportState(); this.patch({ status: 'preparing' }); break;
      case 'ready':
        if (this.current.status === 'preparing') this.patch({ status: 'stopped', a: 0, b: this.current.endTick });
        break;
      case 'seek-request': this.seek(event.tick); break;
      case 'position':
        // Notifiche di campioni già in volo possono arrivare dopo pausa/stop.
        // Da fermi si accettano soltanto posizionamenti espliciti del player.
        if (this.current.status === 'preparing' || this.current.status === 'playing'
          || (this.ready() && event.isSeek)) this.patch(event.position);
        break;
      case 'state': if (this.ready()) this.patch({ status: event.status }); break;
      case 'error': this.patch({ status: 'error', error: event.error }); break;
    }
  }
  private patch(patch: Partial<TransportState>): void {
    if (this.disposed) return;
    this.current = Object.freeze({ ...this.current, ...patch });
    this.listeners.forEach((listener) => listener(this.current));
  }
}
