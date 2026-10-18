// redaction.json: written by `npm run redact` into the clean folder, checked by `npm run import`,
// so a flow can only be built from screenshots that went through redaction.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const MANIFEST = 'redaction.json';
const IMAGE = /\.(png|jpe?g)$/i;

export const sha256 = async (file) => createHash('sha256').update(await readFile(file)).digest('hex');

export async function writeManifest(cleanDir, entries) {
  const manifest = { tool: 'demo-anything redact', version: 1, files: entries };
  await writeFile(join(cleanDir, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
}

// Throws unless every screenshot in <captureDir>/shots is listed in the manifest with a matching hash.
export function verifyManifest(captureDir) {
  const fix = 'Run `npm run redact -- capture/raw capture/clean` and import from capture/clean.';
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(captureDir, MANIFEST), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`${captureDir} has no ${MANIFEST}, so its screenshots weren't redacted. ${fix}`);
    throw new Error(`${MANIFEST} in ${captureDir} isn't valid JSON. ${fix}`);
  }
  const listed = new Map((manifest.files || []).map((f) => [f.file, f.sha256]));
  for (const name of readdirSync(join(captureDir, 'shots')).filter((f) => IMAGE.test(f))) {
    const expected = listed.get(`shots/${name}`);
    if (!expected) throw new Error(`shots/${name} isn't in ${MANIFEST}: it was added after redaction. ${fix}`);
    const actual = createHash('sha256').update(readFileSync(join(captureDir, 'shots', name))).digest('hex');
    if (expected !== actual) throw new Error(`shots/${name} changed after redaction. ${fix}`);
  }
}
