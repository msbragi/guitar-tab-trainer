/**
 * Streaming mono/poly audio-to-note analysis engine in pure TypeScript.
 * Zero runtime allocations in process(); pre-allocated typed arrays throughout.
 * Ported from Hendrix by Moonshroom Studio (MIT License).
 */

import {
  type AudioToMidiConfig,
  DEFAULT_AUDIO_TO_MIDI_CONFIG,
} from '@guitar-practice/core';
import { Radix2Fft } from './fft.js';
import { HENDRIX_PARAMETERS, clampParam } from './parameters.js';

const MAX_FRAME = 2048;
const FFT_SIZE = 4096;
const HOP = 128;
const TAU = Math.PI * 2;
const MAX_PEAKS = 64;

export class ProcessorOutput {
  /** Active velocity (0..127) per MIDI pitch (0..127). */
  readonly notes = new Uint8Array(128);
  /** Monotonic trigger stamp per MIDI pitch (incremented on every onset/repick). */
  readonly stamps = new Uint32Array(128);
  serial = 0;
  levelDb = -120;
  hz = 0;
  bendSemitones = 0;
  windowMs = 0;
  attacks = 0;

  setNote(note: number, velocity: number): void {
    this.stamps[note] = (this.stamps[note]! + 1) >>> 0;
    this.notes[note] = velocity;
  }

  clear(): void {
    this.bendSemitones = 0;
    for (let n = 0; n < 128; n++) {
      if (this.notes[n]! !== 0) {
        this.setNote(n, 0);
      }
    }
  }
}

/**
 * Provisional single-cycle waveform period estimator with Schmitt trigger arming.
 */
class FirstCycle {
  clock = 0;
  previous = 0;
  readonly armed: [boolean, boolean] = [false, false];
  readonly crossing: [number | null, number | null] = [null, null];
  readonly energy: [number, number] = [0, 0];
  readonly count: [number, number] = [0, 0];
  quiet = 0;
  outHz = 0;
  outRms = 0;

  reset(): void {
    this.clock = 0;
    this.previous = 0;
    this.armed[0] = false;
    this.armed[1] = false;
    this.crossing[0] = null;
    this.crossing[1] = null;
    this.energy[0] = 0;
    this.energy[1] = 0;
    this.count[0] = 0;
    this.count[1] = 0;
    this.quiet = 0;
    this.outHz = 0;
    this.outRms = 0;
  }

  push(x: number, rate: number, lo: number, hi: number, threshold: number): boolean {
    this.clock += 1;
    const x2 = x * x;
    this.energy[0] += x2;
    this.energy[1] += x2;
    this.count[0] += 1;
    this.count[1] += 1;

    this.quiet = Math.abs(x) >= threshold ? 0 : this.quiet + 1;
    if (x < -threshold * 0.25) {
      this.armed[0] = true;
    }
    if (x > threshold * 0.25) {
      this.armed[1] = true;
    }

    let found = false;
    const dir =
      this.previous <= 0 && x > 0 ? 0 : this.previous >= 0 && x < 0 ? 1 : -1;

    if (dir !== -1 && this.armed[dir]) {
      const crossing = this.clock - x / (x - this.previous);
      const last = this.crossing[dir];
      if (last !== null) {
        const period = crossing - last;
        const hz = rate / period;
        const rms = Math.sqrt(this.energy[dir]! / Math.max(1, this.count[dir]!));
        if (
          Number.isFinite(hz) &&
          hz >= lo * 0.975 &&
          hz <= hi * 1.025 &&
          rms >= threshold
        ) {
          this.outHz = hz;
          this.outRms = rms;
          found = true;
        }
      }
      this.crossing[dir] = crossing;
      this.armed[dir] = false;
      this.energy[dir] = 0;
      this.count[dir] = 0;
    }
    this.previous = x;
    return found;
  }
}

interface PickSettings {
  gate: number;
  ratio: number;
  rearm: number;
  hold: number;
  gap: number;
  release: number;
  decay: number;
  attack: number;
  relax: number;
  repeat: boolean;
}

