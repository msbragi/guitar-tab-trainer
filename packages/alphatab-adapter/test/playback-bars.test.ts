import { readFileSync } from 'node:fs';
import type { AlphaTabApi } from '@coderline/alphatab';
import { importer, midi, Settings } from '@coderline/alphatab/core';
import type { model } from '@coderline/alphatab/core';
import { describe, expect, it } from 'vitest';
import { readPlaybackBars } from '../src/playback-bars.js';

function apiFor(score: model.Score): AlphaTabApi {
  const generator = new midi.MidiFileGenerator(score, new Settings(), new midi.AlphaSynthMidiFileHandler(new midi.MidiFile()));
  generator.generate();
  return { score, tickCache: generator.tickLookup } as unknown as AlphaTabApi;
}

describe('occorrenze pubbliche alphaTab 1.9', () => {
  it('mantiene distinti i passaggi senza cambiare il modello musicale', () => {
    const score = importer.ScoreLoader.loadAlphaTex('\\tempo 90 . :1 0.6 | :1 1.6');
    score.masterBars[0]!.isRepeatStart = true;
    score.masterBars[1]!.repeatCount = 2;
    score.rebuildRepeatGroups();
    const bars = readPlaybackBars(apiFor(score));
    expect(bars.map(({ barIndex, occurrence }) => [barIndex, occurrence])).toEqual([[0, 1], [1, 1], [0, 2], [1, 2]]);
    expect(bars.map(({ startTick, endTick }) => [startTick, endTick])).toEqual([[0, 3840], [3840, 7680], [7680, 11520], [11520, 15360]]);
    expect(score.masterBars).toHaveLength(2);
    expect(bars[0]).toMatchObject({ tempo: 90, numerator: 4, denominator: 4 });
  });
  it('legge i cambi di tempo reali e i finali alternativi del corpus', () => {
    const load = (name: string) => apiFor(importer.ScoreLoader.loadScoreFromBytes(
      new Uint8Array(readFileSync(new URL('../../../tests/fixtures/' + name, import.meta.url))),
    ));
    const tempo = readPlaybackBars(load('m4-tempo.gp'));
    expect(tempo.map(({ tempo }) => tempo)).toEqual([120, 120, 60, 60]);
    const api = load('alphatab/repeat-close-alternate-endings.gp5');
    const bars = readPlaybackBars(api);
    expect(bars.length).toBeGreaterThan(api.score!.masterBars.length);
    expect(bars.some(({ occurrence }) => occurrence > 1)).toBe(true);
    for (let index = 1; index < bars.length; index++) expect(bars[index]!.startTick).toBe(bars[index - 1]!.endTick);
  });
  it('non inventa una mappa prima della preparazione audio', () => {
    expect(readPlaybackBars({ tickCache: null } as unknown as AlphaTabApi)).toEqual([]);
  });
});
