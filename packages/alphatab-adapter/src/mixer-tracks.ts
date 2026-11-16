import type { model } from '@coderline/alphatab/core';
import type { MixerTrackDefinition } from '@guitar-practice/core';

/** I canali rimangono nell'adapter; il core riceve soltanto gli indici collegati. */
export function describeMixerTracks(tracks: readonly model.Track[]): readonly MixerTrackDefinition[] {
  const channels = tracks.map((track) => new Set([track.playbackInfo.primaryChannel, track.playbackInfo.secondaryChannel]));
  return tracks.map((track, index) => {
    const group = new Set([index]);
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < tracks.length; i++) {
        if (!group.has(i) && [...group].some((member) => [...channels[member]!].some((channel) => channels[i]!.has(channel)))) {
          group.add(i); changed = true;
        }
      }
    }
    const members = [...group].sort((a, b) => a - b);
    return { index: track.index, name: track.name,
      defaultVolume: Math.max(0, Math.min(1, tracks[members[0]!]!.playbackInfo.volume / 16)),
      linkedTrackIndexes: members.map((member) => tracks[member]!.index) };
  });
}
