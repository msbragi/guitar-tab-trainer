import { test, expect } from '@playwright/test';

test.use({ locale: 'en-US', viewport: { width: 1440, height: 960 } });
const themeKey = 'guitar-tab-trainer.theme';

async function openScore(page: import('@playwright/test').Page, file = 'notes.gp3') {
  await page.goto('/');
  await expect(page.locator('#score-file')).toBeEnabled();
  await page.locator('#score-file').setInputFiles(`tests/fixtures/alphatab/${file}`);
  await expect(page.getByRole('status')).toHaveText(`Tablature ready · ${file}`);
  await expect(page.locator('.score-host svg').first()).toBeVisible();
}

test('navigazione attiva, sezioni future dichiarate e trasporto disabilitato senza documento', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(navigation.getByRole('button', { name: 'Practice', exact: true })).toHaveAttribute('aria-current', 'page');
  for (const name of ['Library', 'Projects', 'Virtual Rig']) {
    await navigation.getByRole('button', { name, exact: true }).click();
    await expect(navigation.getByRole('button', { name, exact: true })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('region', { name, exact: true })).toContainText('not available yet');
    await expect(page.getByText('Not available yet', { exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Back to Practice', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Tab', exact: true })).toBeEnabled();
  await expect(page.getByText('Recent files will be available in a future update.')).toBeVisible();
  await expect(page.getByText('Favorites will be available in a future update.')).toBeVisible();
  const transport = page.getByRole('contentinfo', { name: 'Playback', exact: true });
  for (const button of await transport.getByRole('button').all()) await expect(button).toBeDisabled();
  for (const input of await transport.locator('input, select').all()) await expect(input).toBeDisabled();
  await expect(transport).toContainText('Open a tablature to enable playback.');
  await page.getByRole('button', { name: 'IT', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Navigazione principale' }).getByRole('button', { name: 'Studio', exact: true })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('Apri una tablatura per abilitare la riproduzione.')).toBeVisible();
});

test('collasso dei pannelli e navigazione conservano la tablatura e le tracce reali', async ({ page }) => {
  await openScore(page, 'staves.gp5');
  const surface = await page.locator('.at-surface').elementHandle();
  const initialWidth = (await page.locator('.score-workspace').boundingBox())!.width;
  await expect(page.getByLabel('Tracks', { exact: true }).locator('.track-name')).toHaveText(['Standard And Tablature', 'Standard Only', 'Tablature Only']);
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await page.getByRole('button', { name: 'Collapse tracks panel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toHaveAttribute('aria-expanded', 'false');
  expect((await page.locator('.score-workspace').boundingBox())!.width).toBeGreaterThan(initialWidth);
  await expect(page.locator('.score-host svg').first()).toBeVisible();
  await page.getByRole('button', { name: 'Expand tracks panel', exact: true }).click();
  const tracks = page.getByRole('complementary', { name: 'Track controls' });
  for (const control of await tracks.locator('.track-controls button, input').all()) await expect(control).toBeEnabled({ timeout: 15000 });
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  await page.getByRole('navigation').getByRole('button', { name: 'Practice', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Tablature ready · staves.gp5');
  expect(await surface!.evaluate((element) => element === document.querySelector('.at-surface'))).toBe(true);
  await expect(page.locator('.score-host svg').first()).toBeVisible();
});

test('tema System segue il sistema, Light/Dark sono persistenti e non ricreano il renderer', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await openScore(page);
  const surface = await page.locator('.at-surface').elementHandle();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  const select = page.getByLabel('Appearance', { exact: true });
  await expect(select).toHaveValue('system');
  await select.selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(await page.evaluate((key) => localStorage.getItem(key), themeKey)).toBe('light');
  await select.selectOption('dark');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await select.selectOption('system');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('navigation').getByRole('button', { name: 'Practice', exact: true }).click();
  expect(await surface!.evaluate((element) => element === document.querySelector('.at-surface'))).toBe(true);
  await expect(page.locator('.score-panel')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: 'test-results/shell-dark-loaded.png', fullPage: true });
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Appearance', { exact: true }).selectOption('light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByLabel('Appearance', { exact: true })).toHaveValue('light');
});

test('il tema salvato è applicato prima del bundle Angular senza flash iniziale', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.addInitScript((key) => localStorage.setItem(key, 'dark'), themeKey);
  await page.route('**/main-*.js', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('gp-app')).toBeEmpty();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
});

test('tema modificabile anche con localStorage vietato', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }));
  await page.goto('/');
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Appearance', { exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'IT', exact: true }).click();
  await expect(page.getByLabel('Aspetto', { exact: true })).toHaveValue('dark');
});

test('tre modalità e zoom operano sulla partitura reale con il player disponibile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openScore(page);
  const combined = await page.locator('.score-host').innerHTML();
  await expect(page.getByLabel('Zoom', { exact: true })).toHaveValue('1');
  await page.getByRole('button', { name: 'Tab Only', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Tab Only', exact: true })).toHaveAttribute('aria-pressed', 'true');
  const tab = await page.locator('.score-host').innerHTML();
  expect(tab).not.toBe(combined);
  await page.getByRole('button', { name: 'Notation Only', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Notation Only', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.locator('.score-host').innerHTML()).not.toBe(tab);
  await page.getByRole('button', { name: 'Score & Tab', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Score & Tab', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Zoom', { exact: true }).selectOption('1.25');
  await expect(page.getByRole('button', { name: 'Score & Tab', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Zoom', { exact: true })).toHaveValue('1.25');
  await expect(page.locator('.score-host svg').first()).toBeVisible();
  await expect(page.locator('.at-surface')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 15000 });
  expect(errors).toEqual([]);
  const fullscreen = page.getByRole('button', { name: 'Enter fullscreen', exact: true });
  if (await page.evaluate(() => document.fullscreenEnabled)) {
    await fullscreen.click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement?.tagName)).toBe('GP-SCORE-VIEWER');
    await page.getByRole('button', { name: 'Exit fullscreen', exact: true }).click();
    await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  } else { await expect(fullscreen).toBeDisabled(); }
});

test('mobile: menu collassabile, pannelli a scomparsa e partitura senza overflow della pagina', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openScore(page);
  const menu = page.getByRole('button', { name: 'Toggle navigation', exact: true });
  await expect(menu).toBeVisible();
  await expect(page.getByRole('navigation')).toBeHidden();
  await page.getByRole('button', { name: 'Expand sidebar', exact: true }).click();
  await expect(page.getByText('Recent Files', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse sidebar', exact: true }).click();
  await page.getByRole('button', { name: 'Expand tracks panel', exact: true }).click();
  await expect(page.locator('.track-name')).toHaveText('Track 1');
  await page.getByRole('button', { name: 'Collapse tracks panel', exact: true }).click();
  await expect(page.locator('.score-host svg').first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await page.locator('.score-panel').boundingBox())!.width).toBeGreaterThanOrEqual(720);
  expect(await page.locator('.score-scroll').evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/shell-mobile-loaded.png', fullPage: true });
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('navigation').getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByLabel('Appearance', { exact: true })).toBeVisible();
});
