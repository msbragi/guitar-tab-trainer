import { describe, expect, it } from 'vitest';
import type { FretboardFrame } from '@guitar-practice/alphatab-adapter';
import { drawFretboardGestures } from '../src/app/viewer/fretboard/gesture-drawing.js';

const frame = (): FretboardFrame => ({
  tuning: [64, 59, 55, 50, 45, 40], capo: 2,
  positions: [{ string: 3, fret: 5, gestures: [{ kind: 'slide', targetFret: 9, progress: 0.5 }] }],
});
describe('disegno dei gesti sul manico', () => {
  it('allinea partenza, destinazione e avanzamento ai tasti e alla corda', () => {
    const [drawing] = drawFretboardGestures(frame());
    expect(drawing?.path).toBe('M 208 107 L 336 107');
    expect(drawing?.cursor).toEqual({ x: 272, y: 107 });
    expect(drawing?.target).toEqual({ x: 336, y: 107, fret: 9, pitch: 61 });
    expect(drawFretboardGestures(frame())).toEqual(drawFretboardGestures(frame()));
  });
  it('mostra la curva intera da fermo e ne percorre salita, tenuta e ritorno', () => {
    const sample = frame();
    const points = [{ offset: 0, tones: 0 }, { offset: 0.25, tones: 1 }, { offset: 0.75, tones: 1 }, { offset: 1, tones: 0 }];
    const render = (progress: number) => drawFretboardGestures({
      ...sample, positions: [{ string: 3, fret: 5, gestures: [{ kind: 'bend', points, progress }] }],
    })[0]!;
    const start = render(0);
    const rise = render(0.25);
    const hold = render(0.5);
    const release = render(0.875);
    const end = render(1);
    expect(start.path).toBe(end.path);
    expect(rise.cursor.y).toBe(99);
    expect(hold.cursor.y).toBe(99);
    expect(release.cursor.y).toBe(103);
    expect(end.cursor.y).toBe(start.cursor.y);
    expect(end.playedPath).toBe(end.path);
    expect(end.target).toBeNull();
  });
  it('disegna un arco H/P e ne conserva la geometria sulla nota di arrivo', () => {
    const sample = frame();
    const render = (fret: number, progress: number) => drawFretboardGestures({
      ...sample, positions: [{ string: 3, fret, gestures: [{ kind: 'hammer-on', sourceFret: 5, targetFret: 9, progress }] }],
    })[0]!;
    const start = render(5, 0);
    const middle = render(5, 0.5);
    const arrived = render(9, 1);
    expect(start.path).toBe('M 208 107 Q 272 95 336 107');
    expect(middle.cursor).toEqual({ x: 272, y: 101 });
    expect(arrived.path).toBe(start.path);
    expect(arrived.cursor).toEqual({ x: 336, y: 107 });
    expect(arrived.source?.fret).toBe(5);
  });

  it('non aggiunge disegni quando non ci sono gesti', () => {
    expect(drawFretboardGestures(null)).toEqual([]);
    expect(drawFretboardGestures({ tuning: [], capo: 0, positions: [] })).toEqual([]);
  });
});
