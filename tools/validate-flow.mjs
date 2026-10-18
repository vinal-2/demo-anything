#!/usr/bin/env node
// Lints flow folders. Errors fail the run; warnings are printed but don't fail it.
// A flow is ready to publish when it passes with 0 warnings.
//
// Usage: node tools/validate-flow.mjs flows/<flow-id> [flows/<other-id> ...]
//        node tools/validate-flow.mjs --all      every folder in flows/ with a flow.json

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from './lib/image-size.mjs';

const RATIO_TOLERANCE = 0.002;

const TYPES = new Set(['cover', 'image', 'video', 'end']);
const VOICE_PROVIDERS = new Set(['browser', 'kokoro', 'elevenlabs', 'google', 'recorded']);
const STOP = new Set(('the and for you your this that with from into then its their there are was were will can has have had not but '
  + 'all any our out how what when where which who why use used using step steps here now just also than them they '
  + 'show shows open click select choose next back about after before over under same each more most other some such').split(' '));

const srcList = (src) => (Array.isArray(src) ? src : [src]).filter(Boolean);
const isRemote = (p) => /^(?:[a-z][a-z0-9+.-]*:)/i.test(p);

// Lower-case words of 3+ letters, minus stop words, cut to a 5-letter stem so
// "isolate" and "isolating" count as the same word.
export function tokens(text) {
  return new Set(String(text || '').toLowerCase().split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => (w.length > 5 ? w.slice(0, 5) : w)));
}
const normalise = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function overlap(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (Math.min(A.size, B.size) < 5) return 0;
  let shared = 0;
  A.forEach((w) => { if (B.has(w)) shared += 1; });
  return shared / Math.min(A.size, B.size);
}

function scriptsOf(flow) {
  return (flow.steps || [])
    .map((s, i) => ({ i, text: s && s.voice && s.voice.script ? String(s.voice.script) : '' }))
    .filter((x) => x.text.trim());
}

