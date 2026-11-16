// Fixture originale del progetto, generata soltanto su richiesta esplicita.
import { writeFileSync } from 'node:fs';
import { exporter, importer, model } from '@coderline/alphatab/core';

const score = importer.ScoreLoader.loadAlphaTex(
  '\\title "M4 tempo changes" \\tempo 120 . :4 0.6 1.6 2.6 3.6 | 0.6 1.6 2.6 3.6 | 0.6 1.6 2.6 3.6 | 0.6 1.6 2.6 3.6',
);
score.masterBars[2].tempoAutomations = [model.Automation.buildTempoAutomation(false, 0, 60, 2)];
writeFileSync(new URL('../../../tests/fixtures/m4-tempo.gp', import.meta.url), new exporter.Gp7Exporter().export(score));
