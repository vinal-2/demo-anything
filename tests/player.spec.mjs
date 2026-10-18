import { test as base, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { findFlows } from '../tools/validate-flow.mjs';

const SHOTS = 'test-results/steps';
fs.mkdirSync(SHOTS, { recursive: true });

// Every test also fails if the page throws an uncaught error.
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await use(page);
    expect(errors, 'uncaught errors in the page').toEqual([]);
  },
});

const dp = (page) => page.locator('.dp');

async function open(page, url = '/') {
  await page.goto(url);
  await expect(dp(page)).toHaveAttribute('data-mode', 'cover');
}

async function start(page) {
  await open(page);
  await page.getByRole('button', { name: 'Get Started' }).click();
  await expect(dp(page)).toHaveAttribute('data-step', '1');
}

async function settled(page) {
  // The newest layer has faded in and its image (if any) has loaded.
  await page.waitForFunction(() => {
    const layer = document.querySelector('.dp-layers > .dp-layer:last-child');
    if (!layer || !layer.classList.contains('on')) return false;
    const img = layer.querySelector('img');
    return !img || (img.complete && img.naturalWidth > 0);
  });
  await page.waitForTimeout(200);
}

test('cover, then narration advances on its own to the first checkpoint', async ({ page }) => {
  await start(page);
  await expect(dp(page)).toHaveAttribute('data-mode', 'playing');
  await expect(page.locator('.dp-captions')).toBeVisible();
  await expect(dp(page)).toHaveAttribute('data-step', '2', { timeout: 30_000 });
  await expect(dp(page)).toHaveAttribute('data-mode', 'waiting');
  await expect(page.locator('.dp-hs')).toBeVisible();
});

test('a checkpoint waits for the hotspot and ignores clicks elsewhere', async ({ page }) => {
  await start(page);
  await expect(dp(page)).toHaveAttribute('data-step', '2', { timeout: 30_000 });
  await page.waitForTimeout(5000);
  await expect(dp(page)).toHaveAttribute('data-step', '2');
  await expect(page.locator('.dp-hint')).toBeVisible();

  await page.locator('.dp-stage').click({ position: { x: 600, y: 400 } });
  await expect(page.locator('.dp-hs')).toHaveClass(/nudge/);
  await expect(dp(page)).toHaveAttribute('data-step', '2');

  await page.locator('.dp-hs').click();
  await expect(dp(page)).toHaveAttribute('data-step', '3');
});

test('the hotspot sits on its target in the screenshot', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(dp(page)).toHaveAttribute('data-mode', 'waiting');
  const flow = await (await page.request.get('/flows/example/flow.json')).json();
  const { x, y } = flow.steps[2].hotspot;
  const stage = await page.locator('.dp-stage').boundingBox();
  const hs = await page.locator('.dp-hs').boundingBox();
  const cx = hs.x + hs.width / 2 - stage.x;
  const cy = hs.y + hs.height / 2 - stage.y;
  expect(Math.abs(cx - x * stage.width)).toBeLessThan(2);
  expect(Math.abs(cy - y * stage.height)).toBeLessThan(2);
});

test('Back and Next buttons move one step', async ({ page }) => {
  await start(page);
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(dp(page)).toHaveAttribute('data-step', '2');
  await page.getByRole('button', { name: 'Next step' }).click();
  await expect(dp(page)).toHaveAttribute('data-step', '3');
  await page.getByRole('button', { name: 'Previous step' }).click();
  await expect(dp(page)).toHaveAttribute('data-step', '2');
  await page.getByRole('button', { name: 'Previous step' }).click();
  await page.getByRole('button', { name: 'Previous step' }).click();
  await expect(dp(page)).toHaveAttribute('data-mode', 'cover');
  await expect(page.getByRole('button', { name: 'Previous step' })).toBeDisabled();
});

