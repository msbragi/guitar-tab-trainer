import type { ScoreErrorCode } from './score-error.js';

/** Metadati applicativi: nessun oggetto del motore musicale attraversa il confine. */
export interface ScoreSummary {
  readonly title: string;
  readonly artist: string;
  readonly barCount: number;
  readonly tracks: readonly {
    readonly index: number;
    readonly name: string;
    readonly programs?: readonly number[];
  }[];
}

/** Il chiamante gestisce l'accesso al file; il core non conosce File o filesystem. */
export interface ScoreSource {
  readonly name: string;
  read(): Promise<Uint8Array>;
}

/** Risolve quando il documento è pronto per l'uso, incluso il rendering dell'host. */
export interface ScoreLoader {
  load(bytes: Uint8Array): Promise<ScoreSummary>;
}

export type ScoreState =
  | { readonly status: 'idle' }
  | { readonly status: 'loading'; readonly fileName: string }
  | { readonly status: 'ready'; readonly fileName: string; readonly score: ScoreSummary }
  | { readonly status: 'error'; readonly fileName: string; readonly code: ScoreErrorCode; readonly message: string };
