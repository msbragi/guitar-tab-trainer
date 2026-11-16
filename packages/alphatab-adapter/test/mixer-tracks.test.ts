import { describe, expect, it } from 'vitest';
import { importer } from '@coderline/alphatab/core';
import { describeMixerTracks } from '../src/mixer-tracks.js';

describe('gruppi di controllo del mixer alphaTab', () => {
  it('mantiene indipendenti tracce con canali distinti e normalizza il volume GP', () => {
    const tracks = [0,1,2].map((i) => {
      const track = importer.ScoreLoader.loadAlphaTex('. :4 0.6').tracks[0]!;
      track.index = i; track.playbackInfo.primaryChannel = i*2; track.playbackInfo.secondaryChannel = i*2+1;
      track.playbackInfo.volume = 12; return track;
    });
    expect(describeMixerTracks(tracks).map((t) => [t.defaultVolume, t.linkedTrackIndexes])).toEqual([[0.75,[0]],[0.75,[1]],[0.75,[2]]]);
    tracks[1]!.playbackInfo.primaryChannel = 1; tracks[2]!.playbackInfo.primaryChannel = 3;
    tracks[1]!.playbackInfo.volume = 8;
    expect(describeMixerTracks(tracks).map((t) => [t.defaultVolume, t.linkedTrackIndexes])).toEqual([[0.75,[0,1,2]],[0.75,[0,1,2]],[0.75,[0,1,2]]]);
    expect(tracks[1]!.playbackInfo.volume).toBe(8); // Il modello originale non viene riscritto.
  });
});
