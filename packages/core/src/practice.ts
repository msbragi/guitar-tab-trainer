/** One occurrence in playback order; barIndex identifies the written bar. */
export interface PlaybackBar {
  readonly barIndex: number;
  readonly occurrence: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly tempo: number;
  readonly numerator: number;
  readonly denominator: number;
}

/** Indices refer to playback occurrences, with both selected bars included. */
export interface PracticeSelection {
  readonly trackIndex: number;
  readonly from: number;
  readonly to: number;
  readonly leadInBars: number;
  readonly preparation: 'context' | 'count-in' | 'none';
  /** Explicit choice permits context and count-in together; absent keeps automatic fallback. */
  readonly countIn?: boolean;
}

export interface PracticeRange {
  readonly playbackStartTick: number;
  readonly startTick: number;
  readonly endTick: number;
  readonly leadInBars: number;
  readonly countIn: boolean;
}

export function practiceRange(bars: readonly PlaybackBar[], selection: PracticeSelection): PracticeRange | null {
  const { from, to, leadInBars, trackIndex } = selection;
  if (![from, to, leadInBars, trackIndex].every(Number.isInteger)
    || from < 0 || to < from || to >= bars.length || leadInBars < 0 || trackIndex < 0
    || !['context', 'count-in', 'none'].includes(selection.preparation)
    || (selection.preparation === 'context' && leadInBars < 1)) return null;
  const first = bars[from]!;
  const last = bars[to]!;
  const context = selection.preparation === 'context';
  const playbackFrom = context ? Math.max(0, from - leadInBars) : from;
  return { playbackStartTick: bars[playbackFrom]!.startTick, startTick: first.startTick,
    endTick: last.endTick, leadInBars: from - playbackFrom,
    countIn: selection.countIn ?? (selection.preparation === 'count-in' || (context && from === 0)) };
}
