import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ locale: 'en-US' });
const transport = (page: Page) => page.locator('.transport-bar');
const tick = async (page: Page) => Number(await transport(page).getAttribute('data-tick'));
const nearTick = async (page: Page, expected: number) => expect.poll(async () => Math.abs(await tick(page) - expected)).toBeLessThanOrEqual(2);
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
async function open(page: Page, file = 'tests/fixtures/alphatab/effects.gp') {
  await page.goto('/');
  await page.locator('#score-file').setInputFiles(file);
  await expect(transport(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await expect(page.getByLabel('Speed', { exact: true })).toHaveValue('1');
}
async function seek(page: Page, value: number) {
  await page.getByLabel('Playback timeline').evaluate((element, value) => {
    (element as HTMLInputElement).value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

// Misura soltanto campioni nel grafo Web Audio, non il suono del dispositivo fisico.
async function probeAudio(page: Page) {
  await page.addInitScript(() => {
    const probes: AnalyserNode[] = [];
    const outputs: string[] = [];
    Object.assign(window, { __audioProbes: probes, __audioOutputs: outputs });
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (this: AudioNode, destination: AudioNode, output = 0, input = 0) {
      if (destination === this.context.destination) {
        const analyser = this.context.createAnalyser();
        connect.call(this, analyser, output, 0);
        connect.call(analyser, destination, 0, input);
        probes.push(analyser); outputs.push(this.constructor.name);
        return destination;
      }
      return connect.call(this, destination, output, input);
    } as typeof AudioNode.prototype.connect;
  });
}
async function energy(page: Page) {
  return page.evaluate(() => {
    const probes = (window as unknown as { __audioProbes: AnalyserNode[] }).__audioProbes;
    return Math.max(0, ...probes.map((probe) => {
      const data = new Float32Array(probe.fftSize); probe.getFloatTimeDomainData(data);
      return Math.max(...data.map(Math.abs));
    }));
  });
}

test('synth locale: campioni non nulli, pausa/ripresa, stop e cleanup al cambio documento', async ({ page }) => {
  await probeAudio(page);
  const errors: string[] = []; const responses: { url: string; status: number }[] = [];
  let workers = 0; let closed = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('worker', (worker) => { workers++; worker.on('close', () => closed++); });
  page.on('response', (response) => { if (response.url().includes('/assets/alphatab/')) responses.push({ url: response.url(), status: response.status() }); });
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await open(page);
  expect(workers).toBe(1);
  await button(page, 'Play').click();
  await expect(transport(page)).toHaveAttribute('data-status', 'playing');
  await expect.poll(() => tick(page)).toBeGreaterThan(0);
  await expect.poll(() => energy(page)).toBeGreaterThan(0.0001);
  await button(page, 'Pause').click();
  await expect(transport(page)).toHaveAttribute('data-status', 'paused');
  // Attende l'assestamento della posizione di pausa, poi verifica che resti ferma.
  await page.waitForTimeout(300); const paused = await tick(page);
  await page.waitForTimeout(350); expect(await tick(page)).toBe(paused);
  await page.getByLabel('Speed', { exact: true }).selectOption('0.5');
  await button(page, 'Play').click();
  await expect(transport(page)).toHaveAttribute('data-status', 'playing');
  await expect.poll(() => tick(page)).toBeGreaterThan(paused);
  await button(page, 'Stop').click();
  await expect(transport(page)).toHaveAttribute('data-status', 'stopped');
  await nearTick(page, 0);
  await button(page, 'Play').click();
  await expect(transport(page)).toHaveAttribute('data-status', 'playing');
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(transport(page)).toHaveAttribute('data-status', 'stopped');
  await expect.poll(() => closed).toBe(1);
  await expect(page.getByLabel('Speed', { exact: true })).toHaveValue('1');
  await expect(transport(page)).toHaveAttribute('data-loop', 'false');
  await expect.poll(() => page.evaluate(() => {
    const probes = (window as unknown as { __audioProbes: AnalyserNode[] }).__audioProbes;
    return probes.every((probe) => probe.context.state === 'closed');
  })).toBe(true);
  expect(responses.some((response) => response.url.endsWith('/sonivox.sf2') && response.status === 200)).toBe(true);
  expect((await page.request.get('/assets/alphatab/alphaTab.worklet.mjs')).status()).toBe(200);
  expect(await page.evaluate(() => (window as unknown as { __audioOutputs: string[] }).__audioOutputs)).toContain('AudioWorkletNode');
  expect(responses.every((response) => response.status === 200)).toBe(true);
  expect(errors).toEqual([]);
});

test('loop A/B: modifiche durante il playback, seek, stop e intervallo invalido', async ({ page }) => {
  await open(page, 'tests/fixtures/alphatab/repeat-close-alternate-endings.gp5');
  const end = Number(await page.getByLabel('Playback timeline').getAttribute('max'));
  expect(end).toBe(9 * 960); // Nove quarti eseguiti, cinque battute da 1/4 nella notazione.
  await seek(page, 1920); await nearTick(page, 1920);
  await button(page, 'Set loop start A').click();
  await seek(page, 7680); await nearTick(page, 7680);
  await button(page, 'Set loop end B').click();
  await button(page, 'Loop').click();
  await page.getByLabel('Speed', { exact: true }).selectOption('0.25');
  await button(page, 'Stop').click(); await nearTick(page, 1920);
  await button(page, 'Play').click();
  await expect.poll(() => tick(page)).toBeGreaterThan(1920);
  await button(page, 'Set loop start A').click();
  const a = Number(await transport(page).getAttribute('data-a'));
  expect(a).toBeGreaterThan(1920);
  await seek(page, 6000); await expect.poll(() => tick(page)).toBeGreaterThanOrEqual(6000);
  await button(page, 'Set loop end B').click();
  const b = Number(await transport(page).getAttribute('data-b'));
  expect(b).toBeLessThan(7680);
  await expect(transport(page)).toHaveAttribute('data-status', 'playing');
  await expect.poll(() => tick(page)).toBeLessThan(b); // Rientro al nuovo A a fine loop.
  await button(page, 'Stop').click(); await nearTick(page, a);
  await button(page, 'Set loop end B').click();
  await expect(page.getByRole('alert')).toContainText('A must precede B');
  await expect(transport(page)).toHaveAttribute('data-b', String(b));
  await button(page, 'Loop').click();
  await seek(page, 0); await nearTick(page, 0);
});

test('cambi di tempo, velocità, fine brano e rendering durante il playback', async ({ page }) => {
  await open(page, 'tests/fixtures/m4-tempo.gp');
  await button(page, 'Play').click();
  await expect(page.getByLabel('Tempo', { exact: true })).toHaveValue('120');
  await button(page, 'Tab Only').click();
  await page.getByLabel('Zoom', { exact: true }).selectOption('1.25');
  await expect(transport(page)).toHaveAttribute('data-status', 'playing');
  await button(page, 'Pause').click();
  await seek(page, 7680); await nearTick(page, 7680);
  await page.getByLabel('Speed', { exact: true }).selectOption('2');
  await button(page, 'Play').click();
  await expect(page.getByLabel('Tempo', { exact: true })).toHaveValue('120'); // 60 BPM × 2
  await button(page, 'Pause').click();
  await page.getByLabel('Speed', { exact: true }).selectOption('1');
  await seek(page, 8000); await button(page, 'Play').click();
  await expect(page.getByLabel('Tempo', { exact: true })).toHaveValue('60');
  await page.getByRole('button', { name: 'IT', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausa', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await button(page, 'Pause').click();
  await seek(page, 15000); await button(page, 'Play').click();
  await expect(transport(page)).toHaveAttribute('data-status', 'stopped', { timeout: 10000 });
});

test('SoundFont assente: errore localizzato, rendering conservato e recupero', async ({ page }) => {
  await page.route('**/sonivox.sf2', (route) => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto('/');
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(transport(page)).toHaveAttribute('data-status', 'error');
  await expect(page.getByRole('status')).toContainText('Tablature ready');
  await expect(page.locator('.score-host svg').first()).toBeVisible();
  await expect(button(page, 'Play')).toBeDisabled();
  await expect(page.getByRole('alert')).toContainText('Unable to start audio');
  await button(page, 'IT').click();
  await expect(page.getByRole('alert')).toContainText('Impossibile avviare');
  await page.unroute('**/sonivox.sf2');
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(transport(page)).toHaveAttribute('data-status', 'stopped');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('caricamento worklet fallito: errore audio dopo play, partitura e cleanup conservati', async ({ page }) => {
  // Chromium non intercetta addModule tramite page.route: inietta il rifiuto del browser.
  await page.addInitScript(() => {
    const load = AudioWorklet.prototype.addModule;
    let rejectFirst = true;
    AudioWorklet.prototype.addModule = function (...args) {
      if (rejectFirst) { rejectFirst = false; return Promise.reject(new Error('worklet unavailable')); }
      return load.apply(this, args);
    };
  });
  await open(page);
  await button(page, 'Play').click();
  await expect(transport(page)).toHaveAttribute('data-status', 'error');
  await expect(page.locator('.score-host svg').first()).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Unable to start audio');
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(transport(page)).toHaveAttribute('data-status', 'stopped');
});

test('worker assente: errore audio con documento leggibile e recupero', async ({ page }) => {
  await page.context().route('**/alphaTab.worker.mjs', (route) => route.fulfill({ status: 404, body: 'missing' }));
  await page.goto('/');
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(transport(page)).toHaveAttribute('data-status', 'error');
  await expect(page.locator('.score-host svg').first()).toBeVisible();
  await expect(button(page, 'Play')).toBeDisabled();
  await page.context().unroute('**/alphaTab.worker.mjs');
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(transport(page)).toHaveAttribute('data-status', 'stopped');
});
