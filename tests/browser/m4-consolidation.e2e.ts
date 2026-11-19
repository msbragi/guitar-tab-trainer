import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

test.use({ locale: 'en-US', viewport: { width: 1440, height: 960 } });
const bar = (page: Page) => page.locator('.transport-bar');
const tick = async (page: Page) => Number(await bar(page).getAttribute('data-tick'));
async function seek(page: Page, target: number) {
  await page.getByLabel('Playback timeline').evaluate((element, value) => {
    (element as HTMLInputElement).value = String(value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, target);
  await expect.poll(async () => Math.abs(await tick(page) - target)).toBeLessThanOrEqual(2);
}

async function cached(page: Page) {
  return page.evaluate(() => new Promise<{ name: string; id: string; bytes: number[]; snapshot: { id: string; value: {
    transport: { tick: number; speed: number; a: number | null; b: number | null; loop: boolean };
    mixer: { masterVolume: number; tracks: { index: number; muted: boolean; solo: boolean; volume: number }[] };
  } } } | null>((resolve, reject) => {
    const request = indexedDB.open('guitar-practice.current-session', 1);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const database = request.result;
      const transaction = database.transaction('current', 'readonly');
      const file = transaction.objectStore('current').get('file');
      const state = transaction.objectStore('current').get('state');
      transaction.oncomplete = () => {
        database.close();
        resolve(file.result ? { name: file.result.name, id: file.result.id, bytes: Array.from(file.result.bytes), snapshot: state.result } : null);
      };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    };
  }));
}

test('M4 consolidamento: seek fermo, cursore visibile, click e limiti A/B', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/effects.gp');
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  const cursor = page.locator('.at-cursor-beat');
  await expect(cursor).toBeVisible();
  const start = await cursor.boundingBox();
  const end = Number(await page.getByLabel('Playback timeline').getAttribute('max'));
  await seek(page, Math.floor(end * 0.75));
  await expect.poll(async () => {
    const position = await cursor.boundingBox(); const viewport = await page.locator('.score-scroll').boundingBox();
    return !!position && !!viewport && position.y >= viewport.y && position.y < viewport.y + viewport.height;
  }).toBe(true);
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped');
  expect(await cursor.boundingBox()).not.toEqual(start);
  await seek(page, 0);
  const note = page.locator('.score-host svg g[class^="b"]').nth(3);
  await note.click();
  await expect.poll(() => tick(page)).toBeGreaterThan(0);
  const a = await tick(page);
  await page.getByRole('button', { name: 'Set loop start A', exact: true }).click();
  await seek(page, Math.floor(end * 0.75));
  await page.getByRole('button', { name: 'Set loop end B', exact: true }).click();
  await page.getByRole('button', { name: 'Loop', exact: true }).click();
  await page.locator('.score-host svg g[class^="b"]').nth(1).click();
  await expect.poll(async () => Math.abs(await tick(page) - a)).toBeLessThanOrEqual(2);
  await expect(bar(page)).toHaveAttribute('data-loop', 'true');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-status', 'playing');
  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(bar(page)).toHaveAttribute('data-status', 'paused');
  await seek(page, a + 500);
  await page.getByRole('button', { name: 'Tab Only', exact: true }).click();
  await page.getByLabel('Zoom', { exact: true }).selectOption('1.25');
  await expect(bar(page)).toHaveAttribute('data-status', 'paused');
  await expect.poll(async () => Math.abs(await tick(page) - a - 500)).toBeLessThanOrEqual(2);
  await page.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect.poll(async () => Math.abs(await tick(page) - a)).toBeLessThanOrEqual(2);
  expect(errors).toEqual([]);
});

test('M4 consolidamento: preferenze dopo refresh senza avvio audio', async ({ page }) => {
  await page.goto('/');
  await page.locator('#score-file').setInputFiles('tests/fixtures/m4-tempo.gp');
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await page.getByRole('button', { name: 'Tab Only', exact: true }).click();
  await page.getByLabel('Zoom', { exact: true }).selectOption('1.25');
  await page.getByLabel('Speed', { exact: true }).selectOption('0.5');
  await page.getByLabel('Master volume', { exact: true }).fill('42');
  await seek(page, 1920);
  await page.getByRole('button', { name: 'Set loop start A', exact: true }).click();
  const a = Number(await bar(page).getAttribute('data-a'));
  await seek(page, 7680);
  await page.getByRole('button', { name: 'Set loop end B', exact: true }).click();
  const b = Number(await bar(page).getAttribute('data-b'));
  await page.getByRole('button', { name: 'Loop', exact: true }).click();
  await seek(page, 4000);
  const position = await tick(page);
  const track = page.locator('.track-card').first();
  await track.getByRole('button').nth(0).click();
  await track.getByRole('button').nth(1).click();
  await track.getByRole('slider').fill('33');
  await expect.poll(async () => (await cached(page))?.snapshot.value).toMatchObject({
    transport: { tick: position, speed: 0.5, a, b, loop: true },
    mixer: { masterVolume: 0.42, tracks: [{ index: 0, muted: true, solo: true, volume: 0.33 }] },
  });
  const before = await cached(page);
  expect(before?.bytes).toEqual(Array.from(readFileSync('tests/fixtures/m4-tempo.gp')));
  await page.reload();
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Tab Only', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Zoom', { exact: true })).toHaveValue('1.25');
  await expect(page.getByLabel('Speed', { exact: true })).toHaveValue('0.5');
  await expect(page.getByLabel('Master volume', { exact: true })).toHaveValue('42');
  await expect.poll(async () => Math.abs(await tick(page) - position)).toBeLessThanOrEqual(2);
  await expect(bar(page)).toHaveAttribute('data-a', String(a));
  await expect(bar(page)).toHaveAttribute('data-b', String(b));
  await expect(bar(page)).toHaveAttribute('data-loop', 'true');
  await expect(track.getByRole('button').nth(0)).toHaveAttribute('aria-pressed', 'true');
  await expect(track.getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  await expect(track.getByRole('slider')).toHaveValue('33');
  await expect(page.getByRole('status')).toContainText('m4-tempo.gp');
  await expect(page.locator('.at-cursor-beat')).toBeVisible();
  // Anche un refresh durante il playback deve ripartire fermo.
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(async () => (await cached(page))?.snapshot.value.transport.tick ?? 0).toBeGreaterThan(4000);
  await page.reload();
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await expect.poll(() => tick(page)).toBeGreaterThan(4000);
  await expect(bar(page)).toHaveAttribute('data-loop', 'true');
  const stopped = await tick(page);
  await page.waitForTimeout(200); expect(await tick(page)).toBe(stopped);
  // Nuovo documento: preserva i reset M4, anche nelle preferenze salvate.
  await expect(page.getByLabel('Zoom', { exact: true })).toBeEnabled();
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped');
  await expect(page.getByLabel('Speed', { exact: true })).toHaveValue('1');
  await expect(page.getByLabel('Master volume', { exact: true })).toHaveValue('100');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('guitar-practice.session-preferences.v1') ?? '{}')))
    .toMatchObject({ speed: 1, masterVolume: 1, mode: 'tab', scale: 1.25 });
});


