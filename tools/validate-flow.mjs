// Checks flows before they are published.
//   node tools/validate-flow.mjs <flowDir> [<flowDir> ...]
//   node tools/validate-flow.mjs --all        every folder in flows/ with a flow.json
// Exits with 1 when there are errors. A flow is ready when it prints PASS with 0 warnings.
import { readdir } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { FLOW_ID, readJson } from './lib/flows.mjs';
import { pngSize } from './lib/png-size.mjs';

const RATIO_TOLERANCE = 0.001;
const MAX_LABEL_LENGTH = 40;

export async function validateFlow(flowDir) {
  const errors = [];
  const warnings = [];
  const error = (where, message) => errors.push(`${where}: ${message}`);
  const warn = (where, message) => warnings.push(`${where}: ${message}`);

  let flow;
  try {
    flow = await readJson(join(flowDir, 'flow.json'));
  } catch (err) {
    error('flow.json', err.code === 'ENOENT' ? 'file not found' : `not valid JSON (${err.message})`);
    return { errors, warnings };
  }

  const id = basename(resolve(flowDir));
  if (!FLOW_ID.test(id)) error('id', 'the folder name must use lower-case letters, numbers and dashes');
  if (flow.id !== id) error('id', `must be "${id}" to match the folder name`);
  if (!hasText(flow.name)) error('name', 'is missing');
  if (!hasText(flow.cover?.title)) error('cover', 'title is missing');
  if (!hasText(flow.cover?.subtitle)) warn('cover', 'subtitle is empty');
  if (!hasText(flow.end?.title)) warn('end', 'title is empty, so the player shows a default');

  const size = flow.imageSize;
  const sizeOk = isPositiveInt(size?.width) && isPositiveInt(size?.height);
  if (!sizeOk) error('imageSize', 'needs a whole-number width and height');
  if (!(typeof flow.aspectRatio === 'number' && flow.aspectRatio > 0)) {
    error('aspectRatio', 'must be a positive number (height ÷ width)');
  } else if (sizeOk && Math.abs(flow.aspectRatio - size.height / size.width) > RATIO_TOLERANCE) {
    error('aspectRatio', `is ${flow.aspectRatio} but the screenshots are ${size.height / size.width} (height ÷ width)`);
  }

  if (!Array.isArray(flow.steps) || flow.steps.length === 0) {
    error('steps', 'needs at least one step');
    return { errors, warnings };
  }
  for (const [i, step] of flow.steps.entries()) {
    await checkStep(step, i, { flowDir, size: sizeOk ? size : null, error, warn });
  }

  await checkListed(flowDir, id, warn);
  return { errors, warnings };
}

async function checkStep(step, i, { flowDir, size, error, warn }) {
  const where = `step ${i + 1}`;
  if (step.step !== i + 1) warn(where, `is numbered ${step.step}; steps should run 1, 2, 3 in order`);
  if (!hasText(step.screen)) warn(where, 'screen title is empty');
  if (!hasText(step.say)) warn(where, 'narration ("say") is empty');

  const imageOk = await checkImage(step.image, { flowDir, size, where, error });
  const box = step.hotspot;
  if (!box || !['x', 'y', 'width', 'height'].every((key) => typeof box[key] === 'number')) {
    error(where, 'hotspot needs x, y, width and height as numbers');
    return;
  }
  if (box.width <= 0 || box.height <= 0) error(where, 'hotspot width and height must be more than 0');
  if (imageOk && size && (box.x < 0 || box.y < 0 || box.x + box.width > size.width || box.y + box.height > size.height)) {
    error(where, 'hotspot sits outside the screenshot');
  }
  if (!hasText(box.label)) warn(where, 'hotspot label is empty');
  else if (box.label.length > MAX_LABEL_LENGTH) warn(where, `hotspot label is longer than ${MAX_LABEL_LENGTH} characters; keep it short`);
}

async function checkImage(image, { flowDir, size, where, error }) {
  if (!hasText(image)) {
    error(where, 'image is missing');
    return false;
  }
  const file = resolve(flowDir, image);
  const rel = relative(resolve(flowDir), file);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    error(where, `image "${image}" must be inside the flow folder`);
    return false;
  }
  try {
    const actual = await pngSize(file);
    if (size && (actual.width !== size.width || actual.height !== size.height)) {
      error(where, `${image} is ${actual.width}x${actual.height} but imageSize is ${size.width}x${size.height}`);
      return false;
    }
    return true;
  } catch (err) {
    error(where, err.code === 'ENOENT' ? `${image} not found` : err.message);
    return false;
  }
}

async function checkListed(flowDir, id, warn) {
  try {
    const index = await readJson(join(dirname(resolve(flowDir)), 'index.json'));
    if (!index.some((entry) => entry.id === id)) warn('index', `${id} is not listed in flows/index.json`);
  } catch {
    warn('index', 'flows/index.json is missing or not valid JSON');
  }
}

const hasText = (value) => typeof value === 'string' && value.trim() !== '';
const isPositiveInt = (value) => Number.isInteger(value) && value > 0;

// Every folder in flowsRoot that has a flow.json.
export async function findFlows(flowsRoot) {
  const dirs = [];
  for (const entry of await readdir(flowsRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const contents = await readdir(join(flowsRoot, entry.name));
    if (contents.includes('flow.json')) dirs.push(join(flowsRoot, entry.name));
  }
  return dirs.sort();
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const flowDirs = args.includes('--all') ? await findFlows(resolve(import.meta.dirname, '..', 'flows')) : args;
  if (flowDirs.length === 0) {
    console.error('Usage: node tools/validate-flow.mjs <flowDir> [<flowDir> ...] | --all');
    process.exit(2);
  }
  let failed = 0;
  for (const flowDir of flowDirs) {
    const { errors, warnings } = await validateFlow(flowDir);
    if (errors.length) failed += 1;
    console.log(`${errors.length ? 'FAIL' : 'PASS'} ${flowDir}: ${plural(errors.length, 'error')}, ${plural(warnings.length, 'warning')}`);
    for (const message of errors) console.log(`  error    ${message}`);
    for (const message of warnings) console.log(`  warning  ${message}`);
  }
  process.exit(failed ? 1 : 0);
}
