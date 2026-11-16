import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Settings } from '@coderline/alphatab';
const fake = vi.hoisted(() => ({ initialize: vi.fn() }));
vi.mock('@coderline/alphatab', () => ({ Environment: { initializeMain: fake.initialize } }));
import { configureAudioRuntime } from '../src/browser-audio-runtime.js';

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('risorse browser attraverso API pubbliche', () => {
  it('risolve URL locali e termina anche worker senza ack dopo errore o cleanup', async () => {
    class WorkerStub {
      listener: ((event: { preventDefault(): void }) => void) | undefined;
      terminate = vi.fn();
      constructor(readonly url: URL, readonly options: WorkerOptions) {}
      addEventListener(_name: string, listener: (event: { preventDefault(): void }) => void) { this.listener = listener; }
    }
    vi.stubGlobal('Worker', WorkerStub);
    const failure = vi.fn(); const dispose = configureAudioRuntime(failure);
    const [createWorker, createWorklet] = fake.initialize.mock.calls[0]!;
    const settings = { core: { scriptFile: 'https://local.test/sub/assets/alphatab/alphaTab.mjs' } } as Settings;
    const worker = createWorker(settings) as WorkerStub;
    expect(worker.url.href).toBe('https://local.test/sub/assets/alphatab/alphaTab.worker.mjs');
    expect(worker.options.type).toBe('module');
    const preventDefault = vi.fn(); worker.listener!({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce(); expect(failure).toHaveBeenCalledWith(settings);
    const addModule = vi.fn().mockResolvedValue(undefined);
    await createWorklet({ audioWorklet: { addModule } }, settings);
    expect(addModule).toHaveBeenCalledWith('https://local.test/sub/assets/alphatab/alphaTab.worklet.mjs');
    addModule.mockRejectedValue(new Error('missing'));
    await expect(createWorklet({ audioWorklet: { addModule } }, settings)).rejects.toThrow('missing');
    expect(failure).toHaveBeenCalledTimes(2);
    dispose(); dispose(); expect(worker.terminate).toHaveBeenCalledOnce();
  });
});
