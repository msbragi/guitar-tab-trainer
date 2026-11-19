import { readFileSync } from 'node:fs';
import type { AlphaTabApi } from '@coderline/alphatab';
import { importer, midi, model, Settings } from '@coderline/alphatab/core';
import { describe, expect, it } from 'vitest';
import { describeFretboardGestures } from '../src/fretboard-gestures.js';
import { readFretboard } from '../src/fretboard.js';

function apiFor(score: model.Score) {
  const settings = new Settings();
  const generator = new midi.MidiFileGenerator(score, settings, new midi.AlphaSynthMidiFileHandler(new midi.MidiFile()));
  generator.generate();
  return { score, settings, tickCache: generator.tickLookup } as unknown as AlphaTabApi;
}
const demo = () => apiFor(importer.ScoreLoader.loadScoreFromBytes(
  new Uint8Array(readFileSync(new URL('../../../tests/fixtures/m4-gestures.gp', import.meta.url))),
));
describe('anteprima dei gesti e avanzamento in tick', () => {
  it('mantiene visibile lo slide e lo fa avanzare nella seconda metà della nota', () => {
    const api = demo();
    expect(readFretboard(api, 0, 0)?.positions[0]?.gestures).toEqual([{ kind: 'slide', targetFret: 9, progress: 0 }]);
    expect(readFretboard(api, 0, 960)?.positions[0]?.gestures).toEqual([{ kind: 'slide', targetFret: 9, progress: 0 }]);
    expect(readFretboard(api, 0, 1440)?.positions[0]?.gestures).toEqual([{ kind: 'slide', targetFret: 9, progress: 0.5 }]);
    // Un seek inverso ripristina la stessa proiezione senza stato residuo.
    expect(readFretboard(api, 0, 0)?.positions[0]?.gestures?.[0]?.progress).toBe(0);
    expect(readFretboard(api, 0, 5280)?.positions[0]?.gestures).toEqual([{ kind: 'slide', targetFret: 5, progress: 0.5 }]);
  });
  it('conserva tutti gli offset del bending e del release, anche i tratti tenuti', () => {
    const api = demo();
    const start = readFretboard(api, 0, 7680)?.positions[0]?.gestures?.[0];
    const halfway = readFretboard(api, 0, 9600)?.positions[0]?.gestures?.[0];
    expect(start?.kind).toBe('bend');
    expect(start?.progress).toBe(0);
    expect(halfway?.progress).toBe(0.5);
    if (start?.kind === 'bend') {
      expect(start.points[0]).toEqual({ offset: 0, tones: 0 });
      expect(start.points.at(-1)).toEqual({ offset: 1, tones: 0 });
      expect(start.points.filter(({ tones }) => tones === 1).length).toBeGreaterThanOrEqual(2);
    }
    expect(readFretboard(api, 0, 15500)?.positions).toEqual([]);
  });
  it('calcola la posizione relativa nell’occorrenza corretta di una ripetizione', () => {
    const api = apiFor(importer.ScoreLoader.loadAlphaTex('\\tempo 60 . \\ro :2 5.3{ss} 9.3 | :1 r \\rc 2'));
    const bars = api.tickCache!.masterBars;
    const repeated = bars.find((bar, index) => index > 0 && bar.masterBar.index === 0)!;
    expect(repeated).toBeDefined();
    expect(readFretboard(api, 0, repeated.start + 1440)?.positions[0]?.gestures)
      .toEqual(readFretboard(api, 0, 1440)?.positions[0]?.gestures);
  });
  it('ignora durate invalide e slide privi di una destinazione senza inventare tasti', () => {
    const note = new model.Note();
    note.string = 1; note.fret = 5; note.slideOutType = model.SlideOutType.OutUp;
    expect(describeFretboardGestures(note, 100, 960, 0.5)).toEqual([]);
    expect(describeFretboardGestures(note, 0, 0, 0.5)).toEqual([]);
    expect(describeFretboardGestures(note, NaN, 960, 0.5)).toEqual([]);
  });
});