test('M4 cache: storage negato non blocca il documento', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => {
    IDBFactory.prototype.open = () => { throw new DOMException('blocked', 'SecurityError'); };
  });
  await page.goto('/');
  await page.locator('#score-file').setInputFiles('tests/fixtures/m4-tempo.gp');
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await seek(page, 4000);
  await page.reload();
  await expect(bar(page)).toHaveAttribute('data-status', 'idle');
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  expect(errors).toEqual([]);
});

test('M4 cache: sostituzione atomica, scritture vecchie e snapshot corrotto', async ({ page, context }) => {
  await page.goto('/');
  await page.locator('#score-file').setInputFiles('tests/fixtures/m4-tempo.gp');
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await expect.poll(async () => (await cached(page))?.name).toBe('m4-tempo.gp');
  const second = await context.newPage();
  await second.goto('/');
  await expect(bar(second)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await second.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect.poll(async () => (await cached(second))?.name).toBe('notes.gp3');
  await expect(bar(second)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await seek(second, 500);
  await expect.poll(async () => Math.abs(((await cached(second))?.snapshot.value.transport.tick ?? 0) - 500)).toBeLessThanOrEqual(2);
  const replacement = await cached(second);
  await seek(page, 4000); // timer della scheda con il vecchio GP
  await page.waitForTimeout(650);
  const after = await cached(second);
  expect(after?.id).toBe(replacement?.id);
  expect(after?.snapshot.id).toBe(replacement?.id);
  expect(after?.snapshot.value.transport.tick).toBe(replacement?.snapshot.value.transport.tick);
  expect(after?.bytes).toEqual(Array.from(readFileSync('tests/fixtures/alphatab/notes.gp3')));
  await second.close();
  await page.evaluate(() => new Promise<void>((resolve) => {
    const open = indexedDB.open('guitar-practice.current-session', 1);
    open.onsuccess = () => {
      const database = open.result; const transaction = database.transaction('current', 'readwrite');
      const store = transaction.objectStore('current'); const file = store.get('file');
      file.onsuccess = () => store.put({ id: file.result.id, value: { invalid: true } }, 'state');
      transaction.oncomplete = () => { database.close(); resolve(); };
    };
  }));
  await page.reload();
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await expect(page.getByRole('status')).toContainText('notes.gp3');
  await expect.poll(() => tick(page)).toBeLessThanOrEqual(2);
  await expect(bar(page)).toHaveAttribute('data-loop', 'false');
});


test('M4 cache: quota durante la sostituzione e caricamento invalido conservano l’ultima copia valida', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.locator('#score-file').setInputFiles('tests/fixtures/m4-tempo.gp');
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await expect.poll(async () => (await cached(page))?.name).toBe('m4-tempo.gp');
  const original = await cached(page);
  await page.evaluate((id) => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === 'state' && value.id !== id) throw new DOMException('full', 'QuotaExceededError');
      return put.call(this, value, key);
    };
  }, original!.id);
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/notes.gp3');
  await expect(page.getByRole('status')).toContainText('notes.gp3');
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped');
  await page.waitForTimeout(650);
  expect((await cached(page))?.name).toBe('m4-tempo.gp');
  expect((await cached(page))?.bytes).toEqual(original!.bytes);
  await page.locator('#score-file').setInputFiles({ name: 'invalid.gp', mimeType: 'application/octet-stream', buffer: Buffer.from('invalid') });
  await expect(page.getByRole('alert')).toBeVisible();
  expect((await cached(page))?.id).toBe(original!.id);
  await page.reload();
  await expect(page.getByRole('status')).toContainText('m4-tempo.gp');
  await expect(bar(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  expect(errors).toEqual([]);
});
