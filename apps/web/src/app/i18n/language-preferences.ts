export type Language = 'en' | 'it';
export const LANGUAGE_STORAGE_KEY = 'guitar-practice.language';

export function isLanguage(value: unknown): value is Language {
  return value === 'en' || value === 'it';
}

/** Una preferenza esplicita prevale sulle lingue del browser, in ordine. */
export function initialLanguage(saved: unknown, browserLanguages: readonly string[]): Language {
  if (isLanguage(saved)) return saved;
  for (const locale of browserLanguages) {
    const language = locale.toLowerCase().split('-')[0];
    if (isLanguage(language)) return language;
  }
  return 'en';
}

export function readPreference(storage: Pick<Storage, 'getItem'> | undefined): string | null {
  try { return storage?.getItem(LANGUAGE_STORAGE_KEY) ?? null; }
  catch { return null; }
}

export function savePreference(storage: Pick<Storage, 'setItem'> | undefined, language: Language): void {
  try { storage?.setItem(LANGUAGE_STORAGE_KEY, language); }
  catch { /* Storage bloccato o pieno: il cambio resta valido per questa sessione. */ }
}
