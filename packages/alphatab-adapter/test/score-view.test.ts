import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { model } from '@coderline/alphatab/core';
import { parseScore } from '../src/parse-score.js';
import { applyScoreView } from '../src/score-view.js';

describe('visibilità dello spartito tramite proprietà pubbliche Staff', () => {
  it('passa tra tre modalità senza modificare le note o i byte originali', () => {
    const bytes = new Uint8Array(readFileSync(new URL('../../../tests/fixtures/alphatab/notes.gp3', import.meta.url)));
    const original = bytes.slice();
    const { score } = parseScore(bytes);
    const staff = score.tracks[0]!.staves[0]!;
    const bars = staff.bars;
    applyScoreView(score, 'tab');
    expect(staff.showStandardNotation).toBe(false);
    expect(staff.showTablature).toBe(true);
    applyScoreView(score, 'notation');
    expect(staff.showStandardNotation).toBe(true);
    expect(staff.showTablature).toBe(false);
    applyScoreView(score, 'score-tab');
    expect(staff.showStandardNotation).toBe(true);
    expect(staff.showTablature).toBe(true);
    expect(staff.bars).toBe(bars);
    expect(bytes).toEqual(original);
  });

  it('mantiene leggibile la notazione di una traccia senza corde in modalità Tab Only', () => {
    const score = new model.Score();
    const track = new model.Track();
    const staff = new model.Staff();
    score.addTrack(track); track.addStaff(staff);
    applyScoreView(score, 'tab');
    expect(staff.showTablature).toBe(false);
    expect(staff.showStandardNotation).toBe(true);
  });
});
