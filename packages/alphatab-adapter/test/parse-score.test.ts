import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { parseScore } from '../src/parse-score.js';
import { corpus } from '../../../tests/fixtures/corpus.js';

describe('parser alphaTab pubblico 1.9.0', () => {
  for (const fixture of corpus) {
    it(`importa ${fixture.file} e conserva i byte originali`, () => {
      const file = new URL(`../../../tests/fixtures/alphatab/${fixture.file}`, import.meta.url);
      const bytes = new Uint8Array(readFileSync(file));
      const hash = () => createHash('sha256').update(bytes).digest('hex');
      expect(hash()).toBe(fixture.sha256);
      const { summary } = parseScore(bytes);
      expect(summary).toEqual({
        title: fixture.title, artist: '', barCount: fixture.bars,
        tracks: fixture.tracks.map((name, index) => ({ index, name })),
      });
      expect(hash()).toBe(fixture.sha256);
      expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(fixture.sha256);
    });
  }

  it.each([new Uint8Array(), new Uint8Array([0, 1, 2, 3])])('rifiuta input vuoti o non supportati', (bytes) => {
    expect(() => parseScore(bytes)).toThrow('invalid-score');
  });

  it('rifiuta un GP7 troncato', () => {
    const bytes = readFileSync(new URL('../../../tests/fixtures/alphatab/effects.gp', import.meta.url));
    expect(() => parseScore(bytes.subarray(0, 30))).toThrow('invalid-score');
  });
});
