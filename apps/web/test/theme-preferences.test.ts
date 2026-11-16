import { describe, expect, it } from 'vitest';
import { parseTheme, resolveTheme } from '../src/app/theme/theme-preferences.js';

describe('preferenza del tema', () => {
  it.each([null, undefined, '', 'invalid', 'SYSTEM'])('usa System per %j', (value) => {
    expect(parseTheme(value)).toBe('system');
  });
  it.each(['light', 'dark'] as const)('conserva una preferenza %s esplicita', (value) => {
    expect(parseTheme(value)).toBe(value);
  });
  it('segue il sistema soltanto in modalità System', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});
