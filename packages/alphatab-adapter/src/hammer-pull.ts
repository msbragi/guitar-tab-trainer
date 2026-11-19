import type { model } from '@coderline/alphatab/core';

interface HammerPullLink {
  readonly kind: 'hammer-on' | 'pull-off';
  readonly sourceFret: number;
  readonly targetFret: number;
  readonly arrived: boolean;
}

/** Le legature di durata non sono collegamenti hammer-on/pull-off. */
export function hammerPullLinks(note: model.Note): HammerPullLink[] {
  const links: HammerPullLink[] = [];
  const add = (origin: model.Note | null, target: model.Note | null, arrived: boolean) => {
    if (!origin?.isStringed || !target?.isStringed || origin.string !== target.string
      || origin.fret < 0 || target.fret < 0 || origin.fret === target.fret) return;
    links.push({ kind: target.fret > origin.fret ? 'hammer-on' : 'pull-off',
      sourceFret: origin.fret, targetFret: target.fret, arrived });
  };
  add(note.hammerPullOrigin, note, true);
  if (note.isHammerPullOrigin) add(note, note.hammerPullDestination, false);
  return links;
}
