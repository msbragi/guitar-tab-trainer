import { AlphaTabApi } from '@coderline/alphatab';
import type { ScoreLoader, ScoreSummary } from '@guitar-practice/core';
import { ScoreLoadError } from '@guitar-practice/core';
import { parseScore } from './parse-score.js';
import { applyScoreView } from './score-view.js';
import type { ScoreViewMode } from './view-mode.js';

export interface AlphaTabViewOptions {
  readonly fontDirectory: string;
}

/** Adapter browser. Nessuna dipendenza dal framework UI e nessun controllo playback. */
export class AlphaTabScoreAdapter implements ScoreLoader {
  private api: AlphaTabApi | undefined;
  private cancel: (() => void) | undefined;
  private destroyed = false;
  private generation = 0;
  private mode: ScoreViewMode = 'score-tab';
  private scale = 1;

  constructor(private readonly host: HTMLElement, private readonly options: AlphaTabViewOptions) {}

  async load(bytes: Uint8Array): Promise<ScoreSummary> {
    if (this.destroyed) throw new ScoreLoadError('session-closed');
    if (this.cancel) throw new ScoreLoadError('busy');
    this.reset();
    const generation = this.generation;
    const { score, summary } = parseScore(bytes);
    try {
      const api = new AlphaTabApi(this.host, {
        core: {
          fontDirectory: this.options.fontDirectory,
          useWorkers: false,
          enableLazyLoading: false,
        },
        player: { enablePlayer: false },
        display: { scale: this.scale },
      });
      this.api = api;
      applyScoreView(score, this.mode);
      await this.render(api, () => api.renderScore(score, score.tracks.map((track) => track.index)));
      return summary;
    } catch (error: unknown) {
      if (generation === this.generation) this.reset();
      throw error;
    }
  }

  /** Cambia soltanto la presentazione della copia in memoria, senza riscrivere il file. */
  async setView(mode: ScoreViewMode, scale: number): Promise<void> {
    if (this.destroyed) throw new ScoreLoadError('session-closed');
    if (this.cancel) throw new ScoreLoadError('busy');
    const api = this.api;
    if (!api?.score) return;
    this.mode = mode;
    this.scale = Math.max(0.5, Math.min(1.5, scale));
    applyScoreView(api.score, mode);
    api.settings.display.scale = this.scale;
    api.updateSettings();
    await this.render(api, () => api.render());
  }

  private render(api: AlphaTabApi, action: () => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timeout);
          api.postRenderFinished.off(done);
          api.error.off(failed);
          this.cancel = undefined;
        };
        const done = () => { cleanup(); resolve(); };
        const failed = () => { cleanup(); reject(new ScoreLoadError('render-failed')); };
        const timeout = setTimeout(() => {
          cleanup();
          reject(new ScoreLoadError('render-timeout'));
        }, 30_000);
        this.cancel = () => { cleanup(); reject(new ScoreLoadError('cancelled')); };
        api.postRenderFinished.on(done);
        api.error.on(failed);
        try {
          action();
        } catch {
          failed();
        }
      });
  }

  destroy(): void {
    this.destroyed = true;
    this.reset();
  }

  /** Rimuove la vista precedente anche se la lettura del prossimo file fallisce. */
  reset(): void {
    this.generation++;
    this.cancel?.();
    this.api?.destroy();
    this.api = undefined;
    this.host.replaceChildren();
  }
}
