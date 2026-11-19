export interface CountInTiming {
  readonly tempo: number;
  readonly numerator: number;
  readonly denominator: number;
  readonly speed: number;
}

export function countInBeatSeconds(timing: CountInTiming): number {
  const { tempo, numerator, denominator, speed } = timing;
  if (![tempo, numerator, denominator, speed].every((value) => Number.isFinite(value) && value > 0)
    || !Number.isInteger(numerator) || !Number.isInteger(denominator)) throw new Error('invalid-count-in');
  return 60 / tempo * (4 / denominator) / speed;
}

/** Preparatory clicks only. alphaTab remains the clock once song playback starts. */
export class CountIn {
  private context: AudioContext | undefined;
  private generation = 0;

  constructor(private readonly createContext = () => new AudioContext()) {}

  cancel(): void {
    this.generation++;
    const context = this.context; this.context = undefined;
    if (context) void context.close().catch(() => {});
  }

  async start(timing: CountInTiming, onBeat: (remaining: number) => void, complete: () => void): Promise<void> {
    const seconds = countInBeatSeconds(timing);
    this.cancel();
    const generation = this.generation;
    const context = this.createContext(); this.context = context;
    try {
      await context.resume();
      if (generation !== this.generation) return;
      const start = context.currentTime + 0.05;
      for (let beat = 0; beat < timing.numerator; beat++) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const at = start + beat * seconds;
        const duration = Math.min(0.04, seconds / 2);
        oscillator.frequency.value = beat === 0 ? 1100 : 800;
        gain.gain.setValueAtTime(0.18, at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + duration);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.onended = () => {
          if (generation === this.generation) onBeat(timing.numerator - beat);
          oscillator.disconnect(); gain.disconnect();
        };
        oscillator.start(at); oscillator.stop(at + duration);
      }
      // A silent scheduled node marks the end of the entire bar, including its last beat.
      const finish = context.createOscillator();
      const silence = context.createGain(); silence.gain.value = 0;
      finish.connect(silence); silence.connect(context.destination);
      finish.onended = () => {
        finish.disconnect(); silence.disconnect();
        if (generation !== this.generation) return;
        this.cancel(); complete();
      };
      finish.start(start); finish.stop(start + timing.numerator * seconds);
    } catch (error: unknown) {
      if (generation === this.generation) this.cancel();
      throw error;
    }
  }
}
