import { importer } from '@coderline/alphatab/core';
import type { model } from '@coderline/alphatab/core';
import type { ScoreSummary } from '@guitar-practice/core';
import { ScoreLoadError } from '@guitar-practice/core';

export function parseScore(bytes: Uint8Array): { score: model.Score; summary: ScoreSummary } {
  try {
    const score = importer.ScoreLoader.loadScoreFromBytes(bytes.slice());
    if (score.tracks.length === 0 || score.masterBars.length === 0) {
      throw new ScoreLoadError('invalid-score');
    }
    const summary: ScoreSummary = {
      title: score.title,
      artist: score.artist,
      barCount: score.masterBars.length,
      tracks: score.tracks.map((track) => ({ index: track.index, name: track.name })),
    };
    return { score, summary };
  } catch {
    throw new ScoreLoadError('invalid-score');
  }
}
