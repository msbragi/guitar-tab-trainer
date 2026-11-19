import { model } from '@coderline/alphatab/core';
import { describe, expect, it } from 'vitest';
import { describeFretboardEffects } from '../src/fretboard-effects.js';

describe('effetti delle note sulla fretboard', () => {
  it('converte i quarti di tono e conserva prebend, salita e release', () => {
    const note = new model.Note();
    note.bendPoints = [new model.BendPoint(0, 2), new model.BendPoint(20, 4),
      new model.BendPoint(40, 4), new model.BendPoint(60, 0)];
    expect(describeFretboardEffects(note, new model.Beat())).toEqual([{ kind: 'bend', tones: [0.5, 1, 0] }]);
  });

  it('riconosce vibrato della nota e del beat e mantiene effetti simultanei', () => {
    const note = new model.Note();
    const beat = new model.Beat();
    expect(describeFretboardEffects(note, beat)).toEqual([]);
    beat.vibrato = model.VibratoType.Slight;
    note.vibrato = model.VibratoType.Wide;
    note.slideInType = model.SlideInType.IntoFromAbove;
    expect(describeFretboardEffects(note, beat)).toEqual([
      { kind: 'vibrato', wide: true },
      { kind: 'slide', phase: 'in', direction: 'down', legato: false, pick: false },
    ]);
    note.vibrato = model.VibratoType.None;
    expect(describeFretboardEffects(note, beat)[0]).toEqual({ kind: 'vibrato', wide: false });
  });

  it('mostra la destinazione degli slide quando appartiene alla stessa corda', () => {
    const note = new model.Note();
    note.string = 2; note.fret = 5; note.slideOutType = model.SlideOutType.Legato;
    const target = new model.Note();
    target.string = 2; target.fret = 9;
    note.slideTarget = target;
    expect(describeFretboardEffects(note, new model.Beat())).toEqual([
      { kind: 'slide', phase: 'out', direction: 'up', targetFret: 9, legato: true, pick: false },
    ]);
    target.string = 3;
    expect(describeFretboardEffects(note, new model.Beat())[0]).toMatchObject({ direction: 'unknown', targetFret: undefined });
    note.slideOutType = model.SlideOutType.PickSlideDown;
    note.slideTarget = null;
    expect(describeFretboardEffects(note, new model.Beat())[0]).toMatchObject({ direction: 'down', pick: true });
  });
});
