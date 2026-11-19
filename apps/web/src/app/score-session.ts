import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { ScoreController, ScoreLoadError, TransportController, initialTransportState, MixerController, initialMixerState } from '@guitar-practice/core';
import type { ScoreErrorCode, ScoreState, TransportState, MixerState, ScoreSource } from '@guitar-practice/core';
import { AlphaTabScoreAdapter } from '@guitar-practice/alphatab-adapter';
import { readSessionPreferences, writeSessionPreferences } from './session-preferences.js';
import type { SessionPreferences } from './session-preferences.js';
import { CurrentSessionStore } from './current-session-store.js';
import type { CurrentSessionFile } from './current-session-store.js';
import { captureCurrentSessionState, restoreMixer, restoreTransport } from './current-session-state.js';
import type { CurrentSessionState, SavedTransport, SavedMixer } from './current-session-state.js';
import type { ScoreViewMode } from '@guitar-practice/alphatab-adapter';

/** Composizione UI di core e adapter. I componenti presentano dati e inoltrano comandi. */
@Injectable({ providedIn: 'root' })
export class ScoreSession {
  private readonly document = inject(DOCUMENT);
  private readonly current = signal<ScoreState>({ status: 'idle' });
  readonly state = this.current.asReadonly();
  readonly available = signal(false);
  readonly viewBusy = signal(false);
  readonly viewError = signal<ScoreErrorCode | null>(null);
  readonly mode = signal<ScoreViewMode>('score-tab');
  readonly scale = signal(1);
  private readonly transportSnapshot = signal<TransportState>(initialTransportState());
  /** Proiezione dello stato del core; nessuna transizione del trasporto nella UI. */
  readonly transport = this.transportSnapshot.asReadonly();
  private transportController: TransportController | undefined;
  private readonly mixerSnapshot = signal<MixerState>(initialMixerState());
  readonly mixer = this.mixerSnapshot.asReadonly();
  private mixerController: MixerController | undefined;
  private adapter: AlphaTabScoreAdapter | undefined;
  private controller: ScoreController | undefined;

  private preferenceStorage(): Storage | undefined {
    try { return this.document.defaultView?.localStorage; } catch { return undefined; }
  }
  private preferences: SessionPreferences = readSessionPreferences(this.preferenceStorage());
  private savePreferences(patch: Partial<SessionPreferences>): void {
    if (Object.entries(patch).every(([key, value]) => this.preferences[key as keyof SessionPreferences] === value)) return;
    this.preferences = { ...this.preferences, ...patch };
    writeSessionPreferences(this.preferenceStorage(), this.preferences);
  }

  private store: CurrentSessionStore | undefined;
  private currentFile: CurrentSessionFile | undefined;
  private loadGeneration = 0;
  private saveTimer: ReturnType<typeof setTimeout> | undefined;
  private pendingTransport: SavedTransport | undefined;
  private pendingMixer: SavedMixer | undefined;
  private applyingRestore = false;

  private snapshot(): CurrentSessionState {
    const state = captureCurrentSessionState({ mode: this.mode(), scale: this.scale() }, this.transport(), this.mixer());
    return { ...state, transport: this.pendingTransport ?? state.transport, mixer: this.pendingMixer ?? state.mixer };
  }
  private scheduleSave(): void {
    if (this.applyingRestore || !this.currentFile || this.state().status !== 'ready'
      || !['stopped', 'paused', 'playing'].includes(this.transport().status) || !this.mixer().available) return;
    // Solo accorpamento I/O: nessun timer fa avanzare la posizione musicale.
    this.saveTimer ??= setTimeout(() => this.flushSave(), 500);
  }
  private flushSave(): void {
    clearTimeout(this.saveTimer); this.saveTimer = undefined;
    if (this.currentFile && !this.applyingRestore) void this.store?.update(this.currentFile.id, this.snapshot());
  }

