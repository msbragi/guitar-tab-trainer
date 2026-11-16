/** Codici di dominio: la presentazione dei messaggi appartiene all'host. */
export const SCORE_ERROR_CODES = [
  'empty-file', 'invalid-score', 'render-failed', 'render-timeout',
  'cancelled', 'session-closed', 'busy', 'read-failed', 'load-failed',
] as const;

export type ScoreErrorCode = typeof SCORE_ERROR_CODES[number];

export class ScoreLoadError extends Error {
  constructor(readonly code: ScoreErrorCode) {
    super(code);
    this.name = 'ScoreLoadError';
  }
}
