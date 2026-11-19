import { test, expect } from '@playwright/test';

test.use({ locale: 'en-US', viewport: { width: 1440, height: 960 } });

test('song details expand in tracks sidebar alongside independent visibility and mixer controls', async ({ page }) => {
  await page.goto('/');
  await page.locator('#score-file').setInputFiles('tests/fixtures/m4-fretboard.gp');
  const transport = page.locator('.transport-bar');
  await expect(transport).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  const sidebar = page.locator('gp-tracks-panel');
  const details = sidebar.locator('details.song-info');
  await expect(details.locator('summary')).toBeVisible();
  await expect(details).not.toHaveAttribute('open');
  await expect(details.locator('section')).toBeHidden();
  await details.locator('summary').click();
  await expect(details.locator('section')).toContainText('m4-fretboard.gp');
  await expect(page.locator('gp-score-viewer gp-song-info')).toHaveCount(0);
  const guitar = sidebar.locator('.track-card').first();
  await guitar.getByRole('button', { name: 'Visibility for Guitar', exact: true }).click();
  await expect(guitar.getByRole('button', { name: 'Visibility for Guitar', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(guitar.getByRole('button', { name: 'Mute Guitar', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByLabel('Zoom', { exact: true })).toBeEnabled();
  await page.reload();
  await expect(transport).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await expect(guitar.getByRole('button', { name: 'Visibility for Guitar', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.score-host svg:visible').filter({ hasText: 'Guitar' })).toHaveCount(0);
  await expect(page.getByLabel('Zoom', { exact: true })).toBeEnabled();
  await sidebar.locator('details.song-info summary').click();
  await guitar.getByRole('button', { name: 'Mute Guitar', exact: true }).click();
  await sidebar.getByRole('button', { name: 'Reset tracks', exact: true }).click();
  await expect(guitar.getByRole('button', { name: 'Visibility for Guitar', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(guitar.getByRole('button', { name: 'Mute Guitar', exact: true })).toHaveAttribute('aria-pressed', 'false');
  await expect(transport).toHaveAttribute('data-status', 'stopped');
  await expect(details.locator('section')).toBeVisible();
  await page.reload();
  await expect(transport).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await expect(guitar.getByRole('button', { name: 'Visibility for Guitar', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.locator('.score-host svg:visible').filter({ hasText: 'Guitar' }).count()).toBeGreaterThan(0);
});