  attach(host: HTMLElement): () => void {
    let factory: IDBFactory | undefined;
    try { factory = this.document.defaultView?.indexedDB; } catch { /* Storage bloccato. */ }
    const store = new CurrentSessionStore(factory);
    this.store = store;
    const adapter = new AlphaTabScoreAdapter(host, {
      fontDirectory: new URL('assets/alphatab/font/', this.document.baseURI).href,
      audio: {
        scriptFile: new URL('assets/alphatab/alphaTab.mjs', this.document.baseURI).href,
        soundFont: new URL('assets/alphatab/soundfont/sonivox.sf2', this.document.baseURI).href,
        scrollElement: host.closest<HTMLElement>('.score-scroll') ?? host,
      },
    });
    const controller = new ScoreController(adapter);
    const transport = new TransportController(adapter);
    this.transportController = transport;
    let restoreTransportPreferences = true;
    const unsubscribeTransport = transport.subscribe((state) => {
      this.transportSnapshot.set(state);
      if ((restoreTransportPreferences || this.pendingTransport) && state.status === 'stopped') {
        restoreTransportPreferences = false;
        const saved = this.pendingTransport;
        this.pendingTransport = undefined;
        this.applyingRestore = true;
        try {
          if (saved) restoreTransport(transport, saved);
          else transport.setSpeed(this.preferences.speed);
        } finally { this.applyingRestore = false; }
      } else if (['stopped', 'paused', 'playing'].includes(state.status)) {
        this.savePreferences({ speed: state.speed });
      }
      this.scheduleSave();
    });
    const mixer = new MixerController(adapter);
    this.mixerController = mixer;
    let restoreMixerPreferences = true;
    const unsubscribeMixer = mixer.subscribe((state) => {
      this.mixerSnapshot.set(state);
      if ((restoreMixerPreferences || this.pendingMixer) && state.available) {
        restoreMixerPreferences = false;
        const saved = this.pendingMixer;
        this.pendingMixer = undefined;
        this.applyingRestore = true;
        try {
          if (saved) restoreMixer(mixer, saved);
          else mixer.setMasterVolume(this.preferences.masterVolume);
        } finally { this.applyingRestore = false; }
      } else if (state.available) {
        this.savePreferences({ masterVolume: state.masterVolume });
      }
      this.scheduleSave();
    });
    this.adapter = adapter;
    this.controller = controller;
    const unsubscribe = controller.subscribe((state) => {
      if (state.status === 'loading') { adapter.reset(); this.viewError.set(null); }
      this.current.set(state);
    });
    this.available.set(true);
    const generation = this.loadGeneration;
    void store.read().then((saved) => {
      // Un'apertura esplicita o il detach prevalgono sul recupero asincrono.
      if (saved && this.controller === controller && this.loadGeneration === generation && this.state().status === 'idle') {
        void this.load({ name: saved.file.name, read: async () => saved.file.bytes }, saved.state);
      }
    });
    const flush = () => this.flushSave();
    const visibility = () => { if (this.document.visibilityState === 'hidden') flush(); };
    this.document.defaultView?.addEventListener('pagehide', flush);
    this.document.addEventListener('visibilitychange', visibility);
    return () => {
      flush(); this.loadGeneration++;
      this.currentFile = undefined; this.pendingTransport = undefined; this.pendingMixer = undefined;
      this.document.defaultView?.removeEventListener('pagehide', flush);
      this.document.removeEventListener('visibilitychange', visibility);
      store.close(); this.store = undefined;
      this.available.set(false);
      unsubscribe(); controller.dispose(); adapter.destroy();
      unsubscribeTransport(); transport.dispose(); this.transportController = undefined;
      unsubscribeMixer(); mixer.dispose(); this.mixerController = undefined;
      this.adapter = undefined; this.controller = undefined;
    };
  }

  play(): void { this.transportController?.play(); }
  pause(): void { this.transportController?.pause(); }
  stop(): void { this.transportController?.stop(); }
  seek(tick: number): void { this.transportController?.seek(tick); }
  setSpeed(speed: number): void {
    this.transportController?.setSpeed(speed);
    if (this.transport().error === null) this.savePreferences({ speed: this.transport().speed });
  }
  setLoopPoint(point: 'a' | 'b'): void { this.transportController?.setPoint(point); }
  toggleLoop(): void { this.transportController?.toggleLoop(); }
  toggleMute(index: number): void { this.mixerController?.toggleMute(index); }
  toggleSolo(index: number): void { this.mixerController?.toggleSolo(index); }
  setTrackVolume(index: number, volume: number): void { this.mixerController?.setVolume(index, volume); }
  setMasterVolume(volume: number): void {
    this.mixerController?.setMasterVolume(volume);
    if (this.mixer().error === null) this.savePreferences({ masterVolume: this.mixer().masterVolume });
  }

  async open(file: File): Promise<void> {
    await this.load({
      name: file.name,
      read: async () => {
        try { return new Uint8Array(await file.arrayBuffer()); }
        catch { throw new ScoreLoadError('read-failed'); }
      },
    });
  }

  private async load(source: ScoreSource, saved: CurrentSessionState | null = null): Promise<void> {
    const controller = this.controller;
    if (!controller || this.viewBusy() || this.state().status === 'loading') return;
    const generation = ++this.loadGeneration;
    this.flushSave(); this.currentFile = undefined;
    this.pendingTransport = saved?.transport;
    this.pendingMixer = saved?.mixer;
    let bytes: Uint8Array | undefined;
    const loaded = await controller.load({ name: source.name, read: async () => (bytes = await source.read()) });
    if (generation !== this.loadGeneration || this.controller !== controller) return;
    if (!loaded || !bytes) { this.pendingTransport = undefined; this.pendingMixer = undefined; return; }
    const view = saved?.view ?? this.preferences;
    if (this.mode() !== view.mode || this.scale() !== view.scale) await this.setView(view.mode, view.scale);
    if (generation !== this.loadGeneration || this.controller !== controller) return;
    // I byte originali sono distinti dalla copia consegnata dal core all'adapter.
    const file = { id: this.document.defaultView!.crypto.randomUUID(), name: source.name, bytes };
    this.currentFile = file;
    await this.store?.replace(file, this.snapshot());
    if (generation === this.loadGeneration) this.scheduleSave();
  }

  async setView(mode: ScoreViewMode, scale: number): Promise<void> {
    if (!this.adapter || this.state().status !== 'ready' || this.viewBusy()) return;
    this.viewBusy.set(true); this.viewError.set(null);
    try {
      await this.adapter.setView(mode, scale);
      this.mode.set(mode); this.scale.set(scale);
      this.savePreferences({ mode, scale });
      this.scheduleSave();
    } catch (error: unknown) {
      this.viewError.set(error instanceof ScoreLoadError ? error.code : 'render-failed');
    } finally { this.viewBusy.set(false); }
  }
}
