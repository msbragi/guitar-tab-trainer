export interface MixerTrackDefinition {
  readonly index: number;
  readonly name: string;
  readonly defaultVolume: number;
  /** Tracce collegate dallo stesso gruppo di controllo del motore. Nessun tipo MIDI esposto. */
  readonly linkedTrackIndexes: readonly number[];
}
export interface MixerTrackState extends MixerTrackDefinition {
  readonly muted: boolean;
  readonly solo: boolean;
  readonly volume: number;
  readonly excluded: boolean;
}
export interface MixerState {
  readonly available: boolean;
  readonly masterVolume: number;
  readonly tracks: readonly MixerTrackState[];
  readonly error: 'mixer-failed' | 'invalid-volume' | null;
}
export type MixerEvent = { readonly type: 'ready'; readonly tracks: readonly MixerTrackDefinition[] }
  | { readonly type: 'reset' | 'unavailable' };
export interface MixerPort {
  subscribeMixer(listener: (event: MixerEvent) => void): () => void;
  setTrackMute(indexes: readonly number[], muted: boolean): void;
  setTrackSolo(indexes: readonly number[], solo: boolean): void;
  setTrackVolume(indexes: readonly number[], volume: number): void;
  setMasterVolume(volume: number): void;
}
export function initialMixerState(): MixerState {
  return Object.freeze({ available: false, masterVolume: 1, tracks: Object.freeze([]), error: null });
}

/** Stato e politiche del mixer sintetizzato, senza elaborazione audio. */
export class MixerController {
  private current = initialMixerState();
  private readonly listeners = new Set<(state: MixerState) => void>();
  private readonly unsubscribe: () => void;
  private disposed = false;
  constructor(private readonly port: MixerPort) {
    this.unsubscribe = port.subscribeMixer((event) => {
      if (this.disposed) return;
      if (event.type === 'reset') this.publish(initialMixerState());
      else if (event.type === 'unavailable') this.publish({ ...this.current, available: false });
      else if (event.type === 'ready') {
        // Ready può ripetersi sullo stesso documento; il reset identifica una nuova sessione.
        const tracks = this.current.tracks.length ? this.current.tracks : event.tracks.map((track) => ({
          ...track, linkedTrackIndexes: Object.freeze([...track.linkedTrackIndexes]),
          volume: track.defaultVolume, muted: false, solo: false, excluded: false,
        }));
        try {
          this.port.setMasterVolume(this.current.masterVolume);
          for (const track of tracks) {
            this.port.setTrackMute([track.index], track.muted);
            this.port.setTrackSolo([track.index], track.solo);
            this.port.setTrackVolume([track.index], track.volume);
          }
          this.publish({ ...this.current, available: true, error: null, tracks });
        } catch { this.publish({ ...this.current, available: false, error: 'mixer-failed' }); }
      }
    });
  }
  get state(): MixerState { return this.current; }
  subscribe(listener: (state: MixerState) => void): () => void {
    if (this.disposed) throw new Error('session-closed');
    this.listeners.add(listener); listener(this.current);
    return () => { this.listeners.delete(listener); };
  }
  toggleMute(index: number): void {
    const track = this.find(index);
    if (track) this.change(track, { muted: !track.muted }, () => this.port.setTrackMute(track.linkedTrackIndexes, !track.muted));
  }
  toggleSolo(index: number): void {
    const track = this.find(index);
    if (track) this.change(track, { solo: !track.solo }, () => this.port.setTrackSolo(track.linkedTrackIndexes, !track.solo));
  }
  setVolume(index: number, volume: number): void {
    const track = this.find(index);
    if (!track || !this.validVolume(volume)) return;
    this.change(track, { volume }, () => this.port.setTrackVolume(track.linkedTrackIndexes, volume));
  }
  setMasterVolume(volume: number): void {
    if (!this.current.available || this.disposed || !this.validVolume(volume)) return;
    try { this.port.setMasterVolume(volume); this.publish({ ...this.current, masterVolume: volume, error: null }); }
    catch { this.publish({ ...this.current, error: 'mixer-failed' }); }
  }
  dispose(): void { this.disposed = true; this.unsubscribe(); this.listeners.clear(); }
  private find(index: number): MixerTrackState | undefined {
    return this.current.available && !this.disposed ? this.current.tracks.find((track) => track.index === index) : undefined;
  }
  private validVolume(volume: number): boolean {
    if (Number.isFinite(volume) && volume >= 0 && volume <= 1) return true;
    this.publish({ ...this.current, error: 'invalid-volume' }); return false;
  }
  private change(track: MixerTrackState, patch: Partial<MixerTrackState>, command: () => void): void {
    try {
      command();
      this.publish({ ...this.current, error: null, tracks: this.current.tracks.map((item) =>
        track.linkedTrackIndexes.includes(item.index) ? { ...item, ...patch } : item) });
    } catch { this.publish({ ...this.current, error: 'mixer-failed' }); }
  }
  private publish(state: MixerState): void {
    if (this.disposed) return;
    const hasSolo = state.tracks.some((track) => track.solo);
    this.current = Object.freeze({ ...state, tracks: Object.freeze(state.tracks.map((track) =>
      Object.freeze({ ...track, excluded: track.muted || (hasSolo && !track.solo) }))) });
    this.listeners.forEach((listener) => listener(this.current));
  }
}
