export type ThemePreference = 'system' | 'light' | 'dark';
export const THEME_STORAGE_KEY = 'guitar-tab-trainer.theme';

export function parseTheme(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system';
}

export function resolveTheme(preference: ThemePreference, systemDark: boolean): 'light' | 'dark' {
  return preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
}
