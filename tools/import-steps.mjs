// Turns a capture folder into a flow the player can show.
//   node tools/import-steps.mjs <captureDir> <flowDir> --name "Flow name" [--force]
// The capture folder holds shots/NN-short-name.png and steps.json (see README).
// Only import a folder whose screenshots are already redacted.
import { access, copyFile, mkdir, readdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { FLOW_ID, readJson, updateIndex, writeJson } from './lib/flows.mjs';
import { pngSize } from './lib/png-size.mjs';

const SHOT_NAME = /^(\d+)-.+\.png$/i;

export async function importSteps({ captureDir, flowDir, name, force = false }) {
  const id = basename(resolve(flowDir));
  if (!FLOW_ID.test(id)) throw new Error(`folder name "${id}" must use lower-case letters, numbers and dashes`);
  if (!name?.trim()) throw new Error('give the flow a name with --name');

  const flowFile = join(flowDir, 'flow.json');
  if (!force && (await exists(flowFile))) throw new Error(`${flowFile} already exists; use --force to replace it`);

  const entries = await readJson(join(captureDir, 'steps.json'));
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('steps.json must be a list with at least one step');

  const shotsDir = join(captureDir, 'shots');
  const shots = await shotsByStep(shotsDir);
  await mkdir(join(flowDir, 'shots'), { recursive: true });

  let imageSize;
  const steps = [];
  for (const entry of [...entries].sort((a, b) => a.step - b.step)) {
    checkEntry(entry);
    const shot = shots.get(entry.step);
    if (!shot) throw new Error(`no screenshot for step ${entry.step} (expected shots/${String(entry.step).padStart(2, '0')}-name.png)`);

    const size = await pngSize(join(shotsDir, shot));
    imageSize ??= size;
    if (size.width !== imageSize.width || size.height !== imageSize.height) {
      throw new Error(`${shot} is ${size.width}x${size.height} but every screenshot must be ${imageSize.width}x${imageSize.height}`);
    }
    await copyFile(join(shotsDir, shot), join(flowDir, 'shots', shot));

    const { x, y, width, height } = entry.box;
    steps.push({
      step: entry.step,
      screen: entry.screen,
      image: `shots/${shot}`,
      hotspot: { x, y, width, height, label: entry.element },
      say: entry.say,
      why: entry.why,
    });
  }

  const flow = {
    id,
    name,
    cover: { title: name, subtitle: '' },
    aspectRatio: imageSize.height / imageSize.width,
    imageSize,
    steps,
    end: { title: 'All done', text: `You have finished "${name}".` },
  };
  await writeJson(flowFile, flow);
  await updateIndex(dirname(resolve(flowDir)), { id, name });
  return flow;
}

function checkEntry(entry) {
  const where = `steps.json step ${entry?.step ?? '?'}`;
  if (!Number.isInteger(entry?.step) || entry.step < 1) throw new Error(`${where}: "step" must be a whole number from 1`);
  for (const key of ['screen', 'element', 'say']) {
    if (typeof entry[key] !== 'string' || !entry[key].trim()) throw new Error(`${where}: "${key}" is missing`);
  }
  for (const key of ['x', 'y', 'width', 'height']) {
    if (typeof entry.box?.[key] !== 'number') throw new Error(`${where}: box.${key} must be a number`);
  }
}

async function shotsByStep(dir) {
  const shots = new Map();
  for (const file of await readdir(dir)) {
    const match = SHOT_NAME.exec(file);
    if (!match) continue;
    const step = Number(match[1]);
    if (shots.has(step)) throw new Error(`two screenshots for step ${step}: ${shots.get(step)} and ${file}`);
    shots.set(step, file);
  }
  return shots;
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { name: { type: 'string' }, force: { type: 'boolean', default: false } },
  });
  if (positionals.length !== 2) {
    console.error('Usage: node tools/import-steps.mjs <captureDir> <flowDir> --name "Flow name" [--force]');
    process.exit(2);
  }
  const [captureDir, flowDir] = positionals;
  try {
    const flow = await importSteps({ captureDir, flowDir, name: values.name, force: values.force });
    console.log(`Imported ${flow.steps.length} steps into ${flowDir}.`);
    console.log('Next: set the cover subtitle and hotspot labels in flow.json, then run validate-flow.');
  } catch (err) {
    console.error(`Import failed: ${err.message}`);
    process.exit(1);
  }
}
