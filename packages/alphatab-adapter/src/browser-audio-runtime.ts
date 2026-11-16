import { Environment } from '@coderline/alphatab';
import type { Settings } from '@coderline/alphatab';

/** API pubblica 1.9.0: URL espliciti, indipendenti da import.meta.url del bundle Angular. */
export function configureAudioRuntime(onFailure: (settings: Settings) => void): () => void {
  const workers = new Set<Worker>();
  Environment.initializeMain(
    (settings) => {
      const worker = new Worker(new URL('alphaTab.worker.mjs', settings.core.scriptFile!), { type: 'module' });
      workers.add(worker);
      worker.addEventListener('error', (event) => { event.preventDefault(); onFailure(settings); });
      return worker;
    },
    async (context, settings) => {
      try { await context.audioWorklet.addModule(new URL('alphaTab.worklet.mjs', settings.core.scriptFile!).href); }
      catch (error: unknown) { onFailure(settings); throw error; }
    },
  );
  return () => { workers.forEach((worker) => worker.terminate()); workers.clear(); };
}
