/**
 * Note extraction, Standard MIDI File (SMF) recording export, and guitar position helpers.
 * Ported from Hendrix Mobile (score.rs & recording.rs, MIT License).
 */

import {
  type GuitarFretPosition,
  type SampledMidiEvent,
  type TranscribedNote,
  suggestGuitarPosition,
} from '@guitar-practice/core';

export type RecordingErrorCode = 'InvalidSampleRate' | 'OutOfOrder' | 'TooLong';

export class RecordingError extends Error {
  readonly code: RecordingErrorCode;

  constructor(code: RecordingErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'RecordingError';
    this.code = code;
  }
}

/**
 * Extracts completed note intervals from ordered MIDI 1.0 events,
 * closing any notes still held at `endSample`.
 */
export function extractNotes(
  events: readonly SampledMidiEvent[],
  endSample: number,
): TranscribedNote[] {
  const active: Array<Array<{ start: number; velocity: number } | null>> =
    Array.from({ length: 16 }, () =>
      Array.from({ length: 128 }, () => null),
    );
  const notes: TranscribedNote[] = [];
  let previous = 0;

  for (const event of events) {
    if (event.sample < previous || event.sample > endSample) {
      throw new Error('events must be ordered and end within the recording');
    }
    previous = event.sample;
    const [status, pitch, velocity] = event.data;
    if (pitch > 127 || velocity > 127) continue;
    const channel = status & 0x0f;
    const kind = status & 0xf0;
    if (kind !== 0x80 && kind !== 0x90) continue;

    const old = active[channel]![pitch] ?? null;
    if (old !== null) {
      notes.push({
        channel,
        pitch,
        velocity: old.velocity,
        startSample: old.start,
        endSample: event.sample,
      });
      active[channel]![pitch] = null;
    }
    if (kind === 0x90 && velocity > 0) {
      active[channel]![pitch] = { start: event.sample, velocity };
    }
  }

  for (let channel = 0; channel < 16; channel++) {
    for (let pitch = 0; pitch < 128; pitch++) {
      const old = active[channel]![pitch] ?? null;
      if (old !== null) {
        notes.push({
          channel,
          pitch,
          velocity: old.velocity,
          startSample: old.start,
          endSample,
        });
      }
    }
  }

  notes.sort(
    (a, b) =>
      a.startSample - b.startSample ||
      a.pitch - b.pitch ||
      a.channel - b.channel,
  );
  return notes;
}

/**
 * Standard 6-string guitar position helper from Hendrix Mobile (1 = high E).
 */
export function standardGuitarPosition(
  pitch: number,
  maxFret = 24,
): GuitarFretPosition | null {
  return suggestGuitarPosition(pitch, maxFret);
}

/**
 * Sample-accurate MIDI recording session with Standard MIDI File (SMF Format 0) export.
 */
export class MidiRecording {
  private readonly rate: number;
  private readonly origin: number;
  private readonly recordedEvents: SampledMidiEvent[] = [];

  private constructor(sampleRate: number, originSample: number) {
    this.rate = sampleRate;
    this.origin = originSample;
  }

  static create(sampleRate: number, originSample = 0): MidiRecording {
    if (
      !Number.isInteger(sampleRate) ||
      sampleRate < 8000 ||
      sampleRate > 192000 ||
      !Number.isInteger(originSample) ||
      originSample < 0
    ) {
      throw new RecordingError('InvalidSampleRate');
    }
    return new MidiRecording(sampleRate, originSample);
  }

  events(): readonly SampledMidiEvent[] {
    return this.recordedEvents;
  }

  originSample(): number {
    return this.origin;
  }

  push(event: SampledMidiEvent): void {
    const last = this.recordedEvents[this.recordedEvents.length - 1];
    if (
      event.sample < this.origin ||
      (last !== undefined && event.sample < last.sample)
    ) {
      throw new RecordingError('OutOfOrder');
    }
    this.recordedEvents.push({
      sample: event.sample,
      data: [event.data[0], event.data[1], event.data[2]],
    });
  }

  /**
   * Format 0, 480 ticks per quarter note, fixed 120 BPM.
   * Final note-offs and pitch-bend resets are appended at `endSample`.
   */
  toSmf(endSample: number): Uint8Array {
    const last = this.recordedEvents[this.recordedEvents.length - 1];
    if (
      endSample < this.origin ||
      (last !== undefined && endSample < last.sample)
    ) {
      throw new RecordingError('OutOfOrder');
    }

    const track: number[] = [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20];
    let previous = 0;
    const held: boolean[][] = Array.from({ length: 16 }, () =>
      Array.from({ length: 128 }, () => false),
    );
    const bends = new Array<boolean>(16).fill(false);

    for (const event of this.recordedEvents) {
      const [status, a, b] = event.data;
      if (status < 0x80 || status > 0xef || a > 127 || b > 127) continue;
      const tick = Math.floor(((event.sample - this.origin) * 960) / this.rate);
      writeVarLen(track, Math.max(0, tick - previous));
      previous = tick;
      track.push(status, a);
      if ((status & 0xe0) !== 0xc0) {
        track.push(b);
      }
      const channel = status & 15;
      const kind = status & 0xf0;
      if (kind === 0x90) {
        held[channel]![a] = b !== 0;
      } else if (kind === 0x80) {
        held[channel]![a] = false;
      } else if (kind === 0xe0) {
        bends[channel] = a !== 0 || b !== 64;
      }
    }

    const endTick = Math.floor(((endSample - this.origin) * 960) / this.rate);
    let delta = Math.max(0, endTick - previous);
    for (let channel = 0; channel < 16; channel++) {
      for (let note = 0; note < 128; note++) {
        if (held[channel]![note]) {
          writeVarLen(track, delta);
          delta = 0;
          track.push(0x80 | channel, note, 0);
        }
      }
      if (bends[channel]) {
        writeVarLen(track, delta);
        delta = 0;
        track.push(0xe0 | channel, 0, 64);
      }
    }

    writeVarLen(track, delta);
    track.push(0xff, 0x2f, 0);

    if (track.length > 0xffffffff) {
      throw new RecordingError('TooLong');
    }

    const header = [
      0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0, 0x4d, 0x54,
      0x72, 0x6b,
    ];
    const len = track.length;
    const out = new Uint8Array(header.length + 4 + len);
    out.set(header, 0);
    out[18] = (len >>> 24) & 0xff;
    out[19] = (len >>> 16) & 0xff;
    out[20] = (len >>> 8) & 0xff;
    out[21] = len & 0xff;
    out.set(track, 22);
    return out;
  }
}

function writeVarLen(out: number[], value: number): void {
  if (value > 0x0fffffff || value < 0) {
    throw new RecordingError('TooLong');
  }
  const buffer = [0, 0, 0, 0];
  let i = 3;
  let v = value >>> 0;
  buffer[i] = v & 0x7f;
  while ((v >>>= 7) !== 0) {
    i -= 1;
    buffer[i] = (v & 0x7f) | 0x80;
  }
  for (let k = i; k < 4; k++) {
    out.push(buffer[k]!);
  }
}
