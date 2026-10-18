// Hides sensitive areas in raw screenshots and writes cleaned copies.
//   node tools/redact.mjs <rawDir> <cleanDir>
// <rawDir> holds shots/*.png, steps.json and redact.json. redact.json lists EVERY
// screenshot with the areas to hide, using [] when there is nothing to hide:
//   { "01-home.png": [{ "x": 10, "y": 20, "width": 300, "height": 24, "reason": "tenant name" }],
//     "02-list.png": [{ "x": 40, "y": 90, "width": 380, "height": 22, "style": "solid", "pad": 12 }],
//     "03-done.png": [] }
// Each area grows by "pad" pixels (8 by default) so the edges of text are covered too.
// "style" is "blur" (pixelated, then blurred; the default) or "solid" (an opaque block, best for IDs).
// The clean folder is emptied first, every image is re-encoded so no metadata survives, and
// redaction.json records each output's SHA-256 so `npm run import` can check it.
import { copyFile, mkdir, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { readJson } from './lib/flows.mjs';
import { imageSize } from './lib/image-size.mjs';
import { sha256, writeManifest } from './lib/manifest.mjs';

export const DEFAULT_PAD = 8;
const PIXEL_BLOCK = 12;
const BLUR_SIGMA = 8;
const SOLID = { r: 17, g: 24, b: 39 };

export async function redact({ rawDir, cleanDir }) {
  const plan = await readJson(join(rawDir, 'redact.json'));
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    throw new Error('redact.json must map each screenshot name to a list of areas');
  }

  const shotsDir = join(rawDir, 'shots');
  const shots = (await readdir(shotsDir)).filter((file) => file.toLowerCase().endsWith('.png')).sort();
  const unlisted = shots.filter((shot) => !Object.hasOwn(plan, shot));
  if (unlisted.length) {
    throw new Error(`redact.json does not list ${unlisted.join(', ')}; use [] for a screenshot with nothing to hide`);
  }
  const unknown = Object.keys(plan).filter((name) => !shots.includes(name));
  if (unknown.length) throw new Error(`redact.json lists ${unknown.join(', ')}, which is not in shots/`);

  // Start from an empty folder, so a renamed or removed screenshot can't linger.
  await rm(join(cleanDir, 'shots'), { recursive: true, force: true });
  await mkdir(join(cleanDir, 'shots'), { recursive: true });
  let areas = 0;
  const entries = [];
  for (const shot of shots) {
    const input = join(shotsDir, shot);
    const output = join(cleanDir, 'shots', shot);
    const size = imageSize(input);
    if (!Array.isArray(plan[shot])) throw new Error(`redact.json: ${shot} must be a list of areas`);

    const patches = [];
    for (const [i, area] of plan[shot].entries()) {
      const where = `${shot} area ${i + 1}`;
      const box = toPixelBox(area, size, where);
      const style = area.style ?? 'blur';
      if (style !== 'blur' && style !== 'solid') throw new Error(`redact.json ${where}: style must be "blur" or "solid"`);
      patches.push({ input: style === 'solid' ? await solid(box) : await obscure(input, box), left: box.left, top: box.top });
    }
    // Re-encoding drops any metadata the screenshot carried, even when nothing is hidden.
    const image = sharp(input);
    await (patches.length ? image.composite(patches) : image).png().toFile(output);
    entries.push({ file: `shots/${shot}`, sha256: await sha256(output), source: `shots/${shot}`, sourceSha256: await sha256(input), areas: patches.length });
    areas += patches.length;
  }

  await copyFile(join(rawDir, 'steps.json'), join(cleanDir, 'steps.json'));
  await writeManifest(cleanDir, entries);
  return { shots: shots.length, areas };
}

// Grows the area by its padding, rounds outwards and trims it to the image.
function toPixelBox(area, size, where) {
  if (!['x', 'y', 'width', 'height'].every((key) => typeof area?.[key] === 'number')) {
    throw new Error(`redact.json ${where}: needs x, y, width and height as numbers`);
  }
  const pad = area.pad ?? DEFAULT_PAD;
  if (typeof pad !== 'number' || pad < 0) throw new Error(`redact.json ${where}: pad must be a number of pixels, 0 or more`);
  const left = Math.max(0, Math.floor(area.x - pad));
  const top = Math.max(0, Math.floor(area.y - pad));
  const right = Math.min(size.width, Math.ceil(area.x + area.width + pad));
  const bottom = Math.min(size.height, Math.ceil(area.y + area.height + pad));
  if (right <= left || bottom <= top || area.x >= size.width || area.y >= size.height) {
    throw new Error(`redact.json ${where}: is empty or outside the screenshot`);
  }
  return { left, top, width: right - left, height: bottom - top };
}

async function obscure(file, box) {
  const small = {
    width: Math.max(1, Math.round(box.width / PIXEL_BLOCK)),
    height: Math.max(1, Math.round(box.height / PIXEL_BLOCK)),
  };
  const tiny = await sharp(file).extract(box).resize({ ...small, fit: 'fill' }).png().toBuffer();
  const blocky = await sharp(tiny).resize({ width: box.width, height: box.height, fit: 'fill', kernel: 'nearest' }).png().toBuffer();
  return sharp(blocky).blur(BLUR_SIGMA).png().toBuffer();
}

const solid = (box) => sharp({ create: { width: box.width, height: box.height, channels: 3, background: SOLID } }).png().toBuffer();

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [rawDir, cleanDir] = process.argv.slice(2);
  if (!rawDir || !cleanDir) {
    console.error('Usage: node tools/redact.mjs <rawDir> <cleanDir>');
    process.exit(2);
  }
  try {
    const { shots, areas } = await redact({ rawDir, cleanDir });
    console.log(`Redacted ${areas} area${areas === 1 ? '' : 's'} across ${shots} screenshots into ${cleanDir}.`);
    console.log('Next: look at every image in the clean folder before you import it.');
  } catch (err) {
    console.error(`Redact failed: ${err.message}`);
    process.exit(1);
  }
}
