// Hides sensitive areas in raw screenshots and writes cleaned copies.
//   node tools/redact.mjs <rawDir> <cleanDir>
// <rawDir> holds shots/*.png, steps.json and redact.json. redact.json lists EVERY
// screenshot with the areas to hide, using [] when there is nothing to hide:
//   { "01-home.png": [{ "x": 10, "y": 20, "width": 300, "height": 24, "reason": "tenant name" }], "02-list.png": [] }
// Areas are pixelated and then blurred, so text inside them cannot be read.
import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { readJson } from './lib/flows.mjs';
import { pngSize } from './lib/png-size.mjs';

const PIXEL_BLOCK = 12;
const BLUR_SIGMA = 8;

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

  await mkdir(join(cleanDir, 'shots'), { recursive: true });
  let areas = 0;
  for (const shot of shots) {
    const input = join(shotsDir, shot);
    const output = join(cleanDir, 'shots', shot);
    const size = await pngSize(input);
    if (!Array.isArray(plan[shot])) throw new Error(`redact.json: ${shot} must be a list of areas`);

    const patches = [];
    for (const [i, area] of plan[shot].entries()) {
      const box = toPixelBox(area, size, `${shot} area ${i + 1}`);
      patches.push({ input: await obscure(input, box), left: box.left, top: box.top });
    }
    if (patches.length) await sharp(input).composite(patches).png().toFile(output);
    else await copyFile(input, output);
    areas += patches.length;
  }

  await copyFile(join(rawDir, 'steps.json'), join(cleanDir, 'steps.json'));
  return { shots: shots.length, areas };
}

// Rounds outwards so the whole area is covered, and trims it to the image.
function toPixelBox(area, size, where) {
  if (!['x', 'y', 'width', 'height'].every((key) => typeof area?.[key] === 'number')) {
    throw new Error(`redact.json ${where}: needs x, y, width and height as numbers`);
  }
  const left = Math.max(0, Math.floor(area.x));
  const top = Math.max(0, Math.floor(area.y));
  const right = Math.min(size.width, Math.ceil(area.x + area.width));
  const bottom = Math.min(size.height, Math.ceil(area.y + area.height));
  if (right <= left || bottom <= top) throw new Error(`redact.json ${where}: is empty or outside the screenshot`);
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
