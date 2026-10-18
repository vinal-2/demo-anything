// Builds the folder GitHub Pages publishes: index.html, player/ and, for each flow, only
// flow.json and the files it actually uses. Anything else in a flow folder stays private.
//   node tools/build-site.mjs [outDir]      (default _site)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFlows } from './validate-flow.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isRemote = (p) => /^(?:[a-z][a-z0-9+.-]*:)/i.test(p);

// Every local file a flow refers to, relative to its folder.
export function referencedFiles(flow) {
  const files = new Set(['flow.json']);
  const add = (p) => { if (typeof p === 'string' && p && !isRemote(p)) files.add(path.posix.normalize(p)); };
  for (const step of flow.steps || []) {
    (Array.isArray(step.src) ? step.src : [step.src]).forEach(add);
    add(step.logo);
    add(step.bg);
    add(step.voice?.audio);
    Object.values(step.voice?.variants || {}).forEach((v) => add(v?.audio));
  }
  add(flow.backgroundMusic?.src);
  return [...files].filter((f) => !f.startsWith('..') && !path.isAbsolute(f)).sort();
}

export function buildSite({ root = ROOT, out = path.join(ROOT, '_site') } = {}) {
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.copyFileSync(path.join(root, 'index.html'), path.join(out, 'index.html'));
  fs.cpSync(path.join(root, 'player'), path.join(out, 'player'), { recursive: true });
  const published = [];
  for (const dir of findFlows(path.join(root, 'flows'))) {
    const id = path.basename(dir);
    const flow = JSON.parse(fs.readFileSync(path.join(dir, 'flow.json'), 'utf8'));
    for (const rel of referencedFiles(flow)) {
      const target = path.join(out, 'flows', id, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(dir, rel), target);
      published.push(`flows/${id}/${rel}`);
    }
  }
  return published;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.resolve(process.argv[2] || path.join(ROOT, '_site'));
  const files = buildSite({ out });
  console.log(`Built ${path.relative(process.cwd(), out) || out}: index.html, player/ and ${files.length} flow files.`);
}
