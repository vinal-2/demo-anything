#!/usr/bin/env node
// Turns each step's voice.script into narration: assets/vNN.mp3 plus voice.timings.
//
// Providers
//   browser     (default) no files; the player reads the script with the browser's voice
//   kokoro      free and local (npm install kokoro-js); default voice bm_george
//   elevenlabs  ELEVENLABS_API_KEY; voice from ELEVENLABS_VOICE_ID or --voice
//   google      GOOGLE_API_KEY; Chirp 3 HD, default en-GB-Chirp3-HD-Charon
//   recorded    your own voice: put assets/vNN.mp3, .wav or .m4a in the flow and run this
//
// Which narrator: --provider/--voice/--speed, then "narrator" in flow.json, then the
// environment (TTS_PROVIDER, KOKORO_VOICE, ELEVENLABS_VOICE_ID, GOOGLE_TTS_VOICE, TTS_SPEED).
// A flow can instead list several "narrators" ({ id, label, provider, voice, speed }) so
// viewers can switch voice in the player; each is made in turn (--narrator <id> for one).
// Keys live only in .env (never commit it). voice-lexicon.json changes how words are said
// without changing the captions. Unchanged steps are skipped; --force redoes them.
//
// Usage: node tools/make-voice.mjs flows/<id> [--provider p] [--voice v] [--speed 1.0]
//          [--narrator <id>] [--only <step>] [--force] [--align] [--list-voices] [--check-scripts]

import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkFfmpeg, finishAudio } from './lib/audio.mjs';
import { loadDotEnv } from './lib/env.mjs';
import { applyLexicon, checkScript, estimateTimings, mapTimings, PAD_SECONDS, shiftTimings } from './lib/narration.mjs';
import { alignWords, whisperAvailable } from './voice/align.mjs';
import * as elevenlabs from './voice/elevenlabs.mjs';
import * as google from './voice/google.mjs';
import * as kokoro from './voice/kokoro.mjs';

export { wordsFromCharacters } from './voice/elevenlabs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SYNTH = { kokoro, elevenlabs, google };
const PROVIDERS = ['browser', ...Object.keys(SYNTH), 'recorded'];
const VOICE_ENV = { kokoro: 'KOKORO_VOICE', elevenlabs: 'ELEVENLABS_VOICE_ID', google: 'GOOGLE_TTS_VOICE' };
const RECORDED_TYPES = ['.wav', '.m4a', '.mp3', '.ogg', '.flac'];

export function parseArgs(argv) {
  const opts = { force: false, align: false, listVoices: false, checkScripts: false };
  const valueOf = (k) => {
    const v = argv[k + 1];
    if (v === undefined || v.startsWith('--')) throw new Error(`${argv[k]} needs a value.`);
    return v;
  };
  for (let k = 0; k < argv.length; k += 1) {
    const a = argv[k];
    if (a === '--force') opts.force = true;
    else if (a === '--align') opts.align = true;
    else if (a === '--list-voices') opts.listVoices = true;
    else if (a === '--check-scripts') opts.checkScripts = true;
    else if (a === '--provider') { opts.provider = valueOf(k).toLowerCase(); k += 1; }
    else if (a === '--voice') { opts.voice = valueOf(k); k += 1; }
    else if (a === '--speed') { opts.speed = Number(valueOf(k)); k += 1; }
    else if (a === '--only') { opts.only = Number(valueOf(k)); k += 1; }
    else if (a === '--narrator') { opts.narrator = valueOf(k); k += 1; }
    else if (a.startsWith('--')) throw new Error(`Unknown option ${a}.`);
    else opts.dir = a;
  }
  return opts;
}

// Flags first, then the flow's own narrator, then the environment.
export function resolveNarrator(flow, opts, env = process.env) {
  const own = flow?.narrator || {};
  const provider = (opts.provider || own.provider || env.TTS_PROVIDER || 'browser').toLowerCase();
  if (!PROVIDERS.includes(provider)) throw new Error(`Unknown provider "${provider}". Use ${PROVIDERS.join(', ')}.`);
  const sameProvider = !opts.provider || opts.provider === own.provider;
  const voice = opts.voice || (sameProvider ? own.voice : undefined) || env[VOICE_ENV[provider]] || SYNTH[provider]?.DEFAULT_VOICE || '';
  const speed = Number(opts.speed || (sameProvider ? own.speed : undefined) || env.TTS_SPEED || 1);
  if (!(speed > 0)) throw new Error('Speed must be a positive number, such as 1.0.');
  return { provider, voice, speed };
}

