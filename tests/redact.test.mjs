import assert from 'node:assert/strict';
import { access, cp, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import sharp from 'sharp';
import { sha256 } from '../tools/lib/manifest.mjs';
import { previewBoxes } from '../tools/preview-boxes.mjs';
import { redact } from '../tools/redact.mjs';
import { saveShot } from '../tools/save-shot.mjs';

const EXAMPLE_SHOTS = join(import.meta.dirname, '..', 'tools', 'fixtures', 'capture-sample', 'shots');
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

  test('keeps the pixels of a screenshot with nothing to hide but drops its metadata', async () => {
    const rawDir = await makeRaw('nothing', { '01-home.png': [] });
    const raw = join(rawDir, 'shots', '01-home.png');
    const tagged = join(rawDir, 'tagged.png');
    await sharp(raw).withExif({ IFD0: { Copyright: 'Contoso tenant 1234' } }).png().toFile(tagged);
    await cp(tagged, raw);
    assert.ok((await sharp(raw).metadata()).exif, 'the test image should start with metadata');

    const cleanDir = join(work, 'nothing', 'clean');
    await redact({ rawDir, cleanDir });
    const clean = join(cleanDir, 'shots', '01-home.png');
    assert.equal(await areaDifference(raw, clean, { x: 0, y: 0, width: 1600, height: 900 }), 0);
    assert.equal((await sharp(clean).metadata()).exif, undefined);
  });

  test('pads each area by 8 px so the edges of text are covered', async () => {
    const rawDir = await makeRaw('pad', { '01-home.png': [HEADING] });
    const cleanDir = join(work, 'pad', 'clean');
    await redact({ rawDir, cleanDir });
    const raw = join(rawDir, 'shots', '01-home.png');
    const clean = join(cleanDir, 'shots', '01-home.png');
    // A strip just outside the listed box is now inside the padding.
    assert.ok(await areaDifference(raw, clean, { x: HEADING.x - 6, y: HEADING.y, width: 4, height: HEADING.height }) > 0);
    assert.equal(await areaDifference(raw, clean, { x: HEADING.x - 30, y: HEADING.y, width: 4, height: HEADING.height }), 0);
  });

  test('a solid area becomes one opaque colour', async () => {
    const rawDir = await makeRaw('solid', { '01-home.png': [{ ...HEADING, style: 'solid', pad: 0 }] });
    const cleanDir = join(work, 'solid', 'clean');
    await redact({ rawDir, cleanDir });
    // stats() reads the whole input, so crop to a buffer first.
    const crop = await sharp(join(cleanDir, 'shots', '01-home.png')).extract({ left: HEADING.x, top: HEADING.y, width: HEADING.width, height: HEADING.height }).png().toBuffer();
    const { channels } = await sharp(crop).stats();
    channels.slice(0, 3).forEach((c) => assert.equal(c.min, c.max));
  });

  test('empties the clean folder first, so old screenshots cannot linger', async () => {
    const rawDir = await makeRaw('stale', { '01-home.png': [] });
    const cleanDir = join(work, 'stale', 'clean');
    await mkdir(join(cleanDir, 'shots'), { recursive: true });
    await writeFile(join(cleanDir, 'shots', '01-old-name.png'), 'old');
    await redact({ rawDir, cleanDir });
    assert.deepEqual(await readdir(join(cleanDir, 'shots')), ['01-home.png']);
  });

  test('writes redaction.json with the hash of every cleaned screenshot', async () => {
    const rawDir = await makeRaw('manifest', { '01-home.png': [HEADING] });
    const cleanDir = join(work, 'manifest', 'clean');
    await redact({ rawDir, cleanDir });
    const manifest = JSON.parse(await readFile(join(cleanDir, 'redaction.json'), 'utf8'));
    assert.equal(manifest.files.length, 1);
    assert.equal(manifest.files[0].file, 'shots/01-home.png');
    assert.equal(manifest.files[0].areas, 1);
    assert.equal(manifest.files[0].sha256, await sha256(join(cleanDir, 'shots', '01-home.png')));
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
