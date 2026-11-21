import type { AudioToMidiPort, TunerReading } from '@guitar-practice/core';
import {
  HendrixAudioToMidiEngine,
  MidiRecording,
  extractNotes,
} from '@guitar-practice/audio-engine';
import {
  type VariantNote,
  mapTranscribedNotesToVariantNotes,
} from '@guitar-practice/study-project';

export interface GuitarCaptureStatus {
  readonly active: boolean;
  readonly recordingWindow: boolean;
  readonly monitor: boolean;
  readonly levelDb: number;
  readonly tuner: TunerReading | null;
  readonly error: string | null;
}

export interface GuitarCaptureResult {
  readonly notes: VariantNote[];
  readonly smfBytes: Uint8Array;
  readonly sampleRate: number;
  readonly totalSamples: number;
}

export function initialGuitarCaptureStatus(): GuitarCaptureStatus {
  return {
    active: false,
    recordingWindow: false,
    monitor: false,
    levelDb: -96,
    tuner: null,
    error: null,
  };
}

/**
 * Browser Web Audio capture + AudioToMidiPort runner independent of Angular.
 * Collects MIDI events strictly between beginWindow() (Punch-In) and endWindow() (Punch-Out),
 * while continuously updating tuner and input level outside the recording window.
 */
export class GuitarCapture {
  private context: AudioContext | undefined;
  private stream: MediaStream | undefined;
  private source: MediaStreamAudioSourceNode | undefined;
  private processor: ScriptProcessorNode | undefined;
  private monitorGain: GainNode | undefined;
  private silentGain: GainNode | undefined;
  private engine: AudioToMidiPort | undefined;
  private recording: MidiRecording | undefined;
  private windowActive = false;
  private windowStartSample = 0;
  private sampleRate = 48000;
  private monitor = false;
  private statusListener: ((status: GuitarCaptureStatus) => void) | undefined;

  constructor(
    private readonly engineFactory: (sampleRate: number) => AudioToMidiPort = (sr) =>
      new HendrixAudioToMidiEngine(sr),
  ) {}

  isActive(): boolean {
    return this.context !== undefined;
  }

  isRecordingWindow(): boolean {
    return this.windowActive;
  }

  setMonitor(enabled: boolean): void {
    this.monitor = enabled;
    if (this.monitorGain) {
      this.monitorGain.gain.value = enabled ? 1 : 0;
    }
    this.emitStatus(null);
  }

  async start(onStatus: (status: GuitarCaptureStatus) => void): Promise<void> {
    if (this.context) return;
    this.statusListener = onStatus;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const error = 'microphone-unavailable';
      onStatus({ ...initialGuitarCaptureStatus(), monitor: this.monitor, error });
      throw new Error(error);
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      const context = new AudioContext();
      await context.resume();

      this.stream = stream;
      this.context = context;
      this.sampleRate = context.sampleRate;

      const engine = this.engineFactory(this.sampleRate);
      engine.prepare(this.sampleRate);
      this.engine = engine;

      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(1024, 1, 1);
      const monitorGain = context.createGain();
      monitorGain.gain.value = this.monitor ? 1 : 0;
      const silentGain = context.createGain();
      silentGain.gain.value = 0;

      processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.engine) return;
        const input = event.inputBuffer.getChannelData(0);
        this.engine.process(input, (midiEvent) => {
          if (this.windowActive && this.recording) {
            const relSample = Math.max(0, midiEvent.sample - this.windowStartSample);
            this.recording.push({ sample: relSample, data: midiEvent.data });
          }
        });
        this.emitStatus(null);
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(context.destination);

      source.connect(monitorGain);
      monitorGain.connect(context.destination);

      this.source = source;
      this.processor = processor;
      this.monitorGain = monitorGain;
      this.silentGain = silentGain;
      this.emitStatus(null);
    } catch (err: unknown) {
      this.stop();
      const message = err instanceof Error ? err.message : 'microphone-failed';
      onStatus({ ...initialGuitarCaptureStatus(), monitor: this.monitor, error: message });
      throw err;
    }
  }

  beginWindow(): void {
    if (!this.engine) return;
    this.engine.reset();
    this.windowStartSample = this.engine.samplePosition();
    this.recording = MidiRecording.create(this.sampleRate, 0);
    this.windowActive = true;
    this.emitStatus(null);
  }

  endWindow(options: {
    readonly totalPhraseTicks: number;
    readonly openTuningMidi?: readonly number[];
    readonly preferredFretByTick?: (tickOffset: number) => number | undefined;
  }): GuitarCaptureResult {
    this.windowActive = false;
    if (!this.engine || !this.recording) {
      this.emitStatus(null);
      return {
        notes: [],
        smfBytes: new Uint8Array(0),
        sampleRate: this.sampleRate,
        totalSamples: 1,
      };
    }

    this.engine.reset((midiEvent) => {
      if (this.recording) {
        const relSample = Math.max(0, midiEvent.sample - this.windowStartSample);
        this.recording.push({ sample: relSample, data: midiEvent.data });
      }
    });

    const totalSamples = Math.max(1, this.engine.samplePosition() - this.windowStartSample);
    const events = this.recording.events();
    const transcribed = extractNotes(events, totalSamples);
    const notes = mapTranscribedNotesToVariantNotes({
      transcribed,
      sampleRate: this.sampleRate,
      totalPhraseTicks: options.totalPhraseTicks,
      totalPhraseSamples: totalSamples,
      openTuningMidi: options.openTuningMidi,
      preferredFretByTick: options.preferredFretByTick,
    });
    const smfBytes = this.recording.toSmf(totalSamples);
    this.recording = undefined;
    this.emitStatus(null);

    return {
      notes,
      smfBytes,
      sampleRate: this.sampleRate,
      totalSamples,
    };
  }

  stop(): void {
    this.windowActive = false;
    this.recording = undefined;
    if (this.processor) {
      this.processor.onaudioprocess = null;
      this.processor.disconnect();
      this.processor = undefined;
    }
    this.source?.disconnect();
    this.source = undefined;
    this.monitorGain?.disconnect();
    this.monitorGain = undefined;
    this.silentGain?.disconnect();
    this.silentGain = undefined;
    this.engine = undefined;
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = undefined;
    }
    if (this.context) {
      void this.context.close().catch(() => {});
      this.context = undefined;
    }
    this.statusListener?.({ ...initialGuitarCaptureStatus(), monitor: this.monitor });
  }

  private emitStatus(error: string | null): void {
    if (!this.statusListener) return;
    if (!this.engine) {
      this.statusListener({ ...initialGuitarCaptureStatus(), monitor: this.monitor, error });
      return;
    }
    const telemetry = this.engine.telemetry();
    this.statusListener({
      active: this.context !== undefined,
      recordingWindow: this.windowActive,
      monitor: this.monitor,
      levelDb: telemetry.levelDb,
      tuner: this.engine.tuner(),
      error,
    });
  }
}
