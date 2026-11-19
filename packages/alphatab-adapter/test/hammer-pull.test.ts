import { readFileSync } from 'node:fs';
import type { AlphaTabApi } from '@coderline/alphatab';
import { importer, midi, model, Settings } from '@coderline/alphatab/core';
import { describe, expect, it } from 'vitest';
import { describeFretboardEffects } from '../src/fretboard-effects.js';
import { readFretboard } from '../src/fretboard.js';
import { hammerPullLinks } from '../src/hammer-pull.js';

describe('hammer-on e pull-off sul manico', () => {
  it('proietta gli archi dal GP e li mantiene sulla nota di destinazione', () => {
    const score = importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(
      readFileSync(new URL('../../../tests/fixtures/m4-gestures.gp', import.meta.url)),
    ));
    const settings = new Settings();
    const generator = new midi.MidiFileGenerator(score, settings, new midi.AlphaSynthMidiFileHandler(new midi.MidiFile()));
    generator.generate();
    const api = { score, settings, tickCache: generator.tickLookup } as unknown as AlphaTabApi;
    const at = (tick: number) => readFretboard(api, 0, tick)?.positions[0];
    expect(at(19200)?.gestures).toEqual([{ kind: 'hammer-on', sourceFret: 3, targetFret: 6, progress: 0 }]);
    expect(at(20160)?.gestures).toEqual([{ kind: 'hammer-on', sourceFret: 3, targetFret: 6, progress: 0.5 }]);
    expect(at(21120)?.fret).toBe(6);
    expect(at(21120)?.gestures).toEqual([{ kind: 'hammer-on', sourceFret: 3, targetFret: 6, progress: 1 }]);
    expect(at(23040)?.gestures).toEqual([{ kind: 'pull-off', sourceFret: 6, targetFret: 3, progress: 0 }]);
    expect(at(24960)?.gestures).toEqual([{ kind: 'pull-off', sourceFret: 6, targetFret: 3, progress: 1 }]);
    expect(at(19200)?.effects).toContainEqual({ kind: 'hammer-on', sourceFret: 3, targetFret: 6 });
  });
  it('distingue i collegamenti hammer/pull dalle legature di durata e dai target invalidi', () => {
    const origin = new model.Note();
    origin.string = 2; origin.fret = 3; origin.isHammerPullOrigin = true;
    const target = new model.Note();
    target.string = 2; target.fret = 7;
    origin.hammerPullDestination = target;
    expect(hammerPullLinks(origin)[0]).toMatchObject({ kind: 'hammer-on', sourceFret: 3, targetFret: 7 });
    target.string = 1;
    expect(hammerPullLinks(origin)).toEqual([]);
    origin.hammerPullDestination = null; origin.isHammerPullOrigin = false;
    origin.tieDestination = target;
    expect(origin.isTieOrigin).toBe(true);
    expect(describeFretboardEffects(origin, new model.Beat())).toEqual([]);
  });
});
