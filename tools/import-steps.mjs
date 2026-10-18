#!/usr/bin/env node
// Turns a capture folder (screenshots + steps.json, as written by the Claude in Chrome capture prompt)
// into a playable flow: cover, then for each step a narration step and a checkpoint on the same
// screenshot, then an end card. Pixel boxes become hotspot centres as 0–1 fractions.
//
// Usage: node tools/import-steps.mjs <capture-folder> flows/<new-id> [--name "Flow name"] [--force]
//
// steps.json can be a list or { "steps": [...] }. Each entry may use any of these field names:
//   step | n | number                     order
//   screen | title | screenTitle          screen title
//   element | elementClicked | clicked    what to click (becomes the hotspot label)
//   box | bbox | rect                     { x, y, width|w, height|h } in screenshot pixels
//   why | reason                          one line on why (narration when "say" is missing)
//   say | narration | script              narration script (optional)
//   image | file | screenshot | shot      image path inside the capture folder (optional)
// Without an image field, the importer looks for shots/NN-*.png (or .jpg) matching the step number.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize } from './lib/image-size.mjs';
import { validateFlow } from './validate-flow.mjs';

export { imageSize };

const pick = (obj, keys) => { for (const k of keys) if (obj[k] != null && obj[k] !== '') return obj[k]; return undefined; };
const r4 = (n) => Math.round(n * 10000) / 10000;

function findShot(captureDir, n, explicit) {
  if (explicit) {
    const f = path.resolve(captureDir, explicit);
    if (!fs.existsSync(f)) throw new Error(`Step ${n}: image "${explicit}" isn't in ${captureDir}.`);
    return f;
  }
  const shotsDir = fs.existsSync(path.join(captureDir, 'shots')) ? path.join(captureDir, 'shots') : captureDir;
  const prefix = String(n).padStart(2, '0');
  const match = fs.readdirSync(shotsDir).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort()
    .find((f) => f.startsWith(`${prefix}-`) || f.startsWith(`${prefix}.`) || f.startsWith(`${prefix}_`));
  if (!match) throw new Error(`Step ${n}: no screenshot named ${prefix}-*.png in ${path.relative(process.cwd(), shotsDir) || shotsDir}.`);
  return path.join(shotsDir, match);
}

export function importSteps(captureDir, flowDir, { name, force = false } = {}) {
  const stepsFile = path.join(captureDir, 'steps.json');
  if (!fs.existsSync(stepsFile)) throw new Error(`There is no steps.json in ${captureDir}.`);
  const raw = JSON.parse(fs.readFileSync(stepsFile, 'utf8'));
  const entries = (Array.isArray(raw) ? raw : raw.steps || []).slice();
  if (!entries.length) throw new Error('steps.json has no steps.');
  if (fs.existsSync(path.join(flowDir, 'flow.json')) && !force) {
    throw new Error(`${path.join(flowDir, 'flow.json')} already exists. Pass --force to replace it.`);
  }

  entries.forEach((e, k) => { e.__n = Number(pick(e, ['step', 'n', 'number'])) || k + 1; });
  entries.sort((a, b) => a.__n - b.__n);

  const id = path.basename(path.resolve(flowDir));
  const assets = path.join(flowDir, 'assets');
  fs.mkdirSync(assets, { recursive: true });
  const flowName = name || (raw && raw.name) || id.replace(/[-_]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

  const steps = [{
    type: 'cover',
    title: flowName,
    subtitle: (raw && raw.subtitle) || '',
    buttonText: 'Get Started',
    logo: null,
    logoText: '',
    bg: null,
    align: 'left',
  }];

  let frame;
  for (const e of entries) {
    const n = e.__n;
    const shot = findShot(captureDir, n, pick(e, ['image', 'file', 'screenshot', 'shot']));
    const { width, height } = imageSize(shot);
    frame ??= { width, height };
    if (width !== frame.width || height !== frame.height) {
      throw new Error(`Step ${n}: ${path.basename(shot)} is ${width}×${height} but the first screenshot is ${frame.width}×${frame.height}. Every screenshot must be the same size.`);
    }
    const fileName = path.basename(shot);
    fs.copyFileSync(shot, path.join(assets, fileName));
    const src = `assets/${fileName}`;

    const box = pick(e, ['box', 'bbox', 'rect']);
    if (!box) throw new Error(`Step ${n}: no box. Each step needs { x, y, width, height } in screenshot pixels.`);
    const bw = Number(box.width ?? box.w);
    const bh = Number(box.height ?? box.h);
    const bx = Number(box.x);
    const by = Number(box.y);
    if (![bw, bh, bx, by].every(Number.isFinite)) throw new Error(`Step ${n}: the box needs numeric x, y, width and height.`);
    const x = r4((bx + bw / 2) / width);
    const y = r4((by + bh / 2) / height);
    if (x < 0 || x > 1 || y < 0 || y > 1) throw new Error(`Step ${n}: the box centre falls outside the ${width}×${height} screenshot.`);

    const element = String(pick(e, ['element', 'elementClicked', 'clicked', 'target']) || '').trim();
    const why = String(pick(e, ['why', 'reason']) || '').trim();
    const say = String(pick(e, ['say', 'narration', 'script']) || '').trim() || why;
    const title = String(pick(e, ['screen', 'title', 'screenTitle']) || '').trim();

    if (say) {
      steps.push({ type: 'image', src, voice: { script: say, audio: null, timings: [] }, hotspot: null, autoAdvance: true });
    }
    steps.push({
      type: 'image',
      src,
      ...(title ? { alt: `${title} screen` } : {}),
      hotspot: { x, y, size: 40, style: 'pulsating', label: element },
      autoAdvance: false,
    });
  }

  steps.push({
    type: 'end',
    title: 'Thank you for watching!',
    subtitle: '',
    buttons: [{ text: 'Replay', action: 'restart' }],
  });

  const flow = {
    id,
    name: flowName,
    font: 'Inter',
    aspectRatio: r4(frame.height / frame.width),
    theme: { brand: '#0E676C', brandText: '#FFFFFF', hotspot: '#D06A12' },
    showBackNextButtons: true,
    keyboardNav: true,
    backgroundMusic: { src: null, volume: 0.1 },
    steps,
  };
  fs.writeFileSync(path.join(flowDir, 'flow.json'), `${JSON.stringify(flow, null, 2)}\n`);
  return flow;
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const nameAt = args.indexOf('--name');
  const name = nameAt > -1 ? args[nameAt + 1] : undefined;
  const positional = args.filter((a, k) => !a.startsWith('--') && !(nameAt > -1 && k === nameAt + 1));
  if (positional.length < 2) {
    console.error('Usage: node tools/import-steps.mjs <capture-folder> flows/<new-id> [--name "Flow name"] [--force]');
    process.exit(2);
  }
  const [captureDir, flowDir] = positional.map((p) => path.resolve(p));
  try {
    const flow = importSteps(captureDir, flowDir, { name, force });
    console.log(`Wrote ${path.relative(process.cwd(), path.join(flowDir, 'flow.json'))} with ${flow.steps.length} steps.`);
  } catch (err) {
    console.error(err.message || err);
    process.exit(1);
  }
  const { errors, warnings } = validateFlow(flowDir);
  warnings.forEach((w) => console.log(`  warning: ${w}`));
  errors.forEach((e) => console.log(`  error:   ${e}`));
  if (errors.length) process.exit(1);
  console.log(`PASS: open ?flow=${path.basename(flowDir)} to play it, or ?flow=${path.basename(flowDir)}&edit to adjust it.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
