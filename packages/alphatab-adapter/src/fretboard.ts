import type { AlphaTabApi } from '@coderline/alphatab';

import { describeFretboardGestures } from './fretboard-gestures.js';
import { describeFretboardEffects } from './fretboard-effects.js';
import type { FretboardFrame, FretboardPosition } from './fretboard-frame.js';

/** Proietta il tempo confermato dal player senza introdurre stato o clock propri. */
export function readFretboard(api: AlphaTabApi, trackIndex: number, tick: number): FretboardFrame | null {
  const track = api.score?.tracks.find((track) => track.index === trackIndex);
  const staff = track?.staves.find((staff) => staff.isStringed && !staff.isPercussion);
  if (!staff) return null;
  const lookup = api.tickCache?.findBeat(new Set([trackIndex]), tick);
  const positions: FretboardPosition[] = [];
  for (const { beat, playbackStart } of lookup?.beatLookup.highlightedBeats ?? []) {
    if (beat.voice.bar.staff !== staff || beat.isRest) continue;
    for (const note of beat.notes) {
      if (!note.isStringed || note.string < 1 || note.string > staff.tuning.length || note.fret < 0) continue;
      const startTick = (lookup?.masterBar?.start ?? 0) + playbackStart;
      const gestures = describeFretboardGestures(note, tick - startTick, beat.playbackDuration,
        api.settings?.player.slide.shiftSlideDurationRatio ?? 0.5);
      const effects = describeFretboardEffects(note, beat);
      const index = positions.findIndex(({ string, fret }) => string === note.string && fret === note.fret);
      if (index < 0) {
        positions.push({ string: note.string, fret: note.fret, ...(effects.length ? { effects } : {}), ...(gestures.length ? { gestures } : {}) });
      } else if (effects.length) {
        const previous = positions[index]!;
        const combined = [...(previous.effects ?? [])];
        for (const effect of effects) {
          if (!combined.some((item) => JSON.stringify(item) === JSON.stringify(effect))) combined.push(effect);
        }
        positions[index] = { ...previous, effects: combined,
          ...(gestures.length ? { gestures: [...(previous.gestures ?? []), ...gestures] } : {}) };
      }
    }
  }
  return { tuning: [...staff.tuning], capo: staff.capo, positions };
}