test('arrow keys move between steps and Space pauses narration', async ({ page }) => {
  await open(page);
  await page.keyboard.press('ArrowRight');
  await expect(dp(page)).toHaveAttribute('data-step', '1');
  await page.locator('.dp-stage').hover();
  await page.mouse.click(5, 5); // move focus off any button so Space reaches the player
  await page.keyboard.press('Space');
  await expect(dp(page)).toHaveAttribute('data-mode', 'paused');
  await page.waitForTimeout(9000); // longer than the narration, so it would have moved on if not paused
  await expect(dp(page)).toHaveAttribute('data-step', '1');
  await page.keyboard.press('Space');
  await expect(dp(page)).toHaveAttribute('data-mode', /playing|waiting/);
  await page.keyboard.press('ArrowRight');
  await expect(dp(page)).toHaveAttribute('data-step', '2');
  await page.keyboard.press('ArrowLeft');
  await expect(dp(page)).toHaveAttribute('data-step', '1');
});

test('the video step plays and moves on by itself', async ({ page }) => {
  await start(page);
  const flow = await (await page.request.get('/flows/example/flow.json')).json();
  const videoStep = flow.steps.findIndex((s) => s.type === 'video');
  for (let k = 1; k < videoStep; k += 1) await page.getByRole('button', { name: 'Next step' }).click();
  await expect(dp(page)).toHaveAttribute('data-step', String(videoStep));
  await expect(dp(page)).toHaveAttribute('data-step', String(videoStep + 1), { timeout: 15_000 });
  await expect(dp(page)).toHaveAttribute('data-mode', 'waiting');
});

test('the video clip really plays rather than falling back', async ({ page }) => {
  await start(page);
  const flow = await (await page.request.get('/flows/example/flow.json')).json();
  const videoStep = flow.steps.findIndex((s) => s.type === 'video');
  for (let k = 1; k < videoStep; k += 1) await page.getByRole('button', { name: 'Next step' }).click();
  await expect(dp(page)).toHaveAttribute('data-type', 'video');
  const played = await page.waitForFunction(() => {
    const v = document.querySelector('.dp-layers > .dp-layer:last-child video');
    return v && !v.error && v.currentTime > 0.2;
  }, null, { timeout: 8000 }).then(() => true).catch(() => false);
  expect(played).toBe(true);
});

test('keyboard users can run the whole flow', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Get Started' }).focus();
  await page.keyboard.press('Enter');
  await expect(dp(page)).toHaveAttribute('data-step', '2', { timeout: 30_000 });
  await expect(page.locator('.dp-hs')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dp(page)).toHaveAttribute('data-step', '4', { timeout: 30_000 });
  await expect(page.getByRole('button', { name: 'Open the Notifications tab' })).toBeFocused();
  await page.keyboard.press('Space');
  await expect(dp(page)).toHaveAttribute('data-step', '5');

  // Pressing the top-bar Next arrow keeps focus on that arrow.
  const nextBtn = page.getByRole('button', { name: 'Next step' });
  await nextBtn.focus();
  await page.keyboard.press('Enter');
  await expect(dp(page)).toHaveAttribute('data-mode', 'waiting');
  await expect(nextBtn).toBeFocused();
});

test('no hotspot or cursor shows on the cover or end card', async ({ page }) => {
  await open(page);
  await expect(page.locator('.dp-hs')).toBeHidden();
  await page.getByRole('button', { name: 'Get Started' }).click();
  const total = Number(await dp(page).getAttribute('data-total'));
  for (let k = 1; k < total - 1; k += 1) await page.getByRole('button', { name: 'Next step' }).click();
  await expect(dp(page)).toHaveAttribute('data-type', 'end');
  await expect(page.locator('.dp-hs')).toBeHidden();
  await expect(page.locator('.dp-cursor')).toBeHidden();
});

test('captions use shorter chunks on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await start(page);
  const words = await page.locator('.dp-cap').evaluate((el) => el.textContent.trim().split(/\s+/).length);
  expect(words).toBeLessThanOrEqual(5);
});

test('end card Replay restarts at step 1', async ({ page }) => {
  await start(page);
  const total = Number(await dp(page).getAttribute('data-total'));
  for (let k = 1; k < total - 1; k += 1) await page.getByRole('button', { name: 'Next step' }).click();
  await expect(dp(page)).toHaveAttribute('data-type', 'end');
  await expect(page.getByRole('heading', { name: 'You found email alerts' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'read the quick start' })).toHaveAttribute('target', '_blank');
  await expect(page.getByRole('button', { name: 'Next step' })).toBeDisabled();
  await page.getByRole('button', { name: 'Replay' }).click();
  await expect(dp(page)).toHaveAttribute('data-step', '1');
});

