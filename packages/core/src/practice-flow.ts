export interface PracticeBarPick {
  readonly trackIndex: number;
  readonly barIndex: number;
}

export type PracticeFlow =
  | { readonly phase: 'idle' | 'start' }
  | { readonly phase: 'end'; readonly trackIndex: number; readonly startBar: number }
  | { readonly phase: 'configure' | 'active'; readonly trackIndex: number; readonly startBar: number; readonly endBar: number };

/** End clicks select a bar boundary; the start click identifies the part to practise. */
export function pickPracticeBar(flow: PracticeFlow, pick: PracticeBarPick): PracticeFlow {
  if (![pick.trackIndex, pick.barIndex].every((value) => Number.isInteger(value) && value >= 0)) return flow;
  if (flow.phase === 'start') return { phase: 'end', trackIndex: pick.trackIndex, startBar: pick.barIndex };
  if (flow.phase === 'end' && pick.barIndex >= flow.startBar) {
    return { ...flow, phase: 'configure', endBar: pick.barIndex };
  }
  return flow;
}
