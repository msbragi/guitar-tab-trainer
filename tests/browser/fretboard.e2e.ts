import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ locale: 'en-US', viewport: { width: 1440, height: 960 } });
const transport = (page: Page) => page.locator('.transport-bar');
const markers = (page: Page) => page.locator('.fret-marker');
async function open(page: Page, fixture: string) {
  await page.goto('/');
  await page.locator('#score-file').setInputFiles('tests/fixtures/' + fixture);
  await expect(transport(page)).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
}
async function seek(page: Page, tick: number) {
  await page.getByLabel('Playback timeline').evaluate((element: HTMLInputElement, tick) => {
    element.value = String(tick);
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }, tick);
  await expect.poll(async () => Math.abs(Number(await transport(page).getAttribute('data-tick')) - tick)).toBeLessThanOrEqual(2);
}
const command = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

test('fretboard: seek, note selection and playback follow the same transport', async ({ page }) => {
  await open(page, 'm4-tempo.gp');
  await expect(page.getByLabel('Fretboard track')).toHaveCount(0);
  await page.getByText('Fretboard', { exact: true }).click();
  await expect(markers(page).locator('.fret-number')).toHaveText('0');
  await expect(markers(page)).toHaveAttribute('data-string', '1');
  await seek(page, 1100);
  await expect(markers(page).locator('.fret-number')).toHaveText('1');
  await seek(page, 2100);
  await expect(markers(page).locator('.fret-number')).toHaveText('2');
  await page.locator('.score-host svg g[class^="b"]').nth(3).click();
  await expect(markers(page).locator('.fret-number')).toHaveText('3');
  await expect(transport(page)).toHaveAttribute('data-status', 'stopped');

  await seek(page, 0);
  await command(page, 'Play').click();
  await expect(transport(page)).toHaveAttribute('data-status', 'playing');
  await expect(markers(page).locator('.fret-number')).toHaveText('1');
  await command(page, 'Pause').click();
  await expect(transport(page)).toHaveAttribute('data-status', 'paused');
  await seek(page, 2100);
  await expect(markers(page).locator('.fret-number')).toHaveText('2');
});

test('fretboard: track choice survives collapse and does not change the score', async ({ page }) => {
  await open(page, 'm4-fretboard.gp');
  const score = page.locator('.score-host svg');
  const svgCount = await score.count();
  const toggle = page.getByText('Fretboard', { exact: true });
  await toggle.click();
  const track = page.getByLabel('Fretboard track');
  await expect(track).toHaveValue('0');
  await expect(markers(page).locator('.fret-number')).toHaveText('0');
  await track.selectOption('1');
  await expect(track).toHaveValue('1');
  await expect(markers(page).locator('.fret-number')).toHaveText('7');
  await expect(page.locator('.fretboard-scroll tbody tr')).toHaveCount(4);
  await toggle.click();
  await expect(track).toHaveCount(0);
  await toggle.click();
  await expect(track).toHaveValue('1');
  await expect(score).toHaveCount(svgCount);
});

test('fretboard: repeated measures retain the note and an active A/B loop clamps seek', async ({ page }) => {
  await open(page, 'alphatab/repeat-close-alternate-endings.gp5');
  await page.getByText('Fretboard', { exact: true }).click();
  await seek(page, 2100);
  await command(page, 'Set loop start A').click();
  await seek(page, 4100);
  await command(page, 'Set loop end B').click();
  await command(page, 'Loop').click();
  await seek(page, 3000);
  await page.getByLabel('Playback timeline').evaluate((element: HTMLInputElement) => {
    element.value = '6000';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(async () => Math.abs(Number(await transport(page).getAttribute('data-tick')) - 2100)).toBeLessThanOrEqual(2);
  await expect(markers(page).locator('.fret-number')).toHaveText('1');
  await command(page, 'Play').click();
  await expect.poll(async () => Number(await transport(page).getAttribute('data-tick'))).toBeGreaterThan(2200);
  await expect(markers(page).locator('.fret-number')).toHaveText('1');
  await command(page, 'Stop').click();
  await expect(transport(page)).toHaveAttribute('data-status', 'stopped');
  await expect(markers(page).locator('.fret-number')).toHaveText('1');
});