class PickDetector {
  peak = 0;
  baseline = 0;
  hold = 0;
  quiet = 0;
  cooldown = 0;
  audible = false;
  armed = false;

  reset(): void {
    this.peak = 0;
    this.baseline = 0;
    this.hold = 0;
    this.quiet = 0;
    this.cooldown = 0;
    this.audible = false;
    this.armed = false;
  }

  push(x: number, s: PickSettings): 0 | 1 | 2 {
    const amplitude = Math.abs(x);
    this.quiet = amplitude >= s.gate ? 0 : this.quiet + 1;

    if (amplitude >= this.peak) {
      this.peak = amplitude;
      this.hold = s.hold;
    } else if (this.hold > 0) {
      this.hold -= 1;
    } else {
      this.peak *= s.decay;
    }

    if (this.cooldown > 0) {
      this.cooldown -= 1;
    }

    if (!this.audible && amplitude >= s.gate) {
      this.audible = true;
      this.armed = false;
      this.cooldown = s.gap;
      this.baseline = this.peak;
      return 1;
    }

    if (this.quiet >= s.release) {
      this.audible = false;
      this.armed = false;
      this.baseline = this.peak;
      return 0;
    }

    const reference = Math.max(this.baseline, s.gate);
    const rise = this.peak / reference;
    if (rise < s.rearm) {
      this.armed = true;
    }

    const picked =
      this.audible &&
      s.repeat &&
      this.armed &&
      this.cooldown === 0 &&
      rise >= s.ratio &&
      this.peak >= s.gate;

    const coefficient = this.peak > this.baseline ? s.attack : s.relax;
    this.baseline += (this.peak - this.baseline) * coefficient;

    if (picked) {
      this.cooldown = s.gap;
      this.armed = false;
      this.baseline = this.peak;
      return 2;
    }
    return 0;
  }
}

export class HendrixProcessor {
  readonly output = new ProcessorOutput();
  private readonly values = new Float32Array(20);
  private rate = 12000;
  private step = 4;
  private acc = 0;
  private accCount = 0;

  private readonly ring = new Float32Array(MAX_FRAME);
  private at = 0;
  private filled = 0;
  private hop = 0;

  private readonly frame = new Float32Array(MAX_FRAME);
  private readonly difference = new Float32Array(MAX_FRAME / 2 + 1);
  private readonly fft = new Radix2Fft(FFT_SIZE);
  private readonly specRe = new Float32Array(FFT_SIZE);
  private readonly specIm = new Float32Array(FFT_SIZE);
  private readonly magnitudes = new Float32Array(FFT_SIZE / 2 + 1);

  private readonly peakHz = new Float32Array(MAX_PEAKS);
  private readonly peakAmp = new Float32Array(MAX_PEAKS);
  private readonly peakOrder = new Uint8Array(MAX_PEAKS);
  private readonly acceptedHz = new Float32Array(MAX_PEAKS);
  private readonly acceptedAmp = new Float32Array(MAX_PEAKS);
  private readonly acceptedOrder = new Uint8Array(MAX_PEAKS);

  private readonly candidate = new Uint32Array(128);
  private readonly missing = new Uint32Array(128);
  private readonly held = new Uint8Array(128);
  private readonly wanted = new Uint8Array(128);

  private readonly firstCycle = new FirstCycle();
  private readonly picks = new PickDetector();

  private hasProvisional = false;
  private provisionalNote = 0;
  private provisionalAge = 0;

  private hasAcquisition = false;
  private acqAge = 0;
  private acqHasFound = false;
  private acqNote = 0;
  private acqHz = 0;
  private acqRms = 0;
  private acqRepick = false;

  private rejected = false;

  private readonly pickSettings: PickSettings = {
    gate: 0,
    ratio: 1,
    rearm: 1,
    hold: 1,
    gap: 1,
    release: 1,
    decay: 1,
    attack: 1,
    relax: 1,
    repeat: true,
  };

