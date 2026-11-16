import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.use({ locale: 'en-US', viewport: { width: 1440, height: 960 } });
const panel = (page: Page) => page.getByRole('complementary', { name: 'Track controls', exact: true });
const track = (page: Page, index: number) => page.locator(`.track-card[data-track="${index}"]`);
const mute = (page: Page, index: number) => track(page,index).getByRole('button').nth(0);
const solo = (page: Page, index: number) => track(page,index).getByRole('button').nth(1);
async function open(page: Page, linked = false) {
  await page.goto('/');
  await page.locator('#score-file').setInputFiles(`tests/fixtures/m4-mixer${linked ? '-linked' : ''}.gp`);
  await expect(page.locator('.transport-bar')).toHaveAttribute('data-status', 'stopped', { timeout: 15000 });
  await expect(mute(page,0)).toBeEnabled();
}
async function range(page: Page, label: string, value: number) {
  await page.getByLabel(label, { exact: true }).evaluate((element, value) => {
    (element as HTMLInputElement).value = String(value); element.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('mute/solo cumulativi, volumi indipendenti, persistenza nella vista e reset al nuovo GP', async ({ page }) => {
  await open(page);
  await solo(page,0).click(); await solo(page,1).click();
  await expect(solo(page,0)).toHaveAttribute('aria-pressed','true'); await expect(solo(page,1)).toHaveAttribute('aria-pressed','true');
  await expect(track(page,2)).toHaveClass(/track-excluded/);
  await mute(page,1).click(); await expect(track(page,1)).toHaveClass(/track-excluded/);
  await expect(solo(page,1)).toHaveAttribute('aria-pressed','true');
  await mute(page,1).click(); await expect(track(page,1)).not.toHaveClass(/track-excluded/);
  await solo(page,0).click(); await expect(track(page,0)).toHaveClass(/track-excluded/);
  await solo(page,1).click(); await expect(track(page,0)).not.toHaveClass(/track-excluded/);
  await mute(page,0).click(); await mute(page,2).click();
  await expect(mute(page,0)).toHaveAttribute('aria-pressed','true'); await expect(mute(page,2)).toHaveAttribute('aria-pressed','true');
  await range(page,'Track volume: Low voice',30); await range(page,'Track volume: Middle voice',60); await range(page,'Master volume',45);
  await expect(page.getByLabel('Track volume: High voice',{exact:true})).toHaveValue('75');
  await page.getByRole('button',{name:'Tab Only',exact:true}).click(); await page.getByLabel('Zoom',{exact:true}).selectOption('1.25');
  await page.getByRole('navigation').getByRole('button',{name:'Settings',exact:true}).click();
  await page.getByLabel('Appearance',{exact:true}).selectOption('dark');
  await page.getByRole('navigation').getByRole('button',{name:'Practice',exact:true}).click();
  await expect(page.getByLabel('Track volume: Low voice',{exact:true})).toHaveValue('30');
  await expect(page.getByLabel('Track volume: Middle voice',{exact:true})).toHaveValue('60');
  await expect(page.getByLabel('Master volume',{exact:true})).toHaveValue('45');
  await page.locator('#score-file').setInputFiles('tests/fixtures/alphatab/effects.gp');
  await expect(page.getByLabel('Master volume',{exact:true})).toHaveValue('100');
  await expect(page.getByLabel('Track volume: Track 1',{exact:true})).toHaveValue('75');
  await expect(mute(page,0)).toHaveAttribute('aria-pressed','false'); await expect(solo(page,0)).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('.track-card')).toHaveCount(1);
});

test('canali condivisi: avviso e controlli collegati senza stato UI contraddittorio', async ({ page }) => {
  await open(page,true);
  await expect(track(page,0)).toContainText('Controls linked'); await expect(track(page,1)).toContainText('Controls linked');
  await mute(page,0).click(); await expect(mute(page,1)).toHaveAttribute('aria-pressed','true');
  await solo(page,1).click(); await expect(solo(page,0)).toHaveAttribute('aria-pressed','true');
  await range(page,'Track volume: Middle voice',40);
  await expect(page.getByLabel('Track volume: Low voice',{exact:true})).toHaveValue('40');
  await expect(page.getByLabel('Track volume: High voice',{exact:true})).toHaveValue('75');
  await mute(page,1).click(); await expect(mute(page,0)).toHaveAttribute('aria-pressed','false');
});

test('API synth effettive: mute, solo multiplo, volume traccia e master cambiano i campioni', async ({ page }) => {
  test.setTimeout(60000);
  await page.addInitScript(() => {
    const analysers: AnalyserNode[] = []; Object.assign(window,{ __mixerAnalysers: analysers });
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (this: AudioNode, destination: AudioNode, output = 0, input = 0) {
      if (destination === this.context.destination) {
        const analyser = this.context.createAnalyser();
        connect.call(this,analyser,output,0); connect.call(analyser,destination,0,input); analysers.push(analyser); return destination;
      }
      return connect.call(this,destination,output,input);
    } as typeof AudioNode.prototype.connect;
  });
  await page.route('**/*', (route) => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  const requests: string[] = []; page.on('request', (request) => requests.push(request.url()));
  await open(page);
  const rms = () => page.evaluate(() => Math.max(0,...(window as unknown as {__mixerAnalysers:AnalyserNode[]}).__mixerAnalysers.map((a)=> {
    const samples = new Float32Array(a.fftSize); a.getFloatTimeDomainData(samples);
    return Math.sqrt(samples.reduce((sum,value)=>sum+value*value,0)/samples.length);
  })));
  const audible = () => expect.poll(rms,{timeout:6000}).toBeGreaterThan(0.0001);
  const silent = () => expect.poll(rms,{timeout:6000}).toBeLessThan(0.00001);
  await page.getByRole('button',{name:'Play',exact:true}).click(); await audible();
  for(const i of [0,1,2]) await mute(page,i).click(); await silent();
  await mute(page,0).click(); await audible();
  await range(page,'Track volume: Low voice',0); await silent();
  await range(page,'Track volume: Low voice',50); await audible();
  await range(page,'Master volume',0); await silent();
  await range(page,'Master volume',100); await audible();
  await mute(page,1).click(); await solo(page,0).click(); await solo(page,1).click();
  await mute(page,0).click(); await audible(); // Solo 1 resta udibile.
  await mute(page,1).click(); await silent();
  await mute(page,0).click(); await audible(); // Solo 0 resta udibile.
  await solo(page,0).click(); await silent(); // Resta soltanto solo 1, ancora in mute.
  await mute(page,1).click(); await audible();
  await page.getByRole('button',{name:'Stop',exact:true}).click();
  expect(requests.every((url)=>new URL(url).hostname==='127.0.0.1')).toBe(true);
});

test('tooltip nativi EN/IT aggiornati dinamicamente, label distinte e azioni toggle', async ({ page }) => {
  await open(page);
  const allTitles = async () => {
    for (const control of await page.locator('button:visible, select:visible, input[type="range"]:visible').all()) {
      await expect(control).toHaveAttribute('title', /\S/);
    }
  };
  await allTitles();
  await expect(page.getByRole('button',{name:'Play',exact:true})).toHaveAttribute('title','Play');
  await expect(page.getByRole('button',{name:'Set loop start A',exact:true})).toHaveAttribute('title','Set loop start A');
  await mute(page,0).click(); await expect(mute(page,0)).toHaveAttribute('title','Unmute Low voice');
  await solo(page,1).click(); await expect(solo(page,1)).toHaveAttribute('title','Unsolo Middle voice');
  const surface = await page.locator('.at-surface').elementHandle();
  await page.getByRole('button',{name:'IT',exact:true}).click(); await allTitles();
  await expect(page.getByRole('button',{name:'Riproduci',exact:true})).toHaveAttribute('title','Riproduci');
  await expect(mute(page,0)).toHaveAttribute('title','Riattiva Low voice');
  await expect(solo(page,1)).toHaveAttribute('title','Disattiva solo Middle voice');
  await expect(page.getByRole('button',{name:'Apri tablatura',exact:true})).toHaveAttribute('title','Apri tablatura');
  await expect(page.getByRole('button',{name:'EN',exact:true})).toHaveAttribute('title','Inglese');
  await expect(page.getByLabel('Volume generale',{exact:true})).toHaveAttribute('title','Volume generale');
  await page.getByRole('navigation').getByRole('button',{name:'Impostazioni',exact:true}).click();
  await expect(page.getByLabel('Aspetto',{exact:true})).toHaveAttribute('title','Aspetto');
  await page.getByRole('navigation').getByRole('button',{name:'Studio',exact:true}).click();
  expect(await surface!.evaluate(e=>e===document.querySelector('.at-surface'))).toBe(true);
  await page.getByRole('button',{name:'EN',exact:true}).click();
  await page.getByRole('button',{name:'Play',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pause',exact:true})).toHaveAttribute('title','Pause');
  await page.getByRole('button',{name:'IT',exact:true}).click();
  await expect(page.getByRole('button',{name:'Pausa',exact:true})).toHaveAttribute('title','Pausa');
});

for(const width of [1440,1024,390]) {
  test(`trasporto compatto e responsive a ${width}px`, async ({ page }) => {
    await page.setViewportSize({width,height:width===390?844:960}); await open(page);
    const bar = page.locator('.transport-bar');
    expect((await bar.boundingBox())!.height).toBeLessThanOrEqual(width>1100?76:width===390?130:120);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const name of ['Play','Stop','Loop','Set loop start A','Set loop end B']) {
      const control = page.getByRole('button',{name,exact:true}); await expect(control).toBeVisible();
      const bounds = (await control.boundingBox())!; expect(bounds.width).toBeGreaterThanOrEqual(36); expect(bounds.height).toBeGreaterThanOrEqual(40);
    }
    await expect(page.getByLabel('Master volume',{exact:true})).toBeEnabled();
    await expect(page.getByLabel('Speed',{exact:true})).toBeEnabled();
    await page.screenshot({path:`test-results/m4-finalize-${width}.png`,fullPage:true});
  });
}
