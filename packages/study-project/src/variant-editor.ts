import {
  type GuitarFretPosition,
  type PlaybackBar,
  type PracticeSelection,
  type TranscribedNote,
  suggestGuitarPosition,
} from '@guitar-practice/core';
import type { PhraseVariant, VariantNote } from './models.js';

/**
 * Immutable undo/redo editor state for modifying a PhraseVariant's notes on the fretboard.
 */
export interface VariantEditorState {
  readonly variant: PhraseVariant;
  readonly undoStack: readonly (readonly VariantNote[])[];
  readonly redoStack: readonly (readonly VariantNote[])[];
}

export function createVariantEditor(variant: PhraseVariant): VariantEditorState {
  return {
    variant: { ...variant, notes: [...variant.notes] },
    undoStack: [],
    redoStack: [],
  };
}

function pushEdit(
  state: VariantEditorState,
  nextNotes: readonly VariantNote[],
  timestamp = new Date().toISOString(),
): VariantEditorState {
  const sorted = [...nextNotes].sort(
    (a, b) => a.tickOffset - b.tickOffset || a.string - b.string || a.fret - b.fret,
  );
  return {
    variant: {
      ...state.variant,
      updatedAt: timestamp,
      notes: sorted,
    },
    undoStack: [...state.undoStack, state.variant.notes],
    redoStack: [],
  };
}

/**
 * Sets or replaces a note at a specific (tickOffset, string) on the fretboard.
 * If a note already exists on the same string within `[tickOffset - toleranceTicks, tickOffset + toleranceTicks]`,
 * it updates its fret and pitch; otherwise it inserts a new note.
 */
export function upsertVariantNoteOnFretboard(
  state: VariantEditorState,
  input: {
    readonly id?: string;
    readonly tickOffset: number;
    readonly durationTicks: number;
    readonly string: number;
    readonly fret: number;
    readonly openTuningMidi?: readonly number[];
    readonly velocity?: number;
    readonly toleranceTicks?: number;
    readonly timestamp?: string;
  },
): VariantEditorState {
  const tuning = input.openTuningMidi ?? [64, 59, 55, 50, 45, 40];
  const openPitch = tuning[input.string - 1];
  if (
    openPitch === undefined ||
    input.fret < 0 ||
    input.tickOffset < 0 ||
    input.durationTicks <= 0
  ) {
    return state;
  }
  const pitch = openPitch + input.fret;
  if (pitch < 0 || pitch > 127) return state;

  const tolerance = Math.max(0, input.toleranceTicks ?? 60);
  const existingIdx = state.variant.notes.findIndex(
    (n) =>
      n.string === input.string &&
      Math.abs(n.tickOffset - input.tickOffset) <= tolerance,
  );

  const nextNotes = [...state.variant.notes];
  if (existingIdx !== -1) {
    const prev = nextNotes[existingIdx]!;
    if (prev.fret === input.fret && prev.pitch === pitch) {
      return state;
    }
    nextNotes[existingIdx] = {
      ...prev,
      fret: input.fret,
      pitch,
      velocity: input.velocity ?? prev.velocity,
      edited: true,
    };
  } else {
    nextNotes.push({
      id: input.id ?? `note-${input.tickOffset}-${input.string}-${input.fret}`,
      tickOffset: input.tickOffset,
      durationTicks: input.durationTicks,
      string: input.string,
      fret: input.fret,
      pitch,
      velocity: input.velocity ?? 100,
      edited: true,
    });
  }
  return pushEdit(state, nextNotes, input.timestamp);
}

/**
 * Removes a note by ID (or at a given tickOffset + string within tolerance) from the variant.
 */
export function removeVariantNote(
  state: VariantEditorState,
  target: { readonly id: string } | { readonly tickOffset: number; readonly string: number; readonly toleranceTicks?: number },
  timestamp?: string,
): VariantEditorState {
  const nextNotes = state.variant.notes.filter((note) => {
    if ('id' in target) {
      return note.id !== target.id;
    }
    const tolerance = Math.max(0, target.toleranceTicks ?? 60);
    return !(
      note.string === target.string &&
      Math.abs(note.tickOffset - target.tickOffset) <= tolerance
    );
  });
  if (nextNotes.length === state.variant.notes.length) {
    return state;
  }
  return pushEdit(state, nextNotes, timestamp);
}

