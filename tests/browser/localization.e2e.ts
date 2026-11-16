import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ locale: 'en-US' });
const preferenceKey = 'guitar-practice.language';

test('inglese iniziale, cambio senza reload, metadati e renderer invariati, persistenza', async ({ page }) => {
  let navigations = 0;
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations++; });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('No tablature loaded.')).toBeVisible();
  await page.getByLabel('Choose a tablature').setInputFiles('tests/fixtures/alphatab/effects.gp');
  await expect(page.getByRole('status')).toHaveText('Tablature ready · effects.gp');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Effects');
  const surface = await page.locator('.at-surface').elementHandle();
  const svg = await page.locator('.score-host').innerHTML();
  await page.getByRole('button', { name: 'IT', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
  await expect(page.getByRole('status')).toHaveText('Tablatura pronta · effects.gp');
  await expect(page.getByLabel('Informazioni tablatura')).toContainText('32 battute');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Effects');
  await expect(page.getByLabel('Tracce').getByRole('listitem')).toHaveText(['Track 1']);
  expect(await surface!.evaluate((element) => element === document.querySelector('.at-surface'))).toBe(true);
  expect(await page.locator('.score-host').innerHTML()).toBe(svg);
  expect(navigations).toBe(1);
  expect(await page.evaluate((key) => localStorage.getItem(key), preferenceKey)).toBe('it');
  await page.reload();
  await expect(page.getByText('Nessuna tablatura caricata.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'IT', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByText('No tablature loaded.')).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.evaluate((key) => localStorage.getItem(key), preferenceKey)).toBe('en');
});

test('traduce il placeholder del titolo assente e le quantità, conservando il nome traccia', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Choose a tablature').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Untitled tablature');
  await expect(page.getByLabel('Tablature information')).toContainText('1 bar · 1 track');
  await page.getByRole('button', { name: 'IT', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Tablatura senza titolo');
  await expect(page.getByLabel('Informazioni tablatura')).toContainText('1 battuta · 1 traccia');
  await expect(page.getByLabel('Tracce').getByRole('listitem')).toHaveText(['Track 1']);
});

test('i messaggi di errore già visibili cambiano lingua e il caricamento può riprendere', async ({ page }) => {
  await page.goto('/');
  await page.locator('#score-file').setInputFiles({ name: 'broken.gp5', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toHaveText('Invalid or unsupported Guitar Pro file. Choose another file to try again.');
  await page.getByRole('button', { name: 'IT', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('File Guitar Pro non valido o non supportato. Scegli un altro file per riprovare.');
  await page.locator('#score-file').setInputFiles({ name: 'empty.gp', mimeType: 'application/octet-stream', buffer: Buffer.alloc(0) });
  await expect(page.getByRole('alert')).toContainText('Il file è vuoto.');
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('The file is empty.');
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(page.getByRole('status')).toHaveText('Tablature ready · notes.gp3');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('un errore di lettura viene tradotto senza mostrare la diagnostica del browser', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    File.prototype.arrayBuffer = async () => { throw new Error('internal browser diagnostic'); };
  });
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(page.getByRole('alert')).toContainText('Unable to read the selected file.');
  await page.getByRole('button', { name: 'IT', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Impossibile leggere il file selezionato.');
  await expect(page.getByRole('alert')).not.toContainText('internal browser diagnostic');
});

test('il messaggio di caricamento si aggiorna mentre la lettura è pendente', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const original = File.prototype.arrayBuffer;
    const state = window as Window & { releaseRead?: () => void };
    File.prototype.arrayBuffer = function () {
      return new Promise<ArrayBuffer>((resolve, reject) => {
        state.releaseRead = () => { original.call(this).then(resolve, reject); };
      });
    };
  });
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(page.getByRole('status')).toHaveText('Loading notes.gp3…');
  await expect(page.locator('#score-file')).toBeDisabled();
  await page.getByRole('button', { name: 'IT', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Caricamento di notes.gp3…');
  await page.evaluate(() => (window as Window & { releaseRead?: () => void }).releaseRead?.());
  await expect(page.getByRole('status')).toHaveText('Tablatura pronta · notes.gp3');
});

test('storage bloccato non impedisce il cambio lingua', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Blocked', 'SecurityError'); } });
  });
  await page.goto('/');
  await expect(page.getByText('No tablature loaded.')).toBeVisible();
  await page.getByRole('button', { name: 'IT', exact: true }).click();
  await expect(page.getByText('Nessuna tablatura caricata.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('lang', 'it');
});

test('una chiave italiana mancante usa il fallback inglese', async ({ page }) => {
  const italian = JSON.parse(readFileSync('apps/web/public/i18n/it.json', 'utf8'));
  delete italian.status.idle;
  await page.route('**/assets/i18n/it.json', (route) => route.fulfill({ json: italian }));
  await page.goto('/');
  await page.getByRole('button', { name: 'IT', exact: true }).click();
  await expect(page.getByText('Apri una tablatura Guitar Pro dal tuo computer.')).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('No tablature loaded.');
});

test('catalogo italiano non disponibile: la UI resta utilizzabile in inglese', async ({ page }) => {
  await page.addInitScript((key) => localStorage.setItem(key, 'it'), preferenceKey);
  await page.route('**/assets/i18n/it.json', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await expect(page.getByText('No tablature loaded.')).toBeVisible();
  await expect(page.getByLabel('Choose a tablature')).toBeEnabled();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test.describe('browser italiano regionale', () => {
  test.use({ locale: 'it-CH' });

  test('rileva italiano senza salvare una scelta implicita', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Nessuna tablatura caricata.')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'it');
    expect(await page.evaluate((key) => localStorage.getItem(key), preferenceKey)).toBeNull();
  });

  test('una scelta EN salvata prevale sul browser italiano', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'en'), preferenceKey);
    await page.goto('/');
    await expect(page.getByText('No tablature loaded.')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test.describe('browser non supportato', () => {
  test.use({ locale: 'fr-FR' });

  test('lingua e preferenza non supportate ricadono su EN', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, 'fr'), preferenceKey);
    await page.goto('/');
    await expect(page.getByText('No tablature loaded.')).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});