export function validateFlow(flowDir) {
  const errors = [];
  const warnings = [];
  const file = path.join(flowDir, 'flow.json');
  if (!fs.existsSync(file)) return { errors: [`There is no flow.json in ${flowDir}.`], warnings };
  let flow;
  try {
    flow = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    return { errors: [`flow.json isn't valid JSON: ${err.message}`], warnings };
  }

  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  if (!flow.name) warnings.push('The flow has no "name". It is shown in the player\'s address bar.');
  if (!steps.length) errors.push('The flow has no steps.');
  if (steps.length && steps[0].type !== 'cover') errors.push('The first step must be a cover card (type "cover").');
  if (steps.length && steps[steps.length - 1].type !== 'end') errors.push('The last step must be an end card (type "end").');
  if (flow.aspectRatio != null && !(Number(flow.aspectRatio) > 0)) errors.push('"aspectRatio" must be a positive number (height ÷ width, for example 0.5625).');

  const root = path.resolve(flowDir);
  const outside = (p) => {
    const rel = path.relative(root, path.resolve(root, p));
    return rel.startsWith('..') || path.isAbsolute(rel);
  };
  const missing = (p) => !isRemote(p) && !outside(p) && !fs.existsSync(path.join(flowDir, p));
  const where = (i) => `Step ${i} (${steps[i].type || 'no type'})`;
  const imageSizes = new Map();

  const narratorIds = new Set();
  if (flow.narrators != null) {
    if (!Array.isArray(flow.narrators) || !flow.narrators.length) errors.push('"narrators" must be a list with at least one narrator.');
    else {
      flow.narrators.forEach((n, k) => {
        const id = String(n?.id || '');
        if (!/^[a-z0-9-]+$/.test(id)) errors.push(`Narrator ${k}: "id" must use lower-case letters, numbers and dashes.`);
        else if (narratorIds.has(id)) errors.push(`Narrator ${k}: the id "${id}" is used twice.`);
        narratorIds.add(id);
        if (!VOICE_PROVIDERS.has(String(n?.provider || ''))) errors.push(`Narrator ${k} (${id}): unknown provider "${n?.provider}". Use ${[...VOICE_PROVIDERS].join(', ')}.`);
        if (!n?.label) warnings.push(`Narrator ${k} (${id}): no "label", so the voice menu shows its id.`);
      });
    }
  }

  steps.forEach((s, i) => {
    if (!s || typeof s !== 'object') { errors.push(`Step ${i} isn't an object.`); return; }
    if (!TYPES.has(s.type)) errors.push(`${where(i)}: unknown type. Use cover, image, video or end.`);
    if (i > 0 && s.type === 'cover') warnings.push(`${where(i)}: a cover card in the middle of the flow can only be left with Next.`);
    if (i < steps.length - 1 && s.type === 'end') warnings.push(`${where(i)}: an end card before the last step.`);

    if (s.type === 'image' || s.type === 'video') {
      const list = srcList(s.src);
      if (!list.length) errors.push(`${where(i)}: needs a "src".`);
      list.forEach((f) => {
        if (!isRemote(f) && outside(f)) errors.push(`${where(i)}: src "${f}" must be inside the flow folder.`);
        else if (missing(f)) errors.push(`${where(i)}: src file "${f}" is missing from ${flowDir}.`);
        else if (s.type === 'image' && !isRemote(f)) {
          try { imageSizes.set(f, imageSize(path.join(flowDir, f))); } catch (err) { errors.push(`${where(i)}: ${err.message}`); }
        }
      });
    }
    if (s.voice && s.voice.audio && outside(s.voice.audio)) errors.push(`${where(i)}: voice audio "${s.voice.audio}" must be inside the flow folder.`);
    else if (s.voice && s.voice.audio && missing(s.voice.audio)) errors.push(`${where(i)}: voice audio "${s.voice.audio}" is missing from ${flowDir}.`);
    Object.entries((s.voice && s.voice.variants) || {}).forEach(([id, alt]) => {
      if (!narratorIds.has(id)) errors.push(`${where(i)}: voice variant "${id}" isn't one of the flow's narrators.`);
      if (alt && alt.audio && outside(alt.audio)) errors.push(`${where(i)}: ${id} audio "${alt.audio}" must be inside the flow folder.`);
      else if (alt && alt.audio && missing(alt.audio)) errors.push(`${where(i)}: ${id} audio "${alt.audio}" is missing from ${flowDir}.`);
    });
    if (s.voice && s.voice.timings != null && !Array.isArray(s.voice.timings)) errors.push(`${where(i)}: voice.timings must be a list.`);
    ['logo', 'bg'].forEach((k) => { if (s[k] && missing(s[k])) errors.push(`${where(i)}: ${k} file "${s[k]}" is missing from ${flowDir}.`); });

    if (s.hotspot) {
      const { x, y } = s.hotspot;
      const ok = (v) => typeof v === 'number' && v >= 0 && v <= 1;
      if (!ok(x) || !ok(y)) errors.push(`${where(i)}: hotspot x and y must be numbers from 0 to 1 (got ${JSON.stringify(x)}, ${JSON.stringify(y)}).`);
      if (s.type !== 'image' && s.type !== 'video') warnings.push(`${where(i)}: hotspots only show on image and video steps.`);
    }
    if (s.type === 'image' && s.autoAdvance === false && !s.hotspot && !(Number(s.autoAdvanceAfterMs) > 0)) {
      errors.push(`${where(i)}: this checkpoint has no hotspot, so viewers can only leave it with the Next arrow. Add a hotspot or set "autoAdvance": true.`);
    }
    if (s.type === 'video') {
      const start = Number(s.start) || 0;
      if (s.end != null && !(Number(s.end) > start)) errors.push(`${where(i)}: "end" must be later than "start".`);
    }
  });

  // Hotspots are placed as fractions of the frame, so every screenshot must share one shape.
  const sizes = [...imageSizes.entries()];
  if (sizes.length) {
    const [firstFile, first] = sizes[0];
    sizes.slice(1).forEach(([f, s]) => {
      if (s.width !== first.width || s.height !== first.height) {
        errors.push(`Screenshot "${f}" is ${s.width}×${s.height} but "${firstFile}" is ${first.width}×${first.height}. Every screenshot in a flow must be the same size.`);
      }
    });
    const actual = first.height / first.width;
    if (flow.aspectRatio != null && Math.abs(Number(flow.aspectRatio) - actual) > RATIO_TOLERANCE) {
      errors.push(`"aspectRatio" is ${flow.aspectRatio} but the screenshots are ${Math.round(actual * 10000) / 10000} (height ÷ width).`);
    }
  }

  if (flow.backgroundMusic && flow.backgroundMusic.src && missing(flow.backgroundMusic.src)) {
    errors.push(`backgroundMusic file "${flow.backgroundMusic.src}" is missing from ${flowDir}.`);
  }

  // ---- Copy-paste checks (warnings) ----
  const own = scriptsOf(flow);
  for (let a = 0; a < own.length; a += 1) {
    for (let b = a + 1; b < own.length; b += 1) {
      if (normalise(own[a].text) === normalise(own[b].text)) {
        warnings.push(`Steps ${own[a].i} and ${own[b].i} have the same narration script.`);
      } else if (overlap(own[a].text, own[b].text) >= 0.8) {
        warnings.push(`Steps ${own[a].i} and ${own[b].i} have nearly the same narration script. Check one wasn't copied from the other.`);
      }
    }
  }
  const flowsRoot = path.dirname(path.resolve(flowDir));
  let others = [];
  try {
    others = fs.readdirSync(flowsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory() && path.join(flowsRoot, d.name) !== path.resolve(flowDir))
      .map((d) => path.join(flowsRoot, d.name, 'flow.json'))
      .filter((f) => fs.existsSync(f));
  } catch { /* no sibling flows */ }
  for (const otherFile of others) {
    let other;
    try { other = JSON.parse(fs.readFileSync(otherFile, 'utf8')); } catch { continue; }
    const otherName = path.basename(path.dirname(otherFile));
    for (const mine of own) {
      for (const theirs of scriptsOf(other)) {
        const same = normalise(mine.text) === normalise(theirs.text);
        if (same || overlap(mine.text, theirs.text) >= 0.8) {
          warnings.push(`Step ${mine.i}'s narration ${same ? 'is identical to' : 'closely matches'} step ${theirs.i} in flow "${otherName}". Check it belongs in this flow.`);
        }
      }
    }
  }
  const nameWords = tokens(flow.name);
  if (nameWords.size) {
    const shares = (text) => { const t = tokens(text); return [...t].some((w) => nameWords.has(w)); };
    const cover = steps.find((s) => s && s.type === 'cover');
    if (cover && (cover.title || cover.subtitle) && !shares(`${cover.title || ''} ${cover.subtitle || ''}`)) {
      warnings.push('The cover card shares no words with the flow name. Check it belongs to this flow.');
    }
    const firstNarration = own[0];
    if (firstNarration && !shares(firstNarration.text)) {
      warnings.push(`The first narration (step ${firstNarration.i}) shares no words with the flow name "${flow.name}". Check it introduces this flow, not another one.`);
    }
  }

  return { errors, warnings, flow };
}

// Every folder in flowsRoot that has a flow.json.
export function findFlows(flowsRoot) {
  return fs.readdirSync(flowsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(flowsRoot, d.name, 'flow.json')))
    .map((d) => path.join(flowsRoot, d.name))
    .sort();
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function main() {
  const args = process.argv.slice(2);
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dirs = args.includes('--all') ? findFlows(path.join(ROOT, 'flows')) : args.map((d) => path.resolve(d));
  if (!dirs.length) {
    console.error('Usage: node tools/validate-flow.mjs flows/<flow-id> [...] | --all');
    process.exit(2);
  }
  let failed = 0;
  for (const dir of dirs) {
    const { errors, warnings, flow } = validateFlow(dir);
    const label = flow && flow.id ? flow.id : dir;
    warnings.forEach((w) => console.log(`  warning: ${w}`));
    errors.forEach((e) => console.log(`  error:   ${e}`));
    if (errors.length) failed += 1;
    console.log(`${errors.length ? 'FAIL' : 'PASS'} ${label}: ${plural(flow?.steps?.length ?? 0, 'step')}, ${plural(errors.length, 'error')}, ${plural(warnings.length, 'warning')}.`);
  }
  process.exit(failed ? 1 : 0);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
