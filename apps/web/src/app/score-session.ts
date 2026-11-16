import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { ScoreController, ScoreLoadError } from '@guitar-practice/core';
import type { ScoreErrorCode, ScoreState } from '@guitar-practice/core';
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
  private adapter: AlphaTabScoreAdapter | undefined;
  private controller: ScoreController | undefined;

  attach(host: HTMLElement): () => void {
    const adapter = new AlphaTabScoreAdapter(host, {
      fontDirectory: new URL('assets/alphatab/font/', this.document.baseURI).href,
    });
    const controller = new ScoreController(adapter);
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
      this.adapter = undefined; this.controller = undefined;
    };
  }

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
