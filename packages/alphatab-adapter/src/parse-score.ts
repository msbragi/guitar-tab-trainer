import { importer, model } from '@coderline/alphatab/core';
import type { ScoreSummary } from '@guitar-practice/core';
import { ScoreLoadError } from '@guitar-practice/core';

function extractTrackPrograms(track: model.Track): number[] {
  if (track.playbackInfo.primaryChannel === 9 || track.staves.every((staff) => staff.isPercussion)) {
    return [];
  }
  const programs = new Set<number>();
  if (Number.isInteger(track.playbackInfo.program) && track.playbackInfo.program >= 0 && track.playbackInfo.program <= 127) {
    programs.add(track.playbackInfo.program);
  }
  for (const staff of track.staves) {
    for (const bar of staff.bars) {
      for (const voice of bar.voices) {
        for (const beat of voice.beats) {
          for (const automation of beat.automations) {
            if (automation.type === model.AutomationType.Instrument) {
              const prog = Math.round(automation.value);
              if (prog >= 0 && prog <= 127) programs.add(prog);
            }
          }
        }
      }
    }
  }
  return [...programs].sort((a, b) => a - b);
}

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
      tracks: score.tracks.map((track) => {
        const programs = extractTrackPrograms(track);
        return programs.length ? { index: track.index, name: track.name, programs } : { index: track.index, name: track.name };
      }),
    };
    return { score, summary };
  } catch {
    throw new ScoreLoadError('invalid-score');
  }
}
