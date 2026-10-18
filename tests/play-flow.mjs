import { expect } from '@playwright/test';

// Plays a flow from the cover card to the end card, checking on every step
// that the screenshot loaded and the hotspot sits inside it.
export async function playFlow(page, flowId) {
  const res = await page.request.get(`/flows/${flowId}/flow.json`);
  expect(res.ok(), `flows/${flowId}/flow.json should load`).toBe(true);
  const flow = await res.json();

  await page.goto(`/?flow=${flowId}`);
  await expect(page.getByTestId('cover')).toContainText(flow.cover.title);
  await page.getByTestId('start').click();

  for (const [i, step] of flow.steps.entries()) {
    await expect(page.getByTestId('step-count')).toHaveText(`Step ${i + 1} of ${flow.steps.length}`);
    const image = page.getByTestId('screenshot');
    await expect(image).toHaveAttribute('src', `flows/${flowId}/${step.image}`);
    await expect.poll(() => image.evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);

    const hotspot = page.getByTestId('hotspot');
    const imageBox = await image.boundingBox();
    const spotBox = await hotspot.boundingBox();
    const within = 1; // allow for sub-pixel rounding
    expect(spotBox.x, `step ${i + 1} hotspot left edge`).toBeGreaterThanOrEqual(imageBox.x - within);
    expect(spotBox.y, `step ${i + 1} hotspot top edge`).toBeGreaterThanOrEqual(imageBox.y - within);
    expect(spotBox.x + spotBox.width, `step ${i + 1} hotspot right edge`).toBeLessThanOrEqual(imageBox.x + imageBox.width + within);
    expect(spotBox.y + spotBox.height, `step ${i + 1} hotspot bottom edge`).toBeLessThanOrEqual(imageBox.y + imageBox.height + within);

    await hotspot.click();
  }

  await expect(page.getByTestId('end')).toBeVisible();
}
