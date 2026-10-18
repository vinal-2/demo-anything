import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { playFlow } from './play-flow.mjs';

// Every published flow gets its own test, so a new flow is checked as soon as it is listed.
const flows = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'flows', 'index.json'), 'utf8'));

for (const { id } of flows) {
  test(`${id} plays from cover to end card`, async ({ page }) => {
    await playFlow(page, id);
  });
}

test('home page lists the flows', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('index').getByRole('link', { name: /Example/ })).toHaveAttribute('href', '?flow=example');
});

test('Back and the arrow keys move between steps', async ({ page }) => {
  await page.goto('/?flow=example');
  await page.getByTestId('start').click();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByTestId('step-count')).toHaveText(/^Step 2 of/);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByTestId('step-count')).toHaveText(/^Step 1 of/);
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByTestId('cover')).toBeVisible();
});

test('an unknown flow shows a friendly message', async ({ page }) => {
  await page.goto('/?flow=does-not-exist');
  await expect(page.getByTestId('message')).toContainText('Flow not found');
});

test('the server never serves capture/', async ({ request }) => {
  expect((await request.get('/capture/raw/steps.json')).status()).toBe(404);
  expect((await request.get('/package.json')).status()).toBe(404);
});