export function undoVariantEdit(
  state: VariantEditorState,
  timestamp = new Date().toISOString(),
): VariantEditorState {
  if (state.undoStack.length === 0) return state;
  const previous = state.undoStack[state.undoStack.length - 1]!;
  return {
    variant: {
      ...state.variant,
      updatedAt: timestamp,
      notes: previous,
    },
    undoStack: state.undoStack.slice(0, -1),
    redoStack: [...state.redoStack, state.variant.notes],
  };
}

export function redoVariantEdit(
  state: VariantEditorState,
  timestamp = new Date().toISOString(),
): VariantEditorState {
  if (state.redoStack.length === 0) return state;
  const restored = state.redoStack[state.redoStack.length - 1]!;
  return {
    variant: {
      ...state.variant,
      updatedAt: timestamp,
      notes: restored,
    },
    undoStack: [...state.undoStack, state.variant.notes],
    redoStack: state.redoStack.slice(0, -1),
  };
}

/**
 * Maps sample-based TranscribedNotes from AudioToMidiPort onto musical ticks and
 * guitar (string, fret) coordinates within a selected phrase.
 */
export function mapTranscribedNotesToVariantNotes(options: {
  readonly transcribed: readonly TranscribedNote[];
  readonly sampleRate: number;
  readonly totalPhraseTicks: number;
  readonly totalPhraseSamples: number;
  readonly openTuningMidi?: readonly number[];
  readonly maxFret?: number;
  readonly preferredFretByTick?: (tickOffset: number) => number | undefined;
}): VariantNote[] {
  const {
    transcribed,
    sampleRate,
    totalPhraseTicks,
    totalPhraseSamples,
    openTuningMidi = [64, 59, 55, 50, 45, 40],
    maxFret = 24,
    preferredFretByTick,
  } = options;
  if (sampleRate <= 0 || totalPhraseTicks <= 0 || totalPhraseSamples <= 0) {
    return [];
  }

  const ticksPerSample = totalPhraseTicks / totalPhraseSamples;
  const result: VariantNote[] = [];

  for (let i = 0; i < transcribed.length; i++) {
    const item = transcribed[i]!;
    if (item.endSample <= item.startSample) continue;
    const tickOffset = Math.max(
      0,
      Math.min(totalPhraseTicks, Math.round(item.startSample * ticksPerSample)),
    );
    const durationTicks = Math.max(
      1,
      Math.round((item.endSample - item.startSample) * ticksPerSample),
    );
    const preferredFret = preferredFretByTick?.(tickOffset);
    const pos: GuitarFretPosition | null = suggestGuitarPosition(
      item.pitch,
      maxFret,
      openTuningMidi,
      preferredFret,
    );
    if (!pos) continue;

    result.push({
      id: `take-${i + 1}-${tickOffset}-${pos.string}-${pos.fret}`,
      tickOffset,
      durationTicks,
      string: pos.string,
      fret: pos.fret,
      pitch: item.pitch,
      velocity: item.velocity,
      edited: false,
    });
  }

  return result;
}

/**
 * Computes a deterministic content fingerprint (FNV-1a 64-bit hex) for Guitar Pro file bytes
 * synchronously without requiring async SubtleCrypto in pure domain logic.
 */
export function computeScoreContentId(bytes: Uint8Array): string {
  let h1 = 0xdeadbeef ^ bytes.byteLength;
  let h2 = 0x41c6ce57 ^ bytes.byteLength;
  for (let i = 0; i < bytes.byteLength; i++) {
    const ch = bytes[i]!;
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hi = (h2 >>> 0).toString(16).padStart(8, '0');
  const lo = (h1 >>> 0).toString(16).padStart(8, '0');
  return `gp-${hi}${lo}-${bytes.byteLength}`;
}

/**
 * Formats a default human-readable name for a PracticePhrase from its playback bars.
 */
export function formatDefaultPhraseName(
  bars: readonly PlaybackBar[],
  selection: PracticeSelection,
  trackName?: string,
): string {
  const first = bars[selection.from];
  const last = bars[selection.to];
  const startBarNum = first ? first.barIndex + 1 : selection.from + 1;
  const endBarNum = last ? last.barIndex + 1 : selection.to + 1;
  const rangeLabel =
    startBarNum === endBarNum ? `Bar ${startBarNum}` : `Bars ${startBarNum}–${endBarNum}`;
  return trackName ? `${rangeLabel} · ${trackName}` : rangeLabel;
}