  constructor() {
    for (let i = 0; i < HENDRIX_PARAMETERS.length; i++) {
      this.values[i] = HENDRIX_PARAMETERS[i]!.default;
    }
  }

  getParameterValues(): Readonly<Float32Array> {
    return this.values;
  }

  prepare(sampleRate: number): void {
    const sr = Number.isFinite(sampleRate) && sampleRate >= 8000 ? sampleRate : 48000;
    this.step = Math.max(1, Math.round(sr / 12000));
    this.rate = sr / this.step;
    this.reset();
    this.output.windowMs = this.direct() ? 0 : (this.length() * 1000) / this.rate;
  }

  reset(): void {
    this.release();
    this.ring.fill(0);
    this.at = 0;
    this.filled = 0;
    this.hop = 0;
    this.acc = 0;
    this.accCount = 0;
  }

  setParam(idOrIndex: string | number, value: number): boolean {
    const index =
      typeof idOrIndex === 'number'
        ? idOrIndex
        : HENDRIX_PARAMETERS.findIndex((p) => p.id === idOrIndex);
    const param = HENDRIX_PARAMETERS[index];
    if (!param) return false;
    const clamped = clampParam(param, value);
    if (this.values[index] === clamped) return true;
    if (
      index === 0 ||
      index === 1 ||
      index === 5 ||
      index === 6 ||
      index === 8 ||
      index === 9 ||
      index === 11 ||
      index === 13 ||
      index === 14 ||
      index === 16
    ) {
      this.release();
    }
    this.values[index] = clamped;
    if (index === 11 || index === 0 || index === 16) {
      this.output.windowMs = this.direct() ? 0 : (this.length() * 1000) / this.rate;
    }
    return true;
  }

  param(idOrIndex: string | number): number | undefined {
    const index =
      typeof idOrIndex === 'number'
        ? idOrIndex
        : HENDRIX_PARAMETERS.findIndex((p) => p.id === idOrIndex);
    return this.values[index];
  }

  applyConfig(config: Partial<AudioToMidiConfig>): void {
    if (config.mode !== undefined) this.setParam(0, config.mode === 'poly' ? 1 : 0);
    if (config.midiEnabled !== undefined) this.setParam(1, config.midiEnabled ? 1 : 0);
    if (config.inputThresholdDb !== undefined) this.setParam(2, config.inputThresholdDb);
    if (config.noteStabilityMs !== undefined) this.setParam(3, config.noteStabilityMs);
    if (config.releaseMs !== undefined) this.setParam(4, config.releaseMs);
    if (config.lowestNote !== undefined) this.setParam(5, config.lowestNote);
    if (config.highestNote !== undefined) this.setParam(6, config.highestNote);
    if (config.maxVoices !== undefined) this.setParam(7, config.maxVoices);
    if (config.referenceA4Hz !== undefined) this.setParam(8, config.referenceA4Hz);
    if (config.transposeSemitones !== undefined) this.setParam(9, config.transposeSemitones);
    if (config.fixedVelocity !== undefined) this.setParam(10, config.fixedVelocity);
    if (config.verification !== undefined) {
      const v = config.verification === 'fast' ? 0 : config.verification === 'accurate' ? 2 : 1;
      this.setParam(11, v);
    }
    if (config.monoBends !== undefined) this.setParam(13, config.monoBends ? 1 : 0);
    if (config.bendRange !== undefined) {
      const r = config.bendRange === 24 ? 2 : config.bendRange === 12 ? 1 : 0;
      this.setParam(14, r);
    }
    if (config.bendSmoothingMs !== undefined) this.setParam(15, config.bendSmoothingMs);
    if (config.monoWindow !== undefined) {
      const w =
        config.monoWindow === '5ms'
          ? 1
          : config.monoWindow === '10ms'
            ? 2
            : config.monoWindow === '15ms'
              ? 3
              : 0;
      this.setParam(16, w);
    }
    if (config.monoRetriggerOnPick !== undefined) {
      this.setParam(17, config.monoRetriggerOnPick ? 1 : 0);
    }
    if (config.pickThresholdDb !== undefined) this.setParam(18, config.pickThresholdDb);
    if (config.pickMinIntervalMs !== undefined) this.setParam(19, config.pickMinIntervalMs);
  }

