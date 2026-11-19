import { describe, expect, it } from 'vitest';
import { defaultSessionPreferences, readSessionPreferences, writeSessionPreferences } from '../src/app/session-preferences.js';

describe('preferenze sessione web', () => {
  it('ripristina soltanto valori supportati', () => {
    const value = { mode: 'tab', scale: 1.25, speed: 0.5, masterVolume: 0.42 } as const;
    let stored = '';
    writeSessionPreferences({ setItem: (_key, data) => { stored = data; } }, value);
    expect(readSessionPreferences({ getItem: () => stored })).toEqual(value);
    expect(readSessionPreferences({ getItem: () => JSON.stringify({ mode: 'bad', scale: 90, speed: -1, masterVolume: 2 }) })).toEqual(defaultSessionPreferences);
  });
  it('gestisce JSON corrotti e storage bloccato o assente', () => {
    for (const json of ['{', 'null', '[]', 'false']) expect(readSessionPreferences({ getItem: () => json })).toEqual(defaultSessionPreferences);
    expect(readSessionPreferences(undefined)).toEqual(defaultSessionPreferences);
    expect(readSessionPreferences({ getItem: () => { throw Error('blocked'); } })).toEqual(defaultSessionPreferences);
    expect(() => writeSessionPreferences({ setItem: () => { throw Error('quota'); } }, defaultSessionPreferences)).not.toThrow();
  });
});
