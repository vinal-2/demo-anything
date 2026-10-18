// Draws boxes on copies of a capture's screenshots so you can check them by eye.
//   node tools/preview-boxes.mjs <captureDir>
// Orange: the hotspot from steps.json. Red: areas to hide from redact.json (if present).
// Writes <captureDir>/preview/<shot>.png. The originals are not changed.
import { mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { readJson } from './lib/flows.mjs';
import { imageSize } from './lib/image-size.mjs';

const SHOT_NAME = /^(\d+)-.+\.png$/i;

export async function previewBoxes(captureDir) {
  const steps = await readJson(join(captureDir, 'steps.json'));
  const redactPlan = await readJson(join(captureDir, 'redact.json')).catch((err) => {
    if (err.code === 'ENOENT') return {};
    throw err;
  });
  const hotspots = new Map(steps.map((entry) => [entry.step, entry.box]));

  const shotsDir = join(captureDir, 'shots');
  const outDir = join(captureDir, 'preview');
  await mkdir(outDir, { recursive: true });

  const written = [];
  for (const shot of (await readdir(shotsDir)).filter((file) => SHOT_NAME.test(file)).sort()) {
    const { width, height } = imageSize(join(shotsDir, shot));
    const rects = [];
    const hotspot = hotspots.get(Number(SHOT_NAME.exec(shot)[1]));
    if (hotspot) rects.push(rect(hotspot, '#ff7a00'));
    for (const area of redactPlan[shot] ?? []) rects.push(rect(area, '#e00000', '10 6'));

    const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects.join('')}</svg>`;
    await sharp(join(shotsDir, shot)).composite([{ input: Buffer.from(overlay) }]).png().toFile(join(outDir, shot));
    written.push(join(outDir, shot));
  }
  return written;
}

function rect({ x, y, width, height }, colour, dash = '') {
  const n = (value) => Number(value) || 0;
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(width)}" height="${n(height)}" fill="none" stroke="${colour}" stroke-width="4"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const captureDir = process.argv[2];
  if (!captureDir) {
    console.error('Usage: node tools/preview-boxes.mjs <captureDir>');
    process.exit(2);
  }
  try {
    const files = await previewBoxes(captureDir);
    console.log(`Wrote ${files.length} previews to ${join(captureDir, 'preview')}. Look at each one.`);
  } catch (err) {
    console.error(`Preview failed: ${err.message}`);
    process.exit(1);
  }
}
