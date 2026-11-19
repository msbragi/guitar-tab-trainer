import { describe, expect, it, vi } from 'vitest';
import { CountIn, countInBeatSeconds } from '../src/app/practice/count-in.js';

function setup(resume: () => Promise<void> = async () => {}) {
  const nodes: { frequency: { value: number }; connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; onended: (() => void) | null }[] = [];
  const context = { currentTime: 10, destination: {}, resume,
    close: vi.fn(async () => {}),
    createGain: () => ({ gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }),
    createOscillator: () => {
      const node = { frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null as (() => void) | null };
      nodes.push(node); return node;
    },
  };
  return { context, nodes, countIn: new CountIn(() => context as unknown as AudioContext) };
}
const timing = { tempo: 120, numerator: 4, denominator: 4, speed: 1 };

describe('conteggio preparatorio', () => {
  it('segue BPM, denominatore e velocità senza avanzare il trasporto musicale', () => {
    expect(countInBeatSeconds(timing)).toBe(0.5);
    expect(countInBeatSeconds({ ...timing, numerator: 6, denominator: 8, speed: 0.5 })).toBe(0.5);
    expect(countInBeatSeconds({ ...timing, speed: 2 })).toBe(0.25);
    expect(() => countInBeatSeconds({ ...timing, tempo: 0 })).toThrow();
  });
  it('schedula una battuta completa e avvia il playback soltanto dopo l’ultimo movimento', async () => {
    const { context, nodes, countIn } = setup();
    const beat = vi.fn(); const complete = vi.fn();
    await countIn.start(timing, beat, complete);
    expect(nodes).toHaveLength(5);
    expect(nodes[0]!.start).toHaveBeenCalledWith(10.05);
    expect(nodes[3]!.start).toHaveBeenCalledWith(11.55);
    expect(nodes[4]!.stop).toHaveBeenCalledWith(12.05);
    nodes[3]!.onended!(); expect(beat).toHaveBeenCalledWith(1);
    expect(complete).not.toHaveBeenCalled();
    nodes[4]!.onended!(); expect(complete).toHaveBeenCalledOnce(); expect(context.close).toHaveBeenCalledOnce();
  });
  it('annulla callback tardivi e libera l’audio su stop o cambio file', async () => {
    const { context, nodes, countIn } = setup(); const complete = vi.fn(); const beat = vi.fn();
    await countIn.start(timing, beat, complete); countIn.cancel();
    nodes[0]!.onended!(); nodes.at(-1)!.onended!();
    expect(complete).not.toHaveBeenCalled(); expect(beat).not.toHaveBeenCalled(); expect(context.close).toHaveBeenCalledOnce();
  });
  it('gestisce cancellazione durante resume e permesso audio rifiutato', async () => {
    let resume = () => {};
    const deferred = setup(() => new Promise<void>((resolve) => { resume = resolve; }));
    const complete = vi.fn(); const pending = deferred.countIn.start(timing, vi.fn(), complete);
    deferred.countIn.cancel(); resume(); await pending;
    expect(deferred.nodes).toHaveLength(0); expect(complete).not.toHaveBeenCalled();
    const failed = setup(async () => { throw new Error('audio-denied'); });
    await expect(failed.countIn.start(timing, vi.fn(), complete)).rejects.toThrow('audio-denied');
    expect(failed.context.close).toHaveBeenCalledOnce();
  });
});