  toConfig(): AudioToMidiConfig {
    const v = this.values;
    const verIndex = Math.round(v[11]!);
    const bendIdx = Math.round(v[14]!);
    const winIdx = Math.round(v[16]!);
    return {
      mode: v[0]! < 0.5 ? 'mono' : 'poly',
      midiEnabled: v[1]! >= 0.5,
      inputThresholdDb: v[2]!,
      noteStabilityMs: v[3]!,
      releaseMs: v[4]!,
      lowestNote: v[5]!,
      highestNote: v[6]!,
      maxVoices: v[7]!,
      referenceA4Hz: v[8]!,
      transposeSemitones: v[9]!,
      fixedVelocity: v[10]!,
      verification: verIndex === 0 ? 'fast' : verIndex === 2 ? 'accurate' : 'balanced',
      monoBends: v[13]! >= 0.5,
      bendRange: bendIdx === 2 ? 24 : bendIdx === 1 ? 12 : 2,
      bendSmoothingMs: v[15]!,
      monoWindow: winIdx === 1 ? '5ms' : winIdx === 2 ? '10ms' : winIdx === 3 ? '15ms' : 'direct',
      monoRetriggerOnPick: v[17]! >= 0.5,
      pickThresholdDb: v[18]!,
      pickMinIntervalMs: v[19]!,
    };
  }

  /**
   * Processes mono or multi-channel audio in-place without allocating memory.
   */
  process(channels: readonly Float32Array[], frames?: number): void {
    if (channels.length === 0) return;
    let n = frames ?? channels[0]!.length;
    for (let c = 0; c < channels.length; c++) {
      if (channels[c]!.length < n) n = channels[c]!.length;
    }
    if (n <= 0) return;

    const direct = this.direct();
    const minNote = Math.min(this.values[5]!, this.values[6]!);
    const maxNote = Math.max(this.values[5]!, this.values[6]!);
    const lo = this.frequency(minNote);
    const hi = this.frequency(maxNote);
    const stable =
      !this.hasAcquisition &&
      !this.hasProvisional &&
      !this.rejected &&
      this.anyHeld();
    const hz = stable ? Math.max(this.output.hz, lo) : lo;
    const ratio = Math.pow(10, this.values[18]! / 20);

    const s = this.pickSettings;
    s.gate = Math.pow(10, this.values[2]! / 20);
    s.ratio = ratio;
    s.rearm = Math.sqrt(ratio);
    s.hold = Math.ceil((this.rate / hz) * 1.15);
    s.gap = Math.round(this.values[19]! * 0.001 * this.rate);
    s.release = Math.round(this.values[4]! * 0.001 * this.rate);
    s.decay = Math.exp(-1 / (this.rate * 0.01));
    s.attack = 1 - Math.exp(-1 / (this.rate * 0.008));
    s.relax = 1 - Math.exp(-1 / (this.rate * 0.08));
    s.repeat = this.values[17]! >= 0.5;

    const deadline = Math.round(this.limitMs() * 0.001 * this.rate);
    const numCh = channels.length;

    for (let i = 0; i < n; i++) {
      let x = 0;
      for (let c = 0; c < numCh; c++) {
        const v = channels[c]![i]!;
        if (Number.isFinite(v)) {
          x += Math.max(-16, Math.min(16, v));
        }
      }
      x /= numCh;
      this.acc += x;
      this.accCount += 1;

      if (this.accCount === this.step) {
        const sample = this.acc / this.step;
        this.ring[this.at] = sample;
        this.at = (this.at + 1) % MAX_FRAME;
        if (this.filled < MAX_FRAME) this.filled += 1;
        this.acc = 0;
        this.accCount = 0;

        if (direct) {
          this.directSample(sample, s, lo, hi, deadline);
        }
        this.hop += 1;
        if (this.hop >= HOP && this.filled >= this.length()) {
          this.hop = 0;
          this.analyse();
        }
      }
    }

    if (this.values[12]! < 0.5) {
      for (let c = 0; c < numCh; c++) {
        channels[c]!.fill(0, 0, n);
      }
    }
    this.output.serial = (this.output.serial + 1) >>> 0;
  }

