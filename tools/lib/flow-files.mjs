// Which files a flow uses, shared by the validator and the site build.
import fs from 'node:fs';
import path from 'node:path';

// A web address (https:, data:, //host ...) rather than a file in the flow folder.
export const isRemote = (p) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(p);
const srcList = (src) => (Array.isArray(src) ? src : [src]).filter(Boolean);

// Every file reference in a flow: where it is, which field, the path and the kind of
// file that field needs.
export function fileRefs(flow) {
  const refs = [];
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  steps.forEach((step, i) => {
    if (!step || typeof step !== 'object') return;
    const add = (field, file, kind) => { if (typeof file === 'string' && file) refs.push({ step: i, field, file, kind }); };
    if (step.type === 'image' || step.type === 'video') srcList(step.src).forEach((f) => add('src', f, step.type));
    add('logo', step.logo, 'image');
    add('bg', step.bg, 'image');
    add('voice audio', step.voice?.audio, 'audio');
    Object.entries(step.voice?.variants || {}).forEach(([id, v]) => add(`${id} audio`, v?.audio, 'audio'));
  });
  if (flow.backgroundMusic?.src) refs.push({ step: null, field: 'backgroundMusic', file: flow.backgroundMusic.src, kind: 'audio' });
  return refs;
}

// Every local file a flow refers to, relative to its folder, plus flow.json.
export function referencedFiles(flow) {
  const files = new Set(['flow.json']);
  for (const { file } of fileRefs(flow)) if (!isRemote(file)) files.add(path.posix.normalize(file));
  return [...files].filter((f) => !f.startsWith('..') && !path.isAbsolute(f)).sort();
}

// Every symbolic link (or Windows junction) inside a folder, relative to it, or ["."] when
// the folder itself is one. Nothing behind a link is walked. A link in a flow could publish
// or serve a file from anywhere, such as an unredacted screenshot of the same size.
export function symlinksIn(dir) {
  if (fs.lstatSync(dir).isSymbolicLink()) return ['.'];
  const found = [];
  const walk = (rel) => {
    for (const d of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const r = rel ? `${rel}/${d.name}` : d.name;
      if (d.isSymbolicLink()) found.push(r);
      else if (d.isDirectory()) walk(r);
    }
  };
  walk('');
  return found.sort();
}

// Every file in a folder, relative to it, with forward slashes.
export function listFiles(dir) {
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile())
    .map((d) => path.relative(dir, path.join(d.parentPath ?? d.path, d.name)).split(path.sep).join('/'))
    .sort();
}
