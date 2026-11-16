import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { corpus } from '../fixtures/corpus.js';

test.use({ locale: 'it-IT' });

test('la build di produzione avvia Angular senza errori', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Guitar Tab Trainer', exact: true })).toBeVisible();
  await expect(page).toHaveTitle('Guitar Tab Trainer');
  await expect(page.getByText('Nessuna tablatura caricata.')).toBeVisible();
  await expect(page.getByLabel('Scegli una tablatura')).toBeEnabled();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByText('No tablature loaded.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Guitar Tab Trainer', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('il corpus GP viene renderizzato con risorse locali e sostituzione delle istanze', async ({ page }) => {
  const errors: string[] = [];
  const requests: string[] = [];
  const fonts: number[] = [];
  const workers: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => requests.push(request.url()));
  page.on('response', (response) => {
    if (/Bravura\.(woff2?|otf)/.test(response.url())) fonts.push(response.status());
  });
  page.on('worker', (worker) => workers.push(worker.url()));
  // Il contesto browser non può contattare host esterni.
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1'
    ? route.continue() : route.abort());
  await page.goto('/');
  const input = page.getByLabel('Scegli una tablatura');
  await expect(input).toBeEnabled();
  for (const fixture of [...corpus, corpus[0]]) {
    const path = `tests/fixtures/alphatab/${fixture.file}`;
    const bytes = readFileSync(path);
    await input.setInputFiles(path);
    await expect(page.getByRole('status')).toContainText(`Tablatura pronta · ${fixture.file}`, { timeout: 35_000 });
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(fixture.title || 'Tablatura senza titolo');
    await expect(page.getByLabel('Informazioni tablatura')).toContainText(`${fixture.bars} ${fixture.bars === 1 ? 'battuta' : 'battute'}`);
    await expect(page.getByLabel('Tracce').getByRole('listitem')).toHaveText([...fixture.tracks]);
    await expect(page.locator('.score-host .at-surface')).toHaveCount(1);
    await expect(page.locator('.score-host svg').first()).toBeVisible();
    await expect(input).toBeEnabled();
    expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(fixture.sha256);
    expect(readFileSync(path).equals(bytes)).toBe(true);
  }
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.every((status) => status === 200)).toBe(true);
  expect(requests.filter((url) => new URL(url).origin !== new URL(page.url()).origin)).toEqual([]);
  expect(requests.filter((url) => /soundfont|worklet|\.sf2/i.test(url))).toEqual([]);
  expect(workers).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'test-results/score-rendering.png', fullPage: true });
});

test('input non valido, file vuoto e recupero dopo errore', async ({ page }) => {
  await page.goto('/');
  const input = page.getByLabel('Scegli una tablatura');
  await expect(input).toBeEnabled();
  await input.setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(page.getByRole('status')).toContainText('Tablatura pronta');
  await input.setInputFiles({ name: 'non-valido.gp5', mimeType: 'application/octet-stream', buffer: Buffer.from('non è un Guitar Pro') });
  await expect(page.getByRole('alert')).toContainText('File Guitar Pro non valido o non supportato.');
  await expect(page.locator('.score-host svg')).toHaveCount(0);
  await expect(page.getByLabel('Informazioni tablatura')).toHaveCount(0);
  await input.setInputFiles({ name: 'vuoto.gp', mimeType: 'application/octet-stream', buffer: Buffer.alloc(0) });
  await expect(page.getByRole('alert')).toContainText('Il file è vuoto.');
  await input.setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(page.getByRole('status')).toContainText('Tablatura pronta · notes.gp3');
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('.score-host .at-surface')).toHaveCount(1);
});
