import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// Flow ids are folder names and URL values, so keep them simple.
export const FLOW_ID = /^[a-z0-9][a-z0-9-]*$/;

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function writeJson(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`);
}

// Adds or replaces a flow in <flowsRoot>/index.json, the list the player's home page shows.
export async function updateIndex(flowsRoot, { id, name }) {
  const file = join(flowsRoot, 'index.json');
  let flows = [];
  try {
    flows = await readJson(file);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  const updated = [...flows.filter((flow) => flow.id !== id), { id, name }];
  await writeJson(file, updated.sort((a, b) => a.name.localeCompare(b.name)));
}