  private anyHeld(): boolean {
    for (let i = 0; i < 128; i++) {
      if (this.held[i]! > 0) return true;
    }
    return false;
  }

  private length(): number {
    const idx = Math.round(this.values[11]!);
    const n = idx === 0 ? 512 : idx === 2 ? 2048 : 1024;
    if (this.direct()) {
      const minNote = Math.min(this.values[5]!, this.values[6]!);
      const periods = Math.ceil((2 * this.rate) / this.frequency(minNote));
      const nextPow2 = 1 << Math.ceil(Math.log2(Math.max(2, periods)));
      return Math.min(MAX_FRAME, Math.max(n, nextPow2));
    }
    return n;
  }

  private direct(): boolean {
    return this.values[0]! < 0.5;
  }

  private limitMs(): number {
    const idx = Math.round(this.values[16]!);
    return idx === 1 ? 5 : idx === 2 ? 10 : idx === 3 ? 15 : 0;
  }

  private clearNotes(): void {
    this.output.clear();
    this.held.fill(0);
    this.candidate.fill(0);
    this.missing.fill(0);
    this.hasProvisional = false;
  }

  private release(): void {
    this.clearNotes();
    this.firstCycle.reset();
    this.picks.reset();
    this.hasAcquisition = false;
    this.acqHasFound = false;
    this.rejected = false;
  }

  private velocity(db: number): number {
    if (this.values[10]! >= 1) {
      return Math.round(this.values[10]!);
    }
    return Math.max(1, Math.min(127, Math.floor(((db + 60) / 54) * 126 + 1)));
  }

  private frequency(note: number): number {
    return this.values[8]! * Math.pow(2, (note - 69) / 12);
  }

  private noteNumber(hz: number): number | null {
    const n = 69 + 12 * Math.log2(hz / this.values[8]!);
    const rounded = Math.round(n);
    const limit = this.limitMs();
    const allowed = !this.direct() || limit === 0 || 1000 / hz <= limit + 0.001;
    const lo = Math.min(this.values[5]!, this.values[6]!);
    const hi = Math.max(this.values[5]!, this.values[6]!);
    if (
      allowed &&
      Number.isFinite(n) &&
      Math.abs(n - rounded) < 0.42 &&
      rounded >= lo &&
      rounded <= hi
    ) {
      return rounded;
    }
    return null;
  }

