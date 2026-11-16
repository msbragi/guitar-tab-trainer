import { describe, expect, it, vi } from 'vitest';
import { initialLanguage, LANGUAGE_STORAGE_KEY, readPreference, savePreference } from '../src/app/i18n/language-preferences.js';

describe('preferenza lingua della UI', () => {
  it.each([
    ['en', ['it-IT'], 'en'],
    ['it', ['en-US'], 'it'],
    [null, ['it-IT', 'en-US'], 'it'],
    [null, ['en-GB', 'it-IT'], 'en'],
    [null, ['fr-FR', 'it-CH'], 'it'],
    [null, ['IT-it'], 'it'],
    ['invalid', ['it-IT'], 'it'],
    ['fr', ['fr-FR'], 'en'],
    [null, [], 'en'],
  ])('sceglie %j con browser %j: %s', (saved, browser, expected) => {
    expect(initialLanguage(saved, browser as string[])).toBe(expected);
  });

  it('legge e salva soltanto la preferenza dell’app', () => {
    const getItem = vi.fn(() => 'it');
    const setItem = vi.fn();
    expect(readPreference({ getItem })).toBe('it');
    savePreference({ setItem }, 'en');
    expect(getItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY);
    expect(setItem).toHaveBeenCalledWith(LANGUAGE_STORAGE_KEY, 'en');
  });

  it('tollera storage assente o bloccato', () => {
    expect(readPreference(undefined)).toBeNull();
    expect(readPreference({ getItem: () => { throw new Error('denied'); } })).toBeNull();
    expect(() => savePreference(undefined, 'en')).not.toThrow();
    expect(() => savePreference({ setItem: () => { throw new Error('quota'); } }, 'it')).not.toThrow();
  });
});
