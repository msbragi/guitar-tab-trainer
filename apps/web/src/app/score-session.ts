import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { ScoreController, ScoreLoadError, TransportController, initialTransportState, MixerController, initialMixerState } from '@guitar-practice/core';
import type { ScoreErrorCode, ScoreState, TransportState, MixerState } from '@guitar-practice/core';
import { AlphaTabScoreAdapter } from '@guitar-practice/alphatab-adapter';
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

  attach(host: HTMLElement): () => void {
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
    const unsubscribeTransport = transport.subscribe((state) => this.transportSnapshot.set(state));
    const mixer = new MixerController(adapter);
    this.mixerController = mixer;
    const unsubscribeMixer = mixer.subscribe((state) => this.mixerSnapshot.set(state));
    this.adapter = adapter;
    this.controller = controller;
    const unsubscribe = controller.subscribe((state) => {
      if (state.status === 'loading') { adapter.reset(); this.viewError.set(null); }
      this.current.set(state);
    });
    this.available.set(true);
    return () => {
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
  setSpeed(speed: number): void { this.transportController?.setSpeed(speed); }
  setLoopPoint(point: 'a' | 'b'): void { this.transportController?.setPoint(point); }
  toggleLoop(): void { this.transportController?.toggleLoop(); }
  toggleMute(index: number): void { this.mixerController?.toggleMute(index); }
  toggleSolo(index: number): void { this.mixerController?.toggleSolo(index); }
  setTrackVolume(index: number, volume: number): void { this.mixerController?.setVolume(index, volume); }
  setMasterVolume(volume: number): void { this.mixerController?.setMasterVolume(volume); }

  async open(file: File): Promise<void> {
    if (this.viewBusy()) return;
    await this.controller?.load({
      name: file.name,
      read: async () => {
        try { return new Uint8Array(await file.arrayBuffer()); }
        catch { throw new ScoreLoadError('read-failed'); }
      },
    });
  }

  async setView(mode: ScoreViewMode, scale: number): Promise<void> {
    if (!this.adapter || this.state().status !== 'ready' || this.viewBusy()) return;
    this.viewBusy.set(true); this.viewError.set(null);
    try {
      await this.adapter.setView(mode, scale);
      this.mode.set(mode); this.scale.set(scale);
    } catch (error: unknown) {
      this.viewError.set(error instanceof ScoreLoadError ? error.code : 'render-failed');
    } finally { this.viewBusy.set(false); }
  }
}
