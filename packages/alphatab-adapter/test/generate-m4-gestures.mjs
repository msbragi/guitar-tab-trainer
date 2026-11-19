// Dimostrazione originale GTT. Rigenerazione volontaria dalla root.
import { writeFileSync } from 'node:fs';
import { exporter, importer } from '@coderline/alphatab/core';

const score = importer.ScoreLoader.loadAlphaTex(
  '\\title "GTT fretboard gestures" \\tempo 60 . :2 5.3{ss} 9.3 | :2 9.3{sl} 5.3 | :1 7.3{b (0 4 4 0)} | :1 7.3{b (4 4 0)} | :1 r | :2 3.3{h} 6.3 | :2 6.3{h} 3.3',
);
writeFileSync(new URL('../../../tests/fixtures/m4-gestures.gp', import.meta.url), new exporter.Gp7Exporter().export(score));
