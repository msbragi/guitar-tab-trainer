import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SCORE_ERROR_CODES } from '../../../packages/core/src/index.js';

function catalogue(language: string) {
  return JSON.parse(readFileSync(new URL(`../public/i18n/${language}.json`, import.meta.url), 'utf8'));
}

function flatten(value: Record<string, unknown>, prefix = ''): Record<string, string> {
  return Object.assign({}, ...Object.entries(value).map(([key, item]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof item === 'string') return { [path]: item };
    return flatten(item as Record<string, unknown>, path);
  }));
}

describe('cataloghi locali EN/IT', () => {
  const en = flatten(catalogue('en'));
  const itCatalogue = flatten(catalogue('it'));

  it('mantiene le stesse chiavi non vuote e gli stessi parametri in entrambe le lingue', () => {
    expect(Object.keys(itCatalogue).sort()).toEqual(Object.keys(en).sort());
    for (const key of Object.keys(en)) {
      expect(itCatalogue[key]?.trim(), key).toBeTruthy();
      expect(en[key]?.trim(), key).toBeTruthy();
      const parameters = (text: string) => text.match(/\{\{\w+\}\}/g)?.sort() ?? [];
      expect(parameters(itCatalogue[key]!), key).toEqual(parameters(en[key]!));
    }
  });

  it('traduce tutti i codici di errore del dominio', () => {
    for (const code of SCORE_ERROR_CODES) {
      expect(en[`errors.${code}`], code).toBeTruthy();
      expect(itCatalogue[`errors.${code}`], code).toBeTruthy();
    }
  });
});
