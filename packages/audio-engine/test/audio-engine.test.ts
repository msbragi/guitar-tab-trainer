import { describe, expect, it } from 'vitest';
import {
  type SampledMidiEvent,
  suggestGuitarPosition,
} from '@guitar-practice/core';
import {
  HendrixAudioToMidiEngine,
  HendrixMidiReader,
  HendrixPresetBank,
  HendrixProcessor,
  MidiRecording,
  ProcessorOutput,
  extractNotes,
  factoryParameterValues,
  standardGuitarPosition,
} from '../src/index.js';

const TAU = Math.PI * 2;

function playSynthetic(
  processor: HendrixProcessor,
  sampleRate: number,
  notes: readonly number[],
  harmonics: number,
  seconds: number,
  blockSize: number,
): void {
  const ch0 = new Float32Array(blockSize);
  const ch1 = new Float32Array(blockSize);
  const channels = [ch0, ch1];
  const total = Math.floor(sampleRate * seconds);
  let at = 0;

  while (at < total) {
    const n = Math.min(blockSize, total - at);
    for (let i = 0; i < n; i++) {
      const t = (at + i) / sampleRate;
      let v = 0;
      for (const note of notes) {
        const f = 440 * Math.pow(2, (note - 69) / 12);
        for (let h = 1; h <= harmonics; h++) {
          v +=
            (0.12 / Math.max(1, notes.length) / h) *
            Math.sin(TAU * f * h * t);
        }
      }
      ch0[i] = v;
      ch1[i] = v;
    }
    processor.process(channels, n);
    at += n;
  }
}

function activeNotes(processor: HendrixProcessor): number[] {
  const result: number[] = [];
  for (let n = 0; n < 128; n++) {
    if (processor.output.notes[n]! > 0) {
      result.push(n);
    }
  }
  return result;
}

describe('HendrixProcessor (Mono & Poly DSP)', () => {
  it('mono tracks real tones across sample rates and releases cleanly', () => {
    for (const [sr, block] of [
      [44100, 127],
      [48000, 32],
      [96000, 512],
    ] as const) {
      for (const note of [40, 57, 69, 81]) {
        const p = new HendrixProcessor();
        p.prepare(sr);
        playSynthetic(p, sr, [note], 5, 0.4, block);
        expect(activeNotes(p)).toEqual([note]);
        playSynthetic(p, sr, [], 1, 0.3, block);
        expect(activeNotes(p)).toEqual([]);
      }
    }
  });

  it('timed mono windows emit at their deadline and reject late low notes without ghost notes', () => {
    for (const [mode, ms] of [
      [1, 5],
      [2, 10],
      [3, 15],
    ] as const) {
      const sr = 48000;
      const p = new HendrixProcessor();
      p.prepare(sr);
      p.setParam('16', mode);
      const ch0 = new Float32Array(1);
      const ch1 = new Float32Array(1);
      let foundMs: number | null = null;
      const total = Math.floor(sr * 0.05);
      for (let i = 0; i < total; i++) {
        const x = 0.15 * Math.sin((TAU * 440 * i) / sr);
        ch0[0] = x;
        ch1[0] = x;
        p.process([ch0, ch1], 1);
        if (activeNotes(p).length > 0) {
          foundMs = ((i + 1) * 1000) / sr;
          break;
        }
      }
      expect(foundMs).not.toBeNull();
      expect(activeNotes(p)).toEqual([69]);
      expect(foundMs!).toBeGreaterThanOrEqual(ms - 0.15);
      expect(foundMs!).toBeLessThan(ms + 0.35);

      const pLow = new HendrixProcessor();
      pLow.prepare(sr);
      pLow.setParam('16', mode);
      playSynthetic(pLow, sr, [40], 1, 0.4, 128);
      expect(activeNotes(pLow)).toEqual([]);
      const totalStamps = pLow.output.stamps.reduce((a, b) => a + b, 0);
      expect(totalStamps).toBe(0);
    }
  });

  it('tracks monophonic pitch bends and resets bend on release', () => {
    const p = new HendrixProcessor();
    p.prepare(48000);
    p.setParam('13', 1); // Mono-Bends ON
    p.setParam('14', 0); // ±2 semitones
    const ch0 = new Float32Array(128);
    const ch1 = new Float32Array(128);
    let phase = 0;

    for (let block = 0; block < 260; block++) {
      const semitone = block < 100 ? 0 : Math.min(1, (block - 100) / 100);
      const hz = 440 * Math.pow(2, semitone / 12);
      for (let i = 0; i < 128; i++) {
        phase = (phase + hz / 48000) % 1;
        ch0[i] = 0.15 * Math.sin(TAU * phase);
        ch1[i] = ch0[i]!;
      }
      p.process([ch0, ch1], 128);
    }
    expect(activeNotes(p)).toEqual([69]);
    expect(Math.abs(p.output.bendSemitones - 1)).toBeLessThan(0.03);

    playSynthetic(p, 48000, [], 1, 0.3, 128);
    expect(activeNotes(p)).toEqual([]);
    expect(p.output.bendSemitones).toBe(0);
  });

  it('poly tracks major and minor chords without emitting overtones', () => {
    const chords = [
      [60, 64, 67],
      [57, 60, 64],
      [48, 55, 62],
      [48, 55, 60, 64, 67, 72],
    ];
    for (const chord of chords) {
      for (const harmonics of [1, 6]) {
        const p = new HendrixProcessor();
        p.prepare(48000);
        p.setParam('0', 1); // Poly mode
        playSynthetic(p, 48000, chord, harmonics, 0.5, 128);
        expect(activeNotes(p)).toEqual(chord);
      }
    }
  });
});

