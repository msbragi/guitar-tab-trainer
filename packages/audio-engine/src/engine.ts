/**
 * AudioToMidiPort adapter wrapping HendrixProcessor and HendrixMidiReader.
 * Ported from Hendrix Mobile (mobile.rs, MIT License).
 */

import type {
  AudioToMidiConfig,
  AudioToMidiPort,
  AudioToMidiTelemetry,
  SampledMidiEvent,
  TunerReading,
} from '@guitar-practice/core';
import { HendrixMidiReader } from './midi.js';
import { HendrixProcessor } from './processor.js';

export class HendrixAudioToMidiEngine implements AudioToMidiPort {
  private readonly processor = new HendrixProcessor();
  private readonly reader = new HendrixMidiReader();
  private readonly audio: [Float32Array, Float32Array] = [
    new Float32Array(32),
    new Float32Array(32),
  ];
  private sample = 0;
  private channel = 0;

  constructor(sampleRate = 48000) {
    this.prepare(sampleRate);
  }

  prepare(sampleRate: number): void {
    const valid =
      Number.isFinite(sampleRate) && sampleRate >= 8000 && sampleRate <= 192000
        ? sampleRate
        : 48000;
    this.processor.prepare(valid);
    this.sample = 0;
  }

  configure(patch: Partial<AudioToMidiConfig>): void {
    this.processor.applyConfig(patch);
  }

  getConfig(): Readonly<AudioToMidiConfig> {
    return this.processor.toConfig();
  }

  setParameterByIndex(index: number, value: number): boolean {
    return this.processor.setParam(index, value);
  }

  setChannel(channel: number): boolean {
    if (!Number.isInteger(channel) || channel < 0 || channel > 15) {
      return false;
    }
    this.channel = channel;
    return true;
  }

  process(
    input: Float32Array,
    onEvent?: (event: SampledMidiEvent) => void,
  ): void {
    const params = this.processor.getParameterValues();
    for (let offset = 0; offset < input.length; offset += 32) {
      const len = Math.min(32, input.length - offset);
      for (let i = 0; i < len; i++) {
        const raw = input[offset + i]!;
        const v = Number.isFinite(raw) ? raw : 0;
        this.audio[0][i] = v;
        this.audio[1][i] = v;
      }
      this.processor.process(this.audio, len);
      this.sample += len;
      const sample = this.sample;
      this.reader.poll(this.processor.output, params, this.channel, (data) => {
        onEvent?.({ sample, data });
      });
    }
  }

  reset(onEvent?: (event: SampledMidiEvent) => void): void {
    const sample = this.sample;
    this.reader.flush((data) => {
      onEvent?.({ sample, data });
    });
    this.processor.reset();
    this.processor.output.hz = 0;
    this.processor.output.levelDb = -120;
  }

  snapshot(onEvent: (event: SampledMidiEvent) => void): void {
    const sample = this.sample;
    this.reader.snapshot((data) => {
      onEvent({ sample, data });
    });
  }

  samplePosition(): number {
    return this.sample;
  }

  telemetry(): AudioToMidiTelemetry {
    const out = this.processor.output;
    return {
      levelDb: out.levelDb,
      windowMs: out.windowMs,
      bendSemitones: out.bendSemitones,
      attacks: out.attacks,
      activeNotes: new Uint8Array(out.notes),
    };
  }

  tuner(): TunerReading | null {
    const out = this.processor.output;
    const params = this.processor.getParameterValues();
    const hz = out.hz;
    const levelDb = out.levelDb;
    const reference = params[8]!;
    const threshold = params[2]!;
    if (
      !Number.isFinite(hz) ||
      hz <= 0 ||
      !Number.isFinite(levelDb) ||
      levelDb < threshold
    ) {
      return null;
    }
    const position = 69 + 12 * Math.log2(hz / reference);
    if (!Number.isFinite(position) || position < 0 || position > 127) {
      return null;
    }
    const nearest = Math.round(position);
    return {
      hz,
      note: nearest,
      cents: (position - nearest) * 100,
      levelDb,
    };
  }
}
