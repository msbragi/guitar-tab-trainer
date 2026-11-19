import { hammerPullLinks } from './hammer-pull.js';
import { model } from '@coderline/alphatab/core';
import type { FretboardEffect } from './fretboard-frame.js';

/** Traduce solo la notazione degli effetti, senza simulare la sintesi del player. */
export function describeFretboardEffects(note: model.Note, beat: model.Beat): FretboardEffect[] {
  const effects: FretboardEffect[] = [];
  if (note.bendPoints?.length) {
    const tones = note.bendPoints.map(({ value }) => value / 4)
      .filter((value, index, values) => index === 0 || value !== values[index - 1]);
    effects.push({ kind: 'bend', tones });
  }
  const vibrato = Math.max(note.vibrato ?? 0, beat.vibrato ?? 0);
  if (vibrato > 0) effects.push({ kind: 'vibrato', wide: vibrato === model.VibratoType.Wide });

  if (note.slideInType > model.SlideInType.None) {
    effects.push({ kind: 'slide', phase: 'in',
      direction: note.slideInType === model.SlideInType.IntoFromBelow ? 'up' : 'down',
      legato: false, pick: false });
  }
  const slide = note.slideOutType;
  if (slide > model.SlideOutType.None) {
    const target = note.slideTarget;
    const targetFret = target?.isStringed && target.string === note.string && target.fret >= 0 ? target.fret : undefined;
    let direction: 'up' | 'down' | 'unknown' = 'unknown';
    if (slide === model.SlideOutType.OutUp || slide === model.SlideOutType.PickSlideUp) direction = 'up';
    else if (slide === model.SlideOutType.OutDown || slide === model.SlideOutType.PickSlideDown) direction = 'down';
    else if (targetFret !== undefined && targetFret !== note.fret) direction = targetFret > note.fret ? 'up' : 'down';
    effects.push({ kind: 'slide', phase: 'out', direction, targetFret,
      legato: slide === model.SlideOutType.Legato,
      pick: slide === model.SlideOutType.PickSlideUp || slide === model.SlideOutType.PickSlideDown });
  }
  for (const { kind, sourceFret, targetFret } of hammerPullLinks(note)) {
    effects.push({ kind, sourceFret, targetFret });
  }
  return effects;
}