// Every narrator to make. A flow can list several in "narrators" so viewers can switch
// voice; the first is the default. Flags only change the default narrator.
export function narratorList(flow, opts, env = process.env) {
  const listed = Array.isArray(flow?.narrators) && flow.narrators.length ? flow.narrators : null;
  if (!listed) return [{ id: 'default', ...resolveNarrator(flow, opts, env) }];
  const seen = new Set();
  return listed.map((n, k) => {
    const id = String(n?.id || '');
    if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`Narrator ids use lower-case letters, numbers and dashes (got "${id}").`);
    if (seen.has(id)) throw new Error(`Two narrators are called "${id}".`);
    seen.add(id);
    return { id, ...resolveNarrator({ narrator: n }, k === 0 ? opts : {}, env) };
  });
}

const sha = (data) => crypto.createHash('sha1').update(data).digest('hex').slice(0, 12);
const pad2 = (i) => String(i).padStart(2, '0');
// The default narrator keeps assets/vNN.mp3; the others use assets/<id>/vNN.mp3.
const audioPath = (i, folder) => (folder ? `assets/${folder}/v${pad2(i)}.mp3` : `assets/v${pad2(i)}.mp3`);
// Where a narrator's audio and timings live inside step.voice.
const slotFor = (v, folder) => {
  if (!folder) return v;
  v.variants ??= {};
  v.variants[folder] ??= {};
  return v.variants[folder];
};

function loadLexicon() {
  const file = path.join(ROOT, 'voice-lexicon.json');
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
}

function narratedSteps(flow, only) {
  const list = flow.steps.map((step, i) => ({ step, i })).filter(({ step }) => step.voice?.script?.trim());
  if (only === undefined) return list;
  const picked = list.filter(({ i }) => i === only);
  if (!picked.length) throw new Error(`Step ${only} has no narration script. Narrated steps: ${list.map(({ i }) => i).join(', ')}.`);
  return picked;
}

