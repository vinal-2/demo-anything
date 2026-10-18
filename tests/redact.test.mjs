import assert from 'node:assert/strict';
import { access, cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import sharp from 'sharp';
import { previewBoxes } from '../tools/preview-boxes.mjs';
import { redact } from '../tools/redact.mjs';
import { saveShot } from '../tools/save-shot.mjs';

const EXAMPLE_SHOTS = join(import.meta.dirname, '..', 'flows', 'example', 'shots');
const STEPS = [{ step: 1, screen: 'Home', element: 'Settings', box: { x: 16, y: 250, width: 228, height: 44 }, say: 'Open Settings.' }];
// The "Welcome back" heading on the example home screen.
const HEADING = { x: 296, y: 96, width: 260, height: 48 };
let work;

before(async () => {
  work = await mkdtemp(join(tmpdir(), 'demo-anything-redact-'));
});
after(async () => {
  await rm(work, { recursive: true, force: true });
});

async function makeRaw(name, plan) {
  const rawDir = join(work, name, 'raw');
  await mkdir(join(rawDir, 'shots'), { recursive: true });
  await cp(join(EXAMPLE_SHOTS, '01-home.png'), join(rawDir, 'shots', '01-home.png'));
  await writeFile(join(rawDir, 'steps.json'), JSON.stringify(STEPS));
  if (plan) await writeFile(join(rawDir, 'redact.json'), JSON.stringify(plan));
  return rawDir;
}

// Mean absolute difference between the same area of two images, 0 to 255.
async function areaDifference(fileA, fileB, { x, y, width, height }) {
  const read = (file) => sharp(file).extract({ left: x, top: y, width, height }).removeAlpha().raw().toBuffer();
  const [a, b] = await Promise.all([read(fileA), read(fileB)]);
  let total = 0;
  for (let i = 0; i < a.length; i += 1) total += Math.abs(a[i] - b[i]);
  return total / a.length;
}

describe('redact', () => {
  test('changes the listed area and leaves the rest alone', async () => {
    const rawDir = await makeRaw('blur', { '01-home.png': [{ ...HEADING, reason: 'heading' }] });
    const cleanDir = join(work, 'blur', 'clean');
    assert.deepEqual(await redact({ rawDir, cleanDir }), { shots: 1, areas: 1 });

    const raw = join(rawDir, 'shots', '01-home.png');
    const clean = join(cleanDir, 'shots', '01-home.png');
    assert.ok(await areaDifference(raw, clean, HEADING) > 8, 'the heading area should be obscured');
    assert.equal(await areaDifference(raw, clean, { x: 300, y: 400, width: 400, height: 200 }), 0);
    await access(join(cleanDir, 'steps.json'));
  });

  test('refuses to run when a screenshot is not listed', async () => {
    const rawDir = await makeRaw('unlisted', {});
    await assert.rejects(redact({ rawDir, cleanDir: join(work, 'unlisted', 'clean') }), /does not list 01-home\.png/);
  });

  test('refuses an area outside the screenshot', async () => {
    const rawDir = await makeRaw('outside', { '01-home.png': [{ x: 5000, y: 10, width: 20, height: 20 }] });
    await assert.rejects(redact({ rawDir, cleanDir: join(work, 'outside', 'clean') }), /outside the screenshot/);
  });

  test('copies a screenshot with nothing to hide unchanged', async () => {
    const rawDir = await makeRaw('nothing', { '01-home.png': [] });
    const cleanDir = join(work, 'nothing', 'clean');
    await redact({ rawDir, cleanDir });
    const raw = join(rawDir, 'shots', '01-home.png');
    assert.equal(await areaDifference(raw, join(cleanDir, 'shots', '01-home.png'), { x: 0, y: 0, width: 1600, height: 900 }), 0);
  });
});

describe('save-shot', () => {
  test('turns a JPEG screenshot into a correctly named PNG', async () => {
    const jpeg = join(work, 'browser-shot.jpg');
    await sharp(join(EXAMPLE_SHOTS, '01-home.png')).resize(1456).jpeg().toFile(jpeg);
    const output = join(work, 'save', 'shots', '01-home.png');
    assert.deepEqual(await saveShot(jpeg, output), { width: 1456, height: 819 });
    assert.equal((await sharp(output).metadata()).format, 'png');
  });

  test('refuses a file name the importer would not match', async () => {
    await assert.rejects(saveShot(join(EXAMPLE_SHOTS, '01-home.png'), join(work, 'save', 'shots', 'home.png')), /01-short-name\.png/);
  });
});

describe('preview-boxes', () => {
  test('writes a preview with the boxes drawn and leaves the original alone', async () => {
    const rawDir = await makeRaw('preview', { '01-home.png': [HEADING] });
    const [preview] = await previewBoxes(rawDir);
    assert.equal(preview, join(rawDir, 'preview', '01-home.png'));
    const raw = join(rawDir, 'shots', '01-home.png');
    assert.ok(await areaDifference(raw, preview, { x: 14, y: 248, width: 232, height: 4 }) > 20, 'the hotspot outline should be drawn');
  });
});
