import type { ScoreLoader, ScoreSource, ScoreState } from './score.js';
import { ScoreLoadError } from './score-error.js';

export class ScoreController {
  private current: ScoreState = { status: 'idle' };
  private readonly listeners = new Set<(state: ScoreState) => void>();
  private disposed = false;

  constructor(private readonly loader: ScoreLoader) {}

  get state(): ScoreState {
    return this.current;
  }

  subscribe(listener: (state: ScoreState) => void): () => void {
    if (this.disposed) throw new ScoreLoadError('session-closed');
    this.listeners.add(listener);
    listener(this.current);
    return () => { this.listeners.delete(listener); };
  }

  /** Le richieste durante un caricamento vengono ignorate: una sola operazione per sessione. */
  async load(source: ScoreSource): Promise<boolean> {
    if (this.disposed || this.current.status === 'loading') return false;
    this.publish({ status: 'loading', fileName: source.name });
    try {
      const bytes = await source.read();
      if (this.disposed) return false;
      if (bytes.length === 0) throw new ScoreLoadError('empty-file');
      // Il motore riceve una copia: i byte originali restano di proprietà del chiamante.
      const score = await this.loader.load(bytes.slice());
      if (this.disposed) return false;
      this.publish({ status: 'ready', fileName: source.name, score });
      return true;
    } catch (error: unknown) {
      if (!this.disposed) {
        this.publish({
          status: 'error',
          fileName: source.name,
          code: error instanceof ScoreLoadError ? error.code : 'load-failed',
          // Diagnostica originale, non testo da presentare direttamente all'utente.
          message: error instanceof Error ? error.message : 'load-failed',
        });
      }
      return false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.listeners.clear();
  }

  private publish(state: ScoreState): void {
    this.current = Object.freeze(state);
    this.listeners.forEach((listener) => listener(this.current));
  }
}