test('sound, captions, speed and full screen controls respond', async ({ page }) => {
  await start(page);
  const sound = page.locator('[data-act="sound"]');
  await sound.click();
  await expect(sound).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('dp.sound'))).toBe('0');

  const cc = page.locator('[data-act="cc"]');
  await cc.click();
  await expect(cc).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.dp-captions')).toBeHidden();
  await cc.click();
  await expect(page.locator('.dp-captions')).toBeVisible();

  await page.locator('.dp-stage').hover();
  const speed = page.locator('[data-act="speed"]');
  await expect(speed).toBeVisible();
  await speed.click();
  await expect(speed).toHaveText('1.25×');
  await speed.click();
  await speed.click();
  await expect(speed).toHaveText('2×');
  await speed.click();
  await expect(speed).toHaveText('1×');

  await page.locator('[data-act="fullscreen"]').click(); // must not throw, even where full screen is refused

  const lang = page.locator('[data-act="lang"]');
  await lang.click();
  await expect(page.getByRole('menuitemradio', { name: 'English' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menuitemradio', { name: 'English' })).toBeHidden();

  // Settings survive a reload.
  await page.reload();
  await expect(page.locator('[data-act="sound"]')).toHaveAttribute('aria-pressed', 'false');
});

test('the progress bar has one segment per step and jumps when clicked', async ({ page }) => {
  await start(page);
  const total = Number(await dp(page).getAttribute('data-total'));
  await expect(page.locator('.dp-seg')).toHaveCount(total - 2);
  await page.locator('.dp-stage').hover();
  await page.locator('.dp-seg').nth(4).click();
  await expect(dp(page)).toHaveAttribute('data-step', '5');
  await expect(page.locator('.dp-time')).toHaveText(/^\d\d:\d\d \/ \d\d:\d\d$/);
});

test('screenshots of every step', async ({ page }) => {
  await open(page);
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/00-cover.png` });
  await page.getByRole('button', { name: 'Get Started' }).click();
  const total = Number(await dp(page).getAttribute('data-total'));
  for (let k = 1; k < total; k += 1) {
    await expect(dp(page)).toHaveAttribute('data-step', String(k));
    await settled(page);
    const type = await dp(page).getAttribute('data-type');
    const mode = await dp(page).getAttribute('data-mode');
    await page.screenshot({ path: `${SHOTS}/${String(k).padStart(2, '0')}-${type}-${mode}.png` });
    if (k < total - 1) await page.getByRole('button', { name: 'Next step' }).click();
  }
});

for (const width of [375, 768, 1440]) {
  test(`layout holds at ${width}px with no sideways scroll`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 500 ? 812 : 900 });
    await start(page);
    await page.getByRole('button', { name: 'Next step' }).click();
    await expect(dp(page)).toHaveAttribute('data-mode', 'waiting');
    await settled(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const hs = await page.locator('.dp-hs').boundingBox();
    expect(hs.width).toBeGreaterThanOrEqual(44);
    if (width < 640) {
      await expect(page.locator('.dp-url')).toBeHidden();
      await expect(page.locator('.dp-lights')).toBeHidden();
    }
    await page.screenshot({ path: `${SHOTS}/layout-${width}.png`, fullPage: true });
  });
}

test('an embedded player posts step and completion events to its host page', async ({ page }) => {
  await page.goto('/tests/host.html');
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Get Started' }).click();
  await expect.poll(() => page.evaluate(() => window.demoEvents.filter((e) => e.type === 'demo:step').length)).toBeGreaterThan(1);
  const total = await page.evaluate(() => window.demoEvents.find((e) => e.type === 'demo:step').total);
  for (let k = 1; k < total - 1; k += 1) await frame.getByRole('button', { name: 'Next step' }).click();
  await expect.poll(() => page.evaluate(() => window.demoEvents.some((e) => e.type === 'demo:complete'))).toBe(true);
  const margin = await frame.locator('.page').evaluate((el) => getComputedStyle(el).paddingLeft);
  expect(margin).toBe('0px');
});

// Every flow in flows/ is played end to end, so a new flow is tested as soon as it is added.
for (const id of findFlows('flows').map((dir) => path.basename(dir))) {
  test(`flow "${id}" plays from cover to end card with every hotspot on the screenshot`, async ({ page }) => {
    await page.goto(`/?flow=${id}`);
    await expect(dp(page)).toHaveAttribute('data-mode', 'cover');
    await page.locator('[data-act="start"]').click();
    const total = Number(await dp(page).getAttribute('data-total'));
    for (let k = 1; k < total - 1; k += 1) {
      await expect(dp(page)).toHaveAttribute('data-step', String(k));
      const hotspot = page.locator('.dp-hs');
      if (await hotspot.isVisible()) {
        const stage = await page.locator('.dp-stage').boundingBox();
        const hs = await hotspot.boundingBox();
        const cx = hs.x + hs.width / 2;
        const cy = hs.y + hs.height / 2;
        expect(cx, `step ${k} hotspot centre x`).toBeGreaterThanOrEqual(stage.x);
        expect(cx, `step ${k} hotspot centre x`).toBeLessThanOrEqual(stage.x + stage.width);
        expect(cy, `step ${k} hotspot centre y`).toBeGreaterThanOrEqual(stage.y);
        expect(cy, `step ${k} hotspot centre y`).toBeLessThanOrEqual(stage.y + stage.height);
      }
      await page.getByRole('button', { name: 'Next step' }).click();
    }
    await expect(dp(page)).toHaveAttribute('data-type', 'end');
  });
}

test('the local server never serves capture/ or project files', async ({ request }) => {
  expect((await request.get('/capture/raw/steps.json')).status()).toBe(404);
  expect((await request.get('/package.json')).status()).toBe(404);
  expect((await request.get('/tools/serve.mjs')).status()).toBe(404);
});

test('the server answers video range requests so clips can seek', async ({ request }) => {
  const res = await request.get('/flows/example/assets/t01-open-notifications.mp4', { headers: { Range: 'bytes=0-99' } });
  expect(res.status()).toBe(206);
  expect(res.headers()['content-range']).toMatch(/^bytes 0-99\/\d+$/);
  expect((await res.body()).length).toBe(100);
});

test('a missing flow shows a clear error', async ({ page }) => {
  await page.goto('/?flow=does-not-exist');
  await expect(page.getByRole('alert')).toContainText('flows/does-not-exist/flow.json');
});

test('authoring mode places a hotspot and updates the JSON', async ({ page }) => {
  await page.goto('/?edit');
  await expect(page.getByRole('heading', { name: /turn on email alerts/ })).toBeVisible();
  await page.locator('.ed-item[data-index="2"]').click();
  await page.waitForFunction(() => {
    const img = document.querySelector('.ed-canvas img');
    return img && img.complete && img.naturalWidth > 0;
  });
  const box = await page.locator('.ed-canvas').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.25);
  const json = JSON.parse(await page.locator('.ed-json textarea').inputValue());
  expect(json.steps[2].hotspot.x).toBeCloseTo(0.5, 1);
  expect(json.steps[2].hotspot.y).toBeCloseTo(0.25, 1);
  expect(json.steps[2].hotspot.target).toBeUndefined();

  await page.locator('.ed-item[data-index="1"]').click();
  await page.getByRole('button', { name: 'Duplicate as checkpoint' }).click();
  const after = JSON.parse(await page.locator('.ed-json textarea').inputValue());
  expect(after.steps).toHaveLength(json.steps.length + 1);
  expect(after.steps[2].autoAdvance).toBe(false);
  expect(after.steps[1].hotspot).toBeNull();

  await page.locator('textarea[data-f="script"]').fill('');
  await page.getByRole('link', { name: 'Open player' }).click();
  await expect(dp(page)).toHaveAttribute('data-mode', 'cover');
});
