import { hammerPullLinks } from './hammer-pull.js';
import { model } from '@coderline/alphatab/core';
import type { FretboardGesture } from './fretboard-frame.js';

const clamp = (value: number) => Math.max(0, Math.min(1, value));

/** Avanzamento didattico nella durata del beat, ricavato solo dai tick del player. */
export function describeFretboardGestures(
  note: model.Note, elapsedTicks: number, durationTicks: number, slideStartRatio: number,
): FretboardGesture[] {
  if (!Number.isFinite(elapsedTicks) || !Number.isFinite(durationTicks) || durationTicks <= 0) return [];
  const progress = clamp(elapsedTicks / durationTicks);
  const gestures: FretboardGesture[] = [];
  if (note.bendPoints?.length) {
    const points = note.bendPoints.filter(({ offset, value }) => Number.isFinite(offset) && Number.isFinite(value))
      .map(({ offset, value }) => ({ offset: clamp(offset / model.BendPoint.MaxPosition), tones: value / 4 }))
      .sort((left, right) => left.offset - right.offset);
    if (points.length) gestures.push({ kind: 'bend', points, progress });
  }
  const target = note.slideTarget;
  if ((note.slideOutType === model.SlideOutType.Shift || note.slideOutType === model.SlideOutType.Legato)
    && target?.isStringed && target.string === note.string && target.fret >= 0 && target.fret !== note.fret) {
    const start = Number.isFinite(slideStartRatio) ? clamp(slideStartRatio) : 0.5;
    const movement = start < 1 ? clamp((progress - start) / (1 - start)) : progress === 1 ? 1 : 0;
    gestures.push({ kind: 'slide', targetFret: target.fret, progress: movement });
  }
  for (const { kind, sourceFret, targetFret, arrived } of hammerPullLinks(note)) {
    gestures.push({ kind, sourceFret, targetFret, progress: arrived ? 1 : progress });
  }
  return gestures;
}
