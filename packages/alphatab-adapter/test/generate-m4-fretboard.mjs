// Fixture originale: due tracce con posizioni e accordature distinte.
import { writeFileSync } from 'node:fs';
import { exporter, importer } from '@coderline/alphatab/core';

const score = importer.ScoreLoader.loadAlphaTex(
  '\\track "Guitar" . :4 0.6 1.6 2.6 3.6 \\track "Bass" \\tuning G2 D2 A1 E1 . :4 7.4 8.4 9.4 10.4',
);
writeFileSync(new URL('../../../tests/fixtures/m4-fretboard.gp', import.meta.url), new exporter.Gp7Exporter().export(score));
