import type { ScoreViewMode } from '@guitar-practice/alphatab-adapter';

export interface SessionPreferences {
  readonly mode: ScoreViewMode;
  readonly scale: number;
  readonly speed: number;
  readonly masterVolume: number;
}
export const sessionPreferencesKey = 'guitar-practice.session-preferences.v1';
export const defaultSessionPreferences: SessionPreferences = {
  mode: 'score-tab', scale: 1, speed: 1, masterVolume: 1,
};

/** Preferenze della UI web: nessun file o oggetto alphaTab nello storage. */
export function readSessionPreferences(storage: Pick<Storage, 'getItem'> | undefined): SessionPreferences {
  try {
    const value: unknown = JSON.parse(storage?.getItem(sessionPreferencesKey) ?? 'null');
    if (!value || typeof value !== 'object') return defaultSessionPreferences;
    const data = value as Record<string, unknown>;
    return {
      mode: ['score-tab', 'tab', 'notation'].includes(String(data['mode'])) ? data['mode'] as ScoreViewMode : 'score-tab',
      scale: typeof data['scale'] === 'number' && [0.75, 1, 1.25, 1.5].includes(data['scale']) ? data['scale'] : 1,
      speed: typeof data['speed'] === 'number' && [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].includes(data['speed']) ? data['speed'] : 1,
      masterVolume: typeof data['masterVolume'] === 'number' && Number.isFinite(data['masterVolume'])
        && data['masterVolume'] >= 0 && data['masterVolume'] <= 1 ? data['masterVolume'] : 1,
    };
  } catch { return defaultSessionPreferences; }
}
export function writeSessionPreferences(storage: Pick<Storage, 'setItem'> | undefined, value: SessionPreferences): void {
  try { storage?.setItem(sessionPreferencesKey, JSON.stringify(value)); } catch { /* Lo storage non blocca la sessione. */ }
}
