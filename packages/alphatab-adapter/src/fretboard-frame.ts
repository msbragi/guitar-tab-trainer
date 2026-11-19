export type FretboardGesture =
  | { readonly kind: 'bend'; readonly points: readonly { readonly offset: number; readonly tones: number }[];
      readonly progress: number }
  | { readonly kind: 'slide'; readonly targetFret: number; readonly progress: number }
  | { readonly kind: 'hammer-on' | 'pull-off'; readonly sourceFret: number; readonly targetFret: number; readonly progress: number };

export type FretboardEffect =
  | { readonly kind: 'hammer-on' | 'pull-off'; readonly sourceFret: number; readonly targetFret: number }
  | { readonly kind: 'bend'; readonly tones: readonly number[] }
  | { readonly kind: 'vibrato'; readonly wide: boolean }
  | { readonly kind: 'slide'; readonly phase: 'in' | 'out'; readonly direction: 'up' | 'down' | 'unknown';
      readonly targetFret?: number; readonly legato: boolean; readonly pick: boolean };

export interface FretboardPosition {
  readonly string: number;
  readonly fret: number;
  readonly gestures?: readonly FretboardGesture[];
  readonly effects?: readonly FretboardEffect[];
}

export interface FretboardFrame {
  readonly tuning: readonly number[];
  readonly capo: number;
  readonly positions: readonly FretboardPosition[];
}