  private directSample(
    x: number,
    settings: PickSettings,
    lo: number,
    hi: number,
    deadline: number,
  ): void {
    if (this.hasProvisional) {
      this.provisionalAge += 1;
    }
    const onset = this.picks.push(x, settings);
    if (onset > 0 && this.values[1]! >= 0.5) {
      this.hasAcquisition = true;
      this.acqAge = 0;
      this.acqHasFound = false;
      this.acqRepick = onset === 2;
      this.rejected = false;
      this.firstCycle.reset();
      this.hasProvisional = false;
    }
    if (onset === 0 && this.hasAcquisition) {
      this.acqAge += 1;
    }
    if (this.firstCycle.push(x, this.rate, lo, hi, settings.gate)) {
      const hz = this.firstCycle.outHz;
      const rms = this.firstCycle.outRms;
      this.output.windowMs = 1000 / hz;
      const note = this.noteNumber(hz);
      if (note !== null && this.hasAcquisition) {
        this.acqHasFound = true;
        this.acqNote = note;
        this.acqHz = hz;
        this.acqRms = rms;
      }
    }

    const ready =
      this.hasAcquisition &&
      (deadline === 0 ? this.acqHasFound : this.acqAge >= deadline);

    if (ready) {
      this.hasAcquisition = false;
      if (this.acqHasFound) {
        const note = this.acqNote;
        const hz = this.acqHz;
        const rms = this.acqRms;
        const db = 20 * Math.log10(Math.max(1e-6, rms));
        const velocity = this.velocity(db);
        for (let old = 0; old < 128; old++) {
          if (old !== note && this.held[old]! > 0) {
            this.held[old] = 0;
            this.candidate[old] = 0;
            this.output.setNote(old, 0);
          }
        }
        this.held[note] = velocity;
        this.candidate[note] = Math.round(this.values[3]! * 0.001 * this.rate);
        this.missing[note] = 0;
        this.hasProvisional = true;
        this.provisionalNote = note;
        this.provisionalAge = 0;
        this.output.setNote(note, velocity);
        if (this.acqRepick) {
          this.output.attacks += 1;
        }
        this.output.bendSemitones = 0;
        this.output.levelDb = db;
        this.output.hz = hz;
      } else {
        this.clearNotes();
        this.rejected = true;
      }
    }

    if (
      this.firstCycle.quiet >= settings.release &&
      (this.hasAcquisition || this.hasProvisional || this.anyHeld())
    ) {
      const quiet = this.firstCycle.quiet;
      this.release();
      this.firstCycle.quiet = quiet;
      this.picks.quiet = quiet;
    }
  }

  private mono(n: number): number | null {
    const lo = this.frequency(Math.min(this.values[5]!, this.values[6]!));
    const hi = this.frequency(Math.max(this.values[5]!, this.values[6]!));
    const maxTau = Math.min(n >> 1, Math.floor(this.rate / lo));
    const minTau = Math.max(2, Math.floor(this.rate / hi));
    if (maxTau <= minTau + 2) return null;

    const width = n - maxTau;
    let running = 0;
    this.difference[0] = 1;
    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      for (let j = 0; j < width; j++) {
        const d = this.frame[j]! - this.frame[j + tau]!;
        sum += d * d;
      }
      running += sum;
      this.difference[tau] = running > 1e-16 ? (sum * tau) / running : 1;
    }

