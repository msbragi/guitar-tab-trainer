import type { FretboardFrame } from '@guitar-practice/alphatab-adapter';

export const fretCellWidth = 32;
export const fretHeaderHeight = 30;
export const fretRowHeight = 22;

interface Point { readonly x: number; readonly y: number }
export interface GestureDrawing {
  readonly kind: 'slide' | 'bend' | 'hammer-on' | 'pull-off';
  readonly source?: Point & { readonly fret: number };
  readonly string: number;
  readonly fret: number;
  readonly path: string;
  readonly playedPath: string;
  readonly cursor: Point;
  readonly target: (Point & { readonly fret: number; readonly pitch: number }) | null;
}

const path = (points: readonly Point[]) => points.map(({ x, y }, index) => `${index ? 'L' : 'M'} ${x} ${y}`).join(' ');
const interpolate = (from: Point, to: Point, ratio: number): Point => ({
  x: from.x + (to.x - from.x) * ratio, y: from.y + (to.y - from.y) * ratio,
});

/** Coordinate del manico: una colonna per corda/etichetta e poi una per tasto. */
export function drawFretboardGestures(frame: FretboardFrame | null): GestureDrawing[] {
  if (!frame) return [];
  const drawings: GestureDrawing[] = [];
  for (const position of frame.positions) {
    const x = (position.fret + 1.5) * fretCellWidth;
    const y = fretHeaderHeight + (frame.tuning.length - position.string + 0.5) * fretRowHeight;
    for (const gesture of position.gestures ?? []) {
      if (gesture.kind !== 'bend') {
        const from = { x: gesture.kind === 'slide' ? x : (gesture.sourceFret + 1.5) * fretCellWidth, y };
        const target = { x: (gesture.targetFret + 1.5) * fretCellWidth, y, fret: gesture.targetFret,
          pitch: frame.tuning[frame.tuning.length - position.string]! + gesture.targetFret + frame.capo };
        if (gesture.kind !== 'slide') {
          const control = { x: (from.x + target.x) / 2, y: y - 12 };
          const progress = gesture.progress;
          const partialControl = interpolate(from, control, progress);
          const cursor = interpolate(partialControl, interpolate(control, target, progress), progress);
          const arc = (controlPoint: Point, end: Point) =>
            `M ${from.x} ${from.y} Q ${controlPoint.x} ${controlPoint.y} ${end.x} ${end.y}`;
          drawings.push({ kind: gesture.kind, string: position.string, fret: position.fret,
            path: arc(control, target), playedPath: arc(partialControl, cursor), cursor, target,
            source: { ...from, fret: gesture.sourceFret } });
          continue;
        }
        const cursor = interpolate(from, target, gesture.progress);
        drawings.push({ kind: 'slide', string: position.string, fret: position.fret,
          path: path([from, target]), playedPath: path([from, cursor]), cursor, target });
        continue;
      }
      const peak = Math.max(1, ...gesture.points.map(({ tones }) => Math.abs(tones)));
      // Il piccolo arco laterale rappresenta lo spostamento trasversale della corda.
      const curve = gesture.points.map(({ offset, tones }) => ({
        offset, x: x - 12 - 6 * Math.sin(offset * Math.PI), y: y - 8 * tones / peak,
      }));
      if (!curve.length) continue;
      let cursor: Point = curve[0]!;
      const played: Point[] = [];
      for (let index = 0; index < curve.length; index++) {
        const point = curve[index]!;
        if (point.offset <= gesture.progress) {
          played.push(point); cursor = point;
        } else {
          const previous = curve[Math.max(0, index - 1)]!;
          const ratio = point.offset > previous.offset
            ? Math.max(0, (gesture.progress - previous.offset) / (point.offset - previous.offset)) : 0;
          cursor = interpolate(previous, point, ratio);
          played.push(cursor);
          break;
        }
      }
      drawings.push({ kind: 'bend', string: position.string, fret: position.fret,
        path: path(curve), playedPath: path(played), cursor, target: null });
    }
  }
  return drawings;
}
