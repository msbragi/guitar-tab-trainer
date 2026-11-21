/**
 * Stateful MIDI 1.0 message translator for HendrixProcessor output.
 * Ported from Hendrix midi.rs (MIT License).
 */

import type { ProcessorOutput } from './processor.js';

export type MidiMessage = readonly [number, number, number];

export class HendrixMidiReader {
  private readonly held = new Uint8Array(128);
  private readonly stamps = new Uint32Array(128);
  private readonly nextNotes = new Uint8Array(128);
  private readonly nextStamps = new Uint32Array(128);
  private bendValue: number | null = null;
  private bendRange: number | null = null;
  private channel = 0;

  flush(emit: (message: MidiMessage) => void): void {
    for (let n = 0; n < 128; n++) {
      if (this.held[n]! > 0) {
        this.held[n] = 0;
        this.stamps[n] = 0;
        emit([0x80 | this.channel, n, 0]);
      }
    }
    if (this.bendValue !== null) {
      this.bendValue = null;
      this.bendRange = null;
      emit([0xe0 | this.channel, 0, 64]);
    }
  }

  /**
   * Emits currently active MIDI state to a new listener (e.g. when punch-in recording starts)
   * without retriggering live output.
   */
  snapshot(emit: (message: MidiMessage) => void): void {
    if (this.bendValue !== null && this.bendRange !== null) {
      const ch = this.channel;
      for (const [cc, value] of [
        [101, 0],
        [100, 0],
        [6, this.bendRange],
        [38, 0],
        [101, 127],
        [100, 127],
      ] as const) {
        emit([0xb0 | ch, cc, value]);
      }
      emit([0xe0 | ch, this.bendValue & 127, (this.bendValue >> 7) & 127]);
    }
    for (let n = 0; n < 128; n++) {
      const vel = this.held[n]!;
      if (vel > 0) {
        emit([0x90 | this.channel, n, vel]);
      }
    }
  }

  poll(
    output: ProcessorOutput,
    params: Readonly<Float32Array>,
    channel: number,
    emit: (message: MidiMessage) => void,
  ): void {
    const ch = Math.min(15, Math.max(0, channel));
    if (ch !== this.channel) {
      this.flush(emit);
      this.channel = ch;
    }
    if (params[1]! < 0.5) {
      this.flush(emit);
      return;
    }

    this.nextNotes.fill(0);
    this.nextStamps.fill(0);
    const transpose = Math.max(-24, Math.min(24, Math.round(params[9]!)));
    let anyActive = false;

    for (let n = 0; n < 128; n++) {
      const v = output.notes[n]!;
      const pitch = n + transpose;
      if (v > 0 && pitch >= 0 && pitch < 128) {
        this.nextNotes[pitch] = v;
        this.nextStamps[pitch] = output.stamps[n]!;
        anyActive = true;
      }
    }

    let nextBendValue: number | null = null;
    let nextBendRange: number | null = null;
    if (params[0]! < 0.5 && params[13]! >= 0.5 && anyActive) {
      const rangeIdx = Math.max(0, Math.min(2, Math.round(params[14]!)));
      const range = rangeIdx === 2 ? 24 : rangeIdx === 1 ? 12 : 2;
      const semitones = output.bendSemitones;
      const value = Number.isFinite(semitones)
        ? Math.max(0, Math.min(16383, Math.round(8192 + (semitones / range) * 8192)))
        : 8192;
      nextBendValue = value;
      nextBendRange = range;
    }

    if (nextBendRange !== null && this.bendRange !== nextBendRange) {
      for (const [cc, value] of [
        [101, 0],
        [100, 0],
        [6, nextBendRange],
        [38, 0],
        [101, 127],
        [100, 127],
      ] as const) {
        emit([0xb0 | ch, cc, value]);
      }
    }

    if (nextBendValue !== this.bendValue || nextBendRange !== this.bendRange) {
      const value = nextBendValue ?? 8192;
      emit([0xe0 | ch, value & 127, (value >> 7) & 127]);
      this.bendValue = nextBendValue;
      this.bendRange = nextBendRange;
    }

    for (let n = 0; n < 128; n++) {
      const oldVel = this.held[n]!;
      const newVel = this.nextNotes[n]!;
      const retrigger =
        oldVel > 0 && newVel > 0 && this.nextStamps[n]! !== this.stamps[n]!;
      if (oldVel > 0 && (newVel === 0 || retrigger)) {
        emit([0x80 | ch, n, 0]);
      }
      if (newVel > 0 && (oldVel === 0 || retrigger)) {
        emit([0x90 | ch, n, newVel]);
      }
      this.held[n] = newVel;
      this.stamps[n] = this.nextStamps[n]!;
    }
  }
}