    let tau = minTau;
    while (tau < maxTau) {
      if (this.difference[tau]! < 0.14) {
        while (tau + 1 < maxTau && this.difference[tau + 1]! < this.difference[tau]!) {
          tau += 1;
        }
        const a = this.difference[tau - 1]!;
        const b = this.difference[tau]!;
        const c = this.difference[tau + 1]!;
        const d = a - 2 * b + c;
        const shift =
          Math.abs(d) > 1e-12 ? Math.max(-1, Math.min(1, (0.5 * (a - c)) / d)) : 0;
        return this.rate / (tau + shift);
      }
      tau += 1;
    }
    return null;
  }

  private poly(n: number, wanted: Uint8Array, velocity: number): void {
    this.specRe.fill(0);
    this.specIm.fill(0);
    for (let i = 0; i < n; i++) {
      this.specRe[i] =
        this.frame[i]! * (0.5 - 0.5 * Math.cos((TAU * i) / (n - 1)));
    }
    this.fft.forward(this.specRe, this.specIm);

    let maximum = 0;
    let arithmetic = 0;
    let geometric = 0;
    let count = 0;
    const halfFft = FFT_SIZE >> 1;

    for (let i = 1; i <= halfFft; i++) {
      const a = Math.hypot(this.specRe[i]!, this.specIm[i]!);
      this.magnitudes[i] = a;
      if (a > maximum) maximum = a;
      if (i > 5) {
        arithmetic += a;
        geometric += Math.log(Math.max(1e-12, a));
        count += 1;
      }
    }

    if (
      maximum < 1e-8 ||
      Math.exp(geometric / count) / Math.max(1e-12, arithmetic / count) > 0.65
    ) {
      return;
    }

    let used = 0;
    const minimum =
      this.frequency(Math.min(this.values[5]!, this.values[6]!)) * 0.96;
    let i = Math.max(2, Math.floor((minimum * FFT_SIZE) / this.rate));

    while (i < halfFft - 1) {
      const a = this.magnitudes[i]!;
      if (
        a > maximum * 0.1 &&
        a > this.magnitudes[i - 1]! &&
        a >= this.magnitudes[i + 1]!
      ) {
        const l = Math.log(Math.max(1e-12, this.magnitudes[i - 1]!));
        const m = Math.log(a);
        const r = Math.log(Math.max(1e-12, this.magnitudes[i + 1]!));
        const denom = l - 2 * m + r;
        const shift =
          Math.abs(denom) > 1e-12
            ? Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / denom))
            : 0;
        const hz = ((i + shift) * this.rate) / FFT_SIZE;

        if (used < MAX_PEAKS) {
          this.peakHz[used] = hz;
          this.peakAmp[used] = a;
          used += 1;
        } else {
          let weakest = 0;
          for (let k = 1; k < used; k++) {
            if (this.peakAmp[k]! < this.peakAmp[weakest]!) {
              weakest = k;
            }
          }
          if (a > this.peakAmp[weakest]!) {
            this.peakHz[weakest] = hz;
            this.peakAmp[weakest] = a;
          }
        }
      }
      i += 1;
    }

    // In-place insertion sort on indices by ascending frequency
    for (let k = 0; k < used; k++) this.peakOrder[k] = k;
    for (let k = 1; k < used; k++) {
      const idx = this.peakOrder[k]!;
      const hz = this.peakHz[idx]!;
      let j = k - 1;
      while (j >= 0 && this.peakHz[this.peakOrder[j]!]! > hz) {
        this.peakOrder[j + 1] = this.peakOrder[j]!;
        j -= 1;
      }
      this.peakOrder[j + 1] = idx;
    }

    let valid = 0;
    for (let k = 0; k < used; k++) {
      const idx = this.peakOrder[k]!;
      const pHz = this.peakHz[idx]!;
      const pAmp = this.peakAmp[idx]!;
      let harmonic = false;
      for (let b = 0; b < valid; b++) {
        const bHz = this.acceptedHz[b]!;
        const bAmp = this.acceptedAmp[b]!;
        const h = Math.round(pHz / bHz);
        if (
          h >= 2 &&
          h <= 16 &&
          Math.abs(12 * Math.log2(pHz / (bHz * h))) < 0.32 &&
          pAmp < bAmp * (1.25 / Math.sqrt(h))
        ) {
          harmonic = true;
          break;
        }
      }
      if (!harmonic) {
        this.acceptedHz[valid] = pHz;
        this.acceptedAmp[valid] = pAmp;
        this.acceptedOrder[valid] = valid;
        valid += 1;
      }
    }

    // In-place insertion sort on accepted indices by descending amplitude
    for (let k = 1; k < valid; k++) {
      const idx = this.acceptedOrder[k]!;
      const amp = this.acceptedAmp[idx]!;
      let j = k - 1;
      while (j >= 0 && this.acceptedAmp[this.acceptedOrder[j]!]! < amp) {
        this.acceptedOrder[j + 1] = this.acceptedOrder[j]!;
        j -= 1;
      }
      this.acceptedOrder[j + 1] = idx;
    }

    let voices = 0;
    const maxVoices = Math.round(this.values[7]!);
    for (let k = 0; k < valid; k++) {
      const idx = this.acceptedOrder[k]!;
      const note = this.noteNumber(this.acceptedHz[idx]!);
      if (note !== null && wanted[note]! === 0) {
        wanted[note] = Math.max(
          1,
          Math.round(velocity * Math.sqrt(this.acceptedAmp[idx]! / maximum)),
        );
        voices += 1;
        if (voices >= maxVoices) break;
      }
    }
  }

  private analyse(): void {
    const n = this.length();
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const sample = this.ring[(this.at + MAX_FRAME - n + i) % MAX_FRAME]!;
      this.frame[i] = sample;
      sum += sample;
    }
    const mean = sum / n;
    let energy = 0;
    for (let i = 0; i < n; i++) {
      const x = this.frame[i]! - mean;
      this.frame[i] = x;
      energy += x * x;
    }
    const rms = Math.sqrt(energy / n);
    const db = 20 * Math.log10(Math.max(1e-6, rms));
    this.output.levelDb = db;

    if (!this.direct()) {
      this.output.windowMs = (n * 1000) / this.rate;
    }

    if (
      this.direct() &&
      (this.hasAcquisition ||
        this.rejected ||
        (this.hasProvisional && this.provisionalAge < n) ||
        !this.anyHeld())
    ) {
      return;
    }

    const velocity = this.velocity(db);
    this.wanted.fill(0);
    let hz = 0;
    let bend: number | null = null;

    if (db >= this.values[2]! && this.values[1]! >= 0.5) {
      if (this.values[0]! < 0.5) {
        const f = this.mono(n);
        if (f !== null) {
          hz = f;
          if (this.hasProvisional) {
            const old = this.provisionalNote;
            const age = this.provisionalAge;
            const note = this.noteNumber(f);
            if (note !== null) {
              if (
                old !== note &&
                (this.values[13]! < 0.5 || Math.abs(old - note) >= 11)
              ) {
                if (this.limitMs() > 0) {
                  this.clearNotes();
                  this.rejected = true;
                  return;
                }
                this.held[old] = 0;
                this.candidate[old] = 0;
                this.output.setNote(old, 0);
                this.held[note] = velocity;
                this.output.setNote(note, velocity);
                this.hasProvisional = false;
              } else if (age >= n * 2) {
                this.hasProvisional = false;
              }
            }
          }

          if (this.values[13]! >= 0.5) {
            const pitch = 69 + 12 * Math.log2(f / this.values[8]!);
            let anchor = -1;
            for (let k = 0; k < 128; k++) {
              if (this.held[k]! > 0) {
                anchor = k;
                break;
              }
            }
            if (anchor === -1) {
              const nn = this.noteNumber(f);
              if (nn !== null) anchor = nn;
            }
            if (anchor !== -1) {
              this.wanted[anchor] = velocity;
              const rangeIdx = Math.round(this.values[14]!);
              const range = rangeIdx === 2 ? 24 : rangeIdx === 1 ? 12 : 2;
              bend = Math.max(-range, Math.min(range, pitch - anchor));
            }
          } else {
            const note = this.noteNumber(f);
            if (note !== null) {
              this.wanted[note] = velocity;
            }
          }
        }
      } else {
        this.poly(n, this.wanted, velocity);
      }
    }

    if (bend !== null) {
      const previous = this.output.bendSemitones;
      const alpha =
        this.values[15]! > 0
          ? 1 - Math.exp(-HOP / (this.rate * this.values[15]! * 0.001))
          : 1;
      this.output.bendSemitones = previous + (bend - previous) * alpha;
    }

    this.output.hz = hz;
    const stable = Math.round(this.values[3]! * 0.001 * this.rate);
    const release = Math.round(this.values[4]! * 0.001 * this.rate);

    for (let note = 0; note < 128; note++) {
      if (this.wanted[note]! > 0) {
        this.missing[note] = 0;
        this.candidate[note] = this.candidate[note]! + HOP;
        if (
          this.held[note]! === 0 &&
          this.candidate[note]! >= stable &&
          (!this.direct() || this.limitMs() === 0)
        ) {
          this.held[note] = this.wanted[note]!;
          this.output.setNote(note, this.held[note]!);
        }
      } else {
        this.candidate[note] = 0;
        this.missing[note] = this.missing[note]! + HOP;
        if (this.held[note]! > 0 && this.missing[note]! >= release) {
          this.held[note] = 0;
          this.output.setNote(note, 0);
        }
      }
    }

    if (!this.anyHeld()) {
      this.output.bendSemitones = 0;
    }
  }
}