// The newest recording for step i: assets/[<narrator>/]vNN.wav, .m4a, .mp3, .ogg or .flac.
function findRecording(dir, i, folder) {
  const base = path.join(dir, 'assets', ...(folder ? [folder] : []), `v${pad2(i)}`);
  return RECORDED_TYPES.map((ext) => base + ext).filter((f) => fs.existsSync(f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
}

async function timingsFor(script, spoken, outFile, durationSec, providerTimings, align) {
  if (providerTimings?.length) return mapTimings(script, shiftTimings(providerTimings, PAD_SECONDS));
  if (align) return mapTimings(script, await alignWords(outFile));
  return mapTimings(script, estimateTimings(spoken, durationSec));
}

async function narrate(flow, dir, opts) {
  const all = narratorList(flow, opts);
  const chosen = opts.narrator ? all.filter((n) => n.id === opts.narrator) : all;
  if (!chosen.length) throw new Error(`No narrator "${opts.narrator}". This flow has: ${all.map((n) => n.id).join(', ')}.`);
  const steps = narratedSteps(flow, opts.only);
  const lexicon = loadLexicon();
  const results = [];
  for (const narrator of chosen) {
    const folder = narrator === all[0] ? '' : narrator.id;
    results.push({ narrator, ...(await narrateOne(steps, dir, narrator, folder, lexicon, opts)) });
  }
  if (!opts.narrator) dropUnlistedVariants(flow, all);
  return results;
}

// Removes variants for narrators no longer listed, and the empty "variants" object.
function dropUnlistedVariants(flow, all) {
  const keep = new Set(all.slice(1).filter((n) => n.provider !== 'browser').map((n) => n.id));
  for (const step of flow.steps) {
    const variants = step.voice?.variants;
    if (!variants) continue;
    for (const id of Object.keys(variants)) if (!keep.has(id)) delete variants[id];
    if (!Object.keys(variants).length) delete step.voice.variants;
  }
}

async function narrateOne(steps, dir, narrator, folder, lexicon, opts) {
  const { provider, voice, speed } = narrator;
  if (provider === 'browser') {
    // The player reads these with the browser's voice; only the default narrator stores anything.
    if (!folder) for (const { step } of steps) Object.assign(step.voice, { audio: null, timings: [], hash: sha(`browser|${step.voice.script}`) });
    return { made: folder ? 0 : steps.length, skipped: 0 };
  }
  await checkFfmpeg();
  if (opts.align && !(await whisperAvailable())) throw new Error('--align needs Whisper: pip install faster-whisper');

  let made = 0;
  let skipped = 0;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-voice-'));
  try {
    for (const { step, i } of steps) {
      const v = step.voice;
      const slot = slotFor(v, folder);
      const rel = audioPath(i, folder);
      const out = path.join(dir, rel);
      const spoken = applyLexicon(v.script, lexicon);
      const label = `  step ${i}${folder ? ` (${folder})` : ''}`;
      let raw;
      let providerTimings = null;

      if (provider === 'recorded') {
        const source = findRecording(dir, i, folder);
        if (!source) { console.log(`${label}: no recording (add ${rel}, .wav or .m4a), skipped`); skipped += 1; continue; }
        if (!opts.force && slot.hash === sha(fs.readFileSync(source)) && slot.audio === rel) { skipped += 1; continue; }
        raw = path.join(work, `in${path.extname(source)}`);
        fs.copyFileSync(source, raw);
      } else {
        const hash = sha(`${provider}|${voice}|${speed}|${spoken}`);
        if (!opts.force && slot.hash === hash && slot.audio === rel && fs.existsSync(out)) { skipped += 1; continue; }
        raw = path.join(work, `raw-${i}${provider === 'kokoro' ? '.wav' : '.mp3'}`);
        process.stdout.write(`${label}: ${provider} ${voice} … `);
        ({ timings: providerTimings } = await SYNTH[provider].synth(spoken, { voice, speed }, raw));
      }

      fs.mkdirSync(path.dirname(out), { recursive: true });
      const finished = path.join(work, `out-${i}.mp3`);
      const length = await finishAudio(raw, finished);
      fs.copyFileSync(finished, out);
      slot.timings = await timingsFor(v.script, spoken, out, length, providerTimings, opts.align);
      slot.audio = rel;
      slot.hash = provider === 'recorded' ? sha(fs.readFileSync(out)) : sha(`${provider}|${voice}|${speed}|${spoken}`);
      if (provider === 'recorded') console.log(`${label}: recorded, ${length.toFixed(1)} s`);
      else console.log(`${length.toFixed(1)} s, ${slot.timings.length} words timed`);
      made += 1;
    }
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
  return { made, skipped };
}

function printScriptChecks(flow) {
  let problems = 0;
  for (const { step, i } of narratedSteps(flow)) {
    const result = checkScript(step.voice.script);
    if (!result) continue;
    problems += 1;
    console.log(`Step ${i}: ${result.issues.join('; ')}`);
    console.log(`  now:       ${step.voice.script}`);
    console.log(`  suggested: ${result.suggestion}`);
  }
  console.log(problems ? `${problems} script${problems === 1 ? '' : 's'} to look at. Nothing was changed.` : 'Every script reads well aloud.');
}

async function main() {
  loadDotEnv(ROOT);
  const opts = parseArgs(process.argv.slice(2));
  if (opts.listVoices) {
    const provider = (opts.provider || process.env.TTS_PROVIDER || '').toLowerCase();
    if (!SYNTH[provider]) throw new Error(`--list-voices needs --provider ${Object.keys(SYNTH).join(', ')}.`);
    const voices = await SYNTH[provider].listVoices();
    voices.forEach((v) => console.log(`${v.name.padEnd(36)} ${v.id}`));
    console.log(`${voices.length} British English voice${voices.length === 1 ? '' : 's'} for ${provider}.`);
    return;
  }
  const dir = path.resolve(opts.dir || path.join(ROOT, 'flows', 'example'));
  const file = path.join(dir, 'flow.json');
  const flow = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (opts.checkScripts) return printScriptChecks(flow);

  const results = await narrate(flow, dir, opts);
  fs.writeFileSync(file, `${JSON.stringify(flow, null, 2)}\n`);
  for (const { narrator, made, skipped } of results) {
    const who = narrator.provider === 'browser' ? 'browser voice' : `${narrator.provider} ${narrator.voice} at ${narrator.speed}×`;
    const name = narrator.id === 'default' ? '' : `${narrator.id}: `;
    console.log(`${name}${who}: updated ${made} step${made === 1 ? '' : 's'}, skipped ${skipped} unchanged.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
  });
}
