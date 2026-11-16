import { AlphaTabApi } from '@coderline/alphatab';
import type { ScoreLoader, ScoreSummary } from '@guitar-practice/core';
import { ScoreLoadError } from '@guitar-practice/core';
import { parseScore } from './parse-score.js';

export interface AlphaTabViewOptions {
  readonly fontDirectory: string;
}

/** Adapter browser. Nessuna dipendenza dal framework UI e nessun controllo playback. */
export class AlphaTabScoreAdapter implements ScoreLoader {
  private api: AlphaTabApi | undefined;
  private cancel: (() => void) | undefined;
  private destroyed = false;
  private generation = 0;

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
      });
      this.api = api;
      await new Promise<void>((resolve, reject) => {
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
          // Tutte le tracce, senza modificare la configurazione del file originale.
          api.renderScore(score, score.tracks.map((track) => track.index));
        } catch {
          failed();
        }
      });
      return summary;
    } catch (error: unknown) {
      if (generation === this.generation) this.reset();
      throw error;
    }
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
