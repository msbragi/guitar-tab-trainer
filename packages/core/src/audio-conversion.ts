export type AudioConversionMode = 'mono' | 'poly';
export type AudioVerificationQuality = 'fast' | 'balanced' | 'accurate';
export type PitchBendRangeSemitones = 2 | 12 | 24;
export type MonoDetectionWindow = 'direct' | '5ms' | '10ms' | '15ms';

export interface AudioToMidiConfig {
  readonly mode: AudioConversionMode;
  readonly midiEnabled: boolean;
  readonly inputThresholdDb: number;
  readonly noteStabilityMs: number;
  readonly releaseMs: number;
  readonly lowestNote: number;
  readonly highestNote: number;
  readonly maxVoices: number;
  readonly referenceA4Hz: number;
  readonly transposeSemitones: number;
  readonly fixedVelocity: number;
  readonly verification: AudioVerificationQuality;
  readonly monoBends: boolean;
  readonly bendRange: PitchBendRangeSemitones;
  readonly bendSmoothingMs: number;
  readonly monoWindow: MonoDetectionWindow;
  readonly monoRetriggerOnPick: boolean;
  readonly pickThresholdDb: number;
  readonly pickMinIntervalMs: number;
}

export const DEFAULT_AUDIO_TO_MIDI_CONFIG: AudioToMidiConfig = {
  mode: 'mono',
  midiEnabled: true,
  inputThresholdDb: -48,
  noteStabilityMs: 12,
  releaseMs: 40,
  lowestNote: 36,
  highestNote: 96,
  maxVoices: 6,
  referenceA4Hz: 440,
  transposeSemitones: 0,
  fixedVelocity: 0,
  verification: 'balanced',
  monoBends: false,
  bendRange: 2,
  bendSmoothingMs: 8,
  monoWindow: 'direct',
  monoRetriggerOnPick: true,
  pickThresholdDb: 3,
  pickMinIntervalMs: 35,
};

/** Sample-accurate MIDI 1.0 message emitted by an audio-to-MIDI engine. */
export interface SampledMidiEvent {
  readonly sample: number;
  readonly data: readonly [number, number, number];
}

/** Extracted note span with sample coordinates relative to capture start. */
export interface TranscribedNote {
  readonly channel: number;
  readonly pitch: number;
  readonly velocity: number;
  readonly startSample: number;
  readonly endSample: number;
}

/** Suggested fretboard coordinate (1-based string index where 1 = highest string). */
export interface GuitarFretPosition {
  readonly string: number;
  readonly fret: number;
}

/** Live tuner reading computed from the most recent analysis window. */
export interface TunerReading {
  readonly hz: number;
  readonly note: number;
  readonly cents: number;
  readonly levelDb: number;
}

/** Live telemetry snapshot from an audio-to-MIDI engine. */
export interface AudioToMidiTelemetry {
  readonly levelDb: number;
  readonly windowMs: number;
  readonly bendSemitones: number;
  readonly attacks: number;
  readonly activeNotes: Readonly<Uint8Array>;
}

/**
 * Engine-agnostic contract for real-time and offline audio-to-MIDI conversion.
 * Implementations (such as the custom TypeScript Hendrix engine, a WASM module,
 * or an external bridge) must conform to this port without exposing internal details.
 */
export interface AudioToMidiPort {
  prepare(sampleRate: number): void;
  configure(patch: Partial<AudioToMidiConfig>): void;
  getConfig(): Readonly<AudioToMidiConfig>;
  setChannel(channel: number): boolean;
  process(input: Float32Array, onEvent?: (event: SampledMidiEvent) => void): void;
  reset(onEvent?: (event: SampledMidiEvent) => void): void;
  snapshot(onEvent: (event: SampledMidiEvent) => void): void;
  samplePosition(): number;
  telemetry(): AudioToMidiTelemetry;
  tuner(): TunerReading | null;
}

/**
 * Suggests (string, fret) for a MIDI pitch given a guitar tuning (default standard E4..E2)
 * and optional preferred fret anchor (e.g. from the original Guitar Pro phrase).
 */
export function suggestGuitarPosition(
  pitch: number,
  maxFret = 24,
  openTuningMidi: readonly number[] = [64, 59, 55, 50, 45, 40],
  preferredFret?: number,
): GuitarFretPosition | null {
  if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127 || maxFret < 0) return null;
  let best: GuitarFretPosition | null = null;
  let bestCost = Number.POSITIVE_INFINITY;

  for (let i = 0; i < openTuningMidi.length; i++) {
    const base = openTuningMidi[i]!;
    const fret = pitch - base;
    if (fret >= 0 && fret <= maxFret) {
      const stringNum = i + 1;
      const cost =
        preferredFret !== undefined
          ? Math.abs(fret - preferredFret) * 10 + stringNum
          : fret * 10 + stringNum;
      if (cost < bestCost) {
        bestCost = cost;
        best = { string: stringNum, fret };
      }
    }
  }
  return best;
}
