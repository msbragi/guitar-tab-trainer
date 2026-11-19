import type { AlphaTabApi } from '@coderline/alphatab';
import type { PlaybackBar } from '@guitar-practice/core';

/** Copy only public timing data; repeated written bars remain distinct. */
export function readPlaybackBars(api: AlphaTabApi): readonly PlaybackBar[] {
  const counts = new Map<number, number>();
  return (api.tickCache?.masterBars ?? []).map(({ masterBar, start, end, tempoChanges }) => {
    const occurrence = (counts.get(masterBar.index) ?? 0) + 1;
    counts.set(masterBar.index, occurrence);
    return Object.freeze({ barIndex: masterBar.index, occurrence, startTick: start, endTick: end,
      tempo: tempoChanges[0]?.tempo ?? api.score?.tempo ?? 120,
      numerator: masterBar.timeSignatureNumerator, denominator: masterBar.timeSignatureDenominator });
  });
}
