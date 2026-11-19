import type { AlphaTabApi } from '@coderline/alphatab';
import { describe, expect, it, vi } from 'vitest';
import { readFretboard } from '../src/fretboard.js';

describe('proiezione fretboard', () => {
  it('usa il tick confermato e filtra le posizioni per traccia e rigo', () => {
    const guitar = { isStringed: true, tuning: [64, 59, 55, 50, 45, 40], capo: 2 };
    const bass = { isStringed: true, tuning: [43, 38, 33, 28], capo: 0 };
    const drums = { isStringed: false, isPercussion: true, tuning: [], capo: 0 };
    const beat = (staff: object, positions: [number, number][], isRest = false) => ({
      beat: {
        voice: { bar: { staff } }, isRest,
        notes: positions.map(([string, fret]) => ({ isStringed: true, string, fret })),
      },
    });
    const findBeat = vi.fn((_tracks: Set<number>, tick: number) => tick === 800
      ? { beatLookup: { highlightedBeats: [beat(guitar, [[1, 0], [2, 3]]), beat(guitar, [[2, 3], [3, 5]]), beat(bass, [[4, 7]])] } }
      : { beatLookup: { highlightedBeats: [beat(guitar, [], true)] } });
    const api = {
      score: { tracks: [guitar, bass, drums].map((staff, index) => ({ index, staves: [staff] })) },
      tickCache: { findBeat },
    } as unknown as AlphaTabApi;

    expect(readFretboard(api, 0, 800)).toEqual({
      tuning: guitar.tuning, capo: 2,
      positions: [{ string: 1, fret: 0 }, { string: 2, fret: 3 }, { string: 3, fret: 5 }],
    });
    expect(findBeat).toHaveBeenLastCalledWith(new Set([0]), 800);
    expect(readFretboard(api, 1, 800)).toEqual({
      tuning: bass.tuning, capo: 0, positions: [{ string: 4, fret: 7 }],
    });
    expect(readFretboard(api, 0, 900)?.positions).toEqual([]);
    expect(readFretboard(api, 2, 800)).toBeNull();
  });
});