describe('HendrixMidiReader & PresetBank', () => {
  it('handles repeated notes, transpose, channel changes, and flush', () => {
    const out = new ProcessorOutput();
    const reader = new HendrixMidiReader();
    const params = new Float32Array(20);
    params[1] = 1; // Send MIDI
    const events: Array<readonly [number, number, number]> = [];

    out.setNote(60, 100);
    reader.poll(out, params, 0, (m) => events.push(m));
    expect(events).toEqual([[0x90, 60, 100]]);
    events.length = 0;

    // Retrigger same note with new stamp
    out.setNote(60, 110);
    reader.poll(out, params, 0, (m) => events.push(m));
    expect(events).toEqual([
      [0x80, 60, 0],
      [0x90, 60, 110],
    ]);
    events.length = 0;

    // Transpose +12 and change channel to 1
    params[9] = 12;
    reader.poll(out, params, 1, (m) => events.push(m));
    expect(events).toEqual([
      [0x80, 60, 0],
      [0x91, 72, 110],
    ]);
    events.length = 0;

    reader.flush((m) => events.push(m));
    expect(events).toEqual([[0x81, 72, 0]]);
  });

  it('validates and manages presets', () => {
    const bank = new HendrixPresetBank();
    const p = factoryParameterValues();
    p['3'] = 20.5;
    const id = bank.save('My Guitar', p, true);
    p['4'] = 69.1;
    expect(bank.save('my guitar', p, false)).toBe(id);
    expect(bank.entries.length).toBe(1);
    expect(bank.initial()).toEqual(p);
    bank.remove(id);
    expect(bank.isEmpty()).toBe(true);
  });
});

describe('HendrixAudioToMidiEngine & Bonus Mobile Utilities', () => {
  it('implements AudioToMidiPort, extracts notes, provides tuner, and exports SMF', () => {
    const engine = new HendrixAudioToMidiEngine(48000);
    const events: SampledMidiEvent[] = [];
    const block = new Float32Array(128);

    // 400ms of A4 (440 Hz) followed by 200ms silence
    for (let b = 0; b < 150; b++) {
      for (let i = 0; i < 128; i++) {
        const sampleIdx = b * 128 + i;
        block[i] =
          b < 100 ? 0.15 * Math.sin((TAU * 440 * sampleIdx) / 48000) : 0;
      }
      engine.process(block, (ev) => events.push(ev));
      if (b === 50) {
        const tuner = engine.tuner();
        expect(tuner).not.toBeNull();
        expect(tuner!.note).toBe(69);
        expect(Math.abs(tuner!.cents)).toBeLessThan(5);
      }
    }
    engine.reset((ev) => events.push(ev));

    const notes = extractNotes(events, engine.samplePosition());
    expect(notes.length).toBe(1);
    expect(notes[0]!.pitch).toBe(69);
    expect(notes[0]!.endSample).toBeGreaterThan(notes[0]!.startSample);

    // Guitar position suggestion (standard and context-aware)
    expect(standardGuitarPosition(64, 24)).toEqual({ string: 1, fret: 0 });
    expect(suggestGuitarPosition(64, 24, [64, 59, 55, 50, 45, 40], 5)).toEqual({
      string: 2,
      fret: 5,
    });

    // Standard MIDI File export
    const rec = MidiRecording.create(48000, 0);
    for (const ev of events) {
      rec.push(ev);
    }
    const smf = rec.toSmf(engine.samplePosition());
    expect(String.fromCharCode(...smf.slice(0, 4))).toBe('MThd');
    expect(String.fromCharCode(...smf.slice(14, 18))).toBe('MTrk');
  });
});
