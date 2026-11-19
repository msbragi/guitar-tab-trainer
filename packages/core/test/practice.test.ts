import { describe, expect, it } from 'vitest';
import { practiceRange } from '../src/practice.js';
import type { PlaybackBar, PracticeSelection } from '../src/practice.js';
import { pickPracticeBar } from '../src/practice-flow.js';
import type { PracticeFlow } from '../src/practice-flow.js';

const bars: readonly PlaybackBar[] = [0, 1, 0, 2].map((barIndex, index) => ({
  barIndex, occurrence: index === 2 ? 2 : 1,
  startTick: [0, 3840, 6720, 10560][index]!, endTick: [3840, 6720, 10560, 14400][index]!,
  tempo: 120, numerator: index === 1 ? 3 : 4, denominator: 4,
}));
const selection: PracticeSelection = { trackIndex: 0, from: 2, to: 3, leadInBars: 1, preparation: 'context' };

describe('frase e punch-in/out', () => {
  it('guida i due click e mantiene la traccia identificata dall’inizio', () => {
    const idle: PracticeFlow = { phase: 'idle' };
    expect(pickPracticeBar(idle, { trackIndex: 2, barIndex: 5 })).toBe(idle);
    const start = pickPracticeBar({ phase: 'start' }, { trackIndex: 2, barIndex: 5 });
    expect(start).toEqual({ phase: 'end', trackIndex: 2, startBar: 5 });
    expect(pickPracticeBar(start, { trackIndex: 2, barIndex: 4 })).toBe(start);
    const end = pickPracticeBar(start, { trackIndex: 0, barIndex: 8 });
    expect(end).toEqual({ phase: 'configure', trackIndex: 2, startBar: 5, endBar: 8 });
    expect(pickPracticeBar(end, { trackIndex: 0, barIndex: 10 })).toBe(end);
    expect(pickPracticeBar({ phase: 'start' }, { trackIndex: -1, barIndex: 0 })).toEqual({ phase: 'start' });
  });
  it('consente contesto e countdown insieme o nessun countdown anche a inizio brano', () => {
    expect(practiceRange(bars, { ...selection, countIn: true })).toMatchObject({ playbackStartTick: 3840, countIn: true, leadInBars: 1 });
    expect(practiceRange(bars, { ...selection, from: 0, countIn: false })).toMatchObject({ playbackStartTick: 0, countIn: false });
  });
  it('seleziona la seconda occorrenza, con contesto separato e fine esclusiva', () => {
    expect(practiceRange(bars, selection)).toEqual({ playbackStartTick: 3840, startTick: 6720,
      endTick: 14400, leadInBars: 1, countIn: false });
    expect(practiceRange(bars, { ...selection, to: 2 })?.endTick).toBe(10560);
  });
  it('limita il contesto al brano e sceglie il conteggio quando non esistono battute prima', () => {
    expect(practiceRange(bars, { ...selection, leadInBars: 8 })).toMatchObject({ playbackStartTick: 0, leadInBars: 2, countIn: false });
    expect(practiceRange(bars, { ...selection, from: 0 })).toMatchObject({ playbackStartTick: 0, leadInBars: 0, countIn: true });
  });
  it('consente conteggio e partenza diretta anche a metà brano', () => {
    expect(practiceRange(bars, { ...selection, preparation: 'count-in' })).toMatchObject({ playbackStartTick: 6720, leadInBars: 0, countIn: true });
    expect(practiceRange(bars, { ...selection, preparation: 'none' })).toMatchObject({ playbackStartTick: 6720, leadInBars: 0, countIn: false });
  });
  it('rifiuta selezioni invertite, fuori brano, non intere o prive di contesto valido', () => {
    for (const patch of [{ from: -1 }, { from: 4 }, { to: 4 }, { to: 1 }, { leadInBars: -1 },
      { leadInBars: 0 }, { leadInBars: NaN }, { from: 0.5 }, { trackIndex: -1 }]) {
      expect(practiceRange(bars, { ...selection, ...patch })).toBeNull();
    }
    expect(practiceRange([], selection)).toBeNull();
  });
});
