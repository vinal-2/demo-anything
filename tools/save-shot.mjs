// Copies a browser screenshot (JPEG or PNG) into a capture folder as a PNG.
//   node tools/save-shot.mjs <savedScreenshot> <captureDir>/shots/NN-short-name.png
// Prints the image size. Scale hotspot boxes measured in CSS pixels by
// imageWidth ÷ window.innerWidth to turn them into screenshot pixels.
import { mkdir } from 'node:fs/promises';
import { basename, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const SHOT_NAME = /^\d{2,}-[a-z0-9-]+\.png$/;

export async function saveShot(input, output) {
  if (!SHOT_NAME.test(basename(output))) {
    throw new Error(`name the file like 01-short-name.png (got ${basename(output)})`);
  }
  await mkdir(dirname(output), { recursive: true });
  const { width, height } = await sharp(input).png().toFile(output);
  return { width, height };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error('Usage: node tools/save-shot.mjs <savedScreenshot> <captureDir>/shots/NN-short-name.png');
    process.exit(2);
  }
  try {
    const { width, height } = await saveShot(input, output);
    console.log(`Saved ${output} (${width}x${height}).`);
  } catch (err) {
    console.error(`Save failed: ${err.message}`);
    process.exit(1);
  }
}
