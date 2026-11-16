// Fixture sintetiche originali del progetto, nessun file GP upstream modificato.
import { writeFileSync } from 'node:fs';
import { exporter, importer, Settings } from '@coderline/alphatab/core';
const melody = (string) => ':1 ' + Array(32).fill(`0.${string}`).join(' | ');
const score = importer.ScoreLoader.loadAlphaTex('\\title "M4 mixer" \\tempo 120 . ' + melody(6));
for (const string of [4, 2]) score.addTrack(importer.ScoreLoader.loadAlphaTex('. ' + melody(string)).tracks[0]);
score.tracks.forEach((track, index) => {
  track.name = ['Low voice', 'Middle voice', 'High voice'][index];
  track.playbackInfo.primaryChannel = index * 2;
  track.playbackInfo.secondaryChannel = index * 2 + 1;
  track.playbackInfo.volume = 12;
  track.playbackInfo.program = 80;
});
score.finish(new Settings());
writeFileSync(new URL('../../../tests/fixtures/m4-mixer.gp', import.meta.url), new exporter.Gp7Exporter().export(score));
score.tracks[1].playbackInfo.primaryChannel = 0;
score.tracks[1].playbackInfo.secondaryChannel = 1;
writeFileSync(new URL('../../../tests/fixtures/m4-mixer-linked.gp', import.meta.url), new exporter.Gp7Exporter().export(score));
